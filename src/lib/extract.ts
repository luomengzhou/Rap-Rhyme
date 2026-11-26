// 从一段贴进来的歌词里自动找出押在一起的词，作为韵脚本的候选。只给候选，要不要记由作者决定。
import { analyze } from './analyze'
import { enKey, pronounce, syllables, type EnIndex } from './en'
import type { Mode } from './rhyme'

export interface Found {
  /** 押在一起的词 */
  items: string[]
  /** 几押（英文里是押了几个元音） */
  n: number
  lang: 'zh' | 'en'
}

// 太常见的小词，出现在句中时不当韵脚
const STOP = new Set('a an the and or but so to of in on at for with from by is am are was were be been it its i im you your he she we they me my him her his them us our this that these those not no do does did dont have has had just as if then than too very can will would could should there here what when who how all up out'.split(' '))
const WINDOW = 4

interface Tok {
  w: string
  line: number
  end: boolean
  ph: string[]
}

function english(text: string, idx: EnIndex, extra?: Record<string, string>): Found[] {
  const toks: Tok[] = []
  text.split('\n').forEach((raw, line) => {
    const words = raw.replace(/[（(][^）)]*[）)]/g, ' ').toLowerCase().match(/[a-z][a-z']*/g) ?? []
    words.forEach((w0, i) => {
      const w = w0.replace(/^'+|'+$/g, '')
      const p = w ? pronounce(idx, w, extra) : null
      if (p && p.ph.length && !p.unknown.length) toks.push({ w, line, end: i === words.length - 1, ph: p.ph })
    })
  })
  // 最后一个元音原样比（不把轻读的 AH 和 IH 混在一起），免得 bottle 和 walking 被算成一组
  const lastVowel = (ph: string[]) => [...ph].reverse().find((x) => /\d$/.test(x))?.replace(/\d/, '') ?? ''
  const collect = (n: number, mode: Mode, pick: (t: Tok) => boolean) => {
    const by = new Map<string, Tok[]>()
    for (const t of toks) {
      if (!pick(t)) continue
      const base = enKey(t.ph, n, mode)
      const k = base && mode === 'loose' ? `${base}|${lastVowel(t.ph)}` : base
      if (k) by.set(k, [...(by.get(k) ?? []), t])
    }
    const out: Tok[][] = []
    for (const list of by.values()) {
      // 留下附近几行内有同韵词的，而且这一组里至少有一个在句尾
      const near = list.filter((t) => list.some((o) => o.w !== t.w && Math.abs(o.line - t.line) <= WINDOW))
      if (new Set(near.map((t) => t.w)).size >= 2 && near.some((t) => t.end)) out.push(near)
    }
    return out
  }
  const usable = (t: Tok) => t.end || (!STOP.has(t.w.replace(/'/g, '')) && t.w.length >= 3)
  // 先找押两个元音的（比如 gotten / problem / autumn），再找只押最后一个音节的
  const multi = collect(2, 'loose', (t) => syllables(t.ph) >= 2 && usable(t))
  const taken = new Set(multi.flat().map((t) => t.w))
  const single = collect(1, 'strict', (t) => !taken.has(t.w) && usable(t))
  const pack = (groups: Tok[][], n: number): Found[] =>
    groups.map((g) => ({ at: Math.min(...g.map((t) => t.line)), f: { items: [...new Set(g.map((t) => t.w))], n, lang: 'en' as const } })).sort((a, b) => a.at - b.at).map((x) => x.f)
  return [...pack(multi, 2), ...pack(single, 1)]
}

function chinese(text: string, mode: Mode, isWord?: (w: string) => boolean): Found[] {
  // 单押太多太碎，只收双押以上的
  return analyze(text, { mode, isWord }).groups.filter((g) => g.n >= 2 && g.words.length >= 2).map((g) => ({ items: g.words, n: g.n, lang: 'zh' as const }))
}

export interface ExtractOptions {
  mode: Mode
  /** 英文发音词典，没有就只找中文的 */
  en?: EnIndex | null
  extra?: Record<string, string>
  isWord?: (w: string) => boolean
}

/** 找出一段歌词里的韵脚候选：中文的双押以上，英文的按读音 */
export function extractRhymes(text: string, opt: ExtractOptions): Found[] {
  return [...chinese(text, opt.mode, opt.isWord), ...(opt.en ? english(text, opt.en, opt.extra) : [])]
}

/** 请 Claude 找韵脚时用的问法：它能找到跨词的押韵（比如 dropped them / problem），本地的词典做不到 */
export const rhymePrompt = (text: string) =>
  `下面是一段歌词。请找出里面押在一起的词或短语，按韵分组，只列真的押上的（看读音，不看拼写），包括句中押的和几个词连起来押的（例如 dropped them 和 problem）。\n输出格式：每组一行，组内用 / 隔开，至少两个；每个都必须是原文里一字不差出现过的词或短语，尽量短，不要整句；不要编号、解释和其他任何文字。最多 20 组。\n\n歌词：\n<<<\n${text.slice(0, 6000)}\n>>>`

/** 读 Claude 的回答：每行一组，只留原文里真的出现过的 */
export function parseFound(reply: string, text: string): Found[] {
  const low = text.toLowerCase()
  return reply.split('\n').map((l) => l.replace(/^[\s\d.、)\-*]+/, '').split(/\s*[/／]\s*/).map((s) => s.trim()).filter((s) => s && s.length <= 40 && low.includes(s.toLowerCase())))
    .map((items) => [...new Set(items)]).filter((items) => items.length >= 2).slice(0, 20)
    .map((items) => ({ items, n: 0, lang: /[一-鿿]/.test(items[0]) ? ('zh' as const) : ('en' as const) }))
}
