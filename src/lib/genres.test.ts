import { describe, expect, it } from 'vitest'
import { FAMILIES, GENRES, genreOf } from './genres'

describe('曲风表', () => {
  it('每个曲风的鼓点都是两小节 32 格，只用 x 和 .', () => {
    for (const g of GENRES) for (const p of [g.beat.kick, g.beat.snare, g.beat.hat]) expect(p, g.id).toMatch(/^[x.]{32}$/)
  })
  it('id 不重复，分组都在表里，速度在可调范围内', () => {
    expect(new Set(GENRES.map((g) => g.id)).size).toBe(GENRES.length)
    for (const g of GENRES) {
      expect(FAMILIES, g.id).toContain(g.family)
      expect(g.bpm).toBeGreaterThanOrEqual(60)
      expect(g.bpm).toBeLessThanOrEqual(180)
      expect(g.plain.length).toBeGreaterThan(10)
    }
  })
  it('低音跟着底鼓；无鼓的没有低音', () => {
    const trap = genreOf('trap')!
    expect(Object.keys(trap.beat.bass).map(Number)).toEqual([...trap.beat.kick].map((c, i) => (c === 'x' ? i : -1)).filter((i) => i >= 0))
    expect(genreOf('drumless')!.beat.bass).toEqual({})
  })
  it('trap 的军鼓只在第 3 拍，boom bap 在 2、4 拍', () => {
    expect(genreOf('trap')!.beat.snare.slice(0, 16)).toBe('........x.......')
    expect(genreOf('boom-bap')!.beat.snare.slice(0, 16)).toBe('....x.......x...')
  })
})
