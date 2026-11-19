/* The same anatomical poses drive the browser and exported GLB animation clips. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.IndoorLab.LuxMotionRig=factory(root.THREE);})(typeof window==='undefined'?globalThis:window,function(T){
'use strict';
const IK=typeof require==='function'?require('./anatomy-ik.js'):globalThis.IndoorLab.AnatomyIK;
const locomotion=typeof require==='function'?require('./locomotion.js'):globalThis.IndoorLab.Locomotion;
const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  function mapBones(bones){
    const found={},names=bones.map(b=>norm(b.name));
    const match=(role,tests)=>{const i=names.findIndex(n=>tests.some(t=>t.test(n)));if(i>=0)found[role]=bones[i];};
    match('hips',[/hips$/,/pelvis$/]);match('spine',[/spine2$/,/chest$/,/spine1$/,/spine$/]);match('head',[/head$/]);match('jaw',[/jaw$/]);
    for(const [side,letter]of [['left','l'],['right','r']]){
      match(side+'Arm',[new RegExp(side+'(upper)?arm$'),new RegExp('upperarm'+letter+'$'),new RegExp(letter+'upperarm$')]);
      match(side+'ForeArm',[new RegExp(side+'(forearm|lowerarm)$'),new RegExp('(lowerarm|forearm)'+letter+'$')]);
      match(side+'Hand',[new RegExp(side+'hand$'),new RegExp('hand'+letter+'$')]);
      match(side+'UpLeg',[new RegExp(side+'(upleg|thigh|upperleg)$'),new RegExp('(thigh|upperleg)'+letter+'$')]);
      match(side+'Leg',[new RegExp(side+'(leg|calf|lowerleg)$'),new RegExp('(calf|shin|lowerleg)'+letter+'$')]);
      match(side+'Foot',[new RegExp(side+'foot$'),new RegExp('foot'+letter+'$')]);
    }
    return found;
  }

// A facial rig may list an eye or jaw as the head's first child. The head's
// anatomical up axis is vertical in the rest pose, independent of those controls.
class MotionRig {
constructor(scene,bones,height,typingOrigin){this.scene=scene;this.typingOrigin=typingOrigin;this.bones=bones;this.height=height;this.rig=mapBones(bones);this.footDirections={};this.legRest={};scene.updateMatrixWorld(true);for(const side of ['left','right']){const foot=this.rig[side+'Foot'],upper=this.rig[side+'UpLeg'],knee=this.rig[side+'Leg'],toe=foot?.children.find(b=>b.isBone);if(foot&&upper&&knee){const h=upper.getWorldPosition(new T.Vector3()),k=knee.getWorldPosition(new T.Vector3()),a=foot.getWorldPosition(new T.Vector3());this.legRest[side]={ankle:a,length1:h.distanceTo(k),length2:k.distanceTo(a),footQ:foot.getWorldQuaternion(new T.Quaternion())};}if(toe)this.footDirections[side]=toe.getWorldPosition(new T.Vector3()).sub(foot.getWorldPosition(new T.Vector3())).toArray();}this.fingerCache={};for(const side of ['left','right'])for(const digit of ['Index','Middle','Ring','Pinky','Thumb'])for(let joint=1;joint<=3;joint++){const key=side+'Hand'+digit+joint;this.fingerCache[key]=bones.find(b=>norm(b.name).endsWith(norm(key)));}this.armRest={};this.aimChildren=new Map();for(const side of ['left','right']){const upper=this.rig[side+'Arm'],lower=this.rig[side+'ForeArm'],hand=this.rig[side+'Hand'];if(!upper||!lower||!hand)continue;const a=upper.getWorldPosition(new T.Vector3()),b=lower.getWorldPosition(new T.Vector3()),c=hand.getWorldPosition(new T.Vector3());this.armRest[side]={upper:a.distanceTo(b),lower:b.distanceTo(c),out:Math.sign(a.x-this.rig.hips.getWorldPosition(new T.Vector3()).x)||1,forearm:c.clone().sub(b).normalize(),handQ:hand.getWorldQuaternion(new T.Quaternion())};this.aimChildren.set(upper,lower);this.aimChildren.set(lower,hand);this.aimChildren.set(this.rig[side+'UpLeg'],this.rig[side+'Leg']);this.aimChildren.set(this.rig[side+'Leg'],this.rig[side+'Foot']);}let neck=this.rig.head;while(neck?.parent?.isBone&&neck.parent!==this.rig.spine)neck=neck.parent;if(neck?.parent===this.rig.spine)this.aimChildren.set(this.rig.spine,neck);this.leafAxes=new Map();for(const b of bones){const child=this.aimChildren.get(b)||b.children.find(c=>c.isBone),direction=b===this.rig.head?new T.Vector3(0,1,0):child?child.getWorldPosition(new T.Vector3()).sub(b.getWorldPosition(new T.Vector3())):new T.Vector3(0,1,0);this.leafAxes.set(b,direction.normalize().applyQuaternion(b.getWorldQuaternion(new T.Quaternion()).invert()));}this.fingerRest=[];for(const side of ['left','right']){const wrist=this.rig[side+'Hand'],index=this.fingerCache[side+'HandIndex1'],little=this.fingerCache[side+'HandPinky1'];if(!wrist||!index||!little)continue;const origin=wrist.getWorldPosition(new T.Vector3()),normal=new T.Vector3().crossVectors(index.getWorldPosition(new T.Vector3()).sub(origin),little.getWorldPosition(new T.Vector3()).sub(origin)).normalize();if(side==='left')normal.negate();if(this.armRest[side])this.armRest[side].palm=normal.clone();for(const digit of ['Index','Middle','Ring','Pinky','Thumb'])for(let j=1;j<=3;j++){const b=this.fingerCache[side+'Hand'+digit+j];if(!b)continue;const child=b.children.find(c=>c.isBone),direction=child?child.getWorldPosition(new T.Vector3()).sub(b.getWorldPosition(new T.Vector3())).normalize():b.getWorldPosition(new T.Vector3()).sub(b.parent.getWorldPosition(new T.Vector3())).normalize(),axis=new T.Vector3().crossVectors(direction,normal).normalize().applyQuaternion(b.getWorldQuaternion(new T.Quaternion()).invert());this.fingerRest.push({side,b,q:b.quaternion.clone(),axis,angle:digit==='Thumb'?[.35,.75,.6][j-1]:[1.05,1.25,.9][j-1]});}}this.rest=bones.map(b=>({b,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));}
    reset(){for(const r of this.rest){r.b.position.copy(r.p);r.b.quaternion.copy(r.q);r.b.scale.copy(r.s);}this.scene.updateMatrixWorld(true);}
    aim(bone,direction){if(!bone)return;const q=bone.getWorldQuaternion(new T.Quaternion()),axis=this.leafAxes.get(bone);if(!axis)return;const d=axis.clone().applyQuaternion(q).normalize(),target=new T.Vector3(...direction).normalize();q.premultiply(new T.Quaternion().setFromUnitVectors(d,target));bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));bone.updateWorldMatrix(false,true);}
    arm(side,target,gait=false,typing=false){
      const rest=this.armRest[side],r=this.rig;if(!rest)return;
      const upper=r[side+'Arm'],lower=r[side+'ForeArm'],hand=r[side+'Hand'],origin=upper.getWorldPosition(new T.Vector3()),factor=this.height/1.789;
      const goal={x:origin.x+target[0]*factor,y:origin.y+target[1]*factor,z:origin.z+target[2]*factor};
      const solution=IK.solve(origin,goal,gait?{x:rest.out*.10,y:0,z:-1}:{x:rest.out*.38,y:-.8,z:-.35},rest.upper,rest.lower,gait?.998:.985);
      const elbow=new T.Vector3(solution.elbow.x,solution.elbow.y,solution.elbow.z),wrist=new T.Vector3(solution.wrist.x,solution.wrist.y,solution.wrist.z);
      this.aim(upper,elbow.clone().sub(origin).toArray());this.aim(lower,wrist.clone().sub(lower.getWorldPosition(new T.Vector3())).toArray());
      const direction=hand.getWorldPosition(new T.Vector3()).sub(lower.getWorldPosition(new T.Vector3())).normalize();
      const swing=new T.Quaternion().setFromUnitVectors(rest.forearm,direction),q=swing.clone().multiply(rest.handQ);
      if(rest.palm&&(gait||typing)){
        const from=rest.palm.clone().applyQuaternion(swing).projectOnPlane(direction).normalize();
        const to=(typing?new T.Vector3(0,-1,0):new T.Vector3(-rest.out,0,0)).projectOnPlane(direction).normalize();
        const roll=Math.atan2(direction.dot(from.clone().cross(to)),from.dot(to));
        q.premultiply(new T.Quaternion().setFromAxisAngle(direction,roll));
      }
      this.worldRotation(hand,q);
    }
    worldRotation(bone,q){if(!bone)return;bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));bone.updateWorldMatrix(false,true);}
    gaitFeet(t,fast){
      const scale=this.height/1.789,feet={};let shift=Infinity;
      for(const [side,sign]of [['left',-1],['right',1]]){
        const rest=this.legRest[side];if(!rest)continue;
        const step=locomotion.foot(t,sign,fast),ankle=rest.ankle.clone();
        ankle.z+=step.z*scale;ankle.y+=step.lift*scale;feet[side]=ankle;
        const hip=this.rig[side+'UpLeg'].getWorldPosition(new T.Vector3());
        const length=(rest.length1+rest.length2)*.998;
        const reach=Math.sqrt(Math.max(0,length*length-(ankle.x-hip.x)**2-(ankle.z-hip.z)**2));
        shift=Math.min(shift,ankle.y+reach-hip.y);
      }
      if(Number.isFinite(shift)){
        const hips=this.rig.hips,position=hips.getWorldPosition(new T.Vector3());
        position.y+=Math.max(-.08*scale,Math.min(.025*scale,shift));
        hips.position.copy(hips.parent.worldToLocal(position));
        this.scene.updateMatrixWorld(true);
      }
      return feet;
    }
    gaitLeg(side,ankle){
      const rest=this.legRest[side],r=this.rig;if(!rest||!ankle)return;
      const upper=r[side+'UpLeg'],lower=r[side+'Leg'],hip=upper.getWorldPosition(new T.Vector3());
      const {elbow:knee,wrist:foot}=IK.solve(hip,ankle,{x:0,y:0,z:1},rest.length1,rest.length2,.9999);
      this.aim(upper,[knee.x-hip.x,knee.y-hip.y,knee.z-hip.z]);
      const actual=lower.getWorldPosition(new T.Vector3());
      this.aim(lower,[foot.x-actual.x,foot.y-actual.y,foot.z-actual.z]);
      this.worldRotation(r[side+'Foot'],rest.footQ);
    }
    grip(side,amount){for(const f of this.fingerRest)if(f.side===side)f.b.quaternion.copy(f.q).multiply(new T.Quaternion().setFromAxisAngle(f.axis,f.angle*Math.max(0,Math.min(1,amount))));this.rig[side+'Hand']?.updateWorldMatrix(false,true);}
    pose(state,t){
      this.reset();const r=this.rig,phase=t*Math.PI*2,walking=['walk','run','chase','stairs','air-run'].includes(state),sit=['sit','typing','sit-talk','sit-phone','shelter'].includes(state),stride=walking?Math.sin(phase)*(['run','chase'].includes(state)?.34:.19):0,reach=['grab','bite','chase'].includes(state),struggle=state==='struggle',turn=state==='turn',talk=state==='talk'||state==='sit-talk',phone=state==='phone'||state==='sit-phone';
      const shiver=state==='air-shiver',clutch=state==='air-head'||state==='sneeze'||state==='shelter',lurch=state==='air-lurch',air=shiver||clutch||lurch,prone=state==='dead'||state==='down';
      const u=Math.max(0,Math.min(1,t/2)),flinch=['hit','flinch'].includes(state)?Math.sin(Math.PI*Math.min(1,u*1.4))*(1-u):0,grasp=state==='grab'?u*u*(3-2*u):state==='bite'?1:0,bite=state==='bite'?Math.sin(Math.PI*u):0,factor=this.height/1.789,drop=sit?.27:0,lean=state==='bite'?.12+bite*.16:state==='grab'?.04+grasp*.12:reach?.07:turn?Math.sin(t*12)*.08:-flinch*.17;
      r.hips.position.y-=(drop+(clutch?.035:lurch?.045+.025*Math.cos(phase):0))*factor;this.scene.updateMatrixWorld(true);
      const fast=['run','chase','air-run'].includes(state),feet=walking?this.gaitFeet(t,fast):null;
      this.aim(r.spine,[air?Math.sin(phase*(shiver?3:1))*(shiver?.024:.10):turn?Math.sin(phase*2)*.08:flinch*.065,.5,lean+Math.sin(phase*.5)*.008+(clutch?.14:lurch?.13+.15*Math.sin(phase):0)]);
      this.aim(r.head,[air?Math.sin(phase*(shiver?4:1))*.056:turn?Math.sin(t*17)*.09:bite*.035,.2,clutch?.07:lurch?-.04+.09*Math.sin(phase):state==='bite'?.10+Math.sin(u*Math.PI*4)*.025:-flinch*.065]);
      for(const [side,s]of [['left',-1],['right',1]]){
        let elbow=[s*.02,-.23,-stride*s*.6],hand=[s*.025,-.2,-stride*s*.7];
        if(sit){elbow=[s*.025,-.23,.22];hand=[s*.01,-.08,.25];}
        if(state==='typing'){elbow=[-s*.055,-.20,.23];hand=[0,-.05+Math.sin(phase*3+s)*.008,.19];}
        if(shiver){elbow=[s*.018,-.24,.05];hand=[0,-.20+Math.sin(phase*5+s)*.023,.08+Math.cos(phase*4+s)*.021];}
        if(clutch){elbow=[s*.038,-.08,.12];hand=[-s*.09,.28+Math.sin(phase*2+s)*.014,.015];}
        if(lurch){elbow=[s*.085,-.2,.10];hand=[s*.045,-.105+Math.cos(phase+s)*.08,.04+Math.sin(phase+s)*.10];}
        if(prone){elbow=[s*.11,-.24,.025];hand=[s*.03,-.22,.02];}
        if(reach){elbow=[s*.05,-.16+grasp*.04,.24+grasp*.07];hand=[s*.02,.02+grasp*.03,state==='chase'?.21:.25+grasp*.10];}
        if(struggle){elbow=[s*(.05+Math.sin(t*9)*.015),-.09,.23];hand=[-s*.035,.12+Math.sin(t*10+s)*.035,.18];}
        if(turn){elbow=[s*.04,-.15,Math.sin(t*13+s)*.1];hand=[s*.02,-.14,Math.sin(t*10+s)*.1];}
        if(talk&&s===1){elbow=[s*.04,-.13,.2];hand=[s*.02,.17,.12+Math.sin(t*3)*.07];}
        if(phone&&s===1){elbow=[s*.03,-.17,.13];hand=[-.07,.29,-.02];}
        if(state==='pull'){elbow=[s*.03,-.23,.25];hand=[s*.01,-.17,.24];}
        if(state==='hit'||state==='flinch'){elbow=[s*.06,-.12,.10];hand=[-s*.02,.11+flinch*.04,.13];}
        const arm=this.armRest[side],swing=(walking&&!reach||state==='idle')&&arm;
        if(swing){
          const reach=(arm.upper+arm.lower)*(fast?.91:.985)/factor;
          const x=arm.out*.016,z=walking?-locomotion.foot(t,s,fast).z*(fast?.86:.76):.026+Math.sin(phase)*.008;
          this.arm(side,[x,-Math.sqrt(Math.max(0,reach*reach-x*x-z*z)),z],true);
        }else if(state==='typing'&&arm&&this.typingOrigin){
          const shoulder=r[side+'Arm'].getWorldPosition(new T.Vector3()),target=this.typingOrigin.clone();
          target.x+=arm.out*.135*factor;target.y+=(.842+Math.sin(phase*3+s)*.006)*factor;target.z+=.387*factor;
          this.arm(side,target.sub(shoulder).divideScalar(factor).toArray(),false,true);
        }else this.arm(side,[elbow[0]+hand[0],elbow[1]+hand[1],elbow[2]+hand[2]],false,state==='typing');
        this.grip(side,['grab','bite'].includes(state)?.86:state==='chase'?.5:state==='phone'?.65:state==='typing'?.08:.18);
        if(walking)this.gaitLeg(side,feet[side]);else if(sit){this.aim(r[side+'UpLeg'],[s*.01,-.045,.29]);this.aim(r[side+'Leg'],[s*.005,-.42,.13]);this.worldRotation(r[side+'Foot'],this.legRest[side]?.footQ||new T.Quaternion());}
      }
      if(r.jaw&&state==='bite')r.jaw.rotation.x+=.09+Math.abs(Math.sin(u*Math.PI*3))*.22;
      if(['dead','down'].includes(state)){r.hips.position.y-=.66*factor;const world=r.hips.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2));r.hips.quaternion.copy(r.hips.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));}
      this.scene.updateMatrixWorld(true);
    }

}
MotionRig.mapBones=mapBones;return MotionRig;
});
