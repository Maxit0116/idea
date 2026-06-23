import type { CloudConfig, CloudAuthResponse } from '../../../../common/projectOsTypes.js'

const DEFAULT_CONFIG: CloudConfig = {
  enabled: false,
  apiUrl: '',
  authToken: null,
}

let currentConfig: CloudConfig = { ...DEFAULT_CONFIG }

export function getCloudConfig(): CloudConfig {
  return { ...currentConfig }
}

export function setCloudConfig(config: Partial<CloudConfig>): void {
  currentConfig = { ...currentConfig, ...config }
}

// M3 stub: will implement OAuth/API key auth
export async function authenticate(_apiUrl: string): Promise<CloudAuthResponse> {
  throw new Error('Cloud authentication not available until M3')
}

export function isAuthenticated(): boolean {
  return currentConfig.enabled && currentConfig.authToken !== null
}

export function clearAuth(): void {
  currentConfig.authToken = null
}
