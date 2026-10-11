import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RestorePointEntry, RestorePointService, RestorePointStore } from './restore'

describe('RestorePointEntry', () => {
  it('serializa e mantém o estado do ponto de restauração', () => {
    const entry = new RestorePointEntry('Ponto principal', 'Antes do teste', ['game-mode', 'visual-fx'])

    expect(entry.tweakCount).toBe(2)
    expect(entry.toJSON().appliedIds).toEqual(['game-mode', 'visual-fx'])
    expect(entry.name).toBe('Ponto principal')
  })
})

describe('RestorePointStore', () => {
  it('cria e lista pontos persistidos em disco', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'picote-restore-'))
    const filePath = join(dir, 'restore.json')
    const store = new RestorePointStore(filePath)

    await store.create('Ponto 1', 'Antes da otimização', ['game-mode'])
    const points = await store.list()

    expect(points).toHaveLength(1)
    expect(points[0].description).toBe('Antes da otimização')
    expect(await readFile(filePath, 'utf8')).toContain('game-mode')

    await rm(dir, { recursive: true, force: true })
  })
})

describe('RestorePointService', () => {
  it('cria um snapshot com descrição e lista de ajustes ativos', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'picote-service-'))
    const filePath = join(dir, 'restore.json')
    const service = new RestorePointService(new RestorePointStore(filePath))

    const point = await service.createSnapshot('Antes da sessão', ['ultimate-power', 'mouse-accel'])

    expect(point.appliedIds).toEqual(['ultimate-power', 'mouse-accel'])
    expect(point.description).toBe('Antes da sessão')
    expect((await service.listSnapshots())[0].id).toBe(point.id)

    await rm(dir, { recursive: true, force: true })
  })
})
