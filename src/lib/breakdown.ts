// 拆歌：边听边记下 beat 每次变化的位置，用大白话描述每一段的鼓、flow 和转场。
// 网站听不到歌，这里只整理你记下来的东西。
import { genreOf } from './genres'
import type { SectionTpl } from './styles'

type DemoStep = { step: number; kind: 'low' | 'mid' | 'high'; accent: boolean }

const bar = (low: number[], mid: number[], high: number[]): DemoStep[] =>
  [0, 16].flatMap((o) => [
    ...low.map((s) => ({ step: s + o, kind: 'low' as const, accent: s === 0 })),
    ...mid.map((s) => ({ step: s + o, kind: 'mid' as const, accent: true })),
    ...high.map((s) => ({ step: s + o, kind: 'high' as const, accent: false })),
  ])
const every = (n: number) => Array.from({ length: 16 / n }, (_, i) => i * n)

export interface DrumKind {
  id: string
  name: string
  /** 怎么听出来 */
  plain: string
  steps: DemoStep[]
  sounds: { low: string; mid: string; high: string }
}

/** 鼓的几种常见感觉。示例都是通用型，不取自任何具体的歌 */
export const DRUMS: DrumKind[] = [
  { id: 'boombap', name: 'boom bap（正常的咚-哒）', plain: '底鼓和军鼓一下一下很清楚，军鼓落在第 2、4 拍，能跟着点头', steps: bar([0, 10], [4, 12], every(2)), sounds: { low: 'kick', mid: 'snare', high: 'hat' } },
  { id: 'trap', name: 'trap（慢一半 + 密镲）', plain: '军鼓隔很久才来一下，听起来慢了一半；镲却打得很碎很密，低音又长又沉', steps: bar([0, 7, 10], [8], every(1)), sounds: { low: '808', mid: 'snare', high: 'hat' } },
  { id: 'four', name: '四踩（每拍一个底鼓）', plain: '底鼓每一拍都有，像舞曲，推着往前走', steps: bar([0, 4, 8, 12], [4, 12], [2, 6, 10, 14]), sounds: { low: 'kick', mid: 'snare', high: 'hat' } },
  { id: 'sparse', name: '只剩低音或零星几下', plain: '鼓几乎没有，只有很沉的低音偶尔来一下，留出大片空白给人声', steps: bar([0, 10], [], []), sounds: { low: '808', mid: 'snare', high: 'hat' } },
  { id: 'none', name: '鼓抽掉了', plain: '没有鼓，只剩旋律、和声或者清唱。常用在开头、转场前和情绪最重的一句', steps: bar([], [], [0, 6, 12]), sounds: { low: 'kick', mid: 'snare', high: 'bell' } },
  { id: 'other', name: '别的 / 说不清', plain: '先记下时间，在备注里写你听到的感觉', steps: [], sounds: { low: 'kick', mid: 'snare', high: 'hat' } },
]

export interface FlowKind {
  id: string
  name: string
  plain: string
  /** 示范：字落在哪些格子上（16 格一小节，共两小节），accent 是重读的字 */
  grid: number[]
  accents: number[]
  triplet?: boolean
}

export const FLOWS: FlowKind[] = [
  { id: 'steady', name: '稳稳地说', plain: '一拍两个字左右，不急，每个字都听得清', grid: every(2).flatMap((s) => [s, s + 16]).sort((a, b) => a - b), accents: [0, 8, 16, 24] },
  { id: 'dense', name: '密集连珠', plain: '字一个接一个塞满，一拍四个字，几乎不换气', grid: Array.from({ length: 32 }, (_, i) => i), accents: [0, 8, 16, 24] },
  { id: 'punch', name: '一个字，停，再接一长串', plain: '先重重落一个字，空出一段，再一口气补上一长句。停顿让前面那个字变得很重', grid: [0, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31], accents: [0, 16] },
  { id: 'triplet', name: '三连音（哒哒哒、哒哒哒）', plain: '一拍三个字，滚着往前走，trap 里最常见', grid: Array.from({ length: 24 }, (_, i) => i), accents: [0, 3, 6, 9, 12, 15, 18, 21], triplet: true },
  { id: 'drag', name: '拖长了唱', plain: '字很少，每个字拉得很长，带旋律，接近唱', grid: [0, 4, 8, 12, 16, 20, 24, 28], accents: [0, 16] },
  { id: 'talk', name: '像说话', plain: '不太踩拍子，像在讲话或念白', grid: [0, 3, 5, 9, 14, 17, 19, 22, 27, 30], accents: [] },
  { id: 'other', name: '别的 / 说不清', plain: '在备注里写你听到的感觉', grid: [], accents: [] },
]

export const TRANS: { id: string; name: string; plain: string }[] = [
  { id: 'cut', name: '直接切', plain: '上一段最后一个字刚落，新的鼓马上进来' },
  { id: 'gap', name: '停一下再进', plain: '所有声音空一拍或半拍，然后新的一段砸进来' },
  { id: 'dropout', name: '先把鼓抽掉', plain: '最后一两小节只剩人声或旋律，鼓回来的时候已经换了打法' },
  { id: 'rise', name: '越来越强', plain: '一个往上升的音效或越打越密的鼓，把人推进下一段' },
  { id: 'filter', name: '变闷再打开', plain: '声音像隔了一层墙，然后突然清楚' },
  { id: 'fx', name: '一声效果音', plain: '倒放的声音、一声喊、一下重击，当作分界线' },
  { id: 'other', name: '别的 / 没注意', plain: '' },
]

export const FEELS: { id: Feel; name: string }[] = [
  { id: 'same', name: '和前面一样快' },
  { id: 'half', name: '听起来慢了一半' },
  { id: 'double', name: '听起来快了一倍' },
]
export type Feel = 'same' | 'half' | 'double'

export interface Part {
  id: string
  /** 这一段从歌的第几秒开始 */
  at: number
  name: string
  drum: string
  /** 像曲风表里的哪一种（可不填） */
  genre?: string
  feel: Feel
  flow: string
  trans: string
  note: string
}

export interface Breakdown {
  id: string
  song: string
  artist: string
  bpm: number
  parts: Part[]
}

export const newPart = (at: number, n: number): Part => ({ id: 'p' + Math.random().toString(36).slice(2, 10), at: Math.max(0, Math.round(at * 10) / 10), name: `第 ${n} 段`, drum: '', feel: 'same', flow: '', trans: '', note: '' })

/** 秒 -> 1:05 */
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

/** 1:05、65、1：05 -> 秒；看不懂返回 null */
export function parseClock(text: string): number | null {
  const m = /^\s*(?:(\d+)\s*[:：]\s*)?(\d+(?:\.\d+)?)\s*$/.exec(text)
  if (!m) return null
  return (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2])
}

/** 跟着拍子点几下，估出 BPM：取相邻两下间隔的中位数；点得太少返回 0 */
export function tapBpm(times: number[]): number {
  if (times.length < 4) return 0
  const gaps = times.slice(1).map((t, i) => t - times[i]).filter((g) => g > 0.2 && g < 2).sort((a, b) => a - b)
  if (gaps.length < 3) return 0
  return Math.round(60 / gaps[gaps.length >> 1])
}

/** 一段大约几小节（4/4 拍）；最后一段不知道多长，返回 0 */
export function barsOf(b: Breakdown, i: number): number {
  const parts = sorted(b)
  const next = parts[i + 1]
  if (!next || !b.bpm) return 0
  return Math.max(1, Math.round(((next.at - parts[i].at) * b.bpm) / 240))
}

export const sorted = (b: Breakdown) => [...b.parts].sort((x, y) => x.at - y.at)

const nameOf = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id && x.id !== 'other')?.name ?? ''

/** 写成文字，给 Claude 看 */
export function describeBreakdown(b: Breakdown): string {
  const parts = sorted(b)
  const lines = parts.map((p, i) => {
    const bars = barsOf(b, i)
    const bits = [
      nameOf(DRUMS, p.drum) && `鼓：${nameOf(DRUMS, p.drum)}`,
      genreOf(p.genre ?? '') && `我觉得像：${genreOf(p.genre ?? '')!.en}（${genreOf(p.genre ?? '')!.zh}）`,
      p.feel !== 'same' && `速度感：${FEELS.find((f) => f.id === p.feel)?.name}`,
      nameOf(FLOWS, p.flow) && `flow：${nameOf(FLOWS, p.flow)}`,
      i > 0 && nameOf(TRANS, p.trans) && `怎么进来的：${nameOf(TRANS, p.trans)}`,
      p.note.trim() && `我听到的：${p.note.trim()}`,
    ].filter(Boolean)
    return `${i + 1}. ${clock(p.at)}${parts[i + 1] ? '-' + clock(parts[i + 1].at) : ' 起'}${bars ? `（约 ${bars} 小节）` : ''} ${p.name}：${bits.join('；') || '还没填'}`
  })
  return `歌：${b.artist ? b.artist + ' ' : ''}《${b.song || '未填歌名'}》${b.bpm ? `，我跟着拍子点出来大约 ${b.bpm} BPM` : ''}\n${lines.join('\n')}`
}

/** 变成写词页“结构”里的模板：每段的小节数凑成 2 的倍数，最后一段按 8 小节算 */
export function toTemplate(b: Breakdown): SectionTpl[] {
  return sorted(b).map((p, i) => {
    const bars = barsOf(b, i)
    return { name: p.name.trim() || `第 ${i + 1} 段`, bars: bars ? Math.max(2, Math.round(bars / 2) * 2) : 8 }
  })
}
