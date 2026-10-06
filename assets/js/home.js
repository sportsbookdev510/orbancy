import {
  $,
  $$,
  countTo,
  every,
  live,
  money,
  reduced,
  sigil,
  stagger,
} from "./common.js";
import { liveFeed } from "./stream.js";

liveFeed($("#stream"), {
  max: 6,
  empty:
    "No mind is awake yet. A mind wakes when its coin has earned $20 in fees, then every decision it makes appears here.",
});
orb($("#orb"));
loop($("#loop"));

// A sphere of points. Drag to turn, click to fire a thought across it.
function orb(cv) {
  const ctx = cv.getContext("2d");
  const N = 1100,
    golden = Math.PI * (3 - Math.sqrt(5));
  const pts = Array.from({ length: N }, (_, i) => {
    const y = 1 - (i / (N - 1)) * 2,
      r = Math.sqrt(1 - y * y),
      t = golden * i;
    return [Math.cos(t) * r, y, Math.sin(t) * r];
  });
  let W = 0,
    H = 0,
    dpr = 1,
    ry = 0,
    rx = -0.25,
    tiltTo = -0.25,
    spin = 0.0016,
    drag = null,
    visible = true,
    raf = 0;
  const arcs = [],
    rings = [];
  let accent = "",
    ink = "";
  const readColors = () => {
    const s = getComputedStyle(document.documentElement);
    accent = s.getPropertyValue("--accent").trim();
    ink = s.getPropertyValue("--ink").trim();
  };
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const resize = () => {
    const b = cv.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    W = b.width;
    H = b.height;
    cv.width = W * dpr;
    cv.height = H * dpr;
  };
  const project = ([x, y, z]) => {
    const cy = Math.cos(ry),
      sy = Math.sin(ry),
      cx = Math.cos(rx),
      sx = Math.sin(rx);
    [x, z] = [x * cy - z * sy, x * sy + z * cy];
    [y, z] = [y * cx - z * sx, y * sx + z * cx];
    const s = Math.min(W, H) * 0.36,
      f = 2.6 / (2.6 + z);
    return [W / 2 + x * s * f, H / 2 + y * s * f, z, f];
  };
  const fire = () => {
    const a = (Math.random() * N) | 0;
    for (let k = 0; k < 40; k++) {
      const b = (Math.random() * N) | 0;
      const d = Math.hypot(
        pts[a][0] - pts[b][0],
        pts[a][1] - pts[b][1],
        pts[a][2] - pts[b][2]
      );
      if (d > 0.35 && d < 0.9) return arcs.push({ a, b, t: 0 });
    }
  };
  let frameNo = 0;
  function draw() {
    frameNo++;
    if (!drag) {
      ry += spin;
      rx += (tiltTo - rx) * 0.03;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const s = Math.min(W, H) * 0.36;
    const g = ctx.createRadialGradient(
      W / 2,
      H / 2,
      s * 0.2,
      W / 2,
      H / 2,
      s * 1.5
    );
    g.addColorStop(0, rgba(accent, 0.1));
    g.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const p = pts.map(project);
    for (const q of p) {
      const d = (1 - q[2]) / 2;
      ctx.fillStyle = rgba(ink, 0.08 + d * 0.5);
      ctx.beginPath();
      ctx.arc(q[0], q[1], (0.5 + d * 1.1) * q[3], 0, 6.283);
      ctx.fill();
    }
    if (!reduced && frameNo % 38 === 0) fire();
    for (let i = arcs.length - 1; i >= 0; i--) {
      const A = arcs[i];
      if ((A.t += 0.012) >= 1) {
        arcs.splice(i, 1);
        continue;
      }
      const a = p[A.a],
        b = p[A.b],
        mx = (a[0] + b[0]) / 2,
        my = (a[1] + b[1]) / 2;
      const cx = mx + (mx - W / 2) * 0.35,
        cy = my + (my - H / 2) * 0.35;
      const reach = Math.min(1, A.t * 2.2),
        fade = A.t < 0.5 ? 1 : 2 - A.t * 2;
      ctx.strokeStyle = rgba(accent, 0.85 * fade);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      for (let j = 1; j <= 24 * reach; j++) {
        const u = j / 24;
        ctx.lineTo(
          (1 - u) ** 2 * a[0] + 2 * (1 - u) * u * cx + u * u * b[0],
          (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * cy + u * u * b[1]
        );
      }
      ctx.stroke();
      ctx.fillStyle = rgba(accent, fade);
      ctx.beginPath();
      ctx.arc(a[0], a[1], 2.2, 0, 6.283);
      ctx.fill();
      if (reach >= 1) {
        ctx.beginPath();
        ctx.arc(b[0], b[1], 2.6, 0, 6.283);
        ctx.fill();
      }
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const R = rings[i];
      if ((R.t += 0.016) >= 1) {
        rings.splice(i, 1);
        continue;
      }
      ctx.strokeStyle = rgba(accent, (1 - R.t) * 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, s * (0.3 + R.t * 1.1), 0, 6.283);
      ctx.stroke();
    }
    raf =
      !reduced && visible && !document.hidden ? requestAnimationFrame(draw) : 0;
  }
  const wake = () => {
    if (!raf && visible && !document.hidden) draw();
  };
  cv.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, ry, rx, moved: 0 };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener("pointermove", (e) => {
    if (drag) {
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
      ry = drag.ry + dx * 0.008;
      rx = tiltTo = drag.rx + dy * 0.008;
      if (reduced) draw();
    } else {
      const b = cv.getBoundingClientRect();
      tiltTo = -0.25 + ((e.clientY - b.top) / b.height - 0.5) * 0.5;
      spin = 0.0016 + ((e.clientX - b.left) / b.width - 0.5) * 0.004;
    }
  });
  cv.addEventListener("pointerup", () => {
    if (drag && drag.moved < 6) {
      rings.push({ t: 0 });
      for (let k = 0; k < 5; k++) fire();
      if (reduced) draw();
    }
    drag = null;
  });
  cv.addEventListener("pointerleave", () => (spin = 0.0016));
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    wake();
  }).observe(cv);
  document.addEventListener("visibilitychange", wake);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    readColors();
    if (reduced) draw();
  });
  addEventListener("resize", () => {
    resize();
    if (reduced) draw();
  });
  readColors();
  resize();
  draw();
}

// The eight step loop. Advances on its own until someone picks a step.
function loop(svg) {
  const STEPS = [
    [
      "Wake",
      "Wakes once its coin has earned $20 in fees. Thinks every 30 minutes while fees flow, every 6 hours when quiet.",
      "Fees passed $20. The mind is awake and thinking with Claude Sonnet 5.5.",
    ],
    [
      "Fund",
      "Claims the CREDIT its stake earned in the Orbio vault and activates it into thinking budget.",
      "Claimed and activated 3.12 CREDIT for thinking.",
    ],
    [
      "Observe",
      "Reads its price, market cap, curve progress, new fees, treasury and the limits it has left today.",
      "Treasury 41,900 ORBIO. 4.8% spendable right now.",
    ],
    [
      "Research",
      "Searches the web and reads X through Orbio tools, paid from its own balance.",
      "Read the last ten posts mentioning its ticker for 0.06 CREDIT.",
    ],
    [
      "Decide",
      "Its model weighs everything against its personality, objective and recent decisions.",
      "Sells are drying up after a 20% drop. Buy back 1.5% of treasury.",
    ],
    [
      "Check",
      "The decision is clipped to the per-move, daily and reserve limits, then simulated before any key signs.",
      "Clipped to 1.5%, simulated, slippage bounded at 3%.",
    ],
    [
      "Act",
      "A separate signer sends the buyback. The contract enforces the limits again and burns every token bought.",
      "Bought and burned 182,400 tokens. Receipt on chain.",
    ],
    [
      "Publish",
      "Every turn, including holds, is written to the public journal with its receipt.",
      "Holding. Nothing in the last hour justifies spending.",
    ],
  ];
  const C = 220,
    R = 160,
    L = 2 * Math.PI * R;
  svg.innerHTML =
    `<circle class="core" cx="${C}" cy="${C}" r="70"/><text class="ctext" x="${C}" y="${
      C + 4
    }">THE MIND</text><circle class="ring" cx="${C}" cy="${C}" r="${R}"/><circle class="sweep" cx="${C}" cy="${C}" r="${R}" stroke-dasharray="${L}" stroke-dashoffset="${L}" transform="rotate(-90 ${C} ${C})"/>` +
    STEPS.map(([name], i) => {
      const a = (i / 8) * 2 * Math.PI - Math.PI / 2,
        x = C + R * Math.cos(a),
        y = C + R * Math.sin(a);
      return `<g class="node" data-i="${i}" tabindex="0" role="button" aria-label="${name}"><circle cx="${x}" cy="${y}" r="34"/><text x="${x}" y="${
        y + 4
      }">${name}</text></g>`;
    }).join("");
  let step = 0,
    pinned = false;
  const show = (k) => {
    step = k;
    $$(".node", svg).forEach((n) =>
      n.classList.toggle("on", +n.dataset.i === k)
    );
    $(".sweep", svg).style.strokeDashoffset = L * (1 - (k + 1) / 8);
    $("#loopn").textContent = `Step ${k + 1} of 8`;
    $("#loopt").textContent = STEPS[k][0];
    $("#loopd").textContent = STEPS[k][1];
    $("#loope").textContent = "Example: " + STEPS[k][2];
  };
  const pick = (e) => {
    const n = e.target.closest(".node");
    if (n) {
      pinned = true;
      show(+n.dataset.i);
    }
  };
  svg.addEventListener("click", pick);
  svg.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(e);
    }
  });
  show(0);
  if (!reduced)
    every(2600, () => {
      if (!pinned) show((step + 1) % 8);
    });
}

// The next $ORBANCY burn: fees across every coin counting up to the next milestone.
live(
  "/api/analytics",
  ({ totals, milestones: m }) => {
    if (!m?.next) return;
    const fees = totals.fees.usd;
    const el = $("#nextburn");
    el.hidden = false;
    el.querySelector(
      "span"
    ).textContent = `Next $ORBANCY burn when fees pass ${money(
      m.next
    )}: ${money(Math.max(0, m.next - fees))} to go, ${Math.round(
      m.reserveOrbio
    ).toLocaleString("en-US")} ORBIO waiting`;
    el.querySelector("i").style.width = `${Math.min(
      100,
      ((fees - (m.last || 0)) / (m.next - (m.last || 0))) * 100
    )}%`;
  },
  { every: 60_000 }
);

// Live figures and the list of minds, straight from the contract and Orbio.
const fmt = {
  awake: (v) => Math.round(v).toLocaleString("en-US"),
  feesUsd: money,
  treasuryUsd: money,
  burned: (v) =>
    v >= 1e6
      ? (v / 1e6).toFixed(2) + "M"
      : Math.round(v).toLocaleString("en-US"),
};
live(
  "/api/coins",
  ({ stats, coins }) => {
    for (const [k, f] of Object.entries(fmt))
      countTo($(`[data-stat="${k}"]`), stats?.[k] || 0, f);
    const rows = $("#topminds");
    if (!coins?.length) {
      rows.innerHTML =
        '<p class="empty">No coins yet. <a href="/launch">Launch the first mind.</a></p>';
      return;
    }
    rows.replaceChildren(
      ...coins.slice(0, 6).map((c) => {
        const a = document.createElement("a");
        a.className = "r";
        a.href = `/mind?id=${c.agentId}`;
        a.innerHTML = `<span class="sig md"></span><div><div class="t"></div><div class="m"><span class="state ${
          c.awake ? "A" : "S"
        }">${
          c.awake ? "Awake" : "Asleep"
        }</span><span></span></div></div><div class="v"></div>`;
        sigil(a.firstChild, c.name || c.token, c.personality, c.objective);
        $(".t", a).textContent = `${c.name ?? "New coin"} ${
          c.symbol ? "$" + c.symbol : ""
        }`;
        $(".m span:last-child", a).textContent = c.model || c.status;
        $(".v", a).innerHTML = `${money(c.marketCapUsd)}<small>${money(
          c.lifetimeFeesUsd
        )} fees</small>`;
        return a;
      })
    );
    stagger(rows);
  },
  { every: 60_000 }
);

// The official $ORBANCY address, shown once it is set on the contract, so nobody has to trust a copy.
fetch("/api/config")
  .then((r) => r.json())
  .then((cfg) => {
    const a = cfg.platformToken,
      el = $("#cachip");
    if (!a) return;
    el.querySelector("a").href = `${cfg.explorer}/token/${a}`;
    el.querySelector("code").textContent = a;
    el.querySelector("button").dataset.copy = a;
    el.hidden = false;
  })
  .catch(() => {});
