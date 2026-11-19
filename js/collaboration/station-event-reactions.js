/* Event responses use the real cabin occupants and the normal swept-body
   navigation. Their interrupted routines resume from the new location. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,clamp=T.MathUtils.clamp;
  // Crew and robot responses per event. Kind-specific entries let the control
  // cabin crew fly the manipulator while others watch from the windows.
  const configurations={
    capture:{crew:'observe',robot:'scan',crewText:'通过舷窗盯住翻滚目标，报告相对位置',robotText:'同步测距数据，监视机械臂关节负载',byKind:{control:{crew:'console',crewText:'在指令台手控机械臂，对准星箭对接环'}}},
    debris:{crew:'shelter',robot:'secure',crewText:'碎片预警：关闭舱门，蜷身在扶手旁待命',robotText:'加固松散设备，确认舱门密封',byKind:{control:{crew:'console',crewText:'监视规避变轨发动机参数'}}},
    resupply:{crew:'observe',robot:'collect',crewText:'监视交会雷达读数，准备接收货包',robotText:'清出货物通道，搬运新到货包',byKind:{node:{crew:'collect',crewText:'从对接通道接过货包，核对清单'}}},
    attitude:{crew:'brace',robot:'secure',crewText:'姿态异常：抓牢扶手固定身体',robotText:'收拢漂浮物品，锁紧固定带',byKind:{control:{crew:'console',crewText:'切断故障推进器供电，监视角速度'}}},
    solar:{crew:'shelter',robot:'scan',crewText:'质子事件：进入屏蔽区，佩戴个人剂量计',robotText:'为敏感设备加装屏蔽，记录舱内剂量'},
    breach:{crew:'brace',robot:'repair',crewText:'避开漏点，靠近安全扶手稳住身体',robotText:'靠近漏点检查气密与封堵情况'},
    fire:{crew:'brace',robot:'repair',crewText:'戴好面罩，远离故障机柜避开烟气',robotText:'检查故障回路，协助火情处置'},
    coolant:{crew:'collect',robot:'collect',crewText:'避开喷流，用吸水布收拢漂浮液滴',robotText:'检查冷却管路，收集漂浮液滴'},
    blackout:{crew:'observe',robot:'repair',crewText:'扶舱检查应急指示，确认供电恢复',robotText:'巡查配电设备与备用电源'},
    spill:{crew:'collect',robot:'collect',crewText:'抓住破裂的餐包和漂浮面条',robotText:'吸附漂浮液滴与碎屑，清理通风口'},
    broadcast:{crew:'wave',robot:'scan',crewText:'对着镜头向地面课堂挥手讲解',robotText:'稳住摄像机，跟随讲解人补光'}
  };
  const routeKeys=['path','goal','endpoint','navigationGoal','pendingNavigation','flightLaneY','flightPassage','passage','blockedTime','nextReplan'];
  const crewKeys=['activity','activityState','action','activityUntil','pendingActivity','targetAngle','tripStarted','nextCabinTrip','trafficHold','cooperating','cooperateUntil','wait'];
  const robotKeys=['state','status','wait','startedAt','lastProgress','nextTrack','nextRetry','nextLaneChange','meeting'];
  const timerKeys=['activityUntil','tripStarted','nextCabinTrip','cooperateUntil','startedAt','lastProgress','nextTrack','nextRetry','nextLaneChange','nextReplan'];
  const copy=value=>Array.isArray(value)?value.map(p=>({...p})):value&&typeof value==='object'?{...value}:value;
  const position=a=>({x:+a.x.toFixed(4),y:+(a.y||0).toFixed(4),z:+a.z.toFixed(4)});
  class StationEventReactions {
    constructor(station){this.s=station;this.entries=new Map();this.source=null;this.active=false;this.lastSummary=null;this.contextCount=-1;}
    attach(){
      const contexts=this.s.o.contexts;if(!contexts)return;
      if(this.contextCount===contexts.size)return;this.contextCount=contexts.size;
      for(const [key,ctx]of contexts)if(key.startsWith('station-'))ctx.world.eventReactions=this;
    }
    sync(){
      this.attach();const d=this.s.scenarios,film=d?.film,id=film?.id||d?.options?.orbitalEvent;
      const source=d?.active&&film?.liveEvent&&configurations[id]&&film.time<film.duration-1e-6?film:null;
      const target=source?.incident?(source.facts?.displayModule||source.targetModule):null;
      if(this.source===source&&this.targetModule===target)return;
      this.releaseAll();this.source=source;this.active=!!source;this.event=source?id:null;this.targetModule=target;this.config=source?configurations[id]:null;
      if(!source)return;
      for(const [key,ctx]of this.s.o.contexts)if(key.startsWith('station-')&&this.affects(ctx.sim)){
        for(const p of ctx.sim.people)if(!p.external&&!p.stationTransfer)this.enlist(ctx.sim,p,false);
        for(const r of ctx.sim.robots)this.enlist(ctx.sim,r,true);
      }
    }
    affects(sim){return !!this.active&&sim.world.microgravity&&(!this.targetModule||sim.world.spec?.id===this.targetModule);}
    enlist(sim,a,isRobot){
      if(this.entries.has(a))return this.entries.get(a);sim.initFlight(a);if(!isRobot)sim.initCrew(a,a.crewIndex??sim.people.indexOf(a));
      const saved={};for(const key of [...routeKeys,...(isRobot?robotKeys:crewKeys)])saved[key]={present:Object.prototype.hasOwnProperty.call(a,key),value:copy(a[key])};
      const kind=this.config.byKind?.[sim.world.spec?.kind]||{},entry={actor:a,sim,isRobot,saved,mission:a.mission,missionTimes:a.mission?{startedAt:a.mission.startedAt,stageStartedAt:a.mission.stageStartedAt}:null,startedAt:sim.time,start:position(a),distance:0,phase:-1,routeAttempts:0,routeCount:0,mode:isRobot?(kind.robot||this.config.robot):(kind.crew||this.config.crew),text:isRobot?(kind.robotText||this.config.robotText):(kind.crewText||this.config.crewText)};
      this.entries.set(a,entry);a.path=[];a.goal=a.endpoint=null;delete a.flightLaneY;delete a.flightPassage;delete a.passage;a.blockedTime=0;a.trafficHold=false;
      if(isRobot){a.state='event-response';a.status=entry.text;}
      else{a.pendingActivity=null;a.cooperating=false;a.activity='event-response';a.activityState='responding';a.action=entry.text;}
      this.plan(entry);this.pose(entry);sim.flightVisualsDirty=true;
      return entry;
    }
    phase(){return Math.min(3,Math.floor((this.source?.time||0)/8));}
    candidates(entry){
      const {sim,actor:a,isRobot}=entry,points=(sim.world.activityPoints||[]).map(p=>({...p})),task=(sim.world.taskPoints||[]).map(p=>({...p})),index=(a.crewIndex??Number(a.id.split('-').at(-1)))||0,stage=this.phase(),length=sim.world.spec?.length||8;
      let wanted;const near=kinds=>points.filter(p=>kinds.includes(p.activity)).sort((p,q)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(q.x-a.x,q.z-a.z))[0];
      if(this.event==='broadcast')wanted={x:-.55,z:-length*.12+(index%2?.55:-.35),angle:Math.PI/2};
      else if(this.event==='spill')wanted={x:(index%2?.5:-.5),z:-length*.12+(stage%2?.4:-.3)};
      else if(entry.mode==='console'){const p=near(['work','observe','inspect']);wanted=p?{x:p.x,z:p.z,angle:p.angle}:{x:-.6,z:-length*.3};}
      else if(entry.mode==='shelter'){const p=near(['rest']);wanted=p?{x:p.x,z:p.z+(index%2?.45:-.45),angle:p.angle}:{x:.5,z:length*.2};}
      else if(this.targetModule&&entry.mode==='brace')wanted={x:.5,z:length*.26};
      else if(this.targetModule&&isRobot)wanted={x:-.5,z:-length*.18};
      else if(entry.mode==='observe'&&!isRobot){const p=near(['observe']);wanted=p?{x:p.x,z:p.z,angle:p.angle}:{x:index%2?.65:-.65,z:length*.18};}
      else if(entry.mode==='brace')wanted={x:index%2?.7:-.7,z:(index%2?-.22:.22)*length};
      else wanted={x:stage%2?.55:-.55,z:(stage%2?.23:-.23)*length};
      const nearby=[];for(const dx of [0,-.45,.45])for(const dz of [0,-.65,.65])nearby.push({x:wanted.x+dx,z:wanted.z+dz,y:a.y,...(Number.isFinite(wanted.angle)?{angle:wanted.angle}:{})});
      const list=[...nearby,...points,...task].filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&sim.grid.isClear(p.x,p.z,a.radius+.025));
      return list.sort((p,q)=>{
        const rank=p=>Math.hypot(p.x-wanted.x,p.z-wanted.z)+(.5>Math.hypot(p.x-a.x,p.z-a.z)?1.4:0)+[...this.entries.values()].filter(e=>e!==entry&&e.sim===sim&&e.actor.goal&&Math.hypot(p.x-e.actor.goal.x,p.z-e.actor.goal.z)<a.radius+e.actor.radius+.25).length*3;
        return rank(p)-rank(q);
      });
    }
    plan(entry){
      const {sim,actor:a}=entry;entry.phase=this.phase();entry.routeAttempts++;entry.nextPlanAt=sim.time+3;
      for(const target of this.candidates(entry)){
        if(!sim.go(a,{...target,y:sim.flightHeight(a,target.y??a.y)}))continue;
        entry.routeCount++;entry.goal={...a.goal};entry.targetAngle=Number.isFinite(target.angle)?target.angle:(target.x<0?-Math.PI/2:Math.PI/2);return true;
      }
      // An occupied aisle is not a reason to teleport or abandon the response.
      // Keep the in-place protective/observational pose and retry a real route.
      a.path=[];a.goal=a.endpoint=null;entry.targetAngle=a.model.rotation.y;return false;
    }
    pose(entry){
      const {actor:a,isRobot}=entry,t=this.source?.time||0,mode=entry.mode;
      a.model.userData.stationEventReaction={event:this.event,mode,time:t,intensity:this.event==='attitude'?.7+.3*Math.sin(t*1.4)**2:1};
      if(isRobot){
        a.state='event-response';a.status=entry.text;
        const flight=a.model.userData.flightAnimation||{};
        a.model.userData.flightAnimation={...flight,action:a.moving?'move':['repair','collect','dance','scan','secure'].includes(mode)?'work':'guard',event:this.event,speed:Math.hypot(a.velocity.x,a.velocity.y,a.velocity.z)};
        if(mode==='dance'){a.model.rotation.x=.1*Math.sin(t*2.4);a.model.rotation.z=.16*Math.sin(t*2.4+1);}
        else if(mode==='stabilize'||this.event==='attitude'&&mode==='secure'){a.model.rotation.x=.055*Math.sin(t*1.5);a.model.rotation.z=.08*Math.sin(t*1.8);}
      }else{a.activity='event-response';a.activityState='responding';a.action=entry.text;}
    }
    stepCrew(sim,p,dt){return this.stepActor(sim,p,dt,false);}
    stepRobot(sim,r,dt){return this.stepActor(sim,r,dt,true);}
    stepActor(sim,a,dt,isRobot){
      if(!this.affects(sim)||a.external||!isRobot&&a.stationTransfer)return false;
      let entry=this.entries.get(a);
      // Explicit task edits/cancellation win over the suspended task snapshot.
      if(entry&&isRobot&&(a.mission!==entry.mission||a.state!=='event-response')){this.release(entry,false);entry=null;}
      entry??=this.enlist(sim,a,isRobot);const before={x:a.x,y:a.y,z:a.z};
      const movingRoutine=['collect','dance','scan','repair','secure'].includes(entry.mode),stage=this.phase();
      if((movingRoutine&&entry.phase!==stage)||(!a.path.length&&!entry.goal&&sim.time>=entry.nextPlanAt))this.plan(entry);
      a.trafficHold=false;sim.advanceFlight(a,dt,isRobot);
      if(!a.path.length){
        const t=this.source.time,angle=this.event==='broadcast'?entry.targetAngle+.22*Math.sin(t*1.2+(a.crewIndex||0)):entry.mode==='scan'?entry.targetAngle+.28*Math.sin(t*.9):entry.targetAngle;
        const turn=Math.atan2(Math.sin(angle-a.model.rotation.y),Math.cos(angle-a.model.rotation.y));a.model.rotation.y+=turn*(1-Math.exp(-dt*2.8));
      }
      entry.distance+=Math.hypot(a.x-before.x,a.y-before.y,a.z-before.z);this.pose(entry);sim.sync(a);sim.flightVisualsDirty=true;
      if(!sim.deferActorVisuals){if(isRobot)C.animateRobot(a.model,a.phase,a.moving,['repair','collect','dance','secure'].includes(entry.mode),this.source.time);else C.animateStationCrew(a.model,a.phase,a.moving,false,{activity:a.activity,speed:a.crewTravelSpeed,distance:a.crewTravelDistance});}
      return true;
    }
    release(entry,restore=true){
      const {actor:a,sim,isRobot,saved}=entry;delete a.model.userData.stationEventReaction;this.entries.delete(a);
      const present=(isRobot?sim.robots:sim.people).includes(a),unchanged=!isRobot||a.mission===entry.mission&&a.state==='event-response';
      if(!present)return;
      if(!restore||!unchanged){if(a.model.userData.flightAnimation?.event===this.event)delete a.model.userData.flightAnimation;a.model.rotation.x=a.model.rotation.z=0;sim.flightVisualsDirty=true;return;}
      const elapsed=Math.max(0,sim.time-entry.startedAt);
      for(const [key,item]of Object.entries(saved)){if(item.present)a[key]=copy(item.value);else delete a[key];}
      for(const key of timerKeys)if(Number.isFinite(a[key]))a[key]+=elapsed;
      if(isRobot){
        if(a.meeting&&Number.isFinite(a.meeting.until))a.meeting.until+=elapsed;
        if(a.pendingNavigation)for(const key of ['deadline','nextRetry','startedAt'])if(Number.isFinite(a.pendingNavigation[key]))a.pendingNavigation[key]+=elapsed;
        if(a.mission===entry.mission&&entry.missionTimes)for(const key of ['startedAt','stageStartedAt'])if(Number.isFinite(entry.missionTimes[key]))a.mission[key]=entry.missionTimes[key]+elapsed;
      }
      const goal=a.goal||a.endpoint||a.path?.at(-1);a.path=[];a.blockedTime=0;a.moving=false;a.velocity.x=a.velocity.y=a.velocity.z=0;delete a.flightPassage;delete a.passage;delete a.flightLaneY;
      if(goal){if(!sim.go(a,goal)&&isRobot)a.navigationGoal={...goal};}
      a.floatAnchorY=a.y;if(!a.path.length)a.floatTargetY=a.y;a.model.rotation.x=a.model.rotation.z=0;
      if(isRobot){delete a.model.userData.flightAnimation;sim.drawRoute(a);}sim.sync(a);sim.flightVisualsDirty=true;
    }
    releaseAll(){
      if(this.entries.size)this.lastSummary=this.snapshot();
      for(const entry of [...this.entries.values()])this.release(entry);
    }
    snapshot(){
      const actors=[...this.entries.values()].filter(e=>(e.isRobot?e.sim.robots:e.sim.people).includes(e.actor)).map(e=>({id:e.actor.id,name:e.actor.name,kind:e.isRobot?'robot':'crew',module:e.sim.world.spec?.id,event:this.event,mode:e.mode,action:e.isRobot?e.actor.status:e.actor.action,start:e.start,position:position(e.actor),responseDistance:+e.distance.toFixed(4),routeCount:e.routeCount,moving:!!e.actor.moving}));
      return{active:this.active,event:this.event,targetModule:this.targetModule,time:this.source?.time||0,crew:actors.filter(a=>a.kind==='crew').length,robots:actors.filter(a=>a.kind==='robot').length,actors};
    }
    dispose(){this.releaseAll();this.source=null;this.active=false;this.event=null;}
  }
  C.StationEventReactions=StationEventReactions;
})();
