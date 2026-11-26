import { describe, expect, it } from 'vitest'
import { addBackup, AUTO_EVERY, baseTitle, commitVersion, dueForAuto, MAX_BACKUPS, mergeRevised, replaceText, status, type Draft } from './songs'

const d = (id: string, title: string, text: string): Draft => ({ id, title, text })

describe('版本和备份', () => {
  it('定稿才产生版本，内容没变不重复', () => {
    let s = commitVersion(d('a', '歌', '一'), 1)
    s = commitVersion(s, 2)
    expect(s.versions?.length).toBe(1)
    s = commitVersion({ ...s, text: '二' }, 3)
    expect(s.versions?.map((v) => v.text)).toEqual(['一', '二'])
    expect(status(s)).toBe('和 V2 一样')
    expect(status({ ...s, text: '三' })).toBe('V2 之后改过')
  })
  it('备份不算版本，满了先丢自动存的', () => {
    let s = d('a', '歌', 'x')
    s = addBackup(s, 1, true)
    for (let i = 0; i < MAX_BACKUPS; i++) s = addBackup({ ...s, text: 'm' + i }, 10 + i)
    expect(s.backups?.length).toBe(MAX_BACKUPS)
    expect(s.backups?.some((b) => b.auto)).toBe(false)
    expect(s.versions).toBeUndefined()
  })
  it('换掉稿子之前先备份原来的', () => {
    const s = replaceText(d('a', '歌', '原来的'), '新的', 5)
    expect(s.text).toBe('新的')
    expect(s.backups?.[0].text).toBe('原来的')
  })
  it('隔够久才自动备份', () => {
    const s = addBackup(d('a', '歌', 'x'), 1000)
    expect(dueForAuto({ ...s, text: 'y' }, 1000 + AUTO_EVERY - 1)).toBe(false)
    expect(dueForAuto({ ...s, text: 'y' }, 1000 + AUTO_EVERY)).toBe(true)
    expect(dueForAuto(s, 1000 + AUTO_EVERY)).toBe(false)
  })
})

describe('把（改后）收成版本', () => {
  it('同一首歌的几份草稿变成 V1、V2 和正在写的稿子', () => {
    const list = [d('1', '第一首', 'a1'), d('2', '第一首（改后）', 'a2'), d('3', '夜路', 'b1'), d('4', '夜路（改后）', 'b2'), d('5', '夜路（改后）（改后）', 'b3'), d('6', '单独的', 'c')]
    const { drafts, moved } = mergeRevised(list)
    expect(drafts.map((x) => x.title)).toEqual(['第一首', '夜路', '单独的'])
    expect(drafts[1].versions?.map((v) => v.text)).toEqual(['b1', 'b2'])
    expect(drafts[1].text).toBe('b3')
    expect(drafts[1].id).toBe('5')
    expect(moved['3']).toBe('5')
    expect(drafts[2]).toEqual(list[5])
  })
  it('没有（改后）的同名草稿不动', () => {
    const list = [d('1', '新草稿', 'a'), d('2', '新草稿', 'b')]
    expect(mergeRevised(list).drafts).toEqual(list)
    expect(baseTitle('夜路 (改后)（改后）')).toBe('夜路')
  })
})
