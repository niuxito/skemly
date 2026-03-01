/**
 * Shared auth utilities for all serverless endpoints.
 */
import bcryptjs from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomInt } from 'crypto'

const JWT_EXPIRES = '7d'

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

export function getUserFromRequest(req) {
  const auth = req.headers['authorization'] ?? req.headers['Authorization'] ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  return verifyToken(token)
}
