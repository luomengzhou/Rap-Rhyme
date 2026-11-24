import { describe, expect, it } from 'vitest'
import { buildInput, splitReply } from './ai'

describe('网站里的 Claude', () => {
  it('把回答拆成文字和建议', () => {
    const raw = '这段主要押 an。\n\n```json\n{"suggestions":[{"tag":"押韵","title":"换成泛滥","reason":"双押","edits":[{"find":"所以不加阻拦","replace":"所以任它泛滥"}]},{"title":"没有改动","edits":[]}]}\n```'
    const r = splitReply(raw)
    expect(r.text).toBe('这段主要押 an。')
    expect(r.suggestions).toHaveLength(1)
    expect(r.suggestions[0].edits[0].replace).toBe('所以任它泛滥')
  })
  it('还没写完或写坏的代码块不显示也不报错', () => {
    expect(splitReply('先说两句\n```json\n{"suggestions":[{"ti')).toEqual({ text: '先说两句', suggestions: [], materials: [] })
    expect(splitReply('好\n```json\n不是 json\n```').suggestions).toEqual([])
    expect(splitReply('只是聊天').text).toBe('只是聊天')
  })
  it('素材卡片和写进末尾的提纲', () => {
    const raw = '好\n```json\n{"materials":[{"kind":"神话","title":"皮格马利翁","source":"奥维德《变形记》","text":"大意：雕刻家爱上自己的雕像","use":"把她写成你亲手供起来的神像"},{"kind":"x"}],"suggestions":[{"tag":"结构","title":"提纲","edits":[{"find":"","replace":"【verse 1】\\n（相遇）"}]}]}\n```'
    const r = splitReply(raw)
    expect(r.materials).toHaveLength(1)
    expect(r.materials[0].source).toContain('变形记')
    expect(r.suggestions[0].edits[0].find).toBe('')
  })
  it('对话以规则和草稿开头，以用户的话结尾', () => {
    const input = buildInput('歌', '第一行', [{ role: 'user', content: '帮我看看' }])
    expect(input[0].role).toBe('user')
    expect(input[0].content).toContain('第一行')
    expect(input.at(-1)?.content).toBe('帮我看看')
  })
})
