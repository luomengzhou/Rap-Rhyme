import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { getSample } from '../lib/ai'
import { cleanPhones, enKey, findEn, isEnglish, loadEn, parseSaid, pronounce, sayPrompt, syllables, type EnIndex } from '../lib/en'
import { useStored } from '../lib/store'
import { addItems, matchGroups, parseItems, sourceOf, type RhymeGroup } from '../lib/book'
import { findRhymes, toSyls, type Mode, type RhymeIndex } from '../lib/rhyme'
import { colorOf, N_LABEL } from '../lib/palette'

interface Props {
  index: RhymeIndex | null
  query: string
  setQuery: (q: string) => void
  mode: Mode
  setMode: (m: Mode) => void
  blocked: string[]
  setBlocked: (b: string[]) => void
  liked: string[]
  setLiked: (b: string[]) => void
  /** 点一个词：插入到草稿光标处 */
  onPick?: (w: string) => void
  /** 韵脚本：自己从歌里记下来的韵组 */
  groups: RhymeGroup[]
  setGroups: Dispatch<SetStateAction<RhymeGroup[]>>
  onAsk?: (q: string) => void
}

interface BoxProps {
  g: RhymeGroup
  setGroups: Dispatch<SetStateAction<RhymeGroup[]>>
  onPick?: (w: string) => void
  onAsk?: (q: string) => void
}

/** 一组记下来的韵：带颜色的框，写着出处，点词可以插进草稿 */
function GroupBox({ g, setGroups, onPick, onAsk }: BoxProps) {
  const [more, setMore] = useState('')
  const [sure, setSure] = useState(false)
  const patch = (f: (x: RhymeGroup) => RhymeGroup) => setGroups((all) => all.map((x) => (x.id === g.id ? f(x) : x)))
  return (
    <div className="rh-box" style={{ borderColor: colorOf(g.color) }}>
      <div className="rh-src" style={{ color: colorOf(g.color) }}>{sourceOf(g)}</div>
      <div className="chips">
        {g.items.map((it) => (
          <span key={it} className="chip">
            <button className="w" title={onPick ? '点击插入草稿' : undefined} onClick={() => onPick?.(it)}>{it}</button>
            <button className="act" title="从这组里去掉" onClick={() => patch((x) => ({ ...x, items: x.items.filter((y) => y !== it) }))}>×</button>
          </span>
        ))}
      </div>
      <form className="row tight" onSubmit={(e) => { e.preventDefault(); patch((x) => addItems(x, parseItems(more))); setMore('') }}>
        <input value={more} onChange={(e) => setMore(e.target.value)} placeholder="再加几个，用逗号隔开" aria-label="往这组里加词" />
        {onAsk && (
          <button type="button" className="link" onClick={() => onAsk(`我记了一组韵：${g.items.join(' / ')}${g.song || g.artist ? `（出自 ${sourceOf(g)}）` : ''}。请告诉我：这几个放在一起押的是哪个音，哪些押得严、哪些是靠读法带过去的宽押，要怎么读才押得上；再给我 8 个左右能接进这组的常用词或短语，标出哪些是宽押。不要为了押韵凑生僻词。`)}>问 Claude</button>
        )}
        {sure ? (
          <>
            <button type="button" className="link" onClick={() => setGroups((all) => all.filter((x) => x.id !== g.id))}>确定删掉</button>
            <button type="button" className="link" onClick={() => setSure(false)}>不删</button>
          </>
        ) : (
          <button type="button" className="link" onClick={() => setSure(true)}>删这组</button>
        )}
      </form>
    </div>
  )
}

const SHOW = 240

interface Shown {
  w: string
  /** 读音，鼠标停上去能看到 */
  title: string
  looseOnly: boolean
  rare: boolean
  /** 中文意思（英文词才有） */
  zh?: string
}

export function RhymePanel({ index, query, setQuery, mode, setMode, blocked, setBlocked, liked, setLiked, onPick, groups, setGroups, onAsk }: Props) {
  const [draft, setDraft] = useState({ items: '', song: '', artist: '' })
  const addGroup = () => {
    const items = parseItems(draft.items)
    if (!items.length) return
    setGroups((all) => [...all, { id: 'g' + Math.random().toString(36).slice(2, 10), items, song: draft.song.trim(), artist: draft.artist.trim(), color: all.length }])
    setDraft({ items: '', song: '', artist: '' })
  }
  const [n, setN] = useState(2)
  const [sameTone, setSameTone] = useState(false)
  const [showRare, setShowRare] = useState(false)
  const [length, setLength] = useState(0)
  const [all, setAll] = useState(false)

  const en = isEnglish(query)
  const [enIdx, setEnIdx] = useState<EnIndex | null>(null)
  const [enFail, setEnFail] = useState(false)
  useEffect(() => {
    if (!en || enIdx) return
    let live = true
    loadEn(import.meta.env.BASE_URL).then((i) => live && setEnIdx(i), () => live && setEnFail(true))
    return () => { live = false }
  }, [en, enIdx])
  // 词典里没有的词（人名、俚语），读音由 Claude 给或者自己按“读起来像”补，存在本地
  const [extra, setExtra] = useStored<Record<string, string>>('rr.enSaid', {})
  const [showZh, setShowZh] = useStored('rr.enZh', true)
  const [like, setLike] = useState('')
  const [sayMsg, setSayMsg] = useState('')
  const [asking, setAsking] = useState(false)
  const said = useMemo(() => (en && enIdx ? pronounce(enIdx, query, extra) : null), [en, enIdx, query, extra])
  const askSay = async (words: string[]) => {
    setAsking(true)
    setSayMsg('')
    try {
      const sample = await getSample()
      if (!sample) setSayMsg('这里连不上 Claude，用右边的“读起来像”来补。')
      else {
        const got = parseSaid((await sample(sayPrompt(words), { cache: false })).text, words)
        if (Object.keys(got).length) setExtra((e) => ({ ...e, ...got }))
        else setSayMsg('Claude 没给出能用的读音，用“读起来像”来补。')
      }
    } catch {
      setSayMsg('问 Claude 没成功，过一会儿再试，或者用“读起来像”来补。')
    }
    setAsking(false)
  }
  /** 用几个认识的词拼出读音，比如 Actaeon 读起来像 act tea on；也可以直接写音素 */
  const sayLike = (word: string) => {
    if (!enIdx) return
    const direct = cleanPhones(like)
    const p = pronounce(enIdx, like, extra)
    if (!direct && (!p.ph.length || p.unknown.length)) return setSayMsg(`“${p.unknown.join('、') || like}”词典里也没有，换几个常见的词来拼。`)
    setExtra((e) => ({ ...e, [word.toLowerCase().replace(/^'+|'+$/g, '')]: direct ?? p.ph.join(' ') }))
    setLike('')
    setSayMsg('')
  }
  const mineSaid = en ? query.toLowerCase().split(/[^a-z']+/).map((w) => w.replace(/^'+|'+$/g, '')).filter((w) => extra[w]) : []

  const syls = useMemo(() => (en ? [] : toSyls(query)), [en, query])
  const size = en ? (said && !said.unknown.length ? syllables(said.ph) : 0) : syls.length
  const maxN = Math.min(4, size)
  const useN = Math.min(n, Math.max(1, maxN))
  const blockedSet = useMemo(() => new Set(blocked), [blocked])
  const likedSet = useMemo(() => new Set(liked), [liked])

  const { hits, counts } = useMemo((): { hits: Shown[]; counts: number[] } => {
    const byLiked = (a: Shown, b: Shown) => Number(likedSet.has(b.w)) - Number(likedSet.has(a.w))
    if (en) {
      if (!enIdx || !size) return { hits: [], counts: [0, 0, 0, 0] }
      const base = { mode, showRare, blocked: blockedSet, extra }
      const counts = [1, 2, 3, 4].map((k) => (k <= maxN ? findEn(enIdx, query, { ...base, n: k }).length : 0))
      const hits = findEn(enIdx, query, { ...base, n: useN }).map(({ word, looseOnly }) => ({ w: word.w, title: word.ph.join(' '), looseOnly, rare: word.tier === 2, zh: word.zh }))
      return { hits: hits.sort(byLiked), counts }
    }
    if (!index || !syls.length) return { hits: [], counts: [0, 0, 0, 0] }
    const base = { mode, sameTone, showRare, length, blocked: blockedSet }
    const counts = [1, 2, 3, 4].map((k) => (k <= maxN ? findRhymes(index, query, { ...base, n: k }).length : 0))
    const hits = findRhymes(index, query, { ...base, n: useN }).map(({ word, looseOnly }) => ({ w: word.w, title: word.syls.map((x) => x.py.replace('v', 'ü') + (x.tone || '')).join(' '), looseOnly, rare: word.tier === 2 }))
    return { hits: hits.sort(byLiked), counts }
  }, [en, enIdx, size, index, query, syls.length, mode, sameTone, showRare, length, blockedSet, likedSet, useN, maxN, extra])

  // 记过的韵组：中文按韵比；英文词典加载好后按最后两个元音比
  const sound = useMemo(() => (enIdx ? (t: string) => { const p = pronounce(enIdx, t, extra); return p.ph.length && !p.unknown.length ? p.ph : null } : undefined), [enIdx, extra])
  const mine = useMemo(() => matchGroups(groups, query, mode, sound), [groups, query, mode, sound])
  const shown = all ? hits : hits.slice(0, SHOW)
  const tail = syls.slice(-useN)

  return (
    <div className="rhyme">
      <input
        className="q"
        value={query}
        placeholder="输入一个词，中文英文都行，比如 不错、problem"
        onChange={(e) => {
          setQuery(e.target.value)
          setAll(false)
        }}
      />
      <div className="row">
        <div className="seg">
          {[1, 2, 3, 4].map((k) => (
            <button key={k} className={k === useN ? 'on' : ''} disabled={k > maxN} onClick={() => setN(k)}>
              {N_LABEL[k]}
              <small>{k <= maxN ? counts[k - 1] : ''}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="row opts">
        <div className="seg small">
          <button className={mode === 'strict' ? 'on' : ''} onClick={() => setMode('strict')} title={en ? '元音和它后面的辅音都一样才算' : '按实际听感：主要元音和韵尾都相同才算'}>严格</button>
          <button className={mode === 'loose' ? 'on' : ''} onClick={() => setMode('loose')} title={en ? '只要元音一样就算，辅音不管。说唱里最常用，结果里会标出来' : '再合并 en/eng、in/ing、e/o 等相近的韵，结果里会标出来'}>含宽押</button>
        </div>
        {!en && <label><input type="checkbox" checked={sameTone} onChange={(e) => setSameTone(e.target.checked)} />末字同声调</label>}
        <label><input type="checkbox" checked={showRare} onChange={(e) => setShowRare(e.target.checked)} />生僻词</label>
        {en && <label><input type="checkbox" checked={showZh} onChange={(e) => setShowZh(e.target.checked)} />中文意思</label>}
        <select hidden={en} value={length} onChange={(e) => setLength(Number(e.target.value))}>
          <option value={0}>字数不限</option>
          <option value={2}>2 个字</option>
          <option value={3}>3 个字</option>
          <option value={4}>4 个字</option>
        </select>
      </div>

      {mine.length > 0 && (
        <div className="rh-mine">
          <div className="muted">你记过的韵里用得上的：</div>
          {mine.map((g) => <GroupBox key={g.id} g={g} setGroups={setGroups} onPick={onPick} onAsk={onAsk} />)}
        </div>
      )}
      {!en && !index && <p className="muted">正在加载词库…</p>}
      {en && !enIdx && <p className="muted">{enFail ? '英文词典没加载出来，刷新页面再试。' : '正在加载英文发音词典…'}</p>}
      {en && said && said.unknown.length > 0 && (
        <div className="rh-say">
          <b>发音词典里没有 {said.unknown.join('、')}</b>
          <p className="muted">人名、神话里的名字和俚语常常不在词典里。先检查拼写；没拼错的话，补一个读音就能找韵，补过的会记住。</p>
          <form className="row tight" onSubmit={(e) => { e.preventDefault(); sayLike(said.unknown[0]) }}>
            <button type="button" className="primary" disabled={asking} onClick={() => void askSay(said.unknown)}>{asking ? '正在问…' : '让 Claude 给读音'}</button>
            <input id="rh-like" value={like} onChange={(e) => setLike(e.target.value)} placeholder={`或者写 ${said.unknown[0]} 读起来像哪几个词`} />
            <button type="submit" disabled={!like.trim()}>用这个读法</button>
          </form>
          {sayMsg && <p className="muted">{sayMsg}</p>}
        </div>
      )}
      {mineSaid.length > 0 && (
        <p className="muted key">
          {mineSaid.map((w) => (
            <span key={w}>{w} 按补的读音 <code>{extra[w]}</code><button className="link" onClick={() => setExtra((e) => { const n = { ...e }; delete n[w]; return n })}>重新补</button> </span>
          ))}
        </p>
      )}
      {en && said && size > 0 && (
        <p className="muted key">
          押的音：<code>{enKey(said.ph, useN, mode)}</code>
          {mode === 'strict' ? '严格押的词少，说唱里多半只押元音，可以点“含宽押”。' : '带“宽”字的只押元音。'}
        </p>
      )}
      {en && said && size > 0 && hits.length === 0 && <p className="muted">常用词里没有能{N_LABEL[useN]}上的。{mode === 'strict' ? '试试“含宽押”，' : ''}或者减少押的音节数。三押以上多半要靠几个词拼成短语。</p>}
      {!en && index && syls.length > 0 && (
        <p className="muted key">
          押的韵：{tail.map((s, i) => <code key={i}>{s.ch} {s[mode].replace('v', 'ü').replace('i*', 'i（舌尖）')}</code>)}
        </p>
      )}
      {!en && index && syls.length > 0 && hits.length === 0 && (
        <p className="muted">
          词库里没有常用词能{N_LABEL[useN]}上这个词。{useN >= 3 ? '三押以上的现成词本来就少，说唱里多半是几个词拼成的短语。可以先找双押，或者打开“含宽押”。' : '可以试试“含宽押”或“生僻词”。'}
        </p>
      )}
      <div className="chips">
        {shown.map(({ w, title, looseOnly, rare, zh }) => (
          <span key={w} className={'chip' + (looseOnly ? ' loose' : '') + (likedSet.has(w) ? ' liked' : '') + (rare ? ' rare' : '')}>
            <button className="w" title={(zh ? zh + ' · ' : '') + title + (onPick ? ' · 点击插入草稿' : '')} onClick={() => onPick?.(w)}>
              {w}
              {looseOnly && <i>宽</i>}
              {en && showZh && zh && <small>{zh}</small>}
            </button>
            <button className="act" title="喜欢，排到前面" onClick={() => setLiked(likedSet.has(w) ? liked.filter((x) => x !== w) : [...liked, w])}>♥</button>
            <button className="act" title="不押或不是词，以后不再出现" onClick={() => setBlocked([...blocked, w])}>×</button>
          </span>
        ))}
      </div>
      {hits.length > shown.length && (
        <button className="link" onClick={() => setAll(true)}>显示全部 {hits.length} 个</button>
      )}
      <details className="rh-book">
        <summary>韵脚本（{groups.length} 组）</summary>
        <p className="muted">听歌、看歌词时觉得押得好的一组词记在这里，写上是哪首歌里的。查词时，记过的会排在最前面。英文按读音比，日文韩文只认你记过的词本身。也可以在“改稿”的素材卡片里直接划词来记。</p>
        <form className="rh-new" onSubmit={(e) => { e.preventDefault(); addGroup() }}>
          <input id="rh-items" value={draft.items} onChange={(e) => setDraft({ ...draft, items: e.target.value })} placeholder="一组韵，用逗号隔开，短语里可以有空格" />
          <div className="row tight">
            <input id="rh-song" value={draft.song} onChange={(e) => setDraft({ ...draft, song: e.target.value })} placeholder="歌名（自己想的就不填）" />
            <input id="rh-artist" value={draft.artist} onChange={(e) => setDraft({ ...draft, artist: e.target.value })} placeholder="歌手" />
            <button type="submit" className="primary" disabled={!parseItems(draft.items).length}>记一组</button>
          </div>
        </form>
        {groups.filter((g) => !mine.includes(g)).map((g) => <GroupBox key={g.id} g={g} setGroups={setGroups} onPick={onPick} onAsk={onAsk} />)}
      </details>
      {blocked.length > 0 && (
        <p className="muted foot">
          已屏蔽 {blocked.length} 个词。<button className="link" onClick={() => setBlocked([])}>全部恢复</button>
        </p>
      )}
    </div>
  )
}
