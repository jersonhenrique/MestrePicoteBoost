import { beforeEach, describe, expect, it, vi } from 'vitest'

const { exposeInMainWorld, invoke } = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn()
}))

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke }
}))

describe('preload API', () => {
  beforeEach(() => {
    exposeInMainWorld.mockClear()
    invoke.mockReset()
  })

  it('exposes the typed bridge to the renderer', async () => {
    await import('./index')
    expect(exposeInMainWorld).toHaveBeenCalledWith('picote', expect.objectContaining({
      getSystem: expect.any(Function),
      getStatus: expect.any(Function),
      apply: expect.any(Function),
      revert: expect.any(Function),
      createRestorePoint: expect.any(Function),
      listRestorePoints: expect.any(Function),
      restoreFromPoint: expect.any(Function),
      runNetworkCommand: expect.any(Function)
    }))
  })

  it('routes each API call to its corresponding IPC channel and arguments', async () => {
    vi.resetModules()
    await import('./index')
    const calls = exposeInMainWorld.mock.calls
    const api = calls[calls.length - 1][1] as Record<string, (...args: unknown[]) => unknown>
    const methods: [string, unknown[], string, unknown[]][] = [
      ['getSystem', [], 'system:info', []],
      ['isAdmin', [], 'system:admin', []],
      ['getStatus', [], 'opt:status', []],
      ['apply', [['visual-fx']], 'opt:apply', [['visual-fx']]],
      ['revert', [['hags']], 'opt:revert', [['hags']]],
      ['createRestorePoint', ['before test'], 'restore:create', ['before test']],
      ['listRestorePoints', [], 'restore:list', []],
      ['restoreFromPoint', ['point-1'], 'restore:apply', ['point-1']],
      ['runNetworkCommand', ['reset-winsock'], 'network:run', ['reset-winsock']]
    ]

    for (const [method, args, channel, ipcArgs] of methods) {
      invoke.mockClear()
      api[method](...args)
      expect(invoke).toHaveBeenCalledWith(channel, ...ipcArgs)
    }
  })
})
