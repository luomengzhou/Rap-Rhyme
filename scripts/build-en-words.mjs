// 生成英文押韵词表：node scripts/build-en-words.mjs <cmu-pronouncing-dictionary/index.js> <subtlex-word-frequencies/index.json> <ecdict.csv>
// 读音来自 CMU Pronouncing Dictionary，常见度按 SUBTLEX-US 的词频排（只用来分档，不保存频次）。
// 中文释义来自 ECDICT（MIT 许可，github.com/skywind3000/ECDICT），只取每个词最前面的一两个意思。
// 输出 public/data/en-words.txt，每行：词\t音素（空格分隔，元音带重音数字）\t常见度(0 常见 / 1 一般 / 2 生僻)\t中文意思，按常见度从高到低排。
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const [cmuPath, freqPath, ecPath] = process.argv.slice(2)
if (!cmuPath || !freqPath || !ecPath) throw new Error('用法见文件开头')

/** 读 ECDICT 的 CSV：词 -> { 释义, 原形 } */
function readEcdict(path) {
  const text = readFileSync(path, 'utf8')
  const map = new Map()
  let row = []
  let cell = ''
  let quoted = false
  const endRow = () => {
    row.push(cell)
    cell = ''
    if (row.length > 10 && row[3]) {
      const lemma = /(?:^|\/)0:([^/]+)/.exec(row[10] ?? '')?.[1]
      const w = row[0].toLowerCase()
      if (!map.has(w) || row[0] === w) map.set(w, { tr: row[3], lemma })
    }
    row = []
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' } else if (c === '\n') endRow()
    else if (c !== '\r') cell += c
  }
  if (cell || row.length) endRow()
  return map
}

/** 把词典的释义压成一小段：去掉网络释义和专业标签，最多两种词性、每种两个意思 */
function gloss(tr) {
  const parts = []
  for (const line of tr.split(/\\n|\n/)) {
    const l = line.trim()
    if (!l || l.startsWith('[')) continue
    const m = /^([a-z]+\.)\s*(.+)$/.exec(l)
    const body = (m ? m[2] : l).replace(/[（(][^）)]*[）)]/g, '').split(/[,，;；]/).map((x) => x.trim()).filter(Boolean).slice(0, 2).join('、')
    if (body) parts.push((m ? m[1] + ' ' : '') + body)
    if (parts.length === 2) break
  }
  return parts.join('；').slice(0, 40)
}

const ec = readEcdict(ecPath)
const meaning = (w) => {
  const hit = ec.get(w) ?? ec.get(w.replace(/'s$/, ''))
  if (!hit) return ''
  const g = gloss(hit.tr)
  // 变形（过去式、复数）的释义常常只写“xx的过去式”，换成原形的意思
  if (hit.lemma && (!g || /的(过去|现在|复数|第三人称|比较|最高)/.test(g))) {
    const base = ec.get(hit.lemma.toLowerCase())
    if (base) return gloss(base.tr)
  }
  return g
}
const { dictionary } = await import(pathToFileURL(cmuPath).href)
const freq = JSON.parse(readFileSync(freqPath, 'utf8'))
// 词频表把 aren't、we'll 这类拆开了，剩下的半截不是词
const FRAGMENT = new Set(['aren', 'didn', 'doesn', 'isn', 'wasn', 'weren', 'couldn', 'wouldn', 'shouldn', 'hasn', 'haven', 'hadn', 'ain', 'don', 'won', 'll', 've', 're', 'mustn', 'needn', 'shan'])
const out = []
const seen = new Set()
const stat = [0, 0, 0]
let rank = 0
let withZh = 0
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
  const zh = meaning(w)
  // ln、th 这类只是缩写，按字母读，不是能唱的词
  if (w.length <= 3 && (zh.startsWith('abbr.') || (!zh && w.length <= 2))) continue
  if (zh) withZh++
  out.push(`${w}\t${ph}\t${tier}\t${zh}`)
  stat[tier]++
}
writeFileSync('public/data/en-words.txt', out.join('\n'))
console.log('词数', out.length, '常见/一般/生僻', stat, '有中文意思的', withZh)
