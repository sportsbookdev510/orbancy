import { markSvg, sigilSpec } from "./sigil.js";
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
export const money = (n) =>
  n == null || Number.isNaN(n)
    ? "n/a"
    : "$" + Math.round(n).toLocaleString("en-US");
/// A number with up to `d` decimals (exactly `d` when `fixed`), or n/a.
export const num = (v, d = 0, fixed = false) =>
  v == null || Number.isNaN(+v)
    ? "n/a"
    : (+v).toLocaleString("en-US", {
        minimumFractionDigits: fixed ? d : 0,
        maximumFractionDigits: d,
      });

export function ago(t) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function until(t) {
  const mins = Math.round((t - Date.now()) / 60_000);
  return mins <= 1
    ? "any minute"
    : mins < 60
    ? `in ${mins}m`
    : `in ${Math.round(mins / 60)}h`;
}

/// Draws a coin's icon in el: its personality's color, its drive's mark (see sigil.js).
export function sigil(el, name, personality, drive) {
  const { stops, mark } = sigilSpec(name, personality, drive);
  const g = stops
    .map(([at, h, s, l]) => `hsl(${h} ${s}% ${l}%) ${at * 100}%`)
    .join(",");
  el.style.background = `url("data:image/svg+xml,${encodeURIComponent(
    markSvg(mark)
  )}") center/100% no-repeat,radial-gradient(circle at 32% 28%,${g})`;
  if (personality) el.title = `${personality} · ${drive}`;
  el.setAttribute("aria-hidden", "true");
}
$$("[data-sig]").forEach((el) => sigil(el, el.dataset.sig));

// Runs fn every ms while the tab is visible.
export function every(ms, fn) {
  return setInterval(() => {
    if (!document.hidden) fn();
  }, ms);
}

export function countUp(root) {
  $$("[data-count]", root).forEach((el) => {
    const to = +el.dataset.count,
      dec = +(el.dataset.dec || 0),
      pre = el.dataset.pre || "",
      suf = el.dataset.suf || "";
    const fmt = (v) =>
      pre +
      v.toLocaleString("en-US", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      }) +
      suf;
    if (reduced) return;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 1600);
      el.textContent = fmt(to * (1 - (1 - k) ** 4));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-copy]");
  if (!b) return;
  const done = (t) => {
    b.textContent = t;
    setTimeout(() => (b.textContent = "Copy"), 1400);
  };
  navigator.clipboard.writeText(b.dataset.copy).then(
    () => done("Copied"),
    () => done("Select it")
  );
});

// One pressed button per group.
export function pressGroup(group, onPick) {
  group.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !group.contains(b)) return;
    $$("button", group).forEach((x) => x.setAttribute("aria-pressed", x === b));
    onPick(b);
  });
}

// ---------------------------------------------------------------- loading

/// Fetches JSON for render(data). A tab that has seen this URL before renders its last copy at once,
/// then the fresh one; `every` keeps it fresh. onError(status, body) runs if there is nothing to show.
export function live(url, render, { every: ms, onError } = {}) {
  const key = `orbancy:${url}`;
  let last = null;
  try {
    last = sessionStorage.getItem(key);
    if (last) render(JSON.parse(last));
  } catch {
    last = null;
  }
  const load = () =>
    fetch(url)
      .then(async (r) => {
        const text = await r.text();
        if (!r.ok) {
          if (!last) onError?.(r.status, text);
          return;
        }
        if (text === last) return;
        last = text;
        try {
          sessionStorage.setItem(key, text);
        } catch {}
        render(JSON.parse(text));
      })
      .catch(() => {
        if (!last) onError?.(0);
      });
  load();
  if (ms) every(ms, load);
}

/// Puts content into an element that held a placeholder. The first fill fades it up; later ones swap quietly.
export function fill(el, content, { html = false } = {}) {
  if (!el) return;
  const first = !el.dataset.filled;
  if (html) el.innerHTML = content;
  else el.textContent = content;
  if (!first) return;
  el.dataset.filled = "1";
  el.classList.remove("sk", "loading");
  el.classList.add("in");
}

/// Fades up each child of a freshly rendered list, one after another.
export function stagger(el) {
  if (!el || el.dataset.shown) return;
  el.dataset.shown = "1";
  [...el.children].forEach((c, i) => {
    c.style.setProperty("--i", i);
    c.classList.add("in");
  });
}

/// Counts a figure up to `value` (from its last value, so live updates tick rather than jump).
export function countTo(el, value, format) {
  if (!el || value == null || Number.isNaN(value))
    return fill(el, format(value));
  const from = el._value ?? 0;
  el._value = value;
  fill(el, format(from));
  if (reduced || from === value) {
    el.textContent = format(value);
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 900);
    el.textContent = format(from + (value - from) * (1 - (1 - k) ** 3));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
