import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { RestorePoint } from './types'

export class RestorePointEntry implements RestorePoint {
  readonly id: string
  readonly name: string
  readonly createdAt: string
  readonly description: string
  readonly appliedIds: string[]
  readonly tweakCount: number

  constructor(name: string, description: string, appliedIds: string[] = [], id?: string, createdAt?: string) {
    this.id = id ?? `pt-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    this.name = name
    this.description = description
    this.createdAt = createdAt ?? new Date().toISOString()
    this.appliedIds = [...appliedIds]
    this.tweakCount = this.appliedIds.length
  }

  static fromJSON(data: Partial<RestorePoint> & { id?: string }): RestorePointEntry {
    return new RestorePointEntry(
      data.name ?? 'Ponto de restauração',
      data.description ?? '',
      Array.isArray(data.appliedIds) ? data.appliedIds : [],
      data.id,
      data.createdAt
    )
  }

  toJSON(): RestorePoint {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      createdAt: this.createdAt,
      appliedIds: [...this.appliedIds],
      tweakCount: this.tweakCount
    }
  }
}

export class RestorePointStore {
  constructor(private readonly filePath: string) {}

  async list(): Promise<RestorePoint[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as RestorePoint[]
      return Array.isArray(parsed) ? parsed.map((item) => RestorePointEntry.fromJSON(item).toJSON()) : []
    } catch {
      return []
    }
  }

  async save(points: RestorePoint[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(points, null, 2), 'utf8')
  }

  async create(name: string, description: string, appliedIds: string[] = []): Promise<RestorePoint> {
    const points = await this.list()
    const next = new RestorePointEntry(name, description, appliedIds)
    const updated = [next.toJSON(), ...points]
    await this.save(updated)
    return next.toJSON()
  }

  async remove(id: string): Promise<void> {
    const points = (await this.list()).filter((point) => point.id !== id)
    await this.save(points)
  }
}

export class RestorePointService {
  constructor(private readonly store: RestorePointStore) {}

  async createSnapshot(description: string | undefined, appliedIds: string[]): Promise<RestorePoint> {
    const safeDescription = (description ?? '').trim() || 'Ponto de restauração'
    const stamp = new Date().toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    })
    return this.store.create(`Ponto ${stamp}`, safeDescription, appliedIds)
  }

  async listSnapshots(): Promise<RestorePoint[]> {
    return this.store.list()
  }

  async restoreSnapshot(id: string): Promise<RestorePoint | undefined> {
    const points = await this.store.list()
    return points.find((point) => point.id === id)
  }
}
