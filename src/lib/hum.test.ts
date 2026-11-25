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

d('哼唱分析：更像人声的情况', () => {
  // 连着哼不断气：一条 0.2 秒一换的音，音量几乎不变，只是每次换音有个很短的凹口和音高变化
  const legato = () => {
    const x = new Float32Array(SR * 3)
    const notes = [196, 220, 196, 262, 220, 196, 247, 196]
    let ph = 0
    for (let i = 0; i < x.length; i++) {
      const t = i / SR - 0.3
      if (t < 0 || t >= notes.length * 0.2) continue
      const k = Math.floor(t / 0.2)
      const into = t - k * 0.2
      // 结尾 40 毫秒淡出，人声不会戛然而止
      const out = Math.min(1, (notes.length * 0.2 - t) / 0.04)
      const env = 0.5 * out * (1 - 0.35 * Math.exp(-into / 0.012))
      ph += (2 * Math.PI * notes[k]) / SR
      x[i] = env * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.3 * Math.sin(3 * ph) + 0.2 * Math.sin(5 * ph))
    }
    return x
  }
  it('中间不断气的“哒哒哒”也能切开', () => {
    const hits = detectHits(legato(), SR)
    expect(hits).toHaveLength(8)
    hits.forEach((h, i) => expect(Math.abs(h.time - (0.3 + i * 0.2))).toBeLessThan(0.04))
  })
  it('咚 哒 叮 三种都分得出', () => {
    const x = new Float32Array(SR * 3)
    const kinds = ['low', 'mid', 'high', 'low', 'mid', 'high'] as const
    const f = { low: 100, mid: 700, high: 3200 }
    kinds.forEach((kind, j) => {
      const o = Math.round((0.3 + j * 0.3) * SR)
      for (let k = 0; k < 0.1 * SR; k++) x[o + k] += 0.5 * Math.exp(-k / (0.03 * SR)) * Math.sin((2 * Math.PI * f[kind] * k) / SR)
    })
    expect(detectHits(x, SR).map((h) => h.kind)).toEqual([...kinds])
  })
})

d('Strudel 写法', () => {
  const steps: Step[] = [
    { step: 0, kind: 'low', accent: true }, { step: 4, kind: 'mid', accent: false }, { step: 10, kind: 'low', accent: false }, { step: 12, kind: 'mid', accent: false },
    { step: 16, kind: 'low', accent: true }, { step: 31, kind: 'high', accent: false },
  ]
  it('每小节 16 格，带速度、重音和鼓机', async () => {
    const { toStrudel, strudelLink } = await import('./hum')
    const code = toStrudel(steps, 92, 'RolandTR808')
    expect(code).toContain('setcpm(92/4)')
    expect(code).toContain('[bd ~ ~ ~  sd ~ ~ ~  ~ ~ bd ~  sd ~ ~ ~]')
    expect(code).toContain('[bd ~ ~ ~  ~ ~ ~ ~  ~ ~ ~ ~  ~ ~ ~ hh]')
    expect(code).toContain('[1.3 .9 .9 .9  ')
    expect(code).toContain('.bank("RolandTR808")')
    const one = toStrudel(steps.slice(0, 4).map((s) => ({ ...s, accent: false })), 92)
    expect(one).toContain('s(`bd ~ ~ ~  sd ~ ~ ~  ~ ~ bd ~  sd ~ ~ ~`)')
    expect(one).not.toContain('.gain')
    const hash = strudelLink(code).split('#')[1]
    expect(new TextDecoder().decode(Uint8Array.from(atob(decodeURIComponent(hash)), (c) => c.charCodeAt(0)))).toBe(code)
  })
})
