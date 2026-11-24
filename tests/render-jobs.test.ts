import { describe, expect, it } from 'vitest';
import { ECONOMY, factionView, type Game, type UnitView } from '../src/sim/index.ts';
import { jobText, sourceWarnings, workforce } from '../src/render/jobs.ts';
import { linkIndex, newGame, run, workersOf } from './helpers.ts';

// The text players read to understand their economy (JOURNAL 2026-10-27). These helpers are pure
// functions of a FactionView, so a sim change that alters a job or a source issue shows up here.

/** The human's worker units in the sim, so tests can give them orders. */
function workers(game: Game) {
  return workersOf(game, 'human').map((id) => {
    const u = game.world.entities.get(id)!;
    if (u.kind !== 'unit') throw new Error('not a unit');
    return u;
  });
}

function viewOf(game: Game, id: number): { view: ReturnType<typeof factionView>; unit: UnitView } {
  const view = factionView(game.world, 'human');
  return { view, unit: view.units.find((u) => u.id === id)! };
}

describe('jobText', () => {
  it('an idle worker reads "Idle"', () => {
    const game = newGame();
    const [w] = workers(game);
    const { view, unit } = viewOf(game, w!.id);
    expect(jobText(unit, view)).toBe('<span class="warn">Idle</span>');
  });

  it('a worker on its way to a claim says where it is going', () => {
    const game = newGame();
    const [w] = workers(game);
    w!.order = { type: 'claim', site: 'mid_src_n' };
    const { view, unit } = viewOf(game, w!.id);
    expect(jobText(unit, view)).toBe('Walking to work: Claiming Data Source');
  });

  it('a worker claiming a site shows its progress and seconds left', () => {
    const game = newGame();
    const [w] = workers(game);
    const site = game.world.sites.get('mid_src_n')!;
    w!.x = site.x; w!.y = site.y;
    w!.order = { type: 'claim', site: 'mid_src_n' };
    run(game, 40);
    const { view, unit } = viewOf(game, w!.id);
    const pct = Math.trunc((100 * 40) / ECONOMY.claimTicks);
    const secs = Math.ceil((ECONOMY.claimTicks - 40) / 20);
    expect(jobText(unit, view)).toBe(`Claiming Data Source: <b>${pct}%</b> · ${secs}s`);
  });

  it('a worker lighting a link shows fiber progress', () => {
    const game = newGame();
    const [w] = workers(game);
    w!.order = { type: 'lightLink', link: linkIndex(game, 'h_core', 'h_router') };
    run(game, 30);
    const { view, unit } = viewOf(game, w!.id);
    const job = unit.job!;
    expect(job).toMatchObject({ kind: 'link', working: true });
    expect(job.progress).toBeGreaterThan(0);
    expect(jobText(unit, view)).toBe(`Connecting fiber: <b>${job.progress}%</b> · ${job.seconds}s`);
  });
});

describe('workforce', () => {
  it('a fresh start has every worker idle', () => {
    const game = newGame();
    const n = workers(game).length;
    expect(workforce(factionView(game.world, 'human'))).toBe(`<b class="warn">${n} idle</b>`);
  });

  it('counts busy workers by job and keeps idle ones flagged', () => {
    const game = newGame();
    const [w1, w2] = workers(game);
    w1!.order = { type: 'lightLink', link: linkIndex(game, 'h_core', 'h_router') };
    w2!.order = { type: 'claim', site: 'mid_src_n' };
    run(game, 30);
    expect(workforce(factionView(game.world, 'human'))).toBe('1 connecting fiber · 1 walking · <b class="warn">1 idle</b>');
  });
});

describe('sourceWarnings', () => {
  /** Claim the home north Data source; optionally light the fiber from it to the core. */
  function claimHomeSource(connect: boolean): Game {
    const game = newGame();
    const [w1, w2, w3] = workers(game);
    const site = game.world.sites.get('h_src_n')!;
    w3!.x = site.x; w3!.y = site.y;
    w3!.order = { type: 'claim', site: 'h_src_n' };
    if (connect) {
      w1!.order = { type: 'lightLink', link: linkIndex(game, 'h_core', 'h_router') };
      w2!.order = { type: 'lightLink', link: linkIndex(game, 'h_router', 'h_src_n') };
    }
    run(game, 300);
    expect(game.world.sites.get('h_src_n')!.owner).toBe('human');
    return game;
  }

  it('warns about a claimed site with no fiber', () => {
    const view = factionView(claimHomeSource(false).world, 'human');
    expect(sourceWarnings(view)).toEqual([
      '<b class="warn">⚠ Home Data Source</b> not feeding your base: no fiber connected. Light the link from it toward your base.',
    ]);
  });

  it('says nothing about a site whose fiber reaches the base', () => {
    const view = factionView(claimHomeSource(true).world, 'human');
    expect(view.sites.find((s) => s.id === 'h_src_n')!.issue).toBeNull();
    expect(sourceWarnings(view)).toEqual([]);
  });
});
