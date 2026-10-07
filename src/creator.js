import { PARTY_PRESETS, ATTRIBUTE_LABELS, SKILL_LABELS } from './characters.js';

export const CLANS = {
  clanless: { name: 'Бесклановый', note: 'Свой путь без наследственных бонусов.' },
  nara: { name: 'Нара', note: 'Базовый Интеллект 3. Клан стратегов.' },
  sarutobi: { name: 'Сарутоби', note: 'Базовая Сила 3; Решимость удваивается в запасе воли.' },
  senju: { name: 'Сенджу', note: 'Выносливость удваивается в здоровье; Контроль чакры — в чакре.' },
  uchiha: { name: 'Учиха', note: 'Контроль чакры удваивается в запасе чакры. Шаринган требует отдельного развития.' },
  hyuga: { name: 'Хьюга', note: 'Контроль чакры удваивается в запасе чакры. Бьякуган пока не реализован.' },
};
export const ELEMENTS = ['Огонь', 'Вода', 'Земля', 'Ветер', 'Молния'];
export const ADVANCED = {
  fireball: { name: 'Великий огненный шар', requirement: 'Огонь · Решимость 3' },
  mysticPalm: { name: 'Мистическая ладонь', requirement: 'Интеллект 4' },
  barrier: { name: 'Барьер', requirement: 'Смекалка 3' },
};
export const APPEARANCE = {
  skin: ['#d2a27b', '#e8c8a1', '#b78059', '#84553f'],
  hair: ['#583a2b', '#262e31', '#c1a053', '#786086', '#d5d0bf'],
  outfit: ['#c49055', '#628d76', '#a083b7', '#618aa0', '#9d5651'],
};
const clone = value => structuredClone(value);
const int = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
export function baseAttributes(clan = 'clanless') {
  const attributes = Object.fromEntries(Object.keys(ATTRIBUTE_LABELS).map(key => [key, 2]));
  if (clan === 'nara') attributes.intelligence = 3;
  if (clan === 'sarutobi') attributes.strength = 3;
  return attributes;
}
export function createDraft(template = 'ren') {
  const p = PARTY_PRESETS.find(p => p.id === template) || PARTY_PRESETS[0];
  return { template: p.id, name: p.name, clan: 'clanless', element: p.element,
    path: p.path, attributes: clone(p.attributes), skills: clone(p.startingSkills),
    trainedSkills: clone(p.skills), activationLevels: clone(p.activationLevels),
    specializations: clone(p.specializations),
    advanced: p.jutsu.fireball ? 'fireball' : p.jutsu.mysticPalm ? 'mysticPalm' : 'barrier',
    appearance: { skin: APPEARANCE.skin[0], hair: APPEARANCE.hair[p.id === 'miyo' ? 3 : p.id === 'sora' ? 1 : 0], outfit: p.color, hairStyle: 'spiky' },
  };
}
export function upgradeCost(from, to, factor) {
  let cost = 0;
  for (let rank = from + 1; rank <= to; rank++) cost += rank * factor;
  return cost;
}
export function validateDraft(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return { ok: false, errors: ['Нет данных персонажа.'] };
  const d = input, base = baseAttributes(d.clan);
  if (!CLANS[d.clan]) errors.push('Выберите доступный клан.');
  if (typeof d.name !== 'string' || !d.name.trim() || d.name.trim().length > 28) errors.push('Имя: от 1 до 28 символов.');
  if (typeof d.path !== 'string' || d.path.trim().length < 8 || d.path.length > 220) errors.push('Опишите путь шиноби: 8–220 символов.');
  if (!ELEMENTS.includes(d.element)) errors.push('Выберите стихию.');
  let spent = 0;
  for (const key of Object.keys(base)) {
    const value = d.attributes?.[key];
    if (!int(value, base[key], 10)) errors.push(`Недопустимый атрибут: ${ATTRIBUTE_LABELS[key]}.`);
    else spent += upgradeCost(base[key], value, 5);
  }
  const skills = Object.keys(SKILL_LABELS).map(key => d.skills?.[key]);
  if (skills.filter(n => n === 2).length !== 9 || skills.filter(n => n === 1).length !== 9 || skills.some(n => !int(n, 0, 2))) errors.push('Нужно ровно 9 навыков уровня 2 и 9 уровня 1.');
  for (const key of Object.keys(SKILL_LABELS)) {
    const from = d.skills?.[key], to = d.trainedSkills?.[key];
    if (!int(to, Number.isInteger(from) ? from : 0, 10)) errors.push(`Недопустимая тренировка: ${SKILL_LABELS[key]}.`);
    else spent += upgradeCost(from, to, 3);
  }
  for (const key of ['reaction', 'strength', 'endurance']) {
    const value = d.activationLevels?.[key];
    if (!int(value, 0, Math.min(10, d.trainedSkills?.chakraControl ?? 0))) errors.push('Активация не может превышать Контроль чакры.');
    else spent += upgradeCost(0, value, 5);
  }
  if (spent > 40) errors.push(`Превышен бюджет: ${spent} из 40 опыта.`);
  const specs = d.specializations;
  if (!Array.isArray(specs) || specs.length !== 3 || new Set(specs.map(s => s?.skill)).size !== 3 || specs.some(s => !SKILL_LABELS[s?.skill] || !d.trainedSkills?.[s.skill] || typeof s.label !== 'string' || !s.label.trim() || s.label.length > 70)) errors.push('Нужны три специализации на разных изученных навыках.');
  if (!ADVANCED[d.advanced]) errors.push('Выберите продвинутую технику.');
  if (d.advanced === 'fireball' && (d.element !== 'Огонь' || d.attributes?.resolve < 3)) errors.push('Огненный шар требует Огонь и Решимость 3.');
  if (d.advanced === 'mysticPalm' && d.attributes?.intelligence < 4) errors.push('Мистическая ладонь требует Интеллект 4.');
  if (d.advanced === 'barrier' && d.attributes?.wits < 3) errors.push('Барьер требует Смекалку 3.');
  if (!d.appearance || !APPEARANCE.skin.includes(d.appearance.skin) || !APPEARANCE.hair.includes(d.appearance.hair) || ![...APPEARANCE.outfit, ...PARTY_PRESETS.map(p => p.color)].includes(d.appearance.outfit) || !['spiky','long','short'].includes(d.appearance.hairStyle)) errors.push('Выберите доступную внешность.');
  return { ok: errors.length === 0, errors: [...new Set(errors)], spent, remaining: 40 - spent };
}
export function resourcesFor(attributes, skills, clan = 'clanless') {
  const doubledControl = ['senju','uchiha','hyuga'].includes(clan);
  const maxima = {
    hp: 3 + attributes.stamina * (clan === 'senju' ? 2 : 1),
    chakra: attributes.stamina + attributes.resolve + skills.chakraControl * (doubledControl ? 2 : 1),
    will: attributes.composure + attributes.resolve * (clan === 'sarutobi' ? 2 : 1),
  };
  return Object.fromEntries(Object.entries(maxima).map(([key,max]) => [key,{surface:0,critical:0,max}]));
}
export function createHero(input) {
  const validation = validateDraft(input);
  if (!validation.ok) throw new Error(validation.errors.join(' '));
  const d = clone(input), role = d.advanced === 'fireball' ? 'Огневик' : d.advanced === 'mysticPalm' ? 'Медик' : 'Тактик';
  return { id:'ren', name:d.name.trim(), role, color:d.appearance.outfit, appearance:d.appearance,
    clan:CLANS[d.clan].name, clanId:d.clan, element:d.element, path:d.path.trim(),
    description:'Твой шиноби. Его решения станут историей этого отряда.',
    attributes:d.attributes, startingSkills:d.skills, skills:d.trainedSkills,
    specializations:d.specializations, activationLevels:d.activationLevels,
    jutsu:{clone:1,substitution:1,transformation:1,camouflage:1,scrollActivation:1,[d.advanced]:1},
    xp:validation.remaining,xpRemaining:validation.remaining,xpSpent:validation.spent,
    armor:2,weapon:'Кунай',alive:true,x:3,y:7,...resourcesFor(d.attributes,d.trainedSkills,d.clan),
  };
}
