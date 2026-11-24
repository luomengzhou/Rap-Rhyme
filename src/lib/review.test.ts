import { describe, expect, it } from 'vitest'
import { applyReview, diffLines, locate, parseReview, type Review } from './review'

const TEXT = `【verse 1】
请继续沉寂 沉溺 乖乖安睡别惊醒
我慢慢吐息 舒气 毕竟味道还可以

【verse 2】
车子 票子 homie 还有马子
谁给你的胆子？赶紧想个法子
所以不加**阻拦**`

const review: Review = {
  title: '测试',
  suggestions: [
    { id: 'a', tag: '押韵', title: '泛滥', reason: '', edits: [{ find: '所以不加阻拦', replace: '所以任它泛滥' }], options: ['所以随它泛滥'] },
    { id: 'b', tag: '结构', title: '抽出 hook', reason: '', edits: [
      { find: '车子 票子 homie 还有马子\n谁给你的胆子？赶紧想个法子', replace: '' },
      { find: '【verse 2】', replace: '【hook】\n车子 票子 homie 还有马子\n\n【verse 2】' },
    ] },
    { id: 'c', tag: '表达', title: '找不到的', reason: '', edits: [{ find: '这句不存在', replace: 'x' }] },
    { id: 'd', tag: '押韵', title: '和 a 冲突', reason: '', edits: [{ find: '不加阻拦', replace: '袖手旁观' }] },
  ],
}

describe('改稿', () => {
  it('定位时忽略空白和加粗符号', () => {
    const span = locate(TEXT, '所以不加阻拦')!
    expect(TEXT.slice(span.start, span.end)).toBe('所以不加**阻拦**')
    expect(locate(TEXT, '沉寂沉溺')).not.toBeNull()
    expect(locate(TEXT, '没有这句')).toBeNull()
  })
  it('没接受任何建议时原稿不变', () => {
    expect(applyReview(TEXT, review, new Set()).text).toBe(TEXT)
  })
  it('只应用接受的建议，支持换一种写法', () => {
    expect(applyReview(TEXT, review, new Set(['a'])).text).toContain('所以任它泛滥')
    expect(applyReview(TEXT, review, new Set(['a']), { a: 0 }).text).toContain('所以随它泛滥')
  })
  it('一条建议里的多处改动一起生效，删掉的行不留空行', () => {
    const out = applyReview(TEXT, review, new Set(['b'])).text
    expect(out).toContain('【hook】\n车子 票子 homie 还有马子\n\n【verse 2】\n所以不加**阻拦**')
    expect(out.match(/车子/g)!.length).toBe(1)
  })
  it('找不到原文和互相冲突的建议会标出来', () => {
    const { status, text } = applyReview(TEXT, review, new Set(['a', 'c', 'd']))
    expect(status).toMatchObject({ a: 'ok', b: 'ok', c: 'missing', d: 'conflict' })
    expect(text).toContain('任它泛滥')
  })
  it('全角半角标点都能对上，断行不留行尾空格', () => {
    expect(locate(TEXT, '谁给你的胆子?赶紧')).not.toBeNull()
    const r: Review = { title: 't', suggestions: [{ id: 'x', tag: '长度', title: '', reason: '', edits: [{ find: '乖乖安睡', replace: '\n乖乖安睡' }] }] }
    expect(applyReview(TEXT, r, new Set(['x'])).text).toContain('请继续沉寂 沉溺\n乖乖安睡别惊醒')
  })
  it('find 为空时加在草稿末尾，空草稿直接写入', () => {
    const r: Review = { title: 't', suggestions: [{ id: 'o', tag: '结构', title: '', reason: '', edits: [{ find: '', replace: '【verse 1】\n相遇' }] }] }
    expect(applyReview('', r, new Set(['o'])).text).toBe('【verse 1】\n相遇')
    expect(applyReview('已有一行', r, new Set(['o'])).text).toBe('已有一行\n\n【verse 1】\n相遇')
    expect(applyReview('已有一行', r, new Set()).status.o).toBe('ok')
  })
  it('按行对比', () => {
    const rows = diffLines('a\nb\nc', 'a\nB\nc\nd')
    expect(rows.map((r) => r.kind)).toEqual(['same', 'removed', 'added', 'same', 'added'])
    expect(diffLines('今天的天气不错\n走', '今天的天气很好\n走').map((r) => r.kind)).toEqual(['changed', 'same'])
  })
  it('校验建议文件', () => {
    expect(() => parseReview('nope')).toThrow()
    expect(() => parseReview('{"title":"x"}')).toThrow()
    expect(parseReview(JSON.stringify(review)).suggestions.length).toBe(4)
  })
})
