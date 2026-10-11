import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TWEAKS } from '../shared/catalog'

const { state, runPs, runPsSafe } = vi.hoisted(() => ({
  state: {
    userData: '',
    hardwareJson: '',
    isAdmin: 'true',
    powerScheme: '(SCHEME_CURRENT) 11111111-1111-1111-1111-111111111111 (Balanced)',
    registryValues: {} as Record<string, string>,
    serviceStates: {} as Record<string, { status: string; startMode: string }>
  },
  runPs: vi.fn(),
  runPsSafe: vi.fn()
}))

vi.mock('electron', () => ({
  app: { getPath: () => state.userData }
}))

vi.mock('./powershell', () => ({ runPs, runPsSafe }))

const dataRoot = join(tmpdir(), 'mestre-picote-engine-tests')
state.userData = dataRoot
let engine: typeof import('./engine')

beforeAll(async () => {
  engine = await import('./engine')
})

beforeEach(async () => {
  await rm(dataRoot, { recursive: true, force: true })
  await mkdir(dataRoot, { recursive: true })
  state.isAdmin = 'true'
  state.hardwareJson = ''
  state.powerScheme = '(SCHEME_CURRENT) 11111111-1111-1111-1111-111111111111 (Balanced)'
  state.registryValues = {}
  state.serviceStates = {
    SysMain: { status: 'Running', startMode: 'Auto' },
    XblAuthManager: { status: 'Running', startMode: 'Manual' },
    XblGameSave: { status: 'Running', startMode: 'Auto' },
    XboxNetApiSvc: { status: 'Running', startMode: 'Manual' },
    DiagTrack: { status: 'Running', startMode: 'Auto' }
  }
  runPs.mockReset().mockImplementation(async (command: string) => ({
    stdout: command.includes('Win32_Processor') ? state.hardwareJson : '',
    stderr: ''
  }))
  runPsSafe.mockReset().mockImplementation(async (command: string) => {
    if (command.includes('IsInRole')) return state.isAdmin
    if (command.includes('powercfg /getactivescheme')) return state.powerScheme
    if (command.includes('ConvertTo-Json')) return state.hardwareJson
    if (command.includes('$ifaces')) return state.registryValues.Nagle ?? '0'
    const serviceName = command.match(/Name(?:\s*=\s*|\s+)['"]([^'"]+)['"]/i)?.[1]
    if (command.includes('Get-CimInstance Win32_Service')) {
      const service = serviceName ? state.serviceStates[serviceName] : undefined
      return service ? `${service.status}|${service.startMode}` : 'MISSING|MISSING'
    }
    if (command.includes('Get-Service -Name')) {
      return serviceName ? state.serviceStates[serviceName]?.status ?? '' : ''
    }
    const valueName = command.match(/-Name '([^']+)'/)?.[1]
    return valueName ? state.registryValues[valueName] ?? '0' : ''
  })
})

describe('system and admin information', () => {
  it('reads CPU, all GPUs, RAM, and disks from the Windows hardware query', async () => {
    state.hardwareJson = JSON.stringify({
      computer: 'GAMING-PC',
      os: 'Windows 11',
      cpu: 'AMD Ryzen 9 / AMD Ryzen 9',
      cores: 12,
      threads: 24,
      gpu: 'NVIDIA RTX / AMD Radeon',
      ramGB: 32,
      ramFreeGB: 12,
      disks: [{ name: 'C:', freeGB: 100, totalGB: 500 }]
    })

    await expect(engine.isAdmin()).resolves.toBe(true)
    await expect(engine.getSystemInfo()).resolves.toEqual({
      computer: 'GAMING-PC',
      os: 'Windows 11',
      cpu: 'AMD Ryzen 9 / AMD Ryzen 9',
      cores: 12,
      threads: 24,
      gpu: 'NVIDIA RTX / AMD Radeon',
      ramGB: 32,
      ramFreeGB: 12,
      disks: [{ name: 'C:', freeGB: 100, totalGB: 500 }],
      isAdmin: true
    })
  })

  it('reports malformed Windows hardware output instead of silently hiding the scan failure', async () => {
    state.isAdmin = 'false'
    state.hardwareJson = 'invalid JSON'

    await expect(engine.getSystemInfo()).rejects.toThrow(
      'Não foi possível interpretar os dados de hardware do Windows'
    )
  })
})

describe('tweak status, apply, and revert operations', () => {
  it('maps all tweak registry and service values to statuses', async () => {
    state.registryValues = {
      'AutoGameModeEnabled': '1',
      HwSchMode: '2',
      GameDVR_Enabled: '0',
      'GPU Priority': '8',
      VisualFXSetting: '2',
      EnableTransparency: '0',
      MinAnimate: '0',
      GlobalUserDisabled: '1',
      NetworkThrottlingIndex: 'ffffffff',
      MouseSpeed: '0',
      Nagle: '1'
    }
    state.serviceStates.SysMain.status = 'Stopped'
    state.serviceStates.XblAuthManager.status = 'Stopped'
    state.serviceStates.XblGameSave.status = 'Stopped'
    state.serviceStates.XboxNetApiSvc.status = 'Stopped'
    state.serviceStates.DiagTrack.status = 'Stopped'
    state.powerScheme = '(SCHEME_CURRENT) e9a42b02-d5df-448d-aa00-03f14749eb61 (Ultimate Performance)'

    const statuses = await engine.getStatuses()

    expect(statuses).toHaveLength(TWEAKS.length)
    expect(statuses.filter((status) => status.applied).map((status) => status.id)).toEqual(
      expect.arrayContaining([
        'ultimate-power', 'game-mode', 'hags', 'game-dvr', 'mmcss-games', 'visual-fx',
        'transparency', 'animations', 'background-apps', 'network-throttle', 'nagle',
        'mouse-accel', 'sysmain'
      ])
    )
    expect(statuses.find((status) => status.id === 'usb-suspend')).toMatchObject({
      applied: false,
      current: 'plano ativo'
    })
    expect(statuses.filter((status) => status.id.startsWith('xbox-')).every((status) => status.applied)).toBe(true)
  })

  it('applies and reverts every catalog tweak, recording success for each action', async () => {
    const ids = TWEAKS.map((tweak) => tweak.id)
    const applied = await engine.applyTweaks(ids)

    expect(applied.results).toHaveLength(ids.length)
    expect(applied.results.every((result) => result.ok)).toBe(true)
    expect(applied.log.every((line) => line.startsWith('OK'))).toBe(true)
    expect(await readFile(join(dataRoot, 'picote-snapshot.json'), 'utf8')).toContain('ultimate-power')

    const reverted = await engine.revertTweaks(ids)
    expect(reverted.results).toHaveLength(ids.length)
    expect(reverted.results.every((result) => result.ok)).toBe(true)
    expect(reverted.log.every((line) => line.startsWith('REV'))).toBe(true)
    expect(runPs).toHaveBeenCalledWith(expect.stringContaining("sc.exe config 'XblAuthManager' start= demand"))
    expect(runPs).toHaveBeenCalledWith(expect.stringContaining("Start-Service -Name 'XblAuthManager'"))
    expect(runPs).toHaveBeenCalledWith(expect.stringContaining("Set-Service -Name 'DiagTrack' -StartupType Disabled"))
    expect(runPs).toHaveBeenCalledWith(expect.stringContaining("sc.exe config 'DiagTrack' start= auto"))
  })

  it('disables Windows telemetry only when requested and restores its saved startup mode', async () => {
    const applied = await engine.applyTweaks(['telemetry'])
    expect(applied.results).toEqual([
      { id: 'telemetry', ok: true, message: 'DiagTrack parado e desativado' }
    ])
    expect(runPs).toHaveBeenCalledWith(expect.stringContaining("Set-Service -Name 'DiagTrack' -StartupType Disabled"))

    const snapshot = JSON.parse(await readFile(join(dataRoot, 'picote-snapshot.json'), 'utf8'))
    expect(snapshot.telemetry).toEqual({ startMode: 'Auto', status: 'Running' })

    const reverted = await engine.revertTweaks(['telemetry'])
    expect(reverted.results[0].ok).toBe(true)
    expect(runPs).toHaveBeenCalledWith(expect.stringContaining("sc.exe config 'DiagTrack' start= auto"))
    expect(runPs).toHaveBeenCalledWith(expect.stringContaining("Start-Service -Name 'DiagTrack'"))
  })

  it('returns a failure result for an unknown tweak without aborting the report', async () => {
    const report = await engine.applyTweaks(['unknown-tweak'])

    expect(report.results).toEqual([
      { id: 'unknown-tweak', ok: false, message: 'Tweak desconhecido: unknown-tweak' }
    ])
    expect(report.log[0]).toContain('ERR unknown-tweak')
  })

  it('reverts only explicitly requested tweaks and defaults to all catalog items', async () => {
    const selected = await engine.revertTweaks(['visual-fx'])
    expect(selected.results.map((result) => result.id)).toEqual(['visual-fx'])

    const all = await engine.revertTweaks()
    expect(all.results.map((result) => result.id)).toEqual(TWEAKS.map((tweak) => tweak.id))
  })
})

describe('restore point integration', () => {
  it('creates a point from currently active tweaks, lists it, and restores it', async () => {
    state.registryValues = {
      'AutoGameModeEnabled': '1',
      GameDVR_Enabled: '0',
      SysMain: 'Running',
      Nagle: '0'
    }

    const point = await engine.createRestorePoint('Before integration test')

    expect(point.description).toBe('Before integration test')
    expect(point.appliedIds).toContain('game-mode')
    expect(point.appliedIds).toContain('game-dvr')
    expect(await engine.listRestorePoints()).toEqual([point])
    await expect(engine.restoreFromPoint(point.id)).resolves.toMatchObject({
      results: expect.arrayContaining([
        expect.objectContaining({ id: 'game-mode', ok: true }),
        expect.objectContaining({ id: 'game-dvr', ok: true })
      ])
    })
  })

  it('rejects attempts to restore a point that does not exist', async () => {
    await expect(engine.restoreFromPoint('missing-point')).rejects.toThrow(
      'Ponto de restauração não encontrado: missing-point'
    )
  })
})
