// 改稿：把一组建议应用到草稿上，生成“改后”的版本，原稿不动。
// 建议由外部给出（目前是在对话里生成后导入），格式见 Review。

export interface Edit {
  /** 原稿里的一段文字，匹配时忽略空白和 * 号 */
  find: string
  /** 换成什么；空字符串表示删掉 */
  replace: string
}

export interface Suggestion {
  id: string
  /** 分类，如 押韵 / 结构 / 长度 / 表达 */
  tag: string
  title: string
  reason: string
  /** 一条建议可以包含多处改动（比如把几行挪到别处），一起接受或拒绝 */
  edits: Edit[]
  /** 可选的其他写法，替换第一处改动的 replace */
  options?: string[]
}

export interface Review {
  title: string
  /** 对整首词的理解和总评 */
  summary?: string
  /** 不涉及改词的备注，如可以去听的歌 */
  notes?: { title: string; body: string }[]
  suggestions: Suggestion[]
}

export interface Span {
  start: number
  end: number
}

const SKIP = /[\s*]/
// 全角和半角标点当成同一个字符，免得因为输入法不同而对不上
const SAME: Record<string, string> = { '？': '?', '，': ',', '！': '!', '’': "'", '‘': "'", '：': ':', '；': ';', '（': '(', '）': ')' }
const norm = (c: string) => SAME[c] ?? c.toLowerCase()

/** 在原稿里找一段文字，忽略空白和 * 号；找不到返回 null */
export function locate(text: string, find: string): Span | null {
  const needle = [...find].filter((c) => !SKIP.test(c)).map(norm).join('')
  if (!needle) return null
  const map: number[] = []
  let hay = ''
  for (let i = 0; i < text.length; i++) {
    if (SKIP.test(text[i])) continue
    hay += norm(text[i])
    map.push(i)
  }
  const at = hay.indexOf(needle)
  if (at < 0) return null
  let start = map[at]
  let end = map[at + needle.length - 1] + 1
  // 把紧贴着的 * 号一起带上，免得留下半截加粗符号
  while (start > 0 && text[start - 1] === '*') start--
  while (end < text.length && text[end] === '*') end++
  return { start, end }
}

export type Status = 'ok' | 'missing' | 'conflict'

export interface Applied {
  text: string
  /** 每条建议的状态：能应用 / 原文找不到 / 和前面接受的建议改到同一处 */
  status: Record<string, Status>
}

/**
 * 把接受的建议应用到原稿。choice 记录每条建议选了哪种写法（-1 或缺省为默认写法）。
 */
export function applyReview(text: string, review: Review, accepted: Set<string>, choice: Record<string, number> = {}): Applied {
  const status: Record<string, Status> = {}
  const planned: { span: Span; replace: string }[] = []
  for (const s of review.suggestions) {
    // find 为空表示加在草稿末尾（草稿还没内容时用来写入提纲）
    const spans = s.edits.map((e) => (e.find.trim() ? locate(text, e.find) : { start: text.length, end: text.length }))
    if (!s.edits.length || spans.some((x) => !x)) {
      status[s.id] = 'missing'
      continue
    }
    status[s.id] = 'ok'
    if (!accepted.has(s.id)) continue
    const mine = s.edits.map((e, i) => {
      const alt = i === 0 && s.options && choice[s.id] >= 0 ? s.options[choice[s.id]] : undefined
      const rep = alt ?? e.replace
      return { span: spans[i]!, replace: e.find.trim() || !text.trim() ? rep : '\n\n' + rep.replace(/^\n+/, '') }
    })
    const clash = mine.some((m) => planned.some((p) => m.span.start < p.span.end && p.span.start < m.span.end))
    if (clash) {
      status[s.id] = 'conflict'
      continue
    }
    planned.push(...mine)
  }
  planned.sort((a, b) => b.span.start - a.span.start)
  let out = text
  for (const { span, replace } of planned) {
    let { start, end } = span
    if (replace === '') {
      // 整行删除时把换行也带走，不留空行
      const lineStart = start === 0 || out[start - 1] === '\n'
      if (lineStart && out[end] === '\n') end++
      else if (lineStart && end === out.length && start > 0) start--
    } else if (replace.startsWith('\n')) {
      // 在句中断行时，不在上一行末尾留空格
      while (start > 0 && out[start - 1] === ' ') start--
    }
    out = out.slice(0, start) + replace + out.slice(end)
  }
  return { text: out.replace(/\n{3,}/g, '\n\n'), status }
}

export interface Row {
  kind: 'same' | 'changed' | 'removed' | 'added'
  left: string | null
  right: string | null
}

/** 按行对比，输出左右对齐的行，给分屏用 */
export function diffLines(a: string, b: string): Row[] {
  const x = a.split('\n')
  const y = b.split('\n')
  const n = x.length
  const m = y.length
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  const rows: Row[] = []
  let i = 0
  let j = 0
  let dels: string[] = []
  let adds: string[] = []
  // 只有长得像的两行才并排算“改动”，否则分别算删掉和新增（比如整段挪走）
  const alike = (l: string, r: string) => {
    let p = 0
    while (p < l.length && p < r.length && l[p] === r[p]) p++
    let q = 0
    while (q < l.length - p && q < r.length - p && l[l.length - 1 - q] === r[r.length - 1 - q]) q++
    return (p + q) * 2 >= Math.min(l.length, r.length)
  }
  const flush = () => {
    let d = 0
    let a = 0
    while (d < dels.length || a < adds.length) {
      const l = dels[d]
      const r = adds[a]
      if (l !== undefined && r !== undefined && alike(l, r)) {
        rows.push({ kind: 'changed', left: l, right: r })
        d++
        a++
      } else if (l !== undefined && (r === undefined || !adds.slice(a).some((x) => alike(l, x)))) {
        rows.push({ kind: 'removed', left: l, right: null })
        d++
      } else {
        rows.push({ kind: 'added', left: null, right: r })
        a++
      }
    }
    dels = []
    adds = []
  }
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) {
      flush()
      rows.push({ kind: 'same', left: x[i], right: y[j] })
      i++
      j++
    } else if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) adds.push(y[j++])
    else dels.push(x[i++])
  }
  flush()
  return rows
}

/** 校验导入的建议文件；格式不对时抛出带说明的错误 */
export function parseReview(raw: string): Review {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('这不是有效的建议文件（JSON 解析失败）。')
  }
  const r = data as Partial<Review>
  if (!r || typeof r.title !== 'string' || !Array.isArray(r.suggestions)) throw new Error('建议文件缺少标题或建议列表。')
  const suggestions = r.suggestions.map((s, i) => {
    if (!s || typeof s.title !== 'string' || !Array.isArray(s.edits)) throw new Error(`第 ${i + 1} 条建议格式不对。`)
    return {
      id: typeof s.id === 'string' ? s.id : `s${i + 1}`,
      tag: typeof s.tag === 'string' ? s.tag : '建议',
      title: s.title,
      reason: typeof s.reason === 'string' ? s.reason : '',
      edits: s.edits.filter((e) => e && typeof e.find === 'string' && typeof e.replace === 'string'),
      options: Array.isArray(s.options) ? s.options.filter((o) => typeof o === 'string') : undefined,
    }
  })
  return {
    title: r.title,
    summary: typeof r.summary === 'string' ? r.summary : undefined,
    notes: Array.isArray(r.notes) ? r.notes.filter((n) => n && typeof n.title === 'string' && typeof n.body === 'string') : undefined,
    suggestions,
  }
}
