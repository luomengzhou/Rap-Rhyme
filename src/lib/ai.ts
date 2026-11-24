// 网站里的 Claude：只有从 claude.ai 上打开这个网站时才可用（用的是看的人自己的 Claude 账号，不需要 API key）。
import type { Suggestion } from './review'

/** Claude 给的一条素材：典故、诗词、神话、意象等 */
export interface Material {
  id: string
  /** 典故 / 诗词 / 神话 / 寓言 / 文学 / 意象 / 说法 / 歌曲 */
  kind: string
  title: string
  /** 出处：作品、作者 */
  source: string
  /** 原文或大意 */
  text: string
  /** 可以怎么用在这首词里 */
  use: string
}

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
- 分段（划分 intro / verse / hook / bridge / outro）：只用一条建议，tag 用“结构”，每个要加的标题是一处 edit，find 是那一段的第一行原文，replace 是 "【标题】\n" 加上这行原文。草稿里已有的标题不要重复加。判断不了哪里是 hook 时直说，并建议哪几句适合抽出来。
- 被问到长短：结合下面给的小节数和估算时长说实话。长短跟着内容走：长的叙事歌可以五六分钟，短的两分钟出头也很常见。说清楚如果加长可以加什么（再唱一遍 hook、补一段 verse、加 bridge），如果不加为什么也成立，让作者自己选。
- 被问到配 beat 或下一步：按顺序给两三步具体能做的事，例如先定速度和气质（网站底部可以换 beat 和 BPM 跟着念）、去“打拍”页把最顺的一句敲出来、再去找一条 type beat 跟着念并录音、念不顺的行回来改。不要一次讲太多。
- 一次最多给 6 条，挑最值得改的。

构思（草稿还空着或只有几行，作者在讲主题时）：
- 先听懂作者要的感觉，用两三句复述你理解的核心情绪和人物关系，不确定就问。不要评判题材，病态、扭曲、卑微的爱都是正当的文学主题；写情欲和臣服时走意象和心理，不写露骨的性描写。
- 不替作者把词写完。你给的是材料：提纲、意象、典故、可以展开的画面、几个可选的说法。
- 作者要典故、故事、诗词、神话、意象时，用素材卡片给出：在回答最后的 \`\`\`json 代码块里加 "materials":[{"kind":"典故","title":"名字","source":"出处：作品和作者","text":"原文或一两句大意","use":"可以怎么化用到这首词里"}]。kind 只用：典故、诗词、神话、寓言、文学、意象、说法、歌曲。一次 4 到 8 条，古今中外都可以，和主题的关系要具体。
- 参考歌曲不限说唱，流行、K-pop、R&B、摇滚里情绪对得上的都可以给，用 kind“歌曲”：source 写歌手，text 用你自己的话写这首歌怎么处理这种情绪（视角、语气、转折），不要引用歌词原文，use 写可以借鉴的手法。作者提到的歌如果你不认识或拿不准，直说不认识，不要猜。
- 素材必须真实存在。只有你确信的原句才当原文写，拿不准就写大意并注明“大意”。绝不编造出处，不给网址（网站会自动加搜索链接，作者自己核对）。
- 作者讲了分段思路、想把提纲写进草稿时，用一条建议给出：tag 用“结构”，edits 里 find 留空字符串（表示加在草稿末尾），replace 是提纲，格式是每段一个【verse 1】这样的标题，标题下一行用圆括号写这一段的主题，例如“（相遇，她像神明一样攫走我全部心智）”，段与段之间空一行。圆括号里是提示，不是歌词。
- suggestions 和 materials 可以放在同一个代码块里，也可以只有其中一个。正文里不用重复代码块的内容，简单说你给了哪几类建议就行。`

/** 组装发给 Claude 的对话：规则和当前草稿放在最前面，后面是页面保存的对话 */
export function buildInput(title: string, draft: string, turns: Turn[], facts = ''): Turn[] {
  const head = `${RULES}\n\n草稿标题：${title || '未命名'}\n${facts ? facts + '\n' : ''}\n当前草稿（带 ** 的词是作者标出的想押的词；圆括号里的行是提纲提示）：\n<<<\n${draft.trim() ? draft.slice(0, 20000) : '（还是空的，作者在构思阶段）'}\n>>>`
  // 只带最近的对话，免得越聊越长
  return [{ role: 'user', content: head }, ...turns.slice(-16)]
}

const FENCE = /```json\s*([\s\S]*?)(```|$)/

/** 把回答拆成给人看的文字和建议 */
export function splitReply(raw: string, stamp = ''): { text: string; suggestions: Suggestion[]; materials: Material[] } {
  const m = FENCE.exec(raw)
  const text = (m ? raw.slice(0, m.index) + raw.slice(m.index + m[0].length) : raw).trim()
  if (!m || !m[2]) return { text, suggestions: [], materials: [] }
  try {
    const data = JSON.parse(m[1]) as { suggestions?: unknown; materials?: unknown }
    const list = Array.isArray(data.suggestions) ? data.suggestions : []
    const suggestions: Suggestion[] = []
    list.forEach((x, i) => {
      const s = x as Partial<Suggestion>
      if (!s || typeof s.title !== 'string' || !Array.isArray(s.edits)) return
      const edits = s.edits.filter((e) => e && typeof e.find === 'string' && typeof e.replace === 'string' && (e.find.trim() || e.replace.trim()))
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
    const str = (v: unknown) => (typeof v === 'string' ? v : '')
    const materials: Material[] = []
    ;(Array.isArray(data.materials) ? data.materials : []).forEach((x, i) => {
      const k = x as Record<string, unknown>
      if (!k || !str(k.title)) return
      materials.push({ id: `m-${stamp}-${i}`, kind: str(k.kind) || '素材', title: str(k.title), source: str(k.source), text: str(k.text), use: str(k.use) })
    })
    return { text, suggestions, materials }
  } catch {
    return { text, suggestions: [], materials: [] }
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
