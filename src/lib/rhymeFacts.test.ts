import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildEnIndex } from './en'
import { buildIndex } from './rhyme'
import { candidates, lineEnd, rhymeFacts, sectionFor } from './rhymeFacts'

const index = buildIndex(readFileSync('public/data/zh-words.txt', 'utf8'))
const enIdx = buildEnIndex(readFileSync('public/data/en-words.txt', 'utf8'))
const base = { liked: [], blocked: [], index, enIdx }
const draft = '【verse 1】\n今天出门去看海\n（这里想写轻松）\n【Verse 2】\n没有人知道他的姓名\n一个人走在 the long road\n路灯照着安静的街道'

describe('给 Claude 的找韵候选', () => {
  it('问到哪一段就只看哪一段', () => {
    expect(sectionFor(draft, '我对 verse two 不太满意').name).toBe('Verse 2')
    expect(sectionFor(draft, '第一段主歌怎么样').name).toBe('')
    expect(sectionFor(draft, '帮我看看').lines.length).toBe(5)
  })
  it('取每行句尾的词，释义不算', () => {
    expect(lineEnd('没有人知道他的姓名，')).toBe('姓名')
    expect(lineEnd('一个人走在 the long road')).toBe('road')
    expect(lineEnd('（这里想写轻松）')).toBe('')
  })
  it('中文和英文都能查到候选', () => {
    expect(candidates('姓名', base)).toMatchObject({ n: 2 })
    expect(candidates('姓名', base, 30)!.words).toContain('病情')
    expect(candidates('road', base)!.words.length).toBeGreaterThan(3)
    expect(candidates('road', { ...base, enIdx: null })).toBeNull()
  })
  it('喜欢的词排前面，屏蔽的词不出现', () => {
    const first = candidates('姓名', base)!.words[0]
    const c = candidates('姓名', { ...base, liked: ['病情'], blocked: [first] })!
    expect(c.words[0]).toBe('病情')
    expect(c.words).not.toContain(first)
  })
  it('整段话里有正在查的词、这一段的句尾和喜欢的词', () => {
    const f = rhymeFacts({ ...base, text: draft, question: 'verse 2 不太押韵，帮我改', query: '中心', liked: ['病情'] })
    expect(f).toContain('针对【Verse 2】')
    expect(f).toContain('中心（双押）')
    expect(f).toContain('姓名（双押）')
    expect(f).toContain('road（')
    expect(f).not.toContain('看海')
    expect(f).toContain('标过喜欢的词（可以优先考虑）：病情')
    expect(rhymeFacts({ ...base, text: '', question: '你好', query: '', liked: [] })).toBe('')
  })
})
