// The fee flow diagram: creator fees -> Orbio's vault lanes -> where the money ends up. Shared by
// /economics (an example amount on the slider) and /analytics (every fee actually routed).
import { reduced } from "./common.js";

const X0 = 40,
  X1 = 320,
  VW = 150,
  X2 = X1 + VW,
  X3 = 760,
  TOP = 56,
  H = 320,
  GAP = 12;
const LANES = [
  ["credit", "CREDIT minted", "mind"],
  ["balance", "Gateway balance", "mind"],
  ["stake", "Staked ORBIO", "treasury"],
  ["orbio", "Orbio treasury", "orbio"],
];
const ENDS = [
  ["mind", "Mind"],
  ["treasury", "Treasury"],
  ["burn", "$ORBANCY buy and burn"],
  ["team", "Orbancy team"],
  ["orbio", "Orbio"],
];
const RIBBONS = {
  "in-credit": "mind",
  "in-balance": "mind",
  "in-stake": "treasury",
  "in-orbio": "orbio",
  credit: "mind",
  balance: "mind",
  "stake-mind": "mind",
  "stake-treasury": "treasury",
  "stake-burn": "burn",
  "stake-team": "team",
  orbio: "orbio",
};
const pctOf = (v, total) => {
  const p = total > 0 ? (v / total) * 100 : 0;
  return `${p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)}%`;
};

/// Builds the diagram in `svg` and links hover between it and `legend` (elements with data-dest).
/// Returns update(v, fmt): v holds what entered each vault lane { credit, balance, stake, orbio } and
/// where the stake went { fromStake, treasury, burn, team }, all in one unit; fmt formats an amount.
/// It returns what each end received: { mind, treasury, burn, team, orbio }.
export function feeFlow(svg, legend, { ends = {} } = {}) {
  svg.innerHTML = `<defs><linearGradient id="sheen" gradientUnits="userSpaceOnUse" x1="-260" y1="0" x2="0" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      ${
        reduced
          ? ""
          : '<animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="1220 0" dur="4.5s" repeatCount="indefinite"/>'
      }
    </linearGradient></defs>
    <g>${Object.entries(RIBBONS)
      .map(
        ([id, dest]) =>
          `<path class="band" data-id="${id}" data-dest="${dest}"/>`
      )
      .join("")}</g>
    <g>${Object.keys(RIBBONS)
      .map((id) => `<path class="sheen" data-id="${id}" stroke="url(#sheen)"/>`)
      .join("")}</g>
    <rect x="${X0}" y="${TOP}" width="8" height="${H}" fill="var(--ink)"/>
    ${LANES.map(
      ([k, label, dest]) =>
        `<g data-lane="${k}"><rect class="vault" x="${X1}" width="${VW}"/><rect class="edge" x="${X1}" width="3" data-dest="${dest}"/><text class="lbl" x="${
          X1 + 14
        }"><tspan class="pct"></tspan> <tspan class="amt">${label}</tspan></text></g>`
    ).join("")}
    ${ENDS.map(
      ([k, label]) =>
        `<rect class="end" data-end="${k}" data-dest="${k}" x="${X3}" width="8"/><g class="endtag" data-tag="${k}" data-dest-hover="${k}"><text class="lbl" x="${
          X3 + 20
        }" y="0">${ends[k] || label}</text><text class="amt" x="${
          X3 + 20
        }" y="18"></text></g>`
    ).join("")}
    <text class="colhead" x="${X0}" y="${
    TOP - 22
  }">Creator fees</text><text class="colhead" x="${X1}" y="${
    TOP - 22
  }">Orbio vault</text><text class="colhead" x="${X3}" y="${
    TOP - 22
  }">Where it ends up</text>`;

  // The path is set as an attribute, which every browser draws, and as the CSS d property, which
  // animates where supported (Safari does not support it, and would otherwise draw no ribbons).
  const ribbon = (id, x1, y1, x2, y2, w) => {
    const path = `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${
      (x1 + x2) / 2
    },${y2} ${x2},${y2}`;
    for (const el of svg.querySelectorAll(`[data-id="${id}"]`)) {
      el.setAttribute("d", path);
      el.style.d = `path("${path}")`;
      el.style.strokeWidth = Math.max(w, 0) + "px";
      el.style.visibility = w < 0.5 ? "hidden" : "visible";
    }
  };

  // Phones get the same split as one bar: the diagram needs more width than a phone has.
  const bar = document.createElement("div");
  bar.className = "flowbar";
  bar.setAttribute("role", "img");
  bar.innerHTML = ENDS.map(
    ([k]) => `<i data-dest="${k}" style="background:var(--f-${k})"></i>`
  ).join("");
  svg.closest(".flowscroll")?.before(bar);

  // Point at a destination to trace it, in the diagram or the legend.
  const focus = (k) =>
    k ? svg.setAttribute("data-focus", k) : svg.removeAttribute("data-focus");
  for (const root of [svg, legend]) {
    root.addEventListener("pointerover", (e) => {
      const el = e.target.closest("[data-dest],[data-dest-hover]");
      focus(el?.dataset.dest || el?.dataset.destHover);
    });
    root.addEventListener("pointerleave", () => focus());
  }

  return function update(v, fmt) {
    const total = v.credit + v.balance + v.stake + v.orbio;
    const S = total || 1;
    const out = {
      mind: v.credit + v.balance + v.fromStake,
      treasury: v.treasury,
      burn: v.burn,
      team: v.team,
      orbio: v.orbio,
    };

    // The vault's lanes, sized by what entered each.
    const lane = {};
    let ly = TOP;
    for (const [k] of LANES) {
      const h = (v[k] / S) * H;
      lane[k] = { top: ly, h };
      const g = svg.querySelector(`[data-lane="${k}"]`);
      for (const r of g.querySelectorAll("rect")) {
        r.style.y = ly + "px";
        r.style.height = Math.max(h, 1) + "px";
      }
      const label = g.querySelector("text");
      label.style.transform = `translateY(${
        ly + Math.min(Math.max(h, 1) / 2, 22) + 4
      }px)`;
      label.querySelector(".pct").textContent = pctOf(v[k], total);
      ly += h + GAP;
    }

    // Creator fees into the lanes.
    let src = TOP;
    for (const [k] of LANES) {
      const { top, h } = lane[k];
      ribbon("in-" + k, X0 + 8, src + h / 2, X1, top + h / 2, h);
      src += h;
    }

    // Ends, sized by what each received. Labels keep at least 44px apart.
    const end = {};
    let ey = TOP + 10,
      lastTag = -Infinity;
    ENDS.forEach(([k], i) => {
      const h = (out[k] / S) * H;
      end[k] = { top: ey, h };
      const bar = svg.querySelector(`[data-end="${k}"]`);
      bar.style.y = ey + "px";
      bar.style.height = Math.max(h, 2) + "px";
      const tagY = Math.min(
        Math.max(ey + Math.max(h, 2) / 2 - 4, lastTag + 44),
        470 - (ENDS.length - 1 - i) * 44
      );
      lastTag = tagY;
      const tag = svg.querySelector(`[data-tag="${k}"]`);
      tag.style.transform = `translateY(${tagY}px)`;
      tag.lastChild.textContent = `${fmt(out[k])} · ${pctOf(out[k], total)}`;
      ey += h + GAP * 2;
    });

    // Lanes into the ends.
    let my = end.mind.top;
    for (const k of ["credit", "balance"]) {
      const { top, h } = lane[k];
      ribbon(k, X2, top + h / 2, X3, my + h / 2, h);
      my += h;
    }
    let sy = lane.stake.top;
    for (const [id, part, into] of [
      ["stake-mind", v.fromStake, null],
      ["stake-treasury", v.treasury, "treasury"],
      ["stake-burn", v.burn, "burn"],
      ["stake-team", v.team, "team"],
    ]) {
      const h = (part / S) * H;
      const ty = into ? end[into].top : my;
      ribbon(id, X2, sy + h / 2, X3, ty + h / 2, h);
      sy += h;
    }
    ribbon(
      "orbio",
      X2,
      lane.orbio.top + lane.orbio.h / 2,
      X3,
      end.orbio.top + end.orbio.h / 2,
      lane.orbio.h
    );
    for (const [k, label] of ENDS)
      bar.querySelector(`[data-dest="${k}"]`).style.flex =
        String(out[k] / S || 0) + " 1 0";
    bar.setAttribute(
      "aria-label",
      ENDS.map(
        ([k, label]) => `${ends[k] || label} ${pctOf(out[k], total)}`
      ).join(", ")
    );
    return out;
  };
}
