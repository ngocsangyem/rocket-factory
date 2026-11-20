import { AMB } from './scene-context-and-text-helpers'

/** Seven-segment digits drawn as rects: a backdrop loads no web font. Unlit segments stay faint, like a real display. */
const SEGMENTS: Record<string, string> = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g',
}

/** Width of one digit cell including its gap, for right-aligning a string. */
export const segCell = (h: number) => h * 0.52 + h * 0.22

export function seg7(x: number, y: number, str: string, h = 40, color = AMB, colonClass = ''): string {
  const w = h * 0.52
  const t = h * 0.11
  let out = ''
  ;[...str].forEach((ch, i) => {
    const X = x + i * segCell(h)
    if (ch === ':') {
      out += `<g class="${colonClass}"><rect x="${(X + w * 0.3).toFixed(1)}" y="${(y + h * 0.28).toFixed(1)}" width="${t.toFixed(1)}" height="${t.toFixed(1)}" fill="${color}"/><rect x="${(X + w * 0.3).toFixed(1)}" y="${(y + h * 0.64).toFixed(1)}" width="${t.toFixed(1)}" height="${t.toFixed(1)}" fill="${color}"/></g>`
      return
    }
    const R: Record<string, number[]> = {
      a: [X + t, y, w - 2 * t, t], d: [X + t, y + h - t, w - 2 * t, t], g: [X + t, y + h / 2 - t / 2, w - 2 * t, t],
      f: [X, y + t, t, h / 2 - t], b: [X + w - t, y + t, t, h / 2 - t], e: [X, y + h / 2, t, h / 2 - t], c: [X + w - t, y + h / 2, t, h / 2 - t],
    }
    for (const seg of 'abcdefg') {
      const lit = (SEGMENTS[ch] ?? '').includes(seg)
      const [rx = 0, ry = 0, rw = 0, rh = 0] = R[seg] ?? []
      out += `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" rx="1" fill="${color}" opacity="${lit ? 1 : 0.08}"/>`
    }
  })
  return `<g filter="url(#glow)">${out}</g>`
}
