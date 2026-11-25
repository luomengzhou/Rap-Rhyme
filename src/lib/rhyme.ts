// 中文押韵引擎：把拼音拆成“韵”，按最后 N 个音节的韵是否相同来判断 N 押。
// 严格模式比较“主要元音 + 韵尾”，忽略 i/u/ü 介音（一万 / 吸管 / 比惨 算同押）；
// 例外是 ian / üan，介音把元音带成了另一个音，和 an / uan 分开。
// 宽押模式再按十三辙的习惯合并相近的韵（en/eng、in/ing、e/o 等）。
import { pinyin } from 'pinyin-pro'

export interface Syl {
  /** 原字 */
  ch: string
  /** 不带声调的拼音，ü 写作 v */
  py: string
  /** 声调 1-4，轻声为 0 */
  tone: number
  /** 严格韵类 */
  strict: string
  /** 宽押韵类 */
  loose: string
}

const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's']

// 完整韵母 -> 严格韵类
const STRICT: Record<string, string> = {
  a: 'a', ia: 'a', ua: 'a',
  o: 'o', uo: 'o',
  e: 'e',
  ie: 'ie', ve: 'ie',
  i: 'i', er: 'er', u: 'u', v: 'v',
  ai: 'ai', uai: 'ai',
  ei: 'ei', uei: 'ei',
  ao: 'ao', iao: 'ao',
  ou: 'ou', iou: 'ou',
  // ian、üan 的元音实际读成偏“诶”的音（见、全），和 an、uan（看、喘）听起来不是一个韵
  an: 'an', uan: 'an', ian: 'ian', van: 'ian',
  en: 'en', uen: 'en', in: 'in', vn: 'vn',
  ang: 'ang', iang: 'ang', uang: 'ang',
  eng: 'eng', ueng: 'eng', ing: 'ing',
  ong: 'ong', iong: 'ong',
}

// 严格韵类 -> 宽押韵类（十三辙式合并）
const LOOSE: Record<string, string> = {
  o: 'e', e: 'e',
  i: 'i', 'i*': 'i', v: 'i', er: 'i',
  en: 'en', in: 'en', vn: 'en', eng: 'en', ing: 'en',
  ong: 'ong',
  // 传统十三辙里 an / ian / uan / üan 同属一辙
  ian: 'an',
}

/** 把一个带调拼音（如 cuo4、lv4）拆成韵类 */
export function parsePinyin(raw: string, ch = ''): Syl | null {
  const m = /^([a-zv]+?)([0-5]?)$/.exec(raw.toLowerCase().replace(/ü/g, 'v'))
  if (!m) return null
  const py = m[1]
  const tone = m[2] ? Number(m[2]) % 5 : 0
  let initial = ''
  let fin = py
  if (py[0] === 'y') {
    initial = 'y'
    const r = py.slice(1)
    if (r === 'u') fin = 'v'
    else if (r === 'ue') fin = 've'
    else if (r === 'uan') fin = 'van'
    else if (r === 'un') fin = 'vn'
    else if (r === 'i' || r === 'in' || r === 'ing') fin = r
    else if (r === 'ou') fin = 'iou'
    else if (r === 'e') fin = 'ie'
    else if (r === 'ong') fin = 'iong'
    else fin = 'i' + r // ya yao yan yang
  } else if (py[0] === 'w') {
    initial = 'w'
    const r = py.slice(1)
    if (r === 'u') fin = 'u'
    else if (r === 'ei') fin = 'uei'
    else if (r === 'en') fin = 'uen'
    else if (r === 'eng') fin = 'ueng'
    else fin = 'u' + r // wa wo wai wan wang
  } else {
    for (const ini of INITIALS) {
      if (py.startsWith(ini) && py.length > ini.length) {
        initial = ini
        fin = py.slice(ini.length)
        break
      }
    }
    if ('jqx'.includes(initial) && fin[0] === 'u') fin = 'v' + fin.slice(1)
    if (fin === 'iu') fin = 'iou'
    else if (fin === 'ui') fin = 'uei'
    else if (fin === 'un') fin = 'uen'
    else if (fin === 'ue') fin = 've'
    else if (fin === 'o' && 'bpmf'.includes(initial)) fin = 'uo'
  }
  let strict = STRICT[fin]
  if (!strict) return null
  // zhi chi shi ri zi ci si 的 i 是舌尖元音，和 “一” 的 i 听感不同
  if (fin === 'i' && ['zh', 'ch', 'sh', 'r', 'z', 'c', 's'].includes(initial)) strict = 'i*'
  const loose = LOOSE[strict] ?? strict
  return { ch, py, tone, strict, loose }
}

const HAN = /[一-鿿]/

/** 给一段中文注音，非汉字会被跳过 */
export function toSyls(text: string): Syl[] {
  const chars = [...text].filter((c) => HAN.test(c))
  if (!chars.length) return []
  const pys = pinyin(chars.join(''), { toneType: 'num', type: 'array', v: true })
  const out: Syl[] = []
  chars.forEach((c, i) => {
    const s = parsePinyin(pys[i] ?? '', c)
    if (s) out.push(s)
  })
  return out
}

export type Mode = 'strict' | 'loose'

/** 最后 n 个音节的韵，拼成一个键；音节不够返回 null */
export function tailKey(syls: Syl[], n: number, mode: Mode): string | null {
  if (syls.length < n) return null
  return syls
    .slice(-n)
    .map((s) => s[mode])
    .join('-')
}

export interface Word {
  w: string
  syls: Syl[]
  /** 0 常见 / 1 一般 / 2 生僻 */
  tier: number
  /** 词表里的顺序，越小越常见 */
  rank: number
}

export interface RhymeIndex {
  words: Word[]
  /** mode:n:key -> 词的下标 */
  map: Map<string, number[]>
  /** 词表里所有的词，用来判断“是不是词” */
  set: Set<string>
}

/** 解析 zh-words.txt 并建立索引 */
export function buildIndex(raw: string): RhymeIndex {
  const words: Word[] = []
  const map = new Map<string, number[]>()
  for (const line of raw.split('\n')) {
    const [w, py, tier] = line.split('\t')
    if (!w || !py) continue
    const chars = [...w]
    const parts = py.split(' ')
    const syls: Syl[] = []
    for (let i = 0; i < parts.length; i++) {
      const s = parsePinyin(parts[i], chars[i])
      if (s) syls.push(s)
    }
    if (syls.length !== chars.length) continue
    const idx = words.length
    words.push({ w, syls, tier: Number(tier), rank: idx })
    for (const mode of ['strict', 'loose'] as const) {
      for (let n = 1; n <= syls.length; n++) {
        const k = `${mode}:${n}:${tailKey(syls, n, mode)}`
        let arr = map.get(k)
        if (!arr) map.set(k, (arr = []))
        arr.push(idx)
      }
    }
  }
  return { words, map, set: new Set(words.map((w) => w.w)) }
}

export interface FindOptions {
  /** 几押：1-4 */
  n: number
  mode: Mode
  /** 是否显示生僻词 */
  showRare?: boolean
  /** 末字声调必须相同 */
  sameTone?: boolean
  /** 只要这个字数的词，0 为不限 */
  length?: number
  /** 被用户标记为“不押 / 不是词”的词 */
  blocked?: Set<string>
  limit?: number
}

export interface Hit {
  word: Word
  /** 这个结果只有在宽押下才成立 */
  looseOnly: boolean
}

/** 找和 query 最后 n 个音节押韵的词 */
export function findRhymes(index: RhymeIndex, query: string, opt: FindOptions): Hit[] {
  const q = toSyls(query)
  const key = tailKey(q, opt.n, opt.mode)
  if (!key) return []
  const strictKey = tailKey(q, opt.n, 'strict')
  const ids = index.map.get(`${opt.mode}:${opt.n}:${key}`) ?? []
  const qTail = q.slice(-opt.n).map((s) => s.ch).join('')
  const lastTone = q[q.length - 1].tone
  const hits: Hit[] = []
  for (const id of ids) {
    const word = index.words[id]
    if (word.w === query || word.w.endsWith(qTail)) continue // 同字不算押韵
    if (!opt.showRare && word.tier === 2) continue
    if (opt.length && word.syls.length !== opt.length) continue
    if (opt.sameTone && word.syls[word.syls.length - 1].tone !== lastTone) continue
    if (opt.blocked?.has(word.w)) continue
    hits.push({ word, looseOnly: tailKey(word.syls, opt.n, 'strict') !== strictKey })
    if (opt.limit && hits.length >= opt.limit) break
  }
  // 严格押的排在宽押前面，其余保持常见度顺序
  return hits.sort((a, b) => Number(a.looseOnly) - Number(b.looseOnly) || a.word.rank - b.word.rank)
}

/** 每种“几押”各有多少个结果，用于界面上的计数 */
export function countRhymes(index: RhymeIndex, query: string, opt: Omit<FindOptions, 'n'>): number[] {
  return [1, 2, 3, 4].map((n) => findRhymes(index, query, { ...opt, n }).length)
}
