// 从 jieba 词典（MIT）生成中文押韵词表：node scripts/build-words.mjs <dict.txt 路径>
// 输出 public/data/zh-words.txt，每行：词\t带调拼音（空格分隔）\t常见度(0 常见 / 1 一般 / 2 生僻)
import { readFileSync, writeFileSync } from 'node:fs'
import { pinyin } from 'pinyin-pro'

const src = process.argv[2]
if (!src) throw new Error('用法：node scripts/build-words.mjs <dict.txt>')
const han = /^[一-鿿]{2,4}$/
const out = []
const stat = [0, 0, 0]
for (const line of readFileSync(src, 'utf8').split('\n')) {
  const [w, f, pos] = line.split(' ')
  if (!w || !han.test(w)) continue
  const freq = Number(f)
  const isName = pos === 'nr' || pos === 'nrfg' || pos === 'nrt'
  if (freq < 5) continue
  const proper = pos === 'ns' || pos === 'nt' || pos === 'nz' || pos === 'nrt'
  // 人名、地名、机构名等专有名词：不够常见的归到生僻，默认不显示
  const tier = isName && freq < 1000 ? 2 : proper && freq < 300 ? 2 : freq >= 60 ? 0 : freq >= 15 ? 1 : 2
  const py = pinyin(w, { toneType: 'num', type: 'array', v: true, nonZh: 'removed' })
  if (py.length !== w.length) continue
  out.push([w, py.join(' '), tier, freq])
  stat[tier]++
}
out.sort((a, b) => b[3] - a[3])
writeFileSync('public/data/zh-words.txt', out.map((r) => r.slice(0, 3).join('\t')).join('\n'))
console.log('词数', out.length, '常见/一般/生僻', stat)
