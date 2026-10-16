import { describe, expect, it } from 'vitest'
import { CATEGORIES, PROFILES, TWEAKS } from './catalog'

describe('tweak catalog and profiles', () => {
  it('contains unique tweak ids and valid categories', () => {
    const ids = TWEAKS.map((tweak) => tweak.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(TWEAKS.length).toBeGreaterThan(0)
    expect(TWEAKS.every((tweak) => CATEGORIES.some((category) => category.id === tweak.category))).toBe(true)
  })

  it('references only available tweaks from every profile', () => {
    const tweakIds = new Set(TWEAKS.map((tweak) => tweak.id))

    for (const profile of PROFILES) {
      expect(profile.tweakIds.length, profile.title).toBeGreaterThan(0)
      expect(profile.tweakIds.every((id) => tweakIds.has(id)), profile.title).toBe(true)
    }
  })

  it('marks administrative and reboot requirements consistently as booleans', () => {
    expect(TWEAKS.every((tweak) => typeof tweak.requiresAdmin === 'boolean')).toBe(true)
    expect(TWEAKS.filter((tweak) => tweak.rebootHint).every((tweak) => tweak.requiresAdmin)).toBe(true)
  })

  it('excludes network and Xbox tweaks while keeping telemetry in services', () => {
    const removedIds = [
      'network-throttle',
      'nagle',
      'game-mode',
      'game-dvr',
      'xbox-auth',
      'xbox-game-save',
      'xbox-network'
    ]

    expect(removedIds.every((id) => !TWEAKS.some((tweak) => tweak.id === id))).toBe(true)
    expect(CATEGORIES.map((category) => category.id)).not.toContain('rede')
    expect(CATEGORIES.map((category) => category.id)).not.toContain('xbox')
    expect(TWEAKS.find((tweak) => tweak.id === 'telemetry')?.category).toBe('servicos')
  })
})
