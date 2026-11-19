/* Readable emergency gestures, independent of the station's everyday animation. */
(() => {
  'use strict';
  const C=window.CoScene,L=window.IndoorLab,T=THREE,states=new WeakMap(),nativeMotions=new WeakMap();
  const sides=[['left',-1],['right',1]],actions=new Set(['startle','retreat','rush','brace','operate','beckon','assist','recoil','relief']);

  const mix=T.MathUtils.lerp,clamp=T.MathUtils.clamp;
  // A complete reach, grasp, pull, release and coast, in shoulder-local metres.
  // Cubic interpolation keeps velocity continuous through the whole stroke.
  const stroke=[[.11,-.17,.19,.16],[.18,.06,.43,.3],[.23,.15,.40,.9],[.22,-.04,.27,.86],[.16,-.29,.08,.25],[.09,-.24,.12,.12]];
  function cycle(keys,time){
    const n=keys.length,u=((time%1)+1)%1*n,i=Math.floor(u),t=u-i;
    return keys[i].map((_,k)=>{const a=keys[(i+n-1)%n][k],b=keys[i][k],c=keys[(i+1)%n][k],d=keys[(i+2)%n][k];return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);});
  }
  function targets(action,phase,seed,weight,age,strokeTime,turn){
    const wave=Math.sin(phase*2.1+seed),slow=Math.sin(phase*1.17+seed),breath=Math.sin(phase*1.55+seed),work=phase*2.0+seed;
    const p={hips:[slow*.025,1,breath*.025],spine:[slow*.035,1,.035+breath*.025],head:[slow*.035,1,.035],yaw:slow*.12,twist:slow*.045,rate:7,legs:{},grip:{},hands:{}};
    for(const [side,sign]of sides){
      const lag=phase*1.35+seed+(side==='left'?0:.65),fold=Math.sin(lag);
      p.legs[side]={thigh:.39+fold*.085,shin:-.46-Math.sin(lag-.45)*.11,splay:.065+Math.sin(lag*.7)*.016};
      p.hands[side]=[sign*(.10+slow*.02),-.25+breath*.025,.21+Math.sin(lag)*.035];p.grip[side]=.16;
    }
    if(action==='brace'){
      // One hand holds while the other releases, reaches and re-grips.
      p.spine=[-.08+slow*.055,1,.10+breath*.045];p.yaw=-.22+wave*.13;
      p.hands.left=[-.25+slow*.012,.22-breath*.014,.28];p.grip.left=.9;
      const reach=cycle(stroke,phase/3.4+seed*.17);p.hands.right=[reach[0],reach[1]+.06,reach[2]];p.grip.right=reach[3];
    }else if(action==='operate'){
      // Opposed hands turn a valve / manipulate a control, then re-position.
      p.spine=[Math.sin(work)*.045,1,.12+Math.cos(work)*.055];p.twist=Math.sin(work)*.10;p.head=[slow*.035,1,.16+Math.cos(work-.35)*.035];
      for(const [side,sign]of sides){const a=work+(side==='left'?Math.PI:0);p.hands[side]=[sign*.12+Math.cos(a)*.075,-.065+Math.sin(a)*.11,.33+Math.sin(a-.6)*.055];p.grip[side]=.45+.35*(1+Math.sin(a))*.5;}
    }else if(action==='beckon'){
      p.spine=[-.03+wave*.065,1,-.015+slow*.04];p.twist=wave*.07;p.yaw=-.15+slow*.18;
      p.hands.left=[-.23,-.09+breath*.025,.30];p.grip.left=.68;
      p.hands.right=[.12+wave*.16,.20+Math.cos(work)*.16,.27+Math.sin(work-.7)*.09];p.grip.right=.08;
    }else if(action==='assist'){
      // Offer both hands, catch, pull toward the chest, then extend again.
      const pull=cycle([[0,.02,.45],[0,.035,.48],[0,-.10,.29],[0,-.16,.20],[0,-.09,.28]],phase/3.1+seed*.12);
      p.spine=[slow*.04,1,.035+pull[2]*.24];p.twist=slow*.065;p.head=[slow*.025,1,.10+breath*.035];
      for(const [side,sign]of sides){p.hands[side]=[sign*(.10+.025*Math.sin(work+sign)),pull[1]+sign*.018,pull[2]+sign*.02];p.grip[side]=.25+.6*(1-pull[2]/.5);p.legs[side].thigh+=.12;}
    }else if(action==='startle'||action==='recoil'){
      // A single recoil decays into sustained protective readjustment, not a frozen keyframe.
      const flinch=Math.exp(-Math.max(0,age-.18)*2.1),shield=.5+.5*Math.sin(phase*2.4+seed);
      p.spine=[-.08+slow*.04,1,-.08-flinch*.15+breath*.045];p.yaw=.3+slow*.18;p.head=[wave*.045,1,.12+flinch*.12];
      p.hands.left=[-.08-wave*.045,.12+flinch*.08,.25+shield*.055];p.hands.right=[.14+wave*.07,.13+shield*.10,.29-shield*.045];
      for(const [side]of sides){p.legs[side].thigh+=flinch*.4;p.legs[side].shin-=flinch*.3;}
    }else if(action==='retreat'||action==='rush'){
      p.spine=[slow*.055,1,action==='rush'?.12:-.07];p.yaw=action==='retreat'?.45+slow*.22:slow*.15;
    }else if(action==='relief'){
      p.rate=4;p.spine=[slow*.025,1,.018+breath*.02];p.head=[slow*.03,1,.03];
      for(const [side,sign]of sides){p.hands[side]=[sign*.12,-.28+breath*.025,.17+slow*.035];p.legs[side].thigh-=.10;p.legs[side].shin+=.10;}
    }
    // Moving bodies actively pull and coast. Knees tuck after each push with
    // a small left/right delay, never the alternating footfalls of walking.
    if(weight>.001){
      const travelWeight=(action==='startle'||action==='recoil')?weight*.4:weight;
      for(const [side,sign]of sides){
        const offset=side==='left'?0:.48,reach=cycle(stroke,strokeTime+offset),leg=cycle([[.30,-.26],[.42,-.40],[.82,-.95],[.93,-1.05],[.56,-.63],[.32,-.31]],strokeTime-.12+(side==='left'?0:.10));
        const hand=[sign*reach[0],reach[1],reach[2]],l=p.legs[side];
        p.hands[side]=p.hands[side].map((v,i)=>mix(v,hand[i],travelWeight));p.grip[side]=mix(p.grip[side],reach[3],travelWeight);
        l.thigh=mix(l.thigh,leg[0],travelWeight);l.shin=mix(l.shin,leg[1],travelWeight);l.splay+=travelWeight*.025;
      }
      const pull=Math.sin(strokeTime*Math.PI*2),delayed=Math.sin(strokeTime*Math.PI*2-.7);
      p.hips=[delayed*.055*weight,1,-pull*.06*weight];p.spine[0]+=weight*(pull*.075-clamp(turn,-1,1)*.09);p.spine[2]+=weight*delayed*.10;p.twist+=weight*pull*.10;
    }
    return p;
  }

  // Native avatars have a downward resting arm, unlike many imported T poses.
  // Derive every aim axis from the native bind landmarks instead of applying
  // imported Euler angles to a different skeleton.
  function nativeMotion(root,rig){
    let motion=nativeMotions.get(root);if(motion)return motion;
    const index=Math.round((root.userData.stationMotionSeed||0)/.47),h=root.userData.height/1.789,b=.98+(index%2)*.02;
    const axes=new Map(),lengths={},legs=L.NativeLegRig.pose({}).legs;
    axes.set(rig.hips,new T.Vector3(0,1,0));axes.set(rig.torso,rig.head.position.clone().normalize());axes.set(rig.head,new T.Vector3(0,1,0));
    for(const [side,sign]of sides){
      const upper=rig[side+'Arm'],lower=rig[side+'ForeArm'],thigh=rig[side+'UpLeg'],shin=rig[side+'Leg'];
      const shoulder=upper.position.clone().add(rig.torso.position).add(rig.hips.position),elbow=shoulder.clone().add(lower.position),wrist=new T.Vector3(sign*.197*b,.82*h,0),lowerAxis=wrist.sub(elbow);
      axes.set(upper,lower.position.clone().normalize());axes.set(lower,lowerAxis.clone().normalize());lengths[side]={upper:lower.position.length(),lower:lowerAxis.length()};
      const leg=legs[sign<0?0:1];axes.set(thigh,shin.position.clone().normalize());axes.set(shin,new T.Vector3((leg.ankle.x-leg.knee.x)*b,(leg.ankle.y-leg.knee.y)*h,(leg.ankle.z-leg.knee.z)*b).normalize());
    }
    const worldRotation=(bone,q)=>{bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));bone.updateWorldMatrix(false,true);};
    const aim=(bone,direction)=>{if(!bone||!axes.has(bone))return;const q=bone.getWorldQuaternion(new T.Quaternion()),from=axes.get(bone).clone().applyQuaternion(q),to=new T.Vector3(...direction).transformDirection(root.matrixWorld);q.premultiply(new T.Quaternion().setFromUnitVectors(from,to));worldRotation(bone,q);};
    motion={bones:Object.values(rig).filter(Boolean),reset(){for(const bone of this.bones)bone.quaternion.identity();root.updateMatrixWorld(true);},aim,worldRotation,
      arm(side,target){const upper=rig[side+'Arm'],lower=rig[side+'ForeArm'],origin=root.worldToLocal(upper.getWorldPosition(new T.Vector3())),goal={x:origin.x+target[0]*b,y:origin.y+target[1]*h,z:origin.z+target[2]*b},length=lengths[side],sign=side==='left'?-1:1;
        const solved=L.AnatomyIK.solve(origin,goal,{x:sign*.38,y:-.8,z:-.35},length.upper,length.lower,.985);aim(upper,[solved.elbow.x-origin.x,solved.elbow.y-origin.y,solved.elbow.z-origin.z]);const elbow=root.worldToLocal(lower.getWorldPosition(new T.Vector3()));aim(lower,[solved.wrist.x-elbow.x,solved.wrist.y-elbow.y,solved.wrist.z-elbow.z]);
      },grip(){}};
    nativeMotions.set(root,motion);return motion;
  }

  C.resetStationStoryCrew=root=>states.delete(root);
  C.animateStationStoryCrew=(root,phase,action='relief',moving=false,movement={})=>{
    const rig=root?.userData.stationRig;if(!rig||!Number.isFinite(phase))return;
    if(!actions.has(action))action=moving?'rush':'relief';
    const last=states.get(root);if(last&&last.phase===phase&&last.action===action&&last.moving===!!moving&&last.bones.every(({bone,p,q})=>bone.position.equals(p)&&bone.quaternion.equals(q))){root.updateMatrixWorld(true);return;}
    const imported=root.userData.stationMotion,motion=imported||nativeMotion(root,rig),bones=motion.bones,dt=last?phase-last.phase:0,continuous=last&&dt>0&&dt<.5;
    const seed=root.userData.stationMotionSeed||0,start=last&&dt>=0&&last.action===action?last.start:phase,desiredWeight=moving?clamp((movement.speed??.9)/.8,.35,1):0;
    const weight=continuous?mix(last.weight,desiredWeight,1-Math.exp(-dt*5)):desiredWeight;
    const strokeTime=continuous?last.strokeTime+dt*(.31+.10*clamp(movement.speed??.9,0,1.5)):phase*.39+seed*.13;
    const before=bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()})),p=targets(action,phase,seed,weight,phase-start,strokeTime,movement.turn||0);
    const asset=root.userData.stationAssetScene,parent=asset?.parent;
    // Imported anatomical axes are solved before their normalisation transform.
    if(imported)parent?.remove(asset);
    try{
      motion.reset();motion.aim(rig.hips,p.hips);motion.aim(rig.spine||rig.torso,p.spine);
      if(p.twist){const bone=rig.spine||rig.torso,axis=imported?new T.Vector3(0,1,0):new T.Vector3(0,1,0).transformDirection(root.matrixWorld);motion.worldRotation(bone,bone.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromAxisAngle(axis,p.twist)));}
      motion.aim(rig.head,p.head);
      if(rig.head&&p.yaw){const axis=imported?new T.Vector3(0,1,0):new T.Vector3(0,1,0).transformDirection(root.matrixWorld),turn=new T.Quaternion().setFromAxisAngle(axis,p.yaw);motion.worldRotation(rig.head,rig.head.getWorldQuaternion(new T.Quaternion()).premultiply(turn));}
      for(const [side,sign]of sides){
        // Imported crews label anatomical left on +X; native crews use -X.
        // Follow the rest shoulder rather than assuming either naming scheme.
        const outward=imported?.armRest[side]?.out||sign,hand=p.hands[side].slice();hand[0]*=outward/sign;
        const leg=p.legs[side];motion.aim(rig[side+'UpLeg'],[outward*leg.splay,-1,leg.thigh]);motion.aim(rig[side+'Leg'],[outward*.035,-1,leg.shin]);motion.arm(side,hand,false,action==='operate');motion.grip(side,p.grip[side]);
      }
    }finally{if(imported&&parent)parent.add(asset);}
    // Continuous simulation seconds control the blend. Pauses freeze it;
    // rewinds and same-time previews evaluate the requested pose directly.
    const alpha=last&&dt>0?1-Math.exp(-dt*p.rate):1;
    if(alpha<.999)for(let i=0;i<bones.length;i++){const target=bones[i].quaternion.clone();bones[i].position.lerpVectors(before[i].p,bones[i].position,alpha);bones[i].quaternion.copy(before[i].q).slerp(target,alpha);}
    states.set(root,{phase,action,start,weight,strokeTime,moving:!!moving,bones:bones.map(bone=>({bone,p:bone.position.clone(),q:bone.quaternion.clone()}))});root.updateMatrixWorld(true);
  };
})();
