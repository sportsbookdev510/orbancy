// The launch moment. Opens the instant a launch is signed: scattered points drift while the
// transaction is pending, then collapse into a living sphere the moment the mind exists.
import { $, esc, reduced } from "./common.js";
import { EXPLORER, short } from "./wallet.js";

const dlg = $("#born");
const cv = $("#borncv", dlg);
const ctx = cv.getContext("2d");
const N = 760;
const golden = Math.PI * (3 - Math.sqrt(5));
let pts = [],
  W = 0,
  H = 0,
  dpr = 1,
  t0 = 0,
  raf = 0;
let gather = 0,
  gatherTo = 0,
  flash = 0,
  ry = 0,
  ink = "",
  accent = "";

function seed() {
  pts = Array.from({ length: N }, (_, i) => {
    const y = 1 - (i / (N - 1)) * 2,
      r = Math.sqrt(1 - y * y),
      a = golden * i;
    const s = 2.4 + Math.random() * 3.2,
      th = Math.random() * Math.PI * 2,
      ph = Math.acos(2 * Math.random() - 1);
    return {
      to: [Math.cos(a) * r, y, Math.sin(a) * r],
      from: [
        s * Math.sin(ph) * Math.cos(th),
        s * Math.cos(ph),
        s * Math.sin(ph) * Math.sin(th),
      ],
      w: Math.random(),
    };
  });
}

function resize() {
  const b = cv.getBoundingClientRect();
  dpr = Math.min(2, devicePixelRatio || 1);
  W = b.width;
  H = b.height;
  cv.width = W * dpr;
  cv.height = H * dpr;
  const s = getComputedStyle(document.documentElement);
  ink = s.getPropertyValue("--ink").trim();
  accent = s.getPropertyValue("--accent").trim();
}

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const ease = (k) => 1 - (1 - k) ** 4;

function frame(now) {
  const dt = Math.min(48, now - (t0 || now));
  t0 = now;
  const box = cv.getBoundingClientRect();
  if (box.width !== W || box.height !== H) resize();
  if (dlg.dataset.stage === "pending" && gatherTo < 0.85)
    gatherTo = Math.min(0.85, gatherTo + dt / 25000);
  gather +=
    (gatherTo - gather) * Math.min(1, dt / (gatherTo === 1 ? 260 : 1400));
  flash = Math.max(0, flash - dt / 1600);
  ry += dt * (0.00022 + gather * 0.0003);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const R = Math.min(W, H) * 0.3,
    cx = W / 2,
    cy = H / 2,
    cy_ = Math.cos(ry),
    sy = Math.sin(ry);
  const g = ease(Math.min(1, gather));
  if (flash > 0) {
    const k = 1 - flash;
    ctx.beginPath();
    ctx.arc(cx, cy, R * (1 + k * 1.6), 0, Math.PI * 2);
    ctx.strokeStyle = rgba(accent, flash * 0.55);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
    glow.addColorStop(0, rgba(accent, flash * 0.28));
    glow.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }
  for (const p of pts) {
    const drift = (1 - g) * Math.sin(now / 900 + p.w * 9) * 0.06;
    let x = p.from[0] + (p.to[0] - p.from[0]) * g + drift,
      y = p.from[1] + (p.to[1] - p.from[1]) * g,
      z = p.from[2] + (p.to[2] - p.from[2]) * g;
    [x, z] = [x * cy_ - z * sy, x * sy + z * cy_];
    const f = 2.8 / (2.8 + z),
      px = cx + x * R * f,
      py = cy + y * R * f;
    const depth = (1 - z) / 2;
    ctx.fillStyle =
      p.w < 0.07 + g * 0.05
        ? rgba(accent, 0.5 + depth * 0.5)
        : rgba(ink, (0.2 + depth * 0.6) * (0.35 + g * 0.65));
    const size = Math.min(3, (0.8 + depth * 1.5) * f);
    ctx.fillRect(px - size / 2, py - size / 2, size, size);
  }
  raf = requestAnimationFrame(frame);
}

// The steps light up as the wallet and the chain answer: sign, confirm on chain, alive.
const ORDER = ["signing", "pending", "born"];
function stage(name) {
  dlg.dataset.stage = name;
  const at = ORDER.indexOf(name);
  dlg.querySelectorAll(".bornsteps li").forEach((li, k) => {
    li.classList.toggle("done", at > k || name === "born");
    li.classList.toggle("now", at === k && name !== "born");
  });
}
const text = (id, v) => ($(id, dlg).textContent = v);

/// Opens the moment the wallet is asked to sign. Nothing here claims success yet.
export function bornOpen(coin) {
  text("#bornid", `$${coin.symbol}`);
  text("#borntitle", "Confirm in your wallet");
  text(
    "#bornsub",
    `Sign the launch of ${coin.name}. Nothing is sent until you approve it.`
  );
  text("#bornstatus", "Waiting for your wallet");
  stage("signing");
  if (!dlg.open) dlg.showModal();
  resize();
  seed();
  gather = 0;
  gatherTo = 0.1;
  flash = 0;
  cancelAnimationFrame(raf);
  if (reduced) {
    gather = gatherTo;
    frame(performance.now());
    cancelAnimationFrame(raf);
  } else raf = requestAnimationFrame(frame);
}

/// Signed. The points gather while the transaction waits for its block.
export function bornPending(hash, coin) {
  text("#borntitle", `Bringing ${coin.name} to life`);
  text(
    "#bornsub",
    `Thinks with ${coin.model}. ${coin.personality}. ${coin.objective}.`
  );
  $(
    "#bornstatus",
    dlg
  ).innerHTML = `Signed. Waiting for Robinhood Chain to confirm. <a href="${EXPLORER}/tx/${hash}" target="_blank" rel="noopener">Transaction</a>`;
  gatherTo = 0.35;
  stage("pending");
}

/// Confirmed on chain and the coin exists: collapse, pulse, reveal.
export function bornDone({
  agentId,
  token,
  mind,
  name,
  symbol,
  model,
  personality,
  objective,
}) {
  gatherTo = 1;
  flash = 1;
  if (reduced) {
    gather = 1;
    flash = 0;
    frame(performance.now());
    cancelAnimationFrame(raf);
  }
  text("#bornid", `$${symbol}, agent ${agentId}`);
  text("#borntitle", `${name} is alive.`);
  text("#bornsub", `Thinks with ${model}. ${personality}. ${objective}.`);
  const page = `${location.origin}/mind?id=${agentId}`;
  $("#bornfacts", dlg).innerHTML = [
    ["Token", token],
    ["Mind wallet", mind],
  ]
    .map(
      ([k, a]) =>
        `<div><span class="eyebrow">${k}</span><code>${short(
          a
        )}</code><button class="link" type="button" data-copy="${esc(
          a
        )}">Copy</button></div>`
    )
    .join("");
  $("#bornopen", dlg).href = `/mind?id=${agentId}`;
  const post = `I just gave $${symbol} a mind on Orbancy. ${name} runs its own treasury in public.`;
  $(
    "#bornshare",
    dlg
  ).href = `https://x.com/intent/post?text=${encodeURIComponent(
    post
  )}&url=${encodeURIComponent(page)}`;
  stage("born");
}

/// Declined in the wallet, or reverted on chain. The points scatter and the form stays filled in.
export function bornFail(title, detail, tx) {
  gatherTo = 0;
  flash = 0;
  if (reduced) {
    gather = 0;
    frame(performance.now());
    cancelAnimationFrame(raf);
  }
  text("#borntitle", title);
  text("#bornsub", detail);
  $("#bornstatus", dlg).innerHTML = tx
    ? `<a href="${tx}" target="_blank" rel="noopener">See the transaction</a>`
    : "";
  dlg.dataset.stage = "failed";
  dlg
    .querySelectorAll(".bornsteps li")
    .forEach((li) => li.classList.remove("now"));
}

export function bornClose() {
  if (dlg.open) dlg.close();
}

dlg.addEventListener("close", () => cancelAnimationFrame(raf));
dlg.addEventListener("click", (e) => {
  if (e.target.closest("[data-close]")) dlg.close();
  if (e.target.closest("[data-retry]")) {
    dlg.close();
    dlg.dispatchEvent(new Event("retry"));
  }
});
addEventListener("resize", () => {
  if (dlg.open) resize();
});
