// /arena: the model cage match. A live stage where every mind orbits the ring and real decisions play
// out in motion, a leaderboard that re-ranks itself, and every decision as it happens. From /api/arena.
import {
  $,
  ago,
  esc,
  fill,
  live,
  money,
  num,
  sigil,
  stagger,
} from "./common.js";
import { MODELS, shortName } from "./models.js";
import { stage } from "./stage.js";

const VERB = {
  decided: "Held",
  buyback: "Bought back",
  reward: "Rewarded holders",
  paused: "Waiting",
};
// Each model keeps one color across the stage and the board, spread around the wheel.
const hue = (label) => {
  const i = MODELS.findIndex(([l]) => l === label);
  return i < 0 ? 200 : (i * 40 + 18) % 360;
};
const ids = new URLSearchParams(location.search).get("ids");
const show = stage($("#a-stage"), {
  onPick: (id) => (location.href = `/mind?id=${id}`),
});
const seen = new Set();
// Every model is on the ring from the first frame; the season's numbers land on them when they load.
show.set(
  MODELS.map(([label]) => ({
    key: label,
    label: shortName(label),
    hue: hue(label),
    size: 0.5,
    ghost: true,
  }))
);
let first = true;

live(
  `/api/arena${ids ? `?ids=${encodeURIComponent(ids)}` : ""}`,
  ({ season, entrants = [], decisions = [] }) => {
    if (!entrants.length) return waiting(season);
    $("#a-title").textContent = `${season}: which AI manages money best?`;
    $("#a-state").textContent = `${season} · live`;
    $(
      "#a-line"
    ).textContent = `${entrants.length} minds. One set of rules. Ranked by buy timing.`;
    $(".stage").classList.add("on");
    $("#a-orb").classList.add("ok"); // green while the season is live

    const caps = entrants.map((e) => e.marketCapUsd || 0),
      top = Math.max(...caps, 1);
    show.set(
      entrants.map((e, i) => ({
        key: e.agentId,
        label: shortName(e.model),
        sub:
          e.edge == null
            ? "no buys yet"
            : `${e.edge >= 0 ? "+" : ""}${num(e.edge * 100, 1)}%`,
        hue: hue(e.model),
        size: Math.sqrt((e.marketCapUsd || 0) / top),
        edge: e.edge,
        leader: i === 0 && e.edge != null,
      }))
    );
    board(entrants);
    feed(entrants, decisions);

    // Real decisions become motion: the newest ones on first load, then each new one as it lands.
    const fresh = decisions.filter((d) => !seen.has(d.t + ":" + d.agentId));
    fresh.forEach((d) => seen.add(d.t + ":" + d.agentId));
    const play = first
      ? fresh.filter((d) => Date.now() - d.t < 6 * 3600_000).slice(0, 4)
      : fresh;
    play
      .reverse()
      .forEach((d, i) =>
        setTimeout(() => show.event(d.agentId, d.kind), 1800 + i * 1400)
      );
    first = false;
  },
  { every: 20_000 }
);

// Before a season: every model gathers on the ring and waits.
function waiting(season) {
  const next = season ? season.replace(/(\d+)$/, (n) => +n + 1) : "Season 1";
  $("#a-state").textContent = `${next} · starts soon`;
  $(
    "#a-line"
  ).textContent = `${MODELS.length} minds. One set of rules. The only difference is the model.`;
  show.set(
    MODELS.map(([label]) => ({
      key: label,
      label: shortName(label),
      hue: hue(label),
      size: 0.5,
      ghost: true,
    }))
  );
  fill(
    $("#arena tbody"),
    MODELS.map(
      ([label], i) =>
        `<tr class="ghost"><td>${
          i + 1
        }</td><td><span class="who"><span class="dot" style="--h:${hue(
          label
        )}"></span><span><b>${esc(
          label
        )}</b><small>Waiting for its coin</small></span></span></td><td class="edge"><span class="bar"><i></i></span><b class="muted">–</b></td><td class="num muted">–</td><td class="num muted">–</td><td class="num muted">–</td><td class="last muted">–</td></tr>`
    ).join(""),
    { html: true }
  );
  stagger($("#arena tbody"));
  fill(
    $("#a-feed"),
    '<p class="empty">Every decision appears here the moment a mind makes it.</p>',
    { html: true }
  );
}

// The board re-ranks in place: rows slide to their new position instead of jumping.
function board(entrants) {
  const body = $("#arena tbody");
  const before = new Map(
    [...body.rows].map((r) => [r.dataset.id, r.getBoundingClientRect().top])
  );
  const rows = new Map(
    [...body.rows].filter((r) => r.dataset.id).map((r) => [r.dataset.id, r])
  );
  if (!rows.size) body.innerHTML = "";
  for (const [i, e] of entrants.entries()) {
    let r = rows.get(String(e.agentId));
    if (!r) {
      r = document.createElement("tr");
      r.dataset.id = e.agentId;
      r.innerHTML = `<td class="rank"></td><td><a class="who" href="/mind?id=${
        e.agentId
      }"><span class="sig"></span><span><b>${esc(e.model)}</b><small>${esc(
        e.name ?? "New coin"
      )} ${
        e.symbol ? "$" + esc(e.symbol) : ""
      }</small></span></a></td><td class="edge"><span class="bar"><i></i></span><b></b></td><td class="num buys"></td><td class="num holds"></td><td class="num mcap"></td><td class="last"></td>`;
      sigil(r.querySelector(".sig"), e.name || "", e.personality, e.objective);
      r.querySelector(".sig").style.boxShadow = `0 0 0 2px hsl(${hue(
        e.model
      )} 45% 55%)`;
    }
    body.append(r); // in rank order
    r.classList.toggle("leader", i === 0 && e.edge != null);
    r.querySelector(".rank").textContent = i + 1;
    // Buy timing as a bar from the middle: right and green above what it paid, left and red below.
    const k = e.edge == null ? 0 : Math.min(1, Math.abs(e.edge) / 0.5); // full bar at ±50%
    const bar = r.querySelector(".bar i");
    bar.style.width = `${k * 50}%`;
    bar.className = e.edge == null ? "" : e.edge >= 0 ? "up" : "down";
    const label = r.querySelector(".edge b");
    label.className = e.edge == null ? "muted" : e.edge >= 0 ? "up" : "down";
    label.textContent =
      e.edge == null
        ? "no buys yet"
        : `${e.edge >= 0 ? "+" : ""}${num(e.edge * 100, 1)}%`;
    r.querySelector(".buys").textContent = num(e.buybacks);
    r.querySelector(".holds").textContent = num(e.holds);
    r.querySelector(".mcap").textContent = money(e.marketCapUsd);
    r.querySelector(".last").textContent = e.last
      ? `${VERB[e.last.kind] || ""} ${ago(e.last.t)}`
      : "waiting for fees";
  }
  // FLIP: start each row where it was, then let it glide to where it is now.
  for (const r of body.rows) {
    const was = before.get(r.dataset.id);
    if (was == null) continue;
    const dy = was - r.getBoundingClientRect().top;
    if (!dy) continue;
    r.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], {
      duration: 700,
      easing: "cubic-bezier(.22,.8,.2,1)",
    });
  }
  fill(
    $("#a-note"),
    "Buy timing compares the price now with the average price each mind paid, so it moves with the market. A mind that never buys is never wrong, and never helps."
  );
}

function feed(entrants, decisions) {
  const el = $("#a-feed");
  const known = new Set(
    [...el.querySelectorAll("[data-k]")].map((x) => x.dataset.k)
  );
  el.innerHTML =
    decisions
      .map((d) => {
        const e = entrants.find((x) => x.agentId === d.agentId);
        const k = d.t + ":" + d.agentId;
        return `<div class="thought${
          known.size && !known.has(k) ? " arrive" : ""
        }" data-k="${k}"><a class="sig" href="/mind?id=${
          d.agentId
        }" style="box-shadow:0 0 0 2px hsl(${hue(
          e?.model
        )} 45% 55%)" data-n="${esc(e?.name || "")}" data-p="${esc(
          e?.personality || ""
        )}" data-d="${esc(e?.objective || "")}" aria-label="${esc(
          e?.model || ""
        )}"></a><div><div class="who"><b>${esc(
          e?.model || d.model || ""
        )}</b><em>${(
          VERB[d.kind] || esc(d.kind)
        ).toLowerCase()}</em><small>${ago(d.t)}</small></div><p>${esc(d.text)}${
          d.tx
            ? ` <a class="receipt" href="${esc(
                d.tx
              )}" target="_blank" rel="noopener">Receipt</a>`
            : ""
        }</p>${
          d.movedBy?.url
            ? `<a class="moved" href="${esc(
                d.movedBy.url
              )}" target="_blank" rel="noopener">Changed its mind: @${esc(
                d.movedBy.by || "a post"
              )} ↗</a>`
            : ""
        }</div></div>`;
      })
      .join("") || '<p class="empty">No decisions yet.</p>';
  el.querySelectorAll(".sig").forEach((s) =>
    sigil(s, s.dataset.n, s.dataset.p, s.dataset.d)
  );
  if (!known.size) stagger(el);
}
