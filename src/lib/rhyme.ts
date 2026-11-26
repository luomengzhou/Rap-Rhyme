// 中文押韵引擎：把拼音拆成“韵”，按最后 N 个音节的韵是否相同来判断 N 押。
// 严格模式比较“主要元音 + 韵尾”，忽略 i/u/ü 介音（一万 / 吸管 / 比惨 算同押）；
// 例外是 ian / üan，介音把元音带成了另一个音，和 an / uan 分开。
// 宽押模式再合并相近的韵（in/ing、en/eng、e/o 等）；多押另有一档近押，前面的字只比元音。
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
  /** 近押用的元音类：去掉鼻音韵尾 */
  near: string
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

// 严格韵类 -> 宽押韵类
const LOOSE: Record<string, string> = {
  o: 'e', e: 'e',
  // i 和 ü 算近韵；zhi/chi/shi 的 i 和 er 听起来差得远，不并
  i: 'i', v: 'i',
  // 前后鼻音各自合并：in/ing/ün 一组，en/eng 一组。两组之间（心 / 风）听起来不像一个韵，不再并在一起
  in: 'in', ing: 'in', vn: 'in',
  en: 'en', eng: 'en',
  // 传统十三辙里 an / ian / uan / üan 同属一辙
  ian: 'an',
}

// 近押：前面的字只对主要元音，鼻音韵尾不管（中 ong / 古 u，心 in / 西 i）。
// 说唱里多押常常只有最后一个字押得实，前面靠元音带过去。
const NEAR: Record<string, string> = {
  an: 'a', ang: 'a', ian: 'ie',
  en: 'e', eng: 'e', o: 'e',
  in: 'i', ing: 'i', vn: 'i', v: 'i', 'i*': 'i',
  ong: 'u',
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
  return { ch, py, tone, strict, loose, near: NEAR[strict] ?? loose }
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

/** 近押的键：最后一个字按宽押比，前面的字只比元音 */
export function nearKey(syls: Syl[], n: number): string | null {
  if (syls.length < n) return null
  return syls
    .slice(-n)
    .map((s, i) => (i === n - 1 ? s.loose : s.near))
    .join('-')
}

// 词表按词频分级，有些口语里很常见的词被排进了生僻。这里手动提上来。
const COMMON = new Set(['尼古丁'])

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
    words.push({ w, syls, tier: COMMON.has(w) ? 1 : Number(tier), rank: idx })
    for (const mode of ['strict', 'loose'] as const) {
      for (let n = 1; n <= syls.length; n++) {
        const k = `${mode}:${n}:${tailKey(syls, n, mode)}`
        let arr = map.get(k)
        if (!arr) map.set(k, (arr = []))
        arr.push(idx)
      }
    }
    for (let n = 2; n <= syls.length; n++) {
      const k = `near:${n}:${nearKey(syls, n)}`
      let arr = map.get(k)
      if (!arr) map.set(k, (arr = []))
      arr.push(idx)
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
  /** 只有最后一个字押得实，前面的字只对上了元音 */
  near?: boolean
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
  const ok = (word: Word) => {
    if (word.w === query || word.w.endsWith(qTail)) return false // 同字不算押韵
    if (!opt.showRare && word.tier === 2) return false
    if (opt.length && word.syls.length !== opt.length) return false
    if (opt.sameTone && word.syls[word.syls.length - 1].tone !== lastTone) return false
    return !opt.blocked?.has(word.w)
  }
  const seen = new Set<number>()
  for (const id of ids) {
    const word = index.words[id]
    if (!ok(word)) continue
    seen.add(id)
    hits.push({ word, looseOnly: tailKey(word.syls, opt.n, 'strict') !== strictKey })
  }
  // 宽押下再补上近押：最后一个字押上，前面的字只对元音（中心 / 尼古丁）
  if (opt.mode === 'loose' && opt.n >= 2) {
    for (const id of index.map.get(`near:${opt.n}:${nearKey(q, opt.n)}`) ?? []) {
      const word = index.words[id]
      if (seen.has(id) || !ok(word)) continue
      hits.push({ word, looseOnly: true, near: true })
    }
  }
  // 严格押在最前，然后是宽押，最后是近押；同一档里按常见度
  hits.sort((a, b) => Number(!!a.near) - Number(!!b.near) || Number(a.looseOnly) - Number(b.looseOnly) || a.word.rank - b.word.rank)
  return opt.limit ? hits.slice(0, opt.limit) : hits
}

/** 每种“几押”各有多少个结果，用于界面上的计数 */
export function countRhymes(index: RhymeIndex, query: string, opt: Omit<FindOptions, 'n'>): number[] {
  return [1, 2, 3, 4].map((n) => findRhymes(index, query, { ...opt, n }).length)
}
