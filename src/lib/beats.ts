// 用 Tone.js 在浏览器里合成示例 loop，不使用任何现成的歌或采样。
import * as Tone from 'tone'

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

export const BEATS: Beat[] = [
  {
    id: 'click', name: '节拍器', mood: '只要拍子', bpm: 90, desc: '只有拍点，练打拍用',
    kick: 'x...............x...............', snare: '................................',
    hat: 'x...x...x...x...x...x...x...x...', bass: {}, lead: {},
  },
  {
    id: 'dark-trap', name: '暗黑 trap', mood: '暗黑', bpm: 140, desc: '小调、低沉 808，half-time 听感很慢',
    kick: 'x.....x...x.....x......x..x.....', snare: '........x...............x.......',
    hat: 'x.x.x.x.x.xxx.x.x.x.x.x.x.x.xxxx',
    bass: { 0: 'C1', 6: 'C1', 10: 'C1', 16: 'G#0', 23: 'G#0', 26: 'A#0' },
    lead: { 0: 'C4', 4: 'D#4', 8: 'G4', 12: 'D#4', 16: 'G#3', 20: 'C4', 24: 'D#4', 28: 'D4' },
  },
  {
    id: 'boombap-playful', name: '戏谑 boom bap', mood: '戏谑 / 嘲讽', bpm: 92, desc: '跳跃的拨弦旋律，鼓点松弛',
    kick: 'x......x..x.....x..x......x.....', snare: '....x.......x.......x.......x...',
    hat: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.', swing: 0.35,
    bass: { 0: 'E1', 7: 'E1', 10: 'G1', 16: 'A1', 19: 'A1', 26: 'B1' },
    lead: { 0: 'E4', 3: 'G4', 6: 'B4', 8: 'A#4', 14: 'G4', 16: 'A4', 19: 'C5', 22: 'E5', 24: 'D#5', 30: 'B4' },
  },
  {
    id: 'dark-playful', name: '暗黑 + 戏谑', mood: '暗黑 + 戏谑', bpm: 90, desc: '阴森但有跳跃感，马戏团 / 鬼屋色彩',
    kick: 'x.....x.x.......x.....x.x..x....', snare: '....x.......x.......x.......x.x.',
    hat: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.', swing: 0.25,
    bass: { 0: 'D1', 6: 'D1', 8: 'F1', 16: 'A#0', 22: 'A#0', 24: 'A0' },
    lead: { 0: 'D4', 2: 'F4', 4: 'A4', 6: 'G#4', 8: 'A4', 12: 'F4', 16: 'A#3', 18: 'D4', 20: 'F4', 22: 'E4', 24: 'C#4', 28: 'A3' },
  },
  {
    id: 'brag-trap', name: '张扬 trap', mood: '嚣张 / 自信', bpm: 150, desc: '密集 hi-hat，适合三连音 flow',
    kick: 'x..x......x.....x..x......x..x..', snare: '........x...............x.......',
    hat: 'xxx.xxx.x.xxxxx.xxx.xxx.x.xxxxxx',
    bass: { 0: 'F1', 3: 'F1', 10: 'F1', 16: 'D#1', 19: 'D#1', 26: 'C1', 29: 'C1' },
    lead: { 0: 'F4', 8: 'G#4', 16: 'D#4', 24: 'C4' },
  },
  {
    id: 'chill', name: 'chill boom bap', mood: '松弛 / 日常', bpm: 85, desc: '温柔的和弦，蛋堡式的说话感',
    kick: 'x.........x.....x.......x.x.....', snare: '....x.......x.......x.......x...',
    hat: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.', swing: 0.4,
    bass: { 0: 'F1', 10: 'F1', 16: 'D1', 24: 'G1', 26: 'C1' },
    lead: { 0: 'A4', 4: 'C5', 8: 'E5', 12: 'C5', 16: 'F4', 20: 'A4', 24: 'B4', 28: 'G4' },
  },
  {
    id: 'melodic', name: '抒情', mood: '抒情', bpm: 78, desc: '慢速、长音旋律，留给唱的空间',
    kick: 'x...............x.....x.........', snare: '........x...............x.......',
    hat: 'x...x...x...x...x...x...x...x...',
    bass: { 0: 'A1', 16: 'F1', 24: 'G1' },
    lead: { 0: 'E4', 6: 'A4', 12: 'C5', 16: 'A4', 22: 'F4', 24: 'G4', 28: 'E4' },
  },
]

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
