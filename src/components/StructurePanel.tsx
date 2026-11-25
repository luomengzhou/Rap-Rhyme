import type { Analysis } from '../lib/analyze'
import { genreOf } from '../lib/genres'
import { barSeconds, REGULAR_TEMPLATE, type SectionTpl } from '../lib/styles'

interface Props {
  analysis: Analysis
  template: SectionTpl[]
  setTemplate: (t: SectionTpl[]) => void
  bpm: number
  onInsert: () => void
  onJump: (line: number) => void
  beatId: string
  onAsk: (question: string) => void
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

export function StructurePanel({ analysis, template, setTemplate, bpm, onInsert, onJump, beatId, onAsk }: Props) {
  const total = template.reduce((a, s) => a + s.bars, 0)
  const edit = (i: number, patch: Partial<SectionTpl>) => setTemplate(template.map((s, k) => (k === i ? { ...s, ...patch } : s)))
  const move = (i: number, d: number) => {
    const t = [...template]
    const j = i + d
    if (j < 0 || j >= t.length) return
    ;[t[i], t[j]] = [t[j], t[i]]
    setTemplate(t)
  }
  // 草稿里的段落按顺序和模板里同名的段落对照
  const used = new Set<number>()
  const rows = analysis.sections.map((sec) => {
    const k = template.findIndex((t, i) => !used.has(i) && t.name === sec.name)
    if (k >= 0) used.add(k)
    return { sec, plan: k >= 0 ? template[k].bars : null }
  })
  const written = analysis.sections.reduce((a, s) => a + s.bars, 0)

  const named = analysis.sections.filter((x) => x.name !== '未命名段落')
  const hasHook = named.some((x) => /hook|副歌|chorus/i.test(x.name))
  const beatUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(`${genreOf(beatId)?.search ?? 'boom bap'} type beat ${bpm} bpm`)
  const steps: { done: boolean | null; title: string; body: React.ReactNode }[] = [
    { done: written >= 12, title: '先把想说的写出来', body: `不用管长短和押韵，写到十几行再说。现在 ${written} 行。` },
    {
      done: named.length >= 2 && hasHook,
      title: '分段，定下 hook',
      body: (
        <>
          {named.length < 2 ? '草稿还没有分段。' : hasHook ? '已经分好段了。' : '有分段，但还没有 hook。'}
          <button className="link" onClick={() => onAsk('帮我把这份草稿分成 intro / verse / hook / outro。如果没有明显的 hook，告诉我哪几句适合抽出来。')}>让 Claude 帮我分段</button>
        </>
      ),
    },
    { done: null, title: '定速度和气质', body: '在最下面换几种 beat、拖一拖 BPM，跟着念开头四句。哪个念起来最像你想要的语气，就先用哪个。' },
    { done: null, title: '把最顺的一句敲出来', body: '去“打拍”页，用空格把这句的节奏敲一遍。其他句子往这个节奏上靠，就是你的 flow。' },
    {
      done: null,
      title: '找一条真正的 beat 跟着念',
      body: (
        <>
          按现在的气质和速度搜 type beat：
          <a href={beatUrl} target="_blank" rel="noreferrer">在 YouTube 上搜</a>
          。只是自己练和发着玩，选标了 free 的就行，正式发行前要看作者的授权说明。
        </>
      ),
    },
    { done: null, title: '录一遍，回来改词', body: '手机录音就够。念不过来的行多半是字太多，回到“检查”看标红的行；空得发慌的地方可以加词或者留白。' },
  ]
  const at = steps.findIndex((x) => x.done === false)
  const now = at >= 0 ? at : 2
  const perMin = 60 / barSeconds(bpm)

  return (
    <div className="structure">
      <h3>下一步</h3>
      <ol className="guide">
        {steps.map((x, i) => (
          <li key={i} className={x.done ? 'done' : i === now ? 'now' : ''}>
            <b>{x.title}</b>
            <span>{x.body}</span>
          </li>
        ))}
      </ol>
      <div className="row">
        <button onClick={() => onAsk('我想给这首配 beat，按我现在的进度，下一步具体怎么做？')}>问 Claude 下一步</button>
      </div>

      <h3>长短</h3>
      {written === 0 ? (
        <p className="muted">写了词之后，这里会估算这首歌大概多长。</p>
      ) : (
        <p className="muted">
          已写 {written} 小节，{bpm} BPM 下光念词约 {fmt(written * barSeconds(bpm))}。hook 每多唱一遍、前奏和间奏都会再加时间。
          这个速度下 2 分钟约 {Math.round(perMin * 2)} 小节，3 分钟约 {Math.round(perMin * 3)} 小节。两分钟出头的歌和五六分钟的长叙事都很常见，长短跟着你要说的内容走。
        </p>
      )}
      <div className="row">
        <button disabled={written === 0} onClick={() => onAsk('这首现在的长短合适吗？如果要加长，加在哪里最自然；如果不加，为什么也成立？')}>问 Claude 长短怎么选</button>
      </div>

      <h3>结构模板</h3>
      <p className="muted">规整的歌以 4 小节为一个乐句：主歌 16 小节，副歌 8 小节。按你的想法改，不规整不等于不好。</p>
      <ul className="tpl">
        {template.map((s, i) => (
          <li key={i}>
            <input value={s.name} onChange={(e) => edit(i, { name: e.target.value })} />
            <input type="number" min={1} max={64} value={s.bars} onChange={(e) => edit(i, { bars: Math.max(1, Number(e.target.value) || 1) })} />
            <span className={'unit' + (s.bars % 4 ? ' odd' : '')} title={s.bars % 4 ? '不是 4 的倍数，属于不规整的写法' : ''}>小节</span>
            <button onClick={() => move(i, -1)} title="上移">↑</button>
            <button onClick={() => move(i, 1)} title="下移">↓</button>
            <button onClick={() => setTemplate(template.filter((_, k) => k !== i))} title="删除">×</button>
          </li>
        ))}
      </ul>
      <div className="row">
        <button onClick={() => setTemplate([...template, { name: '主歌', bars: 16 }])}>加一段</button>
        <button onClick={() => setTemplate(REGULAR_TEMPLATE)}>恢复规整模板</button>
        <button onClick={onInsert}>把段落标题插入草稿</button>
      </div>
      <p className="muted">共 {total} 小节，{bpm} BPM 下约 {fmt(total * barSeconds(bpm))}。</p>

      <h3>草稿进度</h3>
      {rows.length === 0 ? (
        <p className="muted">草稿里还没有内容。用 [主歌1] 这样的标题分段，一行算一小节。</p>
      ) : (
        <table className="progress">
          <tbody>
            {rows.map(({ sec, plan }, i) => (
              <tr key={i} onClick={() => onJump(sec.start)}>
                <td>{sec.name}</td>
                <td>{sec.bars}{plan ? ` / ${plan}` : ''} 小节</td>
                <td className="note">
                  {plan && sec.bars > plan ? `多了 ${sec.bars - plan} 小节` : plan && sec.bars === plan ? '写满了' : !plan && sec.bars % 4 ? '不是 4 的倍数' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted">“找结构相近的现成歌”需要歌曲数据，放在后面的版本。</p>
    </div>
  )
}
