/* Shared solid robot footprints and locally animated humanoid balance recovery. */
(() => {
  'use strict';const L=window.IndoorLab,T=THREE,clamp=L.clamp;
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  const radius=r=>r.radius??r.spec.radius??.3;
  const height=r=>r.height??r.spec.height??1.32;
  const humanoid=r=>(r.spec.type||r.spec.kind)==='humanoid';
  const robotGrids=new WeakMap();
  function navigation(source){if(robotGrids.has(source))return robotGrids.get(source);const g=new L.Grid(source,source.cell);g.solid.set(source.solid);g.support.set(source.support);g.hasClosedDoors=source.hasClosedDoors;
    // Robots have no boarding/passenger state yet. The lift bank is reserved
    // space, not a shortcut or a work destination, even with its doors open.
    for(let i=0;i<g.size;i++){const p=g.point(i);if(Math.abs(p.x)<3.3&&p.z> -2.35&&p.z<2.45)g.solid[i]=1;}g.finalize();robotGrids.set(source,g);return g;
  }
  const base=r=>r.location==='outside'?L.building.society.exterior.ground(r.x,r.z)-.82:r.stairY??(r.floor-1)*3.6;
  let entryCache=null;
  function invalidate(){entryCache=null;}
  function entries(){if(entryCache)return entryCache;const result=[];for(const fleet of [L.robotArmy,L.robotDutyFleet,L.officeRobots]){
    if(!fleet||fleet===L.officeRobots&&!fleet.enabled)continue;
    for(const r of fleet.robots){if(r.alive===false)continue;r.contactOwner=fleet;result.push(r);}
  }for(const [key,ctx]of L.collaboration?.contexts||[]){if(key!=='campus'&&!key.startsWith('office-'))continue;for(const r of ctx.sim.robots){r.root=r.model;r.floor=key==='campus'?1:Number(key.slice(7));r.location=key==='campus'?'outside':'floor';r.height=r.model.userData.height||1.32;r.angle=r.model.rotation.y;r.contactOwner=ctx.sim;r.contactContext=ctx;result.push(r);}}return entryCache=result;}
  function pointDistance(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);}
  function segmentDistance(a,b,c,d){
    const cross=(p,q,r)=>(q.x-p.x)*(r.z-p.z)-(q.z-p.z)*(r.x-p.x);
    const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
    if(abC*abD<0&&cdA*cdB<0)return 0;
    return Math.min(pointDistance(a,c,d),pointDistance(b,c,d),pointDistance(c,a,b),pointDistance(d,a,b));
  }
  function shape(r,x=r.x,z=r.z){const f=r.balance,lie=f?.lie||0,length=height(r)*.82*lie;
    const half=r.root?.userData.contactHalfLength??(r.spec.type==='quadruped'?.22*(r.spec.scale||1):0),dx=Math.sin(r.angle||0)*half,dz=Math.cos(r.angle||0)*half;
    return {a:{x:x-dx,z:z-dz},b:{x:x+dx+(f?.dx||0)*length,z:z+dz+(f?.dz||0)*length},radius:radius(r),height:height(r)*(1-lie)+.54*lie};
  }
  function gap(a,b){return segmentDistance(a.a,a.b,b.a,b.b)-a.radius-b.radius;}
  function sameLevel(a,b){const ay=base(a),by=base(b);return ay+shape(a).height>by+.03&&by+shape(b).height>ay+.03;}
  function liftClear(r,body){if(r.location==='outside')return true;const a={x:-3.3,z:-2.35},b={x:3.3,z:-2.35},c={x:3.3,z:2.45},d={x:-3.3,z:2.45};
    if([body.a,body.b].some(p=>p.x>a.x&&p.x<b.x&&p.z>a.z&&p.z<d.z))return false;
    return Math.min(segmentDistance(body.a,body.b,a,b),segmentDistance(body.a,body.b,b,c),segmentDistance(body.a,body.b,c,d),segmentDistance(body.a,body.b,d,a))>=body.radius+.01;
  }
  function canMove(r,x,z){const next=shape(r,x,z),old=shape(r);if(!liftClear(r,next)||!liftClear(r,{a:{x:r.x,z:r.z},b:{x,z},radius:radius(r)}))return false;for(const q of entries()){
    if(q===r||!sameLevel(r,q))continue;const other=shape(q),before=gap(old,other),after=gap(next,other);
    if(after<.015&&after<before-1e-7)return false;
    if(before>=.015&&segmentDistance({x:r.x,z:r.z},{x,z},other.a,other.b)<next.radius+other.radius+.015)return false;
  }return true;}
  function canPlace(r,x,z){const body=shape(r,x,z);return liftClear(r,body)&&entries().every(q=>q===r||!sameLevel(r,q)||gap(body,shape(q))>=.025);}
  function clearMove(r,x,z){const owner=r.contactOwner,s=owner?.b?.society||L.building.society;
    const nav=r.location==='outside'?s.exterior.navigation():s.grid(r.floor);
    return nav.isClear(x,z,radius(r))&&(!nav.lineClear||nav.lineClear(r,{x,z},radius(r)))
      &&(r.location==='outside'||!L.crossesClosedRoomDoor(s.model(r.floor),r,{x,z}))&&canMove(r,x,z);
  }
  function reset(r){r.balance=null;r.pushPressure=0;r.pendingPush=null;r.balanceCooldown=0;const root=r.root||r.rig?.root;if(root)root.rotation.set(0,r.angle,0);}
  function knockDown(r,dx,dz){
    if((!humanoid(r)&&!r.cargo)||r.balance||r.stair||r.balanceCooldown>0)return false;
    const len=Math.hypot(dx,dz)||1;dx/=len;dz/=len;
    // Find room for the lying body, including walls, closed doors and robots.
    let direction=null;
    for(const turn of [0,.55,-.55,1.1,-1.1,Math.PI/2,-Math.PI/2,Math.PI]){
      const c=Math.cos(turn),s=Math.sin(turn),x=dx*c-dz*s,z=dz*c+dx*s;
      r.balance={dx:x,dz:z,lie:1};let clear=canPlace(r,r.x,r.z);
      // Check the occupied segment, without requiring twice the body length.
      const society=r.contactOwner?.b?.society||L.building.society,nav=r.location==='outside'?society.exterior.navigation():society.grid(r.floor);
      for(let n=1;clear&&n<=6;n++){const p={x:r.x+x*height(r)*.82*n/6,z:r.z+z*height(r)*.82*n/6};if(!nav.isClear(p.x,p.z,radius(r))||nav.lineClear&&!nav.lineClear(r,p,radius(r))||r.location!=='outside'&&L.crossesClosedRoomDoor(society.model(r.floor),r,p))clear=false;}
      r.balance=null;if(clear){direction={dx:x,dz:z};break;}
    }
    if(!direction)return false;
    if(r.contactContext)r.balanceSaved={state:r.state,status:r.status,goal:r.goal||r.endpoint,speed:r.speed};r.balance={...direction,time:0,phase:'falling',lie:0};r.pushPressure=0;r.pendingPush=null;if(!r.contactContext)r.speed=0;r.vx=r.vz=0;r.path=[];r.pathAt=0;r.pursuit=null;r.target=null;r.meleeTarget=null;r.falls=(r.falls||0)+1;
    r.contactOwner?.releasePartner?.(r);L.robotCargo?.drop(r,direction.dx,direction.dz);if(r.contactContext){r.balancePreviousState=r.state;r.state='idle';r.status='失去平衡 · 倒地';}else r.state='失去平衡 · 倒地';return true;
  }
  function step(r,dt){
    r.balanceCooldown=Math.max(0,(r.balanceCooldown||0)-dt);
    if(!r.balance){const p=r.pendingPush;if(p&&p.remaining>0&&dt>0){p.remaining-=dt;
      r.pushPressure=(r.pushPressure||0)+dt*Math.max(0,p.speed-.65)*.85;
      const amount=Math.min(.025,dt*p.speed*.07),x=r.x+p.dx*amount,z=r.z+p.dz*amount;
      if(clearMove(r,x,z)){r.x=x;r.z=z;}
      if(p.speed>3.4||r.pushPressure>.95)knockDown(r,p.dx,p.dz);
    }else r.pushPressure=Math.max(0,(r.pushPressure||0)-dt*1.8);return !!r.balance;}
    const f=r.balance;f.time+=dt;r.speed=0;r.vx=r.vz=0;
    if(f.time<.65){f.phase='falling';f.lie=smooth(f.time/.65);r.state='失去平衡 · 倒地';}
    else if(f.time<1.85){f.phase='down';f.lie=1;r.state='倒地 · 自检';}
    else if(f.time<4.65){f.phase='rising';f.lie=1-smooth((f.time-2.05)/2.6);r.state=f.time<2.75?'起身 · 双手撑地':f.time<3.65?'起身 · 收腿半跪':'起身 · 蹬地站稳';}
    else {reset(r);r.balanceCooldown=1.6;r.recoveries=(r.recoveries||0)+1;r.path=[];r.pathAt=0;r.repath=0;r.retryAt=0;r.state='已站稳 · 恢复工作';return false;}
    return true;
  }
  function contact(r,a,x,z,from){
    const running=L.collaboration?.environment==='campus'?L.collaboration.externalRunning:L.building.society.running;
    if((!humanoid(r)&&!r.cargo)||r.balance||r.balanceCooldown>0||!running||a.health==='dead')return;
    let vx=a.vx||0,vz=a.vz||0;
    if(a.isPlayer){const t=L.continuousTower;if(!t?.active)return;const input=t.fp.input(),v=t.view;
      const speed=input.running?t.fp.sprintSpeed||5.6:t.fp.walkSpeed||2.6,n=Math.max(1,Math.hypot(input.forward,input.side));
      vx=(Math.sin(v.walkYaw)*input.forward-Math.cos(v.walkYaw)*input.side)*speed/n;
      vz=(Math.cos(v.walkYaw)*input.forward+Math.sin(v.walkYaw)*input.side)*speed/n;
    }
    const dx=r.x-from.x,dz=r.z-from.z,len=Math.hypot(dx,dz)||1,speed=(vx*dx+vz*dz)/len;
    if(speed>.7)r.pendingPush={dx:dx/len,dz:dz/len,speed,remaining:a.isPlayer?.065:.13};
  }
  function blocker(a,x,z,feet,from=a,physical=false){const humanRadius=.24*(a.appearance?.build??1),top=feet+(a.isPlayer&&L.continuousTower?.fp.crouched?.88:1.7);
    for(const r of entries()){const body=shape(r),y=base(r);if(feet>=y+body.height||top<=y)continue;
      const limit=humanRadius+body.radius,before=pointDistance(from,body.a,body.b),after=pointDistance({x,z},body.a,body.b);
      if(after<limit&&after<before-1e-7||before>=limit&&segmentDistance(from,{x,z},body.a,body.b)<limit){if(physical||!a.isPlayer)contact(r,a,x,z,from);return r;}
    }return false;
  }
  function pose(r){const f=r.balance,root=r.root||r.rig?.root;if(!root)return;root.rotation.set(0,r.angle,0);if(!f)return;
    const ground=root.position.y,tilt=f.lie*Math.PI/2,axis=new T.Vector3(f.dz,0,-f.dx);root.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(axis,tilt));
    // Prone -> hands under shoulders -> one knee forward -> crouch -> stand.
    // Interpolate full poses so the transition out of self-check never snaps.
    const keys=[
      [0,[-.25,.55,-.15,-.15,.35,.35,-.2,0]],
      [.25,[-1.25,1.25,-.6,-.6,1.1,1.1,-.3,.12]],
      [.55,[-.6,.7,-.8,-1.25,1.65,2,-.5,.20]],
      [.8,[-.3,.3,-.7,-.7,1.3,1.3,-.5,.1]],
      [1,[0,.18,-.035,-.035,.07,.07,-.035,0]]
    ];
    let angles=keys[0][1].map(v=>v*f.lie);
    if(f.phase==='rising'){const p=clamp((f.time-1.85)/2.8,0,1);let i=0;while(i<keys.length-2&&p>keys[i+1][0])i++;const a=keys[i],b=keys[i+1],blend=smooth((p-a[0])/(b[0]-a[0]));angles=a[1].map((v,n)=>v+(b[1][n]-v)*blend);}
    const values={waist_pitch_joint:angles[7]};
    for(const [side,sign]of [['left',1],['right',-1]]){
      values[side+'_shoulder_pitch_joint']=angles[0];values[side+'_shoulder_roll_joint']=sign*.15*f.lie;
      values[side+'_elbow_joint']=angles[1];values[side+'_hip_pitch_joint']=angles[side==='left'?2:3];
      values[side+'_knee_joint']=angles[side==='left'?4:5];values[side+'_ankle_pitch_joint']=angles[6];
    }
    const data=root.userData;
    if(data.officialG1)for(const d of data.jointDescriptors){const j=data.joints[d.name];if(j&&values[d.name]!=null)j.quaternion.copy(j.userData.baseQuaternion).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(...d.axis),clamp(values[d.name],d.lower,d.upper)));}
    else if(r.rig){for(const side of ['left','right'])for(const [part,key]of [['shoulder-pitch','shoulder_pitch_joint'],['elbow','elbow_joint'],['hip-pitch','hip_pitch_joint'],['knee','knee_joint'],['ankle-pitch','ankle_pitch_joint']])L.RobotModels.set(r.rig,side+'-'+part,(part==='elbow'?-1:1)*values[side+'_'+key]);}
    // Ground the articulated geometry after posing, including arbitrary push
    // directions. A fixed root offset lets knees or hands sink through the slab.
    root.updateMatrixWorld(true);const plane=root.parent?root.parent.localToWorld(new T.Vector3(root.position.x,ground,root.position.z)).y:ground,box=new T.Box3();let lowest=Infinity;
    root.traverse(o=>{if(!o.isMesh||!o.geometry||o===r.ring||o.matrixWorld.determinant()===0)return;for(let p=o;p&&p!==root;p=p.parent)if(!p.visible)return;const g=o.geometry;if(!g.boundingBox)g.computeBoundingBox();box.copy(g.boundingBox).applyMatrix4(o.matrixWorld);lowest=Math.min(lowest,box.min.y);});
    if(Number.isFinite(lowest))root.position.y+=Math.max(0,plane-lowest+.005);
  }
  function drawShadows(fleet){
    if(!fleet.contactShadows&&!fleet.visibleRobots.length)return;
    if(!fleet.contactShadows){const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,3,32,32,32);gradient.addColorStop(0,'rgba(28,40,55,.28)');gradient.addColorStop(1,'rgba(28,40,55,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
      const mesh=fleet.contactShadows=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas),transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),120);mesh.frustumCulled=false;mesh.userData.noAO=true;mesh.name='机器人接地阴影';fleet.group.add(mesh);fleet.v.pipeline._aoExcluded=null;}
    const pose=fleet.pose;let count=0;
    for(const r of fleet.visibleRobots){const b=shape(r),x=(b.a.x+b.b.x)/2,z=(b.a.z+b.b.z)/2,point=fleet.displayPoint({x,y:base(r)+.014,z,floor:r.floor,location:r.location});pose.position.copy(point);pose.rotation.set(-Math.PI/2,Math.atan2(b.b.x-b.a.x,b.b.z-b.a.z),0,'YXZ');pose.scale.set(b.radius*3,b.radius*3+Math.hypot(b.b.x-b.a.x,b.b.z-b.a.z),1);pose.updateMatrix();fleet.contactShadows.setMatrixAt(count++,pose.matrix);}
    fleet.contactShadows.count=count;if(count)fleet.contactShadows.instanceMatrix.needsUpdate=true;
  }
  L.robotContacts={entries,invalidate,shape,gap,sameLevel,canMove,canPlace,clearMove,blocker,contact,step,pose,reset,knockDown,drawShadows,navigation};
})();
