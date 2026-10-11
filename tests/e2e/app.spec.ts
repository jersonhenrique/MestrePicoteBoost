import { expect, test, type Page } from '@playwright/test'
import { allure } from 'allure-playwright'

async function attachStepScreenshot(page: Page, title: string) {
  await allure.attachment(title, await page.screenshot({ fullPage: true }), 'image/png')
}

test('validates all user-facing application workflows with screenshots and final result', async ({ page }) => {
  await page.addInitScript(() => {
    const restorePoints: Array<{
      id: string
      name: string
      description: string
      createdAt: string
      appliedIds: string[]
      tweakCount: number
    }> = []
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
      apply: async (ids: string[]) => ({
        results: ids.map((id) => ({ id, ok: true, message: 'Aplicado no teste' })),
        log: ids.map((id) => `OK ${id} — Aplicado no teste`)
      }),
      revert: async (ids?: string[]) => ({
        results: (ids ?? ['ultimate-power', 'game-mode']).map((id) => ({
          id,
          ok: true,
          message: 'Revertido no teste'
        })),
        log: ids?.length ? [`REV ${ids.join(', ')}`] : ['REV todos os ajustes']
      }),
      createRestorePoint: async (description?: string) => {
        const point = {
          id: `pt-${Date.now()}`,
          name: 'Ponto de teste',
          description: description ?? 'Ponto de restauração',
          createdAt: new Date().toISOString(),
          appliedIds: ['ultimate-power', 'mouse-accel'],
          tweakCount: 2
        }
        restorePoints.unshift(point)
        return point
      },
      listRestorePoints: async () => restorePoints,
      restoreFromPoint: async (id: string) => ({
        results: [{ id, ok: true, message: 'Ponto restaurado no teste' }],
        log: [`Ponto restaurado: ${id}`]
      })
    }
    Object.defineProperty(window, 'picote', { value: mockApi, configurable: true })
  })

  await allure.step('Abrir o app e validar a primeira aba de restauração', async () => {
    await page.goto('/')
    await expect(page).toHaveTitle(/MestrePicoteBoost/i)
    await expect(page.getByRole('heading', { name: 'Ponto de restauração' })).toBeVisible()
    await expect(page.getByText('Nenhum ponto de restauração criado ainda.')).toBeVisible()
    await attachStepScreenshot(page, '01 - primeira aba e estado vazio')
  })

  await allure.step('Criar ponto, validar dados e restaurar pelo ponto criado', async () => {
    await page.getByLabel('Descrição do ponto').fill('Antes da sessão de testes')
    await attachStepScreenshot(page, '02 - descrição informada')
    await page.getByRole('button', { name: 'Criar ponto' }).click()
    await expect(page.locator('.restore-card').getByRole('heading', { name: 'Ponto de teste' })).toBeVisible()
    await expect(page.locator('.restore-card').getByText('Antes da sessão de testes')).toBeVisible()
    await expect(page.locator('.restore-card').getByText('2 ajustes')).toBeVisible()
    await expect(page.getByText(/Ponto de restauração criado/)).toBeVisible()
    await attachStepScreenshot(page, '03 - ponto criado e validado')
    await page.getByRole('button', { name: 'Restaurar este ponto' }).click()
    await expect(page.getByText(/Ponto restaurado:/)).toBeVisible()
    await attachStepScreenshot(page, '04 - resultado da restauração')
  })

  await allure.step('Validar hardware, score, atualização e navegação por todos os perfis', async () => {
    await page.getByRole('button', { name: 'Painel', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Seu rig, no modo partida.' })).toBeVisible()
    await expect(page.getByText('Intel Core i7')).toBeVisible()
    await expect(page.getByText('NVIDIA RTX 4080')).toBeVisible()
    await expect(page.getByText('16 GB livres de 32 GB')).toBeVisible()
    await page.getByRole('button', { name: 'Atualizar scan' }).click()
    await expect(page.getByText('2/19 otimizações ativas')).toBeVisible()
    await attachStepScreenshot(page, '05 - painel, hardware, score e atualização')

    for (let index = 0; index < 4; index += 1) {
      const profile = page.locator('button.profile').nth(index)
      await profile.click()
      await expect(page.getByRole('heading', { name: 'Catálogo de tweaks' })).toBeVisible()
      await expect(page.getByText(/Perfil:/)).toBeVisible()
      await attachStepScreenshot(page, `06 - perfil ${index + 1}`)
      if (index < 3) await page.getByRole('button', { name: 'Painel', exact: true }).click()
    }
  })

  await allure.step('Filtrar catálogo, selecionar os visíveis e aplicar ajustes', async () => {
    await page.getByRole('button', { name: 'Otimizações', exact: true }).click()
    await expect(page.locator('.tweak')).toHaveCount(14)
    await page.getByRole('button', { name: 'Serviços', exact: true }).click()
    await expect(page.locator('.tweak')).toHaveCount(2)
    await expect(page.getByText('Telemetria do Windows (DiagTrack)')).toBeVisible()
    await attachStepScreenshot(page, '07 - serviço de telemetria')
    await page.getByRole('button', { name: 'Energia', exact: true }).click()
    await expect(page.locator('.tweak')).toHaveCount(3)
    await page.getByRole('button', { name: 'Marcar visíveis' }).click()
    await expect(page.locator('.tweak input[type="checkbox"]:checked')).toHaveCount(3)
    await page.locator('.tweak input[type="checkbox"]').first().uncheck()
    await expect(page.locator('.tweak input[type="checkbox"]:checked')).toHaveCount(2)
    await attachStepScreenshot(page, '08 - filtro e seleção do catálogo')
    await page.getByRole('button', { name: 'Aplicar 2' }).click()
    await expect(page.getByText(/OK .*Aplicado no teste/)).toBeVisible()
    await attachStepScreenshot(page, '09 - resultado de aplicar ajustes')
    await page.getByRole('button', { name: 'Todas', exact: true }).click()
    await expect(page.locator('.tweak')).toHaveCount(14)
    await attachStepScreenshot(page, '10 - catálogo completo')
  })

  await allure.step('Manter os itens Xbox na aba dedicada e aplicar somente a seleção Xbox', async () => {
    await page.getByRole('button', { name: 'Xbox', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Xbox', exact: true })).toBeVisible()
    await expect(page.locator('.tweak')).toHaveCount(5)
    await expect(page.getByText('Game Mode do Windows')).toBeVisible()
    await expect(page.getByText('Xbox Live Networking Service')).toBeVisible()
    await page.getByRole('button', { name: 'Marcar itens Xbox' }).click()
    await page.getByRole('button', { name: 'Aplicar selecionados' }).click()
    await expect(page.getByText(/OK .*Aplicado no teste/)).toBeVisible()
    await attachStepScreenshot(page, '11 - aba Xbox com itens aplicados')
  })

  await allure.step('Reverter um item e depois todos os ajustes', async () => {
    await page.getByRole('button', { name: 'Restaurar', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Desfazer o boost' })).toBeVisible()
    await page.locator('.tweak').first().getByRole('button', { name: 'Reverter' }).click()
    await expect(page.getByText(/REV ultimate-power/)).toBeVisible()
    await attachStepScreenshot(page, '11 - reversão individual')
    await page.getByRole('button', { name: 'Reverter tudo' }).click()
    await expect(page.getByText('REV todos os ajustes')).toBeVisible()
    await attachStepScreenshot(page, '12 - reversão total')
  })

  await allure.step('Validar a tela Sobre e concluir com resultado final', async () => {
    await page.getByRole('button', { name: 'Sobre', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Arquitetura' })).toBeVisible()
    await expect(page.getByText(/Não desliga Windows Defender/)).toBeVisible()
    await attachStepScreenshot(page, '13 - tela Sobre')
    await expect(page.locator('.app')).toBeVisible()
    await attachStepScreenshot(page, '14 - validação final da aplicação')
  })
})
