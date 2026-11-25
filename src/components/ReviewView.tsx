import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { addItems, markLine, type RhymeGroup } from '../lib/book'
import { colorOf } from '../lib/palette'
import { buildInput, errorText, getSample, GLOSS_MAX_LINES, glossPrompt, locateGloss, splitReply, translatePrompt, type Material, type Sample, type Turn } from '../lib/ai'
import { applyReview, diffLines, parseReview, type Review, type Status } from '../lib/review'

export interface ReviewState {
  review: Review
  accepted: string[]
  choice: Record<string, number>
  chat?: Turn[]
  /** 自己动手改过的“改后”全文；有它的时候，改后稿以它为准 */
  manual?: string
  /** 收藏的素材 */
  materials?: Material[]
}

interface Props {
  title: string
  text: string
  state: ReviewState | undefined
  setState: (s: ReviewState | undefined) => void
  /** 收藏的素材，所有草稿共用 */
  materials: Material[]
  setMaterials: Dispatch<SetStateAction<Material[]>>
  /** 韵脚本，和写词页共用 */
  groups: RhymeGroup[]
  setGroups: Dispatch<SetStateAction<RhymeGroup[]>>
  onSaveAsNew: (text: string) => void
  /** 草稿还是空的时候，直接把提纲写进去 */
  onWrite: (text: string) => void
  /** 给 Claude 的背景数据，如 BPM、小节数 */
  facts: string
  /** 从别的页面带过来、要自动发出的问题 */
  ask: string
  clearAsk: () => void
}

const STATUS_NOTE: Record<Exclude<Status, 'ok'>, string> = {
  missing: '原稿里找不到这一句，可能你已经改过了。',
  conflict: '和前面已接受的建议改到了同一处，先撤回那条才能用这条。',
}

const STARTERS = [
  '帮我把这份草稿分成 intro / verse / hook / outro',
  '通读整首，说说你读到的主题和明线暗线',
  '结构怎么调？哪几句适合抽出来做 hook',
  '押韵上有哪些词可以换，给我几个选项',
  '和这首手法像的歌有哪些，我去听听',
  '这首长短合适吗？要不要加长',
  '我想给这首配 beat，下一步怎么做',
]

/** 草稿还没什么内容时的开场 */
const IDEA_STARTERS = [
  '我有一个主题，先听我讲，再帮我理成几段',
  '给我和这个主题有关的典故、神话、诗词',
  '给我一些核心意象和可以展开的画面',
  '流行歌里有哪些是这种情绪，我去听听',
  '把我讲的分段思路写成提纲放进草稿',
]

const searchUrl = (m: Material) => 'https://www.bing.com/search?q=' + encodeURIComponent(`${m.title} ${m.source}`.trim())

interface CardProps {
  m: Material
  saved: boolean
  onToggle: () => void
  onEdit?: () => void
  onTranslate?: () => void
  /** 正在讲解时已经写出来的部分 */
  live?: string | null
  /** 翻译划出来的几句 */
  onGloss?: (src: string, at: number) => void
  onDropGloss?: (at: number) => void
  /** 正在翻译的那几句：最后一行的行号和已经写出来的部分 */
  glossing?: { at: number; text: string } | null
  /** 从这张卡片里记下来的韵组，用来上色 */
  groups?: RhymeGroup[]
  /** 把划中的词记进一组韵；group 为空就新开一组 */
  onRhyme?: (word: string, group: string | null) => void
}

/** 原文里有没有需要翻译的外文 */
const foreign = (t: string) => /[A-Za-z\u3040-\u30ff\uac00-\ud7af]{2}/.test(t)

/** 去掉 Claude 偶尔带上的 Markdown 星号、井号，段落名单独加粗 */
function Plain({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((l, i) => {
        const head = /^\s*(\*\*.+\*\*|#+\s.+)\s*$/.test(l)
        const clean = l.replace(/\*\*/g, '').replace(/^\s*#+\s*/, '')
        return clean.trim() ? <div key={i} className={head ? 'mat-h' : undefined}>{clean}</div> : <div key={i} className="mat-gap" />
      })}
    </>
  )
}

function MaterialCard({ m, saved, onToggle, onEdit, onTranslate, live, onGloss, onDropGloss, glossing, groups = [], onRhyme }: CardProps) {
  const tr = live ?? m.translation ?? ''
  const lines = m.text.split('\n')
  const box = useRef<HTMLDivElement>(null)
  const [sel, setSel] = useState<{ src: string; at: number; n: number; word: string } | null>(null)
  const pick = () => {
    const s = window.getSelection()
    const el = box.current
    if (!s || s.isCollapsed || !el || !s.anchorNode || !s.focusNode || !el.contains(s.anchorNode) || !el.contains(s.focusNode)) return setSel(null)
    const raw = s.toString()
    const hit = locateGloss(m.text, raw)
    // 一行以内、不太长的一小段，可以记成韵脚
    const word = raw.trim()
    setSel(hit ? { ...hit, n: hit.src.split('\n').length, word: !word.includes('\n') && word.length <= 40 ? word : '' } : null)
  }
  const glossAt = (i: number) => (glossing?.at === i ? { zh: glossing.text, live: true } : m.glosses?.find((g) => g.at === i))
  return (
    <article className={`mat${saved ? ' on' : ''}`}>
      <div className="sug-head">
        <span className="tag">{m.kind}</span>
        <b>{m.title}</b>
      </div>
      {m.source && <div className="mat-src">{m.source}</div>}
      {m.text && (
        <div className="mat-text" ref={box} onMouseUp={pick} onKeyUp={pick}>
          {lines.map((l, i) => {
            const g = glossAt(i)
            return (
              <div key={i}>
                {l.trim() ? <div>{groups.length ? markLine(l, groups).map((sg, k) => (sg.group < 0 ? sg.text : <mark key={k} className="rh" style={{ borderColor: colorOf(groups[sg.group].color), color: colorOf(groups[sg.group].color) }}>{sg.text}</mark>)) : l}</div> : <div className="mat-gap" />}
                {g && (
                  <div className="mat-gloss">
                    {g.zh ? <Plain text={g.zh} /> : <span className="muted">正在翻译…</span>}
                    {onDropGloss && !('live' in g) && <button className="link" title="去掉这段翻译" onClick={() => onDropGloss(i)}>×</button>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {sel && (
        <div className="row tight mat-pick">
          {onGloss && foreign(sel.src) && (
            sel.n > GLOSS_MAX_LINES ? (
              <span className="muted">划了 {sel.n} 行，一次最多翻译 {GLOSS_MAX_LINES} 行。</span>
            ) : (
              <button className="primary" disabled={!!glossing} onClick={() => { onGloss(sel.src, sel.at); setSel(null); window.getSelection()?.removeAllRanges() }}>翻译划中的这 {sel.n} 行</button>
            )
          )}
          {onRhyme && sel.word && (
            <>
              <span className="muted">把“{sel.word}”记成韵脚：</span>
              {groups.map((g) => (
                <button key={g.id} className="rh-pick" style={{ borderColor: colorOf(g.color) }} title={g.items.join(' / ')} onClick={() => { onRhyme(sel.word, g.id); setSel(null); window.getSelection()?.removeAllRanges() }}>
                  和 {g.items[0]} 一组
                </button>
              ))}
              <button onClick={() => { onRhyme(sel.word, null); setSel(null); window.getSelection()?.removeAllRanges() }}>新的一组</button>
            </>
          )}
        </div>
      )}
      {groups.length > 0 && (
        <div className="rh-groups">
          {groups.map((g) => (
            <div key={g.id} style={{ borderColor: colorOf(g.color) }}>{g.items.join(' / ')}</div>
          ))}
        </div>
      )}
      {tr && (
        <details className="mat-tr" open={live != null}>
          <summary>整段大意</summary>
          <Plain text={tr} />
        </details>
      )}
      {live === '' && <p className="muted">正在读…</p>}
      {m.use && <p>{m.use}</p>}
      <div className="row tight">
        <button className={saved ? 'primary' : ''} onClick={onToggle}>{saved ? (onEdit ? '取消收藏' : '已收藏') : '收藏'}</button>
        {onEdit && <button className="link" onClick={onEdit}>改</button>}
        {onTranslate && foreign(m.text) && <button className="link" disabled={live != null} onClick={onTranslate}>{m.translation ? '重新讲一遍大意' : '讲讲整段大意'}</button>}
        <a className="right" href={searchUrl(m)} target="_blank" rel="noreferrer">搜原文核对</a>
      </div>
    </article>
  )
}

/** 找出一行里真正变了的那一段，其余部分保持原样 */
function inline(a: string, b: string): [string, string, string, string, string] {
  let p = 0
  while (p < a.length && p < b.length && a[p] === b[p]) p++
  let s = 0
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++
  return [a.slice(0, p), a.slice(p, a.length - s), b.slice(p, b.length - s), a.slice(a.length - s), b.slice(0, p)]
}

export function ReviewView({ title, text, state, setState, materials: saved, setMaterials, groups, setGroups, onSaveAsNew, onWrite, facts, ask, clearAsk }: Props) {
  const cur: ReviewState = state ?? { review: { title: `${title || '未命名'} · 改稿`, suggestions: [] }, accepted: [], choice: {}, chat: [] }
  const { review, accepted, choice } = cur
  const chat = cur.chat ?? []
  const idea = text.split('\n').filter((l) => l.trim() && !/^\s*[[【（(]/.test(l)).length < 4
  const matNotes = saved.length
    ? '\n作者收藏的素材（可以直接引用、接着聊）：\n' + saved.slice(0, 20).map((m) => `- [${m.kind}] ${m.title}${m.source ? '（' + m.source + '）' : ''}：${m.text.slice(0, 600)}${m.use ? ' 用法：' + m.use : ''}`).join('\n')
    : ''
  const [matForm, setMatForm] = useState<Material | null>(null)
  const saveMat = () => {
    if (!matForm || !matForm.title.trim()) return
    const prev = saved.find((x) => x.id === matForm.id)
    const changed = !!prev && prev.text !== matForm.text
    const m = { ...matForm, title: matForm.title.trim(), translation: changed ? undefined : matForm.translation, glosses: changed ? undefined : matForm.glosses }
    setMaterials((all) => (all.some((x) => x.id === m.id) ? all.map((x) => (x.id === m.id ? m : x)) : [m, ...all]))
    setMatForm(null)
  }
  const [trans, setTrans] = useState<{ id: string; text: string } | null>(null)
  const translate = async (m: Material) => {
    if (!sample || trans) return
    setTrans({ id: m.id, text: '' })
    setChatError('')
    let out = ''
    try {
      const res = await sample(translatePrompt(m), { cache: false, onText: ({ text: t }) => setTrans({ id: m.id, text: t }) })
      out = res.text.trim()
    } catch (e) {
      setChatError(errorText((e as { code?: string }).code))
    }
    setTrans(null)
    if (!out) return
    setMaterials((all) => all.map((x) => (x.id === m.id ? { ...x, translation: out } : x)))
  }
  const [glossing, setGlossing] = useState<{ id: string; at: number; text: string } | null>(null)
  const gloss = async (m: Material, src: string, at: number) => {
    if (!sample || glossing || trans) return
    setGlossing({ id: m.id, at, text: '' })
    setChatError('')
    let out = ''
    try {
      const res = await sample(glossPrompt(m, src), { cache: false, onText: ({ text: t }) => setGlossing({ id: m.id, at, text: t }) })
      out = res.text.trim()
    } catch (e) {
      setChatError(errorText((e as { code?: string }).code))
    }
    setGlossing(null)
    if (!out) return
    setMaterials((all) => all.map((x) => (x.id === m.id ? { ...x, glosses: [...(x.glosses ?? []).filter((g) => g.at !== at), { src, zh: out, at }] } : x)))
  }
  const dropGloss = (m: Material, at: number) => setMaterials((all) => all.map((x) => (x.id === m.id ? { ...x, glosses: (x.glosses ?? []).filter((g) => g.at !== at) } : x)))
  const rhyme = (m: Material, word: string, group: string | null) =>
    setGroups((all) =>
      group
        ? all.map((g) => (g.id === group ? addItems(g, [word]) : g))
        : [...all, { id: 'g' + Math.random().toString(36).slice(2, 10), items: [word], song: m.title, artist: m.source, color: all.length, from: m.id }],
    )
  const toggleMat = (m: Material) =>
    setMaterials((all) => (all.some((x) => x.title === m.title) ? all.filter((x) => x.title !== m.title) : [...all, { ...m, id: 'm' + Math.random().toString(36).slice(2, 10) }]))

  const [tab, setTab] = useState<'chat' | 'list' | 'mats'>('chat')
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
      const res = await sample(buildInput(title, text, turns, facts + matNotes), {
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
    const { suggestions } = splitReply(answer, Date.now().toString(36))
    setState({
      ...now,
      chat: [...(now.chat ?? turns), { role: 'assistant', content: answer }],
      review: { ...now.review, suggestions: [...now.review.suggestions, ...suggestions] },
    })
  }

  // 从“结构”页带过来的问题，等 Claude 连上后自动发出
  useEffect(() => {
    if (!ask || sample === undefined) return
    clearAsk()
    if (sample) void send(ask)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask, sample])

  const applied = useMemo(() => applyReview(text, review, new Set(accepted), choice), [text, review, accepted, choice])
  const manual = cur.manual
  const final = manual ?? applied.text
  const rows = useMemo(() => diffLines(text, final), [text, final])
  const usable = review.suggestions.filter((s) => applied.status[s.id] !== 'missing')
  const changed = final !== text
  const [editing, setEditing] = useState(false)
  const [dropManual, setDropManual] = useState(false)
  const [manualMsg, setManualMsg] = useState('')

  const toggle = (id: string) => {
    const on = !accepted.includes(id)
    const next = { ...cur, accepted: on ? [...accepted, id] : accepted.filter((x) => x !== id) }
    if (manual === undefined) return setState(next)
    // 已经手改过：新接受的建议直接写进手改稿，找不到原句就不动
    const s = review.suggestions.find((x) => x.id === id)
    if (on && s) {
      const one = applyReview(manual, { ...review, suggestions: [s] }, new Set([id]), choice)
      if (one.status[id] === 'ok') {
        setManualMsg('这条建议已经写进你手改的稿子里。')
        return setState({ ...next, manual: one.text })
      }
      setManualMsg('你手改的稿子里找不到这条建议要改的原句，没有动它。可以照着建议自己改。')
      return
    }
    setManualMsg('取消接受不会把你手改的稿子改回去，需要的话自己改回来。')
    setState(next)
  }
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
            {manual !== undefined && <span className="tag">手改过</span>}
            <button onClick={() => { if (!editing && manual === undefined) setState({ ...cur, manual: applied.text }); setEditing(!editing); setManualMsg('') }}>{editing ? '看对比' : '自己改'}</button>
            {manual !== undefined && (dropManual ? (
              <>
                <button className="link" onClick={() => { setState({ ...cur, manual: undefined }); setEditing(false); setDropManual(false); setManualMsg('') }}>确定放弃</button>
                <button className="link" onClick={() => setDropManual(false)}>不放弃</button>
              </>
            ) : (
              <button className="link" title="丢掉手改的内容，回到按建议生成的改后稿" onClick={() => setDropManual(true)}>放弃手改</button>
            ))}
            {text.trim() ? (
              <button className="primary" disabled={!changed} onClick={() => onSaveAsNew(final)}>存为新草稿</button>
            ) : (
              <button className="primary" disabled={!changed} onClick={() => { onWrite(final); setState({ ...cur, accepted: [], manual: undefined }); setEditing(false) }}>写进这份草稿</button>
            )}
          </div>
        </div>
        {manualMsg && <p className="muted diff-note">{manualMsg}</p>}
        {editing && (
          <div className="diff-edit">
            <pre className="dcell old">{text.replace(/\*/g, '') || '（原稿是空的）'}</pre>
            <textarea id="review-manual" className="dcell new" value={manual ?? ''} onChange={(e) => setState({ ...cur, manual: e.target.value })} placeholder="在这里直接改。原稿在左边，不会被动到。" spellCheck={false} />
          </div>
        )}
        <div className="diff-body" hidden={editing}>
          {!text.trim() && !changed && <p className="muted diff-empty">这份草稿还是空的。可以先在右边和 Claude 聊主题，让它把提纲写进来；也可以去“写词”里直接写。</p>}
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
          <button className={tab === 'mats' ? 'on' : ''} onClick={() => setTab('mats')}>素材（{saved.length}）</button>
        </div>

        {tab === 'chat' && (
          <div className="chat">
            <div className="chat-log" ref={log}>
              {chat.length === 0 && streaming === null && (
                <div className="chat-intro">
                  <p className="muted">
                    {sample === null
                      ? <>这个网址上没有接 Claude。从 <a href="https://claude.ai/artifact/BiNJshjbS8uoLRfLpNZSzm" target="_blank" rel="noreferrer">claude.ai 上的这份网站</a> 打开，就能在这里直接对话。</>
                      : idea
                        ? '这份草稿还在构思阶段。把你想写的主题、感觉、看过的书讲给 Claude 听，它会帮你理成几段，并给典故、意象这类素材，喜欢的可以收藏。'
                        : 'Claude 能看到左边这份草稿。问它什么都行，它给的改动会变成“建议”，在左边分屏里看改前改后，原稿不动。'}
                  </p>
                  {sample && idea && IDEA_STARTERS.map((s) => (
                    <button key={s} className="starter" onClick={() => { setDraftMsg(s.includes('先听我讲') ? '我想写的主题是：' : s); document.getElementById('chat-input')?.focus() }}>{s}</button>
                  ))}
                  {sample && !idea && STARTERS.map((s) => (
                    <button key={s} className="starter" onClick={() => void send(s)}>{s}</button>
                  ))}
                </div>
              )}
              {chat.map((t, i) => {
                const parsed = t.role === 'assistant' ? splitReply(t.content) : null
                return (
                  <div key={i} className={`bubble ${t.role}`}>
                    {parsed ? parsed.text : t.content}
                    {parsed && parsed.materials.length > 0 && (
                      <div className="mats">
                        {parsed.materials.map((m, k) => (
                          <MaterialCard key={k} m={m} saved={saved.some((x) => x.title === m.title)} onToggle={() => toggleMat(m)} />
                        ))}
                      </div>
                    )}
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

        {tab === 'mats' && (
          <div className="pane">
            <p className="muted">收藏的典故、诗词、意象和参考歌曲，所有草稿和版本共用一份。Claude 凭记忆给的内容，用之前点“搜原文核对”确认一下。在卡片的原文里用鼠标划一下：划几行外文可以只翻译那几行；划一个词或短语可以记成韵脚，同一组韵会标上同一种颜色，写词页查韵时会排在最前面。</p>
            {matForm ? (
              <form className="mat-form" onSubmit={(e) => { e.preventDefault(); saveMat() }}>
                <div className="row tight">
                  <select id="mat-kind" value={matForm.kind} onChange={(e) => setMatForm({ ...matForm, kind: e.target.value })}>
                    {['歌曲', '歌词', '诗词', '典故', '神话', '寓言', '文学', '意象', '说法', '其他'].map((k) => <option key={k}>{k}</option>)}
                  </select>
                  <input id="mat-title" value={matForm.title} onChange={(e) => setMatForm({ ...matForm, title: e.target.value })} placeholder="名字，比如歌名" />
                </div>
                <input id="mat-source" value={matForm.source} onChange={(e) => setMatForm({ ...matForm, source: e.target.value })} placeholder="出处：歌手、作者、作品" />
                <textarea id="mat-text" rows={6} value={matForm.text} onChange={(e) => setMatForm({ ...matForm, text: e.target.value })} placeholder="原文、歌词片段，或你自己的记录" />
                <input id="mat-use" value={matForm.use} onChange={(e) => setMatForm({ ...matForm, use: e.target.value })} placeholder="想怎么用（可不填）" />
                <div className="row tight">
                  <button type="submit" className="primary" disabled={!matForm.title.trim()}>保存</button>
                  <button type="button" onClick={() => setMatForm(null)}>取消</button>
                </div>
              </form>
            ) : (
              <div className="row">
                <button onClick={() => setMatForm({ id: 'm' + Math.random().toString(36).slice(2, 10), kind: '歌词', title: '', source: '', text: '', use: '' })}>自己加一条</button>
              </div>
            )}
            {saved.length === 0 && !matForm && <p className="muted">还没有收藏。可以和 Claude 聊主题让它给素材，也可以把自己查到的原文、歌词加进来。</p>}
            <div className="mats">
              {saved.map((m) => <MaterialCard key={m.id} m={m} saved onToggle={() => toggleMat(m)} onEdit={() => setMatForm(m)} onTranslate={sample ? () => void translate(m) : undefined} live={trans?.id === m.id ? trans.text : null} onGloss={sample ? (src, at) => void gloss(m, src, at) : undefined} onDropGloss={(at) => dropGloss(m, at)} glossing={glossing?.id === m.id ? glossing : null} groups={groups.filter((g) => g.from === m.id)} onRhyme={(w, g) => rhyme(m, w, g)} />)}
              {chatError && <p className="review-error">{chatError}</p>}
            </div>
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
