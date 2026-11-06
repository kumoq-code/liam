export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || !(await removeEvent(id))) {
    throw createError({ statusCode: 404, statusMessage: 'Registro no encontrado' })
  }
  return { ok: true }
})
