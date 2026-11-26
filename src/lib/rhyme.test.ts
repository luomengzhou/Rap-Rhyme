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
    expect(parsePinyin('yuan2')!.strict).toBe('ian')
    expect(parsePinyin('yuan2')!.loose).toBe('an')
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
  it('宽押：前后鼻音算近韵，但 in 和 eng 不混', () => {
    const loose = findRhymes(index, '中心', { n: 2, mode: 'loose' })
    const hit = (w: string) => loose.find((h) => h.word.w === w)
    // 我享受被当做中心 / 我习惯成为眼中钉 / …蓝莓味的尼古丁
    expect(hit('眼中钉')).toMatchObject({ looseOnly: true })
    expect(hit('眼中钉')!.near).toBeFalsy()
    // 古 和 中 只对上元音，丁 和 心 是前后鼻音：算近押，排在最后
    expect(hit('尼古丁')).toMatchObject({ near: true })
    expect(loose.findIndex((h) => h.near)).toBeGreaterThan(loose.findIndex((h) => h.word.w === '眼中钉'))
    // 心 和 风 听起来不是一个韵
    expect(hit('东风')).toBeUndefined()
    expect(words('中心', 2)).not.toContain('眼中钉')
    expect(words('中心', 1, 'loose')).not.toContain('风')
  })
  it('默认不给生僻词，屏蔽的词不再出现', () => {
    expect(findRhymes(index, '不错', { n: 2, mode: 'strict' }).every((h) => h.word.tier < 2)).toBe(true)
    const r = findRhymes(index, '不错', { n: 2, mode: 'strict', blocked: new Set(['渡过']) })
    expect(r.map((h) => h.word.w)).not.toContain('渡过')
  })
})

describe('an / uan 和 ian / üan 分开', () => {
  const find = (mode: 'strict' | 'loose') => findRhymes(index, '残喘', { n: 2, mode }).map((h) => h.word.w)
  it('严格：残喘押干旱、叛乱，不押完全、安全、看见', () => {
    const w = find('strict')
    expect(w).toEqual(expect.arrayContaining(['干旱', '叛乱']))
    for (const x of ['完全', '安全', '看见']) expect(w).not.toContain(x)
  })
  it('含宽押时它们还在，并且标成宽押', () => {
    const hits = findRhymes(index, '残喘', { n: 2, mode: 'loose' })
    expect(hits.find((h) => h.word.w === '安全')?.looseOnly).toBe(true)
    expect(hits.find((h) => h.word.w === '干旱')?.looseOnly).toBe(false)
  })
})
