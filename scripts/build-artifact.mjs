// 把 dist/ 打成能发布到 claude.ai 的页面：样式内联，脚本和词表作为旁边的文件。
// 用法：npm run build && node scripts/build-artifact.mjs <输出目录>
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2]
if (!out) throw new Error('需要输出目录')
const assets = readdirSync('dist/assets')
const js = assets.filter((f) => f.endsWith('.js'))
const css = assets.filter((f) => f.endsWith('.css'))
if (js.length !== 1) throw new Error(`期望一个脚本文件，实际 ${js.length} 个`)
mkdirSync(join(out, 'data'), { recursive: true })
cpSync(join('dist/assets', js[0]), join(out, 'app.js'))
cpSync('dist/data/zh-words.txt', join(out, 'data/zh-words.txt'))
const style = css.map((f) => readFileSync(join('dist/assets', f), 'utf8')).join('\n')
writeFileSync(
  join(out, 'index.html'),
  `<title>Rap Rhyme</title>\n<style>${style}</style>\n<div id="root"></div>\n<script type="module" src="app.js"></script>\n`,
)
console.log('ok', js[0])
