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
    const [w, p, t] = line.split('\t')
    if (!w || !p) return
    const word: EnWord = { w, ph: p.split(' '), tier: Number(t) || 0, rank }
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

const lookup = (idx: EnIndex, raw: string): string[] | null => {
  const w = raw.toLowerCase().replace(/[’`]/g, "'")
  if (SPOKEN[w]) return SPOKEN[w].split(' ')
  const bare = w.replace(/^'+|'+$/g, '')
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

/** 一个词或短语的读音；unknown 是词典里没有的词 */
export function pronounce(idx: EnIndex, text: string): { ph: string[]; unknown: string[] } {
  const ph: string[] = []
  const unknown: string[] = []
  for (const w of text.split(/[^A-Za-z'’`]+/).filter((x) => /[a-z]/i.test(x))) {
    const p = lookup(idx, w)
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
}

/** 找押韵的词，常用的排前面；宽押模式下严格押的排最前 */
export function findEn(idx: EnIndex, query: string, opt: EnOptions): EnHit[] {
  const { ph, unknown } = pronounce(idx, query)
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
