import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { request as httpsRequest } from 'https'
import { checkRateLimit, checkFileRateLimit, incrementFileCount } from './api/_rateLimit.js'
import { buildAnthropicBody } from './api/_buildAnthropicBody.js'
import registerHandler from './api/auth/register.js'
import loginHandler from './api/auth/login.js'
import meHandler from './api/auth/me.js'
import verifyOtpHandler from './api/auth/verify-otp.js'
import resendVerificationHandler from './api/auth/resend-verification.js'
import shareHandler from './api/share.js'

/**
 * Wraps Vite's raw Node http req/res into the Vercel-style interface
 * expected by the auth handler functions.
 */
async function runAuthHandler(handler, req, res) {
  // Parse body
  let rawBody = ''
  req.on('data', chunk => { rawBody += chunk })
  await new Promise(resolve => req.on('end', resolve))
  let body = {}
  try { body = rawBody ? JSON.parse(rawBody) : {} } catch { /* ignore */ }

  // Vercel-style response shim
  let statusCode = 200
  const vercelRes = {
    status(code) { statusCode = code; return vercelRes },
    json(data) {
      res.statusCode = statusCode
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(data))
    },
  }

  const vercelReq = { method: req.method, headers: req.headers, body }

  try {
    await handler(vercelReq, vercelRes)
  } catch (err) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: err.message ?? 'Internal server error' }))
  }
}

function sharePlugin() {
  return {
    name: 'share-proxy',
    configureServer(server) {
      server.middlewares.use('/api/share', (req, res) => {
        // Parse query string for GET requests
        const url = new URL(req.url, 'http://x')
        const query = Object.fromEntries(url.searchParams.entries())
        runAuthHandler(
          (vReq, vRes) => shareHandler({ ...vReq, query }, vRes),
          req,
          res,
        )
      })
    },
  }
}

function authPlugin() {
  return {
    name: 'auth-proxy',
    configureServer(server) {
      server.middlewares.use('/api/auth/register',             (req, res) => runAuthHandler(registerHandler,            req, res))
      server.middlewares.use('/api/auth/login',                (req, res) => runAuthHandler(loginHandler,               req, res))
      server.middlewares.use('/api/auth/me',                   (req, res) => runAuthHandler(meHandler,                  req, res))
      server.middlewares.use('/api/auth/verify-otp',           (req, res) => runAuthHandler(verifyOtpHandler,           req, res))
      server.middlewares.use('/api/auth/resend-verification',  (req, res) => runAuthHandler(resendVerificationHandler,  req, res))
    },
  }
}

function anthropicProxyPlugin(apiKey, databaseUrl, dailyLimit, fileDailyLimit, fileMaxSize, models) {
  return {
    name: 'anthropic-proxy',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        if (!apiKey) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY not set on server' } }))
          return
        }

        // ─── Rate limiting ──────────────────────────────────────────────────
        const ip = (req.headers['x-forwarded-for'] ?? '127.0.0.1').split(',')[0].trim()
        const rl = await checkRateLimit({ ip, databaseUrl, dailyLimit })

        if (!rl.allowed) {
          res.statusCode = 429
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            error: {
              type: 'rate_limit_exceeded',
              limit: rl.limit,
              reset_at: rl.resetAt,
              remaining: 0,
            },
          }))
          return
        }

        if (rl.remaining !== null) {
          res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
        }

        // ─── Buffer and parse body ──────────────────────────────────────────
        let rawBody = ''
        req.on('data', chunk => { rawBody += chunk })
        await new Promise(resolve => req.on('end', resolve))

        let parsedBody
        try {
          parsedBody = JSON.parse(rawBody)
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: { message: 'Invalid JSON body' } }))
          return
        }

        // ─── File attachment validation & rate limiting ─────────────────────
        const { attachment } = parsedBody
        if (attachment) {
          if (attachment.size > fileMaxSize) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              error: {
                type: 'file_too_large',
                message: `El fichero supera el límite de ${Math.round(fileMaxSize / 1024 / 1024)} MB.`,
              },
            }))
            return
          }

          const frl = await checkFileRateLimit({ ip, databaseUrl, dailyLimit: fileDailyLimit })
          if (!frl.allowed) {
            res.statusCode = 429
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              error: {
                type: 'file_rate_limit_exceeded',
                limit: frl.limit,
                reset_at: frl.resetAt,
                remaining: 0,
              },
            }))
            return
          }

          if (frl.remaining !== null) {
            res.setHeader('X-FileRateLimit-Remaining', String(frl.remaining))
          }
        }

        // ─── Model selection (first-shot vs edit) ───────────────────────────
        const selectedModel = parsedBody.isFirstShot ? models.firstShot : models.edit
        const builtBody = buildAnthropicBody(parsedBody)
        builtBody.model = selectedModel

        // ─── Proxy to Anthropic ─────────────────────────────────────────────
        const anthropicBody = JSON.stringify(builtBody)
        const isPdf = parsedBody.attachment?.mediaType === 'application/pdf'

        const proxyReq = httpsRequest(
          {
            hostname: 'api.anthropic.com',
            path: '/v1/messages',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(anthropicBody),
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              ...(isPdf ? { 'anthropic-beta': 'pdfs-2024-09-25' } : {}),
            },
          },
          proxyRes => {
            // Only charge the file counter when Anthropic actually accepted the file
            if (parsedBody.attachment && proxyRes.statusCode < 300) {
              incrementFileCount({ ip, databaseUrl }).catch(() => {})
            }
            res.statusCode = proxyRes.statusCode
            res.setHeader('Content-Type', 'application/json')
            proxyRes.pipe(res)
          }
        )
        proxyReq.on('error', err => {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: { message: `Proxy error: ${err.message}` } }))
        })
        proxyReq.write(anthropicBody)
        proxyReq.end()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // loadEnv with '' prefix loads ALL variables (not just VITE_ ones)
  const env = loadEnv(mode, process.cwd(), '')

  // Expose server-side env vars to API handlers running inside the dev server.
  // (loadEnv returns an object but does NOT mutate process.env)
  process.env.DATABASE_URL  = process.env.DATABASE_URL  ?? env.DATABASE_URL
  process.env.JWT_SECRET    = process.env.JWT_SECRET    ?? env.JWT_SECRET
  process.env.RESEND_API_KEY = process.env.RESEND_API_KEY ?? env.RESEND_API_KEY
  process.env.FROM_EMAIL    = process.env.FROM_EMAIL    ?? env.FROM_EMAIL

  return {
    plugins: [
      react(),
      tailwindcss(),
      authPlugin(),
      sharePlugin(),
      anthropicProxyPlugin(
        env.ANTHROPIC_API_KEY,
        env.DATABASE_URL,
        parseInt(env.DAILY_LIMIT ?? '20', 10),
        parseInt(env.FILE_DAILY_LIMIT_ANON ?? '5', 10),
        parseInt(env.FILE_MAX_SIZE_ANON ?? String(2 * 1024 * 1024), 10),
        {
          firstShot: env.AI_MODEL_FIRSTSHOT ?? 'claude-sonnet-4-6',
          edit: env.AI_MODEL_EDIT ?? 'claude-haiku-4-5-20251001',
          pro: env.AI_MODEL_PRO ?? 'claude-sonnet-4-6',
        },
      ),
    ],
  }
})
