/** Illustrated 2D cinematics: procedural scenery, parallax and readable dialogue. */
export class ScenePainter {
  constructor(canvas) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.art='village';
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize=()=>{const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,r.width*d);canvas.height=Math.max(1,r.height*d);};
    this.observer=new ResizeObserver(this.resize);this.observer.observe(canvas);this.resize();
    const tick=time=>{this.paint(this.reduced?0:time/1000);this.raf=requestAnimationFrame(tick);};this.raf=requestAnimationFrame(tick);
  }
  destroy(){cancelAnimationFrame(this.raf);this.observer.disconnect();}
  paint(t){
    const c=this.ctx,w=this.canvas.width,h=this.canvas.height;
    const dawn=this.art==='dawn',ruins=this.art==='ruins',archive=this.art==='archive';
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,dawn?'#7c6859':archive?'#0a1621':'#102725');g.addColorStop(1,dawn?'#cf9b65':ruins?'#5b4634':'#42564a');c.fillStyle=g;c.fillRect(0,0,w,h);
    const circle=(x,y,r,color)=>{c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
    circle(w*.71,h*.25,Math.min(w,h)*.10,dawn?'#f1cf88':'#c7d4b399');circle(w*.72,h*.24,Math.min(w,h)*.098,dawn?'#f1cf88':'#1b332fe0');
    for(let layer=0;layer<4;layer++){
      c.fillStyle=['#3a534766','#2b443cc0','#1a332bcf','#10231de6'][layer];c.beginPath();c.moveTo(0,h);
      for(let x=0;x<=w+20;x+=20){const y=h*(.42+layer*.14)+Math.sin(x/w*8+layer*2)*h*.08+Math.sin(x/w*19+layer)*h*.022;c.lineTo(x,y);}
      c.lineTo(w,h);c.closePath();c.fill();
    }
    const base=h*.70;
    for(let i=0;i<8;i++){
      const x=w*(i/8+.01),height=h*(.10+(i%3)*.035),width=w*.13;
      c.fillStyle=archive?'#283841':ruins?'#36352c':'#334438';c.fillRect(x,base-height,width,height+h*.15);
      c.fillStyle='#101e1b';c.beginPath();c.moveTo(x-w*.02,base-height);c.lineTo(x+width*.48,base-height-h*.06);c.lineTo(x+width+w*.02,base-height);c.closePath();c.fill();
      for(let j=0;j<3;j++){c.fillStyle=ruins?'#2a2921':'#d2a763aa';c.fillRect(x+width*(.15+j*.26),base-height*.67,width*.09,height*.18);}
      if(ruins){c.fillStyle='#10211e';c.fillRect(x+width*.4,base-height,width*.25,height*.55);}
    }
    const gx=w*.66,gy=h*.66;c.fillStyle=archive?'#56524a':'#783f30';c.fillRect(gx-w*.07,gy-h*.12,w*.014,h*.38);c.fillRect(gx+w*.07,gy-h*.12,w*.014,h*.38);c.fillRect(gx-w*.105,gy-h*.13,w*.23,h*.018);c.fillRect(gx-w*.085,gy-h*.07,w*.19,h*.013);
    c.fillStyle='#0d201dee';c.beginPath();c.moveTo(0,h*.92);c.bezierCurveTo(w*.23,h*.75,w*.40,h*.95,w,h*.84);c.lineTo(w,h);c.lineTo(0,h);c.fill();
    for(let i=0;i<14;i++){const x=(i*113.7+t*7)%w,y=h*.25+((i*67.8)%Math.max(1,h*.55));circle(x,y,Math.max(1,w*.001),`rgba(223,199,137,${.25+Math.sin(t+i)*.18})`);}
    if(this.art==='rain')for(let i=0;i<80;i++){const x=(i*73)%w,y=(i*43+t*130)%(h+30);c.strokeStyle='#adc5c533';c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x-5,y+16);c.stroke();}
    const v=c.createRadialGradient(w*.5,h*.4,w*.1,w*.5,h*.5,Math.max(w,h)*.7);v.addColorStop(0,'#03100b00');v.addColorStop(1,'#03100bcf');c.fillStyle=v;c.fillRect(0,0,w,h);
  }
}

export class CinematicPlayer {
  constructor(container,frames,{onDone,instant=false}={}){
    this.container=container;this.frames=frames;this.onDone=onDone;this.index=0;this.instant=instant;this.closed=false;
    container.innerHTML='<div class="cinema"><canvas></canvas><div class="cinema-bars"></div><div class="cinema-top"><span>NARUTO DIAMOND</span><button id="skip-cinema">Пропустить сцену ↗</button></div><div class="cinema-caption"><span class="eyebrow" id="cinema-eyebrow"></span><h2 id="cinema-title"></h2><div class="cinema-text-box"><span id="cinema-speaker"></span><p id="cinema-text" aria-live="polite"></p></div><div class="cinema-bottom"><span id="cinema-progress"></span><button id="next-cinema" class="primary-button">Далее →</button></div></div></div>';
    this.painter=new ScenePainter(container.querySelector('canvas'));
    this.next=()=>{if(!this.complete){this.reveal();return;}this.index++;if(this.index>=frames.length)this.finish();else this.render();};
    container.querySelector('#next-cinema').onclick=this.next;container.querySelector('#skip-cinema').onclick=()=>this.finish();
    this.key=e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();this.next();}if(e.key==='Escape'){e.preventDefault();this.finish();}};document.addEventListener('keydown',this.key);this.render();
  }
  render(){
    const f=this.frames[this.index];this.painter.art=f.art;this.complete=false;this.count=0;
    for(const[key,value]of[['cinema-eyebrow',f.eyebrow],['cinema-title',f.title],['cinema-speaker',f.speaker],['cinema-progress',`${String(this.index+1).padStart(2,'0')} / ${String(this.frames.length).padStart(2,'0')}`]])this.container.querySelector(`#${key}`).textContent=value;
    const p=this.container.querySelector('#cinema-text');p.textContent='';clearInterval(this.timer);
    if(this.instant||this.painter.reduced)this.reveal();else this.timer=setInterval(()=>{this.count+=3;p.textContent=f.text.slice(0,this.count);if(this.count>=f.text.length)this.reveal();},25);
  }
  reveal(){clearInterval(this.timer);this.container.querySelector('#cinema-text').textContent=this.frames[this.index].text;this.complete=true;}
  finish(){if(this.closed)return;this.closed=true;this.destroy();this.onDone?.();}
  destroy(){clearInterval(this.timer);this.painter.destroy();document.removeEventListener('keydown',this.key);}
}
