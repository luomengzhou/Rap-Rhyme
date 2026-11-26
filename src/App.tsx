import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { analyze } from './lib/analyze'
import { beatOf, engine } from './lib/beats'
import { buildIndex, type Mode, type RhymeIndex } from './lib/rhyme'
import { barSeconds, DELIVERIES, maxPerLine, REGULAR_TEMPLATE, type SectionTpl } from './lib/styles'
import { useStored } from './lib/store'
import { BeatBar } from './components/BeatBar'
import { CheckPanel } from './components/CheckPanel'
import { Editor } from './components/Editor'
import { FlowView } from './components/FlowView'
import { HumView } from './components/HumView'
import { RhymePanel } from './components/RhymePanel'
import { StructurePanel } from './components/StructurePanel'
import { BreakdownView } from './components/BreakdownView'
import { GenresView } from './components/GenresView'
import type { Breakdown } from './lib/breakdown'
import { RefsView, type SongRef } from './components/RefsView'
import { ReviewView, type ReviewState } from './components/ReviewView'
import type { Material } from './lib/ai'
import type { RhymeGroup } from './lib/book'
import { TheoryView } from './components/TheoryView'

interface Draft {
  id: string
  title: string
  text: string
}

type View = 'write' | 'review' | 'flow' | 'hum' | 'refs' | 'breakdown' | 'genres' | 'theory'
type Side = 'check' | 'rhyme' | 'structure'

/** 把以前跟着各份草稿存的素材收到一起，同一条只留一份 */
function gatherMaterials(reviews: Record<string, ReviewState>): Material[] {
  const seen = new Set<string>()
  return Object.values(reviews)
    .flatMap((r) => r?.materials ?? [])
    .filter((m) => {
      const k = m.title + '\n' + m.text
      if (seen.has(m.id) || seen.has(k)) return false
      seen.add(m.id)
      seen.add(k)
      return true
    })
}

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
  const [refs, setRefs] = useStored<SongRef[]>('rr.refs', [])
  const [reviews, setReviews] = useStored<Record<string, ReviewState>>('rr.reviews', {})
  const [groups, setGroups] = useStored<RhymeGroup[]>('rr.rhymeGroups', [])
  const [breakdowns, setBreakdowns] = useStored<Breakdown[]>('rr.breakdowns', [])
  // 素材所有草稿共用。以前是跟着每份草稿存的，第一次打开时把它们收到一起
  const [materials, setMaterials] = useStored<Material[]>('rr.materials', gatherMaterials(reviews))
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<RhymeIndex | null>(null)
  const [playing, setPlaying] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [ask, setAsk] = useState('')
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
    await engine.start(beatOf(beatId), bpm)
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

  /** 试听某个曲风：换成它的鼓点和速度并开始放；正在放的就是它时停下 */
  const playGenre = async (id: string) => {
    const b = beatOf(id)
    if (playing && beatId === b.id) {
      engine.stop()
      return setPlaying(false)
    }
    setBeatId(b.id)
    setBpm(b.bpm)
    await engine.start(b, b.bpm)
    setPlaying(true)
  }

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

  const written = analysis.sections.reduce((a, x) => a + x.bars, 0)
  const mine = refs.filter((r) => r.draft === (draft.title || '未命名')).slice(0, 12)
  const refNotes = mine.length
    ? '\n作者为这份草稿记的听歌笔记（参考手法用）：\n' + mine.map((r) => `- ${r.song}${r.artist ? ' / ' + r.artist : ''}${r.at ? '，位置 ' + r.at : ''}${r.fit ? '，适合 ' + r.fit : ''}${r.note ? '，' + r.note : ''}`).join('\n')
    : ''
  const askClaude = (q: string) => {
    setAsk(q)
    setView('review')
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
          <button className={view === 'hum' ? 'on' : ''} onClick={() => setView('hum')}>哼唱</button>
          <button className={view === 'refs' ? 'on' : ''} onClick={() => setView('refs')}>听歌笔记</button>
          <button className={view === 'breakdown' ? 'on' : ''} onClick={() => setView('breakdown')}>拆歌</button>
          <button className={view === 'genres' ? 'on' : ''} onClick={() => setView('genres')}>曲风</button>
          <button className={view === 'theory' ? 'on' : ''} onClick={() => setView('theory')}>乐理卡</button>
        </nav>
        {(view === 'write' || view === 'review' || view === 'refs') && (
          <div className="drafts">
            <select value={draft.id} onChange={(e) => { setActiveId(e.target.value); setConfirmDel(false) }}>
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
            {confirmDel ? (
              <>
                <button
                  onClick={() => {
                    const rest = drafts.filter((d) => d.id !== draft.id)
                    setDrafts(rest)
                    setActiveId(rest[0].id)
                    setConfirmDel(false)
                  }}
                >
                  确定删除
                </button>
                <button onClick={() => setConfirmDel(false)}>取消</button>
              </>
            ) : (
              <button disabled={drafts.length < 2} onClick={() => setConfirmDel(true)}>删除</button>
            )}
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
                <RhymePanel index={index} query={query} setQuery={setQuery} mode={mode} setMode={setMode} blocked={blocked} setBlocked={setBlocked} liked={liked} setLiked={setLiked} onPick={insert} groups={groups} setGroups={setGroups} onAsk={askClaude} />
              )}
              {side === 'structure' && (
                <StructurePanel beatId={beatId} onAsk={askClaude} analysis={analysis} template={template} setTemplate={setTemplate} bpm={bpm} onInsert={insertTemplate} onJump={jump} />
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
          facts={`当前速度 ${bpm} BPM（一小节约 ${barSeconds(bpm).toFixed(1)} 秒），唱法：${delivery.name}。草稿已写 ${written} 小节（一行算一小节），照这个速度约 ${Math.round(written * barSeconds(bpm))} 秒，不含重复的 hook、前奏和间奏。${refNotes}`}
          ask={ask}
          clearAsk={() => setAsk('')}
          state={reviews[draft.id]}
          materials={materials}
          setMaterials={setMaterials}
          groups={groups}
          setGroups={setGroups}
          setState={(s) => {
            const next = { ...reviews }
            if (s) next[draft.id] = s
            else delete next[draft.id]
            setReviews(next)
          }}
          onWrite={setText}
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
      {view === 'hum' && (
        <main className="single">
          <HumView onAsk={askClaude} />
        </main>
      )}
      {view === 'refs' && (
        <main className="single">
          <RefsView refs={refs} setRefs={setRefs} draftTitle={draft.title} sections={analysis.sections.map((x) => x.name).filter((n) => n !== '未命名段落')} />
        </main>
      )}
      {view === 'breakdown' && (
        <main className="single">
          <BreakdownView
            list={breakdowns}
            setList={setBreakdowns}
            draftTitle={draft.title}
            onAsk={askClaude}
            onPlayGenre={(id) => void playGenre(id)}
            onUse={(tpl, b) => {
              setTemplate(tpl)
              if (b >= 60 && b <= 180) setBpm(b)
            }}
          />
        </main>
      )}
      {view === 'genres' && (
        <main className="single">
          <GenresView current={playing ? beatId : ''} picked={beatId} onPlay={(id) => void playGenre(id)} onAsk={askClaude} />
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
