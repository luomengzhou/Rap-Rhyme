// 网站里的 Claude：只有从 claude.ai 上打开这个网站时才可用（用的是看的人自己的 Claude 账号，不需要 API key）。
import type { Suggestion } from './review'

export interface Turn {
  role: 'user' | 'assistant'
  content: string
}

interface SampleOptions {
  onText?: (u: { text: string }) => void
  signal?: AbortSignal
  cache?: boolean
  modelTier?: 'default' | 'complex' | 'quick'
}
export type Sample = (input: string | Turn[], options?: SampleOptions) => Promise<{ text: string; truncated: boolean }>

interface ClaudeHost {
  use: (name: string) => Promise<unknown>
}

/** 拿到向 Claude 提问的函数；不在 claude.ai 里打开时返回 null */
export async function getSample(): Promise<Sample | null> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude
  if (!host?.use) return null
  try {
    return ((await host.use('sample')) as Sample | null) ?? null
  } catch {
    return null
  }
}

const RULES = `你是一个说唱写词搭档，在一个写词网站的“改稿”页里和作者对话。作者是刚开始写说唱的新手，用中文写词。

原则：
- 表达优先于押韵。绝不为了押韵牺牲意思，不要把词改成数来宝。
- 词是作者的。你给的是选项和理由，不替作者决定；关键词、关键意象倾向保留。
- 换词只用真实、常用的现代汉语词，不用生僻词和生造词。说两个词押韵时要真的押（看主要元音和韵尾），并说明是单押还是双押。
- 字数、长度只做温和提醒，不当成规矩。
- 作者的雷点：不写、不推荐以性、炫富炫名气、物化女性、吸毒为内容的词。作者自己的词里出现这些内容用于讽刺时，照常讨论。推荐参考歌曲时如果歌词踩雷点，要说明只参考手法或节奏。
- 推荐歌曲只说你有把握真实存在的，并提醒作者自己核对。
- 看不懂主题或明线暗线时，直接问作者。

回答方式：
- 用中文，像朋友聊天一样说人话，简短。不要用 Markdown 符号（不要 #、**、列表符号），需要分点就换行。
- 当你有具体的改动建议（换词、断行、挪动或抽出几行）时，在回答的最后附上一个 \`\`\`json 代码块，网站会把它变成可以逐条接受或拒绝的改动，并在左右分屏里显示改前改后。没有具体改动就不要附。
- 代码块的格式：
{"suggestions":[{"tag":"押韵","title":"一句话说改什么","reason":"为什么，会失去什么","edits":[{"find":"原稿里的原文","replace":"换成什么"}],"options":["另一种写法"]}]}
- tag 只用：押韵、结构、长度、表达。
- find 必须是从下面草稿里一字不差抄出来的一段（不要带 * 号），尽量短但要能唯一定位。replace 为空字符串表示删掉。
- 断行：replace 写成 "\\n" 加上原文。挪动几行：一条建议里放两处 edits，一处把原文删掉（replace 为空），一处在目标位置的锚点文字上加上这几行。段落标题沿用草稿里的写法，比如【hook】。
- options 可选，是 edits 里第一处改动的其他写法。
- 一次最多给 6 条，挑最值得改的。正文里不用重复代码块的内容，简单说你给了哪几类建议就行。`

/** 组装发给 Claude 的对话：规则和当前草稿放在最前面，后面是页面保存的对话 */
export function buildInput(title: string, draft: string, turns: Turn[]): Turn[] {
  const head = `${RULES}\n\n草稿标题：${title || '未命名'}\n\n当前草稿（带 ** 的词是作者标出的想押的词）：\n<<<\n${draft.slice(0, 20000)}\n>>>`
  // 只带最近的对话，免得越聊越长
  return [{ role: 'user', content: head }, ...turns.slice(-16)]
}

const FENCE = /```json\s*([\s\S]*?)(```|$)/

/** 把回答拆成给人看的文字和建议 */
export function splitReply(raw: string): { text: string; suggestions: Suggestion[] } {
  const m = FENCE.exec(raw)
  const text = (m ? raw.slice(0, m.index) + raw.slice(m.index + m[0].length) : raw).trim()
  if (!m || !m[2]) return { text, suggestions: [] }
  try {
    const data = JSON.parse(m[1]) as { suggestions?: unknown }
    const list = Array.isArray(data.suggestions) ? data.suggestions : []
    const stamp = Date.now().toString(36)
    const suggestions: Suggestion[] = []
    list.forEach((x, i) => {
      const s = x as Partial<Suggestion>
      if (!s || typeof s.title !== 'string' || !Array.isArray(s.edits)) return
      const edits = s.edits.filter((e) => e && typeof e.find === 'string' && typeof e.replace === 'string' && e.find.trim())
      if (!edits.length) return
      suggestions.push({
        id: `ai-${stamp}-${i}`,
        tag: typeof s.tag === 'string' ? s.tag : '建议',
        title: s.title,
        reason: typeof s.reason === 'string' ? s.reason : '',
        edits,
        options: Array.isArray(s.options) ? s.options.filter((o) => typeof o === 'string') : undefined,
      })
    })
    return { text, suggestions }
  } catch {
    return { text, suggestions: [] }
  }
}

/** 把出错原因说成人话 */
export function errorText(code: string | undefined): string {
  switch (code) {
    case 'not_granted':
      return '你没有允许这个页面使用 Claude，所以没法对话。刷新页面后可以重新选择。'
    case 'rate_limited':
      return '问得太频繁，或者你的 Claude 用量到上限了。等一会儿再试。'
    case 'session_expired':
      return '登录过期了，请重新登录 claude.ai 再打开。'
    case 'refused':
      return 'Claude 没有回答这个问题，换个问法试试。'
    case 'sampling_disabled':
    case 'not_declared':
    case 'capability_disabled':
      return '这个账号在这里用不了 Claude。'
    default:
      return '没连上 Claude，再发一次试试。'
  }
}
