import { useRef } from 'react'
import { NOTE, type Analysis } from '../lib/analyze'
import { colorOf } from '../lib/palette'

interface Props {
  text: string
  analysis: Analysis
  maxPerLine: number
  onChange: (t: string) => void
  /** 光标或选区变化：选中的文字和位置 */
  onSelect: (sel: { start: number; end: number; text: string }) => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
}

/** 带彩虹韵脚标注的编辑器：透明的输入框叠在着色层上面 */
export function Editor({ text, analysis, maxPerLine, onChange, onSelect, inputRef }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const report = () => {
    const el = inputRef.current
    if (!el) return
    onSelect({ start: el.selectionStart, end: el.selectionEnd, text: el.value.slice(el.selectionStart, el.selectionEnd) })
  }
  // 每行是所在段落的第几小节
  const bars: number[] = []
  analysis.lines.reduce((bar, l) => {
    const next = l.header ? 0 : l.count > 0 ? bar + 1 : bar
    bars.push(next)
    return next
  }, 0)
  return (
    <div className="editor" ref={wrap}>
      <div className="editor-inner">
        <div className="gutter" aria-hidden>
          {analysis.lines.map((l, i) => {
            const bar = bars[i]
            const over = maxPerLine > 0 && l.count > maxPerLine
            return (
              <div key={i} className={'gutter-row' + (over ? ' over' : '')} title={l.count ? `第 ${bar} 小节 · ${l.count} 个字` : ''}>
                {l.header ? '' : l.count > 0 ? <><span className="bar-no">{bar}</span><span className="syl-no">{l.count}</span></> : ''}
              </div>
            )
          })}
        </div>
        <div className="sheet">
          <pre className="backdrop" aria-hidden>
            {analysis.lines.map((l, i) => (
              <div key={i} className={l.header ? 'line header' : 'line'}>
                {l.text === '' ? '​' : segments(l.text, l.marks).map((s, k) =>
                  s.g === NOTE ? <span key={k} className="note">{s.t}</span> : s.g < 0 ? <span key={k}>{s.t}</span> : <span key={k} className="rh" style={{ color: colorOf(s.g), borderBottomColor: colorOf(s.g) }}>{s.t}</span>,
                )}
              </div>
            ))}
          </pre>
          <textarea
            ref={inputRef}
            className="input"
            value={text}
            spellCheck={false}
            rows={Math.max(analysis.lines.length, 12)}
            placeholder={'在这里写词，一行算一小节。\n用 [主歌1]、[副歌] 这样的标题分段。\n用（圆括号）写这一段想表达什么，它不算歌词。\n也可以把别人的歌词贴进来做韵脚检查。'}
            onChange={(e) => onChange(e.target.value)}
            onSelect={report}
            onKeyUp={report}
            onClick={report}
          />
        </div>
      </div>
    </div>
  )
}

function segments(text: string, marks: number[]) {
  const out: { t: string; g: number }[] = []
  for (let i = 0; i < text.length; i++) {
    const g = marks[i] ?? -1
    const last = out[out.length - 1]
    if (last && last.g === g) last.t += text[i]
    else out.push({ t: text[i], g })
  }
  return out
}
