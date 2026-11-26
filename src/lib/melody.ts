// 哼唱的旋律：把识别出来的音符整理成一条单旋律，写成 MIDI 文件或 Strudel 代码。
// 识别本身在 pitch.ts 里（用开源的 Basic Pitch 模型），这里只处理结果。

export interface Note {
  /** 开始时间，秒 */
  start: number
  /** 时长，秒 */
  dur: number
  /** MIDI 音高，60 是中央 C */
  midi: number
  /** 力度 0-1 */
  amp: number
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const noteName = (midi: number) => `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`

/** 整理成一条单旋律：去掉太短和音域外的，同一时间只留最响的那个音，相邻的同一个音并起来 */
export function toMono(raw: Note[]): Note[] {
  const notes = raw.filter((n) => n.dur >= 0.07 && n.midi >= 36 && n.midi <= 96).sort((a, b) => a.start - b.start || b.amp - a.amp)
  const out: Note[] = []
  for (const n of notes) {
    const last = out[out.length - 1]
    if (!last) {
      out.push({ ...n })
      continue
    }
    const lastEnd = last.start + last.dur
    if (n.start < lastEnd - 0.03) {
      // 重叠：响的那个赢；被盖住的前一个音截短
      if (n.amp > last.amp * 1.15 && n.start - last.start >= 0.07) {
        last.dur = n.start - last.start
        out.push({ ...n })
      } else if (n.amp > last.amp * 1.15) out[out.length - 1] = { ...n }
      continue
    }
    if (n.midi === last.midi && n.start - lastEnd < 0.05) last.dur = n.start + n.dur - last.start
    else out.push({ ...n })
  }
  return out
}

const vlq = (n: number) => {
  const bytes = [n & 0x7f]
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80)
  return bytes
}

/** 写成标准 MIDI 文件（单轨），可以拖进 FL Studio、GarageBand、BandLab */
export function midiFile(notes: Note[], bpm: number): Uint8Array {
  const ppq = 480
  const tick = (sec: number) => Math.max(0, Math.round((sec * bpm * ppq) / 60))
  const ev: { t: number; bytes: number[] }[] = []
  for (const n of notes) {
    const vel = Math.max(1, Math.min(127, Math.round(40 + n.amp * 87)))
    ev.push({ t: tick(n.start), bytes: [0x90, n.midi, vel] })
    ev.push({ t: Math.max(tick(n.start) + 1, tick(n.start + n.dur)), bytes: [0x80, n.midi, 0] })
  }
  // 同一时刻先关音再开音
  ev.sort((a, b) => a.t - b.t || a.bytes[0] - b.bytes[0])
  const us = Math.round(60000000 / bpm)
  const track = [0x00, 0xff, 0x51, 0x03, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff]
  let at = 0
  for (const e of ev) {
    track.push(...vlq(e.t - at), ...e.bytes)
    at = e.t
  }
  track.push(0x00, 0xff, 0x2f, 0x00)
  const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
  return new Uint8Array([0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 0, 0, 1, (ppq >> 8) & 0xff, ppq & 0xff, 0x4d, 0x54, 0x72, 0x6b, ...u32(track.length), ...track])
}

/** 落到 16 分音符格子上：每格一个音名或空；从第一个音开始算，最多 bars 小节 */
export function melodyGrid(notes: Note[], bpm: number, bars = 4): (number | null)[][] {
  if (!notes.length) return []
  const unit = 15 / bpm
  const t0 = notes[0].start
  const cells = new Map<number, Note>()
  for (const n of notes) {
    const s = Math.round((n.start - t0) / unit)
    if (s < 0 || s >= bars * 16) continue
    const cur = cells.get(s)
    if (!cur || n.amp > cur.amp) cells.set(s, n)
  }
  const last = Math.max(...cells.keys())
  return Array.from({ length: Math.floor(last / 16) + 1 }, (_, b) => Array.from({ length: 16 }, (_, i) => cells.get(b * 16 + i)?.midi ?? null))
}

/** 写成 Strudel 代码：note("c4 ~ e4 …")，每小节 16 格 */
export function melodyStrudel(notes: Note[], bpm: number): string {
  const grid = melodyGrid(notes, bpm)
  const rows = grid.map((bar) => '[' + bar.map((m) => (m === null ? '~' : noteName(m).toLowerCase().replace('#', 's'))).join(' ').replace(/((?:\S+ ){3}\S+) /g, '$1  ') + ']')
  const body = !rows.length ? '~' : rows.length > 1 ? `<\n  ${rows.join('\n  ')}\n>` : rows[0].slice(1, -1)
  return [`// 哼唱转出来的旋律，约 ${bpm} BPM。每小节 16 格，~ 是空，cs4 是升 C`, `setcpm(${bpm}/4)`, `note(\`${body}\`)`, '  .s("triangle")', '  // 换音色试试：.s("sawtooth") 或 .s("piano")；加 .room(.4) 有混响'].join('\n')
}
