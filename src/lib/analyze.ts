// 韵脚检查：给一段词里押上的地方分组（同组同色），并给出密度和提醒。
import { toSyls, type Mode, type Syl } from './rhyme'

const HAN = /[一-鿿]/
const HEADER = /^\s*[[【](.+?)[\]】]\s*$/

export interface LineInfo {
  text: string
  /** 段落标题行，如 [主歌1] */
  header: string | null
  /** 每个字符所属的押韵组，-1 为没押 */
  marks: number[]
  /** 这一行的音节数（汉字 + 估算的英文音节） */
  count: number
  /** 押上的音节占比 */
  density: number
}

export interface Group {
  id: number
  /** 最长押了几个音节 */
  n: number
  /** 组内押韵的词（多押只列最后两个字） */
  words: string[]
  /** 出现次数 */
  times: number
  /** 组里有只在宽押下才成立的成员 */
  loose: boolean
}

export interface Section {
  name: string
  /** 起始行号 */
  start: number
  /** 有词的行数，按一行一小节估算 */
  bars: number
}

export interface Hint {
  line: number
  kind: 'drill' | 'run' | 'none' | 'long'
  text: string
}

export interface Analysis {
  lines: LineInfo[]
  groups: Group[]
  sections: Section[]
  hints: Hint[]
  /** 全文押上的音节占比 */
  density: number
  total: number
}

interface Pos {
  line: number
  /** 行内第几个汉字音节 */
  i: number
  /** 在行文本里的字符下标 */
  col: number
  syl: Syl
  /** 后面紧跟着空格、标点、英文或行尾 */
  phraseEnd: boolean
  lineEnd: boolean
  /** 和前一个汉字是否紧挨着 */
  joined: boolean
}

/** 粗略估算英文音节数：数元音组 */
export function latinSyllables(text: string): number {
  let n = 0
  for (const w of text.match(/[A-Za-z']+/g) ?? []) {
    const g = w.toLowerCase().replace(/e\b/, '').match(/[aeiouy]+/g)
    n += Math.max(1, g ? g.length : 0)
  }
  return n
}

export interface AnalyzeOptions {
  mode: Mode
  /** 每行建议的最多音节数，超过就提醒；0 为不提醒 */
  maxPerLine?: number
  /** 小节时长（秒），用来换算每秒字数 */
  barSeconds?: number
  /** 判断是不是一个真词；提供后，句中的内押只认落在词尾的，减少误标 */
  isWord?: (w: string) => boolean
}

export function analyze(text: string, opt: AnalyzeOptions): Analysis {
  const raw = text.split('\n')
  const lines: LineInfo[] = []
  const rows: Pos[][] = []

  raw.forEach((t, line) => {
    const hm = HEADER.exec(t)
    const chars = [...t]
    const row: Pos[] = []
    if (!hm) {
      const syls = toSyls(t)
      let k = 0
      let col = 0
      chars.forEach((c, ci) => {
        if (HAN.test(c) && syls[k] && syls[k].ch === c) {
          const next = chars[ci + 1]
          const prev = chars[ci - 1]
          row.push({
            line,
            i: k,
            col,
            syl: syls[k],
            phraseEnd: !next || !HAN.test(next),
            lineEnd: false,
            joined: !!prev && HAN.test(prev),
          })
          k++
        }
        col += c.length
      })
      if (row.length) row[row.length - 1].lineEnd = true
    }
    rows.push(row)
    lines.push({
      text: t,
      header: hm ? hm[1].trim() : null,
      marks: new Array(t.length).fill(-1),
      count: hm ? 0 : row.length + latinSyllables(t),
      density: 0,
    })
  })

  const mode = opt.mode
  const WINDOW = 4
  const groups: Group[] = []
  /** 已归组的短语末尾：line:i -> 组 */
  const owner = new Map<string, number>()
  const occ = new Map<number, { line: number; n: number; word: string; strictKey: string }[]>()
  const pk = (p: Pos) => `${p.line}:${p.i}`

  const tail = (row: Pos[], end: number, n: number, m: Mode): string | null => {
    if (end - n + 1 < 0) return null
    for (let j = end - n + 2; j <= end; j++) if (!row[j].joined) return null
    return row.slice(end - n + 1, end + 1).map((p) => p.syl[m]).join('-')
  }
  const mark = (row: Pos[], end: number, n: number, g: number) => {
    const line = row[end].line
    for (let j = end - n + 1; j <= end; j++) {
      const p = row[j]
      for (let c = 0; c < p.syl.ch.length; c++) lines[line].marks[p.col + c] = g
    }
    const word = row.slice(end - n + 1, end + 1).map((p) => p.syl.ch).join('')
    const list = occ.get(g) ?? []
    list.push({ line, n, word, strictKey: tail(row, end, n, 'strict') ?? '' })
    occ.set(g, list)
  }
  const near = (a: number, lineNos: number[]) => lineNos.some((b) => Math.abs(a - b) <= WINDOW)

  // 第一步：短语末尾的多押。先按最后两个音节的韵分组（同组同色），
  // 再看组内每一处最多能往前多押几个音节（三押、四押）。
  const byKey = new Map<string, { row: Pos[]; end: number }[]>()
  for (const row of rows) {
    row.forEach((p, end) => {
      if (!p.phraseEnd) return
      const k = tail(row, end, 2, mode)
      if (!k) return
      const list = byKey.get(k) ?? []
      list.push({ row, end })
      byKey.set(k, list)
    })
  }
  for (const list of byKey.values()) {
    if (list.length < 2) continue
    const lineNos = list.map((o) => o.row[o.end].line)
    const members = list.filter((_o, idx) => near(lineNos[idx], lineNos.filter((_, j) => j !== idx)))
    if (members.length < 2) continue
    const g = groups.length
    groups.push({ id: g, n: 2, words: [], times: 0, loose: false })
    for (const o of members) {
      let n = 2
      for (let k = 4; k > 2; k--) {
        const mine = tail(o.row, o.end, k, mode)
        if (mine && members.some((x) => x !== o && tail(x.row, x.end, k, mode) === mine)) {
          n = k
          break
        }
      }
      groups[g].n = Math.max(groups[g].n, n)
      owner.set(pk(o.row[o.end]), g)
      mark(o.row, o.end, n, g)
    }
  }

  // 第二步：行尾的单押（也可以并进已有的多押组）
  const ends = rows.map((row) => (row.length ? row[row.length - 1] : null))
  ends.forEach((p, ln) => {
    if (!p || owner.has(pk(p))) return
    const cls = p.syl[mode]
    let g = -1
    let found = false
    for (let d = -2; d <= 2; d++) {
      const q = ends[ln + d]
      if (!q || d === 0 || q.syl[mode] !== cls) continue
      found = true
      if (owner.has(pk(q))) g = owner.get(pk(q))!
    }
    if (!found) return
    if (g < 0) {
      g = groups.length
      groups.push({ id: g, n: 1, words: [], times: 0, loose: false })
    }
    owner.set(pk(p), g)
    mark(rows[ln], rows[ln].length - 1, 1, g)
  })

  // 第三步：句中的内押，只认和已有多押组最后两个音节完全相同的韵
  for (const g of [...groups]) {
    if (g.n < 2) continue
    const members = occ.get(g.id) ?? []
    if (!members.length) continue
    const key = toSyls(members[0].word).slice(-2).map((s) => s[mode]).join('-')
    const lineNos = members.map((m) => m.line)
    for (const row of rows) {
      row.forEach((p, end) => {
        if (p.phraseEnd || !near(p.line, lineNos)) return
        if (tail(row, end, 2, mode) !== key) return
        if (lines[p.line].marks[row[end].col] !== -1 || lines[p.line].marks[row[end - 1].col] !== -1) return
        if (opt.isWord) {
          const at = (k: number) => (tail(row, end, k, mode) ? row.slice(end - k + 1, end + 1).map((x) => x.syl.ch).join('') : '')
          if (![2, 3, 4].some((k) => at(k) && opt.isWord!(at(k)))) return
        }
        mark(row, end, 2, g.id)
      })
    }
  }

  for (const g of groups) {
    const members = occ.get(g.id) ?? []
    g.times = members.length
    // 列表里只显示核心的两个字，和韵脚检查视频的习惯一致
    g.words = [...new Set(members.map((m) => [...m.word].slice(-2).join('')))]
    const keys = members.filter((m) => m.n >= Math.min(2, g.n)).map((m) => m.strictKey.split('-').slice(-Math.min(2, g.n)).join('-'))
    g.loose = new Set(keys).size > 1
  }

  // 密度
  let marked = 0
  let total = 0
  lines.forEach((l, ln) => {
    const row = rows[ln]
    const m = row.filter((p) => l.marks[p.col] !== -1).length
    l.density = row.length ? m / row.length : 0
    marked += m
    total += row.length
  })

  // 段落
  const sections: Section[] = []
  let cur: Section | null = null
  lines.forEach((l, ln) => {
    if (l.header) {
      cur = { name: l.header, start: ln, bars: 0 }
      sections.push(cur)
    } else if (l.count > 0) {
      if (!cur) {
        cur = { name: '未命名段落', start: ln, bars: 0 }
        sections.push(cur)
      }
      cur.bars++
    }
  })

  // 提醒
  const hints: Hint[] = []
  const endGroup = ends.map((p) => (p && owner.has(pk(p)) ? owner.get(pk(p))! : -1))
  let runStart = 0
  for (let ln = 1; ln <= lines.length; ln++) {
    const same = ln < lines.length && endGroup[ln] !== -1 && endGroup[ln] === endGroup[runStart]
    if (same) continue
    const len = ln - runStart
    if (endGroup[runStart] !== -1 && len >= 4) {
      const counts = lines.slice(runStart, ln).map((l) => l.count)
      const flat = Math.max(...counts) - Math.min(...counts) <= 1
      if (flat) {
        hints.push({
          line: runStart,
          kind: 'drill',
          text: `第 ${runStart + 1}-${ln} 行句尾是同一个韵，字数也几乎一样，容易像数来宝。可以把其中一句的韵挪到句中，或者改一句的长短。`,
        })
      } else if (len > 8) {
        hints.push({
          line: runStart,
          kind: 'run',
          text: `第 ${runStart + 1}-${ln} 行一直是同一个韵（${len} 行）。一般 4 或 8 行换一次韵会更有层次。`,
        })
      }
    }
    runStart = ln
  }
  let bare = 0
  lines.forEach((l, ln) => {
    if (l.count > 0 && endGroup[ln] === -1 && l.density === 0) bare++
    else {
      if (bare >= 4) hints.push({ line: ln - bare, kind: 'none', text: `第 ${ln - bare + 1}-${ln} 行没有押上的地方。如果是有意为之可以忽略。` })
      if (l.count > 0) bare = 0
    }
  })
  if (bare >= 4) hints.push({ line: lines.length - bare, kind: 'none', text: `最后 ${bare} 行没有押上的地方。如果是有意为之可以忽略。` })
  if (opt.maxPerLine) {
    lines.forEach((l, ln) => {
      if (l.count > opt.maxPerLine!) {
        const cps = opt.barSeconds ? `，按一行一小节算是每秒 ${(l.count / opt.barSeconds).toFixed(1)} 个字` : ''
        hints.push({ line: ln, kind: 'long', text: `第 ${ln + 1} 行有 ${l.count} 个字${cps}，这里可能唱不顺。可以拆成两行或删几个字。` })
      }
    })
  }
  hints.sort((a, b) => a.line - b.line)

  return { lines, groups: groups.filter((g) => g.times > 0), sections, hints, density: total ? marked / total : 0, total }
}
