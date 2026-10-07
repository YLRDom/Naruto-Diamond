import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraft, validateDraft, createHero, resourcesFor, upgradeCost } from '../src/creator.js';
import { CampaignGame } from '../src/game.js';
import { REGIONS } from '../src/world.js';
import { SaveStore } from '../src/saves.js';

test('all creator templates are legal and preserve exact starting skill distributions',()=>{
  for(const template of ['ren','sora','miyo']){
    const draft=createDraft(template),result=validateDraft(draft);
    assert.equal(result.ok,true,result.errors.join(';'));
    assert.equal(Object.values(draft.skills).filter(v=>v===2).length,9);
    assert.equal(Object.values(draft.skills).filter(v=>v===1).length,9);
    assert.ok(result.spent<=40);
    assert.equal(new Set(draft.specializations.map(s=>s.skill)).size,3);
  }
  assert.equal(upgradeCost(2,4,5),35);
});
test('creator refuses overspending, illegal skill counts, duplicate specializations and technique prerequisites',()=>{
  for(const change of [d=>d.attributes.strength=10,d=>d.skills.medicine=2,d=>d.specializations[1].skill=d.specializations[0].skill,d=>d.element='Вода',d=>d.advanced='mysticPalm',d=>d.appearance.skin='javascript:bad']){
    const draft=createDraft();change(draft);assert.equal(validateDraft(draft).ok,false);assert.throws(()=>createHero(draft));
  }
});
test('clan baseline ranks and passive resource multipliers are applied without charging free clan ranks',()=>{
  const d=createDraft();d.clan='nara';d.attributes.intelligence=3;
  assert.equal(validateDraft(d).spent,39);assert.equal(createHero(d).attributes.intelligence,3);
  const stats={stamina:2,resolve:3,composure:2},skills={chakraControl:2};
  assert.equal(resourcesFor(stats,skills,'senju').hp.max,7);
  assert.equal(resourcesFor(stats,skills,'senju').chakra.max,9);
  assert.equal(resourcesFor(stats,skills,'uchiha').chakra.max,9);
  assert.equal(resourcesFor(stats,skills,'sarutobi').will.max,8);
});
test('custom name, appearance, clan, training and resources survive a fresh-engine save roundtrip',()=>{
  const d=createDraft('miyo');d.name='Хикари';d.clan='senju';d.appearance.hairStyle='long';
  const game=new CampaignGame({hero:d,world:REGIONS[1],rng:()=>.7});
  assert.equal(game.state.party[0].name,'Хикари');assert.equal(game.state.party[0].hp.max,7);
  assert.equal(game.moveTo(12,7).ok,true);
  const restored=new CampaignGame({rng:()=>.7});assert.equal(restored.load(game.serialize()).ok,true);
  assert.equal(restored.world.id,'ruins');assert.deepEqual(restored.state.party,game.state.party);
  assert.equal(restored.state.party[0].appearance.hairStyle,'long');
  const save=restored.serialize();save.hero.name='Изменён';assert.equal(restored.heroSpec.name,'Хикари');
});
test('bad saved character or region leaves both state and world untouched',()=>{
  const game=new CampaignGame({hero:createDraft(),world:REGIONS[1]});const before=game.getSnapshot();
  for(const change of [s=>s.worldId='missing',s=>s.hero.attributes.dexterity=10,s=>s.state.party[0].hp.max=999]){
    const save=game.serialize();change(save);assert.equal(game.load(save).ok,false);assert.equal(game.world.id,'ruins');assert.deepEqual(game.state,before);
  }
});
test('every chapter has a reachable mission object and independently restorable scene state',()=>{
  for(const world of REGIONS){
    const game=new CampaignGame({hero:createDraft(),world,rng:()=>.7});
    assert.equal(game.moveTo(12,7).ok,true);assert.equal(game.resolvePeacefully().ok,true);
    assert.equal(game.moveTo(world.scroll.x,world.scroll.y+1).ok,true);
    assert.equal(game.collectScroll().ok,true);assert.equal(game.state.phase,'won');
    const fresh=new CampaignGame();assert.equal(fresh.load(game.serialize()).ok,true);assert.equal(fresh.world.id,world.id);
  }
});
test('barrier consumes main action and chakra, prevents movement, survives small hits and expires next turn',()=>{
  const game=new CampaignGame({rng:()=>.7});game.moveTo(9,7);game.startCombat();
  assert.equal(game.active.id,'sora');assert.equal(game.barrier().ok,true);
  assert.equal(game.active.actions.main,false);assert.equal(game.active.actions.movement,0);assert.equal(game.active.chakra.surface,1);
  assert.equal(game.moveTo(9,8).ok,false);const caster=game.active;
  const save=game.serialize();const copy=new CampaignGame({rng:()=>.7});assert.equal(copy.load(save).ok,true);assert.equal(copy.active.barrierHealth,1);
  game._damage(caster,{surface:2,critical:0});assert.equal(caster.hp.surface,0);assert.equal(caster.barrierHealth,1);
  for(let n=0;n<10&&game.state.phase==='combat';n++){if(game.active.team==='enemy')game.runEnemyTurn();else game.endTurn();if(game.active?.id==='sora')break;}
  assert.equal(game.active.id,'sora');assert.equal(game.active.barrierHealth,0);
});
test('manual slots and autosave are independent, deleted slots stay deleted, storage failures remain observable',()=>{
  const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},store=new SaveStore(storage);
  store.put('auto',{version:2,savedAt:2,progress:{chapter:0}});store.put('1',{version:2,savedAt:1,progress:{chapter:1}});
  assert.equal(store.list().length,2);assert.equal(store.list()[0].slot,'auto');
  store.remove('1');assert.equal(store.get('1'),null);assert.equal(store.get('auto').progress.chapter,0);
  assert.throws(()=>store.put('unknown',{}));
  const unavailable=new SaveStore({getItem:()=>null,setItem:()=>{throw new Error('quota');}});assert.throws(()=>unavailable.put('1',{version:2}),/quota/);
});
