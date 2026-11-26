// 听歌笔记：一首歌记在哪个范围，属于什么曲风，以及按曲风摆成一张星图。
import { FAMILIES, GENRES, genreOf } from './genres'

/** 听到适合某段词或某种风格的歌，记下是哪首、在哪个位置 */
export interface SongRef {
  id: string
  song: string
  artist: string
  /** 位置，如 1:20-1:45 */
  at: string
  /** 适合什么：某一段词，或一种风格 */
  fit: string
  note: string
  link: string
  /** 只属于某一首歌时，是那首歌的标题；空表示不限 */
  draft: string
  /** 属于某一类歌（一个文件夹）时，是文件夹的名字 */
  folder?: string
  /** 曲风表里的 id */
  genre?: string
  /** 为什么归到这个曲风，一句话 */
  why?: string
  added: number
}

export type Scope = 'song' | 'folder' | 'global'
export const scopeOf = (r: SongRef): Scope => (r.draft ? 'song' : r.folder ? 'folder' : 'global')

/** 请 Claude 判断几首歌各属于哪个曲风。只让它从曲风表里选，一次问一批，省得一首一首问 */
export const genrePrompt = (songs: { song: string; artist: string }[]) =>
  `下面是几首歌。请判断每首最接近哪个说唱曲风，只能从给出的曲风代号里选一个；不是说唱的歌选气质最接近的。你是凭记忆判断的，不认识或没把握的歌写 unknown，不要猜。\n输出格式：每首一行，“序号|曲风代号|一句话理由（15 个字以内，说听感，不要评价歌词）”，不要别的文字。\n\n可选的曲风代号：\n${GENRES.map((g) => `${g.id}（${g.en}）`).join('、')}\n\n歌曲：\n${songs.map((s, i) => `${i + 1}. ${s.song}${s.artist ? ' / ' + s.artist : ''}`).join('\n')}`

/** 读 Claude 的回答：序号 -> 曲风和理由。代号不在表里的、写 unknown 的都不要 */
export function parseGenres(reply: string, count: number): Record<number, { genre: string; why: string }> {
  const out: Record<number, { genre: string; why: string }> = {}
  for (const line of reply.split('\n')) {
    const m = /^\s*(\d+)\s*[|｜]\s*([a-z0-9-]+)\s*(?:[|｜]\s*(.*))?$/i.exec(line.trim())
    if (!m) continue
    const i = Number(m[1]) - 1
    const g = genreOf(m[2].toLowerCase())
    if (i >= 0 && i < count && g) out[i] = { genre: g.id, why: (m[3] ?? '').trim().slice(0, 40) }
  }
  return out
}

export interface Star {
  ref: SongRef
  x: number
  y: number
  family: number
}

/** 每个曲风家族在星图上的中心（0-100 的画布） */
export const familyCenter = (f: number) => {
  const a = (f / FAMILIES.length) * Math.PI * 2 - Math.PI / 2
  return { x: 50 + Math.cos(a) * 34, y: 50 + Math.sin(a) * 34 }
}

/**
 * 把认出曲风的歌摆成星图：同一个家族聚在一起，同一个曲风的靠得更近。
 * 位置只由曲风决定，是一张示意图，不是算出来的相似度。
 */
export function starMap(refs: SongRef[]): Star[] {
  const seen = new Map<string, number>()
  const out: Star[] = []
  for (const ref of refs) {
    const g = ref.genre ? genreOf(ref.genre) : undefined
    if (!g) continue
    const family = FAMILIES.indexOf(g.family as (typeof FAMILIES)[number])
    const inFam = GENRES.filter((x) => x.family === g.family)
    const gi = inFam.findIndex((x) => x.id === g.id)
    const c = familyCenter(family)
    // 曲风在家族里占一个方向，同曲风的歌沿着这个方向一圈圈往外排
    const k = seen.get(g.id) ?? 0
    seen.set(g.id, k + 1)
    const a = (gi / inFam.length) * Math.PI * 2 + k * 0.9
    const r = 5 + (k % 4) * 2.2 + Math.floor(k / 4) * 1.5
    out.push({ ref, family, x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r })
  }
  return out
}
