// 说唱常见曲风：专用名词、怎么听出来、大概的速度，和一段能听的鼓点骨架。
// 鼓点是每种曲风最通用的打法，由浏览器合成，不取自任何具体的歌；音色只是示意，真实的味道要去听那个曲风的歌。
import type { Beat } from './beats'

export interface Genre {
  id: string
  /** 圈内通用的英文名 */
  en: string
  /** 中文说法 */
  zh: string
  family: string
  bpm: number
  /** 怎么听出来 */
  plain: string
  /** 搜 type beat 用的关键词 */
  search: string
  beat: Beat
}

export const FAMILIES = ['经典 / 东岸', '西岸 / 匪帮', '南方 / trap 系', 'drill / 俱乐部', '旋律 / 情绪', '迷幻 / 实验', '跨界 / 融合'] as const

type Mood = 'none' | 'dark' | 'bright' | 'dreamy' | 'jazzy' | 'bell' | 'whine' | 'penta' | 'eerie' | 'soul' | 'synth'

// 旋律：格子序号 -> 音名（两小节 32 格）
const LEADS: Record<Mood, Record<number, string>> = {
  none: {},
  dark: { 0: 'C4', 4: 'D#4', 8: 'G4', 12: 'D#4', 16: 'G#3', 20: 'C4', 24: 'D#4', 28: 'D4' },
  bright: { 0: 'E4', 3: 'G4', 6: 'B4', 8: 'A4', 14: 'G4', 16: 'A4', 19: 'C5', 22: 'E5', 24: 'D5', 30: 'B4' },
  dreamy: { 0: 'G4', 8: 'D5', 16: 'A#4', 24: 'F4' },
  jazzy: { 0: 'D4', 3: 'F4', 6: 'A4', 9: 'C5', 16: 'G3', 19: 'B3', 22: 'D4', 25: 'F4' },
  bell: { 0: 'C5', 2: 'C5', 4: 'D#5', 6: 'C5', 8: 'G4', 10: 'C5', 12: 'D#5', 14: 'F5', 16: 'C5', 18: 'C5', 20: 'D#5', 22: 'C5', 24: 'G#4', 26: 'G4', 28: 'F4', 30: 'G4' },
  whine: { 0: 'G5', 6: 'F5', 8: 'D5', 16: 'F5', 22: 'D5', 24: 'C5' },
  penta: { 0: 'A4', 2: 'C5', 4: 'D5', 8: 'E5', 12: 'D5', 16: 'G4', 18: 'A4', 20: 'C5', 24: 'A4', 28: 'E4' },
  eerie: { 0: 'D4', 2: 'D#4', 8: 'A4', 10: 'G#4', 16: 'D4', 18: 'C#4', 24: 'G#3', 28: 'A3' },
  soul: { 0: 'C5', 2: 'E5', 4: 'G5', 8: 'E5', 12: 'D5', 16: 'A4', 18: 'C5', 20: 'E5', 24: 'D5', 28: 'B4' },
  synth: { 0: 'F4', 1: 'F4', 3: 'G#4', 4: 'F4', 6: 'C5', 8: 'F4', 9: 'F4', 11: 'G#4', 12: 'A#4', 16: 'D#4', 17: 'D#4', 19: 'G4', 20: 'D#4', 22: 'A#4', 24: 'C4', 28: 'D#4' },
}

// 低音跟着底鼓走：第一小节一个音，第二小节换一个
const ROOTS: Record<Mood, [string, string]> = {
  none: ['C1', 'C1'], dark: ['C1', 'G#0'], bright: ['E1', 'A1'], dreamy: ['G1', 'D#1'], jazzy: ['D1', 'G1'], bell: ['C1', 'G#0'],
  whine: ['G1', 'F1'], penta: ['A1', 'G1'], eerie: ['D1', 'A#0'], soul: ['C1', 'A1'], synth: ['F1', 'D#1'],
}

const two = (p: string) => (p.length === 16 ? p + p : p).padEnd(32, '.').slice(0, 32)

interface Spec {
  id: string
  en: string
  zh: string
  bpm: number
  k: string
  s: string
  h: string
  mood: Mood
  swing?: number
  /** 这个曲风不用低音跟底鼓（比如无鼓、清唱感） */
  noBass?: boolean
  plain: string
  search?: string
}

const build = (family: string, list: Spec[]): Genre[] =>
  list.map((g) => {
    const kick = two(g.k)
    const bass: Record<number, string> = {}
    if (!g.noBass) [...kick].forEach((c, i) => c === 'x' && (bass[i] = ROOTS[g.mood][i < 16 ? 0 : 1]))
    return {
      id: g.id, en: g.en, zh: g.zh, family, bpm: g.bpm, plain: g.plain, search: g.search ?? g.en,
      beat: { id: g.id, name: g.en, mood: g.zh, bpm: g.bpm, desc: g.plain, kick, snare: two(g.s), hat: two(g.h), bass, lead: LEADS[g.mood], swing: g.swing },
    }
  })

const H8 = 'x.x.x.x.x.x.x.x.'
const H16 = 'xxxxxxxxxxxxxxxx'
const H4 = 'x...x...x...x...'
const OFF = '..x...x...x...x.'
const S24 = '....x.......x...'
const S3 = '........x.......'
const NO = '................'
// trap 的镲：16 分音符里夹几处更密的滚奏
const HROLL = 'x.x.x.x.x.xxx.x.x.x.x.x.x.x.xxxx'
const HTRIP = 'xxx.xxx.x.xxxxx.xxx.xxx.x.xxxxxx'
// drill 的镲：3+3+2 的分法
const H332 = 'x..x..x.x..x..x.'

export const GENRES: Genre[] = [
  ...build('经典 / 东岸', [
    { id: 'boom-bap', en: 'Boom Bap', zh: '东岸经典', bpm: 90, k: 'x......x..x.....', s: S24, h: H8, mood: 'jazzy', swing: 0.35, plain: '底鼓“咚”、军鼓“啪”一下一下很清楚，军鼓落在第 2、4 拍，采样一段老唱片循环。最适合讲故事和玩押韵' },
    { id: 'jazz-rap', en: 'Jazz Rap', zh: '爵士说唱', bpm: 88, k: 'x.........x..x..', s: S24, h: H8, mood: 'jazzy', swing: 0.45, plain: 'boom bap 的鼓，上面是爵士的钢琴、贝斯、萨克斯，摇摆感更重，松弛', search: 'jazz rap jazzy boom bap' },
    { id: 'chill', en: 'Chill / Laid-back', zh: '松弛日常', bpm: 85, k: 'x.........x.....', s: S24, h: H8, mood: 'soul', swing: 0.4, plain: '慢一点的 boom bap，温柔的和弦，像说话一样唱，留很多空', search: 'chill boom bap' },
    { id: 'lofi', en: 'Lo-fi Hip Hop', zh: '低保真', bpm: 80, k: 'x......x..x.....', s: S24, h: 'x.x.x.x.x.x.x...', mood: 'dreamy', swing: 0.5, plain: '故意做旧：有底噪、音有点跑、鼓拖在拍子后面，听着像旧磁带', search: 'lofi hip hop' },
    { id: 'soul-sample', en: 'Chipmunk Soul', zh: '灵魂采样', bpm: 92, k: 'x..x......x.....', s: S24, h: H8, mood: 'soul', swing: 0.3, plain: '把老灵魂乐的人声采样加速、升调，变成尖尖的“花栗鼠”声当旋律，温暖、怀旧', search: 'soul sample chipmunk soul' },
    { id: 'hardcore', en: 'Hardcore Hip Hop', zh: '硬核', bpm: 95, k: 'x..x..x...x..x..', s: S24, h: H8, mood: 'dark', swing: 0.2, plain: '鼓很重很脏，采样阴沉，唱得凶，没有什么旋律', search: 'hardcore boom bap dark' },
    { id: 'old-school', en: 'Old School / Electro', zh: '老学校', bpm: 110, k: 'x..x..x...x..x..', s: S24, h: H16, mood: 'synth', plain: '八十年代的鼓机和合成器，节奏直来直去，像在派对上喊话' , search: 'old school hip hop electro 808' },
    { id: 'drumless', en: 'Drumless', zh: '无鼓', bpm: 80, k: NO, s: NO, h: NO, mood: 'soul', noBass: true, plain: '几乎没有鼓，只有一段采样循环，全靠人声自己的节奏撑住。很考验 flow 和词', search: 'drumless sample loop' },
    { id: 'conscious', en: 'Conscious Rap', zh: '意识说唱', bpm: 86, k: 'x.....x...x.....', s: S24, h: H8, mood: 'jazzy', swing: 0.35, plain: '这个词说的是内容：讲社会、自我、思考。beat 多半是 boom bap 或爵士、灵魂味，给词让路', search: 'conscious rap soulful' },
  ]),
  ...build('西岸 / 匪帮', [
    { id: 'g-funk', en: 'G-Funk', zh: '西岸放克', bpm: 94, k: 'x..x....x.x.....', s: S24, h: H8, mood: 'whine', swing: 0.15, plain: '慢悠悠的放克律动，很厚的贝斯，上面飘一条又尖又细的合成器长音。阳光、敞篷车的感觉', search: 'g-funk west coast' },
    { id: 'gangsta', en: 'Gangsta Rap', zh: '匪帮说唱', bpm: 92, k: 'x.....x.x.x.....', s: S24, h: H8, mood: 'eerie', swing: 0.1, plain: '这个词主要说内容和态度：街头、冷硬。beat 常是 G-funk 或阴沉的钢琴加重鼓', search: 'gangsta rap west coast piano' },
    { id: 'ratchet', en: 'Ratchet / West Coast Bounce', zh: '西岸弹跳', bpm: 98, k: 'x.....x...x.....', s: S24, h: OFF, mood: 'synth', plain: '很空：一个短促的低音、拍手落在 2、4 拍、后面跟“嘿”的喊声，镲只在反拍。适合夜店', search: 'west coast bounce ratchet club' },
    { id: 'hyphy', en: 'Hyphy', zh: '湾区嗨飞', bpm: 102, k: 'x..x..x...x.x...', s: S24, h: H16, mood: 'synth', plain: '旧金山湾区的派对风格，鼓很跳，合成器吵闹，整体很亢奋', search: 'hyphy bay area' },
  ]),
  ...build('南方 / trap 系', [
    { id: 'trap', en: 'Trap', zh: '陷阱', bpm: 140, k: 'x.....x...x.....x......x..x.....', s: S3, h: HROLL, mood: 'dark', plain: '军鼓只落在第 3 拍，听起来慢一半；镲很碎，还会突然滚一串；低音是又长又沉的 808。现在最主流的打法', search: 'trap' },
    { id: 'dirty-south', en: 'Dirty South', zh: '南方说唱', bpm: 80, k: 'x..x..x...x.....', s: S24, h: H16, mood: 'dark', plain: '南方说唱的统称：速度慢、低音重、鼓机味浓，trap 就是从这里长出来的', search: 'dirty south' },
    { id: 'crunk', en: 'Crunk', zh: '嗑朗', bpm: 78, k: 'x...x..x.x..x...', s: S24, h: H16, mood: 'synth', plain: '为了让全场一起吼：简单粗暴的合成器、重拍手、反复喊口号', search: 'crunk' },
    { id: 'memphis', en: 'Memphis Rap', zh: '孟菲斯', bpm: 130, k: 'x..x..x...x..x..', s: S3, h: H8, mood: 'bell', plain: '阴森、粗糙，像旧磁带；标志是牛铃敲出来的旋律和反复的人声采样', search: 'memphis rap cowbell' },
    { id: 'phonk', en: 'Phonk', zh: '漂移 phonk', bpm: 130, k: 'x..x..x.x..x..x.', s: S3, h: H8, mood: 'bell', plain: '从孟菲斯来的：牛铃旋律、失真的低音、切碎的人声。快的那种（drift phonk）常配赛车视频', search: 'phonk cowbell drift' },
    { id: 'screwed', en: 'Chopped & Screwed', zh: '慢放切碎', bpm: 65, k: 'x.....x...x.....', s: S24, h: H8, mood: 'dreamy', plain: '把整首歌放慢、降调，再把某些片段重复切一下，听着发晕、黏稠', search: 'chopped and screwed slowed' },
    { id: 'bounce', en: 'Bounce', zh: '新奥尔良弹跳', bpm: 100, k: 'x..x..x.x..x..x.', s: S24, h: H16, mood: 'none', plain: '一直重复同一个很跳的鼓点，配一问一答的喊话，就是为了跳舞', search: 'new orleans bounce' },
    { id: 'miami-bass', en: 'Miami Bass', zh: '迈阿密低音', bpm: 128, k: 'x..x..x...x.x...', s: S24, h: H16, mood: 'none', plain: '快、低音轰隆隆、镲很密，早期鼓机的声音，派对用', search: 'miami bass' },
    { id: 'snap', en: 'Snap', zh: '响指', bpm: 76, k: 'x.....x.x.......', s: S24, h: NO, mood: 'none', plain: '把军鼓换成打响指，东西非常少：一个低音、一个响指、一点点旋律', search: 'snap music' },
    { id: 'trap-soul', en: 'Trap Soul / Melodic Trap', zh: '旋律 trap', bpm: 130, k: 'x.........x.....x......x........', s: S3, h: 'x.x.x.x.x.x.x.x.x.x.x.xxx.x.x.x.', mood: 'dreamy', plain: 'trap 的鼓，但更软更空，上面是 R&B 的和弦，半唱半说', search: 'trap soul melodic' },
    { id: 'plugg', en: 'Plugg', zh: 'plugg', bpm: 145, k: 'x.....x...x.....x.....x..x......', s: S3, h: 'x.x.x.x.x.x.x.x.x.x.x.x.x.xxx.x.', mood: 'bright', plain: '轻飘飘的 trap：亮晶晶的铃声和合成器，鼓不重，听着像游戏音乐。更甜更 R&B 的叫 pluggnb', search: 'plugg pluggnb' },
    { id: 'rage', en: 'Rage', zh: 'rage', bpm: 150, k: 'x..x......x.....x..x......x..x..', s: S3, h: HTRIP, mood: 'synth', plain: '又响又满的合成器像电子游戏里的警报，808 失真，从头炸到尾', search: 'rage' },
    { id: 'detroit', en: 'Detroit', zh: '底特律', bpm: 100, k: 'x..x..x..x..x.x.', s: S24, h: H16, mood: 'eerie', plain: '底鼓很密而且常落在意想不到的反拍，钢琴阴沉；唱的人故意抢在拍子前面，像在追 beat', search: 'detroit type beat' },
    { id: 'trap-metal', en: 'Trap Metal', zh: '金属 trap', bpm: 150, k: 'x..x..x...x.x...', s: S3, h: HTRIP, mood: 'eerie', plain: 'trap 的鼓加失真吉他和嘶吼，极度暴躁', search: 'trap metal' },
  ]),
  ...build('drill / 俱乐部', [
    { id: 'chicago-drill', en: 'Chicago Drill', zh: '芝加哥 drill', bpm: 140, k: 'x......x..x.....x.....x...x.....', s: S3, h: HROLL, mood: 'eerie', plain: 'drill 的源头：像更冷更阴的 trap，铜管和钢琴很压抑，唱得面无表情', search: 'chicago drill' },
    { id: 'uk-drill', en: 'UK Drill', zh: '英式 drill', bpm: 140, k: 'x..x......x.....x.....x..x......', s: '........x...................x...', h: H332, mood: 'dark', plain: '镲是“哒..哒..哒.”的 3+3+2 分法，军鼓落点错开（第一小节第 3 拍、第二小节第 4 拍），低音会滑上滑下', search: 'uk drill' },
    { id: 'ny-drill', en: 'NY / Brooklyn Drill', zh: '纽约 drill', bpm: 142, k: 'x..x..x...x.....x.....x..x..x...', s: '........x...................x...', h: H332, mood: 'eerie', plain: '用英式 drill 的鼓，更凶更满，常采样大家熟悉的老歌', search: 'ny drill brooklyn drill' },
    { id: 'jersey-club', en: 'Jersey Club', zh: '泽西俱乐部', bpm: 138, k: 'x...x...x..x..x.', s: S24, h: OFF, mood: 'bright', plain: '底鼓是“咚 咚 咚 咚咚”：前三下在拍子上，后两下挤在一起。很跳，常夹床垫吱呀声之类的采样', search: 'jersey club' },
    { id: 'grime', en: 'Grime', zh: '英国 grime', bpm: 140, k: 'x.....x...x.....', s: S24, h: 'x..x..x.x..x..x.', mood: 'synth', plain: '英国的：速度快，冰冷的方波合成器和游戏机音色，鼓不规整，唱得又快又冲', search: 'grime instrumental' },
    { id: 'club-rap', en: 'Club / Dance Rap', zh: '舞曲说唱', bpm: 124, k: H4, s: S24, h: OFF, mood: 'synth', plain: '底鼓每拍一下（四踩），像 house 舞曲，在上面说唱', search: 'hip house club rap' },
  ]),
  ...build('旋律 / 情绪', [
    { id: 'melodic', en: 'Melodic Rap', zh: '旋律说唱', bpm: 78, k: 'x...............x.....x.........', s: S3, h: H4, mood: 'dreamy', plain: '慢、长音旋律，一半在唱，鼓让到后面，留给情绪', search: 'melodic rap sad' },
    { id: 'emo-rap', en: 'Emo Rap', zh: '情绪说唱', bpm: 150, k: 'x.....x...x.....x.........x.....', s: S3, h: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.xxx.', mood: 'dreamy', plain: 'trap 的鼓配一段伤感的吉他，唱的是低落、心碎，带摇滚的嗓子', search: 'emo rap guitar' },
    { id: 'cloud-rap', en: 'Cloud Rap', zh: '云端说唱', bpm: 130, k: 'x.........x.....x.....x.........', s: S3, h: 'x...x...x...x.x.x...x...x...xxx.', mood: 'dreamy', plain: '像飘在云里：很多混响、朦胧的铺底音色，鼓稀疏，唱得懒洋洋', search: 'cloud rap ethereal' },
    { id: 'rnb', en: 'R&B / Neo Soul', zh: '节奏布鲁斯', bpm: 82, k: 'x.....x...x..x..', s: S24, h: H8, mood: 'soul', swing: 0.45, plain: '柔软的电钢琴和贝斯，鼓摇摆、偏后，适合半唱半说、写感情', search: 'rnb neo soul' },
    { id: 'pop-rap', en: 'Pop Rap', zh: '流行说唱', bpm: 100, k: 'x..x....x.x.....', s: S24, h: H8, mood: 'bright', plain: '明亮、好记，副歌是能跟着唱的旋律，主歌说唱', search: 'pop rap catchy' },
    { id: 'gospel', en: 'Gospel Rap', zh: '福音说唱', bpm: 88, k: 'x.....x...x.....', s: S24, h: H8, mood: 'soul', swing: 0.3, plain: '合唱团、管风琴和拍手，宏大、往上扬的感觉', search: 'gospel rap choir' },
    { id: 'chinese-style', en: 'Chinese Style', zh: '中国风', bpm: 90, k: 'x.....x...x.....', s: S24, h: H8, mood: 'penta', swing: 0.2, plain: '五声音阶的旋律，用古筝、笛子、琵琶这类音色，鼓可以是 boom bap 也可以是 trap', search: 'chinese style oriental' },
  ]),
  ...build('迷幻 / 实验', [
    { id: 'psychedelic', en: 'Psychedelic / Trippy', zh: '迷幻', bpm: 130, k: 'x.....x...x.....x.....x....x....', s: S3, h: 'x.x.x.x.x.xxx.x.x.x.x...x.x.xxxx', mood: 'eerie', plain: '音色会晃、会扭曲，像隔着水听；回声很长，人声常被调得很飘', search: 'psychedelic trippy trap' },
    { id: 'trip-hop', en: 'Trip Hop', zh: '神游', bpm: 80, k: 'x.....x..x......', s: S24, h: H8, mood: 'eerie', swing: 0.3, plain: '很慢的碎拍，阴郁、电影感，低音厚，像深夜的城市', search: 'trip hop dark' },
    { id: 'abstract', en: 'Abstract / Experimental', zh: '抽象实验', bpm: 88, k: 'x....x....x..x..', s: '....x........x..', h: 'x.x..x.x.x..x.x.', mood: 'jazzy', swing: 0.5, plain: '鼓故意不在格子上，像喝醉了一样晃；结构和采样都不按常理', search: 'abstract hip hop experimental off-kilter' },
    { id: 'horrorcore', en: 'Horrorcore', zh: '恐怖核', bpm: 85, k: 'x..x......x.....', s: S24, h: H8, mood: 'eerie', swing: 0.1, plain: '恐怖片配乐的感觉：不和谐的钢琴、弦乐、尖叫采样', search: 'horrorcore dark' },
    { id: 'industrial', en: 'Industrial Hip Hop', zh: '工业', bpm: 100, k: 'x.x...x.x.x...x.', s: S24, h: H16, mood: 'none', plain: '像工厂里的噪音：金属撞击、失真、刺耳，鼓又硬又机械', search: 'industrial hip hop distorted' },
    { id: 'hyperpop', en: 'Hyperpop / Digicore', zh: '超流行', bpm: 160, k: 'x..x..x...x.x...', s: S3, h: H16, mood: 'bright', plain: '一切都夸张到极点：人声调得很尖，音色很亮很吵，速度很快', search: 'hyperpop digicore' },
  ]),
  ...build('跨界 / 融合', [
    { id: 'reggaeton', en: 'Reggaeton / Latin Trap', zh: '雷鬼顿', bpm: 95, k: H4, s: '...x..x....x..x.', h: H8, mood: 'bright', plain: '底鼓每拍一下，军鼓切在拍子之间，“咚-哒咚-哒”一直摇，叫 dembow 节奏', search: 'reggaeton latin trap dembow' },
    { id: 'afro', en: 'Afrobeats / Afroswing', zh: '非洲节拍', bpm: 105, k: 'x..x..x...x..x..', s: '..x...x...x...x.', h: H16, mood: 'bright', plain: '很多层打击乐交错，重音不在正拍上，轻快、适合扭', search: 'afrobeats afroswing' },
    { id: 'brazilian-funk', en: 'Brazilian Funk', zh: '巴西放克', bpm: 130, k: 'x..x..x.x..x..x.', s: '....x..x....x..x', h: NO, mood: 'none', plain: '一个固定的、很硬的鼓点从头打到尾，低音失真，人声短促重复', search: 'brazilian funk' },
    { id: 'rap-rock', en: 'Rap Rock / Nu Metal', zh: '说唱摇滚', bpm: 96, k: 'x.x...x.x.x.....', s: S24, h: H8, mood: 'dark', plain: '真鼓、失真吉他的重复乐句，主歌说唱、副歌吼或唱', search: 'rap rock nu metal' },
    { id: 'dancehall', en: 'Dancehall / Reggae', zh: '雷鬼舞厅', bpm: 96, k: 'x.....x...x.....', s: '...x..x....x..x.', h: OFF, mood: 'bright', plain: '重音落在反拍上，低音松弛，人声带牙买加式的拖腔', search: 'dancehall reggae' },
  ]),
]

export const genreOf = (id: string) => GENRES.find((g) => g.id === id)
