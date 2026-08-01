// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/i18n',
    'nuxt-charts',
  ],

  css: ['~/assets/css/main.css'],

  fonts: {
    provider: 'local',
  },

  i18n: {
    defaultLocale: 'fa',
    strategy: 'no_prefix',
    detectBrowserLanguage: false,
    locales: [
      {
        code: 'fa',
        name: 'فارسی',
        language: 'fa-IR',
        dir: 'rtl',
        file: 'fa.json',
      },
    ],
  },

  runtimeConfig: {
    battlenetClientId: '',
    battlenetClientSecret: '',
    sqlitePath: '.data/wow-token.sqlite',
  },

  app: {
    head: {
      htmlAttrs: {
        lang: 'fa-IR',
        dir: 'rtl',
      },
      title: 'قیمت توکن ورلد آف وارکرفت',
      meta: [
        {
          name: 'description',
          content: 'نمایش قیمت روز توکن World of Warcraft در مناطق اروپا و آمریکا',
        },
        { name: 'theme-color', content: '#081426' },
      ],
    },
  },
})
