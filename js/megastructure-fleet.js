/* Exterior-only articulated giants. Damage is gated by swept body-part contact. */
(() => {
 'use strict';const L=window.IndoorLab,T=THREE,P=window.MegastructureProtocol,M=L.MegastructureMotion,clamp=L.clamp;
 const up=new T.Vector3(0,1,0),faces=[{x:1,z:0},{x:0,z:1},{x:-1,z:0},{x:0,z:-1}];let modelPromise;
 function prepareModels(){if(L.MegastructureModels)return Promise.resolve();if(!modelPromise)modelPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('js/megastructure-models.js',document.baseURI).href;script.onload=resolve;script.onerror=()=>{modelPromise=null;script.remove();reject(Error('巨构模型载入失败，请重试。'));};document.head.append(script);});return modelPromise;}
 const normalOf=p=>Math.abs(p.x/18)>Math.abs(p.z/13)?new T.Vector3(Math.sign(p.x),0,0):new T.Vector3(0,0,Math.sign(p.z));
 const forwardRotation=n=>new T.Quaternion().setFromAxisAngle(up,Math.atan2(-n.x,-n.z));
 const counters=()=>({launched:0,contacts:0,impacts:0,glass:0,panels:0,misses:0});
 class MegastructureFleet {
  constructor(b){this.b=b;this.v=b.view;this.robots=[];this.projectiles=[];this.contactLog=[];this.serial=0;this.time=0;this.generation=0;this.stats=counters();this.group=new T.Group();this.group.name='楼外巨构机器人';this.group.userData.noAO=true;this.group.userData.ignoreCollision=true;this.v.scene.add(this.group);

  }
  async execute(raw){L.disasterDirector.assertContext();const requestValid=typeof raw.requestValid==='function'?raw.requestValid:()=>true;if(!requestValid())return '巨构控制已取消。';const a=P.validate(raw),chosen=()=>this.robots.filter(r=>['all','random'].includes(a.robotType)||r.type===a.robotType);
   if(a.operation==='clear'){const n=chosen().length;this.clear(a.robotType);return '已移除 '+n+' 台巨构机器人；输入“复原”可恢复建筑。';}
   if(a.operation==='spawn')return this.spawn({...a,paused:raw.paused===true},requestValid);const robots=chosen();if(!robots.length)throw Error('场景中没有对应的巨构机器人，请先输入如“生成5个巨头飞龙机器人”。');
   if(a.operation==='attack'){const generation=this.generation,d=L.disasterDirector,context=d.context(),token=d.generation;d.physics??=new L.DisasterPhysics(d);await d.physics.prepare();if(generation!==this.generation||!d.requestValid(token,context)||!requestValid())return '巨构控制已取消。';for(const r of robots){r.attacking=true;r.returning=null;r.flight=null;r.paused=false;r.power=a.intensity;r.nextAttack=r.elapsed+.4+(r.id%7)*.3;if(r.motion==='crawl')this.startClimb(r);this.b.reactions.buildingAttack?.(r);}return robots.length+' 台巨构机器人正在接近幕墙；嘴部、手部或腕足实际击中后才会触发局部破碎。';}
   if(a.operation==='climb'){const crawlers=robots.filter(r=>r.motion==='crawl');if(!crawlers.length)throw Error('只有章鱼、猎蛛和巨蛇可以攀附外墙；飞龙飞行，泰坦仅在地面行走。');for(const r of crawlers){r.paused=false;r.climbAt=r.elapsed;this.startClimb(r);}return crawlers.length+' 台巨构机器人正在攀附建筑外表皮。';}
   for(const r of robots){if(a.operation==='pause')r.paused=true;else if(a.operation==='resume')r.paused=false;else{const wasAttacking=r.attacking;r.attacking=false;r.paused=false;if((r.attack||wasAttacking)&&r.motion!=='crawl')r.returning={from:r.position.clone(),rotation:r.quaternion.clone(),at:r.elapsed};r.attack=null;if(r.motion==='flight')r.flight=null;}}
   return a.operation==='pause'?'已暂停这些巨构机器人的移动和攻击。':a.operation==='resume'?'已恢复这些巨构机器人的活动。':'已停止攻击，巨构机器人继续在建筑外巡游。';
  }
  async spawn(a,requestValid=()=>true){if(this.robots.length+a.count>12)throw Error('场景最多同时保留 12 台巨构机器人，请先清除部分巨构。');const generation=this.generation,d=L.disasterDirector,context=d.context(),token=d.generation;await prepareModels();if(generation!==this.generation||!d.requestValid(token,context)||!requestValid())return '场景已切换，生成已取消。';
   if(this.robots.length+a.count>12)throw Error('场景最多同时保留 12 台巨构机器人，请先清除部分巨构。');
   const added=[];try{for(let i=0;i<a.count;i++){
    const type=a.robotType==='random'?P.catalog[(this.serial+i)%P.catalog.length].type:a.robotType,rig=L.MegastructureModels.create(type),id=++this.serial,definition=P.catalog.find(c=>c.type===type),bounds=rig.nativeBounds,focus=rig.native.focus;
    const reachX=Math.max(Math.abs(bounds.min.x-focus.x),Math.abs(bounds.max.x-focus.x))*rig.scale,reachZ=Math.max(Math.abs(bounds.min.z-focus.z),Math.abs(bounds.max.z-focus.z))*rig.scale,reach=Math.hypot(reachX,reachZ);
    const r={id,type,rig,root:rig.root,motion:definition.motion,name:definition.name,position:new T.Vector3(),quaternion:new T.Quaternion(),angle:(i/a.count)*Math.PI*2+(id-i)*.37,radius:Math.max(39,25+reach+4)+(id%3)*5,altitude:16+(id*19)%72,reach,height:rig.height,elapsed:0,paused:a.paused===true,attacking:false,power:a.intensity,nextAttack:Infinity,climbAt:5+(i%4)*1.2,mode:definition.motion==='flight'?'flight':'ground',distance:0};
    this.robots.push(r);added.push(r);this.group.add(r.root);this.placePatrol(r,0);this.place(r);if(type==='octopus')this.crawl(r,0);r.root.traverse(o=>{if(o.isMesh)o.frustumCulled=false;});rig.setTheme(this.accent());
   }}catch(error){for(const r of added)this.remove(r);throw error;}
   this.syncFrame();this.b.app.play(true);this.b.society.running=true;if(a.attack)await this.execute({...a,operation:'attack',robotType:a.robotType==='random'?'all':a.robotType,requestValid});
   return '已生成 '+added.length+' 台'+(a.robotType==='random'?'混合巨构机器人':added[0].name+'巨构机器人')+'。'+(a.attack?'已开始楼外攻击。':a.paused?'正在原地待命，可用“继续巨构机器人”恢复活动。':'飞龙在城市上空自由飞行，泰坦地面步行，章鱼／猎蛛／巨蛇爬行并攀附外墙；输入“攻击这栋楼”开始攻击。');
  }
  accent(){const p=this.v.pipeline.style;return (typeof p==='object'?p:L.RENDER_STYLES[p])?.accent||L.RENDER_STYLES.access.accent;}
  ground(x,z){return this.b.society.exterior.ground(x,z)-.82;}
  pull(r){if(r.gait&&r.gait.surface===r.mode&&r.gait.planted<4)return 0;return .18+.82*Math.pow(Math.max(0,Math.sin(r.elapsed*2.5)),2);}
  placePatrol(r,dt){if(r.motion==='flight'){L.MegastructureFlight.step(this,r,dt);return;}let speed=r.motion==='flight'?8:r.type==='serpent'?8:r.type==='titan'?3.2:2.4;if(dt>0&&r.motion!=='flight'&&r.type!=='octopus')speed=Math.min(speed,r.rig.travel/dt);if(r.type==='octopus')speed*=this.pull(r);r.angle+=dt*speed/r.radius;r.distance+=dt*speed;
   r.position.set(Math.cos(r.angle)*r.radius,0,Math.sin(r.angle)*r.radius);r.quaternion.setFromAxisAngle(up,-r.angle);
   r.position.y=this.ground(r.position.x,r.position.z);
   if(r.returning){const f=M.smooth((r.elapsed-r.returning.at)/3),target=r.quaternion.clone();r.position.lerpVectors(r.returning.from,r.position.clone(),f);r.quaternion.copy(r.returning.rotation).slerp(target,f);if(f===1)r.returning=null;}
   r.state=r.motion==='walk'?'地面步行':'触手附着 · 交替爬行';
  }
  startClimb(r){if(r.motion!=='crawl'||r.mode!=='ground')return;const n=normalOf(r.position);r.wall={normal:n,side:faces.findIndex(f=>f.x===n.x&&f.z===n.z),start:r.elapsed,from:r.position.clone(),rotation:r.quaternion.clone(),height:r.type==='octopus'?14:8,direction:1};r.mode='approach';r.gait=null;}
  placeClimber(r,dt){const w=r.wall,n=w.normal,age=r.elapsed-w.start,blend=clamp(age/5,0,1),smooth=M.smooth(blend),tangent=new T.Vector3(-n.z,0,n.x),along=Math.sin(w.start*.16+r.id)*(r.type==='serpent'?1:3);
   const wallPoint=new T.Vector3(n.x*(18+.08),w.height,n.z*(13+.08)).addScaledVector(tangent,along),z=r.type==='serpent'?new T.Vector3().crossVectors(up,n):up.clone(),x=new T.Vector3().crossVectors(n,z).normalize(),rotation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,n,z));
   if(r.type==='serpent'){const parts=r.rig.native.parts,dir=parts.head.position.clone().sub(parts.segments.at(-1).o.position);rotation.multiply(new T.Quaternion().setFromAxisAngle(up,-Math.atan2(dir.x,dir.z)));}
   if(blend<1){r.position.lerpVectors(w.from,wallPoint,smooth);r.quaternion.copy(w.rotation).slerp(rotation,smooth);r.state='接近外墙 · 腕足附着';}
   else{if(r.mode!=='climb'){r.mode='climb';r.gait=null;}if(!r.attack){w.height+=dt*(r.type==='octopus'?2.4*this.pull(r):1.6)*w.direction;if(w.height>88)w.direction=-1;if(w.height<14)w.direction=1;}wallPoint.y=w.height;r.position.copy(wallPoint);r.quaternion.copy(rotation);r.state='吸附支撑 · 抬腕换点 · 推进躯干';}
  }
  place(r){r.root.position.copy(r.position);r.root.quaternion.copy(r.quaternion);r.root.updateMatrixWorld(true);
   // Octopus anchors are solved against the surface itself, so they must not
   // be displaced by a whole-model bounding box correction after planting.
   if(r.wall&&r.type!=='octopus'&&r.mode!=='ground'){
    const n=r.wall.normal,b=r.rig.bounds(),g=this.group.position,plane=n.x?18:13,min=n.x>0?b.min.x-g.x:n.x<0?g.x-b.max.x:n.z>0?b.min.z-g.z:g.z-b.max.z,shift=Math.max(0,plane+.12-min);r.position.addScaledVector(n,shift);r.root.position.copy(r.position);
    if(r.mode==='climb'){const low=b.min.y-this.group.position.y,high=b.max.y-this.group.position.y;let dy=low<.5?.5-low:0;if(high+dy>108)dy+=108-(high+dy);r.position.y+=dy;r.root.position.y=r.position.y;}r.root.updateMatrixWorld(true);
   }
  }
  anchorTarget(r,i){const a=r.rig.native.parts.arms[i],local=new T.Vector3(Math.sin(a.a)*3.9*r.rig.scale,.10*r.rig.scale,Math.cos(a.a)*3.9*r.rig.scale),point=local.applyQuaternion(r.quaternion).add(r.position);
   if(r.mode==='climb'){const n=r.wall.normal;point.addScaledVector(n,(n.x?18:13)+.12-point.dot(n));point.y=clamp(point.y,1,106);if(n.x)point.z=clamp(point.z,-11.5,11.5);else point.x=clamp(point.x,-16.5,16.5);}else if(r.mode==='ground')point.y=this.ground(point.x,point.z)+.12;
   return point;
  }
  crawl(r,dt,attackTarget){const arms=r.rig.native.parts.arms;
   if(!r.gait){r.gait={surface:r.mode,anchors:arms.map((a,i)=>({point:this.anchorTarget(r,i),from:null,to:null,phase:0,planted:true,last:r.elapsed-(i*.41)%2.8})),planted:8,steps:0};}
   const g=r.gait;for(let i=0;i<arms.length;i++){const a=g.anchors[i],ideal=this.anchorTarget(r,i);if(r.mode==='approach'){a.point.lerp(ideal,Math.min(1,dt*5));a.planted=false;continue;}
    if(attackTarget&&i===r.attack.index){a.point.copy(attackTarget);a.planted=false;continue;}
    const swinging=g.anchors.filter(a=>!a.planted&&a.from).length;
    if(a.planted&&r.elapsed-a.last>1.6&&(a.point.distanceTo(ideal)>1.1||r.elapsed-a.last>4)&&swinging<2){a.from=a.point.clone();a.to=ideal.clone();a.phase=0;a.planted=false;}
    if(!a.planted){if(!a.from){a.from=a.point.clone();a.to=ideal.clone();a.phase=0;}a.phase+=dt/.65;a.point.lerpVectors(a.from,a.to,M.smooth(a.phase));const normal=r.mode==='climb'?r.wall.normal:up;a.point.addScaledVector(normal,Math.sin(Math.PI*clamp(a.phase,0,1))*1.7);if(a.phase>=1){a.point.copy(a.to);a.from=null;a.to=null;a.planted=true;a.last=r.elapsed;g.steps++;}}
   }
   g.planted=g.anchors.filter(a=>a.planted).length;const targets=g.anchors.map(a=>r.rig.sourcePoint(a.point.clone().add(this.group.position)));r.rig.edit(native=>{native.scene.updateMatrixWorld(true);for(let i=0;i<arms.length;i++)M.solveArm(arms[i],targets[i]);});
  }
  pickTarget(r){const n=r.wall?.normal||normalOf(r.position),random=()=>L.disasterDirector.random(),current=M.point(r,M.effector(r,r.attackSerial||0)),preferred=current.clone();
   if(r.type==='dragon'){preferred.y=clamp(r.position.y+r.height*.55+(random()-.5)*8,24,102);if(n.x)preferred.z=clamp(r.position.z,-8,8)+(random()-.5)*5;else preferred.x=clamp(r.position.x,-12,12)+(random()-.5)*5;}
   else if(r.type==='titan'){preferred.y=17+random()*5;if(n.x)preferred.z=clamp(r.position.z,-6,6);else preferred.x=clamp(r.position.x,-11,11);}
   else if(r.type==='octopus'||r.type==='spider'){preferred.copy(r.position);preferred.y=clamp(r.position.y+5+random()*6,3,102);if(n.x)preferred.z+=(random()-.5)*6;else preferred.x+=(random()-.5)*6;}
   preferred.addScaledVector(n,(n.x?18:13)-preferred.dot(n));const point=L.disasterDirector.physics.facadeTarget(n,preferred);return point?{point,normal:n.clone()}:null;
  }
  beginAttack(r){if(r.motion==='crawl'&&r.mode!=='climb')return;const target=this.pickTarget(r);if(!target){r.nextAttack=r.elapsed+2;return;}const index=r.type==='octopus'?((r.attackSerial||0)%2?7:0):(r.attackSerial||0)%2;r.attackSerial=(r.attackSerial||0)+1;
   const a=r.attack={...target,index,at:r.elapsed,from:r.position.clone(),rotation:r.quaternion.clone(),age:0,previous:null,hit:false,attempted:false};a.effector=M.effector(r,index);a.duration=r.motion==='flight'?Math.max(1.5,r.position.distanceTo(target.point)/13):r.type==='titan'?Math.max(1.5,r.position.distanceTo(target.point)/4):.2;
   a.ready=target.point.clone().addScaledVector(target.normal,r.type==='titan'?7.2:7);if(r.type==='titan')a.ready.y=this.ground(a.ready.x,a.ready.z);this.stats.launched++;
  }
  mouthPosition(r,a,clearance){const e=a.effector,point=M.point(r,e),offset=point.clone().sub(r.position);r.position.copy(a.point).addScaledVector(a.normal,clearance).sub(offset);if(r.type==='dragon')r.position.y=Math.max(8,r.position.y);r.root.position.copy(r.position);r.root.updateMatrixWorld(true);}
  animateAttack(r,dt){const a=r.attack;a.age=r.elapsed-a.at;const t=a.age-a.duration;
   if(r.type==='dragon'||r.type==='titan'){
    const q=forwardRotation(a.normal),f=M.smooth(a.age/a.duration);r.quaternion.copy(a.rotation).slerp(q,f);this.place(r);
    if(r.type==='dragon'){M.mouthPose(r,0);const offset=M.point(r,a.effector).sub(r.position).applyQuaternion(r.quaternion.clone().invert()).applyQuaternion(q);a.ready.copy(a.point).addScaledVector(a.normal,4+a.effector.radius).sub(offset);a.ready.y=Math.max(8,a.ready.y);}
    if(t<0){r.position.lerpVectors(a.from,a.ready,f);r.state='接近幕墙 · 对准打击部位';}
    else r.quaternion.copy(q);this.place(r);
   }
   const wind=1.05,strike=.55,hold=.16,recovery=1.15,end=wind+strike+hold+recovery;
   let extension=0,clearance=4+a.effector.radius;
   if(t<0){r.state='接近幕墙 · 对准打击部位';}
   else if(t<wind){extension=t/wind*.25;clearance+=Math.sin(t/wind*Math.PI)*1.8;r.state='蓄力 · 抬起'+a.effector.label;}
   else if(t<wind+strike){extension=.25+.75*M.smooth((t-wind)/strike);clearance=4+a.effector.radius-(4.08)*M.smooth((t-wind)/strike);r.state=a.effector.label+'挥击幕墙';}
   else if(t<wind+strike+hold){extension=1;clearance=a.effector.radius-.08;r.state=a.effector.label+'接触幕墙';}
   else{const f=M.smooth((t-wind-strike-hold)/recovery);extension=1-f;clearance=a.effector.radius-.08+4.08*f;r.state='收回'+a.effector.label+' · 恢复支撑';}
   if(r.type==='dragon'||r.type==='serpent'){
    M.mouthPose(r,extension);this.place(r);
    if(t>=0){this.mouthPosition(r,a,clearance);}
   }else if(r.type==='octopus'){
    const target=a.point.clone().addScaledVector(a.normal,clearance);if(t<0)target.copy(r.gait?.anchors[a.index].point||target);this.crawl(r,dt,target);
   }else if(t>=0){const target=a.point.clone().addScaledVector(a.normal,clearance).add(this.group.position);M.limbPose(r,a.index,target);}
   const current=M.point(r,a.effector);
   if(t>=wind&&t<=wind+strike+hold&&!a.attempted&&a.previous){const before=a.previous.clone().sub(a.point).dot(a.normal),distance=current.clone().sub(a.point).dot(a.normal),inward=(before-distance)/Math.max(dt,1e-5),projected=current.clone().addScaledVector(a.normal,-distance);if(!a.nearest||distance<a.nearest.distance)a.nearest={distance,offset:projected.distanceTo(a.point),speed:inward};
    if(distance<=a.effector.radius+.025&&distance>=-a.effector.radius-.25&&inward>.04&&projected.distanceTo(a.point)<a.effector.radius+1){a.attempted=true;this.contact(r,a,current,projected,distance,inward);}
   }a.previous=current;
   if(t>=end){if(!a.attempted){this.stats.misses++;r.lastMiss={part:a.effector.label,...a.nearest};}r.attack=null;r.nextAttack=r.elapsed+1.2+L.disasterDirector.random()*1.3;if(r.gait){const arm=r.gait.anchors[a.index];arm.from=null;arm.planted=false;}}
  }
  contact(r,a,effector,point,distance,speed){const d=L.disasterDirector,result=d.physics?.facadeImpact(point,a.normal,r.power,a.effector.radius);this.stats.contacts++;a.hit=!!(result&&(result.glass||result.panels));const record={robot:r.id,type:r.type,part:a.effector.label,effector:effector.toArray(),point:point.toArray(),normal:a.normal.toArray(),distance,radius:a.effector.radius,speed,damage:a.hit};this.contactLog.push(record);if(this.contactLog.length>60)this.contactLog.shift();
   if(a.hit){this.stats.impacts++;this.stats.glass+=result.glass;this.stats.panels+=result.panels;d.pulse(point,.35);this.b.reactions.frighten({x:point.x,y:point.y,z:point.z},{radius:22,reason:'巨构机器人撞击幕墙，玻璃破裂'});}
  }
  advance(step){this.time+=step;
   for(const r of this.robots){if(!r.paused){r.elapsed+=step;r.rig.step(step);
     if(!r.attack){if((r.mode==='ground'||r.mode==='flight')&&!r.attacking)this.placePatrol(r,step);if(r.motion==='crawl'&&r.mode==='ground'&&r.elapsed>=r.climbAt)this.startClimb(r);if(r.wall)this.placeClimber(r,step);this.place(r);if(r.attacking&&r.type==='dragon')M.mouthPose(r,0);if(r.attacking&&r.type==='serpent')M.mouthPose(r,0);if(r.type==='octopus')this.crawl(r,step);if(r.attacking&&r.elapsed>=r.nextAttack)this.beginAttack(r);}
     else{if(r.wall){this.placeClimber(r,0);this.place(r);}this.animateAttack(r,step);}
    }
   }
  }
  update(dt,options={}){this.active=options.active!==false&&(options.environment||L.collaboration?.environment)!=='station'&&!options.isTransitioning;this.syncFrame();if(!this.active||!this.robots.length)return;const run=(options.running??this.b.society.running)&&!this.b.matrixLab?.active&&!document.hidden;
   // Consume the complete shared simulation clock while retaining the narrow
   // contact window at accelerated speeds. Never advance hidden scene actors.
   if(run&&Number.isFinite(dt)&&dt>0)for(let remaining=dt;remaining>1e-9;){const step=Math.min(.05,remaining);this.advance(step);remaining-=step;}
   const accent=this.accent();for(const r of this.robots)r.rig.setTheme(accent);
  }
  syncFrame(){const b=this.b;L.syncDisasterFrame(this.group,b);this.group.visible=this.active!==false&&this.robots.length>0&&L.collaboration?.environment!=='station'&&!L.collaboration?.switching&&!b.matrixLab?.active;this.group.updateMatrixWorld(true);}
  remove(r){this.group.remove(r.root);L.dispose(r.root);this.robots=this.robots.filter(q=>q!==r);}
  clear(type='all'){this.generation++;for(const r of [...this.robots])if(['all','random'].includes(type)||r.type===type)this.remove(r);if(!this.robots.length){this.time=0;this.stats=counters();this.contactLog=[];}this.syncFrame();}
  summary(){return {total:this.robots.length,attacking:this.robots.filter(r=>r.attacking).length,robots:this.robots.map(r=>({id:r.id,type:r.type,state:r.state,motion:r.motion,mode:r.mode,height:r.height,position:r.position.toArray(),joints:r.rig.joints.length,planted:r.gait?.planted})),...this.stats};}
 }
 L.MegastructureFleet=MegastructureFleet;
})();
