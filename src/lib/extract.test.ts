import { describe, expect, it } from 'vitest'
import { buildEnIndex } from './en'
import { extractRhymes, parseFound } from './extract'

const EN = buildEnIndex(
  [
    'bottle\tB AA1 T AH0 L\t0\t瓶子', 'model\tM AA1 D AH0 L\t0\t模型', 'hollow\tHH AA1 L OW0\t0\t空的', 'night\tN AY1 T\t0\t夜', 'light\tL AY1 T\t0\t光', 'the\tDH AH0\t0\t',
    'on\tAA1 N\t0\t', 'a\tAH0\t0\t', 'in\tIH0 N\t0\t', 'stayed\tS T EY1 D\t0\t', 'up\tAH1 P\t0\t', 'all\tAO1 L\t0\t', 'left\tL EH1 F T\t0\t', 'like\tL AY1 K\t0\t', 'message\tM EH1 S AH0 JH\t0\t',
  ].join('\n'),
)

describe('自动找韵脚', () => {
  it('英文：先找押两个元音的，再找句尾单押', () => {
    const f = extractRhymes('left a message in a bottle\nlike a model\nstayed up all night\non the light', { mode: 'strict', en: EN })
    expect(f[0]).toEqual({ items: ['bottle', 'model'], n: 2, lang: 'en' })
    expect(f.some((g) => g.items.join() === 'night,light')).toBe(true)
    expect(f.flatMap((g) => g.items)).not.toContain('the')
  })
  it('中文只收双押以上，圆括号里的不算', () => {
    const f = extractRhymes('今天终于突破（心态）\n难关已经渡过（状态）\n手里只剩一块', { mode: 'strict' })
    expect(f).toEqual([{ items: ['突破', '渡过'], n: 2, lang: 'zh' }])
  })
  it('Claude 的回答只留原文里有的', () => {
    const f = parseFound('1. dropped them / problem / 编的\nnight / light\n只有一个', 'I dropped them\nwas a problem\nnight light')
    expect(f.map((g) => g.items)).toEqual([['dropped them', 'problem'], ['night', 'light']])
  })
})
