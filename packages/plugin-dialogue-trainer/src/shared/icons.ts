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
  },
}

export function registerDialogueTrainerIcons(): void {
  addCollection(dialogueTrainerIcons)
}
