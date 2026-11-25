import { describe as d, expect, it } from 'vitest'
import { describe, detectHits, estimateBpm, PATTERNS, quantize, rank, type Step } from './hum'

const SR = 16000
/** 合成一段“录音”：在给定时间放一下低音（咚）或一下噪声（哒） */
function synth(events: { t: number; kind: 'low' | 'mid'; amp?: number }[], dur: number) {
  const x = new Float32Array(Math.round(dur * SR))
  let seed = 1
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  for (let i = 0; i < x.length; i++) x[i] = rnd() * 0.002
  for (const e of events) {
    const o = Math.round(e.t * SR)
    const len = Math.round(0.09 * SR)
    for (let k = 0; k < len && o + k < x.length; k++) {
      const env = Math.exp(-k / (0.025 * SR)) * (e.amp ?? 0.6)
      x[o + k] += env * (e.kind === 'low' ? Math.sin((2 * Math.PI * 110 * k) / SR) : rnd())
    }
  }
  return x
}

d('哼唱分析', () => {
  // 100 BPM，一格 0.15 秒：咚 . . . 哒 . . . 咚 . 咚 . 哒 . . .，两小节
  const unit = 15 / 100
  const bar = [
    { s: 0, kind: 'low' as const }, { s: 4, kind: 'mid' as const }, { s: 8, kind: 'low' as const }, { s: 10, kind: 'low' as const }, { s: 12, kind: 'mid' as const },
  ]
  const events = [0, 1].flatMap((b) => bar.map((e) => ({ t: 0.3 + (b * 16 + e.s) * unit, kind: e.kind, amp: e.s === 0 ? 0.9 : 0.5 })))
  const hits = detectHits(synth(events, 6), SR)

  it('切出每一下，时间误差在 30 毫秒内', () => {
    expect(hits).toHaveLength(events.length)
    hits.forEach((h, i) => expect(Math.abs(h.time - events[i].t)).toBeLessThan(0.03))
  })
  it('分得出咚和哒，认得出重音', () => {
    expect(hits.map((h) => h.kind)).toEqual(events.map((e) => e.kind))
    expect(hits[0].accent).toBe(true)
    expect(hits[1].accent).toBe(false)
  })
  it('估出速度（或它的倍数），落到格子上', () => {
    const bpm = estimateBpm(hits.map((h) => h.time))
    expect([50, 100, 200].some((b) => Math.abs(bpm - b) <= 2)).toBe(true)
    const steps = quantize(hits, 100)
    expect(steps.map((s) => s.step)).toEqual([0, 4, 8, 10, 12, 16, 20, 24, 26, 28])
  })
  it('最像的骨架是 boom bap', () => {
    const steps = quantize(hits, 100)
    const top = rank(steps, PATTERNS)[0]
    expect(top.pattern.id).toMatch(/boombap|double-kick/)
    expect(top.score).toBeGreaterThan(0.7)
    const four: Step[] = [0, 4, 8, 12].map((step) => ({ step, kind: 'low', accent: false }))
    expect(rank(four, PATTERNS)[0].pattern.id).toBe('four')
  })
  it('能写成文字', () => {
    expect(describe(quantize(hits, 100), 100)).toContain('第1小节 D... t... d.d. t...')
  })
  it('没声音的录音不报错', () => {
    expect(detectHits(new Float32Array(SR), SR)).toEqual([])
  })
})
