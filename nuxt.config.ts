export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  future: { compatibilityVersion: 4 },
  ssr: false,
  devtools: { enabled: false },

  modules: [
    '@nuxtjs/supabase',
    '@pinia/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [
      import('@tailwindcss/vite').then((m) => m.default()),
    ],
    optimizeDeps: {
      include: ['pdfmake/build/pdfmake', 'pdfmake/build/vfs_fonts', 'lucide-vue-next'],
    },
  },

  supabase: {
    redirect: false,
    redirectOptions: {
      login: '/auth/login',
      callback: '/confirm',
      exclude: ['/sala/*', '/doc/*'],
    },
  },

  runtimeConfig: {
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? '',
    public: {},
  },

  app: {
    head: {
      title: 'SoMedicos — Teleconsultas',
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&family=Inter:wght@300..700&family=JetBrains+Mono:wght@400;600&display=swap',
        },
      ],
    },
  },
})