import type { Analysis } from '../lib/analyze'
import { barSeconds, REGULAR_TEMPLATE, type SectionTpl } from '../lib/styles'

interface Props {
  analysis: Analysis
  template: SectionTpl[]
  setTemplate: (t: SectionTpl[]) => void
  bpm: number
  onInsert: () => void
  onJump: (line: number) => void
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

export function StructurePanel({ analysis, template, setTemplate, bpm, onInsert, onJump }: Props) {
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

  return (
    <div className="structure">
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
      {written > 0 && <p className="muted">已写 {written} 小节，约 {fmt(written * barSeconds(bpm))}。</p>}
      <p className="muted">“找结构相近的现成歌”需要歌曲数据，放在后面的版本。</p>
    </div>
  )
}
