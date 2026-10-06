// The mind's eye: plays back what a mind actually did on its last turn, step by step, from the trace
// it records while it works. While a turn is running it follows along live. Nothing here is invented:
// every frame is a recorded step, and between turns it shows the live numbers it is watching.
import { $, ago, esc, num as n, reduced, until } from "./common.js";

const HOLD = {
  chain: 5200,
  think: 6500,
  x: 7500,
  web: 6500,
  page: 9500,
  decide: 7500,
  check: 5500,
  send: 3500,
  tx: 5500,
  fund: 5000,
  error: 4500,
  wait: 6000,
  post: 5500,
  tool: 3000,
  watch: 9000,
};
const KIND = {
  chain: "Reading the chain",
  think: "Thinking",
  x: "Reading X",
  web: "Searching the web",
  page: "Reading a page",
  decide: "Decided",
  check: "Checking its limits",
  send: "Sending",
  tx: "On chain",
  fund: "Funding its thinking",
  error: "Hit a problem",
  wait: "Waiting for its model",
  post: "Posting on X",
  tool: "Working",
  watch: "Watching",
};
const TILE = {
  chain: "Chain",
  think: "Think",
  x: "X",
  web: "Web",
  page: "Page",
  decide: "Decide",
  check: "Limits",
  send: "Send",
  tx: "Receipt",
  fund: "Fund",
  error: "Error",
  wait: "Wait",
  post: "X",
  tool: "…",
  watch: "Watch",
};
const TOOLNAME = {
  web_search: "Searching the web for",
  x_search: "Searching X for",
  open_page: "Opening",
};
const host = (u) => {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return "";
  }
};
const shortHash = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "");
const dur = (ms) => {
  const s = Math.max(1, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/// Types a paragraph out over `ms`, like the model writing it.
function typeOut(p, ms) {
  const full = p.textContent;
  if (reduced || !full) return;
  const start = performance.now();
  p.classList.add("on");
  const tick = (now) => {
    if (!p.isConnected) return;
    const k = Math.min(1, (now - start) / ms);
    p.textContent = full.slice(0, Math.ceil(full.length * k));
    if (k < 1) requestAnimationFrame(tick);
    else p.classList.remove("on");
  };
  p.textContent = "";
  requestAnimationFrame(tick);
}

export function mindsEye(root, id) {
  const el = (s) => $(s, root);
  let mind = null; // latest dashboard data, for the watching frame
  let run = null;
  let frames = [];
  let at = 0;
  let timer = 0;
  let follow = false;
  let key = "";

  async function poll() {
    const t = await fetch(`/api/trace?id=${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    const next = t?.current?.steps?.length ? t.current : t?.past?.[0] || null;
    const k = next
      ? `${next.startedAt}:${next.steps.length}:${next.live}`
      : "none";
    if (k !== key) {
      const wasSame = run && next && run.startedAt === next.startedAt;
      key = k;
      run = next;
      build(wasSame);
    }
    setTimeout(poll, run?.live ? 3000 : document.hidden ? 60000 : 20000);
  }

  // Frames are the recorded steps. A tool call in progress only shows while it is the newest step.
  function build(sameRun) {
    const steps = (run?.steps || []).filter(
      (s, i, all) => s.kind !== "tool" || (run.live && i === all.length - 1)
    );
    frames = [...steps, { kind: "watch" }];
    el("#eye-frames").innerHTML = frames
      .map(
        (f, i) =>
          `<button type="button" class="fr k-${
            f.kind
          }" data-i="${i}" title="${esc(KIND[f.kind])}"><span>${
            TILE[f.kind]
          }</span><i></i></button>`
      )
      .join("");
    follow = !!run?.live;
    if (follow) show(Math.max(0, frames.length - 2));
    else if (!sameRun || at >= frames.length) show(run ? 0 : frames.length - 1);
    else show(at);
    mode();
  }

  function mode() {
    const m = el("#eye-mode");
    if (!run) {
      m.innerHTML = "Recording starts on its next thought";
      return;
    }
    if (run.live) {
      m.innerHTML = '<span class="live"><i class="orb"></i>Live</span>';
      return;
    }
    m.textContent = `Replay · ${ago(run.startedAt)} · ${dur(
      (run.endedAt || run.steps.at(-1).t) - run.startedAt
    )}`;
  }

  function show(i) {
    clearTimeout(timer);
    at = i;
    const f = frames[i];
    if (!f) return;
    root.querySelectorAll(".fr").forEach((b, j) => {
      b.classList.toggle("on", j === i);
      b.classList.toggle("seen", j < i);
    });
    const [url, view, cap, sub] = render(f);
    el("#eye-url").innerHTML = url;
    const v = el("#eye-view");
    v.className = `view k-${f.kind}`;
    v.innerHTML = view;
    v.querySelectorAll("img").forEach((img) =>
      img.addEventListener("error", () => img.remove())
    );
    v.querySelectorAll(".type").forEach((p) =>
      typeOut(p, (HOLD[f.kind] || 5000) * 0.55)
    );
    el("#eye-kind").textContent = f.kind === "tool" ? "Working" : KIND[f.kind];
    el("#eye-cap").textContent = cap;
    el("#eye-sub").textContent = sub;
    const working = run?.live && i === frames.length - 2;
    el("#eye-st").innerHTML = `<i class="orb"></i>${
      working ? "Working" : f.kind === "watch" ? "Idle" : "Done"
    }`;
    el("#eye-st").className = `st${working ? " busy" : ""}`;
    const hold = HOLD[f.kind] || 5000;
    const bar = el("#eye-prog");
    bar.style.transition = "none";
    bar.style.width = "0";
    if (!follow || f.kind === "watch") {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          bar.style.transition = `width ${hold}ms linear`;
          bar.style.width = "100%";
        })
      );
      v.style.setProperty("--hold", `${hold}ms`);
      timer = setTimeout(() => {
        if (!follow) show((i + 1) % frames.length);
      }, hold);
    } else bar.style.width = "100%";
  }

  function render(f) {
    switch (f.kind) {
      case "chain":
        return [
          "<b>robinhood chain</b> / orbancy.coin(" + id + ")",
          `<div class="reads">${f.reads
            .map(
              ([k, v, s], j) =>
                `<div style="--d:${j * 380}ms"><span>${esc(k)}</span><b>${esc(
                  v
                )}</b><small>${esc(s || "")}</small></div>`
            )
            .join("")}</div>`,
          "Its treasury, fees, price and spending room, read straight from the contract",
          run?.model ? `then hands them to ${run.model}` : "",
        ];
      case "think":
        return [
          `<b>${esc(run?.model || "model")}</b> / reasoning`,
          `<p class="type">${esc(f.text)}</p>`,
          "Thinking out loud before its next step",
          "",
        ];
      case "tool":
        return [
          `<b>${esc(
            {
              web_search: "search",
              x_search: "x.com",
              open_page: host(f.q) || "page",
            }[f.tool] || f.tool
          )}</b> / ${esc(f.q)}`,
          `<div class="work"><span class="spin"></span><p>${esc(
            TOOLNAME[f.tool] || "Running"
          )} “${esc(f.q)}”</p></div>`,
          `${TOOLNAME[f.tool] || "Running"} “${f.q}”`,
          "right now",
        ];
      case "x":
        return [
          `<b>x.com</b>/search?q=${esc(encodeURIComponent(f.q))}`,
          f.posts.length
            ? `<div class="posts">${f.posts
                .map(
                  (p, j) =>
                    `<div class="post" style="--d:${j * 500}ms"><b>@${esc(
                      p.by || "unknown"
                    )}</b><p>${esc(p.text)}</p>${
                      p.likes != null
                        ? `<small>${n(p.likes)} likes</small>`
                        : ""
                    }</div>`
                )
                .join("")}</div>`
            : '<p class="none">No posts came back.</p>',
          `“${f.q}”`,
          `${f.posts.length} posts read`,
        ];
      case "web":
        return [
          `<b>search</b> / ${esc(f.q)}`,
          f.results.length
            ? `<div class="results">${f.results
                .map(
                  (r, j) =>
                    `<div style="--d:${j * 450}ms"><small>${esc(
                      host(r.url)
                    )}</small><b>${esc(r.title || r.url)}</b><p>${esc(
                      r.snippet || ""
                    )}</p></div>`
                )
                .join("")}</div>`
            : '<p class="none">No results came back.</p>',
          `“${f.q}”`,
          `${f.results.length} results`,
        ];
      case "page":
        return [
          `<b>${esc(host(f.url))}</b>${esc(
            (() => {
              try {
                const u = new URL(f.url);
                return u.pathname + u.search;
              } catch {
                return "";
              }
            })()
          )}`,
          `<div class="page">${
            f.image
              ? `<img src="${esc(
                  f.image
                )}" alt="" referrerpolicy="no-referrer">`
              : ""
          }<h4>${esc(
            f.title || host(f.url)
          )}</h4><div class="box"><div class="scroll">${esc(f.text).replace(
            /\n{2,}/g,
            "<br><br>"
          )}</div></div></div>`,
          f.title || f.url,
          `read in full · ${n(f.text.length)} characters`,
        ];
      case "decide":
        return [
          "<b>decision</b>",
          `<div class="dec ${f.action === "buyback" ? "buy" : ""}"><b>${
            f.action === "buyback" ? `Buy back ${n(f.percent, 1)}%` : "Hold"
          }</b><p class="type">${esc(f.note || "")}</p></div>`,
          f.action === "buyback"
            ? `Buy back ${n(f.percent, 1)}% of the treasury and burn it`
            : "Hold the treasury",
          "posted to its journal",
        ];
      case "check":
        return [
          "<b>orbancy</b> / policy()",
          `<div class="checks">${f.checks
            .map(
              ([k, v], j) =>
                `<div style="--d:${j * 500}ms"><span>✓ ${esc(k)}</span><b>${esc(
                  v
                )}</b></div>`
            )
            .join("")}${
            f.skipped ? `<p class="none">Skipped: ${esc(f.skipped)}</p>` : ""
          }</div>`,
          "Clipped to the contract’s limits and simulated before sending",
          "",
        ];
      case "send":
        return [
          "<b>robinhood chain</b> / pending",
          `<div class="work"><span class="spin"></span><p>Buyback sent · <code>${esc(
            shortHash(f.hash)
          )}</code></p></div>`,
          `Spending ${n(f.spent, 2)} ORBIO`,
          "waiting for the block",
        ];
      case "tx":
        return [
          "<b>robinhood chain</b> / confirmed",
          `<div class="txok ${f.ok ? "" : "bad"}"><b>${
            f.ok ? "Confirmed" : "Reverted"
          }</b><p>${n(f.spent, 2)} ORBIO in, about ${n(f.bought)} ${esc(
            run?.symbol ? "$" + run.symbol : "tokens"
          )} bought and burned</p><a href="${esc(
            f.tx
          )}" target="_blank" rel="noopener">Receipt ↗</a></div>`,
          f.ok ? "Bought back and burned" : "The buyback reverted",
          "",
        ];
      case "fund":
        return [
          "<b>orbio</b> / exchange",
          `<div class="txok"><b>Budget topped up</b><p>${esc(f.text)}</p>${
            f.tx
              ? `<a href="${esc(
                  f.tx
                )}" target="_blank" rel="noopener">Receipt ↗</a>`
              : ""
          }</div>`,
          "Paid for its own thinking",
          "",
        ];
      case "post":
        return [
          `<b>x.com/${esc(f.handle)}</b>`,
          f.text
            ? `<div class="posts"><div class="post"><b>@${esc(
                f.handle
              )}</b><p>${esc(f.text)}</p></div></div>`
            : '<p class="none">No post this turn.</p>',
          f.text ? "Posted its decision" : "Replied on X",
          f.replies
            ? `and ${f.replies} repl${
                f.replies === 1 ? "y" : "ies"
              } to people who wrote to it`
            : "from its own account",
        ];
      case "wait":
        return [
          "<b>model</b>",
          `<p class="none">${esc(f.text)}</p>`,
          "Holding this turn",
          "nothing was spent",
        ];
      case "error":
        return [
          "<b>error</b>",
          `<p class="none">${esc(f.text)}</p>`,
          "Stopped this turn",
          "it tries again next turn",
        ];
      default: {
        // watch: the live numbers between turns
        const s = mind?.mindState || {};
        const last = (mind?.history || []).find(
          (e) => e.kind === "decided" || e.kind === "buyback"
        );
        return [
          `<b>${esc(location.host)}</b>/mind?id=${id}`,
          `<div class="watch"><div class="radar"><i></i><i></i><i></i><span></span></div><div class="wnums">
            <div><span>Market cap</span><b>${
              mind?.market?.marketCapUsd != null
                ? "$" + n(mind.market.marketCapUsd)
                : "n/a"
            }</b></div>
            <div><span>Fees earned</span><b>$${n(
              mind?.fees.lifetimeUsd,
              2,
              true
            )}</b></div>
            <div><span>Treasury</span><b>${n(
              mind?.treasury?.orbio
            )} ORBIO</b></div>
            <div><span>Next thought</span><b>${
              s.awake && s.nextThinkAt ? until(s.nextThinkAt) : "when funded"
            }</b></div>
          </div>${
            last
              ? `<p class="lastnote"><small>Last decision · ${ago(
                  last.t
                )}</small>${esc(last.text)}</p>`
              : ""
          }</div>`,
          `Watching $${mind?.symbol || ""} between thoughts`,
          "live numbers, refreshed every 30 seconds",
        ];
      }
    }
  }

  root.addEventListener("click", (e) => {
    const b = e.target.closest(".fr");
    if (!b) return;
    follow = false;
    show(+b.dataset.i);
  });

  poll();
  return {
    update(m) {
      mind = m;
      if (frames[at]?.kind === "watch") {
        const [, view] = render(frames[at]);
        el("#eye-view").innerHTML = view;
      }
    },
  };
}
