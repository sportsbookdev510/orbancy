import { ago, esc, every, sigil, stagger } from "./common.js";

const VERB = {
  decided: "decided",
  buyback: "bought back",
  reward: "rewarded holders",
  paused: "is waiting for its model",
  woke: "woke up",
  slept: "went to sleep",
  funded: "funded its thinking",
};

function entry(e) {
  const el = document.createElement("div");
  el.className = "thought";
  const name = e.name || `Agent ${e.agentId}`;
  const receipt = e.tx
    ? ` <a class="receipt" href="${esc(
        e.tx
      )}" target="_blank" rel="noopener">Receipt</a>`
    : "";
  const model = e.model ? `<small>${esc(e.model)}</small>` : "";
  el.innerHTML = `<a class="sig" href="/mind?id=${e.agentId}" aria-label="${esc(
    name
  )}"></a><div><div class="who"><a href="/mind?id=${e.agentId}"><b>${esc(
    name
  )}</b></a><em>${VERB[e.kind] || esc(e.kind)}</em><small data-t="${e.t}">${ago(
    e.t
  )}</small>${model}</div><p>${esc(e.text)}${receipt}</p></div>`;
  sigil(el.firstChild, name, e.personality, e.objective);
  return el;
}

/// Renders the newest journal entries across every mind into el and keeps them fresh.
export function liveFeed(el, { max = 8, empty }) {
  let seen = null;
  const blank = () =>
    el.replaceChildren(
      Object.assign(document.createElement("p"), {
        className: "empty",
        textContent: empty,
      })
    );
  const load = () =>
    fetch("/api/minds")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ feed }) => {
        const list = feed.slice(0, max);
        const key = list.map((e) => e.t + e.agentId).join();
        if (key !== seen) {
          seen = key;
          if (list.length) el.replaceChildren(...list.map(entry));
          else blank();
          stagger(el);
        }
        el.querySelectorAll("[data-t]").forEach(
          (s) => (s.textContent = ago(+s.dataset.t))
        );
      })
      .catch(() => {
        if (seen == null) blank();
      });
  load();
  every(30_000, load);
}
