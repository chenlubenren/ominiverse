/* Free capsule movement on actual floors, stair treads and the outdoor city. */
(() => {
 'use strict';const L=window.IndoorLab;
 class TowerWorld {
  constructor(tower){this.tower=tower;this.fp=tower.fp;this.outside=false;this.landed=0;}
  absoluteFeet(){return(this.tower.origin-1)*3.6+this.fp.feet;}
  contains(x,z){return Math.abs(x)<18&&Math.abs(z)<13;}
  carSurface(x,z){const t=this.tower;for(const c of t.society.lifts.cars){if(Math.abs(x-c.x)>1.23||z< -2.10||z>2.4)continue;if(t.player.location==='lift'&&t.carIndex===c.id||c.door>.95&&Math.abs(c.floor-t.origin)<.02)return(t.society.renderCar(c).floor-1)*3.6;}return null;}
  surface(x,z,feet){let best=-Infinity;const accept=h=>{if(h<=feet+.305&&h>best)best=h;};
   const car=this.carSurface(x,z);if(car!==null)return car;
   if(this.contains(x,z)){
    const lower=Math.max(0,Math.min(29,Math.floor((feet+.305)/3.6)));
    for(let floor=Math.max(0,lower-1);floor<=Math.min(29,lower+1);floor++){
     if(L.disasterDirector?.physics?.destroyedFloors.has(floor+1))continue;const base=floor*3.6;for(const[w,d,cx,cz]of L.towerSlabTiles)if(Math.abs(x-cx)<w/2&&Math.abs(z-cz)<d/2)accept(base);
     for(const s of L.TOWER.core.stairs){const sign=Math.sign(s.x),inner=s.x-sign*.98,outer=s.x+sign*.98;
      if(Math.abs(x-s.x)<2.1&&z>=-3.45&&z<=-2.19){accept(base);accept(base+3.6);}
      if(Math.abs(x-s.x)<2.04&&z>=2.04&&z<=3.41)accept(base+1.8);
      if(floor===0&&Math.abs(x-s.x)<2.1&&Math.abs(z)<3.45)accept(0);
      // A continuous support ramp follows the tops of the visible steps. The
      // capsule never alternates between free fall and a 180 mm upward snap.
      if(z>=-2.65&&z<=2.1){if(Math.abs(x-inner)<=.98)accept(base+L.clamp((z+2.6)/4.7,0,1)*1.8);if(Math.abs(x-outer)<=.98)accept(base+1.8+L.clamp((2.1-z)/4.7,0,1)*1.8);}
     }
    }
   }
   if(this.contains(x,z)&&Number.isFinite(best)&&best>=0)return best;
   // The plinth, road, islands and neighbouring buildings are physical surfaces.
   for(const b of this.tower.building.outdoorBoxes||[])if(Math.abs(x-b.x)<=b.w/2&&Math.abs(z-b.z)<=b.d/2)accept(b.y+b.h/2-.82);
   const rubble=L.disasterDirector?.physics?.surface(x,z,feet);if(Number.isFinite(rubble))accept(rubble);accept(this.tower.society.exterior.ground(x,z)-.82);
   return Number.isFinite(best)?best:-1.72;
  }
  clear(x,z,feet=this.absoluteFeet()){
   if(Math.abs(x)>320||Math.abs(z)>320||L.disasterDirector?.physics?.blocks(x,z,feet))return false;const t=this.tower,fp=this.fp,base=(t.origin-1)*3.6;
   const position=t.view.camera.position;
   const candidate=this.surface(x,z,feet),standing=candidate>feet&&candidate-feet<.305?candidate:feet,local=standing-base;
   if(t.society.bodies.blocks(t.player,x,z,standing,true,position))return false;
   if(t.player.location==='lift'){const car=t.society.lifts.cars[t.carIndex];if(car){const door=car.door>.95&&Math.abs(car.floor-Math.round(car.floor))<.015;if(Math.abs(x-car.x)<1.02&&z>-1.85&&z<1.9)return true;if(!door)return false;if(Math.abs(x-car.x)<.59&&z>1.8&&z<2.65)return true;}}
   // A visible landing is not a cabin: only board a fully open car stopped on
   // this floor. The free-world controller must honor the moving lift doors.
   if(t.player.location!=='lift'&&z<2.48&&z>-2.4)for(const c of t.society.lifts.cars)if(Math.abs(x-c.x)<1.24&&!(c.door>.95&&Math.abs(c.floor-t.origin)<.02))return false;
   if(t.player.location!=='lift'&&t.society.lifts.unavailable&&z<2.5&&z>1.7&&t.society.lifts.cars.some(c=>Math.abs(x-c.x)<1.05))return false;
   if(t.player.location!=='lift'&&z<2.5&&z>1.7&&t.society.lifts.cars.some(c=>Math.abs(c.floor-t.origin)<.02&&Math.abs(x-c.x)<.95&&c.passengers.length>=c.capacity))return false;
   if(Math.abs(x)>12&&Math.abs(z)<3.6)for(const rail of L.towerStairRails){
    const next=Math.abs(x-rail.x),previous=Math.abs(position.x-rail.x);
    if(next>=.21||next>=previous&&Math.sign(x-rail.x)===Math.sign(position.x-rail.x)||z<rail.z0-.1||z>rail.z1+.1)continue;
    const u=L.clamp((z-rail.z0)/(rail.z1-rail.z0),0,1),y=base+rail.y0+(rail.y1-rail.y0)*u;
    for(const height of [y,y-3.6])if(height<feet+(fp.bodyHeight||1.7)&&height+1.04>feet+.02)return false;
   }
   for(const s of L.TOWER.core.stairs){const y=base+1.8;
    if(feet<y+1.04&&feet+(fp.bodyHeight||1.7)>y){
     const side=Math.abs(x-s.x),oldSide=Math.abs(position.x-s.x);
     if(z>2.02&&z<3.55&&side>1.69&&side<2.13&&side>oldSide)return false;
     if(Math.abs(x-s.x)<2.14&&z>3.20&&z<3.62&&z>position.z)return false;
    }
   }
   // Open tubular handrails stop sideways entry into a raised stair flight.
   // Keep the turning platforms open across both flights.
   if(z> -2.17&&z<2.02)for(const s of L.TOWER.core.stairs){if(Math.abs(x-s.x)<2.12){const sign=Math.sign(s.x),inner=s.x-sign*.98,outer=s.x+sign*.98,base=Math.floor((feet+.03)/3.6)*3.6,ramps=[{x:inner,y:base+L.clamp((z+2.6)/4.7,0,1)*1.8},{x:outer,y:base+1.8+L.clamp((2.1-z)/4.7,0,1)*1.8}];if(ramps.some(r=>Math.abs(x-r.x)<.93&&r.y>feet+.31))return false;}}
   for(const b of fp.nearby(x,z))if(b.top>local+.045&&b.bottom<local+(fp.bodyHeight||1.8)&&fp.overlaps(b,x,z))return false;
   for(const b of t.building.outdoorBoxes||[])if(b.h>.3&&b.y+b.h/2-.82>standing+.305&&b.y-b.h/2-.82<standing+(fp.bodyHeight||1.8)&&Math.abs(x-b.x)<b.w/2+.24&&Math.abs(z-b.z)<b.d/2+.24){const current=t.view.camera.position,oldPen=Math.min(b.w/2+.24-Math.abs(current.x-b.x),b.d/2+.24-Math.abs(current.z-b.z)),newPen=Math.min(b.w/2+.24-Math.abs(x-b.x),b.d/2+.24-Math.abs(z-b.z));if(oldPen>0&&newPen<oldPen-.000001)continue;return false;}
   return !t.combat?.physics?.blocks(x,z,local);
  }
  update(dt){const t=this.tower,fp=this.fp,v=t.view,p=v.camera.position;fp.buildColliders();if(t.player.location==='lift'){const c=t.society.lifts.cars[t.carIndex],y=(t.society.renderCar(c).floor-1)*3.6;if(this.rideY!==undefined)fp.feet+=y-this.rideY;this.rideY=y;}const input=fp.prepare(dt),steps=Math.max(1,Math.ceil(fp.speed*dt/.045)),dx=fp.velocity.x*dt/steps,dz=fp.velocity.y*dt/steps;let feet=this.absoluteFeet();
   for(let i=0;i<steps;i++){
    // Re-establish the actual floor's colliders before approaching a facade
    // from outside. Holding the fall's render origin must not bypass windows.
    const edgeDistance=(x,z)=>Math.max(0,Math.abs(x)-18)**2+Math.max(0,Math.abs(z)-13)**2;
    if(this.outside&&t.player.location!=='lift'&&Math.abs(p.x+dx)<18.5&&Math.abs(p.z+dz)<13.5&&edgeDistance(p.x+dx,p.z+dz)<edgeDistance(p.x,p.z)-1e-9){
     const contextFloor=L.clamp(Math.floor((feet+.03)/3.6)+1,1,30);
     if(contextFloor!==t.origin){const delta=(t.origin-contextFloor)*3.6;t.switchFloor(contextFloor,true);fp.feet+=delta;fp.buildColliders();}
    }
    if(this.clear(p.x+dx,p.z+dz,feet)){p.x+=dx;p.z+=dz;}else{if(this.clear(p.x+dx,p.z,feet))p.x+=dx;else fp.velocity.x=0;if(this.clear(p.x,p.z+dz,feet))p.z+=dz;else fp.velocity.y=0;}
    const h=this.surface(p.x,p.z,feet);if(fp.grounded&&h-feet<=.305&&h-feet>=-.305){feet=h;fp.feet=feet-(t.origin-1)*3.6;}
   }
   let support=this.surface(p.x,p.z,feet);for(const b of fp.nearby(p.x,p.z))if(b.top+(t.origin-1)*3.6<=feet+.08&&b.top+(t.origin-1)*3.6>support&&fp.overlaps(b,p.x,p.z,.12))support=b.top+(t.origin-1)*3.6;
   const wasGrounded=fp.grounded,speed=fp.verticalSpeed;fp.vertical(dt,support-(t.origin-1)*3.6);feet=this.absoluteFeet();
   if(!wasGrounded&&fp.grounded&&speed< -6){fp.landing=Math.min(.23,Math.abs(speed)*.012);if(t.combat){t.combat.shake=Math.min(.1,Math.abs(speed)*.003);t.combat.sound('solid');}this.landed++;t.player.action=speed< -12?'坠落落地，正在恢复':'落地';this.recoverUntil=performance.now()+Math.min(1100,Math.abs(speed)*22);}
   this.outside=!this.contains(p.x,p.z);
   // Keep one coordinate frame during an exterior fall. There is no indoor
   // collision context to change until landing or re-entering the building.
   const floor=Math.max(1,Math.min(30,Math.floor((feet+.03)/3.6)+1));if(t.player.location!=='lift'&&floor!==t.origin&&(!this.outside||fp.grounded)){const delta=(t.origin-floor)*3.6;t.switchFloor(floor,true);fp.feet+=delta;}
   if(t.player.location!=='lift'&&!t.stair){t.player.location=this.outside?'outside':'floor';if(!this.outside&&t.player.health==='escaped')t.player.health='healthy';}
   fp.animate(dt,input);p.y=(fp.eyeHeight||1.65)+fp.feet+fp.bob-fp.landing;if(performance.now()<this.recoverUntil)p.y-=.10;fp.look();fp.refreshHUD();
  }
 }
 L.TowerWorld=TowerWorld;
})();
