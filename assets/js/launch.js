import { $, $$, pressGroup, sigil } from "./common.js";
import { connect, connected, onChange, reason, send } from "./wallet.js";
import {
  bornClose,
  bornDone,
  bornFail,
  bornOpen,
  bornPending,
} from "./born.js";
import { DRIVES, PERSONALITIES, READS_MENTIONS } from "./personas.js";
import { MODELS } from "./models.js";

// Orbancy's launch errors, in words.
const REVERTS = {
  "0x94af166d":
    "That mind wallet was taken by another launch a moment earlier. Try again and you will get a fresh one.",
  "0x203d82d8": "The signed launch expired. Try again to sign a new one.",
  "0x5cd5d233":
    "The launch signature was not valid for this wallet. Try again.",
  "0xd93c0665": "Launching is paused right now.",
};
const COIN_LAUNCHED =
  "0x0ed147ef629d8d524bf00674cfe21def0b135068bb11a537a4355e68a90e14a6";
const name = $("#ln"),
  ticker = $("#lt"),
  xIn = $("#lx"),
  about = $("#ld"),
  form = $("#lform"),
  submit = $("#lsubmit"),
  msg = $("#lmsg");
const picked = (id) => $(`#${id} [aria-pressed="true"]`)?.dataset.v;
let account = null;
let deployed = false;

const MAKER = [
  [/^Claude/, "Anthropic"],
  [/^GPT/, "OpenAI"],
  [/^Gemini/, "Google"],
  [/^Grok/, "xAI"],
  [/^DeepSeek/, "DeepSeek"],
  [/^Kimi/, "Moonshot AI"],
];
const maker = (m) => MAKER.find(([re]) => re.test(m))?.[1];

// The ticker follows the name until it is typed in by hand: "Meridian" → MRDN, "Fable" → FABLE.
let tickerTyped = false;

// The token's image: generated from its personality and drive, unless one is dropped in. A dropped
// image is cropped to a 512px square here, so the server only ever stores a small, known shape.
let image = null;
async function useImage(file) {
  const hint = $("#li-hint");
  if (!file) return;
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type))
    return (hint.textContent =
      "That file is not a PNG, JPEG, WebP or GIF image.");
  if (file.size > 10e6)
    return (hint.textContent = "That image is over 10 MB. Try a smaller one.");
  try {
    // Read as a data: URL. The site's security policy allows data: images but not blob: ones.
    const src = await new Promise((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = no;
      r.readAsDataURL(file);
    });
    const img = await new Promise((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = no;
      i.src = src;
    });
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const k = 512 / Math.min(img.naturalWidth, img.naturalHeight); // cover: fill the square, crop the rest evenly
    const w = img.naturalWidth * k,
      h = img.naturalHeight * k;
    c.getContext("2d").drawImage(img, (512 - w) / 2, (512 - h) / 2, w, h);
    let data = c.toDataURL("image/png");
    if (data.length > 1.3e6) data = c.toDataURL("image/jpeg", 0.9);
    image = data;
    hint.textContent =
      "Your image, cropped to a square. Remove it to go back to the generated one.";
  } catch {
    return (hint.textContent =
      "That image could not be read. Try another file.");
  }
  $("#lclear").hidden = false;
  preview();
}
function clearImage() {
  image = null;
  $("#li").value = "";
  $("#lclear").hidden = true;
  $("#li-hint").textContent =
    "Generated from its personality and drive. Drop in your own image to replace it.";
  preview();
}
function suggest(n) {
  const w = n
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .trim();
  const words = w.split(/\s+/).filter(Boolean);
  if (words.length >= 3)
    return words
      .map((x) => x[0])
      .join("")
      .slice(0, 6);
  const joined = words.join("");
  if (joined.length <= 6) return joined;
  return (joined[0] + joined.slice(1).replace(/[AEIOU]/g, "")).slice(0, 5);
}
const cleanTicker = (v) =>
  v
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);

// "@handle", "handle" or an x.com / twitter.com link, as https://x.com/handle. Empty when not a handle.
const handle = () =>
  xIn.value
    .trim()
    .replace(/^@/, "")
    .replace(/^(https?:\/\/)?(www\.)?(x|twitter)\.com\//i, "")
    .split(/[/?#]/)[0];
const xUrl = () =>
  /^[A-Za-z0-9_]{1,15}$/.test(handle()) ? `https://x.com/${handle()}` : "";

// One message per field, shown after the field is left or a launch is tried, cleared as it is fixed.
const CHECKS = {
  ln: () => (name.value.trim() ? "" : "Give it a name."),
  lt: () => (ticker.value ? "" : "Give it a ticker, letters and numbers."),
  lx: () =>
    !xIn.value.trim() || xUrl()
      ? ""
      : "That does not look like an X handle. Letters, numbers and _ only, up to 15.",
};
const shown = new Set();
function check(id) {
  const text = CHECKS[id]();
  const el = $("#" + id);
  $(`#${id}-err`).textContent = shown.has(id) ? text : "";
  el.setAttribute("aria-invalid", String(shown.has(id) && !!text));
  return !text;
}

function preview() {
  const n = name.value.trim() || "Meridian";
  const t = ticker.value || suggest(name.value) || "MRDN";
  const m = picked("lm"),
    p = picked("lp"),
    d = picked("lo");
  for (const el of [$("#lsig"), $("#psig")]) {
    sigil(el, n, p, d);
    if (image) el.style.background = `center/cover no-repeat url(${image})`;
  }
  $("#pn").textContent = n;
  $("#pt").textContent = `$${t}` + (xUrl() ? ` · @${handle()}` : "");
  $("#pm").textContent = m;
  $("#pp-t").textContent = p;
  $("#pp").textContent = PERSONALITIES[p];
  $("#po-t").textContent = d;
  $("#po").textContent = DRIVES[d];
  $("#lm-hint").textContent = `Made by ${maker(
    m
  )}. The mind thinks with it for life.`;
  $("#lp-hint").textContent = PERSONALITIES[p];
  $("#lo-hint").textContent = DRIVES[d];
  $("#lx-hint").textContent = READS_MENTIONS.includes(d)
    ? "Shown on Orbio. Convince me also reads every post that mentions this account."
    : "Shown on Orbio.";
  const words = about.value.trim();
  $$(".pd").forEach((el) => (el.hidden = !words));
  $("#pd").textContent = words ? `“${words}”` : "";
  $("#ld-count").textContent = `${about.value.length} / 380`;
}

function state() {
  submit.disabled = !deployed;
  submit.textContent = !deployed
    ? "Launching opens soon"
    : account
    ? "Sign and launch"
    : "Connect wallet to launch";
}

const say = (text, html) =>
  html ? (msg.innerHTML = text) : (msg.textContent = text);

// The choices, each explained under its group as it is picked.
const chips = (id, keys, first) =>
  ($(`#${id}`).innerHTML = keys
    .map(
      (k) =>
        `<button type="button" data-v="${k}" aria-pressed="${
          k === first
        }">${k}</button>`
    )
    .join(""));
chips(
  "lm",
  MODELS.map(([l]) => l),
  "Claude Sonnet 5.5"
);
chips("lp", Object.keys(PERSONALITIES), Object.keys(PERSONALITIES)[0]);
chips("lo", Object.keys(DRIVES), Object.keys(DRIVES)[0]);
for (const id of ["lm", "lp", "lo"]) pressGroup($(`#${id}`), preview);

name.addEventListener("input", () => {
  if (!tickerTyped) ticker.value = suggest(name.value);
  check("ln");
  check("lt");
  preview();
});
ticker.addEventListener("input", () => {
  const at = ticker.selectionStart;
  ticker.value = cleanTicker(ticker.value);
  ticker.setSelectionRange(at, at);
  tickerTyped = !!ticker.value;
  check("lt");
  preview();
});
xIn.addEventListener("input", () => {
  check("lx");
  preview();
});
xIn.addEventListener("change", () => {
  if (xUrl()) xIn.value = handle();
}); // a pasted link becomes the handle
about.addEventListener("input", preview);
$("#li").addEventListener("change", () => useImage($("#li").files[0]));
$("#lclear").addEventListener("click", clearImage);
// A file dragged anywhere over the token section lands on the image.
const zone = $("#lform .fsec"),
  drop = $("#ldrop");
const hasFile = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
zone.addEventListener("dragover", (e) => {
  if (!hasFile(e)) return;
  e.preventDefault();
  drop.classList.add("over");
});
zone.addEventListener("dragleave", (e) => {
  if (!zone.contains(e.relatedTarget)) drop.classList.remove("over");
});
zone.addEventListener("drop", (e) => {
  if (!hasFile(e)) return;
  e.preventDefault();
  drop.classList.remove("over");
  useImage(e.dataTransfer.files[0]);
});
for (const id of Object.keys(CHECKS))
  $("#" + id).addEventListener("blur", () => {
    if ($("#" + id).value.trim()) shown.add(id);
    check(id);
  });
// Enter in a field never submits: the wallet opens only when the launch button is clicked.
form.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.tagName === "INPUT") e.preventDefault();
});
preview();

onChange(async () => {
  account = await connected();
  state();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!deployed) return;
  Object.keys(CHECKS).forEach((id) => shown.add(id));
  const bad = Object.keys(CHECKS).filter((id) => !check(id))[0];
  if (bad) return $("#" + bad).focus();
  submit.disabled = true;
  try {
    account ||= await connect();
    state();
    say("Allocating a mind wallet and checking the launch terms");
    const r = await fetch("/api/mind", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        launcher: account,
        name: name.value.trim(),
        symbol: ticker.value,
        socials: { twitter: xUrl() },
        image: image || undefined,
        personality: picked("lp"),
        drive: picked("lo"),
        description: `${about.value.trim()}\n\nMind: ${picked("lm")}, ${picked(
          "lp"
        )}, ${picked("lo")}. Launched from Orbancy.io.`,
      }),
    });
    const tx = await r.json();
    if (!r.ok) throw new Error(tx.error);
    const coin = {
      name: name.value.trim(),
      symbol: ticker.value.trim().toUpperCase(),
      model: picked("lm"),
      personality: picked("lp"),
      objective: picked("lo"),
    };
    say("");
    bornOpen(coin);
    const receipt = await send(
      { from: account, to: tx.to, data: tx.data, value: tx.value },
      (hash) => bornPending(hash, coin)
    );
    const log = receipt.logs.find((l) => l.topics[0] === COIN_LAUNCHED);
    const agentId = BigInt(log.topics[1]).toString();
    const token = "0x" + log.topics[2].slice(26);
    bornDone({ ...coin, agentId, token, mind: tx.mind });
    say(
      `Launched as Orbio agent ${agentId}. <a href="/mind?id=${agentId}">Open its mind</a>.`,
      true
    );
  } catch (err) {
    if ($("#born").open) {
      if (err.code === 4001 || /reject|denied|cancel/i.test(err.message || ""))
        bornFail(
          "Launch declined",
          "You declined in your wallet. Nothing was sent and nothing was spent."
        );
      else if (err.reverted)
        bornFail(
          "The launch did not go through",
          REVERTS[err.revertData?.slice(0, 10)] ||
            "The transaction reverted on chain. You only paid gas; the launch fee was returned.",
          err.tx
        );
      else bornFail("The launch did not go through", reason(err));
    } else say(reason(err));
  } finally {
    state();
  }
});

// Models that failed Orbio's last check can't be picked: a mind's model is permanent.
fetch("/api/health")
  .then((r) => r.json())
  .then(({ models }) => {
    for (const b of $$("#lm button")) {
      const down = models?.models?.[b.dataset.v]?.ok === false;
      b.disabled = down;
      b.title = down ? "Unavailable on Orbio right now" : "";
    }
    if ($('#lm [aria-pressed="true"]')?.disabled) {
      $("#lm button:not(:disabled)")?.click();
    }
  })
  .catch(() => {});

const cfg = await fetch("/api/config")
  .then((r) => r.json())
  .catch(() => ({}));
deployed = !!cfg.orbancy;
account = await connected();
state();
if (!deployed)
  say(
    "Orbancy’s contracts are not deployed yet. Your wallet can connect now; launching opens with the deployment."
  );

// After a launch, "Launch another" or Esc clears the form for the next one.
$("#born").addEventListener("retry", () => form.requestSubmit());
$("#born").addEventListener("close", () => {
  if ($("#born").dataset.stage !== "born") return;
  name.value = "";
  ticker.value = "";
  xIn.value = "";
  about.value = "";
  tickerTyped = false;
  shown.clear();
  Object.keys(CHECKS).forEach(check);
  clearImage();
  preview();
  say("");
});
