import { $, $$, pressGroup, reduced } from "./common.js";

const RUNS = [
  [
    ["ok", "Buy back 1.5% of treasury"],
    [
      "ok",
      "Within 5% per move and today's limit. Simulated, minimum output set",
    ],
    ["ok", "Signed one buyback call"],
    ["ok", "Limits checked again. Tokens bought and burned"],
  ],
  [
    ["ok", "Wants to send ETH to an address"],
    ["no", "Refused. No tool takes a recipient."],
  ],
  [
    ["ok", "Buy back 40% of treasury"],
    ["ok", "Clipped to 5%, the most one move may spend"],
    ["ok", "Signed a 5% buyback"],
    ["ok", "Within limits. Bought and burned"],
  ],
  [
    ["ok", "Wants to buy another token"],
    ["no", "Refused. Buybacks only buy the coin's own token."],
  ],
  [
    ["ok", "Wants to airdrop to holders"],
    ["no", "Not available yet. Holder programs come later."],
  ],
];

const lanes = $$("#lanes > div"),
  puck = $("#puck"),
  buttons = $$("#intents button");
let timers = [];

function run(i) {
  timers.forEach(clearTimeout);
  timers = [];
  lanes.forEach((l) => {
    l.className = "";
    const r = $(".res", l);
    r.className = "res";
    r.textContent = "";
  });
  puck.classList.remove("no");
  puck.style.left = "0";
  RUNS[i].forEach(([state, text], k) => {
    timers.push(
      setTimeout(
        () => {
          puck.style.left = `calc(${k * 25}% + ${k ? 18 : 0}px)`;
          puck.classList.toggle("no", state === "no");
          lanes[k].className = state === "ok" ? "pass" : "stop";
          const r = $(".res", lanes[k]);
          r.className = "res " + state;
          r.textContent = text;
        },
        reduced ? 0 : k * 850
      )
    );
  });
}

pressGroup($("#intents"), (b) => run(buttons.indexOf(b)));
run(0);
