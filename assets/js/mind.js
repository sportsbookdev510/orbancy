// /mind lists every mind; /mind?id=N is one mind's dashboard, refreshed every 30 seconds.
import {
  $,
  ago,
  esc,
  every,
  fill,
  live,
  money,
  num,
  sigil,
  stagger,
  until,
} from "./common.js";
import { connect, connected, onChange, reason, send, short } from "./wallet.js";
import { mindsEye } from "./eye.js";
import { DRIVES, PERSONALITIES } from "./personas.js";

const id = new URLSearchParams(location.search).get("id");
const usd = (v) =>
  v == null ? "n/a" : v >= 1000 ? money(v) : "$" + num(v, 2, true);
const price = (v) =>
  v == null ? "n/a" : v >= 0.01 ? "$" + num(v, 4) : "$" + v.toPrecision(3);
const compact = (v) =>
  v == null
    ? "n/a"
    : "$" +
      Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: v >= 1e6 ? 2 : 1,
      }).format(v);
const clock = (t) =>
  new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const set = (sel, v) => fill($(sel), v);
const html = (sel, v) => fill($(sel), v, { html: true });
const KIND = {
  decided: "Decided",
  buyback: "Bought back",
  reward: "Rewarded holders",
  funded: "Funded",
  woke: "Woke",
  slept: "Slept",
  paused: "Waiting",
};
let eye = null;
let marketAt = 0; // when the 5-second poll last set the market cap
let shown = false;

if (id) {
  $("#dash").hidden = false;
  eye = mindsEye($("#eye"), id); // its trace loads alongside the dashboard data
  live(`/api/minds?id=${encodeURIComponent(id)}`, render, {
    every: 30_000,
    onError: (_, body) => {
      $("#dash").hidden = true;
      list({
        title: "Mind not found",
        text: (() => {
          try {
            return JSON.parse(body).error;
          } catch {
            return "Try again in a moment.";
          }
        })(),
      });
    },
  });
  every(5_000, market);
} else list();

// Market cap and price, every 5 seconds while the tab is open. The full dashboard refreshes every 30.
async function market() {
  const m = await fetch(`/api/market?id=${encodeURIComponent(id)}`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (m?.marketCapUsd == null) return;
  marketAt = Date.now();
  set("#s-cap", compact(m.marketCapUsd));
  if (m.priceUsd != null) set("#s-price", `${price(m.priceUsd)} per token`);
}

function list(message) {
  $("#mlist").hidden = false;
  if (message) {
    set("#mname", message.title);
    set("#mabout", message.text);
    $("#minds").hidden = true;
    return;
  }
  live(
    "/api/coins",
    ({ coins = [] }) => {
      if (!coins.length) {
        html(
          "#minds",
          '<p class="empty">No coins yet. <a href="/launch">Launch the first mind.</a></p>'
        );
        return;
      }
      $("#minds").replaceChildren(
        ...coins.map((c) => {
          const a = document.createElement("a");
          a.className = "r";
          a.href = `/mind?id=${c.agentId}`;
          a.innerHTML = `<span class="sig md"></span><div><div class="t">${esc(
            c.name ?? "New coin"
          )} <span class="muted">${
            c.symbol ? "$" + esc(c.symbol) : ""
          }</span></div><div class="m"><span class="state ${
            c.awake ? "A" : "S"
          }">${c.awake ? "Awake" : "Asleep"}</span><span>${esc(
            c.model || c.status
          )}</span></div></div><div class="v">${money(
            c.marketCapUsd
          )}<small>${money(c.lifetimeFeesUsd)} fees</small></div>`;
          sigil(a.firstChild, c.name || c.token, c.personality, c.objective);
          return a;
        })
      );
      stagger($("#minds"));
    },
    { every: 60_000 }
  );
}

function render(m) {
  const s = m.mindState;
  const name = m.name ?? `Agent ${m.agentId}`;
  const sym = m.symbol ? "$" + m.symbol : `Agent ${m.agentId}`;
  const history = m.history || [];
  const fees = m.fees.lifetimeUsd;
  const asleep = fees < m.fees.wakeAtUsd ? "Waiting" : "Asleep";
  if (!shown) {
    shown = true;
    document.title = `${name}${m.symbol ? ` (${sym})` : ""}, Orbancy`;
    for (const el of [$("#d-sig"), $("#d-sig2")]) {
      el.classList.remove("sk");
      sigil(el, m.name || m.token, s.personality, s.objective);
    }
  }

  // Header
  set("#d-sym", sym);
  set("#d-stage", m.market.graduated ? "Graduated" : "On curve");
  set("#d-name", name);
  $("#d-trade").href = m.trade;
  fill($("#d-ca"), short(m.token));
  Object.assign($("#d-ca"), {
    title: `Copy contract ${m.token}`,
  }).dataset.copy = m.token;
  if (Date.now() - marketAt > 15_000) {
    // the 5-second poll is fresher; don't step back to an older figure
    set("#s-cap", compact(m.market.marketCapUsd));
    set("#s-price", `${price(m.market.priceUsd)} per token`);
  }
  set("#s-fees", usd(fees));
  set(
    "#s-fees2",
    m.fees.lifetimeOrbio != null
      ? `${num(m.fees.lifetimeOrbio)} ORBIO`
      : "lifetime"
  );
  set("#s-tre", usd(m.treasury.usd));
  set("#s-tre2", `${num(m.treasury.orbio)} ORBIO`);
  set(
    "#s-bud",
    s.balanceUsd == null ? "Not yet" : "$" + num(s.balanceUsd, 2, true)
  );
  const ready = m.wallet.credit + m.wallet.creditOwed;
  set(
    "#s-bud2",
    ready >= 0.01
      ? `+${num(ready, 2)} CREDIT ready`
      : m.wallet.orbio >= 1
      ? `+${num(m.wallet.orbio)} ORBIO to convert`
      : "Orbio AI balance"
  );
  set("#s-curvek", m.market.graduated ? "Trading" : "Curve");
  set(
    "#s-curve",
    m.market.graduated
      ? "Uniswap"
      : m.market.curveProgressPct == null
      ? "n/a"
      : `${num(m.market.curveProgressPct, 1, true)}%`
  );
  set("#s-curve2", m.market.graduated ? "graduated" : "to graduation");

  // The mind
  set("#d-mname", name);
  set("#d-model", `Thinks with ${s.model}`);
  $("#d-awake").className = `badge ${s.awake ? "A" : "S"}`;
  html("#d-awake", `<i class="orb"></i>${s.awake ? "Awake" : asleep}`);
  const explain = (label, meaning) =>
    `${esc(label)}${meaning ? ` <span class="muted">${meaning}</span>` : ""}`;
  html("#d-pers", explain(s.personality, PERSONALITIES[s.personality]));
  html("#d-obj", explain(s.objective, DRIVES[s.objective]));
  set("#d-desc", m.description || "");
  $("#d-desc").hidden = !m.description;
  $("#d-live").className = `live${s.awake ? "" : " off"}`;
  html("#d-live", `<i class="orb"></i>${s.awake ? "Live" : "Idle"}`);

  // Thinking: the journal
  const journal = $("#d-journal");
  const key = history.map((e) => e.t).join();
  if (journal.dataset.key !== key) {
    journal.dataset.key = key;
    journal.innerHTML = history.length
      ? history
          .slice(0, 60)
          .map(
            (e) =>
              `<div class="te"><time data-t="${e.t}">${ago(e.t)}<small>${clock(
                e.t
              )}</small></time><div><span class="k ${esc(e.kind)}">${
                KIND[e.kind] || esc(e.kind)
              }</span><p>${esc(e.text)}</p>${moved(e)}${
                e.posted
                  ? `<a class="moved" href="https://x.com/${esc(
                      e.posted.handle
                    )}" target="_blank" rel="noopener">On X, @${esc(
                      e.posted.handle
                    )}${
                      e.posted.replies
                        ? ` · replied to ${e.posted.replies}`
                        : ""
                    } ↗</a>`
                  : ""
              }</div></div>`
          )
          .join("")
      : `<p class="empty">${
          fees < m.fees.wakeAtUsd
            ? `Wakes when its coin has earned $${
                m.fees.wakeAtUsd
              } in fees. ${usd(fees)} so far.`
            : "Waking. Its first thought appears here within ten minutes."
        }</p>`;
    stagger(journal);
  } else
    journal
      .querySelectorAll("time[data-t]")
      .forEach((t) => (t.firstChild.textContent = ago(+t.dataset.t)));

  eye.update(m);

  // Fee ladder: where this coin's fees sit on the bands
  const band = fees < 20 ? 0 : fees < 100 ? 1 : 2;
  const legend = [
    ["First $20", "All to the mind"],
    ["$20 to $100", "Half mind, half treasury"],
    ["Above $100", "80% treasury, 10% burn, 10% team"],
  ];
  html(
    "#d-ladder",
    `
    <div class="ladder">${legend
      .map(
        (_, b) =>
          `<span class="${b < band ? "on" : b === band ? "at" : ""}"></span>`
      )
      .join("")}<em style="left:${Math.min(100, fees / 2)}%"></em></div>
    <div class="legend">${legend
      .map(
        ([k, v], b) =>
          `<div class="${
            b === band ? "now" : ""
          }"><span>${k}</span><span>${v}</span></div>`
      )
      .join("")}</div>
    <p class="muted small">${usd(
      fees
    )} earned. Orbio also turns 40% of every fee into CREDIT for this mind.</p>`
  );

  // Spending limits, as the contract checks them
  const t = m.treasury,
    p = m.policy;
  const share = (a, b) => (b > 0 ? Math.min(100, (a / b) * 100) : 0);
  const lim = (label, value, bar, cls = "") =>
    `<div class="lim"><div class="row"><span>${label}</span><b>${value}</b></div>${
      bar == null
        ? ""
        : `<div class="bar ${cls}"><i style="width:${bar}%"></i></div>`
    }</div>`;
  html(
    "#d-limits",
    [
      lim(
        "Spent today",
        `${num(t.spentTodayOrbio)} / ${num(t.dailyCapOrbio)} ORBIO`,
        share(t.spentTodayOrbio, t.dailyCapOrbio)
      ),
      lim(`Per move, ${num(p.perMovePct)}%`, `${num(t.perMoveOrbio)} ORBIO`),
      lim(
        `Reserve, ${num(p.reservePct)}% of high`,
        `${num(t.floorOrbio)} ORBIO`
      ),
      lim(
        "Can spend now",
        `${num(t.spendableNowOrbio)} ORBIO`,
        share(t.spendableNowOrbio, t.orbio),
        "ok"
      ),
    ].join("")
  );

  // Holdings
  set("#d-treusd", usd(t.usd));
  const hold = (label, sub, amount, value = "", bar) =>
    `<div class="hold"><b>${label}<small>${sub}</small></b><span class="n">${amount}</span><span class="u">${value}</span>${
      bar == null ? "" : `<div class="bar"><i style="width:${bar}%"></i></div>`
    }</div>`;
  const burned = history.reduce(
    (a, e) => a + (e.kind === "buyback" ? e.spentOrbio || 0 : 0),
    0
  );
  html(
    "#d-holds",
    [
      hold(
        "ORBIO",
        "Treasury",
        num(t.orbio, 2, true),
        usd(t.usd),
        share(t.orbio, t.highestOrbio)
      ),
      hold(
        "ORBIO",
        "Mind wallet, for thinking",
        num(m.wallet.orbio, 2, true),
        usd(m.wallet.orbio * m.orbioUsd)
      ),
      ready >= 0.01
        ? hold("CREDIT", "Ready to activate", num(ready, 2, true))
        : "",
      m.wallet.usdg >= 0.01
        ? hold(
            "USDG",
            "Mid conversion",
            num(m.wallet.usdg, 2, true),
            usd(m.wallet.usdg)
          )
        : "",
      hold("ETH", "Gas", num(m.wallet.eth, 5, true)),
    ].join("") +
      (burned > 0
        ? `<p class="muted small">${num(
            burned,
            2,
            true
          )} ORBIO spent buying back and burning ${esc(sym)}.</p>`
        : "")
  );

  // Moves with receipts
  const moves = history.filter((e) => e.tx);
  const label = (e) =>
    e.kind === "buyback"
      ? `Bought back${
          e.spentOrbio ? ` ${num(e.spentOrbio, 2, true)} ORBIO` : ""
        }`
      : e.kind === "reward"
      ? `Rewarded ${num(e.program?.recipients)} holders`
      : e.kind === "funded"
      ? "Funded its thinking"
      : KIND[e.kind] || esc(e.kind);
  html(
    "#d-moves",
    moves.length
      ? moves
          .slice(0, 20)
          .map(
            (e) =>
              `<a class="mv" href="${esc(
                e.tx
              )}" target="_blank" rel="noopener"><span>${label(
                e
              )}</span><small>On chain <span>· ${ago(
                e.t
              )}</span></small><span class="go">tx ↗</span></a>`
          )
          .join("")
      : '<p class="empty">No moves yet. Buybacks and top-ups land here with receipts.</p>'
  );

  // Rhythm
  const active = s.lastFeesAt && Date.now() - s.lastFeesAt < 86_400_000;
  set(
    "#d-cadence",
    s.hot
      ? "every 10 min, people are arguing"
      : active
      ? "every 30 min"
      : "every 6 h"
  );
  html(
    "#d-rhythm",
    [
      ["Status", esc(s.status || (s.awake ? "Awake" : asleep))],
      [
        "Woke",
        s.wokeAt
          ? ago(s.wokeAt)
          : fees < m.fees.wakeAtUsd
          ? `at $${m.fees.wakeAtUsd} of fees`
          : "n/a",
      ],
      ["Last thought", s.lastThinkAt ? ago(s.lastThinkAt) : "not yet"],
      [
        "Next thought",
        s.awake && s.nextThinkAt ? until(s.nextThinkAt) : "when funded",
      ],
      ["Fees last came in", s.lastFeesAt ? ago(s.lastFeesAt) : "n/a"],
      ["Holders", m.holders == null ? "counting" : num(m.holders)],
      [
        "Mind wallet",
        `<button class="link" type="button" data-copy="${esc(m.mind)}">${short(
          m.mind
        )}</button>`,
      ],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
      .join("")
  );
}

// The post that changed its mind, linked rather than quoted. A function declaration on purpose: the
// dashboard first renders from cache while this module is still loading, before any const below exists.
function moved(e) {
  return e.movedBy?.url && /^https:\/\/x\.com\//.test(e.movedBy.url)
    ? `<a class="moved" href="${esc(
        e.movedBy.url
      )}" target="_blank" rel="noopener">Changed its mind: @${esc(
        e.movedBy.by || "a post"
      )}${e.movedBy.likes ? ` · ${num(e.movedBy.likes)} likes` : ""} ↗</a>`
    : "";
}

// Holder rewards: every program this mind funded, and a claim button for the connected wallet's share.
let rewardsFor = null;
async function rewards() {
  if (!id) return;
  const account = await connected().catch(() => null);
  const r = await fetch(
    `/api/rewards?id=${encodeURIComponent(id)}${
      account ? `&account=${account}` : ""
    }`
  )
    .then((x) => (x.ok ? x.json() : null))
    .catch(() => null);
  if (!r?.programs?.length) return;
  rewardsFor = { ...r, account };
  $("#rw-pane").hidden = false;
  set(
    "#rw-meta",
    `${r.programs.length} program${r.programs.length === 1 ? "" : "s"}`
  );
  const orbio = (wei) => num(Number(BigInt(wei) / 10n ** 12n) / 1e6, 2, true);
  html(
    "#d-rewards",
    r.programs
      .map((p) => {
        const open = Date.now() < p.deadline;
        const mine = p.mine;
        const action = !account
          ? open
            ? '<span class="muted small">Connect your wallet to see your share.</span>'
            : ""
          : !mine
          ? '<span class="muted small">This wallet did not qualify.</span>'
          : mine.claimed
          ? `<span class="muted small">Claimed ${orbio(
              mine.amount
            )} ORBIO.</span>`
          : open
          ? `<button class="btn sm" type="button" data-claim="${
              p.programId
            }">Claim ${orbio(mine.amount)} ORBIO</button>`
          : '<span class="muted small">Closed. Unclaimed ORBIO went back to the treasury.</span>';
        return `<div class="rw"><div class="row"><b>${orbio(
          p.total
        )} ORBIO to ${num(p.recipients)} holders</b><a class="go" href="${esc(
          p.tx
        )}" target="_blank" rel="noopener">tx ↗</a></div><p>${esc(
          p.note
        )}</p><small class="muted">Held ${num(
          p.heldDays,
          1
        )}+ days without selling · ${
          open ? `claim ${until(p.deadline)}` : "closed"
        }</small><div class="act">${action}</div></div>`;
      })
      .join("")
  );
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-claim]");
  if (!b || !rewardsFor) return;
  const p = rewardsFor.programs.find(
    (x) => String(x.programId) === b.dataset.claim
  );
  b.disabled = true;
  b.textContent = "Confirm in your wallet";
  try {
    const { encodeClaim } = await import("./claim.js");
    await send({
      from: await connect(),
      to: rewardsFor.distributor,
      data: encodeClaim(
        p.programId,
        p.mine.index,
        rewardsFor.account,
        p.mine.amount,
        p.mine.proof
      ),
    });
    await rewards();
  } catch (err) {
    b.disabled = false;
    b.textContent = "Try again";
    b.title = reason(err);
  }
});
if (id) {
  rewards();
  onChange(rewards);
}
