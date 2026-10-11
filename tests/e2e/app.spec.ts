import { expect, test } from '@playwright/test'
import { allure } from 'allure-playwright'

test('aplica o fluxo completo da aplicação com criação de ponto de restauração', async ({ page }) => {
  const restorePoints: Array<{ id: string; name: string; description: string; createdAt: string; appliedIds: string[]; tweakCount: number }> = []

  await page.addInitScript(({ points }) => {
    const mockApi = {
      getSystem: async () => ({
        computer: 'Teste PC',
        os: 'Windows 11',
        cpu: 'Intel Core i7',
        cores: 8,
        threads: 16,
        gpu: 'NVIDIA RTX 4080',
        ramGB: 32,
        ramFreeGB: 16,
        disks: [{ name: 'C:', freeGB: 240, totalGB: 512 }],
        isAdmin: true
      }),
      isAdmin: async () => true,
      getStatus: async () => [
        { id: 'ultimate-power', applied: true, current: 'Ultimate Performance' },
        { id: 'game-mode', applied: false, current: '0' },
        { id: 'mouse-accel', applied: true, current: '0' }
      ],
      apply: async () => ({ results: [], log: ['OK'] }),
      revert: async () => ({ results: [], log: ['REV'] }),
      createRestorePoint: async (description?: string) => {
        const point = {
          id: `pt-${Date.now()}`,
          name: 'Ponto 1',
          description: description ?? 'Ponto de restauração',
          createdAt: new Date().toISOString(),
          appliedIds: ['ultimate-power', 'mouse-accel'],
          tweakCount: 2
        }
        points.push(point)
        return point
      },
      listRestorePoints: async () => points,
      restoreFromPoint: async () => ({ results: [], log: ['Ponto restaurado'] })
    }
    Object.defineProperty(window, 'picote', { value: mockApi, configurable: true })
  }, { points: restorePoints })

  await allure.step('Abrir a aplicação', async () => {
    await page.goto('/')
    await expect(page).toHaveTitle(/MestrePicoteBoost/i)
    await allure.attachment('Tela inicial', await page.screenshot(), 'image/png')
  })

  await allure.step('Entrar na aba Ponto de restauração', async () => {
    await page.getByRole('button', { name: /Ponto de restauração/i }).click()
    await expect(page.getByRole('heading', { name: /Ponto de restauração/i })).toBeVisible()
    await allure.attachment('Aba de ponto de restauração', await page.screenshot(), 'image/png')
  })

  await allure.step('Criar um ponto de restauração', async () => {
    await page.getByLabel('Descrição do ponto').fill('Antes do teste automatizado')
    await page.getByRole('button', { name: /Criar ponto/i }).click()
    await expect(page.getByText(/Ponto de restauração criado/i)).toBeVisible()
    await allure.attachment('Resultado do ponto criado', await page.screenshot(), 'image/png')
  })

  await allure.step('Navegar para o painel e validar a lista de perfis', async () => {
    await page.getByRole('button', { name: /Painel/i }).click()
    await expect(page.getByRole('heading', { name: /Seu rig, no modo partida/i })).toBeVisible()
    await expect(page.getByText(/FPS e input/i).first()).toBeVisible()
    await allure.attachment('Painel com perfis', await page.screenshot(), 'image/png')
  })
})
