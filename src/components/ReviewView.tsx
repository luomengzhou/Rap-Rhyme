import { useMemo, useRef, useState } from 'react'
import { applyReview, diffLines, parseReview, type Review, type Status } from '../lib/review'

export interface ReviewState {
  review: Review
  accepted: string[]
  choice: Record<string, number>
}

interface Props {
  title: string
  text: string
  state: ReviewState | undefined
  setState: (s: ReviewState | undefined) => void
  onSaveAsNew: (text: string) => void
}

const STATUS_NOTE: Record<Exclude<Status, 'ok'>, string> = {
  missing: '原稿里找不到这一句，可能你已经改过了。',
  conflict: '和前面已接受的建议改到了同一处，先拒绝那条才能用这条。',
}

/** 找出一行里真正变了的那一段，其余部分保持原样 */
function inline(a: string, b: string): [string, string, string, string, string] {
  let p = 0
  while (p < a.length && p < b.length && a[p] === b[p]) p++
  let s = 0
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++
  return [a.slice(0, p), a.slice(p, a.length - s), b.slice(p, b.length - s), a.slice(a.length - s), b.slice(0, p)]
}

export function ReviewView({ title, text, state, setState, onSaveAsNew }: Props) {
  const [error, setError] = useState('')
  const [pasting, setPasting] = useState(false)
  const [raw, setRaw] = useState('')
  const file = useRef<HTMLInputElement>(null)

  const load = (json: string) => {
    try {
      setState({ review: parseReview(json), accepted: [], choice: {} })
      setError('')
      setPasting(false)
      setRaw('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败。')
    }
  }

  const applied = useMemo(
    () => (state ? applyReview(text, state.review, new Set(state.accepted), state.choice) : null),
    [text, state],
  )
  const rows = useMemo(() => (applied ? diffLines(text, applied.text) : []), [text, applied])

  const importer = (
    <div className="review-import">
      <div className="row">
        <button onClick={() => file.current?.click()}>选择建议文件</button>
        <button onClick={() => setPasting(!pasting)}>粘贴建议</button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) load(await f.text())
          }}
        />
      </div>
      {pasting && (
        <>
          <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={8} placeholder="把建议文件的内容粘贴到这里" />
          <div className="row">
            <button disabled={!raw.trim()} onClick={() => load(raw)}>导入</button>
          </div>
        </>
      )}
      {error && <p className="review-error">{error}</p>}
    </div>
  )

  if (!state || !applied) {
    return (
      <main className="single">
        <div className="review-empty">
          <h2>改稿</h2>
          <p className="muted">
            这里像看代码改动一样看改词建议：左边是你的原稿，右边是改后的样子，每条建议都可以单独接受或拒绝。
            原稿不会被动，满意了再把改后的版本存成一份新草稿。
          </p>
          <p className="muted">
            现在的建议来自对话：把词发给 Claude，它会给你一份建议文件，在这里导入「{title || '未命名'}」这份草稿对应的那份就行。
          </p>
          {importer}
        </div>
      </main>
    )
  }

  const { review, accepted, choice } = state
  const usable = review.suggestions.filter((s) => applied.status[s.id] !== 'missing')
  const toggle = (id: string) =>
    setState({ ...state, accepted: accepted.includes(id) ? accepted.filter((x) => x !== id) : [...accepted, id] })
  const jump = (find: string) => {
    const key = find.replace(/[\s*]/g, '').slice(0, 6)
    const el = [...document.querySelectorAll<HTMLElement>('.diff-row')].find((r) => r.dataset.key?.includes(key))
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el?.classList.add('flash')
    setTimeout(() => el?.classList.remove('flash'), 1200)
  }
  const changed = applied.text !== text

  return (
    <main className="review">
      <section className="diff">
        <div className="diff-head">
          <div>原稿<small>不会被改动</small></div>
          <div>
            改后<small>已接受 {accepted.filter((id) => applied.status[id] === 'ok').length} / {usable.length} 条</small>
            <button className="primary" disabled={!changed} onClick={() => onSaveAsNew(applied.text)}>存为新草稿</button>
          </div>
        </div>
        <div className="diff-body">
          {rows.map((r, i) => {
            const left = r.left?.replace(/\*/g, '') ?? null
            const right = r.right?.replace(/\*/g, '') ?? null
            const parts = left !== null && right !== null && r.kind === 'changed' ? inline(left, right) : null
            const header = /^\s*[[【]/.test(r.left ?? r.right ?? '')
            return (
              <div key={i} className={`diff-row ${r.kind}${header ? ' header' : ''}`} data-key={(r.left ?? '').replace(/[\s*]/g, '')}>
                <div className="dcell old">
                  {parts ? <>{parts[0]}<del>{parts[1]}</del>{parts[3]}</> : left}
                </div>
                <div className="dcell new">
                  {parts ? <>{parts[4]}<ins>{parts[2]}</ins>{parts[3]}</> : right}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <aside>
        <div className="pane">
          <h2>{review.title}</h2>
          {review.summary && <p className="review-summary">{review.summary}</p>}

          <h3>
            建议（{review.suggestions.length}）
            <span className="right row tight">
              <button className="link" onClick={() => setState({ ...state, accepted: usable.map((s) => s.id) })}>全部接受</button>
              <button className="link" onClick={() => setState({ ...state, accepted: [] })}>全部拒绝</button>
            </span>
          </h3>
          {review.suggestions.map((s) => {
            const st = applied.status[s.id]
            const on = accepted.includes(s.id)
            const pick = choice[s.id] ?? -1
            const first = s.edits[0]
            return (
              <article key={s.id} className={`sug ${on && st === 'ok' ? 'on' : ''} ${st !== 'ok' ? 'off' : ''}`}>
                <div className="sug-head">
                  <span className="tag">{s.tag}</span>
                  <button className="link sug-title" onClick={() => first && jump(first.find)}>{s.title}</button>
                </div>
                {s.reason && <p>{s.reason}</p>}
                {s.options && s.options.length > 0 && first && (
                  <div className="opts">
                    {[first.replace, ...s.options].map((o, i) => (
                      <button
                        key={i}
                        className={pick === i - 1 ? 'on' : ''}
                        onClick={() => setState({ ...state, choice: { ...choice, [s.id]: i - 1 }, accepted: on ? accepted : [...accepted, s.id] })}
                      >
                        {o.replace(/\*/g, '') || '（删掉）'}
                      </button>
                    ))}
                  </div>
                )}
                {st !== 'ok' && <p className="review-error">{STATUS_NOTE[st]}</p>}
                <div className="row tight">
                  <button className={on ? 'primary' : ''} disabled={st === 'missing'} onClick={() => toggle(s.id)}>
                    {on ? '已接受，点击撤回' : '接受'}
                  </button>
                </div>
              </article>
            )
          })}

          {review.notes?.map((n) => (
            <div key={n.title}>
              <h3>{n.title}</h3>
              <p className="review-note">{n.body}</p>
            </div>
          ))}

          <h3>换一份建议</h3>
          {importer}
          <div className="row">
            <button onClick={() => window.confirm('清除这份建议？原稿和已存的草稿不受影响。') && setState(undefined)}>清除这份建议</button>
          </div>
        </div>
      </aside>
    </main>
  )
}
