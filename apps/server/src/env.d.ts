/// <reference types="@types/bun" />
/// <reference types="bun-types" />

declare module 'az' {
  export const Morph: {
    // eslint-disable-next-line ts/method-signature-style
    init(callback: () => void): void
    (word: string): Array<{
      word: string
      tag: {
        POS: string
        [key: string]: string | boolean
      }
    }>
  }
}
