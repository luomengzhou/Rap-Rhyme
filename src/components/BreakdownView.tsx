import { useEffect, useRef, useState } from 'react'
import { engine } from '../lib/beats'
import { barsOf, clock, describeBreakdown, DRUMS, FEELS, FLOWS, newPart, parseClock, sorted, tapBpm, toTemplate, TRANS, type Breakdown, type Feel, type Part } from '../lib/breakdown'
import { FAMILIES, GENRES } from '../lib/genres'
import type { SectionTpl } from '../lib/styles'

interface Props {
  list: Breakdown[]
  setList: (b: Breakdown[]) => void
  draftTitle: string
  onAsk: (q: string) => void
  /** 用底部播放条试听某个曲风 */
  onPlayGenre: (id: string) => void
  /** 把拆出来的段落套到写词页的结构里 */
  onUse: (tpl: SectionTpl[], bpm: number) => void
}

const fresh = (): Breakdown => ({ id: 'b' + Math.random().toString(36).slice(2, 10), song: '', artist: '', bpm: 0, parts: [] })

/** 拆歌：一边放歌一边打点，记下 beat 每次变化的位置，再用大白话描述每一段 */
export function BreakdownView({ list, setList, draftTitle, onAsk, onPlayGenre, onUse }: Props) {
  const [curId, setCurId] = useState(list[0]?.id ?? '')
  const cur = list.find((b) => b.id === curId) ?? list[0]
  const patch = (f: (b: Breakdown) => Breakdown) => cur && setList(list.map((b) => (b.id === cur.id ? f(b) : b)))
  const patchPart = (id: string, p: Partial<Part>) => patch((b) => ({ ...b, parts: b.parts.map((x) => (x.id === id ? { ...x, ...p } : x)) }))

  // 计时：在别的 app 里放歌的同时点“开始”，之后每次觉得 beat 变了就点一下
  const [startAt, setStartAt] = useState<number | null>(null)
  const [from, setFrom] = useState('0:00')
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (startAt === null) return
    const t = setInterval(() => setNow((performance.now() - startAt) / 1000), 200)
    return () => clearInterval(t)
  }, [startAt])
  const mark = () => {
    if (startAt === null || !cur) return
    const at = (performance.now() - startAt) / 1000
    patch((b) => ({ ...b, parts: [...b.parts, newPart(at, b.parts.length + 1)] }))
  }
  const start = () => {
    const off = parseClock(from) ?? 0
    setStartAt(performance.now() - off * 1000)
    setNow(off)
    if (cur && !cur.parts.length) patch((b) => ({ ...b, parts: [{ ...newPart(off, 1), name: '开头' }] }))
  }

  const taps = useRef<number[]>([])
  const [tapMsg, setTapMsg] = useState('')
  const tap = () => {
    const t = performance.now() / 1000
    if (taps.current.length && t - taps.current[taps.current.length - 1] > 2.5) taps.current = []
    taps.current = [...taps.current.slice(-11), t]
    const bpm = tapBpm(taps.current)
    if (bpm) patch((b) => ({ ...b, bpm }))
    setTapMsg(bpm ? '' : `再点 ${Math.max(1, 4 - taps.current.length)} 下`)
  }

  const [sure, setSure] = useState(false)
  const [used, setUsed] = useState('')
  const demoBpm = cur?.bpm || 90

  if (!cur) {
    return (
      <div className="bd">
        <h2>拆歌</h2>
        <p className="muted">听到一首编排很厉害的歌，想知道它是怎么做的：在这里一边放歌一边打点，记下 beat 每次变化的位置，再用大白话描述每一段的鼓、flow 和转场。不需要乐理，每个选项都能点开听示例。</p>
        <button className="primary" onClick={() => { const b = fresh(); setList([b, ...list]); setCurId(b.id) }}>开始拆一首歌</button>
      </div>
    )
  }
  const parts = sorted(cur)

  return (
    <div className="bd">
      <h2>拆歌</h2>
      <p className="muted">网站听不到歌，这里是帮你把听到的东西记清楚。在别的 app 里放歌，这边同时计时；每次觉得“鼓变了”或“唱法变了”就点一下，之后再回头填每一段是什么感觉。</p>
      <div className="row">
        <select id="bd-pick" value={cur.id} onChange={(e) => { setCurId(e.target.value); setStartAt(null); setSure(false) }}>
          {list.map((b) => <option key={b.id} value={b.id}>{b.song || '还没填歌名'}</option>)}
        </select>
        <input id="bd-song" value={cur.song} onChange={(e) => patch((b) => ({ ...b, song: e.target.value }))} placeholder="歌名" />
        <input id="bd-artist" value={cur.artist} onChange={(e) => patch((b) => ({ ...b, artist: e.target.value }))} placeholder="歌手" />
        <button onClick={() => { const b = fresh(); setList([b, ...list]); setCurId(b.id); setStartAt(null) }}>再拆一首</button>
        {sure ? (
          <>
            <button className="link" onClick={() => { setList(list.filter((b) => b.id !== cur.id)); setCurId(''); setSure(false) }}>确定删掉这首的记录</button>
            <button className="link" onClick={() => setSure(false)}>不删</button>
          </>
        ) : (
          <button className="link" onClick={() => setSure(true)}>删</button>
        )}
      </div>

      <h3>第一步：测速度</h3>
      <div className="row">
        <button onClick={tap}>跟着拍子点这里</button>
        <input id="bd-bpm" type="number" min={40} max={220} value={cur.bpm || ''} onChange={(e) => patch((b) => ({ ...b, bpm: Number(e.target.value) || 0 }))} placeholder="BPM" />
        <span className="muted">{tapMsg || (cur.bpm ? `约 ${cur.bpm} BPM。像点头那样一拍点一下，点 8 下左右就稳了。知道速度才能算出每段几小节。` : '放着歌，像点头那样一拍点一下。')}</span>
      </div>

      <h3>第二步：边听边打点</h3>
      <div className="row">
        {startAt === null ? (
          <>
            <label className="check">歌从 <input id="bd-from" className="bd-time" value={from} onChange={(e) => setFrom(e.target.value)} /> 开始放</label>
            <button className="primary" onClick={start}>歌一响就点这里，开始计时</button>
          </>
        ) : (
          <>
            <b className="bd-clock">{clock(now)}</b>
            <button className="primary bd-mark" onClick={mark}>这里变了</button>
            <button onClick={() => setStartAt(null)}>停</button>
            <span className="muted">不用想清楚变成了什么，先点。点错的回头可以删。</span>
          </>
        )}
        <button onClick={() => patch((b) => ({ ...b, parts: [...b.parts, newPart((sorted(b).at(-1)?.at ?? -15) + 15, b.parts.length + 1)] }))}>手动加一段</button>
      </div>

      <h3>第三步：每一段是什么感觉</h3>
      {parts.length === 0 && <p className="muted">还没有打点。</p>}
      <div className="bd-parts">
        {parts.map((p, i) => {
          const bars = barsOf(cur, i)
          const drum = DRUMS.find((d) => d.id === p.drum)
          const flow = FLOWS.find((f) => f.id === p.flow)
          const trans = TRANS.find((t) => t.id === p.trans)
          return (
            <article key={p.id} className="bd-part">
              <div className="row tight">
                <input className="bd-time" aria-label="开始时间" defaultValue={clock(p.at)} key={p.at} onBlur={(e) => { const s = parseClock(e.target.value); if (s !== null) patchPart(p.id, { at: s }); else e.target.value = clock(p.at) }} />
                <input className="bd-name" aria-label="这一段叫什么" value={p.name} onChange={(e) => patchPart(p.id, { name: e.target.value })} />
                <span className="muted">{parts[i + 1] ? `到 ${clock(parts[i + 1].at)}` : '到结尾'}{bars ? `，约 ${bars} 小节` : ''}</span>
                <button className="link right" onClick={() => patch((b) => ({ ...b, parts: b.parts.filter((x) => x.id !== p.id) }))}>删这段</button>
              </div>
              <div className="bd-field">
                <label>鼓
                  <select value={p.drum} onChange={(e) => patchPart(p.id, { drum: e.target.value })}>
                    <option value="">没选</option>
                    {DRUMS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </label>
                {drum && drum.steps.length > 0 && <button className="link" onClick={() => void engine.playSteps(p.feel === 'double' ? demoBpm * 2 : demoBpm, drum.steps, drum.sounds)}>听示例</button>}
                <select aria-label="速度感" value={p.feel} onChange={(e) => patchPart(p.id, { feel: e.target.value as Feel })}>
                  {FEELS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                {drum?.plain && <small>{drum.plain}</small>}
              </div>
              <div className="bd-field">
                <label>像哪种曲风
                  <select value={p.genre ?? ''} onChange={(e) => patchPart(p.id, { genre: e.target.value })}>
                    <option value="">不确定</option>
                    {FAMILIES.map((f) => (
                      <optgroup key={f} label={f}>
                        {GENRES.filter((g) => g.family === f).map((g) => <option key={g.id} value={g.id}>{g.en} · {g.zh}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </label>
                {p.genre && <button className="link" onClick={() => onPlayGenre(p.genre!)}>听 / 停</button>}
                {p.genre && <small>{GENRES.find((g) => g.id === p.genre)?.plain}</small>}
              </div>
              <div className="bd-field">
                <label>flow
                  <select value={p.flow} onChange={(e) => patchPart(p.id, { flow: e.target.value })}>
                    <option value="">没选</option>
                    {FLOWS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </label>
                {flow && flow.grid.length > 0 && <button className="link" onClick={() => void engine.demo(demoBpm, flow.grid, flow.accents, flow.triplet ? '8t' : '16n')}>听示例</button>}
                {flow?.plain && <small>{flow.plain}</small>}
              </div>
              {i > 0 && (
                <div className="bd-field">
                  <label>怎么进来的
                    <select value={p.trans} onChange={(e) => patchPart(p.id, { trans: e.target.value })}>
                      <option value="">没选</option>
                      {TRANS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </label>
                  {trans?.plain && <small>{trans.plain}</small>}
                </div>
              )}
              <input className="bd-note" aria-label="备注" value={p.note} onChange={(e) => patchPart(p.id, { note: e.target.value })} placeholder="别的你听到的：乐器、音效、情绪、他在这里唱了什么样的内容" />
            </article>
          )
        })}
      </div>

      {parts.length > 0 && (
        <>
          <h3>第四步：弄明白，然后拿来用</h3>
          <div className="row">
            <button
              className="primary"
              onClick={() =>
                onAsk(
                  `我在拆一首歌的编排，下面是我边听边记的。你听不到这首歌，只根据我的记录来讲；我没记的细节不要替这首歌编，不确定就说不确定。\n${describeBreakdown(cur)}\n\n请用大白话告诉我：\n1. 每一处变化，制作人管它叫什么（给出中文说法和英文行话），是怎么做出来的。\n2. 变了这么多次为什么听起来还是一首歌、不散。\n3. 我自己的歌《${draftTitle || '未命名'}》如果想用类似的结构，每一段该放什么内容、用什么 flow，哪里换 beat 最合适。\n4. 我去找 beat 或者跟做 beat 的人沟通时，该怎么描述这种结构，搜 type beat 用哪些英文关键词。`,
                )
              }
            >
              问 Claude：这些手法叫什么，我怎么用
            </button>
            <button onClick={() => { onUse(toTemplate(cur), cur.bpm); setUsed('已经套到写词页“结构”里了，原来的结构模板被换掉。') }}>把这个结构套到我的歌上</button>
            {used && <span className="muted">{used}</span>}
          </div>
        </>
      )}

      <details className="bd-why">
        <summary>为什么有的歌 beat 变了很多次还不乱</summary>
        <ul>
          <li><b>速度其实没变。</b>从“正常”变成 trap，多半只是军鼓从每小节两下变成一下，听起来慢了一半（half-time），底下的拍子还是原来的。所以你点头的速度不用换。</li>
          <li><b>有东西从头贯穿到尾。</b>同一个调、同一段旋律或采样、同一种人声处理。鼓换了，但耳朵认得出还是这首歌。</li>
          <li><b>变化卡在整数的地方。</b>通常是第 4、8、16 小节结束的位置，正好一句话说完。</li>
          <li><b>换之前先留白。</b>把鼓抽掉一两小节，或者全部停半拍，耳朵“清空”一下，新的打法进来就不突兀。</li>
          <li><b>“一个字，停，再接一长串”</b>是 flow 上的对比：前面留白让那个字变重，后面密集的一串把欠的拍子补回来。鼓越空，这种唱法越明显。</li>
        </ul>
      </details>
    </div>
  )
}
