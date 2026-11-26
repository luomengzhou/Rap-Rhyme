import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { errorText, getSample, type Material, type Sample } from '../lib/ai'
import { norm, sourceOf, type RhymeGroup } from '../lib/book'
import { loadEn, type EnIndex } from '../lib/en'
import { extractRhymes, parseFound, rhymePrompt, type Found } from '../lib/extract'
import { N_LABEL } from '../lib/palette'
import type { Mode } from '../lib/rhyme'
import { useStored } from '../lib/store'
import { GroupBox } from './RhymePanel'
import type { SongRef } from './RefsView'

interface Props {
  groups: RhymeGroup[]
  setGroups: Dispatch<SetStateAction<RhymeGroup[]>>
  /** 素材库：可以直接拿里面贴过的歌词来找 */
  materials: Material[]
  refs: SongRef[]
  setRefs: (r: SongRef[]) => void
  mode: Mode
  isWord?: (w: string) => boolean
  /** 从别处带过来、只看某首歌的韵 */
  focus: string
  /** 点一个词：去写词页用它找韵 */
  onLookup: (w: string) => void
  onAsk: (q: string) => void
}

interface Cand extends Found {
  on: boolean
}

const id = () => 'g' + Math.random().toString(36).slice(2, 10)

/** 韵脚本：所有歌共用的一本。可以贴一段歌词自动找出韵脚，挑着记下来 */
export function BookView({ groups, setGroups, materials, refs, setRefs, mode, isWord, focus, onLookup, onAsk }: Props) {
  const [song, setSong] = useState('')
  const [artist, setArtist] = useState('')
  const [text, setText] = useState('')
  const [cands, setCands] = useState<Cand[] | null>(null)
  const [note, setNote] = useState(true)
  const [msg, setMsg] = useState('')
  const [filter, setFilter] = useState(focus)
  const [en, setEn] = useState<EnIndex | null>(null)
  const [extra] = useStored<Record<string, string>>('rr.enSaid', {})
  const [sample, setSample] = useState<Sample | null>(null)
  const [asking, setAsking] = useState(false)

  useEffect(() => setFilter(focus), [focus])
  useEffect(() => {
    let live = true
    void getSample().then((s) => live && setSample(() => s))
    return () => {
      live = false
    }
  }, [])
  const needEn = /[a-z]{2}/i.test(text)
  useEffect(() => {
    if (!needEn || en) return
    let live = true
    loadEn(import.meta.env.BASE_URL).then((i) => live && setEn(i), () => {})
    return () => {
      live = false
    }
  }, [needEn, en])

  const lyricMats = materials.filter((m) => m.text.trim().split('\n').length >= 2)
  const known = useMemo(() => new Set(groups.flatMap((g) => g.items.map(norm))), [groups])
  const find = () => {
    setMsg('')
    const found = extractRhymes(text, { mode, en, extra, isWord })
    setCands(found.map((f) => ({ ...f, on: !f.items.every((it) => known.has(norm(it))) })))
    if (!found.length) setMsg(needEn && !en ? '英文发音词典还在加载，等一两秒再点一次。' : '没有自动找到。可以让 Claude 再找一遍，或者自己在下面手动记一组。')
  }
  const askClaude = async () => {
    if (!sample || asking) return
    setAsking(true)
    setMsg('')
    try {
      const res = await sample(rhymePrompt(text), { cache: false })
      const found = parseFound(res.text, text)
      const have = new Set((cands ?? []).map((c) => c.items.map(norm).sort().join('|')))
      const fresh = found.filter((f) => !have.has(f.items.map(norm).sort().join('|')))
      setCands([...(cands ?? []), ...fresh.map((f) => ({ ...f, on: true }))])
      setMsg(fresh.length ? `Claude 多找到 ${fresh.length} 组，排在后面。它是凭读音判断的，记之前自己念一遍确认。` : 'Claude 没有找到更多的。')
    } catch (e) {
      setMsg(errorText((e as { code?: string }).code))
    }
    setAsking(false)
  }
  const picked = (cands ?? []).filter((c) => c.on && c.items.length >= 2)
  const save = () => {
    if (!picked.length) return
    setGroups((all) => [...all, ...picked.map((c, i) => ({ id: id(), items: c.items, song: song.trim(), artist: artist.trim(), color: all.length + i }))])
    const title = song.trim()
    if (note && title && !refs.some((r) => norm(r.song) === norm(title))) {
      setRefs([{ id: id(), song: title, artist: artist.trim(), at: '', fit: '', note: `在韵脚本里记了 ${picked.length} 组它的韵`, link: '', draft: '', added: Date.now() }, ...refs])
    }
    setMsg(`记下了 ${picked.length} 组。歌词本身没有保存，只留了押韵的词和出处。`)
    setCands(null)
    setText('')
    setFilter(title)
  }

  const q = norm(filter)
  const shown = q ? groups.filter((g) => norm(g.song).includes(q) || norm(g.artist).includes(q) || g.items.some((it) => norm(it).includes(q))) : groups
  const sources = [...new Set(groups.map((g) => g.song).filter(Boolean))]

  return (
    <div className="book">
      <h2>韵脚本</h2>
      <p className="muted">所有歌共用的一本。看歌词时觉得押得好的一组词记在这里，写词查韵时，记过的会排在最前面，并标明出自哪首歌。只存押韵的词和出处，不存整段歌词。</p>

      <section className="book-find">
        <h3>贴一段歌词，自动找韵脚</h3>
        <div className="row tight">
          <input id="book-song" value={song} onChange={(e) => setSong(e.target.value)} placeholder="歌名" list="book-songs" />
          <datalist id="book-songs">{[...new Set([...refs.map((r) => r.song), ...sources])].map((s) => <option key={s} value={s} />)}</datalist>
          <input id="book-artist" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="歌手" />
          {lyricMats.length > 0 && (
            <select
              id="book-mat"
              value=""
              onChange={(e) => {
                const m = lyricMats.find((x) => x.id === e.target.value)
                if (!m) return
                setText(m.text)
                setSong(m.title)
                setArtist(m.source)
                setCands(null)
              }}
            >
              <option value="">从素材里拿一段…</option>
              {lyricMats.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          )}
        </div>
        <textarea id="book-text" rows={7} value={text} onChange={(e) => { setText(e.target.value); setCands(null) }} placeholder="把歌词贴在这里，一行一句。中文找双押以上的，英文按读音找。" spellCheck={false} />
        <div className="row tight">
          <button className="primary" disabled={!text.trim()} onClick={find}>自动找韵脚</button>
          {sample && <button disabled={!text.trim() || asking} onClick={() => void askClaude()} title="它能找到几个词连起来押的，比如 dropped them 和 problem">{asking ? 'Claude 正在找…' : '让 Claude 再找一遍'}</button>}
          {msg && <span className="muted">{msg}</span>}
        </div>
        {cands && cands.length > 0 && (
          <div className="book-cands">
            {cands.map((c, i) => (
              <div key={i} className={'book-cand' + (c.on ? ' on' : '')}>
                <label>
                  <input type="checkbox" checked={c.on} onChange={(e) => setCands(cands.map((x, k) => (k === i ? { ...x, on: e.target.checked } : x)))} />
                  <i className="tag">{c.n === 0 ? 'Claude 找的' : c.lang === 'zh' ? N_LABEL[c.n] : c.n >= 2 ? '押两个音' : '押一个音'}</i>
                </label>
                <div className="chips">
                  {c.items.map((it) => (
                    <span key={it} className="chip">
                      <span className="w">{it}</span>
                      <button className="act" title="这个不算，去掉" onClick={() => setCands(cands.map((x, k) => (k === i ? { ...x, items: x.items.filter((y) => y !== it) } : x)))}>×</button>
                    </span>
                  ))}
                </div>
                {c.items.every((it) => known.has(norm(it))) && <small className="muted">已经记过</small>}
              </div>
            ))}
            <div className="row tight">
              <button className="primary" disabled={!picked.length} onClick={save}>把勾选的 {picked.length} 组记进韵脚本</button>
              <label className="check"><input type="checkbox" checked={note} onChange={(e) => setNote(e.target.checked)} />听歌笔记里还没有这首歌的话，顺手记一笔</label>
            </div>
          </div>
        )}
      </section>

      <h3>
        已记 {groups.length} 组
        <input id="book-filter" className="right" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="按歌名、歌手或词筛选" />
      </h3>
      {groups.length === 0 && <p className="muted">还没有记过。贴一段歌词试试，或者去“写词”右边的“找韵”里手动记一组。</p>}
      {groups.length > 0 && shown.length === 0 && <p className="muted">没有符合「{filter}」的。<button className="link" onClick={() => setFilter('')}>看全部</button></p>}
      <div className="book-list">
        {shown.map((g) => <GroupBox key={g.id} g={g} setGroups={setGroups} onPick={onLookup} onAsk={onAsk} />)}
      </div>
      {sources.length > 1 && (
        <p className="muted foot">
          按歌看：{sources.map((s) => <button key={s} className="link" onClick={() => setFilter(s)}>{sourceOf({ song: s, artist: groups.find((g) => g.song === s)?.artist ?? '' })}</button>)}
        </p>
      )}
    </div>
  )
}
