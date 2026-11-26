import { useState } from 'react'
import { FAMILIES, GENRES } from '../lib/genres'

interface Props {
  /** 正在放的曲风 id，没在放是空 */
  current: string
  /** 底部播放条现在选的 */
  picked: string
  onPlay: (id: string) => void
  onAsk: (q: string) => void
}

/** 曲风表：说唱里常见曲风的专用名词、怎么听出来、能听的鼓点骨架 */
export function GenresView({ current, picked, onPlay, onAsk }: Props) {
  const [q, setQ] = useState('')
  const key = q.trim().toLowerCase()
  const hit = GENRES.filter((g) => !key || `${g.en} ${g.zh} ${g.plain} ${g.family}`.toLowerCase().includes(key))
  return (
    <div className="genres">
      <h2>曲风</h2>
      <p className="muted">
        说唱里常见的 {GENRES.length} 种曲风：圈内叫什么、怎么听出来、大概多快。点“听”会用底部的播放条放这种曲风最通用的鼓点骨架，同时把它设成你写词时的 beat。
        鼓声是真实的采样，按曲风分成几套，打法是最通用的骨架，旋律是合成的示意。真正的味道还是要去听这个曲风的歌；想找现成的 beat 点“搜 type beat”。
      </p>
      <input id="genre-q" className="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜名字或感觉，比如 drill、牛铃、迷幻、慢" />
      {FAMILIES.map((f) => {
        const list = hit.filter((g) => g.family === f)
        if (!list.length) return null
        return (
          <section key={f}>
            <h3>{f}</h3>
            <div className="genre-grid">
              {list.map((g) => (
                <article key={g.id} className={picked === g.id ? 'on' : ''}>
                  <div className="genre-head">
                    <b>{g.en}</b>
                    <span>{g.zh}</span>
                    <span className="tag">{g.bpm} BPM</span>
                  </div>
                  <p>{g.plain}。</p>
                  <div className="row tight">
                    <button className={current === g.id ? 'primary' : ''} onClick={() => onPlay(g.id)}>{current === g.id ? '停' : '听'}</button>
                    <a href={'https://www.youtube.com/results?search_query=' + encodeURIComponent(`${g.search} type beat`)} target="_blank" rel="noreferrer">搜 type beat</a>
                    <button className="link" onClick={() => onAsk(`给我讲讲 ${g.en}（${g.zh}）这个说唱曲风：它是怎么来的，鼓、低音、旋律各有什么标志，常用什么 flow，适合写什么内容和情绪；推荐三四首有代表性的歌让我去听（只说歌名和歌手，不确定就说不确定）。我不喜欢歌词里炫富、物化女性和毒品的内容，推荐时避开或者提前说明。`)}>问 Claude</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )
      })}
      {!hit.length && <p className="muted">没有找到。换个词试试，或者告诉我缺了哪种曲风。</p>}
    </div>
  )
}
