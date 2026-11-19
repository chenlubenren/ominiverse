/* Contact poses for the articulated models supplied in 科幻机器人.html.
 * Crawling uses fixed substrate anchors and a bounded FABRIK solve. See
 * docs/巨构机器人与外立面攻击.md for research/code references. */
(() => {
 'use strict';const L=window.IndoorLab,T=THREE,up=new T.Vector3(0,1,0),unitZ=new T.Vector3(0,0,1);
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 function prepareArms(native){for(const a of native.parts.arms){if(a.tip)continue;const last=a.links.at(-1);a.tip=new T.Object3D();a.tip.position.y=.42*last.s;last.j.add(a.tip);a.lengths=a.links.map(l=>.42*l.s);a.points=[];}}
 function solveArm(arm,target){
  const links=arm.links,base=links[0].j.getWorldPosition(new T.Vector3()),lengths=arm.lengths,total=lengths.reduce((a,b)=>a+b,0),end=target.clone(),delta=end.clone().sub(base),distance=delta.length();
  if(distance>total*.995)end.copy(base).addScaledVector(delta,total*.995/distance);const surface=Math.min(.035,end.y);
  // A consistent bend toward the free side prevents flips and wall penetration.
  const points=arm.points;for(let i=0;i<=links.length;i++){const t=i/links.length;points[i]??=new T.Vector3();points[i].lerpVectors(base,end,t);points[i].y+=Math.sin(Math.PI*t)*Math.min(1.3,total*.22);}
  for(let pass=0;pass<48;pass++){
   points.at(-1).copy(end);
   for(let i=links.length-1;i>=0;i--){delta.copy(points[i]).sub(points[i+1]).normalize();points[i].copy(points[i+1]).addScaledVector(delta,lengths[i]);}
   points[0].copy(base);
   for(let i=1;i<points.length;i++){delta.copy(points[i]).sub(points[i-1]).normalize();points[i].copy(points[i-1]).addScaledVector(delta,lengths[i-1]);if(points[i].y<surface)points[i].y=surface;}
   if(points.at(-1).distanceToSquared(end)<1e-7)break;
  }
  // Each following joint query refreshes its ancestor chain. Updating every
  // descendant after every joint would repeat the same work quadratically.
  for(let i=0;i<links.length;i++){
   const j=links[i].j,y=points[i+1].clone().sub(points[i]).normalize(),z=new T.Vector3(0,-1,0).addScaledVector(y,y.y);
   if(z.lengthSq()<.001)z.set(Math.sin(arm.a),0,Math.cos(arm.a));z.normalize();const x=new T.Vector3().crossVectors(y,z).normalize();z.crossVectors(x,y).normalize();
   const q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z)),parent=j.parent.getWorldQuaternion(new T.Quaternion()).invert();j.quaternion.copy(parent.multiply(q));j.updateWorldMatrix(false,false);
  }
  arm.error=arm.tip.getWorldPosition(new T.Vector3()).distanceTo(target);
 }
 function crawlRest(native){
  prepareArms(native);const p=native.parts;p.carrier.position.set(0,0,0);p.carrier.quaternion.identity();p.body.position.set(0,2.5,0);p.body.rotation.set(0,0,0);p.body.scale.setScalar(1);native.focus.set(0,0,0);
  for(const a of p.arms){a.yaw.rotation.set(0,a.a,0);a.pitch.rotation.set(0,0,0);a.roll.rotation.set(0,0,0);}
  native.scene.updateMatrixWorld(true);
  for(const a of p.arms)solveArm(a,new T.Vector3(Math.sin(a.a)*3.9,.10,Math.cos(a.a)*3.9));native.commitPose();
 }
 // CCD acts on the original joints; hydraulic rods/cables are uploaded afterward.
 function aim(joints,tip,offset,target){
  const at=()=>{tip.updateWorldMatrix(true,false);return tip.localToWorld(offset.clone());};
  for(let pass=0;pass<18;pass++){
   for(let i=joints.length-1;i>=0;i--){const j=joints[i],origin=j.getWorldPosition(new T.Vector3()),a=at().sub(origin).normalize(),b=target.clone().sub(origin).normalize();if(a.lengthSq()<.5||b.lengthSq()<.5)continue;
    const turn=new T.Quaternion().setFromUnitVectors(a,b),angle=2*Math.acos(Math.min(1,Math.abs(turn.w)));if(angle>.32)turn.identity().slerp(new T.Quaternion().setFromUnitVectors(a,b),.32/angle);
    const world=j.getWorldQuaternion(new T.Quaternion()).premultiply(turn),parent=j.parent.getWorldQuaternion(new T.Quaternion()).invert();j.quaternion.copy(parent.multiply(world));j.updateWorldMatrix(false,false);
   }
   if(at().distanceToSquared(target)<.00001)break;
  }
 }
 function effector(r,index=0){const p=r.rig.native.parts;
  if(r.type==='dragon')return {object:p.head,offset:new T.Vector3(0,-.16,2.36),radius:.25*r.rig.scale,label:'嘴部'};
  if(r.type==='serpent')return {object:p.head,offset:new T.Vector3(0,-.15,2.33),radius:.20*r.rig.scale,label:'嘴部'};
  if(r.type==='octopus')return {object:p.arms[index%8].tip,offset:new T.Vector3(),radius:.075*r.rig.scale,label:'触手 '+(index%8+1)};
  if(r.type==='titan')return {object:p.arms[index%2].wrist,offset:new T.Vector3(0,0,9),radius:1.5*r.rig.scale,label:index%2?'左手':'右手'};
  return {object:p.legs[index%2].foot,offset:new T.Vector3(0,-p.footDepth,0),radius:.30*r.rig.scale,label:'前足 '+(index%2+1)};
 }
 function mouthPose(r,amount){r.rig.edit(native=>{const p=native.parts;if(r.type==='dragon'){p.carrier.rotation.set(0,0,0);p.body.rotation.x=0;for(let i=0;i<p.neck.length;i++){p.neck[i].rotation.x=.035-Math.sin(Math.PI*amount)*.025;p.neck[i].rotation.y=0;}p.head.rotation.set(.04*(1-amount),0,0);p.jaw.rotation.x=.12+.62*Math.sin(Math.PI*Math.min(1,amount+.10));
    // Brake beside the facade with the fingers and membranes swept behind the
    // neck. The original broad flapping flight remains in patrol mode.
    for(const wing of p.wings){wing.sh1.rotation.z=.28+.07*Math.sin(r.elapsed*5);wing.sh2.rotation.y=.65;wing.sh3.rotation.x=0;wing.el.rotation.set(0,.35,0);wing.wrist.rotation.set(0,.25,0);for(const f of wing.fingers){f.base.rotation.set(0,.10+f.fi*.18,0);f.j2.rotation.set(0,.18,0);}}
   }
   else{p.jaw.rotation.x=.12+.58*Math.sin(Math.PI*amount);if(r.mode==='climb'){
    // Bend the anterior body toward the substrate, keeping the rest of the
    // long body on its exterior supports. A translated mouth must never drag
    // the entire snake through the tower.
    p.head.position.y=.85;p.head.rotation.set(Math.PI/2-.12*(1-amount),0,0);
    for(let i=0;i<12;i++){const part=p.segments[i].o;part.position.y=T.MathUtils.lerp(.85,part.position.y,smooth(i/12));}
    for(let i=0;i<11;i++){const part=p.segments[i].o,front=i?p.segments[i-1].o.position:p.head.position,back=p.segments[i+1].o.position,z=front.clone().sub(back).normalize(),x=new T.Vector3().crossVectors(up,z).normalize(),y=new T.Vector3().crossVectors(z,x);part.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));}
   }else p.head.rotation.x+=Math.sin(Math.PI*amount)*.24;}
  });}
 function limbPose(r,index,worldTarget){const target=r.rig.sourcePoint(worldTarget);r.rig.edit(native=>{const p=native.parts;
   if(r.type==='titan'){const a=p.arms[index%2];a.fingers.forEach(f=>f.forEach((j,k)=>j.rotation.x=1.05+k*.16));aim([a.sh,a.shR,a.el,a.wrist],a.wrist,new T.Vector3(0,0,9),target);}
   else if(r.type==='spider'){const a=p.legs[index%2];aim([a.coxa,a.femur,a.tibia,a.foot],a.foot,new T.Vector3(0,-p.footDepth,0),target);}
  });}
 // Refresh this joint's ancestor chain. Full descendant refreshes are retained
 // by pose commits and rendering, outside individual coordinate queries.
 function point(r,e){e.object.updateWorldMatrix(true,false);const p=e.object.localToWorld(e.offset.clone());p.sub(L.megastructureFleet.group.position);return p;}
 L.MegastructureMotion={smooth,solveArm,crawlRest,effector,mouthPose,limbPose,point};
})();
