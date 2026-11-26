// 韵脚本：自己从歌里记下来的一组组韵。只存押韵的词和出处，不存整段歌词。
import { enKey, syllables } from './en'
import { tailKey, toSyls, type Mode } from './rhyme'

export interface RhymeGroup {
  id: string
  /** 押在一起的词或短语 */
  items: string[]
  /** 出处：歌名、歌手。自己想的就留空 */
  song: string
  artist: string
  /** 颜色在调色板里的序号 */
  color: number
  /** 是从哪张素材卡片里划出来的 */
  from?: string
}

/** 比较用：小写，去掉标点和撇号，空白并成一个空格 */
export const norm = (s: string) => s.toLowerCase().replace(/[’'`]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** 手动输入一组：用逗号、顿号、斜杠或换行隔开，短语里可以有空格 */
export const parseItems = (text: string) => {
  const seen = new Set<string>()
  return text.split(/[,，、/／;；\n]+/).map((s) => s.trim()).filter((s) => {
    const k = norm(s)
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** 往一组里加词，重复的不加 */
export const addItems = (g: RhymeGroup, more: string[]): RhymeGroup => {
  const have = new Set(g.items.map(norm))
  const add = more.map((s) => s.trim()).filter((s) => {
    const k = norm(s)
    if (!k || have.has(k)) return false
    have.add(k)
    return true
  })
  return add.length ? { ...g, items: [...g.items, ...add] } : g
}

export const sourceOf = (g: Pick<RhymeGroup, 'song' | 'artist'>) => (g.song || g.artist ? `${g.artist}${g.song ? `《${g.song}》` : ''}` : '自己记的')

/**
 * 查一个词时，哪些记过的韵组用得上。
 * 中文按最后一个字的韵比；英文在给了 sound（查读音的函数）时按最后两个元音比；
 * 其余只认组里出现过的词（整个短语，或短语里的某个词）。
 */
export function matchGroups(groups: RhymeGroup[], query: string, mode: Mode, sound?: (text: string) => string[] | null): RhymeGroup[] {
  const q = norm(query)
  if (!q) return []
  const qs = toSyls(query)
  const qp = sound?.(query)
  const qn = qp ? syllables(qp) : 0
  return groups.filter((g) =>
    g.items.some((it) => {
      const k = norm(it)
      if (k === q || k.split(' ').includes(q) || q.split(' ').includes(k)) return true
      const p = qp && sound?.(it)
      if (p) {
        // 英文：最后两个元音一样（只有一个音节的就比一个）
        const n = Math.min(2, qn, syllables(p))
        if (n > 0 && enKey(qp, n, 'loose') === enKey(p, n, 'loose')) return true
      }
      const s = toSyls(it)
      if (!qs.length || !s.length) return false
      return tailKey(qs, 1, mode) === tailKey(s, 1, mode)
    }),
  )
}

export interface Seg {
  text: string
  /** 属于哪一组；不属于任何一组是 -1 */
  group: number
}

const isWord = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c) && !/[぀-ヿ㐀-鿿가-힯]/.test(c)

/** 把一行歌词按记过的韵词切开，用来上色。长的短语优先；字母词要整词才算 */
export function markLine(line: string, groups: RhymeGroup[]): Seg[] {
  const low = line.toLowerCase()
  const items = groups.flatMap((g, gi) => g.items.map((it) => ({ it: it.toLowerCase().trim(), gi }))).filter((x) => x.it).sort((a, b) => b.it.length - a.it.length)
  const owner = new Int16Array(line.length).fill(-1)
  for (const { it, gi } of items) {
    for (let at = low.indexOf(it); at >= 0; at = low.indexOf(it, at + 1)) {
      const end = at + it.length
      if (isWord(low[at]) && isWord(low[at - 1])) continue
      if (isWord(low[end - 1]) && isWord(low[end])) continue
      let free = true
      for (let k = at; k < end && free; k++) free = owner[k] < 0
      if (free) owner.fill(gi, at, end)
    }
  }
  const out: Seg[] = []
  for (let i = 0; i < line.length; i++) {
    const last = out[out.length - 1]
    if (last && last.group === owner[i]) last.text += line[i]
    else out.push({ text: line[i], group: owner[i] })
  }
  return out
}
