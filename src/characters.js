/**
 * Original, clanless shinobi built from Naruto Diamond Fandom RP 0.6.
 * Each preset begins with attributes 2, nine skills 2, nine skills 1,
 * three different specializations, five basic jutsu 1, one advanced
 * jutsu 1, an elemental affinity, and 40 XP. See docs/rules-scope.md.
 */
export const ATTRIBUTE_LABELS = {
  strength: 'Сила', dexterity: 'Ловкость', stamina: 'Выносливость',
  charisma: 'Харизма', manipulation: 'Манипулирование', composure: 'Самообладание',
  intelligence: 'Интеллект', wits: 'Смекалка', resolve: 'Решимость',
};

export const SKILL_LABELS = {
  athletics: 'Атлетика', brawl: 'Рукопашный бой', handSeals: 'Ручные печати',
  drive: 'Транспорт', shooting: 'Стрельба', legerdemain: 'Ловкость рук',
  melee: 'Холодное оружие', stealth: 'Скрытность', survival: 'Выживание',
  animalKen: 'Понимание животных', etiquette: 'Этикет', empathy: 'Проницательность',
  intimidation: 'Запугивание', leadership: 'Лидерство', performance: 'Исполнение',
  persuasion: 'Убеждение', streetwise: 'Знание улиц', subterfuge: 'Хитрость',
  academics: 'Образование', awareness: 'Внимательность', finance: 'Финансы',
  investigation: 'Расследование', medicine: 'Медицина', chakraControl: 'Контроль чакры',
  politics: 'Политика', science: 'Наука', technology: 'Технологии',
};

const baseAttributes = Object.fromEntries(Object.keys(ATTRIBUTE_LABELS).map((key) => [key, 2]));

function startingSkills(twos, ones) {
  if (twos.length !== 9 || ones.length !== 9 || new Set([...twos, ...ones]).size !== 18) {
    throw new Error('A preset must select nine distinct skills at 2 and nine other skills at 1.');
  }
  const skills = Object.fromEntries(Object.keys(SKILL_LABELS).map((key) => [key, 0]));
  for (const key of twos) skills[key] = 2;
  for (const key of ones) skills[key] = 1;
  return skills;
}

const basicJutsu = {
  clone: 1, substitution: 1, transformation: 1, camouflage: 1, scrollActivation: 1,
};

const renSkills = startingSkills(
  ['athletics', 'brawl', 'handSeals', 'shooting', 'melee', 'awareness', 'chakraControl', 'intimidation', 'persuasion'],
  ['stealth', 'survival', 'legerdemain', 'empathy', 'leadership', 'subterfuge', 'academics', 'investigation', 'medicine'],
);
const soraSkills = startingSkills(
  ['athletics', 'shooting', 'melee', 'stealth', 'survival', 'awareness', 'investigation', 'chakraControl', 'subterfuge'],
  ['brawl', 'handSeals', 'legerdemain', 'animalKen', 'empathy', 'persuasion', 'streetwise', 'academics', 'medicine'],
);
const miyoSkills = startingSkills(
  ['medicine', 'chakraControl', 'handSeals', 'empathy', 'persuasion', 'academics', 'awareness', 'investigation', 'athletics'],
  ['brawl', 'shooting', 'melee', 'stealth', 'survival', 'etiquette', 'leadership', 'subterfuge', 'science'],
);

export const PARTY_PRESETS = [
  {
    id: 'ren', name: 'Рэн', role: 'Огневик', color: '#e39f5a', clan: 'Бесклановый',
    description: 'Вспыльчивый ученик, который учится выбирать слова раньше огня.',
    path: 'Вернуть всех товарищей домой, даже если приказ требует обратного.',
    element: 'Огонь', attributes: { ...baseAttributes, dexterity: 3, resolve: 3 },
    startingSkills: renSkills, skills: { ...renSkills, handSeals: 3 },
    specializations: [
      { skill: 'handSeals', label: 'Огненные техники' },
      { skill: 'shooting', label: 'Сюрикены' },
      { skill: 'persuasion', label: 'Переговоры о миссии' },
    ],
    jutsu: { ...basicJutsu, fireball: 1 },
    activationLevels: { reaction: 0, strength: 0, endurance: 0 },
    xp: 1, xpRemaining: 1, xpSpent: 39,
    xpPurchases: [
      { kind: 'attribute', key: 'dexterity', from: 2, to: 3, cost: 15 },
      { kind: 'attribute', key: 'resolve', from: 2, to: 3, cost: 15 },
      { kind: 'skill', key: 'handSeals', from: 2, to: 3, cost: 9 },
    ],
    armor: 2, weapon: 'Кунай', x: 3, y: 7,
  },
  {
    id: 'sora', name: 'Сора', role: 'Разведчик', color: '#76b9a5', clan: 'Бесклановый',
    description: 'Тихий следопыт, который замечает ловушки и находит обходные пути.',
    path: 'Побеждать знанием местности и сохранять жизни по обе стороны клинка.',
    element: 'Земля', attributes: { ...baseAttributes, dexterity: 3, wits: 3 },
    startingSkills: soraSkills, skills: { ...soraSkills },
    specializations: [
      { skill: 'stealth', label: 'Лес' },
      { skill: 'awareness', label: 'Ловушки' },
      { skill: 'melee', label: 'Кунай' },
    ],
    jutsu: { ...basicJutsu, barrier: 1 },
    activationLevels: { reaction: 1, strength: 0, endurance: 1 },
    xp: 0, xpRemaining: 0, xpSpent: 40,
    xpPurchases: [
      { kind: 'attribute', key: 'dexterity', from: 2, to: 3, cost: 15 },
      { kind: 'attribute', key: 'wits', from: 2, to: 3, cost: 15 },
      { kind: 'activation', key: 'reaction', from: 0, to: 1, cost: 5 },
      { kind: 'activation', key: 'endurance', from: 0, to: 1, cost: 5 },
    ],
    armor: 2, weapon: 'Кунай', x: 2, y: 8,
  },
  {
    id: 'miyo', name: 'Миё', role: 'Медик', color: '#bc94d5', clan: 'Бесклановый',
    description: 'Начинающий медик, который ищет человеческую причину каждого конфликта.',
    path: 'Не позволять страху решать, кому достанется помощь.',
    element: 'Вода', attributes: { ...baseAttributes, intelligence: 4 },
    startingSkills: miyoSkills, skills: { ...miyoSkills },
    specializations: [
      { skill: 'medicine', label: 'Первая помощь' },
      { skill: 'empathy', label: 'Страх' },
      { skill: 'academics', label: 'История деревень' },
    ],
    jutsu: { ...basicJutsu, mysticPalm: 1 },
    activationLevels: { reaction: 0, strength: 0, endurance: 1 },
    xp: 0, xpRemaining: 0, xpSpent: 40,
    xpPurchases: [
      { kind: 'attribute', key: 'intelligence', from: 2, to: 3, cost: 15 },
      { kind: 'attribute', key: 'intelligence', from: 3, to: 4, cost: 20 },
      { kind: 'activation', key: 'endurance', from: 0, to: 1, cost: 5 },
    ],
    armor: 2, weapon: 'Кунай', x: 3, y: 9,
  },
];

export const PRESETS = PARTY_PRESETS;

/** Return independent campaign actors; damage tracks store spent points. */
export function createParty() {
  return structuredClone(PARTY_PRESETS).map((unit) => ({
    ...unit,
    alive: true,
    hp: { surface: 0, critical: 0, max: 3 + unit.attributes.stamina },
    chakra: {
      surface: 0, critical: 0,
      max: unit.attributes.stamina + unit.attributes.resolve + unit.skills.chakraControl,
    },
    will: {
      surface: 0, critical: 0,
      max: unit.attributes.composure + unit.attributes.resolve,
    },
  }));
}
