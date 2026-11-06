<script setup lang="ts">
interface BabyEvent {
  id: string
  type: 'bottle' | 'breast' | 'diaper'
  time: string
  endTime?: string
  duration?: number
  side?: 'left' | 'right' | 'both'
  amount?: number
  wet?: boolean
  dirty?: boolean
  note?: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

const selectedDate = ref(toDateInput(new Date()))
const events = ref<BabyEvent[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const now = ref(new Date())

const isToday = computed(() => selectedDate.value === toDateInput(now.value))

const dayLabel = computed(() => {
  const [y, m, d] = selectedDate.value.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  if (isToday.value) return 'Hoy'
  const yesterday = new Date(now.value)
  yesterday.setDate(yesterday.getDate() - 1)
  if (selectedDate.value === toDateInput(yesterday)) return 'Ayer'
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
})

function dayRange(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const from = new Date(y!, m! - 1, d!)
  const to = new Date(y!, m! - 1, d! + 1)
  return { from, to }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { from, to } = dayRange(selectedDate.value)
    const all = await $fetch<BabyEvent[]>('/api/events', {
      query: { from: from.toISOString(), to: to.toISOString() },
    })
    events.value = all.filter((e) => e.type === 'bottle' || e.type === 'breast' || e.type === 'diaper')
  } catch (e: any) {
    if (handleAuthError(e)) return
    error.value = e?.statusMessage || 'No se pudieron cargar los registros'
  } finally {
    loading.value = false
  }
}

function shiftDay(delta: number) {
  const { from } = dayRange(selectedDate.value)
  from.setDate(from.getDate() + delta)
  selectedDate.value = toDateInput(from)
}

watch(selectedDate, load)

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  load()
  timer = setInterval(() => (now.value = new Date()), 1_000)
  try {
    const saved = JSON.parse(localStorage.getItem(TIMER_KEY) || 'null')
    if (saved?.start && !Number.isNaN(new Date(saved.start).getTime())) {
      timerStart.value = saved.start
      breastSide.value = saved.side ?? null
      breastMode.value = 'range'
    }
  } catch {}
})
onBeforeUnmount(() => clearInterval(timer))

// --- Resumen ---
const bottles = computed(() => events.value.filter((e) => e.type === 'bottle'))
const diapers = computed(() => events.value.filter((e) => e.type === 'diaper'))
const breasts = computed(() => events.value.filter((e) => e.type === 'breast'))
const breastMinutes = computed(() => breasts.value.reduce((s, e) => s + (e.duration || 0), 0))
const totalMl = computed(() => bottles.value.reduce((s, e) => s + (e.amount || 0), 0))
const wetCount = computed(() => diapers.value.filter((e) => e.wet).length)
const dirtyCount = computed(() => diapers.value.filter((e) => e.dirty).length)

function sinceLabel(iso?: string) {
  if (!iso) return '—'
  const mins = Math.max(0, Math.round((now.value.getTime() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'ahora mismo'
  if (mins < 60) return `hace ${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `hace ${h} h${m ? ` ${m} min` : ''}`
}
const lastFeed = computed(() =>
  isToday.value ? events.value.find((e) => e.type === 'bottle' || e.type === 'breast') : undefined,
)
const feedLabel = (e: BabyEvent) => (e.type === 'bottle' ? `biberón ${e.amount} ml` : `pecho ${e.duration} min`)

// --- Formularios ---
const bottleAmount = ref<number | null>(90)
const bottleTime = ref('')
const diaperWet = ref(true)
const diaperDirty = ref(false)
const diaperTime = ref('')
const quickAmounts = [30, 60, 90, 120, 150, 180]

// --- Lactancia materna ---
type Side = 'left' | 'right' | 'both'
const TIMER_KEY = 'liam_breast_timer'
const sideOptions: { value: Side; label: string }[] = [
  { value: 'left', label: 'Izquierdo' },
  { value: 'right', label: 'Derecho' },
  { value: 'both', label: 'Ambos' },
]
const sideLabel = (s?: Side) => sideOptions.find((o) => o.value === s)?.label
const breastMode = ref<'manual' | 'range'>('manual')
const breastSide = ref<Side | null>(null)
const breastMinutesInput = ref<number | null>(15)
const breastTime = ref('') // modo manual: hora de inicio
const breastStart = ref('') // modo inicio/fin
const breastEnd = ref('')
const quickMinutes = [5, 10, 15, 20, 30, 40]
const timerStart = ref<string | null>(null) // ISO del cronómetro en marcha

const timerElapsed = computed(() => {
  if (!timerStart.value) return ''
  const secs = Math.max(0, Math.floor((now.value.getTime() - new Date(timerStart.value).getTime()) / 1000))
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h ? `${h}:` : ''}${pad(m)}:${pad(secs % 60)}`
})

const rangeMinutes = computed(() => {
  if (!breastStart.value || !breastEnd.value) return null
  const [sh, sm] = breastStart.value.split(':').map(Number)
  const [eh, em] = breastEnd.value.split(':').map(Number)
  let mins = eh! * 60 + em! - (sh! * 60 + sm!)
  if (mins <= 0) mins += 24 * 60 // cruza la medianoche
  return mins
})

function persistTimer() {
  try {
    if (timerStart.value) localStorage.setItem(TIMER_KEY, JSON.stringify({ start: timerStart.value, side: breastSide.value }))
    else localStorage.removeItem(TIMER_KEY)
  } catch {}
}
watch(breastSide, () => timerStart.value && persistTimer())

function startTimer() {
  error.value = ''
  timerStart.value = new Date().toISOString()
  persistTimer()
}

function cancelTimer() {
  if (!confirm('¿Descartar el cronómetro en marcha?')) return
  timerStart.value = null
  persistTimer()
}

async function stopTimer() {
  if (!timerStart.value) return
  const end = new Date()
  if (end.getTime() - new Date(timerStart.value).getTime() < 30_000) {
    error.value = 'La toma ha durado menos de 30 segundos'
    return
  }
  const ok = await save({
    type: 'breast',
    time: timerStart.value,
    endTime: end.toISOString(),
    side: breastSide.value ?? undefined,
  })
  if (ok) {
    timerStart.value = null
    breastSide.value = null
    persistTimer()
    selectedDate.value = toDateInput(new Date())
  }
}

async function addBreast() {
  let payload: Record<string, unknown>
  if (breastMode.value === 'manual') {
    const mins = breastMinutesInput.value
    if (!mins || mins <= 0) {
      error.value = 'Indica los minutos de la toma'
      return
    }
    let time = buildTime(breastTime.value)
    // Sin hora y en el día de hoy: la toma acaba de terminar
    if (!breastTime.value && isToday.value) time = new Date(Date.now() - mins * 60000).toISOString()
    payload = { type: 'breast', time, duration: mins }
  } else {
    if (!breastStart.value || !breastEnd.value) {
      error.value = 'Indica la hora de inicio y de fin'
      return
    }
    const start = new Date(buildTime(breastStart.value))
    const end = new Date(start.getTime() + rangeMinutes.value! * 60000)
    payload = { type: 'breast', time: start.toISOString(), endTime: end.toISOString() }
  }
  if (await save({ ...payload, side: breastSide.value ?? undefined })) {
    breastTime.value = ''
    breastStart.value = ''
    breastEnd.value = ''
    breastSide.value = null
  }
}

function setNow(target: 'start' | 'end') {
  const t = toTimeInput(new Date())
  if (target === 'start') breastStart.value = t
  else breastEnd.value = t
}

function buildTime(time: string) {
  const { from } = dayRange(selectedDate.value)
  const base = isToday.value && !time ? new Date() : from
  if (time) {
    const [h, m] = time.split(':').map(Number)
    base.setHours(h!, m!, 0, 0)
  } else if (!isToday.value) {
    base.setHours(12, 0, 0, 0)
  }
  return base.toISOString()
}

async function save(payload: Record<string, unknown>) {
  saving.value = true
  error.value = ''
  try {
    await $fetch('/api/events', { method: 'POST', body: payload })
    await load()
    return true
  } catch (e: any) {
    if (handleAuthError(e)) return false
    error.value = e?.data?.statusMessage || e?.statusMessage || 'No se pudo guardar'
    return false
  } finally {
    saving.value = false
  }
}

async function addBottle() {
  if (!bottleAmount.value || bottleAmount.value <= 0) {
    error.value = 'Indica la cantidad en ml'
    return
  }
  if (await save({ type: 'bottle', amount: bottleAmount.value, time: buildTime(bottleTime.value) })) {
    bottleTime.value = ''
  }
}

async function addDiaper() {
  if (!diaperWet.value && !diaperDirty.value) {
    error.value = 'Marca mojado y/o manchado'
    return
  }
  if (
    await save({
      type: 'diaper',
      wet: diaperWet.value,
      dirty: diaperDirty.value,
      time: buildTime(diaperTime.value),
    })
  ) {
    diaperTime.value = ''
    diaperWet.value = true
    diaperDirty.value = false
  }
}

async function remove(ev: BabyEvent) {
  if (!confirm('¿Eliminar este registro?')) return
  try {
    await $fetch(`/api/events/${ev.id}`, { method: 'DELETE' })
    events.value = events.value.filter((e) => e.id !== ev.id)
  } catch {
    error.value = 'No se pudo eliminar'
  }
}

// Si la sesión caduca, volver al login
function handleAuthError(e: any) {
  if (e?.statusCode === 401 || e?.response?.status === 401) {
    window.location.replace('/login')
    return true
  }
  return false
}

const formatTime = (iso: string) => toTimeInput(new Date(iso))
</script>

<template>
  <div class="min-h-dvh bg-gradient-to-b from-pink-50 to-sky-50 text-slate-800">
    <div class="mx-auto max-w-xl px-4 pb-16 pt-6">
      <!-- Cabecera -->
      <AppHeader />

      <!-- Selector de día -->
      <div class="mb-5 flex items-center justify-between rounded-2xl bg-white/80 p-2 shadow-sm ring-1 ring-slate-200">
        <button
          class="rounded-xl px-3 py-2 text-lg hover:bg-slate-100"
          aria-label="Día anterior"
          @click="shiftDay(-1)"
        >
          ‹
        </button>
        <label class="relative flex flex-col items-center">
          <span class="font-semibold capitalize">{{ dayLabel }}</span>
          <input
            v-model="selectedDate"
            type="date"
            class="absolute inset-0 cursor-pointer opacity-0"
            :max="toDateInput(now)"
          />
          <span class="text-xs text-slate-400">{{ selectedDate.split('-').reverse().join('/') }}</span>
        </label>
        <button
          class="rounded-xl px-3 py-2 text-lg hover:bg-slate-100 disabled:opacity-30"
          aria-label="Día siguiente"
          :disabled="isToday"
          @click="shiftDay(1)"
        >
          ›
        </button>
      </div>

      <!-- Resumen -->
      <section class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p class="text-xs font-medium uppercase text-slate-500">Biberones</p>
          <p class="mt-1 text-2xl font-bold text-pink-600">{{ bottles.length }}</p>
          <p class="text-xs text-slate-400">{{ totalMl }} ml</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p class="text-xs font-medium uppercase text-slate-500">Pecho</p>
          <p class="mt-1 text-2xl font-bold text-rose-600">{{ breasts.length }}</p>
          <p class="text-xs text-slate-400">{{ breastMinutes }} min</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p class="text-xs font-medium uppercase text-slate-500">Mojados</p>
          <p class="mt-1 text-2xl font-bold text-sky-600">{{ wetCount }}</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p class="text-xs font-medium uppercase text-slate-500">Manchados</p>
          <p class="mt-1 text-2xl font-bold text-amber-600">{{ dirtyCount }}</p>
        </div>
      </section>

      <p v-if="isToday" class="mb-5 text-center text-sm text-slate-500">
        Última toma:
        <span class="font-medium text-slate-700">
          {{ lastFeed ? `${formatTime(lastFeed.time)} · ${feedLabel(lastFeed)} (${sinceLabel(lastFeed.endTime || lastFeed.time)})` : 'ninguna todavía' }}
        </span>
      </p>

      <!-- Error -->
      <div
        v-if="error"
        class="mb-4 flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
      >
        <span>{{ error }}</span>
        <button class="ml-3 font-bold" @click="error = ''">×</button>
      </div>

      <!-- Nueva toma -->
      <section class="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 class="mb-3 font-semibold">🍼 Nueva toma</h2>
        <div class="mb-3 flex flex-wrap gap-2">
          <button
            v-for="q in quickAmounts"
            :key="q"
            class="rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition"
            :class="
              bottleAmount === q
                ? 'bg-pink-500 text-white ring-pink-500'
                : 'bg-white text-slate-600 ring-slate-200 hover:bg-pink-50'
            "
            @click="bottleAmount = q"
          >
            {{ q }} ml
          </button>
        </div>
        <div class="flex gap-2">
          <label class="flex-1">
            <span class="mb-1 block text-xs text-slate-500">Cantidad (ml)</span>
            <input
              v-model.number="bottleAmount"
              type="number"
              min="1"
              max="1000"
              inputmode="numeric"
              class="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-200"
            />
          </label>
          <label class="flex-1">
            <span class="mb-1 block text-xs text-slate-500">Hora {{ isToday ? '(vacío = ahora)' : '' }}</span>
            <input
              v-model="bottleTime"
              type="time"
              class="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-200"
            />
          </label>
        </div>
        <button
          class="mt-3 w-full rounded-xl bg-pink-500 py-3 font-semibold text-white shadow-sm transition hover:bg-pink-600 disabled:opacity-50"
          :disabled="saving"
          @click="addBottle"
        >
          Registrar toma
        </button>
      </section>

      <!-- Lactancia materna -->
      <section class="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 class="mb-3 font-semibold">🤱 Lactancia materna</h2>

        <!-- Pecho -->
        <div class="mb-3 grid grid-cols-3 gap-2">
          <button
            v-for="o in sideOptions"
            :key="o.value"
            class="rounded-xl py-2 text-sm font-medium ring-1 transition"
            :class="
              breastSide === o.value
                ? 'bg-rose-500 text-white ring-rose-500'
                : 'bg-white text-slate-600 ring-slate-200 hover:bg-rose-50'
            "
            @click="breastSide = breastSide === o.value ? null : o.value"
          >
            {{ o.label }}
          </button>
        </div>

        <!-- Cronómetro en marcha -->
        <div v-if="timerStart" class="rounded-xl bg-rose-50 p-4 text-center ring-1 ring-rose-100">
          <p class="text-xs font-medium uppercase text-rose-700">Toma en curso · desde {{ formatTime(timerStart) }}</p>
          <p class="my-1 font-mono text-4xl font-bold tabular-nums text-rose-600">{{ timerElapsed }}</p>
          <div class="mt-3 flex gap-2">
            <button
              class="flex-1 rounded-xl bg-rose-500 py-3 font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-50"
              :disabled="saving"
              @click="stopTimer"
            >
              ⏹ Terminar y guardar
            </button>
            <button
              class="rounded-xl px-4 py-3 text-sm font-medium text-slate-500 ring-1 ring-slate-200 hover:bg-white"
              @click="cancelTimer"
            >
              Descartar
            </button>
          </div>
        </div>

        <template v-else>
          <!-- Modo -->
          <div class="mb-3 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-medium">
            <button
              class="rounded-lg py-1.5 transition"
              :class="breastMode === 'manual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'"
              @click="breastMode = 'manual'"
            >
              Tiempo a mano
            </button>
            <button
              class="rounded-lg py-1.5 transition"
              :class="breastMode === 'range' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'"
              @click="breastMode = 'range'"
            >
              Inicio y fin
            </button>
          </div>

          <template v-if="breastMode === 'manual'">
            <div class="mb-3 flex flex-wrap gap-2">
              <button
                v-for="q in quickMinutes"
                :key="q"
                class="rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition"
                :class="
                  breastMinutesInput === q
                    ? 'bg-rose-500 text-white ring-rose-500'
                    : 'bg-white text-slate-600 ring-slate-200 hover:bg-rose-50'
                "
                @click="breastMinutesInput = q"
              >
                {{ q }} min
              </button>
            </div>
            <div class="flex gap-2">
              <label class="flex-1">
                <span class="mb-1 block text-xs text-slate-500">Duración (min)</span>
                <input
                  v-model.number="breastMinutesInput"
                  type="number"
                  min="1"
                  max="240"
                  inputmode="numeric"
                  class="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
              </label>
              <label class="flex-1">
                <span class="mb-1 block text-xs text-slate-500">
                  Hora inicio {{ isToday ? '(vacío = acaba de terminar)' : '' }}
                </span>
                <input
                  v-model="breastTime"
                  type="time"
                  class="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
              </label>
            </div>
          </template>

          <template v-else>
            <button
              v-if="isToday"
              class="mb-3 w-full rounded-xl py-3 font-semibold text-rose-600 ring-1 ring-rose-300 transition hover:bg-rose-50"
              @click="startTimer"
            >
              ▶ Empezar ahora (cronómetro)
            </button>
            <div class="flex gap-2">
              <div class="flex-1">
                <span class="mb-1 flex items-center justify-between text-xs text-slate-500">
                  Inicio
                  <button v-if="isToday" type="button" class="font-medium text-rose-500" @click="setNow('start')">ahora</button>
                </span>
                <input
                  v-model="breastStart"
                  type="time"
                  aria-label="Hora de inicio"
                  class="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
              </div>
              <div class="flex-1">
                <span class="mb-1 flex items-center justify-between text-xs text-slate-500">
                  Fin
                  <button v-if="isToday" type="button" class="font-medium text-rose-500" @click="setNow('end')">ahora</button>
                </span>
                <input
                  v-model="breastEnd"
                  type="time"
                  aria-label="Hora de fin"
                  class="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
              </div>
            </div>
            <p v-if="rangeMinutes" class="mt-2 text-center text-sm text-slate-500">
              Duración: <span class="font-semibold text-rose-600">{{ rangeMinutes }} min</span>
            </p>
          </template>

          <button
            class="mt-3 w-full rounded-xl bg-rose-500 py-3 font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-50"
            :disabled="saving"
            @click="addBreast"
          >
            Registrar toma de pecho
          </button>
        </template>
      </section>

      <!-- Nuevo pañal -->
      <section class="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 class="mb-3 font-semibold">🧷 Cambio de pañal</h2>
        <div class="mb-3 grid grid-cols-2 gap-2">
          <button
            class="rounded-xl py-3 font-medium ring-1 transition"
            :class="diaperWet ? 'bg-sky-500 text-white ring-sky-500' : 'bg-white text-slate-600 ring-slate-200 hover:bg-sky-50'"
            @click="diaperWet = !diaperWet"
          >
            💧 Mojado
          </button>
          <button
            class="rounded-xl py-3 font-medium ring-1 transition"
            :class="
              diaperDirty ? 'bg-amber-500 text-white ring-amber-500' : 'bg-white text-slate-600 ring-slate-200 hover:bg-amber-50'
            "
            @click="diaperDirty = !diaperDirty"
          >
            💩 Manchado
          </button>
        </div>
        <label class="block">
          <span class="mb-1 block text-xs text-slate-500">Hora {{ isToday ? '(vacío = ahora)' : '' }}</span>
          <input
            v-model="diaperTime"
            type="time"
            class="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </label>
        <button
          class="mt-3 w-full rounded-xl bg-sky-500 py-3 font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:opacity-50"
          :disabled="saving"
          @click="addDiaper"
        >
          Registrar pañal
        </button>
      </section>

      <!-- Historial del día -->
      <section>
        <h2 class="mb-3 font-semibold">Registros del día</h2>
        <p v-if="loading" class="text-center text-sm text-slate-400">Cargando…</p>
        <p v-else-if="!events.length" class="rounded-2xl bg-white/60 p-6 text-center text-sm text-slate-400 ring-1 ring-slate-200">
          No hay registros este día
        </p>
        <ul v-else class="space-y-2">
          <li
            v-for="ev in events"
            :key="ev.id"
            class="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200"
          >
            <span class="w-12 font-mono text-sm text-slate-500">{{ formatTime(ev.time) }}</span>
            <span class="text-xl">{{ ev.type === 'bottle' ? '🍼' : ev.type === 'breast' ? '🤱' : '🧷' }}</span>
            <span class="flex-1">
              <template v-if="ev.type === 'bottle'">
                <span class="font-semibold text-pink-600">{{ ev.amount }} ml</span>
              </template>
              <template v-else-if="ev.type === 'breast'">
                <span class="font-semibold text-rose-600">{{ ev.duration }} min</span>
                <span v-if="ev.endTime" class="ml-1.5 text-xs text-slate-400">hasta {{ formatTime(ev.endTime) }}</span>
                <span v-if="ev.side" class="ml-1.5 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">{{ sideLabel(ev.side) }}</span>
              </template>
              <template v-else>
                <span v-if="ev.wet" class="mr-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">Mojado</span>
                <span v-if="ev.dirty" class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Manchado</span>
              </template>
            </span>
            <button
              class="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
              aria-label="Eliminar"
              @click="remove(ev)"
            >
              ✕
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
