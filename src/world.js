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
export const WORLD = Object.freeze({ id: 'forest', width, height, tiles, blocked, npc: {x:4,y:5}, scroll: {x:16,y:5}, name: 'Тропа Тихой реки', river: true, theme: 'forest', npcName: 'Дозорный', objectName: 'Запечатанный свиток' });
export const distance = (a,b) => Math.abs(a.x-b.x) + Math.abs(a.y-b.y);

function makeRegion(id, theme, name, npcName, objectName) {
  const cells = structuredClone(tiles);
  for (let y = 0; y < height; y++) {
    cells[y][10] = y === 0 || y === height - 1 ? 'forest' : 'grass';
    for (let x = 1; x < width - 1; x++) {
      if (cells[y][x] === 'tree' && theme === 'ruins') cells[y][x] = 'rock';
    }
  }
  for (let x = 1; x < width - 1; x++) cells[7][x] = 'path';
  if (theme === 'archive') {
    for (const [x,y] of [[6,3],[7,3],[6,4],[7,4]]) cells[y][x]='building';
    for (const [x,y] of [[8,9],[11,11],[12,11]]) cells[y][x]='rock';
  }
  const solid=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(['forest','water','tree','rock','building'].includes(cells[y][x]))solid.push({x,y});
  return Object.freeze({id,width,height,tiles:cells,blocked:solid,npc:{x:4,y:5},scroll:{x:16,y:5},name,npcName,objectName,river:false,theme});
}
export const REGIONS = [WORLD,
  makeRegion('ruins','ruins','Руины Хасуми','Лекарь Иори','Список поставок'),
  makeRegion('archive','archive','Закрытый архив','Архивист Хаку','Печать приказа'),
];
export function getWorld(id='forest') {
  const world=REGIONS.find(world=>world.id===id);
  if(!world)throw new Error('Неизвестная локация.');
  return world;
}
