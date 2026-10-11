import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { applyTweaks, getStatuses, getSystemInfo, isAdmin, revertTweaks } from './engine'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1080,
    minHeight: 720,
    title: 'MestrePicoteBoost',
    backgroundColor: '#0b0c0a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('system:info', () => getSystemInfo())
  ipcMain.handle('system:admin', () => isAdmin())
  ipcMain.handle('opt:status', () => getStatuses())
  ipcMain.handle('opt:apply', (_e, ids: string[]) => applyTweaks(ids))
  ipcMain.handle('opt:revert', (_e, ids?: string[]) => revertTweaks(ids))

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
