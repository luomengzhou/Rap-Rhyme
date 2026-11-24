import { useEffect, useState } from 'react'

/** 存在浏览器本地的状态；读写失败时退回内存 */
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* 本地存储不可用时忽略 */
    }
  }, [key, value])
  return [value, setValue] as const
}
