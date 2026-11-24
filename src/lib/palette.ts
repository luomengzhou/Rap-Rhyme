// 韵脚分组的颜色，深色背景上都清晰可辨
export const PALETTE = ['#5ec8ff', '#ff6fd8', '#ffd24a', '#7ee081', '#ff8a5c', '#b79bff', '#4fe0c8', '#ff6b7d', '#c8e05a', '#8fb0ff']
export const colorOf = (g: number) => PALETTE[g % PALETTE.length]
export const N_LABEL = ['', '单押', '双押', '三押', '四押']
