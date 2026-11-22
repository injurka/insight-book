import type { IconifyJSON } from '@iconify/vue'
import { addCollection } from '@iconify/vue'

const chineseAnalyzerIcons: IconifyJSON = {
  prefix: 'mdi',
  width: 24,
  height: 24,
  icons: {
    'ideogram-cjk-variant': {
      body: '<path fill="currentColor" d="M11 4v2H4v2h11.36c-.23.87-.73 1.77-1.48 2.69c-.53.66-1.17 1.31-1.88 1.98c-.71-.67-1.35-1.32-1.88-1.98c-.47-.57-.82-1.14-1.09-1.69H6.85c.36 1.05.97 2.03 1.71 2.95c.57.71 1.23 1.39 1.94 2.05l-5.14 4.23l1.28 1.54L12 15.34l5.36 4.43l1.28-1.54L13.5 14c.71-.66 1.37-1.34 1.94-2.05c.97-1.21 1.72-2.52 1.96-3.95H20V6h-7V4Z"/>',
    },
    'translate': {
      body: '<path fill="currentColor" d="m12.87 15.07l-2.54-2.51l.03-.03A17.5 17.5 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35C8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5l3.11 3.11zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2zm-2.62 7l1.62-4.33L19.12 17z"/>',
    },
    'magnify': {
      body: '<path fill="currentColor" d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5l-1.5 1.5l-5-5v-.79l-.27-.27A6.52 6.52 0 0 1 9.5 16A6.5 6.5 0 0 1 3 9.5A6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14S14 12 14 9.5S12 5 9.5 5"/>',
    },
    'auto-fix': {
      body: '<path fill="currentColor" d="M7.5 5.6L5 7l1.4-2.5L5 2l2.5 1.4L10 2L8.6 4.5L10 7zm12 9.8L22 14l-1.4 2.5L22 19l-2.5-1.4L17 19l1.4-2.5L17 14zM22 2l-1.4 2.5L22 7l-2.5-1.4L17 7l1.4-2.5L17 2l2.5 1.4zm-8.66 10.78l2.44-2.44l-2.12-2.12l-2.44 2.44zm1.03-5.49l2.34 2.34c.39.37.39 1.02 0 1.41L5.04 22.71c-.39.39-1.04.39-1.41 0l-2.34-2.34c-.39-.37-.39-1.02 0-1.41L12.96 7.29c.39-.39 1.04-.39 1.41 0"/>',
    },
    'star-four-points-outline': {
      body: '<path fill="currentColor" d="m12 6.7l1.45 3.85L17.3 12l-3.85 1.45L12 17.3l-1.45-3.85L6.7 12l3.85-1.45zM12 1L9 9l-8 3l8 3l3 8l3-8l8-3l-8-3z"/>',
    },
    'volume-high': {
      body: '<path fill="currentColor" d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.84-5 6.7v2.07c4-.91 7-4.49 7-8.77s-3-7.86-7-8.77M16.5 12c0-1.77-1-3.29-2.5-4.03V16c1.5-.71 2.5-2.24 2.5-4M3 9v6h4l5 5V4L7 9z"/>',
    },
    'volume-medium': {
      body: '<path fill="currentColor" d="M5 9v6h4l5 5V4L9 9m9.5 3c0-1.77-1-3.29-2.5-4.03V16c1.5-.71 2.5-2.24 2.5-4"/>',
    },
    'stop': {
      body: '<path fill="currentColor" d="M18 18H6V6h12z"/>',
    },
    'content-copy': {
      body: '<path fill="currentColor" d="M19 21H8V7h11m0-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m-3-4H4a2 2 0 0 0-2 2v14h2V3h12z"/>',
    },
    'check': {
      body: '<path fill="currentColor" d="M21 7L9 19l-5.5-5.5l1.41-1.41L9 16.17L19.59 5.59z"/>',
    },
    'history': {
      body: '<path fill="currentColor" d="M13.5 8H12v5l4.28 2.54l.72-1.21l-3.5-2.08zM13 3a9 9 0 0 0-9 9H1l3.96 4.03L9 12H6a7 7 0 0 1 7-7a7 7 0 0 1 7 7a7 7 0 0 1-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.9 8.9 0 0 0 13 21a9 9 0 0 0 9-9a9 9 0 0 0-9-9"/>',
    },
    'delete-outline': {
      body: '<path fill="currentColor" d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM8 9h8v10H8zm7.5-5l-1-1h-5l-1 1H5v2h14V4z"/>',
    },
    'close': {
      body: '<path fill="currentColor" d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"/>',
    },
    'arrow-left': {
      body: '<path fill="currentColor" d="M20 11v2H8l5.5 5.5l-1.42 1.42L4.16 12l7.92-7.92L13.5 5.5L8 11z"/>',
    },
    'arrow-right': {
      body: '<path fill="currentColor" d="M4 11v2h12l-5.5 5.5l1.42 1.42L19.84 12l-7.92-7.92L10.5 5.5L16 11z"/>',
    },
    'plus': {
      body: '<path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/>',
    },
    'minus': {
      body: '<path fill="currentColor" d="M19 13H5v-2h14z"/>',
    },
    'fit-to-screen-outline': {
      body: '<path fill="currentColor" d="M17 4h3c1.1 0 2 .9 2 2v2h-2V6h-3zM4 8V6h3V4H4c-1.1 0-2 .9-2 2v2zm16 8v2h-3v2h3c1.1 0 2-.9 2-2v-2zM7 18H4v-2H2v2c0 1.1.9 2 2 2h3zm9-8v4H8v-4zm2-2H6v8h12z"/>',
    },
    'fullscreen': {
      body: '<path fill="currentColor" d="M5 5h5v2H7v3H5zm9 0h5v5h-2V7h-3zm3 9h2v5h-5v-2h3zm-7 3v2H5v-5h2v3z"/>',
    },
    'fullscreen-exit': {
      body: '<path fill="currentColor" d="M14 14h5v2h-3v3h-2zm-9 0h5v5H8v-3H5zm3-9h2v5H5V8h3zm11 3v2h-5V5h2v3z"/>',
    },
    'sitemap-outline': {
      body: '<path fill="currentColor" d="M21 16v-3c0-1.11-.89-2-2-2h-6V8h2V2H9v6h2v3H5c-1.11 0-2 .89-2 2v3H1v6h6v-6H5v-3h6v3H9v6h6v-6h-2v-3h6v3h-2v6h6v-6zM11 4h2v2h-2zM5 20H3v-2h2zm8 0h-2v-2h2zm8 0h-2v-2h2z"/>',
    },
    'vector-curve': {
      body: '<path fill="currentColor" d="M18.5 2A1.5 1.5 0 0 1 20 3.5A1.5 1.5 0 0 1 18.5 5c-.23 0-.45-.05-.65-.15l-3.69 3.7l.34.45c2.19-1.26 4.76-2 7.5-2l1 .03v2.01L22 9c-2.58 0-5 .75-7 2.04A3.96 3.96 0 0 1 11.04 15C9.75 17 9 19.42 9 22l.04 1H7.03L7 22c0-2.74.74-5.31 2-7.5l-.45-.34l-3.7 3.69c.1.2.15.42.15.65A1.5 1.5 0 0 1 3.5 20A1.5 1.5 0 0 1 2 18.5A1.5 1.5 0 0 1 3.5 17c.23 0 .45.05.65.15l3.69-3.7C7.31 12.78 7 11.92 7 11a4 4 0 0 1 4-4c.92 0 1.78.31 2.45.84l3.7-3.69c-.1-.2-.15-.42-.15-.65A1.5 1.5 0 0 1 18.5 2M11 9a2 2 0 0 0-2 2a2 2 0 0 0 2 2a2 2 0 0 0 2-2a2 2 0 0 0-2-2"/>',
    },
    'unfold-more-horizontal': {
      body: '<path fill="currentColor" d="M12 18.17L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15M12 5.83L15.17 9l1.41-1.41L12 3L7.41 7.59L8.83 9z"/>',
    },
    'unfold-less-horizontal': {
      body: '<path fill="currentColor" d="M16.59 5.41L15.17 4L12 7.17L8.83 4L7.41 5.41L12 10m-4.59 8.59L8.83 20L12 16.83L15.17 20l1.41-1.41L12 14z"/>',
    },
    'book-open-variant-outline': {
      body: '<path fill="currentColor" d="M12 21.5c-1.35-.85-3.8-1.5-5.5-1.5c-1.65 0-3.35.3-4.75 1.05c-.1.05-.15.05-.25.05c-.25 0-.5-.25-.5-.5V6c.6-.45 1.25-.75 2-1c1.11-.35 2.33-.5 3.5-.5c1.95 0 4.05.4 5.5 1.5c1.45-1.1 3.55-1.5 5.5-1.5c1.17 0 2.39.15 3.5.5c.75.25 1.4.55 2 1v14.6c0 .25-.25.5-.5.5c-.1 0-.15 0-.25-.05c-1.4-.75-3.1-1.05-4.75-1.05c-1.7 0-4.15.65-5.5 1.5m-1-14c-1.36-.6-3.16-1-4.5-1c-1.2 0-2.4.15-3.5.5v11.5c1.1-.35 2.3-.5 3.5-.5c1.34 0 3.14.4 4.5 1zM13 19c1.36-.6 3.16-1 4.5-1c1.2 0 2.4.15 3.5.5V7c-1.1-.35-2.3-.5-3.5-.5c-1.34 0-3.14.4-4.5 1zm1-2.65c.96-.35 2.12-.52 3.5-.52c1.04 0 1.88.08 2.5.24v-1.5a13.9 13.9 0 0 0-6 .19zm0-2.66c.96-.35 2.12-.53 3.5-.53c1.04 0 1.88.08 2.5.24v-1.5c-.87-.16-1.71-.23-2.5-.23c-1.28 0-2.45.15-3.5.45zM14 11c.96-.33 2.12-.5 3.5-.5c.91 0 1.76.09 2.5.28V9.23c-.87-.15-1.71-.23-2.5-.23c-1.32 0-2.5.15-3.5.46z"/>',
    },
    'school-outline': {
      body: '<path fill="currentColor" d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9zm6.82 6L12 12.72L5.18 9L12 5.28zM17 16l-5 2.72L7 16v-3.73L12 15l5-2.73z"/>',
    },
    'waveform': {
      body: '<path fill="currentColor" d="m22 12l-2 1l-1 1l-1-1l-1 3l-1-3l-1 8l-1-8l-1 2l-1-2l-1 4l-1-4l-1 9l-1-9l-1 6l-1-6l-1 1l-1-1l-2-1l2-1l1-1l1 1l1-6l1 6l1-9l1 9l1-4l1 4l1-2l1 2l1-8l1 8l1-3l1 3l1-1l1 1z"/>',
    },
    'compass-outline': {
      body: '<path fill="currentColor" d="m7 17l3.2-6.8L17 7l-3.2 6.8zm5-5.9a.9.9 0 0 0-.9.9a.9.9 0 0 0 .9.9a.9.9 0 0 0 .9-.9a.9.9 0 0 0-.9-.9M12 2a10 10 0 0 1 10 10a10 10 0 0 1-10 10A10 10 0 0 1 2 12A10 10 0 0 1 12 2m0 2a8 8 0 0 0-8 8a8 8 0 0 0 8 8a8 8 0 0 0 8-8a8 8 0 0 0-8-8"/>',
    },
    'swap-horizontal': {
      body: '<path fill="currentColor" d="m21 9l-4-4v3h-7v2h7v3M7 11l-4 4l4 4v-3h7v-2H7z"/>',
    },
    'alert-circle-outline': {
      body: '<path fill="currentColor" d="M11 15h2v2h-2zm0-8h2v6h-2zm1-5C6.47 2 2 6.5 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2m0 18a8 8 0 0 1-8-8a8 8 0 0 1 8-8a8 8 0 0 1 8 8a8 8 0 0 1-8 8"/>',
    },
    'lightbulb-on-outline': {
      body: '<path fill="currentColor" d="M20 11h3v2h-3zM1 11h3v2H1zM13 1v3h-2V1zM4.92 3.5l2.13 2.14l-1.42 1.41L3.5 4.93zm12.03 2.13l2.12-2.13l1.43 1.43l-2.13 2.12zM12 6a6 6 0 0 1 6 6c0 2.22-1.21 4.16-3 5.2V19a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1.8c-1.79-1.04-3-2.98-3-5.2a6 6 0 0 1 6-6m2 15v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1zm-3-3h2v-2.13c1.73-.44 3-2.01 3-3.87a4 4 0 0 0-4-4a4 4 0 0 0-4 4c0 1.86 1.27 3.43 3 3.87z"/>',
    },
    'layers-triple-outline': {
      body: '<path fill="currentColor" d="m12 16.54l7.37-5.74L21 12.07l-9 7l-9-7l1.62-1.26zM12 14L3 7l9-7l9 7zm0-11.47L6.26 7L12 11.47L17.74 7zm0 18.94l7.37-5.74L21 17l-9 7l-9-7l1.62-1.26z"/>',
    },
    'brush-variant': {
      body: '<path fill="currentColor" d="M8 3C5.79 3 4 4.79 4 7v7c0 1.1.9 2 2 2h3v4c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-4h3c1.1 0 2-.9 2-2V3zm0 2h4v2h2V5h1v4h2V5h1v5H6V7c0-1.1.9-2 2-2m-2 9v-2h12v2z"/>',
    },
    'play-outline': {
      body: '<path fill="currentColor" d="M8.5 8.64L13.77 12L8.5 15.36zM6.5 5v14l11-7"/>',
    },
    'refresh': {
      body: '<path fill="currentColor" d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 0 0-8 8a8 8 0 0 0 8 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18a6 6 0 0 1-6-6a6 6 0 0 1 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z"/>',
    },
    'chevron-down': {
      body: '<path fill="currentColor" d="M7.41 8.58L12 13.17l4.59-4.59L18 10l-6 6l-6-6z"/>',
    },
    'chevron-up': {
      body: '<path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6l-6 6z"/>',
    },
    'chevron-right': {
      body: '<path fill="currentColor" d="M8.59 16.58L13.17 12L8.59 7.41L10 6l6 6l-6 6z"/>',
    },
    'account-voice': {
      body: '<path fill="currentColor" d="M9 5a4 4 0 0 1 4 4a4 4 0 0 1-4 4a4 4 0 0 1-4-4a4 4 0 0 1 4-4m0 10c2.67 0 8 1.34 8 4v2H1v-2c0-2.66 5.33-4 8-4m7.76-9.64c2.02 2.2 2.02 5.25 0 7.27l-1.68-1.69c.84-1.18.84-2.71 0-3.89zM20.07 2c3.93 4.05 3.9 10.11 0 14l-1.63-1.63c2.77-3.18 2.77-7.72 0-10.74z"/>',
    },
    'chat-processing-outline': {
      body: '<path fill="currentColor" d="M12 3C6.5 3 2 6.58 2 11a7.22 7.22 0 0 0 2.75 5.5c0 .6-.42 2.17-2.75 4.5c2.37-.11 4.64-1 6.47-2.5c1.14.33 2.34.5 3.53.5c5.5 0 10-3.58 10-8s-4.5-8-10-8m0 14c-4.42 0-8-2.69-8-6s3.58-6 8-6s8 2.69 8 6s-3.58 6-8 6m5-5v-2h-2v2zm-4 0v-2h-2v2zm-4 0v-2H7v2z"/>',
    },
    'tag-outline': {
      body: '<path fill="currentColor" d="m21.41 11.58l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .59 1.42l9 9A2 2 0 0 0 13 22a2 2 0 0 0 1.41-.59l7-7A2 2 0 0 0 22 13a2 2 0 0 0-.59-1.42M13 20l-9-9V4h7l9 9M6.5 5A1.5 1.5 0 1 1 5 6.5A1.5 1.5 0 0 1 6.5 5"/>',
    },
    'microphone': {
      body: '<path fill="currentColor" d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3m7 9c0 3.53-2.61 6.44-6 6.93V21h-2v-3.07c-3.39-.49-6-3.4-6-6.93h2a5 5 0 0 0 5 5a5 5 0 0 0 5-5z"/>',
    },
    'microphone-off': {
      body: '<path fill="currentColor" d="M19 11c0 1.19-.34 2.3-.9 3.28l-1.23-1.23c.27-.62.43-1.31.43-2.05zm-4 .16L9 5.18V5a3 3 0 0 1 3-3a3 3 0 0 1 3 3zM4.27 3L21 19.73L19.73 21l-4.19-4.19c-.77.46-1.63.77-2.54.91V21h-2v-3.28c-3.28-.49-6-3.31-6-6.72h1.7c0 3 2.54 5.1 5.3 5.1c.81 0 1.6-.19 2.31-.52l-1.66-1.66L12 14a3 3 0 0 1-3-3v-.72L3 4.27z"/>',
    },
    'loading': {
      body: '<path fill="currentColor" d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8"/>',
    },
  },
}

export function registerChineseAnalyzerIcons(): void {
  addCollection(chineseAnalyzerIcons)
}
