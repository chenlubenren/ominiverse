/* Local hazard perception, relayed warnings, shelter, then stair evacuation. */
(() => {
 'use strict';const L=window.IndoorLab,dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 const FIRE_SIGHT_RANGE=9,FIRE_NEAR_RANGE=2,FIRE_SHOUT_RANGE=8,FIRE_ALARM_DELAY=3;
 class OfficeEmergency {
  constructor(building){this.building=building;this.s=building.society;this.type='none';this.hazard=null;this.signals=[];const tick=this.s.tick.bind(this.s);this.s.tick=dt=>{tick(dt);this.tick(dt);};}
  begin(type,hazard,floor){this.type=type;this.hazard=hazard;this.floor=floor;this.started=this.s.time;this.signals=[];this.nextSense=0;this.refuges=new Map();
   // One building alarm belongs to the whole incident. Additional burning
   // floors must not restart the delay while unseen occupants keep working.
   if(type==='fire')this.fireAlarmStarted??=this.s.time;else if(!L.disasterDirector?.fires.size)this.fireAlarmStarted=null;
   for(const a of this.s.agents){a.hazardNotice=null;a.heardAlarmAt=null;a.pendingAlarm=null;a.warningUntil=0;}
   if(type==='earthquake'){hazard.shelterZones=this.shelters(floor);for(const a of this.s.agents)if(a.location==='stairs')this.alert(a,type,'shake');}
   if(['fire','earthquake'].includes(type)){
    for(const q of this.s.lifts.calls)q.agent.liftRequest=null;this.s.lifts.calls=[];
    for(const car of this.s.lifts.cars){const floor=L.clamp(car.state==='moving'?(car.direction>0?Math.ceil(car.floor):Math.floor(car.floor)):Math.round(car.floor),1,30);car.manualDestination=floor;car.manualPickup=floor;car.manualHoldUntil=this.s.time+18;if(car.state==='moving')car.target=floor;for(const a of car.passengers)if(!a.isPlayer)this.alert(a,type,'lift-recall');}
   }
  }
  clear(){this.hazard?.dispose?.();this.hazard=null;this.type='none';this.signals=[];this.fireAlarmStarted=null;for(const a of this.s.agents){a.emergencyType=null;a.alertInfo=null;a.shelterGoal=null;a.hazardNotice=null;a.heardAlarmAt=null;a.pendingAlarm=null;a.warningUntil=0;a.alarmNext=0;a.inShelter=false;}}
  shelters(floor){if(this.refuges.has(floor))return this.refuges.get(floor);const model=this.s.model(floor),g=this.s.grid(floor),zones=[];
   for(const r of model.rooms)for(const [x,z]of [[r.minX+.7,r.minZ+.7],[r.maxX-.7,r.minZ+.7],[r.minX+.7,r.maxZ-.7],[r.maxX-.7,r.maxZ-.7]]){
    const i=g.nearest({x,z},.24);if(i<0)continue;const p=g.point(i);if(p.x<r.minX+.35||p.x>r.maxX-.35||p.z<r.minZ+.35||p.z>r.maxZ-.35||dist(p,{x,z})>1.5)continue;
    zones.push({...p,id:'shelter-'+floor+'-'+zones.length,room:r.id,radius:.58,name:r.name+' · 角落避险位'});
   }
   this.refuges.set(floor,zones);return zones;
  }
  shelter(a,dt){const s=this.s,z=s.zombie,room=s.model(a.floor).rooms.find(r=>a.x>r.minX&&a.x<r.maxX&&a.z>r.minZ&&a.z<r.maxZ);
   if(!a.shelterGoal){const zones=this.shelters(Math.round(a.floor)),same=zones.filter(q=>q.room===room?.id),near=s.agents.filter(b=>b!==a&&b.shelterGoal&&Math.round(b.floor)===Math.round(a.floor));const choices=(same.length?same:zones).map(p=>({p,cost:dist(a,p)+near.reduce((n,b)=>n+(dist(p,b.shelterGoal)<.85?8:0),0)})).sort((a,b)=>a.cost-b.cost);
    for(const {p}of choices)if(z.path(a,p,'quake-shelter')){a.shelterGoal={...p};break;}
   }
   const goal=a.shelterGoal;
   if(goal&&dist(a,goal)>.32){a.action='前往室内角落，准备蹲低护头';a.zombieAnim='';a.reaction={code:'shelter',posture:'upright',text:a.action};if(z.move(a,dt,1.65+(a.id%3)*.08))a.inShelter=true;}
   else{a.inShelter=true;a.vx=a.vz=0;a.state='sheltered';a.zombieAnim='';a.action=goal?'室内角落避险，蹲低保护头颈':'就近蹲低护头，等待摇晃停止';a.reaction={code:'protect',posture:'crouch',text:a.action};}
  }
  alert(a,type,source,from){if(a.isPlayer||a.health!=='healthy'||a.alertInfo?.type===type||!['floor','stairs','lift'].includes(a.location))return false;const z=this.s.zombie;
   if(!a.alerted||type!=='zombie')z.release(a);a.alerted=true;a.emergencyType=type;a.activity=type==='earthquake'?'shelter':'evacuate';a.onArrival=null;a.robotCooperation=null;a.alertInfo={type,source,time:this.s.time,from:from?.id??null};a.pendingAlarm=null;a.hazardNotice=null;a.alarmNext=this.s.time+(type==='fire'?0:2.2+(a.id%4)*.35);a.zombieAnim=type==='earthquake'?'':'flee';a.action=source==='alarm'?'听到全楼火警，离座经消防楼梯撤离':source==='shout'?(type==='fire'?'听到同伴火警，起身并提醒周围人':'听到同伴警报，起身避险'):type==='zombie'?'发现感染者，起身逃生':type==='fire'?'确认火情，呼喊提醒附近同伴':'感到摇晃，前往室内角落';a.reaction={code:'alarm',posture:'upright',text:a.name+' · '+a.action};this.s.note(a,'发现危险',a.action);this.signals.push({id:a.id,type,source,from:from?.id??null,time:this.s.time});return true;}
  fireCues(h=this.hazard){
   if(!h?.grid)return[];const buckets=new Map(),g=h.grid;
   for(let i=0;i<g.size;i++){const flame=h.flame[i],smoke=h.smoke[i],heat=h.temperature[i],ceiling=h.ceilingSmoke?.[i]||0;if(flame<=.08&&smoke<=.08&&heat<=50&&ceiling<=.12)continue;const key=Math.floor((i%g.cols)/3)+':'+Math.floor(Math.floor(i/g.cols)/3),strength=flame*5+smoke+ceiling+(heat-20)/150,old=buckets.get(key);if(!old||strength>old.strength)buckets.set(key,{...g.point(i),flame,smoke,heat,ceiling,strength});}
   return [...buckets.values()];
  }
  perceiveFire(a,cues){let delay=Infinity;
   for(const p of cues){const d=dist(a,p),flame=p.flame>.08,local=d<=1.2&&(p.smoke>.08||p.heat>50),smoke=d<=4.5&&(p.smoke>.12||p.ceiling>.12);
    if(!(flame&&d<=FIRE_SIGHT_RANGE||local||smoke))continue;
    // This is a wall/closed-door check, not a gaze cone or a walking-grid ray:
    // chairs and low desks must not hide flames, heat, or shouted warnings.
    if(!this.building.reactions.canSee(a,{...p,floor:a.floor,location:'floor'}))continue;
    delay=Math.min(delay,local||flame&&d<=FIRE_NEAR_RANGE?0:.35+(a.id%4)*.1);if(delay===0)break;
   }
   return delay;
  }
  receiveFireWarnings(){for(const a of this.s.agents){const pending=a.pendingAlarm;if(pending?.type==='fire'&&this.s.time>=pending.at){a.pendingAlarm=null;this.alert(a,'fire','shout',{id:pending.from});}}}
  warnFire(){const s=this.s,people=s.agents.filter(a=>!a.isPlayer&&a.health==='healthy'&&['floor','stairs'].includes(a.location));
   // Freeze callers for this pass. New listeners react on their own timer,
   // then relay on a later pass, even if their caller has already run away.
   const callers=people.filter(a=>a.alertInfo?.type==='fire'&&s.time>=a.alarmNext);
   for(const caller of callers){caller.alarmNext=s.time+1;caller.warningUntil=s.time+.75;
    for(const other of people){if(other===caller||other.alertInfo?.type==='fire'||other.pendingAlarm||Math.round(other.floor)!==Math.round(caller.floor)||dist(caller,other)>FIRE_SHOUT_RANGE||!this.building.reactions.canSee(caller,other))continue;
     other.heardAlarmAt=s.time+.25+(other.id%4)*.08;other.pendingAlarm={type:'fire',at:other.heardAlarmAt,from:caller.id};
    }
   }
  }
  sense(){const s=this.s,z=s.zombie,fireActive=!!L.disasterDirector?.fires.size||this.type==='fire';if(fireActive)this.fireAlarmStarted??=s.time;else this.fireAlarmStarted=null;const type=z.active?'zombie':this.type==='earthquake'&&this.hazard?.shaking?'earthquake':fireActive?'fire':this.type;if(type==='none'||type==='infection'||type==='ventilation')return;if(type==='fire')this.receiveFireWarnings();const floorPeople=s.agents.filter(a=>!a.isPlayer&&a.health==='healthy'&&a.location==='floor'),threats=z.active?s.agents.filter(a=>a.health==='zombie'&&a.location==='floor'):[],fireCues=type==='fire'?new Map([...(L.disasterDirector?.fires||new Map()),...(this.type==='fire'?[[this.floor,this.hazard]]:[])].map(([f,h])=>[f,this.fireCues(h)])):new Map();
   for(const a of floorPeople){if(a.alertInfo?.type===type)continue;let perceived=false,source='sight',threat;
    if(type==='zombie'){threat=threats.find(b=>Math.round(a.floor)===Math.round(b.floor)&&dist(a,b)<8&&this.building.reactions.canSee(a,b));perceived=!!threat;}
    else if(type==='earthquake'){perceived=this.hazard.shaking&&s.time-this.started>.3+(a.id%7)*.16;source='shake';}
    else if(type==='fire'&&fireCues.has(Math.round(a.floor))){const delay=this.perceiveFire(a,fireCues.get(Math.round(a.floor)));perceived=Number.isFinite(delay);if(perceived){const at=s.time+delay;if(a.hazardNotice?.type!==type||at<a.hazardNotice.at)a.hazardNotice={type,at};}}
    if(perceived){a.hazardNotice??={type,at:s.time};if(s.time>=a.hazardNotice.at)this.alert(a,type,source,threat);}else a.hazardNotice=null;
   }
   if(type==='fire')this.warnFire();
   else if(type!=='earthquake')for(const caller of floorPeople.filter(a=>a.alertInfo?.type===type&&s.time>=a.alarmNext)){caller.alarmNext=s.time+3.2;for(const other of floorPeople){if(other===caller||Math.round(other.floor)!==Math.round(caller.floor)||dist(caller,other)>4.5||!this.building.reactions.canSee(caller,other))continue;other.heardAlarmAt??=s.time+.8+(other.id%4)*.25;if(s.time>=other.heardAlarmAt)this.alert(other,type,'shout',caller);}}
   // Broadcast reaches closed rooms and other floors independently of local
   // sight/shouts. Stagger reactions slightly, then let the normal seat, lift
   // and stair routines move people; players, casualties and safe people keep
   // their existing control and position.
   if(type==='fire')for(const a of s.agents)if(s.time>=this.fireAlarmStarted+FIRE_ALARM_DELAY+(a.id%7)*.1)this.alert(a,type,'alarm');
   if(this.signals.length>1000)this.signals.splice(0,this.signals.length-1000);
  }
  tick(dt){const s=this.s,z=s.zombie;this.hazard?.tick(dt);if(s.time>=(this.nextSense||0)){this.nextSense=s.time+.35;this.sense();}if((this.type==='none'||this.type==='infection'||this.type==='ventilation')&&!L.disasterDirector?.fires.size||z.active)return;
   for(const a of s.agents){if(!a.emergencyType||a.health!=='healthy'||a.isPlayer||a.fear&&!(this.type==='earthquake'&&this.hazard.shaking))continue;if(a.downUntil>s.time){a.vx=a.vz=0;a.zombieAnim='down';continue;}if(a.rise&&L.crossesClosedRoomDoor(s.model(a.floor),a,a.rise.to))a.rise=null;if(a.rise){z.moveRise(a,dt);continue;}if(a.location==='lift'||L.isOutdoorAgent(a))continue;
    if(this.type==='earthquake'&&this.hazard.shaking){a.fear=null;if(a.location==='stairs'){a.vx=a.vz=0;a.action='扶住栏杆，等待摇晃停止';a.reaction={code:'protect',posture:'brace',text:a.action};continue;}this.shelter(a,dt);continue;}
    if(a.inShelter||a.zKind==='quake-shelter'){a.inShelter=false;a.shelterGoal=null;a.zPath=[];a.zKind='';}
    a.activity='evacuate';if(a.location==='stairs'){z.stairs(a,dt);continue;}a.zombieAnim='flee';a.pose='stand';a.reaction={code:'evacuating',posture:'upright',text:'经消防楼梯疏散'};z.evacuate(a,dt,2.5,'经消防楼梯疏散至街区');if(this.type==='fire'&&s.time<a.warningUntil&&a.location==='floor'){a.action+='，呼喊火警提醒周围人';a.reaction.text=a.action;}
   }s.bodies.rebuild();s.recordLocomotion(dt);
  }
 }
 L.OfficeEmergency=OfficeEmergency;
})();
