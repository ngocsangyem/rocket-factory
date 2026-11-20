/**
 * The film's motion: camera moves over the factory, kinetic type, flashes and the end card.
 * One paused GSAP timeline, every tween at an absolute second, registered at the end.
 */
(function () {
  const tl = gsap.timeline({ paused: true })

  /** Wrap each word (or letter) of an element's own text in a span so it can move by itself. */
  function split(sel, by) {
    const out = []
    document.querySelectorAll(sel).forEach(el => {
      ;[...el.childNodes].forEach(node => {
        if (node.nodeType !== 3) { node.classList && node.classList.add('w'); out.push(node); return }
        const parts = by === 'letter' ? [...node.textContent] : node.textContent.split(/(\s+)/)
        const frag = document.createDocumentFragment()
        parts.forEach(p => {
          if (!p) return
          if (by !== 'letter' && /^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return }
          const s = document.createElement('span')
          s.className = by === 'letter' ? 'l' : 'w'
          s.textContent = p
          frag.appendChild(s)
          out.push(s)
        })
        el.replaceChild(frag, node)
      })
    })
    return out
  }

  /** Camera state that puts a point of the scene (in its own 1600x1000 units) at a screen point, at a zoom. */
  function shot(vx, vy, scale, px, py) {
    const fx = vx * 1.2, fy = vy * 1.2 - 60
    const x = Math.min(0, Math.max(1920 - 1920 * scale, px - fx * scale))
    const y = Math.min(60 * scale, Math.max(1080 - 1140 * scale, py - fy * scale))
    return { x, y, scale }
  }
  const WIDE = shot(800, 500, 1, 960, 540)
  const SHOTS = {
    read: shot(520, 640, 2.3, 1320, 560), edit: shot(1110, 760, 2.6, 620, 600),
    bash: shot(850, 890, 2.4, 1300, 620), web: shot(1330, 610, 2.7, 460, 560),
    rocket: shot(470, 560, 1.3, 520, 540), digits: shot(1110, 400, 2.2, 960, 520),
    fire: shot(470, 800, 1.9, 600, 640), rollout: shot(800, 480, 1.12, 960, 540),
  }

  gsap.set('#cam', { transformOrigin: '0 0', ...WIDE, opacity: 0 })
  gsap.set(['#scrim-l', '#scrim-r', '#scrim-c', '#flash', '#dip'], { opacity: 0 })

  /** A whip: one eased move that smears at its fastest frame, landing on the next shot. */
  function whip(to, at, dur = 0.45) {
    tl.to('#cam', { ...to, duration: dur, ease: 'power2.inOut' }, at)
    tl.to('#cam', { filter: 'blur(16px)', duration: dur / 2, ease: 'power2.in' }, at)
    tl.to('#cam', { filter: 'blur(0px)', duration: dur / 2, ease: 'power2.out' }, at + dur / 2)
  }
  const scrim = (id, v, at, dur = 0.3) => tl.to(id, { opacity: v, duration: dur, ease: 'power2.inOut' }, at)
  const blurOut = (sel, at) => tl.to(sel, { opacity: 0, filter: 'blur(10px)', duration: 0.18, ease: 'power2.in' }, at)
  const linesUp = (sel, at) => tl.fromTo(`${sel} .line > span`, { yPercent: 105 }, { yPercent: 0, duration: 0.5, stagger: 0.09, ease: 'expo.out' }, at)

  // 0 · Hook: words on black, then the lights come on.
  const hookA = split('#hook-a'), hookB = split('#hook-b')
  tl.fromTo(hookA, { opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.16, stagger: 0.09, ease: 'power2.out' }, 0.2)
  gsap.set('#hook-b', { opacity: 0 })
  tl.set('#hook-a', { opacity: 0 }, 1.3).set('#hook-b', { opacity: 1 }, 1.3)
  tl.fromTo(hookB, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.07, ease: 'expo.out' }, 1.3)
  ;[[1.3, 1], [1.36, 0.25], [1.43, 1], [1.5, 0.55], [1.56, 1]].forEach(([t, o]) => tl.set('#cam', { opacity: o }, t))
  tl.set('#scrim-c', { opacity: 1 }, 1.3)
  tl.fromTo('#flash', { opacity: 0.5 }, { opacity: 0, duration: 0.3, ease: 'power2.out' }, 1.3)
  tl.to('#cam', { ...shot(800, 500, 1.07, 960, 540), duration: 1.25, ease: 'power1.out' }, 1.3)
  blurOut('#t-hook', 2.5)
  scrim('#scrim-c', 0, 2.45, 0.25)

  // 1 · Four stations: whip in, type lands, the station works.
  const STATIONS = [['read', 2.55, '#scrim-l', -1], ['edit', 4.6, '#scrim-r', 1], ['bash', 6.6, '#scrim-l', -1], ['web', 8.6, '#scrim-r', 1]]
  STATIONS.forEach(([id, at, sc, dir], i) => {
    const t = `#t-${id}`, land = at + 0.4, out = at + 1.85
    whip(SHOTS[id], at)
    scrim(sc, 1, at + 0.15)
    scrim(sc, 0, out, 0.2)
    tl.fromTo(`${t} .kicker`, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power1.out' }, land)
    if (i % 2 === 0) {
      tl.fromTo(`${t} .tool`, { opacity: 0, x: dir * 90, filter: 'blur(12px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.4, ease: 'expo.out' }, land)
    } else {
      tl.fromTo(split(`${t} .tool`, 'letter'), { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.025, ease: 'back.out(1.6)' }, land)
    }
    tl.fromTo(`${t} .rule`, { scaleX: 0, transformOrigin: '0 50%' }, { scaleX: 1, duration: 0.45, ease: 'expo.out' }, land + 0.1)
    linesUp(t, land + 0.15)
    blurOut(t, out)
  })

  // 2 · Pull back: every station at once, tool names roll.
  whip(WIDE, 10.6, 0.55)
  scrim('#scrim-c', 1, 10.85, 0.3)
  linesUp('#t-all', 11.02)
  tl.fromTo('#roller', { opacity: 0, scaleX: 0.4 }, { opacity: 1, scaleX: 1, duration: 0.35, ease: 'expo.out' }, 11.15)
  for (let i = 1; i < 8; i++) tl.to('#roller-col', { y: -96 * i, duration: 0.11, ease: 'power3.out' }, 11.3 + i * 0.15)
  blurOut('#t-all', 12.42)
  scrim('#scrim-c', 0, 12.4, 0.2)

  // 3 · The rocket: each answered turn drops a ring, the count jumps as it lands.
  whip(SHOTS.rocket, 12.45, 0.5)
  scrim('#scrim-r', 1, 12.6)
  tl.fromTo(split('#ring-a'), { opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.16, stagger: 0.08, ease: 'power2.out' }, 12.95)
  gsap.set(['#n7', '#n8'], { opacity: 0 })
  tl.fromTo('#n6', { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'expo.out' }, 13.0)
  tl.fromTo(split('#ring-b'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.07, ease: 'expo.out' }, 13.15)
  ;[['#n6', '#n7', 13.56], ['#n7', '#n8', 15.26]].forEach(([from, to, at]) => {
    tl.set(from, { opacity: 0 }, at).set(to, { opacity: 1 }, at)
    tl.fromTo(to, { scale: 1.3 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.6)' }, at)
    tl.fromTo('#shake', { y: 10 }, { y: 0, duration: 0.3, ease: 'power3.out' }, at)
  })
  blurOut('#t-ring', 15.72)
  scrim('#scrim-r', 0, 15.72, 0.2)

  // 4 · Countdown: a dip, then the factory's own 3 · 2 · 1, punched on every digit.
  tl.to('#dip', { opacity: 0.45, duration: 0.1, ease: 'none' }, 15.9).set('#dip', { opacity: 0 }, 16.0)
  tl.set('#cam', SHOTS.digits, 16.0)
  ;[16.0, 16.8, 17.6].forEach(at => tl.fromTo('#cam', { scale: SHOTS.digits.scale * 1.08 }, { scale: SHOTS.digits.scale, duration: 0.3, ease: 'expo.out' }, at))

  // 5 · Static fire: hard cut on the flash, the frame shakes, the words slam in.
  tl.set('#cam', SHOTS.fire, 18.4)
  tl.fromTo('#flash', { opacity: 0.9 }, { opacity: 0, duration: 0.35, ease: 'power2.out' }, 18.4)
  tl.set('#scrim-r', { opacity: 1 }, 18.4)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  for (let f = 0; f < 39; f++) {
    const amp = 9 - f * 0.13
    tl.set('#shake', { x: rnd() * amp, y: rnd() * amp }, 18.4 + f / 15)
  }
  tl.set('#shake', { x: 0, y: 0 }, 21.0)
  const slam = { opacity: 1, scale: 1, duration: 0.22, stagger: 0.035, ease: 'power4.out' }
  tl.fromTo(split('#fire-a', 'letter'), { opacity: 0, scale: 1.9 }, slam, 18.46)
  tl.fromTo(split('#fire-b', 'letter'), { opacity: 0, scale: 1.9 }, slam, 18.72)
  tl.fromTo('#t-fire .kicker', { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power1.out' }, 19.05)
  blurOut('#t-fire', 20.76)
  scrim('#scrim-r', 0, 20.75, 0.25)

  // 6 · Roll-out: the camera lets the ship go; its mission patch pops.
  tl.to('#cam', { ...SHOTS.rollout, duration: 1.3, ease: 'power2.inOut' }, 21.0)
  tl.fromTo('#t-fleet .line > span', { yPercent: 105 }, { yPercent: 0, duration: 0.55, stagger: 0.1, ease: 'expo.out' }, 21.95)
  tl.to('#t-fleet', { opacity: 0, duration: 0.15, ease: 'power2.in' }, 23.85)

  // 7 · End card: the mission patch becomes the world.
  tl.fromTo('#end-in', { clipPath: 'circle(0px at 1377px 432px)' }, { clipPath: 'circle(1700px at 1377px 432px)', duration: 0.6, ease: 'power3.in' }, 24.0)
  tl.fromTo('#end-ring', { scale: 1, opacity: 1 }, { scale: 16, opacity: 0, duration: 0.9, ease: 'power2.in' }, 24.0)
  tl.fromTo(split('#end-title', 'letter'), { opacity: 0, y: 90, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, stagger: 0.035, ease: 'expo.out' }, 24.5)
  tl.fromTo('#end-sub', { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power1.out' }, 25.2)
  tl.fromTo('#end-cta', { opacity: 0, scaleX: 0.5 }, { opacity: 1, scaleX: 1, duration: 0.45, ease: 'expo.out' }, 25.5)

  window.__timelines['main'] = tl
  tl.seek(0)
})()
