import { useEffect, useMemo, useRef, useState } from 'react'
import { buildInput, errorText, getSample, splitReply, type Sample, type Turn } from '../lib/ai'
import { applyReview, diffLines, parseReview, type Review, type Status } from '../lib/review'

export interface ReviewState {
  review: Review
  accepted: string[]
  choice: Record<string, number>
  chat?: Turn[]
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
  conflict: '和前面已接受的建议改到了同一处，先撤回那条才能用这条。',
}

const STARTERS = [
  '通读整首，说说你读到的主题和明线暗线',
  '结构怎么调？哪几句适合抽出来做 hook',
  '押韵上有哪些词可以换，给我几个选项',
  '和这首手法像的歌有哪些，我去听听',
]

/** 找出一行里真正变了的那一段，其余部分保持原样 */
function inline(a: string, b: string): [string, string, string, string, string] {
  let p = 0
  while (p < a.length && p < b.length && a[p] === b[p]) p++
  let s = 0
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++
  return [a.slice(0, p), a.slice(p, a.length - s), b.slice(p, b.length - s), a.slice(a.length - s), b.slice(0, p)]
}

export function ReviewView({ title, text, state, setState, onSaveAsNew }: Props) {
  const cur: ReviewState = state ?? { review: { title: `${title || '未命名'} · 改稿`, suggestions: [] }, accepted: [], choice: {}, chat: [] }
  const { review, accepted, choice } = cur
  const chat = cur.chat ?? []

  const [tab, setTab] = useState<'chat' | 'list'>('chat')
  const [error, setError] = useState('')
  const [pasting, setPasting] = useState(false)
  const [raw, setRaw] = useState('')
  const [sample, setSample] = useState<Sample | null | undefined>(undefined)
  const [draftMsg, setDraftMsg] = useState('')
  const [streaming, setStreaming] = useState<string | null>(null)
  const [chatError, setChatError] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const ctl = useRef<AbortController | null>(null)
  const log = useRef<HTMLDivElement>(null)
  const latest = useRef(cur)
  useEffect(() => {
    latest.current = cur
  })

  useEffect(() => {
    let alive = true
    void getSample().then((s) => alive && setSample(() => s))
    return () => {
      alive = false
      ctl.current?.abort()
    }
  }, [])
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight })
  }, [chat.length, streaming])

  const load = (json: string) => {
    try {
      const r = parseReview(json)
      setState({ ...cur, review: r, accepted: [], choice: {} })
      setError('')
      setPasting(false)
      setRaw('')
      setTab('list')
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败。')
    }
  }

  const send = async (message: string) => {
    const content = message.trim()
    if (!content || !sample || streaming !== null) return
    const turns: Turn[] = [...chat, { role: 'user', content }]
    setState({ ...cur, chat: turns })
    setDraftMsg('')
    setChatError('')
    setStreaming('')
    ctl.current = new AbortController()
    let answer = ''
    try {
      const res = await sample(buildInput(title, text, turns), {
        cache: false,
        signal: ctl.current.signal,
        onText: ({ text: t }) => setStreaming(splitReply(t).text),
      })
      answer = res.text
    } catch (e) {
      const err = e as { code?: string; text?: string }
      answer = err.text ?? ''
      if (err.code !== 'cancelled') setChatError(errorText(err.code))
    }
    setStreaming(null)
    if (!answer.trim()) return
    const now = latest.current
    const { suggestions } = splitReply(answer)
    setState({
      ...now,
      chat: [...(now.chat ?? turns), { role: 'assistant', content: answer }],
      review: { ...now.review, suggestions: [...now.review.suggestions, ...suggestions] },
    })
  }

  const applied = useMemo(() => applyReview(text, review, new Set(accepted), choice), [text, review, accepted, choice])
  const rows = useMemo(() => diffLines(text, applied.text), [text, applied])
  const usable = review.suggestions.filter((s) => applied.status[s.id] !== 'missing')
  const changed = applied.text !== text

  const toggle = (id: string) => setState({ ...cur, accepted: accepted.includes(id) ? accepted.filter((x) => x !== id) : [...accepted, id] })
  const remove = (id: string) =>
    setState({ ...cur, review: { ...review, suggestions: review.suggestions.filter((s) => s.id !== id) }, accepted: accepted.filter((x) => x !== id) })
  const jump = (find: string) => {
    const key = find.replace(/[\s*]/g, '').slice(0, 6)
    const el = [...document.querySelectorAll<HTMLElement>('.diff-row')].find((r) => r.dataset.key?.includes(key))
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el?.classList.add('flash')
    setTimeout(() => el?.classList.remove('flash'), 1200)
  }

  const importer = (
    <div className="review-import">
      <div className="row">
        <button onClick={() => file.current?.click()}>选择建议文件</button>
        <button onClick={() => setPasting(!pasting)}>粘贴建议</button>
        <input
          ref={file}
          id="review-file"
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
          <textarea id="review-paste" value={raw} onChange={(e) => setRaw(e.target.value)} rows={6} placeholder="把建议文件的内容粘贴到这里" />
          <div className="row">
            <button disabled={!raw.trim()} onClick={() => load(raw)}>导入</button>
          </div>
        </>
      )}
      {error && <p className="review-error">{error}</p>}
    </div>
  )

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
          {!text.trim() && <p className="muted diff-empty">这份草稿还是空的。先去“写词”里写几句，再回来让 Claude 看。</p>}
          {rows.map((r, i) => {
            const left = r.left?.replace(/\*/g, '') ?? null
            const right = r.right?.replace(/\*/g, '') ?? null
            const parts = left !== null && right !== null && r.kind === 'changed' ? inline(left, right) : null
            const header = /^\s*[[【]/.test(r.left ?? r.right ?? '')
            return (
              <div key={i} className={`diff-row ${r.kind}${header ? ' header' : ''}`} data-key={(r.left ?? '').replace(/[\s*]/g, '')}>
                <div className="dcell old">{parts ? <>{parts[0]}<del>{parts[1]}</del>{parts[3]}</> : left}</div>
                <div className="dcell new">{parts ? <>{parts[4]}<ins>{parts[2]}</ins>{parts[3]}</> : right}</div>
              </div>
            )
          })}
        </div>
      </section>

      <aside>
        <div className="tabs">
          <button className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}>和 Claude 聊</button>
          <button className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>建议（{review.suggestions.length}）</button>
        </div>

        {tab === 'chat' && (
          <div className="chat">
            <div className="chat-log" ref={log}>
              {chat.length === 0 && streaming === null && (
                <div className="chat-intro">
                  <p className="muted">
                    {sample === null
                      ? <>这个网址上没有接 Claude。从 <a href="https://claude.ai/artifact/BiNJshjbS8uoLRfLpNZSzm" target="_blank" rel="noreferrer">claude.ai 上的这份网站</a> 打开，就能在这里直接对话。</>
                      : 'Claude 能看到左边这份草稿。问它什么都行，它给的改动会变成“建议”，在左边分屏里看改前改后，原稿不动。'}
                  </p>
                  {sample && STARTERS.map((s) => (
                    <button key={s} className="starter" disabled={!text.trim()} onClick={() => void send(s)}>{s}</button>
                  ))}
                </div>
              )}
              {chat.map((t, i) => {
                const parsed = t.role === 'assistant' ? splitReply(t.content) : null
                return (
                  <div key={i} className={`bubble ${t.role}`}>
                    {parsed ? parsed.text : t.content}
                    {parsed && parsed.suggestions.length > 0 && (
                      <button className="link bubble-more" onClick={() => setTab('list')}>给了 {parsed.suggestions.length} 条改动，去看看</button>
                    )}
                  </div>
                )
              })}
              {streaming !== null && <div className="bubble assistant">{streaming || '正在想…'}</div>}
              {chatError && <p className="review-error">{chatError}</p>}
            </div>
            <form
              className="chat-form"
              onSubmit={(e) => {
                e.preventDefault()
                void send(draftMsg)
              }}
            >
              <textarea
                id="chat-input"
                value={draftMsg}
                onChange={(e) => setDraftMsg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    void send(draftMsg)
                  }
                }}
                rows={3}
                disabled={!sample}
                placeholder={sample ? '比如：这首我想讲的是……你觉得 verse 2 哪里拖了？' : sample === null ? '这里没有接 Claude' : '正在连接 Claude…'}
              />
              <div className="row tight">
                {streaming !== null ? (
                  <button type="button" onClick={() => ctl.current?.abort()}>停</button>
                ) : (
                  <button type="submit" className="primary" disabled={!sample || !draftMsg.trim()}>发送</button>
                )}
                {chat.length > 0 && streaming === null && (
                  confirmClear ? (
                    <>
                      <button type="button" onClick={() => { setState({ ...cur, chat: [] }); setConfirmClear(false) }}>确定清空</button>
                      <button type="button" className="link" onClick={() => setConfirmClear(false)}>取消</button>
                    </>
                  ) : (
                    <button type="button" className="link right" onClick={() => setConfirmClear(true)}>清空对话</button>
                  )
                )}
              </div>
            </form>
          </div>
        )}

        {tab === 'list' && (
          <div className="pane">
            {review.summary && <p className="review-summary">{review.summary}</p>}
            <h3>
              建议（{review.suggestions.length}）
              {review.suggestions.length > 0 && (
                <span className="right row tight">
                  <button className="link" onClick={() => setState({ ...cur, accepted: usable.map((s) => s.id) })}>全部接受</button>
                  <button className="link" onClick={() => setState({ ...cur, accepted: [] })}>全部撤回</button>
                </span>
              )}
            </h3>
            {review.suggestions.length === 0 && <p className="muted">还没有建议。去和 Claude 聊聊这首词，它给的改动会出现在这里。</p>}
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
                          onClick={() => setState({ ...cur, choice: { ...choice, [s.id]: i - 1 }, accepted: on ? accepted : [...accepted, s.id] })}
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
                    <button className="link right" onClick={() => remove(s.id)}>不要这条</button>
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

            <h3>导入建议文件</h3>
            {importer}
          </div>
        )}
      </aside>
    </main>
  )
}
