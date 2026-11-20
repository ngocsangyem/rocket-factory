import { RINGS } from '../factory-state-machine'
import { AMB, cls, isOn, pad, RED, times, txt, type SceneCtx } from './scene-context-and-text-helpers'

/** Left and centre: launch tower with stage lights, chopstick arms, roof crane, the rocket, weld bay, cutting table. */

/** A one-shot started this phase resumes at its age, so a redraw mid-phase does not replay it. */
const resume = (c: SceneCtx) => (c.anim ? `animation-delay:-${c.phaseAgeS.toFixed(2)}s` : "")

function weldBay(c: SceneCtx): string {
  const welding = isOn(c, 'weld')
  const arm = (side: 1 | -1, name: string) =>
    `<g class="${welding ? cls(c, name) : ''}" style="transform-origin:${side * 100}px 30px"><rect x="${side === 1 ? 96 : -104}" y="-10" width="8" height="44" fill="#3a3a3a"/><path d="M${side * 100} -6 L${side * 62} -30 L${side * 58} -24 L${side * 96} 0 Z" fill="#4a4a4a"/><circle cx="${side * 60}" cy="-27" r="5" fill="#666"/></g>`
  const sparks = c.anim ? times(12, i => `<circle class="spark${i % 2 ? '' : ' sparkR'}" style="animation-delay:${(i * 0.09).toFixed(2)}s" cx="${i % 2 ? -56 : 56}" cy="-12" r="2.2" fill="#fff3d6"/>`) : ''
  const arcs = welding ? `<circle cx="-56" cy="-12" r="26" fill="url(#arc)" class="${cls(c, 'arcFlick')}"/><circle cx="56" cy="-12" r="26" fill="url(#arc)" class="${cls(c, 'arcFlick')}"/>${sparks}` : ''
  return `<g transform="translate(1110 760)"><rect x="-120" y="-150" width="8" height="190" fill="#262626"/><rect x="112" y="-150" width="8" height="190" fill="#262626"/><rect x="-124" y="-156" width="248" height="10" fill="#2a2a2a"/>
<ellipse cx="0" cy="10" rx="62" ry="18" fill="none" stroke="#9a9a9a" stroke-width="10"/><ellipse cx="0" cy="4" rx="62" ry="18" fill="none" stroke="#d6d6d6" stroke-width="3"/>${arm(-1, 'armL')}${arm(1, 'armR')}${arcs}${txt(0, 70, 'BAY 01 · WELDING', 10, '#4a4a4a', 'middle')}</g>`
}

function tower(c: SceneCtx): string {
  const p = c.s.progress
  let o = ''
  for (let y = 230; y < 900; y += 36) o += `<path d="M300 ${y} L344 ${y + 36} M344 ${y} L300 ${y + 36}" stroke="#2c2c2c" stroke-width="2"/>`
  o += `<rect x="296" y="220" width="52" height="680" fill="none" stroke="#3a3a3a" stroke-width="5"/>`
  const red = c.tr === 'scrub'
  o += times(RINGS, i => {
    const y = c.baseY - c.ringH * (i + 1) + c.ringH / 2
    const lit = i < c.shown
    const next = c.P === 'SHIFT' && i === c.shown
    return `<rect x="284" y="${y - 6}" width="10" height="12" rx="1" fill="${red ? RED : lit ? AMB : '#1f1f1f'}" ${lit || red ? 'filter="url(#glow)"' : ''} class="${next ? cls(c, 'blink') : ''}"/>`
  })
  o += `<rect x="318" y="208" width="8" height="12" fill="${RED}" class="${cls(c, 'blink')}"/>`
  o += txt(322, 196, `T-${pad(p.ship)} · ${c.shown}/8 · H${p.welds}`, 12, '#8a8a8a', 'middle')
  // Fuse box: blinks while the mod itself has a fault.
  const fault = c.s.faultUntil > c.now
  o += `<rect x="350" y="866" width="24" height="32" fill="#191919" stroke="#333"/><circle cx="362" cy="878" r="4" fill="${fault ? AMB : '#262626'}" class="${fault ? cls(c, 'blink') : ''}"/>`
  // Chopstick arms close around the stack when it is ready.
  const closed = c.P === 'READY'
  const armY = c.baseY - c.ringH * 5
  const arm = (dy: number) => `<g transform="translate(344 ${armY + dy}) rotate(${closed ? 0 : -28})"><rect y="-5" width="${closed ? c.cx - c.rw / 2 - 344 : 110}" height="10" fill="#3a3a3a"/></g>`
  return o + arm(-18) + arm(18)
}

function crane(c: SceneCtx): string {
  const busy = isOn(c, 'crane')
  const hookY = c.P === 'STACK' ? c.topY - 18 : 290
  const tx = busy ? 640 : c.cx
  return `<line x1="322" y1="220" x2="720" y2="220" stroke="#3a3a3a" stroke-width="10"/><g class="${busy ? cls(c, 'trolley') : ''}"><rect x="${tx - 16}" y="214" width="32" height="14" fill="#444"/><line x1="${tx}" y1="228" x2="${tx}" y2="${hookY}" stroke="#777" stroke-width="2"/><path d="M${tx - 12} ${hookY} h24 v8 h-24 z M${tx} ${hookY + 8} q8 10 0 16" fill="#777" stroke="#777"/></g>`
}

function rocket(c: SceneCtx): string {
  const { cx, rw, ringH, baseY, shown, topY, P } = c
  const mount = `<rect x="378" y="840" width="184" height="14" fill="#1f1f1f"/><rect x="392" y="854" width="12" height="60" fill="#1f1f1f"/><rect x="536" y="854" width="12" height="60" fill="#1f1f1f"/>`
  let o = [-30, -10, 10, 30].map(d => `<path d="M${cx + d - 8} ${baseY} h16 l5 20 h-26 z" fill="${P === 'FIRE' ? '#f2f2f2' : '#444'}"/>`).join('')
  o += times(shown, i => {
    const y = baseY - ringH * (i + 1)
    const dropping = P === 'STACK' && i === shown - 1
    return `<g class="${dropping ? cls(c, 'drop') : ''}" style="${dropping ? resume(c) : ''}"><rect x="${cx - rw / 2}" y="${y}" width="${rw}" height="${ringH}" fill="url(#steel)"/><line x1="${cx - rw / 2}" x2="${cx + rw / 2}" y1="${y}" y2="${y}" stroke="#555" stroke-width="2"/></g>`
  })
  if (shown >= RINGS) {
    o += `<path class="${P === 'READY' ? cls(c, 'drop') : ''}" style="${P === 'READY' ? resume(c) : ''}" d="M${cx - rw / 2} ${topY} C${cx - rw / 2} ${topY - 84} ${cx - 18} ${topY - 140} ${cx} ${topY - 150} C${cx + 18} ${topY - 140} ${cx + rw / 2} ${topY - 84} ${cx + rw / 2} ${topY} Z" fill="url(#steel)"/>`
  }
  if (isOn(c, 'weld')) {
    const sparks = c.anim ? times(8, i => `<circle class="spark" style="animation-delay:${(i * 0.12).toFixed(2)}s" cx="${cx - rw / 2}" cy="${topY + 6}" r="2.2" fill="#fff3d6"/>`) : ''
    o += `<circle cx="${cx - rw / 2}" cy="${topY + 6}" r="30" fill="url(#arc)" class="${cls(c, 'arcFlick')}"/>${sparks}`
  }
  // Roll-out: the finished ship is hoisted out through the roof; the mount stays.
  if (P === 'ROLLOUT') o = c.anim ? `<g class="rollout" style="${resume(c)}">${o}</g>` : ''
  o = mount + o
  if (isOn(c, 'survey')) {
    o += `<g class="${cls(c, 'droneScan')}"><path d="M${cx + 84} ${topY - 6} l-64 74 h44 z" fill="#ffffff" opacity=".08"/><rect x="${cx + 66}" y="${topY - 16}" width="36" height="6" rx="3" fill="#bdbdbd"/><rect x="${cx + 62}" y="${topY - 20}" width="12" height="3" fill="#777"/><rect x="${cx + 94}" y="${topY - 20}" width="12" height="3" fill="#777"/><circle cx="${cx + 84}" cy="${topY - 7}" r="3" fill="${AMB}" class="${cls(c, 'blink')}"/></g>`
  }
  return o
}

function cuttingTableAndForklift(c: SceneCtx): string {
  const cut = isOn(c, 'cut')
    ? `<rect x="600" y="858" width="100" height="8" fill="#8a8a8a"/><circle class="${cls(c, 'cutter')}" cx="612" cy="858" r="5" fill="#fff"/><circle class="${cls(c, 'cutter')}" cx="612" cy="858" r="18" fill="url(#arc)"/>`
    : ''
  const fork = isOn(c, 'crane')
    ? `<g class="${cls(c, 'forklift')}"><rect x="1000" y="890" width="76" height="26" rx="3" fill="#3a3a3a"/><rect x="1010" y="866" width="24" height="24" fill="#2a2a2a"/><circle cx="1062" cy="874" r="16" fill="none" stroke="#9a9a9a" stroke-width="6"/><circle cx="1012" cy="920" r="7" fill="#050505"/><circle cx="1064" cy="920" r="7" fill="#050505"/></g>`
    : ''
  return `<g><rect x="590" y="866" width="120" height="10" fill="#1f1f1f"/><rect x="600" y="876" width="8" height="40" fill="#1f1f1f"/><rect x="692" y="876" width="8" height="40" fill="#1f1f1f"/>${cut}</g>${fork}`
}

export function buildFloor(c: SceneCtx): string {
  return weldBay(c) + tower(c) + crane(c) + rocket(c) + cuttingTableAndForklift(c)
}
