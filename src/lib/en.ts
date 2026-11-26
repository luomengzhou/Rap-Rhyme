// 英文找韵：按读音（CMU 发音词典的音素）比，不看拼写。
// 严格 = 从倒数第 n 个元音起，后面的音完全一样；宽押 = 只要最后 n 个元音一样，辅音不管（说唱里最常用的押法）。
import type { Mode } from './rhyme'

export interface EnWord {
  w: string
  ph: string[]
  /** 0 常见 / 1 一般 / 2 生僻或人名 */
  tier: number
  /** 在词表里的位置，越小越常用 */
  rank: number
  /** 中文意思，没有就是空 */
  zh: string
}

export interface EnIndex {
  words: Map<string, EnWord>
  /** keys[mode][n-1]：韵 -> 词 */
  strict: Map<string, EnWord[]>[]
  loose: Map<string, EnWord[]>[]
}

const isVowel = (p: string) => /\d$/.test(p)

/** 宽押时合并听起来差不多的元音（后面带 r 的除外）：AO 并进 AA（美音里 song 和 John 的元音很近），不重读的 AH / IH 都当成轻的“呃” */
const looseVowel = (p: string, next?: string) => {
  const v = p.slice(0, -1)
  // 后面跟着 r 的元音听起来是另一个音（car、four），单独算
  if (next === 'R' && (v === 'AA' || v === 'AO')) return v === 'AA' ? 'AR' : 'OR'
  if (v === 'AO') return 'AA'
  if (p.endsWith('0') && (v === 'AH' || v === 'IH')) return 'ə'
  return v
}

/** 一串音素的韵；音节不够 n 个返回 null */
export function enKey(ph: string[], n: number, mode: Mode): string | null {
  const at: number[] = []
  ph.forEach((p, i) => isVowel(p) && at.push(i))
  if (at.length < n) return null
  if (mode === 'loose') return at.slice(-n).map((i) => looseVowel(ph[i], ph[i + 1])).join('-')
  return ph.slice(at[at.length - n]).map((p) => p.replace(/\d/, '')).join(' ')
}

export const syllables = (ph: string[]) => ph.filter(isVowel).length

export function buildEnIndex(raw: string): EnIndex {
  const idx: EnIndex = { words: new Map(), strict: [0, 1, 2, 3].map(() => new Map()), loose: [0, 1, 2, 3].map(() => new Map()) }
  raw.split('\n').forEach((line, rank) => {
    const [w, p, t, zh = ''] = line.split('\t')
    if (!w || !p) return
    const word: EnWord = { w, ph: p.split(' '), tier: Number(t) || 0, rank, zh }
    idx.words.set(w, word)
    for (const mode of ['strict', 'loose'] as const) {
      for (let n = 1; n <= 4; n++) {
        const k = enKey(word.ph, n, mode)
        if (!k) break
        const m = idx[mode][n - 1]
        const list = m.get(k)
        if (list) list.push(word)
        else m.set(k, [word])
      }
    }
  })
  return idx
}

/** 歌词里的口语写法 */
const SPOKEN: Record<string, string> = { em: 'AH0 M', "'em": 'AH0 M', cuz: 'K AH0 Z', "'cause": 'K AH0 Z', cause: 'K AH0 Z', ya: 'Y AH0', tryna: 'T R AY1 N AH0', gonna: 'G AH1 N AH0', wanna: 'W AA1 N AH0', gotta: 'G AA1 T AH0' }

const lookup = (idx: EnIndex, raw: string, extra?: Record<string, string>): string[] | null => {
  const w = raw.toLowerCase().replace(/[’`]/g, "'")
  const bare = w.replace(/^'+|'+$/g, '')
  if (extra?.[bare]) return extra[bare].split(' ')
  if (SPOKEN[w]) return SPOKEN[w].split(' ')
  const hit = idx.words.get(w) ?? idx.words.get(bare)
  if (hit) return hit.ph
  // droppin' / droppin -> dropping，结尾的 NG 读成 N
  if (/in$/.test(bare)) {
    const g = idx.words.get(bare + 'g')
    if (g && g.ph[g.ph.length - 1] === 'NG') return [...g.ph.slice(0, -1), 'N']
  }
  return null
}

export const isEnglish = (q: string) => /[a-z]/i.test(q) && !/[぀-ヿ㐀-鿿가-힯]/.test(q)

/** 一个词或短语的读音；unknown 是词典里没有的词。extra 是自己补的读音（词 -> 音素） */
export function pronounce(idx: EnIndex, text: string, extra?: Record<string, string>): { ph: string[]; unknown: string[] } {
  const ph: string[] = []
  const unknown: string[] = []
  for (const w of text.split(/[^A-Za-z'’`]+/).filter((x) => /[a-z]/i.test(x))) {
    const p = lookup(idx, w, extra)
    if (p) ph.push(...p)
    else unknown.push(w)
  }
  return { ph, unknown }
}

export interface EnHit {
  word: EnWord
  /** 只在宽押时才算押 */
  looseOnly: boolean
}

export interface EnOptions {
  n: number
  mode: Mode
  showRare: boolean
  blocked: Set<string>
  /** 自己补的读音 */
  extra?: Record<string, string>
}

/** 找押韵的词，常用的排前面；宽押模式下严格押的排最前 */
export function findEn(idx: EnIndex, query: string, opt: EnOptions): EnHit[] {
  const { ph, unknown } = pronounce(idx, query, opt.extra)
  if (!ph.length || unknown.length) return []
  const own = new Set(query.toLowerCase().split(/[^a-z']+/))
  const ok = (w: EnWord) => !own.has(w.w) && !opt.blocked.has(w.w) && (opt.showRare || w.tier < 2)
  const sk = enKey(ph, opt.n, 'strict')
  const strict = (sk ? idx.strict[opt.n - 1].get(sk) ?? [] : []).filter(ok)
  const out: EnHit[] = strict.map((word) => ({ word, looseOnly: false }))
  if (opt.mode === 'loose') {
    const lk = enKey(ph, opt.n, 'loose')
    const got = new Set(strict)
    for (const word of lk ? idx.loose[opt.n - 1].get(lk) ?? [] : []) if (ok(word) && !got.has(word)) out.push({ word, looseOnly: true })
  }
  return out.sort((a, b) => Number(a.looseOnly) - Number(b.looseOnly) || a.word.rank - b.word.rank)
}

let cache: Promise<EnIndex> | null = null
/** 第一次查英文时才去拿词表 */
export const loadEn = (base: string) => (cache ??= fetch(base + 'data/en-words.txt').then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status))))).then(buildEnIndex).catch((e) => { cache = null; throw e }))

const VOWELS = ['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW']
const CONS = new Set(['B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K', 'L', 'M', 'N', 'NG', 'P', 'R', 'S', 'SH', 'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH'])

/** 检查一串音素是不是合法的写法（元音要带 0/1/2），合法就整理好返回，否则 null */
export function cleanPhones(raw: string): string | null {
  const ph = raw.trim().toUpperCase().split(/\s+/).filter(Boolean)
  if (!ph.length || ph.length > 40) return null
  const ok = ph.every((p) => CONS.has(p) || (/^[A-Z]{2}[012]$/.test(p) && VOWELS.includes(p.slice(0, 2))))
  return ok && ph.some((p) => /\d$/.test(p)) ? ph.join(' ') : null
}

/** 词典里没有的词，让 Claude 给读音时用的提问 */
export const sayPrompt = (words: string[]) =>
  `给出下面这些英文词（可能是人名、神话里的名字、俚语或生造词）的美式英语读音，用 CMU 发音词典的 ARPAbet 音素写法：音素之间用空格隔开，元音后面带重音数字（1 主重音，2 次重音，0 不重读）。有多种读法时取最通行的一种。\n每个词一行，格式是：词，一个冒号，然后是音素。只输出这些行，不要别的文字。\n例子：\nproblem: P R AA1 B L AH0 M\n\n要读的词：\n${words.join('\n')}`

/** 读 Claude 的回答，只留写法合法的 */
export function parseSaid(text: string, words: string[]): Record<string, string> {
  const want = new Set(words.map((w) => w.toLowerCase()))
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Za-z'’]+)\s*[:：]\s*(.+)$/.exec(line)
    if (!m) continue
    const w = m[1].toLowerCase().replace(/’/g, "'")
    const ph = cleanPhones(m[2])
    if (ph && want.has(w)) out[w.replace(/^'+|'+$/g, '')] = ph
  }
  return out
}
