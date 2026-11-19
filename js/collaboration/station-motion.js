/* Cabin-local microgravity: inertial translation, station keeping and daily crew routines. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,P=C.Simulation.prototype,clamp=T.MathUtils.clamp;
  const original={};
  for(const key of ['addRobot','robotRadius','navigationActors','canPlace','plan','go','approach','rendezvous','requestPassage','assign','recover','move','sync','step','tick','reset','drawRoute','canInteract','report'])original[key]=P[key];
  const robotHeights=new Map(),heightKey=spec=>spec.type+':'+[...(spec.accessories||[])].sort().join(','),makeRobot=C.makeRobot;
  C.makeRobot=spec=>{const model=makeRobot(spec);robotHeights.set(heightKey(spec),model.userData.height/(spec.scale||1));return model;};
  P.actorHeight=function(a){const spec=a.spec||a;return a.model?.userData.height||(robotHeights.get(heightKey(spec))||C.stationRobotDimensions?.[spec.type]?.height||({humanoid:1.32,delivery:1.6,quadruped:.94,carrier:1.1}[spec.type])||1.79)*(spec.scale||1);};
  P.robotRadius=function(spec){const radius=C.stationRobotDimensions?.[spec.type]?.radius;return radius?Math.ceil(radius*(spec.scale||1)*20)/20:original.robotRadius.call(this,spec);};
  P.flightOverlap=function(a,b,position=a){
    const y=position.y??a.y??0,otherY=b.y??0;
    return y<otherY+this.actorHeight(b)+.10&&y+this.actorHeight(a)+.10>otherY;
  };
  P.navigationActors=function(a){const actors=original.navigationActors.call(this,a);return this.world.microgravity?actors.filter(b=>this.flightOverlap(a,b)):actors;};
  P.actorCenter=function(a){return new T.Vector3(a.x,(a.y||0)+this.actorHeight(a)/2,a.z);};
  P.placementPoint=function(spec,point){
    if(!point||![point.x,point.z].every(Number.isFinite))return null;
    const height=this.actorHeight(spec.model?spec:{spec}),ceiling=this.world.ceiling||3.4;
    return {x:point.x,y:point.y===undefined?clamp(1.72-height/2,.22,ceiling-height-.22):point.y,z:point.z};
  };
  P.flightPoint=function(a,point){return new T.Vector3(point.x,Number.isFinite(point.y)?point.y+this.actorHeight(a)/2:1.72,point.z);};
  P.flightHeight=function(a,y){return clamp(y,.22,(this.world.ceiling||3.4)-this.actorHeight(a)-.22);};
  P.initFlight=function(a){
    if(a.velocity)return;
    a.y=this.placementPoint(a.spec||{},a).y;a.velocity={x:0,y:0,z:0};a.floatTargetY=a.y;a.floatAnchorY=a.y;a.phase=a.phase||0;
    a.model.userData.microgravity=true;
  };
  P.initCrew=function(p,index){
    if(p.crewInitialized)return;
    p.crewInitialized=true;p.crewIndex=index;p.radius=.28;p.speed=.38+(index%2)*.04;p.crewTravelDistance=0;p.crewTravelSpeed=0;
    this.initFlight(p);p.y=this.flightHeight(p,.68+(index%3)*.18);p.floatAnchorY=p.floatTargetY=p.y;
    p.activityHistory=[];p.activityIndex=index%(this.world.activityPoints?.length||1);p.nextCabinTrip=this.time+16+index*7;
    const activity=this.world.activityPoints?.[p.activityIndex]||{activity:'inspect',name:'设备检查',duration:10};
    p.activity='observe';p.action='检查当前工位';p.activityUntil=this.time+.4+index*.25;p.activityState='active';p.path=[];p.targetAngle=activity.angle??0;
    p.activityHistory.push({time:this.time,activity:p.activity,name:p.action});this.sync(p);
  };
  P.canPlace=function(spec,point){
    if(!this.world.microgravity)return original.canPlace.call(this,spec,point);
    const q=this.placementPoint(spec,point),height=this.actorHeight({spec});
    return !!q&&Number.isFinite(q.y)&&q.y>=.18&&q.y+height<=(this.world.ceiling||3.4)-.18&&original.canPlace.call(this,spec,q);
  };
  P.addRobot=function(spec,options={}){
    const r=original.addRobot.call(this,spec,options);if(!this.world.microgravity)return r;
    this.initFlight(r);r.speed=spec.type==='carrier'?.34:.48;r.stageTimeout=Math.max(r.stageTimeout,180);
    r.y=this.placementPoint(r,options.position||r).y;r.floatTargetY=r.floatAnchorY=r.y;r.placement={x:r.x,y:r.y,z:r.z};
    r.ring.position.y=this.actorHeight(r)/(2*(spec.scale||1));this.sync(r);C.animateRobot(r.model,0,false,false,this.time);this.drawRoute(r);return r;
  };
  P.prepareFlightRoute=function(a,target){
    const height=this.actorHeight(a),goalY=this.flightHeight(a,a.flightLaneY??(Number.isFinite(target.y)?target.y:1.72-height/2));
    const total=a.path.reduce((sum,p,i)=>sum+Math.hypot(p.x-(i?a.path[i-1].x:a.x),p.z-(i?a.path[i-1].z:a.z)),0);let covered=0,previous=a;
    for(const p of a.path){covered+=Math.hypot(p.x-previous.x,p.z-previous.z);p.y=this.flightHeight(a,a.y+(goalY-a.y)*(total?covered/total:1));previous=p;}
    if(a.endpoint)a.endpoint.y=goalY;if(a.goal)a.goal.y=goalY;a.floatTargetY=goalY;if(a.spec)this.drawRoute(a);
  };
  P.plan=function(a,target){
    // At a close encounter, snapping the starting point back to a grid centre
    // can step toward the other body. A clear direct escape starts at the real
    // position, so a crew member can always use an unobstructed side opening.
    if(!this.world.microgravity)return original.plan.call(this,a,target);
    if(this.grid.isClear(target.x,target.z,a.radius+.02)&&this.segmentClear(a,target))return {path:[{...target}],endpoint:{...target}};
    const route=original.plan.call(this,a,target);if(route)return route;
    // A longer detour may need the same escape before joining the grid. Try
    // nearby reachable cells, rather than insisting on the single nearest cell.
    const x=a.x,z=a.z,entries=this.grid.nav(a.radius+.02).free.map(i=>this.grid.point(i)).filter(p=>Math.hypot(p.x-x,p.z-z)<.9).sort((p,q)=>Math.hypot(p.x-x,p.z-z)-Math.hypot(q.x-x,q.z-z));
    for(const entry of entries.slice(0,12)){
      if(!this.segmentClear(a,entry))continue;
      let detour;try{a.x=entry.x;a.z=entry.z;detour=original.plan.call(this,a,target);}finally{a.x=x;a.z=z;}
      if(detour){detour.path.unshift(entry);return detour;}
    }
    return null;
  };
  P.go=function(a,target){
    let result=false;
    // Crew aim for the actual control surface or handrail before falling
    // back to a nearby navigation cell. Otherwise they operate empty air.
    if(this.world.microgravity&&!a.spec&&target&&this.grid.isClear(target.x,target.z,a.radius+.02)){
      const route=this.plan(a,target);if(route){a.path=route.path;a.endpoint=route.endpoint;a.goal={...target};a.blockedTime=0;result=true;}
    }
    if(!result)result=original.go.call(this,a,target);
    if(this.world.microgravity&&target){
      // An occupied aisle is temporary. Retain a statically reachable task and
      // let the swept-body controller wait/request passage instead of skipping it.
      if(!result&&a.spec){const route=this.grid.route(a,target,a.radius+.02);if(route.reachable&&route.path.length){a.path=route.path;a.endpoint=route.endpoint;a.goal={...target};result=true;}}
      if(result){this.initFlight(a);this.prepareFlightRoute(a,target);}
    }
    return result;
  };
  P.approach=function(r,p){
    if(!this.world.microgravity)return original.approach.call(this,r,p);
    if(!p||p.stationTransfer)return false;
    const height=this.flightHeight(r,this.actorCenter(p).y-this.actorHeight(r)/2),currentY=r.y;
    // Candidate checks use the future arrival height; the body itself still
    // reaches it by accelerating along the resulting three-dimensional route.
    let result;try{r.y=height;result=original.approach.call(this,r,p);}finally{r.y=currentY;}
    if(result)this.prepareFlightRoute(r,{y:height});return result;
  };
  P.rendezvous=function(r,p){if(this.world.microgravity&&p?.stationTransfer)return false;const result=original.rendezvous.call(this,r,p);if(result&&this.world.microgravity)this.prepareFlightRoute(r,{y:(p.floatTargetY??p.y)+this.actorHeight(p)/2-this.actorHeight(r)/2});return result;};
  P.requestPassage=function(r,p){
    if(!this.world.microgravity)return original.requestPassage.call(this,r,p);
    if(p?.spec){
      // The cabin is a volume. Two robots must be able to pass above/below
      // each other instead of waiting forever on the same floor footprint.
      if(this.time<(r.nextLaneChange||0)||p.flightPassage?.other===r)return false;
      const height=this.actorHeight(r),otherHeight=this.actorHeight(p),choices=[p.y+otherHeight+.16,p.y-height-.16].filter(y=>y>=.22&&y+height<=(this.world.ceiling||3.4)-.22).sort((a,b)=>Math.abs(a-r.y)-Math.abs(b-r.y));
      for(const y of choices){
        if(this.actors().some(b=>b!==r&&Math.hypot(r.x-b.x,r.z-b.z)<r.radius+b.radius+.10&&Math.min(r.y,y)<(b.y||0)+this.actorHeight(b)+.10&&Math.max(r.y,y)+height+.10>(b.y||0)))continue;
        const point=r.path[0]||r.goal,dx=(point?.x??p.x)-r.x,dz=(point?.z??p.z)-r.z,length=Math.hypot(dx,dz)||1;
        r.flightPassage={other:p,dx:dx/length,dz:dz/length,restoreY:r.floatTargetY};r.flightLaneY=y;r.floatTargetY=y;for(const point of r.path)point.y=y;if(r.endpoint)r.endpoint.y=y;
        r.nextLaneChange=this.time+12;r.lastProgress=this.time;r.status='调整悬浮高度，让出交会通道';this.drawRoute(r);return true;
      }
      return false;
    }
    if(!p||p.assigned||p.cooperating||this.time<(p.nextRequest||0))return false;
    if(p.stationTransfer)return false;
    p.nextRequest=this.time+3;
    const points=this.grid.nav(p.radius+.02).mainFree.map(i=>this.grid.point(i)).filter(q=>Math.hypot(q.x-p.x,q.z-p.z)<2.2&&Math.abs(q.x-p.x)>.08&&this.grid.lineClear(p,q,p.radius+.02)&&!this.actors().some(a=>a!==p&&Math.hypot(a.x-q.x,a.z-q.z)<a.radius+p.radius+.12));
    points.sort((a,b)=>(Math.abs(b.x-r.x)-Math.abs(a.x-r.x))*3+Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
    for(const point of points.slice(0,12))if(this.askPerson(p,{...point,y:p.y},r,'扶舱侧移，让出漂浮通道',12)){r.passage={person:p,until:this.time+10};r.status='悬停等候，乘员正在侧移让行';return true;}
    return false;
  };
  P.recover=function(r){
    if(this.world.microgravity&&r.partner&&['approach','handoff'].includes(r.state)&&this.time-r.startedAt<Math.min(r.stageTimeout||180,120)){
      // A moving crew member may be delayed by a second robot after accepting
      // a rendezvous. Reapproach that same person instead of excluding the
      // cabin's only recipient and stranding a perfectly serviceable mission.
      r.meeting=null;r.handoff=0;r.state='approach';r.lastProgress=this.time;
      if(this.approach(r,r.partner))r.status='重新接近'+r.partner.name+'，继续舱内交接';
      else{r.path=[];r.wait=.5;r.nextTrack=this.time+.5;r.status='交接通道暂被占用，悬停等待伙伴';this.drawRoute(r);}
      return;
    }
    if(this.world.microgravity&&r.goal&&this.time-r.startedAt<Math.min(r.stageTimeout||180,120)&&r.state!=='handoff'){
      if(this.go(r,r.goal)){r.lastProgress=this.time;r.status='舱道暂被占用，悬停等待通行';return;}
    }
    return original.recover.call(this,r);
  };
  P.assign=function(r){
    if(this.world.microgravity&&r.action==='assist'&&!this.people.length){this.complete(r,'当前舱段暂无乘员可交接，请选择自主巡检或定点补给，或前往有乘员的舱段','attention');return false;}
    return original.assign.call(this,r);
  };
  P.drawRoute=function(r){
    if(!this.world.microgravity)return original.drawRoute.call(this,r);
    if(this.deferActorVisuals){r.flightRouteDirty=true;return;}
    const geometry=r.line.geometry,count=r.path.length+1;let positions=geometry.getAttribute('position');
    if(!positions||positions.count<count){
      // Grow only when necessary; route tracking no longer allocates a new GPU
      // buffer several times per second for each robot.
      geometry.dispose();positions=new T.Float32BufferAttribute(new Float32Array(T.MathUtils.ceilPowerOfTwo(Math.max(8,count))*3),3).setUsage(T.DynamicDrawUsage);geometry.setAttribute('position',positions);
    }
    const center=this.actorCenter(r);positions.setXYZ(0,center.x,center.y,center.z);
    for(let i=0;i<r.path.length;i++){const p=this.flightPoint(r,r.path[i]);positions.setXYZ(i+1,p.x,p.y,p.z);}
    // Unused capacity stays at the endpoint so ordinary bounds also stay valid.
    const end=count-1;for(let i=count;i<positions.count;i++)positions.setXYZ(i,positions.getX(end),positions.getY(end),positions.getZ(end));
    positions.needsUpdate=true;geometry.setDrawRange(0,count);geometry.computeBoundingSphere();r.flightRouteDirty=false;
  };
  P.canInteract=function(r,p){
    if(!this.world.microgravity)return original.canInteract.call(this,r,p);
    if(!p)return false;const a=this.actorCenter(r),b=p.model?this.actorCenter(p):new T.Vector3(p.x,Number.isFinite(p.y)?p.y+this.actorHeight(p)/2:a.y,p.z);
    if(a.distanceTo(b)>r.radius+1.15||Math.abs(a.y-b.y)>.48)return false;
    // Test the actual floating handoff segment, including equipment at its height.
    return !(this.world.colliders||[]).some(box=>{
      if(box.ignore)return false;const n=Math.max(1,Math.ceil(a.distanceTo(b)/.08)),c=Math.cos(box.rotation||0),s=Math.sin(box.rotation||0);
      for(let i=0;i<=n;i++){const t=i/n,y=a.y+(b.y-a.y)*t;if(y<box.y-box.h/2||y>box.y+box.h/2)continue;const x=a.x+(b.x-a.x)*t-box.x,z=a.z+(b.z-a.z)*t-box.z;if(Math.abs(x*c-z*s)<box.w/2+.04&&Math.abs(x*s+z*c)<box.d/2+.04)return true;}return false;
    });
  };
  P.recordCrewTravel=function(p,previous,dt){
    // Measure completed motion, including vertical travel, after collision and
    // height constraints. Doorway movement uses this same animation input.
    const travelled=Math.hypot(p.x-previous.x,p.y-previous.y,p.z-previous.z);
    p.crewTravelDistance=(p.crewTravelDistance||0)+travelled;p.crewTravelSpeed=dt>0?travelled/dt:0;
  };
  P.advanceFlight=function(a,dt,isRobot){
    this.initFlight(a);a._flightFrame=this.time;a.moving=false;
    if(a.flightPassage){const p=a.flightPassage,other=p.other;if((a.x-other.x)*p.dx+(a.z-other.z)*p.dz>a.radius+other.radius+.25||!a.path.length){delete a.flightPassage;delete a.flightLaneY;a.floatTargetY=p.restoreY;if(a.path.length)this.prepareFlightRoute(a,{y:p.restoreY});}}
    const previous=isRobot?null:{x:a.x,y:a.y,z:a.z};
    let holding=!isRobot&&a.trafficHold;
    if(isRobot&&a.passage){
      const {person,until}=a.passage;
      if(this.time<until&&person.cooperating&&person.path.length)holding=true;
      else{delete a.passage;if(a.path.length&&a.goal)this.go(a,a.goal);}
    }
    // A requested side-step reserves its destination until the person reaches
    // it. The waiting robot must not drift into that space and trap both bodies.
    const v=a.velocity,beforeVelocity={...v},beforeYaw=a.model.rotation.y,waypoint=holding?null:a.path[0],targetY=waypoint?.y??a.floatTargetY;
    const dx=waypoint?waypoint.x-a.x:0,dz=waypoint?waypoint.z-a.z:0,d=Math.hypot(dx,dz),acceleration=isRobot?.40:.30;
    const desiredSpeed=waypoint?Math.min(a.speed,Math.sqrt(2*acceleration*d)*.72):0;
    // Velocity persists between steps. Controlled pushes/thrust accelerate and brake;
    // there is no gravity, floor friction or walking speed applied to the body.
    const desired={x:d?dx/d*desiredSpeed:0,z:d?dz/d*desiredSpeed:0},change=Math.hypot(desired.x-v.x,desired.z-v.z),gain=change?Math.min(1,acceleration*dt/change):1;
    v.x+=(desired.x-v.x)*gain;v.z+=(desired.z-v.z)*gain;
    const drift=waypoint?0:.025*Math.sin(this.time*.48+(a.crewIndex||this.serial)*1.7),dy=this.flightHeight(a,targetY+drift)-a.y;
    v.y+=clamp(dy*.9-v.y,-.20*dt,.20*dt);v.y=clamp(v.y,-.18,.18);
    const candidate={x:a.x+v.x*dt,y:this.flightHeight(a,a.y+v.y*dt),z:a.z+v.z*dt};let obstacle=null;
    if(Math.hypot(v.x,v.z)>.0001){
      obstacle=this.actors().find(b=>b!==a&&this.flightOverlap(a,b,candidate)&&Math.hypot(candidate.x-b.x,candidate.z-b.z)<a.radius+b.radius+.10&&Math.hypot(candidate.x-b.x,candidate.z-b.z)<Math.hypot(a.x-b.x,a.z-b.z)+.00001);
      if(obstacle||!this.grid.lineClear(a,candidate,a.radius)){
        v.x=v.z=0;a.blockedTime=(a.blockedTime||0)+dt;
        if(isRobot&&obstacle&&!obstacle.spec){a.status='悬停礼让'+obstacle.name;if(this.time-a.lastYield>4){a.lastYield=this.time;this.yields++;}}
        if(isRobot&&a.blockedTime>1.2)this.requestPassage(a,obstacle);
        if(a.blockedTime>1&&this.time>=(a.nextReplan||0)){
          const blockedTime=a.blockedTime;a.nextReplan=this.time+1.5;
          if(a.goal||a.endpoint)(isRobot&&a.state==='approach'&&a.partner?this.approach(a,a.partner):this.go(a,a.goal||a.endpoint));
          // Finding the same static route is not physical progress. Retain the
          // blocked duration so the passage request above can actually fire.
          a.blockedTime=blockedTime;
        }
      }else{
        const travelled=Math.hypot(v.x*dt,v.y*dt,v.z*dt);a.x=candidate.x;a.z=candidate.z;a.blockedTime=0;a.moving=true;
        a.distance=(a.distance||0)+travelled;if(isRobot){a.lastProgress=this.time;this.distance+=travelled;}
        const yaw=Math.atan2(v.x,v.z),delta=Math.atan2(Math.sin(yaw-a.model.rotation.y),Math.cos(yaw-a.model.rotation.y));a.model.rotation.y+=delta*Math.min(1,dt*1.8);
      }
    }
    let y=this.flightHeight(a,a.y+v.y*dt);if(y!==a.y+v.y*dt)v.y=0;
    if(this.actors().some(b=>b!==a&&Math.hypot(a.x-b.x,a.z-b.z)<a.radius+b.radius+.10&&this.flightOverlap(a,b,{y})&&!this.flightOverlap(a,b))){y=a.y;v.y=0;}
    if(isRobot&&waypoint&&Math.abs(targetY-a.y)>.055&&Math.abs(y-a.y)>.0001)a.lastProgress=this.time;a.y=y;
    if(waypoint&&Math.hypot(waypoint.x-a.x,waypoint.z-a.z)<.055&&Math.abs((waypoint.y??a.floatTargetY)-a.y)<.055){
      a.path.shift();if(!a.path.length){a.floatAnchorY=a.floatTargetY=waypoint.y??a.y;v.x=v.z=0;}if(isRobot)this.drawRoute(a);
    }
    a.phase+=dt;a.moving=a.moving||Math.abs(v.y)>.025;
    if(!isRobot)this.recordCrewTravel(a,previous,dt);
    a.model.rotation.x=clamp(-Math.hypot(v.x,v.z)*.13,-.065,0)+.015*Math.sin(this.time*.31+(a.crewIndex||0));
    a.model.rotation.z=.025*Math.sin(this.time*.37+(a.crewIndex||0)*1.9);
    if(isRobot){const yaw=a.model.rotation.y,c=Math.cos(yaw),s=Math.sin(yaw),fx=(v.x-beforeVelocity.x)/dt,fz=(v.z-beforeVelocity.z)/dt;
      a.model.userData.flightAnimation={action:a.moving?'move':['handoff','loaded'].includes(a.state)?'work':a.state==='checking'?'scan':'guard',speed:Math.hypot(v.x,v.y,v.z),thrust:{x:c*fx-s*fz,y:(v.y-beforeVelocity.y)/dt,z:s*fx+c*fz},turn:Math.atan2(Math.sin(yaw-beforeYaw),Math.cos(yaw-beforeYaw))/dt,dt};}
  };
  P.move=function(a,dt,isRobot){if(!this.world.microgravity)return original.move.call(this,a,dt,isRobot);this.advanceFlight(a,dt,isRobot);};
  P.nextCrewActivity=function(p){
    const points=this.world.activityPoints||[];
    if(this.time>=(p.nextCabinTrip||0)&&this.world.requestCrewTransfer?.(p))return;
    for(let attempt=1;attempt<=points.length;attempt++){
      const index=(p.activityIndex+attempt)%points.length,target=points[index];
      if(target.activity==='chat'&&this.people.length<2)continue;
      if(!this.go(p,target))continue;
      p.activityIndex=index;p.pendingActivity=target;p.activity='transit';p.activityState='transit';p.action='扶舱借力，漂向'+target.name;p.activityUntil=Infinity;p.tripStarted=this.time;return;
    }
    p.activityUntil=this.time+2;p.action='扶手旁等候通道空闲';
  };
  P.stepCrew=function(p,dt){
    this.initCrew(p,p.crewIndex??this.people.indexOf(p));
    if(this.world.stepCrewTransfer?.(p,dt))return;
    // Hold an ordinary trip while a nearby robot passes. Requested side-steps
    // take priority; other crew cannot repeatedly cut across that reserved gap.
    p.trafficHold=!p.cooperating&&!p.assigned&&this.robots.some(r=>{
      if(!r.path.length||Math.hypot(r.x-p.x,r.z-p.z)>=2.4)return false;
      const q=p.path[0];return !q||(q.x-p.x)*(p.x-r.x)+(q.z-p.z)*(p.z-r.z)<=.015;
    });
    if(p.cooperating){p.activity='handoff';p.action=p.assigned?'漂向机器人交接点':'扶舱侧移让行';if(this.time>p.cooperateUntil){p.cooperating=false;p.path=[];p.pendingActivity=null;p.activityUntil=this.time+2;}}
    else if(p.assigned){p.activity='handoff';p.action='悬停配合机器人交接';const robot=this.robots.find(r=>r.id===p.assigned);if(robot)p.targetAngle=Math.atan2(robot.x-p.x,robot.z-p.z);}
    else if(p.pendingActivity&&!p.path.length){
      const task=p.pendingActivity;p.pendingActivity=null;p.activity=task.activity;p.action=task.name;p.activityState='active';p.activityUntil=this.time+(task.duration||12);if(Number.isFinite(task.angle))p.targetAngle=task.angle;
      p.activityHistory.push({time:Number(this.time.toFixed(2)),activity:p.activity,name:p.action});p.activityHistory=p.activityHistory.slice(-12);
    }else if(!p.path.length&&this.time>=p.activityUntil)this.nextCrewActivity(p);
    else if(p.path.length&&this.time-p.tripStarted>35&&!p.cooperating&&!p.assigned){p.path=[];p.pendingActivity=null;p.activityUntil=this.time;}
    if(this.world.stepCrewTransfer?.(p,dt))return;
    this.advanceFlight(p,dt,false);if(!p.path.length&&Number.isFinite(p.targetAngle)){const turn=Math.atan2(Math.sin(p.targetAngle-p.model.rotation.y),Math.cos(p.targetAngle-p.model.rotation.y));p.model.rotation.y+=turn*(1-Math.exp(-dt*2.6));}this.sync(p);if(!this.deferActorVisuals)C.animateStationCrew(p.model,p.phase,p.moving,p.activity==='handoff',{activity:p.activity,speed:p.crewTravelSpeed,distance:p.crewTravelDistance});
  };
  P.sync=function(a){
    if(!this.world.microgravity)return original.sync.call(this,a);
    this.initFlight(a);a.model.position.set(a.x,a.y,a.z);
  };
  P.step=function(dt){
    original.step.call(this,dt);if(!this.world.microgravity)return;
    for(const r of this.robots){if(r._flightFrame!==this.time)this.advanceFlight(r,dt,true);this.sync(r);if(r.path.length&&this.time>=(r.nextFlightRoute||0)){this.drawRoute(r);r.nextFlightRoute=this.time+.2;}}
  };
  P.refreshFlightVisuals=function(){
    if(!this.world.microgravity||!this.flightVisualsDirty)return;
    for(const p of this.people)C.animateStationCrew(p.model,p.phase,p.moving,p.activity==='handoff',{activity:p.activity,speed:p.crewTravelSpeed,distance:p.crewTravelDistance});
    for(const r of this.robots){C.animateRobot(r.model,r.phase,r.moving,r.state==='handoff'||r.state==='loaded',this.time);if(r.flightRouteDirty)this.drawRoute(r);}
    this.flightVisualsDirty=false;
  };
  P.tick=function(dt,{visuals=true}={}){
    if(!this.world.microgravity)return original.tick.call(this,dt);
    // Keep every physics step and schedule update. Articulate only the final
    // presented state, and defer invisible cabins until they are shown again.
    const previous=this.deferActorVisuals;this.deferActorVisuals=true;
    try{original.tick.call(this,dt);}finally{this.deferActorVisuals=previous;}
    this.flightVisualsDirty=true;if(visuals)this.refreshFlightVisuals();
  };
  P.reset=function(){
    if(this.world.microgravity)for(const p of this.people)this.world.cancelCrewTransfer?.(p);
    original.reset.call(this);if(!this.world.microgravity)return;
    for(const [i,p]of this.people.entries()){p.crewInitialized=false;delete p.velocity;p.cooperating=false;p.pendingActivity=null;p.nextRequest=p.nextReplan=p.cooperateUntil=0;p.trafficHold=false;p.goal=p.endpoint=null;p.model.rotation.set(0,0,0);this.initCrew(p,p.crewIndex??i);C.animateStationCrew(p.model,0,false,false,{activity:p.activity,speed:p.crewTravelSpeed,distance:p.crewTravelDistance});}
  };
  P.report=function(){const report=original.report.call(this);if(this.world.microgravity){report.environment='microgravity';report.crew=this.people.map(p=>({id:p.id,name:p.name,activity:p.activity,action:p.action,position:{x:p.x,y:p.y,z:p.z},history:p.activityHistory}));report.robots.forEach((r,i)=>r.position.y=this.robots[i].y);}return report;};
  const animate=C.animateRobot;
  C.animateRobot=(root,phase,moving,interacting,time)=>{
    if(root.userData.stationRobot&&C.animateStationRobot)return C.animateStationRobot(root,time??phase,root.userData.flightAnimation||{action:interacting?'work':moving?'move':'guard',speed:moving?.48:0});
    if(!root.userData.microgravity)return animate(root,phase,moving,interacting,time);
    const data=root.userData,j=data.joints;
    // Keep wheels stopped and limbs tucked. These bodies translate by simulated
    // attitude/position control, never by a foot or wheel contact with the deck.
    if(data.industrialQuadruped){data.body.position.y=0;for(const leg of Object.values(data.legs)){leg.abduction.rotation.z=leg.side*.12;leg.hip.rotation.x=.65;leg.knee.rotation.x=-1.65;leg.foot.userData.stance=false;}return;}
    if(data.officialG1){
      const values={};for(const side of ['left','right'])Object.assign(values,{[side+'_hip_pitch_joint']:-.22,[side+'_knee_joint']:.48,[side+'_ankle_pitch_joint']:-.20,[side+'_shoulder_pitch_joint']:interacting?-.55:-.18,[side+'_shoulder_roll_joint']:side==='left'?.13:-.13,[side+'_elbow_joint']:interacting?.65:.38});
      for(const d of data.jointDescriptors){const node=j[d.name];if(node)node.quaternion.copy(node.userData.baseQuaternion).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(...d.axis),clamp(values[d.name]||0,d.lower,d.upper)));}data.forward.position.y=data.standingBase;return;
    }
    animate(root,0,false,interacting,time);for(const d of data.jointDescriptors||[])if(d.type==='continuous')j[d.name].rotation.set(0,0,0);
  };
})();
