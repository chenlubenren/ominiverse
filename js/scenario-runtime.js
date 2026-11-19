/* Shared health display and bounded scenario reactions. */
(() => {
 'use strict';const L=window.IndoorLab,$=id=>document.getElementById(id);
 L.isAgentAffected=a=>!!a&&(a.health==='zombie'||a.health==='turning'||a.hasMutated||a.respiratoryStage==='exposed'||a.respiratoryStage==='infectious'||a.ventilationAffected===true);
 L.agentAlertColor=a=>L.isAgentAffected(a)?'#ed252d':null;
 const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
 class ScenarioRuntime {
  constructor(b){
   this.b=b;this.s=b.society;this.initialPeople=new Map();this.initialDoors=new Map();this.nextAmbient=0;this.nextExposure=0;this.initialSeed=this.s.seed;
   this.captureBaseline();this.nextUI=0;this.lastCounts=null;
  }
  captureBaseline({validateLayout=false}={}){
   const s=this.s,people=s.agents.filter(a=>!a.isPlayer&&!a.directorSpawn);
   if(validateLayout){
    const placed=[];for(const a of people){
     if(a.homeSeat&&!s.seat(a.homeFloor,a.homeSeat))a.homeSeat=null;
     if(a.location!=='floor')continue;
     const seat=a.pose==='sit'&&a.seatId?s.seat(a.floor,a.seatId):null;
     if(seat){a.x=seat.x;a.z=seat.z;a.angle=seat.angle;}
     else{a.seatId=null;a.pose='stand';a.sitBlend=0;const g=s.grid(a.floor),nav=g.nav(.24),cell=g.index(a.x,a.z),clear=p=>placed.every(q=>q.floor!==a.floor||Math.hypot(q.x-p.x,q.z-p.z)>=.52);
      if(cell<0||!nav.valid[cell]||nav.component[cell]!==nav.largest||!clear(a)){let best=null,distance=Infinity;for(const i of nav.mainFree){const p=g.point(i),d=(a.x-p.x)**2+(a.z-p.z)**2;if(d<distance&&clear(p)){best=p;distance=d;}}if(best)Object.assign(a,best);}
     }placed.push(a);
    }
    const ids=new Set(people.map(a=>a.id));for(const map of [s.reservations,s.seatOwners])for(const [key,id]of map)if(ids.has(id))map.delete(key);
    for(const a of people)if(a.location==='floor'&&a.seatId){const key=s.seatKey(a.floor,a.seatId);s.reservations.set(key,a.id);s.seatOwners.set(key,a.id);}s.bodies.rebuild();
   }
   this.initialPeople.clear();this.initialDoors.clear();this.initialSeed=s.seed;
   const keys=['floor','location','x','z','angle','pose','sitBlend','seatId','state','activity','action','until','health','homeFloor','homeSeat','appearance','outsidePath','outsideAt','plan','gesture'];
   for(const a of people){const data={};for(const key of keys)data[key]=copy(a[key]??null);if(validateLayout&&Number.isFinite(data.until))data.until=Math.max(0,data.until-s.time);this.initialPeople.set(a.id,data);}
   for(const model of s.models)for(const door of model.doors)this.initialDoors.set(model.towerFloor+':'+door.id,door.open);
   this.lastCounts=null;this.nextAmbient=this.nextExposure=this.nextUI=0;return this.initialPeople.size;
  }
  ambient(){
   const s=this.s,d=L.disasterDirector;if(s.time<this.nextAmbient)return;this.nextAmbient=s.time+.35;
   const fire=!!d?.fires.size;if(!fire)return;
   for(const a of s.agents){if(a.isPlayer||a.health==='dead'||['zombie','turning'].includes(a.health)||!L.isOutdoorAgent(a))continue;
    if(Math.hypot(a.x,a.z-12)>48||a.z< -18)continue;
    if(!a.avoidBuilding){s.exterior.frighten(a,{x:0,z:12},false);a.avoidBuilding=true;a.plan=null;a.pendingPlan=null;a.action='发现大楼起火，转身跑向街区安全处';s.note(a,'发现楼内火灾',a.action);}
    if(a.outdoorFlight){a.outdoorFlight.origin=null;a.outdoorFlight.dangerUntil=Math.max(a.outdoorFlight.dangerUntil||0,s.time+8);a.outdoorFlight.threat={x:0,z:12};}
   }
  }
  exposure(){
   const s=this.s,e=s.emergency;if(s.time<this.nextExposure)return;this.nextExposure=s.time+.3;
   if(e.type!=='ventilation')return;const h=e.hazard;
   for(const a of s.agents){if(a.isPlayer||a.health==='dead'||a.location!=='floor')continue;const field=h.floors[Math.round(a.floor)-1];if(!field)continue;const i=field.grid.index(a.x,a.z),c=i>=0?field.air[i]:0;if(c>h.coverageThreshold*.65){a.ventilationAffected=true;a.ventilationDose=(a.ventilationDose||0)+c*.3;}}
  }
  counts(){
   const people=this.s.agents.filter(a=>this.initialPeople.has(a.id)),alive=people.filter(a=>!['dead','zombie','turning'].includes(a.health)),infected=alive.filter(a=>L.isAgentAffected(a)),zombies=this.s.agents.filter(a=>a.health==='zombie'||a.health==='turning'),outside=alive.filter(a=>L.isOutdoorAgent(a)||a.location==='escaped');
   return{initial:this.initialPeople.size,alive:alive.length,dead:people.filter(a=>a.health==='dead').length,infected:infected.length,zombies:zombies.length,outside:outside.length,inside:alive.length-outside.length};
  }
  update(dt,{running=this.s.running}={}){const active=L.disasterDirector?.fires.size||this.s.emergency.type!=='none'||this.s.zombie.active||L.robotArmy?.robots.some(r=>r.hostile);if(active&&running){this.ambient();this.exposure();}this.nextUI-=dt;if(this.nextUI<=0){this.nextUI=active?.5:2;this.updateUI();}}
  updateUI(){L.affectedAgentIds=new Set(this.s.agents.filter(L.isAgentAffected).map(a=>a.id));this.lastCounts=this.counts();return this.lastCounts;}
  snapshot(){return {...(this.lastCounts||this.updateUI()),fireFloors:[...(L.disasterDirector?.fires.keys()||[])],physics:L.disasterDirector?.physics?.summary()||null,giants:L.megastructureFleet?.summary()||null};}
  captureWalk(){
   const t=this.b.continuous;if(!t.active||this.b.view.view!=='walk'||!t.player)return null;
   const pick=(value,keys)=>Object.fromEntries(keys.map(key=>[key,value[key]])),car=t.player.location==='lift'?this.s.lifts.cars[t.carIndex]:null;
   return{origin:t.origin,stair:t.stair,carIndex:t.carIndex,outside:t.worldWalk.outside,rideY:t.worldWalk.rideY,
    fp:pick(t.fp,['feet','eyeHeight','bodyHeight','crouched','verticalSpeed','grounded','phase','landing','jumpRequested','speed','bob','roll']),velocity:t.fp.velocity.clone(),
    player:pick(t.player,['x','z','angle','floor','location','pose','sitBlend','state','feetY','absoluteY','stair','vx','vz','liftStage','manualLift']),
    car:car?{...this.s.renderCar(car),floor:Number.isFinite(t.worldWalk.rideY)?t.worldWalk.rideY/3.6+1:this.s.renderCar(car).floor}:null};
  }
  restoreWalk(state){
   if(!state)return;const t=this.b.continuous;Object.assign(t.fp,state.fp);t.fp.velocity.copy(state.velocity);Object.assign(t.player,state.player);t.origin=state.origin;t.stair=state.stair;t.carIndex=state.carIndex;t.worldWalk.outside=state.outside;t.worldWalk.rideY=state.rideY;
   // Reset lift service, but keep the occupied cabin beneath the player. A
   // cabin between floors resumes only as far as the nearest safe landing.
   if(state.car){const car=this.s.lifts.cars[state.carIndex],floor=state.car.floor,target=L.clamp(Math.round(floor),1,30),moving=Math.abs(target-floor)>.001;
    Object.assign(car,{floor,door:state.car.door,passengers:[t.player],target:moving?target:null,direction:Math.sign(target-floor),state:moving?'moving':'opening',manualDestination:moving?target:null,manualHoldUntil:3.5});
    if(this.s.lifts.outOfService)car.serviceStop=target;t.player.floor=floor;t.player.liftStage='riding';t.player.liftTo=null;t.worldWalk.rideY=(floor-1)*3.6;
   }this.s.bodies.rebuild();
  }
  async restore({preserveCamera=true,preserveLiftOutage=false}={}){
   const b=this.b,s=this.s,manualOutage=preserveLiftOutage&&s.lifts.outOfService,walk=preserveCamera?this.captureWalk():null;if(!preserveCamera)L.firstPersonMode?.stop(false);b.app.clearDisaster();L.robotArmy?.clear({hostileOnly:false});for(const r of [...(L.officeRobots?.robots||[])])L.officeRobots.remove(r.id);
   s.zombie.stop();s.agents=s.agents.filter(a=>a.isPlayer||this.initialPeople.has(a.id));s.time=0;s.seed=this.initialSeed;s.accumulator=0;s.events=[];s.eventTotal=0;s.meetings=[];s.chats=[];s.lifts=new L.OfficeLifts(s);if(manualOutage)s.lifts.setOutOfService(true);s.reservations.clear();s.seatOwners.clear();s.resourceOwners.clear();
   for(const a of s.agents){if(a.isPlayer){Object.assign(a,{respiratoryStage:null,respiratoryControlled:false,ventilationAffected:false,ventilationDose:0,fireDamage:0,deathCause:null});continue;}Object.assign(a,copy(this.initialPeople.get(a.id)));Object.assign(a,{previous:null,health:'healthy',civilianHP:100,zombieHP:100,zombieControlled:false,alerted:false,hasMutated:false,fear:null,attack:null,transition:null,pendingPlan:null,path:[],pathAt:0,onArrival:null,zPath:[],zKind:'',meetingId:null,chatId:null,stair:null,stairApproach:null,stairWait:null,absoluteY:undefined,respiratoryStage:null,respiratoryControlled:false,ventilationAffected:false,ventilationDose:0,fireDamage:0,deathCause:null,avoidBuilding:false,outdoorFlight:null,planning:false,failedRoute:false,trail:[],distance:0,trip:0,waitTime:0,inShelter:false,alertInfo:null});if(a.seatId){s.reservations.set(s.seatKey(a.floor,a.seatId),a.id);s.seatOwners.set(s.seatKey(a.floor,a.seatId),a.id);}}
   for(const model of new Set([...s.models,...b.continuous.models,L.app.model]))if(model?.doors)for(const door of model.doors){const state=this.initialDoors.get(model.towerFloor+':'+door.id);if(state!==undefined)model.setDoor(door.id,state);}
   s.grids.clear();s.bodies.rebuild();s.activity.clear();s.nextCalendar=3;s.arrivals=s.distance=s.stairTrips=s.completedActivities=0;this.restoreWalk(walk);
   if(!preserveCamera){if(b.continuous.active)b.view.setView('perspective');if(L.matrixDesign.envelope||Object.keys(L.matrixDesign.floors||{}).length)await b.matrixLab.restoreDefaults();}
   if(!preserveCamera){b.exploded=false;b.mix=0;b.drawerFloor=null;b.selected=1;b.setPhase('overview',false);b.frameCamera(false);}b.updateTowerBatches(true);b.view.shadowDirty=true;
   for(const batch of L.characterAssets?.batches||[])batch.states.clear();L.characterAssets?.identities.clear();this.nextAmbient=this.nextExposure=0;if(L.robotArmy){L.robotArmy.time=0;L.robotArmy.nextUI=0;L.robotArmy.serial=0;L.robotArmy.perception.noises=[];}b.view.selected=-1;L.disasterDirector.time=0;b.app.play(true);s.running=true;L.robotSystems?.reset?.({preserveCamera});this.updateUI();
  }
 }
 L.ScenarioRuntime=ScenarioRuntime;
})();
