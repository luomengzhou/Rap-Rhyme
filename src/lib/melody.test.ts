import { describe, expect, it } from 'vitest'
import { melodyGrid, melodyStrudel, midiFile, noteName, toMono, type Note } from './melody'

const n = (start: number, dur: number, midi: number, amp = 0.6): Note => ({ start, dur, midi, amp })

describe('哼唱旋律', () => {
  it('音名', () => {
    expect(noteName(60)).toBe('C4')
    expect(noteName(69)).toBe('A4')
    expect(noteName(61)).toBe('C#4')
  })
  it('整理成单旋律', () => {
    const mono = toMono([n(0, 0.3, 60), n(0.02, 0.3, 72, 0.2), n(0.31, 0.2, 60), n(0.6, 0.02, 64), n(0.7, 0.3, 67), n(0.8, 0.3, 69, 0.9), n(1.5, 0.2, 20)])
    expect(mono.map((x) => x.midi)).toEqual([60, 67, 69])
    // 两个挨着的 C 并成了一个；G 被后面更响的 A 截短
    expect(mono[0].dur).toBeCloseTo(0.51)
    expect(mono[1].dur).toBeCloseTo(0.1)
  })
  it('落到格子上，写成 Strudel', () => {
    // 120 BPM，一格 0.125 秒
    const notes = [n(1, 0.2, 60), n(1.5, 0.2, 61), n(2, 0.2, 67), n(3.01, 0.2, 60)]
    expect(melodyGrid(notes, 120)[0].filter((x) => x !== null)).toEqual([60, 61, 67])
    const code = melodyStrudel(notes, 120)
    expect(code).toContain('setcpm(120/4)')
    expect(code).toContain('[c4 ~ ~ ~  cs4 ~ ~ ~  g4 ~ ~ ~  ~ ~ ~ ~]')
    expect(code).toContain('[c4 ~ ~ ~  ~ ~ ~ ~')
  })
  it('写成 MIDI 文件', () => {
    const f = midiFile([n(0, 0.5, 60), n(0.5, 0.5, 64)], 120)
    expect(String.fromCharCode(...f.slice(0, 4))).toBe('MThd')
    expect(String.fromCharCode(...f.slice(14, 18))).toBe('MTrk')
    // 速度 120 = 每拍 500000 微秒
    expect([...f.slice(22, 29)]).toEqual([0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20])
    // 第一个音：时间 0，开 C4；半秒后（480 tick = 0x83 0x60）关
    expect([...f.slice(29, 33)]).toEqual([0x00, 0x90, 60, 92])
    expect([...f.slice(33, 38)]).toEqual([0x83, 0x60, 0x80, 60, 0])
    expect([...f.slice(-4)]).toEqual([0x00, 0xff, 0x2f, 0x00])
    expect((f[18] << 24) | (f[19] << 16) | (f[20] << 8) | f[21]).toBe(f.length - 22)
  })
})
