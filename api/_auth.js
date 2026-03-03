/**
 * Shared auth utilities for all serverless endpoints.
 */
import bcryptjs from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomInt } from 'crypto'

const JWT_EXPIRES = '7d'
const COOKIE_NAME = 'vibediag_token'

function getSecret() {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET env var not set')
  return s
}

export async function hashPassword(plain) {
  return bcryptjs.hash(plain, 10)
}

export async function comparePassword(plain, hash) {
  return bcryptjs.compare(plain, hash)
}

export function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: JWT_EXPIRES })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret())
  } catch {
    return null
  }
}

export function generateOtp() {
  return String(randomInt(100000, 1000000))
}

/**
 * Sets an HttpOnly auth cookie on the response.
 * Secure flag only in production (HTTPS required).
 */
export function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production'
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; ${isProd ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=604800`,
  )
}

/**
 * Clears the auth cookie.
 */
export function clearAuthCookie(res) {
  const isProd = process.env.NODE_ENV === 'production'
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; ${isProd ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=0`,
  )
}

/**
 * Extracts and verifies the JWT from the request.
 * Reads the HttpOnly cookie first; falls back to Bearer header for API clients.
 */
export function getUserFromRequest(req) {
  // 1. Try HttpOnly cookie (preferred)
  const cookieHeader = req.headers['cookie'] ?? ''
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)vibediag_token=([^;]+)/)
  const cookieToken = cookieMatch?.[1] ?? null

  // 2. Fall back to Bearer header (for API clients / backward compat)
  const auth = req.headers['authorization'] ?? req.headers['Authorization'] ?? ''
  const bearerToken = auth.startsWith('Bearer ') ? auth.slice(7) : null

  const token = cookieToken ?? bearerToken
  if (!token) return null
  return verifyToken(token)
}
