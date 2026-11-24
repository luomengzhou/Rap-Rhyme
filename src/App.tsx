import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { analyze } from './lib/analyze'
import { BEATS, engine } from './lib/beats'
import { buildIndex, type Mode, type RhymeIndex } from './lib/rhyme'
import { barSeconds, DELIVERIES, maxPerLine, REGULAR_TEMPLATE, type SectionTpl } from './lib/styles'
import { useStored } from './lib/store'
import { BeatBar } from './components/BeatBar'
import { CheckPanel } from './components/CheckPanel'
import { Editor } from './components/Editor'
import { FlowView } from './components/FlowView'
import { RhymePanel } from './components/RhymePanel'
import { StructurePanel } from './components/StructurePanel'
import { ReviewView, type ReviewState } from './components/ReviewView'
import { TheoryView } from './components/TheoryView'

interface Draft {
  id: string
  title: string
  text: string
}

type View = 'write' | 'review' | 'flow' | 'theory'
type Side = 'check' | 'rhyme' | 'structure'

const newDraft = (title = '新草稿'): Draft => ({ id: Math.random().toString(36).slice(2, 10), title, text: '' })
const HAN = /^[一-鿿]{1,6}$/

export default function App() {
  const [view, setView] = useState<View>('write')
  const [side, setSide] = useState<Side>('check')
  const [drafts, setDrafts] = useStored<Draft[]>('rr.drafts', [newDraft('第一首')])
  const [activeId, setActiveId] = useStored<string>('rr.active', '')
  const [mode, setMode] = useStored<Mode>('rr.mode', 'strict')
  const [deliveryId, setDeliveryId] = useStored('rr.delivery', 'story')
  const [beatId, setBeatId] = useStored('rr.beat', 'chill')
  const [bpm, setBpm] = useStored('rr.bpm', 85)
  const [blocked, setBlocked] = useStored<string[]>('rr.blocked', [])
  const [liked, setLiked] = useStored<string[]>('rr.liked', [])
  const [template, setTemplate] = useStored<SectionTpl[]>('rr.template', REGULAR_TEMPLATE)
  const [reviews, setReviews] = useStored<Record<string, ReviewState>>('rr.reviews', {})
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<RhymeIndex | null>(null)
  const [playing, setPlaying] = useState(false)
  const [sel, setSel] = useState({ start: 0, end: 0, text: '' })
  const input = useRef<HTMLTextAreaElement>(null)

  const draft = drafts.find((d) => d.id === activeId) ?? drafts[0]
  const setText = (text: string) => setDrafts(drafts.map((d) => (d.id === draft.id ? { ...d, text } : d)))

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/zh-words.txt')
      .then((r) => r.text())
      .then((t) => setIndex(buildIndex(t)))
      .catch(() => setIndex({ words: [], map: new Map(), set: new Set() }))
  }, [])

  const delivery = DELIVERIES.find((d) => d.id === deliveryId) ?? DELIVERIES[0]
  const limit = maxPerLine(delivery, bpm)
  const analysis = useMemo(
    () => analyze(draft.text, { mode, maxPerLine: limit, barSeconds: barSeconds(bpm), isWord: index ? (w) => index.set.has(w) : undefined }),
    [draft.text, mode, limit, bpm, index],
  )

  // beat
  useEffect(() => {
    if (playing) engine.setBpm(bpm)
  }, [bpm, playing])
  useEffect(() => engine.onStep((i) => i === -1 && setPlaying(false)), [])
  const start = useCallback(async () => {
    await engine.start(BEATS.find((b) => b.id === beatId) ?? BEATS[0], bpm)
    setPlaying(true)
  }, [beatId, bpm])
  const toggle = () => {
    if (playing) {
      engine.stop()
      setPlaying(false)
    } else void start()
  }
  useEffect(() => {
    if (engine.playing) void start()
    // 只在换 beat 时重启
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatId])

  const lookup = (w: string) => {
    setQuery(w)
    setSide('rhyme')
    setView('write')
  }
  const insert = (w: string) => {
    const el = input.current
    const { start: s, end: e } = sel
    setText(draft.text.slice(0, s) + w + draft.text.slice(e))
    const at = s + w.length
    setSel({ start: at, end: at, text: '' })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at, at)
    })
  }
  const jump = (line: number) => {
    const el = input.current
    if (!el) return
    const at = draft.text.split('\n').slice(0, line).join('\n').length + (line ? 1 : 0)
    el.focus()
    el.setSelectionRange(at, at + (draft.text.split('\n')[line]?.length ?? 0))
    const lh = parseFloat(getComputedStyle(el).lineHeight)
    el.closest('.editor')?.scrollTo({ top: Math.max(0, line * lh - 80), behavior: 'smooth' })
  }
  const insertTemplate = () => {
    const heads = template.map((s) => `[${s.name}]\n`).join('\n')
    setText(draft.text.trim() ? draft.text.replace(/\n*$/, '\n\n') + heads : heads)
  }

  const picked = sel.text.trim()
  const currentLine = useMemo(() => {
    const before = draft.text.slice(0, sel.start).split('\n').length - 1
    const l = draft.text.split('\n')[before] ?? ''
    return /^\s*[[【]/.test(l) ? '' : l.trim()
  }, [draft.text, sel.start])

  return (
    <div className="app">
      <header>
        <h1>Rap Rhyme<small>写词工作台</small></h1>
        <nav>
          <button className={view === 'write' ? 'on' : ''} onClick={() => setView('write')}>写词</button>
          <button className={view === 'review' ? 'on' : ''} onClick={() => setView('review')}>改稿</button>
          <button className={view === 'flow' ? 'on' : ''} onClick={() => setView('flow')}>打拍</button>
          <button className={view === 'theory' ? 'on' : ''} onClick={() => setView('theory')}>乐理卡</button>
        </nav>
        {(view === 'write' || view === 'review') && (
          <div className="drafts">
            <select value={draft.id} onChange={(e) => setActiveId(e.target.value)}>
              {drafts.map((d) => (
                <option key={d.id} value={d.id}>{d.title || '未命名'}</option>
              ))}
            </select>
            <input value={draft.title} onChange={(e) => setDrafts(drafts.map((d) => (d.id === draft.id ? { ...d, title: e.target.value } : d)))} placeholder="标题" />
            <button
              onClick={() => {
                const d = newDraft()
                setDrafts([...drafts, d])
                setActiveId(d.id)
              }}
            >
              新建
            </button>
            <button
              disabled={drafts.length < 2}
              onClick={() => {
                if (draft.text.trim() && !window.confirm(`删除「${draft.title}」？这一步不能撤销。`)) return
                const rest = drafts.filter((d) => d.id !== draft.id)
                setDrafts(rest)
                setActiveId(rest[0].id)
              }}
            >
              删除
            </button>
          </div>
        )}
      </header>

      {view === 'write' && (
        <main className="write">
          <section className="left">
            <Editor text={draft.text} analysis={analysis} maxPerLine={limit} onChange={setText} onSelect={setSel} inputRef={input} />
            {HAN.test(picked) && (
              <button className="float" onMouseDown={(e) => e.preventDefault()} onClick={() => lookup(picked)}>
                找「{picked}」的韵
              </button>
            )}
          </section>
          <aside>
            <div className="tabs">
              <button className={side === 'check' ? 'on' : ''} onClick={() => setSide('check')}>检查</button>
              <button className={side === 'rhyme' ? 'on' : ''} onClick={() => setSide('rhyme')}>找韵</button>
              <button className={side === 'structure' ? 'on' : ''} onClick={() => setSide('structure')}>结构</button>
            </div>
            <div className="pane">
              {side === 'check' && (
                <CheckPanel analysis={analysis} delivery={delivery} setDelivery={setDeliveryId} bpm={bpm} maxPerLine={limit} mode={mode} setMode={setMode} onWord={lookup} onJump={jump} />
              )}
              {side === 'rhyme' && (
                <RhymePanel index={index} query={query} setQuery={setQuery} mode={mode} setMode={setMode} blocked={blocked} setBlocked={setBlocked} liked={liked} setLiked={setLiked} onPick={insert} />
              )}
              {side === 'structure' && (
                <StructurePanel analysis={analysis} template={template} setTemplate={setTemplate} bpm={bpm} onInsert={insertTemplate} onJump={jump} />
              )}
            </div>
          </aside>
        </main>
      )}
      {view === 'review' && (
        <ReviewView
          key={draft.id}
          title={draft.title}
          text={draft.text}
          state={reviews[draft.id]}
          setState={(s) => {
            const next = { ...reviews }
            if (s) next[draft.id] = s
            else delete next[draft.id]
            setReviews(next)
          }}
          onSaveAsNew={(text) => {
            const d = { ...newDraft(`${draft.title || '未命名'}（改后）`), text }
            setDrafts([...drafts, d])
            setActiveId(d.id)
            setView('write')
          }}
        />
      )}
      {view === 'flow' && (
        <main className="single">
          <FlowView bpm={bpm} playing={playing} start={start} currentLine={currentLine} />
        </main>
      )}
      {view === 'theory' && (
        <main className="single">
          <TheoryView bpm={bpm} />
        </main>
      )}

      <BeatBar beatId={beatId} setBeatId={setBeatId} bpm={bpm} setBpm={setBpm} playing={playing} toggle={toggle} />
    </div>
  )
}
