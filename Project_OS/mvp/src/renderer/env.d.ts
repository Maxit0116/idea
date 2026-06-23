/// <reference types="vite/client" />

import type { ProjectOSApi } from '../preload/index'

declare global {
  interface Window {
    projectOS: ProjectOSApi
  }
}
