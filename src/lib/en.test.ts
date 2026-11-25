import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildEnIndex, enKey, findEn, isEnglish, pronounce, syllables } from './en'

const idx = buildEnIndex(readFileSync('public/data/en-words.txt', 'utf8'))
const find = (q: string, n: number, mode: 'strict' | 'loose', showRare = false) => findEn(idx, q, { n, mode, showRare, blocked: new Set() })
const words = (q: string, n: number, mode: 'strict' | 'loose', showRare = false) => find(q, n, mode, showRare).map((h) => h.word.w)

describe('英文找韵', () => {
  it('分得出是不是英文', () => {
    expect(isEnglish('problem')).toBe(true)
    expect(isEnglish('不错')).toBe(false)
    expect(isEnglish('不错 ok')).toBe(false)
  })
  it('严格单押：元音和后面的辅音都一样', () => {
    const w = words('late', 1, 'strict')
    expect(w).toEqual(expect.arrayContaining(['gate', 'great', 'wait', 'straight']))
    expect(w).not.toContain('late')
    expect(w).not.toContain('made')
  })
  it('宽押：只比元音，严格押的排前面并且不标“宽”', () => {
    const h = find('late', 1, 'loose')
    expect(h.map((x) => x.word.w)).toEqual(expect.arrayContaining(['gate', 'made', 'name']))
    expect(h.find((x) => x.word.w === 'gate')?.looseOnly).toBe(false)
    expect(h.find((x) => x.word.w === 'made')?.looseOnly).toBe(true)
    expect(h.findIndex((x) => x.looseOnly)).toBeGreaterThan(h.findIndex((x) => x.word.w === 'gate'))
  })
  it('双押宽押：两个元音都对上的词能连成一串', () => {
    const w = words('problem', 2, 'loose')
    expect(w).toEqual(expect.arrayContaining(['gotten', 'bottom', 'autumn', 'common']))
    // 带 r 的元音不算同一个音，拆开的半截词不出现
    expect(w).not.toContain('started')
    expect(w).not.toContain('aren')
  })
  it('短语和口语写法也能读', () => {
    expect(pronounce(idx, "put 'em on").unknown).toEqual([])
    expect(syllables(pronounce(idx, 'put em on').ph)).toBe(3)
    expect(pronounce(idx, "droppin'").ph.at(-1)).toBe('N')
    expect(pronounce(idx, 'zzqx word').unknown).toEqual(['zzqx'])
    expect(find('zzqx', 1, 'loose')).toEqual([])
  })
  it('song 和 on 在宽押里算同一个元音，人名默认不出现', () => {
    const song = pronounce(idx, 'song').ph
    const on = pronounce(idx, 'on').ph
    expect(enKey(song, 1, 'loose')).toBe(enKey(on, 1, 'loose'))
    expect(enKey(song, 1, 'strict')).not.toBe(enKey(on, 1, 'strict'))
    expect(words('on', 1, 'strict')).not.toContain('john')
    expect(words('on', 1, 'strict', true)).toContain('john')
  })
})
