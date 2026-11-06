// Protege la app con una pantalla de login si se define NUXT_AUTH_PASSWORD
const PUBLIC = ['/login', '/api/auth/', '/api/health', '/_nuxt/', '/__nuxt', '/favicon', '/logo', '/apple-touch-icon']

export default defineEventHandler((event) => {
  if (!authEnabled()) return
  const path = getRequestURL(event).pathname
  if (PUBLIC.some((p) => path.startsWith(p))) return
  if (isAuthenticated(event)) return

  if (path.startsWith('/api/')) {
    throw createError({ statusCode: 401, statusMessage: 'Sesión caducada, vuelve a entrar' })
  }
  return sendRedirect(event, `/login?redirect=${encodeURIComponent(path)}`, 302)
})
