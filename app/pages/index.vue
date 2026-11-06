<script setup lang="ts">
interface BabyEvent {
  id: string
  type: 'bottle' | 'diaper'
  time: string
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
    events.value = all.filter((e) => e.type === 'bottle' || e.type === 'diaper')
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
  timer = setInterval(() => (now.value = new Date()), 30_000)
})
onBeforeUnmount(() => clearInterval(timer))

// --- Resumen ---
const bottles = computed(() => events.value.filter((e) => e.type === 'bottle'))
const diapers = computed(() => events.value.filter((e) => e.type === 'diaper'))
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
const lastBottle = computed(() => (isToday.value ? bottles.value[0] : undefined))

// --- Formularios ---
const bottleAmount = ref<number | null>(90)
const bottleTime = ref('')
const diaperWet = ref(true)
const diaperDirty = ref(false)
const diaperTime = ref('')
const quickAmounts = [30, 60, 90, 120, 150, 180]

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
          <p class="text-xs font-medium uppercase text-slate-500">Tomas</p>
          <p class="mt-1 text-2xl font-bold text-pink-600">{{ bottles.length }}</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p class="text-xs font-medium uppercase text-slate-500">Total</p>
          <p class="mt-1 text-2xl font-bold text-pink-600">{{ totalMl }}<span class="text-sm font-medium"> ml</span></p>
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
          {{ lastBottle ? `${formatTime(lastBottle.time)} (${sinceLabel(lastBottle.time)})` : 'ninguna todavía' }}
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
            <span class="text-xl">{{ ev.type === 'bottle' ? '🍼' : '🧷' }}</span>
            <span class="flex-1">
              <template v-if="ev.type === 'bottle'">
                <span class="font-semibold text-pink-600">{{ ev.amount }} ml</span>
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
