// 从录音里识别音高：用 Spotify 开源的 Basic Pitch 模型（Apache-2.0），在浏览器里本地运行，录音不会上传。
// 模型和它依赖的 TensorFlow.js 比较大，第一次用到时才加载。
import { toMono, type Note } from './melody'

const RATE = 22050

/** 转成模型要的格式：22050 Hz、单声道 */
async function resample(buf: AudioBuffer): Promise<AudioBuffer> {
  if (buf.sampleRate === RATE && buf.numberOfChannels === 1) return buf
  const off = new OfflineAudioContext(1, Math.ceil(buf.duration * RATE), RATE)
  const src = off.createBufferSource()
  src.buffer = buf
  src.connect(off.destination)
  src.start()
  return off.startRendering()
}

/** 识别出一条单旋律。progress 是 0-1 的进度 */
export async function transcribe(buf: AudioBuffer, base: string, progress: (p: number) => void): Promise<Note[]> {
  const [{ BasicPitch, outputToNotesPoly, addPitchBendsToNoteEvents, noteFramesToTime }, audio] = await Promise.all([import('@spotify/basic-pitch'), resample(buf)])
  const model = new BasicPitch(base + 'models/basic-pitch/model.json')
  const frames: number[][] = []
  const onsets: number[][] = []
  const contours: number[][] = []
  await model.evaluateModel(
    audio,
    (f, o, c) => {
      frames.push(...f)
      onsets.push(...o)
      contours.push(...c)
    },
    progress,
  )
  // 哼唱的起音比乐器软，起点门槛放低一些；最短 11 帧（约 0.13 秒）才算一个音
  const events = noteFramesToTime(addPitchBendsToNoteEvents(contours, outputToNotesPoly(frames, onsets, 0.4, 0.3, 11, true, null, null, true)))
  return toMono(events.map((e) => ({ start: e.startTimeSeconds, dur: e.durationSeconds, midi: e.pitchMidi, amp: e.amplitude })))
}
