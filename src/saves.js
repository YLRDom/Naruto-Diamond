const KEY='naruto-diamond-campaign-slots-v2';
export class SaveStore {
  constructor(storage){this.storage=storage;}
  read(){
    const raw=this.storage.getItem(KEY);if(!raw)return{};
    const slots=JSON.parse(raw);if(!slots||typeof slots!=='object'||Array.isArray(slots))throw new Error('Файл сохранений повреждён.');return slots;
  }
  list(){return Object.entries(this.read()).filter(([key,value])=>['auto','1','2','3'].includes(key)&&value?.version===2).map(([slot,data])=>({slot,data})).sort((a,b)=>b.data.savedAt-a.data.savedAt);}
  put(slot,data){if(!['auto','1','2','3'].includes(String(slot)))throw new Error('Неизвестный слот.');const slots=this.read();slots[slot]=structuredClone(data);this.storage.setItem(KEY,JSON.stringify(slots));}
  get(slot){return this.read()[slot]||null;}
  remove(slot){const slots=this.read();delete slots[slot];this.storage.setItem(KEY,JSON.stringify(slots));}
}
