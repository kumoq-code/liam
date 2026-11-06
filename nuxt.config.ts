import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    // Se sobrescriben con variables de entorno NUXT_DATA_DIR, NUXT_AUTH_USER, NUXT_AUTH_PASSWORD, NUXT_SESSION_SECRET
    dataDir: './data',
    authUser: '',
    authPassword: '',
    sessionSecret: 'liam',
  },
  app: {
    head: {
      title: 'Liam · Registro del bebé',
      htmlAttrs: { lang: 'es' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#fdf2f8' },
      ],
      link: [
        { rel: 'icon', href: '/logo-icon.png', type: 'image/png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },
})
