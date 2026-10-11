import { contextBridge, ipcRenderer } from 'electron'
import type { ApplyReport, SystemInfo, TweakStatus } from '../shared/types'

const api = {
  getSystem: (): Promise<SystemInfo> => ipcRenderer.invoke('system:info'),
  isAdmin: (): Promise<boolean> => ipcRenderer.invoke('system:admin'),
  getStatus: (): Promise<TweakStatus[]> => ipcRenderer.invoke('opt:status'),
  apply: (ids: string[]): Promise<ApplyReport> => ipcRenderer.invoke('opt:apply', ids),
  revert: (ids?: string[]): Promise<ApplyReport> => ipcRenderer.invoke('opt:revert', ids)
}

contextBridge.exposeInMainWorld('picote', api)

export type PicoteApi = typeof api
