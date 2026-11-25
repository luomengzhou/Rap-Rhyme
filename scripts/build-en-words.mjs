// 生成英文押韵词表：node scripts/build-en-words.mjs <cmu-pronouncing-dictionary/index.js> <subtlex-word-frequencies/index.json>
// 读音来自 CMU Pronouncing Dictionary，常见度按 SUBTLEX-US 的词频排（只用来分档，不保存频次）。
// 输出 public/data/en-words.txt，每行：词\t音素（空格分隔，元音带重音数字）\t常见度(0 常见 / 1 一般 / 2 生僻)，按常见度从高到低排。
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const [cmuPath, freqPath] = process.argv.slice(2)
if (!cmuPath || !freqPath) throw new Error('用法见文件开头')
const { dictionary } = await import(pathToFileURL(cmuPath).href)
const freq = JSON.parse(readFileSync(freqPath, 'utf8'))
// 词频表把 aren't、we'll 这类拆开了，剩下的半截不是词
const FRAGMENT = new Set(['aren', 'didn', 'doesn', 'isn', 'wasn', 'weren', 'couldn', 'wouldn', 'shouldn', 'hasn', 'haven', 'hadn', 'ain', 'don', 'won', 'll', 've', 're', 'mustn', 'needn', 'shan'])
const out = []
const seen = new Set()
const stat = [0, 0, 0]
let rank = 0
for (const { word, count } of freq) {
  const w = word.toLowerCase()
  if (seen.has(w) || !/^[a-z']+$/.test(w) || count < 3 || FRAGMENT.has(w)) continue
  const ph = dictionary[w]
  if (!ph || !/\d/.test(ph)) continue
  // 单个字母（除了 a、i）和缩写的碎片不要
  if (w.length === 1 && w !== 'a' && w !== 'i') continue
  seen.add(w)
  rank++
  // 首字母大写的多半是人名地名，归到生僻
  const proper = word !== 'I' && /^[A-Z]/.test(word)
  const tier = proper ? 2 : rank <= 12000 ? 0 : rank <= 30000 ? 1 : 2
  out.push(`${w}\t${ph}\t${tier}`)
  stat[tier]++
}
writeFileSync('public/data/en-words.txt', out.join('\n'))
console.log('词数', out.length, '常见/一般/生僻', stat)
