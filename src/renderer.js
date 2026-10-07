import { WORLD } from './world.js';

const W = 1000, H = 700, TILE = 48, OX = 20, OY = 14;
const TAU = Math.PI * 2;
const center = ({ x, y }) => ({ x: OX + (x + .5) * TILE, y: OY + (y + .5) * TILE });
const seed = (x, y, n = 0) => {
  const value = Math.sin(x * 127.1 + y * 311.7 + n * 74.7) * 43758.5453;
  return value - Math.floor(value);
};
const circle = (c, x, y, r, color) => { c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
const line = (c, points, color, width = 1) => {
  c.strokeStyle = color; c.lineWidth = width; c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
};
const roundRect = (c, x, y, w, h, r, color) => { c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };

/** A deterministic, dependency-free tactical map. All coordinates are world cells. */
export class MapRenderer {
  constructor(canvas, { onCell = () => {}, onHover = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = null;
    this.options = {};
    this.effects = [];
    this.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.map = document.createElement('canvas');
    this.map.width = W; this.map.height = H;
    this.paintLandscape(this.map.getContext('2d'));
    this.pointerDown = event => {
      if (event.button !== undefined && event.button !== 0) return;
      const cell = this.cellAtPointer(event);
      if (cell) { event.preventDefault(); onCell(cell); }
    };
    this.pointerMove = event => onHover(this.cellAtPointer(event));
    this.pointerLeave = () => onHover(null);
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerleave', this.pointerLeave);
    this.resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.resize()) : null;
    this.resizeObserver?.observe(canvas);
    this.resize();
    this.frame = time => {
      this.render(time / 1000);
      this.raf = requestAnimationFrame(this.frame);
    };
    this.raf = requestAnimationFrame(this.frame);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || W), height = Math.max(1, rect.height || H);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.viewport = { width, height, dpr, scale: Math.min(width / W, height / H) };
    this.viewport.x = (width - W * this.viewport.scale) / 2;
    this.viewport.y = (height - H * this.viewport.scale) / 2;
    this.render(performance.now() / 1000);
  }

  cellAtPointer(event) {
    const rect = this.canvas.getBoundingClientRect(), v = this.viewport;
    if (!v || !v.scale) return null;
    const x = Math.floor(((event.clientX - rect.left - v.x) / v.scale - OX) / TILE);
    const y = Math.floor(((event.clientY - rect.top - v.y) / v.scale - OY) / TILE);
    return x >= 0 && x < WORLD.width && y >= 0 && y < WORLD.height ? { x, y } : null;
  }

  draw(state, options = {}) {
    this.state = state;
    this.options = options;
    this.render(performance.now() / 1000);
  }

  /** Optional visual feedback; type: attack, heal, chakra, move, hit or miss. */
  effect(effect) {
    this.effects.push({ ...effect, start: performance.now() / 1000, duration: this.reducedMotion ? .4 : .8 });
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener('pointerdown', this.pointerDown);
    this.canvas.removeEventListener('pointermove', this.pointerMove);
    this.canvas.removeEventListener('pointerleave', this.pointerLeave);
  }

  paintLandscape(c) {
    c.fillStyle = '#112522'; c.fillRect(0, 0, W, H);
    const ground = c.createLinearGradient(0, 0, W, H);
    ground.addColorStop(0, '#294039'); ground.addColorStop(.45, '#2a4238'); ground.addColorStop(1, '#203731');
    c.fillStyle = ground; c.fillRect(OX, OY, TILE * 20, TILE * 14);
    for (let y = 0; y < WORLD.height; y++) for (let x = 0; x < WORLD.width; x++) {
      const kind = WORLD.tiles[y][x], p = center({ x, y });
      if (kind === 'path' || kind === 'bridge') {
        const gradient = c.createLinearGradient(p.x, p.y - 24, p.x, p.y + 24);
        gradient.addColorStop(0, '#766c4a'); gradient.addColorStop(.5, '#8c7b52'); gradient.addColorStop(1, '#6b6549');
        c.fillStyle = gradient; c.fillRect(p.x - 24, p.y - 24, 48, 48);
        for (let i = 0; i < 27; i++) circle(c, p.x - 23 + seed(x, y, i) * 46, p.y - 22 + seed(y, x, i + 1) * 44, .4 + seed(x, y, i + 2) * 1.1, i % 3 ? '#b9a67950' : '#3f493a50');
      } else if (kind !== 'water') {
        for (let i = 0; i < 35; i++) {
          const xx = p.x - 23 + seed(x, y, i) * 46, yy = p.y - 23 + seed(y, x, i + 4) * 46;
          const colors = ['#84926b28', '#4a6b492b', '#c1b68818', '#0e252729'];
          circle(c, xx, yy, 1 + seed(x, y, i + 10) * 2, colors[i % 4]);
          if (i % 6 === 0) line(c, [[xx - 1, yy + 2], [xx, yy - 2], [xx + 2, yy + 1]], '#81a17535');
        }
      }
    }
    // Soft grassy verges make the walkable route easy to follow.
    for (let x = 1; x < 19; x++) {
      if (x >= 9 && x <= 11) continue;
      const p = center({ x, y: 7 });
      for (let i = 0; i < 13; i++) {
        const xx = p.x - 25 + i * 4, yy = p.y + (i % 2 ? 23 : -23);
        circle(c, xx, yy, 2 + seed(x, i) * 3, '#426146');
        line(c, [[xx - 1, yy], [xx - 3, yy - 4], [xx, yy - 2], [xx + 3, yy - 5]], '#67825480');
      }
    }
    this.paintRiver(c);
    this.paintBridge(c);
    // The old eastern watchhouse occupies exactly the four impassable tiles.
    this.paintHouse(c, center({ x: 14, y: 3 }));
    for (let y = 0; y < WORLD.height; y++) for (let x = 0; x < WORLD.width; x++) {
      const kind = WORLD.tiles[y][x];
      if (kind === 'tree' || kind === 'forest') this.paintTree(c, x, y, kind === 'forest');
      if (kind === 'rock') this.paintRock(c, x, y);
    }
    this.paintGate(c, center({ x: 4, y: 6 }), .76);
    this.paintLantern(c, center({ x: 8, y: 6 }));
    this.paintLantern(c, center({ x: 12, y: 7 }));
    this.paintLantern(c, center({ x: 16, y: 4 }));
    c.font = '8px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#d2cba276';
    c.fillText('СТАРАЯ ЗАСТАВА', OX + 15 * TILE, OY + 5 * TILE + 10);
    c.fillText('ПЕРЕПРАВА', OX + 10.5 * TILE, OY + 8 * TILE + 17);
    // Leaf litter, little wildflowers and a quiet trail of stone markers.
    for (let i = 0; i < 130; i++) {
      const x = 1 + seed(i, 4) * 18, y = 1 + seed(i, 2) * 12;
      const cell = WORLD.tiles[Math.floor(y)][Math.floor(x)];
      if (cell !== 'grass') continue;
      const xx = OX + x * TILE, yy = OY + y * TILE;
      if (i % 4) {
        c.save(); c.translate(xx, yy); c.rotate(seed(i, 5) * TAU); c.fillStyle = '#b6a57455'; c.fillRect(-2, -1, 4, 2); c.restore();
      } else {
        circle(c, xx, yy, 1.1, '#d5b7a099'); circle(c, xx + 3, yy + 2, 1, '#d5b7a077');
      }
    }
    this.paintMapEdges(c);
  }

  paintRiver(c) {
    const left = OX + 10 * TILE, top = OY;
    c.fillStyle = '#112e31'; c.fillRect(left - 4, top, TILE + 8, 14 * TILE);
    const river = c.createLinearGradient(left, 0, left + TILE, 0);
    river.addColorStop(0, '#1c494c'); river.addColorStop(.25, '#2c6264'); river.addColorStop(.64, '#28585f'); river.addColorStop(1, '#183f46');
    c.fillStyle = river; c.fillRect(left, top, TILE, TILE * 14);
    for (let i = 0; i < 85; i++) {
      const y = top + seed(i, 7) * 672, x = left + 5 + seed(i, 8) * 34;
      line(c, [[x, y], [x + 7 + seed(i, 1) * 10, y - 1]], i % 3 ? '#87b5a929' : '#d4e2c731', .7);
    }
    for (let i = 0; i < 35; i++) {
      const yy = OY + i * 20, leftBank = left - 4, rightBank = left + TILE + 4;
      for (const xx of [leftBank, rightBank]) {
        circle(c, xx, yy, 4 + seed(i, xx) * 4, '#31493b');
        if (i % 3 === 0) {
          circle(c, xx + (xx === leftBank ? -2 : 2), yy + 2, 3, '#86947170');
          line(c, [[xx, yy], [xx + 2, yy - 10], [xx + 4, yy - 7]], '#72836585');
        }
      }
    }
  }

  paintBridge(c) {
    const p = center({ x: 10, y: 7 }), x = p.x - 72, y = p.y - 23;
    roundRect(c, x - 4, y + 10, 152, 47, 5, '#09232975');
    c.fillStyle = '#68523a'; c.fillRect(x, y, 144, 46);
    for (let i = 0; i < 16; i++) {
      const shade = i % 3 === 0 ? '#a48b5d' : i % 3 === 1 ? '#927a51' : '#7f6a49';
      c.fillStyle = shade; c.fillRect(x + i * 9 + 1, y + 1, 8, 44);
      line(c, [[x + i * 9 + 4, y + 4], [x + i * 9 + 3, y + 39]], '#4c473549', .7);
      circle(c, x + i * 9 + 5, y + 7, .8, '#313732'); circle(c, x + i * 9 + 5, y + 38, .8, '#313732');
    }
    for (const yy of [y + 1, y + 45]) {
      line(c, [[x - 2, yy + 2], [x + 146, yy + 2]], '#282f28', 5);
      line(c, [[x - 2, yy], [x + 146, yy]], '#b09863', 3);
      for (const xx of [x + 3, x + 47, x + 96, x + 141]) {
        roundRect(c, xx - 3, yy - 7, 6, 14, 1, '#5e5540');
        circle(c, xx, yy - 7, 4, '#beaa76');
      }
    }
  }

  paintTree(c, x, y, edge = false) {
    const p = center({ x, y }), xx = p.x + (seed(x, y) - .5) * 9, yy = p.y + 2;
    const r = edge ? 25 : 28;
    c.save();
    circle(c, xx + 5, yy + 9, r + 5, '#081d2163');
    roundRect(c, xx - 4, yy - 6, 8, 20, 2, '#554b37');
    line(c, [[xx - 1, yy + 10], [xx - 7, yy + 16]], '#3c402e', 3);
    line(c, [[xx + 1, yy + 12], [xx + 9, yy + 17]], '#3c402e', 3);
    const palette = edge ? ['#14332e', '#1d4034', '#28503d', '#3b5c42'] : ['#193a30', '#254e36', '#426443', '#567449'];
    circle(c, xx, yy - 6, r, palette[0]);
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * TAU, radius = r * (.35 + seed(x, y, i) * .45);
      circle(c, xx + Math.cos(angle) * radius, yy - 9 + Math.sin(angle) * radius * .77, 9 + seed(y, x, i) * 8, palette[1 + i % 3]);
    }
    for (let i = 0; i < 35; i++) {
      const angle = seed(x, y, i + 17) * TAU, radius = Math.sqrt(seed(y, x, i + 19)) * r;
      circle(c, xx + Math.cos(angle) * radius, yy - 10 + Math.sin(angle) * radius * .75, .8 + seed(y, x, i) * 1.8, i % 3 ? '#a3b07533' : '#102e3055');
    }
    c.restore();
  }

  paintRock(c, x, y) {
    const p = center({ x, y });
    c.save(); c.translate(p.x, p.y);
    c.fillStyle = '#0c25244d'; c.beginPath(); c.ellipse(4, 9, 25, 16, -.15, 0, TAU); c.fill();
    c.fillStyle = '#596961'; c.beginPath(); c.moveTo(-22, 4); c.lineTo(-18, -11); c.lineTo(-5, -20); c.lineTo(12, -17); c.lineTo(21, -4); c.lineTo(17, 12); c.lineTo(-8, 15); c.closePath(); c.fill();
    c.fillStyle = '#768174'; c.beginPath(); c.moveTo(-18, -11); c.lineTo(-5, -20); c.lineTo(12, -17); c.lineTo(6, -5); c.lineTo(-6, -2); c.closePath(); c.fill();
    line(c, [[6, -5], [12, 5], [9, 12]], '#384f48', 1.5);
    line(c, [[-18, -10], [-9, -4], [-6, -2]], '#95a09255');
    for (let i = 0; i < 10; i++) circle(c, -18 + seed(x, y, i) * 34, 5 + seed(y, x, i) * 9, 2 + seed(x, i) * 2, '#6d7d4d99');
    c.restore();
  }

  paintHouse(c, p) {
    const x = p.x - 20, y = p.y - 19, w = 88, h = 88;
    roundRect(c, x + 7, y + 14, w + 8, h + 4, 5, '#09232380');
    c.fillStyle = '#665b43'; c.fillRect(x + 4, y + 30, w - 8, h - 22);
    for (let xx = x + 8; xx < x + w - 4; xx += 9) line(c, [[xx, y + 31], [xx, y + h]], '#a2977150');
    roundRect(c, x + 30, y + 65, 22, 25, 2, '#1b332d');
    roundRect(c, x + 9, y + 57, 14, 14, 1, '#25392d');
    line(c, [[x + 16, y + 57], [x + 16, y + 71]], '#8c8760');
    c.fillStyle = '#384a46'; c.beginPath(); c.moveTo(x - 6, y + 45); c.lineTo(x + 12, y - 3); c.lineTo(x + 71, y - 3); c.lineTo(x + 94, y + 45); c.closePath(); c.fill();
    c.fillStyle = '#4e6154'; c.beginPath(); c.moveTo(x + 12, y - 3); c.lineTo(x + 42, y + 14); c.lineTo(x + 94, y + 45); c.lineTo(x + 71, y - 3); c.closePath(); c.fill();
    for (let i = 0; i < 7; i++) line(c, [[x + 9 - i * 2, y + i * 6], [x + 74 + i * 3, y + i * 6]], '#87957a48');
    line(c, [[x - 6, y + 45], [x + 94, y + 45]], '#213b34', 5);
    line(c, [[x + 11, y - 3], [x + 72, y - 3]], '#9b9a72', 4);
    for (const xx of [x + 1, x + 80]) {
      for (let i = 0; i < 9; i++) circle(c, xx + seed(i, xx) * 8, y + 41 + i * 5, 3 + seed(i, xx, 1) * 3, '#60754a');
    }
  }

  paintGate(c, p, scale) {
    c.save(); c.translate(p.x, p.y - 4); c.scale(scale, scale);
    c.fillStyle = '#071e2250'; c.fillRect(-38, 14, 91, 12);
    for (const xx of [-32, 32]) {
      roundRect(c, xx - 4, -30, 8, 52, 1, '#7d493c');
      c.fillStyle = '#b47150'; c.fillRect(xx - 4, -29, 2, 47);
      roundRect(c, xx - 6, 17, 12, 5, 1, '#75816b');
    }
    line(c, [[-40, -13], [40, -13]], '#aa6d4d', 7);
    line(c, [[-51, -33], [-31, -28], [31, -28], [51, -33]], '#a75d43', 9);
    line(c, [[-51, -36], [-30, -31], [30, -31], [51, -36]], '#d3945f', 2);
    roundRect(c, -6, -26, 12, 16, 1, '#524c36');
    line(c, [[-2, -23], [3, -21], [-2, -17], [3, -14]], '#d0b77d');
    // Old paper charms hanging from a rope beneath the crossbeam.
    line(c, [[-29, -10], [0, -5], [29, -10]], '#c0ad7b', 1);
    for (const xx of [-18, 0, 18]) { c.fillStyle = '#d3c6a0'; c.fillRect(xx - 2, -5, 4, 8); }
    c.restore();
  }

  paintLantern(c, p) {
    const xx = p.x - 13, yy = p.y - 3;
    const glow = c.createRadialGradient(xx, yy, 3, xx, yy, 63);
    glow.addColorStop(0, '#e8b45625'); glow.addColorStop(1, '#e8b45600');
    c.fillStyle = glow; c.fillRect(xx - 63, yy - 63, 126, 126);
    roundRect(c, xx - 3, yy + 4, 6, 18, 1, '#767560');
    roundRect(c, xx - 8, yy + 18, 16, 5, 1, '#747961');
    roundRect(c, xx - 7, yy - 8, 14, 13, 2, '#aaa077');
    c.fillStyle = '#eec886'; c.fillRect(xx - 4, yy - 6, 8, 9);
    line(c, [[xx, yy - 6], [xx, yy + 3]], '#988968');
    c.fillStyle = '#7a7b62'; c.beginPath(); c.moveTo(xx - 12, yy - 8); c.lineTo(xx, yy - 15); c.lineTo(xx + 12, yy - 8); c.closePath(); c.fill();
    line(c, [[xx - 11, yy - 8], [xx + 11, yy - 8]], '#b6af85', 2);
  }

  paintMapEdges(c) {
    const shade = c.createRadialGradient(500, 340, 170, 500, 340, 605);
    shade.addColorStop(0, '#081d2200'); shade.addColorStop(.7, '#081d220d'); shade.addColorStop(1, '#07191bbd');
    c.fillStyle = shade; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#b6b27c3c'; c.lineWidth = 1; c.strokeRect(OX - .5, OY - .5, 961, 673);
    c.fillStyle = '#aab2977a'; c.font = '8px "Courier New", monospace'; c.textAlign = 'center';
    for (let x = 0; x < WORLD.width; x++) c.fillText(String(x + 1).padStart(2, '0'), OX + (x + .5) * TILE, 10);
    for (let y = 0; y < WORLD.height; y++) c.fillText(String.fromCharCode(65 + y), 10, OY + (y + .5) * TILE + 3);
    for (const [x, y, dx, dy] of [[OX, OY, 1, 1], [980, OY, -1, 1], [OX, 686, 1, -1], [980, 686, -1, -1]]) {
      line(c, [[x + dx * 15, y], [x, y], [x, y + dy * 15]], '#c6b58e99', 2);
    }
  }

  render(time = 0) {
    if (!this.viewport) return;
    const c = this.ctx, v = this.viewport, state = this.state;
    c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    c.fillStyle = '#102522'; c.fillRect(0, 0, v.width, v.height);
    c.translate(v.x, v.y); c.scale(v.scale, v.scale);
    c.drawImage(this.map, 0, 0);
    if (!state) return;
    const t = this.reducedMotion ? 0 : time;
    this.paintWaterMotion(c, t);
    this.paintInteraction(c, state, t);
    if (!state.scrollTaken && !state.scrollRecovered && state.phase !== 'won') this.paintScroll(c, t);
    this.paintNpc(c, t);
    const enemies = state.questStage === 'resolved' || state.questStage === 'flee' || state.questStage === 'fled' ? [] : state.enemies || [];
    const units = [...(state.party || []).map(unit => ({ ...unit, enemy: false })), ...enemies.map(unit => ({ ...unit, enemy: true }))];
    units.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const unit of units) this.paintUnit(c, unit, state, t);
    this.paintAtmosphere(c, t);
    this.paintEffects(c, time);
    this.paintHover(c, units);
  }

  paintWaterMotion(c, t) {
    if (this.reducedMotion) return;
    c.save(); c.beginPath(); c.rect(OX + 10 * TILE + 3, OY, TILE - 6, 672); c.clip();
    for (let i = 0; i < 13; i++) {
      const y = OY + ((i * 59 + t * 10) % 675);
      if (y > 346 && y < 400) continue;
      const x = OX + 10 * TILE + 10 + Math.sin(t * .5 + i) * 5;
      c.globalAlpha = .18 + Math.sin(t + i) * .06;
      line(c, [[x, y], [x + 9, y - 1], [x + 22, y + 1]], '#bfdbcd', 1);
    }
    c.restore();
  }

  paintInteraction(c, state, time) {
    const selected = (state.party || []).find(unit => unit.id === state.selectedId);
    const combat = state.phase === 'combat';
    const options = this.options;
    if (combat) {
      c.strokeStyle = '#becfac10'; c.lineWidth = .6; c.beginPath();
      for (let x = 0; x <= 20; x++) { c.moveTo(OX + x * TILE, OY); c.lineTo(OX + x * TILE, OY + 14 * TILE); }
      for (let y = 0; y <= 14; y++) { c.moveTo(OX, OY + y * TILE); c.lineTo(OX + 20 * TILE, OY + y * TILE); }
      c.stroke();
    }
    const reachable = options.reachable || [];
    for (const cell of reachable) {
      const p = center(cell);
      roundRect(c, p.x - 21, p.y - 21, 42, 42, 4, '#94d9b815');
      c.strokeStyle = '#92ceb632'; c.lineWidth = .7; c.strokeRect(p.x - 20.5, p.y - 20.5, 41, 41);
      circle(c, p.x, p.y, 1.2, '#b3d8a866');
    }
    if (selected?.alive && options.mode !== 'move' && options.mode !== 'explore') {
      const p = center(selected);
      const radius = (options.range || (options.mode === 'melee' ? 1 : 5)) * TILE;
      c.save(); c.beginPath(); c.rect(OX, OY, 960, 672); c.clip();
      c.strokeStyle = '#d5b07b43'; c.lineWidth = 1; c.setLineDash([4, 7]);
      c.beginPath(); c.moveTo(p.x, p.y - radius); c.lineTo(p.x + radius, p.y); c.lineTo(p.x, p.y + radius); c.lineTo(p.x - radius, p.y); c.closePath(); c.stroke(); c.restore();
    }
    if (options.hover) {
      const p = center(options.hover), blocked = WORLD.blocked.some(cell => cell.x === options.hover.x && cell.y === options.hover.y);
      const occupied = [...(state.party || []), ...(state.enemies || [])].some(unit => unit.alive && unit.x === options.hover.x && unit.y === options.hover.y);
      const tint = blocked && !occupied ? '#c2756430' : options.mode !== 'move' && occupied ? '#c48b7040' : '#c2d2a525';
      roundRect(c, p.x - 22, p.y - 22, 44, 44, 4, tint);
      c.strokeStyle = blocked && !occupied ? '#c2866b99' : '#e0cd9899'; c.lineWidth = 1.2;
      c.beginPath(); c.roundRect(p.x - 22, p.y - 22, 44, 44, 4); c.stroke();
    }
  }

  paintScroll(c, t) {
    const p = center(WORLD.scroll), pulse = .65 + Math.sin(t * 2) * .2;
    const glow = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, 37);
    glow.addColorStop(0, `rgba(209,185,99,${pulse * .28})`); glow.addColorStop(1, '#ccb47300');
    c.fillStyle = glow; c.fillRect(p.x - 37, p.y - 37, 74, 74);
    c.strokeStyle = '#d9c08280'; c.lineWidth = 1; c.setLineDash([2, 5]); c.beginPath(); c.arc(p.x, p.y + 2, 20, 0, TAU); c.stroke(); c.setLineDash([]);
    c.save(); c.translate(p.x, p.y); c.rotate(-.22);
    roundRect(c, -10, -8, 20, 16, 2, '#d9c494');
    for (const xx of [-11, 8]) roundRect(c, xx, -10, 4, 20, 2, '#8c6246');
    roundRect(c, -3, -9, 6, 18, 1, '#9a4d42');
    c.fillStyle = '#dec08b'; c.fillRect(-1, -3, 2, 6); c.restore();
    for (let i = 0; i < 3; i++) circle(c, p.x + Math.cos(t + i * 2) * 22, p.y - 15 + Math.sin(t * .7 + i) * 11, 1, '#f1d296a0');
  }

  paintNpc(c, t) {
    const p = center(WORLD.npc);
    circle(c, p.x, p.y + 10, 14, '#102b2455');
    c.save(); c.translate(p.x, p.y);
    line(c, [[-6, 9], [-7, 15]], '#3b4537', 6); line(c, [[6, 9], [7, 15]], '#3b4537', 6);
    roundRect(c, -9, -4, 18, 17, 4, '#a68c66');
    roundRect(c, -10, -3, 3, 12, 1, '#d0b695'); roundRect(c, 7, -3, 3, 12, 1, '#d0b695');
    circle(c, 0, -8, 7.5, '#d5ba93');
    c.fillStyle = '#847254'; c.beginPath(); c.ellipse(0, -12, 12, 4, 0, 0, TAU); c.fill();
    c.fillStyle = '#aa9467'; c.beginPath(); c.moveTo(-10, -12); c.lineTo(0, -22); c.lineTo(10, -12); c.closePath(); c.fill();
    line(c, [[10, 1], [14, 18]], '#a99876', 2);
    c.restore();
    circle(c, p.x + 13, p.y - 21, 6, '#d7be7b');
    c.fillStyle = '#4f4933'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText('!', p.x + 13, p.y - 18);
  }

  paintUnit(c, unit, state, t) {
    const p = center(unit), selected = unit.id === state.selectedId, active = state.phase === 'combat' && unit.id === state.activeId;
    const target = unit.id === this.options.targetId;
    const hovered = this.options.hover && unit.x === this.options.hover.x && unit.y === this.options.hover.y;
    const color = unit.color || (unit.enemy ? '#cd7970' : '#d5ae70');
    c.save();
    if (unit.alive === false) c.globalAlpha = .5;
    c.fillStyle = '#071f2385'; c.beginPath(); c.ellipse(p.x + 2, p.y + 12, 16, 8, 0, 0, TAU); c.fill();
    if (unit.enemy && unit.alive) {
      c.strokeStyle = target || hovered ? '#ec967f' : '#c875637e'; c.lineWidth = target || hovered ? 2 : 1;
      c.beginPath(); c.ellipse(p.x, p.y + 7, 18, 13, 0, 0, TAU); c.stroke();
    }
    if (selected || active) {
      const pulse = active ? Math.sin(t * 3) * 1.5 : 0;
      const glow = c.createRadialGradient(p.x, p.y, 9, p.x, p.y, 27);
      glow.addColorStop(0, '#f2ce7824'); glow.addColorStop(1, '#f2ce7800');
      c.fillStyle = glow; c.fillRect(p.x - 28, p.y - 28, 56, 56);
      c.strokeStyle = active ? '#f1d48d' : '#d7bd79'; c.lineWidth = active ? 2.3 : 1.5;
      c.beginPath(); c.ellipse(p.x, p.y + 6, 20 + pulse, 15 + pulse * .6, 0, 0, TAU); c.stroke();
      if (active) {
        c.fillStyle = '#f1d48d'; c.beginPath(); c.moveTo(p.x - 4, p.y - 33); c.lineTo(p.x + 4, p.y - 33); c.lineTo(p.x, p.y - 28); c.closePath(); c.fill();
      }
    }
    if (unit.defending) {
      c.strokeStyle = '#95cbd58c'; c.lineWidth = 1.7; c.beginPath(); c.arc(p.x, p.y + 1, 23, Math.PI * 1.05, TAU * .96); c.stroke();
    }
    if (unit.clones) {
      for (const dx of [-22, 22]) {
        c.save(); c.globalAlpha *= .22; c.translate(p.x + dx, p.y + 3); this.paintNinja(c, unit, color); c.restore();
      }
    }
    c.save(); c.translate(p.x, p.y);
    if (unit.alive === false) { c.rotate(-Math.PI / 2.6); c.scale(.9, .9); }
    this.paintNinja(c, unit, color);
    c.restore();
    // A small monogram anchors a distinct color and shape to each party member.
    if (!unit.enemy && unit.alive !== false) {
      circle(c, p.x + 12, p.y + 13, 6, '#162f2bee');
      c.fillStyle = color; c.font = 'bold 8px sans-serif'; c.textAlign = 'center';
      c.fillText((unit.name || unit.id || '?')[0].toUpperCase(), p.x + 12, p.y + 16);
    }
    const damage = (unit.hp?.surface || 0) + (unit.hp?.critical || 0);
    if (damage && unit.alive !== false) {
      const hpMax = typeof unit.hp.max === 'number' ? unit.hp.max : (unit.hp.max?.surface || 0) + (unit.hp.max?.critical || 0) || 10;
      const surface = Math.max(0, 1 - (unit.hp.surface || 0) / hpMax);
      const critical = Math.max(0, 1 - (unit.hp.critical || 0) / hpMax);
      roundRect(c, p.x - 16, p.y + 23, 32, 7, 2, '#112925dd');
      roundRect(c, p.x - 15, p.y + 24, 30 * surface, 2, 1, '#a6c18e');
      roundRect(c, p.x - 15, p.y + 27, 30 * critical, 2, 1, '#d28a79');
    }
    c.restore();
  }

  paintNinja(c, unit, color) {
    const enemy = unit.enemy;
    // Sandals, split legs, flak jacket, satchel and a recognizable forehead band.
    line(c, [[-5, 7], [-7, 15]], '#243434', 6);
    line(c, [[5, 7], [7, 15]], '#243434', 6);
    roundRect(c, -11, 13, 9, 5, 2, '#172929'); roundRect(c, 3, 13, 9, 5, 2, '#172929');
    line(c, [[-7, 13], [-7, 15]], '#c4af8d', 2); line(c, [[7, 13], [7, 15]], '#c4af8d', 2);
    // The scarf and its tails introduce readable asymmetric silhouettes.
    if (unit.id === 'ren' || enemy) {
      c.fillStyle = color; c.beginPath(); c.moveTo(-6, -5); c.lineTo(-18, -1); c.lineTo(-17, 10); c.lineTo(-11, 4); c.lineTo(-8, 6); c.closePath(); c.fill();
    }
    if (unit.id === 'miyo') {
      c.fillStyle = '#453447'; c.beginPath(); c.moveTo(-6, -12); c.lineTo(-12, 7); c.lineTo(-8, 13); c.lineTo(-3, -4); c.closePath(); c.fill();
    }
    roundRect(c, -9, -6, 18, 18, 4, enemy ? '#68483f' : color);
    line(c, [[0, -4], [0, 9]], '#152d304b', 1.3);
    roundRect(c, -10, 3, 20, 4, 1, '#283c37');
    roundRect(c, 7, 4, 5, 7, 1, '#70624b');
    line(c, [[-10, -2], [-13, 6]], enemy ? '#b39779' : color, 5);
    line(c, [[10, -2], [13, 6]], enemy ? '#b39779' : color, 5);
    circle(c, -13, 7, 2.6, '#d4b595'); circle(c, 13, 7, 2.6, '#d4b595');
    circle(c, 0, -10, 8, '#ddc09c');
    if (enemy) {
      circle(c, 0, -13, 8.5, '#2c3631');
      roundRect(c, -7, -10, 14, 6, 1, '#d4c6a4');
      line(c, [[-4, -8], [-2, -7]], '#6b473f', 1.8); line(c, [[2, -7], [4, -8]], '#6b473f', 1.8);
      roundRect(c, -7, -3, 14, 3, 1, color);
      line(c, [[12, 8], [19, 2]], '#b4b9a5', 2); line(c, [[11, 9], [15, 12]], '#6d654b', 2);
    } else {
      const hair = unit.id === 'ren' ? '#564331' : unit.id === 'sora' ? '#273d3a' : '#463647';
      c.fillStyle = hair; c.beginPath(); c.moveTo(-8, -9); c.lineTo(-9, -17); c.lineTo(-5, -16); c.lineTo(-4, -22); c.lineTo(0, -18); c.lineTo(5, -22); c.lineTo(6, -17); c.lineTo(10, -17); c.lineTo(8, -9); c.lineTo(3, -14); c.lineTo(-1, -12); c.closePath(); c.fill();
      roundRect(c, -8, -12, 16, 4, 1, '#263936'); roundRect(c, -5, -12, 10, 4, 1, '#adbbb0');
      c.strokeStyle = '#4d6760'; c.lineWidth = .8; c.beginPath(); c.arc(0, -10, 1.1, .5, 5.8); c.stroke();
      circle(c, -3, -6, .8, '#293832'); circle(c, 3, -6, .8, '#293832');
      if (unit.id === 'sora') { line(c, [[-11, 8], [-16, -15]], '#68857d', 2); line(c, [[-16, -15], [-20, -20]], '#a9b8a5', 1.5); }
    }
  }

  paintAtmosphere(c, t) {
    c.save();
    // A faint moonbeam across the eastern bank and glints between the trees.
    const mist = c.createLinearGradient(650, 60, 830, 610);
    mist.addColorStop(0, '#bcd4c30a'); mist.addColorStop(.55, '#bcd4c308'); mist.addColorStop(1, '#bcd4c300');
    c.fillStyle = mist; c.beginPath(); c.moveTo(580, 14); c.lineTo(705, 14); c.lineTo(936, 675); c.lineTo(842, 675); c.closePath(); c.fill();
    for (let i = 0; i < 17; i++) {
      const x = 90 + seed(i, 42) * 830 + Math.sin(t * .25 + i) * 7;
      const y = 90 + seed(i, 24) * 520 + Math.cos(t * .35 + i) * 6;
      const opacity = .2 + (.5 + Math.sin(t * .7 + i * 1.9) * .5) * .4;
      circle(c, x, y, .9, `rgba(210,217,147,${opacity})`);
    }
    if (!this.reducedMotion) for (let i = 0; i < 8; i++) {
      const x = 70 + ((seed(i, 64) * 860 + t * (3 + seed(i, 1) * 4)) % 860);
      const y = 40 + ((seed(i, 67) * 620 + t * 4) % 620);
      c.save(); c.translate(x, y); c.rotate(t * .3 + i); c.fillStyle = '#e1c4ae52'; c.beginPath(); c.ellipse(0, 0, 2.5, 1.1, 0, 0, TAU); c.fill(); c.restore();
    }
    c.restore();
  }

  paintEffects(c, time) {
    this.effects = this.effects.filter(effect => time - effect.start < effect.duration);
    for (const effect of this.effects) {
      const progress = Math.min(1, (time - effect.start) / effect.duration);
      const to = effect.to ? center(effect.to) : effect.from ? center(effect.from) : null;
      if (!to) continue;
      const from = effect.from ? center(effect.from) : to;
      const heal = effect.type === 'heal', chakra = effect.type === 'chakra';
      const color = effect.color || (heal ? '#b1dcc0' : chakra ? '#9dcfd7' : '#f1d3a0');
      c.save(); c.globalAlpha = 1 - progress;
      if (effect.from && effect.to && !heal) {
        line(c, [[from.x, from.y], [from.x + (to.x - from.x) * Math.min(1, progress * 3), from.y + (to.y - from.y) * Math.min(1, progress * 3)]], color, 2.5);
      }
      c.strokeStyle = color; c.lineWidth = 2 * (1 - progress) + .5;
      c.beginPath(); c.arc(to.x, to.y, 7 + progress * 31, 0, TAU); c.stroke();
      for (let i = 0; i < 8; i++) {
        const angle = i / 8 * TAU;
        circle(c, to.x + Math.cos(angle) * progress * 34, to.y + Math.sin(angle) * progress * 34, 2 * (1 - progress), color);
      }
      if (effect.text) { c.fillStyle = color; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.fillText(effect.text, to.x, to.y - 22 - progress * 20); }
      c.restore();
    }
  }

  paintHover(c, units) {
    const hover = this.options.hover;
    if (!hover) { this.canvas.style.cursor = 'default'; return; }
    const unit = units.find(item => item.x === hover.x && item.y === hover.y);
    const npc = hover.x === WORLD.npc.x && hover.y === WORLD.npc.y;
    const scroll = hover.x === WORLD.scroll.x && hover.y === WORLD.scroll.y;
    const blocked = WORLD.blocked.some(cell => cell.x === hover.x && cell.y === hover.y);
    this.canvas.style.cursor = unit || npc || scroll ? 'pointer' : blocked ? 'not-allowed' : 'crosshair';
    const label = unit?.name || (npc ? 'Старый проводник' : scroll ? 'Запечатанный свиток' : null);
    if (!label) return;
    const p = center(hover);
    c.save(); c.font = '11px sans-serif'; c.textAlign = 'center';
    const width = c.measureText(label).width + 20;
    const x = Math.max(OX + width / 2 + 2, Math.min(W - OX - width / 2 - 2, p.x));
    const y = p.y < 60 ? p.y + 36 : p.y - 39;
    roundRect(c, x - width / 2, y - 12, width, 23, 4, '#122b27ed');
    c.strokeStyle = unit?.enemy ? '#a9695380' : '#b5b08a66'; c.lineWidth = 1; c.beginPath(); c.roundRect(x - width / 2, y - 12, width, 23, 4); c.stroke();
    c.fillStyle = '#e1d6b8'; c.fillText(label, x, y + 3); c.restore();
  }
}
