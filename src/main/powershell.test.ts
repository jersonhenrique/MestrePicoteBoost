import { describe, expect, it, vi } from 'vitest'
import { createPowerShellRunner, type PowerShellExecutor } from './powershell'

describe('PowerShell execution helpers', () => {
  it('runs powershell non-interactively and returns trimmed output', async () => {
    const execute = vi.fn<PowerShellExecutor>().mockResolvedValue({
      stdout: ' result \r\n',
      stderr: ' warning \n'
    })
    const { runPs } = createPowerShellRunner(execute)

    await expect(runPs('Get-Item')).resolves.toEqual({ stdout: 'result', stderr: 'warning' })
    expect(execute).toHaveBeenCalledWith(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', expect.stringContaining('Get-Item')],
      expect.objectContaining({ windowsHide: true, timeout: 45000 })
    )
  })

  it('surfaces PowerShell failures as useful errors', async () => {
    const execute = vi.fn<PowerShellExecutor>().mockRejectedValue(
      Object.assign(new Error('process failed'), { stderr: 'access denied', stdout: '' })
    )
    const { runPs } = createPowerShellRunner(execute)

    await expect(runPs('Get-Item')).rejects.toThrow('access denied')
  })

  it('returns an empty string from the safe helper when PowerShell fails', async () => {
    const execute = vi.fn<PowerShellExecutor>().mockRejectedValue(new Error('process failed'))
    const { runPsSafe } = createPowerShellRunner(execute)

    await expect(runPsSafe('Get-Item')).resolves.toBe('')
  })
})
