import { $, $$, money, reduced } from "./common.js";
import { feeFlow } from "./flow.js";

const input = $("#fees"),
  svg = $("#flow");
const MAX = 50000;
const toFees = (v) => Math.round(10 ** ((v / 1000) * Math.log10(MAX + 1)) - 1);
const toSlider = (L) =>
  Math.round((Math.log10(L + 1) / Math.log10(MAX + 1)) * 1000);

$("#ticks").innerHTML = [0, 20, 100, 1000, 10000, 50000]
  .map(
    (L) =>
      `<span data-x="${toSlider(L) / 10}">${
        L >= 1000 ? `$${L / 1000}k` : `$${L}`
      }</span>`
  )
  .join("");
$$("#ticks span").forEach((s) => (s.style.left = s.dataset.x + "%"));

// Orbancy's fee ladder, funded from Orbio's split: 30% CREDIT + 10% balance go to the mind, and the
// staked 50% tops up the mind (first bands), stays as treasury, or above $100 pays the platform cut:
// 10% buys and burns $ORBANCY, 10% goes to the Orbancy team in ORBIO.
function ladder(L) {
  const b1 = Math.min(L, 20),
    b2 = Math.min(Math.max(L - 20, 0), 80),
    b3 = Math.max(L - 100, 0);
  const fromStake = 0.5 * b1 + 0.05 * b2;
  return {
    mind: 0.4 * L + fromStake,
    fromStake,
    treasury: 0.45 * b2 + 0.3 * b3,
    burn: 0.1 * b3,
    team: 0.1 * b3,
    orbio: 0.1 * L,
  };
}
const BANDS = [
  "First $20: everything the coin earns goes to the mind so it can wake.",
  "$20 to $100: half to the mind, half stays staked as treasury.",
  "Above $100: 10% buys and burns $ORBANCY, 10% goes to the Orbancy team in ORBIO, the rest funds the mind and treasury.",
];

const flow = feeFlow(svg, $("#split"));

function draw() {
  const L = toFees(+input.value),
    r = ladder(L);
  $("#feesout").textContent = money(L);
  const band = L <= 20 ? 0 : L <= 100 ? 1 : 2;
  $("#bandnote").textContent = BANDS[band];
  $$("tr[data-band]").forEach((tr) =>
    tr.classList.toggle("on", +tr.dataset.band === band)
  );

  flow(
    {
      credit: 0.3 * L,
      balance: 0.1 * L,
      stake: 0.5 * L,
      orbio: 0.1 * L,
      fromStake: r.fromStake,
      treasury: r.treasury,
      burn: r.burn,
      team: r.team,
    },
    money
  );

  $("#split").innerHTML = [
    ["mind", "To the mind", r.mind, "CREDIT and balance it can think with"],
    [
      "treasury",
      "To the treasury",
      r.treasury,
      "Staked ORBIO, earning CREDIT while idle",
    ],
    [
      "burn",
      "To buy and burn $ORBANCY",
      r.burn,
      "10% of fees above $100. Held in ORBIO until $ORBANCY launches",
    ],
    [
      "team",
      "To the Orbancy team",
      r.team,
      "10% of fees above $100, paid in ORBIO",
    ],
    ["orbio", "To Orbio", r.orbio, "Orbio’s 10% protocol fee"],
  ]
    .map(
      ([k, t, v, d]) =>
        `<div data-dest="${k}"><span class="eyebrow">${t}</span><b>${money(
          v
        )}</b><span>${d}</span></div>`
    )
    .join("");
}

input.addEventListener("input", draw);

// Opening move: sweep from $0 to $250 so the ladder visibly fills.
const target = toSlider(250);
if (reduced) {
  input.value = target;
  draw();
} else {
  let v = 0;
  const step = () => {
    v += Math.max(1, (target - v) * 0.08);
    input.value = Math.min(v, target);
    draw();
    if (v < target) requestAnimationFrame(step);
  };
  step();
}
