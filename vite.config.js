import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { request as httpsRequest } from 'https'
import { checkRateLimit } from './api/_rateLimit.js'

function anthropicProxyPlugin(apiKey, databaseUrl, dailyLimit) {
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

        // ─── Proxy to Anthropic ─────────────────────────────────────────────
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          const proxyReq = httpsRequest(
            {
              hostname: 'api.anthropic.com',
              path: '/v1/messages',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              },
            },
            proxyRes => {
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
          proxyReq.write(body)
          proxyReq.end()
        })
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
      ),
    ],
  }
})
