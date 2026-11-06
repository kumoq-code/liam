import { promises as fs } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

export type EventType = 'bottle' | 'breast' | 'diaper' | 'growth'
export type BreastSide = 'left' | 'right' | 'both'

export interface BabyEvent {
  id: string
  type: EventType
  time: string // ISO (en lactancia: inicio de la toma)
  endTime?: string // ISO, fin de la toma de pecho (si se registró inicio y fin)
  duration?: number // minutos (lactancia materna)
  side?: BreastSide // pecho usado
  amount?: number // ml (biberón)
  wet?: boolean // pañal mojado
  dirty?: boolean // pañal manchado
  weight?: number // kg (crecimiento)
  height?: number // cm (crecimiento)
  note?: string
  createdAt: string
}

let cache: BabyEvent[] | null = null
let queue: Promise<unknown> = Promise.resolve()

function filePath() {
  const { dataDir } = useRuntimeConfig()
  return join(resolve(dataDir), 'events.json')
}

async function load(): Promise<BabyEvent[]> {
  if (cache) return cache
  try {
    cache = JSON.parse(await fs.readFile(filePath(), 'utf8')) as BabyEvent[]
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err
    cache = []
  }
  return cache
}

async function persist(events: BabyEvent[]) {
  const file = filePath()
  await fs.mkdir(resolve(file, '..'), { recursive: true })
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, JSON.stringify(events, null, 2))
  await fs.rename(tmp, file)
}

// Serializa las escrituras para evitar condiciones de carrera
function mutate<T>(fn: (events: BabyEvent[]) => T): Promise<T> {
  const run = queue.then(async () => {
    const events = await load()
    const result = fn(events)
    await persist(events)
    return result
  })
  queue = run.catch(() => {})
  return run
}

export async function listEvents(from?: Date, to?: Date) {
  const events = await load()
  return events
    .filter((e) => {
      const t = new Date(e.time).getTime()
      return (!from || t >= from.getTime()) && (!to || t < to.getTime())
    })
    .sort((a, b) => b.time.localeCompare(a.time))
}

export function addEvent(input: Omit<BabyEvent, 'id' | 'createdAt'>) {
  return mutate((events) => {
    const ev: BabyEvent = { ...input, id: randomUUID(), createdAt: new Date().toISOString() }
    events.push(ev)
    return ev
  })
}

export function removeEvent(id: string) {
  return mutate((events) => {
    const idx = events.findIndex((e) => e.id === id)
    if (idx === -1) return false
    events.splice(idx, 1)
    return true
  })
}
