/* Live cabin view during station events. While the user watches the exterior
   (or another cabin), the affected cabin is rendered into a small framed
   region of the same canvas with its own camera, so the crew's reactions and
   the robots' work stay visible. The main camera is never moved; clicking
   the view enters that cabin. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,$=id=>document.getElementById(id),clamp=T.MathUtils.clamp;
  class StationEventPip {
    constructor(station){
      this.s=station;this.camera=new T.PerspectiveCamera(46,1.6,.04,200);this.focus=null;this.position=null;this.moduleId=null;this.activeKey=null;this.nextChoice=0;this.dismissed=null;this.rect=null;
      const el=this.el=document.createElement('figure');el.id='st-event-pip';el.hidden=true;el.setAttribute('aria-live','polite');
      el.innerHTML='<header><i aria-hidden="true"></i><b>舱内实时</b><span id="st-pip-module"></span><button type="button" id="st-pip-close" aria-label="关闭舱内画面" title="关闭舱内画面">×</button></header><div class="st-pip-view"><canvas id="st-pip-noise" aria-hidden="true"></canvas><figcaption><span id="st-pip-metric"></span><ul id="st-pip-actors"></ul><small>点击画面进入该舱</small></figcaption></div>';
      document.body.appendChild(el);this.view=el.querySelector('.st-pip-view');this.noise=$('st-pip-noise');
      $('st-pip-close').onclick=e=>{e.stopPropagation();this.dismissed=this.film;this.hide();};
      el.addEventListener('click',()=>{const s=this.s,o=s.o;if(!this.moduleId||o.switching||o.robotInteraction?.pending||o.chat?.picking||s.transferring)return;const id=this.moduleId;this.hide();s.enter(id);});
    }
    get film(){const d=this.s.scenarios;return d?.active&&d.film?.liveEvent&&!d.film.disposed?d.film:null;}
    crew(id){const ctx=this.s.o.contexts?.get('station-'+id);return ctx?ctx.sim.people.filter(p=>!p.external&&!p.stationTransfer):[];}
    hide(){if(!this.el.hidden)this.el.hidden=true;this.activeKey=null;}
    choose(film,info,now){
      const list=(info.modules||[]).filter(id=>C.stationModule(id));if(!list.length)return null;
      if(film.incident)return list[0];
      if(this.moduleId&&list.includes(this.moduleId)&&this.crew(this.moduleId).length&&now<this.nextChoice)return this.moduleId;
      this.nextChoice=now+1500;
      // Prefer the scene's lead cabin with crew; otherwise the busiest cabin.
      const staffed=list.find(id=>this.crew(id).length);if(staffed)return staffed;
      const busiest=C.stationModules.map(m=>m.id).sort((a,b)=>this.crew(b).length-this.crew(a).length)[0];return this.crew(busiest).length?busiest:list[0];
    }
    layout(){
      const vw=innerWidth,vh=innerHeight;if(vw<640||vh<460)return null;
      const panel=this.s.ui?.querySelector('.st-panel')?.getBoundingClientRect(),chat=$('co-observation-chat')?.getBoundingClientRect(),index=this.s.ui?.querySelector('.st-modules')?.getBoundingClientRect();
      const floor=chat&&chat.height?chat.top-12:vh-24,width=clamp(vw*.22,240,340),header=26;
      const fits=(left,top,w)=>{const h=header+w*.6;return top+h<=floor&&left+w<=(index&&index.width?index.left-12:vw-20)?{left,top,width:w,height:h}:null;};
      if(panel&&panel.width){
        for(let w=width;w>=200;w-=20){const below=fits(panel.left,panel.bottom+12,w);if(below)return below;}
        const beside=fits(panel.right+14,panel.top,Math.min(width,280));if(beside)return beside;
      }
      return fits(28,158,Math.min(width,280));
    }
    update(dt=1/60){
      const s=this.s,o=s.o,film=this.film,now=performance.now();
      if(!film||this.dismissed===film||o.environment!=='station'||o.switching||s.shellStudy?.changed||!s.rooms||film.time>=film.duration-.05){if(!film)this.dismissed=null;this.hide();return;}
      if(film!==this.lastFilm){this.lastFilm=film;this.moduleId=null;this.nextChoice=0;this.focus=null;}
      const info=film.pipInfo?.()||{modules:[film.targetModule||'tianhe']},id=this.choose(film,info,now);
      if(!id||(s.phase!=='overview'&&s.selected===id)){this.hide();return;}
      const rect=this.layout();if(!rect){this.hide();return;}
      if(id!==this.moduleId){this.moduleId=id;this.focus=null;}
      this.activeKey='station-'+id;
      const el=this.el;if(el.hidden)el.hidden=false;
      Object.assign(el.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px'});this.view.style.height=(rect.height-26)+'px';
      el.classList.toggle('is-alert',!!info.alert);
      const spec=C.stationModule(id);this.text('st-pip-module',spec.name);this.text('st-pip-metric',info.metric||'');
      this.syncActors(id);this.drawNoise(info.noise||0);
      this.render(id,dt);
    }
    text(id,value){const e=$(id);if(e&&e.textContent!==value)e.textContent=value;}
    syncActors(id){
      const reactions=this.s.eventReactions,rows=[];
      if(reactions)for(const e of reactions.entries.values())if(e.sim.world.spec?.id===id)rows.push((e.isRobot?'🤖 ':'')+e.actor.name+' · '+(e.isRobot?e.actor.status:e.actor.action));
      if(!rows.length)for(const p of this.crew(id))rows.push(p.name+' · '+(p.action||'值守'));
      const film=this.film;if(film?.helpers?.some(h=>h.id===id))rows.push('服务机器人 · '+({capture:'显示目标测距数据',debris:'加固松散设备',resupply:'搬运新到货包',attitude:'收拢漂浮物品',solar:'安装屏蔽水袋'}[film.id]||'协助处置'));
      if(film?.incident)rows.push('维修机器人 · '+(film.narrative?.().stage||'处置中'));
      const markup=rows.slice(0,this.view.clientHeight<190?2:3).map(r=>'<li>'+r.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</li>').join('');
      if(this.actorsMarkup!==markup){this.actorsMarkup=markup;$('st-pip-actors').innerHTML=markup;}
    }
    drawNoise(level){
      // Particle strikes on the cabin camera sensor during the proton event.
      const c=this.noise,box=this.view.getBoundingClientRect();if(!level){if(this.noiseOn){c.getContext('2d').clearRect(0,0,c.width,c.height);this.noiseOn=false;}return;}
      this.noiseOn=true;if(c.width!==Math.round(box.width)||c.height!==Math.round(box.height)){c.width=Math.round(box.width);c.height=Math.round(box.height);}
      const g=c.getContext('2d');g.globalCompositeOperation='destination-out';g.fillStyle='rgba(0,0,0,.45)';g.fillRect(0,0,c.width,c.height);g.globalCompositeOperation='source-over';
      const n=Math.round(level*28);for(let i=0;i<n;i++){const x=Math.random()*c.width,y=Math.random()*c.height,l=Math.random()<.3?2+Math.random()*7:0;g.fillStyle=`rgba(255,255,255,${.5+Math.random()*.5})`;if(l){g.save();g.translate(x,y);g.rotate(Math.random()*Math.PI);g.fillRect(0,0,l,1.2);g.restore();}else g.fillRect(x,y,1.5,1.5);}
    }
    render(id,dt){
      const s=this.s,v=s.v,renderer=v.renderer,room=s.getRoom(id);if(!room)return;
      const box=this.view.getBoundingClientRect(),canvas=renderer.domElement.getBoundingClientRect();if(box.width<20||box.height<20)return;
      const x=box.left-canvas.left,y=canvas.bottom-box.bottom,w=box.width,h=box.height;
      room.root.updateWorldMatrix(true,true);
      // Frame the crew from above the hidden ceiling, easing as they move.
      const people=this.crew(id),spec=room.spec,focus=new T.Vector3();
      if(people.length){for(const p of people)focus.add(new T.Vector3(p.x,(p.y||0)+1.1,p.z));focus.multiplyScalar(1/people.length);}else focus.set(0,1.4,-spec.length*.12);
      focus.x=clamp(focus.x,-spec.width*.3,spec.width*.3);focus.z=clamp(focus.z,-spec.length*.4,spec.length*.4);
      const position=focus.clone().add(new T.Vector3(spec.width*.48,3.15,Math.min(2.6,spec.length*.26)));
      const k=this.focus?1-Math.exp(-Math.min(.1,dt)*2.2):1;this.focus=(this.focus||focus.clone()).lerp(focus,k);this.position=(this.position||position.clone()).lerp(position,k);
      const cam=this.camera;cam.aspect=w/h;cam.updateProjectionMatrix();cam.position.copy(room.root.localToWorld(this.position.clone()));cam.up.set(0,1,0).transformDirection(room.root.matrixWorld);cam.lookAt(room.root.localToWorld(this.focus.clone()));cam.updateMatrixWorld(true);
      // Only this cabin is drawn; everything else keeps its own visibility.
      const saved=s.root.children.map(child=>[child,child.visible]),roof=room.roof.visible,exposure=renderer.toneMappingExposure,light=[s.ambient.intensity,s.sun.intensity,s.fill.intensity];
      for(const child of s.root.children)child.visible=child===room.root;room.root.visible=true;room.roof.visible=false;
      s.ambient.intensity=.38;s.sun.intensity=.35;s.fill.intensity=.14;renderer.toneMappingExposure=.92;
      const shadow=renderer.shadowMap.needsUpdate;renderer.shadowMap.needsUpdate=false;
      try{renderer.setScissorTest(true);renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);renderer.render(s.scene,cam);}
      finally{
        renderer.setScissorTest(false);const size=renderer.getSize(new T.Vector2());renderer.setViewport(0,0,size.x,size.y);renderer.setScissor(0,0,size.x,size.y);
        for(const [child,visible]of saved)child.visible=visible;room.roof.visible=roof;renderer.toneMappingExposure=exposure;[s.ambient.intensity,s.sun.intensity,s.fill.intensity]=light;renderer.shadowMap.needsUpdate=shadow;
      }
    }
    dispose(){this.el.remove();}
  }
  C.StationEventPip=StationEventPip;
})();
