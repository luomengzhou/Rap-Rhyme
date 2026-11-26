// 哼唱分析：从一段“哒哒哒 咚咚 叮”的录音里切出每一下，估出速度，落到 16 分音符的格子上。
// 起点用频谱通量，明暗用频谱重心；目标是抓节奏型，不是识别音高。

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

/** 原地 FFT（长度必须是 2 的幂） */
function fft(re: Float32Array, im: Float32Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const t = re[i]; re[i] = re[j]; re[j] = t
      const u = im[i]; im[i] = im[j]; im[j] = u
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const xr = re[b] * cr - im[b] * ci
        const xi = re[b] * ci + im[b] * cr
        re[b] = re[a] - xr; im[b] = im[a] - xi
        re[a] += xr; im[a] += xi
        const t = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = t
      }
    }
  }
}

const BANDS = 28

/**
 * 切出每一下。做法是音频分析里通用的“频谱通量”：把声音按 10 毫秒一帧拆成 28 个频段，
 * 哪一帧有频段突然变响，就是一下的起点。比只看总音量稳：连着哼、中间不断气的“哒哒哒”，
 * 换音时总音量几乎不变，但频段会变。明亮度用频谱重心（声音能量集中在多高的频率）。
 */
export function detectHits(x: Float32Array, sr: number): Hit[] {
  const hop = Math.max(1, Math.round(sr * 0.01))
  let N = 256
  while (N < sr * 0.023) N <<= 1
  const n = Math.max(0, Math.floor((x.length - N) / hop))
  if (!n) return []
  const hann = new Float32Array(N)
  for (let i = 0; i < N; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))
  // 频段边界：60 Hz 到 8 kHz（或采样率的一半），按对数等分
  const fTop = Math.min(8000, sr / 2)
  const edge: number[] = []
  for (let b = 0; b <= BANDS; b++) edge.push(Math.round(((60 * (fTop / 60) ** (b / BANDS)) / sr) * N))
  for (let b = 1; b <= BANDS; b++) if (edge[b] <= edge[b - 1]) edge[b] = edge[b - 1] + 1

  const rms = new Float32Array(n)
  const cen = new Float32Array(n)
  const band = new Float32Array(n * BANDS)
  const re = new Float32Array(N)
  const im = new Float32Array(N)
  let peak = 0
  let bandPeak = 0
  for (let i = 0; i < n; i++) {
    let e = 0
    const o = i * hop
    for (let k = 0; k < N; k++) {
      const v = x[o + k]
      e += v * v
      re[k] = v * hann[k]
      im[k] = 0
    }
    rms[i] = Math.sqrt(e / N)
    peak = Math.max(peak, rms[i])
    fft(re, im)
    let num = 0
    let den = 0
    for (let b = 0; b < BANDS; b++) {
      let s = 0
      for (let k = edge[b]; k < edge[b + 1] && k < N / 2; k++) {
        const p = re[k] * re[k] + im[k] * im[k]
        s += p
        num += p * k
        den += p
      }
      const a = Math.sqrt(s)
      band[i * BANDS + b] = a
      bandPeak = Math.max(bandPeak, a)
    }
    cen[i] = den > 0 ? ((num / den) * sr) / N : 0
  }
  if (peak < 1e-4 || !bandPeak) return []

  // 每个频段压成对数响度（低于最响处 2% 的当作底噪），只算变响的部分
  const lv = (i: number, b: number) => Math.log1p(100 * Math.max(0, band[i * BANDS + b] / bandPeak - 0.02))
  const rise = new Float32Array(n)
  let top = 0
  for (let i = 2; i < n; i++) {
    let s = 0
    for (let b = 0; b < BANDS; b++) s += Math.max(0, lv(i, b) - Math.max(lv(i - 1, b), lv(i - 2, b)))
    rise[i] = s
    top = Math.max(top, s)
  }
  if (!top) return []
  for (let i = 0; i < n; i++) rise[i] /= top

  const raw: { i: number; rise: number }[] = []
  for (let i = 3; i < n - 1; i++) {
    const near: number[] = []
    for (let k = Math.max(0, i - 15); k < Math.min(n, i + 15); k++) near.push(rise[k])
    const thr = Math.max(0.08, median(near) * 2 + 0.04)
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
    // 明亮度：这一下头 60 毫秒的频谱重心，按能量加权，不容易被底噪带偏
    for (let k = i; k < Math.min(n, i + 6); k++) {
      const w = rms[k] * rms[k]
      b += cen[k] * w
      c += w
    }
    // 一帧的窗口有 N 个采样，起点大约落在窗口后半段
    const time = Math.max(0, i * hop + N * 0.75 - hop) / sr
    return { time, strength: s / peak, bright: c > 0 ? b / c : 0, kind: 'mid' as Kind, accent: false }
  }).filter((h) => h.strength > 0.08)
  if (!hits.length) return []

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

/** Strudel（strudel.cc，用代码写音乐的开源工具）里能选的几套鼓机音色 */
export const STRUDEL_BANKS: [string, string][] = [
  ['', '默认鼓组'],
  ['RolandTR808', 'TR-808（trap、老派电子）'],
  ['RolandTR909', 'TR-909（house、舞曲）'],
  ['AkaiLinn', 'Linn（80 年代流行）'],
]

/** 写成 Strudel 代码：咚=bd 底鼓，哒=sd 军鼓，叮=hh 镲；重音用 gain 加大音量 */
export function toStrudel(steps: Step[], bpm: number, bank = ''): string {
  const name: Record<Kind, string> = { low: 'bd', mid: 'sd', high: 'hh' }
  const bars = toBars(steps)
  const group = (cells: string[]) => cells.join(' ').replace(/((?:\S+ ){3}\S+) /g, '$1  ')
  const seq = (f: (s: Step | undefined) => string) =>
    bars.map((b) => `[${group(Array.from({ length: 16 }, (_, i) => f(b.find((s) => s.step === i))))}]`)
  const wrap = (rows: string[]) => (!rows.length ? '~' : rows.length > 1 ? `<\n  ${rows.join('\n  ')}\n>` : rows[0].slice(1, -1))
  const lines = [
    `// 哼唱转出来的节奏，约 ${bpm} BPM。每小节 16 格，~ 是空`,
    `setcpm(${bpm}/4)`,
    `s(\`${wrap(seq((s) => (s ? name[s.kind] : '~')))}\`)`,
  ]
  if (steps.some((s) => s.accent)) lines.push(`  .gain(\`${wrap(seq((s) => (s?.accent ? '1.3' : '.9')))}\`)`)
  if (bank) lines.push(`  .bank("${bank}")`)
  lines.push('  // 想换效果就去掉下面某一行前面的 //', '  // .room(.4)      // 混响，空间感', '  // .lpf(900)      // 低通，变闷', '  // .delay(.25)    // 回声', '  // .speed(.8)     // 音调放低')
  return lines.join('\n')
}

/** 在 strudel.cc 里直接打开这段代码的链接（代码放在 # 后面，不会发给服务器） */
export function strudelLink(code: string): string {
  const bytes = new TextEncoder().encode(code)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return 'https://strudel.cc/#' + encodeURIComponent(btoa(bin))
}
