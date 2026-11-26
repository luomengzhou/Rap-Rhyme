import { describe, expect, it } from 'vitest'
import { genrePrompt, parseGenres, scopeOf, starMap, type SongRef } from './refs'

const ref = (p: Partial<SongRef>): SongRef => ({ id: Math.random().toString(36), song: '歌', artist: '', at: '', fit: '', note: '', link: '', draft: '', added: 0, ...p })

describe('听歌笔记', () => {
  it('范围：一首歌、一类歌、全局', () => {
    expect([ref({ draft: '甲' }), ref({ folder: '怨歌' }), ref({})].map(scopeOf)).toEqual(['song', 'folder', 'global'])
  })
  it('只认曲风表里的代号', () => {
    const r = parseGenres('1|boom-bap|鼓很脏，采样爵士\n2 | unknown | 不认识\n3｜trap｜\n4|not-a-genre|x\n9|trap|越界', 4)
    expect(r).toEqual({ 0: { genre: 'boom-bap', why: '鼓很脏，采样爵士' }, 2: { genre: 'trap', why: '' } })
    expect(genrePrompt([{ song: '甲', artist: '乙' }])).toContain('1. 甲 / 乙')
  })
  it('星图里同家族的聚在一起，位置不重叠', () => {
    const stars = starMap([ref({ genre: 'boom-bap' }), ref({ genre: 'boom-bap' }), ref({ genre: 'jazz-rap' }), ref({ genre: 'trap' }), ref({})])
    expect(stars.length).toBe(4)
    expect(stars[0].family).toBe(stars[2].family)
    expect(stars[0].family).not.toBe(stars[3].family)
    expect(new Set(stars.map((s) => `${s.x.toFixed(2)},${s.y.toFixed(2)}`)).size).toBe(4)
    const d = (a: number, b: number) => Math.hypot(stars[a].x - stars[b].x, stars[a].y - stars[b].y)
    expect(d(0, 2)).toBeLessThan(d(0, 3))
  })
})
