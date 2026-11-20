import { AMB, type SceneCtx } from './scene-context-and-text-helpers'

/** Gradients, patterns, filters and every CSS animation the scene uses. */

export const DEFS = `<defs>
<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0b0b"/><stop offset="1" stop-color="#151515"/></linearGradient>
<linearGradient id="steel" x1="0" x2="1"><stop offset="0" stop-color="#4a4a4a"/><stop offset=".3" stop-color="#e2e2e2"/><stop offset=".62" stop-color="#a2a2a2"/><stop offset=".9" stop-color="#c8c8c8"/><stop offset="1" stop-color="#5a5a5a"/></linearGradient>
<linearGradient id="cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".09"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="arc"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#ffd9a0" stop-opacity=".6"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient>
<linearGradient id="flame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#ffe6c0"/><stop offset="1" stop-color="${AMB}" stop-opacity="0"/></linearGradient>
<pattern id="hazard" width="20" height="12" patternUnits="userSpaceOnUse"><rect width="20" height="12" fill="${AMB}"/><path d="M0 12 L10 0 H20 L10 12 Z" fill="#111"/></pattern>
<pattern id="shutter" width="10" height="14" patternUnits="userSpaceOnUse"><rect width="10" height="14" fill="#262626"/><rect y="11" width="10" height="3" fill="#161616"/></pattern>
<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.4" fill="#000" opacity=".32"/></pattern>
<linearGradient id="rollG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".035"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .06 0"/></filter>
<filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .8 0 0 0 0 .8 0 0 0 0 .8 0 0 0 .5 0"/></filter>
</defs>`

/**
 * Ambient loops start at the wall clock's offset into their period, so a redraw (any state change)
 * continues them where they were instead of snapping walkers back to the start.
 */
function loop(c: SceneCtx, name: string, periodS: number, rest: string): string {
  const offset = ((c.now / 1000) % periodS).toFixed(2)
  return `.${name}{animation:${name} ${periodS}s -${offset}s ${rest}}`
}

export function keyframes(c: SceneCtx): string {
  const travel = Math.max(120, c.baseY - c.topY - 60)
  return `${loop(c, 'tw', 3, 'infinite alternate')}@keyframes tw{to{opacity:.1}}
${loop(c, 'hum', 9, 'infinite')}@keyframes hum{0%,95%,100%{opacity:1}97%{opacity:.55}}.flicker{animation:flk .35s infinite steps(2)}@keyframes flk{50%{opacity:.2}}
.blink{animation:blink 1.1s infinite steps(1)}@keyframes blink{50%{opacity:.15}}.colon{animation:blink 1s infinite steps(1)}
.spark{animation:spark .55s infinite ease-out}@keyframes spark{0%{transform:translate(0,0);opacity:1}100%{transform:translate(-22px,44px);opacity:0}}.sparkR{animation-name:sparkR}@keyframes sparkR{0%{transform:translate(0,0);opacity:1}100%{transform:translate(22px,44px);opacity:0}}
.arcFlick,.cutter{animation:arcF .12s infinite alternate}@keyframes arcF{from{opacity:.35}to{opacity:1}}
.armL{animation:armL 1.4s infinite ease-in-out}@keyframes armL{50%{transform:rotate(-6deg)}}.armR{animation:armR 1.4s infinite ease-in-out}@keyframes armR{50%{transform:rotate(6deg)}}
.drop{animation:drop 1.6s cubic-bezier(.3,.7,.3,1) both}@keyframes drop{from{transform:translateY(-240px)}to{transform:none}}
.droneScan{animation:dscan 2.2s infinite ease-in-out}@keyframes dscan{50%{transform:translateY(${travel}px)}}
.trolley{animation:trol 2.4s infinite ease-in-out}@keyframes trol{50%{transform:translateX(-150px)}}.forklift{animation:fork 3.2s infinite ease-in-out}@keyframes fork{50%{transform:translateX(-300px)}}
${loop(c, 'walkA', 14, 'infinite linear')}@keyframes walkA{50%{transform:translateX(-200px)}}${loop(c, 'walkB', 17, 'infinite linear')}@keyframes walkB{50%{transform:translateX(220px)}}${loop(c, 'cart', 11, 'infinite ease-in-out')}@keyframes cart{50%{transform:translateX(160px)}}
.truck{animation:truck 1.4s cubic-bezier(.2,.8,.3,1) both}@keyframes truck{from{transform:translateX(260px)}to{transform:none}}
.belt{animation:belt 2.1s infinite linear}@keyframes belt{to{transform:translateX(400px)}}.shelf{animation:shelf 1.6s infinite alternate ease-in-out}@keyframes shelf{to{transform:translateX(212px)}}
.dish{animation:dish 2s infinite ease-in-out}@keyframes dish{50%{transform:rotate(-25deg)}}.ping{animation:ping 1.5s infinite ease-out}@keyframes ping{from{transform:scale(.4);opacity:1}to{transform:scale(4);opacity:0}}
.ping2{animation:ping2 .9s infinite ease-out}@keyframes ping2{from{opacity:1}to{opacity:0;transform:translateX(18px)}}.hand{animation:hand 1s infinite linear}@keyframes hand{to{transform:rotate(360deg)}}
.sweep{animation:sweep 2s infinite linear}@keyframes sweep{to{transform:rotate(360deg)}}.bob{animation:bob 1.2s infinite ease-in-out}@keyframes bob{50%{transform:translateY(-6px)}}.think{animation:think .8s infinite alternate steps(2)}@keyframes think{to{opacity:.2}}
.smoke{animation:smoke 1.4s infinite ease-out}@keyframes smoke{to{transform:translateY(-40px) scale(1.6);opacity:0}}.scan{animation:scanA 1.8s infinite linear}@keyframes scanA{to{transform:translateY(${c.baseY - c.topY}px)}}
.flame{transform-origin:${c.cx}px 840px;animation:flick .09s infinite alternate}@keyframes flick{from{transform:scaleY(.92)}to{transform:scaleY(1.07)}}.steam{animation:steam 2.8s infinite ease-out}@keyframes steam{0%{transform:scale(.4);opacity:0}30%{opacity:.26}100%{transform:scale(1.5) translateY(-50px);opacity:0}}
.shutDown{animation:shut 1.2s ease-in both}@keyframes shut{from{transform:scaleY(.05)}to{transform:none}}
.rollout{animation:rollout 3.6s cubic-bezier(.5,0,.8,.4) both}@keyframes rollout{from{transform:none;opacity:1}85%{opacity:1}to{transform:translateY(-900px);opacity:0}}
.cd0,.cd1,.cd2{animation:3s linear both}.cd0{animation-name:cd0}.cd1{animation-name:cd1}.cd2{animation-name:cd2}
@keyframes cd0{0%,33%{opacity:1}34%,100%{opacity:0}}@keyframes cd1{0%,33%{opacity:0}34%,66%{opacity:1}67%,100%{opacity:0}}@keyframes cd2{0%,66%{opacity:0}67%,100%{opacity:1}}
.pop{animation:pop .6s cubic-bezier(.2,1.4,.4,1) both}@keyframes pop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}
${loop(c, 'roll', 7, 'infinite linear')}@keyframes roll{from{transform:translateY(-140px)}to{transform:translateY(1000px)}}
.band{animation:band .6s infinite linear}@keyframes band{to{transform:translateY(160px)}}.staticFx{animation:stat .12s infinite steps(2)}@keyframes stat{50%{transform:translate(-8px,6px)}}
.jitter{animation:jit .18s infinite steps(2)}@keyframes jit{50%{transform:translate(3px,-2px)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.cd1,.cd2,.rollout{display:none}}`
}
