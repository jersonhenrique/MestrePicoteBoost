import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handlers, app, browserWindow, ipcMain, shell, engine } = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  const loadURL = vi.fn()
  const loadFile = vi.fn()
  const setWindowOpenHandler = vi.fn()
  const window = vi.fn(function () {
    return { webContents: { setWindowOpenHandler }, loadURL, loadFile }
  })
  return {
    handlers,
    app: {
      whenReady: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      quit: vi.fn()
    },
    browserWindow: Object.assign(window, { getAllWindows: vi.fn(() => []) }),
    ipcMain: { handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler)) },
    shell: { openExternal: vi.fn() },
    engine: {
      applyTweaks: vi.fn(),
      createRestorePoint: vi.fn(),
      getStatuses: vi.fn(),
      getSystemInfo: vi.fn(),
      isAdmin: vi.fn(),
      listRestorePoints: vi.fn(),
      runNetworkCommand: vi.fn(),
      restoreFromPoint: vi.fn(),
      revertTweaks: vi.fn()
    }
  }
})

vi.mock('electron', () => ({ app, BrowserWindow: browserWindow, ipcMain, shell }))
vi.mock('./engine', () => engine)

describe('Electron main process IPC and window lifecycle', () => {
  beforeEach(async () => {
    handlers.clear()
    vi.clearAllMocks()
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173'
    vi.resetModules()
    await import('./index')
    await Promise.resolve()
  })

  it('registers renderer-facing system, optimization, and restore point channels', () => {
    expect([...handlers.keys()]).toEqual([
      'system:info',
      'system:admin',
      'opt:status',
      'opt:apply',
      'opt:revert',
      'restore:create',
      'restore:list',
      'restore:apply',
      'network:run'
    ])
  })

  it('passes channel arguments to engine operations', async () => {
    const ids = ['visual-fx', 'mouse-accel']
    const fakeEvent = {}

    expect(await handlers.get('system:info')?.(fakeEvent)).toBe(engine.getSystemInfo.mock.results.at(-1)?.value)
    await handlers.get('system:admin')?.(fakeEvent)
    await handlers.get('opt:status')?.(fakeEvent)
    await handlers.get('opt:apply')?.(fakeEvent, ids)
    await handlers.get('opt:revert')?.(fakeEvent, ids)
    await handlers.get('restore:create')?.(fakeEvent, 'before changes')
    await handlers.get('restore:list')?.(fakeEvent)
    await handlers.get('restore:apply')?.(fakeEvent, 'point-1')
    await handlers.get('network:run')?.(fakeEvent, 'flush-dns')

    expect(engine.getSystemInfo).toHaveBeenCalled()
    expect(engine.isAdmin).toHaveBeenCalled()
    expect(engine.getStatuses).toHaveBeenCalled()
    expect(engine.applyTweaks).toHaveBeenCalledWith(ids)
    expect(engine.revertTweaks).toHaveBeenCalledWith(ids)
    expect(engine.createRestorePoint).toHaveBeenCalledWith('before changes')
    expect(engine.listRestorePoints).toHaveBeenCalled()
    expect(engine.restoreFromPoint).toHaveBeenCalledWith('point-1')
    expect(engine.runNetworkCommand).toHaveBeenCalledWith('flush-dns')
  })

  it('opens external links outside Electron and registers window lifecycle handlers', () => {
    const createdWindow = browserWindow.mock.results[0].value
    const openHandler = createdWindow.webContents.setWindowOpenHandler.mock.calls[0][0]

    expect(openHandler({ url: 'https://example.com' })).toEqual({ action: 'deny' })
    expect(shell.openExternal).toHaveBeenCalledWith('https://example.com')
    expect(createdWindow.loadURL).toHaveBeenCalledWith('http://localhost:5173')
    expect(app.on).toHaveBeenCalledWith('activate', expect.any(Function))
    expect(app.on).toHaveBeenCalledWith('window-all-closed', expect.any(Function))
  })
})
