import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function runPs(command: string): Promise<{ stdout: string; stderr: string }> {
  const wrapped = [
    '[Console]::OutputEncoding = [Text.UTF8Encoding]::new();',
    '$ErrorActionPreference = "Stop";',
    command
  ].join(' ')

  try {
    const { stdout, stderr } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', wrapped],
      {
        windowsHide: true,
        timeout: 45000,
        maxBuffer: 8 * 1024 * 1024,
        encoding: 'utf8'
      }
    )
    return { stdout: stdout?.trim() ?? '', stderr: stderr?.trim() ?? '' }
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    const message = [err.stderr, err.stdout, err.message].filter(Boolean).join('\n')
    throw new Error(message || 'Falha no PowerShell')
  }
}

export async function runPsSafe(command: string): Promise<string> {
  try {
    const { stdout } = await runPs(command)
    return stdout
  } catch {
    return ''
  }
}
