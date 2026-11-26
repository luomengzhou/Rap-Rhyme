import { useEffect, useMemo, useState } from 'react'
import { errorText, getSample, type Sample } from '../lib/ai'
import { FAMILIES, genreOf } from '../lib/genres'
import { colorOf } from '../lib/palette'
import { familyCenter, genrePrompt, parseGenres, scopeOf, starMap, type Scope, type SongRef } from '../lib/refs'

export type { SongRef } from '../lib/refs'

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
  /** 用底部播放条试听某个曲风 */
  onPlayGenre: (id: string) => void
}

const EMPTY = { song: '', artist: '', at: '', fit: '', note: '', link: '' }
const STYLES = ['Boom Bap', 'Storytelling', 'Hardcore', 'Trap', 'Drill', 'Melodic Rap', 'Jazz Rap / Lo-fi', 'Chopper', 'hook 的唱法', '换 beat 的转场', '开头', '结尾']
/** 一次最多问 Claude 几首，省着用 */
const BATCH = 12

export function RefsView({ groups, onBook, refs, setRefs, draftTitle, sections, onPlayGenre }: Props) {
  const [form, setForm] = useState(EMPTY)
  const [scope, setScope] = useState<Scope>('song')
  const [folder, setFolder] = useState('')
  const [show, setShow] = useState<string>('all')
  const [editing, setEditing] = useState<string | null>(null)
  const [sample, setSample] = useState<Sample | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const set = (k: keyof typeof EMPTY, v: string) => setForm({ ...form, [k]: v })
  const title = draftTitle || '未命名'
  const folders = useMemo(() => [...new Set(refs.map((r) => r.folder).filter((f): f is string => !!f))], [refs])

  useEffect(() => {
    let live = true
    void getSample().then((s) => live && setSample(() => s))
    return () => {
      live = false
    }
  }, [])

  const save = () => {
    if (!form.song.trim()) return
    const base = { ...form, song: form.song.trim(), draft: scope === 'song' ? title : '', folder: scope === 'folder' ? folder.trim() || '未分类' : undefined }
    setRefs(editing ? refs.map((r) => (r.id === editing ? { ...r, ...base, ...(r.song === base.song && r.artist === base.artist ? {} : { genre: undefined, why: undefined }) } : r)) : [{ ...base, id: Math.random().toString(36).slice(2, 10), added: Date.now() }, ...refs])
    setForm(EMPTY)
    setEditing(null)
  }

  /** 让 Claude 认曲风：只问还没认过的，一次一批 */
  const classify = async (only?: SongRef) => {
    if (!sample || busy) return
    const todo = (only ? [only] : refs.filter((r) => !r.genre)).slice(0, BATCH)
    if (!todo.length) return
    setBusy(true)
    setMsg('')
    try {
      const res = await sample(genrePrompt(todo), { cache: false })
      const got = parseGenres(res.text, todo.length)
      const byId = new Map(todo.map((r, i) => [r.id, got[i]]))
      setRefs(refs.map((r) => (byId.get(r.id) ? { ...r, ...byId.get(r.id) } : r)))
      const n = Object.keys(got).length
      const left = refs.filter((r) => !r.genre).length - n
      setMsg(`认出了 ${n} 首${todo.length - n ? `，${todo.length - n} 首它不认识或没把握` : ''}${!only && left > todo.length - n ? '，还有没问的，可以再点一次' : ''}。它是凭记忆判断的，不对就点曲风自己改。`)
    } catch (e) {
      setMsg(errorText((e as { code?: string }).code))
    }
    setBusy(false)
  }

  const shown = show === 'all' ? refs : show === 'song' ? refs.filter((r) => r.draft === title) : show === 'global' ? refs.filter((r) => scopeOf(r) === 'global') : refs.filter((r) => r.folder === show.slice(2))
  const stars = useMemo(() => starMap(shown), [shown])
  const unknown = refs.filter((r) => !r.genre).length
  const sel = picked ? shown.find((r) => r.id === picked) : undefined

  return (
    <div className="refs">
      <h2>听歌笔记</h2>
      <p className="muted">听到一首歌，觉得它适合某一段词或者某种风格，就在这里记一笔：是哪首、大概在哪个位置。和 Claude 聊一首歌时，它能看到这首歌的笔记和全局的笔记。</p>

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
        <div className="row wide ref-scope">
          <span className="muted">这条笔记属于</span>
          <div className="seg small">
            <button type="button" className={scope === 'song' ? 'on' : ''} onClick={() => setScope('song')}>这首歌「{title}」</button>
            <button type="button" className={scope === 'folder' ? 'on' : ''} onClick={() => setScope('folder')}>一类歌</button>
            <button type="button" className={scope === 'global' ? 'on' : ''} onClick={() => setScope('global')}>全局</button>
          </div>
          {scope === 'folder' && (
            <>
              <input id="ref-folder" list="ref-folders" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="文件夹名，比如：怨歌、暗黑戏谑" />
              <datalist id="ref-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist>
            </>
          )}
          <button type="submit" className="primary" disabled={!form.song.trim()}>{editing ? '保存修改' : '记下来'}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY) }}>取消</button>}
        </div>
      </form>

      <h3>已记 {refs.length} 条</h3>
      <div className="row ref-filter">
        <div className="seg small wrap">
          <button className={show === 'all' ? 'on' : ''} onClick={() => setShow('all')}>全部</button>
          <button className={show === 'song' ? 'on' : ''} onClick={() => setShow('song')}>这首歌</button>
          {folders.map((f) => <button key={f} className={show === 'f:' + f ? 'on' : ''} onClick={() => setShow('f:' + f)}>📁 {f}</button>)}
          <button className={show === 'global' ? 'on' : ''} onClick={() => setShow('global')}>全局</button>
        </div>
        {sample && unknown > 0 && <button disabled={busy} onClick={() => void classify()} title={`一次问一批（最多 ${BATCH} 首），只问还没认过的`}>{busy ? '正在认…' : `让 Claude 认一下曲风（${unknown} 首没认）`}</button>}
      </div>
      {msg && <p className="muted">{msg}</p>}

      {stars.length > 0 && (
        <div className="ref-map">
          <svg viewBox="0 0 100 100" role="img" aria-label="按曲风摆开的星图">
            {FAMILIES.map((f, i) => {
              const c = familyCenter(i)
              return (
                <g key={f} pointerEvents="none">
                  <circle cx={c.x} cy={c.y} r={13} fill={colorOf(i)} opacity={0.07} />
                  <text x={c.x} y={c.y - 14.5} textAnchor="middle" fontSize={2.6} fill={colorOf(i)} opacity={0.85}>{f}</text>
                </g>
              )
            })}
            {stars.map((s) => (
              <g key={s.ref.id} className={'ref-star' + (picked === s.ref.id ? ' on' : '')} onClick={() => setPicked(picked === s.ref.id ? null : s.ref.id)}>
                <circle cx={s.x} cy={s.y} r={3.2} fill="transparent" />
                <circle className="dot" cx={s.x} cy={s.y} r={picked === s.ref.id ? 1.9 : 1.3} fill={colorOf(s.family)} />
                <text x={s.x + 2} y={s.y + 0.9} fontSize={2.1} fill="#c9ccd6">{s.ref.song.length > 12 ? s.ref.song.slice(0, 11) + '…' : s.ref.song}</text>
              </g>
            ))}
          </svg>
          <p className="muted">
            {sel ? <><b>{sel.song}</b>{sel.artist ? ` · ${sel.artist}` : ''}：{genreOf(sel.genre ?? '')?.en}{sel.why ? `，${sel.why}` : ''}。</> : '每颗星是一首记过的歌，同一类曲风的聚在一起。点一颗看它。'}
            位置只按曲风摆，是示意，不是算出来的相似度。
          </p>
        </div>
      )}

      {shown.length === 0 && <p className="muted">{refs.length ? '这个范围里还没有笔记。' : '还没有笔记。下次听到合适的歌，回来记一笔。'}</p>}
      <ul className="ref-list">
        {shown.map((r) => {
          const g = r.genre ? genreOf(r.genre) : undefined
          const n = groups.filter((x) => x.song.trim().toLowerCase() === r.song.trim().toLowerCase()).length
          return (
            <li key={r.id} className={picked === r.id ? 'on' : ''}>
              <div className="ref-main">
                <b>{r.song}</b>
                {r.artist && <span> · {r.artist}</span>}
                {r.at && <code>{r.at}</code>}
                {/^https:\/\//.test(r.link) && <a href={r.link} target="_blank" rel="noreferrer">打开</a>}
              </div>
              <div className="ref-meta">
                <span className="tag dim">{r.draft ? `这首歌：${r.draft}` : r.folder ? `📁 ${r.folder}` : '全局'}</span>
                {r.fit && <span className="tag">适合：{r.fit}</span>}
                {g ? (
                  <button className="tag ref-genre" title={`${g.zh}：${g.plain}${r.why ? '\n归到这里的理由：' + r.why : ''}\n点一下试听这个曲风的鼓点`} onClick={() => onPlayGenre(g.id)}>♪ {g.en}</button>
                ) : sample ? (
                  <button className="link" disabled={busy} onClick={() => void classify(r)}>认曲风</button>
                ) : null}
                <button className="link" onClick={() => onBook(r.song)}>{n ? `韵脚本里记了 ${n} 组韵` : '去韵脚本记它的韵'}</button>
              </div>
              {r.note && <p>{r.note}</p>}
              <div className="row tight">
                <button className="link" onClick={() => { setEditing(r.id); setForm({ song: r.song, artist: r.artist, at: r.at, fit: r.fit, note: r.note, link: r.link }); setScope(scopeOf(r)); setFolder(r.folder ?? '') }}>改</button>
                {g && <button className="link" onClick={() => setRefs(refs.map((x) => (x.id === r.id ? { ...x, genre: undefined, why: undefined } : x)))}>曲风不对，去掉</button>}
                <button className="link" onClick={() => setRefs(refs.filter((x) => x.id !== r.id))}>删掉</button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
