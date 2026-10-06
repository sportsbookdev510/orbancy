// /analytics: where every fee went, from /api/analytics (contract events) and /api/coins (live treasuries).
import {
  $,
  ago,
  countTo,
  esc,
  fill,
  live,
  money,
  num,
  stagger,
} from "./common.js";
import { feeFlow } from "./flow.js";

const usd = (v) =>
  v == null ? "n/a" : v >= 1000 ? money(v) : "$" + num(v, 2, true);
const pct = (v) => `${num(v * 100, v < 0.1 ? 1 : 0)}%`;

// Where fees end up, with the same colors as the flow diagram.
const DEST = [
  {
    key: "mind",
    name: "To minds",
    what: "AI credit and a spending balance from Orbio, plus ORBIO from the ladder. Pays for every model call and tool.",
  },
  {
    key: "treasury",
    name: "To coin treasuries",
    what: "Owned by each coin. Only its mind can spend it, on buybacks, inside on-chain limits.",
  },
  {
    key: "burn",
    name: "To buy and burn $ORBANCY",
    what: "Held in ORBIO until $ORBANCY launches, then used to buy it and burn it.",
  },
  {
    key: "team",
    name: "To the Orbancy team",
    what: "Paid in ORBIO, never in $ORBANCY, so it adds no selling pressure.",
  },
  {
    key: "orbio",
    name: "To Orbio",
    what: "Orbio’s protocol fee on every harvest, before anything reaches Orbancy.",
  },
].map((d) => ({ ...d, color: `var(--f-${d.key})` }));
const flow = feeFlow($("#flow"), $("#split"), {
  ends: { mind: "Minds", treasury: "Coin treasuries" },
});

let coins = [],
  stats = {},
  data = null;
const name = (id) => {
  const c = coins.find((x) => x.agentId === +id);
  return c?.name
    ? `${c.name}${c.symbol ? " $" + c.symbol : ""}`
    : `Agent ${id}`;
};

// Two sources: the routed totals, and live treasuries and names. Each redraws when it lands.
live(
  "/api/coins",
  (c) => {
    coins = c.coins || [];
    stats = c.stats || {};
    if (data) render(data);
  },
  { every: 60_000 }
);
live(
  "/api/analytics",
  (a) => {
    data = a;
    render(a);
  },
  { every: 60_000 }
);

function render(a) {
  const t = a.totals;
  const total = t.fees.usd;

  // Headline figures
  countTo($("#k-volume"), t.volume.usd, usd);
  $("#k-volume").title = `${num(a.counts.trades)} trades`;
  countTo($("#k-fees"), total, usd);
  countTo(
    $("#k-minds"),
    t.mindCredit.usd + t.mindBalance.usd + t.toMind.usd,
    usd
  );
  if (stats.treasuryUsd != null)
    countTo($("#k-treasury"), stats.treasuryUsd, usd);
  countTo($("#k-bought"), t.buybacks.usd, usd);

  // Where the fees went: the economics flow, drawn with every fee actually routed
  $("#w-note").textContent = a.updatedAt ? `Updated ${ago(a.updatedAt)}` : "";
  $("#w-flow").classList.remove("loading");
  const out = flow(
    {
      credit: t.mindCredit.usd,
      balance: t.mindBalance.usd,
      stake: t.staked.usd,
      orbio: t.orbioFee.usd,
      fromStake: t.toMind.usd,
      treasury: t.toTreasury.usd,
      burn: t.toBurn.usd,
      team: t.toTeam.usd,
    },
    usd
  );
  fill(
    $("#split"),
    DEST.map(
      (d) =>
        `<div data-dest="${d.key}"><span class="eyebrow">${
          d.name
        }</span><b>${usd(out[d.key])}</b><em>${pct(
          total > 0 ? out[d.key] / total : 0
        )} of all fees</em><span>${d.what}</span></div>`
    ).join(""),
    { html: true }
  );
  stagger($("#split"));

  // Treasuries: spent on buybacks vs still held
  const routed = t.toTreasury.orbio;
  const spent = Math.min(routed, t.buybacks.orbio + t.programs.orbio);
  const held = Math.max(0, routed - spent);
  fill(
    $("#t-bar"),
    routed > 0
      ? `<span style="flex:${spent};background:var(--f-treasury)"><em>${
          spent / routed >= 0.12 ? pct(spent / routed) : ""
        }</em></span><span class="soft" style="flex:${held}"><em>${
          held / routed >= 0.12 ? pct(held / routed) : ""
        }</em></span>`
      : '<span class="none">Nothing routed to treasuries yet</span>',
    { html: true }
  );
  fill(
    $("#t-legend"),
    `
    <div><i class="key" style="background:var(--f-treasury)"></i><span>Bought back and burned</span><b>${num(
      spent,
      2,
      true
    )} ORBIO</b><small>${a.counts.buybacks} buybacks, ${num(
      a.counts.tokensBurned
    )} coin tokens burned</small></div>
    <div><i class="key soft"></i><span>Still held</span><b>${num(
      held,
      2,
      true
    )} ORBIO</b><small>${usd(
      stats.treasuryUsd
    )} at today's price</small></div>`,
    { html: true }
  );

  // $ORBANCY burn: the reserve waiting, counting down to the next fee milestone, when it all burns at once
  const ms = a.milestones || {};
  countTo(
    $("#b-reserve"),
    ms.reserveOrbio ?? t.toBurn.orbio - t.platformBurn.orbio,
    (v) => `${num(v, 2, true)} ORBIO`
  );
  const prev = ms.last || 0;
  const toGo = Math.max(0, (ms.next || 0) - total);
  $("#b-bar i").style.width = `${
    ms.next ? Math.min(100, ((total - prev) / (ms.next - prev)) * 100) : 0
  }%`;
  fill(
    $("#b-note"),
    ms.next
      ? `Burns when fees across every coin pass ${money(ms.next)}: ${usd(
          toGo
        )} to go.${
          t.platformBurn.orbio > 0
            ? ` ${num(a.counts.orbancyBurned)} $ORBANCY burned so far.`
            : " The first burn waits for $ORBANCY to launch."
        }`
      : "Waiting for the first fees."
  );
  fill(
    $("#b-hist"),
    (ms.history || [])
      .slice(0, 5)
      .map(
        (b) =>
          `<div class="route k-platformBurn"><time>${ago(
            b.at
          )}</time><p>Passed ${money(b.milestone)} in fees: burned <b>${num(
            b.burned
          )} $ORBANCY</b> with ${num(b.orbio, 2, true)} ORBIO.</p>${
            b.tx
              ? `<a class="go" href="${esc(
                  b.tx
                )}" target="_blank" rel="noopener">tx ↗</a>`
              : ""
          }</div>`
      )
      .join(""),
    { html: true }
  );

  chart(a.hours);

  // By coin
  const list = Object.entries(a.coins).sort(
    (x, y) => y[1].fees.usd - x[1].fees.usd
  );
  fill(
    $("#coins tbody"),
    list.length
      ? list
          .map(
            ([id, c]) =>
              `<tr><td><a href="/mind?id=${id}">${esc(
                name(id)
              )}</a></td><td class="num">${usd(
                c.volume.usd
              )}</td><td class="num">${usd(
                c.fees.usd
              )}</td><td class="num">${usd(
                c.mindCredit.usd + c.mindBalance.usd + c.toMind.usd
              )}</td><td class="num">${usd(
                c.toTreasury.usd
              )}</td><td class="num">${num(
                c.buybacks.orbio,
                2,
                true
              )} ORBIO</td><td class="num">${num(c.tokensBurned)}</td></tr>`
          )
          .join("")
      : '<tr><td colspan="7" class="muted">No fees routed yet.</td></tr>',
    { html: true }
  );
  stagger($("#coins tbody"));

  // Live routing, in sentences
  fill(
    $("#feed"),
    a.recent.length
      ? a.recent.slice(0, 25).map(sentence).join("")
      : '<p class="empty">Nothing routed yet. Fees settle every five minutes.</p>',
    { html: true }
  );
  stagger($("#feed"));
}

function sentence(e) {
  const who =
    e.agentId != null
      ? `<a href="/mind?id=${e.agentId}">${esc(name(e.agentId))}</a>`
      : "Orbancy";
  const receipt = `<a class="go" href="https://robin.etherscan.io/tx/${esc(
    e.tx
  )}" target="_blank" rel="noopener">tx ↗</a>`;
  let text;
  if (e.kind === "settled") {
    const parts = [
      ["its mind", e.toMind],
      ["its treasury", e.toTreasury],
      ["the $ORBANCY burn", e.toBurn],
      ["the team", e.toTeam],
      ["Orbio", e.toOrbio],
    ]
      .filter(([, v]) => v >= 0.005)
      .map(([k, v]) => `${usd(v)} to ${k}`);
    text = `${who} earned <b>${usd(e.usd)}</b> in fees: ${parts.join(", ")}.`;
  } else if (e.kind === "buyback")
    text = `${who}’s mind spent <b>${num(
      e.orbio,
      2,
      true
    )} ORBIO</b> buying back and burned ${num(e.burned)} tokens.`;
  else if (e.kind === "platformBurn")
    text = `Orbancy bought and burned <b>${num(
      e.burned
    )} $ORBANCY</b> with ${num(e.orbio, 2, true)} ORBIO.`;
  else
    text = `${who} funded a holder reward program with <b>${num(
      e.orbio,
      2,
      true
    )} ORBIO</b>.`;
  return `<div class="route k-${e.kind}"><time>${ago(
    e.t
  )}</time><p>${text}</p>${receipt}</div>`;
}

// Fees over time: hourly for the first three days of data, daily after that.
function chart(hours) {
  const keys = Object.keys(hours).sort();
  const el = $("#c-chart"),
    axis = $("#c-axis"),
    tip = $("#c-tip");
  if (!keys.length) {
    el.classList.remove("loading");
    el.innerHTML = '<p class="empty">No fees yet.</p>';
    axis.innerHTML = "";
    return;
  }
  const span =
    (Date.parse(keys.at(-1) + ":00Z") - Date.parse(keys[0] + ":00Z")) /
    3_600_000;
  const daily = span > 72;
  const buckets = new Map();
  // Fill every bucket between the first and now, so quiet hours show as gaps, not missing columns.
  const step = daily ? 86_400_000 : 3_600_000;
  const keyOf = (ms) => new Date(ms).toISOString().slice(0, daily ? 10 : 13);
  for (let ms = Date.parse(keys[0] + ":00Z"); ms <= Date.now(); ms += step)
    buckets.set(keyOf(ms), {});
  for (const k of keys) {
    const b = buckets.get(keyOf(Date.parse(k + ":00Z"))) || {};
    for (const [f, v] of Object.entries(hours[k])) b[f] = (b[f] || 0) + v;
    buckets.set(keyOf(Date.parse(k + ":00Z")), b);
  }
  const cols = [...buckets].slice(daily ? -90 : -72);
  const max = Math.max(...cols.map(([, b]) => b.fees || 0), 1);
  $("#c-title").textContent = daily ? "Fees by day" : "Fees by hour";
  $("#c-note").textContent = `Peak ${usd(max)} in ${
    daily ? "a day" : "an hour"
  }`;
  const label = (k) =>
    daily
      ? new Date(k + "T00:00Z").toLocaleDateString([], {
          month: "short",
          day: "numeric",
        })
      : new Date(k + ":00Z").toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "numeric",
        });
  // Columns grow up from the baseline the first time; later refreshes resize in place.
  const grow = !el.dataset.drawn;
  el.dataset.drawn = "1";
  el.classList.remove("loading");
  el.innerHTML = cols
    .map(
      ([k, b], i) =>
        `<div class="c" data-i="${i}"><span style="height:${
          grow ? 0 : ((b.fees || 0) / max) * 100
        }%;transition-delay:${grow ? i * 12 : 0}ms" data-h="${
          ((b.fees || 0) / max) * 100
        }"></span></div>`
    )
    .join("");
  if (grow)
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        el
          .querySelectorAll("span[data-h]")
          .forEach((s) => (s.style.height = s.dataset.h + "%"))
      )
    );
  axis.innerHTML = `<span>${label(cols[0][0])}</span><span>${label(
    cols.at(-1)[0]
  )}</span>`;
  el.onmousemove = (e) => {
    const c = e.target.closest(".c");
    if (!c) {
      tip.hidden = true;
      return;
    }
    const [k, b] = cols[+c.dataset.i];
    tip.innerHTML =
      `<b>${label(k)}</b><div><span>Volume</span><b>${usd(
        b.volume || 0
      )}</b></div><div><span>Fees</span><b>${usd(b.fees || 0)}</b></div>` +
      DEST.map((d) => [
        d,
        d.key === "mind"
          ? (b.mindCredit || 0) + (b.mindBalance || 0) + (b.toMind || 0)
          : b[
              {
                treasury: "toTreasury",
                burn: "toBurn",
                team: "toTeam",
                orbio: "orbioFee",
              }[d.key]
            ] || 0,
      ])
        .filter(([, v]) => v > 0)
        .map(
          ([d, v]) =>
            `<div><span><i class="key" style="background:${d.color}"></i>${
              d.name
            }</span><b>${usd(v)}</b></div>`
        )
        .join("");
    tip.hidden = false;
    const box = el.getBoundingClientRect(),
      r = c.getBoundingClientRect();
    tip.style.left = `${Math.min(
      Math.max(r.left - box.left + r.width / 2, 90),
      box.width - 90
    )}px`;
  };
  el.onmouseleave = () => (tip.hidden = true);
}
