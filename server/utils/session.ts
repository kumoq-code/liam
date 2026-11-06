import { createHmac, createHash, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

export const SESSION_COOKIE = 'liam_session'
const MAX_AGE = 60 * 60 * 24 * 60 // 60 días

function secret() {
  const { authUser, authPassword, sessionSecret } = useRuntimeConfig()
  // Cambiar la contraseña invalida todas las sesiones abiertas
  return createHash('sha256').update(`${sessionSecret}|${authUser}|${authPassword}`).digest()
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url')

export function safeEqual(a: string, b: string) {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export function authEnabled() {
  return Boolean(useRuntimeConfig().authPassword)
}

export function isAuthenticated(event: H3Event) {
  if (!authEnabled()) return true
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return false
  const [exp, sig] = token.split('.')
  if (!exp || !sig || Number(exp) < Date.now()) return false
  return safeEqual(sig, sign(exp))
}

export function createSession(event: H3Event) {
  const exp = String(Date.now() + MAX_AGE * 1000)
  setCookie(event, SESSION_COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getRequestProtocol(event, { xForwardedProto: true }) === 'https',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export function destroySession(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}
