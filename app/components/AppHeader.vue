<script setup lang="ts">
const route = useRoute()
const { data: authStatus } = useFetch('/api/auth/status', { server: false })

const links = [
  { to: '/', label: 'Registro' },
  { to: '/dashboard', label: 'Panel' },
]

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  window.location.replace('/login')
}
</script>

<template>
  <header class="mb-5 flex items-center justify-between gap-3">
    <NuxtLink to="/" class="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
      <img src="/logo-icon.png" alt="Kumoq" class="h-9 w-9" />
      Liam
    </NuxtLink>
    <nav class="flex items-center gap-1">
      <div class="flex rounded-xl bg-white/80 p-1 shadow-sm ring-1 ring-slate-200">
        <NuxtLink
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
          :class="route.path === l.to ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'"
        >
          {{ l.label }}
        </NuxtLink>
      </div>
      <button
        v-if="authStatus?.enabled"
        class="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
        aria-label="Salir"
        title="Salir"
        @click="logout"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
        </svg>
      </button>
    </nav>
  </header>
</template>
