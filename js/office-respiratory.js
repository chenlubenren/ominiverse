/* Fictional, accelerated respiratory experiment. It never takes over daily plans. */
(() => {
 'use strict';const L=window.IndoorLab,T=THREE;
 class OfficeRespiratory {
  constructor(society,intensity=1,seed=8317,options={}){
   this.s=society;this.intensity=intensity;this.seed=seed>>>0;this.time=0;this.clouds=[];this.events=[];this.states=new Map();this.affectedFloors=new Set();this.maxClouds=640;this.maxAge=30;this.expiredClouds=0;this.setLifetime(options.lifetime??30);this.floorTimes=new Map();this.population=society.agents.filter(a=>!a.isPlayer).map(a=>({id:a.id,floor:a.homeFloor}));this.disposed=false;
   const pool=society.agents.filter(a=>!a.isPlayer&&a.health==='healthy'&&a.location==='floor');
   const count=Math.min(pool.length,Math.max(1,Math.round(2*intensity)));
   for(let i=0;i<count;i++){const at=Math.floor(this.random()*pool.length),a=pool.splice(at,1)[0];this.expose(a,true);}
  }
  setLifetime(value){const seconds=Number(value);if(Number.isFinite(seconds))this.maxAge=Math.max(1,seconds);this.expireClouds();return this.maxAge;}
  expireClouds(){const alive=[];for(const c of this.clouds){c.life=this.maxAge;if(this.time-c.born<this.maxAge)alive.push(c);else this.expiredClouds++;}this.clouds=alive;}
  random(){this.seed=(this.seed*1664525+1013904223)>>>0;return this.seed/4294967296;}
  expose(a,initial=false,source=null){if(this.states.get(a.id)?.stage)return;const state={stage:initial?'infectious':'exposed',at:this.time,dose:0,source,nextSneeze:this.time+(initial?.4:12+this.random()*10),latent:initial?0:10+this.random()*12};this.states.set(a.id,state);this.affectedFloors.add(Math.round(a.floor));a.respiratoryStage=state.stage;this.events.push({time:this.time,id:a.id,floor:Math.round(a.floor),type:initial?'初始感染':'吸入感染',source});this.s.note(a,initial?'初始感染':'呼吸暴露','日常活动继续，等待下一次喷嚏传播');}
  emit(a,sneeze=true){
   if(a.location!=='floor')return;
   while(this.clouds.length>=this.maxClouds){this.clouds.shift();this.expiredClouds++;}
   const angle=a.angle||0,reach=sneeze?.55:.23;
   this.clouds.push({x:a.x+Math.sin(angle)*reach,z:a.z+Math.cos(angle)*reach,y:1.4,floor:Math.round(a.floor),born:this.time,life:this.maxAge,strength:(sneeze?1.8:.35)*this.intensity,source:a.id,seed:this.random()*100});
   if(sneeze){a.sneezeUntil=this.s.time+.85;this.events.push({time:this.time,id:a.id,floor:Math.round(a.floor),type:'喷嚏'});}
  }
  connected(a,c){const model=this.s.model(c.floor),find=p=>model.rooms.find(r=>p.x>r.minX&&p.x<r.maxX&&p.z>r.minZ&&p.z<r.maxZ),ra=find(a),rc=find(c);if(ra?.id===rc?.id)return true;if((ra&&model.doors.find(d=>d.id===ra.id)?.open===false)||(rc&&model.doors.find(d=>d.id===rc.id)?.open===false))return false;return this.s.grid(c.floor).lineClear(a,c,.025);}
  tick(dt){if(this.disposed)return;this.time+=dt;this.expireClouds();
   const buckets=new Map(),key=(f,x,z)=>f+':'+Math.floor(x/3)+':'+Math.floor(z/3);
   for(const c of this.clouds){const k=key(c.floor,c.x,c.z);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(c);}
   for(const a of this.s.agents){if(a.isPlayer||a.health!=='healthy')continue;let state=this.states.get(a.id);
    if(state?.stage==='exposed'&&this.time-state.at>=state.latent){state.stage='infectious';a.respiratoryStage='infectious';state.nextSneeze=this.time+.4+this.random()*2;}
    // Further inhalation must not restart an established incubation period.
    if(state?.stage==='exposed')continue;
    if(state?.stage==='infectious'){
     if(this.time>=state.nextSneeze&&a.location==='floor'){this.emit(a);state.nextSneeze=this.time+(8+this.random()*14)/Math.sqrt(this.intensity);}
     if(['talk','typing'].includes(a.gesture)&&this.time>=(state.nextTalk||0)){if(a.gesture==='talk')this.emit(a,false);state.nextTalk=this.time+3.5;}
     continue;
    }
    if(a.location!=='floor')continue;const f=Math.round(a.floor),cx=Math.floor(a.x/3),cz=Math.floor(a.z/3);let dose=0,source=null;
    for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++)for(const c of buckets.get(f+':'+x+':'+z)||[]){const age=this.time-c.born,r=.6+Math.min(1.75,age*.065),d=Math.hypot(c.x-a.x,c.z-a.z);if(d>r||c.source===a.id||!this.connected(a,c))continue;dose+=c.strength*Math.exp(-age/17)*(1-d/r)*dt;source=c.source;}
    if(dose){if(!state){state={dose:0};this.states.set(a.id,state);}state.dose+=dose;if(state.dose>.38+(a.id%11)*.027){this.states.delete(a.id);this.expose(a,false,source);}}
    else if(state){state.dose=Math.max(0,state.dose-dt*.012);if(state.dose===0)this.states.delete(a.id);}
   }
   if(this.events.length>2400)this.events.splice(0,this.events.length-2400);
   for(let f=1;f<=30;f++){const people=this.population.filter(a=>a.floor===f);if(people.length&&!this.floorTimes.has(f)&&people.every(a=>this.states.get(a.id)?.stage))this.floorTimes.set(f,this.time);}
   if(this.allInfectedAt==null&&this.population.length&&this.population.every(a=>this.states.get(a.id)?.stage))this.allInfectedAt=this.time;
  }
  draw(view){
   if(!this.points){this.positions=new Float32Array(1800*3);const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));this.points=new T.Points(g,new T.PointsMaterial({color:'#ee6963',size:.045,transparent:true,opacity:.72,depthWrite:false,toneMapped:false}));this.points.frustumCulled=false;this.points.userData.noAO=true;this.points.name='喷嚏与残留气溶胶';view.scene.add(this.points);}
   const tower=L.continuousTower,visible=!(tower?.active&&tower.worldWalk.outside)&&L.building.phase==='interior',floor=tower?.active?tower.origin:view.model?.towerFloor;let count=0;
   if(visible)for(const c of this.clouds){if(c.floor!==floor)continue;const age=this.time-c.born,r=.6+Math.min(1.75,age*.065),n=Math.max(3,Math.floor(28*Math.exp(-age/20)));for(let i=0;i<n&&count<1800;i++){const theta=i*2.399963+c.seed,range=r*((i*.618033+.17)%1),j=count++*3;this.positions[j]=c.x+Math.cos(theta+age*.12)*range;this.positions[j+1]=.8+((i*.38197+c.seed)%1)*1.1+Math.sin(age+i)*.06;this.positions[j+2]=c.z+Math.sin(theta+age*.12)*range;}}
   const origin=view.floorOrigin;this.points.position.set(origin?.x||0,origin?.y||0,origin?.z||0);this.points.visible=visible&&count>0;this.points.geometry.setDrawRange(0,count);this.points.geometry.attributes.position.needsUpdate=true;
  }
  floorSummary(floor){const people=this.population.filter(a=>Math.round(a.floor)===Math.round(floor)),states=people.map(a=>this.states.get(a.id)).filter(a=>a?.stage);return {floor:Math.round(floor),population:people.length,infected:states.length,infectious:states.filter(a=>a.stage==='infectious').length,exposed:states.filter(a=>a.stage==='exposed').length,coverage:people.length?states.length/people.length:0,completeAt:this.floorTimes.get(Math.round(floor))??null};}
  summary(){const cases=[...this.states.values()].filter(s=>s.stage);return{time:this.time,infected:cases.length,exposed:cases.filter(s=>s.stage==='exposed').length,infectious:cases.filter(s=>s.stage==='infectious').length,airborneClouds:this.clouds.length,affectedFloors:this.affectedFloors.size,population:this.population.length,allInfectedAt:this.allInfectedAt??null,floorTimes:Object.fromEntries(this.floorTimes),lifetime:this.maxAge,expiredClouds:this.expiredClouds};}
  dispose(){this.disposed=true;this.clouds=[];for(const a of this.s.agents){delete a.respiratoryStage;delete a.sneezeUntil;}if(this.points){this.points.parent?.remove(this.points);this.points.geometry.dispose();this.points.material.dispose();}}
 }
 L.OfficeRespiratory=OfficeRespiratory;
})();
