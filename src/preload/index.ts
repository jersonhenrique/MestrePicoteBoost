import { contextBridge, ipcRenderer } from 'electron'
import type { ApplyReport, NetworkCommand, RestorePoint, SystemInfo, TweakStatus } from '../shared/types'

const api = {
  getSystem: (): Promise<SystemInfo> => ipcRenderer.invoke('system:info'),
  isAdmin: (): Promise<boolean> => ipcRenderer.invoke('system:admin'),
  getStatus: (): Promise<TweakStatus[]> => ipcRenderer.invoke('opt:status'),
  apply: (ids: string[]): Promise<ApplyReport> => ipcRenderer.invoke('opt:apply', ids),
  revert: (ids?: string[]): Promise<ApplyReport> => ipcRenderer.invoke('opt:revert', ids),
  createRestorePoint: (description?: string): Promise<RestorePoint> => ipcRenderer.invoke('restore:create', description),
  listRestorePoints: (): Promise<RestorePoint[]> => ipcRenderer.invoke('restore:list'),
  restoreFromPoint: (id: string): Promise<ApplyReport> => ipcRenderer.invoke('restore:apply', id),
  runNetworkCommand: (command: NetworkCommand): Promise<string> => ipcRenderer.invoke('network:run', command)
}

contextBridge.exposeInMainWorld('picote', api)

export type PicoteApi = typeof api
