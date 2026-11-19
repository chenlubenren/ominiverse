/* Contact infection, sight-driven evacuation and cross-floor pursuit. */
(() => {
  'use strict';const L=window.IndoorLab,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  class ZombieSociety {
    constructor(building){this.building=building;this.society=building.society;this.active=false;this.attacks=[];this.infections=0;this.seed=81371;this.ui();}
    random(){this.seed=(this.seed*1664525+1013904223)>>>0;return this.seed/4294967296;}
    ui(){const dock=document.createElement('div');dock.id='scenario-dock';dock.innerHTML='<button id="zombie-toggle">丧尸逃生</button><span id="zombie-summary">日常办公</span><button id="zombie-restart" hidden>重新开始</button>';document.body.appendChild(dock);document.getElementById('zombie-toggle').onclick=()=>this.active?this.stop():this.start();document.getElementById('zombie-restart').onclick=()=>this.restart();
      const result=document.createElement('div');result.id='escape-result';result.hidden=true;result.innerHTML='<div><small>SPATIAL SIMULATION / ESCAPE</small><h2></h2><p></p><button id="escape-again">重新逃生</button><button id="escape-observe">观察楼内</button></div>';document.body.appendChild(result);this.result=result;
      document.getElementById('escape-again').onclick=()=>{this.restart();const t=L.continuousTower;if(!t.active)t.view.setView('walk');const f=t.spawnFloor||this.building.selected;t.switchFloor(f,false);Object.assign(t.player,{floor:f,x:0,z:f===1?9:3.9,location:'floor',health:'healthy'});t.fp.reset();t.view.camera.position.set(0,1.65,t.player.z);this.result.hidden=true;t.fp.lock();};document.getElementById('escape-observe').onclick=()=>{this.result.hidden=true;this.building.view.setView('perspective');};
    }
    restart(){return this.start({restart:true,airborne:!!this.air,intensity:this.air?.intensity,count:this.air?0:5});}
    start({restart=false,count=5,seed,airborne=false,intensity=1,floor=this.building.selected,preserveCamera=false}={}){if(this.active||restart)this.restore({preserveCamera});if(seed!==undefined)this.seed=seed;this.active=true;this.attacks=[];this.infections=0;this.started=this.society.time;this.result.hidden=true;
      const s=this.society;for(const a of s.agents){a.health=a.location==='escaped'&&a.outdoorFlight?'escaped':'healthy';a.hasMutated=false;a.streetHunt=null;a.proneImpact=null;a.airDose=0;a.airLatent=a.airThreshold=undefined;a.airTurning=false;a.civilianHP=100;a.fearFlinchUntil=0;a.emergencyAlight=false;a.injuryMask=0;a.limbDamage={};a.nextBloodAt=0;a.nextHuntAt=0;a.fear=null;a.biteMotion=null;a.impactReaction=null;a.blockedFor=0;a.avoidStairSide=undefined;a.avoidStairUntil=0;a.reverseAfter=0;a.stairChoiceUntil=0;a.hasEscaped=false;a.alerted=false;a.zombieControlled=!!(a.isPlayer||a.outdoorFlight);a.zombieHP=100;a.poise=0;a.downUntil=0;a.stunUntil=0;a.knockVelocity=null;a.locomotionSample=null;a.gaitDistance=0;a.gaitPhase=0;a.gaitSpeed=0;a.bloodLevel=0;a.rise=null;a.attack=null;a.grabbedBy=null;a.zPath=[];a.zombieAnim='';}
      s.meetings=[];s.chats=[];for(const a of s.agents){a.meetingId=null;a.chatId=null;}
      const candidates=s.agents.filter(a=>!a.isPlayer&&a.location==='floor'),local=candidates.filter(a=>a.floor===floor),chosen=[];if(count>0&&local.length)chosen.push(local[Math.floor(this.random()*local.length)]);
      while(chosen.length<Math.min(count,candidates.length)){const a=candidates[Math.floor(this.random()*candidates.length)];if(!chosen.includes(a))chosen.push(a);}for(const a of chosen)this.infect(a,null,true);
      if(airborne)this.air=new L.TowerAirborne(this,intensity);this.building.app.play(true);this.renderUI();return chosen;
    }
    stop(options){this.restore(options);this.active=false;this.result.hidden=true;this.renderUI();}
    restore({preserveCamera=false}={}){const runtime=L.scenarioRuntime,walk=preserveCamera?runtime?.captureWalk():null;this.air?.dispose();this.air=null;const s=this.society;this.active=false;this.attacks=[];s.lifts=new L.OfficeLifts(s);s.meetings=[];s.chats=[];s.reservations.clear();s.seatOwners.clear();s.resourceOwners.clear();
      for(const a of s.agents){a.health='healthy';a.hasMutated=false;a.outdoorFlight=null;a.streetHunt=null;a.proneImpact=null;a.airDose=0;a.airLatent=a.airThreshold=undefined;a.airTurning=false;a.civilianHP=100;a.fearFlinchUntil=0;a.emergencyAlight=false;a.injuryMask=0;a.limbDamage={};a.nextBloodAt=0;a.nextHuntAt=0;a.reaction={code:'calm',posture:'upright',text:a.name+' · 日常办公'};a.previous=null;a.emergencyType=null;a.alertInfo=null;a.fear=null;a.biteMotion=null;a.impactReaction=null;a.blockedFor=0;a.avoidStairSide=undefined;a.avoidStairUntil=0;a.reverseAfter=0;a.stairChoiceUntil=0;a.hasEscaped=false;a.zombieControlled=!!a.isPlayer;a.alerted=false;a.attack=null;a.zPath=[];a.grabbedBy=null;a.zombieAnim='';a.downUntil=0;a.stunUntil=0;a.knockVelocity=null;a.locomotionSample=null;a.gaitDistance=0;a.gaitPhase=0;a.gaitSpeed=0;a.bloodLevel=0;a.rise=null;a.transition=null;a.stair=null;a.stairWait=null;a.stairApproach=null;delete a.absoluteY;a.location='floor';a.floor=a.homeFloor;a.liftRequest=null;a.liftStage=null;a.liftTo=null;a.meetingId=null;a.chatId=null;a.plan=null;a.pendingPlan=null;a.path=[];a.state='arrived';a.gesture=null;a.zombieHP=100;
        const seat=a.homeSeat&&s.seat(a.floor,a.homeSeat);if(seat){a.x=seat.x;a.z=seat.z;a.angle=seat.angle;a.pose='sit';a.sitBlend=1;a.seatId=seat.id;s.setSeatOffset(a.floor,seat.id,0);a.activity='work';a.action='工位办公';s.reservations.set(s.seatKey(a.floor,seat.id),a.id);s.seatOwners.set(s.seatKey(a.floor,seat.id),a.id);}else{a.pose='stand';a.sitBlend=0;a.x=a.isPlayer?0:a.role==='security'?(a.id%2?-4.1:4.1):a.role==='barista'?-12.7:(a.id%2?-10:10);a.z=a.isPlayer?9:a.role==='barista'?-10.8:9;a.until=s.time+15;a.activity='lounge';a.action='休息与等候';if(s.model(a.floor).spec.plan&&['security','barista'].includes(a.role)){const feature=s.model(a.floor).features.find(q=>q.kind===(a.role==='security'?'guard':'coffee'));if(feature){const g=s.grid(a.floor),i=g.nearest({...feature,x:feature.x+(a.role==='security'&&a.id%2?5.2:0)},.24,g.nav(.24).largest);if(i>=0){a.x=g.point(i).x;a.z=g.point(i).z;}}}}
      }
      s.bodies.rebuild();for(const batch of L.characterAssets?.batches||[])batch.states.clear();const t=L.continuousTower;if(t?.active){if(!walk){t.stair=null;t.carIndex=undefined;t.fp.reset();}this.result.hidden=true;}this.building.combat?.reset();if(walk){runtime.restoreWalk(walk);if(walk.car)s.lifts.cars[walk.carIndex].manualHoldUntil=s.time+3.5;}
    }
    release(a){a.stairWait=null;a.stairApproach=null;const s=this.society;if(L.isOutdoorAgent(a))s.releaseSeat(a);a.zombieControlled=true;a.path=[];a.zPath=[];a.transition=null;a.pendingPlan=null;a.plan=null;a.meetingId=null;a.chatId=null;a.gesture=null;if(a.location==='lift'){
      if(!this.active&&!['fire','earthquake'].includes(s.emergency?.type)){a.liftTo=1;a.emergencyAlight=false;}
      else{a.emergencyAlight=true;const car=s.lifts.cars.find(c=>c.passengers.includes(a));if(car&&car.state!=='moving'){car.manualPickup=Math.round(car.floor);car.manualHoldUntil=s.time+6;}}
    }else{a.liftRequest=null;a.liftStage=null;}s.lifts.calls=s.lifts.calls.filter(q=>q.agent!==a);if(a.seatId){const seat=s.seat(a.floor,a.seatId),g=s.grid(a.floor),index=g.nearest(seat?.approach||a,.24,g.hasClosedDoors?undefined:g.nav(.24).largest);if(index>=0&&distance(a,g.point(index))<1.8&&(!g.hasClosedDoors||this.building.reactions.canSee(a,{...a,...g.point(index)})))a.rise={from:{x:a.x,z:a.z},to:g.point(index),time:0};s.releaseSeat(a);}a.pose='stand';a.sitBlend=0;a.state='moving';}
    moveRise(a,dt){const rise=a.rise;if(!rise)return false;if(L.crossesClosedRoomDoor(this.society.model(a.floor),a,rise.to)){a.rise=null;a.vx=a.vz=0;return false;}const dx=rise.to.x-a.x,dz=rise.to.z-a.z,d=Math.hypot(dx,dz),step=Math.min(d,dt*1.25);rise.time+=dt;a.vx=d?dx/d*step/dt:0;a.vz=d?dz/d*step/dt:0;a.x+=a.vx*dt;a.z+=a.vz*dt;a.state='moving';if(d<=step+.001)a.rise=null;return true;}
    infect(a,source,initial=false,airborne=false){if(['zombie','dead','turning'].includes(a.health)||a.health==='escaped'&&!L.isOutdoorAgent(a))return false;this.release(a);if(!a.isPlayer&&L.isOutdoorAgent(a))this.society.exterior.enterZombie(a);a.health='turning';a.airTurning=airborne;a.turnTime=airborne?9+this.random()*5:initial?.7:1.6;a.turnRemaining=a.turnTime;a.zombieAnim=airborne?'air-shiver':'turn';a.action=airborne?'感染发作，失去协调':initial?'感染异变':'被咬后正在转化';a.grabbedBy=null;a.attack=null;a.zombieHP=100;a.poise=0;a.infectedBy=source?.id??null;this.infections++;this.society.note(a,'病毒感染',airborne?'通风暴露后发作':initial?'初始感染':'咬击传播');return true;}
    healthy(a){return a.health==='healthy'&&a.location!=='escaped'||a.health==='escaped'&&L.isOutdoorAgent(a);}
    y(a){return this.society.bodies.feet(a);}
    line(a,b){if(a.location==='lift'&&b.location==='lift')return this.society.lifts.cars.some(c=>c.passengers.includes(a)&&c.passengers.includes(b));if(Math.abs(this.y(a)-this.y(b))>.95)return false;if(L.isOutdoorAgent(a)||L.isOutdoorAgent(b))return this.society.exterior.canSee(a,b);if(a.location==='stairs'||b.location==='stairs'){if(a.stair&&b.stair&&a.stair.side!==b.stair.side)return false;return Math.hypot(distance(a,b),this.y(a)-this.y(b))<1.25;}return Math.round(a.floor)===Math.round(b.floor)&&(this.building.reactions?this.building.reactions.canSee(a,b):this.society.grid(a.floor).lineClear(a,b,.06));}
    alert(a,source){if(!this.healthy(a)||a.isPlayer)return;if(L.isOutdoorAgent(a)){if(source)this.society.exterior.frighten(a,source,true);return;}if(a.alerted)return;this.release(a);a.alerted=true;a.action='发现丧尸，逃向一楼出口';a.zombieAnim='flee';a.zRouteAt=0;this.society.note(a,'发现感染者','开始逃生');}
    contactTarget(a,healthy){let best=null,nearest=Infinity;for(const b of healthy){if(!this.healthy(b)||b.grabbedBy!=null)continue;const d=Math.hypot(distance(a,b),this.y(a)-this.y(b)),reach=b.pose==='sit'?1.5:.82;if(d<reach&&d<nearest&&this.line(a,b)){best=b;nearest=d;}}return best;}
    huntTarget(a,healthy){let best=null,cost=Infinity;const outdoor=L.isOutdoorAgent(a);for(const b of healthy){const outside=L.isOutdoorAgent(b);if(!this.healthy(b)||outdoor&&!outside||!outside&&!['floor','stairs'].includes(b.location))continue;const vertical=Math.abs(this.y(a)-this.y(b)),d=distance(a,b),visible=vertical<.95&&d<(outside?18:9)&&this.line(a,b),value=d+vertical*3.4-(visible?28:0)+(b.isPlayer?-1:0);if(value<cost){best=b;cost=value;}}return best;}
    pursuitFloor(a,target){if(L.isOutdoorAgent(target))return 1;if(target.location!=='stairs'||!target.stair)return Math.round(target.floor);const tr=target.stair;if(Math.round(a.floor)===tr.from)return tr.to;if(Math.round(a.floor)===tr.to)return tr.from;return Math.abs(a.floor-tr.from)<Math.abs(a.floor-tr.to)?tr.from:tr.to;}
    bleed(a){if(a.health!=='zombie'||Math.hypot(a.vx||0,a.vz||0)<.1||this.society.time<(a.nextBloodAt||0))return;a.nextBloodAt=this.society.time+.9+this.random()*2.7;const effects=this.building.combat?.effects;if(!effects)return;const y=this.y(a);effects.drip({x:a.x+(this.random()-.5)*.12,y:y+.65,z:a.z+(this.random()-.5)*.12},y);}
    path(a,goal,kind){const s=this.society,g=s.grid(a.floor);a.zPath=L.safeEscapeRoute?L.safeEscapeRoute(s,a,goal):L.officeRoute(g,a,goal);a.zAt=0;a.zGoal={...goal};a.zKind=kind;a.repath=s.time+.65+(a.id%7)*.05;if(!a.zPath.length){const i=g.nearest(a,.24,g.hasClosedDoors?undefined:g.nav(.24).largest);if(i>=0&&distance(a,g.point(i))<1.3)a.zPath=[g.point(i)];}return a.zPath.length>0;}
    refreshCrowd(){this.crowdTime=this.society.time;this.crowd=new Map();for(const a of this.society.agents){if(a.location!=='floor'||['dead','escaped'].includes(a.health))continue;const key=`${Math.round(a.floor)}:${Math.floor(a.x/1.2)}:${Math.floor(a.z/1.2)}`;if(!this.crowd.has(key))this.crowd.set(key,[]);this.crowd.get(key).push(a);}}
    neighbors(a){if(this.crowdTime!==this.society.time)this.refreshCrowd();const result=[],cx=Math.floor(a.x/1.2),cz=Math.floor(a.z/1.2);for(let x=cx-2;x<=cx+2;x++)for(let z=cz-2;z<=cz+2;z++)for(const b of this.crowd.get(`${Math.round(a.floor)}:${x}:${z}`)||[])if(b!==a&&distance(a,b)<3)result.push(b);return result;}
    stairScore(a,side){if(L.fireExitBlocked?.(a,side))return Infinity;const entry=L.TOWER.core.stairs[side].entry;let score=distance(a,entry);if(a.health!=='zombie'){for(const b of this.society.agents){if(Math.abs(this.y(b)-(a.floor-1)*3.6)>1.3)continue;const d=distance(b,entry);if(b.health==='zombie'&&d<6)score+=(6-d)*8;else if(b!==a&&b.health==='healthy'&&b.location==='floor'){if(d<2)score+=1.3;else if(b.zKind==='stairs'&&b.zStairSide===side)score+=.9;}}if(a.avoidStairSide===side&&a.avoidStairUntil>this.society.time)score+=32;}return score;}
    escapeNeedsRoute(a){if(this.society.time<(a.escapeRecheck||0))return false;a.escapeRecheck=this.society.time+.8+(a.id%5)*.06;return L.fireRouteUnsafe?.(a)||!L.TOWER.core.stairs[a.zStairSide]||(a.blockedFor||0)>.6||this.stairScore(a,1-a.zStairSide)+4<this.stairScore(a,a.zStairSide);}
    selectStair(a,to){
      const s=this.society,g=s.grid(a.floor),scores=L.TOWER.core.stairs.map((_,i)=>this.stairScore(a,i));
      a.repath=s.time+.65+(a.id%7)*.05;
      let best=scores[0]<=scores[1]?0:1;
      if(a.zStairSide!==undefined&&a.stairChoiceUntil>s.time&&scores[a.zStairSide]<scores[best]+3)best=a.zStairSide;
      for(const side of [best,1-best]){
        if(!Number.isFinite(scores[side]))continue;
        const {x,z}=L.sampleTowerStair(side,to>a.floor?0:1),goal={x,z};
        const route=L.safeEscapeRoute?L.safeEscapeRoute(s,a,goal):L.officeRoute(g,a,goal);
        if(!route.length)continue;
        Object.assign(a,{zPath:route,zAt:0,zGoal:goal,zKind:'stairs',zStairSide:side,zStairTo:to,stairChoiceUntil:s.time+1.4,escapeRecheck:s.time+.8});
        return true;
      }
      return false;
    }
    move(a,dt,speed){const points=a.zPath||[];a.zAt??=0;while(a.zAt<points.length&&distance(a,points[a.zAt])<.11)a.zAt++;if(a.zAt>=points.length){a.vx=a.vz=0;return true;}const p=points[a.zAt],d=distance(a,p)||1,near=this.neighbors(a);let dx=(p.x-a.x)/d,dz=(p.z-a.z)/d;
      for(const b of near){const dist=distance(a,b),angle=dist<.001?(a.id*2.399963+b.id*.5):Math.atan2(a.x-b.x,a.z-b.z),nx=dist<.001?Math.sin(angle):(a.x-b.x)/dist,nz=dist<.001?Math.cos(angle):(a.z-b.z)/dist;if(dist<.8){const pressure=(.8-dist)*1.35;dx+=nx*pressure;dz+=nz*pressure;}if(a.health==='healthy'&&b.health==='zombie'&&dist<3){const fear=(1-dist/3)*2.6;dx+=nx*fear;dz+=nz*fear;}}
      const length=Math.hypot(dx,dz)||1;dx/=length;dz/=length;const step=Math.min(d,speed*dt*((a.injuryMask&12)?.48:1)),g=this.society.grid(a.floor);let moved=false;
      for(const angle of [0,.32,-.32,.67,-.67,1.05,-1.05,1.45,-1.45]){const co=Math.cos(angle),si=Math.sin(angle),nx=a.x+(dx*co-dz*si)*step,nz=a.z+(dz*co+dx*si)*step,clear=a.floor===1&&Math.abs(nx)<2.6&&nz>12?true:g.isClear(nx,nz,.24)&&g.lineClear(a,{x:nx,z:nz},.22);if(!clear||L.crossesClosedRoomDoor(this.society.model(a.floor),a,{x:nx,z:nz}))continue;if(this.society.bodies.blocks(a,nx,nz))continue;a.vx=(nx-a.x)/dt;a.vz=(nz-a.z)/dt;a.x=nx;a.z=nz;const heading=Math.atan2(a.vx,a.vz),turn=Math.atan2(Math.sin(heading-a.angle),Math.cos(heading-a.angle));a.angle+=turn*Math.min(1,dt*10);moved=true;a.blockedFor=0;break;}
      if(!moved){a.vx=a.vz=0;a.blockedFor=(a.blockedFor||0)+dt;if(this.society.time>(a.unstick||0)){a.unstick=this.society.time+.75;const avoid=near.filter(b=>b.pose!=='sit'&&distance(b,a.zGoal)>.65),detour=L.officeRoute(g,a,a.zGoal,avoid);if(detour.length){if(a.zKind==='office-egress')detour.push({x:a.zGoal.x,z:13.82});a.zPath=detour;a.zAt=0;}}}a.state='moving';return false;
    }
    escapeGround(a,dt,speed,reason){
      const s=this.society;
      if(a.zKind!=='office-egress'||!a.zPath?.length||a.zAt>=a.zPath.length||a.blockedFor>1.5&&s.time>=(a.nextEgress||0)){
        if(s.time<(a.nextEgress||0))return false;
        const lane=[-2.08,2.08,-1.28,1.28][((a.id+(a.egressAttempt||0))%4+4)%4];
        const target={x:lane,z:12.08},route=L.safeEscapeRoute?L.safeEscapeRoute(s,a,target):L.officeRoute(s.grid(1),a,target);
        a.egressAttempt=(a.egressAttempt||0)+1;a.blockedFor=0;a.nextEgress=s.time+.68+(a.id%4)*.055;
        if(!route.length)return false;
        a.zKind='office-egress';a.zGoal=target;a.zPath=[...route,{x:lane,z:13.82}];a.zAt=0;
      }
      this.move(a,dt,speed);
      if(a.z>13.45&&Math.abs(a.x)<2.6){
        if(a.health==='zombie')s.exterior.enterZombie(a);
        else s.exterior.begin(a,reason);
      }
      return true;
    }
    evacuate(a,dt,speed,reason){
      const s=this.society;
      if(s.time>=(a.nextFireRouteCheck||0)){a.nextFireRouteCheck=s.time+.65;if(L.fireRouteUnsafe?.(a)){a.avoidStairSide=a.zStairSide;a.avoidStairUntil=s.time+8;a.zPath=[];a.zKind='';a.escapeRetryAt=0;a.stairChoiceUntil=0;a.action='发现逃生通道起火，改走另一侧楼梯';}}
      if(a.zKind==='stair-yield'&&s.time<(a.stairYieldUntil||0)){
        a.action='在平台侧面让行';
        this.move(a,dt,1.8);
        return;
      }
      a.action=a.floor===1?'奔向首层出口':'奔向消防楼梯';
      if(s.time>=(a.escapeRetryAt||0)){
        if(a.floor===1){
          if(this.escapeGround(a,dt,speed,reason))return;
        }else{
          const hasStairRoute=a.zKind==='stairs'&&a.zPath?.length;
          if((hasStairRoute&&!this.escapeNeedsRoute(a))||this.selectStair(a,1)){
            if(!this.startStair(a))this.move(a,dt,speed);
            return;
          }
        }
        a.escapeRetryAt=s.time+1.5+(a.id%5)*.17;
      }
      this.panicLocal(a,dt,speed);
    }
    panicLocal(a,dt,speed){
      const s=this.society;
      a.action='通路受阻，就近躲避';
      if(a.zKind==='panic-local'&&a.zAt<a.zPath.length&&(a.blockedFor||0)<.55){
        if(!this.move(a,dt,speed))return;
      }
      if(s.time<(a.panicSearchAt||0))return;
      a.panicSearchAt=s.time+.32+(a.id%4)*.07;
      const g=s.grid(a.floor),nav=g.nav(.24),cell=g.index(a.x,a.z);
      const start=nav.valid[cell]?cell:g.nearest(a,.24);
      if(start<0)return;
      const origin=g.point(start),component=nav.component[start],near=this.neighbors(a),danger=a.fear?.source||near.find(b=>b.health==='zombie');
      const candidates=[];
      for(let i=0;i<36;i++){
        const angle=i*2.399963+a.id*.83+s.time*.56,range=.75+i%6*.67;
        const index=g.index(origin.x+Math.cos(angle)*range,origin.z+Math.sin(angle)*range);
        if(!nav.valid[index]||nav.component[index]!==component)continue;
        const point=g.point(index),d=distance(a,point);
        if(d<.64)continue;
        const space=near.reduce((closest,b)=>Math.min(closest,distance(point,b)),1.7);
        const safe=danger?Math.min(4,distance(danger,point))*.55:0;
        const variation=a.zKind==='panic-local'?Math.min(2,distance(point,a.zGoal))*.85:0;
        candidates.push({point,score:space*1.65+safe+variation+Math.min(d,2.8)*.2});
      }
      candidates.sort((a,b)=>b.score-a.score);
      for(const {point} of candidates.slice(0,5)){
        const route=L.officeRoute(g,a,point);
        if(!route.length)continue;
        Object.assign(a,{zPath:route,zAt:0,zGoal:point,zKind:'panic-local',blockedFor:0});
        this.move(a,dt,speed);
        return;
      }
      a.vx=a.vz=0;
      a.state='waiting';
    }
    stairs(a,dt){let tr=a.stair;if(!tr||!L.TOWER.core.stairs[tr.side]||!Number.isFinite(tr.to)){a.location='floor';a.floor=L.clamp(Math.round(a.floor)||a.homeFloor||1,1,30);a.stair=null;a.stairWait=null;a.stairApproach=null;delete a.absoluteY;a.zPath=[];return;}const length=L.sampleTowerStair(tr.side,0).length;
      if(a.health==='healthy'&&a.alerted&&this.society.time>(a.reverseAfter||0)){const threat=this.society.agents.find(b=>b.health==='zombie'&&b.location==='stairs'&&b.stair?.side===tr.side&&Math.hypot(distance(a,b),this.y(a)-this.y(b))<2.2&&((b.x-a.x)*Math.sin(a.angle)+(b.z-a.z)*Math.cos(a.angle))>.05);if(threat){const progress=clamp(tr.time/tr.duration,0,1),from=tr.from;tr.from=tr.to;tr.to=from;tr.time=(1-progress)*tr.duration;a.floor=tr.from;a.reverseAfter=this.society.time+4;a.avoidStairSide=tr.side;a.avoidStairUntil=this.society.time+12;a.action='楼梯发现感染者，后退改走另一侧';}}
      if(a.health==='healthy'&&tr.time/tr.duration>.55&&this.society.time>=(a.reverseAfter||0)&&L.fireExitBlocked?.({...a,floor:tr.to},tr.side)){const progress=clamp(tr.time/tr.duration,0,1),from=tr.from;tr.from=tr.to;tr.to=from;tr.time=(1-progress)*tr.duration;a.floor=tr.from;a.reverseAfter=this.society.time+4;a.avoidStairSide=tr.side;a.avoidStairUntil=this.society.time+12;a.stairChoiceUntil=0;a.action='发现下层楼梯口起火，返回改走另一侧';}
      const s=this.society,speed=a.health==='zombie'?3.4:2.5,current=clamp(tr.time/tr.duration,0,1);let progress=Math.min(1,current+dt/tr.duration*((a.injuryMask&12)?.48:1));
      for(const b of s.agents){const bt=b.stair;if(b===a||b.location!=='stairs'||!bt||bt.side!==tr.side||bt.from!==tr.from||bt.to!==tr.to||['dead','escaped'].includes(b.health))continue;const ahead=bt.time/bt.duration;if(ahead>current+.0001||Math.abs(ahead-current)<.0001&&b.id<a.id)progress=Math.min(progress,Math.max(current,ahead-.93/length));}
      progress=s.bodies.stairProgress(a,progress);
      const p=L.officeStairPoint(tr,progress),ox=a.x,oz=a.z,blocker=dt&&s.bodies.blocker(a,p.x,p.z,p.y);
      if(blocker){
        a.vx=a.vz=0;s.bodies.yieldLanding(blocker,a);
        if((current>.78||current<.24)&&blocker.location==='floor'&&!blocker.isPlayer&&blocker.health==='healthy'&&blocker.alerted&&s.time>=(blocker.stairYieldUntil||0)){
          const goal={x:Math.sign(a.x)*9.65,z:-3.1+(blocker.id%4)*.48},route=L.officeRoute(s.grid(blocker.floor),blocker,goal);
          if(route.length)Object.assign(blocker,{zPath:route,zAt:0,zKind:'stair-yield',zGoal:goal,stairYieldUntil:s.time+1.6,blockedFor:0});
        }
        return;
      }
      tr.time=progress*tr.duration;a.x=p.x;a.z=p.z;a.absoluteY=p.y;a.angle=p.angle;a.vx=dt?(a.x-ox)/dt:Math.sin(a.angle)*speed;a.vz=dt?(a.z-oz)/dt:Math.cos(a.angle)*speed;a.state='moving';
      if(progress===1){a.floor=tr.to;a.location='floor';a.stair=null;a.stairWait=null;a.stairApproach=null;delete a.absoluteY;a.zPath=[];s.stairTrips++;a.blockedFor=0;}
    }
    startStair(a){
      const side=a.zStairSide,s=this.society;
      if(!L.TOWER.core.stairs[side]||!Number.isFinite(a.zStairTo))return false;
      const to=L.clamp(Math.round(a.floor)+Math.sign(a.zStairTo-a.floor),1,30),entry=L.sampleTowerStair(side,to>a.floor?0:1);
      const pastEntry=Math.abs(a.x)>Math.abs(entry.x)+.25;
      if(L.fireExitBlocked?.(a,side))return false;
      if(to===a.floor||distance(a,entry)>(pastEntry?.9:.48)||!s.grid(a.floor).lineClear(a,entry,.24)||L.crossesClosedRoomDoor(s.model(a.floor),a,entry))return false;
      let startAt=0,best=distance(a,entry);
      if(pastEntry)for(let d=.12;d<=.96;d+=.12){
        const progress=d/entry.length,p=L.sampleTowerStair(side,to>a.floor?progress:1-progress),gap=distance(a,p);
        if(gap<best){best=gap;startAt=progress;}
      }
      const duration=entry.length/(a.health==='zombie'?3.4:2.5),trip={from:a.floor,to,side,time:startAt*duration,duration,startAt,start:{x:a.x,z:a.z}};
      const first=L.officeStairPoint(trip,startAt+.1/duration);
      if(s.bodies.stairLandingBusy(a,side,a.floor,true)||s.bodies.blocks(a,first.x,first.z,first.y))return false;
      if(s.agents.some(b=>b!==a&&b.health!=='dead'&&b.location==='stairs'&&b.stair?.side===side&&b.stair.from===a.floor&&b.stair.to===to&&b.stair.time/b.stair.duration<startAt+.93/entry.length)){
        a.vx=a.vz=0;a.action='保持间距，依次进入楼梯';return false;
      }
      a.location='stairs';a.stair=trip;a.zPath=[];return true;
    }
    warn(a){for(const b of this.society.agents){if(b===a||!this.healthy(b)||b.isPlayer||Math.abs(this.y(a)-this.y(b))>1.3)continue;const d=distance(a,b),outside=L.isOutdoorAgent(b);if(d<(outside?18:8)&&this.line(a,b))this.alert(b,a);}}
    beginAttack(a,target){if(a.health!=='zombie'||!this.healthy(target)||target.grabbedBy!=null||distance(a,target)>(target.pose==='sit'?1.5:.82)||!this.line(a,target))return false;const seated=target.pose==='sit';if(L.isOutdoorAgent(target))target.zombieControlled=true;else this.release(target);const pull=seated&&target.rise?{from:{x:target.x,z:target.z},to:target.rise.to}:null;target.rise=null;a.attack={target:target.id,time:0,bitten:false,blood:false,pull};target.grabbedBy=a.id;target.health='grabbed';target.zombieAnim='struggle';target.action='被抓住，推挡挣脱';a.zombieAnim='grab';a.action='上前抓住肩膀';a.vx=a.vz=target.vx=target.vz=0;this.attacks.push({attacker:a.id,target:target.id,time:this.society.time});this.warn(a);return true;}
    attack(a,dt){const tr=a.attack,target=this.society.agents[tr.target];if(!target||['zombie','dead','escaped'].includes(target.health)){if(target){target.biteMotion=null;target.grabbedBy=null;}a.attack=null;a.biteMotion=null;return;}if(!this.line(a,target)){this.interrupt(a);a.zPath=[];return;}tr.time+=dt;const time=tr.time;a.angle=Math.atan2(target.x-a.x,target.z-a.z);a.zombieAnim=time<.48?'grab':time<1.18?'bite':'recover';a.action=time<.48?'扣住肩膀，拉近身体':time<1.18?'低头贴近颈肩咬击':'松开抓握，回身追捕';target.zombieAnim=tr.bitten?'turn':'struggle';target.angle=a.angle+Math.PI;a.biteMotion={time,role:'attacker'};target.biteMotion={time,role:'victim'};
      if(tr.pull&&target.location==='floor'&&!L.crossesClosedRoomDoor(this.society.model(target.floor),target,tr.pull.to)){const u=clamp(time/.45,0,1),ease=u*u*(3-2*u);target.x=tr.pull.from.x+(tr.pull.to.x-tr.pull.from.x)*ease;target.z=tr.pull.from.z+(tr.pull.to.z-tr.pull.from.z)*ease;}
      if(a.location==='floor'&&target.location==='floor'&&Math.round(a.floor)===Math.round(target.floor)){const d=distance(a,target),hold=time<.48?.61:time<1.18?.49:.64;if(Math.abs(d-hold)>.01){const step=Math.min(Math.abs(d-hold),dt*1.15)*Math.sign(d-hold),x=a.x+Math.sin(a.angle)*step,z=a.z+Math.cos(a.angle)*step;if(this.society.grid(a.floor).isClear(x,z,.24)){a.x=x;a.z=z;}}}
      if(time>.67&&!tr.blood){tr.blood=true;this.building.combat?.effects.blood({x:target.x,y:this.y(target)+1.43,z:target.z},20,{direction:{x:Math.sin(a.angle),z:Math.cos(a.angle)},power:.6,floor:this.y(target)});}
      if(time>1.05&&!tr.bitten){tr.bitten=true;this.infect(target,a);target.biteMotion={time,role:'victim'};}
      if(time>1.55){a.attack=null;a.biteMotion=null;target.biteMotion=null;target.grabbedBy=null;a.zTarget=null;a.zPath=[];a.zombieAnim='chase';}
    }
    interrupt(a){if(a.attack){const target=this.society.agents[a.attack.target];if(target){target.biteMotion=null;target.grabbedBy=null;if(target.health==='grabbed'){target.health=target.location==='escaped'?'escaped':'healthy';target.zombieAnim='flee';if(!target.isPlayer)this.alert(target,a);}}a.attack=null;}a.biteMotion=null;}
    damage(a,damage,poise,direction){if(a.health==='zombie')a.hasMutated=true;if(a.health!=='zombie'&&a.health!=='turning')return false;this.interrupt(a);a.zombieHP=Math.max(0,(a.zombieHP??100)-damage);a.poise=(a.poise||0)+poise;a.stunUntil=this.society.time+.3;a.hitDirection=direction;a.zombieAnim='hit';a.impactReaction={at:this.society.time,until:this.society.time+.48,x:direction.x,z:direction.z,sequence:(a.impactReaction?.sequence||0)+1,strength:Math.min(1,damage/30)};if(a.zombieHP===0){a.health='dead';a.zombieAnim='dead';a.deathTime=this.society.time;a.action='倒地，失去行动能力';}else if(a.poise>=60){a.downUntil=this.society.time+2.2;a.knockVelocity=null;a.poise=0;a.zombieAnim='down';a.action='遭到重击倒地';}return true;}
    tick(dt){if(!this.active)return;this.air?.tick(dt);this.refreshCrowd();const s=this.society,zombies=s.agents.filter(a=>a.health==='zombie'),healthy=s.agents.filter(a=>this.healthy(a));
      for(const a of s.agents){if(a.isPlayer){if(this.healthy(a)&&!a.hasEscaped&&Math.round(a.floor)===1&&a.z>14.5&&Math.abs(a.x)<3&&(a.feetY??0)<.3&&L.continuousTower.fp.grounded){a.health='escaped';a.location='escaped';a.action='已逃出办公楼';a.hasEscaped=true;this.endPlayer(true);}continue;}
        const outdoor=L.isOutdoorAgent(a);
        if(this.healthy(a)&&(!a.alerted||outdoor)){
          if(s.time>(a.nextSense||0)){
            a.nextSense=s.time+(outdoor?.45:.25)+(a.id%5)*.03;
            const threat=zombies.find(z=>{
              const d=distance(a,z);
              return d<(outdoor?18:9)&&this.line(a,z)&&(d<(outdoor?5:2.5)||Math.cos(Math.atan2(z.x-a.x,z.z-a.z)-a.angle)>-.35);
            });
            if(threat)this.alert(a,threat);
          }
          if(!a.alerted||outdoor)continue;
        }
        if(!a.zombieControlled)continue;
        if(a.health==='dead'||a.downUntil>s.time){a.vx=a.vz=0;continue;}
        if(a.knockVelocity){const k=a.knockVelocity,g=outdoor?s.exterior.navigation():s.grid(a.floor),nx=a.x+k.x*dt,nz=a.z+k.z*dt;if(g.isClear(nx,nz,.24)&&!s.bodies.blocks(a,nx,nz)){a.x=nx;a.z=nz;}k.x*=Math.exp(-dt*8);k.z*=Math.exp(-dt*8);if(Math.hypot(k.x,k.z)<.05)a.knockVelocity=null;}
        if(a.health==='grabbed'){a.vx=a.vz=0;continue;}
        if(this.moveRise(a,dt))continue;
        if(a.health==='turning'){a.turnRemaining-=dt;a.vx=a.vz=0;const progress=1-a.turnRemaining/a.turnTime;a.zombieAnim=a.airTurning?(progress<.24?'air-shiver':progress<.45?'air-head':'air-lurch'):'turn';if(a.airTurning&&progress>.45&&!a.isPlayer){this.agitate(a,dt);a.zombieAnim='air-run';}if(a.turnRemaining<=0){a.hasMutated=true;a.health='zombie';a.zombieAnim='chase';a.action='已转化，寻找生还者';a.zTarget=null;a.zPath=[];a.nextHuntAt=0;}continue;}
        if(a.health==='escaped')continue;if(a.stunUntil>s.time){a.zombieAnim='hit';continue;}
        if(a.attack){this.attack(a,dt);continue;}
        // Contact sensing happens before stair/lift movement, so passing survivors are never skipped.
        if(a.health==='zombie'){this.bleed(a);const nearby=this.contactTarget(a,healthy);if(nearby&&this.beginAttack(a,nearby))continue;}
        if(a.location==='lift')continue;if(a.location==='stairs'){this.stairs(a,dt);continue;}
        if(a.health==='zombie'){
          let target=s.agents[a.zTarget];if(!target||!this.healthy(target)||target.location==='lift'||s.time>=(a.nextHuntAt||0)){const next=this.huntTarget(a,healthy);if(next?.id!==a.zTarget){a.zTarget=next?.id;a.zPath=[];a.zKind='';}target=next;a.nextHuntAt=s.time+.55+(a.id%7)*.035;}
          if(outdoor&&a.directorSpawn&&!a.directorEntered){a.zombieAnim='chase';L.disasterDirector.advanceAttacker(a,dt);continue;}if(outdoor){a.zombieAnim='chase';a.action=target?'在街区追捕生还者':'在街区寻找生还者';s.exterior.chase(a,target,dt);continue;}
          if(!target){a.state='waiting';a.vx=a.vz=0;continue;}if(this.beginAttack(a,target))continue;
          const floor=this.pursuitFloor(a,target);if(floor!==Math.round(a.floor)){if((a.zPath.length&&a.zKind==='stairs'&&a.zStairTo===floor)||(s.time>=(a.repath||0)&&this.selectStair(a,floor))){if(this.move(a,dt,3.7))this.startStair(a);}else a.vx=a.vz=0;}
          else if(L.isOutdoorAgent(target)){a.zombieAnim='chase';a.action='穿过一楼出口追向街区';this.escapeGround(a,dt,3.7);}
          else{if(!a.zPath.length||s.time>a.repath&&distance(target,a.zGoal)>.65)this.path(a,target,'chase');this.move(a,dt,3.7);a.zombieAnim='chase';a.action='追捕生还者';}
        }else if(a.alerted){a.zombieAnim='flee';this.evacuate(a,dt,a.floor>1?2.5:2.65,'逃离感染区，向街区分散');}
      }
      const player=L.continuousTower?.player;if(player?.health==='turning'){player.turnRemaining-=dt;if(player.turnRemaining<=0){player.hasMutated=true;player.health='zombie';player.zombieAnim='chase';this.endPlayer(false);}}if(s.time>(this.nextUI||0)){this.nextUI=s.time+.25;this.renderUI();}
    }
    agitate(a,dt){const s=this.society,model=s.model(a.floor),room=model.rooms.find(r=>a.x>r.minX&&a.x<r.maxX&&a.z>r.minZ&&a.z<r.maxZ);a.airRoom??=room?.id;const bounds=model.rooms.find(r=>r.id===a.airRoom)||room;if(!bounds)return;a.action='感染发作，在房间内失控踉跄';if(a.zKind!=='air-panic'||!a.zPath?.length||a.zAt>=a.zPath.length){const g=s.grid(a.floor);for(let i=0;i<8;i++){const goal={x:bounds.minX+.6+this.random()*Math.max(.1,bounds.maxX-bounds.minX-1.2),z:bounds.minZ+.6+this.random()*Math.max(.1,bounds.maxZ-bounds.minZ-1.2)};if(distance(a,goal)<.6||!g.isClear(goal.x,goal.z,.24))continue;if(this.path(a,goal,'air-panic'))break;}}this.move(a,dt,1.7+this.random()*.5);}
    endPlayer(won){const combat=this.building.combat;if(combat){combat.current=null;combat.queue=[];combat.hitStop=0;}this.result.hidden=false;this.result.querySelector('h2').textContent=won?'逃生成功':'你已被感染';this.result.querySelector('p').textContent=won?'你已穿过一楼大厅，来到大楼之外。':this.air?'病毒已经发作。楼内仍可继续观察通风传播与隔离结果。':'咬击传播了病毒。楼内其他生还者仍在逃生，感染者会继续追捕。';const observe=document.getElementById('escape-observe');observe.textContent=won?'继续在楼外探索':'观察楼内';observe.onclick=()=>{this.result.hidden=true;if(won)L.continuousTower.fp.lock();else this.building.view.setView('perspective');};if(document.pointerLockElement)document.exitPointerLock();}
    renderUI(){const count=state=>this.society.agents.filter(a=>a.health===state).length;document.body.classList.toggle('zombie-mode',this.active);document.getElementById('zombie-toggle').textContent=this.active?'结束丧尸模式':'丧尸逃生';document.getElementById('zombie-restart').hidden=!this.active;document.getElementById('zombie-summary').textContent=this.active?`感染 ${count('zombie')+count('turning')} · 生还 ${count('healthy')+count('grabbed')} · 逃出 ${count('escaped')} · 击倒 ${count('dead')}`:'日常办公';}
  }
  L.ZombieSociety=ZombieSociety;
  L.proneJolt=(a,time)=>{const age=time-(a.proneImpact?.at??-10);return age>=0&&age<.28?Math.sin(Math.PI*age/.28)*.052:0;};
  L.zombiePose=(a,time)=>{const state=a.health==='dead'?'dead':a.sneezeUntil>time?'sneeze':a.zombieAnim||'',zombie=a.health==='zombie'||a.hasMutated,phase=time*7+a.id,hitAge=a.impactReaction?Math.max(0,time-a.impactReaction.at):99,hit=hitAge<.48?Math.sin(Math.PI*Math.min(1,hitAge/.48))*(a.impactReaction.strength||1):0,paired=a.biteMotion,pt=paired?.time||0,victim=paired?.role==='victim',grab=state==='grab'?Math.min(1,pt/.35):0,bite=state==='bite'?Math.sin(Math.PI*L.clamp((pt-.48)/.7,0,1)):0,guard=state==='flinch'||state==='hit',recoil=hit*-.12+(victim?.06*Math.sin(Math.min(1,pt/.55)*Math.PI):0);return{active:zombie||!!state||hit>0,zombie,state,lean:(zombie?.07:0)+grab*.1+bite*.16,reach:state==='chase'?.29:state==='grab'?.32+grab*.28:state==='bite'?.53:state==='recover'?.34:0,bite:bite*.09,down:['dead','down'].includes(state),turn:state==='turn'?Math.sin(phase)*.035:0,struggle:state==='struggle'?Math.sin(phase*1.8)*.035:0,guard,hit,recoil,sway:hit*Math.sin(a.id*1.7)*.055,headDip:bite*.075+(guard?.045:0)};};

})();
