<script setup lang="ts">
export interface DayPoint {
  day: number // 1..31
  date: string // YYYY-MM-DD
  ml: number | null // null = día futuro
  feeds: number
}

const props = defineProps<{ points: DayPoint[]; selected?: string }>()
const emit = defineEmits<{ select: [date: string] }>()

// Geometría (viewBox; el SVG escala al ancho del contenedor)
const W = 640
const H = 240
const M = { top: 16, right: 12, bottom: 28, left: 44 }
const iw = W - M.left - M.right
const ih = H - M.top - M.bottom

const maxMl = computed(() => Math.max(0, ...props.points.map((p) => p.ml ?? 0)))

// Escala "bonita" para el eje Y
const yTicks = computed(() => {
  const max = maxMl.value || 100
  const raw = max / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!
  const top = Math.ceil(max / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
})
const yMax = computed(() => yTicks.value[yTicks.value.length - 1] || 100)

const x = (i: number) => M.left + (props.points.length <= 1 ? iw / 2 : (i / (props.points.length - 1)) * iw)
const y = (v: number) => M.top + ih - (v / yMax.value) * ih

const known = computed(() => props.points.map((p, i) => ({ ...p, i })).filter((p) => p.ml !== null))

const linePath = computed(() =>
  known.value.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.ml!).toFixed(1)}`).join(' '),
)
const areaPath = computed(() => {
  if (known.value.length < 2) return ''
  const first = known.value[0]!
  const last = known.value[known.value.length - 1]!
  return `${linePath.value} L${x(last.i)},${y(0)} L${x(first.i)},${y(0)} Z`
})

const xLabels = computed(() =>
  props.points.filter((p) => p.day === 1 || p.day % 5 === 0 || p.day === props.points.length),
)

// --- Hover / selección ---
const svgRef = ref<SVGSVGElement>()
const hover = ref<number | null>(null)

function indexFromEvent(ev: PointerEvent) {
  const rect = svgRef.value!.getBoundingClientRect()
  const px = ((ev.clientX - rect.left) / rect.width) * W
  const i = Math.round(((px - M.left) / iw) * (props.points.length - 1))
  return Math.min(props.points.length - 1, Math.max(0, i))
}
function onMove(ev: PointerEvent) {
  hover.value = indexFromEvent(ev)
}
function onClick(ev: PointerEvent) {
  const p = props.points[indexFromEvent(ev)]
  if (p && p.ml !== null) emit('select', p.date)
}

const active = computed(() => (hover.value !== null ? props.points[hover.value] : undefined))
const selectedIndex = computed(() => props.points.findIndex((p) => p.date === props.selected))

const tooltipStyle = computed(() => {
  if (hover.value === null) return {}
  const pct = (x(hover.value) / W) * 100
  return pct > 70 ? { right: `${100 - pct + 2}%` } : { left: `${pct + 2}%` }
})

const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
</script>

<template>
  <div class="relative">
    <svg
      ref="svgRef"
      :viewBox="`0 0 ${W} ${H}`"
      class="h-auto w-full touch-none select-none"
      role="img"
      aria-label="Mililitros tomados por día del mes"
      @pointermove="onMove"
      @pointerdown="onMove"
      @pointerleave="hover = null"
      @click="onClick"
    >
      <defs>
        <linearGradient id="mlArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#ec4899" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#ec4899" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- Cuadrícula y eje Y -->
      <g>
        <template v-for="t in yTicks" :key="t">
          <line :x1="M.left" :x2="W - M.right" :y1="y(t)" :y2="y(t)" stroke="#e2e8f0" :stroke-dasharray="t ? '3 4' : ''" />
          <text :x="M.left - 8" :y="y(t) + 4" text-anchor="end" class="fill-slate-400 text-[11px]">{{ t }}</text>
        </template>
      </g>

      <!-- Eje X -->
      <text
        v-for="p in xLabels"
        :key="p.day"
        :x="x(p.day - 1)"
        :y="H - 8"
        text-anchor="middle"
        class="fill-slate-400 text-[11px]"
      >
        {{ p.day }}
      </text>

      <!-- Día seleccionado -->
      <rect
        v-if="selectedIndex >= 0"
        :x="x(selectedIndex) - iw / points.length / 2"
        :y="M.top"
        :width="iw / points.length"
        :height="ih"
        rx="4"
        fill="#fce7f3"
      />

      <!-- Área y línea -->
      <path v-if="areaPath" :d="areaPath" fill="url(#mlArea)" />
      <path :d="linePath" fill="none" stroke="#db2777" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />

      <!-- Punto del día seleccionado -->
      <circle
        v-if="selectedIndex >= 0 && points[selectedIndex]?.ml !== null"
        :cx="x(selectedIndex)"
        :cy="y(points[selectedIndex]!.ml!)"
        r="5"
        fill="#db2777"
        stroke="#fff"
        stroke-width="2"
      />

      <!-- Cursor -->
      <g v-if="active && active.ml !== null" class="pointer-events-none">
        <line :x1="x(hover!)" :x2="x(hover!)" :y1="M.top" :y2="M.top + ih" stroke="#94a3b8" stroke-dasharray="2 3" />
        <circle :cx="x(hover!)" :cy="y(active.ml)" r="5" fill="#db2777" stroke="#fff" stroke-width="2" />
      </g>
    </svg>

    <!-- Tooltip -->
    <div
      v-if="active && active.ml !== null"
      class="pointer-events-none absolute top-2 rounded-xl bg-slate-900/90 px-3 py-2 text-xs text-white shadow-lg"
      :style="tooltipStyle"
    >
      <p class="font-medium capitalize text-slate-300">{{ fmtDate(active.date) }}</p>
      <p class="mt-0.5 text-sm font-semibold">{{ active.ml }} ml</p>
      <p class="text-slate-300">{{ active.feeds }} {{ active.feeds === 1 ? 'toma' : 'tomas' }}</p>
    </div>
  </div>
</template>
