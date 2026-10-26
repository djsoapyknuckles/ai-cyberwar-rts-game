// Gate 2 numbers from an LLM General's turn log: invalid-command rate, fallbacks, latency percentiles.
import { TICK_RATE } from '../../sim/index.ts';
import type { TurnLog } from './general.ts';

export interface TurnStats {
  turns: number;
  fallbacks: { late: number; invalid: number; error: number };
  orders: number;
  rejected: number;
  /** Rejected orders per order received, in percent. */
  invalidPct: number;
  /** Seconds from request to apply, over answered turns (null if none). */
  p50: number | null;
  p95: number | null;
}

export function turnStats(logs: TurnLog[]): TurnStats {
  const fallbacks = { late: 0, invalid: 0, error: 0 };
  for (const t of logs) if (t.fallback) fallbacks[t.fallback]++;
  const rejected = logs.reduce((s, t) => s + t.rejected, 0);
  // A reply that is not even a turn counts as one rejected order.
  const orders = logs.reduce((s, t) => s + t.calls.length + t.rejected, 0);
  const lat = logs.flatMap((t) => (t.latency === null ? [] : [t.latency])).sort((a, b) => a - b);
  const pct = (p: number) => (lat.length === 0 ? null : lat[Math.min(lat.length - 1, Math.ceil((p / 100) * lat.length) - 1)]! / TICK_RATE);
  return {
    turns: logs.length, fallbacks, orders, rejected,
    invalidPct: orders === 0 ? 0 : Math.round((rejected * 1000) / orders) / 10,
    p50: pct(50), p95: pct(95),
  };
}
