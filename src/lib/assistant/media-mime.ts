import type { MediaKind } from './gemini'

/** Форматы звука, которые модель принимает как есть. */
const AUDIO_OK = /^audio\/(ogg|mpeg|mp3|wav|x-wav|aac|flac|aiff|webm)$/

/**
 * Тип файла для модели. Green API присылает «audio/ogg», а Instagram — голосовое в контейнере MP4
 * («audio/mp4», «video/mp4») или вовсе «application/octet-stream». Смотрим на первые байты:
 * OggS — ogg, ftyp — MP4 (модель читает его как video/mp4 — звук из него она понимает), ID3 — mp3.
 */
export function mediaMime(kind: MediaKind, given: string, bytes: Buffer): string {
  if (kind === 'image') return /^image\//.test(given) ? given : 'image/jpeg'
  if (AUDIO_OK.test(given)) return given
  const head = bytes.subarray(0, 12).toString('latin1')
  if (head.startsWith('OggS')) return 'audio/ogg'
  if (head.slice(4, 8) === 'ftyp') return 'video/mp4'
  if (head.startsWith('ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return 'audio/mpeg'
  if (head.startsWith('RIFF')) return 'audio/wav'
  if (head.startsWith('\x1aE\xdf\xa3')) return 'audio/webm'
  return given || 'audio/ogg'
}
