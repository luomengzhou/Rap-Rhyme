import { useEffect, useMemo, useRef, useState } from 'react'
import { engine, rhythmCode } from '../lib/beats'
import { barSeconds } from '../lib/styles'
import { useStored } from '../lib/store'

interface Props {
  bpm: number
  playing: boolean
  start: () => Promise<void>
  /** 草稿里光标所在的那一行，方便直接拿来打拍 */
  currentLine: string
}

interface Saved {
  name: string
  taps: number[]
  bpm: number
}

const BARS = 4
const HAN = /[一-鿿]/

/** 空格打拍：把脑子里的节奏落到 16 格上 */
export function FlowView({ bpm, playing, start, currentLine }: Props) {
  const [line, setLine] = useState('')
  const [taps, setTaps] = useState<number[]>([])
  const [armed, setArmed] = useState(false)
  const [pos, setPos] = useState(-1)
  const [saved, setSaved] = useStored<Saved[]>('rr.flows', [])
  // 记录的起点：第一个落点所在小节的开头
  const [base, setBase] = useState<number | null>(null)
  const state = useRef({ armed, playing, base })
  useEffect(() => {
    state.current = { armed, playing, base }
  }, [armed, playing, base])

  // 播放头
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      setPos(engine.position())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const clear = () => {
    setTaps([])
    setBase(null)
    setArmed(false)
  }

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return
      if (e.code === 'Escape') return clear()
      if (e.code !== 'Space' || e.repeat) return
      e.preventDefault()
      if (!state.current.armed) {
        // 第一下：表示这句开始，beat 没在放就从头放
        setTaps([])
        setBase(null)
        state.current.base = null
        setArmed(true)
        if (!state.current.playing) await start()
        return
      }
      const p = Math.round(engine.position())
      if (state.current.base === null) {
        state.current.base = Math.floor(p / 16) * 16
        setBase(state.current.base)
      }
      const rel = p - state.current.base
      if (rel >= BARS * 16) return setArmed(false)
      setTaps((t) => (t.includes(rel) ? t : [...t, rel]))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [start])

  const toggleCell = (i: number) => setTaps((t) => (t.includes(i) ? t.filter((x) => x !== i) : [...t, i]))
  const sorted = useMemo(() => [...taps].sort((a, b) => a - b), [taps])
  const units = useMemo(() => line.match(/[一-鿿]|[A-Za-z']+/g) ?? [], [line])
  const label = (cell: number) => {
    const k = sorted.indexOf(cell)
    return k >= 0 ? units[k] ?? '' : ''
  }
  const secs = barSeconds(bpm)
  const head = !playing || pos < 0 ? -1 : base !== null ? pos - base : pos % (BARS * 16)
  const hanCount = [...line].filter((c) => HAN.test(c)).length

  const replay = () => engine.demo(bpm, sorted, sorted.filter((s) => s % 4 === 0))

  return (
    <div className="flow">
      <div className="flow-head">
        <h2>空格打拍</h2>
        <p className="muted">
          按一下空格表示这句开始（beat 会跟着响），之后每唱到一个字或词就按一下。落点会对齐到最近的 16 分音符，也可以直接点格子修改。Esc 清空。
        </p>
        <div className="row">
          <input className="q" value={line} placeholder="可选：把这句词写在这里，会按顺序贴到落点上" onChange={(e) => setLine(e.target.value)} />
          <button disabled={!currentLine} onClick={() => setLine(currentLine)} title="用草稿里光标所在的那一行">用草稿当前行</button>
        </div>
        <p className={'status' + (armed ? ' rec' : '')}>
          {armed ? (taps.length ? `正在记录：已经按了 ${taps.length} 下，再按继续，满 4 小节自动停` : '开始了，跟着拍子按空格') : taps.length ? `记录了 ${taps.length} 个落点。按空格重新来一遍` : '按空格开始'}
        </p>
      </div>

      <div className="grid4">
        {Array.from({ length: BARS }, (_, b) => {
          const mine = sorted.filter((t) => t >= b * 16 && t < b * 16 + 16).map((t) => t - b * 16)
          const over = mine.length / secs > 6.5
          return (
            <div className="bar" key={b}>
              <div className="bar-meta">
                <b>第 {b + 1} 小节</b>
                {mine.length > 0 && (
                  <span className={over ? 'warn' : ''}>
                    节奏 {rhythmCode(mine)} · {mine.length} 个落点 · 每秒 {(mine.length / secs).toFixed(1)}
                    {over ? ' · 可能唱不顺' : ''}
                  </span>
                )}
              </div>
              <div className="cells">
                {Array.from({ length: 16 }, (_, i) => {
                  const cell = b * 16 + i
                  const on = taps.includes(cell)
                  const now = head >= cell && head < cell + 1
                  return (
                    <button key={i} className={'cell' + (i % 4 === 0 ? ' beat' : '') + (on ? ' on' : '') + (now ? ' now' : '')} onClick={() => toggleCell(cell)}>
                      <small>{i % 4 === 0 ? i / 4 + 1 : ''}</small>
                      <span>{label(cell)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="row">
        <button onClick={replay} disabled={!taps.length}>听一遍这个节奏</button>
        <button onClick={clear} disabled={!taps.length && !armed}>清空</button>
        <button
          disabled={!taps.length}
          onClick={() => setSaved([{ name: line || `节奏 ${saved.length + 1}`, taps: sorted, bpm }, ...saved])}
        >
          保存这个节奏
        </button>
        {line && taps.length > 0 && units.length !== taps.length && (
          <span className="muted">这句有 {units.length} 个字/词（汉字 {hanCount} 个），落点有 {taps.length} 个，数量对不上。</span>
        )}
      </div>

      {saved.length > 0 && (
        <div className="saved">
          <h3>存下来的节奏</h3>
          <ul>
            {saved.map((s, i) => (
              <li key={i}>
                <button onClick={() => { setTaps(s.taps); setLine(s.name.startsWith('节奏 ') ? '' : s.name); setBase(null); setArmed(false) }}>{s.name}</button>
                <code>{[0, 1, 2, 3].map((b) => rhythmCode(s.taps.filter((t) => t >= b * 16 && t < b * 16 + 16).map((t) => t - b * 16))).filter(Boolean).join(' | ')}</code>
                <span className="muted">{s.bpm} BPM</span>
                <button className="link" onClick={() => setSaved(saved.filter((_, k) => k !== i))}>删除</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
