/* City-wide, continuous dragon flight. The articulated torso follows velocity;
 * the source model supplies flapping, membranes, neck, legs and tail motion. */
(() => {
 'use strict';const L=window.IndoorLab,T=THREE,up=new T.Vector3(0,1,0),zAxis=new T.Vector3(0,0,1),clamp=L.clamp;
 function random(f){f.seed=(Math.imul(f.seed,1664525)+1013904223)>>>0;return f.seed/4294967296;}
 function obstacles(fleet){const source=fleet.b.outdoorBoxes,key=(fleet.b.matrixEpoch||0)+':'+source.length;if(fleet.flightObstacleSource!==source||fleet.flightObstacleKey!==key){fleet.flightObstacleSource=source;fleet.flightObstacleKey=key;fleet.flightObstacles=[{x:0,z:0,w:36,d:26,roof:112},...source.filter(b=>b.h>3).map(b=>({x:b.x,z:b.z,w:b.w,d:b.d,roof:b.y+b.h/2-.82}))];}return fleet.flightObstacles;}
 function roofAt(boxes,p,margin){let roof=0;for(const b of boxes)if(Math.abs(p.x-b.x)<b.w/2+margin&&Math.abs(p.z-b.z)<b.d/2+margin)roof=Math.max(roof,b.roof);return roof;}
 function clearSegment(boxes,from,to,margin){
  for(let i=0;i<=18;i++){const p=from.clone().lerp(to,i/18);for(const b of boxes)if(p.y<b.roof+6&&Math.abs(p.x-b.x)<b.w/2+margin&&Math.abs(p.z-b.z)<b.d/2+margin)return false;}return true;
 }
 function chooseGoal(r,f,boxes){
  const margin=Math.min(r.reach,32)+3;let candidate;
  for(let n=0;n<36;n++){
   candidate=new T.Vector3((random(f)-.5)*330,26+random(f)*112,(random(f)-.5)*330);
   const delta=candidate.clone().sub(r.position),distance=delta.length();if(distance<48||distance>210)continue;
   if(f.velocity.lengthSq()>1&&delta.clone().setY(0).normalize().dot(f.velocity.clone().setY(0).normalize())<-.45)continue;
   if(clearSegment(boxes,r.position,candidate,margin)){f.goal=candidate;f.nextGoal=r.elapsed+10+random(f)*8;f.routes++;return;}
  }
  // If a low-altitude street is blocked, first climb along its free side.
  const forward=f.velocity.clone().setY(0);if(forward.lengthSq()<.1)forward.set(Math.cos(r.angle),0,Math.sin(r.angle));forward.normalize();
  candidate=r.position.clone().addScaledVector(forward,48);candidate.x=clamp(candidate.x,-165,165);candidate.z=clamp(candidate.z,-165,165);candidate.y=Math.min(148,Math.max(r.position.y+20,roofAt(boxes,candidate,margin)+9));f.goal=candidate;f.nextGoal=r.elapsed+5;f.routes++;
 }
 function align(r,f,dir){
  const forward=dir.clone().normalize(),right=new T.Vector3().crossVectors(up,forward).normalize(),vertical=new T.Vector3().crossVectors(forward,right),q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(right,vertical,forward));
  q.multiply(new T.Quaternion().setFromAxisAngle(zAxis,f.bank));
  // The native body leans during its wing beat. Remove only that presentation
  // offset from the carrier so its real +Z axis still points along flight.
  q.multiply(r.rig.native.parts.body.quaternion.clone().invert());r.quaternion.copy(q);f.heading.copy(forward);
 }
 function initialize(fleet,r,boxes){
  if(!r.flightInitialized){r.position.set(Math.cos(r.angle)*r.radius,r.altitude,Math.sin(r.angle)*r.radius);r.position.y=Math.max(r.position.y,roofAt(boxes,r.position,Math.min(r.reach,32)+3)+9);r.flightInitialized=true;}
  const direction=new T.Vector3(-Math.sin(r.angle),0,Math.cos(r.angle)),f=r.flight={seed:(r.id*2654435761)>>>0,velocity:direction.multiplyScalar(10),heading:new T.Vector3(),bank:0,goal:null,nextGoal:0,routes:0};chooseGoal(r,f,boxes);align(r,f,f.velocity);return f;
 }
 function departure(fleet,r,dt,boxes){const d=r.returning;
  if(!d.normal){d.normal=Math.abs(r.position.x/18)>Math.abs(r.position.z/13)?new T.Vector3(Math.sign(r.position.x),0,0):new T.Vector3(0,0,Math.sign(r.position.z));d.end=d.from.clone().addScaledVector(d.normal,Math.max(8,(d.normal.x?18:13)+r.reach+8-d.from.dot(d.normal)));d.end.y=Math.max(d.from.y,roofAt(boxes,d.end,Math.min(r.reach,32)+3)+8);d.sourceBody=r.rig.native.parts.body.quaternion.clone();}
  const age=r.elapsed-d.at;
  if(age<3){r.position.lerpVectors(d.from,d.end,L.MegastructureMotion.smooth(age/3));r.quaternion.copy(d.rotation);r.state='后撤脱离幕墙';L.MegastructureMotion.mouthPose(r,0);return true;}
  const out=d.normal.clone(),f=r.flight??={seed:(r.id*2654435761)>>>0,velocity:out.clone().multiplyScalar(10),heading:out.clone(),bank:0,goal:null,nextGoal:0,routes:0};
  r.position.copy(d.end);align(r,f,out);const goal=r.quaternion.clone();r.quaternion.copy(d.rotation).slerp(goal,L.MegastructureMotion.smooth((age-3)/1.1));r.state='悬停转向';
  if(age<4.1)return true;r.returning=null;chooseGoal(r,f,boxes);return false;
 }
 function step(fleet,r,dt){const boxes=obstacles(fleet);
  if(r.returning&&departure(fleet,r,dt,boxes))return;
  const f=r.flight||initialize(fleet,r,boxes);if(!dt)return;
  if(!f.goal||r.position.distanceTo(f.goal)<20||r.elapsed>=f.nextGoal)chooseGoal(r,f,boxes);
  const desired=f.goal.clone().sub(r.position).normalize(),margin=Math.min(r.reach,32)+3;let clearance=Infinity;
  for(const b of boxes){if(r.position.y<b.roof+7){const dx=Math.max(0,Math.abs(r.position.x-b.x)-b.w/2),dz=Math.max(0,Math.abs(r.position.z-b.z)-b.d/2);clearance=Math.min(clearance,Math.hypot(dx,dz));}
   let threatened=false;for(let n=1;n<=6;n++){const t=n*.75;if(r.position.y+f.velocity.y*t<b.roof+7&&Math.abs(r.position.x+f.velocity.x*t-b.x)<b.w/2+margin&&Math.abs(r.position.z+f.velocity.z*t-b.z)<b.d/2+margin){threatened=true;break;}}if(!threatened)continue;
   const away=new T.Vector3(r.position.x-clamp(r.position.x,b.x-b.w/2,b.x+b.w/2),0,r.position.z-clamp(r.position.z,b.z-b.d/2,b.z+b.d/2));
   if(away.lengthSq()<.1)away.set(r.position.x-b.x,0,r.position.z-b.z);if(away.lengthSq()<.1)away.set(1,0,0);away.normalize();
   const tangent=new T.Vector3(-away.z,0,away.x);if(tangent.dot(f.velocity)<0)tangent.negate();desired.addScaledVector(away,2.8).addScaledVector(tangent,1.8);desired.y=Math.max(desired.y,.22);
  }
  if(Math.abs(r.position.x)>168||Math.abs(r.position.z)>168)desired.add(new T.Vector3(-r.position.x/90,0,-r.position.z/90));
  desired.normalize();const rise=clamp(desired.y,-.32,.32);desired.setY(0);if(desired.lengthSq()<.001)desired.copy(f.velocity).setY(0);desired.normalize().multiplyScalar(Math.sqrt(1-rise*rise));desired.y=rise;
  // Steer yaw and pitch independently. A shortest 3D quaternion turn between
  // two rising headings can otherwise make a U-turn climb almost vertically.
  const old=f.velocity.clone().normalize(),oldYaw=Math.atan2(old.x,old.z),goalYaw=Math.atan2(desired.x,desired.z),yawError=Math.atan2(Math.sin(goalYaw-oldYaw),Math.cos(goalYaw-oldYaw)),nextYaw=oldYaw+clamp(yawError,-dt*.26,dt*.26),oldPitch=Math.asin(clamp(old.y,-1,1)),pitch=oldPitch+clamp(Math.asin(desired.y)-oldPitch,-dt*.13,dt*.13),direction=new T.Vector3(Math.sin(nextYaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(nextYaw)*Math.cos(pitch)),speed=(11.5+1.5*Math.sin(r.elapsed*.17+r.id))*clamp((clearance-margin+5)/24,.28,1);
  f.velocity.copy(direction).multiplyScalar(speed);const delta=f.velocity.clone().multiplyScalar(dt);r.position.add(delta);r.distance+=delta.length();
  const yaw=Math.atan2(old.z*direction.x-old.x*direction.z,old.x*direction.x+old.z*direction.z)/Math.max(dt,1e-5),bank=clamp(-yaw*1.5,-.38,.38);f.bank+=(bank-f.bank)*(1-Math.exp(-dt*3));align(r,f,delta);r.state='城市自由飞行 · 转弯与升降';
 }
 L.MegastructureFlight={step};
})();
