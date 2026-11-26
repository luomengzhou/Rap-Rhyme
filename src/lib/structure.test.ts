import { describe, expect, it } from 'vitest'
import { irregular, judge, kindOf, shape, similarPrompt } from './structure'

const sec = (name: string, bars: number, start = 0) => ({ name, start, bars })

describe('结构提示', () => {
  it('从标题认段落', () => {
    expect(['Intro', '主歌1', 'verse 2', 'hook', '副歌', 'Pre-Chorus', 'Bridge', 'outro', '随便'].map(kindOf)).toEqual(['intro', 'verse', 'verse', 'hook', 'hook', 'pre', 'bridge', 'outro', 'other'])
  })
  it('和规整的写法比长短', () => {
    const j = judge([sec('intro', 2), sec('主歌1', 6), sec('副歌', 8), sec('主歌2', 17), sec('空的', 0)])
    expect(j.map((x) => x.size)).toEqual(['ok', 'short', 'ok', 'long'])
    expect(j[1].note).toContain('偏短')
    expect(shape(j)).toBe('前奏 2 · 主歌 6 · 副歌 8 · 主歌 17')
    expect(irregular(j)).toContain('几段主歌长短不一样（6、17 小节）')
    expect(similarPrompt(j)).toContain('前奏 2')
  })
  it('没有副歌会说出来', () => {
    expect(irregular(judge([sec('主歌1', 16), sec('主歌2', 16)]))).toEqual(['没有副歌，从头念到尾'])
  })
})
