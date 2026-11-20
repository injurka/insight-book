import type { IconifyJSON } from '@iconify/vue'
import { addCollection } from '@iconify/vue'

const dialogueTrainerIcons: IconifyJSON = {
  prefix: 'mdi',
  width: 24,
  height: 24,
  icons: {
    'volume-off': {
      body: '<path fill="currentColor" d="M12 4L9.91 6.09L12 8.18M4.27 3L3 4.27L7.73 9H3v6h4l5 5v-6.73l4.25 4.26c-.67.51-1.42.93-2.25 1.17v2.07c1.38-.32 2.63-.95 3.68-1.81L19.73 21L21 19.73l-9-9M19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.9 8.9 0 0 0 21 12c0-4.28-3-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71m-2.5 0c0-1.77-1-3.29-2.5-4.03v2.21l2.45 2.45c.05-.2.05-.42.05-.63"/>',
    },
    'volume-medium': {
      body: '<path fill="currentColor" d="M5 9v6h4l5 5V4L9 9zm10.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02"/>',
    },
    'volume-high': {
      body: '<path fill="currentColor" d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77c0-4.28-2.99-7.86-7-8.77M16.5 12c0-1.77-1-3.29-2.5-4.03v8.05c1.5-.74 2.5-2.26 2.5-4.02M3 9v6h4l5 5V4L7 9z"/>',
    },
    'alphabet-latin': {
      body: '<path fill="currentColor" d="M13 6v12h2v-.69c.37.42.9.69 1.5.69h.5c1.65 0 3-1.35 3-3v-3c0-1.64-1.35-3-3-3h-.5c-.6 0-1.13.27-1.5.7V6M5 9v2h3c.57 0 1 .43 1 1H7c-1.64 0-3 1.36-3 3c0 1.65 1.36 3 3 3h4v-6c0-1.64-1.35-3-3-3m8 2h1c.57 0 1 .43 1 1v3c0 .57-.43 1-1 1h-1c-.57 0-1-.43-1-1v-3c0-.57.43-1 1-1m-9 3h2v2H7c-.57 0-1-.43-1-1s.43-1 1-1"/>',
    },
    'subtitles-outline': {
      body: '<path fill="currentColor" d="M20 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 14V6H4v12zM6 10h2v2H6zm0 4h8v2H6zm10 0h2v2h-2zm-6-4h8v2h-8z"/>',
    },
    'play-speed': {
      body: '<path fill="currentColor" d="M13 2.05v2c4.39.54 7.5 4.53 6.96 8.92c-.46 3.64-3.32 6.53-6.96 6.96v2c5.5-.55 9.5-5.43 8.95-10.93c-.45-4.75-4.22-8.5-8.95-8.97zM5.67 19.74A10 10 0 0 0 11 22v-2a8 8 0 0 1-3.9-1.63zm1.43-14c1.12-.9 2.47-1.48 3.9-1.68v-2c-1.95.19-3.81.94-5.33 2.2zM5.69 7.1L4.26 5.67A9.9 9.9 0 0 0 2.05 11h2c.19-1.42.75-2.77 1.64-3.9M4.06 13h-2c.2 1.96.97 3.81 2.21 5.33l1.42-1.43A8 8 0 0 1 4.06 13M10 16.5l6-4.5l-6-4.5z"/>',
    },
  },
}

export function registerDialogueTrainerIcons(): void {
  addCollection(dialogueTrainerIcons)
}
