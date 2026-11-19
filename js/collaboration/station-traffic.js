/* Shared hatch traffic between cabin-local simulations. Crew keep one identity. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  class StationTraffic {
    constructor(station){this.station=station;this.entries=new Map();this.reservations=new Map();this.doors=new Map();this.stats={requested:0,started:0,completed:0,rejected:0,blocked:0};this.time=0;}
    context(id){return this.station.contextFor(id);}
    door(a,b){
      const key=[a,b].sort().join(':');let door=this.doors.get(key);
      if(!door){
        const ah=this.station.getRoom(a).hatches.find(h=>h.id===b),bh=this.station.getRoom(b).hatches.find(h=>h.id===a);if(!ah||!bh)return null;
        door={key,a,b,hatches:[ah,bh],manualOpen:false,holds:new Set(),fraction:0,entry:null};this.doors.set(key,door);
        for(const h of door.hatches){h.sharedDoor=door;h.open=0;h.fraction=0;h.frame.traverse(o=>{if(o.isMesh)o.userData.hatch=h.id;});}
      }
      return door;
    }
    initialize(){for(const m of C.stationModules)for(const id of m.links)this.door(m.id,id);}
    point(h,inset=.95){const yaw=h.frame.rotation.y;return{x:h.x+Math.sin(yaw)*inset,z:h.z+Math.cos(yaw)*inset,y:.32};}
    occupancy(id){return this.context(id).sim.people.length+(this.reservations.get(id)?.size||0);}
    owns(p){return !!p.stationTransfer&&this.entries.get(p.id)===p.stationTransfer;}
    available(sourceId,targetId,p){
      if(!p||p.assigned||p.cooperating||this.owns(p)||!C.stationModule(sourceId)?.links.includes(targetId))return false;
      const door=this.door(sourceId,targetId);return !!door&&!door.entry&&this.occupancy(targetId)<2;
    }
    route(sim,p,target){
      const route=sim.plan(p,target);if(!route)return false;
      const end=route.path.at(-1)||p;
      if(distance(end,target)>.025){if(!sim.segmentClear(p,target,end))return false;route.path.push({...target});}
      p.path=route.path;p.goal={...target};p.endpoint={...target};p.blockedTime=0;sim.prepareFlightRoute(p,target);return true;
    }
    request(sourceId,p,preferred){
      this.stats.requested++;if(!p||p.assigned||p.cooperating||this.owns(p))return false;
      const source=this.context(sourceId).sim;if(!source.people.includes(p))return false;
      const links=C.stationModule(sourceId).links,ordered=preferred?[preferred]:[...links].sort((a,b)=>{
        const visits=p.cabinVisits||{};return (visits[a]||0)-(visits[b]||0)||this.occupancy(a)-this.occupancy(b)||((links.indexOf(a)+p.crewIndex)%links.length)-((links.indexOf(b)+p.crewIndex)%links.length);
      });
      for(const targetId of ordered){
        if(!this.available(sourceId,targetId,p))continue;
        const target=this.context(targetId).sim,sourceHatch=source.world.hatches.find(h=>h.id===targetId),targetHatch=target.world.hatches.find(h=>h.id===sourceId),approach=this.point(sourceHatch),arrival=this.point(targetHatch,1.25);
        if(!source.grid.isClear(approach.x,approach.z,p.radius+.02)||!target.grid.isClear(arrival.x,arrival.z,p.radius+.02)||!this.route(source,p,approach))continue;
        const door=this.door(sourceId,targetId),entry={person:p,sourceId,targetId,sourceHatch,targetHatch,approach,arrival,door,state:'to-door',started:this.time,lastProgress:this.time,lastPosition:{x:p.x,z:p.z},crossed:false};
        this.entries.set(p.id,entry);door.entry=entry;
        if(!this.reservations.has(targetId))this.reservations.set(targetId,new Set());this.reservations.get(targetId).add(p.id);
        p.stationTransfer=entry;p.pendingTransfer=null;p.pendingActivity=null;p.trafficHold=false;p.activity='transit';p.activityState='transit';p.action='前往舱门 · '+C.stationModule(targetId).name;p.activityUntil=Infinity;this.stats.started++;return true;
      }
      this.stats.rejected++;return false;
    }
    setOpen(a,b,open){const door=this.door(a,b);if(!door)return false;door.manualOpen=!!open;this.syncDoor(door,0);return true;}
    toggle(a,b){const door=this.door(a,b);return door?this.setOpen(a,b,!door.manualOpen):false;}
    hold(a,b,token){const door=this.door(a,b);if(door)door.holds.add(token);return door;}
    release(a,b,token){this.door(a,b)?.holds.delete(token);}
    nearDoor(door){
      return [door.a,door.b].some(id=>{
        const sim=this.context(id).sim,h=sim.world.hatches.find(h=>h.sharedDoor===door);
        return sim.actors().some(p=>distance(p,h)<.82);
      });
    }
    syncDoor(door,dt){
      const open=door.manualOpen||door.holds.size>0||(door.fraction>.03&&this.nearDoor(door));
      door.fraction=T.MathUtils.clamp(door.fraction+(open?1:-1)*dt*1.8,0,1);
      for(const h of door.hatches){h.open=open?1:0;h.fraction=door.fraction;h.leaf.position.x=door.fraction*1.58;}
    }
    updateDoors(dt){for(const door of this.doors.values())this.syncDoor(door,Math.max(0,dt));}
    corridorClear(sim,p,point){
      if(sim.actors().some(other=>other!==p&&distance(point,other)<p.radius+other.radius+.1))return false;
      return !(sim.world.colliders||[]).some(b=>{
        if(b.ignore||p.y>b.y+b.h/2||p.y+sim.actorHeight(p)<b.y-b.h/2)return false;
        const c=Math.cos(b.rotation||0),s=Math.sin(b.rotation||0),dx=point.x-b.x,dz=point.z-b.z;
        return Math.max(Math.abs(dx*c-dz*s)-b.w/2,0)**2+Math.max(Math.abs(dx*s+dz*c)-b.d/2,0)**2<(p.radius+.025)**2;
      });
    }
    moveCorridor(entry,sim,target,dt){
      const p=entry.person,previous={x:p.x,y:p.y,z:p.z},d=distance(p,target),step=Math.min(d,.4*dt),point=d?{x:p.x+(target.x-p.x)*step/d,z:p.z+(target.z-p.z)*step/d}:{x:p.x,z:p.z};
      p.moving=false;p.crewTravelSpeed=0;p.phase+=dt;
      if(!this.corridorClear(sim,p,point)){p.action='舱门已打开 · 等候通道空闲';this.stats.blocked++;return false;}
      if(step){const yaw=Math.atan2(target.x-p.x,target.z-p.z),turn=Math.atan2(Math.sin(yaw-p.model.rotation.y),Math.cos(yaw-p.model.rotation.y));p.model.rotation.y+=T.MathUtils.clamp(turn,-dt*1.8,dt*1.8);p.x=point.x;p.z=point.z;p.moving=true;entry.lastProgress=this.time;}
      p.y=T.MathUtils.lerp(p.y,sim.flightHeight(p,.32),Math.min(1,dt*3));p.floatTargetY=p.floatAnchorY=p.y;p.velocity.x=p.velocity.y=p.velocity.z=0;
      sim.recordCrewTravel(p,previous,dt);
      return d<=.012;
    }
    migrate(entry){
      const p=entry.person,source=this.context(entry.sourceId).sim,target=this.context(entry.targetId).sim,index=source.people.indexOf(p);
      if(index<0||target.people.includes(p)||target.people.length>=2)return false;
      // Rebase only at the shared aperture. The next steps carry this same
      // object from the destination aperture into its own navigation volume.
      if(distance(p,entry.sourceHatch)>.035)return false;
      source.people.splice(index,1);target.people.push(p);target.group.add(p.model);this.reservations.get(entry.targetId)?.delete(p.id);
      p.x=entry.targetHatch.x;p.z=entry.targetHatch.z;p.y=target.flightHeight(p,.32);p.currentCabin=entry.targetId;p.path=[];p.goal=p.endpoint=null;p.velocity.x=p.velocity.y=p.velocity.z=0;p.floatTargetY=p.floatAnchorY=p.y;
      p.action='通过舱门 · 进入'+target.world.spec.name;p.cabinVisits??={};p.cabinVisits[entry.targetId]=(p.cabinVisits[entry.targetId]||0)+1;p.cabinHistory??=[];p.cabinHistory.push({from:entry.sourceId,to:entry.targetId,time:Number(this.time.toFixed(2))});p.cabinHistory=p.cabinHistory.slice(-24);
      entry.crossed=true;entry.state='to-room';entry.lastProgress=this.time;target.sync(p);source.flightVisualsDirty=target.flightVisualsDirty=true;return true;
    }
    finish(entry,cancelled=false){
      const p=entry.person,sim=this.context(entry.crossed?entry.targetId:entry.sourceId).sim;
      this.reservations.get(entry.targetId)?.delete(p.id);entry.door.holds.delete(p.id);if(entry.door.entry===entry)entry.door.entry=null;this.entries.delete(p.id);delete p.stationTransfer;
      p.path=[];p.goal=p.endpoint=null;p.pendingTransfer=null;p.pendingActivity=null;p.activity='observe';p.activityState='active';p.action=cancelled?'扶手旁调整路线':'抵达'+sim.world.spec.name+'，准备下一项工作';p.activityUntil=sim.time+(cancelled?3:2.5);p.nextCabinTrip=sim.time+22;p.velocity.x=p.velocity.y=p.velocity.z=0;p.crewTravelSpeed=0;p.moving=false;
      if(!cancelled){this.stats.completed++;this.station.crewTransfers=(this.station.crewTransfers||0)+1;p.activityHistory.push({time:Number(sim.time.toFixed(2)),activity:'transfer',name:p.action});p.activityHistory=p.activityHistory.slice(-12);}
    }
    cancel(p){const entry=this.entries.get(p.id);if(!entry)return false;this.finish(entry,true);return true;}
    step(entry,dt){
      const p=entry.person,sim=this.context(entry.crossed?entry.targetId:entry.sourceId).sim;
      if(!entry.crossed&&(p.assigned||p.cooperating)){this.finish(entry,true);return;}
      if(entry.state==='to-door'){
        p.trafficHold=false;sim.advanceFlight(p,dt,false);
        if(distance(p,entry.lastPosition)>.01){entry.lastProgress=this.time;entry.lastPosition={x:p.x,z:p.z};}
        if(!p.path.length){
          if(distance(p,entry.approach)>.16){if(!this.route(sim,p,entry.approach)){this.finish(entry,true);return;}}
          else{entry.state='door-open';entry.door.holds.add(p.id);p.action='开启舱门 · 等待门扇完全打开';p.velocity.x=p.velocity.z=0;}
        }
        if(this.time-entry.lastProgress>14){this.finish(entry,true);return;}
      }else if(entry.state==='door-open'){
        p.phase+=dt;p.moving=false;p.crewTravelSpeed=0;p.velocity.x=p.velocity.z=0;
        const target=this.context(entry.targetId).sim;
        if(entry.door.fraction>=.98&&this.corridorClear(target,p,entry.targetHatch)&&this.corridorClear(target,p,entry.arrival)){entry.state='crossing';p.action='扶住门框 · 穿过舱门';entry.lastProgress=this.time;}
        else if(this.time-entry.lastProgress>18){this.finish(entry,true);return;}
      }else if(entry.state==='crossing'){
        if(this.moveCorridor(entry,sim,entry.sourceHatch,dt))this.migrate(entry);
      }else if(entry.state==='to-room'){
        if(this.moveCorridor(entry,sim,entry.arrival,dt))this.finish(entry);
      }
      const current=this.context(p.currentCabin||entry.sourceId).sim;current.sync(p);current.flightVisualsDirty=true;
    }
    update(dt){
      let remaining=Math.max(0,Math.min(dt,.4));
      while(remaining>0){const step=Math.min(remaining,.05);this.time+=step;this.updateDoors(step);for(const entry of [...this.entries.values()])this.step(entry,step);remaining-=step;}
      for(const m of C.stationModules){const sim=this.context(m.id).sim;if(sim.world.root.visible)sim.refreshFlightVisuals?.();}
    }
  }
  C.StationTraffic=StationTraffic;
})();
