import { useEffect, useState } from 'react'
import { beatOf, engine, KIT_NAMES } from '../lib/beats'
import { useStored } from '../lib/store'
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
  const [melody, setMelody] = useStored('rr.beatMelody', true)
  useEffect(() => {
    engine.melody = melody
  }, [melody])
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
      <label className="beat-melody" title="旋律是合成的示意，嫌吵可以关掉，只听鼓和低音">
        <input type="checkbox" checked={melody} onChange={(e) => setMelody(e.target.checked)} />
        旋律
      </label>
      <span className="desc" title={beat.desc}>
        {genre ? `${genre.zh}：${beat.desc}` : beat.desc}
        {beat.kit ? `。鼓声：${KIT_NAMES[beat.kit]}（真实采样），打法是这个曲风最通用的骨架。` : ''}
      </span>
    </footer>
  )
}
