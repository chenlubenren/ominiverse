/* Dedicated intravehicular crew in work coveralls, with relaxed microgravity poses. */
(() => {
  'use strict';
  const C=window.CoScene,L=window.IndoorLab,T=THREE;
  const bodyKeys=new Set(['torso','badge']),headKeys=new Set(['head','hair','eyes','iris','lips','brow','glasses','hat','jaw']);
  const sharedMaterials=new WeakMap(),skeletonLayouts=new WeakMap();

  function crewPerson(index){
    return {id:50000+index,gender:index%2?'female':'male',age:32+index*3,type:'pedestrian',profile:{radius:.28,color:'#f28c36'},role:'crew',health:'healthy',appearance:{height:.98+(index%3)*.02,build:.98+(index%2)*.02},x:0,z:0,baseY:0,angle:0,vx:0,vz:0,state:'idle',pose:'stand',gesture:null};
  }

  function copyMaterial(source){
    const material=source.clone();
    material.skinning=true;material.transparent=false;material.opacity=1;material.depthWrite=true;material.userData.styleLocked=true;
    if(source.userData.clayCharacter)L.WhiteAvatar.applyMaterial(material);
    return material;
  }

  function sharedMaterial(source){
    let material=sharedMaterials.get(source);
    if(!material){
      material=copyMaterial(source);material.userData.sharedCharacterAsset=true;
      // Texture images and sampling do not vary by crew member. The asset
      // manager owns them for as long as its source model remains loaded.
      for(const texture of Object.values(material))if(texture?.isTexture){texture.userData??={};texture.userData.sharedCharacterAsset=true;}
      sharedMaterials.set(source,material);
    }
    return material;
  }

  function assetSkeletons(asset){
    let layouts=skeletonLayouts.get(asset);if(layouts)return layouts;
    layouts=new Map();const equivalent=new Map();
    asset.scene.traverse(source=>{
      if(!source.isSkinnedMesh||layouts.has(source.skeleton))return;
      const skeleton=source.skeleton,key=skeleton.bones.map((b,i)=>b.uuid+':'+skeleton.boneInverses[i].elements.join(',')).join('|');
      if(!equivalent.has(key))equivalent.set(key,skeleton);
      layouts.set(skeleton,equivalent.get(key));
    });
    skeletonLayouts.set(asset,layouts);return layouts;
  }

  function assetCrew(root,asset,person){
    const clone=asset.scene.clone(true),sources=[],targets=[];
    asset.scene.traverse(o=>sources.push(o));clone.traverse(o=>targets.push(o));
    const copies=new Map(sources.map((o,i)=>[o,targets[i]])),bones=[],skeletons=new Map(),layouts=assetSkeletons(asset);
    let meshIndex=0;
    for(const source of sources){
      const target=copies.get(source);
      if(source.isBone)bones.push(target);
      if(!source.isMesh)continue;
      target.geometry=source.geometry;target.geometry.userData.sharedCharacterAsset=true;
      const material=source.isSkinnedMesh?asset.meshes[meshIndex++].material:source.material;
      target.material=Array.isArray(material)?material.map(sharedMaterial):sharedMaterial(material);
      target.frustumCulled=false;target.castShadow=target.receiveShadow=false;target.userData.noAO=true;
      if(source.isSkinnedMesh){
        // GLTFLoader may create one Skeleton per primitive even though all
        // six parts use the same joints and inverse binds. Share within this
        // person only; every person still owns independent bones/matrices.
        const key=layouts.get(source.skeleton);
        let skeleton=skeletons.get(key);
        if(!skeleton){skeleton=new T.Skeleton(source.skeleton.bones.map(b=>copies.get(b)),source.skeleton.boneInverses.map(m=>m.clone()));skeletons.set(key,skeleton);}
        target.skeleton=skeleton;target.bindMatrix.copy(source.bindMatrix);target.bindMatrixInverse.copy(source.bindMatrixInverse);
      }
    }
    const motion=new L.LuxMotionRig(clone,bones,asset.height);
    const normalized=new T.Group();normalized.matrixAutoUpdate=false;normalized.matrix.copy(asset.normalise).premultiply(new T.Matrix4().makeScale(person.appearance.build,person.appearance.height,person.appearance.build));normalized.add(clone);root.add(normalized);
    root.userData.stationRig=L.LuxMotionRig.mapBones(bones);
    // Solve poses before the normalization/cabin transform, in the asset's frame.
    root.userData.stationMotion=motion;
    root.userData.stationAsset=asset.meta.id;
    root.userData.stationAssetScene=clone;
    root.userData.stationNormalization=normalized;
  }

  C.disposeStationCrew=root=>{
    const skeletons=new Set();root.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);});
    for(const skeleton of skeletons)skeleton.dispose();
  };

  function nativeCrew(root,person){
    const snapshot=new T.Group(),renderer=new L.CrowdRenderer(snapshot,[person]);
    // The asset branch above handles optional detailed models. This snapshot
    // takes the exact native geometry and palette used by the ground crowd.
    renderer.update([person],0);
    const h=person.appearance.height,b=person.appearance.build,shape=L.WhiteAvatar?.shape(person)||{shoulderWidth:1},legs=L.NativeLegRig.pose({});
    const world={hips:[0,.86*h,0],torso:[0,1.11*h,0],head:[0,1.65*h,0]},parents={hips:null,torso:'hips',head:'torso'};
    for(const [side,sign]of [['left',-1],['right',1]]){
      const shoulder={x:sign*.168*shape.shoulderWidth,y:1.36,z:0},arm=L.AnatomyIK.solve(shoulder,{x:sign*.197,y:.82,z:0},{x:sign*.55,y:-.42,z:-.9},.285,.265),leg=legs.legs[sign<0?0:1];
      world[side+'Arm']=[shoulder.x*b,shoulder.y*h,0];world[side+'ForeArm']=[arm.elbow.x*b,arm.elbow.y*h,arm.elbow.z*b];
      world[side+'UpLeg']=[leg.hip.x*b,leg.hip.y*h,leg.hip.z*b];world[side+'Leg']=[leg.knee.x*b,leg.knee.y*h,leg.knee.z*b];
      parents[side+'Arm']='torso';parents[side+'ForeArm']=side+'Arm';parents[side+'UpLeg']='hips';parents[side+'Leg']=side+'UpLeg';
    }
    const names=['hips','torso','head','leftArm','leftForeArm','rightArm','rightForeArm','leftUpLeg','leftLeg','rightUpLeg','rightLeg'],rig={},bones=[];
    for(const name of names){const bone=new T.Bone();bone.name=name;bone.position.fromArray(world[name]);if(parents[name])bone.position.sub(new T.Vector3(...world[parents[name]]));rig[name]=bone;bones.push(bone);(parents[name]?rig[parents[name]]:root).add(bone);}
    root.updateMatrixWorld(true);const skeleton=new T.Skeleton(bones);
    const matrix=new T.Matrix4(),normalMatrix=new T.Matrix3(),point=new T.Vector3(),normal=new T.Vector3(),center=new T.Vector3(),color=new T.Color();
    const boneFor=(key,p)=>{
      if(bodyKeys.has(key))return 1;if(headKeys.has(key))return 2;
      const side=p.x<0?'left':'right',upper=side==='left'?3:5,thigh=side==='left'?7:9;
      if(key==='hip'||key==='skirt'||key==='bag')return 0;
      if(key==='pants')return p.y>world[side+'Leg'][1]?thigh:thigh+1;
      if(key==='shoes')return thigh+1;
      if(key==='joint')return p.y<.8*h?thigh+1:upper;
      if(key==='cloth')return upper;
      if(key==='finger'||key==='fingertip'||key==='phone')return upper+1;
      if(key==='skin')return p.y>1.53*h?2:Math.abs(p.x)<.12*b?1:upper+1;
      return 0;
    };
    for(const [key,source]of Object.entries(renderer.parts)){
      if(!source.count||key==='selection')continue;
      const g=source.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,positions=[],normals=[],uvs=[],colors=[],skinIndices=[],skinWeights=[],indices=[];
      for(let instance=0;instance<source.count;instance++){
        source.getMatrixAt(instance,matrix);normalMatrix.getNormalMatrix(matrix);center.setFromMatrixPosition(matrix);
        if(source.instanceColor)source.getColorAt(instance,color);else color.set(0xffffff);
        const bone=boneFor(key,center),offset=positions.length/3;
        for(let i=0;i<p.count;i++){
          point.fromBufferAttribute(p,i).applyMatrix4(matrix);normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();
          positions.push(point.x,point.y,point.z);normals.push(normal.x,normal.y,normal.z);uvs.push(uv?.getX(i)||0,uv?.getY(i)||0);colors.push(color.r,color.g,color.b);skinIndices.push(bone,0,0,0);skinWeights.push(1,0,0,0);
        }
        if(g.index)for(let i=0;i<g.index.count;i++)indices.push(offset+g.index.getX(i));else for(let i=0;i<p.count;i++)indices.push(offset+i);
      }
      const geometry=new T.BufferGeometry();geometry.setIndex(indices);for(const [name,array,size]of [['position',positions,3],['normal',normals,3],['uv',uvs,2],['color',colors,3],['skinWeight',skinWeights,4]])geometry.setAttribute(name,new T.Float32BufferAttribute(array,size));geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndices,4));
      const material=copyMaterial(source.material);material.vertexColors=true;const mesh=new T.SkinnedMesh(geometry,material);mesh.name='ground-'+key;mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=false;mesh.userData.noAO=true;root.add(mesh);mesh.bind(skeleton);
    }
    for(const source of Object.values(renderer.parts)){source.geometry.dispose();source.material.dispose();}
    root.userData.stationRig=rig;root.userData.stationAsset='ground-native';
  }

  C.makeStationCrew=index=>{
    const root=new T.Group(),person=crewPerson(index||0);root.name='舱内乘员 '+String((index||0)+1).padStart(2,'0');root.userData.noAO=true;root.userData.stationCrew=true;root.userData.height=1.789*person.appearance.height;root.userData.attire='daily';root.userData.crewGender=person.gender;
    root.userData.stationMotionSeed=(index||0)*.47;
    const asset=L.characterAssets?.pickCrew(person)||L.characterAssets?.pick(person);
    if(asset){assetCrew(root,asset,person);if(asset.meta.kind==='crew'){root.userData.attire='crew-workwear';root.userData.uniform='intravehicular-coverall';}}else nativeCrew(root,person);
    C.animateStationCrew(root,(index||0)*.7,false,false);return root;
  };

  function finishStationPose(root,rig,last,meta){
    const bones=root.userData.stationMotion?.bones||Object.values(rig).filter(Boolean),delta=last?meta.phase-last.phase:0;
    // Slerp from the displayed pose using simulation time. A long deferred
    // update catches up immediately; rewinding/resetting is deterministic.
    // Same-phase explicit pose previews still show their requested activity.
    const alpha=last&&delta>0?1-Math.exp(-delta*5):1;
    const previous=last?.bones;
    const states=bones.map((bone,i)=>{
      const state=previous?.[i];
      if(state&&alpha<.999){const target=bone.quaternion.clone();bone.position.lerpVectors(state.position,bone.position,alpha);bone.quaternion.copy(state.quaternion).slerp(target,alpha);}
      return {position:bone.position.clone(),quaternion:bone.quaternion.clone()};
    });
    root.userData.stationPose={...meta,bones:states};root.updateMatrixWorld(true);
  }

  // Reach, pull, tuck and coast. Both knees fold with a small delay rather
  // than taking alternating steps; the cycle advances with actual travel.
  const travelHands=[[.10,-.22,.18,.14],[.16,.06,.43,.35],[.20,.09,.39,.82],[.17,-.12,.22,.72],[.10,-.28,.10,.18],[.09,-.25,.13,.12]];
  const travelLegs=[[.26,-.26],[.34,-.38],[.68,-.82],[.80,-.94],[.49,-.53],[.27,-.27]];
  function travelCycle(keys,phase){
    const n=keys.length,u=((phase%1)+1)%1*n,i=Math.floor(u),t=u-i;
    return keys[i].map((_,k)=>{const a=keys[(i+n-1)%n][k],b=keys[i][k],c=keys[(i+1)%n][k],d=keys[(i+2)%n][k];return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);});
  }

  // Live incidents use the actual crew rigs. Targets stay in the same local
  // anatomy frame as daily activities, so a rotated or extracted cabin needs
  // no special pose conversion and imported/native people both react.
  function eventPose(reaction,seed){
    if(!reaction)return null;
    const event=reaction.event,mode=reaction.mode||({capture:'console',debris:'shelter',resupply:'observe',attitude:'brace',solar:'shelter',breach:'brace',fire:'brace',coolant:'collect',blackout:'repair',spill:'collect',broadcast:'wave'}[event]);
    if(!['brace','observe','collect','dance','repair','console','shelter','wave','secure'].includes(mode))return null;
    const time=Number.isFinite(reaction.time)?reaction.time:0,intensity=T.MathUtils.clamp(Number.isFinite(reaction.intensity)?reaction.intensity:1,0,1),wave=Math.sin(time*2.4+seed),beat=Math.sin(time*4.5+seed),sides={};
    const pose={event,mode,time,intensity,lean:0,sway:0,headPitch:0,headYaw:0,sides};
    for(const [side,sign]of [['left',-1],['right',1]]){
      let hand,grip=.35,thigh=.4,shin=-.45,splay=.06,upper=-.9,fore=-.9,armRoll=sign*.12;
      if(mode==='console'){
        // Hands on the panel; the right hand works the manipulator hand controller.
        const tap=Math.sin(time*(side==='right'?2.2:3.1)+seed);hand=[sign*(.11+.015*tap),-.05+.025*tap,.45];grip=side==='right'?.72:.3;upper=-1.25;fore=-1.02+.08*tap;armRoll=sign*.1;thigh=.42;shin=-.5;pose.lean=.07;pose.headPitch=.15;pose.headYaw=.05*Math.sin(time*.7+seed);
      }else if(mode==='shelter'){
        // Knees drawn up, arms close to the chest, head down: smallest exposed area.
        const breath=Math.sin(time*1.1+seed)*.02;hand=[sign*.06,-.12+breath,.26];grip=.7;upper=-1.05;fore=-1.62;armRoll=sign*.2;thigh=.95+breath;shin=-1.22;splay=.05;pose.lean=.18;pose.headPitch=.28;pose.sway=breath;
      }else if(mode==='wave'){
        const w=Math.sin(time*5.2+seed);if(side==='right'){hand=[.22+.07*w,.34,.2];grip=.05;upper=-2.45;fore=-.42+.25*w;armRoll=.5;}else{hand=[-.1,-.02,.38];grip=.2;upper=-1.2;fore=-.9;}thigh=.4;shin=-.46;pose.headYaw=.12*Math.sin(time*.8+seed);pose.headPitch=-.04;pose.sway=.04*Math.sin(time*1.3+seed);
      }else if(mode==='secure'){
        const reach=Math.sin(time*1.6+seed+sign);hand=[sign*(.15+.03*reach),-.06+.05*reach,.4];grip=.82;upper=-1.3-reach*.15;fore=-.8+reach*.15;armRoll=sign*.18;thigh=.5;shin=-.6;pose.lean=.08;pose.headPitch=.12;
      }else if(mode==='brace'){
        const holding=event==='attitude'||event==='debris'||event==='gravity'||event==='meteor',flinch=Math.sin(time*(event==='meteor'?7:3)+seed)*.025;
        hand=holding?[sign*.20,.08+flinch,.34]:[sign*.035,.19+flinch,.17];grip=holding?.86:.62;thigh=.70+wave*.06;shin=-.86;splay=.08;upper=holding?-1.50:-1.85;fore=holding?-.72:-1.32;armRoll=sign*(holding?.38:.14);
        pose.lean=.12+flinch;pose.sway=holding?wave*.045:flinch;pose.headPitch=.16;
      }else if(mode==='observe'){
        hand=side==='right'?[.13+wave*.035,.13,.43]:[-.08,-.18,.27];grip=side==='right'?.12:.38;upper=side==='right'?-1.72:-.72;fore=side==='right'?-.48:-.9;thigh=.37;shin=-.42;pose.headYaw=.26+wave*.10;pose.headPitch=-.055;pose.lean=.035;
      }else if(mode==='collect'){
        const reach=Math.sin(time*2+seed+sign*1.1);hand=[sign*(.13+.055*reach),-.02+.10*reach,.38+.09*Math.cos(time*2+seed+sign)];grip=.35+.25*(1-reach);upper=-1.34-reach*.24;fore=-.76+reach*.28;armRoll=sign*(.16+.12*reach);thigh=.48+reach*.10;shin=-.58;pose.lean=.055;pose.headPitch=.10;
      }else if(mode==='dance'){
        const swing=Math.sin(time*3.6+seed+sign*1.3);hand=[sign*(.19+.06*wave),.06+.22*swing,.22+.10*Math.cos(time*3.6+seed+sign)];grip=.18;upper=-1.55-swing*.65;fore=-.72+wave*.3;armRoll=sign*(.40+.22*swing);thigh=.46+.19*swing;shin=-.56-.22*swing;splay=.10+.035*beat;pose.sway=wave*.14;pose.lean=beat*.06;pose.headYaw=wave*.14;
      }else{
        const turn=Math.sin(time*2.7+seed+sign);hand=[sign*(.10+.035*turn),-.08+turn*.035,.44+turn*.045];grip=.62;upper=-1.13-turn*.13;fore=-1.04+turn*.15;thigh=.45;shin=-.54;pose.lean=.07;pose.headPitch=.12;
      }
      sides[side]={hand,grip,thigh,shin,splay,upper,fore,armRoll};
    }
    return pose;
  }

  C.animateStationCrew=(root,phase,moving,interacting,activity={})=>{
    const rig=root.userData.stationRig;if(!rig)return;
    const action=typeof activity==='string'?activity:(activity.activity?.kind||activity.activity||activity.kind||activity.state||''),working=interacting||/work|experiment|inspect|maintenance|research|operate|handoff/.test(action),talking=/talk|chat|social|brief/.test(action),resting=/rest|sleep/.test(action),feeding=/eat|drink/.test(action),observing=/observe/.test(action),experimenting=/experiment|research/.test(action),inspecting=/inspect/.test(action),maintaining=/maintenance|repair|operate/.test(action);
    const speed=Number.isFinite(activity.speed)?Math.max(0,activity.speed):moving?.4:0,distance=Number.isFinite(activity.distance)?activity.distance:null;
    const seed=root.userData.stationMotionSeed||0,reaction=eventPose(root.userData.stationEventReaction,seed);
    const last=root.userData.stationPose,meta={phase,moving:!!moving,action,working:!!working,talking,resting,feeding,observing,speed,distance,reactionEvent:reaction?.event||null,reactionMode:reaction?.mode||null,reactionTime:reaction?.time??null,reactionIntensity:reaction?.intensity??0};
    // Paused simulations and repeated direct calls must not redo the same IK.
    if(last&&Object.keys(meta).every(key=>last[key]===meta[key])){root.updateMatrixWorld(true);return;}
    const sway=Math.sin(phase*.32+seed),drift=Math.cos(phase*.27+seed*.7),headLag=Math.sin(phase*.24+seed*.9),sip=(1+Math.sin(phase*.65+seed))*.5;
    const dt=last?phase-last.phase:0,continuous=last&&dt>0&&dt<.5,s=T.MathUtils.clamp(speed/.32,0,1),wanted=moving?s*s*(3-2*s):0;
    const travelWeight=continuous?T.MathUtils.lerp(last.travelWeight??0,wanted,1-Math.exp(-dt*6)):wanted;
    const travelPhase=distance!==null?distance/1.05+seed*.13:continuous?(last.travelPhase??0)+dt*speed/1.05:phase*speed/1.05+seed*.13;
    Object.assign(meta,{travelWeight,travelPhase});
    const pull=Math.sin(travelPhase*Math.PI*2),fold=Math.sin(travelPhase*Math.PI*2-.7);
    const motion=root.userData.stationMotion,targets={};
    for(const [side,sign]of [['left',-1],['right',1]]){
      const handWave=Math.sin(phase*1.15+seed+sign*.9),slowWave=Math.sin(phase*.64+seed+sign*.6);
      let hand=[sign*.07,-.26,.17],grip=.12;
      if(working){hand=[sign*(.07+handWave*.015),-.15+Math.max(0,handWave)*.025,.46+slowWave*.035];grip=.22+Math.max(0,handWave)*.08;}
      if(experimenting){hand=[sign*(.11+slowWave*.035),-.07+handWave*.02,.39+Math.sin(phase*.7+seed+sign)*.055];grip=.38+Math.max(0,handWave)*.12;}
      if(inspecting){hand=side==='right'?[.16+slowWave*.035,-.025+handWave*.025,.41+slowWave*.045]:[-.08,-.18,.29];grip=side==='right'?.30:.16;}
      if(maintaining){hand=[sign*(.13+slowWave*.04),-.11+handWave*.035,.37+Math.cos(phase*.73+seed+sign)*.06];grip=.38+Math.max(0,slowWave)*.14;}
      if(resting){hand=[sign*.07,-.25,.19+slowWave*.02];grip=.10;}
      if(observing){hand=[sign*.08,-.24,.22];grip=.16;}
      if(talking&&side==='right'){hand=[.13+slowWave*.04,-.035+handWave*.035,.32+headLag*.07];grip=.13;}
      if(feeding){hand=side==='right'?[-.11,.07+sip*.15,.22-sip*.07]:[-.06,-.18,.29];grip=side==='right'?.52:.28;}
      const knee=Math.sin(phase*.41+seed+sign*.18),reach=travelCycle(travelHands,travelPhase+(side==='left'?0:.5)),leg=travelCycle(travelLegs,travelPhase-.12+(side==='left'?0:.09));
      hand=hand.map((v,i)=>T.MathUtils.lerp(v,reach[i]*(i===0?sign:1),travelWeight));grip=T.MathUtils.lerp(grip,reach[3],travelWeight);
      targets[side]={hand,grip,splay:.045+knee*.006+travelWeight*.015,thigh:T.MathUtils.lerp(.30+(resting?.14:0)+drift*.025+knee*.01,leg[0],travelWeight),shin:T.MathUtils.lerp(-.34+sway*.025+knee*.018,leg[1],travelWeight)};
      if(reaction){
        const weight=reaction.intensity*(1-travelWeight*.38),response=reaction.sides[side],target=targets[side];
        target.hand=target.hand.map((value,i)=>T.MathUtils.lerp(value,response.hand[i],weight));
        for(const key of ['grip','splay','thigh','shin'])target[key]=T.MathUtils.lerp(target[key],response[key],weight);
        target.reactionWeight=weight;
      }
    }
    if(motion){
      // Aim in asset coordinates before applying its rotated cabin frame.
      const scene=root.userData.stationAssetScene,parent=scene.parent;parent.remove(scene);motion.reset();
      const lean=resting?.05:experimenting?.04:maintaining?.045:working?.025:talking?-.018:0;
      motion.aim(rig.spine,[sway*.015+pull*.045*travelWeight,1,lean+drift*.012+fold*.065*travelWeight]);
      motion.aim(rig.head,[headLag*(talking?.10:observing?.12:working?.035:.025),1,feeding?.035+sip*.025:working?.08:resting?.025:0]);
      if(observing){const turn=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),headLag*.18);motion.worldRotation(rig.head,rig.head.getWorldQuaternion(new T.Quaternion()).premultiply(turn));}
      if(reaction){const weight=reaction.intensity*(1-travelWeight*.38);motion.aim(rig.spine,[reaction.sway*weight,1,T.MathUtils.lerp(lean,reaction.lean,weight)]);motion.aim(rig.head,[0,1,reaction.headPitch*weight]);const turn=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),reaction.headYaw*weight);motion.worldRotation(rig.head,rig.head.getWorldQuaternion(new T.Quaternion()).premultiply(turn));}
      for(const [side,sign]of [['left',-1],['right',1]]){
        const {hand,grip,splay,thigh,shin}=targets[side],out=motion.armRest[side]?.out||sign;
        motion.aim(rig[side+'UpLeg'],[out*splay,-1,thigh]);
        motion.aim(rig[side+'Leg'],[out*.025,-1,shin]);
        motion.arm(side,[hand[0]*out/sign,hand[1],hand[2]],false,working&&!moving);motion.grip(side,grip);
      }
      parent.add(scene);finishStationPose(root,rig,last,meta);return;
    }
    rig.hips.rotation.set(0,0,0);rig.torso.rotation.set((working?-.025:resting?.04:0)+fold*.065*travelWeight,sway*.015,-pull*.045*travelWeight);rig.head.rotation.set(feeding?.025+sip*.025:working?.055:0,observing?headLag*.18:talking?headLag*.12:headLag*.035,0);
    if(reaction){const weight=reaction.intensity*(1-travelWeight*.38);rig.torso.rotation.x=T.MathUtils.lerp(rig.torso.rotation.x,-reaction.lean,weight);rig.torso.rotation.z=T.MathUtils.lerp(rig.torso.rotation.z,-reaction.sway,weight);rig.head.rotation.x=T.MathUtils.lerp(rig.head.rotation.x,reaction.headPitch,weight);rig.head.rotation.y=T.MathUtils.lerp(rig.head.rotation.y,reaction.headYaw,weight);}
    for(const [side,sign]of [['left',-1],['right',1]]){
      const {hand,splay,thigh,shin}=targets[side];
      rig[side+'UpLeg'].rotation.set(-Math.atan(thigh),0,sign*splay);
      rig[side+'Leg'].rotation.set(Math.atan(thigh)-Math.atan(shin),0,0);
      rig[side+'Arm'].rotation.set(-hand[2]-(working?.20:0),0,sign*.10);
      rig[side+'ForeArm'].rotation.set(-(working?.54:talking&&side==='right'?.68:.36)+hand[1]*.12,0,0);
      if(experimenting){rig[side+'Arm'].rotation.x=-.94-hand[0]*.3;rig[side+'ForeArm'].rotation.x=-1.15+hand[2]*.3;}
      if(inspecting&&side==='right'){rig.rightArm.rotation.x=-1.02-hand[0]*.3;rig.rightForeArm.rotation.x=-1.30+hand[2]*.3;}
      if(maintaining){rig[side+'Arm'].rotation.x=-.82-hand[0]*.4;rig[side+'ForeArm'].rotation.x=-.98+hand[2]*.3;}
      if(feeding&&side==='right'){rig.rightArm.rotation.set(-1.25-sip*.20,0,-.18);rig.rightForeArm.rotation.set(-1.78-sip*.18,0,0);}
      if(travelWeight>0){const reach=travelCycle(travelHands,travelPhase+(side==='left'?0:.5));rig[side+'Arm'].rotation.x=T.MathUtils.lerp(rig[side+'Arm'].rotation.x,-.45-reach[1]*1.5-reach[2],travelWeight);rig[side+'ForeArm'].rotation.x=T.MathUtils.lerp(rig[side+'ForeArm'].rotation.x,-.45-reach[3]*.65,travelWeight);}
      if(reaction){const response=reaction.sides[side],weight=targets[side].reactionWeight;rig[side+'Arm'].rotation.x=T.MathUtils.lerp(rig[side+'Arm'].rotation.x,response.upper,weight);rig[side+'Arm'].rotation.z=T.MathUtils.lerp(rig[side+'Arm'].rotation.z,response.armRoll,weight);rig[side+'ForeArm'].rotation.x=T.MathUtils.lerp(rig[side+'ForeArm'].rotation.x,response.fore,weight);}
    }
    finishStationPose(root,rig,last,meta);
  };
  // Existing cabin callers keep working while adopting the clearer crew API.
  C.makeStationAstronaut=C.makeStationCrew;
  C.animateStationAstronaut=C.animateStationCrew;
})();
