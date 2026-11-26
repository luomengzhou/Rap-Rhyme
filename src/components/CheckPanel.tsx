import type { Analysis } from '../lib/analyze'
import { colorOf, N_LABEL } from '../lib/palette'
import { barSeconds, DELIVERIES, type Delivery } from '../lib/styles'
import type { Mode } from '../lib/rhyme'

interface Props {
  analysis: Analysis
  delivery: Delivery
  setDelivery: (id: string) => void
  bpm: number
  maxPerLine: number
  mode: Mode
  setMode: (m: Mode) => void
  onWord: (w: string) => void
  onJump: (line: number) => void
}

export function CheckPanel({ analysis, delivery, setDelivery, bpm, maxPerLine, mode, setMode, onWord, onJump }: Props) {
  const secs = barSeconds(bpm)
  const inRange = bpm >= delivery.bpm[0] && bpm <= delivery.bpm[1]
  return (
    <div className="check">
      <h3>唱法</h3>
      <div className="seg wrap">
        {DELIVERIES.map((d) => (
          <button key={d.id} className={d.id === delivery.id ? 'on' : ''} onClick={() => setDelivery(d.id)} title={d.name}>{d.en}</button>
        ))}
      </div>
      <dl className="facts">
        <dt>中文叫法</dt><dd>{delivery.name}</dd>
        <dt>每小节</dt><dd>{delivery.perBar[0]}-{delivery.perBar[1]} 个字（{bpm} BPM 下一小节 {secs.toFixed(1)} 秒）</dd>
        <dt>16 小节主歌</dt><dd>约 {delivery.perBar[0] * 16}-{delivery.perBar[1] * 16} 个字</dd>
        <dt>Hook</dt><dd>{delivery.hook}</dd>
        <dt>吐字</dt><dd>{delivery.tip}</dd>
        <dt>常见 BPM</dt><dd>{delivery.bpm[0]}-{delivery.bpm[1]}{inRange ? '' : `，现在是 ${bpm}`}</dd>
      </dl>
      <p className="muted">超过 {maxPerLine} 个字的行会在左边标红。这些是起步的经验值，只做提醒。</p>

      <h3>
        韵脚
        <span className="seg small right">
          <button className={mode === 'strict' ? 'on' : ''} onClick={() => setMode('strict')}>严格</button>
          <button className={mode === 'loose' ? 'on' : ''} onClick={() => setMode('loose')}>含宽押</button>
        </span>
      </h3>
      {analysis.total === 0 ? (
        <p className="muted">写几行词，押上的地方会自动标上颜色。</p>
      ) : (
        <>
          <div className="meter" title="押上的字占全部字数的比例">
            <div style={{ width: `${Math.round(analysis.density * 100)}%` }} />
            <span>押韵密度 {Math.round(analysis.density * 100)}%</span>
          </div>
          {analysis.groups.length === 0 && <p className="muted">还没有找到押韵的地方。</p>}
          <ul className="groups">
            {analysis.groups.map((g) => (
              <li key={g.id}>
                <span className="dot" style={{ background: colorOf(g.id) }} />
                <b style={{ color: colorOf(g.id) }}>{N_LABEL[g.n]} ×{g.times}</b>
                {g.loose && <i className="tag">宽押</i>}
                <span className="gw">
                  {g.words.map((w) => (
                    <button key={w} onClick={() => onWord(w)} title="用这个词找韵">{w}</button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>提醒</h3>
      {analysis.hints.length === 0 ? (
        <p className="muted">目前没有需要留意的地方。</p>
      ) : (
        <ul className="hints">
          {analysis.hints.map((h, i) => (
            <li key={i} className={h.kind}>
              <button onClick={() => onJump(h.line)}>{h.text}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
