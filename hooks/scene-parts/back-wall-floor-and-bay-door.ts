import { AMB, cls, HZ, isOn, RED, times, txt, type SceneCtx } from './scene-context-and-text-helpers'

/** The room itself: ribbed back wall, far bay and shelves, the big bay door with the fleet, hanging lamps, floor grid. */

function wall(c: SceneCtx): string {
  let o = `<rect width="1600" height="${HZ}" fill="url(#wall)"/>`
  for (let x = 40; x < 1600; x += 80) o += `<rect x="${x}" y="0" width="6" height="${HZ}" fill="#161616"/>`
  for (let x = 520; x < 1280; x += 96) {
    o += `<rect x="${x}" y="70" width="70" height="44" fill="${c.dark ? '#121212' : '#1d1d1d'}"/><line x1="${x + 35}" y1="70" x2="${x + 35}" y2="114" stroke="#101010" stroke-width="3"/>`
  }
  // Far bay (a worktree opens a second line): its windows light up.
  const bay = isOn(c, 'bay')
  o += `<g>${times(3, i => `<rect x="${560 + i * 30}" y="${HZ - 150}" width="20" height="14" fill="${bay ? AMB : '#1c1c1c'}" opacity="${bay ? 0.8 : 1}"/>`)}${txt(560, HZ - 160, 'FAR BAY', 10, '#3a3a3a')}</g>`
  // Warehouse shelves (catalogue lookups): a scan light runs along them.
  const shelves = times(4, i => `<rect x="740" y="${HZ - 110 + i * 26}" width="220" height="4" fill="#202020"/>${times(6, j => `<rect x="${750 + j * 34}" y="${HZ - 128 + i * 26}" width="22" height="18" fill="#1a1a1a"/>`)}`)
  const scan = isOn(c, 'stock') ? `<rect class="${cls(c, 'shelf')}" x="744" y="${HZ - 132}" width="5" height="112" fill="${AMB}" opacity=".8" filter="url(#glow)"/>` : ''
  return `${o}<g>${shelves}${scan}${txt(850, HZ - 140, 'STORES', 10, '#3a3a3a', 'middle')}</g>`
}

function bayDoor(c: SceneCtx): string {
  const shut = c.tr === 'gate'
  const fleet = c.s.progress.fleet
  const stars = times(18, i => `<circle cx="${1300 + ((i * 61) % 270)}" cy="${265 + ((i * 37) % 170)}" r="${i % 5 ? 0.9 : 1.6}" fill="#d8d8d8" opacity="${(0.3 + (i % 4) * 0.15).toFixed(2)}" class="${i % 5 ? '' : cls(c, 'tw')}"/>`)
  const ships = times(Math.min(fleet, 5), i => {
    const x = 1550 - i * 44
    return `<g opacity="${(0.9 - i * 0.12).toFixed(2)}"><rect x="${x - 8}" y="${HZ - 120}" width="16" height="120" fill="#262626"/><path d="M${x - 8} ${HZ - 120} q8 -30 16 0 z" fill="#262626"/><rect x="${x - 8}" y="${HZ - 120}" width="3" height="120" fill="#4a4a4a"/></g>`
  })
  const shutter = `<rect x="1290" y="250" width="290" height="${shut ? HZ - 250 : 18}" fill="url(#shutter)" class="${shut ? cls(c, 'shutDown') : ''}" style="transform-origin:1435px 250px"/>`
  const sign = shut ? `<rect x="1355" y="420" width="160" height="40" fill="#0c0c0c" stroke="${RED}" stroke-width="2"/>${txt(1435, 447, 'SUSPENDED', 18, RED, 'middle', 'font-weight="700"')}` : ''
  const frame = `<rect x="1282" y="240" width="306" height="10" fill="#222"/><rect x="1282" y="240" width="8" height="${HZ - 240}" fill="#222"/><rect x="1580" y="240" width="8" height="${HZ - 240}" fill="#222"/>`
  return `<g><rect x="1290" y="250" width="290" height="${HZ - 250}" fill="#070707"/>${stars}${ships}${txt(1300, 292, `FLEET · ${fleet} SHIPS`, 12, '#7a7a7a')}${shutter}${sign}${frame}</g>`
}

function lamps(c: SceneCtx): string {
  return [600, 900, 1180]
    .map((x, i) => {
      const off = c.dark || (c.dim && i % 2 === 1)
      const cone = off
        ? ''
        : `<path class="${cls(c, c.tr === 'signal' ? 'flicker' : 'hum')}" d="M${x - 18} 168 L${x - 230} 1000 L${x + 230} 1000 L${x + 18} 168 Z" fill="url(#cone)"/><rect x="${x - 14}" y="166" width="28" height="4" fill="#f2f2f2"/>`
      return `<line x1="${x}" y1="0" x2="${x}" y2="150" stroke="#2a2a2a" stroke-width="2"/><path d="M${x - 22} 168 h44 l-8 -18 h-28 z" fill="#2c2c2c"/>${cone}`
    })
    .join('')
}

function floor(): string {
  let o = `<rect y="${HZ}" width="1600" height="${1000 - HZ}" fill="#0f0f0f"/>`
  for (let i = -10; i <= 26; i++) o += `<line x1="${800 + i * 22}" y1="${HZ}" x2="${800 + i * 150}" y2="1000" stroke="#1c1c1c" stroke-width="1.2"/>`
  for (let k = 1; k < 10; k++) {
    const y = (HZ + ((1000 - HZ) * k * k) / 81).toFixed(1)
    o += `<line x1="0" y1="${y}" x2="1600" y2="${y}" stroke="#1c1c1c" stroke-width="1.2"/>`
  }
  return `${o}<line x1="0" y1="${HZ}" x2="1600" y2="${HZ}" stroke="#262626" stroke-width="2"/>`
}

export function roomShell(c: SceneCtx): string {
  return wall(c) + bayDoor(c) + lamps(c) + floor()
}
