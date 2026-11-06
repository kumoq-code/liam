export default defineEventHandler((event) => ({
  enabled: authEnabled(),
  needsUser: Boolean(useRuntimeConfig().authUser),
  authenticated: isAuthenticated(event),
}))
