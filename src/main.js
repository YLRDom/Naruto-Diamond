import './styles.css';
import { CampaignGame } from './game.js';
import { MapRenderer } from './renderer.js';
import { WORLD, distance } from './world.js';
import { ATTRIBUTE_LABELS, SKILL_LABELS } from './characters.js';

const icon = {
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
const portrait=id=>`<span class="portrait ${id}" aria-hidden="true"><span class="hair"></span><span class="face"></span><span class="headband">◇</span><span class="eyes">• &nbsp; •</span><span class="collar"></span></span>`;
let game,renderer,state,mode='move',hover=null,enemyTimer,toastTimer,dialogue=null,helpOpen=false,lastPhase='exploration',lastVisualRoll='';
const freshStory=()=>({started:false,metMentor:false,clue:false,approachResolved:false,peaceful:false});
let story=freshStory();

document.querySelector('#app').innerHTML=`<div class="shell">
<header class="header"><a class="brand" href="/" aria-label="Naruto Diamond">${icon.diamond}<span>NARUTO<span>DIAMOND</span></span></a><div class="chapter-label"><span class="chapter-line"></span>ГЛАВА I <span>·</span> НАЧАЛО ПУТИ</div><div class="header-buttons"><button id="save" class="subtle-button">${icon.save}<span>Сохранить</span></button><button id="load" class="subtle-button">Загрузить</button><button id="help" class="help-button" aria-label="Правила и управление">?</button></div></header>
<main><div class="page-heading"><div><div class="eyebrow">СТРАНА ОГНЯ <span>/</span> ГРАНИЦА КОНОХИ</div><h1>Где исчезает след<span>.</span></h1><p>Небольшой отряд. Пропавший курьер. Решения, у которых есть последствия.</p></div><div class="edition"><span>◇</span><div><strong>NARUTO DIAMOND</strong><small>2D НРИ · правила 0.6</small></div></div></div>
<div class="campaign-layout"><aside class="party-sidebar"><div class="section-title"><h2>Твой отряд</h2><span>03</span></div><div id="party" class="party-list"></div><section class="sheet-panel"><div class="section-title"><h2 id="selected-name">Рэн</h2><button id="character-sheet" class="text-button">Лист ↗</button></div><span class="label">ОСНОВНЫЕ АТРИБУТЫ</span><div id="attribute-preview" class="attribute-preview"></div><div class="path-note"><span class="label">ПУТЬ ШИНОБИ</span><p id="path-text"></p></div></section><div class="party-note"><span>忍</span><p>Не каждый бой нужно<br>выигрывать клинком.</p></div></aside>
<section class="map-column" aria-label="Игровая карта"><div class="map-toolbar"><span class="map-location"><i class="live-dot"></i>ТРОПА ТИХОЙ РЕКИ</span><div><span class="phase-badge" id="phase-badge">ИССЛЕДОВАНИЕ</span><button id="interact" class="interact-button">Действие <kbd>F</kbd></button></div></div><div class="map-stage" id="map-stage"><canvas id="map" tabindex="0" aria-label="Тактическая карта: клик по земле — движение, по персонажу — взаимодействие."></canvas><div id="map-hint" class="map-hint"></div><div id="initiative" class="initiative" hidden></div><div id="story-overlay" class="story-overlay"></div><div id="dialogue" class="dialogue" hidden></div><div class="map-coordinates"><span>ЛЕСНОЙ ПОСТ · 07</span><span id="map-coordinate">X 03 / Y 07</span></div></div><div class="turn-info"><div><i class="turn-dot" id="turn-dot"></i><strong id="turn-name">Свободное исследование</strong><span id="action-summary"></span></div><span id="round-label">СЦЕНА 01</span></div><div class="hotbar"><div class="hotbar-actions">${[['move','Движение','M'],['kunai','Кунай','1'],['fireball','Огненный шар','2'],['clone','Клон','3'],['activate','Активация','4'],['defend','Уклонение','5'],['heal','Лечение','6']].map(([id,name,key])=>`<button class="action-button" id="action-${id}" data-action="${id}" aria-label="${name}" title="${name}"><span>${icon[id]}</span><kbd>${key}</kbd><small>${name}</small></button>`).join('')}</div><button class="end-turn" id="end-turn" disabled>Завершить ход ${icon.arrow}<kbd>SPACE</kbd></button></div><div class="action-detail" id="action-detail"><span>ИССЛЕДОВАНИЕ</span> Выбери шиноби и укажи место на карте.</div><div class="map-bottom"><span><kbd>WASD</kbd> шаг по клетке</span><span><kbd>F</kbd> действие</span><span><kbd>ESC</kbd> отмена</span><span>d10 · 6+ успех · 10 = 2</span></div></section>
<aside class="journal-sidebar"><section class="quest-panel"><div class="section-title"><h2>Журнал</h2><span class="rank-badge">РАНГ C</span></div><span class="quest-icon">${icon.scroll}</span><h3>Пропавший курьер</h3><p>Курьер не вернулся с лесного поста. Найди его свиток и узнай, кто перекрыл дорогу.</p><ol id="objectives"><li data-step="mentor"><i></i>Поговорить с дозорным</li><li data-step="bridge"><i></i>Пересечь Тихую реку</li><li data-step="bandits"><i></i>Разобраться с отступниками</li><li data-step="scroll"><i></i>Забрать запечатанный свиток</li></ol><div class="quest-footer"><span>ПОДХОД</span><strong id="approach-label">Выбор за тобой</strong></div></section><section class="dice-panel"><div class="section-title"><h2>Бросок судьбы</h2><span>d10</span></div><div id="dice-tray" class="dice-tray"><span class="empty-die">◇</span><p>Кубики решат, когда слова<br>и клинки встретятся.</p></div><div id="roll-description" class="roll-description">6–9 → 1 успех · 10 → 2</div></section><section class="log-panel"><div class="section-title"><h2>События</h2><i class="live-dot"></i></div><div id="event-log" class="event-log"></div></section></aside></div></main>
<footer><span>${icon.diamond} NARUTO DIAMOND <span class="footer-version">ПЕРВЫЙ ИГРОВОЙ ЭПИЗОД</span></span><span>Выбирай свой путь. Береги свой отряд.</span></footer></div>
<dialog id="rules-dialog"><button class="dialog-close" data-close="rules-dialog" aria-label="Закрыть">×</button><div class="eyebrow">NARUTO DIAMOND FANDOM RP 0.6</div><h2>Правила твоей истории</h2><p>Первый эпизод 2D-ролевой игры по присланной НРИ. Весь справочник техник пока не реализован.</p><div class="rule-grid"><div><strong>Пулы d10</strong><p>Атрибут + навык. 1–5: провал; 6–9: успех; 10: два успеха. Специализация добавляет кубик.</p></div><div><strong>Пошаговый бой</strong><p>Инициатива: ловкость + смекалка. Основное и короткое действие. Уклонение бесплатно.</p></div><div><strong>Две шкалы</strong><p>Поверхностные и критические повреждения отдельно. Поверхностный урон от разницы успехов делится надвое вверх.</p></div><div><strong>Чакра и воля</strong><p>Критическая чакра требует столько же воли. Ресурсы не восстанавливаются автоматически.</p></div></div><div class="adaptation-note"><strong>Настройки компьютерной сцены</strong><p>Движение — 4 клетки за ход; кунай — 6; огненный шар — 5, радиус 1; лечение — соседняя клетка. Эти расстояния не заданы НРИ и выбраны для адаптации. Атаки нелетальные. Полный перечень правил и допущений — в docs/rules-scope.md.</p></div><p>Клик по земле — движение. Выбери атаку, затем противника. Для лечения выбери Миё и союзника рядом. Пробел завершает ход.</p><button class="primary-button" data-close="rules-dialog">Понятно ${icon.arrow}</button></dialog>
<dialog id="sheet-dialog"><button class="dialog-close" data-close="sheet-dialog" aria-label="Закрыть">×</button><div id="sheet-content"></div></dialog>
<dialog id="restart-dialog"><button class="dialog-close" data-close="restart-dialog" aria-label="Закрыть">×</button><div class="eyebrow">НОВАЯ ПОПЫТКА</div><h2>Начать эпизод заново?</h2><p>Текущий прогресс сбросится. Сохранённая игра останется доступной.</p><button id="confirm-restart" class="primary-button">Начать заново ${icon.arrow}</button><button class="text-button" data-close="restart-dialog">Вернуться</button></dialog><div id="toast" class="toast" role="status" hidden></div>`;

function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3600);}
function actor(){return state?.party.find(u=>u.id===state.selectedId)||state?.party[0];}
function canAct(){return story.started&&!dialogue&&!helpOpen&&state?.phase==='combat'&&state.party.some(u=>u.id===state.activeId&&u.alive);}
function canPay(u,n){return u.chakra.max*2-u.chakra.surface-u.chakra.critical>=n;}
function perform(result){if(!result?.ok){toast(result?.reason||'Действие сейчас недоступно');return false;}render(game.getSnapshot());return true;}
function render(snapshot){
  state=snapshot;const u=actor();if(!u)return;
  $('party').innerHTML=state.party.map(p=>`<button class="party-card ${p.id===u.id?'selected':''} ${!p.alive?'downed':''}" data-unit="${p.id}" aria-pressed="${p.id===u.id}" style="--unit-color:${p.color}">${portrait(p.id)}<span class="party-card-info"><span class="party-name">${esc(p.name)}${p.id===state.activeId&&state.phase==='combat'?'<i class="active-turn-marker"></i>':''}</span><span class="party-role">${esc(p.role)} · ${p.alive?'Генин':'Без сознания'}</span><span class="health-dots">${Array.from({length:p.hp.max},(_,i)=>`<i class="${i<p.hp.critical?'critical':i<p.hp.critical+p.hp.surface?'surface-damage':''}"></i>`).join('')}</span><span class="party-resource">Ч ${Math.max(0,p.chakra.max-p.chakra.surface)}<span>/${p.chakra.max}</span> · В ${Math.max(0,p.will.max-p.will.surface)}<span>/${p.will.max}</span></span></span><span class="party-number">${state.party.indexOf(p)+1}</span></button>`).join('');
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
    const id=b.dataset.action;let off=!story.started||!!dialogue||helpOpen||['won','lost'].includes(state.phase);
    if(id!=='move')off||=!canAct();
    if(id==='move'&&state.phase==='combat')off||=!canAct()||(a?.movement??0)<=0;
    if(['kunai','fireball','clone','defend','heal'].includes(id))off||=!a?.main;
    if(id==='fireball')off||=!u.jutsu.fireball||!canPay(u,2);
    if(id==='clone')off||=!canPay(u,1);
    if(id==='heal')off||=!u.jutsu.mysticPalm||!canPay(u,1);
    if(id==='activate')off||=!a?.quick||!Object.entries(u.activationLevels).some(([k,v])=>v>0&&!u.activation[k])||!canPay(u,1);
    b.disabled=off;b.classList.toggle('selected',mode===id);
  }
  $('interact').disabled=!story.started||state.phase!=='exploration'||!!dialogue||helpOpen;$('save').disabled=!story.started||!!dialogue;
  const done={mentor:story.metMentor,bridge:state.party.some(p=>p.x>=12),bandits:state.questStage==='resolved',scroll:state.phase==='won'};
  for(const el of document.querySelectorAll('[data-step]'))el.classList.toggle('complete',!!done[el.dataset.step]);
  $('approach-label').textContent=story.peaceful?'Переговоры':story.approachResolved?'Боевая сцена':story.clue?'Следы найдены':'Выбор за тобой';
  renderRoll();$('event-log').innerHTML=state.log.slice(-5).reverse().map(e=>`<p class="log-entry ${esc(e.kind||'')}"><span>◇</span>${esc(e.text)}</p>`).join('')||'<p class="muted">Твоя история ещё не началась.</p>';
  if(state.phase!==lastPhase){if(lastPhase==='combat'&&state.phase==='exploration'){story.approachResolved=true;toast('Путь свободен. Забери свиток у старого поста.');}if(state.phase==='combat')mode='move';lastPhase=state.phase;}
  renderOverlay();renderMap();updateHint();scheduleEnemy();
}
function renderRoll(){const r=state.lastRoll;if(!r?.dice){$('dice-tray').innerHTML='<span class="empty-die">◇</span><p>Кубики решат, когда слова<br>и клинки встретятся.</p>';return;}$('dice-tray').innerHTML=`<div class="dice-label">${esc(r.label||'Проверка')}</div><div class="dice-row">${r.dice.map(v=>`<span class="die ${v===10?'crit':v>=6?'success':'failure'}">${v}</span>`).join('')}</div><div class="roll-total"><strong>${r.successes}</strong><span>успехов${r.difficulty?` / нужно ${r.difficulty}`:''}</span>${typeof r.success==='boolean'?`<b class="${r.success?'passed':'failed'}">${r.success?'УСПЕХ':'ПРОВАЛ'}</b>`:''}</div>${r.defenseDice?`<div class="defense-result">Защита: ${r.defenseSuccesses} <span>(${r.defenseDice.join(' · ')})</span></div>`:''}`;}
function renderOverlay(){
  const o=$('story-overlay'),key=!story.started?'intro':['won','lost'].includes(state.phase)?state.phase:'';if(o.dataset.key===key)return;o.dataset.key=key;o.hidden=!key;
  if(key==='intro')o.innerHTML=`<div class="intro-card"><span class="intro-emblem">忍</span><div class="eyebrow">ТВОЙ ПУТЬ ШИНОБИ</div><h2>История начинается<br>с одного решения<span>.</span></h2><p>Исследуй лесной пост, говори с людьми<br>и веди отряд в пошаговый бой.</p><button class="primary-button" id="begin">Начать историю ${icon.arrow}</button><span class="intro-footnote">Первый эпизод · три шиноби · одна миссия</span></div>`;
  else if(key)o.innerHTML=`<div class="intro-card result-card"><span class="intro-emblem">${key==='won'?'◇':'忍'}</span><div class="eyebrow">${key==='won'?'ПРОПАВШИЙ КУРЬЕР':'КОНЕЦ ЭТОЙ ПОПЫТКИ'}</div><h2>${key==='won'?'Свиток возвращён':'Путь ещё не окончен'}<span>.</span></h2><p>${key==='won'?(story.peaceful?'Отряд добился своего словами. Иногда это и есть самая сильная техника.':'Лесной пост свободен. Запечатанный свиток вернётся в Коноху.'):'Отряд потерял сознание. Новая попытка — шанс выбрать другую тактику.'}</p><div class="ending-note">${key==='won'?'Первый эпизод завершён. Продолжение кампании пока не реализовано.':'Попробуй разведку, активацию и уклонение.'}</div><button class="primary-button" id="new-campaign">Начать заново ${icon.arrow}</button></div>`;
  if(key==='intro')$('begin').onclick=()=>{story.started=true;render(game.getSnapshot());openMentor();};
  if(['won','lost'].includes(key))$('new-campaign').onclick=()=>{helpOpen=true;$('restart-dialog').showModal();};
}
function reachable(){
  return state.phase==='combat'&&canAct()&&mode==='move'?game.reachableCells():[];
}
function renderMap(){
  renderer?.draw(state,{mode,hover,reachable:reachable(),range:mode==='kunai'?6:mode==='heal'?1:5});
  const r=state.lastRoll,key=JSON.stringify(r);
  if(renderer&&r&&key!==lastVisualRoll){
    lastVisualRoll=key;
    const units=[...state.party,...state.enemies],from=units.find(u=>u.id===r.unitId);
    const targets=r.targets||[{targetId:r.targetId,hit:r.hit,damage:r.damage}];
    for(const target of targets){const to=units.find(u=>u.id===target.targetId);if(from&&to)renderer.effect({type:target.hit?'attack':'miss',from,to,text:target.hit?`−${(target.damage?.critical||0)+(target.damage?.surface||0)}`:'Уклонение',color:r.kind==='fireball'?'#f5ad6d':undefined});}
  }
}
function updateHint(){let t='Клик по земле — движение · Подойди к дозорному у фонаря';if(story.metMentor)t='Перейди мост. У старого поста замечены отступники.';if(state.questStage==='resolved')t='Путь свободен. Подойди к свитку и нажми F.';if(state.phase==='combat')t=canAct()?'Выбери действие, затем цель. Пробел — завершить ход.':'Противник обдумывает свой ход…';if(state.phase==='won')t='Миссия выполнена';if(state.phase==='lost')t='Отряд повержен';$('map-hint').textContent=t;}
function scheduleEnemy(){if(enemyTimer||dialogue||helpOpen||state.phase!=='combat'||!state.enemies.some(u=>u.id===state.activeId&&u.alive))return;enemyTimer=setTimeout(()=>{enemyTimer=null;if(!dialogue&&!helpOpen&&game.state.phase==='combat')game.runEnemyTurn();},650);}
function chooseMode(id){
  if($(`action-${id}`).disabled)return;const u=actor();
  if(id==='clone'){perform(game.clone());mode='move';}else if(id==='defend'){perform(game.defend());mode='move';}else if(id==='activate'){const kind=['reaction','endurance','strength'].find(k=>u.activationLevels[k]>0&&!u.activation[k]);perform(game.activate(kind));mode='move';}else mode=id;
  const hints={move:'Кликни по свободной клетке. Движение сохраняет основное действие.',kunai:`${u.attributes.dexterity+u.skills.shooting+(u.activation.reaction||0)}d10 · ловкость + стрельба${u.activation.reaction?' + активация':''} · дальность 6 клеток`,fireball:'Ручные печати + техника + специализация · 2 чакры · выбери противника; союзники в области тоже получают урон',clone:'1 чакры · один клон: +1d10 уклонения до первой атаки',activate:'1 чакры на сцену · короткое действие · усиление реакции или выносливости',defend:'+2d10 уклонения до следующего хода · основное действие',heal:'1 чакры · снимает 1 поверхностное повреждение · выбери союзника рядом'};
  $('action-detail').innerHTML=`<span>${esc($(`action-${id}`).getAttribute('aria-label')).toUpperCase()}</span> ${esc(hints[id])}`;render(game.getSnapshot());$('map').focus({preventScroll:true});
}
function onCell(cell){
  if(!story.started||dialogue||helpOpen||['won','lost'].includes(state.phase))return;
  const ally=state.party.find(u=>u.x===cell.x&&u.y===cell.y&&u.alive),enemy=state.enemies.find(u=>u.x===cell.x&&u.y===cell.y&&u.alive);
  if(ally){if(mode==='heal'&&canAct())perform(game.heal(ally.id));else if(game.selectUnit(ally.id))render(game.getSnapshot());else toast('Сейчас ход другого участника.');return;}
  if(enemy&&state.phase==='combat'){if(!canAct())return;if(mode==='fireball')perform(game.fireball(enemy.id));else if(mode==='kunai')perform(game.attack(enemy.id,'kunai'));else{mode='kunai';render(game.getSnapshot());toast('Кунай выбран. Кликни по противнику ещё раз.');}return;}
  if(state.phase==='exploration'&&cell.x===WORLD.npc.x&&cell.y===WORLD.npc.y){interact('mentor');return;}
  if(state.phase==='exploration'&&cell.x===WORLD.scroll.x&&cell.y===WORLD.scroll.y){interact('scroll');return;}
  if(state.phase==='exploration'&&enemy){if(distance(actor(),enemy)<=6)openBandits();else toast('Подойди ближе к лесному посту.');return;}
  if(mode!=='move'&&state.phase==='combat'){toast('Выбери цель или переключись на движение.');return;}
  if(perform(game.moveTo(cell.x,cell.y))){$('map').focus({preventScroll:true});checkApproach();}
}
function checkApproach(){if(state.phase==='exploration'&&!story.approachResolved&&actor().x>=12)openBandits();}
function interact(type){if(state.phase!=='exploration'||dialogue)return;const u=actor();if(type==='mentor'||(!type&&distance(u,WORLD.npc)<=3)){if(distance(u,WORLD.npc)>3){toast('Подойди ближе к дозорному.');return;}openMentor();return;}if(type==='scroll'||(!type&&distance(u,WORLD.scroll)<=1)){perform(game.collectScroll());return;}if(!story.approachResolved&&u.x>=11){openBandits();return;}toast('Рядом нет взаимодействия. Подойди к дозорному или свитку.');}
function say(speaker,subtitle,text,choices){dialogue={choices};$('dialogue').hidden=false;$('dialogue').innerHTML=`<div class="dialogue-speaker"><span class="speaker-avatar ${speaker==='Дозорный'?'mentor':'bandit'}">${speaker==='Дозорный'?'守':'忍'}</span><div><span class="label">${esc(subtitle)}</span><strong>${esc(speaker)}</strong></div><span class="dialogue-icon">◇</span></div><p>${esc(text)}</p><div class="dialogue-choices">${choices.map((c,i)=>`<button data-choice="${i}"><span class="choice-number">${i+1}</span><span>${esc(c.label)}</span>${icon.arrow}</button>`).join('')}</div>`;render(game.getSnapshot());}
function closeDialogue(){dialogue=null;$('dialogue').hidden=true;render(game.getSnapshot());$('map').focus({preventScroll:true});}
function openMentor(){story.metMentor=true;say('Дозорный','ЛЕСНОЙ ПОСТ КОНОХИ','Курьер должен был пройти здесь до рассвета. На мосту нашли его повязку. За рекой чужие шиноби. Свиток важен — ваши жизни важнее.',[
  {label:'Что известно об этих шиноби?',run:()=>say('Дозорный','ЛЕСНОЙ ПОСТ КОНОХИ','Трое отступников ищут лекарства, а не войну. Убедите их, что свиток им не поможет. Или используйте лес для засады.',[{label:'Мы найдём курьера.',run:closeDialogue}])},
  {label:`[Смекалка + Внимательность · 2 успеха] Осмотреть следы — ${actor().name}`,run:()=>{const r=game.skillCheck(actor().id,'wits','awareness',2);story.clue=r.success??r.successes>=2;say('Дозорный',story.clue?'СЛЕДЫ НАЙДЕНЫ':'СЛЕДЫ РАЗМЫТЫ',story.clue?'В грязи следы трёх пар сандалий. Курьер ушёл обратно по боковой тропе. Его свиток остался в лагере.':'Дождь размыл следы. Дорога ведёт к старому посту за мостом.',[{label:'Отправляемся к посту.',run:closeDialogue}]);}},
  {label:'Мы готовы. Отправляемся.',run:closeDialogue},
]);}
function openBandits(){if(story.approachResolved||state.phase!=='exploration')return;const u=actor();say('Каэда','ОТСТУПНИЦА У СТАРОГО ПОСТА','Ещё шаг — и полетят кунаи. Нам нужны лекарства для деревни. В этом свитке должны быть маршруты поставок. Коноха всё равно нас не услышит.',[
  {label:`[Харизма + Убеждение · 2 успеха] Предложить помощь — ${u.name}`,run:()=>{const r=game.skillCheck(u.id,'charisma','persuasion',2,{specialization:u.id==='ren'?'Переговоры о миссии':null}),ok=r.success??r.successes>=2;if(ok){story.approachResolved=true;story.peaceful=true;perform(game.resolvePeacefully());say('Каэда','ПРОВЕРКА ПРОЙДЕНА','Забирайте свиток. Скажите дозорному о нашей деревне. Если сдержите слово — сегодня никто не пострадает.',[{label:'Мы передадим просьбу. Забрать свиток.',run:closeDialogue}]);}else say('Каэда','ПРОВЕРКА ПРОВАЛЕНА','Обещания Конохи мы уже слышали. Свиток останется здесь.',[{label:'Тогда придётся сражаться.',run:()=>beginCombat(false)}]);}},
  {label:`[Ловкость + Скрытность · 3 успеха] Подготовить засаду — ${u.name}`,run:()=>{const r=game.skillCheck(u.id,'dexterity','stealth',3,{specialization:u.id==='sora'?'Лес':null}),ok=r.success??r.successes>=3;say(ok?'Твой отряд':'Каэда',ok?'ЗАСАДА ПОДГОТОВЛЕНА':'ТЕБЯ ЗАМЕТИЛИ',ok?'Лес скрывает ваши движения. В первом раунде атаки отряда пройдут против сложности 1, без уклонения противника.':'Хруст ветки выдаёт отряд. Отступники разворачиваются к вам.',[{label:ok?'Начать бой из засады.':'Приготовиться к бою.',run:()=>beginCombat(ok)}]);}},
  {label:'[Без проверки] Мы вернём свиток силой.',run:()=>beginCombat(false)},
]);}
function beginCombat(advantage){story.approachResolved=true;dialogue=null;$('dialogue').hidden=true;mode='move';perform(game.startCombat({advantage}));$('map').focus({preventScroll:true});}
function showSheet(){const u=actor();$('sheet-content').innerHTML=`<div class="sheet-header">${portrait(u.id)}<div><div class="eyebrow">ГЕНИН · ${esc(u.clan)} · ${esc(u.element)}</div><h2>${esc(u.name)} <span>${esc(u.role)}</span></h2><p>${esc(u.description)}</p></div></div><div class="sheet-resources">${[['hp','Здоровье'],['chakra','Чакра'],['will','Воля']].map(([k,label])=>`<div><strong>${label} · ${u[k].max}</strong><span>Поверхностные: ${u[k].surface}/${u[k].max}</span><span>Критические: ${u[k].critical}/${u[k].max}</span></div>`).join('')}</div><h3>Атрибуты</h3><div class="full-attributes">${Object.entries(ATTRIBUTE_LABELS).map(([k,label])=>`<span>${label}<b>${u.attributes[k]}</b></span>`).join('')}</div><h3>Навыки</h3><div class="full-skills">${Object.entries(SKILL_LABELS).map(([k,label])=>`<span>${label}<b>${u.skills[k]}</b></span>`).join('')}</div><h3>Специализации</h3><p>${u.specializations.map(s=>`${SKILL_LABELS[s.skill]}: ${esc(s.label)}`).join(' · ')}</p><h3>Путь шиноби</h3><p>${esc(u.path)}</p><p class="muted">На старте 40 опыта; потрачено ${u.xpSpent}; осталось ${u.xpRemaining}. Все базовые дзюцу уровня 1. В прототипе доступна часть изученных техник.</p>`;helpOpen=true;$('sheet-dialog').showModal();render(game.getSnapshot());}

document.addEventListener('click',e=>{
  const u=e.target.closest('[data-unit]');if(u&&!dialogue&&!helpOpen){if(mode==='heal'&&canAct())perform(game.heal(u.dataset.unit));else if(game.selectUnit(u.dataset.unit))render(game.getSnapshot());else toast('Во время боя управлять можно только текущим участником.');}
  const c=e.target.closest('[data-choice]');if(c&&dialogue)dialogue.choices[Number(c.dataset.choice)].run();
  const a=e.target.closest('[data-action]');if(a&&!a.disabled)chooseMode(a.dataset.action);
  const close=e.target.closest('[data-close]');if(close)$(close.dataset.close).close();
});
$('interact').onclick=()=>interact();$('end-turn').onclick=()=>{mode='move';perform(game.endTurn());};$('character-sheet').onclick=showSheet;
$('help').onclick=()=>{helpOpen=true;$('rules-dialog').showModal();render(game.getSnapshot());};
for(const id of ['rules-dialog','sheet-dialog','restart-dialog'])$(id).addEventListener('close',()=>{helpOpen=false;render(game.getSnapshot());$('map').focus({preventScroll:true});});
$('save').onclick=()=>{try{localStorage.setItem('naruto-diamond-save-v1',JSON.stringify({version:1,campaign:game.serialize(),story,savedAt:Date.now()}));toast('История сохранена в этом браузере.');}catch{toast('Браузер не разрешил сохранить игру.');}};
$('load').onclick=()=>{try{const raw=localStorage.getItem('naruto-diamond-save-v1');if(!raw){toast('Сохранения пока нет.');return;}const data=JSON.parse(raw);if(data.version!==1||!data.story||typeof data.story.started!=='boolean')throw new Error('format');const r=game.load(data.campaign);if(!r.ok){toast(r.reason||'Сохранение повреждено.');return;}clearTimeout(enemyTimer);enemyTimer=null;story=data.story;dialogue=null;$('dialogue').hidden=true;mode='move';render(game.getSnapshot());toast('История загружена.');}catch{toast('Не удалось прочитать сохранение.');}};
$('confirm-restart').onclick=()=>{clearTimeout(enemyTimer);enemyTimer=null;story={...freshStory(),started:true};dialogue=null;mode='move';lastPhase='exploration';$('dialogue').hidden=true;$('restart-dialog').close();game.restart();render(game.getSnapshot());openMentor();};
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||!story.started)return;
  if(dialogue){if(/^[1-4]$/.test(e.key)){const c=dialogue.choices[Number(e.key)-1];if(c){e.preventDefault();c.run();}}return;}
  const actions={m:'move','1':'kunai','2':'fireball','3':'clone','4':'activate','5':'defend','6':'heal'};if(actions[e.key.toLowerCase()]){e.preventDefault();chooseMode(actions[e.key.toLowerCase()]);return;}
  if(e.key==='Escape'){mode='move';render(game.getSnapshot());return;}if(e.code==='Space'&&canAct()){e.preventDefault();mode='move';perform(game.endTurn());return;}if(e.key.toLowerCase()==='f'){e.preventDefault();interact();return;}
  const d={w:[0,-1],a:[-1,0],s:[0,1],d:[1,0],ArrowUp:[0,-1],ArrowLeft:[-1,0],ArrowDown:[0,1],ArrowRight:[1,0]}[e.key]||{w:[0,-1],a:[-1,0],s:[0,1],d:[1,0]}[e.key.toLowerCase()];if(d&&['exploration','combat'].includes(state.phase)){e.preventDefault();const u=actor();if(perform(game.moveTo(u.x+d[0],u.y+d[1])))checkApproach();}
});
game=new CampaignGame({onChange:render});renderer=new MapRenderer($('map'),{onCell,onHover:cell=>{hover=cell;$('map-coordinate').textContent=cell?`X ${String(cell.x).padStart(2,'0')} / Y ${String(cell.y).padStart(2,'0')}`:'ТРОПА ТИХОЙ РЕКИ';renderMap();}});render(game.getSnapshot());
window.addEventListener('pagehide',()=>{clearTimeout(enemyTimer);renderer.destroy();});
