import { describe, expect, it } from 'vitest'
import { barsOf, clock, describeBreakdown, DRUMS, FLOWS, newPart, parseClock, tapBpm, toTemplate, type Breakdown } from './breakdown'

const b: Breakdown = {
  id: 'b', song: '示例歌', artist: '示例歌手', bpm: 120,
  parts: [
    { ...newPart(32, 2), drum: 'trap', feel: 'half', flow: 'punch', trans: 'dropout', note: '低音很沉' },
    { ...newPart(0, 1), name: '开头', drum: 'boombap', flow: 'steady' },
    { ...newPart(48, 3), drum: 'other' },
  ],
}

describe('拆歌', () => {
  it('时间来回转', () => {
    expect(clock(65)).toBe('1:05')
    expect(parseClock('1:05')).toBe(65)
    expect(parseClock('1：05')).toBe(65)
    expect(parseClock('42')).toBe(42)
    expect(parseClock('abc')).toBeNull()
  })
  it('跟着点拍子估速度', () => {
    expect(tapBpm([0, 0.5, 1, 1.5, 2.02, 2.5])).toBe(120)
    expect(tapBpm([0, 0.5])).toBe(0)
  })
  it('按时间排好，估每段几小节', () => {
    // 120 BPM 一小节 2 秒：0-32 秒是 16 小节，32-48 秒是 8 小节
    expect(barsOf(b, 0)).toBe(16)
    expect(barsOf(b, 1)).toBe(8)
    expect(barsOf(b, 2)).toBe(0)
  })
  it('写成文字', () => {
    const t = describeBreakdown(b)
    expect(t).toContain('示例歌手 《示例歌》，我跟着拍子点出来大约 120 BPM')
    expect(t).toContain('1. 0:00-0:32（约 16 小节） 开头：鼓：boom bap')
    expect(t).toContain('2. 0:32-0:48（约 8 小节） 第 2 段：鼓：trap（慢一半 + 密镲）；速度感：听起来慢了一半；flow：一个字，停，再接一长串；怎么进来的：先把鼓抽掉；我听到的：低音很沉')
    expect(t).toContain('3. 0:48 起 第 3 段：还没填')
  })
  it('变成结构模板', () => {
    expect(toTemplate(b)).toEqual([{ name: '开头', bars: 16 }, { name: '第 2 段', bars: 8 }, { name: '第 3 段', bars: 8 }])
  })
  it('示例都在两小节以内', () => {
    for (const d of DRUMS) for (const s of d.steps) expect(s.step).toBeLessThan(32)
    for (const f of FLOWS) for (const g of f.grid) expect(g).toBeLessThan(32)
  })
})
