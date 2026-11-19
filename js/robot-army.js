/* Migrated articulated models + game-only robot combat, with pooled rendering. */
(() => {
 'use strict';const L=window.IndoorLab,C=window.CoScene,T=THREE,$=id=>document.getElementById(id),P=window.RobotArmyProtocol;
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
 class RobotArmy {
  constructor(b){
   this.b=b;this.v=b.view;this.app=L.app;this.externalRunning=true;this.combatEnabled=true;this.robots=[];this.serial=0;this.time=0;this.shots=[];this.beams=[];this.events=[];this.stats={bullet:0,laser:0,melee:0,hits:0,kills:0};this.batches=[];this.batchDirty=true;this.geometryKeys=new WeakMap();this.pose=new T.Object3D();this.savedCount=0;
   this.group=new T.Group();this.group.name='迁移机器人 · 实体与战斗';this.group.userData.noAO=true;this.v.scene.add(this.group);this.virtual=new T.Group();this.virtual.visible=false;this.group.add(this.virtual);
   this.effects();this.observation=new L.RobotObservation(this);this.perception=new L.RobotPerception(this);this.ui();
  }
  get studio(){return L.collaboration?.studio||{saved:[]};}

  floor(){return this.b.continuous.active?this.b.continuous.origin:this.b.selected||1;}
  locationName(){return this.floor()+'F';}
  toast(text){const status=$('army-status');if(status)status.textContent=L.brandNeutralText?.(text)??text;L.collaboration?.toast?.(text);}
  ui(){
   const panel=document.createElement('dialog');panel.id='robot-army-panel';panel.setAttribute('aria-labelledby','army-title');
   panel.innerHTML='<div class="co-heading"><div><small>ROBOT / SCENARIO</small><h2 id="army-title">机器人对抗实验</h2></div><button id="army-close" class="co-close" aria-label="关闭机器人事件实验">×</button></div><p class="co-note">使用现有工业模型，在办公楼与园区观察机器人进攻、避让和人员反应。</p><div class="army-settings"><label>机器人<select id="army-type"></select></label><label>部署数量<input id="army-count" type="number" min="1" max="120" value="6"></label><label>位置<select id="army-location"><option value="outside">楼外主入口</option><option value="floor">当前楼层</option></select></label><label>攻击方式<select id="army-weapon"><option value="auto">依型号自动</option><option value="bullet">子弹射击</option><option value="laser">激光束</option><option value="melee">近战冲击</option></select></label></div><div class="army-actions"><button id="army-deploy" class="co-action primary">生成进攻机器人</button><button id="army-pause" class="co-action">停止进攻</button><button id="army-clear" class="co-action">清除进攻机器人</button></div><p id="army-status" class="co-note" role="status"></p><p id="army-summary" class="co-note"></p>';
   document.body.append(panel);$('army-close').onclick=()=>panel.close();$('army-clear').onclick=()=>this.clear();
   $('army-pause').onclick=()=>{this.combatEnabled=!this.combatEnabled;this.shots.length=this.beams.length=0;this.refresh();};
   $('army-deploy').onclick=async()=>{const button=$('army-deploy');button.disabled=true;try{this.toast(await this.spawn({robotType:$('army-type').value,count:Number($('army-count').value),weapon:$('army-weapon').value,floor:this.floor(),exterior:$('army-location').value==='outside',hostile:true}));}catch(error){this.toast(error.message);}finally{button.disabled=false;}};
  }
  open(){if(L.collaboration?.environment==='station')return false;if(document.pointerLockElement)document.exitPointerLock();const select=$('army-type');select.replaceChildren();for(const spec of C.presets){const option=document.createElement('option');option.value=spec.type;option.textContent=L.brandNeutralText?.(spec.label)??spec.label;select.append(option);}if(L.collaboration?.environment==='campus')$('army-location').value='outside';$('army-location').disabled=L.collaboration?.environment==='campus';$('robot-army-panel').showModal();this.refresh();return true;}
  async spawn(a){
   if(L.collaboration?.environment==='station')throw Error('机器人事件适用于办公楼与园区。');
   a=P.validate(a);if(L.collaboration?.environment==='campus')a.exterior=true;if(a.operation==='clear'){this.clear();return'已移除进攻机器人军队。';}if(a.operation==='pause'||a.operation==='resume'){this.combatEnabled=a.operation==='resume';this.shots=[];this.beams=[];return this.combatEnabled?'机器人军队已恢复进攻。':'机器人已停止进攻。';}if(this.robots.length+a.count>120)throw Error('场景最多同时保留 120 台新机器人，请先清除已有军队。');this.combatEnabled=true;
   const saved=this.studio.saved.find(s=>s.name===a.robotName),chosen=saved?{type:saved.type,name:saved.name,randomized:false}:P.resolve(a.robotName,a.robotType,()=>L.disasterDirector?.random()??Math.random());
   const preset=saved||C.presets.find(s=>s.type===chosen.type),start=this.robots.length,requestVersion=this.spawnVersion||0,environment=L.collaboration?.environment||'office';
   await C.prepareRobot(preset);
   if(requestVersion!==(this.spawnVersion||0)||environment!==(L.collaboration?.environment||'office')||L.collaboration?.switching)throw Error('场景已改变或实验已复原，本次生成已取消。');
   const mixed=a.robotType==='random'&&!a.robotName&&!saved;
   for(let i=0;i<a.count;i++){const model=mixed?C.presets[Math.floor((L.disasterDirector?.random()??Math.random())*C.presets.length)]:preset;await this.spawnOne({...model,name:mixed?P.catalog.find(s=>s.type===model.type).name:chosen.name},{...a,index:i,total:a.count,requestVersion,environment,weapon:a.weapon==='auto'?(P.catalog.find(s=>s.type===model.type)?.weapon||'bullet'):a.weapon});}
   this.refresh();this.app.play(true);this.b.society.running=true;if(L.collaboration?.environment==='campus')L.collaboration.externalRunning=true;
   return(a.robotName&&chosen.randomized?'未识别“'+a.robotName+'”，随机选择 '+chosen.name+'。':'')+'已生成 '+(this.robots.length-start)+' 台 '+(mixed?'随机混合机器人':chosen.name)+'，'+(a.hostile?'将以'+({bullet:'子弹',laser:'激光',melee:'近战'}[a.weapon]||'该型号的默认武器')+'攻击场景中的人类。':'已加入当前场景。');
  }
  async buildFromDescription(action,entry=null){
   if(L.collaboration?.environment==='station')throw Error('机器人事件适用于办公楼与园区。');
   const requestVersion=this.spawnVersion||0,environment=L.collaboration?.environment||'office';
   const valid=()=>requestVersion===(this.spawnVersion||0)&&environment===(L.collaboration?.environment||'office')&&!L.collaboration?.switching&&action.requestValid?.()!==false;
   const a=window.RobotControlProtocol.validate(action,{floor:this.floor(),interior:this.b.phase==='interior'});
   if(environment==='campus'){a.exterior=true;a.floor=1;}
   if(this.robots.length+a.count>120)throw Error('场景最多同时保留 120 台新机器人，请先移除已有机器人。');
   if(!a.exterior&&L.disasterDirector?.physics?.destroyedFloors.has(a.floor))throw Error(a.floor+'F 已损毁，请先复原再放置机器人。');
   const preset=entry?.spec||C.presets.find(p=>p.type===a.robotType),spec={...window.RobotContract.interpret(a.prompt,preset),type:a.robotType,...(entry?{name:entry.name,libraryEntry:entry}: {})};
   spec.source=entry?.kind==='generated'?(entry.bodyPlan==='articulated'?'lux3d-part-joints':'lux3d-skinning'):spec.type==='humanoid'?'unitree-urdf':'local-articulated';await C.prepareRobot(spec);if(!valid())throw Error('场景已改变或实验已复原，本次生成已取消。');const added=[];
   try{for(let i=0;i<a.count;i++)added.push(await this.spawnOne({...spec},{floor:a.floor,exterior:a.exterior,hostile:a.behavior==='attack',behavior:a.behavior,site:a.site,weapon:a.weapon,index:i,requestVersion,environment,requestValid:valid}));if(!valid())throw Error('场景或机器人窗口已改变，本次调用已取消。');}
   catch(error){for(const r of added){const at=this.robots.indexOf(r);if(at>=0){this.robots.splice(at,1);r.alive=false;L.robotConflict?.forget?.(r);L.robotCargo?.forget?.(r);r.root.parent?.remove(r.root);C.disposeModel(r.root);}}L.robotContacts.invalidate();this.batchDirty=true;this.draw();throw error;}
   for(const r of added){r.createdFromDescription=true;r.turret.scale.setScalar(r.hostile?1:0);}
   if(a.behavior==='attack')this.combatEnabled=true;this.update(0);this.refresh();this.app.play(true);this.b.society.running=true;if(environment==='campus')L.collaboration.externalRunning=true;
   const place=a.exterior?({entrance:'大楼入口前',back:'大楼后方',left:'大楼左侧',right:'大楼右侧'}[a.site]):a.floor+'F',behavior={wander:'友好巡游，沿可通行路线自由走动',standby:'原地待命',attack:'搜寻并攻击人类'}[a.behavior];
   return '已在'+place+'生成 '+added.length+' 台'+(entry?.name||P.catalog.find(p=>p.type===spec.type).name)+'；'+behavior+'。';
  }
  async spawnOne(spec,options){
   if(this.robots.length>=120)throw Error('场景已达到 120 台机器人上限。');await C.prepareRobot(spec);if(options.requestVersion!==undefined&&(options.requestVersion!==(this.spawnVersion||0)||options.environment!==(L.collaboration?.environment||'office')||L.collaboration?.switching||options.requestValid?.()===false))throw Error('场景已改变或实验已复原，本次生成已取消。');if(this.robots.length>=120)throw Error('场景已达到 120 台机器人上限。');const root=C.makeRobot(spec),id=++this.serial,index=options.index??this.robots.length,floor=options.floor||1;
   const r={id,spec,root,task:spec.task,weapon:options.weapon==='auto'||!options.weapon?P.catalog.find(s=>s.type===spec.type)?.weapon||'bullet':options.weapon,hostile:options.hostile===true,floor:options.exterior?1:floor,location:options.exterior?'outside':'floor',x:(index%12-5.5)*1.4,z:29+Math.floor(index/12)*1.4,angle:Math.PI,speed:0,distance:0,phase:0,radius:(spec.type==='quadruped'?.30:spec.type==='carrier'?.36:.27)*(spec.scale||1),height:root.userData.height||1.3,state:'advance',nextFire:this.time+(index%7)*.12,nextSense:0,path:[],pathAt:0,attackAt:-100,alive:true,visionRange:18,visionAngle:Math.PI*.75};
   r.radius=root.userData.contactRadius??r.radius;r.contactOwner=this;r.behavior=options.behavior||(r.hostile?'attack':'standby');
   if(!options.exterior){const g=this.b.society.grid(floor),free=g.nav(r.radius).mainFree;if(!free.length){C.disposeModel(root);throw Error('当前楼层没有足够的部署净空。');}Object.assign(r,g.point(free[(index*97)%free.length]));}
   if(options.exterior&&!options.site){const nav=this.b.society.exterior.navigation(),start=this.robots.filter(q=>q.location==='outside').length;let spot=null;for(let n=0;n<360;n++){const slot=start+index+n,p={x:(slot%12-5.5)*1.4,z:29+Math.floor(slot/12)*1.4};Object.assign(r,p);if(nav.isClear(p.x,p.z,r.radius)&&L.robotContacts.canPlace(r,p.x,p.z)&&!this.b.society.agents.some(a=>L.isOutdoorAgent(a)&&distance(a,p)<r.radius+.3)){spot=p;break;}}if(!spot){C.disposeModel(root);throw Error('入口外暂时没有未被占用的部署空间。');}Object.assign(r,spot);}
   if(!options.exterior){const g=this.b.society.grid(floor),free=g.nav(r.radius).mainFree;let spot=null;for(let n=0;n<free.length;n++){const p=g.point(free[(index*97+n*31)%free.length]);if(L.robotContacts.canPlace(r,p.x,p.z)&&!this.b.society.agents.some(a=>a.location==='floor'&&Math.round(a.floor)===floor&&distance(a,p)<r.radius+.26)){spot=p;break;}}if(!spot){C.disposeModel(root);throw Error('当前楼层没有未被占用的机器人部署空间。');}Object.assign(r,spot);}
   if(options.exterior&&options.site){const center=({entrance:{x:0,z:27},back:{x:0,z:-24},left:{x:-27,z:0},right:{x:27,z:0}})[options.site]||{x:0,z:27},g=this.b.society.exterior.navigation();let spot=null;for(let n=0;n<1024;n++){const k=index+n,p={x:center.x+(k%12-5.5)*1.2,z:center.z+(Math.floor(k/12)%12-5.5)*1.2};if(g.isClear(p.x,p.z,r.radius)&&L.robotContacts.canPlace(r,p.x,p.z)&&!this.b.society.agents.some(a=>L.isOutdoorAgent(a)&&distance(a,p)<r.radius+.26)){spot=p;break;}}if(!spot){C.disposeModel(root);throw Error('大楼外指定区域没有足够的部署净空。');}Object.assign(r,spot);}
   this.weapon(r);this.virtual.add(root);this.robots.push(r);L.robotContacts.invalidate();this.batchDirty=true;return r;
  }
  weapon(r){
   const pivot=r.turret=new T.Group();pivot.position.y=r.spec.type==='humanoid'?r.height*.74:r.height*.85;r.root.add(pivot);const dark=C.material('#25374b'),accent=C.material(r.weapon==='laser'?'#37d7ee':'#445c75');
   const housing=C.part(pivot,'box',dark,[.2,.16,.28],[0,.05,.04]);housing.name='combat-gimbal';
   if(r.weapon!=='melee'){C.part(pivot,'cylinder',accent,[.045,.35,.045],[0,.05,.25],[Math.PI/2,0,0]);C.part(pivot,'cylinder',dark,[.057,.035,.057],[0,.05,.43],[Math.PI/2,0,0]);}
   else{const guard=r.blade=new T.Group();pivot.add(guard);C.part(guard,'box',accent,[.68,.05,.14],[0,0,.3]);}
   r.flash=C.part(pivot,'sphere',new T.MeshBasicMaterial({color:r.weapon==='laser'?'#65efff':'#ffd367',toneMapped:false}),[0,0,0],[0,.05,.48]);
  }
  effects(){
   this.bulletMesh=new T.InstancedMesh(new T.SphereGeometry(1,6,4),new T.MeshBasicMaterial({color:'#ffbd45',toneMapped:false}),320);this.bulletMesh.count=0;this.bulletMesh.frustumCulled=false;this.group.add(this.bulletMesh);
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(120*6),3));this.beamMesh=new T.LineSegments(geometry,new T.LineBasicMaterial({color:'#23dbea',transparent:true,opacity:.9,toneMapped:false}));this.beamMesh.frustumCulled=false;this.group.add(this.beamMesh);
  }
  sees(r,a){return this.b.reactions.canSee({x:r.x,z:r.z,floor:r.floor,location:r.location,absoluteY:r.location==='outside'?this.b.society.exterior.ground(r.x,r.z)-.82:(r.floor-1)*3.6},a);}
  blocker(a,x,z,feet,from=a){
   const cx=Math.floor(x/1.5),cz=Math.floor(z/1.5);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const r of this.robotCells?.get((cx+dx)+':'+(cz+dz))||[]){const base=r.worldBase;if(feet>=base+r.height||feet+1.7<=base)continue;const limit=r.radius+.24,prior=distance(from,r),next=Math.hypot(x-r.x,z-r.z);if(next<limit&&(next<prior-1e-6||prior>=limit))return r;}return false;
  }
  route(r,goal){if(this.routeBudget<=0)return null;this.routeBudget--;return L.officeRoute(L.robotContacts.navigation(this.b.society.grid(r.floor)),r,goal);}
  move(r,goal,dt){
   if(r.balance){r.speed=0;return;}
   const s=this.b.society;let target=goal;
   if(r.location==='floor'){
    const g=L.robotContacts.navigation(s.grid(r.floor));if(!g.lineClear(r,goal,r.radius)||L.crossesClosedRoomDoor(s.model(r.floor),r,goal)){
     if(this.time>=(r.repath||0)){const route=this.route(r,goal);if(route===null){r.speed=0;return;}r.path=route;r.pathAt=0;r.repath=this.time+.7+(r.id%6)*.1;}
     while(r.pathAt<r.path.length&&distance(r,r.path[r.pathAt])<.25)r.pathAt++;target=r.path[r.pathAt];if(!target){r.speed=0;return;}
    }
   }
   const d=distance(r,target);if(d<.08){r.speed=0;return;}let dx=(target.x-r.x)/d,dz=(target.z-r.z)/d;
   // Robots keep a small separation; humans can still be approached for melee.
   for(const q of this.robots)if(q!==r&&q.location===r.location&&q.floor===r.floor){const gap=distance(r,q);if(gap>.01&&gap<.75){dx+=(r.x-q.x)/gap*(.75-gap)*1.5;dz+=(r.z-q.z)/gap*(.75-gap)*1.5;}}
   const len=Math.hypot(dx,dz)||1,speed=r.root.userData.moveSpeed??(r.spec.type==='quadruped'?3.4:r.spec.type==='carrier'?1.7:2.3),step=Math.min(d,speed*dt);let moved=false;
   for(const turn of [0,.5,-.5,1,-1]){const c=Math.cos(turn),si=Math.sin(turn),x=r.x+(dx*c-dz*si)/len*step,z=r.z+(dz*c+dx*si)/len*step;
    if(r.location==='floor'){if(!s.grid(r.floor).isClear(x,z,r.radius)||L.crossesClosedRoomDoor(s.model(r.floor),r,{x,z}))continue;}else if(!s.exterior.navigation().isClear(x,z,r.radius))continue;
    if(!L.robotContacts.canMove(r,x,z))continue;
    const delta=Math.hypot(x-r.x,z-r.z);r.x=x;r.z=z;r.distance+=delta;r.phase+=delta*7;r.speed=delta/Math.max(dt,.001);r.angle+=Math.atan2(Math.sin(Math.atan2(dx,dz)-r.angle),Math.cos(Math.atan2(dx,dz)-r.angle))*Math.min(1,dt*8);moved=true;break;
   }if(!moved)r.speed=0;
  }
  enter(r,dt){const lane=((r.id%5)-2)*.8;if(r.z>15||Math.abs(r.x-lane)>1){this.move(r,{x:lane,z:14.1},dt);return;}const door=this.b.society.model(1).doors.find(d=>d.id==='mainExitDoor');if(door?.open===false){r.state='blocked-door';r.speed=0;return;}r.location='floor';r.floor=1;const g=this.b.society.grid(1),i=g.nearest({x:lane,z:11},r.radius);if(i>=0)Object.assign(r,g.point(i));r.path=[];r.state='advance';}
  settleFloor(r,f,side){
   const s=this.b.society,stair=L.TOWER.core.stairs[side],goal={x:Math.sign(stair.doorX)*(Math.abs(stair.doorX)-.95),z:stair.entry.z},g=s.grid(f),i=g.nearest(goal,r.radius);r.floor=f;r.location='floor';if(i>=0)Object.assign(r,g.point(i));r.stair=null;r.stairY=null;r.path=[];r.pathAt=0;r.repath=0;r.target=null;r.memory=null;r.searchGoal=null;r.nextSense=this.time;r.angle=Math.atan2(-r.x,-r.z);
  }
  useStairs(r,target,dt){
   if(r.stair){const stair=r.stair;stair.t=Math.min(1,stair.t+dt/5);const p=L.sampleTowerStair(stair.side,stair.to>stair.from?stair.t:1-stair.t);r.x=p.x;r.z=p.z;r.stairY=(Math.min(stair.from,stair.to)-1)*3.6+p.y;r.angle=p.angle;r.speed=1;r.phase+=dt*7;if(stair.t>=1)this.settleFloor(r,stair.to,stair.side);return;}
   const to=L.clamp(r.floor+(target.floor>r.floor?1:-1),1,30);if(to===r.floor)return;
   const choices=L.TOWER.core.stairs.map((s,side)=>({s,side,d:distance(r,s.entry)})).sort((a,b)=>a.d-b.d),choice=choices.find(({s})=>this.b.society.model(r.floor).doors.find(d=>d.id===s.id+'-door')?.open!==false&&this.b.society.model(to).doors.find(d=>d.id===s.id+'-door')?.open!==false);
   if(!choice){r.state='blocked-door';r.speed=0;return;}const entry={x:Math.sign(choice.s.doorX)*(Math.abs(choice.s.doorX)-.95),z:choice.s.entry.z};if(distance(r,entry)<.65){r.target=null;r.path=[];r.stair={from:r.floor,to,side:choice.side,t:0};return;}this.move(r,entry,dt);
  }
  alertWitnesses(r,victim){
   this.b.reactions.robotAssault?.(r,victim);
   const s=this.b.society,base=r.location==='outside'?s.exterior.ground(r.x,r.z)-.82:(r.floor-1)*3.6;
   this.perception.noise({x:r.x,z:r.z,floor:r.floor,location:r.location},28);
   this.b.reactions.frighten({x:victim?.x??r.x,y:base,z:victim?.z??r.z,outdoors:r.location==='outside'},{victim: victim||null,radius:18,reason:'目击机器人攻击，远离机器人'});
   for(const a of s.agents)if(a.fear&&Math.round(a.floor)===r.floor&&distance(a,victim||r)<18){a.fear.source={x:r.x,z:r.z};if(!a.fear.robotId){a.fear.robotId=r.id;const g=s.grid(a.floor),angle=Math.atan2(a.x-r.x,a.z-r.z),point={x:a.x+Math.sin(angle)*5,z:a.z+Math.cos(angle)*5},at=g.nearest(point,.24);if(at>=0){a.fear.scatter=g.point(at);a.fear.scattered=false;}}}
  }
  damage(a,amount,r){
   if(!a||a.isPlayer||a.health==='dead')return;a.civilianHP=Math.max(0,(a.civilianHP??100)-amount);this.stats.hits++;
   this.alertWitnesses(r,a);
   if(a.civilianHP<=0){a.health='dead';a.deathTime=this.b.society.time;a.zombieAnim='dead';a.pose='stand';a.action='被机器人击倒';a.vx=a.vz=0;this.stats.kills++;}
  }
  fire(r,target){
   if(this.time<r.nextFire||!this.sees(r,target))return;
   r.attackAt=this.time;r.state=r.weapon==='melee'?'melee-windup':r.weapon==='laser'?'laser-charge':'firing';r.angle=Math.atan2(target.x-r.x,target.z-r.z);
   const base=r.location==='outside'?this.b.society.exterior.ground(r.x,r.z)-.82:(r.floor-1)*3.6,from=V(r.x,base+r.turret.position.y+.05,r.z).add(V(Math.sin(r.angle)*.48,0,Math.cos(r.angle)*.48)),to=V(target.x,(Math.max(1,target.floor)-1)*3.6+.95,target.z);
   if(r.weapon==='bullet'){if(this.shots.length<320){const velocity=to.clone().sub(from).normalize().multiplyScalar(48);this.shots.push({position:from,velocity,age:0,target,robot:r,floor:r.floor,outside:r.location==='outside'});this.stats.bullet++;}r.nextFire=this.time+.32+(r.id%3)*.04;}
   else if(r.weapon==='laser'){this.beams.push({from,to,robot:r,target,at:this.time,hit:false});r.nextFire=this.time+1.35;this.stats.laser++;}
   else{r.meleeTarget=target;r.meleeHit=false;r.nextFire=this.time+1.05;this.stats.melee++;}
   if(this.time>(r.alarmAt||0)){this.alertWitnesses(r,target);r.alarmAt=this.time+2;}
  }
  animate(r){
   if(r.root.userData.libraryAnimate){r.root.userData.libraryAnimate(r,this.time);return;}
   C.animateRobot(r.root,r.phase,r.speed>.05,!r.hostile&&r.speed<.05,this.time);
   const age=this.time-r.attackAt,attacking=age<.65,aim=r.state==='firing'||r.state==='laser-charge',recoil=Math.exp(-age*18)*.08;
   r.turret.rotation.y=0;r.turret.position.z=-recoil;r.flash.scale.setScalar(attacking&&age<.08?.12:0);if(r.blade)r.blade.rotation.y=attacking?Math.sin(age/.65*Math.PI*1.5)*2:0;
   const data=r.root.userData;if(data.officialG1){const values=r.weapon==='melee'&&attacking?{right_shoulder_pitch_joint:-.4-Math.sin(age/.65*Math.PI)*1.2,right_elbow_joint:.7-Math.sin(age/.65*Math.PI)*.6,waist_yaw_joint:Math.sin(age/.65*Math.PI)*.3}:aim?{right_shoulder_pitch_joint:-1.1+recoil,left_shoulder_pitch_joint:-.75,right_elbow_joint:.18,left_elbow_joint:.7,waist_pitch_joint:.06}:null;if(values)for(const d of data.jointDescriptors)if(values[d.name]!=null){const joint=data.joints[d.name];joint.quaternion.copy(joint.userData.baseQuaternion).multiply(new T.Quaternion().setFromAxisAngle(V(...d.axis),L.clamp(values[d.name],d.lower,d.upper)));}}
   if(data.industrialQuadruped&&r.weapon==='melee'&&attacking){data.body.rotation.x=-Math.sin(age/.65*Math.PI)*.12;}
  }
  update(dt,present=true,running=this.b.society.running){
   this.routeBudget=4;let senseBudget=8;const s=this.b.society,run=dt>0&&running&&!this.b.matrixLab?.active;if(run)this.time+=dt;
   const needsHumans=run&&this.combatEnabled&&this.robots.some(r=>r.alive!==false&&r.hostile),humans=needsHumans?s.agents.filter(a=>!a.isPlayer&&a.health!=='dead'&&!['zombie','turning'].includes(a.health)&&['floor','outside','stairs','escaped'].includes(a.location)):[];
   const byFloor=new Map();for(const a of humans){const key=L.isOutdoorAgent(a)?'outside':Math.round(a.floor);if(!byFloor.has(key))byFloor.set(key,[]);byFloor.get(key).push(a);}
   this.perception.noises=this.perception.noises.filter(noise=>this.time-noise.at<=2);
   for(const r of this.robots){
    if(r.alive===false)continue;const recovering=L.robotContacts.step(r,run?dt:0);
    const managed=run&&!recovering&&(!r.hostile||this.combatEnabled)&&L.robotConflict?.control(r,this,dt);
    if(run&&!recovering&&!managed&&(!r.hostile||this.combatEnabled)){
     if(r.hostile){if(!r.stair&&this.time>=r.nextSense&&senseBudget>0){senseBudget--;this.perception.sense(r,byFloor.get(r.location==='outside'?'outside':Math.round(r.floor))||[]);r.nextSense=this.time+.22+(r.id%5)*.025;}
      const a=r.target;if(r.stair){this.useStairs(r,{floor:r.stair.to},dt);}
      else if(r.location==='outside'&&(!a||distance(r,a)>9)){this.enter(r,dt);}
      else if(a&&a.health!=='dead'&&(r.location==='outside'?L.isOutdoorAgent(a):Math.round(a.floor)===r.floor)){
       const range=r.weapon==='melee'?1.1:r.weapon==='laser'?14:12,d=distance(r,a),sight=this.sees(r,a);
       if(!sight){r.target=null;this.perception.patrol(r,dt);}else if(d>range){r.state='advance';this.move(r,a,dt);}else{r.speed=0;this.fire(r,a);r.angle=Math.atan2(a.x-r.x,a.z-r.z);}
      }else{r.target=null;const local=humans.some(a=>a.location==='floor'&&Math.round(a.floor)===r.floor);if(r.location==='floor'&&!local&&this.time>(r.nextFloorSearch||0)){r.nextFloorSearch=this.time+1.5;const nearby=humans.filter(a=>a.location==='floor'&&Math.abs(a.floor-r.floor)<=1).sort((a,b)=>Math.abs(a.floor-r.floor)-Math.abs(b.floor-r.floor))[0];if(nearby)r.floorGoal=nearby.floor;}if(!local&&r.floorGoal&&r.floorGoal!==r.floor)this.useStairs(r,{floor:r.floorGoal},dt);else this.perception.patrol(r,dt);}
      if(r.meleeTarget&&!r.meleeHit&&this.time-r.attackAt>.3){r.meleeHit=true;if(distance(r,r.meleeTarget)<1.65&&this.sees(r,r.meleeTarget))this.damage(r.meleeTarget,28,r);}
     }else if(r.behavior==='wander'){this.perception.patrol(r,dt);r.state='友好巡游';}
     else{r.speed=0;r.state='原地待命';}
    }
    if(r.hostile&&!this.combatEnabled){r.speed=0;r.state='ceasefire';}const outside=r.location==='outside',base=outside?s.exterior.ground(r.x,r.z)-.82:r.stairY??(r.floor-1)*3.6;r.worldBase=base;this.observation.record(r);if(this.isVisible(r))this.animate(r);
   }
   for(let i=this.shots.length-1;i>=0;i--){const shot=this.shots[i];if(run){const prior=shot.position.clone();shot.position.addScaledVector(shot.velocity,dt);shot.age+=dt;const target=shot.target,targetY=(Math.max(1,target.floor)-1)*3.6+.95,segment=shot.position.clone().sub(prior),u=L.clamp(V(target.x,targetY,target.z).sub(prior).dot(segment)/Math.max(.00001,segment.lengthSq()),0,1),near=prior.clone().addScaledVector(segment,u).distanceTo(V(target.x,targetY,target.z));if(near<.44&&target.health!=='dead'&&this.sees(shot.robot,target)){this.damage(target,12,shot.robot);this.shots.splice(i,1);continue;}if(shot.age>1.5||!shot.outside&&L.crossesClosedRoomDoor(s.model(shot.floor),{x:prior.x,z:prior.z},{x:shot.position.x,z:shot.position.z})){this.shots.splice(i,1);continue;}}
   }
   for(let i=this.beams.length-1;i>=0;i--){const beam=this.beams[i],age=this.time-beam.at;if(age>.6){this.beams.splice(i,1);continue;}if(run&&age>.2&&!beam.hit){beam.hit=true;if(this.sees(beam.robot,beam.target))this.damage(beam.target,23,beam.robot);}}
   if(present)this.draw();if(this.time>(this.nextUI||0)){this.nextUI=this.time+.5;this.refresh();}
  }
  geometryKey(g){if(this.geometryKeys.has(g))return this.geometryKeys.get(g);const a=g.attributes.position.array;let h=2166136261;for(let i=0;i<a.length;i+=Math.max(1,Math.floor(a.length/96)))h=Math.imul(h^Math.round(a[i]*1e5),16777619);const key=a.length+':'+g.index?.count+':'+h;this.geometryKeys.set(g,key);return key;}
  rebuild(){
   for(const b of this.batches){b.mesh.parent?.remove(b.mesh);b.mesh.material.dispose();b.mesh.dispose?.();}this.batches=[];this.nodeOwners=new WeakMap();const groups=new Map();
   for(const r of this.robots){if(r.root.userData.librarySkinned)continue;r.root.traverse(node=>{if(!node.isMesh||!node.geometry||Array.isArray(node.material))return;this.nodeOwners.set(node,r);const m=node.material,key=this.geometryKey(node.geometry)+':'+m.type+':'+m.color?.getHex()+':'+m.roughness+':'+m.metalness+':'+m.opacity+':'+(m.map?.uuid||'');if(!groups.has(key))groups.set(key,{geometry:node.geometry,material:m,nodes:[]});groups.get(key).nodes.push(node);});}
   for(const g of groups.values()){const mesh=new T.InstancedMesh(g.geometry,g.material.clone(),g.nodes.length);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.castShadow=false;mesh.receiveShadow=true;this.group.add(mesh);this.batches.push({mesh,nodes:g.nodes});}this.batchDirty=false;
  }
  draw(){
   for(const r of this.robots)if(r.root.userData.librarySkinned){if(r.root.parent!==this.group)this.group.add(r.root);r.root.visible=this.isVisible(r);}
   for(const r of this.robots)if(this.isVisible(r)){r.worldBase=r.location==='outside'?this.b.society.exterior.ground(r.x,r.z)-.82:r.stairY??(r.floor-1)*3.6;r.root.position.copy(this.displayPoint({x:r.x,y:r.worldBase,z:r.z,floor:r.floor,location:r.location}));L.robotContacts.pose(r);L.robotCargo?.pose(r);r.root.updateMatrixWorld(true);}
   this.robotCells=new Map();for(const r of this.robots){const key=Math.floor(r.x/1.5)+':'+Math.floor(r.z/1.5);if(!this.robotCells.has(key))this.robotCells.set(key,[]);this.robotCells.get(key).push(r);}
   if(this.batchDirty)this.rebuild();const interior=this.b.phase==='interior',origin=interior?(this.floor()-1)*3.6:0,offset=interior?0:.82;this.group.position.set(0,-origin+offset,0);if(interior&&this.v.floorOrigin)this.group.position.add(this.v.floorOrigin);this.group.updateMatrixWorld(true);const inverse=new T.Matrix4().copy(this.group.matrixWorld).invert(),matrix=new T.Matrix4();
   this.visibleRobots=this.robots.filter(r=>this.isVisible(r));
   L.robotContacts.drawShadows(this);
   for(const b of this.batches){let n=0;for(const node of b.nodes){if(node.userData.cargoHidden||node.userData.robotBrokenPart||!this.isVisible(this.nodeOwners.get(node)))continue;matrix.multiplyMatrices(inverse,node.matrixWorld);b.mesh.setMatrixAt(n++,matrix);}b.mesh.count=n;if(n){b.mesh.instanceMatrix.updateRange.offset=0;b.mesh.instanceMatrix.updateRange.count=n*16;b.mesh.instanceMatrix.needsUpdate=true;}}
   let bullets=0;for(const shot of this.shots){if(!this.isVisible({floor:shot.floor,location:shot.outside?'outside':'floor'}))continue;this.pose.position.copy(this.displayPoint({...shot.position,floor:shot.floor,location:shot.outside?'outside':'floor'}));this.pose.scale.set(.035,.035,.28);this.pose.quaternion.setFromUnitVectors(V(0,0,1),shot.velocity.clone().normalize());this.pose.updateMatrix();this.bulletMesh.setMatrixAt(bullets++,this.pose.matrix);}this.bulletMesh.count=bullets;if(bullets)this.bulletMesh.instanceMatrix.needsUpdate=true;
   const array=this.beamMesh.geometry.attributes.position.array;let n=0;for(const beam of this.beams){if(this.time-beam.at<.2||!this.isVisible(beam.robot))continue;for(const point of [beam.from,beam.to])this.displayPoint({...point,floor:beam.robot.floor,location:beam.robot.location}).toArray(array,n++*3);}this.beamMesh.geometry.setDrawRange(0,n);if(n)this.beamMesh.geometry.attributes.position.needsUpdate=true;this.observation.update();
  }
  isVisible(r){
   if(!r||r.alive===false&&!(r.deathUntil>this.time)||this.environment==='station')return false;if(this.environment==='campus')return r.location==='outside';if(this.b.phase==='interior'&&r.location==='outside')return !!(this.b.continuous.active&&this.b.continuous.worldWalk?.outside);
   if(r.location!=='outside'&&L.disasterDirector?.physics?.destroyedFloors.has(Math.round(r.floor)))return false;
   if(this.b.phase!=='interior')return true;
   const floor=this.floor();if(r.stair){const y=r.stairY??r.worldBase;return y>=(floor-1)*3.6-.05&&y<floor*3.6;}
   return Math.round(r.floor)===floor;
  }
  displayPoint(p){const v=V(p.x,p.y,p.z);if(this.b.phase!=='interior'&&p.location!=='outside'){const plate=this.b.plates[Math.round(p.floor)-1];if(plate){v.x+=plate.group.position.x;v.y+=plate.group.position.y-(p.floor-1)*3.6;v.z+=plate.group.position.z;}}return v;}

   refresh(){const summary=$('army-summary');if(summary)summary.textContent='进攻机器人 '+this.robots.length+' 台 · 命中 '+this.stats.hits+' · 击倒 '+this.stats.kills;const pause=$('army-pause');if(pause)pause.textContent=this.combatEnabled?'停止进攻':'恢复进攻';}

  clear({hostileOnly=true}={}){this.spawnVersion=(this.spawnVersion||0)+1;const removed=this.robots.filter(r=>!hostileOnly||r.hostile);this.robots=this.robots.filter(r=>!removed.includes(r));L.robotContacts.invalidate();for(const b of this.batches){b.mesh.parent?.remove(b.mesh);b.mesh.material.dispose();b.mesh.dispose?.();}this.batches=[];for(const r of removed){r.alive=false;L.robotConflict?.forget?.(r);L.robotCargo?.forget?.(r);r.root.parent?.remove(r.root);C.disposeModel(r.root);}this.shots=[];this.beams=[];this.batchDirty=true;this.stats={bullet:0,laser:0,melee:0,hits:0,kills:0};this.draw();this.refresh();}
  summary(){return{total:this.robots.length,hostile:this.robots.filter(r=>r.hostile).length,types:this.robots.map(r=>r.spec.type),joints:this.robots.map(r=>r.root.userData.jointDescriptors?.length),stats:{...this.stats},drawBatches:this.batches.length};}
 }
  L.RobotArmy=RobotArmy;
})();
