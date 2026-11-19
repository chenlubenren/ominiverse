/* Film acting: world-space eye lines and measurable hand contact with real props. */
(() => {
  'use strict';
  const C=window.CoScene,L=window.IndoorLab,T=THREE,clamp=T.MathUtils.clamp,states=new WeakMap(),nativeRigs=new WeakMap(),headRestQuaternions=new WeakMap();
  const vector=value=>value?.isVector3?value.clone():Array.isArray(value)?new T.Vector3(...value):value&&Number.isFinite(value.x)?new T.Vector3(value.x,value.y,value.z):null;
  const targetOf=value=>vector(value?.position||value?.point||value);
  const activities={idle:'observe',listen:'observe',nod:'observe',weak:'rest',unresponsive:'rest',faint:'rest',cough:'rest',reach:'handoff',press:'operate',grip:'handoff',steady:'rest',float:'observe',beckon:'talk'};
  function restHeadRotation(motion){
    if(headRestQuaternions.has(motion))return headRestQuaternions.get(motion);
    const q=new T.Quaternion();for(let node=motion.rig.head;node;node=node.parent){const rest=motion.rest.find(r=>r.b===node);q.premultiply(rest?.q||node.quaternion);}
    headRestQuaternions.set(motion,q);return q;
  }
  function nativeRig(root){
    if(nativeRigs.has(root))return nativeRigs.get(root);
    const rig=root.userData.stationRig,index=Math.round((root.userData.stationMotionSeed||0)/.47),h=root.userData.height/1.789,b=.98+(index%2)*.02,out={};
    for(const [side,sign]of [['left',-1],['right',1]]){
      const upper=rig[side+'Arm'],lower=rig[side+'ForeArm'];if(!upper||!lower)continue;
      const shoulder=upper.position.clone().add(rig.torso.position).add(rig.hips.position),elbow=shoulder.clone().add(lower.position),wrist=new T.Vector3(sign*.197*b,.82*h,0),lowerAxis=wrist.sub(elbow);
      out[side]={upper,lower,upperAxis:lower.position.clone().normalize(),lowerAxis:lowerAxis.clone().normalize(),upperLength:lower.position.length(),lowerLength:lowerAxis.length()};
    }
    nativeRigs.set(root,out);return out;
  }
  function worldRotation(bone,q){bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));bone.updateWorldMatrix(false,true);}
  function nativeArm(root,side,goal){
    const r=nativeRig(root)[side];if(!r)return;const sign=side==='left'?-1:1,origin=root.worldToLocal(r.upper.getWorldPosition(new T.Vector3())),local=root.worldToLocal(goal.clone());
    const solution=L.AnatomyIK.solve(origin,local,{x:sign*.38,y:-.8,z:-.35},r.upperLength,r.lowerLength,.985);
    const aim=(bone,axis,direction)=>{const q=bone.getWorldQuaternion(new T.Quaternion()),from=axis.clone().applyQuaternion(q),to=direction.transformDirection(root.matrixWorld);q.premultiply(new T.Quaternion().setFromUnitVectors(from,to));worldRotation(bone,q);};
    aim(r.upper,r.upperAxis,new T.Vector3(solution.elbow.x-origin.x,solution.elbow.y-origin.y,solution.elbow.z-origin.z));
    const elbow=root.worldToLocal(r.lower.getWorldPosition(new T.Vector3()));aim(r.lower,r.lowerAxis,new T.Vector3(solution.wrist.x-elbow.x,solution.wrist.y-elbow.y,solution.wrist.z-elbow.z));
  }
  C.stationFilmHandPosition=(root,side='right')=>{
    root.updateWorldMatrix(true,true);const rig=root.userData.stationRig,hand=rig?.[side+'Hand'];if(hand)return hand.getWorldPosition(new T.Vector3());
    const r=nativeRig(root)[side];return r?r.lower.localToWorld(r.lowerAxis.clone().multiplyScalar(r.lowerLength)):root.getWorldPosition(new T.Vector3());
  };
  C.stationFilmChestPosition=root=>{root.updateWorldMatrix(true,true);const rig=root.userData.stationRig;return(rig?.spine||rig?.torso||root).getWorldPosition(new T.Vector3());};
  // Surface points describe the button/glass; wrist goals stay outside the
  // surface so the hand itself, rather than its wrist bone, makes contact.
  C.stationFilmContactTarget=(root,side,surfacePoint,normal,distance=.115)=>{
    const point=targetOf(surfacePoint),axis=vector(normal);if(!point||!axis)return null;
    axis.normalize();return{position:point.clone().addScaledVector(axis,distance),surface:point,normal:axis,wristOffset:distance,grip:0};
  };
  C.resetStationFilmActor=root=>{states.delete(root);delete root.userData.filmContacts;delete root.userData.filmActing;delete root.userData.stationPose;C.resetStationStoryCrew?.(root);};
  // Film crew keep the web station's geometry, skin, hair and orange uniform.
  C.styleStationFilmActor=root=>root;

  // These are physical, visible handrails fixed to the robot's protective body.
  // Holding a rail does not compete with the robot's articulated tool arms.
  function robotHandles(root){
    const data=root.userData;if(data.filmHandles)return data.filmHandles;
    const handles=data.filmHandles={},large=data.role==='cargo',width=large?.53:data.role==='medical'?.35:.30;
    const material=C.material('#7de8e0',{metalness:.6,roughness:.28}),mount=C.material('#57717f',{metalness:.75,roughness:.3});
    for(const [side,sign]of [['left',-1],['right',1]]){
      const holder=new T.Group();holder.name='film-'+side+'-rescue-handrail';holder.position.set(sign*width,(data.height||.7)*.5,data.role==='medical'?-.18:.13);root.add(holder);
      const rail=new T.Mesh(new T.CylinderGeometry(.016,.016,.18,16),material);rail.name='graspable-handrail';holder.add(rail);
      for(const y of [-.09,.09]){const stem=new T.Mesh(new T.CylinderGeometry(.012,.012,.07,12),mount);stem.rotation.z=Math.PI/2;stem.position.set(-sign*.035,y,0);holder.add(stem);}
      handles[side]=holder;
    }
    const rear=new T.Group();rear.name='film-rear-rescue-handrail';rear.position.set(0,(data.height||.7)*.5,data.role==='cargo'?-.67:-.40);root.add(rear);
    const bar=new T.Mesh(new T.CylinderGeometry(.017,.017,.30,16),material);bar.rotation.z=Math.PI/2;rear.add(bar);
    for(const x of [-.15,.15]){const length=data.role==='cargo'?.30:.16,stem=new T.Mesh(new T.CylinderGeometry(.012,.012,length,12),mount);stem.rotation.x=Math.PI/2;stem.position.set(x,0,length/2);rear.add(stem);}handles.rear=rear;
    if(data.role==='medical')for(const arm of data.arms||[]){
      // A slim clinical probe reaches the offered wrist while the rigid
      // coupler and fingers stay outside the person's hand envelope.
      const probe=new T.Mesh(new T.CylinderGeometry(.008,.008,.09,12),mount);probe.name='film-medical-contact-probe';probe.position.set(0,-.085,0);arm.wrist.add(probe);
      const tip=new T.Mesh(new T.SphereGeometry(.010,12,8),material);tip.name='film-medical-contact-tip';tip.position.set(0,-.13,0);arm.wrist.add(tip);arm.filmTipLength=.13;
    }
    return handles;
  }
  C.stationFilmRobotGrip=(root,side='right')=>{root.updateWorldMatrix(true,true);return robotHandles(root)[side]?.getWorldPosition(new T.Vector3())||root.getWorldPosition(new T.Vector3());};
  C.reachStationFilmRobot=(root,side,targetWorld,weight=1)=>{
    const target=targetOf(targetWorld),arm=root?.userData.arms?.find(a=>a.sign===(side==='left'?-1:1));if(!arm||!target)return null;
    const {shoulder,elbow,wrist,claws}=arm;root.updateWorldMatrix(true,true);
    const key=JSON.stringify([target.toArray(),weight,root.matrixWorld.elements]),last=arm.filmReach;
    if(last?.key===key&&[shoulder,elbow,wrist].every((bone,i)=>bone.quaternion.equals(last.pose[i])))return last.contact;
    const origin=root.worldToLocal(shoulder.getWorldPosition(new T.Vector3())),goal=root.worldToLocal(target.clone()),upper=elbow.position.length(),tip=arm.filmTipLength||.04,lower=wrist.position.length()+tip;
    const distance=origin.distanceTo(goal),reach=(upper+lower)*.985,minReach=Math.max(Math.abs(upper-lower)+.001,(upper+lower)*.25),reachable=distance<=reach&&distance>=minReach;
    const solution=L.AnatomyIK.solve(origin,goal,{x:arm.sign*.45,y:root.userData.role==='medical'?.8:-.8,z:-.3},upper,lower,.985),before=[shoulder,elbow,wrist].map(b=>b.quaternion.clone()),amount=clamp(weight,0,1);
    const aim=(bone,axis,direction)=>{const q=bone.getWorldQuaternion(new T.Quaternion()),from=axis.clone().applyQuaternion(q),to=direction.transformDirection(root.matrixWorld);q.premultiply(new T.Quaternion().setFromUnitVectors(from,to));worldRotation(bone,q);};
    aim(shoulder,elbow.position.clone().normalize(),new T.Vector3(solution.elbow.x-origin.x,solution.elbow.y-origin.y,solution.elbow.z-origin.z));
    const actualElbow=root.worldToLocal(elbow.getWorldPosition(new T.Vector3()));aim(elbow,wrist.position.clone().normalize(),new T.Vector3(solution.wrist.x-actualElbow.x,solution.wrist.y-actualElbow.y,solution.wrist.z-actualElbow.z));
    wrist.quaternion.identity();for(const [i,bone]of [shoulder,elbow,wrist].entries())bone.quaternion.slerpQuaternions(before[i],bone.quaternion.clone(),amount);
    for(const [i,claw]of (claws||[]).entries())claw.rotation.z=(i?1:-1)*(.1+.22*amount);
    root.updateWorldMatrix(true,true);const actual=wrist.localToWorld(new T.Vector3(0,-tip,0)),contact={target:target.clone(),actual,error:actual.distanceTo(target),reachable,reach,distance,weight:amount};
    arm.filmReach={key,contact,pose:[shoulder,elbow,wrist].map(bone=>bone.quaternion.clone())};
    (root.userData.filmRobotContacts??={})[side]=contact;return contact;
  };

  C.animateStationFilmActor=(root,time,options={})=>{
    const rig=root?.userData.stationRig;if(!rig||!Number.isFinite(time))return;
    root.updateWorldMatrix(true,true);const action=options.action||'idle',speed=Number.isFinite(options.speed)?options.speed:0,targets=options.handTargets||{},lookAt=targetOf(options.lookAt);
    const key=JSON.stringify([time,action,speed,options.lean??null,options.grip??null,options.restHandOffsets??null,lookAt?.toArray(),...['left','right'].map(side=>{const input=targets[side];return[targetOf(input)?.toArray(),vector(input?.normal)?.toArray(),input?.weight??1,input?.grip??null];}),root.matrixWorld.elements]);
    let state=states.get(root);if(state?.key===key&&state.pose?.every(({bone,q,p})=>bone.quaternion.equals(q)&&bone.position.equals(p)))return;
    const dt=state?time-state.time:0,continuous=!!state&&dt>0&&dt<.5,alpha=continuous?1-Math.exp(-dt*10):1;
    if(!state||dt<0)state={time,key:null,hands:{},lean:0,yaw:0,pitch:0,coughWeight:0,faintWeight:0,unresponsive:false};
    state.options={...options,speed:0,handTargets:Object.fromEntries(Object.entries(targets).map(([side,value])=>[side,value?.position?{...value,position:value.position.clone(),normal:vector(value.normal)}:value?.isVector3?value.clone():value]))};
    // The everyday crew pose preserves the pelvis bind frame. The emergency
    // retargeter aims Hips through its first child (a thigh on this GLB), which
    // rolls the pelvis over 110 degrees and then countertwists the torso.
    // Reuse the actual station animator and add only limited local gestures.
    C.animateStationCrew(root,time,speed>.025,false,{activity:activities[action]||'observe',speed});
    const motion=root.userData.stationMotion,asset=root.userData.stationAssetScene,parent=asset?.parent,bones=motion?.bones||Object.values(rig).filter(Boolean);
    const basePose=new Map(bones.map(bone=>[bone,{q:bone.quaternion.clone(),p:bone.position.clone()}]));
    const weak=action==='weak',unresponsive=action==='unresponsive'||action==='faint',cough=action==='cough',nod=action==='nod',enterFaint=unresponsive&&!state.unresponsive;
    state.faintWeight+=((unresponsive?1:0)-state.faintWeight)*(continuous?1-Math.exp(-dt*2.5):1);
    const desiredLean=clamp(unresponsive?.12:Number.isFinite(options.lean)?options.lean:weak?.08:cough?.07:0,-.07,.12);state.lean+=(desiredLean-state.lean)*(unresponsive&&continuous?1-Math.exp(-dt*2.5):alpha);
    const goals={};
    for(const side of ['left','right']){
      const input=targets[side],point=input?.free?null:targetOf(input),wanted=unresponsive?0:point?clamp(input?.weight??1,0,1):0;
      const hand=state.hands[side]??={weight:0,point:null};
      if(enterFaint)hand.faintRelease={start:time,weight:hand.weight};
      if(unresponsive&&hand.faintRelease){const u=clamp(time-hand.faintRelease.start,0,1);hand.weight=hand.faintRelease.weight*(1-u*u*(3-2*u));}
      else{hand.faintRelease=null;hand.weight+=(wanted-hand.weight)*alpha;}
      // World targets follow the moving prop. Blending weight, rather than
      // blending the target position, keeps a fully closed grip attached.
      if(point)hand.point=point;
      if(hand.point&&hand.weight>.001)goals[side]={point:hand.point.clone(),normal:vector(input?.normal),weight:hand.weight,grip:clamp(input?.grip??(typeof options.grip==='number'?options.grip:options.grip?.[side])??.78,0,1)};
    }
    state.coughWeight+=((cough&&!goals.right ? .92 : 0)-state.coughWeight)*alpha;
    const inverse=parent?.matrixWorld.clone().invert();if(motion&&parent)parent.remove(asset);
    try{
      if(motion){
        const seed=root.userData.stationMotionSeed||0,breath=Math.sin(time*1.46+seed),quiet=unresponsive?.38:1;
        // Relax unused hands in front of the hips. This is a small variant of
        // the everyday resting pose, keeping idle fingers clear of controls.
        if(['idle','listen','weak','steady','cough','press','float'].includes(action))for(const [side,lag]of [['left',.4],['right',2.1]])if(!goals[side]){const out=motion.armRest[side]?.out||(side==='left'?1:-1),wave=Math.sin(time*1.68+seed+lag),slow=Math.sin(time*.73+seed*.6+lag),extra=options.restHandOffsets?.[side]||[0,0,0];motion.arm(side,[out*(.105+.012*wave)+extra[0],-.36+.026*slow+extra[1],.074+.012*Math.sin(time*1.23+seed+lag)+extra[2]]);motion.grip(side,.13+.045*Math.sin(time*1.11+seed+lag));rig[side+'Hand'].quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(.035*slow,.04*wave,.025*Math.sin(time*.91+lag))));}
        motion.aim(rig.spine,[Math.sin(time*.83+seed)*.012*quiet,1,state.lean+breath*.012*quiet]);
        // In zero gravity the knees drift at different phases, with ankles
        // responding later. No footfall cycle or body scaling is introduced.
        for(const [side,lag]of [['left',.25],['right',2.35]]){const out=motion.armRest[side]?.out||(side==='left'?1:-1),wave=Math.sin(time*1.37+seed+lag),lagged=Math.sin(time*1.09+seed+lag-.68);motion.aim(rig[side+'UpLeg'],[out*(.045+.009*Math.sin(time*.77+lag)),-1,.34+quiet*(.070*wave+.020*Math.sin(time*.51+seed))]);motion.aim(rig[side+'Leg'],[out*.025,-1,-.39+quiet*.085*lagged]);const foot=rig[side+'Foot'];if(foot)foot.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(quiet*.055*Math.sin(time*1.13+lag-.9),0,quiet*.025*Math.sin(time*.87+lag))));}
        if(lookAt){
          const target=lookAt.clone().applyMatrix4(inverse),head=rig.head.getWorldPosition(new T.Vector3()),direction=target.sub(head);
          const yaw=clamp(Math.atan2(direction.x,direction.z),-.45,.45),pitch=clamp(-Math.atan2(direction.y,Math.hypot(direction.x,direction.z)),-.24,.28)+(nod?Math.sin(time*4)*.045:0);
          state.yaw+=(yaw-state.yaw)*alpha;state.pitch+=(pitch-state.pitch)*alpha;
          // Absolute orientation from the neutral rig avoids adding another
          // yaw to last frame's head pose on every update.
          motion.worldRotation(rig.head,new T.Quaternion().setFromEuler(new T.Euler(state.pitch+.018*Math.sin(time*1.17+seed),state.yaw+.03*Math.sin(time*.71+seed),.012*Math.sin(time*.93+seed),'YXZ')).multiply(restHeadRotation(motion)));
        }else if(weak)motion.aim(rig.head,[.035*Math.sin(time*.8),1,.20+.025*Math.sin(time*2.1)]);
        if(state.faintWeight>.001){
          const weight=state.faintWeight,blend=(bone,apply)=>{if(!bone)return;const before=bone.quaternion.clone();apply();bone.quaternion.slerpQuaternions(before,bone.quaternion.clone(),weight);bone.updateWorldMatrix(false,true);};
          // Breathing and soft inertial adjustments continue after the crew
          // member stops responding. The director owns all root translation.
          const breath=Math.sin(time*1.12),drift=Math.sin(time*.43);
          blend(rig.head,()=>motion.worldRotation(rig.head,new T.Quaternion().setFromEuler(new T.Euler(.28+breath*.012,drift*.018,Math.sin(time*.31)*.018,'YXZ')).multiply(restHeadRotation(motion))));
          for(const [side,sign]of [['left',-1],['right',1]]){
            const out=motion.armRest[side]?.out||sign,upper=rig[side+'Arm'],lower=rig[side+'ForeArm'],hand=rig[side+'Hand'],before=[upper,lower,hand].map(b=>b.quaternion.clone());
            motion.arm(side,[out*(.075+drift*.008),-.40+breath*.008,.105+Math.sin(time*.61+sign*.4)*.015]);motion.grip(side,.06);
            for(const [i,bone]of [upper,lower,hand].entries()){bone.quaternion.slerpQuaternions(before[i],bone.quaternion.clone(),weight);bone.updateWorldMatrix(false,true);}
            blend(rig[side+'UpLeg'],()=>motion.aim(rig[side+'UpLeg'],[out*.045,-1,.34+Math.sin(time*.47+sign*.3)*.025]));
            blend(rig[side+'Leg'],()=>motion.aim(rig[side+'Leg'],[out*.025,-1,-.40+Math.sin(time*.47+sign*.3-.6)*.025]));
          }
        }
        if(state.coughWeight>.001&&!goals.right){const mouth=rig.head.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,-.07,.11).multiplyScalar(motion.height/1.789));goals.right={assetPoint:mouth,weight:state.coughWeight,grip:.2};}
        for(const [side,target]of Object.entries(goals)){
          const point=target.assetPoint||target.point.clone().applyMatrix4(inverse),upper=rig[side+'Arm'],lower=rig[side+'ForeArm'],hand=rig[side+'Hand'];if(!upper||!lower||!hand)continue;
          const origin=upper.getWorldPosition(new T.Vector3()),rest=motion.armRest[side],factor=motion.height/1.789,offset=point.sub(origin),out=rest?.out||(side==='left'?1:-1);
          // Keep contacts inside a comfortable shoulder workspace. Never pull
          // an idle hand behind the body or twist a wrist to satisfy a surface.
          offset.x=out*Math.max(-.12*factor,out*offset.x);offset.y=clamp(offset.y,-.52*factor,.28*factor);offset.z=Math.max(-.03*factor,offset.z);
          const reach=(rest.upper+rest.lower)*.94;if(offset.length()>reach)offset.setLength(reach);
          motion.arm(side,offset.multiplyScalar(1/factor).toArray(),false,false);motion.grip(side,Math.min(.7,target.grip));
          if(target.normal&&rest?.palm){const q=hand.getWorldQuaternion(new T.Quaternion()),swing=q.clone().multiply(rest.handQ.clone().invert()),palm=rest.palm.clone().applyQuaternion(swing).normalize(),normal=target.normal.clone().transformDirection(inverse).negate(),adjust=new T.Quaternion().setFromUnitVectors(palm,normal),angle=2*Math.acos(clamp(Math.abs(adjust.w),-1,1));adjust.slerpQuaternions(new T.Quaternion(),adjust,Math.min(1,.60/Math.max(.001,angle)));q.premultiply(adjust);motion.worldRotation(hand,q);}
          if(target.weight<.999)for(const bone of [upper,lower,hand]){const previous=basePose.get(bone);bone.quaternion.slerpQuaternions(previous.q,bone.quaternion.clone(),target.weight);bone.updateWorldMatrix(false,true);}
        }
      }else{
        for(const [side,target]of Object.entries(goals)){const r=nativeRig(root)[side];if(!r)continue;nativeArm(root,side,target.point);if(target.weight<.999)for(const bone of [r.upper,r.lower])bone.quaternion.slerpQuaternions(basePose.get(bone).q,bone.quaternion.clone(),target.weight);}
      }
    }finally{if(motion&&parent)parent.add(asset);}
    // Procedural gestures have no external contact constraint. Blend their
    // final displayed arm pose as well as their intent, so lifting a hand to
    // the mouth cannot jump when the underlying action changes to recoil.
    if(continuous&&state.coughWeight>.001&&!goals.right?.point){
      const smooth=1-Math.exp(-dt*6);
      for(const name of ['rightArm','rightForeArm','rightHand']){const bone=rig[name],old=state.pose?.find(p=>p.bone===bone);if(bone&&old)bone.quaternion.slerpQuaternions(old.q,bone.quaternion.clone(),smooth);}
    }
    if(continuous&&state.faintWeight>.001){
      const smooth=1-Math.exp(-dt*5),names=['head','leftUpLeg','leftLeg','rightUpLeg','rightLeg'];
      for(const side of ['left','right'])if(unresponsive||(goals[side]?.weight||0)<.98)names.push(side+'Arm',side+'ForeArm',side+'Hand');
      for(const name of names){const bone=rig[name],old=state.pose?.find(p=>p.bone===bone);if(bone&&old){const target=bone.quaternion.clone(),amount=unresponsive&&/Arm|Hand/.test(name)?Math.min(smooth,dt*2.2/Math.max(.00001,old.q.angleTo(target))):smooth;bone.quaternion.slerpQuaternions(old.q,target,amount);}}
    }
    // A prop release and the next everyday pose share the same displayed
    // skeleton. Bound joint angular speed so changing ownership cannot snap.
    if(continuous&&state.pose)for(const previous of state.pose){const bone=previous.bone,target=bone.quaternion.clone(),angle=previous.q.angleTo(target),rate=bone===rig.head?2.2:bone===rig.spine?2:3.4;if(angle>rate*dt)bone.quaternion.slerpQuaternions(previous.q,target,rate*dt/angle);}
    root.updateWorldMatrix(true,true);const contacts={};
    for(const [side,target]of Object.entries(goals))if(target.point){const actual=C.stationFilmHandPosition(root,side),origin=rig[side+'Arm'].getWorldPosition(new T.Vector3()),elbow=rig[side+'ForeArm'].getWorldPosition(new T.Vector3()),upper=origin.distanceTo(elbow),lower=elbow.distanceTo(actual),distance=origin.distanceTo(target.point),reach=(upper+lower)*.985,minReach=Math.max(Math.abs(upper-lower)+.001,(upper+lower)*.25);contacts[side]={target:target.point.clone(),actual,error:actual.distanceTo(target.point),weight:target.weight,reachable:distance<=reach&&distance>=minReach,distance,reach};}
    root.userData.filmContacts=contacts;root.userData.filmActing={action,unresponsive,passiveBlend:state.faintWeight};state.unresponsive=unresponsive;state.time=time;state.key=key;state.pose=bones.map(bone=>({bone,q:bone.quaternion.clone(),p:bone.position.clone()}));states.set(root,state);
  };
  C.animateStationFilmAmbient=(root,time)=>{const state=states.get(root);if(state?.options)C.animateStationFilmActor(root,time,state.options);};
})();

