import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { request as httpsRequest } from 'https'
import { checkRateLimit, checkFileRateLimit, incrementFileCount } from './api/_rateLimit.js'
import { buildAnthropicBody } from './api/_buildAnthropicBody.js'

function anthropicProxyPlugin(apiKey, databaseUrl, dailyLimit, fileDailyLimit, fileMaxSize) {
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

        // ─── Proxy to Anthropic ─────────────────────────────────────────────
        const anthropicBody = JSON.stringify(buildAnthropicBody(parsedBody))
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

  return {
    plugins: [
      react(),
      tailwindcss(),
      anthropicProxyPlugin(
        env.ANTHROPIC_API_KEY,
        env.DATABASE_URL,
        parseInt(env.DAILY_LIMIT ?? '20', 10),
        parseInt(env.FILE_DAILY_LIMIT_ANON ?? '5', 10),
        parseInt(env.FILE_MAX_SIZE_ANON ?? String(2 * 1024 * 1024), 10),
      ),
    ],
  }
})
