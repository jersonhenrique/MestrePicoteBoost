export interface DiskInfo {
  name: string
  freeGB: number
  totalGB: number
}

export interface SystemInfo {
  computer: string
  os: string
  cpu: string
  cores: number
  threads: number
  gpu: string
  ramGB: number
  ramFreeGB: number
  disks: DiskInfo[]
  isAdmin: boolean
}

export interface TweakStatus {
  id: string
  applied: boolean
  current: string
}

export interface ActionResult {
  id: string
  ok: boolean
  message: string
}

export interface ApplyReport {
  results: ActionResult[]
  log: string[]
}

export interface RestorePoint {
  id: string
  name: string
  description: string
  createdAt: string
  appliedIds: string[]
  tweakCount: number
}
