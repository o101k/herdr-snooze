// Snooze state, shared by the sidebar and the picker. It lives in shared("snooze.spaces"),
// which Herdr saves in shared.json:
//   { [spaceId]: { until, at, name, machine, with: [worktree space ids hidden along with it] } }
// `until` and `at` are epoch milliseconds.

import { shared, setShared, spaces, machines, agents, terminals } from "herdr";

const KEY = "snooze.spaces";

export const DEFAULT_DURATIONS = ["15m", "30m", "1h", "2h", "4h"];

const UNIT = { m: 60e3, h: 3600e3, d: 86400e3, w: 604800e3 };
const LONGEST = 52 * UNIT.w;

export function entries() {
  const v = shared(KEY);
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

// Every space id the sidebar hides: the snoozed ones and the worktrees snoozed with them.
export function hiddenIds() {
  const ids = new Set();
  for (const [id, e] of Object.entries(entries())) {
    ids.add(id);
    for (const kid of e.with ?? []) ids.add(kid);
  }
  return ids;
}

export function snooze(space, ms, kids = []) {
  const now = Date.now();
  setShared(KEY, {
    ...entries(),
    [space.id]: { until: now + ms, at: now, name: space.name, machine: space.machine ?? null, with: kids },
  });
}

export function wake(id) {
  const next = { ...entries() };
  delete next[id];
  setShared(KEY, next);
}

// Drops entries that are due, and spaces that were closed while snoozed (only when their
// machine's layout is readable, so a machine still loading doesn't lose its snoozes).
// Returns the entries that came due, for a notification.
export function sweep(now = Date.now()) {
  const all = entries();
  const live = new Set(spaces().map((s) => s.id));
  // This computer is listed too (name null), and can still be loading at start.
  const ready = (m) => machines().some((k) => (k.name ?? null) === m && k.layout === "ready");
  const next = {};
  const due = [];
  let changed = false;
  for (const [id, e] of Object.entries(all)) {
    const machine = e.machine ?? null;
    if (ready(machine) && !live.has(id)) { changed = true; continue; }
    if (e.until <= now) { due.push({ id, ...e }); changed = true; continue; }
    const kids = ready(machine) ? (e.with ?? []).filter((k) => live.has(k)) : (e.with ?? []);
    if (kids.length !== (e.with ?? []).length) changed = true;
    next[id] = { ...e, with: kids };
  }
  if (changed) setShared(KEY, next);
  return due;
}

// "15m", "2h", "1h30m", "1.5h", "2d", "1w" -> milliseconds, or null.
export function parseDuration(text) {
  const s = String(text ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  const ok = (ms) => (ms > 0 && ms <= LONGEST ? ms : null);
  if (/^\d+(\.\d+)?$/.test(s)) return ok(Number(s) * UNIT.m); // a bare number is minutes
  // Longer spellings first: alternatives are tried in order.
  const re = /(\d+(?:\.\d+)?)(mins|min|m|hrs|hr|h|d|w)/y;
  let total = 0, at = 0, m;
  while (at < s.length && (m = re.exec(s))) { total += Number(m[1]) * UNIT[m[2][0]]; at = re.lastIndex; }
  return at === s.length ? ok(total) : null;
}

// "15m" -> "15 minutes", "1h30m" -> "1h 30m".
export function describe(text) {
  const ms = parseDuration(text);
  if (ms === null) return String(text);
  const one = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (ms % UNIT.w === 0) return one(ms / UNIT.w, "week");
  if (ms % UNIT.d === 0) return one(ms / UNIT.d, "day");
  if (ms % UNIT.h === 0) return one(ms / UNIT.h, "hour");
  if (ms < UNIT.h && ms % UNIT.m === 0) return one(ms / UNIT.m, "minute");
  return left(ms);
}

// Time left, short: "<1m", "45m", "2h 14m", "1d 3h".
export function left(ms) {
  if (ms < UNIT.m) return "<1m";
  const d = Math.floor(ms / UNIT.d), h = Math.floor((ms % UNIT.d) / UNIT.h), m = Math.floor((ms % UNIT.h) / UNIT.m);
  if (d) return h ? `${d}d ${h}h` : `${d}d`;
  if (h) return m ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

// When a snooze ends, as a clock time: "14:05", or "Thu 09:00" past today.
export function clock(at) {
  const d = new Date(at), now = new Date();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (d.toDateString() === now.toDateString()) return hm;
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]} ${hm}`;
}

// Agents: shared("snooze.agents") = { [address]: { until, at, name, space } }. Kept apart from spaces:
// an agent's snooze hides only its row in the Agents list.
const AGENTS = "snooze.agents";

export function agentEntries() {
  const v = shared(AGENTS);
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

export function snoozeAgent(address, name, space, ms) {
  const now = Date.now();
  setShared(AGENTS, { ...agentEntries(), [address]: { until: now + ms, at: now, name, space: space ?? "" } });
}

export function wakeAgent(address) {
  const next = { ...agentEntries() };
  delete next[address];
  setShared(AGENTS, next);
}

// Ends due snoozes and those of agents that need you now (blocked: Herdr tells you itself),
// and forgets this computer's agents whose terminal ended. Returns the due ones.
export function sweepAgents(now = Date.now()) {
  const all = agentEntries();
  const status = new Map(agents().map((a) => [a.address, a.status]));
  const live = terminals().filter((t) => t.state === "live").map((t) => t.address);
  const known = new Set(live);
  const next = {};
  const due = [];
  let changed = false;
  for (const [address, e] of Object.entries(all)) {
    const local = !address.includes("/");
    if (local && live.length && !known.has(address)) { changed = true; continue; }
    if (status.get(address) === "blocked") { changed = true; continue; }
    if (e.until <= now) { due.push({ address, ...e }); changed = true; continue; }
    next[address] = e;
  }
  if (changed) setShared(AGENTS, next);
  return due;
}
