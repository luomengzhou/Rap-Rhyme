import { useEffect, useState } from 'react'
import { BEATS, engine } from '../lib/beats'

interface Props {
  beatId: string
  setBeatId: (id: string) => void
  bpm: number
  setBpm: (n: number) => void
  playing: boolean
  toggle: () => void
}

/** 底部的 beat 播放条，所有页面共用 */
export function BeatBar({ beatId, setBeatId, bpm, setBpm, playing, toggle }: Props) {
  const [step, setStep] = useState(-1)
  useEffect(() => engine.onStep(setStep), [])
  const beat = BEATS.find((b) => b.id === beatId) ?? BEATS[0]
  return (
    <footer className="beatbar">
      <button className={'play' + (playing ? ' on' : '')} onClick={toggle} title={playing ? '停止' : '播放'}>
        {playing ? '■' : '▶'}
      </button>
      <select
        value={beatId}
        onChange={(e) => {
          const b = BEATS.find((x) => x.id === e.target.value)!
          setBeatId(b.id)
          setBpm(b.bpm)
        }}
      >
        {BEATS.map((b) => (
          <option key={b.id} value={b.id}>{b.mood} · {b.name}</option>
        ))}
      </select>
      <label className="bpm">
        <input type="range" min={60} max={180} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
        <input type="number" min={60} max={180} value={bpm} onChange={(e) => setBpm(Math.min(180, Math.max(60, Number(e.target.value) || 60)))} />
        BPM
      </label>
      <div className="steps" aria-hidden>
        {Array.from({ length: 16 }, (_, i) => (
          <i key={i} className={(i % 4 === 0 ? 'beat ' : '') + (step >= 0 && step % 16 === i ? 'now' : '')} />
        ))}
      </div>
      <span className="desc">{beat.desc}。示例 loop 由浏览器合成。</span>
    </footer>
  )
}
