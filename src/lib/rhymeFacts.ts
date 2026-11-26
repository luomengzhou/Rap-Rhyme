// 把找韵工具能查到的东西整理成一段话交给 Claude：
// 对话里的 Claude 自己不会算韵，这里替它查好候选词，它只负责挑意思合适的。
import { stripNotes } from './analyze'
import { findEn, isEnglish, type EnIndex } from './en'
import { findRhymes, toSyls, type RhymeIndex } from './rhyme'

const HEADER = /^\s*[[【](.+?)[\]】]\s*$/
const NUM: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', 一: '1', 二: '2', 三: '3', 四: '4' }
/** verse two / Verse 2 / 第二段主歌 都归成同一种写法，方便对上段落标题 */
const flat = (s: string) =>
  s
    .toLowerCase()
    .replace(/one|two|three|four|[一二三四]/g, (m) => NUM[m])
    .replace(/主歌/g, 'verse')
    .replace(/副歌/g, 'hook')
    .replace(/[^a-z0-9㐀-鿿]+/g, '')

/** 问题里提到了哪一段，就只看那一段；没提到就看整首 */
export function sectionFor(text: string, question: string): { name: string; lines: string[] } {
  const q = flat(question)
  const all: string[] = []
  let cur: { name: string; lines: string[] } | null = null
  let hit: { name: string; lines: string[] } | null = null
  for (const line of text.split('\n')) {
    const m = HEADER.exec(line)
    if (m) {
      cur = { name: m[1].trim(), lines: [] }
      const key = flat(cur.name)
      if (!hit && key.length >= 2 && q.includes(key)) hit = cur
    } else {
      all.push(line)
      cur?.lines.push(line)
    }
  }
  return hit ?? { name: '', lines: all }
}

/** 一行最后押韵的那个词：最后两个连着的汉字，或者最后一个英文词 */
export function lineEnd(line: string): string {
  const t = stripNotes(line).replace(/\*/g, '').replace(/[^A-Za-z'㐀-鿿]+$/u, '')
  const en = /[A-Za-z']+$/.exec(t)
  if (en) return en[0].toLowerCase()
  const zh = /[㐀-鿿]{1,2}$/.exec(t)
  return zh ? zh[0] : ''
}

/** 问题里用引号括起来的词 */
const quoted = (q: string) => [...q.matchAll(/[「『“"]([^」』”"\n]{1,12})[」』”"]/g)].map((m) => m[1].trim()).filter(Boolean)

export interface RhymeFactsInput {
  text: string
  question: string
  /** 找韵面板里现在查的词 */
  query: string
  liked: string[]
  blocked: string[]
  index: RhymeIndex | null
  enIdx: EnIndex | null
  /** 自己补的英文读音 */
  extra?: Record<string, string>
}

/** 作者点名要查的词多给一些，句尾自动查的少给一些，免得太长 */
const PER = 12
const PER_ASKED = 30
const MAX_TARGETS = 12

/** 查一个词的候选：先双押，不够再单押。喜欢的排前面 */
export function candidates(word: string, o: Pick<RhymeFactsInput, 'liked' | 'blocked' | 'index' | 'enIdx' | 'extra'>, per = PER): { n: number; words: string[] } | null {
  const liked = new Set(o.liked)
  const blocked = new Set(o.blocked)
  const top = (list: { w: string; loose: boolean }[]) => {
    const sorted = [...list].sort((a, b) => Number(liked.has(b.w)) - Number(liked.has(a.w)))
    return sorted.slice(0, per).map((x) => x.w + (x.loose ? '（宽）' : ''))
  }
  if (isEnglish(word)) {
    if (!o.enIdx) return null
    for (const n of [2, 1]) {
      const hits = findEn(o.enIdx, word, { n, mode: 'loose', showRare: false, blocked, extra: o.extra })
      if (hits.length >= (n === 2 ? 4 : 1)) return { n, words: top(hits.map((h) => ({ w: h.word.w, loose: h.looseOnly }))) }
    }
    return null
  }
  if (!o.index) return null
  const size = toSyls(word).length
  for (const n of [2, 1]) {
    if (size < n) continue
    const hits = findRhymes(o.index, word, { n, mode: 'loose', blocked })
    if (hits.length >= (n === 2 ? 4 : 1)) return { n, words: top(hits.map((h) => ({ w: h.word.w, loose: h.looseOnly }))) }
  }
  return null
}

/** 给 Claude 的一段话；什么都查不到时返回空字符串 */
export function rhymeFacts(o: RhymeFactsInput): string {
  const sec = sectionFor(o.text, o.question)
  const targets: string[] = []
  const add = (w: string) => {
    const t = w.trim()
    if (t && !targets.includes(t) && targets.length < MAX_TARGETS) targets.push(t)
  }
  add(o.query)
  quoted(o.question).forEach(add)
  const asked = targets.length
  sec.lines.map(lineEnd).forEach(add)

  const seen = new Set<string>()
  const rows: string[] = []
  for (const [i, t] of targets.entries()) {
    const c = candidates(t, o, i < asked ? PER_ASKED : PER)
    if (!c) continue
    // 同一个韵只列一次
    const sig = c.words.slice(0, 4).join()
    if (seen.has(sig)) continue
    seen.add(sig)
    rows.push(`${t}（${c.n === 2 ? '双押' : '单押'}）：${c.words.join('、')}`)
  }
  const parts: string[] = []
  if (rows.length) {
    parts.push(
      `网站的找韵工具按读音查到的候选词（${sec.name ? `针对【${sec.name}】各行的句尾` : '针对草稿各行的句尾'}${o.query ? `，以及作者正在查的「${o.query}」` : ''}）。这些词确实押得上，带（宽）的是相近的韵。建议换词时优先从这里挑意思合适的，没有合适的就直说，不要为了押韵硬塞，也不要自己编别的“押韵词”：\n` + rows.join('\n'),
    )
  }
  if (o.liked.length) parts.push(`作者在找韵里标过喜欢的词（可以优先考虑）：${o.liked.slice(-40).join('、')}`)
  return parts.length ? '\n' + parts.join('\n') : ''
}

/** 找韵面板里“让 Claude 用这些词”的问法 */
export const rhymeAskPrompt = (query: string, liked: string[], shown: string[]) =>
  `我在找韵里查了「${query}」。${liked.length ? `我比较喜欢这几个：${liked.join('、')}。` : ''}能押上的还有：${shown.join('、')}。请看看我的草稿里哪几句可以顺着这个韵来改，每处给我一两种写法，说明换完意思有没有变。意思优先，没有合适的地方就直说。`
