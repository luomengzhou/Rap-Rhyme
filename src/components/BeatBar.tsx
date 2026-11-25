import { useEffect, useState } from 'react'
import { beatOf, engine } from '../lib/beats'
import { FAMILIES, GENRES, genreOf } from '../lib/genres'

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
  const beat = beatOf(beatId)
  const genre = genreOf(beat.id)
  return (
    <footer className="beatbar">
      <button className={'play' + (playing ? ' on' : '')} onClick={toggle} title={playing ? '停止' : '播放'}>
        {playing ? '■' : '▶'}
      </button>
      <select
        value={beat.id}
        onChange={(e) => {
          const b = beatOf(e.target.value)
          setBeatId(b.id)
          setBpm(b.bpm)
        }}
      >
        <option value="click">节拍器 · 只要拍子</option>
        {FAMILIES.map((f) => (
          <optgroup key={f} label={f}>
            {GENRES.filter((g) => g.family === f).map((g) => <option key={g.id} value={g.id}>{g.en} · {g.zh}</option>)}
          </optgroup>
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
      <span className="desc" title={beat.desc}>{genre ? `${genre.zh}：${beat.desc}` : beat.desc}。鼓点骨架由浏览器合成，音色只是示意。</span>
    </footer>
  )
}
