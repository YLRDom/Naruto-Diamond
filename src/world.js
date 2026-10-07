const width = 20, height = 14;
const tiles = Array.from({ length: height }, () => Array(width).fill('grass'));
const treeCells = [[1,2],[2,2],[3,2],[6,2],[7,3],[1,10],[6,11],[7,10],[12,2],[14,2],[18,2],[18,10],[15,11],[17,11],[2,11],[5,1],[8,1],[13,1],[16,1],[18,5]];
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  if (x === 0 || x === width - 1 || y === 0 || y === height - 1) tiles[y][x] = 'forest';
  if (x === 10) tiles[y][x] = 'water';
}
for (let x = 1; x < width - 1; x++) tiles[7][x] = 'path';
for (let y = 4; y < 10; y++) { tiles[y][4] = 'path'; tiles[y][16] = 'path'; }
for (const [x,y] of treeCells) tiles[y][x] = 'tree';
for (const [x,y] of [[8,5],[12,9],[14,9],[5,9],[7,5]]) tiles[y][x] = 'rock';
for (const [x,y] of [[14,3],[15,3],[14,4],[15,4]]) tiles[y][x] = 'building';
for (const x of [9,10,11]) tiles[7][x] = 'bridge';
const blocked = [];
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (['forest','water','tree','rock','building'].includes(tiles[y][x])) blocked.push({ x, y });
export const WORLD = Object.freeze({ width, height, tiles, blocked, npc: {x:4,y:5}, scroll: {x:16,y:5}, name: 'Тропа Тихой реки' });
export const distance = (a,b) => Math.abs(a.x-b.x) + Math.abs(a.y-b.y);
