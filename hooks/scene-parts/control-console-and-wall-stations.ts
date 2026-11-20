import { AMB, cls, isOn, times, txt, type SceneCtx } from './scene-context-and-text-helpers'

/** Right side of the room: supply truck, CRT console (plan, ask, radio), wall clock, siren, outbound conveyor. */

function consoleDesk(c: SceneCtx): string {
  const busy = Object.keys(c.s.active).length > 0 || c.s.crew > 0
  const plan = isOn(c, 'plan')
  const monitors = times(3, i => {
    const X = 1312 + i * 80
    const lit = plan || (busy && i === 1)
    const blueprint = `<g stroke="${AMB}" stroke-width="1.2" fill="none" opacity=".9" filter="url(#glow)"><rect x="${X + 12}" y="616" width="42" height="28"/><line x1="${X + 33}" y1="616" x2="${X + 33}" y2="644"/><line x1="${X + 12}" y1="630" x2="${X + 54}" y2="630"/></g>`
    const lines = times(4, j => `<rect class="${cls(c, 'think')}" style="animation-delay:${((i + j) * 0.2).toFixed(1)}s" x="${X + 11}" y="${615 + j * 8}" width="${20 + ((i * 7 + j * 11) % 24)}" height="3" fill="${AMB}" opacity=".85"/>`)
    return `<rect x="${X}" y="604" width="66" height="54" rx="6" fill="#141414" stroke="#2e2e2e" stroke-width="3"/><rect x="${X + 6}" y="610" width="54" height="40" rx="4" fill="${lit ? '#1a1406' : '#0b0b0b'}"/>${lit ? (plan ? blueprint : lines) : ''}<rect x="${X + 28}" y="658" width="10" height="26" fill="#1f1f1f"/>`
  })
  const keys = times(8, i => `<rect x="${1314 + i * 28}" y="716" width="14" height="8" fill="${busy && i % 3 === 0 ? AMB : '#262626'}"/>`)
  const ask = isOn(c, 'ask')
  const beacon = `<rect x="1528" y="586" width="12" height="16" fill="${ask ? AMB : '#262626'}" class="${ask ? cls(c, 'blink') : ''}"/>${ask ? `<path class="${cls(c, 'sweep')}" d="M1534 592 l-150 -60 v40 z" fill="${AMB}" opacity=".18" style="transform-origin:1534px 592px"/>` : ''}`
  const radio = isOn(c, 'radio')
  const waves = radio && c.anim ? times(3, i => `<circle class="ping" style="animation-delay:${i * 0.5}s" cy="-24" r="8" fill="none" stroke="${AMB}" stroke-width="2"/>`) : ''
  const dish = `<g transform="translate(1310 590)"><g class="${radio ? cls(c, 'dish') : ''}"><path d="M-22 0 q22 -28 44 0 z" fill="#333"/><line x1="0" y1="-8" x2="0" y2="-24" stroke="#666" stroke-width="2"/></g>${waves}</g>`
  return `<g><rect x="1300" y="700" width="250" height="70" fill="#181818" stroke="#2a2a2a"/><path d="M1290 700 h270 l-10 -16 h-250 z" fill="#202020"/>${monitors}${keys}${txt(1425, 756, 'CONTROL DESK', 11, '#4a4a4a', 'middle')}${beacon}${dish}</g>`
}

function wallClockAndSiren(c: SceneCtx): string {
  const clock = `<g><circle cx="1220" cy="220" r="22" fill="#141414" stroke="#2e2e2e" stroke-width="3"/><line class="${isOn(c, 'clock') ? cls(c, 'hand') : ''}" x1="1220" y1="220" x2="1220" y2="204" stroke="#d0d0d0" stroke-width="2.5" style="transform-origin:1220px 220px"/><line x1="1220" y1="220" x2="1230" y2="220" stroke="#d0d0d0" stroke-width="2"/></g>`
  const siren = isOn(c, 'siren')
  const rings = siren && c.anim ? times(2, i => `<path class="ping2" style="animation-delay:${i * 0.4}s" d="M30 -14 q14 19 0 38" stroke="${AMB}" stroke-width="2" fill="none"/>`) : ''
  return `${clock}<g transform="translate(1180 300)"><path d="M0 0 l24 -12 v34 z" fill="${siren ? AMB : '#2e2e2e'}"/>${rings}</g>`
}

/** Parked in the bay door, behind the console, so the monitors stay readable. */
function truck(c: SceneCtx): string {
  if (!isOn(c, 'supply') || !c.s.truck) return ''
  const label = c.s.truck.length > 14 ? `${c.s.truck.slice(0, 13)}…` : c.s.truck
  return `<g class="${cls(c, 'truck')}"><rect x="1330" y="560" width="150" height="62" rx="3" fill="#202020" stroke="#383838"/><rect x="1480" y="578" width="46" height="44" rx="3" fill="#2a2a2a"/>${txt(1405, 584, label, 13, '#e6e6e6', 'middle')}<circle cx="1360" cy="626" r="10" fill="#050505"/><circle cx="1500" cy="626" r="10" fill="#050505"/></g>`
}

function conveyor(c: SceneCtx): string {
  const jam = c.tr === 'jam'
  const crates = isOn(c, 'ship') || jam
    ? times(3, i => `<rect class="${jam ? '' : cls(c, 'belt')}" style="animation-delay:${(i * 0.7).toFixed(1)}s" x="${jam ? 1520 - i * 32 : 1190}" y="906" width="30" height="24" fill="#3a3a3a" stroke="#555"/>`)
    : ''
  return `<g><rect x="1180" y="930" width="420" height="10" fill="#1e1e1e"/>${times(6, i => `<circle cx="${1200 + i * 70}" cy="945" r="5" fill="#1a1a1a"/>`)}${crates}</g>`
}

export function rightSideStations(c: SceneCtx): string {
  return truck(c) + consoleDesk(c) + wallClockAndSiren(c) + conveyor(c)
}
