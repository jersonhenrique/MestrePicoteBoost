import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { TWEAKS } from '../shared/catalog'
import { RestorePointService, RestorePointStore } from '../shared/restore'
import type { ActionResult, ApplyReport, RestorePoint, SystemInfo, TweakStatus } from '../shared/types'
import { runPs, runPsSafe } from './powershell'

interface Snapshot {
  [id: string]: Record<string, string>
}

const ULTIMATE_SCHEME = 'e9a42b02-d5df-448d-aa00-03f14749eb61'
const OPTIONAL_SERVICES: Record<string, string> = {
  sysmain: 'SysMain',
  'xbox-auth': 'XblAuthManager',
  'xbox-game-save': 'XblGameSave',
  'xbox-network': 'XboxNetApiSvc'
}

interface ServiceState {
  status: string
  startMode: string
}

function storePath(): string {
  return join(app.getPath('userData'), 'picote-snapshot.json')
}

async function loadSnapshot(): Promise<Snapshot> {
  try {
    const raw = await readFile(storePath(), 'utf8')
    return JSON.parse(raw) as Snapshot
  } catch {
    return {}
  }
}

async function saveSnapshot(snap: Snapshot): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(storePath(), JSON.stringify(snap, null, 2), 'utf8')
}

const restoreStore = new RestorePointStore(join(app.getPath('userData'), 'picote-restore-points.json'))
const restorePointService = new RestorePointService(restoreStore)

async function remember(id: string, data: Record<string, string>): Promise<void> {
  const snap = await loadSnapshot()
  if (!snap[id]) snap[id] = data
  await saveSnapshot(snap)
}

function psJson(command: string): string {
  return `${command} | ConvertTo-Json -Compress -Depth 6`
}

export async function isAdmin(): Promise<boolean> {
  const out = await runPsSafe(
    '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'
  )
  return out.toLowerCase() === 'true'
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const admin = await isAdmin()
  const json = await runPsSafe(
    psJson(`
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$gpu = @(Get-CimInstance Win32_VideoController | Where-Object { $_.Name -notmatch 'Oray|Remote|Basic Display' } | Select-Object -First 1)
$os = Get-CimInstance Win32_OperatingSystem
$cs = Get-CimInstance Win32_ComputerSystem
$disks = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
  [pscustomobject]@{ name = $_.DeviceID; freeGB = [math]::Round(($_.FreeSpace/1GB),1); totalGB = [math]::Round(($_.Size/1GB),1) }
})
[pscustomobject]@{
  computer = $env:COMPUTERNAME
  os = $os.Caption
  cpu = ($cpu.Name).Trim()
  cores = $cpu.NumberOfCores
  threads = $cpu.NumberOfLogicalProcessors
  gpu = $(if ($gpu.Count -gt 0) { $gpu[0].Name } else { 'GPU não detectada' })
  ramGB = [math]::Round($cs.TotalPhysicalMemory/1GB,1)
  ramFreeGB = [math]::Round($os.FreePhysicalMemory/1MB,1)
  disks = $disks
}
`)
  )

  try {
    const parsed = JSON.parse(json) as Omit<SystemInfo, 'isAdmin'>
    const disks = Array.isArray(parsed.disks) ? parsed.disks : parsed.disks ? [parsed.disks] : []
    return { ...parsed, disks, isAdmin: admin }
  } catch {
    return {
      computer: 'PC',
      os: 'Windows',
      cpu: 'CPU não lida',
      cores: 0,
      threads: 0,
      gpu: 'GPU não lida',
      ramGB: 0,
      ramFreeGB: 0,
      disks: [],
      isAdmin: admin
    }
  }
}

async function regGet(root: string, path: string, name: string): Promise<string> {
  const out = await runPsSafe(
    `try { $v = Get-ItemProperty -Path '${root}:\\${path}' -Name '${name}' -ErrorAction Stop; [string]$v.'${name}' } catch { 'MISSING' }`
  )
  return out || 'MISSING'
}

async function regSet(root: string, path: string, name: string, type: string, value: string): Promise<void> {
  await runPs(`
if (-not (Test-Path '${root}:\\${path}')) { New-Item -Path '${root}:\\${path}' -Force | Out-Null }
New-ItemProperty -Path '${root}:\\${path}' -Name '${name}' -PropertyType ${type} -Value ${value} -Force | Out-Null
`)
}

async function powerSchemeLine(): Promise<string> {
  return runPsSafe('(powercfg /getactivescheme)')
}

async function powerGuid(): Promise<string> {
  const out = await powerSchemeLine()
  const match = out.match(
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
  )
  return match?.[0] ?? ''
}

async function getServiceState(name: string): Promise<ServiceState> {
  const output = await runPsSafe(`
$service = Get-CimInstance Win32_Service -Filter "Name='${name}'" -ErrorAction SilentlyContinue
if ($null -eq $service) { 'MISSING|MISSING' } else { '{0}|{1}' -f $service.State, $service.StartMode }
`)
  const [status, startMode] = output.split('|')
  if (!status || status === 'MISSING' || !startMode || startMode === 'MISSING') {
    throw new Error(`Serviço do Windows não encontrado: ${name}`)
  }
  return { status, startMode }
}

async function disableService(name: string): Promise<void> {
  await runPs(`
$service = Get-Service -Name '${name}' -ErrorAction Stop
if ($service.Status -ne 'Stopped') { Stop-Service -Name '${name}' -Force -ErrorAction Stop }
Set-Service -Name '${name}' -StartupType Disabled -ErrorAction Stop
`)
}

async function restoreWindowsService(name: string, previous: ServiceState): Promise<void> {
  const startModes: Record<string, string> = {
    Boot: 'boot',
    System: 'system',
    Auto: 'auto',
    Manual: 'demand',
    Disabled: 'disabled'
  }
  const startMode = startModes[previous.startMode]
  if (!startMode) {
    throw new Error(`Tipo de inicialização não reconhecido para ${name}: ${previous.startMode}`)
  }

  await runPs(`
& sc.exe config '${name}' start= ${startMode} | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Falha ao restaurar a inicialização do serviço ${name}' }
switch ('${previous.status}') {
  'Running' { Start-Service -Name '${name}' -ErrorAction Stop }
  'Paused' {
    Start-Service -Name '${name}' -ErrorAction Stop
    Suspend-Service -Name '${name}' -ErrorAction Stop
  }
  default { Stop-Service -Name '${name}' -Force -ErrorAction SilentlyContinue }
}
`)
}

export async function getStatuses(): Promise<TweakStatus[]> {
  const schemeLine = await powerSchemeLine()
  const scheme = schemeLine.match(
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
  )?.[0] ?? ''
  const [
    gameMode,
    hags,
    dvr,
    gpuPri,
    visual,
    trans,
    anim,
    bg,
    throttle,
    mouse
  ] = await Promise.all([
    regGet('HKCU', 'Software\\Microsoft\\GameBar', 'AutoGameModeEnabled'),
    regGet('HKLM', 'SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers', 'HwSchMode'),
    regGet('HKCU', 'System\\GameConfigStore', 'GameDVR_Enabled'),
    regGet('HKLM', 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games', 'GPU Priority'),
    regGet('HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects', 'VisualFXSetting'),
    regGet('HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', 'EnableTransparency'),
    regGet('HKCU', 'Control Panel\\Desktop\\WindowMetrics', 'MinAnimate'),
    regGet('HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications', 'GlobalUserDisabled'),
    regGet('HKLM', 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile', 'NetworkThrottlingIndex'),
    regGet('HKCU', 'Control Panel\\Mouse', 'MouseSpeed')
  ])

  const nagleSample = await runPsSafe(`
$ifaces = Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces'
$hit = $false
foreach ($i in $ifaces) {
  $p = Get-ItemProperty $i.PSPath -ErrorAction SilentlyContinue
  if ($p.TcpNoDelay -eq 1) { $hit = $true; break }
}
if ($hit) { '1' } else { '0' }
`)
  const serviceStatuses = await Promise.all(
    Object.entries(OPTIONAL_SERVICES).map(async ([id, name]) => [id, await runPsSafe(`(Get-Service -Name '${name}' -ErrorAction SilentlyContinue).Status`)] as const)
  )

  const map: Record<string, { applied: boolean; current: string }> = {
    'ultimate-power': {
      applied: /ultimate performance/i.test(schemeLine) || scheme.toLowerCase() === ULTIMATE_SCHEME,
      current: schemeLine || scheme || 'desconhecido'
    },
    'usb-suspend': { applied: false, current: 'plano ativo' },
    'pcie-link': { applied: false, current: 'plano ativo' },
    'game-mode': { applied: gameMode === '1', current: gameMode },
    hags: { applied: hags === '2', current: hags },
    'game-dvr': { applied: dvr === '0', current: dvr },
    'mmcss-games': { applied: gpuPri === '8', current: gpuPri },
    'visual-fx': { applied: visual === '2', current: visual },
    transparency: { applied: trans === '0', current: trans },
    animations: { applied: anim === '0', current: anim },
    'background-apps': { applied: bg === '1', current: bg },
    'network-throttle': { applied: throttle === '4294967295' || throttle.toLowerCase() === 'ffffffff', current: throttle },
    nagle: { applied: nagleSample === '1', current: nagleSample },
    'mouse-accel': { applied: mouse === '0', current: mouse }
  }
  for (const [id, serviceStatus] of serviceStatuses) {
    map[id] = { applied: serviceStatus.toLowerCase() === 'stopped', current: serviceStatus || 'MISSING' }
  }

  return TWEAKS.map((t) => ({
    id: t.id,
    applied: map[t.id]?.applied ?? false,
    current: map[t.id]?.current ?? '—'
  }))
}

async function applyOne(id: string): Promise<string> {
  switch (id) {
    case 'ultimate-power': {
      const prev = await powerGuid()
      await remember(id, { scheme: prev })
      await runPs(`
powercfg -duplicatescheme ${ULTIMATE_SCHEME} | Out-Null
powercfg -setactive ${ULTIMATE_SCHEME}
`)
      return 'Plano Ultimate Performance ativo'
    }
    case 'usb-suspend': {
      const guid = await powerGuid()
      await remember(id, { scheme: guid })
      await runPs(`powercfg /SETACVALUEINDEX ${guid} 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-143dd0bfaa38 0
powercfg /SETDCVALUEINDEX ${guid} 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-143dd0bfaa38 0
powercfg /setactive ${guid}`)
      return 'Suspensão USB desligada'
    }
    case 'pcie-link': {
      const guid = await powerGuid()
      await remember(id, { scheme: guid })
      await runPs(`powercfg /SETACVALUEINDEX ${guid} 501a4d13-42af-4429-9fd1-a6cf2bdffac9 ee12f906-d277-404b-b6da-e5cd03cc4aa8 0
powercfg /SETDCVALUEINDEX ${guid} 501a4d13-42af-4429-9fd1-a6cf2bdffac9 ee12f906-d277-404b-b6da-e5cd03cc4aa8 0
powercfg /setactive ${guid}`)
      return 'PCI Express em desempenho máximo'
    }
    case 'game-mode': {
      await remember(id, {
        auto: await regGet('HKCU', 'Software\\Microsoft\\GameBar', 'AutoGameModeEnabled'),
        allow: await regGet('HKCU', 'Software\\Microsoft\\GameBar', 'AllowAutoGameMode')
      })
      await regSet('HKCU', 'Software\\Microsoft\\GameBar', 'AutoGameModeEnabled', 'DWord', '1')
      await regSet('HKCU', 'Software\\Microsoft\\GameBar', 'AllowAutoGameMode', 'DWord', '1')
      return 'Game Mode ligado'
    }
    case 'hags': {
      await remember(id, {
        value: await regGet('HKLM', 'SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers', 'HwSchMode')
      })
      await regSet('HKLM', 'SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers', 'HwSchMode', 'DWord', '2')
      return 'HAGS ligado (reinicie para valer 100%)'
    }
    case 'game-dvr': {
      await remember(id, {
        dvr: await regGet('HKCU', 'System\\GameConfigStore', 'GameDVR_Enabled'),
        cap: await regGet('HKCU', 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR', 'AppCaptureEnabled')
      })
      await regSet('HKCU', 'System\\GameConfigStore', 'GameDVR_Enabled', 'DWord', '0')
      await regSet('HKCU', 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR', 'AppCaptureEnabled', 'DWord', '0')
      return 'Game DVR desligado'
    }
    case 'mmcss-games': {
      const path = 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'
      await remember(id, {
        gpu: await regGet('HKLM', path, 'GPU Priority'),
        prio: await regGet('HKLM', path, 'Priority'),
        cat: await regGet('HKLM', path, 'Scheduling Category')
      })
      await regSet('HKLM', path, 'GPU Priority', 'DWord', '8')
      await regSet('HKLM', path, 'Priority', 'DWord', '6')
      await runPs(`
$path = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'
if (-not (Test-Path $path)) { New-Item $path -Force | Out-Null }
New-ItemProperty -Path $path -Name 'Scheduling Category' -PropertyType String -Value 'High' -Force | Out-Null
`)
      return 'MMCSS Games ajustado'
    }
    case 'visual-fx': {
      await remember(id, {
        value: await regGet('HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects', 'VisualFXSetting')
      })
      await regSet('HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects', 'VisualFXSetting', 'DWord', '2')
      return 'Efeitos visuais no desempenho'
    }
    case 'transparency': {
      await remember(id, {
        value: await regGet('HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', 'EnableTransparency')
      })
      await regSet('HKCU', 'Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', 'EnableTransparency', 'DWord', '0')
      return 'Transparência desligada'
    }
    case 'animations': {
      await remember(id, {
        value: await regGet('HKCU', 'Control Panel\\Desktop\\WindowMetrics', 'MinAnimate')
      })
      await runPs(`
$path = 'HKCU:\\Control Panel\\Desktop\\WindowMetrics'
New-ItemProperty -Path $path -Name 'MinAnimate' -PropertyType String -Value '0' -Force | Out-Null
`)
      return 'Animações de janela desligadas'
    }
    case 'background-apps': {
      await remember(id, {
        value: await regGet(
          'HKCU',
          'Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications',
          'GlobalUserDisabled'
        )
      })
      await regSet(
        'HKCU',
        'Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications',
        'GlobalUserDisabled',
        'DWord',
        '1'
      )
      return 'Apps em segundo plano limitados'
    }
    case 'network-throttle': {
      const path = 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile'
      await remember(id, {
        throttle: await regGet('HKLM', path, 'NetworkThrottlingIndex'),
        resp: await regGet('HKLM', path, 'SystemResponsiveness')
      })
      await regSet('HKLM', path, 'NetworkThrottlingIndex', 'DWord', '4294967295')
      await regSet('HKLM', path, 'SystemResponsiveness', 'DWord', '0')
      return 'Throttle de rede removido'
    }
    case 'nagle': {
      await remember(id, { applied: '1' })
      await runPs(`
Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' | ForEach-Object {
  $p = Get-ItemProperty $_.PSPath
  if ($null -ne $p.DhcpIPAddress -or $null -ne $p.IPAddress) {
    New-ItemProperty -Path $_.PSPath -Name 'TcpNoDelay' -PropertyType DWord -Value 1 -Force | Out-Null
    New-ItemProperty -Path $_.PSPath -Name 'TcpAckFrequency' -PropertyType DWord -Value 1 -Force | Out-Null
  }
}
`)
      return 'Nagle desligado nas interfaces ativas'
    }
    case 'mouse-accel': {
      await remember(id, {
        speed: await regGet('HKCU', 'Control Panel\\Mouse', 'MouseSpeed'),
        t1: await regGet('HKCU', 'Control Panel\\Mouse', 'MouseThreshold1'),
        t2: await regGet('HKCU', 'Control Panel\\Mouse', 'MouseThreshold2')
      })
      await runPs(`
$path = 'HKCU:\\Control Panel\\Mouse'
New-ItemProperty -Path $path -Name 'MouseSpeed' -PropertyType String -Value '0' -Force | Out-Null
New-ItemProperty -Path $path -Name 'MouseThreshold1' -PropertyType String -Value '0' -Force | Out-Null
New-ItemProperty -Path $path -Name 'MouseThreshold2' -PropertyType String -Value '0' -Force | Out-Null
`)
      return 'Precisão do ponteiro desligada'
    }
    case 'sysmain':
    case 'xbox-auth':
    case 'xbox-game-save':
    case 'xbox-network': {
      const serviceName = OPTIONAL_SERVICES[id]
      const previous = await getServiceState(serviceName)
      await remember(id, { startMode: previous.startMode, status: previous.status })
      await disableService(serviceName)
      return `${serviceName} parado e desativado`
    }
    default:
      throw new Error(`Tweak desconhecido: ${id}`)
  }
}

function dwordOrString(value: string): string {
  if (value === 'MISSING' || value === '') return ''
  if (/^\d+$/.test(value)) return value
  return `'${value.replace(/'/g, "''")}'`
}

export async function revertOne(id: string): Promise<string> {
  const snap = await loadSnapshot()
  const prev = snap[id]

  switch (id) {
    case 'ultimate-power': {
      const scheme = prev?.scheme
      if (scheme) await runPs(`powercfg -setactive ${scheme}`)
      else await runPs('powercfg -setactive SCHEME_BALANCED')
      break
    }
    case 'game-mode':
      if (prev?.auto && prev.auto !== 'MISSING') {
        await regSet('HKCU', 'Software\\Microsoft\\GameBar', 'AutoGameModeEnabled', 'DWord', prev.auto)
      }
      break
    case 'hags':
      if (prev?.value && prev.value !== 'MISSING') {
        await regSet('HKLM', 'SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers', 'HwSchMode', 'DWord', prev.value)
      } else {
        await regSet('HKLM', 'SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers', 'HwSchMode', 'DWord', '1')
      }
      break
    case 'game-dvr':
      await regSet('HKCU', 'System\\GameConfigStore', 'GameDVR_Enabled', 'DWord', prev?.dvr && prev.dvr !== 'MISSING' ? prev.dvr : '1')
      break
    case 'visual-fx':
      await regSet(
        'HKCU',
        'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects',
        'VisualFXSetting',
        'DWord',
        prev?.value && prev.value !== 'MISSING' ? prev.value : '0'
      )
      break
    case 'transparency':
      await regSet(
        'HKCU',
        'Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize',
        'EnableTransparency',
        'DWord',
        prev?.value && prev.value !== 'MISSING' ? prev.value : '1'
      )
      break
    case 'animations':
      await runPs(`New-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop\\WindowMetrics' -Name 'MinAnimate' -PropertyType String -Value '1' -Force | Out-Null`)
      break
    case 'background-apps':
      await regSet(
        'HKCU',
        'Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications',
        'GlobalUserDisabled',
        'DWord',
        '0'
      )
      break
    case 'network-throttle': {
      const path = 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile'
      await regSet('HKLM', path, 'SystemResponsiveness', 'DWord', '20')
      await runPs(`Remove-ItemProperty -Path 'HKLM:\\${path}' -Name 'NetworkThrottlingIndex' -ErrorAction SilentlyContinue`)
      break
    }
    case 'nagle':
      await runPs(`
Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' | ForEach-Object {
  Remove-ItemProperty -Path $_.PSPath -Name 'TcpNoDelay' -ErrorAction SilentlyContinue
  Remove-ItemProperty -Path $_.PSPath -Name 'TcpAckFrequency' -ErrorAction SilentlyContinue
}
`)
      break
    case 'mouse-accel':
      await runPs(`
$path = 'HKCU:\\Control Panel\\Mouse'
New-ItemProperty -Path $path -Name 'MouseSpeed' -PropertyType String -Value '${prev?.speed && prev.speed !== 'MISSING' ? prev.speed : '1'}' -Force | Out-Null
New-ItemProperty -Path $path -Name 'MouseThreshold1' -PropertyType String -Value '${prev?.t1 && prev.t1 !== 'MISSING' ? prev.t1 : '6'}' -Force | Out-Null
New-ItemProperty -Path $path -Name 'MouseThreshold2' -PropertyType String -Value '${prev?.t2 && prev.t2 !== 'MISSING' ? prev.t2 : '10'}' -Force | Out-Null
`)
      break
    case 'sysmain':
    case 'xbox-auth':
    case 'xbox-game-save':
    case 'xbox-network':
      if (prev?.startMode && prev.status) {
        await restoreWindowsService(OPTIONAL_SERVICES[id], {
          startMode: prev.startMode,
          status: prev.status
        })
      }
      break
    case 'mmcss-games': {
      const path = 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'
      if (prev?.gpu && prev.gpu !== 'MISSING') await regSet('HKLM', path, 'GPU Priority', 'DWord', prev.gpu)
      break
    }
    case 'usb-suspend':
    case 'pcie-link':
      return 'Volte o plano de energia anterior (Restaurar Ultimate Performance) para reverter este item junto.'
    default:
      break
  }

  if (snap[id]) {
    delete snap[id]
    await saveSnapshot(snap)
  }
  void dwordOrString
  return `Revertido: ${id}`
}

export async function listRestorePoints(): Promise<RestorePoint[]> {
  return restorePointService.listSnapshots()
}

export async function createRestorePoint(description?: string): Promise<RestorePoint> {
  const statuses = await getStatuses()
  const appliedIds = TWEAKS.filter((tweak) => statuses.some((status) => status.id === tweak.id && status.applied)).map(
    (tweak) => tweak.id
  )
  return restorePointService.createSnapshot(description, appliedIds)
}

export async function restoreFromPoint(id: string): Promise<ApplyReport> {
  const point = await restorePointService.restoreSnapshot(id)
  if (!point) {
    throw new Error(`Ponto de restauração não encontrado: ${id}`)
  }
  return revertTweaks(point.appliedIds)
}

export async function applyTweaks(ids: string[]): Promise<ApplyReport> {
  const results: ActionResult[] = []
  const log: string[] = []
  for (const id of ids) {
    try {
      const message = await applyOne(id)
      results.push({ id, ok: true, message })
      log.push(`OK  ${id} — ${message}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      results.push({ id, ok: false, message })
      log.push(`ERR ${id} — ${message}`)
    }
  }
  return { results, log }
}

export async function revertTweaks(ids?: string[]): Promise<ApplyReport> {
  const target = ids?.length ? ids : TWEAKS.map((t) => t.id)
  const results: ActionResult[] = []
  const log: string[] = []
  for (const id of target) {
    try {
      const message = await revertOne(id)
      results.push({ id, ok: true, message })
      log.push(`REV ${id} — ${message}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      results.push({ id, ok: false, message })
      log.push(`ERR ${id} — ${message}`)
    }
  }
  return { results, log }
}
