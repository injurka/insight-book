import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

export const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'parchment',
    themes: {
      parchment: {
        dark: false,
        colors: {
          'background': '#f3efe9',
          'surface': '#e8e2d9',
          'primary': '#4b8266',
          'secondary': '#8e867b',
          'accent': '#5a9c7b',
          'error': '#c46d6d',
          'info': '#617a94',
          'success': '#4b8266',
          'warning': '#b38f2b',
          'on-background': '#4a443c',
          'on-surface': '#4a443c',
          'on-primary': '#f3efe9',
          'on-success': '#f3efe9',
          'on-error': '#f3efe9',
        },
      },
    },
  },
})
