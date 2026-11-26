import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

/** 两栏之间可以拖的分隔条。onDrag 给出鼠标当前的横坐标 */
export function Splitter({ onDrag, className = '', title = '拖动调整宽度' }: { onDrag: (clientX: number) => void; className?: string; title?: string }) {
  const dragging = useRef(false)
  return (
    <div
      className={'splitter ' + className}
      role="separator"
      aria-orientation="vertical"
      title={title}
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        e.preventDefault()
      }}
      onPointerMove={(e) => dragging.current && onDrag(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    />
  )
}

/** 记住的滚动位置：换标签、换页面再回来时还在原处。只在这次打开网站期间有效 */
const remembered = new Map<string, number>()
export const hasScroll = (key: string) => remembered.has(key)

/**
 * 记住 root 里每个带 data-scroll 的滚动区域滚到了哪里。
 * 区域的名字里通常带上当前标签，这样每个标签各记各的。
 */
export function useScrollMemory(root: RefObject<HTMLElement | null>, deps: unknown[]) {
  useEffect(() => {
    const el = root.current
    if (!el) return
    const onScroll = (e: Event) => {
      const t = e.target as HTMLElement
      const key = t.dataset?.scroll
      if (key) remembered.set(key, t.scrollTop)
    }
    el.addEventListener('scroll', onScroll, true)
    return () => el.removeEventListener('scroll', onScroll, true)
  }, [root])
  useLayoutEffect(() => {
    root.current?.querySelectorAll<HTMLElement>('[data-scroll]').forEach((t) => {
      const top = remembered.get(t.dataset.scroll!)
      if (top !== undefined) t.scrollTop = top
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
