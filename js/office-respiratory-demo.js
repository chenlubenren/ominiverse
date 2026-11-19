/* Explicit floor-by-floor demonstration. The default respiratory model remains unchanged. */
(() => {
 'use strict';const L=window.IndoorLab;
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 class OfficeRespiratoryDemo {
  constructor(society,intensity=1,seed=8317,options={}){
   this.s=society;this.intensity=Math.max(.2,Math.min(4,Number(intensity)||1));this.seed=seed>>>0;this.time=0;this.clouds=[];this.events=[];this.states=new Map();this.affectedFloors=new Set();this.mode='floor-demo';this.maxClouds=Math.max(30,Math.min(2400,Math.floor(Number(options.maxClouds)||1200)));this.maxParticles=Math.max(256,Math.min(8000,Math.floor(Number(options.maxParticles)||6000)));this.maxAge=30;this.expiredClouds=0;this.setLifetime(options.lifetime??30);this.routeBudget=4;this.floorTimes=new Map();this.disposed=false;
   // Freeze each floor's starting cohort so visitors cannot change its denominator.
   this.population=society.agents.filter(a=>this.eligible(a)&&a.location==='floor'&&a.floor>=1&&a.floor<=30).map(a=>({id:a.id,floor:Math.round(a.floor)}));
   this.cohorts=new Map();for(const person of this.population){if(!this.cohorts.has(person.floor))this.cohorts.set(person.floor,[]);this.cohorts.get(person.floor).push(person.id);}
   const floors=new Map();for(const a of society.agents)if(this.eligible(a)&&a.location==='floor'&&a.floor>=1&&a.floor<=30){const f=Math.round(a.floor);if(!floors.has(f))floors.set(f,[]);floors.get(f).push(a);}
   this.initialSources=[];
   for(const [floor,people]of floors){const a=people[Math.floor(this.random()*people.length)];this.initialSources.push({floor,id:a.id});this.expose(a,true);}
  }
  eligible(a){return !a.isPlayer&&a.health==='healthy'&&!a.zombieControlled&&!a.emergencyType&&!a.alerted&&!a.robotCooperation;}
  setLifetime(value){const seconds=Number(value);if(Number.isFinite(seconds))this.maxAge=Math.max(1,seconds);this.expireClouds();return this.maxAge;}
  expireClouds(){const alive=[];for(const c of this.clouds){c.life=this.maxAge;if(this.time-c.born<this.maxAge)alive.push(c);else this.expiredClouds++;}this.clouds=alive;}
  random(){this.seed=(this.seed*1664525+1013904223)>>>0;return this.seed/4294967296;}
  expose(a,initial=false,source=null){
   if(this.disposed||this.states.get(a.id)?.stage||!this.eligible(a))return;
   const state={stage:initial?'infectious':'exposed',at:this.time,dose:0,source,nextSneeze:this.time+.4,latent:initial?0:(8+this.random()*8)/Math.sqrt(this.intensity),nextGoal:this.time};
   this.states.set(a.id,state);this.affectedFloors.add(Math.round(a.floor));a.respiratoryStage=state.stage;
   this.events.push({time:this.time,id:a.id,floor:Math.round(a.floor),type:initial?'初始感染':'吸入感染',source});
   this.s.note(a,initial?'初始携带者':'呼吸暴露',initial?'本层喷嚏传播开始':'进入潜伏期，随后继续喷嚏传播');
   if(initial){this.control(a,state);this.emit(a);state.nextSneeze=this.time+(5+this.random()*5)/Math.sqrt(this.intensity);}
  }
  control(a,state){
   if(state.controlled||!this.eligible(a)||a.location!=='floor')return;
   state.saved={zombieControlled:a.zombieControlled,activity:a.activity,action:a.action};
   const z=this.s.zombie;
   if(z?.release){z.release(a);a.zombieControlled=state.saved.zombieControlled;}
   else{this.s.releaseSeat?.(a);a.seatId=null;a.pose='stand';a.sitBlend=0;a.path=[];a.plan=null;a.pendingPlan=null;a.transition=null;}
   if(a.resourceKey){this.s.resourceOwners?.delete(a.resourceKey);a.resourceKey=null;}
   state.controlled=true;state.floor=Math.round(a.floor);state.nextGoal=this.time;
   a.respiratoryControlled=true;a.activity='respiratory-roam';a.gesture=null;
   a.action='在本层走动，间歇打喷嚏';a.reaction={code:'calm',posture:'upright',text:a.name+' · '+a.action};
  }
  emit(a,sneeze=true){
   if(this.disposed||!this.eligible(a)||a.location!=='floor')return;
   while(this.clouds.length>=this.maxClouds){this.clouds.shift();this.expiredClouds++;}
   const angle=a.angle||0,reach=sneeze?.22:.12,origin={x:a.x+Math.sin(angle)*reach,z:a.z+Math.cos(angle)*reach};
   if(this.s.building?.reactions&&!this.s.building.reactions.canSee(a,{...origin,floor:a.floor,location:'floor'})){origin.x=a.x;origin.z=a.z;}
   const model=this.s.model(Math.round(a.floor)),room=model.rooms.find(r=>origin.x>r.minX&&origin.x<r.maxX&&origin.z>r.minZ&&origin.z<r.maxZ);
   this.clouds.push({...origin,y:a.pose==='sit'?1.12:1.48,floor:Math.round(a.floor),born:this.time,life:this.maxAge,strength:(sneeze?2.2:.28)*this.intensity,source:a.id,seed:this.random()*100,angle,kind:'sneeze',bounds:room?{minX:room.minX,maxX:room.maxX,minZ:room.minZ,maxZ:room.maxZ}:undefined});
   if(sneeze){
    a.sneezeUntil=this.s.time+1.05;const state=this.states.get(a.id);if(state)state.pauseUntil=this.time+1.05;
    a.vx=a.vz=0;a.state='waiting';a.action='停下打喷嚏，飞沫扩散';a.reaction={code:'smoke',posture:'upright',text:a.name+' · '+a.action};
    this.events.push({time:this.time,id:a.id,floor:Math.round(a.floor),type:'喷嚏'});
   }
  }
  connected(a,c){
   const model=this.s.model(c.floor),find=p=>model.rooms.find(r=>p.x>r.minX&&p.x<r.maxX&&p.z>r.minZ&&p.z<r.maxZ),ra=find(a),rc=find(c);
   if(ra?.id===rc?.id&&ra)return true;
   if((ra&&model.doors.find(d=>d.id===ra.id)?.open===false)||(rc&&model.doors.find(d=>d.id===rc.id)?.open===false))return false;
   // All-directional wall sight ignores low furniture and occupied seat cells.
   if(this.s.building?.reactions)return this.s.building.reactions.canSee(a,{...c,location:'floor'});
   return this.s.grid(c.floor).lineClear(a,c,.025);
  }
  roam(a,state,dt){
   if(this.disposed||!this.eligible(a)||a.location!=='floor')return;
   const z=this.s.zombie;
   if(this.time<(state.pauseUntil||0)){a.vx=a.vz=0;a.state='waiting';a.action='停下打喷嚏，飞沫扩散';a.reaction={code:'smoke',posture:'upright',text:a.name+' · '+a.action};return;}
   if(a.rise){z?.moveRise?.(a,dt);return;}
   a.pose='stand';a.activity='respiratory-roam';a.gesture=null;a.action='在本层走动，间歇打喷嚏';a.reaction={code:'calm',posture:'upright',text:a.name+' · '+a.action};
   const finished=!a.zPath?.length||a.zAt>=a.zPath.length;
   if((finished||(a.blockedFor||0)>1.4)&&this.time>=state.nextGoal&&this.routeBudget>0){
    state.nextGoal=this.time+2+this.random()*2;
    const g=this.s.grid(a.floor),nav=g.nav(.24),people=(this.peopleByFloor?.get(Math.round(a.floor))||[]).filter(b=>b!==a);
    // Visit coworkers and floor space, using local routes without stair/lift plans.
    for(let attempt=0;attempt<5;attempt++){
     let goal;
     if(people.length&&attempt<3){const b=people[Math.floor(this.random()*people.length)],seat=b.seatId&&this.s.seat?.(b.floor,b.seatId);goal=seat?.approach||b;}
     else{const list=nav.free||nav.mainFree;if(!list?.length)break;goal=g.point(list[Math.floor(this.random()*list.length)]);}
     if(distance(a,goal)<1.3)continue;
     if(this.routeBudget<=0)break;this.routeBudget--;const path=L.officeRoute?.(g,a,goal);
     if(!path?.length)continue;
     a.zPath=path;a.zAt=0;a.zGoal={x:goal.x,z:goal.z};a.zKind='respiratory-walk';a.blockedFor=0;state.nextGoal=this.time+3;break;
    }
   }
   if(a.zPath?.length&&a.zAt<a.zPath.length)z?.move?.(a,dt,1.05+(a.id%4)*.06);
   else{a.vx=a.vz=0;a.state='waiting';}
  }
  tick(dt){
   if(this.disposed||!Number.isFinite(dt)||dt<=0)return;this.time+=dt;this.routeBudget=4;this.expireClouds();
   this.peopleByFloor=new Map();for(const a of this.s.agents)if(this.eligible(a)&&a.location==='floor'){const f=Math.round(a.floor);if(!this.peopleByFloor.has(f))this.peopleByFloor.set(f,[]);this.peopleByFloor.get(f).push(a);}

   for(const a of this.s.agents){
    const state=this.states.get(a.id);if(!state?.stage)continue;if(!this.eligible(a)){if(state.controlled){state.controlled=false;delete a.respiratoryControlled;delete a.respiratoryStage;delete a.sneezeUntil;}continue;}
    if(state.stage==='exposed'&&this.time-state.at>=state.latent){state.stage='infectious';a.respiratoryStage='infectious';state.nextSneeze=this.time+.2;this.control(a,state);}
    if(state.stage==='infectious'){
     this.control(a,state);
     if(this.time>=state.nextSneeze&&a.location==='floor'){this.emit(a);state.nextSneeze=this.time+(5+this.random()*5)/Math.sqrt(this.intensity);}
     this.roam(a,state,dt);
    }
   }
   const buckets=new Map(),key=(f,x,z)=>f+':'+Math.floor(x/3)+':'+Math.floor(z/3);
   for(const c of this.clouds){const k=key(c.floor,c.x,c.z);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(c);}
   for(const a of this.s.agents){
    if(!this.eligible(a)||a.location!=='floor'||this.states.get(a.id)?.stage)continue;
    const f=Math.round(a.floor),cx=Math.floor(a.x/3),cz=Math.floor(a.z/3);let dose=0,source=null;
    for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++)for(const c of buckets.get(f+':'+x+':'+z)||[]){
     const age=this.time-c.born,r=.65+Math.min(2.1,age*.16),d=distance(c,a);
     if(d>r||c.source===a.id||!this.connected(a,c))continue;
     dose+=c.strength*Math.exp(-age/Math.max(1,this.maxAge*.55))*(1-d/r)*dt;source=c.source;
    }
    let state=this.states.get(a.id);
    if(dose){if(!state){state={dose:0};this.states.set(a.id,state);}state.dose+=dose;if(state.dose>.5+(a.id%11)*.032)this.expose(a,false,source);}
    else if(state){state.dose=Math.max(0,state.dose-dt*.012);if(state.dose===0)this.states.delete(a.id);}
   }
   if(this.events.length>2400)this.events.splice(0,this.events.length-2400);
   for(const [floor,ids]of this.cohorts)if(ids.length&&!this.floorTimes.has(floor)&&ids.every(id=>this.states.get(id)?.stage))this.floorTimes.set(floor,this.time);
   if(this.allInfectedAt==null&&this.population.length&&this.population.every(a=>this.states.get(a.id)?.stage))this.allInfectedAt=this.time;
   // Society's main loop owns collision rebuilding and locomotion accounting.
  }
  draw(view){
   if(this.disposed||!L.AirParticleRenderer)return;
   if(!this.renderer)this.renderer=new L.AirParticleRenderer({color:'#f07748',maxParticles:this.maxParticles,name:'逐层传播演示 · 喷嚏与残留气溶胶'});
   this.renderer.draw(view,this.clouds,this.time+(this.s.accumulator||0));this.points=this.renderer.points;
  }
  floorSummary(floor){const ids=this.cohorts.get(Math.round(floor))||[],cases=ids.map(id=>this.states.get(id)).filter(state=>state?.stage),infected=cases.length;return{floor:Math.round(floor),infected,population:ids.length,infectious:cases.filter(state=>state.stage==='infectious').length,exposed:cases.filter(state=>state.stage==='exposed').length,coverage:ids.length?infected/ids.length:0,completeAt:this.floorTimes.get(Math.round(floor))??null};}
  summary(){const cases=[...this.states.values()].filter(s=>s.stage);return{mode:this.mode,maxClouds:this.maxClouds,maxParticles:this.maxParticles,time:this.time,infected:cases.length,exposed:cases.filter(s=>s.stage==='exposed').length,infectious:cases.filter(s=>s.stage==='infectious').length,airborneClouds:this.clouds.length,affectedFloors:this.affectedFloors.size,population:this.population.length,allInfectedAt:this.allInfectedAt??null,floorTimes:Object.fromEntries(this.floorTimes),lifetime:this.maxAge,expiredClouds:this.expiredClouds,initialSources:this.initialSources.length};}
  dispose(){
   if(this.disposed)return;this.disposed=true;this.clouds=[];this.renderer?.dispose();
   for(const a of this.s.agents){
    const state=this.states.get(a.id);if(!state?.stage)continue;delete a.respiratoryStage;delete a.sneezeUntil;delete a.respiratoryControlled;
    if(!state.controlled||!this.eligible(a))continue;state.controlled=false;
    a.zombieControlled=state.saved.zombieControlled;a.zPath=[];a.zAt=0;a.zKind='';a.zGoal=null;a.rise=null;a.gesture=null;a.onArrival=null;a.plan=null;a.pendingPlan=null;a.transition=null;a.path=[];a.blockedFor=0;a.vx=a.vz=0;a.state='arrived';a.until=this.s.time+10;
    a.activity=state.saved.activity||'lounge';a.action=state.saved.action||'恢复日常活动';a.reaction={code:'calm',posture:'upright',text:a.name+' · 恢复日常活动'};
    const home=a.homeSeat&&this.s.seat?.(a.homeFloor,a.homeSeat);
    if(a.location==='floor'&&a.health==='healthy'&&this.s.returnHome&&(home||a.role==='visitor'))this.s.returnHome(a);
   }
  }
 }
 L.OfficeRespiratoryDemo=OfficeRespiratoryDemo;
})();
