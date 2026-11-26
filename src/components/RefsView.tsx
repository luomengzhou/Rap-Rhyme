import { useState } from 'react'

/** 听歌笔记：听到适合某段词或某种风格的歌，记下是哪首、在哪个位置 */
export interface SongRef {
  id: string
  song: string
  artist: string
  /** 位置，如 1:20-1:45 */
  at: string
  /** 适合什么：某一段词，或一种风格 */
  fit: string
  note: string
  link: string
  /** 关联的草稿标题，空表示不限 */
  draft: string
  added: number
}

interface Props {
  /** 韵脚本，用来显示每首歌记了几组韵 */
  groups: { song: string }[]
  /** 去韵脚本看这首歌的韵 */
  onBook: (song: string) => void
  refs: SongRef[]
  setRefs: (r: SongRef[]) => void
  draftTitle: string
  /** 当前草稿的段落名，用来做“适合”的候选 */
  sections: string[]
}

const EMPTY = { song: '', artist: '', at: '', fit: '', note: '', link: '' }
const STYLES = ['Boom Bap', 'Storytelling', 'Hardcore', 'Trap', 'Drill', 'Melodic Rap', 'Jazz Rap / Lo-fi', 'Chopper', 'hook 的唱法', '换 beat 的转场', '开头', '结尾']

export function RefsView({ groups, onBook, refs, setRefs, draftTitle, sections }: Props) {
  const [form, setForm] = useState(EMPTY)
  const [tie, setTie] = useState(true)
  const [only, setOnly] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const set = (k: keyof typeof EMPTY, v: string) => setForm({ ...form, [k]: v })
  const title = draftTitle || '未命名'

  const save = () => {
    if (!form.song.trim()) return
    const base = { ...form, song: form.song.trim(), draft: tie ? title : '' }
    setRefs(editing ? refs.map((r) => (r.id === editing ? { ...r, ...base } : r)) : [{ ...base, id: Math.random().toString(36).slice(2, 10), added: Date.now() }, ...refs])
    setForm(EMPTY)
    setEditing(null)
  }
  const shown = only ? refs.filter((r) => r.draft === title) : refs

  return (
    <div className="refs">
      <h2>听歌笔记</h2>
      <p className="muted">听到一首歌，觉得它适合某一段词或者某种风格，就在这里记一笔：是哪首、大概在哪个位置。和 Claude 聊这份草稿时，它也能看到关联的笔记。</p>

      <form
        className="ref-form"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <label>歌名<input id="ref-song" value={form.song} onChange={(e) => set('song', e.target.value)} placeholder="Ill Mind of Hopsin 5" /></label>
        <label>歌手<input id="ref-artist" value={form.artist} onChange={(e) => set('artist', e.target.value)} placeholder="Hopsin" /></label>
        <label>位置<input id="ref-at" value={form.at} onChange={(e) => set('at', e.target.value)} placeholder="1:20-1:45，或“第二段主歌开头”" /></label>
        <label>
          适合
          <input id="ref-fit" list="ref-fit-list" value={form.fit} onChange={(e) => set('fit', e.target.value)} placeholder="哪一段词，或哪种风格" />
          <datalist id="ref-fit-list">
            {[...new Set([...sections, ...STYLES])].map((s) => <option key={s} value={s} />)}
          </datalist>
        </label>
        <label className="wide">想学它什么<input id="ref-note" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="比如：这里突然抽掉鼓，只剩人声" /></label>
        <label className="wide">链接（可不填）<input id="ref-link" value={form.link} onChange={(e) => set('link', e.target.value)} placeholder="https://" /></label>
        <div className="row wide">
          <label className="check"><input id="ref-tie" type="checkbox" checked={tie} onChange={(e) => setTie(e.target.checked)} />关联到「{title}」</label>
          <button type="submit" className="primary" disabled={!form.song.trim()}>{editing ? '保存修改' : '记下来'}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY) }}>取消</button>}
        </div>
      </form>

      <h3>
        已记 {refs.length} 条
        <label className="check right"><input id="ref-only" type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} />只看「{title}」的</label>
      </h3>
      {shown.length === 0 && <p className="muted">{refs.length ? '这份草稿还没有关联的笔记。' : '还没有笔记。下次听到合适的歌，回来记一笔。'}</p>}
      <ul className="ref-list">
        {shown.map((r) => (
          <li key={r.id}>
            <div className="ref-main">
              <b>{r.song}</b>
              {r.artist && <span> · {r.artist}</span>}
              {r.at && <code>{r.at}</code>}
              {/^https:\/\//.test(r.link) && <a href={r.link} target="_blank" rel="noreferrer">打开</a>}
            </div>
            <div className="ref-meta">
              {r.fit && <span className="tag">适合：{r.fit}</span>}
              {r.draft && <span className="tag dim">{r.draft}</span>}
              {(() => {
                const n = groups.filter((g) => g.song.trim().toLowerCase() === r.song.trim().toLowerCase()).length
                return <button className="link" onClick={() => onBook(r.song)}>{n ? `韵脚本里记了 ${n} 组韵` : '去韵脚本记它的韵'}</button>
              })()}
            </div>
            {r.note && <p>{r.note}</p>}
            <div className="row tight">
              <button className="link" onClick={() => { setEditing(r.id); setForm({ song: r.song, artist: r.artist, at: r.at, fit: r.fit, note: r.note, link: r.link }); setTie(!!r.draft) }}>改</button>
              <button className="link" onClick={() => setRefs(refs.filter((x) => x.id !== r.id))}>删掉</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
