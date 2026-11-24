import { engine } from '../lib/beats'
import { useStored } from '../lib/store'

interface Demo {
  label: string
  run: (bpm: number) => void
}
interface Card {
  id: string
  title: string
  rule: string
  body: string
  listen: string
  demos: Demo[]
}

const range = (n: number, step = 1) => Array.from({ length: n }, (_, i) => i * step)
const MINOR = ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4']
const MAJOR = ['A3', 'B3', 'C#4', 'D4', 'E4', 'F#4', 'G#4', 'A4']

const CARDS: Card[] = [
  {
    id: 'beat', title: '拍、BPM、小节',
    rule: '4/4 拍：一小节 4 拍，跟着数 1、2、3、4。BPM 是每分钟多少拍。',
    body: '一小节的时长 = 240 ÷ BPM 秒。90 BPM 一小节约 2.7 秒，140 BPM 约 1.7 秒。写词时“一行一小节”是最常见的起步写法。',
    listen: '随便放一首你喜欢的歌，跟着鼓点数 1、2、3、4：军鼓（最响的“啪”）通常落在第 2、4 拍。',
    demos: [{ label: '听两小节的拍点（高音是第 1 拍）', run: (bpm) => engine.demo(bpm, range(8, 4), [0, 16]) }],
  },
  {
    id: 'division', title: '音符时值：8 分、16 分、三连音',
    rule: '把一拍切成 2 份是 8 分音符，切成 4 份是 16 分，切成 3 份是三连音。',
    body: '中文一个字一个音节，所以一小节全用 8 分音符是 8 个字，全用 16 分是 16 个字，全用三连音是 12 个字。大多数 flow 是这几种的混合，再加上休止。',
    listen: '三连音 flow 最容易认：哒哒哒、哒哒哒，每拍三个字。很多 trap 歌的主歌是这种节奏；只听节奏就行，不用管词。',
    demos: [
      { label: '8 分：每小节 8 下', run: (bpm) => engine.demo(bpm, range(8, 2), [0, 4, 8, 12]) },
      { label: '16 分：每小节 16 下', run: (bpm) => engine.demo(bpm, range(16), [0, 4, 8, 12]) },
      { label: '三连音：每小节 12 下', run: (bpm) => engine.demo(bpm, range(12), [0, 3, 6, 9], '8t') },
    ],
  },
  {
    id: 'accent', title: '重拍与切分',
    rule: '韵脚落在拍点上听起来稳、狠；落在两拍之间（切分）听起来跳、松。',
    body: '同样的字数，把重音从拍点上挪开半拍，律动就变了。数来宝的感觉往往来自每句的韵脚都砸在同一个位置。想避免，就换一换韵脚落的格子。',
    listen: '对比同一个歌手的硬核歌和轻松的歌，留意每句最后一个字落在拍点上，还是抢在拍点前面。',
    demos: [
      { label: '重音在拍点上', run: (bpm) => engine.demo(bpm, range(16), [0, 4, 8, 12]) },
      { label: '重音在两拍之间', run: (bpm) => engine.demo(bpm, range(16), [3, 6, 11, 14]) },
    ],
  },
  {
    id: 'rest', title: '换气与留空',
    rule: '不唱的地方也是节奏的一部分。少几个字，剩下的字反而更重。',
    body: '新手最常见的问题是把一小节塞满。先决定在哪里换气（通常是小节末尾留一两格），再往里填字。一句话太长就拆成两小节。',
    listen: '找一首慢速、压迫感强的歌，数一数每小节其实只有几个字。',
    demos: [
      { label: '塞满的一小节', run: (bpm) => engine.demo(bpm, range(16), [0, 4, 8, 12]) },
      { label: '留空的一小节', run: (bpm) => engine.demo(bpm, [0, 2, 3, 6, 8, 10, 11], [0, 8]) },
    ],
  },
  {
    id: 'key', title: '大调与小调',
    rule: '小调听起来暗、紧张；大调听起来亮、开阔。暗黑风的 beat 几乎都是小调。',
    body: '两者只差几个音：把大调的第 3、6、7 个音各降半音就是小调。说唱不需要你唱准音高，但选 beat 时知道“想要暗就找小调”就够用了。',
    listen: '底部 beat 里的“暗黑 trap”是小调，“chill boom bap”偏大调，来回切换听区别。',
    demos: [
      { label: '小调音阶', run: (bpm) => engine.demo(bpm, range(8, 2), [], '16n', MINOR) },
      { label: '大调音阶', run: (bpm) => engine.demo(bpm, range(8, 2), [], '16n', MAJOR) },
    ],
  },
  {
    id: 'hook', title: 'Hook 怎么写得好记',
    rule: '字少、重复、有一点旋律。主歌讲内容，hook 只讲一件事。',
    body: '常见做法：一句核心的话重复两到四次，每次结尾稍微变一下；节奏比主歌简单，留出长音。8 小节的 hook 其实常常只是 2 小节的句子重复 4 遍。',
    listen: '挑三首你最喜欢的歌，把 hook 的词抄下来，数一数不重复的句子有几句。',
    demos: [{ label: '一个 2 小节的 hook 节奏', run: (bpm) => engine.demo(bpm, [0, 3, 6, 8, 16, 19, 22, 24], [0, 16]) }],
  },
  {
    id: 'structure', title: '歌曲结构',
    rule: '规整的写法：Intro 4 → 主歌 16 → 副歌 8 → 主歌 16 → 副歌 8 → Outro 4（小节）。',
    body: '4 小节是一个乐句，鼓和旋律通常每 4 或 8 小节变化一次，所以段落长度是 4 的倍数时最顺。12 小节主歌、没有副歌、中途换 beat 都是常见的不规整写法，先会规整的再打破它。',
    listen: '听歌时数小节：从主歌第一句开始数到副歌进来，看是不是 16。',
    demos: [],
  },
]

export function TheoryView({ bpm }: { bpm: number }) {
  const [notes, setNotes] = useStored<Record<string, string>>('rr.theoryNotes', {})
  return (
    <div className="theory">
      <h2>乐理卡</h2>
      <p className="muted">每张卡一个概念：先听例子，再看规则，最后在“我的归纳”里用自己的话写下来。示范用的是底部的 BPM（现在 {bpm}）。</p>
      <div className="cards">
        {CARDS.map((c, i) => (
          <article key={c.id}>
            <h3><span>{i + 1}</span>{c.title}</h3>
            <p className="rule">{c.rule}</p>
            <p>{c.body}</p>
            {c.demos.length > 0 && (
              <div className="demos">
                {c.demos.map((d) => (
                  <button key={d.label} onClick={() => d.run(bpm)}>▶ {d.label}</button>
                ))}
              </div>
            )}
            <p className="listen"><b>去听</b>{c.listen}</p>
            <textarea
              placeholder="我的归纳：听完之后自己的总结、对应的歌和时间点"
              value={notes[c.id] ?? ''}
              onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })}
            />
          </article>
        ))}
      </div>
    </div>
  )
}
