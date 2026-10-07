import { createDraft, validateDraft, createHero, CLANS, ELEMENTS, ADVANCED, APPEARANCE, baseAttributes } from './creator.js';
import { ATTRIBUTE_LABELS, SKILL_LABELS } from './characters.js';
import { CHAPTERS, introScenes, transitionScenes, endingScenes } from './campaign-data.js';
import { ScenePainter, CinematicPlayer } from './cinematics.js';
import { SaveStore } from './saves.js';
import './campaign.css';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(entries,value)=>entries.map(([key,label])=>`<option value="${esc(key)}" ${key===value?'selected':''}>${esc(label)}</option>`).join('');
const dates=value=>new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(value);
export class CampaignUI {
  constructor(hooks){
    this.hooks=hooks;this.front=document.createElement('div');this.front.id='campaign-front';document.body.append(this.front);
    this.running=false;this.blocked=true;this.chapter=0;this.hero=null;this.flags={mercy:false,evidence:false,trust:0,choice:null};this.completed=[];
    this.settings={instantText:false,grid:true,sound:false,volume:0.18};
    try{Object.assign(this.settings,JSON.parse(localStorage.getItem('naruto-diamond-settings')||'{}'));}catch{}
    try{this.store=new SaveStore(localStorage);}catch{this.store=null;}
    this.migrateLegacy();this.showMenu();
  }
  migrateLegacy(){
    try{
      if(!this.store||this.store.list().length)return;
      const raw=localStorage.getItem('naruto-diamond-save-v1');if(!raw)return;
      const old=JSON.parse(raw);if(old.version!==1||!old.campaign?.state||!old.story)return;
      const hero=createDraft();const legacyStory={started:true,metMentor:false,clue:false,crossed:false,approachResolved:false,peaceful:false,spokeSora:false,spokeMiyo:false,...old.story};
      legacyStory.crossed=old.campaign.state.party.some(u=>u.x>=12);
      const upgraded={version:2,savedAt:old.savedAt||Date.now(),progress:{chapter:0,hero,flags:{mercy:!!old.story.peaceful,evidence:!!old.story.clue,trust:0,choice:null},completed:[]},campaign:{...old.campaign,worldId:'forest',hero},story:legacyStory};
      this.store.put('auto',upgraded);
    }catch{/* Preserve legacy data if browser storage or migration is unavailable. */}
  }
  get definition(){return CHAPTERS[this.chapter];}
  notify(text){this.hooks.toast(text);}
  clear(){this.cinematic?.destroy();this.cinematic=null;this.painter?.destroy();this.painter=null;this.front.innerHTML='';}
  showFront(){this.blocked=true;this.front.hidden=false;document.querySelector('.shell').hidden=true;this.hooks.onBlocked?.();}
  showGame(){this.clear();this.front.hidden=true;document.querySelector('.shell').hidden=false;this.blocked=false;this.running=true;this.hooks.onResume?.();}
  list(){try{return this.store?.list()||[];}catch{this.notify('Не удалось прочитать сохранения браузера.');return[];}}
  showMenu(){
    this.clear();this.showFront();const saves=this.list();
    this.front.innerHTML=`<section class="main-menu"><canvas class="menu-art"></canvas><div class="menu-shade"></div><header class="menu-header"><span class="menu-brand">◇ NARUTO DIAMOND</span><span>РОЛЕВАЯ КАМПАНИЯ · 0.2</span></header><div class="menu-content"><div class="eyebrow">СТРАНА ОГНЯ · ТВОЙ ПУТЬ ШИНОБИ</div><h1>NARUTO<span>DIAMOND</span></h1><p class="menu-tagline">Пепел под листвой</p><p class="menu-description">За каждым приказом — чья-то история.<br>Узнай её, прежде чем обнажить клинок.</p><nav class="menu-buttons"><button id="menu-resume" ${!this.running?'disabled':''}>Вернуться в игру <span>↗</span></button><button id="menu-continue" ${!saves.length?'disabled':''}>Продолжить сохранение <span>→</span></button><button id="menu-new">Новая история <span>◇</span></button><button id="menu-saves">Сохранения <span>03</span></button><button id="menu-settings">Настройки <span>⚙</span></button><button id="menu-codex">Кодекс шиноби <span>忍</span></button></nav><div class="menu-footnote">Три главы · Отряд · Пошаговые сражения · Несколько финалов</div></div><div class="menu-chapter-preview"><span class="label">КАМПАНИЯ</span><strong>Пепел под листвой</strong><div>${CHAPTERS.map(c=>`<span><i>${c.number}</i>${c.location}</span>`).join('')}</div><p>Основано на правилах<br>Naruto Diamond Fandom RP 0.6</p></div><footer class="menu-footer"><span>Правда начинается с вопроса.</span><span>Сохранения хранятся в этом браузере</span></footer></section>`;
    this.painter=new ScenePainter(this.front.querySelector('canvas'));
    this.front.querySelector('#menu-resume').onclick=()=>this.flags.choice?this.showCredits():this.showGame();
    this.front.querySelector('#menu-continue').onclick=()=>this.load(saves[0]?.data);
    this.front.querySelector('#menu-new').onclick=()=>this.showCreator();
    this.front.querySelector('#menu-saves').onclick=()=>this.showSaves();
    this.front.querySelector('#menu-settings').onclick=()=>this.showSettings();
    this.front.querySelector('#menu-codex').onclick=()=>this.showCodex();
  }
  shell(title,subtitle,body){
    this.clear();this.showFront();this.front.innerHTML=`<section class="front-page"><header><button id="front-back" class="subtle-button">← Главное меню</button><span>◇ NARUTO DIAMOND</span></header><div class="front-heading"><div class="eyebrow">ПЕПЕЛ ПОД ЛИСТВОЙ</div><h1>${title}</h1><p>${subtitle}</p></div>${body}</section>`;this.front.querySelector('#front-back').onclick=()=>this.showMenu();
  }
  showCreator(draft=createDraft(),tab='identity'){
    this.draft=draft;this.creatorTab=tab;
    const d=draft,skillOptions=Object.entries(SKILL_LABELS);
    this.shell('Создай своего шиноби','История принадлежит тебе. Внешность, путь и навыки станут частью кампании.',`
      <div class="creator-layout"><div class="creator-main"><div class="creator-tabs">${[['identity','01 Личность'],['skills','02 Навыки'],['training','03 Подготовка']].map(([key,label])=>`<button data-tab="${key}" class="${key===tab?'selected':''}">${label}</button>`).join('')}</div>
      <section class="creator-tab" data-tab-panel="identity" ${tab!=='identity'?'hidden':''}><div class="creator-section-title"><h2>Личность и происхождение</h2><span>Ты — главный герой отряда</span></div><div class="form-grid"><label>Имя<input id="hero-name" maxlength="28" value="${esc(d.name)}" /></label><label>Клан<select id="hero-clan">${options(Object.entries(CLANS).map(([k,v])=>[k,v.name]),d.clan)}</select></label><label>Стихия<select id="hero-element">${options(ELEMENTS.map(e=>[e,e]),d.element)}</select></label><label>Продвинутая техника<select id="hero-advanced">${options(Object.entries(ADVANCED).map(([k,v])=>[k,v.name]),d.advanced)}</select></label></div><p class="form-note" id="clan-note">${CLANS[d.clan].note}</p><label class="wide-label">Путь шиноби<textarea id="hero-path" maxlength="220" rows="3">${esc(d.path)}</textarea></label><div class="creator-section-title"><h2>Внешность</h2><span>Видна в игре и листе</span></div>${[['skin','Тон кожи'],['hair','Цвет волос'],['outfit','Цвет одежды']].map(([key,label])=>`<div class="palette-row"><span>${label}</span><div>${[...new Set([...APPEARANCE[key],d.appearance[key]])].map(color=>`<button class="swatch ${d.appearance[key]===color?'selected':''}" style="--swatch:${color}" data-palette="${key}" data-color="${color}" aria-label="${label}: ${color}"></button>`).join('')}</div></div>`).join('')}<label class="wide-label">Причёска<select id="hero-hair-style">${options([['spiky','Острые пряди'],['short','Короткая'],['long','Длинные волосы']],d.appearance.hairStyle)}</select></label></section>
      <section class="creator-tab" data-tab-panel="skills" ${tab!=='skills'?'hidden':''}><div class="creator-section-title"><h2>Стартовые навыки</h2><span id="skill-count"></span></div><p class="form-note">Выбери ровно 9 навыков уровня 2 и 9 уровня 1. Три специализации должны относиться к разным изученным навыкам.</p><div class="skill-editor">${skillOptions.map(([key,label])=>`<label>${label}<select data-base-skill="${key}">${options([[0,'0'],[1,'1'],[2,'2']],d.skills[key])}</select></label>`).join('')}</div><h3>Специализации</h3><div class="specialization-editor">${d.specializations.map((s,i)=>`<div><select data-spec-skill="${i}">${options(skillOptions,s.skill)}</select><input data-spec-label="${i}" value="${esc(s.label)}" maxlength="70" placeholder="Узкая область навыка" /></div>`).join('')}</div></section>
      <section class="creator-tab" data-tab-panel="training" ${tab!=='training'?'hidden':''}><div class="creator-section-title"><h2>Атрибуты и 40 опыта</h2><span>Цена: новый уровень × 5</span></div><div class="rank-editor">${Object.entries(ATTRIBUTE_LABELS).map(([key,label])=>this.rankRow('attributes',key,label,d.attributes[key])).join('')}</div><h3>Активации чакры</h3><p class="form-note">Цена: новый уровень × 5. Ранг не выше Контроля чакры.</p><div class="rank-editor">${[['reaction','Реакция'],['strength','Сила'],['endurance','Выносливость']].map(([key,label])=>this.rankRow('activationLevels',key,label,d.activationLevels[key])).join('')}</div><h3>Дополнительная тренировка навыков</h3><p class="form-note">Начальное распределение сохраняется. Каждый новый ранг стоит ранг × 3.</p><div class="training-editor">${skillOptions.map(([key,label])=>this.rankRow('trainedSkills',key,label,d.trainedSkills[key])).join('')}</div></section>
      <div class="creator-template-row"><span>Начать с готовой подготовки:</span>${[['ren','Огневик'],['sora','Разведчик'],['miyo','Медик']].map(([id,label])=>`<button class="subtle-button" data-template="${id}">${label}</button>`).join('')}</div></div>
      <aside class="creator-preview"><span class="label">ТВОЙ ПЕРСОНАЖ</span><div id="creator-portrait"></div><h2 id="creator-preview-name"></h2><p id="creator-preview-role"></p><div id="creator-resources" class="creator-resources"></div><div class="xp-budget"><span>СТАРТОВЫЙ ОПЫТ</span><strong id="xp-remaining"></strong><small id="xp-spent"></small></div><div id="creator-validation" class="creator-validation" role="status"></div><button id="creator-start" class="primary-button">Начать историю →</button><p class="creator-disclaimer">Клановые пассивные бонусы применяются. Особые додзюцу и хидены пока не перенесены.</p></aside></div>`);
    this.front.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{this.creatorTab=b.dataset.tab;this.front.querySelectorAll('[data-tab]').forEach(n=>n.classList.toggle('selected',n===b));this.front.querySelectorAll('[data-tab-panel]').forEach(n=>n.hidden=n.dataset.tabPanel!==b.dataset.tab);});
    for(const[id,key]of[['hero-name','name'],['hero-path','path'],['hero-element','element'],['hero-advanced','advanced']])this.front.querySelector(`#${id}`).oninput=e=>{this.draft[key]=e.target.value;this.validateCreator();};
    this.front.querySelector('#hero-clan').onchange=e=>{this.draft.clan=e.target.value;const base=baseAttributes(e.target.value);for(const k of Object.keys(base))this.draft.attributes[k]=Math.max(base[k],this.draft.attributes[k]);this.showCreator(this.draft,this.creatorTab);};
    this.front.querySelector('#hero-hair-style').onchange=e=>{this.draft.appearance.hairStyle=e.target.value;this.validateCreator();};
    this.front.querySelectorAll('[data-palette]').forEach(b=>b.onclick=()=>{this.draft.appearance[b.dataset.palette]=b.dataset.color;this.front.querySelectorAll(`[data-palette="${b.dataset.palette}"]`).forEach(n=>n.classList.toggle('selected',n===b));this.validateCreator();});
    this.front.querySelectorAll('[data-base-skill]').forEach(s=>s.onchange=()=>{const old=this.draft.skills[s.dataset.baseSkill],value=Number(s.value);this.draft.skills[s.dataset.baseSkill]=value;if(this.draft.trainedSkills[s.dataset.baseSkill]===old)this.draft.trainedSkills[s.dataset.baseSkill]=value;else this.draft.trainedSkills[s.dataset.baseSkill]=Math.max(value,this.draft.trainedSkills[s.dataset.baseSkill]);this.showCreator(this.draft,this.creatorTab);});
    this.front.querySelectorAll('[data-spec-skill]').forEach(s=>s.onchange=()=>{this.draft.specializations[Number(s.dataset.specSkill)].skill=s.value;this.validateCreator();});
    this.front.querySelectorAll('[data-spec-label]').forEach(s=>s.oninput=()=>{this.draft.specializations[Number(s.dataset.specLabel)].label=s.value;this.validateCreator();});
    this.front.querySelectorAll('[data-rank]').forEach(b=>b.onclick=()=>{const [group,key]=b.dataset.rank.split(':');const floor=group==='attributes'?baseAttributes(this.draft.clan)[key]:group==='trainedSkills'?this.draft.skills[key]:0;this.draft[group][key]=Math.max(floor,Math.min(10,this.draft[group][key]+Number(b.dataset.delta)));this.showCreator(this.draft,this.creatorTab);});
    this.front.querySelectorAll('[data-template]').forEach(b=>b.onclick=()=>{const next=createDraft(b.dataset.template);next.name=this.draft.name;next.path=this.draft.path;next.appearance=this.draft.appearance;this.showCreator(next,this.creatorTab);});
    this.front.querySelector('#creator-start').onclick=()=>this.start(this.draft);this.validateCreator();
  }
  rankRow(group,key,label,value){return `<div class="rank-row"><span>${label}</span><div><button data-rank="${group}:${key}" data-delta="-1" aria-label="Уменьшить ${label}">−</button><b>${value}</b><button data-rank="${group}:${key}" data-delta="1" aria-label="Увеличить ${label}">+</button></div></div>`;}
  validateCreator(){
    const d=this.draft,v=validateDraft(d),q=id=>this.front.querySelector(`#${id}`);
    q('creator-preview-name').textContent=d.name||'Безымянный';q('creator-preview-role').textContent=`${CLANS[d.clan].name} · ${d.element}`;q('clan-note').textContent=CLANS[d.clan].note;
    q('creator-portrait').innerHTML=`<div class="hero-illustration ${d.appearance.hairStyle}" style="--hero-skin:${d.appearance.skin};--hero-hair:${d.appearance.hair};--hero-outfit:${d.appearance.outfit}"><div class="hero-aura"></div><div class="hero-body"></div><div class="hero-neck"></div><div class="hero-face"></div><div class="hero-hair"></div><div class="hero-band"><span>◇</span></div><div class="hero-eyes"><i></i><i></i></div><div class="hero-scarf"></div></div>`;
    q('xp-remaining').textContent=String(v.remaining??0);q('xp-spent').textContent=`осталось из 40 · потрачено ${v.spent??0}`;
    q('creator-validation').innerHTML=v.ok?'<span class="valid-build">✓ Персонаж соответствует стартовым правилам</span>':v.errors.map(e=>`<p>${esc(e)}</p>`).join('');q('creator-start').disabled=!v.ok;
    const values=Object.values(d.skills);q('skill-count').textContent=`Уровень 2: ${values.filter(v=>v===2).length}/9 · уровень 1: ${values.filter(v=>v===1).length}/9`;
    if(v.ok){const h=createHero(d);q('creator-resources').innerHTML=[['hp','Здоровье'],['chakra','Чакра'],['will','Воля']].map(([k,label])=>`<span>${label}<strong>${h[k].max}</strong></span>`).join('');}
    else q('creator-resources').innerHTML='<span>Исправь подготовку, чтобы увидеть итоговые ресурсы</span>';
  }
  start(hero){
    if(!validateDraft(hero).ok)return;this.hero=structuredClone(hero);this.chapter=0;this.flags={mercy:false,evidence:false,trust:0,choice:null};this.completed=[];this.running=true;
    this.hooks.onStart(this.hero,0);this.play(introScenes(this.hero.name),()=>{this.showGame();this.hooks.onBriefing();this.autosave();});
  }
  play(frames,onDone){this.clear();this.showFront();this.cinematic=new CinematicPlayer(this.front,frames,{instant:this.settings.instantText,onDone:()=>{this.cinematic=null;onDone();}});}
  record(kind){if(kind==='mercy')this.flags.mercy=true;if(kind==='evidence')this.flags.evidence=true;if(kind==='trust')this.flags.trust++;}
  completeChapter(){
    if(this.hooks.getSave().campaign.state.phase!=='won'){this.notify('Сначала заверши текущую миссию.');return;}
    if(!this.completed.includes(this.chapter))this.completed.push(this.chapter);
    this.autosave();
    if(this.chapter===2){this.showEndingChoice();return;}
    const old=this.chapter;this.play(transitionScenes(old,this.flags),()=>{this.chapter=old+1;this.hooks.onStart(this.hero,this.chapter);this.showGame();this.hooks.onBriefing();this.autosave();});
  }
  showEndingChoice(){
    this.shell('Что останется после приказа?','Печать и доказательства у отряда. Теперь реши, кому принадлежит правда.',`<div class="ending-choices">${[['truth','Раскрыть правду','Передать документы и свидетельства Хасуми в совет. Потребовать открытого расследования.'],['village','Довериться деревне','Передать дело наставнику. Добиться помощи Хасуми, сохранив решение внутри Конохи.'],['people','Выбрать людей','Отдать копии лекарю Иори и немедленно доставить лекарства, нарушив порядок приказа.']].map(([id,title,text])=>`<button data-ending="${id}"><span>◇</span><h2>${title}</h2><p>${text}</p><strong>Выбрать этот путь →</strong></button>`).join('')}</div>`);
    this.front.querySelectorAll('[data-ending]').forEach(b=>b.onclick=()=>{this.flags.choice=b.dataset.ending;this.play(endingScenes(this.flags.choice,this.flags,this.hero?.name||'Рэн'),()=>{this.showCredits();this.autosave();});});
  }
  showCredits(){
    this.shell('Твой путь оставил след','Кампания «Пепел под листвой» завершена.',`<div class="credits-card"><span class="credits-symbol">忍</span><h2>${{truth:'Воля огня',village:'Цена послушания',people:'За пределами приказа'}[this.flags.choice]||'Путь шиноби'}</h2><p>Главный герой: ${esc(this.hero?.name||'Рэн')}<br>Завершено глав: ${this.completed.length} / 3<br>${this.flags.mercy?'Переговоры спасли жизни.':'Отряд прошёл через сражения.'}<br>${this.flags.evidence?'Найдены улики о подделке приказа.':'Не все следы удалось прочитать.'}</p><div class="credits-companions"><strong>Сора</strong><span>${this.flags.trust?'«Мы слушали друг друга. Я пойду с тобой снова».':'«Надеюсь, в следующий раз мы успеем поговорить». '}</span><strong>Миё</strong><span>«Самое важное — мы не забыли, ради кого шли».</span></div><button id="credits-menu" class="primary-button">В главное меню →</button></div>`);this.front.querySelector('#credits-menu').onclick=()=>this.showMenu();
  }
  package(){return {version:2,savedAt:Date.now(),progress:{chapter:this.chapter,hero:this.hero,flags:this.flags,completed:this.completed},...this.hooks.getSave()};}
  autosave(){try{this.store?.put('auto',this.package());}catch{this.notify('Автосохранение недоступно. Экспортируй сохранение из меню.');}}
  save(slot='1'){try{if(!this.store)throw new Error();this.store.put(slot,this.package());this.notify(`История сохранена: слот ${slot}.`);}catch{this.notify('Не удалось записать сохранение. Можно экспортировать JSON.');}}
  load(data){
    try{
      const p=data?.progress;if(data?.version!==2||!p||!Number.isInteger(p.chapter)||p.chapter<0||p.chapter>2||!validateDraft(p.hero).ok||!p.flags||typeof p.flags.mercy!=='boolean'||typeof p.flags.evidence!=='boolean'||!Number.isInteger(p.flags.trust)||p.flags.trust<0||p.flags.trust>100||!Array.isArray(p.completed)||p.completed.some(n=>!Number.isInteger(n)||n<0||n>2)||new Set(p.completed).size!==p.completed.length||![null,'truth','village','people'].includes(p.flags.choice)||data.campaign?.worldId!==CHAPTERS[p.chapter].id||JSON.stringify(data.campaign.hero)!==JSON.stringify(p.hero))throw new Error('Несовместимое или повреждённое сохранение.');
      const result=this.hooks.onLoad(data);if(!result.ok)throw new Error(result.reason);
      this.hero=structuredClone(p.hero);this.chapter=p.chapter;this.flags=structuredClone(p.flags);this.completed=[...p.completed];this.running=true;
      if(this.flags.choice)this.showCredits();else this.showGame();this.notify('Сохранение загружено.');
    }catch(e){this.notify(e.message||'Не удалось загрузить сохранение.');}
  }
  showSaves(){
    const entries=this.list();
    this.shell('Сохранения','Три ручных слота и отдельное автосохранение. Экспорт позволяет перенести историю в другой браузер.',`<div class="save-list">${['auto','1','2','3'].map(slot=>{const e=entries.find(e=>e.slot===slot)?.data;return `<article class="save-card"><div><span class="label">${slot==='auto'?'АВТОСОХРАНЕНИЕ':`СЛОТ ${slot}`}</span><h2>${e?esc(e.progress?.hero?.name||'Шиноби'):'Пустой слот'}</h2><p>${e?`${esc(CHAPTERS[e.progress?.chapter]?.title||'Кампания')} · ${dates(e.savedAt)}`:'История ещё не записана'}</p></div><div>${slot!=='auto'?`<button data-save-slot="${slot}" class="subtle-button" ${!this.running?'disabled':''}>Сохранить</button>`:''}<button data-load-slot="${slot}" class="primary-button" ${!e?'disabled':''}>Загрузить</button><button data-delete-slot="${slot}" class="text-button" ${!e?'disabled':''}>Удалить</button></div></article>`;}).join('')}</div><div class="save-transfer"><button id="export-save" class="subtle-button" ${!this.running?'disabled':''}>Экспорт текущей истории JSON ↓</button><label class="subtle-button file-button">Импорт сохранения ↑<input id="import-save" type="file" accept="application/json,.json" /></label></div>`);
    this.front.querySelectorAll('[data-save-slot]').forEach(b=>b.onclick=()=>{this.save(b.dataset.saveSlot);this.showSaves();});
    this.front.querySelectorAll('[data-load-slot]').forEach(b=>b.onclick=()=>{try{this.load(this.store.get(b.dataset.loadSlot));}catch{this.notify('Не удалось прочитать слот.');}});
    this.front.querySelectorAll('[data-delete-slot]').forEach(b=>b.onclick=()=>{if(!confirm('Удалить это сохранение?'))return;try{this.store.remove(b.dataset.deleteSlot);this.showSaves();}catch{this.notify('Не удалось удалить сохранение.');}});
    this.front.querySelector('#export-save').onclick=()=>{const blob=new Blob([JSON.stringify(this.package(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='naruto-diamond-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    this.front.querySelector('#import-save').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>1000000){this.notify('Файл слишком большой. Нужен JSON до 1 МБ.');return;}try{this.load(JSON.parse(await file.text()));}catch{this.notify('Это не файл сохранения JSON.');}};
  }
  showSettings(){
    this.shell('Настройки','Настройки сохраняются в этом браузере.',`<div class="settings-card"><label><span><strong>Мгновенный текст</strong><small>Без постепенного появления реплик катсцен</small></span><input type="checkbox" id="setting-text" ${this.settings.instantText?'checked':''}/></label><label><span><strong>Тактическая сетка</strong><small>Показывать клетки карты во время боя</small></span><input type="checkbox" id="setting-grid" ${this.settings.grid?'checked':''}/></label><label><span><strong>Звуки действий</strong><small>Короткие синтезированные сигналы атак и техник</small></span><input type="checkbox" id="setting-sound" ${this.settings.sound?'checked':''}/></label><label><span><strong>Громкость</strong><small>Звуки включаются после действия пользователя</small></span><input type="range" id="setting-volume" min="0" max="0.4" step="0.01" value="${this.settings.volume}"/></label><p class="form-note">Уменьшение движения учитывает системную настройку prefers-reduced-motion. Видео, озвучки и фоновой музыки в версии 0.2 нет.</p></div>`);
    for(const[id,key]of[['setting-text','instantText'],['setting-grid','grid'],['setting-sound','sound'],['setting-volume','volume']])this.front.querySelector(`#${id}`).onchange=e=>{this.settings[key]=key==='volume'?Number(e.target.value):e.target.checked;try{localStorage.setItem('naruto-diamond-settings',JSON.stringify(this.settings));}catch{this.notify('Не удалось сохранить настройки.');}this.hooks.onSettings?.();};
  }
  showCodex(){
    this.shell('Кодекс шиноби','Правила боя и границы компьютерной адаптации.',`<div class="codex-grid">${[
      ['Проверка d10','Атрибут + навык. 1–5 — провал; 6–9 — один успех; 10 — два успеха. Специализация добавляет один кубик. Ничья в соревновании в пользу инициатора.'],
      ['Создание','Атрибуты 2, девять навыков 2 и девять навыков 1. Три специализации, пять базовых дзюцу, одна продвинутая техника, одна стихия и 40 опыта. Клановые бонусы применяются отдельно.'],
      ['Бой','Инициатива — Ловкость + Смекалка. Ход: основное и короткое действие. Уклонение не тратит действие. Четыре клетки движения — настройка адаптации.'],
      ['Ресурсы','Здоровье = 3 + Выносливость. Чакра = Выносливость + Решимость + Контроль чакры. Воля = Самообладание + Решимость. Кланы могут менять эти формулы.'],
      ['Урон','Поверхностный урон от разницы успехов делится пополам вверх. Оружие наносит отдельный критический урон. Плотная одежда превращает до двух его единиц в неделимый поверхностный.'],
      ['Техники','Клон: 1 чакры и +1d10 уклонения до атаки. Огненный шар: 2 чакры и критический урон области, включая союзников. Ладонь: 1 чакры, лечение поверхностной раны. Барьер: 1 чакры, неподвижная защита до следующего хода.'],
      ['Лечение между главами','Между миссиями проходит время на лечение у медиков и подготовку. Отряд начинает новую главу восстановленным. Это сюжетное решение кампании, а не универсальное правило мгновенного отдыха.'],
      ['Что ещё не перенесено','Весь справочник хиденов, геномов и продвинутых дзюцу; свободный мастерский режим; многопользовательская игра. Катсцены — иллюстрированные 2D-сцены, без видео и озвучки.'],
    ].map(([title,text])=>`<article><span>◇</span><h2>${title}</h2><p>${text}</p></article>`).join('')}</div>`);
  }
}
