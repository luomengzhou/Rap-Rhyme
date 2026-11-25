import { useEffect, useMemo, useRef, useState } from 'react'
import { BEATS, engine } from '../lib/beats'
import { describe, detectHits, estimateBpm, KIND_NAME, PATTERNS, quantize, rank, type Hit, type Kind, type Step } from '../lib/hum'
import { useStored } from '../lib/store'

interface Props {
  onAsk: (question: string) => void
}

interface SavedFlow {
  name: string
  taps: number[]
  bpm: number
}

const SOUNDS = {
  low: [['kick', '底鼓'], ['808', '808 长低音']],
  mid: [['snare', '军鼓'], ['rim', '边击 / 短促的咔']],
  high: [['bell', '铃 / 叮'], ['hat', '踩镲 / 嚓']],
} as const
const ORDER: (Kind | null)[] = [null, 'mid', 'low', 'high']
const COLOR: Record<Kind, string> = { low: '#ff8a5c', mid: '#5ec8ff', high: '#ffd84d' }
const MAX_SECONDS = 40

/** 哼唱分析：把“哒哒哒 咚咚 叮”的录音变成格子上的节奏 */
export function HumView({ onAsk }: Props) {
  const [hits, setHits] = useState<Hit[]>([])
  const [wave, setWave] = useState<Float32Array | null>(null)
  const [dur, setDur] = useState(0)
  const [bpm, setBpm] = useState(90)
  const [steps, setSteps] = useState<Step[]>([])
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('')
  const [rec, setRec] = useState<MediaRecorder | null>(null)
  const [sounds, setSounds] = useStored('rr.humSounds', { low: 'kick', mid: 'snare', high: 'bell' })
  const [flows, setFlows] = useStored<SavedFlow[]>('rr.flows', [])
  const [savedMsg, setSavedMsg] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  const load = async (blob: Blob) => {
    setStatus('正在分析…')
    setSavedMsg('')
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
      void ctx.close()
      const len = Math.min(buf.length, Math.round(MAX_SECONDS * buf.sampleRate))
      const mono = new Float32Array(len)
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const d = buf.getChannelData(c)
        for (let i = 0; i < len; i++) mono[i] += d[i] / buf.numberOfChannels
      }
      const found = detectHits(mono, buf.sampleRate)
      const guess = estimateBpm(found.map((h) => h.time))
      // 画波形用的缩略：每一列取最大值
      const cols = 900
      const thumb = new Float32Array(cols)
      for (let i = 0; i < len; i++) {
        const k = Math.min(cols - 1, Math.floor((i / len) * cols))
        const v = Math.abs(mono[i])
        if (v > thumb[k]) thumb[k] = v
      }
      setWave(thumb)
      setDur(len / buf.sampleRate)
      setHits(found)
      setBpm(guess)
      setSteps(quantize(found, guess))
      setUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(blob)
      })
      setStatus(
        found.length
          ? `听到 ${found.length} 下${buf.duration > MAX_SECONDS ? `（只分析了前 ${MAX_SECONDS} 秒）` : ''}。速度是估的，不对就调一下。`
          : '没听出明显的落点。录的时候离麦克风近一点，每一下短促一些再试试。',
      )
    } catch {
      setStatus('这个文件读不了。试试 m4a、mp3 或 wav 格式的录音。')
    }
  }

  const record = async () => {
    if (rec) return rec.stop()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      const chunks: Blob[] = []
      mr.ondataavailable = (e) => chunks.push(e.data)
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setRec(null)
        void load(new Blob(chunks, { type: mr.mimeType }))
      }
      mr.start()
      setRec(mr)
      setStatus('正在录，哼完点“停”。')
    } catch {
      setStatus('这里录不了音（页面没有麦克风权限）。用手机或电脑的语音备忘录录好，再点“选择录音文件”传上来。')
    }
  }

  const retime = (next: number) => {
    const b = Math.min(220, Math.max(40, Math.round(next)))
    setBpm(b)
    setSteps(quantize(hits, b))
  }
  const cycle = (cell: number) => {
    const cur = steps.find((s) => s.step === cell)
    const next = ORDER[(ORDER.indexOf(cur?.kind ?? null) + 1) % ORDER.length]
    const rest = steps.filter((s) => s.step !== cell)
    setSteps(next ? [...rest, { step: cell, kind: next, accent: cur?.accent ?? false }].sort((a, b) => a.step - b.step) : rest)
  }

  useEffect(() => {
    const c = canvas.current
    if (!c || !wave) return
    const g = c.getContext('2d')
    if (!g) return
    const w = c.width
    const h = c.height
    g.clearRect(0, 0, w, h)
    let peak = 0.001
    wave.forEach((v) => (peak = Math.max(peak, v)))
    g.fillStyle = '#4a5060'
    wave.forEach((v, i) => {
      const y = (v / peak) * (h / 2 - 6)
      g.fillRect((i / wave.length) * w, h / 2 - y, Math.max(1, w / wave.length), y * 2 || 1)
    })
    for (const hit of hits) {
      const x = (hit.time / dur) * w
      g.fillStyle = COLOR[hit.kind]
      g.fillRect(x, hit.accent ? 0 : 10, 2, hit.accent ? h : h - 20)
    }
  }, [wave, hits, dur])

  const matches = useMemo(() => {
    const site = BEATS.filter((b) => b.id !== 'click').map((b) => ({ id: 'site-' + b.id, name: `网站里的「${b.name}」`, note: b.desc, kick: b.kick.slice(0, 16), snare: b.snare.slice(0, 16) }))
    return rank(steps, [...PATTERNS, ...site]).slice(0, 4)
  }, [steps])
  const playPattern = (p: { kick: string; snare: string }) => {
    const one: Step[] = []
    ;[...p.kick].forEach((c, i) => c === 'x' && one.push({ step: i, kind: 'low', accent: i % 8 === 0 }))
    ;[...p.snare].forEach((c, i) => c === 'x' && one.push({ step: i, kind: 'mid', accent: false }))
    void engine.playSteps(bpm, [...one, ...one.map((s) => ({ ...s, step: s.step + 16 }))], sounds)
  }
  const bars = Math.max(1, Math.min(4, Math.ceil(((steps.at(-1)?.step ?? 0) + 1) / 16)))

  return (
    <div className="hum">
      <h2>哼唱分析</h2>
      <p className="muted">
        脑子里有节奏但写不成字的时候，像语音备忘录那样哼出来：“哒哒哒哒 咚咚 叮”。这里会切出每一下的位置和轻重，分出闷的“咚”、中间的“哒”、亮的“叮”，落到格子上，再找相近的鼓点骨架。不用哼得准，每一下短促、分开就行。
      </p>
      <div className="row">
        <button className="primary" onClick={() => file.current?.click()}>选择录音文件</button>
        <button onClick={() => void record()}>{rec ? '停' : '直接录音'}</button>
        <input ref={file} id="hum-file" type="file" accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.webm" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void load(f) }} />
        {status && <span className="muted">{status}</span>}
      </div>

      {wave && (
        <>
          <canvas ref={canvas} className="hum-wave" width={900} height={90} />
          <div className="row">
            {url && <audio controls src={url} />}
            <span className="hum-legend">
              {(Object.keys(KIND_NAME) as Kind[]).map((k) => <span key={k}><i style={{ background: COLOR[k] }} />{KIND_NAME[k]}</span>)}
              <span className="muted">顶到头的线是重音</span>
            </span>
          </div>
        </>
      )}

      {hits.length > 0 && (
        <>
          <h3>落到格子上</h3>
          <div className="row">
            <span>速度</span>
            <button onClick={() => retime(bpm / 2)}>÷2</button>
            <button onClick={() => retime(bpm - 1)}>−</button>
            <input id="hum-bpm" type="number" min={40} max={220} value={bpm} onChange={(e) => retime(Number(e.target.value) || bpm)} />
            <button onClick={() => retime(bpm + 1)}>+</button>
            <button onClick={() => retime(bpm * 2)}>×2</button>
            <span className="muted">BPM。格子对不齐你哼的感觉时，先试 ÷2 或 ×2，再微调。点格子可以改：空、哒、咚、叮轮流换。</span>
          </div>
          <div className="grid4">
            {Array.from({ length: bars }, (_, b) => (
              <div className="bar" key={b}>
                <div className="bar-meta"><b>第 {b + 1} 小节</b></div>
                <div className="cells">
                  {Array.from({ length: 16 }, (_, i) => {
                    const s = steps.find((x) => x.step === b * 16 + i)
                    return (
                      <button key={i} className={'cell' + (i % 4 === 0 ? ' beat' : '') + (s ? ' on' : '')} style={s ? { background: COLOR[s.kind], color: '#111' } : undefined} onClick={() => cycle(b * 16 + i)}>
                        <small>{i % 4 === 0 ? i / 4 + 1 : ''}</small>
                        <span style={s?.accent ? { fontWeight: 800, fontSize: 19 } : undefined}>{s ? KIND_NAME[s.kind] : ''}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="row">
            <button className="primary" disabled={!steps.length} onClick={() => void engine.playSteps(bpm, steps, sounds)}>用鼓的声音听一遍</button>
            {(Object.keys(SOUNDS) as Kind[]).map((k) => (
              <label key={k} className="check">
                {KIND_NAME[k]}
                <select id={'hum-sound-' + k} value={sounds[k]} onChange={(e) => setSounds({ ...sounds, [k]: e.target.value })}>
                  {SOUNDS[k].map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                </select>
              </label>
            ))}
            <button
              disabled={!steps.length}
              onClick={() => {
                setFlows([{ name: `哼唱 ${flows.length + 1}`, taps: steps.map((s) => s.step), bpm }, ...flows])
                setSavedMsg('存好了，在“打拍”页的“存下来的节奏”里。')
              }}
            >
              存到打拍
            </button>
            {savedMsg && <span className="muted">{savedMsg}</span>}
          </div>

          <h3>相近的鼓点骨架</h3>
          <ul className="hum-match">
            {matches.map(({ pattern, score }) => (
              <li key={pattern.id}>
                <b>{pattern.name}</b>
                <span className="tag">{Math.round(score * 100)}% 像</span>
                <button className="link" onClick={() => playPattern(pattern)}>听</button>
                <p>{pattern.note}</p>
              </li>
            ))}
          </ul>
          <p className="muted">对照的是几种通用骨架和网站自带的示例 beat，只比落点的位置。相似度低于一半时，说明你哼的更像一句旋律或 flow，而不是鼓点。</p>
          <div className="row">
            <button
              disabled={!steps.length}
              onClick={() =>
                onAsk(
                  `我哼了一段脑子里的节奏，网站分析出来是这样：\n${describe(steps, bpm)}\n最像的鼓点骨架：${matches[0]?.pattern.name ?? '无'}（${Math.round((matches[0]?.score ?? 0) * 100)}%）。\n请告诉我：这像什么风格的 beat；我去搜 type beat 时可以用哪些英文关键词；“咚”“哒”“叮”分别可以用什么音色或效果，用制作人常说的词讲；这个节奏适合配什么样的 flow。`,
                )
              }
            >
              问 Claude：这是什么感觉的 beat，去哪找
            </button>
          </div>
        </>
      )}
    </div>
  )
}
