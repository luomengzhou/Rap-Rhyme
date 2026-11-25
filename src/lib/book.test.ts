import { describe, expect, it } from 'vitest'
import { addItems, markLine, matchGroups, norm, parseItems, sourceOf, type RhymeGroup } from './book'

const g = (items: string[], extra: Partial<RhymeGroup> = {}): RhymeGroup => ({ id: items[0], items, song: '', artist: '', color: 0, ...extra })

describe('韵脚本', () => {
  it('手动输入：逗号隔开，短语保留空格，重复的去掉', () => {
    expect(parseItems('alpha, beta one、 Alpha / gamma\n')).toEqual(['alpha', 'beta one', 'gamma'])
  })
  it('比较时不分大小写和撇号', () => {
    expect(norm("Put 'Em On!")).toBe('put em on')
    expect(addItems(g(['alpha']), ['ALPHA', 'beta']).items).toEqual(['alpha', 'beta'])
  })
  it('查词：组里有这个词，或短语里有这个词', () => {
    const groups = [g(['alpha', 'beta one']), g(['gamma'])]
    expect(matchGroups(groups, 'Alpha', 'strict')).toEqual([groups[0]])
    expect(matchGroups(groups, 'one', 'strict')).toEqual([groups[0]])
    expect(matchGroups(groups, 'delta', 'strict')).toEqual([])
  })
  it('查词：中文按韵比', () => {
    const groups = [g(['不错', '堕落']), g(['天空'])]
    expect(matchGroups(groups, '执着', 'strict')).toEqual([groups[0]])
  })
  it('上色：整词才算，长短语优先', () => {
    const segs = markLine('The alphabet and Alpha, beta one', [g(['alpha']), g(['beta one', 'one'])])
    expect(segs.filter((s) => s.group >= 0)).toEqual([{ text: 'Alpha', group: 0 }, { text: 'beta one', group: 1 }])
    expect(markLine('天空很空', [g(['天空'])]).map((s) => s.group)).toEqual([0, -1])
  })
  it('出处', () => {
    expect(sourceOf(g([], { song: '歌名', artist: '歌手' }))).toBe('歌手《歌名》')
    expect(sourceOf(g([]))).toBe('自己记的')
  })
})
