import { describe, expect, it } from 'vitest'
import { analyze, latinSyllables } from './analyze'

const SAMPLE = `曾卖过吸管 屋外是饥寒
赚的小钱只能给粥加个皮蛋
所以那些人 别来和我比惨
我的人生满是遗憾`

describe('韵脚检查', () => {
  it('把同一个双押标成一组', () => {
    const a = analyze(SAMPLE, { mode: 'strict' })
    const g = a.groups.find((x) => x.words.includes('饥寒'))!
    // “过吸管 / 我比惨”、“是饥寒 / 是遗憾” 连前一个字也押上了，所以最长是三押
    expect(g.n).toBe(3)
    for (const w of ['吸管', '饥寒', '皮蛋', '比惨', '遗憾']) expect(g.words).toContain(w)
    expect(g.times).toBe(5)
    expect(a.groups.length).toBe(1)
    expect(g.loose).toBe(false)
  })
  it('标记落在正确的字上', () => {
    const a = analyze('曾卖过吸管 屋外是饥寒', { mode: 'strict' })
    const marks = a.lines[0].marks
    expect(marks.slice(0, 3)).toEqual([-1, -1, -1])
    expect(marks[3]).toBe(marks[4])
    expect(marks[3]).not.toBe(-1)
    expect(marks[5]).toBe(-1)
  })
  it('宽押模式下 人犯 / 城管 归为一组并标出宽押', () => {
    const t = '你可以是个杀人犯\n可以是城管\n可以走上神坛'
    const strict = analyze(t, { mode: 'strict' }).groups.find((x) => x.n === 2)!
    expect(strict.words).not.toContain('城管')
    const g = analyze(t, { mode: 'loose' }).groups.find((x) => x.n === 2)!
    expect(g.words).toEqual(expect.arrayContaining(['人犯', '城管', '神坛']))
    expect(g.loose).toBe(true)
  })
  it('句尾同韵、字数一样的四行提醒数来宝', () => {
    const t = '我今天很开心\n你明天要小心\n他后天不甘心\n谁昨天没良心'
    expect(analyze(t, { mode: 'strict' }).hints.some((h) => h.kind === 'drill')).toBe(true)
    expect(analyze(SAMPLE, { mode: 'strict' }).hints.some((h) => h.kind === 'drill')).toBe(false)
  })
  it('一行太长时提醒，段落按标题和行数统计', () => {
    const t = '[主歌1]\n我想把所有的话一口气全部都塞进这一个小节里面\n短句\n\n[副歌]\n啦啦啦'
    const a = analyze(t, { mode: 'strict', maxPerLine: 16, barSeconds: 2.67 })
    expect(a.hints.filter((h) => h.kind === 'long').map((h) => h.line)).toEqual([1])
    expect(a.sections.map((s) => [s.name, s.bars])).toEqual([['主歌1', 2], ['副歌', 1]])
  })
  it('句中的内押只认真词', () => {
    const t = '曾卖过吸管\n屋外是饥寒\n一口气全部塞进这里面你说行不行'
    const isWord = (w: string) => w === '里面'
    const marks = analyze(t, { mode: 'strict', isWord }).lines[2].marks
    expect(marks[t.split('\n')[2].indexOf('气')]).toBe(-1)
    expect(marks[t.split('\n')[2].indexOf('里')]).not.toBe(-1)
  })
  it('估算英文音节', () => {
    expect(latinSyllables('Call me GOD')).toBe(3)
    expect(latinSyllables('rapper')).toBe(2)
  })
})

import { rhythmCode } from './beats'
describe('节奏码', () => {
  it('连着的落点算一组', () => {
    expect(rhythmCode([0, 2, 4, 6, 8, 10])).toBe('6')
    expect(rhythmCode([0, 1, 4, 5, 8, 9, 12, 13, 14])).toBe('2-2-2-3')
    expect(rhythmCode([])).toBe('')
  })
})
