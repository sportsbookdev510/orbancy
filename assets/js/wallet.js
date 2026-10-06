// The injected wallet (MetaMask, Rabby, Coinbase), held to Robinhood Chain. No library.
export const CHAIN_ID = "0x1237"; // 4663
const CHAIN = {
  chainId: CHAIN_ID,
  chainName: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
  blockExplorerUrls: ["https://robin.etherscan.io"],
};
export const EXPLORER = "https://robin.etherscan.io";

const eth = () => {
  if (!window.ethereum)
    throw new Error("No wallet found. Install MetaMask or Rabby, then reload.");
  return window.ethereum;
};

export const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// The site only talks to the wallet after the visitor clicks Connect here. That choice is remembered per
// browser; until then nothing is asked of the wallet, so no wallet ever pops up on its own.
const KEY = "orbancy:wallet";
const remember = (on) => {
  try {
    on ? localStorage.setItem(KEY, "on") : localStorage.removeItem(KEY);
  } catch {}
};
const chosen = () => {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
};
const changed = () => window.dispatchEvent(new Event("wallet"));

export async function connect() {
  const [account] = await eth().request({ method: "eth_requestAccounts" });
  remember(true);
  changed();
  await ensureChain();
  return account;
}

export async function connected() {
  if (!window.ethereum || !chosen()) return null;
  const [account] = await window.ethereum.request({ method: "eth_accounts" });
  return account || null;
}

export async function disconnect() {
  remember(false);
  // Wallets that support it drop the site's permission too, so the next connect asks again.
  await window.ethereum
    ?.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    })
    .catch(() => {});
  changed();
}

async function ensureChain() {
  if ((await eth().request({ method: "eth_chainId" })) === CHAIN_ID) return;
  try {
    await eth().request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID }],
    });
  } catch (err) {
    if (err.code !== 4902) throw err;
    await eth().request({ method: "wallet_addEthereumChain", params: [CHAIN] });
  }
}

/// Sends a transaction and waits for its receipt. Omitting `to` deploys `data` as a contract.
export async function send(tx, onSent) {
  await ensureChain();
  const hash = await eth().request({
    method: "eth_sendTransaction",
    params: [tx],
  });
  onSent?.(hash);
  for (;;) {
    const receipt = await eth().request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    });
    if (receipt) {
      if (receipt.status !== "0x1") {
        // Replay it at the block before to learn why it reverted.
        const before = "0x" + (BigInt(receipt.blockNumber) - 1n).toString(16);
        const sent = await eth().request({
          method: "eth_getTransactionByHash",
          params: [hash],
        });
        const data = await eth()
          .request({
            method: "eth_call",
            params: [
              {
                from: sent.from,
                to: sent.to,
                data: sent.input,
                value: sent.value,
              },
              before,
            ],
          })
          .then(
            () => null,
            (e) => e?.data?.data || e?.data || null
          );
        throw Object.assign(new Error("The transaction reverted on chain."), {
          reverted: true,
          revertData: typeof data === "string" ? data : null,
          tx: `${EXPLORER}/tx/${hash}`,
        });
      }
      return receipt;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

export const onChange = (fn) => {
  window.addEventListener("wallet", fn);
  window.ethereum?.on?.("accountsChanged", fn);
  window.ethereum?.on?.("chainChanged", fn);
};

export const reason = (err) =>
  err?.data?.message || err?.shortMessage || err?.message || String(err);
