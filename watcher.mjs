// pump.fun bounty watcher
// Polls the public pump.fun bounties API and pushes a phone notification (via
// ntfy.sh) whenever a brand-new bounty appears. No login or browser needed.
//
//   node watcher.mjs        -> run forever, poll every config.pollSeconds
//   node watcher.mjs --test -> send one test notification and exit

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
const SEEN_FILE = path.join(__dirname, "seen.json");

// Env vars override config.json (used by the GitHub Actions setup so the secret
// ntfy topic never has to be committed to the repo).
const NTFY_SERVER = (process.env.NTFY_SERVER || CONFIG.ntfyServer || "https://ntfy.sh").replace(/\/$/, "");
const NTFY_TOPIC = process.env.NTFY_TOPIC || CONFIG.ntfyTopic;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const log = (...a) => console.log(new Date().toISOString(), ...a);

// ---------- seen-id persistence ----------
function loadSeen() {
  try { return JSON.parse(fs.readFileSync(SEEN_FILE, "utf8").replace(/^﻿/, "")); }
  catch { return { initialized: false, ids: [] }; }
}
function saveSeen(state) {
  if (state.ids.length > 5000) state.ids = state.ids.slice(-5000);
  fs.writeFileSync(SEEN_FILE, JSON.stringify(state));
}

// ---------- fetch the current bounty list ----------
async function fetchBounties() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(CONFIG.apiUrl, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json", Origin: "https://pump.fun", Referer: "https://pump.fun/" },
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    return Array.isArray(j) ? j : (j.items || j.tasks || j.data || []);
  } finally {
    clearTimeout(t);
  }
}

function rewardUsd(b) {
  const n = Number(b.rewardTotalUsd ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function describe(b) {
  const usd = rewardUsd(b);
  const reward = usd > 0 ? "$" + Math.round(usd).toLocaleString() : "";
  const title = String(b.title ?? "New bounty").replace(/\s+/g, " ").trim().slice(0, 120);
  const url = CONFIG.bountyLinkBase + b.taskId;
  return { reward, title, url, status: b.status };
}

// ---------- phone push via ntfy ----------
function asciiHeader(s) {
  return String(s).replace(/[^\x20-\x7E]/g, "").slice(0, 120) || "pump.fun bounty";
}
async function pushPhone({ title, message, url, priority = "high", tags = "moneybag" }) {
  const endpoint = `${NTFY_SERVER}/${NTFY_TOPIC}`;
  const headers = { Title: asciiHeader(title), Priority: priority, Tags: tags };
  if (url) headers.Click = url;
  try {
    const r = await fetch(endpoint, { method: "POST", headers, body: message });
    if (!r.ok) log("ntfy push failed:", r.status, await r.text().catch(() => ""));
  } catch (e) {
    log("ntfy push error:", e.message);
  }
}

// ---------- one poll: fetch, compare, notify ----------
async function processCycle() {
  const bounties = await fetchBounties();
  const seen = loadSeen();
  const known = new Set(seen.ids);

  if (!seen.initialized) {
    // first run: record everything currently open so we don't blast old bounties
    seen.ids = bounties.map(b => b.taskId).filter(Boolean);
    seen.initialized = true;
    saveSeen(seen);
    log(`Baseline saved: ${seen.ids.length} existing bounties. Watching for new ones...`);
    await pushPhone({
      title: "pump.fun watcher is live",
      message: `Connected. Now watching for new bounties (${seen.ids.length} already open).`,
      tags: "satellite_antenna", priority: "default",
      url: "https://pump.fun/go/bounties?sort=recent",
    });
    return;
  }

  const fresh = bounties.filter(b => b.taskId && !known.has(b.taskId));
  // oldest-first so phone alerts arrive in chronological order
  fresh.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  let notified = 0;
  for (const b of fresh) {
    const d = describe(b);
    seen.ids.push(b.taskId); // mark seen regardless, so we never repeat
    if (rewardUsd(b) < (CONFIG.minRewardUsd || 0)) continue;
    notified++;
    log("NEW BOUNTY:", d.reward || "(no $)", "|", d.status, "|", d.title);
    await pushPhone({
      title: d.reward ? `New bounty • ${d.reward}` : "New pump.fun bounty",
      message: d.title,
      url: d.url,
    });
  }
  if (fresh.length) saveSeen(seen);
  log(fresh.length ? `${fresh.length} new (${notified} notified).` : `No new bounties (checked ${bounties.length}).`);
}

// ---------- entry point ----------
async function main() {
  if (process.argv.includes("--test")) {
    await pushPhone({
      title: "pump.fun watcher test",
      message: "Notifications are working. You're subscribed to topic: " + NTFY_TOPIC,
      url: "https://pump.fun/go/bounties?sort=recent",
      tags: "white_check_mark",
    });
    log("Test notification sent.");
    return;
  }

  // scheduled run (used by GitHub Actions). By default it checks once and exits.
  // If config.runForSeconds > 0, it keeps checking every pollSeconds for that long
  // before exiting - this lets a 5-minute GitHub timer give ~30s freshness by
  // staying alive between fires.
  if (process.argv.includes("--check-once")) {
    const runForMs = Number(CONFIG.runForSeconds || 0) * 1000;
    const end = Date.now() + runForMs;
    while (true) {
      try { await processCycle(); }
      catch (e) { log("Cycle error:", e.message); }
      const remaining = end - Date.now();
      if (remaining <= 0) break;
      await new Promise(r => setTimeout(r, Math.min(CONFIG.pollSeconds * 1000, remaining)));
    }
    return;
  }

  // continuous run (used on your PC or a VPS)
  log(`Watcher started. Polling every ${CONFIG.pollSeconds}s. ntfy topic: ${NTFY_TOPIC}`);
  let consecutiveErrors = 0;
  while (true) {
    try {
      await processCycle();
      consecutiveErrors = 0;
    } catch (e) {
      consecutiveErrors++;
      log("Poll error:", e.message, `(streak ${consecutiveErrors})`);
      // if the site/network is down for a long stretch, warn the phone once
      if (consecutiveErrors === 20) {
        await pushPhone({
          title: "pump.fun watcher: connection trouble",
          message: "Can't reach pump.fun for a while. It will keep retrying.",
          priority: "low", tags: "warning",
        });
      }
    }
    await new Promise(r => setTimeout(r, CONFIG.pollSeconds * 1000));
  }
}

main().catch(e => { log("FATAL:", e); process.exit(1); });
