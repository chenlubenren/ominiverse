/* Natural language event director, using the existing persistent population. */
(() => {
 'use strict';const L=window.IndoorLab,T=THREE,$=id=>document.getElementById(id);
 class DisasterDirector {
  constructor(b){
   this.b=b;this.v=b.view;this.history=[];this.lastActions=[];this.fires=new Map();this.seed=18243;this.busy=false;this.time=0;this.pulses=[];this.doorSaved=new Map();this.generation=0;this.environment='office';this.active=true;this.fireAttachment=new L.BuildingFireAttachment(this);
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  context(extra={}){return {floor:this.b.continuous.active?this.b.continuous.origin:this.b.selected,interior:this.b.phase==='interior'&&(!this.b.continuous.active||!this.b.continuous.worldWalk?.outside),lastActions:this.lastActions,environment:L.collaboration?.environment||this.environment||'office',...extra};}
  assertContext(context=this.context()){const actual=L.collaboration?.environment||context.environment;if(actual==='station'||context.environment==='station')throw Error('空间站使用独立情景，请返回办公楼或园区执行此类事件。');if(L.collaboration?.switching||this.isTransitioning)throw Error('正在切换场景，请待过渡完成后再执行事件。');if(actual!==context.environment)throw Error('目标场景已变化，请在当前场景重新发送。');}
  requestValid(token,context){return token===this.generation&&!L.collaboration?.switching&&!this.isTransitioning&&(L.collaboration?.environment||context.environment)===context.environment&&context.environment!=='station';}
  async executeText(text,options={}){
   if(this.busy)throw Error('上一条事件仍在处理中，请稍候。');const context=this.context(options),token=this.generation;this.assertContext(context);
   if(window.DisasterCommands.isNonCommand(text))return {message:'疑问、假设或否定描述不会触发场景事件。',actions:[],source:'local'};
   this.busy=true;
   try{window.DisasterCommands.validExplicitNumbers(text);if(L.robotLibrary)await L.robotLibrary.ready;if(!this.requestValid(token,context))throw Error('场景已切换或复原，本次事件已取消。');const local=L.robotLibrary?.plan(text,context)||window.DisasterCommands.parse(text,context);let plan=local;
    if(options.allowRemote===true&&!window.DisasterCommands.shouldUseLocal(text,context,local)){
     try{const response=await fetch('/__disaster_director__',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,context,history:this.history.slice(-6)}),signal:AbortSignal.timeout(30000)});if(response.status===404)throw Error('服务暂不可用');const data=await response.json();if(!response.ok){const error=Error(data.error||'解析失败');error.validation=true;throw error;}plan={...window.DisasterCommands.validate(data,context),source:data.source||'local',warning:data.warning};}
     catch(error){if(error.validation)throw error;plan={...local,warning:'智能解析暂不可用，已使用本地明确指令。'};}
    }
    if(!this.requestValid(token,context))throw Error('场景已切换或复原，本次事件已取消。');
    const results=[];for(const action of plan.actions){if(!this.requestValid(token,context))throw Error('场景已切换，本次事件已取消。');results.push(await this.execute({...action,position:options.position},context));if(action.type==='reset')break;}
    this.lastActions=plan.actions;const message=[...(plan.notices||[]),...results].join('\n')||plan.reply||'未识别到可执行事件。';this.history.push({role:'user',content:String(text)},{role:'assistant',content:JSON.stringify({actions:plan.actions,reply:message})});this.history=this.history.slice(-10);
    return {message,actions:plan.actions,source:plan.source||'local',warning:plan.warning};
   }finally{this.busy=false;}
  }
  adoptFire(floor,fire,intensity=1){this.ensureVisuals();fire.settings.persistentBurning=true;this.fires.set(floor,fire);this.fireState??=new Map();this.fireState.set(floor,{start:this.time,intensity});this.revision=(this.revision||0)+1;return fire;}
  ensureVisuals(){if(!this.fx)this.visuals();}
  setRunning(run,context=this.context()){this.b.app.play(run);this.b.society.running=run;if(context.environment==='campus'&&L.collaboration?.environment==='campus'){L.collaboration.externalRunning=run;const button=$('co-env-play');if(button)button.textContent=run?'Ⅱ 暂停模拟':'▶ 继续模拟';}}
  syncPresentation(){const allowed=(L.collaboration?.environment||this.environment)!=='station'&&!L.collaboration?.switching&&!this.isTransitioning;if(this.fx){this.fx.visible=allowed;L.syncDisasterFrame(this.fx,this.b);}if(this.physics){this.physics.group.visible=allowed;this.physics.syncFrame();}if(L.megastructureFleet){L.megastructureFleet.active=allowed;L.megastructureFleet.syncFrame();}}
  async execute(a,context=this.context()){this.assertContext(context);const checked=window.DisasterCommands.validate({actions:[a]},context).actions[0];const result=await this.perform({...checked,position:a.position},context);this.revision=(this.revision||0)+1;const e=this.b.society.emergency;const type=e.type!=='none'?e.type:this.b.society.zombie.active?'zombie':'none';if($('disaster-type'))$('disaster-type').value=type;if($('virus-lifetime-control'))$('virus-lifetime-control').hidden=type!=='infection';return result;}
  async perform(a,context=this.context()){
   this.assertContext(context);const token=this.generation;
   const s=this.b.society,e=s.emergency;
   if(a.type==='pause'||a.type==='resume'){const run=a.type==='resume';this.setRunning(run,context);return run?'模拟已继续。':'模拟已暂停。';}
   // A new event starts the scene so its result is visible, just as existing
   // disaster controls do. Explicit pause/resume use the same scene clock.
   this.setRunning(true,context);
   if(a.type==='reset'){if(L.scenarioRuntime)await L.scenarioRuntime.restore({preserveCamera:true});else this.b.app.clearDisaster();return'已复原初始建筑、全部人员和门，清除火灾、感染及生成的进攻者。';}
   if(a.type==='extinguish')return this.extinguish(a);
   if(a.type==='doors')return this.doors(a);
   if(a.type==='robot-rebellion'){if(!L.robotConflict?.ready)throw Error('机器人阵营系统正在准备，请稍候。');return L.robotConflict.execute(a);}
   if(a.type==='robot-design'){if(!L.robotArmy)throw Error('机器人系统正在准备，请稍候。');return L.robotArmy.buildFromDescription(a);}
   if(a.type==='robot-library'){if(!L.robotLibrary)throw Error('机器人库正在准备，请稍候。');return L.robotLibrary.deploy(a.entryId,a);}
   if(a.type==='megastructures'){if(!L.megastructureFleet)throw Error('巨构机器人系统正在准备，请稍候。');return L.megastructureFleet.execute(a);}
   if(a.type==='fire'){
    if(this.physics?.destroyedFloors.has(a.floor))throw Error(a.floor+'层已被摧毁，请先清除灾害。');
    const old=this.fires.get(a.floor);if(old&&old!==e.hazard)old.dispose?.();const fire=L.createOfficeFire(s,a.floor,a.intensity,{position:a.position});this.adoptFire(a.floor,fire,a.intensity);
    if(e.type==='none'||e.type==='fire'){if(e.hazard&&e.hazard!==fire&&!this.fires.has(e.floor))e.hazard.dispose?.();e.begin('fire',fire,a.floor);}
    this.fireState??=new Map();this.fireState.set(a.floor,{start:this.time,intensity:a.intensity});return a.floor+'层已起火，火焰和烟气将沿外立面向上蔓延，人员开始感知和疏散。';
   }
   if(a.type==='explosion'){this.ensureVisuals();this.physics??=new L.DisasterPhysics(this);await this.physics.prepare();if(!this.requestValid(token,context))throw Error('场景已切换，本次爆炸已取消。');await this.physics.explosion(a.floor,a.intensity);return a.floor+'层已发生爆炸：楼板、外墙和内部物件进入刚体破坏模拟。';}
   if(a.type==='earthquake'){
    this.ensureVisuals();this.physics??=new L.DisasterPhysics(this);await this.physics.prepare();if(!this.requestValid(token,context))throw Error('场景已切换，本次地震已取消。');await this.physics.quake(a.intensity,a.collapse||a.intensity>=2.8);
    if(!a.collapse&&a.intensity<2.8){await this.b.app.startDisaster({type:'earthquake',floor:a.floor,intensity:a.intensity,preserve:true});return'地震已启动：建筑摇晃、家具倾倒、墙板破裂；人员就地避险，停止后疏散。';}
    {if(e.hazard&&!this.fires.has(e.floor))e.hazard.dispose?.();e.begin('earthquake',new L.EarthquakeScenario(s.grid(a.floor),[],{pga:.32*a.intensity,frequency:2.2,duration:16,seed:Date.now()>>>0}).start(),a.floor);}
    
    return a.collapse||a.intensity>=2.8?'最大强度地震已启动：失去支承后整楼逐层崩塌，碎块以 Rapier 刚体碰撞、堆积。':'地震已启动：建筑摇晃，人员就地避险，停止后疏散。';
   }
   if(a.type==='robots'){if(!L.robotArmy)throw Error('机器人模型系统仍在载入，请稍候。');return L.robotArmy.spawn(a);}
   if(a.type==='zombies')return this.spawn(a);
   if(a.type==='zombie-virus'){
    if(!s.zombie.active)s.zombie.start({count:a.airborne?0:5,airborne:a.airborne,intensity:a.intensity});else if(a.airborne&&!s.zombie.air)s.zombie.air=new L.TowerAirborne(s.zombie,a.intensity);
    return a.airborne?'丧尸病毒已进入通风传播系统，暴露者将逐步感染并异变。':'丧尸病毒已释放，初始感染者将异变并追捕、传播感染。';
   }
   if(e.hazard&&!this.fires.has(e.floor))e.hazard.dispose?.();
   const hazard=a.type==='infection'?new (a.demo?L.OfficeRespiratoryDemo:L.OfficeRespiratory)(s,a.intensity,Date.now()>>>0,{lifetime:Number(document.getElementById('virus-lifetime')?.value||30)}):new L.OfficeVentilation(s,a.intensity,Date.now()>>>0);
   e.begin(a.type,hazard,a.floor);return a.type==='infection'?(a.demo?'已启动逐层传播演示：每层一名初始携带者，本层走动与喷嚏传播；复原后回到日常办公。':'已启动全楼呼吸道感染，携带者通过呼吸和喷嚏传播。'):'已启动全楼通风污染，各层出风口持续释放并扩散。';
  }
  doors(a){
   const s=this.b.society,floors=a.all?Array.from({length:30},(_,i)=>i+1):[a.floor];let count=0;
   for(const f of floors){const copies=new Set([s.model(f),L.app.model,this.b.continuous.models[f-1]]);for(const model of copies)if(model?.towerFloor===f)for(const door of model.doors){if(!this.doorSaved.has(door))this.doorSaved.set(door,door.open);if(model.setDoor(door.id,a.open))count++;}s.grids.delete(f);for(const r of L.robotArmy?.robots||[])if(r.floor===f){r.path=[];r.pathAt=0;r.repath=0;}for(const actor of s.agents)if(Math.round(actor.floor)===f){actor.zPath=[];actor.path=[];actor.onArrival=null;actor.repath=s.time+(actor.id%11)*.18;actor.nextHuntAt=0;actor.escapeRetryAt=s.time+(actor.id%11)*.18;if(!actor.zombieControlled&&actor.state==='moving'){actor.state='waiting';actor.until=s.time+1+(actor.id%11)*.2;actor.vx=actor.vz=0;}actor.progressCheck=null;}}
   this.b.updateTowerBatches(true);this.v.firstPerson.collisionModel=null;this.v.shadowDirty=true;if(this.v.model)this.v.grid=s.grid(this.v.model.towerFloor);return(a.all?'全楼':'第'+a.floor+'层')+'房门、防火门'+(floors.includes(1)?'和公司主大门':'')+'已'+(a.open?'打开':'关闭')+'。';
  }
  spawn(a){
   const s=this.b.society,z=s.zombie,total=s.agents.filter(q=>q.directorSpawn).length;if(total+a.count>200)throw Error('场景最多同时保留 200 个生成的进攻者，请先清除灾害。');
   if(!z.active)z.start({count:0});
   const g=!a.exterior?s.grid(a.floor):null,free=g?.nav(.24).mainFree;
   for(let i=0;i<a.count;i++){
    const actor=s.makeAgent(a.exterior?1:a.floor,null,'visitor');actor.directorSpawn=true;actor.name=(a.monster?'复仇女神':'实验体')+' '+String(total+i+1).padStart(3,'0');actor.job=a.monster?'重型生化怪物':'丧尸进攻者';actor.appearance={...actor.appearance,height:a.monster?1.6:1.02,build:a.monster?1.5:1.03,outfit:0};actor.directorMonster=a.monster;
    if(a.exterior){actor.location='outside';actor.x=(i%12-5.5)*1.05;actor.z=28+Math.floor(i/12)*1.1;}else{const p=g.point(free[(i*71)%free.length]);actor.x=p.x;actor.z=p.z;}
    z.infect(actor,null,true);actor.turnRemaining=.1;actor.zombieHP=a.monster?800:100;actor.action='向大楼进攻';
   }s.bodies.rebuild();return'已生成 '+a.count+' 个'+(a.monster?'复仇女神型重型怪物':'丧尸')+'，'+(a.exterior?'从楼外向大楼进攻。':'位于 '+a.floor+' 层。');
  }
  advanceAttacker(a,dt){
   const s=this.b.society,lane=((a.id%5)-2)*.8;
   if(a.z>14.9||Math.abs(a.x-lane)>.9){s.exterior.chase(a,{x:lane,z:14.1},dt);a.action='向公司主入口进攻';return;}
   const door=s.model(1).doors.find(d=>d.id==='mainExitDoor');
   if(door?.open===false){a.vx=a.vz=0;a.state='waiting';a.action='被关闭的公司大门阻挡';return;}
   const g=s.grid(1),i=g.nearest({x:lane,z:11.1},.24);if(i<0)return;const p=g.point(i);
   Object.assign(a,{location:'floor',floor:1,x:p.x,z:p.z,directorEntered:true,streetHunt:null,zPath:[],zKind:'',zTarget:null,nextHuntAt:0,action:'已进入大厅，寻找生还者'});
  }
  visuals(){
   this.fx=new T.Group();this.fx.name='灾害 · 合批火焰烟气';this.fx.userData.noAO=true;this.v.scene.add(this.fx);
   const count=24000,positions=new Float32Array(count*3),seeds=new Float32Array(count*3);for(let i=0;i<count*3;i++)seeds[i]=this.random();
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('seed',new T.BufferAttribute(seeds,3));geometry.setDrawRange(0,0);
   this.fireMaterial=new T.ShaderMaterial({uniforms:{time:{value:0},pixel:{value:Math.min(devicePixelRatio,2)},scale:{value:1}},transparent:true,depthWrite:false,blending:T.NormalBlending,toneMapped:false,
    vertexShader:`attribute vec3 seed;uniform float time;uniform float pixel;uniform float scale;varying float age;varying float smoke;void main(){smoke=step(.82,seed.z);age=fract(time*(.35+seed.x*.42)+seed.y);vec3 p=position;p.x+=sin(time*1.4+seed.x*40.)*(smoke>.5?.8:.18);p.z+=cos(time*1.1+seed.y*40.)*(smoke>.5?.4:.08);p.y+=age*(smoke>.5?7.:3.2)*(.65+scale*.35);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((smoke>.5?7600.:3900.)*pixel*scale*(.6+age)/max(1.,-mv.z),2.,95.);}`,
    fragmentShader:`varying float age;varying float smoke;void main(){vec2 uv=gl_PointCoord;vec2 shape=uv-.5;if(smoke<.5){shape.x=(shape.x+sin(uv.y*13.+age*17.)*.045)/(.3+uv.y*.7);shape.y*=.85;}float r=length(shape)*2.;if(r>1.)discard;float a=pow(1.-r,.8)*pow(1.-age,.65);vec3 c=mix(vec3(1.,.52,.045),vec3(.85,.10,.005),age);if(smoke>.5)c=vec3(.19,.18,.19);gl_FragColor=vec4(c,a*(smoke>.5?.33:1.2));}`});
   this.firePoints=new T.Points(geometry,this.fireMaterial);this.firePoints.frustumCulled=false;this.fx.add(this.firePoints);
   this.flashGeometry=new T.SphereGeometry(1,12,8);
  }
  pulse(at,intensity){this.ensureVisuals();const material=new T.MeshBasicMaterial({color:'#ffa340',transparent:true,opacity:.65,depthWrite:false,toneMapped:false,wireframe:false}),mesh=new T.Mesh(this.flashGeometry,material);mesh.position.copy(at);this.fx.add(mesh);this.pulses.push({mesh,at:this.time,intensity});}
  update(dt,options={}){
   this.environment=options.environment||L.collaboration?.environment||'office';this.isTransitioning=!!options.isTransitioning;this.active=options.active!==false&&this.environment!=='station'&&!this.isTransitioning&&!document.hidden;
   if(this.fx)this.fx.visible=this.active;if(this.physics)this.physics.group.visible=this.active;
   const run=options.running??this.b.society.running;
   L.megastructureFleet?.update(dt,{active:this.active,running:run,environment:this.environment,isTransitioning:this.isTransitioning});
   if(!this.active)return;
   L.scenarioRuntime?.update(dt,{running:run});L.scenarioSafety?.update(dt,{running:run});
   if(!this.fires.size&&!this.physics&&!this.pulses.length&&!this.impactShake)return;
   this.ensureVisuals();const s=this.b.society;if(run)this.time+=dt;
   if(this.physics&&run)this.physics.update(dt);else this.physics?.syncFrame();
   L.syncDisasterFrame(this.fx,this.b);
   if(this.fires.size||this.fireAttachment.detached.length)this.fireAttachment.update(dt,run);
   for(let i=this.pulses.length-1;i>=0;i--){const p=this.pulses[i],age=this.time-p.at;if(age>1.4){p.mesh.parent?.remove(p.mesh);p.mesh.material.dispose();this.pulses.splice(i,1);continue;}p.mesh.scale.setScalar(1+age*(5+p.intensity*4));p.mesh.material.opacity=Math.max(0,.7*(1-age/1.4));}
   // Shake all intact storeys in the batched overview without rebuilding geometry.
   const q=this.physics?.quakeState;let shake=0;if(q){const age=this.physics.time-q.start,weight=Math.max(0,1-age/q.duration);shake=Math.sin(age*14)*q.intensity*.09*weight;}if(this.impactShake){const age=this.time-this.impactShake.at;if(age<.6)shake+=Math.sin(age*24)*this.impactShake.intensity*Math.exp(-age*7);else this.impactShake=null;}this.b.tower.position.x=shake;
   if(this.physics?.destroyedFloors.size)this.b.updateTowerBatches();
  }
  extinguish(a){return this.fireAttachment.extinguish(a);}
  clearEffects(){
   this.generation++;
   L.robotLibrary?.close();L.robotArmy?.clear({hostileOnly:true});L.robotConflict?.reset();L.robotCargo?.reset();this.b.reactions?.resetRobotDanger?.();
   this.fireAttachment.clear();
   L.megastructureFleet?.clear();
   this.impactShake=null;
   this.physics?.dispose();this.physics=null;for(const fire of this.fires.values())if(fire!==this.b.society.emergency.hazard)fire.dispose?.();this.fires.clear();this.fireState?.clear();this.firePoints?.geometry.setDrawRange(0,0);for(const p of this.pulses){p.mesh.parent?.remove(p.mesh);p.mesh.material.dispose();}this.pulses=[];this.b.tower.position.x=0;
   const s=this.b.society;for(const model of new Set([...s.models,L.app.model,...this.b.continuous.models]))for(const door of model?.doors||[])if(this.doorSaved.has(door))model.setDoor(door.id,this.doorSaved.get(door));this.doorSaved.clear();s.grids.clear();
   if(s.agents.some(a=>a.directorSpawn)){s.agents=s.agents.filter(a=>!a.directorSpawn);for(const batch of L.characterAssets?.batches||[])batch.states.clear();s.bodies.rebuild();}this.b.updateTowerBatches(true);
  }
 }
 L.createOfficeFire=(s,f,intensity=1,options={})=>{const fireGrid=L.officeFastGrid(s.model(f),.4),seed=crypto.getRandomValues(new Uint32Array(1))[0],h=new L.FireModel(fireGrid,{seed,sourcePower:620*intensity,fireHeat:450*intensity,conductivity:1.4,ignitionTemperature:92,spreadTemperature:37,fieldInterval:.16,smokeDiffusion:.5,ceilingRise:.22,burnRate:.12,persistentBurning:true,fireSmoke:.34}),free=fireGrid.nav(.24).mainFree;const fuel=new Float32Array(fireGrid.size).fill(.24);for(const item of s.model(f).layoutItems)if(['desk','wood','fabric','chair'].includes(item.key)){const i=fireGrid.index(item.x,item.z);if(i>=0)for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){const j=i+dz*fireGrid.cols+dx;if(j>=0&&j<fuel.length&&!fireGrid.blocked(j))fuel[j]=.95;}}h.setFuelMap(fuel);const pool=free.filter(i=>fuel[i]>.5),source=options.position&&Number.isFinite(options.position.x)&&Number.isFinite(options.position.z)?free.reduce((best,i)=>{const p=fireGrid.point(i),q=fireGrid.point(best);return Math.hypot(p.x-options.position.x,p.z-options.position.z)<Math.hypot(q.x-options.position.x,q.z-options.position.z)?i:best;},free[0]):(pool.length?pool:free)[seed%(pool.length||free.length)];h.addSource({cell:source,power:620*intensity,smoke:.54*intensity,flame:1});h.rebuildEscapeDistance(L.TOWER.core.stairs.map(a=>a.entry));return h;};
 L.syncDisasterFrame=(group,b)=>{const v=b.view,interior=b.phase==='interior',origin=interior?((b.continuous.active?b.continuous.origin:v.model?.towerFloor||b.selected)-1)*3.6:0,focus=interior?v.floorOrigin:null;group.position.set(focus?.x||0,(focus?.y||0)-origin+(interior?0:.82),focus?.z||0);};
 L.DisasterDirector=DisasterDirector;
 L.initializeDisasterExtensions=b=>{if(L.disasterDirector)return L.disasterDirector;if(!b?.society?.emergency)throw Error('办公模拟尚未准备好。');L.disasterDirector=new DisasterDirector(b);L.scenarioRuntime=new L.ScenarioRuntime(b);L.scenarioSafety=new L.ScenarioSafety(b);L.megastructureFleet=new L.MegastructureFleet(b);L.megastructureFleet.ready=true;return L.disasterDirector;};
})();
