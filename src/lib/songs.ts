// 一首歌 = 一份正在写的稿子 + 定稿过的版本 + 备份。
// 版本是自己点“定稿”才有的（像提交一次）；备份只是怕丢，不算版本。

export interface Snapshot {
  /** 存下来的时间（毫秒） */
  at: number
  text: string
  /** 自动存的备份 */
  auto?: boolean
}

export interface Draft {
  id: string
  title: string
  /** 正在写的稿子，每次改动都自动保存 */
  text: string
  /** 定稿过的版本，第一个是 V1 */
  versions?: Snapshot[]
  /** 备份，新的在后面 */
  backups?: Snapshot[]
}

export const MAX_BACKUPS = 30
/** 自动备份最短隔多久存一次 */
export const AUTO_EVERY = 10 * 60 * 1000

const SUFFIX = /(?:\s*[（(]改后[）)])+$/
/** 去掉旧版本里“存为新草稿”加上的（改后）后缀 */
export const baseTitle = (title: string) => title.replace(SUFFIX, '').trim()

/** 把现在的稿子定成一个新版本。和上一个版本一模一样、或者是空的时候不重复存 */
export function commitVersion(d: Draft, at: number): Draft {
  const vs = d.versions ?? []
  if (!d.text.trim() || vs[vs.length - 1]?.text === d.text) return d
  return { ...d, versions: [...vs, { at, text: d.text }] }
}

/** 存一份备份。和最近一份备份一样时不重复存；太多时先丢最旧的自动备份 */
export function addBackup(d: Draft, at: number, auto = false, text = d.text): Draft {
  const bs = d.backups ?? []
  if (!text.trim() || bs[bs.length - 1]?.text === text) return d
  let next = [...bs, { at, text, ...(auto ? { auto: true } : {}) }]
  while (next.length > MAX_BACKUPS) {
    const i = next.findIndex((b) => b.auto)
    next = next.filter((_, k) => k !== (i < 0 ? 0 : i))
  }
  return { ...d, backups: next }
}

/** 该不该自动备份一次：稿子不空、和最近的备份不同、而且离上次备份够久了 */
export function dueForAuto(d: Draft, now: number): boolean {
  const last = (d.backups ?? [])[(d.backups ?? []).length - 1]
  return !!d.text.trim() && last?.text !== d.text && now - (last?.at ?? 0) >= AUTO_EVERY
}

/** 把稿子换成另一份内容（恢复旧版本、采用改后稿）。换之前先把现在的备份下来 */
export function replaceText(d: Draft, text: string, at: number): Draft {
  if (text === d.text) return d
  return { ...addBackup(d, at), text }
}

/** 现在的稿子相对最新版本的状态 */
export function status(d: Draft): string {
  const n = d.versions?.length ?? 0
  if (!n) return '还没有定稿过'
  return d.versions![n - 1].text === d.text ? `和 V${n} 一样` : `V${n} 之后改过`
}

/**
 * 把旧版本里的「败犬」「败犬（改后）」「败犬（改后）（改后）」收成同一首歌：
 * 前面几份依次变成 V1、V2…，最后一份是正在写的稿子。
 * 返回新的列表，以及每个旧编号现在对应哪首歌。
 */
export function mergeRevised(drafts: Draft[]): { drafts: Draft[]; moved: Record<string, string> } {
  const depth = (t: string) => (t.match(/改后/g) ?? []).length
  const families = new Map<string, Draft[]>()
  for (const d of drafts) {
    const key = baseTitle(d.title)
    families.set(key, [...(families.get(key) ?? []), d])
  }
  const out: Draft[] = []
  const moved: Record<string, string> = {}
  const done = new Set<string>()
  for (const d of drafts) {
    const key = baseTitle(d.title)
    if (done.has(key)) continue
    const fam = families.get(key)!
    // 只有一份，或者没有哪份带（改后），就不动
    if (fam.length < 2 || !fam.some((x) => SUFFIX.test(x.title))) {
      out.push(d)
      continue
    }
    done.add(key)
    const chain = fam.map((x, i) => ({ x, i })).sort((a, b) => depth(a.x.title) - depth(b.x.title) || a.i - b.i).map((o) => o.x)
    const last = chain[chain.length - 1]
    const versions: Snapshot[] = []
    const backups: Snapshot[] = []
    chain.forEach((x, i) => {
      versions.push(...(x.versions ?? []))
      backups.push(...(x.backups ?? []))
      if (i < chain.length - 1 && x.text.trim() && versions[versions.length - 1]?.text !== x.text) versions.push({ at: 0, text: x.text })
      moved[x.id] = last.id
    })
    out.push({ id: last.id, title: key || '未命名', text: last.text, versions, backups: backups.slice(-MAX_BACKUPS) })
  }
  return { drafts: out, moved }
}

/** 时间写成“11月26日 08:30”；旧草稿迁移过来的没有时间 */
export function when(at: number): string {
  if (!at) return '以前存的'
  const d = new Date(at)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`
}
