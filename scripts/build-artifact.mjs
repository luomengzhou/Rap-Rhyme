// 把 dist/ 打成能发布到 claude.ai 的页面：样式内联，脚本和词表作为旁边的文件。
// 用法：npm run build && node scripts/build-artifact.mjs <输出目录>
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2]
if (!out) throw new Error('需要输出目录')
const assets = readdirSync('dist/assets')
const js = assets.filter((f) => f.endsWith('.js'))
const css = assets.filter((f) => f.endsWith('.css'))
// 入口脚本改名成 app.js；其余是用到时才加载的分块（比如识别音高的模型代码），原名放在旁边，
// 分块里回头引用入口的地方也改成 app.js，免得入口被加载两次
const entry = js.find((f) => f.startsWith('index-'))
if (!entry) throw new Error('没找到入口脚本')
mkdirSync(join(out, 'data'), { recursive: true })
mkdirSync(join(out, 'models/basic-pitch'), { recursive: true })
cpSync(join('dist/assets', entry), join(out, 'app.js'))
const chunks = js.filter((f) => f !== entry)
for (const f of chunks) writeFileSync(join(out, f), readFileSync(join('dist/assets', f), 'utf8').replaceAll(entry, 'app.js'))
cpSync('dist/models/basic-pitch', join(out, 'models/basic-pitch'), { recursive: true })
cpSync('dist/data/zh-words.txt', join(out, 'data/zh-words.txt'))
cpSync('dist/data/en-words.txt', join(out, 'data/en-words.txt'))
const style = css.map((f) => readFileSync(join('dist/assets', f), 'utf8')).join('\n')
writeFileSync(
  join(out, 'index.html'),
  `<title>Rap Rhyme</title>\n<style>${style}</style>\n<div id="root"></div>\n<script type="module" src="app.js"></script>\n`,
)
console.log('ok', entry, '分块：', chunks.join(' ') || '无')
