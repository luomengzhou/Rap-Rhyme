// 唱法：按说唱里常说的几大类来分。数字是起步用的经验值，只用来提醒，不是规定。
export interface Delivery {
  id: string
  /** 通用的英文叫法 */
  en: string
  name: string
  bpm: [number, number]
  /** 每小节字数的常见范围 */
  perBar: [number, number]
  /** 这种唱法每秒大概最多能咬清几个字 */
  rate: number
  hook: string
  tip: string
}

export const DELIVERIES: Delivery[] = [
  { id: 'boom-bap', en: 'Boom Bap', name: '东岸硬核', bpm: [85, 98], perBar: [10, 14], rate: 6.5, hook: '8 小节，短句、好跟着念', tip: '字踩在鼓点上，咬字清楚，韵脚落在第 2、4 拍的军鼓附近' },
  { id: 'story', en: 'Storytelling / Conscious', name: '叙事', bpm: [80, 95], perBar: [10, 14], rate: 6.5, hook: '8 小节，一句话概括主题', tip: '说话感，句子可以跨小节，韵为内容让路' },
  { id: 'hardcore', en: 'Hardcore', name: '硬核 / 攻击', bpm: [85, 100], perBar: [12, 16], rate: 7, hook: '8 小节，喊口号、重复', tip: '咬字重，句尾砸在重拍上，少拖音' },
  { id: 'trap', en: 'Trap', name: '陷阱', bpm: [130, 160], perBar: [6, 12], rate: 6.5, hook: '8 小节，几个词反复，留出空拍', tip: '三连音（哒哒哒一组）和短句交替，句尾常接一声 ad-lib' },
  { id: 'drill', en: 'Drill', name: '钻头', bpm: [138, 146], perBar: [8, 12], rate: 6.5, hook: '8 小节，冷着念，句尾下沉', tip: '切分多，字常常抢在拍子前面，语气平、压着说' },
  { id: 'melodic', en: 'Melodic Rap', name: '旋律说唱', bpm: [70, 150], perBar: [6, 10], rate: 5, hook: '8 小节，唱出来的旋律', tip: '带音高、拖长音，韵脚放在长音上' },
  { id: 'chill', en: 'Jazz Rap / Lo-fi', name: '松弛 / chill', bpm: [75, 92], perBar: [8, 12], rate: 6, hook: '8 小节，半唱半说', tip: '稍微落在拍子后面（laid-back），多留空拍' },
  { id: 'chopper', en: 'Chopper', name: '快嘴', bpm: [90, 140], perBar: [16, 24], rate: 10, hook: '8 小节，放慢下来，和主歌形成对比', tip: '一拍塞三四个字，先慢练咬字再提速，气口提前设计好' },
  { id: 'old-school', en: 'Old School', name: '老派', bpm: [95, 112], perBar: [8, 12], rate: 6, hook: '4 或 8 小节，一问一答、适合合唱', tip: '句子规整，句尾押韵，重音很明显' },
]

/** 旧版的唱法分类对应到现在的哪一类 */
const OLD_DELIVERY: Record<string, string> = { hard: 'hardcore', playful: 'boom-bap' }
export const deliveryOf = (id: string): Delivery => DELIVERIES.find((d) => d.id === (OLD_DELIVERY[id] ?? id)) ?? DELIVERIES[0]

/** 4/4 拍下一小节的秒数 */
export const barSeconds = (bpm: number) => 240 / bpm

/** 唱得清楚的大致上限：按这种唱法每秒能咬清的字数算，且不超过唱法范围上限 + 2 */
export function maxPerLine(d: Delivery, bpm: number): number {
  return Math.min(d.perBar[1] + 2, Math.floor(barSeconds(bpm) * d.rate))
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
