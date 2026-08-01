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
      include: ['lucide-vue-next'],
      // pdfmake removido daqui — carregado dinamicamente só onde é usado
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            pdfmake: ['pdfmake/build/pdfmake', 'pdfmake/build/vfs_fonts'],
          },
        },
      },
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
    smtpHost: process.env.SMTP_HOST ?? '',
    smtpPort: process.env.SMTP_PORT ?? '587',
    smtpUser: process.env.SMTP_USER ?? '',
    smtpPass: process.env.SMTP_PASS ?? '',
    smtpFrom: process.env.SMTP_FROM ?? 'SoMedicos <noreply@somedicos.com.br>',
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
          // Reduzido para 1 família (Inter cobre todos os casos de uso)
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300..700&family=JetBrains+Mono:wght@400;600&display=swap',
        },
      ],
    },
  },
})