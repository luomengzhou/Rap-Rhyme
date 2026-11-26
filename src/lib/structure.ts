// 结构提示：把草稿里每一段的小节数和规整的写法比一比。只是参照，不规整不等于不好。
import type { Section } from './analyze'

export type Kind = 'intro' | 'verse' | 'hook' | 'pre' | 'bridge' | 'outro' | 'other'

export const KIND_NAMES: Record<Kind, string> = { intro: '前奏', verse: '主歌', hook: '副歌', pre: '预副歌', bridge: '桥段', outro: '结尾', other: '其他' }

/** 规整写法里每种段落常见的小节数：[最少, 最常见, 最多] */
export const USUAL: Record<Kind, [number, number, number] | null> = {
  intro: [2, 4, 8],
  verse: [12, 16, 16],
  hook: [4, 8, 8],
  pre: [2, 4, 4],
  bridge: [4, 8, 8],
  outro: [2, 4, 8],
  other: null,
}

/** 从段落标题看它是哪种段落 */
export function kindOf(name: string): Kind {
  const n = name.toLowerCase()
  if (/pre|预副|导歌/.test(n)) return 'pre'
  if (/intro|前奏|开场|引子/.test(n)) return 'intro'
  if (/outro|结尾|尾奏|收尾/.test(n)) return 'outro'
  if (/hook|chorus|副歌|refrain/.test(n)) return 'hook'
  if (/bridge|桥|间奏|interlude|break/.test(n)) return 'bridge'
  if (/verse|主歌|^v\s*\d|段/.test(n)) return 'verse'
  return 'other'
}

export interface Judged {
  name: string
  start: number
  bars: number
  kind: Kind
  /** short 偏短，long 偏长，ok 在常见范围里，free 没有可比的 */
  size: 'short' | 'long' | 'ok' | 'free'
  /** 是不是 4 的倍数（规整的歌以 4 小节为一个乐句） */
  even: boolean
  note: string
}

export function judge(sections: Section[]): Judged[] {
  return sections.filter((s) => s.bars > 0).map((s) => {
    const kind = kindOf(s.name)
    const u = USUAL[kind]
    // 前奏、结尾、预副歌两小节一组也很常见
    const even = s.bars % (kind === 'intro' || kind === 'outro' || kind === 'pre' ? 2 : 4) === 0
    const size = !u ? 'free' : s.bars < u[0] ? 'short' : s.bars > u[2] ? 'long' : 'ok'
    let note = ''
    if (u) {
      const usual = `规整的${KIND_NAMES[kind]}一般 ${u[0] === u[2] ? u[1] : `${u[0]}-${u[2]}`} 小节，最常见 ${u[1]}`
      if (size === 'short') note = `偏短。${usual}。${kind === 'verse' ? '想补可以再写 ' + (u[0] - s.bars) + ' 行，或者留空拍让 beat 自己走。' : ''}`
      else if (size === 'long') note = `偏长。${usual}。${kind === 'verse' ? '可以拆成两段，中间插一遍副歌。' : kind === 'hook' ? '副歌太长不容易记住，可以挑最顺口的几句。' : ''}`
      else if (!even) note = `长度在常见范围里，但不是 4 的倍数，会多出或少掉半个乐句。有意为之就没问题。`
      else note = '和规整的写法一致。'
    } else if (!even) note = '不是 4 的倍数。'
    return { name: s.name, start: s.start, bars: s.bars, kind, size, even, note }
  })
}

/** 一句话写出整首的形状，例如“前奏 2 · 主歌 12 · 副歌 8” */
export const shape = (j: Judged[]) => j.map((x) => `${x.kind === 'other' ? x.name : KIND_NAMES[x.kind]} ${x.bars}`).join(' · ')

/** 整体上哪里和规整的歌不一样 */
export function irregular(j: Judged[]): string[] {
  const out: string[] = []
  const verses = j.filter((x) => x.kind === 'verse')
  const hooks = j.filter((x) => x.kind === 'hook')
  if (j.length && !hooks.length) out.push('没有副歌，从头念到尾')
  if (verses.length >= 2 && new Set(verses.map((v) => v.bars)).size > 1) out.push(`几段主歌长短不一样（${verses.map((v) => v.bars).join('、')} 小节）`)
  if (hooks.length >= 2 && new Set(hooks.map((v) => v.bars)).size > 1) out.push('几遍副歌长短不一样')
  const first = j.find((x) => x.kind === 'verse' || x.kind === 'hook')
  if (first?.kind === 'hook' && verses.length) out.push('副歌在主歌前面')
  if (j.some((x) => x.kind !== 'other' && !x.even)) out.push('有的段落不是 4 的倍数')
  if (j.some((x) => x.size === 'long' && x.kind === 'verse')) out.push('有一段主歌特别长')
  if (j.some((x) => x.kind === 'bridge')) out.push('中间有桥段换气氛')
  return out
}

/** 请 Claude 举结构相近的歌 */
export const similarPrompt = (j: Judged[]) =>
  `我这首现在的结构是：${shape(j)}（数字是小节数，一行词算一小节）。${irregular(j).length ? '和规整的歌不一样的地方：' + irregular(j).join('；') + '。' : '基本是规整的结构。'}\n请举 3 到 5 首结构和它相近的真实存在的说唱歌曲，中文、英文、韩文都可以，让我去听它们是怎么处理的。每首说明：哪里像（用上面这些特点来说），听的时候留意什么。你是凭记忆说的，记不清段落长短的地方要直说“不确定”，不要编小节数。最后说一句：照现在这样不改也成立的理由，和如果想改得规整一点最省事的改法，让我自己选。`
