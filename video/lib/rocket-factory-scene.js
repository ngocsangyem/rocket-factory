(() => {
  // hooks/failure-classifier.ts
  var SHOW_MS = { signal: 6000, fuel: 4000, gate: 4000, jam: 4000, scrub: 4000 };
  var KIND_BY_CODE = {
    overloaded: "signal",
    server_error: "signal",
    rate_limit: "fuel",
    authentication_failed: "gate",
    oauth_org_not_allowed: "gate",
    account_on_hold: "gate",
    verification_required: "gate",
    billing_error: "gate",
    cloud_credential_error: "gate",
    max_output_tokens: "jam",
    invalid_request: "scrub",
    model_not_found: "scrub",
    unknown: "scrub"
  };
  function troubleKindOf(code) {
    return KIND_BY_CODE[code] ?? "scrub";
  }
  function troubleShowMs(kind) {
    return SHOW_MS[kind];
  }

  // hooks/tool-to-workshop-station.ts
  var STATION_TOOLS = {
    survey: ["Read", "LSP", "ReadMcpResourceTool", "ReadMcpResourceDirTool", "ListMcpResourcesTool", "ReadWidgetContext", "memory_read", "memory_list"],
    stock: ["ToolSearch", "ListSkills", "SearchSkills", "ListPlugins", "SearchPlugins", "SearchMcpRegistry", "ListConnectors", "ListAgents", "GetTask", "TaskGet", "TaskList", "CronList", "Projects", "FetchInboxMessage", "ReadNotifications"],
    weld: ["Edit", "NotebookEdit", "memory_write"],
    cut: ["Write"],
    crane: ["Bash", "Monitor", "TaskStop"],
    radio: ["WebSearch", "WebFetch", "RemoteTrigger", "request_computer", "OfferChromeSetup", "WaitForMcpServers"],
    crew: ["Agent", "Workflow", "SendMessage", "Yield", "TaskCreate", "TaskUpdate"],
    plan: ["EnterPlanMode", "ExitPlanMode", "TodoWrite", "ProposeGoal", "Skill", "propose_skills"],
    ask: ["AskUserQuestion", "ShowOnboardingRolePicker"],
    ship: ["SendUserFile", "SendFile", "SendUserMessage", "SendToProject", "SendToProjectContext", "Artifact", "ArtifactCheck", "ArtifactComments", "ArtifactData", "AppifactRepl", "ClaudeDesign", "DesignSync", "PublishPlugin", "ReportFindings", "SendFeedback", "ShareOnboardingGuide", "WrapUp", "SuggestSkills", "SuggestPluginInstall", "SuggestConnectors"],
    siren: ["PushNotification"],
    clock: ["CronCreate", "CronDelete", "ScheduleWakeup", "Poll"],
    bay: ["EnterWorktree", "ExitWorktree"],
    lights: ["EndConversation"]
  };
  var BY_TOOL = new Map;
  for (const [station, tools] of Object.entries(STATION_TOOLS))
    for (const tool of tools)
      BY_TOOL.set(tool, station);
  function stationOf(tool) {
    if (tool.startsWith("mcp__"))
      return "supply";
    return BY_TOOL.get(tool) ?? "misc";
  }
  function truckLabel(tool) {
    const server = tool.split("__")[1];
    return (server && server.length > 0 ? server : "MCP").toUpperCase().slice(0, 14);
  }

  // hooks/factory-state-machine.ts
  var RINGS = 8;
  var PHASE_MS = { STACK: 2600, READY: 3000, FIRE: 6000, ROLLOUT: 3600, PAUSE: 2000, HANDOVER: 3000 };
  var FAILING_MS = 1800;
  var FAULT_MS = 4000;
  var REFUSAL_MS = 3000;
  function freshProgress(now, fleet = 0, ship = 1) {
    return { ship, ring: 0, welds: 0, rejects: 0, fleet, shipStartedAt: now };
  }
  function initialFactoryState() {
    return {
      progress: freshProgress(0),
      phase: "IDLE",
      phaseStartedAt: 0,
      sessionStartedAt: 0,
      inTurn: false,
      active: {},
      failing: null,
      gate: null,
      trouble: null,
      crew: 0,
      truck: null,
      faults: 0,
      faultUntil: 0,
      mode: "on"
    };
  }
  function freshest(mine, stored) {
    if (!stored)
      return mine;
    if (stored.ship !== mine.ship)
      return stored.ship > mine.ship ? stored : mine;
    return stored.ring > mine.ring ? stored : mine;
  }
  var isShowtime = (s) => s.phase === "READY" || s.phase === "FIRE" || s.phase === "ROLLOUT";
  var go = (s, phase, now) => ({ ...s, phase, phaseStartedAt: now });
  var idle = (s) => s.inTurn ? "SHIFT" : "IDLE";
  function bump(active, st, by) {
    const n = Math.max(0, (active[st] ?? 0) + by);
    const next = { ...active };
    if (n === 0)
      delete next[st];
    else
      next[st] = n;
    return next;
  }
  function reduce(s, ev, now) {
    switch (ev.type) {
      case "RESTORE": {
        const base = { ...s, active: {}, gate: null, crew: 0, truck: null, mode: ev.mode };
        if (s.sessionStartedAt === 0) {
          return settle({ ...base, progress: ev.stored ?? freshProgress(now), phase: "IDLE", phaseStartedAt: now, sessionStartedAt: now }, now);
        }
        return settle({ ...base, progress: freshest(s.progress, ev.stored) }, now);
      }
      case "TURN_START":
        if (isShowtime(s))
          return { ...s, inTurn: true };
        return go({ ...s, inTurn: true, trouble: null }, "SHIFT", now);
      case "TURN_END": {
        const ended = { ...s, inTurn: false, active: {}, gate: null, truck: null };
        if (isShowtime(s))
          return ended;
        if (ev.reason === "aborted")
          return go(ended, "PAUSE", now);
        if (ev.reason !== "answer") {
          return go({ ...ended, trouble: { kind: "scrub", code: ev.reason, until: now + REFUSAL_MS } }, "IDLE", now);
        }
        const p = freshest(s.progress, ev.stored);
        return go({ ...ended, progress: { ...p, ring: Math.min(p.ring + 1, RINGS) } }, "STACK", now);
      }
      case "TOOL_START": {
        const st = stationOf(ev.tool);
        if (st === "crew")
          return { ...s, crew: s.crew + 1 };
        if (st === "lights")
          return go(s, "CLOSED", now);
        return { ...s, active: bump(s.active, st, 1), truck: st === "supply" ? truckLabel(ev.tool) : s.truck };
      }
      case "TOOL_END": {
        const st = stationOf(ev.tool);
        if (st === "lights")
          return s;
        let next = st === "crew" ? { ...s, crew: Math.max(0, s.crew - 1) } : { ...s, active: bump(s.active, st, -1) };
        if (st === "supply" && !next.active.supply)
          next = { ...next, truck: null };
        if (ev.outcome === "ok" && st === "weld")
          next = { ...next, progress: { ...next.progress, welds: next.progress.welds + 1 } };
        if (ev.outcome === "error" || ev.outcome === "deny") {
          next = {
            ...next,
            progress: { ...next.progress, rejects: next.progress.rejects + 1 },
            failing: { station: st, label: ev.outcome === "deny" ? "DENIED" : "FAILED", until: now + FAILING_MS }
          };
        }
        return { ...next, gate: null };
      }
      case "GATE_OPEN":
        return { ...s, gate: { tool: ev.tool } };
      case "GATE_CLOSE":
        return { ...s, gate: null };
      case "API_ERROR": {
        const kind = troubleKindOf(ev.code);
        return go({ ...s, inTurn: false, active: {}, gate: null, truck: null, trouble: { kind, code: ev.code, until: now + troubleShowMs(kind) } }, "IDLE", now);
      }
      case "COMPACT_START":
        return isShowtime(s) ? s : go(s, "SERVICE", now);
      case "COMPACT_END":
        return s.phase === "SERVICE" ? go(s, idle(s), now) : s;
      case "CLEARED":
        return go({ ...s, progress: freshest(s.progress, ev.stored), inTurn: false, active: {}, gate: null, crew: 0, truck: null, trouble: null, sessionStartedAt: now }, "HANDOVER", now);
      case "FAULT":
        return { ...s, faults: s.faults + 1, faultUntil: now + FAULT_MS };
      case "MODE":
        return { ...s, mode: ev.mode };
      case "TICK":
        return { ...settle(s, now), minute: s.sessionStartedAt ? Math.floor((now - s.sessionStartedAt) / 60000) : 0 };
    }
  }
  function settle(s, now) {
    let cur = expireMarks(s, now);
    for (let guard = 0;guard < 8; guard++) {
      const step = timedStep(cur);
      if (!step || step.at > now)
        return cur;
      cur = step.apply(cur, step.at);
    }
    return cur;
  }
  function expireMarks(s, now) {
    return {
      ...s,
      failing: s.failing && s.failing.until > now ? s.failing : null,
      trouble: s.trouble && s.trouble.until > now ? s.trouble : null,
      faultUntil: s.faultUntil > now ? s.faultUntil : 0
    };
  }
  function timedStep(s) {
    const t0 = s.phaseStartedAt;
    switch (s.phase) {
      case "STACK":
        return { at: t0 + PHASE_MS.STACK, apply: (x, at) => go(x, x.progress.ring >= RINGS ? "READY" : idle(x), at) };
      case "READY":
        return { at: t0 + PHASE_MS.READY, apply: (x, at) => go(x, "FIRE", at) };
      case "FIRE":
        return { at: t0 + PHASE_MS.FIRE, apply: (x, at) => go(x, "ROLLOUT", at) };
      case "ROLLOUT":
        return {
          at: t0 + PHASE_MS.ROLLOUT,
          apply: (x, at) => go({ ...x, progress: freshProgress(at, x.progress.fleet + 1, x.progress.ship + 1) }, idle(x), at)
        };
      case "PAUSE":
        return { at: t0 + PHASE_MS.PAUSE, apply: (x, at) => go(x, idle(x), at) };
      case "HANDOVER":
        return { at: t0 + PHASE_MS.HANDOVER, apply: (x, at) => go(x, idle(x), at) };
      default:
        return null;
    }
  }

  // hooks/scene-parts/scene-context-and-text-helpers.ts
  var AMB = "#ffb547";
  var RED = "#ff6250";
  var MONO = "ui-monospace, Menlo, monospace";
  var HZ = 640;
  function makeCtx(s, now, anim) {
    const ringH = 54;
    const baseY = 820;
    const shown = Math.min(s.progress.ring, RINGS);
    return {
      s,
      now,
      anim,
      P: s.phase,
      tr: s.trouble?.kind,
      cx: 470,
      rw: 96,
      ringH,
      baseY,
      shown,
      topY: baseY - ringH * shown,
      dark: s.phase === "CLOSED",
      dim: s.trouble?.kind === "fuel",
      phaseAgeS: Math.max(0, (now - s.phaseStartedAt) / 1000)
    };
  }
  var cls = (c, name) => c.anim ? name : "";
  var isOn = (c, st) => (c.s.active[st] ?? 0) > 0;
  var esc = (str) => str.replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[ch] ?? ch);
  var pad = (n) => String(n).padStart(2, "0");
  function txt(x, y, str, size = 14, fill = "#9a9a9a", anchor = "start", extra = "") {
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${MONO}" font-size="${size}" letter-spacing="2" fill="${fill}" ${extra}>${esc(str)}</text>`;
  }
  var times = (n, f) => Array.from({ length: Math.max(0, n) }, (_, i) => f(i)).join("");

  // hooks/scene-parts/back-wall-floor-and-bay-door.ts
  function wall(c) {
    let o = `<rect width="1600" height="${HZ}" fill="url(#wall)"/>`;
    for (let x = 40;x < 1600; x += 80)
      o += `<rect x="${x}" y="0" width="6" height="${HZ}" fill="#161616"/>`;
    for (let x = 520;x < 1280; x += 96) {
      o += `<rect x="${x}" y="70" width="70" height="44" fill="${c.dark ? "#121212" : "#1d1d1d"}"/><line x1="${x + 35}" y1="70" x2="${x + 35}" y2="114" stroke="#101010" stroke-width="3"/>`;
    }
    const bay = isOn(c, "bay");
    o += `<g>${times(3, (i) => `<rect x="${560 + i * 30}" y="${HZ - 150}" width="20" height="14" fill="${bay ? AMB : "#1c1c1c"}" opacity="${bay ? 0.8 : 1}"/>`)}${txt(560, HZ - 160, "FAR BAY", 10, "#3a3a3a")}</g>`;
    const shelves = times(4, (i) => `<rect x="740" y="${HZ - 110 + i * 26}" width="220" height="4" fill="#202020"/>${times(6, (j) => `<rect x="${750 + j * 34}" y="${HZ - 128 + i * 26}" width="22" height="18" fill="#1a1a1a"/>`)}`);
    const scan = isOn(c, "stock") ? `<rect class="${cls(c, "shelf")}" x="744" y="${HZ - 132}" width="5" height="112" fill="${AMB}" opacity=".8" filter="url(#glow)"/>` : "";
    return `${o}<g>${shelves}${scan}${txt(850, HZ - 140, "STORES", 10, "#3a3a3a", "middle")}</g>`;
  }
  function bayDoor(c) {
    const shut = c.tr === "gate";
    const fleet = c.s.progress.fleet;
    const stars = times(18, (i) => `<circle cx="${1300 + i * 61 % 270}" cy="${265 + i * 37 % 170}" r="${i % 5 ? 0.9 : 1.6}" fill="#d8d8d8" opacity="${(0.3 + i % 4 * 0.15).toFixed(2)}" class="${i % 5 ? "" : cls(c, "tw")}"/>`);
    const ships = times(Math.min(fleet, 5), (i) => {
      const x = 1550 - i * 44;
      return `<g opacity="${(0.9 - i * 0.12).toFixed(2)}"><rect x="${x - 8}" y="${HZ - 120}" width="16" height="120" fill="#262626"/><path d="M${x - 8} ${HZ - 120} q8 -30 16 0 z" fill="#262626"/><rect x="${x - 8}" y="${HZ - 120}" width="3" height="120" fill="#4a4a4a"/></g>`;
    });
    const shutter = `<rect x="1290" y="250" width="290" height="${shut ? HZ - 250 : 18}" fill="url(#shutter)" class="${shut ? cls(c, "shutDown") : ""}" style="transform-origin:1435px 250px"/>`;
    const sign = shut ? `<rect x="1355" y="420" width="160" height="40" fill="#0c0c0c" stroke="${RED}" stroke-width="2"/>${txt(1435, 447, "SUSPENDED", 18, RED, "middle", 'font-weight="700"')}` : "";
    const frame = `<rect x="1282" y="240" width="306" height="10" fill="#222"/><rect x="1282" y="240" width="8" height="${HZ - 240}" fill="#222"/><rect x="1580" y="240" width="8" height="${HZ - 240}" fill="#222"/>`;
    return `<g><rect x="1290" y="250" width="290" height="${HZ - 250}" fill="#070707"/>${stars}${ships}${txt(1300, 292, `FLEET · ${fleet} SHIPS`, 12, "#7a7a7a")}${shutter}${sign}${frame}</g>`;
  }
  function lamps(c) {
    return [600, 900, 1180].map((x, i) => {
      const off = c.dark || c.dim && i % 2 === 1;
      const cone = off ? "" : `<path class="${cls(c, c.tr === "signal" ? "flicker" : "hum")}" d="M${x - 18} 168 L${x - 230} 1000 L${x + 230} 1000 L${x + 18} 168 Z" fill="url(#cone)"/><rect x="${x - 14}" y="166" width="28" height="4" fill="#f2f2f2"/>`;
      return `<line x1="${x}" y1="0" x2="${x}" y2="150" stroke="#2a2a2a" stroke-width="2"/><path d="M${x - 22} 168 h44 l-8 -18 h-28 z" fill="#2c2c2c"/>${cone}`;
    }).join("");
  }
  function floor() {
    let o = `<rect y="${HZ}" width="1600" height="${1000 - HZ}" fill="#0f0f0f"/>`;
    for (let i = -10;i <= 26; i++)
      o += `<line x1="${800 + i * 22}" y1="${HZ}" x2="${800 + i * 150}" y2="1000" stroke="#1c1c1c" stroke-width="1.2"/>`;
    for (let k = 1;k < 10; k++) {
      const y = (HZ + (1000 - HZ) * k * k / 81).toFixed(1);
      o += `<line x1="0" y1="${y}" x2="1600" y2="${y}" stroke="#1c1c1c" stroke-width="1.2"/>`;
    }
    return `${o}<line x1="0" y1="${HZ}" x2="1600" y2="${HZ}" stroke="#262626" stroke-width="2"/>`;
  }
  function roomShell(c) {
    return wall(c) + bayDoor(c) + lamps(c) + floor();
  }

  // hooks/scene-parts/control-console-and-wall-stations.ts
  function consoleDesk(c) {
    const busy = Object.keys(c.s.active).length > 0 || c.s.crew > 0;
    const plan = isOn(c, "plan");
    const monitors = times(3, (i) => {
      const X = 1312 + i * 80;
      const lit = plan || busy && i === 1;
      const blueprint = `<g stroke="${AMB}" stroke-width="1.2" fill="none" opacity=".9" filter="url(#glow)"><rect x="${X + 12}" y="616" width="42" height="28"/><line x1="${X + 33}" y1="616" x2="${X + 33}" y2="644"/><line x1="${X + 12}" y1="630" x2="${X + 54}" y2="630"/></g>`;
      const lines = times(4, (j) => `<rect class="${cls(c, "think")}" style="animation-delay:${((i + j) * 0.2).toFixed(1)}s" x="${X + 11}" y="${615 + j * 8}" width="${20 + (i * 7 + j * 11) % 24}" height="3" fill="${AMB}" opacity=".85"/>`);
      return `<rect x="${X}" y="604" width="66" height="54" rx="6" fill="#141414" stroke="#2e2e2e" stroke-width="3"/><rect x="${X + 6}" y="610" width="54" height="40" rx="4" fill="${lit ? "#1a1406" : "#0b0b0b"}"/>${lit ? plan ? blueprint : lines : ""}<rect x="${X + 28}" y="658" width="10" height="26" fill="#1f1f1f"/>`;
    });
    const keys = times(8, (i) => `<rect x="${1314 + i * 28}" y="716" width="14" height="8" fill="${busy && i % 3 === 0 ? AMB : "#262626"}"/>`);
    const ask = isOn(c, "ask");
    const beacon = `<rect x="1528" y="586" width="12" height="16" fill="${ask ? AMB : "#262626"}" class="${ask ? cls(c, "blink") : ""}"/>${ask ? `<path class="${cls(c, "sweep")}" d="M1534 592 l-150 -60 v40 z" fill="${AMB}" opacity=".18" style="transform-origin:1534px 592px"/>` : ""}`;
    const radio = isOn(c, "radio");
    const waves = radio && c.anim ? times(3, (i) => `<circle class="ping" style="animation-delay:${i * 0.5}s" cy="-24" r="8" fill="none" stroke="${AMB}" stroke-width="2"/>`) : "";
    const dish = `<g transform="translate(1310 590)"><g class="${radio ? cls(c, "dish") : ""}"><path d="M-22 0 q22 -28 44 0 z" fill="#333"/><line x1="0" y1="-8" x2="0" y2="-24" stroke="#666" stroke-width="2"/></g>${waves}</g>`;
    return `<g><rect x="1300" y="700" width="250" height="70" fill="#181818" stroke="#2a2a2a"/><path d="M1290 700 h270 l-10 -16 h-250 z" fill="#202020"/>${monitors}${keys}${txt(1425, 756, "CONTROL DESK", 11, "#4a4a4a", "middle")}${beacon}${dish}</g>`;
  }
  function wallClockAndSiren(c) {
    const clock = `<g><circle cx="1220" cy="220" r="22" fill="#141414" stroke="#2e2e2e" stroke-width="3"/><line class="${isOn(c, "clock") ? cls(c, "hand") : ""}" x1="1220" y1="220" x2="1220" y2="204" stroke="#d0d0d0" stroke-width="2.5" style="transform-origin:1220px 220px"/><line x1="1220" y1="220" x2="1230" y2="220" stroke="#d0d0d0" stroke-width="2"/></g>`;
    const siren = isOn(c, "siren");
    const rings = siren && c.anim ? times(2, (i) => `<path class="ping2" style="animation-delay:${i * 0.4}s" d="M30 -14 q14 19 0 38" stroke="${AMB}" stroke-width="2" fill="none"/>`) : "";
    return `${clock}<g transform="translate(1180 300)"><path d="M0 0 l24 -12 v34 z" fill="${siren ? AMB : "#2e2e2e"}"/>${rings}</g>`;
  }
  function truck(c) {
    if (!isOn(c, "supply") || !c.s.truck)
      return "";
    const label = c.s.truck.length > 14 ? `${c.s.truck.slice(0, 13)}…` : c.s.truck;
    return `<g class="${cls(c, "truck")}"><rect x="1330" y="560" width="150" height="62" rx="3" fill="#202020" stroke="#383838"/><rect x="1480" y="578" width="46" height="44" rx="3" fill="#2a2a2a"/>${txt(1405, 584, label, 13, "#e6e6e6", "middle")}<circle cx="1360" cy="626" r="10" fill="#050505"/><circle cx="1500" cy="626" r="10" fill="#050505"/></g>`;
  }
  function conveyor(c) {
    const jam = c.tr === "jam";
    const crates = isOn(c, "ship") || jam ? times(3, (i) => `<rect class="${jam ? "" : cls(c, "belt")}" style="animation-delay:${(i * 0.7).toFixed(1)}s" x="${jam ? 1520 - i * 32 : 1190}" y="906" width="30" height="24" fill="#3a3a3a" stroke="#555"/>`) : "";
    return `<g><rect x="1180" y="930" width="420" height="10" fill="#1e1e1e"/>${times(6, (i) => `<circle cx="${1200 + i * 70}" cy="945" r="5" fill="#1a1a1a"/>`)}${crates}</g>`;
  }
  function rightSideStations(c) {
    return truck(c) + consoleDesk(c) + wallClockAndSiren(c) + conveyor(c);
  }

  // hooks/scene-parts/crew-failures-and-show-effects.ts
  function pill(c, x, y, name, delay, hat = "#d6d6d6") {
    const style = delay ? ` style="animation-delay:${delay}s"` : "";
    return `<g class="${cls(c, name)}"${style}><rect x="${x - 7}" y="${y - 30}" width="14" height="30" rx="7" fill="#8a8a8a"/><rect x="${x - 7}" y="${y - 30}" width="14" height="8" rx="4" fill="${hat}"/></g>`;
  }
  function crew(c) {
    let o = "";
    if (!c.dark)
      o += pill(c, 760, 760, "walkA", 0) + pill(c, 980, 720, "walkB", 0);
    if (isOn(c, "misc"))
      o += `<g class="${cls(c, "walkA")}">${pill(c, 900, 880, "", 0)}<rect x="906" y="862" width="16" height="10" fill="#6a6a6a"/></g>`;
    o += times(Math.min(c.s.crew, 5), (i) => pill(c, 640 + i * 40, 962, "bob", i * 0.3, AMB));
    if (!c.dark)
      o += `<g class="${cls(c, "cart")}"><rect x="820" y="900" width="60" height="22" fill="#2a2a2a"/><circle cx="830" cy="926" r="5" fill="#050505"/><circle cx="870" cy="926" r="5" fill="#050505"/></g>`;
    return o;
  }
  function rejectPile(c) {
    const n = c.s.progress.rejects;
    const crates = times(Math.min(n, 8), (i) => {
      const x = 250 + i % 4 * 12;
      const y = 950 - Math.floor(i / 4) * 10 - i % 2 * 3;
      return `<rect x="${x}" y="${y}" width="12" height="9" fill="#2a1c1a" stroke="${RED}" stroke-width=".8" transform="rotate(${i * 23 % 30 - 15} ${x + 6} 954)"/>`;
    });
    return `<g>${crates}${txt(250, 982, `SCRAP ${n}`, 11, "#6a4a46")}</g>`;
  }
  function failSpot(c) {
    switch (c.s.failing?.station) {
      case "supply":
        return [1405, 590];
      case "crane":
        return [1040, 880];
      case "weld":
        return [1110, 748];
      case "radio":
      case "plan":
      case "ask":
        return [1420, 630];
      case "cut":
        return [650, 850];
      default:
        return [c.cx, c.topY];
    }
  }
  function failure(c) {
    if (!c.s.failing)
      return "";
    const [fx, fy] = failSpot(c);
    const sparks = c.anim ? times(8, (i) => `<circle class="spark" style="animation-delay:${(i * 0.08).toFixed(2)}s" cx="${i % 3 * 4}" r="2.4" fill="${RED}"/>`) : "";
    return `<g transform="translate(${fx} ${fy})">${sparks}<circle class="${cls(c, "smoke")}" cy="-20" r="22" fill="#2a2a2a" opacity=".8"/><path d="M-12 -12 l24 24 M12 -12 l-24 24" stroke="${RED}" stroke-width="4"/></g>`;
  }
  function barrierAndGauges(c) {
    let o = "";
    const gate = c.s.gate;
    if (gate) {
      const tool = gate.tool.length > 16 ? `${gate.tool.slice(0, 15)}…` : gate.tool;
      o += `<g><rect x="${c.cx + 70}" y="800" width="8" height="70" fill="#333"/><rect x="${c.cx + 70}" y="796" width="170" height="12" fill="url(#hazard)"/><circle cx="${c.cx + 74}" cy="790" r="7" fill="${AMB}" class="${cls(c, "blink")}" filter="url(#glow)"/>${txt(c.cx + 156, 786, tool, 12, AMB, "middle")}</g>`;
    }
    if (c.tr === "fuel")
      o += `<g transform="translate(1200 780)"><rect width="56" height="86" rx="6" fill="#161616" stroke="#333"/><rect x="8" y="74" width="40" height="4" fill="${AMB}"/>${txt(28, 104, "0%", 12, AMB, "middle")}</g>`;
    if (c.P === "SERVICE")
      o += `<rect class="${cls(c, "scan")}" x="${c.cx - c.rw / 2 - 16}" y="${c.topY}" width="${c.rw + 32}" height="3" fill="${AMB}" opacity=".7" filter="url(#glow)"/>`;
    return o;
  }
  function staticFire(c) {
    if (c.P !== "FIRE")
      return "";
    const { cx, baseY } = c;
    const flame = `<path class="${cls(c, "flame")}" d="M${cx - 34} ${baseY + 20} Q${cx} ${baseY + 200} ${cx + 34} ${baseY + 20} Z" fill="url(#flame)"/>`;
    const steam = c.anim ? times(9, (i) => `<circle class="steam" style="animation-delay:${(i * 0.3).toFixed(2)}s" cx="${cx + (i % 2 ? 1 : -1) * (50 + i * 24)}" cy="${baseY + 80}" r="${44 + i * 6}" fill="#e6e6e6" opacity=".2"/>`) : `<ellipse cx="${cx}" cy="${baseY + 90}" rx="240" ry="46" fill="#e6e6e6" opacity=".16"/>`;
    return flame + steam;
  }
  function floorLife(c) {
    return crew(c) + rejectPile(c) + failure(c) + barrierAndGauges(c) + staticFire(c);
  }

  // hooks/factory-display-copy.ts
  var SHIP_NAMES = ["Morning Star", "Evening Star", "Polaris", "Pleiades", "Altair", "Vega", "Orion"];
  function shipName(n) {
    const base = SHIP_NAMES[(n - 1) % SHIP_NAMES.length] ?? "Morning Star";
    const round = Math.floor((n - 1) / SHIP_NAMES.length);
    return round > 0 ? `${base} ${round + 1}` : base;
  }
  var shipCode = (n) => `SHIP-${String(n).padStart(2, "0")}`;
  var PHASE_LABEL = {
    IDLE: "STANDING BY",
    SHIFT: "ON SHIFT",
    STACK: "STACKING",
    READY: "READY",
    FIRE: "STATIC FIRE",
    ROLLOUT: "ROLL-OUT",
    SERVICE: "MAINTENANCE",
    HANDOVER: "SHIFT CHANGE",
    PAUSE: "PAUSED",
    CLOSED: "LIGHTS OUT"
  };
  var STATION_LABEL = {
    survey: "SURVEYING",
    stock: "STOCKTAKE",
    weld: "WELDING",
    cut: "CUTTING",
    crane: "HAULING",
    radio: "RADIO LINK",
    supply: "DELIVERY",
    crew: "OVERTIME",
    plan: "PLANNING",
    ask: "CALLING COMMAND",
    ship: "SHIPPING",
    siren: "ANNOUNCING",
    clock: "SCHEDULING",
    bay: "NEW LINE",
    lights: "LIGHTS OUT",
    misc: "ODD JOBS"
  };
  var TROUBLE_LABEL = {
    signal: "SIGNAL LOST",
    fuel: "OUT OF FUEL",
    gate: "LICENCE REVOKED",
    jam: "STORES FULL",
    scrub: "SCRUBBED"
  };
  function hudLabel(s, now) {
    if (s.trouble)
      return { text: TROUBLE_LABEL[s.trouble.kind], tone: s.trouble.kind === "fuel" || s.trouble.kind === "jam" ? "warn" : "fail" };
    if (s.gate)
      return { text: "AWAITING APPROVAL", tone: "warn" };
    if (s.failing)
      return { text: s.failing.label, tone: "fail" };
    const running = Object.keys(s.active);
    const last = running[running.length - 1];
    if (last)
      return { text: STATION_LABEL[last], tone: "busy" };
    if (s.crew > 0)
      return { text: STATION_LABEL.crew, tone: "busy" };
    if (s.faultUntil > now)
      return { text: "POWER FAULT", tone: "warn" };
    const busy = s.phase === "STACK" || s.phase === "READY" || s.phase === "FIRE" || s.phase === "ROLLOUT";
    return { text: PHASE_LABEL[s.phase], tone: busy ? "busy" : "calm" };
  }

  // hooks/scene-parts/seven-segment-digits.ts
  var SEGMENTS = {
    0: "abcdef",
    1: "bc",
    2: "abged",
    3: "abgcd",
    4: "fgbc",
    5: "afgcd",
    6: "afgedc",
    7: "abc",
    8: "abcdefg",
    9: "abcdfg",
    "-": "g"
  };
  var segCell = (h) => h * 0.52 + h * 0.22;
  function seg7(x, y, str, h = 40, color = AMB, colonClass = "") {
    const w = h * 0.52;
    const t = h * 0.11;
    let out = "";
    [...str].forEach((ch, i) => {
      const X = x + i * segCell(h);
      if (ch === ":") {
        out += `<g class="${colonClass}"><rect x="${(X + w * 0.3).toFixed(1)}" y="${(y + h * 0.28).toFixed(1)}" width="${t.toFixed(1)}" height="${t.toFixed(1)}" fill="${color}"/><rect x="${(X + w * 0.3).toFixed(1)}" y="${(y + h * 0.64).toFixed(1)}" width="${t.toFixed(1)}" height="${t.toFixed(1)}" fill="${color}"/></g>`;
        return;
      }
      const R = {
        a: [X + t, y, w - 2 * t, t],
        d: [X + t, y + h - t, w - 2 * t, t],
        g: [X + t, y + h / 2 - t / 2, w - 2 * t, t],
        f: [X, y + t, t, h / 2 - t],
        b: [X + w - t, y + t, t, h / 2 - t],
        e: [X, y + h / 2, t, h / 2 - t],
        c: [X + w - t, y + h / 2, t, h / 2 - t]
      };
      for (const seg of "abcdefg") {
        const lit = (SEGMENTS[ch] ?? "").includes(seg);
        const [rx = 0, ry = 0, rw = 0, rh = 0] = R[seg] ?? [];
        out += `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" rx="1" fill="${color}" opacity="${lit ? 1 : 0.08}"/>`;
      }
    });
    return `<g filter="url(#glow)">${out}</g>`;
  }

  // hooks/scene-parts/hud-overlay.ts
  var TONE = { calm: "#e6e6e6", busy: AMB, warn: AMB, fail: RED };
  function corners() {
    const br = (x, y, dx, dy) => `<path d="M${x} ${y + dy * 34} V${y} H${x + dx * 34}" stroke="#6a6a6a" stroke-width="2" fill="none"/>`;
    return br(30, 30, 1, 1) + br(1570, 30, -1, 1) + br(30, 970, 1, -1) + br(1570, 970, -1, -1);
  }
  function missionClock(c) {
    const mins = c.s.sessionStartedAt ? Math.max(0, Math.floor((c.now - c.s.sessionStartedAt) / 60000)) : 0;
    const clock = `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
    const h = 38;
    return txt(1540, 62, "MISSION TIME · T+", 12, "#7a7a7a", "end") + seg7(1540 - clock.length * segCell(h) + h * 0.22, 74, clock, h, AMB, cls(c, "colon"));
  }
  function statusBlock(c) {
    const p = c.s.progress;
    const label = hudLabel(c.s, c.now);
    const color = TONE[label.tone];
    const lw = label.text.length * 10.5 + 26;
    let o = txt(1540, 142, `${shipCode(p.ship)} ${shipName(p.ship).toUpperCase()}`, 15, "#d6d6d6", "end");
    o += txt(1540, 164, `RING ${c.shown}/8 · WELDS ${pad(Math.min(p.welds, 999))} · SCRAP ${pad(Math.min(p.rejects, 99))}`, 13, "#8a8a8a", "end");
    o += `<rect x="${1540 - lw}" y="178" width="${lw}" height="28" fill="#0a0a0a" fill-opacity=".7" stroke="${color}" stroke-width="1.5"/>`;
    o += txt(1528, 198, label.text, 15, color, "end", 'filter="url(#glow)"');
    if (c.s.mode === "calm")
      o += txt(1540, 226, "CALM MODE", 11, "#6a6a6a", "end");
    return o;
  }
  function recLine(c) {
    return `<g><circle cx="1222" cy="954" r="6" fill="${RED}" class="${cls(c, "blink")}"/>${txt(1234, 959, "REC", 13, "#bdbdbd")}${txt(1540, 959, `FACTORY 01 · FLEET ${c.s.progress.fleet}`, 12, "#7a7a7a", "end")}</g>`;
  }
  function countdown(c) {
    if (c.P !== "READY")
      return "";
    const label = txt(1110, 510, "SECONDS TO STATIC FIRE", 16, "#c9a46a", "middle");
    if (!c.anim)
      return `${seg7(1060, 300, String(Math.max(1, 3 - Math.floor(c.phaseAgeS))), 170)}${label}`;
    const delay = `animation-delay:-${c.phaseAgeS.toFixed(2)}s`;
    return ["3", "2", "1"].map((d, i) => `<g class="cd${i}" style="${delay}">${seg7(1060, 300, d, 170)}</g>`).join("") + label;
  }
  function patch(c) {
    if (c.P !== "ROLLOUT")
      return "";
    const p = c.s.progress;
    const mins = Math.max(1, Math.round((c.s.phaseStartedAt - p.shipStartedAt) / 60000));
    return `<g transform="translate(1110 400)"><g class="${cls(c, "pop")}" style="animation-delay:-${c.phaseAgeS.toFixed(2)}s"><circle r="96" fill="#111" stroke="${AMB}" stroke-width="3"/><circle r="84" fill="none" stroke="#333" stroke-dasharray="3 5"/>${txt(0, -34, "ROLLED OUT", 12, "#c9a46a", "middle")}${txt(0, 0, shipCode(p.ship), 26, "#ececec", "middle", 'font-weight="700"')}${txt(0, 22, shipName(p.ship).toUpperCase(), 12, "#bdbdbd", "middle")}${txt(0, 44, `8 rings · ${p.welds} welds`, 11, "#8a8a8a", "middle")}${txt(0, 60, `${p.rejects} scrap · ${mins} min`, 11, "#8a8a8a", "middle")}</g></g>`;
  }
  function hudOverlay(c) {
    return { topRight: missionClock(c) + statusBlock(c), bottomRight: recLine(c), inRoom: corners() + countdown(c) + patch(c) };
  }

  // hooks/scene-parts/svg-defs-and-keyframes.ts
  var DEFS = `<defs>
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
</defs>`;
  function loop(c, name, periodS, rest) {
    const offset = (c.now / 1000 % periodS).toFixed(2);
    return `.${name}{animation:${name} ${periodS}s -${offset}s ${rest}}`;
  }
  function keyframes(c) {
    const travel = Math.max(120, c.baseY - c.topY - 60);
    return `${loop(c, "tw", 3, "infinite alternate")}@keyframes tw{to{opacity:.1}}
${loop(c, "hum", 9, "infinite")}@keyframes hum{0%,95%,100%{opacity:1}97%{opacity:.55}}.flicker{animation:flk .35s infinite steps(2)}@keyframes flk{50%{opacity:.2}}
.blink{animation:blink 1.1s infinite steps(1)}@keyframes blink{50%{opacity:.15}}.colon{animation:blink 1s infinite steps(1)}
.spark{animation:spark .55s infinite ease-out}@keyframes spark{0%{transform:translate(0,0);opacity:1}100%{transform:translate(-22px,44px);opacity:0}}.sparkR{animation-name:sparkR}@keyframes sparkR{0%{transform:translate(0,0);opacity:1}100%{transform:translate(22px,44px);opacity:0}}
.arcFlick,.cutter{animation:arcF .12s infinite alternate}@keyframes arcF{from{opacity:.35}to{opacity:1}}
.armL{animation:armL 1.4s infinite ease-in-out}@keyframes armL{50%{transform:rotate(-6deg)}}.armR{animation:armR 1.4s infinite ease-in-out}@keyframes armR{50%{transform:rotate(6deg)}}
.drop{animation:drop 1.6s cubic-bezier(.3,.7,.3,1) both}@keyframes drop{from{transform:translateY(-240px)}to{transform:none}}
.droneScan{animation:dscan 2.2s infinite ease-in-out}@keyframes dscan{50%{transform:translateY(${travel}px)}}
.trolley{animation:trol 2.4s infinite ease-in-out}@keyframes trol{50%{transform:translateX(-150px)}}.forklift{animation:fork 3.2s infinite ease-in-out}@keyframes fork{50%{transform:translateX(-300px)}}
${loop(c, "walkA", 14, "infinite linear")}@keyframes walkA{50%{transform:translateX(-200px)}}${loop(c, "walkB", 17, "infinite linear")}@keyframes walkB{50%{transform:translateX(220px)}}${loop(c, "cart", 11, "infinite ease-in-out")}@keyframes cart{50%{transform:translateX(160px)}}
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
${loop(c, "roll", 7, "infinite linear")}@keyframes roll{from{transform:translateY(-140px)}to{transform:translateY(1000px)}}
.band{animation:band .6s infinite linear}@keyframes band{to{transform:translateY(160px)}}.staticFx{animation:stat .12s infinite steps(2)}@keyframes stat{50%{transform:translate(-8px,6px)}}
.jitter{animation:jit .18s infinite steps(2)}@keyframes jit{50%{transform:translate(3px,-2px)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.cd1,.cd2,.rollout{display:none}}`;
  }

  // hooks/scene-parts/tower-crane-rocket-and-weld-bay.ts
  var resume = (c) => c.anim ? `animation-delay:-${c.phaseAgeS.toFixed(2)}s` : "";
  function weldBay(c) {
    const welding = isOn(c, "weld");
    const arm = (side, name) => `<g class="${welding ? cls(c, name) : ""}" style="transform-origin:${side * 100}px 30px"><rect x="${side === 1 ? 96 : -104}" y="-10" width="8" height="44" fill="#3a3a3a"/><path d="M${side * 100} -6 L${side * 62} -30 L${side * 58} -24 L${side * 96} 0 Z" fill="#4a4a4a"/><circle cx="${side * 60}" cy="-27" r="5" fill="#666"/></g>`;
    const sparks = c.anim ? times(12, (i) => `<circle class="spark${i % 2 ? "" : " sparkR"}" style="animation-delay:${(i * 0.09).toFixed(2)}s" cx="${i % 2 ? -56 : 56}" cy="-12" r="2.2" fill="#fff3d6"/>`) : "";
    const arcs = welding ? `<circle cx="-56" cy="-12" r="26" fill="url(#arc)" class="${cls(c, "arcFlick")}"/><circle cx="56" cy="-12" r="26" fill="url(#arc)" class="${cls(c, "arcFlick")}"/>${sparks}` : "";
    return `<g transform="translate(1110 760)"><rect x="-120" y="-150" width="8" height="190" fill="#262626"/><rect x="112" y="-150" width="8" height="190" fill="#262626"/><rect x="-124" y="-156" width="248" height="10" fill="#2a2a2a"/>
<ellipse cx="0" cy="10" rx="62" ry="18" fill="none" stroke="#9a9a9a" stroke-width="10"/><ellipse cx="0" cy="4" rx="62" ry="18" fill="none" stroke="#d6d6d6" stroke-width="3"/>${arm(-1, "armL")}${arm(1, "armR")}${arcs}${txt(0, 70, "BAY 01 · WELDING", 10, "#4a4a4a", "middle")}</g>`;
  }
  function tower(c) {
    const p = c.s.progress;
    let o = "";
    for (let y = 230;y < 900; y += 36)
      o += `<path d="M300 ${y} L344 ${y + 36} M344 ${y} L300 ${y + 36}" stroke="#2c2c2c" stroke-width="2"/>`;
    o += `<rect x="296" y="220" width="52" height="680" fill="none" stroke="#3a3a3a" stroke-width="5"/>`;
    const red = c.tr === "scrub";
    o += times(RINGS, (i) => {
      const y = c.baseY - c.ringH * (i + 1) + c.ringH / 2;
      const lit = i < c.shown;
      const next = c.P === "SHIFT" && i === c.shown;
      return `<rect x="284" y="${y - 6}" width="10" height="12" rx="1" fill="${red ? RED : lit ? AMB : "#1f1f1f"}" ${lit || red ? 'filter="url(#glow)"' : ""} class="${next ? cls(c, "blink") : ""}"/>`;
    });
    o += `<rect x="318" y="208" width="8" height="12" fill="${RED}" class="${cls(c, "blink")}"/>`;
    o += txt(322, 196, `T-${pad(p.ship)} · ${c.shown}/8 · H${p.welds}`, 12, "#8a8a8a", "middle");
    const fault = c.s.faultUntil > c.now;
    o += `<rect x="350" y="866" width="24" height="32" fill="#191919" stroke="#333"/><circle cx="362" cy="878" r="4" fill="${fault ? AMB : "#262626"}" class="${fault ? cls(c, "blink") : ""}"/>`;
    const closed = c.P === "READY";
    const armY = c.baseY - c.ringH * 5;
    const arm = (dy) => `<g transform="translate(344 ${armY + dy}) rotate(${closed ? 0 : -28})"><rect y="-5" width="${closed ? c.cx - c.rw / 2 - 344 : 110}" height="10" fill="#3a3a3a"/></g>`;
    return o + arm(-18) + arm(18);
  }
  function crane(c) {
    const busy = isOn(c, "crane");
    const hookY = c.P === "STACK" ? c.topY - 18 : 290;
    const tx = busy ? 640 : c.cx;
    return `<line x1="322" y1="220" x2="720" y2="220" stroke="#3a3a3a" stroke-width="10"/><g class="${busy ? cls(c, "trolley") : ""}"><rect x="${tx - 16}" y="214" width="32" height="14" fill="#444"/><line x1="${tx}" y1="228" x2="${tx}" y2="${hookY}" stroke="#777" stroke-width="2"/><path d="M${tx - 12} ${hookY} h24 v8 h-24 z M${tx} ${hookY + 8} q8 10 0 16" fill="#777" stroke="#777"/></g>`;
  }
  function rocket(c) {
    const { cx, rw, ringH, baseY, shown, topY, P } = c;
    const mount = `<rect x="378" y="840" width="184" height="14" fill="#1f1f1f"/><rect x="392" y="854" width="12" height="60" fill="#1f1f1f"/><rect x="536" y="854" width="12" height="60" fill="#1f1f1f"/>`;
    let o = [-30, -10, 10, 30].map((d) => `<path d="M${cx + d - 8} ${baseY} h16 l5 20 h-26 z" fill="${P === "FIRE" ? "#f2f2f2" : "#444"}"/>`).join("");
    o += times(shown, (i) => {
      const y = baseY - ringH * (i + 1);
      const dropping = P === "STACK" && i === shown - 1;
      return `<g class="${dropping ? cls(c, "drop") : ""}" style="${dropping ? resume(c) : ""}"><rect x="${cx - rw / 2}" y="${y}" width="${rw}" height="${ringH}" fill="url(#steel)"/><line x1="${cx - rw / 2}" x2="${cx + rw / 2}" y1="${y}" y2="${y}" stroke="#555" stroke-width="2"/></g>`;
    });
    if (shown >= RINGS) {
      o += `<path class="${P === "READY" ? cls(c, "drop") : ""}" style="${P === "READY" ? resume(c) : ""}" d="M${cx - rw / 2} ${topY} C${cx - rw / 2} ${topY - 84} ${cx - 18} ${topY - 140} ${cx} ${topY - 150} C${cx + 18} ${topY - 140} ${cx + rw / 2} ${topY - 84} ${cx + rw / 2} ${topY} Z" fill="url(#steel)"/>`;
    }
    if (isOn(c, "weld")) {
      const sparks = c.anim ? times(8, (i) => `<circle class="spark" style="animation-delay:${(i * 0.12).toFixed(2)}s" cx="${cx - rw / 2}" cy="${topY + 6}" r="2.2" fill="#fff3d6"/>`) : "";
      o += `<circle cx="${cx - rw / 2}" cy="${topY + 6}" r="30" fill="url(#arc)" class="${cls(c, "arcFlick")}"/>${sparks}`;
    }
    if (P === "ROLLOUT")
      o = c.anim ? `<g class="rollout" style="${resume(c)}">${o}</g>` : "";
    o = mount + o;
    if (isOn(c, "survey")) {
      o += `<g class="${cls(c, "droneScan")}"><path d="M${cx + 84} ${topY - 6} l-64 74 h44 z" fill="#ffffff" opacity=".08"/><rect x="${cx + 66}" y="${topY - 16}" width="36" height="6" rx="3" fill="#bdbdbd"/><rect x="${cx + 62}" y="${topY - 20}" width="12" height="3" fill="#777"/><rect x="${cx + 94}" y="${topY - 20}" width="12" height="3" fill="#777"/><circle cx="${cx + 84}" cy="${topY - 7}" r="3" fill="${AMB}" class="${cls(c, "blink")}"/></g>`;
    }
    return o;
  }
  function cuttingTableAndForklift(c) {
    const cut = isOn(c, "cut") ? `<rect x="600" y="858" width="100" height="8" fill="#8a8a8a"/><circle class="${cls(c, "cutter")}" cx="612" cy="858" r="5" fill="#fff"/><circle class="${cls(c, "cutter")}" cx="612" cy="858" r="18" fill="url(#arc)"/>` : "";
    const fork = isOn(c, "crane") ? `<g class="${cls(c, "forklift")}"><rect x="1000" y="890" width="76" height="26" rx="3" fill="#3a3a3a"/><rect x="1010" y="866" width="24" height="24" fill="#2a2a2a"/><circle cx="1062" cy="874" r="16" fill="none" stroke="#9a9a9a" stroke-width="6"/><circle cx="1012" cy="920" r="7" fill="#050505"/><circle cx="1064" cy="920" r="7" fill="#050505"/></g>` : "";
    return `<g><rect x="590" y="866" width="120" height="10" fill="#1f1f1f"/><rect x="600" y="876" width="8" height="40" fill="#1f1f1f"/><rect x="692" y="876" width="8" height="40" fill="#1f1f1f"/>${cut}</g>${fork}`;
  }
  function buildFloor(c) {
    return weldBay(c) + tower(c) + crane(c) + rocket(c) + cuttingTableAndForklift(c);
  }

  // hooks/factory-scene-svg.ts
  var ROOT = '<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">';
  var PINS = [
    ["max-aspect-ratio:7/5", 100, 0],
    ["max-aspect-ratio:6/5", 200, 0],
    ["max-aspect-ratio:1/1", 300, 0],
    ["max-aspect-ratio:4/5", 400, 0],
    ["max-aspect-ratio:3/5", 500, 0],
    ["min-aspect-ratio:9/5", 0, 55],
    ["min-aspect-ratio:21/10", 0, 119],
    ["min-aspect-ratio:5/2", 0, 180]
  ];
  var pinCss = PINS.map(([q, dx, dy]) => `@media (${q}){.pinTR{transform:translate(-${dx}px,${dy}px)}.pinBR{transform:translate(-${dx}px,-${dy}px)}}`).join("");
  function signalLoss(c) {
    if (c.tr !== "signal")
      return "";
    const noise = c.anim ? '<rect width="1600" height="1000" filter="url(#noise)" class="staticFx"/>' : '<rect width="1600" height="1000" fill="#888" opacity=".15"/>';
    const bands = times(7, (i) => `<rect class="${cls(c, "band")}" style="animation-delay:${(i * 0.17).toFixed(2)}s" y="${i * 149 % 1000}" width="1600" height="${6 + i % 3 * 8}" fill="#cfcfcf" opacity=".12"/>`);
    return `<g opacity=".85">${noise}${bands}<rect x="560" y="440" width="480" height="70" fill="#0a0a0a" stroke="${RED}" stroke-width="2"/>${txt(800, 486, "SIGNAL LOST · RETRYING", 22, RED, "middle", 'filter="url(#glow)"')}</g>`;
  }
  function crtLayer(c, grain) {
    const roll = c.anim ? '<rect class="roll" width="1600" height="120" fill="url(#rollG)"/>' : "";
    const noise = grain ? '<rect width="1600" height="1000" filter="url(#grain)"/>' : "";
    return `${noise}<rect width="1600" height="1000" fill="url(#scan)"/>${roll}<rect width="1600" height="1000" fill="url(#vig)"/>`;
  }
  function pinnedHud(c) {
    const hud = hudOverlay(c);
    return `${hud.inRoom}<g class="pinTR">${hud.topRight}</g><g class="pinBR">${hud.bottomRight}</g>`;
  }
  function buildScene(s, now) {
    const c = makeCtx(s, now, s.mode !== "calm");
    const room = roomShell(c) + rightSideStations(c) + buildFloor(c) + floorLife(c);
    const shake = c.tr === "signal" ? cls(c, "jitter") : "";
    return `${ROOT}${DEFS}<style>${keyframes(c)}${pinCss}</style><rect width="1600" height="1000" fill="#0c0c0c"/><g class="${shake}">${room}</g>${pinnedHud(c)}${signalLoss(c)}${crtLayer(c, true)}</svg>`;
  }

  // video/factory-entry.ts
  globalThis.RocketFactory = { buildScene, initialFactoryState, reduce };
})();
