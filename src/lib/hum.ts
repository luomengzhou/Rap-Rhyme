// 哼唱分析：从一段“哒哒哒 咚咚 叮”的录音里切出每一下，估出速度，落到 16 分音符的格子上。
// 只用音量和明亮度这类粗特征，目标是抓节奏型，不是识别音高。

export type Kind = 'low' | 'mid' | 'high'
export const KIND_NAME: Record<Kind, string> = { low: '咚', mid: '哒', high: '叮' }

export interface Hit {
  /** 起点，秒 */
  time: number
  /** 这一下的音量，0-1（相对整段最响处） */
  strength: number
  /** 明亮度：估出来的主要频率，Hz */
  bright: number
  kind: Kind
  accent: boolean
}

export interface Step {
  /** 第几个 16 分音符，从 0 开始 */
  step: number
  kind: Kind
  accent: boolean
}

const median = (a: number[]) => {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  return s[s.length >> 1]
}

/** 切出每一下 */
export function detectHits(x: Float32Array, sr: number): Hit[] {
  const hop = Math.max(1, Math.round(sr * 0.01))
  const win = hop * 2
  const n = Math.max(0, Math.floor((x.length - win) / hop))
  const rms = new Float32Array(n)
  const zcr = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let e = 0
    let z = 0
    const o = i * hop
    for (let k = 0; k < win; k++) {
      const v = x[o + k]
      e += v * v
      // 相邻采样差的能量：声音越亮（频率越高）这个值相对越大，比数过零点稳
      if (k) z += (v - x[o + k - 1]) ** 2
    }
    rms[i] = Math.sqrt(e / win)
    zcr[i] = z
  }
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, rms[i])
  if (peak < 1e-4) return []

  // 音量突然变大的地方就是一下的起点
  const rise = new Float32Array(n)
  for (let i = 2; i < n; i++) rise[i] = Math.max(0, rms[i] - Math.min(rms[i - 1], rms[i - 2])) / peak
  const raw: { i: number; rise: number }[] = []
  for (let i = 3; i < n - 1; i++) {
    let local = 0
    let c = 0
    for (let k = Math.max(0, i - 15); k < Math.min(n, i + 15); k++) {
      local += rise[k]
      c++
    }
    const thr = Math.max(0.06, (local / c) * 2)
    if (rise[i] < thr) continue
    if (rise[i] < rise[i - 1] || rise[i] < rise[i + 1]) continue
    raw.push({ i, rise: rise[i] })
  }
  // 80 毫秒内只算一下，留更明显的那个
  const picked: typeof raw = []
  for (const p of raw) {
    const last = picked[picked.length - 1]
    if (last && p.i - last.i < 8) {
      if (p.rise > last.rise) picked[picked.length - 1] = p
    } else picked.push(p)
  }

  const hits: Hit[] = picked.map(({ i }) => {
    let s = 0
    for (let k = i; k < Math.min(n, i + 6); k++) s = Math.max(s, rms[k])
    let b = 0
    let c = 0
    // 明亮度：这一下的“平均频率”，按能量算，不容易被底噪带偏
    for (let k = i; k < Math.min(n, i + 7); k++) {
      b += zcr[k]
      c += rms[k] * rms[k] * win
    }
    return { time: Math.max(0, (i - 1) * hop) / sr, strength: s / peak, bright: (sr / (2 * Math.PI)) * Math.acos(Math.max(-1, 1 - b / Math.max(c, 1e-12) / 2)), kind: 'mid' as Kind, accent: false }
  }).filter((h) => h.strength > 0.08)

  // 咚 / 哒 / 叮：只和这段录音里的其他几下比。明暗差不多就都算“哒”；
  // 分成两堆时闷的是“咚”、亮的是“哒”；中间还有一堆时最亮的才算“叮”
  const logs = hits.map((h) => Math.log(Math.max(h.bright, 20)))
  const lo = Math.min(...logs)
  const hi = Math.max(...logs)
  const loud = median(hits.map((h) => h.strength))
  const spread = hi - lo > Math.log(2.5)
  const pos = logs.map((l) => (spread ? (l - lo) / (hi - lo) : 0.5))
  const three = pos.some((p) => p > 0.33 && p < 0.67)
  hits.forEach((h, i) => {
    const p = pos[i]
    h.kind = !spread ? 'mid' : three ? (p <= 0.33 ? 'low' : p >= 0.67 ? 'high' : 'mid') : p < 0.5 ? 'low' : 'mid'
    h.accent = h.strength > loud * 1.3
  })
  return hits
}

/** 每个落点离最近的 16 分格子有多远（0-0.5 格），越小越整齐 */
export function gridError(times: number[], bpm: number): number {
  if (times.length < 2) return 0
  const unit = 15 / bpm
  const t0 = times[0]
  let e = 0
  for (const t of times) {
    const u = (t - t0) / unit
    e += Math.abs(u - Math.round(u))
  }
  return e / times.length
}

/** 估速度：找一个让落点最贴 16 分格子的 BPM；倍速和半速分不清时取靠近 95 的 */
export function estimateBpm(times: number[]): number {
  if (times.length < 3) return 90
  let best = Infinity
  const errs: [number, number][] = []
  for (let bpm = 60; bpm <= 180; bpm++) {
    const e = gridError(times, bpm)
    errs.push([bpm, e])
    best = Math.min(best, e)
  }
  const ok = errs.filter(([, e]) => e <= best + 0.02)
  ok.sort((a, b) => Math.abs(a[0] - 95) - Math.abs(b[0] - 95))
  return ok[0][0]
}

/** 落到格子上，最多 bars 小节；同一格只留最响的一下 */
export function quantize(hits: Hit[], bpm: number, bars = 4): Step[] {
  if (!hits.length) return []
  const unit = 15 / bpm
  const t0 = hits[0].time
  const by = new Map<number, Hit>()
  for (const h of hits) {
    const step = Math.round((h.time - t0) / unit)
    if (step < 0 || step >= bars * 16) continue
    const cur = by.get(step)
    if (!cur || h.strength > cur.strength) by.set(step, h)
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([step, h]) => ({ step, kind: h.kind, accent: h.accent }))
}

export interface Pattern {
  id: string
  name: string
  note: string
  /** 一小节 16 格，x 为触发 */
  kick: string
  snare: string
}

/** 几种常见的鼓点骨架，用来对照。都是通用型，不取自任何具体的歌 */
export const PATTERNS: Pattern[] = [
  { id: 'boombap', name: 'boom bap 基本型', note: '底鼓在 1 和 3 的后半，军鼓在 2、4，最经典的说唱骨架', kick: 'x.........x.....', snare: '....x.......x...' },
  { id: 'boombap-sync', name: 'boom bap 切分', note: '底鼓多了一个提前的切分，听感更跳', kick: 'x..x......x.....', snare: '....x.......x...' },
  { id: 'double-kick', name: '双踩推进', note: '底鼓两下连着，往前推的感觉', kick: 'x.x.....x.x.....', snare: '....x.......x...' },
  { id: 'four', name: '四踩', note: '每拍一个底鼓，舞曲、house 的骨架', kick: 'x...x...x...x...', snare: '....x.......x...' },
  { id: 'half', name: 'half-time（trap 常用）', note: '军鼓只落在第 3 拍，听起来慢一半、很沉', kick: 'x......x..x.....', snare: '........x.......' },
  { id: 'dembow', name: 'dembow（雷鬼顿）', note: '底鼓每拍一下，军鼓切在拍子之间，摇摆感', kick: 'x...x...x...x...', snare: '...x..x....x..x.' },
  { id: 'roll', name: '句尾连打', note: '前面留空，小节最后一拍连着打四下', kick: 'x.......x.......', snare: '....x.......xxxx' },
  { id: 'offbeat', name: '反拍', note: '重音都在拍子后半，雷鬼、ska 的感觉', kick: 'x.......x.......', snare: '..x...x...x...x.' },
]

const at = (s: string) => [...s].map((c, i) => (c === 'x' ? i : -1)).filter((i) => i >= 0)

/** 一小节里的落点和一个骨架有多像，0-1。差一格算半对；咚对底鼓、哒对军鼓会加分 */
export function similarity(bar: Step[], p: Pick<Pattern, 'kick' | 'snare'>): number {
  const kicks = at(p.kick)
  const snares = at(p.snare)
  const all = [...new Set([...kicks, ...snares])]
  if (!bar.length || !all.length) return 0
  const near = (list: number[], s: number) => (list.includes(s) ? 1 : list.includes(s - 1) || list.includes(s + 1) ? 0.5 : 0)
  let hitScore = 0
  for (const b of bar) {
    const base = near(all, b.step)
    const typed = b.kind === 'low' ? near(kicks, b.step) : b.kind === 'mid' ? near(snares, b.step) : 0
    hitScore += base * 0.8 + typed * 0.2
  }
  const mine = bar.map((b) => b.step)
  let covered = 0
  for (const s of all) covered += near(mine, s)
  const precision = hitScore / bar.length
  const recall = covered / all.length
  return precision + recall ? (2 * precision * recall) / (precision + recall) : 0
}

/** 把落点按小节分开，每小节内的 step 归到 0-15 */
export function toBars(steps: Step[]): Step[][] {
  const bars: Step[][] = []
  for (const s of steps) {
    const b = Math.floor(s.step / 16)
    while (bars.length <= b) bars.push([])
    bars[b].push({ ...s, step: s.step % 16 })
  }
  return bars
}

/** 和每个骨架比，取各小节的平均，从像到不像排 */
export function rank<T extends Pick<Pattern, 'kick' | 'snare'>>(steps: Step[], patterns: T[]): { pattern: T; score: number }[] {
  const bars = toBars(steps).filter((b) => b.length)
  return patterns
    .map((pattern) => ({ pattern, score: bars.length ? bars.reduce((a, b) => a + similarity(b, pattern), 0) / bars.length : 0 }))
    .sort((a, b) => b.score - a.score)
}

/** 写成文字，给 Claude 看：每格一个字，. 是空，大写表示重音 */
export function describe(steps: Step[], bpm: number): string {
  const sym: Record<Kind, string> = { low: 'd', mid: 't', high: 'i' }
  const bars = toBars(steps)
  const lines = bars.map((b, i) => {
    const cells = Array(16).fill('.')
    for (const s of b) cells[s.step] = s.accent ? sym[s.kind].toUpperCase() : sym[s.kind]
    return `第${i + 1}小节 ${cells.join('').replace(/(.{4})/g, '$1 ').trim()}`
  })
  return `速度约 ${bpm} BPM，4/4 拍，每小节 16 格（每 4 格一拍）。d=闷的低音“咚”，t=中间的“哒”，i=亮的“叮”，大写是重音，. 是空。\n${lines.join('\n')}`
}
