// The wallet in the header, on every page: connect when disconnected; when connected, the address,
// with a menu to copy it, see it on the explorer, or disconnect.
import {
  EXPLORER,
  connect,
  connected,
  disconnect,
  onChange,
  reason,
  short,
} from "./wallet.js";

const root = document.querySelector("#acct");
const button = root.querySelector("button");
const menu = root.querySelector('[role="menu"]');
let account = null;

const open = (on) => {
  menu.hidden = !on;
  button.setAttribute("aria-expanded", on);
};

async function draw() {
  account = await connected().catch(() => null);
  root.classList.toggle("on", !!account);
  button.innerHTML = account
    ? `<i class="dot"></i>${short(account)}`
    : "Connect wallet";
  button.setAttribute("aria-haspopup", account ? "menu" : "false");
  menu.querySelector("[data-view]").href = account
    ? `${EXPLORER}/address/${account}`
    : "#";
  open(false);
}

button.addEventListener("click", async () => {
  if (account) return open(menu.hidden);
  try {
    await connect();
  } catch (err) {
    if (err.code !== 4001) note(reason(err));
  }
});
menu.addEventListener("click", async (e) => {
  const item = e.target.closest("[data-copy],[data-off]");
  if (!item) return;
  if (item.matches("[data-copy]")) {
    await navigator.clipboard?.writeText(account);
    item.textContent = "Copied";
    setTimeout(() => (item.textContent = "Copy address"), 1200);
  } else await disconnect();
});
document.addEventListener("click", (e) => {
  if (!root.contains(e.target)) open(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") open(false);
});

// No browser dialogs: a short note under the button.
function note(text) {
  root.dataset.note = text;
  setTimeout(() => delete root.dataset.note, 4000);
}

onChange(draw);
draw();
