import { createParty } from './characters.js';
import { WORLD, getWorld } from './world.js';
import { createHero, resourcesFor } from './creator.js';

// Naruto Diamond 0.6, pp. «Базовые понятия» / «Боевая сцена».
// Grid movement, weapon ranges, stable initiative ties and cloth protection
// against weapons are explicit computer-game adaptations; see rules-scope.md.
export const RANGES = Object.freeze({ kunai: 6, shuriken: 6, melee: 1, unarmed: 1, fireball: 5, heal: 1 });
const MOVEMENT = 4;
const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const copy = (value) => structuredClone(value);
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const cellKey = (x, y) => `${x},${y}`;
const track = (max) => ({ surface: 0, critical: 0, max });
const actions = () => ({ main: true, quick: true, reaction: true, movement: MOVEMENT });
const successValue = (die) => die === 10 ? 2 : die >= 6 ? 1 : 0;

/** 1–5 fail, 6–9 yield one success, 10 yields two (source line 1385). */
export function rollPool(pool, rng = Math.random) {
  if (!Number.isInteger(pool) || pool < 0 || pool > 100) throw new RangeError('Invalid d10 pool');
  const dice = Array.from({ length: pool }, () => {
    const value = rng();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('RNG must return [0, 1)');
    return 1 + Math.floor(value * 10);
  });
  return { pool, dice, successes: dice.reduce((sum, die) => sum + successValue(die), 0) };
}

/** Ties go to the initiator, including zero-to-zero weapon contests. */
export function resolveContest(attack, defense) {
  const attackSuccesses = typeof attack === 'number' ? attack : attack.successes;
  const defenseSuccesses = typeof defense === 'number' ? defense : defense.successes;
  return {
    hit: attackSuccesses >= defenseSuccesses,
    margin: Math.max(0, attackSuccesses - defenseSuccesses),
    winner: attackSuccesses >= defenseSuccesses ? 'attacker' : 'defender',
  };
}

/**
 * Weapon damage and success-margin damage are separate. Armor converts some
 * weapon critical damage to superficial damage WITHOUT halving that conversion
 * (1386, 1418, 1426). Endurance absorbs raw damage before ordinary halving.
 */
export function computeDamage({ critical = 0, surface = 0, armor = 0, soak = 0, undividedSurface = 0 } = {}) {
  let remainingCritical = Math.max(0, critical);
  let converted = Math.min(Math.max(0, armor), remainingCritical);
  remainingCritical -= converted;
  let rawSurface = Math.max(0, surface);
  let rawUndivided = Math.max(0, undividedSurface);
  let remainingSoak = Math.max(0, soak);
  const absorption = (amount) => {
    const absorbed = Math.min(amount, remainingSoak);
    remainingSoak -= absorbed;
    return amount - absorbed;
  };
  remainingCritical = absorption(remainingCritical);
  converted = absorption(converted);
  rawUndivided = absorption(rawUndivided);
  rawSurface = absorption(rawSurface);
  return {
    critical: remainingCritical,
    surface: converted + rawUndivided + Math.ceil(rawSurface / 2),
    converted,
    absorbed: Math.max(0, soak) - remainingSoak,
  };
}

export function deriveResources(attributes, skills, clan = 'clanless') {
  return resourcesFor(attributes, skills, clan);
}

/** All counters mean damage/spending, not remaining points. */
export function applyTrackDamage(resource, { surface = 0, critical = 0 } = {}) {
  const result = { ...resource };
  result.critical = Math.min(result.max, result.critical + Math.max(0, critical));
  const totalSurface = result.surface + Math.max(0, surface);
  result.surface = Math.min(result.max, totalSurface);
  result.critical = Math.min(result.max, result.critical + Math.max(0, totalSurface - result.max));
  return result;
}

/** Will can reroll up to three failed dice, except ones (source line 1395). */
export function rerollWithWill(roll, indices, rng = Math.random) {
  const chosen = [...new Set(indices)];
  if (!chosen.length || chosen.length > 3 || chosen.some((index) =>
    !Number.isInteger(index) || index < 0 || index >= roll.dice.length ||
    roll.dice[index] === 1 || roll.dice[index] >= 6)) {
    throw new RangeError('Select one to three failed dice other than ones');
  }
  const dice = [...roll.dice];
  const replacements = rollPool(chosen.length, rng).dice;
  chosen.forEach((index, position) => { dice[index] = replacements[position]; });
  return { ...roll, dice, successes: dice.reduce((sum, die) => sum + successValue(die), 0), rerolled: chosen };
}

function makeBandits(worldId = 'forest') {
  return [
    { id: 'bandit-scout', name: 'Дозорный', role: 'Разбойник · метатель', x: 14, y: 6, weapon: 'shuriken', color: '#cb8158' },
    { id: 'bandit-blade', name: 'Старый клинок', role: 'Разбойник · ближний бой', x: 16, y: 8, weapon: 'melee', color: '#b06a61' },
    { id: 'bandit-leader', name: 'Каэда', role: 'Отступница · кунай', x: 17, y: 5, weapon: 'kunai', color: '#b99461' },
  ].map((preset) => {
    const attributes = { strength: 2, dexterity: 2, stamina: 1, charisma: 1, manipulation: 1, composure: 1, intelligence: 1, wits: 1, resolve: 1 };
    const skills = { athletics: 1, brawl: 1, melee: 1, shooting: 1, chakraControl: 0, awareness: 1 };
    if (worldId === 'archive' && preset.id === 'bandit-leader') { attributes.stamina = 3; attributes.dexterity = 3; }
    return {
      ...preset, ...(worldId === 'ruins' ? {name: { 'bandit-scout': 'Страж руин', 'bandit-blade': 'Наёмник', 'bandit-leader': 'Сэйдзи' }[preset.id]} : worldId === 'archive' ? {name: { 'bandit-scout': 'Хранитель', 'bandit-blade': 'Тень архива', 'bandit-leader': 'Куро' }[preset.id]} : {}), team: 'enemy', attributes, skills, specializations: [], jutsu: {},
      ...deriveResources(attributes, skills), armor: 0, alive: true,
      actions: actions(), defending: false, clones: 0, barrierHealth: 0,
      activation: { reaction: 0, strength: 0, endurance: 0 }, activationLevels: {},
    };
  });
}

export class CampaignGame {
  constructor({ onChange = () => {}, onUpdate, rng = Math.random, hero = null, world = WORLD } = {}) {
    this.onChange = onUpdate || onChange;
    this.rng = rng;
    this.world = getWorld(world.id);
    this.heroSpec = hero ? copy(hero) : null;
    if (this.heroSpec) createHero(this.heroSpec);
    this.blocked = new Set(this.world.blocked.map(({ x, y }) => cellKey(x, y)));
    this._lastSkillRoll = null;
    this.restart();
  }

  get selected() { return this.state.party.find((unit) => unit.id === this.state.selectedId) || null; }
  get active() { return this.allUnits.find((unit) => unit.id === this.state.activeId) || null; }
  get allUnits() { return [...this.state.party, ...this.state.enemies]; }
  getSnapshot() { return copy(this.state); }
  notify() { this.onChange(this.getSnapshot()); }

  serialize() { return { version: 1, worldId: this.world.id, hero: copy(this.heroSpec), state: this.getSnapshot() }; }

  _partyPresets() {
    const party = createParty();
    if (this.heroSpec) party[0] = createHero(this.heroSpec);
    return party;
  }

  load(data) {
    // Rebuild immutable character/rule data from presets. A save may restore
    // progress, but cannot grant attributes, skills, equipment or extra units.
    const previous = {world:this.world, hero:this.heroSpec, blocked:this.blocked};
    try {
      if (!data || data.version !== 1 || !data.state || typeof data.state !== 'object') throw new Error('Неизвестный формат сохранения.');
      const nextWorld = getWorld(data.worldId || 'forest');
      const nextHero = data.hero ? copy(data.hero) : null;
      if (nextHero) createHero(nextHero);
      this.world = nextWorld; this.heroSpec = nextHero;
      this.blocked = new Set(nextWorld.blocked.map(({x,y}) => cellKey(x,y)));
      const saved = data.state;
      if (!['exploration', 'combat', 'won', 'lost'].includes(saved.phase) ||
          !['meet', 'crossing', 'resolved'].includes(saved.questStage)) throw new Error('Некорректный этап миссии.');
      if (!Array.isArray(saved.party) || !Array.isArray(saved.enemies) || saved.party.length !== 3 || saved.enemies.length !== 3) throw new Error('Некорректный состав отряда.');
      const canonicalParty = this._partyPresets();
      const canonicalEnemies = makeBandits(this.world.id);
      const positions = new Set();
      const restore = (units, presets, team) => presets.map((preset) => {
        const matches = units.filter((unit) => unit?.id === preset.id);
        if (matches.length !== 1) throw new Error('Неизвестные или повторяющиеся персонажи.');
        const savedUnit = matches[0];
        const resources = deriveResources(preset.attributes, preset.skills, preset.clanId);
        if (typeof savedUnit.alive !== 'boolean' || !Number.isInteger(savedUnit.x) || !Number.isInteger(savedUnit.y) ||
            savedUnit.x < 0 || savedUnit.y < 0 || savedUnit.x >= this.world.width || savedUnit.y >= this.world.height ||
            this.blocked.has(cellKey(savedUnit.x, savedUnit.y)) ||
            (this.world.npc.x === savedUnit.x && this.world.npc.y === savedUnit.y)) throw new Error('Некорректная позиция персонажа.');
        const key = cellKey(savedUnit.x, savedUnit.y);
        if (savedUnit.alive && positions.has(key)) throw new Error('Два персонажа занимают одну клетку.');
        if (savedUnit.alive) positions.add(key);
        for (const name of ['hp', 'chakra', 'will']) {
          const value = savedUnit[name]; const max = resources[name].max;
          if (!value || value.max !== max || !Number.isInteger(value.surface) || !Number.isInteger(value.critical) ||
              value.surface < 0 || value.surface > max || value.critical < 0 || value.critical > max) throw new Error('Некорректная шкала ресурсов.');
          resources[name] = { surface: value.surface, critical: value.critical, max };
          if (savedUnit.alive && value.critical >= max) throw new Error('Персонаж с исчерпанным ресурсом не может действовать.');
        }
        const turnActions = savedUnit.actions;
        if (!turnActions || ['main', 'quick', 'reaction'].some((name) => typeof turnActions[name] !== 'boolean') ||
            !Number.isInteger(turnActions.movement) || turnActions.movement < 0 || turnActions.movement > MOVEMENT) throw new Error('Некорректные действия персонажа.');
        const activation = savedUnit.activation;
        if (!activation || ['reaction', 'strength', 'endurance'].some((name) =>
          !Number.isInteger(activation[name]) || activation[name] < 0 ||
          activation[name] > Math.min(preset.activationLevels?.[name] || 0, preset.skills.chakraControl || 0))) throw new Error('Некорректная активация чакры.');
        if (!Number.isInteger(savedUnit.clones) || savedUnit.clones < 0 || savedUnit.clones > (preset.jutsu.clone || 0) ||
            typeof savedUnit.defending !== 'boolean') throw new Error('Некорректное защитное состояние.');
        return { ...copy(preset), ...resources, team, barrierHealth: Number.isInteger(savedUnit.barrierHealth) && savedUnit.barrierHealth >= 0 && savedUnit.barrierHealth <= (preset.jutsu?.barrier || 0) ? savedUnit.barrierHealth : 0, x: savedUnit.x, y: savedUnit.y, alive: savedUnit.alive,
          ...(['knocked-out', 'chakra-exhausted', 'unconscious', 'fled'].includes(savedUnit.condition) ? { condition: savedUnit.condition } : {}),
          actions: { ...turnActions }, activation: { ...activation },
          activationLevels: { ...preset.activationLevels }, clones: savedUnit.clones, defending: savedUnit.defending };
      });
      const party = restore(saved.party, canonicalParty, 'ally');
      const enemies = restore(saved.enemies, canonicalEnemies, 'enemy');
      const allUnits = [...party, ...enemies];
      const ids = new Set(allUnits.map(({ id }) => id));
      if (!party.some(({ id }) => id === saved.selectedId) || !Array.isArray(saved.order) ||
          new Set(saved.order).size !== saved.order.length || saved.order.some((id) => !ids.has(id)) ||
          !Number.isInteger(saved.round) || saved.round < 0 || saved.round > 100000 ||
          !Number.isInteger(saved.turnIndex) || saved.turnIndex < 0 || saved.turnIndex >= Math.max(1, saved.order.length) ||
          typeof saved.advantage !== 'boolean') throw new Error('Некорректная очерёдность ходов.');
      const livingAllies = party.some(({ alive }) => alive);
      const livingEnemies = enemies.some(({ alive }) => alive);
      if (saved.phase === 'combat' && (saved.order.length !== 6 || saved.round < 1 ||
          saved.order[saved.turnIndex] !== saved.activeId || !allUnits.some((unit) => unit.id === saved.activeId && unit.alive) ||
          !livingAllies || !livingEnemies || saved.questStage !== 'crossing')) throw new Error('Некорректное боевое сохранение.');
      if (saved.phase !== 'combat' && saved.activeId !== null) throw new Error('Вне боя нет активного хода.');
      if (saved.phase === 'lost' && livingAllies) throw new Error('Некорректный исход миссии.');
      if (saved.phase === 'won' && (!livingAllies || livingEnemies || saved.questStage !== 'resolved')) throw new Error('Некорректная победа.');
      if (saved.questStage === 'resolved' && livingEnemies) throw new Error('Столкновение ещё не решено.');
      if (saved.phase === 'exploration' && !livingAllies) throw new Error('Отряд больше не может путешествовать.');
      if (saved.phase === 'combat' && allUnits.find(({ id }) => id === saved.activeId).team === 'ally' && saved.selectedId !== saved.activeId) throw new Error('В бою выбран персонаж не своего хода.');
      const safeLog = (entries, max) => Array.isArray(entries) ? entries.slice(-max).filter((entry) => entry && typeof entry.text === 'string').map((entry) =>
        ({ text: entry.text.slice(0, 1000), kind: typeof entry.kind === 'string' ? entry.kind.slice(0, 30) : 'info',
          ...(Array.isArray(entry.dice) ? { dice: entry.dice.filter((die) => Number.isInteger(die) && die >= 1 && die <= 10).slice(0, 100) } : {}),
          ...(Number.isFinite(entry.successes) ? { successes: Math.max(0, Math.min(200, entry.successes)) } : {}) })) : [];
      this.state = {
        worldId: this.world.id, phase: saved.phase, questStage: saved.questStage, party, enemies,
        selectedId: saved.selectedId, activeId: saved.activeId, round: saved.round,
        order: [...saved.order], turnIndex: saved.turnIndex, advantage: saved.advantage,
        log: safeLog(saved.log, 100), history: safeLog(saved.history, 500),
        initiative: [], lastRoll: null, lastMove: null,
      };
      this._lastSkillRoll = null; this.notify(); return { ok: true };
    } catch (error) { this.world=previous.world;this.heroSpec=previous.hero;this.blocked=previous.blocked;return this._fail(error.message || 'Сохранение повреждено.'); }
  }

  restart() {
    const starts = [{ x: 3, y: 7 }, { x: 2, y: 8 }, { x: 3, y: 9 }];
    const party = this._partyPresets().map((preset, index) => ({
      ...preset, ...starts[index], team: 'ally', alive: true, armor: preset.armor ?? 2,
      ...deriveResources(preset.attributes, preset.skills, preset.clanId),
      actions: actions(), defending: false, clones: 0, barrierHealth: 0,
      activation: { reaction: 0, strength: 0, endurance: 0 },
      activationLevels: { ...preset.activationLevels },
    }));
    this.state = {
      worldId: this.world.id, phase: 'exploration', party, enemies: makeBandits(this.world.id), selectedId: party[0].id,
      round: 0, order: [], initiative: [], turnIndex: 0, activeId: null,
      log: [], questStage: 'meet', history: [], lastRoll: null, lastMove: null,
      advantage: false,
    };
    this._lastSkillRoll = null;
    this._log('Отряд у старого моста. Найдите проводника и верните пропавший свиток.', 'story');
    this.notify();
    return { ok: true };
  }

  _log(text, kind = 'info', extra = {}) {
    const entry = { text, kind, ...extra };
    this.state.log.push(entry);
    if (this.state.log.length > 100) this.state.log.shift();
    this.state.history.push(entry);
    if (this.state.history.length > 500) this.state.history.shift();
  }

  _fail(reason) { return { ok: false, reason }; }

  selectUnit(id) {
    const unit = this.state.party.find((candidate) => candidate.id === id && candidate.alive);
    if (!unit || (this.state.phase === 'combat' && this.state.activeId !== id)) return false;
    this.state.selectedId = id;
    this.notify();
    return true;
  }

  _occupied(x, y, exceptId) {
    return this.allUnits.some((unit) => unit.alive && unit.id !== exceptId && unit.x === x && unit.y === y) ||
      (this.world.npc.x === x && this.world.npc.y === y);
  }

  _walkable(x, y, exceptId) {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 &&
      x < this.world.width && y < this.world.height && !this.blocked.has(cellKey(x, y)) && !this._occupied(x, y, exceptId);
  }

  findPath(unit, x, y) {
    if (!this._walkable(x, y, unit.id)) return null;
    if (unit.x === x && unit.y === y) return [];
    const start = cellKey(unit.x, unit.y);
    const target = cellKey(x, y);
    const queue = [{ x: unit.x, y: unit.y }];
    const previous = new Map([[start, null]]);
    for (let index = 0; index < queue.length; index++) {
      const cell = queue[index];
      for (const [dx, dy] of DIRECTIONS) {
        const next = { x: cell.x + dx, y: cell.y + dy };
        const key = cellKey(next.x, next.y);
        if (previous.has(key) || !this._walkable(next.x, next.y, unit.id)) continue;
        previous.set(key, cell);
        if (key === target) {
          const path = [next];
          let cursor = cell;
          while (cellKey(cursor.x, cursor.y) !== start) {
            path.push(cursor);
            cursor = previous.get(cellKey(cursor.x, cursor.y));
          }
          return path.reverse();
        }
        queue.push(next);
      }
    }
    return null;
  }

  // Public preview has no side effects, allowing the map to show legal steps.
  reachableCells(unit = this.selected) {
    if (!unit?.alive || ['won', 'lost'].includes(this.state.phase)) return [];
    const budget = this.state.phase === 'combat' ? unit.actions.movement : this.world.width * this.world.height;
    const queue = [{ x: unit.x, y: unit.y, cost: 0 }];
    const seen = new Set([cellKey(unit.x, unit.y)]);
    for (let index = 0; index < queue.length; index++) {
      const cell = queue[index];
      if (cell.cost >= budget) continue;
      for (const [dx, dy] of DIRECTIONS) {
        const x = cell.x + dx; const y = cell.y + dy; const key = cellKey(x, y);
        if (seen.has(key) || !this._walkable(x, y, unit.id)) continue;
        seen.add(key); queue.push({ x, y, cost: cell.cost + 1 });
      }
    }
    return queue.slice(1);
  }

  moveTo(x, y) {
    const unit = this.selected;
    if (!unit?.alive || !['exploration', 'combat'].includes(this.state.phase)) return this._fail('Сейчас нельзя перемещаться.');
    if (unit.barrierHealth) return this._fail('Во время поддержания барьера нельзя двигаться.');
    if (this.state.phase === 'combat' && unit.id !== this.state.activeId) return this._fail('Сейчас ход противника.');
    const path = this.findPath(unit, x, y);
    if (!path) return this._fail('Путь перекрыт или клетка занята.');
    if (!path.length) return this._fail('Персонаж уже на этой клетке.');
    if (this.state.phase === 'combat' && path.length > unit.actions.movement) return this._fail('Не хватает движения. За ход доступны четыре клетки.');
    const oldPosition = { x: unit.x, y: unit.y };
    unit.x = x; unit.y = y;
    this.state.lastMove = { unitId: unit.id, path: [oldPosition, ...path] };
    if (this.state.phase === 'combat') unit.actions.movement -= path.length;
    else this._followParty(unit, oldPosition);
    this.notify();
    return { ok: true, path };
  }

  _followParty(leader) {
    // Followers traverse legal paths to distinct cells near the leader. They
    // cannot cross the river, trees, NPC or hostile occupants by teleporting.
    for (const follower of this.state.party.filter((unit) => unit.alive && unit.id !== leader.id)) {
      const candidates = [];
      for (let radius = 1; radius <= 3; radius++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const dy = radius - Math.abs(dx);
          candidates.push({ x: leader.x + dx, y: leader.y + dy });
          if (dy) candidates.push({ x: leader.x + dx, y: leader.y - dy });
        }
      }
      for (const candidate of candidates) {
        const path = this.findPath(follower, candidate.x, candidate.y);
        if (path) { follower.x = candidate.x; follower.y = candidate.y; break; }
      }
    }
  }

  startCombat({ advantage = false } = {}) {
    if (this.state.phase !== 'exploration' || this.state.questStage === 'resolved') return this._fail('Сражение сейчас недоступно.');
    this.state.phase = 'combat'; this.state.questStage = 'crossing'; this.state.round = 1;
    this.state.advantage = Boolean(advantage);
    this.state.initiative = this.allUnits.filter((unit) => unit.alive).map((unit) => {
      const roll = rollPool(unit.attributes.dexterity + unit.attributes.wits, this.rng);
      return { id: unit.id, dexterity: unit.attributes.dexterity, ...roll };
    }).sort((a, b) => b.successes - a.successes || b.dexterity - a.dexterity || a.id.localeCompare(b.id));
    this.state.order = this.state.initiative.map(({ id }) => id);
    this.state.turnIndex = 0;
    this.allUnits.forEach((unit) => { unit.actions = actions(); unit.defending = false; });
    this._log(advantage ? 'Засада удалась: в первом раунде враги не могут уклоняться от атак отряда.' : 'Разбойники обнажают оружие. Начинается сражение.', 'combat');
    this._beginTurn();
    this.notify();
    return { ok: true, initiative: copy(this.state.initiative) };
  }

  _beginTurn() {
    const id = this.state.order[this.state.turnIndex];
    const unit = this.allUnits.find((candidate) => candidate.id === id);
    this.state.activeId = id;
    unit.actions = { ...actions(), reaction: unit.actions.reaction };
    unit.defending = false; unit.barrierHealth = 0;
    if (unit.team === 'ally') this.state.selectedId = id;
    this._log(`Ход: ${unit.name}.`, unit.team === 'ally' ? 'turn' : 'enemy');
  }

  _actor(needMain = true) {
    if (this.state.phase !== 'combat' || !this.active?.alive || this.active.team !== 'ally') return { error: 'Дождитесь хода своего персонажа.' };
    if (needMain && !this.active.actions.main) return { error: 'Основное действие уже использовано.' };
    return { unit: this.active };
  }

  _specialization(unit, skill, context) {
    const entries = unit.specializations || [];
    const matching = Array.isArray(entries) ? entries : Object.entries(entries).map(([key, name]) => ({ skill: key, name }));
    return matching.some((entry) => {
      if (typeof entry === 'string') return entry === skill || entry === context;
      return entry.skill === skill && (context === true || !context ||
        String(entry.name || entry.label || '').toLowerCase().includes(String(context).toLowerCase()) || entry.context === context);
    }) ? 1 : 0;
  }

  _pool(unit, attribute, skill, context) {
    const bonus = attribute === 'dexterity' ? unit.activation.reaction : attribute === 'strength' ? unit.activation.strength : 0;
    return (unit.attributes[attribute] || 0) + (unit.skills[skill] || 0) + bonus + this._specialization(unit, skill, context);
  }

  _lineOfSight(from, to) {
    // Grid Bresenham: walls/trees block missiles; water does not.
    let x = from.x; let y = from.y;
    const dx = Math.abs(to.x - x); const dy = Math.abs(to.y - y);
    const sx = x < to.x ? 1 : -1; const sy = y < to.y ? 1 : -1;
    let error = dx - dy;
    while (x !== to.x || y !== to.y) {
      const twice = error * 2;
      if (twice > -dy) { error -= dy; x += sx; }
      if (twice < dx) { error += dx; y += sy; }
      const terrain = this.world.tiles?.[y]?.[x];
      if (this.blocked.has(cellKey(x, y)) && terrain !== 'water' && terrain !== 'river') return false;
    }
    return true;
  }

  _attackAllowed(unit, target, kind) {
    if (!target?.alive || target.team === unit.team) return 'Выберите живого противника.';
    if (!(kind in RANGES) || !['kunai', 'shuriken', 'melee', 'unarmed'].includes(kind)) return 'Неизвестная атака.';
    if (distance(unit, target) > RANGES[kind]) return 'Цель слишком далеко.';
    if (RANGES[kind] > 1 && !this._lineOfSight(unit, target)) return 'Линия атаки перекрыта деревом или стеной.';
    return null;
  }

  attack(targetId, kind = 'kunai') {
    const actor = this._actor();
    if (actor.error) return this._fail(actor.error);
    const target = this.allUnits.find((unit) => unit.id === targetId);
    const error = this._attackAllowed(actor.unit, target, kind);
    if (error) return this._fail(error);
    const result = this._attackUnit(actor.unit, target, kind);
    this._settleAction(); this.notify();
    return { ok: true, ...result };
  }

  _dodge(unit) {
    const pool = this._pool(unit, 'dexterity', 'athletics', 'уклонение') + (unit.defending ? 2 : 0) + unit.clones;
    const roll = rollPool(pool, this.rng);
    if (unit.clones > 0) unit.clones--;
    return roll;
  }

  _soak(unit) {
    if (!unit.activation.endurance) return { dice: [], successes: 0, pool: 0 };
    // The activation permits up to its level of Stamina dice, rather than
    // passively adding unrolled armor (source line 99).
    return rollPool(Math.min(unit.attributes.stamina, unit.activation.endurance), this.rng);
  }

  _attackUnit(unit, target, kind) {
    const style = kind === 'unarmed' ? ['strength', 'brawl', 'рукопашный'] :
      kind === 'melee' ? ['dexterity', 'melee', 'кунай'] : ['dexterity', 'shooting', kind === 'shuriken' ? 'сюрикен' : 'кунай'];
    const attack = rollPool(this._pool(unit, ...style), this.rng);
    const surprise = this.state.advantage && this.state.round === 1 && unit.team === 'ally';
    const defense = surprise ? { dice: [], successes: 1, pool: 0 } : this._dodge(target);
    const contest = resolveContest(attack, defense);
    const soak = contest.hit ? this._soak(target) : { dice: [], successes: 0 };
    const damage = contest.hit ? computeDamage({
      critical: kind === 'unarmed' ? 0 : kind === 'shuriken' ? 1 : 2,
      surface: contest.margin, armor: target.armor, soak: soak.successes,
    }) : { critical: 0, surface: 0, converted: 0, absorbed: 0 };
    unit.actions.main = false;
    if (contest.hit) this._damage(target, damage);
    const label = kind === 'unarmed' ? 'Рукопашный удар' : kind === 'shuriken' ? 'Сюрикен' : kind === 'melee' ? 'Удар кунаем' : 'Бросок куная';
    const roll = { label, kind: 'attack', unitId: unit.id, targetId: target.id, ...attack,
      defenseDice: defense.dice, defenseSuccesses: defense.successes, soakDice: soak.dice,
      hit: contest.hit, damage, surprise };
    this.state.lastRoll = roll; this._lastSkillRoll = null;
    this._log(`${unit.name}: ${label.toLowerCase()} → ${target.name}. ${contest.hit ? `Урон: ${damage.surface} поверхностный, ${damage.critical} критический.` : 'Цель уклоняется.'}`,
      contest.hit ? 'damage' : 'miss', { dice: attack.dice, successes: attack.successes, defenseDice: defense.dice, defenseSuccesses: defense.successes });
    return { roll: copy(roll), damage };
  }

  _damage(unit, damage) {
    if (unit.barrierHealth) {
      const force = damage.critical + Math.ceil(damage.surface / 2);
      if (force <= unit.barrierHealth) { this._log(`${unit.name}: барьер поглощает атаку.`, 'defend'); return; }
      unit.barrierHealth = 0; this._log(`${unit.name}: барьер разрушен.`, 'damage');
    }
    unit.hp = applyTrackDamage(unit.hp, damage);
    if (unit.hp.critical >= unit.hp.max) {
      unit.alive = false; unit.condition = 'knocked-out';
      this._log(`${unit.name} теряет сознание. Все удары в этой миссии нелетальные.`, 'knockout');
    }
  }

  _canSpendChakra(unit, amount) {
    const criticalCost = Math.max(0, unit.chakra.surface + amount - unit.chakra.max);
    if (unit.chakra.critical + criticalCost > unit.chakra.max) return false;
    return unit.will.surface + unit.will.critical + criticalCost <= unit.will.max * 2;
  }

  _spendChakra(unit, amount) {
    const criticalCost = Math.max(0, unit.chakra.surface + amount - unit.chakra.max);
    unit.chakra = applyTrackDamage(unit.chakra, { surface: amount });
    if (criticalCost) unit.will = applyTrackDamage(unit.will, { surface: criticalCost });
    if (unit.chakra.critical >= unit.chakra.max || unit.will.critical >= unit.will.max) {
      unit.alive = false; unit.condition = unit.chakra.critical >= unit.chakra.max ? 'chakra-exhausted' : 'unconscious';
      this._log(`${unit.name}: резерв исчерпан, персонаж выбывает.`, 'knockout');
    }
  }

  clone() {
    const actor = this._actor(); if (actor.error) return this._fail(actor.error);
    const unit = actor.unit; const level = unit.jutsu.clone || unit.jutsu.clones || 0;
    if (!level) return this._fail('Персонаж не владеет клонированием.');
    if (!this._canSpendChakra(unit, 1)) return this._fail('Недостаточно чакры или воли.');
    this._spendChakra(unit, 1); unit.actions.main = false; unit.clones = level;
    this._log(`${unit.name} создаёт ${level} иллюзорных клонов: +${level} кубиков к следующему уклонению, один клон исчезает за атаку.`, 'jutsu');
    this._settleAction(); this.notify(); return { ok: true };
  }

  activate(kind) {
    const actor = this._actor(false); if (actor.error) return this._fail(actor.error);
    const unit = actor.unit;
    if (!['reaction', 'strength', 'endurance'].includes(kind)) return this._fail('Неизвестная активация.');
    if (!unit.actions.quick) return this._fail('Короткое действие уже использовано.');
    const level = Math.min(unit.activationLevels[kind] || 0, unit.skills.chakraControl || 0);
    if (!level) return this._fail('Эта активация ещё не изучена.');
    if (unit.activation[kind]) return this._fail('Активация уже действует до конца сцены.');
    if (!this._canSpendChakra(unit, 1)) return this._fail('Недостаточно чакры или воли.');
    this._spendChakra(unit, 1); unit.activation[kind] = level; unit.actions.quick = false;
    this._log(`${unit.name}: активация ${kind === 'reaction' ? 'реакции' : kind === 'strength' ? 'силы' : 'выносливости'} ${level}, −1 чакра.`, 'jutsu');
    this._settleAction(); this.notify(); return { ok: true };
  }

  barrier() {
    const actor=this._actor();if(actor.error)return this._fail(actor.error);
    const unit=actor.unit;if(!unit.jutsu.barrier)return this._fail('Барьер не изучен.');
    if(!this._canSpendChakra(unit,1))return this._fail('Недостаточно чакры или воли.');
    this._spendChakra(unit,1);unit.actions.main=false;unit.barrierHealth=unit.jutsu.barrier;unit.actions.movement=0;
    this._log(`${unit.name}: барьер ${unit.barrierHealth} до следующего хода, −1 чакра.`, 'jutsu');
    this._settleAction();this.notify();return {ok:true};
  }

  defend() {
    const actor = this._actor(); if (actor.error) return this._fail(actor.error);
    actor.unit.actions.main = false; actor.unit.defending = true;
    this._log(`${actor.unit.name} сосредоточен на уклонении: +2 кубика до следующего своего хода.`, 'defend');
    this.notify(); return { ok: true };
  }

  heal(targetId = this.active?.id) {
    const actor = this._actor(); if (actor.error) return this._fail(actor.error);
    const unit = actor.unit; const target = this.state.party.find((candidate) => candidate.id === targetId);
    if (!(unit.jutsu.mysticPalm > 0)) return this._fail('Мистической ладонью владеет только медик.');
    if (!target?.alive || distance(unit, target) > RANGES.heal) return this._fail('Для лечения нужен союзник рядом.');
    if (!target.hp.surface) return this._fail('Поверхностных ран нет. Критические раны эта техника первого уровня не лечит.');
    if (!this._canSpendChakra(unit, 1)) return this._fail('Недостаточно чакры или воли.');
    this._spendChakra(unit, 1); unit.actions.main = false;
    const healing = Math.min(target.hp.surface, unit.jutsu.mysticPalm);
    target.hp.surface -= healing;
    this._log(`${unit.name}: мистическая ладонь лечит ${target.name}, −${healing} поверхностный урон, −1 чакра.`, 'heal');
    this._settleAction(); this.notify(); return { ok: true, healing };
  }

  fireball(targetId) {
    const actor = this._actor(); if (actor.error) return this._fail(actor.error);
    const unit = actor.unit; const target = this.state.enemies.find((candidate) => candidate.id === targetId && candidate.alive);
    if (!(unit.jutsu.fireball > 0)) return this._fail('Персонаж не изучил великий огненный шар.');
    if (!target || distance(unit, target) > RANGES.fireball) return this._fail('Выберите противника в пределах пяти клеток.');
    if (!this._lineOfSight(unit, target)) return this._fail('Линия техники перекрыта деревом или стеной.');
    if (!this._canSpendChakra(unit, 2)) return this._fail('Для огненного шара нужны две единицы чакры и доступная воля при критической трате.');
    const targets = this.allUnits.filter((candidate) => candidate.alive && candidate.id !== unit.id && distance(candidate, target) <= 1).slice(0, 5);
    const attack = rollPool((unit.skills.handSeals || 0) + unit.jutsu.fireball + this._specialization(unit, 'handSeals', 'огнен'), this.rng);
    unit.actions.main = false; this._spendChakra(unit, 2);
    const results = targets.map((victim) => {
      const surprise = this.state.advantage && this.state.round === 1 && unit.team !== victim.team;
      const defense = surprise ? { dice: [], successes: 1 } : this._dodge(victim);
      const contest = resolveContest(attack, defense);
      const soak = contest.hit ? this._soak(victim) : { dice: [], successes: 0 };
      const damage = computeDamage({ critical: contest.hit ? contest.margin : 0, soak: soak.successes });
      if (contest.hit) this._damage(victim, damage);
      this._log(`${victim.name}: огненный шар ${contest.hit ? `наносит ${damage.critical} критического урона` : 'не попадает'}.`, contest.hit ? 'damage' : 'miss',
        { dice: attack.dice, successes: attack.successes, defenseDice: defense.dice, defenseSuccesses: defense.successes });
      return { targetId: victim.id, defenseDice: defense.dice, defenseSuccesses: defense.successes, hit: contest.hit, damage };
    });
    this.state.lastRoll = { ...attack, label: 'Великий огненный шар', kind: 'fireball', unitId: unit.id, targets: results,
      defenseDice: results[0]?.defenseDice || [], defenseSuccesses: results[0]?.defenseSuccesses || 0 };
    this._lastSkillRoll = null;
    this._log(`${unit.name} применяет великий огненный шар: −2 чакра. В области задеваются и союзники.`, 'jutsu');
    this._settleAction(); this.notify(); return { ok: true, roll: copy(this.state.lastRoll), targets: copy(results) };
  }

  endTurn() {
    const actor = this._actor(false); if (actor.error) return this._fail(actor.error);
    this._advanceTurn(); this.notify(); return { ok: true };
  }

  _advanceTurn() {
    this._checkOutcome(); if (this.state.phase !== 'combat') return;
    for (let count = 0; count <= this.state.order.length; count++) {
      this.state.turnIndex++;
      if (this.state.turnIndex >= this.state.order.length) {
        this.state.turnIndex = 0; this.state.round++;
        this.allUnits.forEach((unit) => { unit.actions.reaction = true; });
        this._log(`Раунд ${this.state.round}.`, 'round');
      }
      const next = this.allUnits.find((unit) => unit.id === this.state.order[this.state.turnIndex]);
      if (next?.alive) { this._beginTurn(); return; }
    }
  }

  runEnemyTurn() {
    if (this.state.phase !== 'combat' || this.active?.team !== 'enemy' || !this.active.alive) return this._fail('Сейчас не ход противника.');
    const unit = this.active; const targets = this.state.party.filter((candidate) => candidate.alive).sort((a, b) => distance(unit, a) - distance(unit, b));
    const target = targets[0]; const kind = unit.weapon; const range = RANGES[kind];
    if (this._attackAllowed(unit, target, kind)) {
      let best = null;
      for (const enemy of targets) {
        for (let y = Math.max(0, enemy.y - range); y <= Math.min(this.world.height - 1, enemy.y + range); y++) {
          for (let x = Math.max(0, enemy.x - range); x <= Math.min(this.world.width - 1, enemy.x + range); x++) {
            const position = { x, y };
            if (distance(position, enemy) > range || !this._lineOfSight(position, enemy)) continue;
            const path = this.findPath(unit, x, y);
            if (path && (!best || path.length < best.path.length)) best = { path, enemy };
          }
        }
      }
      if (best?.path.length) {
        const walked = best.path.slice(0, unit.actions.movement);
        const previous = { x: unit.x, y: unit.y };
        const position = walked.at(-1); unit.x = position.x; unit.y = position.y;
        unit.actions.movement -= walked.length; this.state.lastMove = { unitId: unit.id, path: [previous, ...walked] };
        this._log(`${unit.name} перемещается на ${walked.length} клетки.`, 'enemy');
      }
    }
    const viable = this.state.party.filter((candidate) => candidate.alive && !this._attackAllowed(unit, candidate, kind)).sort((a, b) => distance(unit, a) - distance(unit, b));
    if (viable.length) this._attackUnit(unit, viable[0], kind);
    else { unit.actions.main = false; unit.defending = true; this._log(`${unit.name} занимает оборону.`, 'defend'); }
    this._advanceTurn(); this.notify(); return { ok: true };
  }

  _checkOutcome() {
    if (this.state.phase !== 'combat') return;
    if (!this.state.party.some((unit) => unit.alive)) {
      this.state.phase = 'lost'; this.state.activeId = null;
      this._log('Отряд не смог удержать мост. Начните миссию заново и попробуйте другую тактику.', 'defeat');
    } else if (!this.state.enemies.some((unit) => unit.alive)) {
      this.state.phase = 'exploration'; this.state.questStage = 'resolved'; this.state.activeId = null;
      this.state.selectedId = this.state.party.find((unit) => unit.alive).id;
      this.state.party.forEach((unit) => { unit.activation = { reaction: 0, strength: 0, endurance: 0 }; unit.clones = 0; unit.defending = false; unit.barrierHealth = 0; });
      this._log('Разбойники обезврежены. Заберите свиток у лагеря на восточном берегу.', 'victory');
    }
  }

  _settleAction() {
    this._checkOutcome();
    if (this.state.phase === 'combat' && !this.active?.alive) this._advanceTurn();
  }

  resolvePeacefully() {
    if (this.state.phase !== 'exploration' || this.state.questStage === 'resolved') return this._fail('Мирный исход сейчас недоступен.');
    this.state.enemies.forEach((unit) => { unit.alive = false; unit.condition = 'fled'; });
    this.state.questStage = 'resolved';
    this._log('Переговоры сработали. Разбойники уходят, оставляя свиток в лагере.', 'story');
    this.notify(); return { ok: true };
  }

  collectScroll() {
    if (this.state.phase !== 'exploration' || this.state.questStage !== 'resolved') return this._fail('Сначала решите столкновение с разбойниками.');
    if (!this.selected?.alive || distance(this.selected, this.world.scroll) > 1) return this._fail('Подойдите к свитку на восточном берегу.');
    this.state.phase = 'won'; this._log('Свиток возвращён. Миссия завершена — отряд возвращается в Коноху.', 'victory');
    this.notify(); return { ok: true };
  }

  skillCheck(unitId, attribute, skill, difficulty = 2, { specialization } = {}) {
    const unit = this.state.party.find((candidate) => candidate.id === unitId && candidate.alive);
    if (!unit || !Number.isInteger(difficulty) || difficulty < 0) return { ok: false, reason: 'Недопустимая проверка.' };
    if (!(attribute in unit.attributes) || !(skill in unit.skills)) return { ok: false, reason: 'Неизвестный атрибут или навык.' };
    const bonus = specialization ? this._specialization(unit, skill, specialization) : 0;
    const roll = rollPool(unit.attributes[attribute] + unit.skills[skill] + bonus, this.rng);
    const result = { ...roll, label: `${unit.name}: проверка`, kind: 'skill', unitId, attribute, skill, difficulty,
      success: roll.successes >= difficulty, specializationBonus: bonus };
    this.state.lastRoll = result; this._lastSkillRoll = { unitId, rerolled: false };
    this._log(`${unit.name}: ${roll.successes} успехов против сложности ${difficulty} — ${result.success ? 'успех' : 'провал'}.`, 'roll', { dice: roll.dice, successes: roll.successes });
    this.notify(); return copy(result);
  }

  spendWillToReroll(indices) {
    const previous = this._lastSkillRoll; const lastRoll = this.state.lastRoll;
    if (!previous || previous.rerolled || lastRoll?.kind !== 'skill') return this._fail('Переброс доступен для последней ещё не переброшенной проверки навыка.');
    const unit = this.state.party.find((candidate) => candidate.id === previous.unitId && candidate.alive);
    if (!unit || unit.will.surface + unit.will.critical >= unit.will.max * 2) return this._fail('Воля исчерпана.');
    let next;
    try { next = rerollWithWill(lastRoll, indices, this.rng); }
    catch (error) { if (error instanceof RangeError) return this._fail(error.message); throw error; }
    unit.will = applyTrackDamage(unit.will, { surface: 1 });
    if (unit.will.critical >= unit.will.max) { unit.alive = false; unit.condition = 'unconscious'; }
    next.success = next.successes >= next.difficulty; this.state.lastRoll = next; previous.rerolled = true;
    this._log(`${unit.name} тратит 1 волю: переброс → ${next.successes} успехов.`, 'roll', { dice: next.dice, successes: next.successes });
    this._settleAction(); this.notify(); return { ok: true, roll: copy(next) };
  }
}
