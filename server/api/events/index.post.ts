export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event)
  const type = body?.type
  const time = new Date(typeof body?.time === 'string' ? body.time : Date.now())

  if (Number.isNaN(time.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Fecha/hora no válida' })
  }
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : undefined

  if (type === 'bottle') {
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) {
      throw createError({ statusCode: 400, statusMessage: 'Cantidad (ml) no válida' })
    }
    return addEvent({ type, time: time.toISOString(), amount: Math.round(amount), note })
  }

  if (type === 'diaper') {
    const wet = Boolean(body.wet)
    const dirty = Boolean(body.dirty)
    if (!wet && !dirty) {
      throw createError({ statusCode: 400, statusMessage: 'Indica si el pañal está mojado y/o manchado' })
    }
    return addEvent({ type, time: time.toISOString(), wet, dirty, note })
  }

  if (type === 'growth') {
    const num = (v: unknown) => (v === '' || v == null ? undefined : Number(v))
    const weight = num(body.weight)
    const height = num(body.height)
    if (weight === undefined && height === undefined) {
      throw createError({ statusCode: 400, statusMessage: 'Indica el peso y/o la altura' })
    }
    if (weight !== undefined && !(weight > 0.3 && weight < 40)) {
      throw createError({ statusCode: 400, statusMessage: 'Peso no válido (kg)' })
    }
    if (height !== undefined && !(height > 20 && height < 150)) {
      throw createError({ statusCode: 400, statusMessage: 'Altura no válida (cm)' })
    }
    return addEvent({
      type,
      time: time.toISOString(),
      weight: weight !== undefined ? Math.round(weight * 1000) / 1000 : undefined,
      height: height !== undefined ? Math.round(height * 10) / 10 : undefined,
      note,
    })
  }

  throw createError({ statusCode: 400, statusMessage: 'Tipo de registro no válido' })
})
