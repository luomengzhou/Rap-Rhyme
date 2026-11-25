// 用 Tone.js 在浏览器里合成示例 loop，不使用任何现成的歌或采样。
import * as Tone from 'tone'
import { GENRES } from './genres'

export interface Beat {
  id: string
  name: string
  mood: string
  bpm: number
  desc: string
  /** 每个字符是一个 16 分音符，x 为触发，共 32 格（两小节） */
  kick: string
  snare: string
  hat: string
  /** 低音与旋律：格子序号 -> 音名 */
  bass: Record<number, string>
  lead: Record<number, string>
  swing?: number
}

/** 底部播放条能选的 beat：一个节拍器，加上曲风表里每种曲风的鼓点骨架 */
export const BEATS: Beat[] = [
  {
    id: 'click', name: '节拍器', mood: '只要拍子', bpm: 90, desc: '只有拍点，练打拍用',
    kick: 'x...............x...............', snare: '................................',
    hat: 'x...x...x...x...x...x...x...x...', bass: {}, lead: {},
  },
  ...GENRES.map((g) => g.beat),
]

/** 按 id 找 beat；以前存的旧名字找不到时退回 boom bap */
export const beatOf = (id: string) => BEATS.find((b) => b.id === id) ?? BEATS.find((b) => b.id === 'boom-bap') ?? BEATS[0]

type StepFn = (step: number) => void

class Engine {
  private ready = false
  private kick!: Tone.MembraneSynth
  private snare!: Tone.NoiseSynth
  private hat!: Tone.NoiseSynth
  private bass!: Tone.MonoSynth
  private lead!: Tone.PolySynth
  private click!: Tone.Synth
  private seq: Tone.Sequence<number> | null = null
  private listeners = new Set<StepFn>()
  playing = false
  beat: Beat = BEATS[0]

  private init() {
    if (this.ready) return
    const out = new Tone.Limiter(-3).toDestination()
    this.kick = new Tone.MembraneSynth({ octaves: 6, pitchDecay: 0.04, envelope: { attack: 0.001, decay: 0.3, sustain: 0 } }).connect(out)
    this.snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 } }).connect(new Tone.Filter(1800, 'highpass').connect(out))
    this.snare.volume.value = -8
    this.hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0 } }).connect(new Tone.Filter(8000, 'highpass').connect(out))
    this.hat.volume.value = -18
    this.bass = new Tone.MonoSynth({ oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.4, sustain: 0.5, release: 0.3 }, filterEnvelope: { attack: 0.001, decay: 0.1, sustain: 1, baseFrequency: 200, octaves: 1 } }).connect(out)
    this.bass.volume.value = -4
    this.lead = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.25, sustain: 0.1, release: 0.4 } }).connect(new Tone.Filter(2400, 'lowpass').connect(out))
    this.lead.volume.value = -14
    this.click = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 } }).connect(out)
    this.click.volume.value = -16
    this.ready = true
  }

  onStep(fn: StepFn) {
    this.listeners.add(fn)
    return () => void this.listeners.delete(fn)
  }

  setBpm(bpm: number) {
    Tone.getTransport().bpm.value = bpm
  }

  /** 当前位置，单位是 16 分音符（从开始播放算起，带小数） */
  position(): number {
    const t = Tone.getTransport()
    return (t.seconds * t.bpm.value * 4) / 60
  }

  async start(beat: Beat, bpm: number) {
    await Tone.start()
    this.init()
    this.stop()
    this.beat = beat
    const t = Tone.getTransport()
    t.bpm.value = bpm
    t.swing = beat.swing ?? 0
    t.swingSubdivision = '16n'
    const steps = Array.from({ length: 32 }, (_, i) => i)
    this.seq = new Tone.Sequence<number>(
      (time, i) => {
        if (beat.id === 'click') {
          if (i % 4 === 0) this.click.triggerAttackRelease(i % 16 === 0 ? 'C6' : 'C5', '32n', time)
        } else {
          if (beat.kick[i] === 'x') this.kick.triggerAttackRelease('C1', '8n', time)
          if (beat.snare[i] === 'x') this.snare.triggerAttackRelease('16n', time)
          if (beat.hat[i] === 'x') this.hat.triggerAttackRelease('32n', time)
          if (beat.bass[i]) this.bass.triggerAttackRelease(beat.bass[i], '4n', time)
          if (beat.lead[i]) this.lead.triggerAttackRelease(beat.lead[i], '8n', time)
        }
        Tone.getDraw().schedule(() => this.listeners.forEach((fn) => fn(i)), time)
      },
      steps,
      '16n',
    )
    this.seq.start(0)
    t.start('+0.05', 0)
    this.playing = true
  }

  stop() {
    if (!this.ready) return
    this.seq?.dispose()
    this.seq = null
    const t = Tone.getTransport()
    t.stop()
    t.position = 0
    this.playing = false
    this.listeners.forEach((fn) => fn(-1))
  }

  /** 回放哼唱分析出来的节奏：咚 / 哒 / 叮各用选定的音色，重音更响 */
  async playSteps(bpm: number, steps: { step: number; kind: 'low' | 'mid' | 'high'; accent: boolean }[], sounds: { low: string; mid: string; high: string }) {
    await Tone.start()
    this.init()
    this.stop()
    const now = Tone.now() + 0.08
    const unit = 15 / bpm
    for (const s of steps) {
      const at = now + s.step * unit
      const vel = s.accent ? 1 : 0.55
      if (s.kind === 'low') {
        if (sounds.low === '808') this.bass.triggerAttackRelease('C1', 0.45, at, vel)
        else this.kick.triggerAttackRelease('C1', '8n', at, vel)
      } else if (s.kind === 'mid') {
        if (sounds.mid === 'rim') this.click.triggerAttackRelease('G5', '32n', at, vel)
        else this.snare.triggerAttackRelease('16n', at, vel)
      } else if (sounds.high === 'hat') this.hat.triggerAttackRelease('32n', at, vel)
      else this.lead.triggerAttackRelease('C6', 0.4, at, vel)
    }
  }

  /** 回放识别出来的旋律：notes 的时间是秒，音高是 MIDI 编号 */
  async playNotes(notes: { start: number; dur: number; midi: number; amp: number }[]) {
    await Tone.start()
    this.init()
    this.stop()
    if (!notes.length) return
    const now = Tone.now() + 0.08
    const t0 = notes[0].start
    for (const n of notes) this.lead.triggerAttackRelease(Tone.Frequency(n.midi, 'midi').toFrequency(), Math.max(0.08, n.dur), now + n.start - t0, 0.4 + n.amp * 0.5)
  }

  /** 乐理卡里的小示范：按给定的格子敲击，accent 为重音位置 */
  async demo(bpm: number, grid: number[], accents: number[] = [], division: '16n' | '8t' = '16n', notes?: string[]) {
    await Tone.start()
    this.init()
    this.stop()
    const now = Tone.now() + 0.08
    const unit = division === '16n' ? 60 / bpm / 4 : 60 / bpm / 3
    grid.forEach((g, k) => {
      const at = now + g * unit
      if (notes) this.lead.triggerAttackRelease(notes[k % notes.length], 0.3, at)
      else this.click.triggerAttackRelease(accents.includes(g) ? 'C6' : 'G4', '32n', at)
    })
  }
}

export const engine = new Engine()

/** 把一小节里的落点（0-15）写成节奏码：连着的算一组，例如 2-2-2 */
export function rhythmCode(onsets: number[]): string {
  if (!onsets.length) return ''
  const s = [...new Set(onsets)].sort((a, b) => a - b)
  const groups: number[] = []
  let n = 1
  for (let i = 1; i < s.length; i++) {
    if (s[i] - s[i - 1] > 2) {
      groups.push(n)
      n = 1
    } else n++
  }
  groups.push(n)
  return groups.join('-')
}
