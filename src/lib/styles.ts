// 唱法：起步用的经验值，只用来提醒，不是规定。
export interface Delivery {
  id: string
  name: string
  bpm: [number, number]
  /** 每小节字数的常见范围 */
  perBar: [number, number]
  hook: string
  tip: string
}

export const DELIVERIES: Delivery[] = [
  { id: 'hard', name: '狠 / 攻击', bpm: [85, 100], perBar: [12, 16], hook: '8 小节，短句喊口号、重复', tip: '咬字重，韵脚砸在重拍，少拖音' },
  { id: 'story', name: '叙事', bpm: [85, 95], perBar: [10, 14], hook: '8 小节，简单概括', tip: '说话感，句子可以跨小节' },
  { id: 'playful', name: '戏谑', bpm: [90, 100], perBar: [8, 16], hook: '8 小节，洗脑好记', tip: '突然加速或停顿做笑点' },
  { id: 'chill', name: '慢热 / chill', bpm: [80, 90], perBar: [8, 12], hook: '8 小节，半唱半说', tip: '稍微落后拍子（laid-back），留空拍' },
  { id: 'melodic', name: '抒情 / 旋律', bpm: [70, 90], perBar: [6, 10], hook: '8 小节，唱出来的旋律', tip: '拖音、带音高，韵脚放在长音上' },
]

/** 4/4 拍下一小节的秒数 */
export const barSeconds = (bpm: number) => 240 / bpm

/** 唱得清楚的大致上限：每秒约 6.5 个字，且不超过唱法范围上限 + 2 */
export function maxPerLine(d: Delivery, bpm: number): number {
  return Math.min(d.perBar[1] + 2, Math.floor(barSeconds(bpm) * 6.5))
}

export interface SectionTpl {
  name: string
  bars: number
}

export const REGULAR_TEMPLATE: SectionTpl[] = [
  { name: 'Intro', bars: 4 },
  { name: '主歌1', bars: 16 },
  { name: '副歌', bars: 8 },
  { name: '主歌2', bars: 16 },
  { name: '副歌', bars: 8 },
  { name: 'Outro', bars: 4 },
]
