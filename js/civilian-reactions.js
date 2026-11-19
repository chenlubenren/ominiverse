/* Witnesses react to assaults and nearby impacts, including during office hours. */
(() => {
 'use strict';const L=window.IndoorLab;
 class CivilianReactions {
  constructor(building){this.building=building;this.s=building.society;this.z=this.s.zombie;this.events=[];this.robotThreats=new Map();this.nextRobotSense=0;const tick=this.s.tick.bind(this.s);this.s.tick=dt=>{if(this.building.combat?.hitStop>0)return;this.senseRobotDanger();tick(dt);this.tick(dt);this.s.recordLocomotion(dt);};}
  buildingAttack(robot){const s=this.s;this.robotThreats.set(robot,{robot,giant:true,until:s.time+8});if(this.robotBuildingAlarm)return;this.robotBuildingAlarm=true;
   for(const a of s.agents){if(a.isPlayer||a.health!=='healthy'||!['floor','stairs','lift'].includes(a.location))continue;this.z.release(a);a.alerted=true;a.robotDanger={kind:'building',at:s.time};a.fear={source:{x:0,z:0},start:s.time,until:Infinity,scattered:true};a.fearFlinchUntil=s.time+.18+(a.id%6)*.04;a.zombieAnim='flinch';a.escapeRetryAt=a.panicSearchAt=0;a.action='听到巨构袭击警报，撤离大楼';a.reaction={code:'fear',posture:'brace',text:a.action};s.note(a,'巨构袭击警报','停止办公，经楼梯撤离到楼外街区');}
   this.nextRobotSense=0;
  }
  robotAssault(robot,victim){if(victim?.robotCombat)return;const s=this.s;this.robotThreats.set(robot,{robot,victim,until:s.time+5});this.nextRobotSense=0;
   const outdoors=robot.location==='outside',point={x:victim?.x??robot.x,y:outdoors?s.exterior.ground(robot.x,robot.z)-.82:(robot.floor-1)*3.6,z:victim?.z??robot.z,outdoors};this.frighten(point,{victim,radius:22,reason:'目击机器人袭击人类'});this.senseRobotDanger();
  }
  avoidRobot(a,point,reason){const s=this.s;if(!a.robotDanger||!a.avoidBuilding){s.exterior.frighten(a,point);a.avoidBuilding=true;a.robotDanger={kind:'witness',at:s.time};a.plan=null;a.pendingPlan=null;a.onArrival=null;a.action=reason;s.note(a,'中止进楼',reason);}
   const f=a.outdoorFlight;if(f){if(f.returning){f.path=[];f.at=0;f.retryAt=s.time;f.returning=false;}f.origin=null;f.threat={x:point.x,z:point.z};f.dangerUntil=Math.max(f.dangerUntil||0,s.time+10);}
  }
  senseRobotDanger(){const s=this.s;if(s.time<this.nextRobotSense)return;this.nextRobotSense=s.time+.3;const giants=L.megastructureFleet?.robots.filter(r=>r.attacking&&!r.paused)||[];for(const r of giants)this.robotThreats.set(r,{robot:r,giant:true,until:s.time+8});for(const [r,t]of this.robotThreats)if(t.until<s.time||r.alive===false||t.giant&&!L.megastructureFleet?.robots.includes(r))this.robotThreats.delete(r);
   if(!this.robotThreats.size)return;const exterior=s.exterior,g=exterior.navigation();for(const a of s.agents){if(a.isPlayer||!L.isOutdoorAgent(a)||!['healthy','escaped'].includes(a.health))continue;
    for(const t of this.robotThreats.values()){const r=t.robot;if(t.giant){if(Math.hypot(a.x,a.z)>85)continue;const point=Math.abs(a.x/18)>Math.abs(a.z/13)?{x:Math.sign(a.x)*18.8,z:L.clamp(a.z,-12,12)}:{x:L.clamp(a.x,-17,17),z:Math.sign(a.z)*13.8};if(!g.lineClear(a,point,.04))continue;this.avoidRobot(a,point,'发现巨构正在攻击大楼，转身逃向街区');break;}
     if(Math.hypot(a.x-r.x,a.z-r.z)>24)continue;const source={...r,absoluteY:r.location==='outside'?exterior.ground(r.x,r.z)-.82:(r.floor-1)*3.6};if(!this.canSee(a,source)&&(!t.victim||!this.canSee(a,t.victim)))continue;this.avoidRobot(a,{x:r.x,z:r.z},'目击机器人袭击人类，中止进楼并逃离');break;
    }
   }
  }
  resetRobotDanger(){this.robotThreats.clear();this.robotBuildingAlarm=false;this.nextRobotSense=0;for(const a of this.s.agents)a.robotDanger=null;}
  canSee(a,b){if(L.isOutdoorAgent(a)||L.isOutdoorAgent(b))return Math.abs(this.z.y(a)-this.z.y(b))<2&&this.s.exterior.canSee(a,b);const ay=this.z.y(a),by=this.z.y(b),well=Math.abs(a.x)>11&&Math.abs(b.x)>11&&Math.sign(a.x)===Math.sign(b.x)&&Math.abs(a.z)<3.8&&Math.abs(b.z)<3.8;if(Math.round(a.floor)!==Math.round(b.floor)&&!well)return false;if(Math.abs(ay-by)>2)return false;const loFloor=Math.max(1,Math.floor(Math.min(ay,by)/3.6)+1),hiFloor=Math.min(30,Math.floor(Math.max(ay,by)/3.6)+1);for(let f=loFloor;f<=hiFloor;f++){const model=this.building.journey?.continuous?.models[f-1]||this.s.models[f-1];for(const wall of L.towerSightWalls(model)){const co=Math.cos(wall.rotation||0),si=Math.sin(wall.rotation||0),local=p=>({x:(p.x-wall.x)*co-(p.z-wall.z)*si,z:(p.x-wall.x)*si+(p.z-wall.z)*co,y:p.y-wall.y-(f-1)*3.6}),p=local({x:a.x,y:ay+1.35,z:a.z}),q=local({x:b.x,y:by+1.35,z:b.z});let lo=0,hi=1;for(const [axis,size]of [['x','w'],['y','h'],['z','d']]){const d=q[axis]-p[axis],half=wall[size]/2;if(Math.abs(d)<1e-8){if(Math.abs(p[axis])>half){lo=2;break;}}else{const u=(-half-p[axis])/d,v=(half-p[axis])/d;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));}}if(lo<=hi&&hi>.03&&lo<.97)return false;}}return true;}
  receiveHit(a,direction,damage){const s=this.s;a.impactReaction={at:s.time,until:s.time+.48,x:direction.x,z:direction.z,sequence:(a.impactReaction?.sequence||0)+1,strength:Math.min(1,damage/30)};a.stunUntil=s.time+.24;if(a.health==='healthy'&&a.location==='floor')a.knockVelocity={x:direction.x*.7,z:direction.z*.7};if(!s.running)this.building.app.play(true);const outdoors=L.isOutdoorAgent(a);this.frighten({x:a.x,y:this.z.y(a),z:a.z,outdoors},{victim:a,radius:outdoors?5.5:8,reason:'玩家攻击了身边的人'});}
  frighten(point,{victim=null,radius=8,reason='附近发生撞击'}={}){const s=this.s,z=this.z;
   for(const a of s.agents){const outdoors=L.isOutdoorAgent(a);if(a.isPlayer||a.downUntil>s.time||['zombie','turning','grabbed','dead'].includes(a.health)||a.health==='escaped'&&!outdoors||!outdoors&&!['floor','stairs','lift'].includes(a.location)||Math.abs(z.y(a)-(point.y||0))>1.5||Math.hypot(a.x-point.x,a.z-point.z)>radius)continue;if(a!==victim&&a.fear&&s.time-a.fear.start<6)continue;const sight=this.canSee({...point,absoluteY:point.y,feetY:point.y,floor:point.outdoors?0:a.floor,location:point.outdoors?'outside':'floor'},a);if(a!==victim&&!sight&&(outdoors||Math.hypot(a.x-point.x,a.z-point.z)>3))continue;
    if(outdoors){s.exterior.frighten(a,point);a.fearFlinchUntil=s.time+(a===victim?.24:.3);a.zombieAnim=a===victim?'hit':'flinch';this.events.push({id:a.id,time:s.time,victim:a===victim});continue;}
    a.health??='healthy';if(!a.fear)z.release(a);a.fear={source:{x:point.x,z:point.z},start:s.time,until:s.time+25,victim:a===victim};a.alerted=true;a.zombieControlled=true;a.zombieAnim=a===victim?'hit':'flinch';a.fearFlinchUntil=s.time+(a===victim?.24:.28+(a.id%4)*.025);a.action=a===victim?'受到攻击，惊吓逃离':'听到撞击，惊吓逃离';a.zPath=[];a.escapeRetryAt=a.panicSearchAt=0;a.reaction={code:'fear',posture:'brace',text:a.action};s.note(a,'受惊逃离',reason);this.events.push({id:a.id,time:s.time,victim:a===victim});
    if(a.location==='floor'){
      const g=s.grid(a.floor),angle=Math.atan2(a.x-point.x,a.z-point.z)+(a.id%5-2)*.28;
      const goal={x:a.x+Math.sin(angle)*(3+a.id%3),z:a.z+Math.cos(angle)*(3+a.id%3)};
      const i=g.nearest(goal,.24,g.nav(.24).largest);
      if(i>=0)a.fear.scatter=g.point(i);
    }
   }if(this.events.length>200)this.events.splice(0,this.events.length-200);
  }
  tick(dt){const s=this.s,z=this.z;if(s.emergency?.type==='earthquake'&&s.emergency.hazard.shaking)return;if(!z.active)z.refreshCrowd();for(const a of s.agents){if(!a.fear||a.health!=='healthy'||L.isOutdoorAgent(a))continue;if(a.downUntil>s.time){a.zombieAnim='down';a.vx=a.vz=0;continue;}if(!z.active&&a.knockVelocity){const k=a.knockVelocity,g=s.grid(Math.max(1,Math.round(a.floor))),x=a.x+k.x*dt,zp=a.z+k.z*dt;if(a.location==='floor'&&g.isClear(x,zp,.24)&&!s.bodies.blocks(a,x,zp)){a.x=x;a.z=zp;}k.x*=Math.exp(-dt*9);k.z*=Math.exp(-dt*9);if(Math.hypot(k.x,k.z)<.05)a.knockVelocity=null;}if(a.fearFlinchUntil>s.time){a.zombieAnim=a.fear.victim?'hit':'flinch';a.vx=a.vz=0;continue;}if(!z.active&&a.rise){z.moveRise(a,dt);continue;}a.zombieAnim='flee';a.reaction={code:'fear',text:a.name+' · 受惊逃离'};if(z.active)continue;
    if(a.location==='stairs'){z.stairs(a,dt);continue;}if(L.isOutdoorAgent(a)){if(!a.outdoorFlight)s.exterior.begin(a,'受惊后向街区分散');continue;}if(a.location==='lift')continue;
    if(!a.zPath?.length&&a.location==='floor'){const g=s.grid(a.floor);if(!g.isClear(a.x,a.z,.24)){const i=g.nearest(a,.24,g.hasClosedDoors?undefined:g.nav(.24).largest),to=i>=0?g.point(i):null;if(to&&Math.hypot(a.x-to.x,a.z-to.z)<1.8&&!L.crossesClosedRoomDoor(s.model(a.floor),a,to)){a.rise={from:{x:a.x,z:a.z},to,time:0};continue;}}}
    if(a.fear.scatter&&!a.fear.scattered&&s.time<a.fear.start+7){
      const route=a.zKind==='fear-scatter'&&a.zPath.length?a.zPath:L.officeRoute(s.grid(a.floor),a,a.fear.scatter);
      if(route.length){
        if(route!==a.zPath)Object.assign(a,{zPath:route,zAt:0,zGoal:a.fear.scatter,zKind:'fear-scatter'});
        a.action='受惊躲闪，远离袭击者';
        if(z.move(a,dt,2.6+(a.id%4)*.15)){a.fear.scattered=true;a.zPath=[];}
        continue;
      }
      a.fear.scattered=true;
    }
    z.evacuate(a,dt,2.8,'受惊后向街区分散');
   }}
 }
 L.CivilianReactions=CivilianReactions;
})();
