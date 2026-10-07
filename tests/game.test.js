import test from 'node:test';
import assert from 'node:assert/strict';
import { CampaignGame, rollPool, resolveContest, computeDamage, applyTrackDamage, deriveResources, rerollWithWill } from '../src/game.js';
import { WORLD } from '../src/world.js';

const stableRng = () => 0.7;
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function bridgeBattle(options = {}) {
  const game = new CampaignGame({ rng: stableRng, ...options });
  assert.equal(game.moveTo(9, 7).ok, true);
  assert.equal(game.startCombat().ok, true);
  return game;
}

function progressTo(game, id) {
  for (let turn = 0; turn < 20 && game.active?.id !== id && game.state.phase === 'combat'; turn++) {
    if (game.active.team === 'enemy') game.runEnemyTurn();
    else game.endTurn();
  }
  assert.equal(game.active?.id, id);
}

function relocate(game, positions) {
  const saved = game.serialize();
  for (const unit of [...saved.state.party, ...saved.state.enemies]) {
    if (positions[unit.id]) Object.assign(unit, positions[unit.id]);
  }
  const result = game.load(saved);
  assert.equal(result.ok, true, result.reason);
}

test('d10 pools count critical tens as two, ordinary successes as one, and preserve individual dice', () => {
  const values = [0, 0.49, 0.5, 0.89, 0.9];
  const result = rollPool(5, () => values.shift());
  assert.deepEqual(result, { pool: 5, dice: [1, 5, 6, 9, 10], successes: 4 });
  assert.deepEqual(rollPool(0), { pool: 0, dice: [], successes: 0 });
  assert.throws(() => rollPool(-1), RangeError);
  assert.throws(() => rollPool(2.5), RangeError);
  assert.throws(() => rollPool(1, () => 1), RangeError);
});

test('initiator wins ties and superficial margin is distinct from weapon critical damage', () => {
  assert.deepEqual(resolveContest({ successes: 0 }, { successes: 0 }), { hit: true, margin: 0, winner: 'attacker' });
  assert.equal(resolveContest(2, 3).hit, false);
  assert.equal(resolveContest(5, 2).margin, 3);
  assert.deepEqual(computeDamage({ critical: 2, surface: 3, armor: 2 }), { critical: 0, surface: 4, converted: 2, absorbed: 0 });
  // Armor-converted critical damage is NOT divided by two: 2 + ceil(3/2).
  assert.equal(computeDamage({ critical: 3, surface: 1, armor: 2 }).critical, 1);
  assert.equal(computeDamage({ critical: 3, surface: 1, armor: 2 }).surface, 3);
  assert.deepEqual(computeDamage({ critical: 3, surface: 3, armor: 2, soak: 3 }), { critical: 0, surface: 2, converted: 0, absorbed: 3 });
});

test('dual resource tracks apply critical damage first and spill superficial damage into critical', () => {
  const resource = { surface: 4, critical: 0, max: 5 };
  assert.deepEqual(applyTrackDamage(resource, { surface: 3, critical: 1 }), { surface: 5, critical: 3, max: 5 });
  assert.deepEqual(resource, { surface: 4, critical: 0, max: 5 });
  assert.deepEqual(applyTrackDamage(resource, { surface: 20, critical: 20 }), { surface: 5, critical: 5, max: 5 });
  const maxima = deriveResources({ stamina: 2, resolve: 3, composure: 2 }, { chakraControl: 2 });
  assert.equal(maxima.hp.max, 5);
  assert.equal(maxima.chakra.max, 7);
  assert.equal(maxima.will.max, 5);
});

test('exploration paths cross only the bridge and followers remain on distinct walkable cells', () => {
  const game = new CampaignGame({ rng: stableRng });
  assert.equal(game.moveTo(10, 6).ok, false);
  assert.equal(game.moveTo(WORLD.npc.x, WORLD.npc.y).ok, false);
  assert.equal(game.moveTo(17, 5).ok, false); // hostile occupant
  assert.equal(game.moveTo(1.5, 7).ok, false);
  const move = game.moveTo(13, 7);
  assert.equal(move.ok, true);
  assert.ok(move.path.some((cell) => cell.x === 10 && cell.y === 7));
  assert.ok(!move.path.some((cell) => cell.x === 10 && cell.y !== 7));
  const unique = new Set(game.state.party.map(({ x, y }) => `${x},${y}`));
  assert.equal(unique.size, 3);
  for (const unit of game.state.party) {
    assert.ok(!WORLD.blocked.some((cell) => cell.x === unit.x && cell.y === unit.y));
    assert.ok(manhattan(unit, game.selected) <= 3);
  }
});

test('initiative uses dexterity+wits and action economy keeps movement, quick and main independent', () => {
  const game = bridgeBattle();
  assert.deepEqual(game.state.order.slice(0, 3), ['sora', 'ren', 'miyo']);
  assert.equal(game.state.initiative.find(({ id }) => id === 'sora').pool, 6);
  assert.equal(game.active.id, 'sora');
  assert.equal(game.selectUnit('ren'), false);
  assert.equal(game.activate('reaction').ok, true);
  assert.equal(game.active.actions.quick, false);
  assert.equal(game.active.actions.main, true);
  assert.equal(game.active.chakra.surface, 1);
  assert.equal(game.activate('endurance').ok, false);
  assert.equal(game.clone().ok, true);
  assert.equal(game.active.actions.main, false);
  assert.equal(game.active.clones, 1);
  assert.equal(game.defend().ok, false);
  const cell = game.reachableCells().find((candidate) => candidate.cost === 4);
  assert.ok(cell);
  assert.equal(game.moveTo(cell.x, cell.y).ok, true);
  assert.equal(game.active.actions.movement, 0);
  const neighbor = game.reachableCells();
  assert.deepEqual(neighbor, []);
  assert.equal(game.endTurn().ok, true);
  assert.equal(game.active.id, 'ren');
});

test('invalid ranges and targets preserve actions, chakra and positions', () => {
  const game = new CampaignGame({ rng: stableRng });
  game.startCombat();
  const before = game.getSnapshot();
  assert.equal(game.attack('bandit-leader').ok, false);
  assert.equal(game.attack('ren').ok, false);
  assert.equal(game.attack('nonexistent').ok, false);
  assert.equal(game.moveTo(16, 5).ok, false);
  assert.equal(game.heal('ren').ok, false);
  assert.deepEqual(game.state, before);
});

test('clones contribute a defensive die then disappear even when an attack misses', () => {
  const game = new CampaignGame({ rng: stableRng });
  relocate(game, { sora: { x: 9, y: 7 }, ren: { x: 7, y: 8 }, miyo: { x: 7, y: 9 } });
  game.startCombat();
  const original = game.active;
  assert.equal(game.clone().ok, true);
  game.endTurn();
  for (let turn = 0; turn < 10 && original.clones; turn++) {
    if (game.active.team === 'enemy') game.runEnemyTurn();
    else game.endTurn();
  }
  assert.equal(original.clones, 0);
  const attack = game.state.history.find((entry) => entry.defenseDice?.length === 6);
  assert.ok(attack, 'five ordinary Sora dodge dice plus one clone must be rolled');
  assert.ok(attack.text.includes('уклоняется'));
});

test('guard grants two defensive dice until the next own turn, then expires', () => {
  const game = new CampaignGame({ rng: stableRng });
  relocate(game, { sora: { x: 9, y: 7 }, ren: { x: 7, y: 8 }, miyo: { x: 7, y: 9 } });
  game.startCombat();
  assert.equal(game.defend().ok, true);
  const sora = game.active;
  game.endTurn();
  progressTo(game, 'sora');
  assert.equal(game.state.round, 2);
  assert.equal(sora.defending, false);
  assert.ok(game.state.history.some((entry) => entry.defenseDice?.length === 7));
  assert.deepEqual(game.state.order.slice(0, 3), ['sora', 'ren', 'miyo']);
});

test('medic restores only superficial wounds and critical chakra spending consumes equal will', () => {
  const game = bridgeBattle();
  progressTo(game, 'miyo');
  const saved = game.serialize();
  const miyo = saved.state.party.find(({ id }) => id === 'miyo');
  miyo.hp.surface = 2; miyo.hp.critical = 1;
  miyo.chakra.surface = miyo.chakra.max;
  assert.equal(game.load(saved).ok, true);
  const result = game.heal('miyo');
  assert.equal(result.ok, true);
  assert.equal(result.healing, 1);
  assert.equal(game.active.hp.surface, 1);
  assert.equal(game.active.hp.critical, 1);
  assert.equal(game.active.chakra.critical, 1);
  assert.equal(game.active.will.surface, 1);
  assert.equal(game.active.actions.main, false);
});

test('fireball uses hand seals plus jutsu plus matching specialization and can hit adjacent allies', () => {
  let high = false;
  let remainingAttackDice = 0;
  const rng = () => high ? (remainingAttackDice-- > 0 ? 0.99 : 0) : 0.7;
  const game = new CampaignGame({ rng });
  relocate(game, {
    ren: { x: 12, y: 7 }, sora: { x: 14, y: 8 }, miyo: { x: 13, y: 8 },
    'bandit-scout': { x: 14, y: 7 }, 'bandit-blade': { x: 15, y: 7 },
  });
  game.startCombat(); progressTo(game, 'ren');
  high = true; remainingAttackDice = 5;
  const result = game.fireball('bandit-scout');
  assert.equal(result.ok, true);
  assert.equal(result.roll.pool, 5);
  assert.equal(result.roll.successes, 10);
  assert.ok(result.targets.some(({ targetId }) => targetId === 'sora'));
  assert.equal(game.state.party.find(({ id }) => id === 'sora').alive, false);
  assert.equal(game.state.enemies.find(({ id }) => id === 'bandit-scout').alive, false);
  assert.equal(game.state.enemies.find(({ id }) => id === 'bandit-blade').alive, false);
  assert.equal(game.state.party.find(({ id }) => id === 'ren').chakra.surface, 2);
});

test('will rerolls exclude ones and successful dice, cost one will, and update social check success', () => {
  const source = { pool: 5, dice: [1, 2, 5, 6, 10], successes: 3 };
  assert.throws(() => rerollWithWill(source, [0], stableRng), RangeError);
  assert.throws(() => rerollWithWill(source, [3], stableRng), RangeError);
  const rerolled = rerollWithWill(source, [1, 2], () => 0.9);
  assert.deepEqual(rerolled.dice, [1, 10, 10, 6, 10]);
  assert.equal(rerolled.successes, 7);
  let rollingHigh = false;
  const game = new CampaignGame({ rng: () => rollingHigh ? 0.9 : 0.2 });
  const check = game.skillCheck('ren', 'charisma', 'persuasion', 2, { specialization: 'миссии' });
  assert.equal(check.pool, 5);
  assert.equal(check.success, false);
  rollingHigh = true;
  assert.equal(game.spendWillToReroll([0, 1]).ok, true);
  assert.equal(game.state.lastRoll.success, true);
  assert.equal(game.selected.will.surface, 1);
  assert.equal(game.spendWillToReroll([2]).ok, false);
});

test('ordinary player actions and enemy AI complete combat, then only collecting the recovered scroll wins', () => {
  const game = bridgeBattle();
  assert.equal(game.collectScroll().ok, false);
  let enemyTurns = 0;
  for (let turn = 0; turn < 120 && game.state.phase === 'combat'; turn++) {
    if (game.active.team === 'enemy') {
      const before = { x: game.active.x, y: game.active.y };
      const enemy = game.active;
      assert.equal(game.runEnemyTurn().ok, true);
      assert.ok(manhattan(before, enemy) <= 4);
      enemyTurns++;
    } else {
      const target = game.state.enemies.filter(({ alive }) => alive).sort((a, b) => manhattan(game.active, a) - manhattan(game.active, b))[0];
      let result = game.attack(target.id);
      if (!result.ok) {
        const reachable = game.reachableCells().sort((a, b) => manhattan(a, target) - manhattan(b, target));
        if (reachable[0]) game.moveTo(reachable[0].x, reachable[0].y);
        result = game.attack(target.id);
      }
      if (game.state.phase === 'combat') game.endTurn();
    }
  }
  assert.ok(enemyTurns > 0);
  assert.equal(game.state.phase, 'exploration');
  assert.equal(game.state.questStage, 'resolved');
  assert.ok(game.state.enemies.every(({ alive }) => !alive));
  assert.equal(game.moveTo(WORLD.scroll.x, WORLD.scroll.y).ok, true);
  assert.equal(game.collectScroll().ok, true);
  assert.equal(game.state.phase, 'won');
  assert.equal(game.startCombat().ok, false);
  assert.equal(game.moveTo(15, 5).ok, false);
});

test('a decisive enemy attack on the last conscious ally produces loss', () => {
  let lethalRoll = false;
  let attackingDice = 0;
  const rng = () => lethalRoll ? (attackingDice-- > 0 ? 0.99 : 0) : 0.7;
  const game = bridgeBattle({ rng });
  progressTo(game, 'bandit-leader');
  const saved = game.serialize();
  for (const unit of saved.state.party) {
    if (unit.id !== 'ren') { unit.alive = false; unit.hp.critical = unit.hp.max; unit.condition = 'knocked-out'; }
    else { unit.hp.surface = unit.hp.max; unit.hp.critical = unit.hp.max - 1; unit.x = 12; unit.y = 7; }
  }
  saved.state.enemies.find(({ id }) => id === 'bandit-leader').x = 14;
  saved.state.enemies.find(({ id }) => id === 'bandit-leader').y = 7;
  assert.equal(game.load(saved).ok, true);
  lethalRoll = true; attackingDice = 3;
  assert.equal(game.runEnemyTurn().ok, true);
  assert.equal(game.state.phase, 'lost');
  assert.equal(game.state.activeId, null);
  assert.equal(game.collectScroll().ok, false);
  assert.equal(game.attack('bandit-leader').ok, false);
});

test('critical chakra exhaustion advances past the disabled active ally instead of trapping the turn', () => {
  const game = bridgeBattle();
  const saved = game.serialize();
  const sora = saved.state.party.find(({ id }) => id === 'sora');
  sora.chakra.surface = sora.chakra.max;
  sora.chakra.critical = sora.chakra.max - 1;
  assert.equal(game.load(saved).ok, true);
  assert.equal(game.clone().ok, true);
  assert.equal(game.state.party.find(({ id }) => id === 'sora').alive, false);
  assert.equal(game.active.id, 'ren');
});

test('snapshots are independent and saves validate phases, identity, terrain, track caps and turn state', () => {
  const game = bridgeBattle();
  const snapshot = game.getSnapshot();
  snapshot.party[0].hp.surface = 4;
  assert.equal(game.state.party[0].hp.surface, 0);
  const saved = game.serialize();
  const restored = new CampaignGame({ rng: stableRng });
  assert.equal(restored.load(saved).ok, true);
  assert.deepEqual(restored.state.party, game.state.party);
  assert.deepEqual(restored.state.order, game.state.order);
  assert.equal(restored.state.activeId, game.state.activeId);
  const corruptions = [
    (save) => { save.version = 2; },
    (save) => { save.state.party[0].hp.surface = 6; },
    (save) => { save.state.party[0].x = 10; save.state.party[0].y = 6; },
    (save) => { save.state.party[0].id = 'admin'; },
    (save) => { save.state.order[0] = save.state.order[1]; },
    (save) => { save.state.activeId = 'ren'; },
    (save) => { save.state.party[0].actions.movement = 999; },
    (save) => { save.state.party[0].activation.reaction = 10; },
    (save) => { save.state.phase = 'won'; },
  ];
  for (const corrupt of corruptions) {
    const invalid = structuredClone(saved); corrupt(invalid);
    const before = restored.getSnapshot();
    assert.equal(restored.load(invalid).ok, false);
    assert.deepEqual(restored.state, before, 'invalid load must not partially mutate state');
  }
  const injected = structuredClone(saved);
  injected.state.party[0].attributes.dexterity = 10;
  assert.equal(restored.load(injected).ok, true);
  assert.equal(restored.state.party[0].attributes.dexterity, 3);
});

test('peaceful resolution opens the scroll objective, saves reload, and restart resets all campaign state', () => {
  const game = new CampaignGame({ rng: stableRng });
  assert.equal(game.resolvePeacefully().ok, true);
  assert.equal(game.state.phase, 'exploration');
  assert.equal(game.state.questStage, 'resolved');
  assert.equal(game.collectScroll().ok, false);
  assert.equal(game.moveTo(16, 5).ok, true);
  assert.equal(game.collectScroll().ok, true);
  const saved = game.serialize();
  const second = new CampaignGame({ rng: stableRng });
  assert.equal(second.load(saved).ok, true);
  assert.equal(second.state.phase, 'won');
  assert.equal(second.restart().ok, true);
  assert.equal(second.state.phase, 'exploration');
  assert.equal(second.state.questStage, 'meet');
  assert.ok(second.state.enemies.every(({ alive }) => alive));
  assert.ok(second.state.party.every((unit) => unit.hp.surface === 0 && unit.hp.critical === 0 && unit.chakra.surface === 0));
  assert.equal(second.state.activeId, null);
});
