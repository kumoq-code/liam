// Limitador sencillo de intentos fallidos por IP
const failures = new Map<string, { count: number; until: number }>()

export default defineEventHandler(async (event) => {
  const { authUser, authPassword } = useRuntimeConfig()
  if (!authPassword) return { ok: true }

  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const f = failures.get(ip)
  if (f && f.count >= 5 && f.until > Date.now()) {
    throw createError({ statusCode: 429, statusMessage: 'Demasiados intentos. Espera unos minutos.' })
  }

  const body = await readBody<{ user?: string; password?: string }>(event)
  const userOk = !authUser || safeEqual(String(body?.user ?? '').trim(), authUser)
  const passOk = safeEqual(String(body?.password ?? ''), authPassword)

  if (!userOk || !passOk) {
    const count = (f && f.until > Date.now() ? f.count : 0) + 1
    failures.set(ip, { count, until: Date.now() + 5 * 60_000 })
    await new Promise((r) => setTimeout(r, 600))
    throw createError({ statusCode: 401, statusMessage: 'Usuario o contraseña incorrectos' })
  }

  failures.delete(ip)
  createSession(event)
  return { ok: true }
})
