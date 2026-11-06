<script setup lang="ts">
import type { DayPoint } from '~/components/MlLineChart.vue'

useHead({ title: 'Panel · Liam' })

interface BabyEvent {
  id: string
  type: 'bottle' | 'breast' | 'diaper' | 'growth'
  time: string
  endTime?: string
  duration?: number
  side?: 'left' | 'right' | 'both'
  amount?: number
  wet?: boolean
  dirty?: boolean
  weight?: number
  height?: number
}

const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
const parseDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, m! - 1, d || 1)
}

const today = new Date()
const todayKey = dateKey(today)

// --- Filtros ---
const month = ref(monthKey(today))
const day = ref('') // vacío = todo el mes

watch(day, (d) => {
  if (d && d.slice(0, 7) !== month.value) month.value = d.slice(0, 7)
})
watch(month, (m) => {
  if (day.value && day.value.slice(0, 7) !== m) day.value = ''
})

function shiftMonth(delta: number) {
  const d = parseDate(month.value)
  d.setMonth(d.getMonth() + delta)
  month.value = monthKey(d)
}
const isCurrentMonth = computed(() => month.value === monthKey(today))
const monthLabel = computed(() =>
  parseDate(month.value).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
)

// --- Datos ---
const monthEvents = ref<BabyEvent[]>([])
const weekEvents = ref<BabyEvent[]>([])
const growth = ref<BabyEvent[]>([])
const loading = ref(false)
const error = ref('')

function handleError(e: any, msg: string) {
  if (e?.statusCode === 401 || e?.response?.status === 401) return window.location.replace('/login')
  error.value = e?.data?.statusMessage || msg
}

async function fetchRange(from: Date, to: Date) {
  return $fetch<BabyEvent[]>('/api/events', { query: { from: from.toISOString(), to: to.toISOString() } })
}

async function loadMonth() {
  loading.value = true
  try {
    const from = parseDate(month.value)
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 1)
    monthEvents.value = await fetchRange(from, to)
  } catch (e) {
    handleError(e, 'No se pudieron cargar los datos del mes')
  } finally {
    loading.value = false
  }
}

// Semana actual: lunes a domingo
const weekStart = (() => {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
})()

async function loadWeek() {
  try {
    const to = new Date(weekStart)
    to.setDate(to.getDate() + 7)
    weekEvents.value = await fetchRange(weekStart, to)
  } catch (e) {
    handleError(e, 'No se pudieron cargar los datos de la semana')
  }
}

async function loadGrowth() {
  try {
    growth.value = await $fetch<BabyEvent[]>('/api/events', { query: { type: 'growth' } })
  } catch (e) {
    handleError(e, 'No se pudo cargar el crecimiento')
  }
}

watch(month, loadMonth)
onMounted(() => Promise.all([loadMonth(), loadWeek(), loadGrowth()]))

// --- Agregados por día ---
interface DayStats {
  ml: number
  feeds: number
  breast: number // tomas de pecho
  breastMin: number // minutos de pecho
  wet: number
  dirty: number
}
const empty: DayStats = { ml: 0, feeds: 0, breast: 0, breastMin: 0, wet: 0, dirty: 0 }

function aggregate(events: BabyEvent[]) {
  const map = new Map<string, DayStats>()
  for (const e of events) {
    const k = dateKey(new Date(e.time))
    const s = map.get(k) || { ...empty }
    if (e.type === 'bottle') {
      s.ml += e.amount || 0
      s.feeds++
    } else if (e.type === 'breast') {
      s.breast++
      s.breastMin += e.duration || 0
    } else if (e.type === 'diaper') {
      if (e.wet) s.wet++
      if (e.dirty) s.dirty++
    }
    map.set(k, s)
  }
  return map
}

const monthStats = computed(() => aggregate(monthEvents.value))

const points = computed<DayPoint[]>(() => {
  const first = parseDate(month.value)
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  return Array.from({ length: days }, (_, i) => {
    const date = dateKey(new Date(first.getFullYear(), first.getMonth(), i + 1))
    const s = monthStats.value.get(date) || empty
    return { day: i + 1, date, ml: date > todayKey ? null : s.ml, feeds: s.feeds }
  })
})

// Resumen (mes completo o día filtrado)
const summary = computed(() => {
  if (day.value) {
    const s = monthStats.value.get(day.value) || empty
    return { ...s, avgDay: null as number | null, avgFeed: s.feeds ? Math.round(s.ml / s.feeds) : 0 }
  }
  const elapsed = points.value.filter((p) => p.ml !== null)
  const tot = [...monthStats.value.values()].reduce(
    (a, s) => ({
      ml: a.ml + s.ml,
      feeds: a.feeds + s.feeds,
      breast: a.breast + s.breast,
      breastMin: a.breastMin + s.breastMin,
      wet: a.wet + s.wet,
      dirty: a.dirty + s.dirty,
    }),
    { ...empty },
  )
  // Media diaria sobre días con alguna toma registrada
  const withData = elapsed.filter((p) => (p.ml ?? 0) > 0).length
  return {
    ...tot,
    avgDay: withData ? Math.round(tot.ml / withData) : 0,
    avgFeed: tot.feeds ? Math.round(tot.ml / tot.feeds) : 0,
  }
})

const dayLabel = computed(() =>
  day.value
    ? parseDate(day.value).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    : '',
)
const dayFeeds = computed(() =>
  day.value
    ? monthEvents.value
        .filter((e) => (e.type === 'bottle' || e.type === 'breast') && dateKey(new Date(e.time)) === day.value)
        .sort((a, b) => a.time.localeCompare(b.time))
    : [],
)

// --- Mejor y peor día de la semana actual ---
const weekRanking = computed(() => {
  const stats = aggregate(weekEvents.value)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    const k = dateKey(d)
    return { key: k, date: d, ...(stats.get(k) || empty) }
  })
  // Solo días completos (hasta ayer); si es lunes, se usa el día de hoy
  let pool = days.filter((d) => d.key < todayKey)
  const partial = pool.length === 0
  if (partial) pool = days.filter((d) => d.key === todayKey)
  pool = pool.filter((d) => d.feeds > 0)
  if (!pool.length) return null
  const best = pool.reduce((a, b) => (b.ml > a.ml ? b : a))
  const worst = pool.reduce((a, b) => (b.ml < a.ml ? b : a))
  return { best, worst, partial, count: pool.length }
})
const sideShort = { left: 'Izq.', right: 'Der.', both: 'Ambos' } as const
const weekdayName = (d: Date) => d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })

// --- Crecimiento ---
const growthDate = ref(todayKey)
const weight = ref<number | null>(null)
const height = ref<number | null>(null)
const savingGrowth = ref(false)

const lastWeight = computed(() => growth.value.find((g) => g.weight != null))
const lastHeight = computed(() => growth.value.find((g) => g.height != null))

async function addGrowth() {
  error.value = ''
  if (!weight.value && !height.value) {
    error.value = 'Indica el peso y/o la altura'
    return
  }
  savingGrowth.value = true
  try {
    const d = parseDate(growthDate.value)
    d.setHours(12, 0, 0, 0)
    await $fetch('/api/events', {
      method: 'POST',
      body: { type: 'growth', time: d.toISOString(), weight: weight.value || undefined, height: height.value || undefined },
    })
    weight.value = null
    height.value = null
    await loadGrowth()
  } catch (e) {
    handleError(e, 'No se pudo guardar la medida')
  } finally {
    savingGrowth.value = false
  }
}

async function removeGrowth(g: BabyEvent) {
  if (!confirm('¿Eliminar esta medida?')) return
  try {
    await $fetch(`/api/events/${g.id}`, { method: 'DELETE' })
    growth.value = growth.value.filter((x) => x.id !== g.id)
  } catch (e) {
    handleError(e, 'No se pudo eliminar')
  }
}

const fmtShort = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtTime = (iso: string) => {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fmtKg = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: 3 })
const fmtCm = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: 1 })

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-200'
</script>

<template>
  <div class="min-h-dvh bg-gradient-to-b from-pink-50 to-sky-50 text-slate-800">
    <div class="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <AppHeader />

      <!-- Error -->
      <div
        v-if="error"
        class="mb-4 flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
      >
        <span>{{ error }}</span>
        <button class="ml-3 font-bold" @click="error = ''">×</button>
      </div>

      <!-- Filtros -->
      <section class="mb-5 flex flex-wrap items-end gap-3 rounded-2xl bg-white/80 p-3 shadow-sm ring-1 ring-slate-200">
        <div class="flex items-center gap-1">
          <button class="rounded-lg px-2.5 py-2 text-lg hover:bg-slate-100" aria-label="Mes anterior" @click="shiftMonth(-1)">‹</button>
          <label class="block">
            <span class="mb-1 block text-xs text-slate-500">Mes</span>
            <input v-model="month" type="month" :max="monthKey(today)" :class="inputClass" @change="!month && (month = monthKey(today))" />
          </label>
          <button
            class="rounded-lg px-2.5 py-2 text-lg hover:bg-slate-100 disabled:opacity-30"
            aria-label="Mes siguiente"
            :disabled="isCurrentMonth"
            @click="shiftMonth(1)"
          >
            ›
          </button>
        </div>
        <label class="block">
          <span class="mb-1 block text-xs text-slate-500">Día</span>
          <input v-model="day" type="date" :max="todayKey" :class="inputClass" />
        </label>
        <button
          v-if="day"
          class="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
          @click="day = ''"
        >
          Ver todo el mes
        </button>
      </section>

      <!-- Resumen -->
      <h2 class="mb-2 text-sm font-medium text-slate-500 first-letter:uppercase">
        {{ day ? dayLabel : monthLabel }}
      </h2>
      <section class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p class="text-xs font-medium uppercase text-slate-500">🍼 Biberón</p>
          <p class="mt-1 text-2xl font-bold">{{ summary.ml.toLocaleString('es-ES') }}<span class="text-sm font-medium text-slate-500"> ml</span></p>
          <p class="text-xs text-slate-400">{{ summary.feeds }} tomas</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p class="text-xs font-medium uppercase text-slate-500">🤱 Pecho</p>
          <p class="mt-1 text-2xl font-bold">{{ summary.breastMin.toLocaleString('es-ES') }}<span class="text-sm font-medium text-slate-500"> min</span></p>
          <p class="text-xs text-slate-400">
            {{ summary.breast }} tomas{{ summary.breast ? ` · ${Math.round(summary.breastMin / summary.breast)} min/toma` : '' }}
          </p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p class="text-xs font-medium uppercase text-slate-500">{{ day ? 'Por biberón' : 'Media diaria' }}</p>
          <p class="mt-1 text-2xl font-bold">
            {{ day ? summary.avgFeed : summary.avgDay }}<span class="text-sm font-medium text-slate-500"> ml</span>
          </p>
          <p v-if="!day" class="text-xs text-slate-400">{{ summary.avgFeed }} ml por biberón</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p class="text-xs font-medium uppercase text-slate-500">💧 Mojados</p>
          <p class="mt-1 text-2xl font-bold">{{ summary.wet }}</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p class="text-xs font-medium uppercase text-slate-500">💩 Manchados</p>
          <p class="mt-1 text-2xl font-bold">{{ summary.dirty }}</p>
        </div>
      </section>

      <!-- Gráfico -->
      <section class="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div class="mb-2 flex items-baseline justify-between">
          <h2 class="font-semibold">ml tomados por día</h2>
          <span class="text-xs text-slate-400">Toca un día para filtrarlo</span>
        </div>
        <p v-if="loading" class="py-16 text-center text-sm text-slate-400">Cargando…</p>
        <MlLineChart v-else :points="points" :selected="day" @select="day = $event" />
        <details class="mt-2 text-sm">
          <summary class="cursor-pointer text-xs text-slate-400 hover:text-slate-600">Ver tabla</summary>
          <table class="mt-2 w-full text-left text-xs">
            <thead class="text-slate-500">
              <tr><th class="py-1 font-medium">Día</th><th class="py-1 text-right font-medium">Tomas</th><th class="py-1 text-right font-medium">ml</th></tr>
            </thead>
            <tbody>
              <tr v-for="p in points.filter((p) => p.ml !== null)" :key="p.date" class="border-t border-slate-100">
                <td class="py-1">{{ p.day }}</td>
                <td class="py-1 text-right tabular-nums">{{ p.feeds }}</td>
                <td class="py-1 text-right tabular-nums">{{ p.ml }}</td>
              </tr>
            </tbody>
          </table>
        </details>
      </section>

      <!-- Tomas del día filtrado -->
      <section v-if="day" class="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 class="mb-3 font-semibold">Tomas del día</h2>
        <p v-if="!dayFeeds.length" class="text-sm text-slate-400">Sin tomas registradas</p>
        <div v-else class="flex flex-wrap gap-2">
          <span
            v-for="f in dayFeeds"
            :key="f.id"
            class="rounded-full px-3 py-1 text-sm ring-1"
            :class="f.type === 'breast' ? 'bg-rose-50 ring-rose-100' : 'bg-pink-50 ring-pink-100'"
          >
            <span class="font-mono text-slate-500">{{ fmtTime(f.time) }}</span>
            <span v-if="f.type === 'bottle'" class="ml-1.5 font-semibold text-pink-700">🍼 {{ f.amount }} ml</span>
            <span v-else class="ml-1.5 font-semibold text-rose-700">
              🤱 {{ f.duration }} min<span v-if="f.side" class="font-normal text-rose-500"> · {{ sideShort[f.side] }}</span>
            </span>
          </span>
        </div>
      </section>

      <!-- Mejor / peor día de la semana -->
      <section class="mb-5">
        <h2 class="mb-2 font-semibold">Esta semana</h2>
        <p v-if="!weekRanking" class="rounded-2xl bg-white/60 p-4 text-sm text-slate-400 ring-1 ring-slate-200">
          Aún no hay tomas registradas esta semana
        </p>
        <div v-else class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-emerald-200">
            <p class="flex items-center gap-1.5 text-xs font-medium uppercase text-emerald-700">▲ Mejor día</p>
            <p class="mt-1 text-2xl font-bold">{{ weekRanking.best.ml }}<span class="text-sm font-medium text-slate-500"> ml</span></p>
            <p class="text-sm text-slate-500 first-letter:uppercase">{{ weekdayName(weekRanking.best.date) }} · {{ weekRanking.best.feeds }} tomas</p>
          </div>
          <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-amber-200">
            <p class="flex items-center gap-1.5 text-xs font-medium uppercase text-amber-700">▼ Peor día</p>
            <p class="mt-1 text-2xl font-bold">{{ weekRanking.worst.ml }}<span class="text-sm font-medium text-slate-500"> ml</span></p>
            <p class="text-sm text-slate-500 first-letter:uppercase">{{ weekdayName(weekRanking.worst.date) }} · {{ weekRanking.worst.feeds }} tomas</p>
          </div>
        </div>
        <p v-if="weekRanking" class="mt-2 text-xs text-slate-400">
          {{ weekRanking.partial ? 'Basado en el día de hoy (aún en curso).' : 'Basado en los días completos de la semana (lunes a ayer).' }}
        </p>
      </section>

      <!-- Crecimiento -->
      <section class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 class="mb-3 font-semibold">📏 Peso y altura</h2>

        <div class="mb-4 grid grid-cols-2 gap-3">
          <div class="rounded-xl bg-violet-50 p-3 ring-1 ring-violet-100">
            <p class="text-xs font-medium uppercase text-violet-700">Último peso</p>
            <p class="mt-0.5 text-xl font-bold">{{ lastWeight ? `${fmtKg(lastWeight.weight!)} kg` : '—' }}</p>
            <p v-if="lastWeight" class="text-xs text-slate-500">{{ fmtShort(lastWeight.time) }}</p>
          </div>
          <div class="rounded-xl bg-teal-50 p-3 ring-1 ring-teal-100">
            <p class="text-xs font-medium uppercase text-teal-700">Última altura</p>
            <p class="mt-0.5 text-xl font-bold">{{ lastHeight ? `${fmtCm(lastHeight.height!)} cm` : '—' }}</p>
            <p v-if="lastHeight" class="text-xs text-slate-500">{{ fmtShort(lastHeight.time) }}</p>
          </div>
        </div>

        <form class="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:items-end" @submit.prevent="addGrowth">
          <label class="col-span-2 block sm:col-span-1">
            <span class="mb-1 block text-xs text-slate-500">Fecha</span>
            <input v-model="growthDate" type="date" :max="todayKey" required :class="inputClass" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-slate-500">Peso (kg)</span>
            <input v-model.number="weight" type="number" step="0.01" min="0.3" max="40" inputmode="decimal" placeholder="4,25" :class="inputClass" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-slate-500">Altura (cm)</span>
            <input v-model.number="height" type="number" step="0.1" min="20" max="150" inputmode="decimal" placeholder="54,5" :class="inputClass" />
          </label>
          <button
            type="submit"
            :disabled="savingGrowth"
            class="col-span-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50 sm:col-span-1"
          >
            Guardar medida
          </button>
        </form>

        <ul v-if="growth.length" class="mt-4 divide-y divide-slate-100 text-sm">
          <li v-for="g in growth" :key="g.id" class="flex items-center gap-3 py-2">
            <span class="w-28 text-slate-500">{{ fmtShort(g.time) }}</span>
            <span class="flex-1">
              <span v-if="g.weight != null" class="mr-3 font-medium">{{ fmtKg(g.weight) }} kg</span>
              <span v-if="g.height != null" class="font-medium">{{ fmtCm(g.height) }} cm</span>
            </span>
            <button
              class="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
              aria-label="Eliminar medida"
              @click="removeGrowth(g)"
            >
              ✕
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
