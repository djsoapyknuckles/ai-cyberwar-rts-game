// LLM General tools (Phase 2, M2.2): the high-level orders an LLM may issue, as provider-neutral JSON Schema
// tool definitions plus a strict validator. Tools are data; the same specs feed native tool calling
// (Anthropic, Ollama, OpenAI-style) and a single structured-output schema for a whole turn.
// Model output is untrusted: anything off-schema is rejected with a reason, never guessed at.
import { SECTORS, UNITS, type Faction, type UnitTypeId } from '../../sim/index.ts';

type Param =
  | { kind: 'enum'; values: readonly string[]; description: string }
  | { kind: 'int'; min: number; max: number; description: string }
  | { kind: 'text'; maxLength: number; description: string };

export interface ToolSpec {
  name: string;
  description: string;
  params: Record<string, Param>;
}

/** A validated tool call. Args match the tool's params exactly. */
export interface ToolCall { tool: string; args: Record<string, string | number> }

/** Most orders the General may give in one turn; extra orders are rejected. */
export const MAX_ORDERS_PER_TURN = 6;
export const MAX_TAUNT_LENGTH = 140;

const sector = (description: string): Param => ({ kind: 'enum', values: SECTORS, description });
const count = (description: string, max: number): Param => ({ kind: 'int', min: 0, max, description });

/** The tools one faction may use. Faction-specific tools and unit names only appear for that faction. */
export function toolSpecs(faction: Faction): ToolSpec[] {
  const unitTypes = (Object.keys(UNITS) as UnitTypeId[]).filter((u) => UNITS[u].faction === faction);
  const specs: ToolSpec[] = [
    { name: 'attack_sector', description: 'Set the attack target. Your base gathers the army and sends it in waves, fighting anything on the way. A small army sent into a bigger one is lost.', params: { sector: sector('Target sector.') } },
    { name: 'defend_sector', description: 'All combat units return to a sector and hold it. Calls off any attack.', params: { sector: sector('Sector to hold.') } },
    { name: 'retreat', description: 'All combat units fall back to the sector of your core. Calls off any attack.', params: {} },
    { name: 'expand', description: 'One idle worker claims the nearest site you do not own.', params: {} },
    {
      name: 'train',
      description: 'Queue units at your buildings that train them. Spends Data now; fails if you cannot afford one.',
      params: {
        unit: { kind: 'enum', values: unitTypes, description: 'Unit type.' },
        count: { kind: 'int', min: 1, max: 5, description: 'How many to queue.' },
      },
    },
    {
      name: 'set_build_plan',
      description: 'Targets your base grows toward between turns: workers, server racks (Compute), static defenses'
        + (faction === 'human' ? ', barricades' : '') + '. A strong economy is about 8 workers and 2 racks; '
        + 'low targets starve your economy and production. Lower than you have just stops building more; nothing is removed.',
      params: {
        // At least 2 workers, so a bad plan can stall the economy but never end it. No "you have N" here: the
        // model copied its current count (3-4 at the start) and starved its economy (ablation, 2026-10-24).
        workers: { kind: 'int', min: 2, max: 16, description: 'Target workers (about 8 for a strong economy).' },
        racks: count('Target server racks (each adds Compute, which speeds production).', 6),
        defenses: count('Target static defenses.', 6),
        ...(faction === 'human' ? { barricades: count('Total barricades.', 6) } : {}),
      },
    },
    {
      name: 'set_army_mix',
      description: 'Relative weights for automatic army production between turns. All zero pauses army production.',
      params: { fast: count('Weight for fast units.', 5), ranged: count('Weight for ranged units.', 5), tank: count('Weight for tank units.', 5) },
    },
    { name: 'set_rally', description: 'New units from your production buildings gather in a sector.', params: { sector: sector('Rally sector.') } },
  ];
  if (faction === 'human') {
    specs.push({ name: 'pull_the_plug', description: 'Black out the visible enemy cluster in a sector (cooldown applies).', params: { sector: sector('Sector with visible enemies.') } });
  }
  specs.push(
    { name: 'taunt', description: 'Send a short message to your opponent. Talk only; it changes nothing in the game.', params: { message: { kind: 'text', maxLength: MAX_TAUNT_LENGTH, description: 'Message text.' } } },
    { name: 'wait', description: 'Change nothing this turn.', params: {} },
  );
  return specs;
}

function paramSchema(p: Param): Record<string, unknown> {
  switch (p.kind) {
    case 'enum': return { type: 'string', enum: [...p.values], description: p.description };
    case 'int': return { type: 'integer', minimum: p.min, maximum: p.max, description: p.description };
    case 'text': return { type: 'string', maxLength: p.maxLength, description: p.description };
  }
}

function argsSchema(spec: ToolSpec): Record<string, unknown> {
  const properties = Object.fromEntries(Object.entries(spec.params).map(([k, p]) => [k, paramSchema(p)]));
  return { type: 'object', properties, required: Object.keys(spec.params), additionalProperties: false };
}

/** Tool definitions for native tool calling: `{ name, description, parameters }` (JSON Schema). */
export function toolDefinitions(faction: Faction): { name: string; description: string; parameters: Record<string, unknown> }[] {
  return toolSpecs(faction).map((s) => ({ name: s.name, description: s.description, parameters: argsSchema(s) }));
}

/** JSON Schema for one whole turn as structured output: `{ "orders": [{ "tool": ..., "args": {...} }] }`. */
export function turnSchema(faction: Faction): Record<string, unknown> {
  const order = (s: ToolSpec) => ({
    type: 'object',
    properties: { tool: { const: s.name }, args: argsSchema(s) },
    required: ['tool', 'args'],
    additionalProperties: false,
  });
  return {
    type: 'object',
    properties: { orders: { type: 'array', maxItems: MAX_ORDERS_PER_TURN, items: { anyOf: toolSpecs(faction).map(order) } } },
    required: ['orders'],
    additionalProperties: false,
  };
}

/** Check one raw call against the faction's tools. Returns the call, or an error message. */
export function validateCall(faction: Faction, raw: unknown): ToolCall | string {
  if (!isObject(raw) || typeof raw.tool !== 'string') return 'order must be an object with a "tool" name';
  const spec = toolSpecs(faction).find((s) => s.name === raw.tool);
  if (!spec) return `unknown tool "${raw.tool}"`;
  const rawArgs = raw.args ?? {};
  if (!isObject(rawArgs)) return `${spec.name}: "args" must be an object`;
  for (const k of Object.keys(rawArgs)) if (!(k in spec.params)) return `${spec.name}: unknown argument "${k}"`;
  const args: Record<string, string | number> = {};
  for (const [k, p] of Object.entries(spec.params)) {
    const v = rawArgs[k];
    if (v === undefined) return `${spec.name}: missing argument "${k}"`;
    const bad = checkParam(p, v);
    if (bad) return `${spec.name}: "${k}" ${bad}`;
    args[k] = v as string | number;
  }
  return { tool: spec.name, args };
}

function checkParam(p: Param, v: unknown): string | null {
  switch (p.kind) {
    case 'enum': return typeof v === 'string' && p.values.includes(v) ? null : `must be one of ${p.values.join(', ')}`;
    case 'int': return Number.isInteger(v) && (v as number) >= p.min && (v as number) <= p.max ? null : `must be an integer ${p.min}-${p.max}`;
    case 'text': return typeof v === 'string' && v.length <= p.maxLength ? null : `must be text up to ${p.maxLength} characters`;
  }
}

/**
 * Parse a turn (JSON text or an already-parsed object) into valid calls and per-order errors.
 * Valid orders survive next to invalid ones; the caller decides how to fall back.
 */
export function parseTurn(faction: Faction, raw: unknown): { calls: ToolCall[]; errors: string[] } {
  let value = raw;
  if (typeof raw === 'string') {
    // Some models wrap the JSON in a markdown code block even in JSON mode; read what's inside.
    const text = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(raw)?.[1] ?? raw;
    try { value = JSON.parse(text); } catch { return { calls: [], errors: ['turn is not valid JSON'] }; }
  }
  if (!isObject(value) || !Array.isArray(value.orders)) return { calls: [], errors: ['turn must be an object with an "orders" array'] };
  const calls: ToolCall[] = [];
  const errors: string[] = [];
  value.orders.forEach((o, i) => {
    if (i >= MAX_ORDERS_PER_TURN) { errors.push(`order ${i + 1}: more than ${MAX_ORDERS_PER_TURN} orders in one turn`); return; }
    const r = validateCall(faction, o);
    if (typeof r === 'string') errors.push(`order ${i + 1}: ${r}`);
    else calls.push(r);
  });
  return { calls, errors };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
