<script setup lang="ts">
useHead({ title: 'Entrar · Liam' })

const route = useRoute()
const { data: status } = await useFetch('/api/auth/status')

const user = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')
const shake = ref(false)

const redirectTo = computed(() => {
  const r = String(route.query.redirect || '/')
  return r.startsWith('/') && !r.startsWith('//') ? r : '/'
})

if (status.value && (!status.value.enabled || status.value.authenticated)) {
  await navigateTo(redirectTo.value, { replace: true, external: true })
}

async function submit() {
  if (loading.value) return
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { user: user.value, password: password.value } })
    // Recarga completa para que el servidor entregue la app ya autenticada
    window.location.replace(redirectTo.value)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'No se pudo iniciar sesión'
    password.value = ''
    shake.value = true
    setTimeout(() => (shake.value = false), 500)
    loading.value = false
  }
}
</script>

<template>
  <div class="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-50 px-4 py-10">
    <!-- Fondo decorativo -->
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-sky-300/50 blur-3xl animate-float" />
      <div class="absolute -right-20 top-1/3 h-96 w-96 rounded-full bg-indigo-300/50 blur-3xl animate-float-slow" />
      <div class="absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-violet-300/40 blur-3xl animate-float" />
    </div>

    <main class="relative w-full max-w-sm" :class="{ 'animate-shake': shake }">
      <!-- Logo -->
      <div class="mb-8 flex flex-col items-center text-center">
        <img src="/logo.png" alt="Kumoq" class="mb-6 h-12 w-auto drop-shadow-sm" />
        <h1 class="text-3xl font-bold tracking-tight text-slate-900">Liam 🍼</h1>
        <p class="mt-1 text-sm text-slate-500">Tomas y pañales del día</p>
      </div>

      <!-- Tarjeta -->
      <form
        class="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-xl shadow-slate-900/5 backdrop-blur-xl sm:p-8"
        @submit.prevent="submit"
      >
        <h2 class="mb-6 text-lg font-semibold text-slate-800">Bienvenido de nuevo 👋</h2>

        <div class="space-y-4">
          <div v-if="status?.needsUser">
            <label for="user" class="mb-1.5 block text-sm font-medium text-slate-700">Usuario</label>
            <div class="relative">
              <svg class="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.1a7.5 7.5 0 0 1 15 0A17.9 17.9 0 0 1 12 21.75c-2.68 0-5.22-.58-7.5-1.65Z" />
              </svg>
              <input
                id="user"
                v-model="user"
                type="text"
                autocomplete="username"
                autocapitalize="none"
                required
                placeholder="Tu usuario"
                class="w-full rounded-xl border border-slate-200 bg-white/80 py-3 pl-11 pr-4 text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div>
            <label for="password" class="mb-1.5 block text-sm font-medium text-slate-700">Contraseña</label>
            <div class="relative">
              <svg class="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                required
                placeholder="••••••••"
                class="w-full rounded-xl border border-slate-200 bg-white/80 py-3 pl-11 pr-12 text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                @click="showPassword = !showPassword"
              >
                <svg v-if="!showPassword" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.04 12.32a1 1 0 0 1 0-.64C3.42 7.51 7.36 4.5 12 4.5c4.64 0 8.57 3 9.96 7.18.07.2.07.43 0 .64C20.58 16.49 16.64 19.5 12 19.5c-4.64 0-8.57-3-9.96-7.18Z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.22A10.48 10.48 0 0 0 1.93 12C3.23 16.34 7.24 19.5 12 19.5c.99 0 1.95-.14 2.86-.4M6.23 6.23A10.45 10.45 0 0 1 12 4.5c4.76 0 8.77 3.16 10.07 7.5a10.52 10.52 0 0 1-4.29 5.77M6.23 6.23 3 3m3.23 3.23 3.65 3.65m7.89 7.89L21 21m-3.23-3.23-3.65-3.65m0 0a3 3 0 1 0-4.24-4.24m4.24 4.24L9.88 9.88" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <Transition
          enter-active-class="transition duration-200"
          enter-from-class="opacity-0 -translate-y-1"
          leave-active-class="transition duration-150"
          leave-to-class="opacity-0"
        >
          <p v-if="error" class="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-600 ring-1 ring-red-100">
            <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            {{ error }}
          </p>
        </Transition>

        <button
          type="submit"
          :disabled="loading"
          class="group mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 py-3.5 font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:shadow-xl hover:shadow-indigo-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <svg v-if="loading" class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
          </svg>
          <span>{{ loading ? 'Entrando…' : 'Entrar' }}</span>
          <svg v-if="!loading" class="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </form>

      <p class="mt-6 text-center text-xs text-slate-400">La sesión se mantiene abierta en este dispositivo</p>
    </main>
  </div>
</template>
