// The Arena stage: every model's mind orbits the Orbancy ring. Before a season the orbs gather and
// wait; during it, every real decision plays out: a buyback streaks into the ring and burns, a hold
// ripples, a holder reward scatters outward. Size follows market cap, the leader wears a halo.
// Canvas only, no library. Pauses off screen; draws still frames for reduced motion.
import { reduced } from "./common.js";

const TAU = Math.PI * 2;
const ease = (k) => 1 - (1 - k) ** 3;
const css = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function stage(canvas, { onPick } = {}) {
  const ctx = canvas.getContext("2d");
  let W = 0,
    H = 0,
    dpr = 1,
    cx = 0,
    cy = 0,
    R = 0;
  let orbs = []; // { key, label, sub, hue, size, edge, leader, ghost, born, x, y, trail: [] }
  const fx = []; // effects: { kind, from, t0, ... }
  const dust = Array.from({ length: 70 }, () => ({
    a: Math.random() * TAU,
    r: 0.15 + Math.random() * 1.1,
    s: (Math.random() - 0.5) * 0.00012,
    z: Math.random(),
  }));
  let spin = 0,
    last = performance.now(),
    running = false,
    visible = true,
    hover = -1,
    flash = 0;
  const ink = () => css("--ink") || "#16140F";
  const accent = () => css("--accent") || "#8A6B36";

  function resize() {
    const box = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = box.width;
    H = box.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    cx = W / 2;
    cy = H / 2 + 14;
    R = Math.min(W * 0.38, H * 0.56);
    if (!running) draw(performance.now());
  }

  /// entrants: [{ key, label, sub, hue, size 0..1, edge, leader, ghost }]
  function set(entrants) {
    const now = performance.now();
    // An orb keeps its place when it comes back under the same key or model, so the ring never restarts.
    const old = new Map(
      orbs.flatMap((o) => [
        [o.key, o],
        ["label:" + o.label, o],
      ])
    );
    orbs = entrants.map((e, i) => ({
      ...(old.get(e.key) ||
        old.get("label:" + e.label) || { born: now + i * 110, trail: [] }),
      ...e,
    }));
    // A still frame right away, so the stage is never blank, even before (or without) animation.
    if (!running) {
      for (const o of orbs) o.born = Math.min(o.born, now - 2000);
      draw(now);
    }
  }

  /// A real decision: 'buyback' | 'decided' | 'reward' | 'paused', by entrant key.
  function event(key, kind) {
    const from = orbs.findIndex((o) => o.key === key);
    if (from < 0) return;
    fx.push({
      kind,
      from,
      t0: performance.now(),
      sparks: Array.from({ length: kind === "reward" ? 18 : 26 }, () => ({
        a: Math.random() * TAU,
        v: 0.5 + Math.random(),
      })),
    });
  }

  function place(i, now) {
    const o = orbs[i];
    const n = orbs.length;
    const a = spin + (i / n) * TAU - Math.PI / 2;
    // Orbs arrive from far out on a spiral, then settle on the ring.
    const k = Math.min(1, Math.max(0, (now - o.born) / 1600));
    const r = R * (1 + (1 - ease(k)) * 1.6);
    const aa = a - (1 - ease(k)) * 2.2;
    o.x = cx + Math.cos(aa) * r;
    o.y = cy + Math.sin(aa) * r * 0.62; // a tilted orbit, seen slightly from above
    o.k = ease(k);
    o.depth = (Math.sin(aa) + 1) / 2; // 0 at the back, 1 at the front
  }

  function draw(now) {
    const dt = Math.min(64, now - last);
    last = now;
    if (!reduced) spin += dt * 0.000045;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const INK = ink(),
      ACC = accent();

    // Dust drifting around the ring
    for (const d of dust) {
      d.a += d.s * dt;
      const x = cx + Math.cos(d.a) * R * d.r * 1.25,
        y = cy + Math.sin(d.a) * R * d.r * 0.78;
      ctx.globalAlpha = 0.08 + d.z * 0.14;
      ctx.fillStyle = INK;
      ctx.fillRect(x, y, 1.2, 1.2);
    }

    // The track: the orbit itself and two faint guide rings
    ctx.globalAlpha = 1;
    for (const [m, a] of [
      [1, 0.14],
      [1.32, 0.05],
      [0.62, 0.05],
    ]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, R * m, R * m * 0.62, 0, 0, TAU);
      ctx.strokeStyle = INK;
      ctx.globalAlpha = a;
      ctx.lineWidth = 1;
      ctx.setLineDash(m === 1 ? [] : [2, 6]);
      ctx.lineDashOffset = -spin * 400;
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // The Orbancy ring at the center: ring, turning orbit, breathing core
    const r0 = R * 0.2;
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r0, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r0, r0 * 0.38, spin * 3, 0, TAU);
    ctx.stroke();
    const breathe = reduced ? 0.5 : (Math.sin(now / 900) + 1) / 2;
    flash = Math.max(0, flash - dt / 700);
    const glow = ctx.createRadialGradient(
      cx,
      cy,
      0,
      cx,
      cy,
      r0 * (1.6 + flash * 2)
    );
    glow.addColorStop(0, ACC);
    glow.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.12 + breathe * 0.08 + flash * 0.5;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r0 * (1.6 + flash * 2), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = ACC;
    ctx.beginPath();
    ctx.arc(cx, cy, r0 * (0.22 + breathe * 0.04 + flash * 0.15), 0, TAU);
    ctx.fill();

    // Orbs, back to front so the near side overlaps the far side
    orbs.forEach((_, i) => place(i, now));
    const order = orbs
      .map((o, i) => i)
      .sort((a, b) => orbs[a].depth - orbs[b].depth);
    for (const i of order) {
      const o = orbs[i];
      const big = hover === i ? 1.25 : 1;
      const size = (9 + o.size * 15) * (0.75 + o.depth * 0.35) * big;
      const alpha = (o.ghost ? 0.5 : 1) * o.k * (0.55 + o.depth * 0.45);
      // trail
      if (!reduced) {
        o.trail.push([o.x, o.y]);
        if (o.trail.length > 18) o.trail.shift();
      }
      ctx.lineWidth = size * 0.5;
      ctx.lineCap = "round";
      for (let t = 1; t < o.trail.length; t++) {
        ctx.globalAlpha = alpha * (t / o.trail.length) * 0.12;
        ctx.strokeStyle = `hsl(${o.hue} 45% 55%)`;
        ctx.beginPath();
        ctx.moveTo(...o.trail[t - 1]);
        ctx.lineTo(...o.trail[t]);
        ctx.stroke();
      }
      // halo for the leader
      if (o.leader && !o.ghost) {
        ctx.globalAlpha = alpha * 0.8;
        ctx.strokeStyle = ACC;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 5]);
        ctx.lineDashOffset = -now / 60;
        ctx.beginPath();
        ctx.arc(o.x, o.y, size * 1.7, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // glow and body, lit from the top left like every Orbancy icon
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, size * 2.6);
      g.addColorStop(0, `hsla(${o.hue} 60% 60% / .35)`);
      g.addColorStop(1, "transparent");
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(o.x, o.y, size * 2.6, 0, TAU);
      ctx.fill();
      const b = ctx.createRadialGradient(
        o.x - size * 0.36,
        o.y - size * 0.44,
        size * 0.1,
        o.x,
        o.y,
        size
      );
      b.addColorStop(0, `hsl(${o.hue} 45% 86%)`);
      b.addColorStop(0.58, `hsl(${(o.hue + 14) % 360} 38% 48%)`);
      b.addColorStop(1, `hsl(${(o.hue + 28) % 360} 40% 20%)`);
      ctx.fillStyle = b;
      ctx.beginPath();
      ctx.arc(o.x, o.y, size, 0, TAU);
      ctx.fill();
      // label
      ctx.globalAlpha = alpha * (hover === i ? 1 : 0.85);
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.font = `600 ${
        hover === i ? 13 : 12
      }px "Instrument Sans", system-ui, sans-serif`;
      ctx.fillText(o.label, o.x, o.y + size + 18);
      if (o.sub) {
        ctx.font = '500 11px "Instrument Sans", system-ui, sans-serif';
        ctx.fillStyle =
          o.edge == null ? INK : o.edge >= 0 ? "#3E8E5E" : "#B0473A";
        ctx.globalAlpha = alpha * 0.75;
        ctx.fillText(o.sub, o.x, o.y + size + 32);
      }
    }

    // Decisions in motion
    for (let j = fx.length - 1; j >= 0; j--) {
      const e = fx[j],
        o = orbs[e.from];
      if (!o) {
        fx.splice(j, 1);
        continue;
      }
      const t = (now - e.t0) / 1000;
      if (e.kind === "buyback") {
        // a comet from the mind into the ring, then the burn
        const k = Math.min(1, t / 1.1);
        if (k < 1) {
          const q = ease(k),
            mx = (o.x + cx) / 2,
            my = Math.min(o.y, cy) - R * 0.35;
          const px = (1 - q) ** 2 * o.x + 2 * (1 - q) * q * mx + q * q * cx;
          const py = (1 - q) ** 2 * o.y + 2 * (1 - q) * q * my + q * q * cy;
          const tail = ctx.createRadialGradient(px, py, 0, px, py, 14);
          tail.addColorStop(0, `hsl(${o.hue} 70% 75%)`);
          tail.addColorStop(1, "transparent");
          ctx.globalAlpha = 1;
          ctx.fillStyle = tail;
          ctx.beginPath();
          ctx.arc(px, py, 14, 0, TAU);
          ctx.fill();
        } else {
          if (!e.hit) {
            e.hit = true;
            flash = 1;
          }
          const s = t - 1.1;
          for (const p of e.sparks) {
            const d = ease(Math.min(1, s / 0.9)) * R * 0.45 * p.v;
            ctx.globalAlpha = Math.max(0, 1 - s / 0.9);
            ctx.fillStyle = s < 0.2 ? "#fff" : ACC;
            ctx.beginPath();
            ctx.arc(
              cx + Math.cos(p.a) * d,
              cy + Math.sin(p.a) * d * 0.7,
              1.6,
              0,
              TAU
            );
            ctx.fill();
          }
          if (s > 0.9) fx.splice(j, 1);
        }
      } else if (e.kind === "reward") {
        for (const p of e.sparks) {
          const d = ease(Math.min(1, t / 1.2)) * 60 * p.v;
          ctx.globalAlpha = Math.max(0, 1 - t / 1.2);
          ctx.fillStyle = `hsl(${o.hue} 70% 70%)`;
          ctx.beginPath();
          ctx.arc(o.x + Math.cos(p.a) * d, o.y + Math.sin(p.a) * d, 2, 0, TAU);
          ctx.fill();
        }
        if (t > 1.2) fx.splice(j, 1);
      } else {
        // a hold, or a mind waiting for its model: one calm ripple
        for (const lag of [0, 0.25]) {
          const k = Math.min(1, Math.max(0, (t - lag) / 1.2));
          ctx.globalAlpha = (1 - k) * 0.6;
          ctx.strokeStyle = e.kind === "paused" ? INK : `hsl(${o.hue} 50% 60%)`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(o.x, o.y, 12 + ease(k) * 34, 0, TAU);
          ctx.stroke();
        }
        if (t > 1.5) fx.splice(j, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    if (!running) return;
    draw(now);
    requestAnimationFrame(loop);
  }
  function start() {
    if (reduced || running || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
  }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    visible ? start() : stop();
  }).observe(canvas);
  document.addEventListener("visibilitychange", () =>
    document.hidden ? stop() : start()
  );
  const at = (e) => {
    const box = canvas.getBoundingClientRect(),
      x = e.clientX - box.left,
      y = e.clientY - box.top;
    return orbs.findIndex((o) => Math.hypot(o.x - x, o.y - y) < 28);
  };
  canvas.addEventListener("pointermove", (e) => {
    hover = at(e);
    canvas.style.cursor =
      hover >= 0 && !orbs[hover].ghost ? "pointer" : "default";
    if (reduced) draw(performance.now());
  });
  canvas.addEventListener("pointerleave", () => (hover = -1));
  canvas.addEventListener("click", (e) => {
    const i = at(e);
    if (i >= 0 && !orbs[i].ghost) onPick?.(orbs[i].key);
  });
  resize();
  start();
  return { set, event };
}
