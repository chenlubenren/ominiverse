/* Official Unitree G1 visual asset. Motion below is local demonstration only. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE;
  const originalMake=C.makeRobot,originalAnimate=C.animateRobot;
  const assetURL=new URL('../../assets/robots/unitree-g1/g1-29dof.glb',document.currentScript.src).href;
  const manifestURL=new URL('../../assets/robots/unitree-g1/joints.json',document.currentScript.src).href;
  // currentScript is in js/collaboration, so the asset directory is two levels above.
  C.prepareRobot=async spec=>{
    if(spec.type!=='humanoid')return;
    if(C.g1Asset)return;
    if(!C.g1Promise)C.g1Promise=Promise.all([
      new Promise((resolve,reject)=>new T.GLTFLoader().load(assetURL,resolve,undefined,reject)),
      fetch(manifestURL).then(r=>{if(!r.ok)throw Error('无法读取人形机器人关节定义。');return r.json();})
    ]).then(([asset,joints])=>{
      // The source license and provenance remain in the asset directory.
      // Remove the separate embossed logo from the presentation model.
      const logo=asset.scene.getObjectByName('logo_link');logo?.parent?.remove(logo);
      asset.scene.traverse(o=>{if(o.geometry){o.geometry.userData.sharedRobotAsset=true;o.geometry.computeBoundingBox();}if(o.isMesh){o.castShadow=o.receiveShadow=true;}});
      C.g1Asset={scene:asset.scene,joints};window.RobotContract.setHumanoidJoints(joints);
    }).catch(error=>{C.g1Promise=null;throw new Error('人形机器人模型载入失败，请重试。'+(error.message||''));});
    await C.g1Promise;
  };
  C.presets[0]={...C.presets[0],name:'人形协作伙伴',label:'工业人形机器人',subtitle:'工业结构 / 29 个活动关节',asset:'unitree-g1',color:C.robotPalette.accent};
  C.makeRobot=spec=>{
    if(spec.type!=='humanoid')return originalMake(spec);
    if(!C.g1Asset)throw new Error('正在准备人形机器人模型，请稍后重试。');
    const root=new T.Group(),forward=new T.Group(),rig=C.g1Asset.scene.clone(true),joints={};
    forward.rotation.y=-Math.PI/2;rig.rotation.x=-Math.PI/2;forward.add(rig);root.add(forward);root.name=spec.name;root.scale.setScalar(spec.scale||1);
    const originals=new Map();
    rig.traverse(o=>{
      if(o.userData.robotJoint){joints[o.userData.robotJoint.name||o.name]=o;o.matrixAutoUpdate=true;o.userData.baseQuaternion=o.quaternion.clone();}
      if(!o.isMesh)return;
      o.userData.robotRoot=root;const source=o.material;
      // Assign colors to the existing parts only; never alter mesh geometry or transforms.
      const role=source.name==='white'?(/shoulder_roll|shoulder_yaw|wrist_pitch|hip_roll|waist_yaw/.test(o.name)?'accent':'shell'):'dark';
      const key=source.uuid+':'+role;
      if(!originals.has(key)){
        const m=source.clone();m.roughness=.48;m.metalness=.30;m.userData.robotPaletteRole=role;
        if(spec.color&&spec.color!=='#8c9ba9')m.color.copy(new T.Color(role==='accent'?spec.color:C.robotPalette[role]).convertSRGBToLinear());
        originals.set(key,m);
      }
      o.material=originals.get(key);
    });
    const bounds=new T.Box3().setFromObject(forward);forward.position.y=-bounds.min.y;
    root.userData={spec:{...spec,asset:'unitree-g1'},joints,jointDescriptors:C.g1Asset.joints,height:bounds.getSize(new T.Vector3()).y*(spec.scale||1),officialG1:true,forward,standingBase:forward.position.y};
    return C.applyRobotRig(root,spec.rig);
  };
  C.animateRobot=(root,phase,moving=false,interacting=false,time=0)=>{
    if(!root.userData.officialG1)return originalAnimate(root,phase,moving,interacting,time);
    const data=root.userData,amp=moving?1:0;
    const values={waist_yaw_joint:moving?Math.sin(phase)*.05:Math.sin(time*.75)*.045,waist_pitch_joint:interacting?.035+Math.sin(time*1.6)*.018:Math.sin(time*.9)*.012};
    for(const [side,offset]of [['left',0],['right',Math.PI]]){
      const a=Math.sin(phase+offset);
      values[side+'_hip_pitch_joint']=a*.34*amp-.035;
      values[side+'_knee_joint']=.07+Math.max(0,-a)*.44*amp;
      values[side+'_ankle_pitch_joint']=-values[side+'_hip_pitch_joint']-values[side+'_knee_joint'];
      values[side+'_shoulder_pitch_joint']=-a*.30*amp+(moving?0:Math.sin(time*1.1+offset)*.035);
      values[side+'_shoulder_roll_joint']=side==='left'?.08:-.08;
      values[side+'_elbow_joint']=.18+Math.max(0,a)*.10*amp;
    }
    if(interacting){const reach=.5+.5*Math.sin(time*2);values.right_shoulder_pitch_joint=-.45-reach*.25;values.right_elbow_joint=.55+reach*.3;values.right_wrist_yaw_joint=Math.sin(time*1.6)*.2;values.left_elbow_joint=.24+reach*.1;}
    for(const d of data.jointDescriptors){const joint=data.joints[d.name];if(!joint)continue;const angle=Math.max(d.lower,Math.min(d.upper,values[d.name]||0));joint.quaternion.copy(joint.userData.baseQuaternion).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(...d.axis),angle));}
    data.forward.position.y=data.standingBase+(moving?Math.abs(Math.sin(phase))*.008:0);
  };
})();
