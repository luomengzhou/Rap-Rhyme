import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base 用相对路径，这样部署到 GitHub Pages 的子目录也能直接打开
export default defineConfig({
  base: './',
  plugins: [react()],
})
