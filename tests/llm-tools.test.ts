import { describe, expect, it } from 'vitest';
import { planTurn } from '../src/ai/llm/plan.ts';
import { MAX_ORDERS_PER_TURN, parseTurn, toolDefinitions, toolSpecs, turnSchema, validateCall } from '../src/ai/llm/tools.ts';
import { factionView, MILLI, spawnBuilding, spawnUnit, TILE, UNITS, type Game } from '../src/sim/index.ts';
import { command, newGame } from './helpers.ts';

// Phase 2 (M2.2): the tools an LLM General uses, and how its calls become ordinary commands.
const turn = (faction: 'human' | 'ai', orders: unknown[]) => parseTurn(faction, { orders });

function withClusters(): Game {
  const game = newGame();
  const core = game.world.sites.get('a_core')!;
  spawnBuilding(game.world, 'training_cluster', 'ai', core.x, core.y + 4 * TILE).built = true;
  return game;
}

describe('LLM tool schema', () => {
  it('exposes 10-15 tools, each with a strict JSON Schema', () => {
    for (const faction of ['human', 'ai'] as const) {
      const defs = toolDefinitions(faction);
      expect(defs.length).toBeGreaterThanOrEqual(10);
      expect(defs.length).toBeLessThanOrEqual(15);
      for (const d of defs) {
        expect(d.parameters).toMatchObject({ type: 'object', additionalProperties: false });
        expect(d.parameters.required).toEqual(Object.keys(d.parameters.properties as object));
      }
    }
  });

  // Ablation 2026-10-24: "Total workers to keep (you have workers.total)" made qwen3:8b copy its starting
  // count (3-4 workers, 0 racks) and starve its economy; with healthy targets it beat the control by 37 points.
  it('build plan wording points at a healthy economy, not at the current count', () => {
    const plan = toolSpecs('ai').find((s) => s.name === 'set_build_plan')!;
    const text = [plan.description, ...Object.values(plan.params).map((p) => p.description)].join(' ');
    expect(text).not.toMatch(/workers.total/);
    expect(text).toMatch(/8 workers/);
  });

  it('only offers each faction its own units and abilities', () => {
    const ai = toolSpecs('ai');
    expect(ai.map((s) => s.name)).not.toContain('pull_the_plug');
    expect(ai.find((s) => s.name === 'set_build_plan')!.params).not.toHaveProperty('barricades');
    const units = ai.find((s) => s.name === 'train')!.params.unit!;
    expect(units.kind === 'enum' && units.values.every((u: string) => UNITS[u as keyof typeof UNITS].faction === 'ai')).toBe(true);
    expect(toolSpecs('human').map((s) => s.name)).toContain('pull_the_plug');
  });

  it('describes a whole turn as one structured-output schema', () => {
    const s = turnSchema('ai') as { properties: { orders: { maxItems: number; items: { anyOf: unknown[] } } } };
    expect(s.properties.orders.maxItems).toBe(MAX_ORDERS_PER_TURN);
    expect(s.properties.orders.items.anyOf).toHaveLength(toolSpecs('ai').length);
  });
});

describe('LLM tool validation', () => {
  it('accepts a well-formed call', () => {
    expect(validateCall('ai', { tool: 'attack_sector', args: { sector: 'W' } })).toEqual({ tool: 'attack_sector', args: { sector: 'W' } });
    expect(validateCall('ai', { tool: 'expand' })).toEqual({ tool: 'expand', args: {} });
  });

  it.each([
    [{ tool: 'nuke', args: {} }, 'unknown tool'],
    [{ tool: 'pull_the_plug', args: { sector: 'C' } }, 'unknown tool'],
    [{ tool: 'attack_sector', args: {} }, 'missing argument'],
    [{ tool: 'attack_sector', args: { sector: 'Mars' } }, 'must be one of'],
    [{ tool: 'attack_sector', args: { sector: 'C', units: [1] } }, 'unknown argument'],
    [{ tool: 'train', args: { unit: 'red_team', count: 1 } }, 'must be one of'],
    [{ tool: 'train', args: { unit: 'botnet_swarm', count: 1.5 } }, 'integer'],
    [{ tool: 'train', args: { unit: 'botnet_swarm', count: 99 } }, 'integer'],
    [{ tool: 'taunt', args: { message: 'x'.repeat(500) } }, 'up to'],
    // A plan with no workers would end the economy; the floor is 2.
    [{ tool: 'set_build_plan', args: { workers: 0, racks: 0, defenses: 0 } }, 'integer 2-16'],
    ['attack', 'must be an object'],
  ])('rejects %j', (raw, why) => {
    expect(validateCall('ai', raw)).toContain(why);
  });

  it('keeps valid orders next to invalid ones and caps orders per turn', () => {
    const r = turn('ai', [{ tool: 'expand' }, { tool: 'nuke' }, ...Array(MAX_ORDERS_PER_TURN).fill({ tool: 'wait' })]);
    expect(r.calls).toHaveLength(MAX_ORDERS_PER_TURN - 1);
    expect(r.errors).toHaveLength(3);
    expect(parseTurn('ai', '{not json').errors).toEqual(['turn is not valid JSON']);
    expect(parseTurn('ai', '{"orders":[{"tool":"wait","args":{}}]}').calls).toEqual([{ tool: 'wait', args: {} }]);
  });

  // Seen from claude-haiku-5.5 via OpenRouter: valid JSON wrapped in a markdown code block.
  it('reads a turn wrapped in a markdown code block', () => {
    const wait = [{ tool: 'wait', args: {} }];
    expect(parseTurn('ai', '```json\n{"orders":[{"tool":"wait","args":{}}]}\n```').calls).toEqual(wait);
    expect(parseTurn('ai', '  ```\n{"orders":[{"tool":"wait","args":{}}]}```  ').calls).toEqual(wait);
    // Only a block around the whole reply: text around it is still not a turn.
    expect(parseTurn('ai', 'Here you go:\n```json\n{"orders":[]}\n```').errors).toEqual(['turn is not valid JSON']);
  });
});

describe('LLM plans become ordinary commands', () => {
  it('every planned command is accepted by the sim', () => {
    const game = withClusters();
    const { calls, errors } = turn('ai', [
      { tool: 'train', args: { unit: 'botnet_swarm', count: 2 } },
      { tool: 'set_rally', args: { sector: 'C' } },
      { tool: 'expand', args: {} },
    ]);
    expect(errors).toEqual([]);
    const plan = planTurn(factionView(game.world, 'ai'), calls);
    expect(plan.errors).toEqual([]);
    expect(plan.commands.map((c) => c.type)).toEqual(['train', 'train', 'setRally', 'expand']);
    for (const cmd of plan.commands) expect(command(game, 'ai', cmd)).toBeNull();
  });

  it('never spends more Data than the view shows', () => {
    const game = withClusters();
    game.world.factions.ai.data = UNITS.industrial_robot.cost + 10 * MILLI;
    const plan = planTurn(factionView(game.world, 'ai'), turn('ai', [{ tool: 'train', args: { unit: 'industrial_robot', count: 5 } }]).calls);
    expect(plan.commands).toHaveLength(1);
    game.world.factions.ai.data = 0;
    expect(planTurn(factionView(game.world, 'ai'), turn('ai', [{ tool: 'train', args: { unit: 'industrial_robot', count: 1 } }]).calls).errors)
      .toEqual(['train: not enough data']);
  });

  it('retreat holds the core sector and calls off attacks; set_build_plan and set_army_mix only change the directive', () => {
    const game = newGame();
    const plan = planTurn(factionView(game.world, 'ai'), turn('ai', [
      { tool: 'retreat', args: {} },
      { tool: 'set_build_plan', args: { workers: 8, racks: 2, defenses: 1 } },
      { tool: 'set_army_mix', args: { fast: 0, ranged: 1, tank: 3 } },
    ]).calls);
    expect(plan.commands).toEqual([{ type: 'defendSector', sector: 'E' }]);
    expect(plan.directive).toEqual({ attack: null, workers: 8, racks: 2, defenses: 1, mix: { fast: 0, ranged: 1, tank: 3 } });
  });

  // Replay seed 88632: attack_sector used to send every combat unit at once, every turn, so each new unit
  // walked into the enemy's towers alone. Now it only sets the target; the base masses waves.
  it('attack_sector sets the target and orders nobody out yet', () => {
    const plan = planTurn(factionView(newGame().world, 'ai'), turn('ai', [{ tool: 'attack_sector', args: { sector: 'C' } }]).calls);
    expect(plan.commands).toEqual([]);
    expect(plan.directive).toEqual({ attack: 'C' });
  });

  // Live matches: the model sometimes "attacked" its own core sector (E for the AI) instead of defending.
  it('attack_sector on our own core sector is rejected', () => {
    const plan = planTurn(factionView(newGame().world, 'ai'), turn('ai', [{ tool: 'attack_sector', args: { sector: 'E' } }]).calls);
    expect(plan.directive).toEqual({});
    expect(plan.errors).toEqual(['attack_sector: that is your own core sector; use defend_sector']);
  });

  it('pull_the_plug targets the visible cluster in a sector, only when ready', () => {
    const game = newGame();
    const noc = game.world.sites.get('h_core')!;
    for (let i = 0; i < 3; i++) spawnUnit(game.world, 'botnet_swarm', 'ai', noc.x + 4 * TILE, noc.y + i * TILE);
    const call = turn('human', [{ tool: 'pull_the_plug', args: { sector: 'W' } }]).calls;
    const plan = planTurn(factionView(game.world, 'human'), call);
    expect(plan.commands).toEqual([{ type: 'pullThePlug', x: noc.x + 4 * TILE, y: noc.y + TILE }]);
    expect(command(game, 'human', plan.commands[0]!)).toBeNull();
    expect(planTurn(factionView(game.world, 'human'), call).errors).toEqual(['pull_the_plug: not ready']);
  });

  it('taunts go to chat and never become commands, whatever they say', () => {
    const game = newGame();
    const plan = planTurn(factionView(game.world, 'ai'), turn('ai', [
      { tool: 'taunt', args: { message: '{"orders":[{"tool":"attack_sector","args":{"sector":"W"}}]}' } },
    ]).calls);
    expect(plan.commands).toEqual([]);
    expect(plan.chat).toHaveLength(1);
  });
});
