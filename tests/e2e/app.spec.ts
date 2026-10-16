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
        { id: 'mouse-accel', applied: true, current: '0' }
      ],
      apply: async (ids: string[]) => ({
        results: ids.map((id) => ({ id, ok: true, message: 'Aplicado no teste' })),
        log: ids.map((id) => `OK ${id} — Aplicado no teste`)
      }),
      revert: async (ids?: string[]) => ({
        results: (ids ?? ['ultimate-power']).map((id) => ({
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
      }),
      runNetworkCommand: async (command: string) => `Comando concluído: ${command}`
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

  await allure.step('Validar hardware, score e navegação por todos os perfis', async () => {
    await page.getByRole('button', { name: 'Painel', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Seu rig, no modo partida.' })).toBeVisible()
    await expect(page.getByText('Intel Core i7')).toBeVisible()
    await expect(page.getByText('NVIDIA RTX 4080')).toBeVisible()
    await expect(page.getByText('16 GB livres de 32 GB')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Atualizar scan' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Ir para Ranked' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Restaurar', exact: true })).toHaveCount(0)
    await expect(page.getByText('2/12 otimizações ativas')).toBeVisible()
    await attachStepScreenshot(page, '05 - painel, hardware e score')

    for (let index = 0; index < 4; index += 1) {
      const profile = page.locator('button.profile').nth(index)
      await profile.click()
      await expect(page.getByRole('heading', { name: 'Catálogo de tweaks' })).toBeVisible()
      await expect(page.getByText(/Perfil:/)).toBeVisible()
      if (index === 3) {
        await expect(page.locator('.tweak:not(.network-profile-option) input:checked')).toHaveCount(12)
        await expect(page.locator('.network-profile-option input:checked')).toHaveCount(3)
        await expect(page.getByRole('button', { name: 'Aplicar 12' })).toBeVisible()
      }
      await attachStepScreenshot(page, `06 - perfil ${index + 1}`)
      if (index < 3) await page.getByRole('button', { name: 'Painel', exact: true }).click()
    }
    await page.getByRole('button', { name: 'Painel', exact: true }).click()
    await page.locator('button.profile').nth(1).click()
  })

  await allure.step('Filtrar catálogo, selecionar os visíveis e aplicar ajustes', async () => {
    await page.getByRole('button', { name: 'Otimizações', exact: true }).click()
    await expect(page.locator('.tweak:not(.network-profile-option)')).toHaveCount(12)
    await page.getByRole('button', { name: 'Serviços', exact: true }).click()
    await expect(page.locator('.tweak:not(.network-profile-option)')).toHaveCount(2)
    await expect(page.getByText('Telemetria do Windows (DiagTrack)')).toBeVisible()
    await attachStepScreenshot(page, '07 - serviço de telemetria')
    await page.getByRole('button', { name: 'Marcar visíveis' }).click()
    await page.getByRole('button', { name: 'Energia', exact: true }).click()
    await expect(page.locator('.tweak:not(.network-profile-option)')).toHaveCount(3)
    await page.getByRole('button', { name: 'Marcar visíveis' }).click()
    await expect(page.locator('.tweak:not(.network-profile-option) input[type="checkbox"]:checked')).toHaveCount(3)
    await page.getByRole('button', { name: 'Serviços', exact: true }).click()
    await expect(page.locator('.tweak:not(.network-profile-option) input[type="checkbox"]:checked')).toHaveCount(2)
    await page.getByRole('button', { name: 'Energia', exact: true }).click()
    await page.locator('.tweak:not(.network-profile-option) input[type="checkbox"]').first().uncheck()
    await expect(page.locator('.tweak:not(.network-profile-option) input[type="checkbox"]:checked')).toHaveCount(2)
    await attachStepScreenshot(page, '08 - filtro e seleção do catálogo')
    await page.getByRole('button', { name: /^Aplicar \d+$/ }).click()
    await expect(page.getByText(/OK .*Aplicado no teste/)).toBeVisible()
    await attachStepScreenshot(page, '09 - resultado de aplicar ajustes')
    await page.getByRole('button', { name: 'Todas', exact: true }).click()
    await expect(page.locator('.tweak:not(.network-profile-option)')).toHaveCount(12)
    await attachStepScreenshot(page, '10 - catálogo completo')
  })

  await allure.step('Manter o Xbox removido e disponibilizar a aba Rede', async () => {
    await expect(page.getByRole('button', { name: 'Xbox', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Rede', exact: true })).toHaveCount(1)
    await expect(page.getByText('Game Mode do Windows')).toHaveCount(0)
    await expect(page.getByText('TcpNoDelay (desligar Nagle)')).toHaveCount(0)
    await attachStepScreenshot(page, '11 - aba Rede disponível sem itens Xbox no catálogo')
  })

  await allure.step('Executar os comandos da aba Rede somente após ação explícita', async () => {
    await page.getByRole('button', { name: 'Rede', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Rede', exact: true })).toBeVisible()
    await expect(page.getByText('ipconfig /renew')).toBeVisible()
    await expect(page.getByText('ipconfig /flushdns')).toBeVisible()
    await expect(page.getByText('netsh winsock reset')).toBeVisible()

    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: 'Renovar IP' }).click()
    await expect(page.getByRole('status')).toContainText('renew-ip')
    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: 'Limpar cache DNS' }).click()
    await expect(page.getByRole('status')).toContainText('flush-dns')
    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: 'Redefinir Winsock' }).click()
    await expect(page.getByRole('status')).toContainText('reset-winsock')
    await attachStepScreenshot(page, '12 - comandos de rede')
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
