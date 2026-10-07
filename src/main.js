import './styles.css';
import { CampaignGame } from './game.js';
import { MapRenderer } from './renderer.js';
import { REGIONS, distance } from './world.js';
import { CampaignUI } from './campaign-ui.js';
import { ActionAudio } from './audio.js';
import { CHAPTERS } from './campaign-data.js';
import { ATTRIBUTE_LABELS, SKILL_LABELS } from './characters.js';

const icon = {
  barrier:'<svg viewBox="0 0 24 24"><path d="M3 20V9l9-7 9 7v11M7 20V11l5-4 5 4v9M3 20h18" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  diamond:'<svg viewBox="0 0 32 32"><path d="m16 2 13 14-13 14L3 16Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m16 9 6 7-6 7-6-7Z" fill="currentColor"/></svg>',
  move:'<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18m-13-5 4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4m10-8 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  kunai:'<svg viewBox="0 0 24 24"><path d="m17 3 4 4-8 8-5-1-1-5Z" fill="currentColor"/><path d="m9 14-4 4" stroke="currentColor" stroke-width="2"/><circle cx="4" cy="20" r="2" fill="none" stroke="currentColor"/></svg>',
  fireball:'<svg viewBox="0 0 24 24"><path d="M13 2c2 7-3 7-2 11 3 0 5-3 5-5 5 5 6 13-4 14C2 21 2 15 6 9c0 4 2 4 2 4 0-5 3-7 5-11Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  clone:'<svg viewBox="0 0 24 24"><circle cx="14" cy="6" r="3" fill="none" stroke="currentColor"/><path d="M9 21v-6a5 5 0 0 1 10 0v6M5 20v-5c0-2 1-4 2-5M8 4a3 3 0 0 0 0 5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  activate:'<svg viewBox="0 0 24 24"><path d="m14 2-10 12h7l-1 8 10-12h-7Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  defend:'<svg viewBox="0 0 24 24"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m8 12 3 3 5-6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  heal:'<svg viewBox="0 0 24 24"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  scroll:'<svg viewBox="0 0 24 24"><path d="M7 4h12v13M7 4a3 3 0 0 0-3 3h4V4M7 4v16h10a3 3 0 0 0 3-3H9" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  save:'<svg viewBox="0 0 24 24"><path d="M4 3h13l3 3v15H4V3ZM8 3v6h8V3M8 21v-8h8v8" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  arrow:'<svg viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
};
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const portrait=(id,unit)=>`<span class="portrait ${id}" style="${unit?.appearance?`--custom-skin:${unit.appearance.skin};--custom-hair:${unit.appearance.hair};--custom-outfit:${unit.appearance.outfit}`:''}" aria-hidden="true"><span class="hair"></span><span class="face"></span><span class="headband">◇</span><span class="eyes">• &nbsp; •</span><span class="collar"></span></span>`;
const actionAudio=new ActionAudio();
let campaign,world=REGIONS[0],game,renderer,state,mode='move',hover=null,enemyTimer,toastTimer,dialogue=null,helpOpen=false,lastPhase='exploration',lastVisualRoll='';
const freshStory=()=>({started:false,metMentor:false,clue:false,crossed:false,approachResolved:false,peaceful:false,spokeSora:false,spokeMiyo:false});
let story=freshStory();

document.querySelector('#app').innerHTML=`<div class="shell">
<header class="header"><a class="brand" href="/" aria-label="Naruto Diamond">${icon.diamond}<span>NARUTO<span>DIAMOND</span></span></a><div class="chapter-label"><span class="chapter-line"></span>ГЛАВА I <span>·</span> НАЧАЛО ПУТИ</div><div class="header-buttons"><button id="game-menu" class="subtle-button">Меню</button><button id="camp-talk" class="subtle-button">Отряд</button><button id="save" class="subtle-button">${icon.save}<span>Сохранить</span></button><button id="load" class="subtle-button">Загрузить</button><button id="help" class="help-button" aria-label="Правила и управление">?</button></div></header>
<main><div class="page-heading"><div><div class="eyebrow">СТРАНА ОГНЯ <span>/</span> ГРАНИЦА КОНОХИ</div><h1>Где исчезает след<span>.</span></h1><p>Небольшой отряд. Пропавший курьер. Решения, у которых есть последствия.</p></div><div class="edition"><span>◇</span><div><strong>NARUTO DIAMOND</strong><small>2D НРИ · правила 0.6</small></div></div></div>
<div class="campaign-layout"><aside class="party-sidebar"><div class="section-title"><h2>Твой отряд</h2><span>03</span></div><div id="party" class="party-list"></div><section class="sheet-panel"><div class="section-title"><h2 id="selected-name">Рэн</h2><button id="character-sheet" class="text-button">Лист ↗</button></div><span class="label">ОСНОВНЫЕ АТРИБУТЫ</span><div id="attribute-preview" class="attribute-preview"></div><div class="path-note"><span class="label">ПУТЬ ШИНОБИ</span><p id="path-text"></p></div></section><div class="party-note"><span>忍</span><p>Не каждый бой нужно<br>выигрывать клинком.</p></div></aside>
<section class="map-column" aria-label="Игровая карта"><div class="map-toolbar"><span class="map-location"><i class="live-dot"></i>ТРОПА ТИХОЙ РЕКИ</span><div><span class="phase-badge" id="phase-badge">ИССЛЕДОВАНИЕ</span><button id="interact" class="interact-button">Действие <kbd>F</kbd></button></div></div><div class="map-stage" id="map-stage"><canvas id="map" tabindex="0" aria-label="Тактическая карта: клик по земле — движение, по персонажу — взаимодействие."></canvas><div id="map-hint" class="map-hint"></div><div id="initiative" class="initiative" hidden></div><div id="story-overlay" class="story-overlay"></div><div id="dialogue" class="dialogue" hidden></div><div class="map-coordinates"><span>ЛЕСНОЙ ПОСТ · 07</span><span id="map-coordinate">X 03 / Y 07</span></div></div><div class="turn-info"><div><i class="turn-dot" id="turn-dot"></i><strong id="turn-name">Свободное исследование</strong><span id="action-summary"></span></div><span id="round-label">СЦЕНА 01</span></div><div class="hotbar"><div class="hotbar-actions">${[['move','Движение','M'],['kunai','Кунай','1'],['fireball','Огненный шар','2'],['clone','Клон','3'],['activate','Активация','4'],['barrier','Барьер','7'],['defend','Уклонение','5'],['heal','Лечение','6']].map(([id,name,key])=>`<button class="action-button" id="action-${id}" data-action="${id}" aria-label="${name}" title="${name}"><span>${icon[id]}</span><kbd>${key}</kbd><small>${name}</small></button>`).join('')}</div><button class="end-turn" id="end-turn" disabled>Завершить ход ${icon.arrow}<kbd>SPACE</kbd></button></div><div class="action-detail" id="action-detail"><span>ИССЛЕДОВАНИЕ</span> Выбери шиноби и укажи место на карте.</div><div class="map-bottom"><span><kbd>WASD</kbd> шаг по клетке</span><span><kbd>F</kbd> действие</span><span><kbd>ESC</kbd> отмена</span><span>d10 · 6+ успех · 10 = 2</span></div></section>
<aside class="journal-sidebar"><section class="quest-panel"><div class="section-title"><h2>Журнал</h2><span class="rank-badge">РАНГ C</span></div><span class="quest-icon">${icon.scroll}</span><h3>Пропавший курьер</h3><p>Курьер не вернулся с лесного поста. Найди его свиток и узнай, кто перекрыл дорогу.</p><ol id="objectives"><li data-step="mentor"><i></i>Поговорить с дозорным</li><li data-step="bridge"><i></i>Пересечь Тихую реку</li><li data-step="bandits"><i></i>Разобраться с отступниками</li><li data-step="scroll"><i></i>Забрать запечатанный свиток</li></ol><div class="quest-footer"><span>ПОДХОД</span><strong id="approach-label">Выбор за тобой</strong></div></section><section class="dice-panel"><div class="section-title"><h2>Бросок судьбы</h2><span>d10</span></div><div id="dice-tray" class="dice-tray"><span class="empty-die">◇</span><p>Кубики решат, когда слова<br>и клинки встретятся.</p></div><div id="roll-description" class="roll-description">6–9 → 1 успех · 10 → 2</div></section><section class="log-panel"><div class="section-title"><h2>События</h2><i class="live-dot"></i></div><div id="event-log" class="event-log"></div></section></aside></div></main>
<footer><span>${icon.diamond} NARUTO DIAMOND <span class="footer-version">ПЕРВЫЙ ИГРОВОЙ ЭПИЗОД</span></span><span>Выбирай свой путь. Береги свой отряд.</span></footer></div>
<dialog id="rules-dialog"><button class="dialog-close" data-close="rules-dialog" aria-label="Закрыть">×</button><div class="eyebrow">NARUTO DIAMOND FANDOM RP 0.6</div><h2>Правила твоей истории</h2><p>Кампания из трёх глав по присланной НРИ. Весь справочник техник пока не реализован.</p><div class="rule-grid"><div><strong>Пулы d10</strong><p>Атрибут + навык. 1–5: провал; 6–9: успех; 10: два успеха. Специализация добавляет кубик.</p></div><div><strong>Пошаговый бой</strong><p>Инициатива: ловкость + смекалка. Основное и короткое действие. Уклонение бесплатно.</p></div><div><strong>Две шкалы</strong><p>Поверхностные и критические повреждения отдельно. Поверхностный урон от разницы успехов делится надвое вверх.</p></div><div><strong>Чакра и воля</strong><p>Критическая чакра требует столько же воли. Ресурсы не восстанавливаются автоматически.</p></div></div><div class="adaptation-note"><strong>Настройки компьютерной сцены</strong><p>Движение — 4 клетки за ход; кунай — 6; огненный шар — 5, радиус 1; лечение — соседняя клетка. Эти расстояния не заданы НРИ и выбраны для адаптации. Атаки нелетальные. Полный перечень правил и допущений — в docs/rules-scope.md.</p></div><p>Клик по земле — движение. Выбери атаку, затем противника. Для лечения выбери Миё и союзника рядом. Пробел завершает ход.</p><button class="primary-button" data-close="rules-dialog">Понятно ${icon.arrow}</button></dialog>
<dialog id="sheet-dialog"><button class="dialog-close" data-close="sheet-dialog" aria-label="Закрыть">×</button><div id="sheet-content"></div></dialog>
<dialog id="restart-dialog"><button class="dialog-close" data-close="restart-dialog" aria-label="Закрыть">×</button><div class="eyebrow">НОВАЯ ПОПЫТКА</div><h2>Начать эпизод заново?</h2><p>Текущий прогресс сбросится. Сохранённая игра останется доступной.</p><button id="confirm-restart" class="primary-button">Начать заново ${icon.arrow}</button><button class="text-button" data-close="restart-dialog">Вернуться</button></dialog><div id="toast" class="toast" role="status" hidden></div>`;

function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3600);}
function actor(){return state?.party.find(u=>u.id===state.selectedId)||state?.party[0];}
function canAct(){return story.started&&!campaign?.blocked&&!dialogue&&!helpOpen&&state?.phase==='combat'&&state.party.some(u=>u.id===state.activeId&&u.alive);}
function canPay(u,n){return u.chakra.max*2-u.chakra.surface-u.chakra.critical>=n;}
function perform(result){if(!result?.ok){toast(result?.reason||'Действие сейчас недоступно');return false;}render(game.getSnapshot());return true;}
function changed(snapshot){render(snapshot);if(campaign&&!campaign.blocked&&story.started&&!dialogue)campaign.autosave();}
function render(snapshot){
  state=snapshot;updateChapterUI();const u=actor();if(!u)return;
  $('party').innerHTML=state.party.map(p=>`<button class="party-card ${p.id===u.id?'selected':''} ${!p.alive?'downed':''}" data-unit="${p.id}" aria-pressed="${p.id===u.id}" style="--unit-color:${p.color}">${portrait(p.id,p)}<span class="party-card-info"><span class="party-name">${esc(p.name)}${p.id===state.activeId&&state.phase==='combat'?'<i class="active-turn-marker"></i>':''}</span><span class="party-role">${esc(p.role)} · ${p.alive?'Генин':'Без сознания'}</span><span class="health-dots">${Array.from({length:p.hp.max},(_,i)=>`<i class="${i<p.hp.critical?'critical':i<p.hp.critical+p.hp.surface?'surface-damage':''}"></i>`).join('')}</span><span class="party-resource">Ч ${Math.max(0,p.chakra.max-p.chakra.surface)}<span>/${p.chakra.max}</span> · В ${Math.max(0,p.will.max-p.will.surface)}<span>/${p.will.max}</span></span></span><span class="party-number">${state.party.indexOf(p)+1}</span></button>`).join('');
  $('selected-name').textContent=u.name;$('path-text').textContent=u.path;
  $('attribute-preview').innerHTML=['dexterity','wits','resolve','chakraControl'].map(k=>`<span>${ATTRIBUTE_LABELS[k]||SKILL_LABELS[k]}<strong>${u.attributes[k]??u.skills[k]}</strong></span>`).join('');
  $('phase-badge').textContent={exploration:'ИССЛЕДОВАНИЕ',combat:'ПОШАГОВЫЙ БОЙ',won:'МИССИЯ ВЫПОЛНЕНА',lost:'ОТРЯД ПОВЕРЖЕН'}[state.phase];$('phase-badge').classList.toggle('combat',state.phase==='combat');
  const active=[...state.party,...state.enemies].find(p=>p.id===state.activeId),a=active?.actions;
  $('turn-name').textContent=state.phase==='combat'?`Ход: ${active?.name||'…'}`:state.phase==='won'?'Свиток у твоего отряда':state.phase==='lost'?'Отряд без сознания':'Свободное исследование';
  $('action-summary').textContent=state.phase==='combat'?`${a?.main?'●':'○'} основное · ${a?.quick?'●':'○'} короткое · ${a?.movement??0} клетки`:'Отряд следует за выбранным шиноби';
  $('round-label').textContent=state.phase==='combat'?`РАУНД ${String(state.round).padStart(2,'0')}`:'СЦЕНА 01';$('turn-dot').classList.toggle('enemy-turn',active&&!state.party.some(p=>p.id===active.id));
  $('end-turn').disabled=!canAct();$('initiative').hidden=state.phase!=='combat';
  $('initiative').innerHTML=(state.order||[]).map(id=>{const p=[...state.party,...state.enemies].find(p=>p.id===id);return p?`<span class="initiative-token ${id===state.activeId?'active':''} ${!p.alive?'out':''}" style="--unit-color:${p.color||'#c9796c'}" title="${esc(p.name)}">${p.name[0]}</span>`:'';}).join('');
  for(const b of document.querySelectorAll('[data-action]')){
    const id=b.dataset.action;let off=!story.started||!!campaign?.blocked||!!dialogue||helpOpen||['won','lost'].includes(state.phase);
    if(id!=='move')off||=!canAct();
    if(id==='move'&&state.phase==='combat')off||=!canAct()||(a?.movement??0)<=0;
    if(['kunai','fireball','clone','barrier','defend','heal'].includes(id))off||=!a?.main;
    if(id==='fireball')off||=!u.jutsu.fireball||!canPay(u,2);
    if(id==='clone')off||=!canPay(u,1);
    if(id==='barrier')off||=!u.jutsu.barrier||!canPay(u,1);
    if(id==='heal')off||=!u.jutsu.mysticPalm||!canPay(u,1);
    if(id==='activate')off||=!a?.quick||!Object.entries(u.activationLevels).some(([k,v])=>v>0&&!u.activation[k])||!canPay(u,1);
    b.disabled=off;b.classList.toggle('selected',mode===id);
  }
  $('interact').disabled=!story.started||state.phase!=='exploration'||!!dialogue||helpOpen;$('save').disabled=!story.started||!!dialogue;
  if(state.party.some(p=>p.x>=12))story.crossed=true;
  const done={mentor:story.metMentor,bridge:story.crossed,bandits:state.questStage==='resolved',scroll:state.phase==='won'};
  for(const el of document.querySelectorAll('[data-step]'))el.classList.toggle('complete',!!done[el.dataset.step]);
  $('approach-label').textContent=story.peaceful?'Переговоры':story.approachResolved?'Боевая сцена':story.clue?'Следы найдены':'Выбор за тобой';
  renderRoll();$('event-log').innerHTML=state.log.slice(-5).reverse().map(e=>`<p class="log-entry ${esc(e.kind||'')}"><span>◇</span>${esc(e.text)}</p>`).join('')||'<p class="muted">Твоя история ещё не началась.</p>';
  if(state.phase!==lastPhase){if(lastPhase==='combat'&&state.phase==='exploration'){story.approachResolved=true;toast('Путь свободен. Забери свиток у старого поста.');}if(state.phase==='combat')mode='move';lastPhase=state.phase;}
  renderOverlay();renderMap();updateHint();scheduleEnemy();
}
function renderRoll(){const r=state.lastRoll;if(!r?.dice){$('dice-tray').innerHTML='<span class="empty-die">◇</span><p>Кубики решат, когда слова<br>и клинки встретятся.</p>';return;}$('dice-tray').innerHTML=`<div class="dice-label">${esc(r.label||'Проверка')}</div><div class="dice-row">${r.dice.map(v=>`<span class="die ${v===10?'crit':v>=6?'success':'failure'}">${v}</span>`).join('')}</div><div class="roll-total"><strong>${r.successes}</strong><span>успехов${r.difficulty?` / нужно ${r.difficulty}`:''}</span>${typeof r.success==='boolean'?`<b class="${r.success?'passed':'failed'}">${r.success?'УСПЕХ':'ПРОВАЛ'}</b>`:''}</div>${r.defenseDice?`<div class="defense-result">Защита: ${r.defenseSuccesses} <span>(${r.defenseDice.join(' · ')})</span></div>`:''}`;}
function definition(){return CHAPTERS.find(c=>c.id===world.id)||CHAPTERS[0];}
function updateChapterUI(){
  const c=definition();
  document.querySelector('.chapter-label').innerHTML=`<span class="chapter-line"></span>ГЛАВА ${c.number} <span>·</span> ПЕПЕЛ ПОД ЛИСТВОЙ`;
  document.querySelector('.page-heading h1').innerHTML=`${esc(c.title)}<span>.</span>`;
  document.querySelector('.page-heading p').textContent=c.subtitle;
  document.querySelector('.map-location').innerHTML=`<i class="live-dot"></i>${esc(c.location.toUpperCase())}`;
  document.querySelector('.quest-panel h3').textContent=c.quest;document.querySelector('.quest-panel>p').textContent=c.description;
  document.querySelector('[data-step=mentor]').innerHTML=`<i></i>Поговорить: ${esc(c.mentor)}`;
  document.querySelector('[data-step=bridge]').innerHTML=`<i></i>${c.id==='forest'?'Пересечь Тихую реку':'Добраться до восточной заставы'}`;
  document.querySelector('[data-step=scroll]').innerHTML=`<i></i>${esc(c.objective)}`;
  document.querySelector('.footer-version').textContent='КАМПАНИЯ · ВЕРСИЯ 0.2';
}
function renderOverlay(){
  const o=$('story-overlay'),key=!story.started?'intro':['won','lost'].includes(state.phase)?state.phase:'';if(o.dataset.key===key)return;o.dataset.key=key;o.hidden=!key;
  if(key==='intro')o.innerHTML=`<div class="intro-card"><span class="intro-emblem">忍</span><div class="eyebrow">ТВОЙ ПУТЬ ШИНОБИ</div><h2>История начинается<br>с одного решения<span>.</span></h2><p>Исследуй лесной пост, говори с людьми<br>и веди отряд в пошаговый бой.</p><button class="primary-button" id="begin">Начать историю ${icon.arrow}</button><span class="intro-footnote">Первый эпизод · три шиноби · одна миссия</span></div>`;
  else if(key)o.innerHTML=`<div class="intro-card result-card"><span class="intro-emblem">${key==='won'?'◇':'忍'}</span><div class="eyebrow">${esc(definition().quest.toUpperCase())}</div><h2>${key==='won'?'Миссия выполнена':'Путь ещё не окончен'}<span>.</span></h2><p>${key==='won'?(story.peaceful?'Отряд добился своего словами. Впереди — следующая часть истории.':'Столкновение решено. Доказательства у отряда; пора понять, что за ними скрывается.'):'Отряд потерял сознание. Попробуй другую тактику или загрузи сохранение.'}</p><div class="ending-note">${key==='won'?`Глава ${definition().number} завершена. ${campaign?.chapter===2?'Последний выбор ждёт тебя.':'История продолжается.'}`:'Клоны, активация и барьер помогают сохранить отряд.'}</div><button class="primary-button" id="new-campaign">${key==='won'?(campaign?.chapter===2?'Решить судьбу приказа':'Продолжить кампанию'):'Повторить главу'} →</button>${key==='lost'?'<button class="text-button" id="loss-load">Загрузить сохранение</button>':''}</div>`;
  if(key==='intro')$('begin').onclick=()=>{story.started=true;render(game.getSnapshot());openMentor();};
  if(key==='won')$('new-campaign').onclick=()=>campaign.completeChapter();
  if(key==='lost'){$('new-campaign').onclick=()=>{helpOpen=true;$('restart-dialog').showModal();};$('loss-load').onclick=()=>campaign.showSaves();}
}
function reachable(){
  return state.phase==='combat'&&canAct()&&mode==='move'?game.reachableCells():[];
}
function renderMap(){
  renderer?.draw(state,{mode,hover,reachable:reachable(),range:mode==='kunai'?6:mode==='heal'?1:5,showGrid:campaign?.settings.grid!==false});
  const r=state.lastRoll,key=JSON.stringify(r);
  if(renderer&&r&&key!==lastVisualRoll){
    lastVisualRoll=key;actionAudio.play(r.kind,campaign?.settings);
    const units=[...state.party,...state.enemies],from=units.find(u=>u.id===r.unitId);
    const targets=r.targets||[{targetId:r.targetId,hit:r.hit,damage:r.damage}];
    for(const target of targets){const to=units.find(u=>u.id===target.targetId);if(from&&to)renderer.effect({type:target.hit?'attack':'miss',from,to,text:target.hit?`−${(target.damage?.critical||0)+(target.damage?.surface||0)}`:'Уклонение',color:r.kind==='fireball'?'#f5ad6d':undefined});}
  }
}
function updateHint(){let t='Клик по земле — движение · Поговори с союзником у поста';if(story.metMentor)t='Доберись до восточного поста. Доказательства охраняют.';if(state.questStage==='resolved')t=`Путь свободен. Подойди к объекту «${definition().object}» и нажми F.`;if(state.phase==='combat')t=canAct()?'Выбери действие, затем цель. Пробел — завершить ход.':'Противник обдумывает свой ход…';if(state.phase==='won')t='Миссия выполнена';if(state.phase==='lost')t='Отряд повержен';$('map-hint').textContent=t;}
function scheduleEnemy(){if(enemyTimer||campaign?.blocked||dialogue||helpOpen||state.phase!=='combat'||!state.enemies.some(u=>u.id===state.activeId&&u.alive))return;enemyTimer=setTimeout(()=>{enemyTimer=null;if(!campaign?.blocked&&!dialogue&&!helpOpen&&game.state.phase==='combat')game.runEnemyTurn();},650);}
function chooseMode(id){
  if($(`action-${id}`).disabled)return;const u=actor();
  if(id==='clone'){perform(game.clone());mode='move';}else if(id==='barrier'){perform(game.barrier());mode='move';}else if(id==='defend'){perform(game.defend());mode='move';}else if(id==='activate'){const kind=['reaction','endurance','strength'].find(k=>u.activationLevels[k]>0&&!u.activation[k]);perform(game.activate(kind));mode='move';}else mode=id;
  const hints={barrier:'1 чакры · защитный барьер до следующего хода · нельзя двигаться',move:'Кликни по свободной клетке. Движение сохраняет основное действие.',kunai:`${u.attributes.dexterity+u.skills.shooting+(u.activation.reaction||0)}d10 · ловкость + стрельба${u.activation.reaction?' + активация':''} · дальность 6 клеток`,fireball:'Ручные печати + техника + специализация · 2 чакры · выбери противника; союзники в области тоже получают урон',clone:'1 чакры · один клон: +1d10 уклонения до первой атаки',activate:'1 чакры на сцену · короткое действие · усиление реакции или выносливости',defend:'+2d10 уклонения до следующего хода · основное действие',heal:'1 чакры · снимает 1 поверхностное повреждение · выбери союзника рядом'};
  $('action-detail').innerHTML=`<span>${esc($(`action-${id}`).getAttribute('aria-label')).toUpperCase()}</span> ${esc(hints[id])}`;render(game.getSnapshot());$('map').focus({preventScroll:true});
}
function onCell(cell){
  if(!story.started||campaign?.blocked||dialogue||helpOpen||['won','lost'].includes(state.phase))return;
  const ally=state.party.find(u=>u.x===cell.x&&u.y===cell.y&&u.alive),enemy=state.enemies.find(u=>u.x===cell.x&&u.y===cell.y&&u.alive);
  if(ally){if(mode==='heal'&&canAct())perform(game.heal(ally.id));else if(game.selectUnit(ally.id))render(game.getSnapshot());else toast('Сейчас ход другого участника.');return;}
  if(enemy&&state.phase==='combat'){if(!canAct())return;if(mode==='fireball')perform(game.fireball(enemy.id));else if(mode==='kunai')perform(game.attack(enemy.id,'kunai'));else{mode='kunai';render(game.getSnapshot());toast('Кунай выбран. Кликни по противнику ещё раз.');}return;}
  if(state.phase==='exploration'&&cell.x===world.npc.x&&cell.y===world.npc.y){interact('mentor');return;}
  if(state.phase==='exploration'&&cell.x===world.scroll.x&&cell.y===world.scroll.y){interact('scroll');return;}
  if(state.phase==='exploration'&&enemy){if(distance(actor(),enemy)<=6)openBandits();else toast('Подойди ближе к лесному посту.');return;}
  if(mode!=='move'&&state.phase==='combat'){toast('Выбери цель или переключись на движение.');return;}
  if(perform(game.moveTo(cell.x,cell.y))){$('map').focus({preventScroll:true});checkApproach();}
}
function checkApproach(){if(state.phase==='exploration'&&!story.approachResolved&&actor().x>=12)openBandits();}
function interact(type){if(state.phase!=='exploration'||dialogue)return;const u=actor();if(type==='mentor'||(!type&&distance(u,world.npc)<=3)){if(distance(u,world.npc)>3){toast('Подойди ближе к дозорному.');return;}openMentor();return;}if(type==='scroll'||(!type&&distance(u,world.scroll)<=1)){perform(game.collectScroll());return;}if(!story.approachResolved&&u.x>=11){openBandits();return;}toast('Рядом нет взаимодействия. Подойди к дозорному или свитку.');}
function say(speaker,subtitle,text,choices){dialogue={choices};$('dialogue').hidden=false;$('dialogue').innerHTML=`<div class="dialogue-speaker"><span class="speaker-avatar ${speaker==='Дозорный'?'mentor':'bandit'}">${speaker==='Дозорный'?'守':'忍'}</span><div><span class="label">${esc(subtitle)}</span><strong>${esc(speaker)}</strong></div><span class="dialogue-icon">◇</span></div><p>${esc(text)}</p><div class="dialogue-choices">${choices.map((c,i)=>`<button data-choice="${i}"><span class="choice-number">${i+1}</span><span>${esc(c.label)}</span>${icon.arrow}</button>`).join('')}</div>`;render(game.getSnapshot());}
function closeDialogue(){dialogue=null;$('dialogue').hidden=true;render(game.getSnapshot());campaign?.autosave();$('map').focus({preventScroll:true});}
function openMentor(){
  story.metMentor=true;const c=definition();say(c.mentor,'ПЕПЕЛ ПОД ЛИСТВОЙ · ГЛАВА '+c.number,c.briefing,[
    {label:'Расскажи подробнее.',run:()=>say(c.mentor,'ЧТО СКРЫВАЕТ ПРИКАЗ',c.information,[{label:'Спасибо. Мы разберёмся.',run:()=>{campaign?.record('trust');closeDialogue();}}])},
    {label:`[Смекалка + Внимательность · 2 успеха] Осмотреть улики — ${actor().name}`,run:()=>{const r=game.skillCheck(actor().id,'wits','awareness',2);story.clue=r.success??r.successes>=2;if(story.clue)campaign?.record('evidence');say(c.mentor,story.clue?'УЛИКА НАЙДЕНА':'СЛЕДЫ НЕ ПРОЧИТАНЫ',story.clue?c.clue:'Следов слишком мало. Придётся узнать больше у тех, кто охраняет восточный пост.',[{label:'Отправляемся.',run:closeDialogue}]);}},
    {label:'Мы готовы. Отправляемся.',run:closeDialogue},
  ]);
}
function openBandits(){
  if(story.approachResolved||state.phase!=='exploration')return;const u=actor(),c=definition();
  const difficulty=c.difficulty-(c.id==='archive'&&campaign?.flags.evidence?1:0);
  say(c.enemy,'ВОСТОЧНЫЙ ПОСТ · '+c.location.toUpperCase(),c.confrontation,[
    {label:`[Харизма + Убеждение · ${difficulty} успеха] ${c.persuasion} — ${u.name}`,run:()=>{const r=game.skillCheck(u.id,'charisma','persuasion',difficulty,{specialization:u.id==='ren'?'Переговоры о миссии':null}),ok=r.success??r.successes>=difficulty;if(ok){story.approachResolved=true;story.peaceful=true;campaign?.record('mercy');perform(game.resolvePeacefully());say(c.enemy,'ПРОВЕРКА ПРОЙДЕНА',c.peace,[{label:'Мы выполним обещание.',run:closeDialogue}]);}else say(c.enemy,'ПРОВЕРКА ПРОВАЛЕНА','Твоих слов недостаточно. Приказ придётся оспаривать в бою.',[{label:'Приготовиться к бою.',run:()=>beginCombat(false)}]);}},
    {label:`[Ловкость + Скрытность · 3 успеха] Подготовить засаду — ${u.name}`,run:()=>{const r=game.skillCheck(u.id,'dexterity','stealth',3,{specialization:u.id==='sora'?'Лес':null}),ok=r.success??r.successes>=3;say(ok?'Твой отряд':c.enemy,ok?'ЗАСАДА ПОДГОТОВЛЕНА':'ТЕБЯ ЗАМЕТИЛИ',ok?'Твой отряд готов. В первом раунде атаки пройдут против сложности 1 без уклонения противников.':'Засада сорвалась. Противники готовятся к бою.',[{label:'Начать бой.',run:()=>beginCombat(ok)}]);}},
    {label:'[Без проверки] Вернуть доказательства силой.',run:()=>beginCombat(false)},
  ]);
}
function talkCompanions(){
  if(state.phase!=='exploration'||dialogue)return;const name=state.party[0].name;
  say('Твой отряд','СОРА И МИЁ','Перед следующей дорогой есть время поговорить. Что ты хочешь спросить?',[
    {label:'Сора, почему ты идёшь со мной?',run:()=>say('Сора','ПУТЬ РАЗВЕДЧИКА',`${name}, я хочу знать, что за каждым приказом есть человек. Я не всегда согласен с тобой, но хочу, чтобы ты слышал меня.`,[{label:'Я буду слушать. Решения примем вместе.',run:()=>{if(!story.spokeSora){campaign?.record('trust');story.spokeSora=true;}closeDialogue();}}])},
    {label:'Миё, чего ты ждёшь от этой миссии?',run:()=>say('Миё','ПУТЬ МЕДИКА','Я хочу, чтобы лекарства вернулись тем, кому нужны. Когда мы дерёмся, я вижу раны по обе стороны. Не прошу избегать любого боя — только помнить о его цене.',[{label:'Мы попробуем сохранить жизни.',run:()=>{if(!story.spokeMiyo){campaign?.record('trust');story.spokeMiyo=true;}closeDialogue();}}])},
    {label:'Пора двигаться дальше.',run:closeDialogue},
  ]);
}
function beginCombat(advantage){story.approachResolved=true;dialogue=null;$('dialogue').hidden=true;mode='move';perform(game.startCombat({advantage}));$('map').focus({preventScroll:true});}
function showSheet(){const u=actor();$('sheet-content').innerHTML=`<div class="sheet-header">${portrait(u.id,u)}<div><div class="eyebrow">ГЕНИН · ${esc(u.clan)} · ${esc(u.element)}</div><h2>${esc(u.name)} <span>${esc(u.role)}</span></h2><p>${esc(u.description)}</p></div></div><div class="sheet-resources">${[['hp','Здоровье'],['chakra','Чакра'],['will','Воля']].map(([k,label])=>`<div><strong>${label} · ${u[k].max}</strong><span>Поверхностные: ${u[k].surface}/${u[k].max}</span><span>Критические: ${u[k].critical}/${u[k].max}</span></div>`).join('')}</div><h3>Атрибуты</h3><div class="full-attributes">${Object.entries(ATTRIBUTE_LABELS).map(([k,label])=>`<span>${label}<b>${u.attributes[k]}</b></span>`).join('')}</div><h3>Навыки</h3><div class="full-skills">${Object.entries(SKILL_LABELS).map(([k,label])=>`<span>${label}<b>${u.skills[k]}</b></span>`).join('')}</div><h3>Специализации</h3><p>${u.specializations.map(s=>`${SKILL_LABELS[s.skill]}: ${esc(s.label)}`).join(' · ')}</p><h3>Путь шиноби</h3><p>${esc(u.path)}</p><p class="muted">На старте 40 опыта; потрачено ${u.xpSpent}; осталось ${u.xpRemaining}. Все базовые дзюцу уровня 1. В версии 0.2 доступна часть изученных техник.</p>`;helpOpen=true;$('sheet-dialog').showModal();render(game.getSnapshot());}

document.addEventListener('click',e=>{
  const u=e.target.closest('[data-unit]');if(u&&!dialogue&&!helpOpen){if(mode==='heal'&&canAct())perform(game.heal(u.dataset.unit));else if(game.selectUnit(u.dataset.unit))render(game.getSnapshot());else toast('Во время боя управлять можно только текущим участником.');}
  const c=e.target.closest('[data-choice]');if(c&&dialogue)dialogue.choices[Number(c.dataset.choice)].run();
  const a=e.target.closest('[data-action]');if(a&&!a.disabled)chooseMode(a.dataset.action);
  const close=e.target.closest('[data-close]');if(close)$(close.dataset.close).close();
});
$('interact').onclick=()=>interact();$('end-turn').onclick=()=>{mode='move';perform(game.endTurn());};$('character-sheet').onclick=showSheet;
$('help').onclick=()=>{helpOpen=true;$('rules-dialog').showModal();render(game.getSnapshot());};
for(const id of ['rules-dialog','sheet-dialog','restart-dialog'])$(id).addEventListener('close',()=>{helpOpen=false;render(game.getSnapshot());$('map').focus({preventScroll:true});});
$('save').onclick=()=>campaign.save('1');
$('game-menu').onclick=()=>campaign.showMenu();$('camp-talk').onclick=talkCompanions;
$('load').onclick=()=>campaign.showSaves();
$('confirm-restart').onclick=()=>{clearTimeout(enemyTimer);enemyTimer=null;story={...freshStory(),started:true};dialogue=null;mode='move';lastPhase='exploration';$('dialogue').hidden=true;$('restart-dialog').close();game.restart();render(game.getSnapshot());openMentor();};
document.addEventListener('keydown',e=>{
  if(campaign?.blocked||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||!story.started)return;
  if(dialogue){if(/^[1-4]$/.test(e.key)){const c=dialogue.choices[Number(e.key)-1];if(c){e.preventDefault();c.run();}}return;}
  const actions={m:'move','1':'kunai','2':'fireball','3':'clone','4':'activate','5':'defend','6':'heal','7':'barrier'};if(actions[e.key.toLowerCase()]){e.preventDefault();chooseMode(actions[e.key.toLowerCase()]);return;}
  if(e.key==='Escape'){if(mode!=='move'){mode='move';render(game.getSnapshot());}else campaign.showMenu();return;}if(e.code==='Space'&&canAct()){e.preventDefault();mode='move';perform(game.endTurn());return;}if(e.key.toLowerCase()==='f'){e.preventDefault();interact();return;}
  const d={w:[0,-1],a:[-1,0],s:[0,1],d:[1,0],ArrowUp:[0,-1],ArrowLeft:[-1,0],ArrowDown:[0,1],ArrowRight:[1,0]}[e.key]||{w:[0,-1],a:[-1,0],s:[0,1],d:[1,0]}[e.key.toLowerCase()];if(d&&['exploration','combat'].includes(state.phase)){e.preventDefault();const u=actor();if(perform(game.moveTo(u.x+d[0],u.y+d[1])))checkApproach();}
});
game=new CampaignGame({onChange:changed});renderer=new MapRenderer($('map'),{onCell,onHover:cell=>{hover=cell;$('map-coordinate').textContent=cell?`X ${String(cell.x).padStart(2,'0')} / Y ${String(cell.y).padStart(2,'0')}`:'ТРОПА ТИХОЙ РЕКИ';renderMap();}});render(game.getSnapshot());
campaign=new CampaignUI({
  toast,
  onBlocked:()=>{clearTimeout(enemyTimer);enemyTimer=null;},
  onResume:()=>{renderer.resize();render(game.getSnapshot());$('map').focus({preventScroll:true});},
  onBriefing:openMentor,
  onStart:(hero,chapter)=>{
    clearTimeout(enemyTimer);enemyTimer=null;world=REGIONS[chapter];story={...freshStory(),started:true};dialogue=null;$('dialogue').hidden=true;mode='move';lastPhase='exploration';lastVisualRoll='';delete $('story-overlay').dataset.key;
    game=new CampaignGame({hero,world,onChange:changed});render(game.getSnapshot());
  },
  getSave:()=>({campaign:game.serialize(),story:structuredClone(story)}),
  onLoad:data=>{
    if(!data.story||Object.keys(freshStory()).some(key=>typeof data.story[key]!=='boolean'))return{ok:false,reason:'Повреждены события истории.'};
    const candidate=new CampaignGame({onChange:()=>{}});const result=candidate.load(data.campaign);if(!result.ok)return result;
    clearTimeout(enemyTimer);enemyTimer=null;game=candidate;game.onChange=changed;world=game.world;story=structuredClone(data.story);dialogue=null;$('dialogue').hidden=true;mode='move';lastPhase=game.state.phase;lastVisualRoll='';delete $('story-overlay').dataset.key;return{ok:true};
  },
  onSettings:()=>renderMap(),
});
window.addEventListener('pagehide',()=>{clearTimeout(enemyTimer);renderer.destroy();campaign.clear();});
