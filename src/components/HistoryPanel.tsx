import { useState } from 'react'
import { when, type Draft, type Snapshot } from '../lib/songs'

interface Props {
  draft: Draft
  /** 把某一份恢复成正在写的稿子（现在的会先备份） */
  onRestore: (text: string) => void
  onDelete: (kind: 'versions' | 'backups', index: number) => void
}

const lines = (t: string) => t.split('\n').filter((l) => l.trim()).length

/** 这首歌定稿过的版本和备份：点一份看内容，可以恢复 */
export function HistoryPanel({ draft, onRestore, onDelete }: Props) {
  const versions = draft.versions ?? []
  const backups = draft.backups ?? []
  const [pick, setPick] = useState<{ kind: 'versions' | 'backups'; i: number } | null>(versions.length ? { kind: 'versions', i: versions.length - 1 } : backups.length ? { kind: 'backups', i: backups.length - 1 } : null)
  const [confirm, setConfirm] = useState(false)
  const shown: Snapshot | undefined = pick ? draft[pick.kind]?.[pick.i] : undefined
  const choose = (kind: 'versions' | 'backups', i: number) => {
    setPick({ kind, i })
    setConfirm(false)
  }
  const item = (kind: 'versions' | 'backups', s: Snapshot, i: number, label: string) => (
    <button key={kind + i} className={'hist-item' + (pick?.kind === kind && pick.i === i ? ' on' : '')} onClick={() => choose(kind, i)}>
      <b>{label}</b>
      <small>{when(s.at)} · {lines(s.text)} 行{s.text === draft.text ? ' · 和现在一样' : ''}</small>
    </button>
  )
  return (
    <div className="hist">
      <div className="hist-list" data-scroll={`hist:${draft.id}`}>
        <h3>版本</h3>
        {versions.length === 0 && <p className="muted">还没有定稿过。写到一个满意的阶段，点上面的“定稿为 V1”。</p>}
        {versions.map((s, i) => item('versions', s, i, `V${i + 1}`)).reverse()}
        <h3>备份</h3>
        <p className="muted">备份只是怕丢，不算版本。写的过程中每隔十来分钟会自动存一份，换掉稿子之前也会存。最多留 30 份。</p>
        {backups.map((s, i) => item('backups', s, i, s.auto ? '自动备份' : '备份')).reverse()}
      </div>
      <div className="hist-view">
        {shown && pick ? (
          <>
            <div className="hist-bar">
              <b>{pick.kind === 'versions' ? `V${pick.i + 1}` : '备份'}</b>
              <small className="muted">{when(shown.at)}</small>
              <button className="primary" disabled={shown.text === draft.text} onClick={() => onRestore(shown.text)} title="现在的稿子会先存一份备份">恢复成现在的稿子</button>
              {confirm ? (
                <>
                  <button className="link" onClick={() => { onDelete(pick.kind, pick.i); setPick(null); setConfirm(false) }}>确定删除</button>
                  <button className="link" onClick={() => setConfirm(false)}>取消</button>
                </>
              ) : (
                <button className="link" onClick={() => setConfirm(true)}>删除这一份</button>
              )}
            </div>
            <pre className="hist-text" data-scroll={`histv:${draft.id}`}>{shown.text}</pre>
          </>
        ) : (
          <p className="muted hist-empty">点左边的一份看内容。</p>
        )}
      </div>
    </div>
  )
}
