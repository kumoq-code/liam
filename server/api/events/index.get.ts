export default defineEventHandler(async (event) => {
  const { from, to, type } = getQuery(event)
  const parse = (v: unknown) => {
    if (typeof v !== 'string' || !v) return undefined
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? undefined : d
  }
  const events = await listEvents(parse(from), parse(to))
  return typeof type === 'string' && type ? events.filter((e) => e.type === type) : events
})
