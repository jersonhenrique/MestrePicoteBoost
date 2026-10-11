import type { PicoteApi } from './index'

declare global {
  interface Window {
    picote: PicoteApi
  }
}

export {}
