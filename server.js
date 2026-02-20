/**
 * Production server — serves dist/ static files + POST /api/chat proxy.
 * Run after `npm run build`:  node server.js
 * Reads ANTHROPIC_API_KEY from environment (never exposed to the client).
 */
import { createServer } from 'http'
import { request as httpsRequest } from 'https'
import { readFile } from 'fs/promises'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DIST = join(__dirname, 'dist')
const PORT = process.env.PORT ?? 3000
const API_KEY = process.env.ANTHROPIC_API_KEY ?? ''

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function handleChat(req, res) {
  if (!API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY not configured on server' } }))
    return
  }

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
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
        },
      },
      proxyRes => {
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' })
        proxyRes.pipe(res)
      }
    )
    proxyReq.on('error', err => {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: `Proxy error: ${err.message}` } }))
    })
    proxyReq.write(body)
    proxyReq.end()
  })
}

async function handleStatic(req, res) {
  const urlPath = req.url.split('?')[0]
  const filePath = join(DIST, urlPath === '/' ? 'index.html' : urlPath)
  try {
    const data = await readFile(filePath)
    const mime = MIME[extname(filePath)] ?? 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': mime })
    res.end(data)
  } catch {
    // SPA fallback
    try {
      const html = await readFile(join(DIST, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  }
}

createServer((req, res) => {
  if (req.url === '/api/chat' && req.method === 'POST') {
    handleChat(req, res)
  } else {
    handleStatic(req, res)
  }
}).listen(PORT, () => {
  console.log(`Vibedrawing server running at http://localhost:${PORT}`)
  if (!API_KEY) console.warn('  WARNING: ANTHROPIC_API_KEY is not set — AI Chat will return errors')
})
