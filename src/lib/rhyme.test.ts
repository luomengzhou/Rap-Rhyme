import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildIndex, findRhymes, parsePinyin, tailKey, toSyls } from './rhyme'

const index = buildIndex(readFileSync('public/data/zh-words.txt', 'utf8'))
const words = (q: string, n: number, mode: 'strict' | 'loose' = 'strict') =>
  findRhymes(index, q, { n, mode }).map((h) => h.word.w)

describe('拼音拆韵', () => {
  it('介音不影响韵类', () => {
    const k = (w: string) => tailKey(toSyls(w), 2, 'strict')
    for (const w of ['吸管', '饥寒', '遗憾', '极端', '比惨', '避难']) expect(k(w)).toBe(k('一万'))
  })
  it('uo、e、ie 是三个不同的韵', () => {
    const c = (p: string) => parsePinyin(p)!.strict
    expect(c('cuo4')).toBe('o')
    expect(c('ke3')).toBe('e')
    expect(c('ye4')).toBe('ie')
    expect(c('xue2')).toBe('ie')
    expect(c('bo1')).toBe('o')
  })
  it('zhi/chi/shi 的 i 和 yi 的 i 分开', () => {
    expect(parsePinyin('shi4')!.strict).not.toBe(parsePinyin('yi1')!.strict)
  })
  it('j/q/x/y 后面的 u 是 ü', () => {
    expect(parsePinyin('ju4')!.strict).toBe('v')
    expect(parsePinyin('yuan2')!.strict).toBe('an')
    expect(parsePinyin('lu4')!.strict).toBe('u')
  })
})

describe('找韵', () => {
  it('“不错”的双押是真押、真词', () => {
    const r = words('不错', 2)
    expect(r).toContain('渡过')
    expect(r).toContain('突破')
    expect(r).toContain('触摸')
    // 韵律 App 里出现的不押结果
    for (const bad of ['不可', '苦涩', '暮色', '午夜', '树叶']) expect(r).not.toContain(bad)
    // 好押 App 里出现的非词
    for (const bad of ['写么', '屠佐', '杵作']) expect(r).not.toContain(bad)
  })
  it('宽押才把 e 和 o 合并，并且标出来', () => {
    const hits = findRhymes(index, '不错', { n: 2, mode: 'loose' })
    const ke = hits.find((h) => h.word.w === '不可')
    expect(ke?.looseOnly).toBe(true)
    expect(hits.find((h) => h.word.w === '渡过')?.looseOnly).toBe(false)
  })
  it('人犯 / 城管 / 神坛 只有宽押才算', () => {
    expect(tailKey(toSyls('人犯'), 2, 'strict')).not.toBe(tailKey(toSyls('城管'), 2, 'strict'))
    expect(tailKey(toSyls('人犯'), 2, 'loose')).toBe(tailKey(toSyls('城管'), 2, 'loose'))
    expect(tailKey(toSyls('神坛'), 2, 'loose')).toBe(tailKey(toSyls('城管'), 2, 'loose'))
  })
  it('三押和四押能找到词', () => {
    expect(words('不知道', 3)).toContain('出师表')
    expect(words('时代广场', 4, 'loose')).toContain('熙来攘往')
  })
  it('默认不给生僻词，屏蔽的词不再出现', () => {
    expect(findRhymes(index, '不错', { n: 2, mode: 'strict' }).every((h) => h.word.tier < 2)).toBe(true)
    const r = findRhymes(index, '不错', { n: 2, mode: 'strict', blocked: new Set(['渡过']) })
    expect(r.map((h) => h.word.w)).not.toContain('渡过')
  })
})
