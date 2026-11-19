/* Live orbital events in the station's own coordinate frame. Hardware is
   modelled after real station operations: the core module manipulator, a
   defunct satellite, a cargo spacecraft, debris, thruster plumes, the Sun,
   aurora and the station's flexible solar wings. Navigation, the crew
   simulation and rendering keep running through the normal station loop. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,K=C.StationEventKit,TAU=Math.PI*2,clamp=T.MathUtils.clamp;
  const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);},ramp=(t,a,b)=>smooth((t-a)/(b-a)),mix=T.MathUtils.lerp;
  const lin=(t,a,b)=>clamp((t-a)/(b-a),0,1),pulse=(t,a,b,fade=.6)=>ramp(t,a,a+fade)*(1-ramp(t,b-fade,b));
  // Fallback anchors on the original Tiangong exterior (station root coordinates).
  const anchors={armBase:V(0,1.96,-10.6),nodeTop:V(-.1,1.35,1.4),wingHit:V(14.6,13.5,1.14),tianzhouAft:V(-.1,.2,-24.76),tianzhouSide:V(1.5,0,-21.6),airlock:V(-.1,-9.38,.9),tianheFront:V(-.1,0,-6.4)};
  const stories={
    capture:{title:'失效卫星抵近 · 机械臂捕获',duration:34,keyAt:16,alert:false,pip:['tianhe','node','habitat'],
      beats:[[0,'地面测控：一颗失效卫星正翻滚着漂向空间站，预计最近距离约 60 米。'],[6,'指令舱乘员接管机械臂手控，巡检机器人从气闸出舱伴飞测量翻滚。'],[11,'巡检机器人用冷气推力轻推目标，翻滚逐渐减缓到可捕获范围。'],[16,'机械臂末端锁住星箭对接环，捕获成功。'],[24,'机械臂把目标推离到安全轨道，巡检机器人返航。']],
      ending:'目标已推离到安全轨道，空间站姿态与载荷正常。'},
    debris:{title:'空间碎片预警 · 紧急规避',duration:34,keyAt:16,alert:true,pip:['shenzhou','tianhe','habitat','node'],
      beats:[[0,'碎片预警：一片解体卫星碎片云将在 15 秒后穿越轨道。'],[4,'乘员关闭舱间舱门，到神舟飞船附近待命；舱内机器人加固松散设备。'],[8,'天舟发动机点火，空间站执行规避变轨。'],[16,'碎片高速掠过！一块小碎片击中梦天太阳翼。'],[21,'巡检机器人飞抵撞击点，拍摄并测量太阳翼损伤。']],
      ending:'损伤局限在两片电池片，供电下降约 0.4%，警报解除。'},
    resupply:{title:'天舟货运飞船交会对接',duration:34,keyAt:16,alert:false,pip:['node','habitat','tianhe'],
      beats:[[0,'天舟货运飞船完成远距离导引，进入 200 米停泊点。'],[7,'乘员监视激光雷达读数，舱内机器人清出货物通道。'],[16,'对接环接触捕获，锁钩依次锁紧，对接完成。'],[21,'舱门打开，机器人把货包从对接通道搬入舱内，乘员核对清单。']],
      ending:'补给完成：新到货包已扫描入库。'},
    attitude:{title:'推进器误喷 · 姿态失控',duration:32,keyAt:16,alert:true,pip:['tianhe','habitat','node'],
      beats:[[0,'告警：天舟一台姿控推进器误喷，空间站开始缓慢旋转。'],[5,'乘员抓牢扶手固定身体，机器人收拢漂浮物品。'],[12,'乘员与地面切断故障推进器供电，控制力矩陀螺接近饱和。'],[16,'旋转速率达到峰值，天和发动机反向喷气制动。'],[24,'姿态回到正常范围，机器人检查固定装置。']],
      ending:'姿态恢复正常，故障推进器已隔离。'},
    solar:{title:'太阳风暴 · 质子事件',duration:36,keyAt:16,alert:true,pip:['habitat','tianhe','node'],
      beats:[[0,'空间天气预警：太阳爆发 X 级耀斑，高能质子将在数十秒内到达。'],[5,'乘员进入屏蔽较好的休息区，机器人为敏感设备加装屏蔽水袋。'],[8,'柔性太阳翼开始收拢，减小受照面积并保护电池片。'],[16,'质子流抵达！舱内相机出现粒子击中噪点，地球上空亮起极光。'],[27,'通量回落，太阳翼重新展开，乘员返回岗位。']],
      ending:'质子事件结束，乘员剂量在限值内，太阳翼恢复发电。'}
  };
  // Legacy ids from earlier builds resolve to their realistic counterparts.
  const legacy={fleet:'capture',meteor:'debris',whale:'capture',gravity:'attitude'};
  class StationOrbitalEvents {
    constructor(d){this.d=d;this.s=d.s;this.liveEvent=true;this.time=0;this.duration=32;this.geometries=new Set();this.materials=new Set();this.textures=new Set();this.objects=[];this.beams=[];this.followers=[];this.restores=[];this.announced=new Set();this.disposed=false;}
    start(options={}){
      const requested=legacy[options.orbitalEvent]||options.orbitalEvent;
      this.id=stories[requested]?requested:'capture';this.story=stories[this.id];this.title=this.story.title;this.duration=this.story.duration;this.variant='live';
      this.options={...options,scenario:'visitor',orbitalEvent:this.id};
      const d=this.d;d.options=this.options;d.active=true;d.loading=false;d.paused=false;d.time=0;d.duration=this.duration;d.story={title:this.title};d.outcome=null;d.ui.hidden=true;d.stageActors=[];d.robot=null;
      document.body.dataset.stationEvent=this.id;
      try{
        this.scene=this.s.scene;this.camera=this.s.v.camera;
        this.effects=new T.Group();this.effects.name='轨道事件 / '+this.id;this.effects.userData.noAO=true;this.effects.userData.stationEvent=this.id;this.s.root.add(this.effects);
        this.tiangong=!this.s.shellStudy?.changed;this.measure();this.syncAnchor();
        this['make'+this.id[0].toUpperCase()+this.id.slice(1)]();
        if(this.story.alert)this.captureCabinLights();
        this.facts={keyScene:this.id,keySceneReached:false,keySceneAt:this.story.keyAt,completed:false,beats:[],sourceModel:this.tiangong?'tiangong':'selected-shell',independentStage:false,liveEvent:true};
        this.step();this.render();return this.snapshot();
      }catch(error){d.active=false;this.dispose();throw error;}
    }
    // Registered resource helpers (also used by the cabin incidents).
    material(color,options={}){const m=new T.MeshStandardMaterial({color:new T.Color(color).convertSRGBToLinear(),roughness:.5,metalness:.1,envMapIntensity:.15,...options});this.materials.add(m);return m;}
    glow(color,opacity=1){const m=new T.MeshBasicMaterial({color:new T.Color(color).convertSRGBToLinear(),transparent:opacity<1,opacity,depthWrite:opacity>=1,toneMapped:false});this.materials.add(m);return m;}
    mesh(parent,geometry,material,name,position=V()){this.geometries.add(geometry);const m=new T.Mesh(geometry,material);m.name=name;m.position.copy(position);parent.add(m);return m;}
    sphere(parent,r,material,name,position=V(),scale){const m=this.mesh(parent,new T.SphereGeometry(r,24,16),material,name,position);if(scale)m.scale.fromArray(scale);return m;}
    box(parent,size,material,name,position=V()){return this.mesh(parent,new T.BoxGeometry(...size),material,name,position);}
    ring(parent,r,material,name,position=V(),tube=.08){return this.mesh(parent,new T.TorusGeometry(r,tube,8,72),material,name,position);}
    group(name,parent=this.effects){const g=new T.Group();g.name=name;parent.add(g);return g;}
    track(name,root){this.objects.push({name,root});return root;}
    line(name,color,r=.055,parent=this.effects){const m=this.mesh(parent,new T.CylinderGeometry(r,r,1,8),this.glow(color,.55),name);m.userData.noAO=true;this.beams.push(m);return m;}
    join(mesh,a,b){mesh.position.copy(a).add(b).multiplyScalar(.5);const delta=b.clone().sub(a);mesh.scale.y=Math.max(.001,delta.length());mesh.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());}
    // A group that follows one cabin's exterior through extraction.
    follow(id){const g=this.group('随舱段 / '+id);g.userData.module=id;this.followers.push(g);return g;}
    measure(){
      // Real surface points on the loaded hull; constants cover alternate shells.
      this.at={};for(const [k,v]of Object.entries(anchors))this.at[k]=v.clone();
      if(!this.tiangong||!this.s.modules)return;
      const ray=new T.Raycaster(),root=this.s.root;root.updateMatrixWorld(true);
      // Only the hull batches are tested; the bolt and wire batches are large.
      const hit=(id,layers,origin,dir)=>{const g=this.s.modules.get(id);if(!g)return null;const meshes=g.children.filter(n=>n.isMesh&&layers.includes(n.name.split('-').pop()));if(!meshes.length)return null;const o=root.localToWorld(origin.clone()),dw=dir.clone().transformDirection(root.matrixWorld);ray.set(o,dw);const h=ray.intersectObjects(meshes,false)[0];return h?root.worldToLocal(h.point.clone()).sub(g.position):null;};
      const need={capture:['armBase','airlock'],debris:['wingHit','tianzhouAft','airlock'],resupply:['nodeTop'],attitude:['tianzhouSide','tianzhouAft'],solar:[]}[this.id]||[];
      const probes={armBase:['tianhe',['0'],V(0,12,-10.6),V(0,-1,0)],nodeTop:['node',['0'],V(-.1,12,1.4),V(0,-1,0)],wingHit:['mengtian',['7','8','9'],V(14.6,13.5,8),V(0,0,-1)],tianzhouAft:['tianzhou',['0'],V(-.1,.2,-40),V(0,0,1)],tianzhouSide:['tianzhou',['0'],V(8,0,-21.6),V(-1,0,0)],airlock:['airlock',['0'],V(-.1,-20,.9),V(0,1,0)]};
      for(const key of need){const [id,layers,origin,dir]=probes[key],p=hit(id,layers,origin,dir);if(p)this.at[key].copy(p);}
    }
    syncAnchor(){
      // Original exterior: identity frame and per-cabin followers. Alternate
      // shells: map the Tiangong frame onto the adopted shell's bounds.
      const shell=this.s.shellStudy?.changed?this.s.shellStudy.current?.model:null;
      if(!shell){this.effects.position.set(0,0,0);this.effects.scale.setScalar(1);for(const g of this.followers)g.position.copy(this.s.modules?.get(g.userData.module)?.position||V());this.anchorSource=this.s.exterior;return;}
      if(shell===this.anchorSource)return;this.anchorSource=shell;
      this.s.root.updateMatrixWorld(true);const inverse=this.s.root.matrixWorld.clone().invert(),bounds=new T.Box3(),relative=new T.Matrix4();
      shell.traverse(node=>{if(!node.isMesh||!node.geometry)return;node.geometry.computeBoundingBox();relative.multiplyMatrices(inverse,node.matrixWorld);bounds.union(node.geometry.boundingBox.clone().applyMatrix4(relative));});
      if(bounds.isEmpty())bounds.set(V(-12,-4,-12),V(12,4,12));
      const size=bounds.getSize(V()),k=Math.max(size.x,size.y,size.z)/50.3,center=bounds.getCenter(V());
      this.effects.scale.setScalar(k);this.effects.position.copy(center).sub(V(-1.4,0,-6.75).multiplyScalar(k));for(const g of this.followers)g.position.set(0,0,0);
      if(this.facts)this.facts.sourceModel='selected-shell';
    }
    // -------------------------------------------------- 失效卫星 · 机械臂捕获
    makeCapture(){
      const f=this.follow('tianhe');this.captureFrame=f;
      const arm=this.arm=K.roboticArm(this);arm.root.position.copy(this.at.armBase);f.add(arm.root);this.track('robotic-arm',arm.root);
      const sat=this.sat=K.satellite(this);f.add(sat.root);this.track('satellite',sat.root);
      const drone=this.drone=K.freeFlyer(this,{scale:3.4,accent:'#d08a3a'});f.add(drone.root);drone.root.name='舱外巡检机器人';this.track('inspection-robot',drone.root);
      this.puffs=new K.Particles(this,90,{soft:1.4,name:'冷气推力'});f.add(this.puffs.points);
      this.flash=K.sprite(this,'glow','#dff3ff',3);f.add(this.flash);this.glint=K.sprite(this,'spark','#fff6dc',2.4);f.add(this.glint);
      this.armLamp=K.sprite(this,'glow','#ffe9c4',1.2,.8);f.add(this.armLamp);
      this.ranging=this.line('激光测距','#7fe6ff',.012,f);
      // Capture geometry in the follower frame.
      const base=this.at.armBase,shoulder=base.clone().add(V(0,.59,0));this.captureAt=base.clone().add(V(3.2,4.3,.6));
      this.approach=this.captureAt.clone().sub(shoulder).normalize();this.release=base.clone().add(V(2.7,3.9,-2.6));
      this.releaseDir=this.release.clone().sub(shoulder).normalize();
      this.satStart=this.captureAt.clone().add(V(36,11,-7));this.tumbleAxis=V(.35,1,.2).normalize();
      this.captureQ=new T.Quaternion().setFromUnitVectors(V(0,1,0),this.approach);
      // Pose at the capture instant fixes the satellite to the end effector.
      arm.setAngles(this.armAngles(16));arm.root.updateMatrixWorld(true);f.updateMatrixWorld(true);
      const tipToFrame=new T.Matrix4().copy(f.matrixWorld).invert().multiply(arm.tip.matrixWorld),sat16=this.satFree(16),satMatrix=new T.Matrix4().compose(sat16.p,sat16.q,V(1,1,1));
      this.gripOffset=tipToFrame.clone().invert().multiply(satMatrix);
      this.droneHome=this.at.airlock.clone().add(V(0,-1.2,0));
    }
    satFree(t){
      // Drift in, decelerating; tumble slowed by the robot's plume, then aligned.
      const x=clamp(t/15.6,0,1),e=1-Math.pow(1-x,2.4),end=this.captureAt.clone().addScaledVector(this.approach,.62),p=this.satStart.clone().lerp(end,e);
      const w=.9*(1-.85*ramp(t,10,14.5)),angle=t<10?w*t:.9*10+(t-10)*w;
      const q=new T.Quaternion().setFromAxisAngle(this.tumbleAxis,angle+1.1),aligned=q.clone().slerp(this.captureQ,ramp(t,12.4,15.5));
      return{p,q:aligned,rate:w};
    }
    armAngles(t){
      const a=this.arm,stow=a.stowed,stand=a.solve(this.captureAt.clone().addScaledVector(this.approach,-1.1).sub(this.at.armBase),this.approach);
      const at=(p,dir)=>a.solve(p.clone().sub(this.at.armBase),dir),lerpA=(x,y,u)=>x.map((v,i)=>mix(v,y[i],u));
      if(t<5)return stow;if(t<10)return lerpA(stow,stand,ramp(t,5,10));
      if(t<16){const target=this.captureAt.clone().addScaledVector(this.approach,-1.1*(1-ramp(t,12.8,15.6)));return at(target,this.approach);}
      if(t<24){const u=ramp(t,17,23),p=this.captureAt.clone().lerp(this.release,u),dir=this.approach.clone().lerp(this.releaseDir,u).normalize();return at(p,dir);}
      const last=at(this.release,this.releaseDir);return lerpA(last,stow,ramp(t,25.5,33));
    }
    stepCapture(t){
      const arm=this.arm,f=this.captureFrame;arm.setAngles(this.armAngles(t));f.updateMatrixWorld(true);
      const sat=this.sat.root,frameInverse=new T.Matrix4().copy(f.matrixWorld).invert();
      if(t<16){const s=this.satFree(t);sat.position.copy(s.p);sat.quaternion.copy(s.q);}
      else if(t<24){const m=frameInverse.clone().multiply(arm.tip.matrixWorld).multiply(this.gripOffset);m.decompose(sat.position,sat.quaternion,sat.scale);sat.scale.setScalar(1);}
      else{
        if(!this.releaseState||this.releaseState.t>t){const keep=this.time;const m=new T.Matrix4();arm.setAngles(this.armAngles(24));f.updateMatrixWorld(true);m.copy(frameInverse).multiply(arm.tip.matrixWorld).multiply(this.gripOffset);const p=V(),q=new T.Quaternion();m.decompose(p,q,V());this.releaseState={t:24,p,q};arm.setAngles(this.armAngles(keep));f.updateMatrixWorld(true);}
        const dt=t-24,push=this.releaseDir.clone().multiplyScalar(.75);sat.position.copy(this.releaseState.p).addScaledVector(push,dt).add(V(.08,.05,0).multiplyScalar(dt*dt));
        sat.quaternion.copy(this.releaseState.q).multiply(new T.Quaternion().setFromAxisAngle(V(.2,1,.1).normalize(),dt*.12));sat.scale.setScalar(1);
      }
      sat.visible=true;
      // Inspection robot: leaves the airlock, paces the target, then returns.
      const s=this.satFree(Math.min(t,15.6)).p,beside=s.clone().add(V(2.4,-1.6,3.2)),watch=this.captureAt.clone().add(V(3.6,-.4,4.2)),home=this.droneHome;
      let dp;if(t<5)dp=home.clone();else if(t<10)dp=home.clone().lerp(beside,ramp(t,5,10));else if(t<14.5)dp=beside;else if(t<24)dp=beside.clone().lerp(watch,ramp(t,14.5,18));else dp=watch.clone().lerp(home,ramp(t,24,32));
      this.drone.root.position.copy(dp);this.drone.root.visible=t>4.2&&t<33;this.drone.root.lookAt(f.localToWorld(s.clone()));this.drone.pose(t,{reach:.2});
      // Cold-gas pulses aimed at the target during the despin.
      const towards=s.clone().sub(dp).normalize(),white=new T.Color('#e8f4ff');
      for(let i=0;i<this.puffs.count;i++){const cycle=(t*1.7+i*.618)%1,active=t>10.2&&t<14.6&&Math.sin(t*5+i)>-.2;if(!active){this.puffs.hide(i);continue;}const spread=V(Math.sin(i*2.1),Math.cos(i*1.7),Math.sin(i*3.3)).multiplyScalar(.25*cycle);const p=dp.clone().addScaledVector(towards,.6+cycle*1.6).add(spread);this.puffs.set(i,p.x,p.y,p.z,.25+cycle*.6,.55*(1-cycle),white);}
      this.puffs.commit();
      const tipLocal=f.worldToLocal(arm.tip.getWorldPosition(V())),grapple=f.worldToLocal(this.sat.grapple.getWorldPosition(V()));
      this.ranging.visible=t>9&&t<15.6;if(this.ranging.visible)this.join(this.ranging,tipLocal,grapple);
      this.armLamp.position.copy(f.worldToLocal(arm.lamp.getWorldPosition(V())));this.armLamp.material.opacity=.85*ramp(t,8.5,9.5)*(1-ramp(t,31,33));this.armLamp.visible=this.armLamp.material.opacity>.01;
      const sf=this.satFree(t);this.glint.position.copy(sat.position);this.glint.material.opacity=t<15?Math.pow(Math.max(0,Math.sin(sf.rate*t*2+1.3)),24):0;this.glint.visible=this.glint.material.opacity>.02;
      this.flash.position.copy(tipLocal);this.flash.material.opacity=pulse(t,15.9,17.2,.3);this.flash.visible=this.flash.material.opacity>.01;this.flash.scale.setScalar(1.2+2*lin(t,15.9,17));
      this.facts.capture={tumbleRate:+this.satFree(Math.min(t,16)).rate.toFixed(3),captured:t>=16&&t<24,released:t>=24,distance:+tipLocal.distanceTo(grapple).toFixed(3)};
    }
    // -------------------------------------------------- 空间碎片 · 规避变轨
    makeDebris(){
      const r=K.rand(11),dir=this.debrisDir=V(1,-.1,.28).normalize();this.chunks=[];
      for(let i=0;i<16;i++){const kind=i%3===0?'foil':i%3===1?'metal':'cell',m=K.fragment(this,kind,i+3,.28+r()*.35);this.effects.add(m);m.castShadow=false;
        const offset=V((r()-.5)*24,(r()-.5)*16,(r()-.5)*22),at=14+r()*5,speed=24+r()*14;this.chunks.push({mesh:m,closest:V(0,6,4).add(offset),at,speed,spin:V(r()*3,r()*3,r()*3)});this.track('debris-'+i,m);}
      // Fragment 0 strikes the starboard solar wing at the key instant.
      this.hit=this.at.wingHit.clone();Object.assign(this.chunks[0],{closest:this.hit.clone(),at:16,speed:34,impact:true});
      this.streaks=new K.Streaks(this,90,'高速碎片轨迹');this.effects.add(this.streaks.lines);this.streakData=[];for(let i=0;i<90;i++)this.streakData.push({closest:V((r()-.5)*70,(r()-.5)*40+4,(r()-.5)*60),at:13.6+r()*6.4,speed:70+r()*60,length:4+r()*7});
      this.glints=[];for(let i=0;i<6;i++){const g=K.sprite(this,'spark','#fff1d8',1.6);this.effects.add(g);this.glints.push(g);}
      const aft=this.follow('tianzhou');this.burn=[];for(let i=0;i<4;i++){const a=i/4*TAU+Math.PI/4,m=K.plume(this,6.5,1.05,'#ffd9a8');m.position.copy(this.at.tianzhouAft).add(V(Math.cos(a)*.48,Math.sin(a)*.48,-.1));m.rotation.x=Math.PI/2;aft.add(m);this.burn.push(m);}
      this.burnGlow=K.sprite(this,'glow','#ffd6a0',3.4);this.burnGlow.position.copy(this.at.tianzhouAft).add(V(0,0,-.4));aft.add(this.burnGlow);
      const wingFrame=this.follow('mengtian');this.wingFrame=wingFrame;
      this.impactFlash=K.sprite(this,'glow','#fff4e0',2);this.impactFlash.position.copy(this.hit).add(V(0,0,.1));wingFrame.add(this.impactFlash);
      this.spall=new K.Particles(this,140,{soft:1.1,core:.6,name:'撞击溅射'});wingFrame.add(this.spall.points);
      const scar=this.mesh(wingFrame,new T.CircleGeometry(.42,32),new T.MeshBasicMaterial({color:new T.Color('#1b120c').convertSRGBToLinear(),alphaMap:K.texture('glow'),transparent:true,opacity:0,depthWrite:false}),'太阳翼撞击坑',this.hit.clone().add(V(0,0,.03)));this.materials.add(scar.material);this.scar=scar;
      this.cracks=[];for(let i=0;i<6;i++){const a=i/6*TAU+.3,c=this.mesh(wingFrame,new T.BoxGeometry(.012,.55+(i%3)*.2,.004),this.material('#2a2622',{roughness:.9}),'电池片裂纹',this.hit.clone().add(V(Math.cos(a)*.32,Math.sin(a)*.32,.035)));c.rotation.z=a-Math.PI/2;c.visible=false;this.cracks.push(c);}
      this.drone=K.freeFlyer(this,{scale:3.4,accent:'#d08a3a'});this.drone.root.name='舱外巡检机器人';wingFrame.add(this.drone.root);this.track('inspection-robot',this.drone.root);
      this.spot=K.plume(this,1.8,.9,'#fff2c8');wingFrame.add(this.spot);this.droneHome=this.at.airlock.clone().add(V(0,-1.2,0));
    }
    stepDebris(t){
      const dir=this.debrisDir,warm=new T.Color('#ffd9b0');
      this.chunks.forEach((c,i)=>{const dt=t-c.at,p=c.closest.clone().addScaledVector(dir,c.speed*dt);c.mesh.position.copy(p);c.mesh.rotation.set(c.spin.x*t,c.spin.y*t,c.spin.z*t);c.mesh.visible=dt>-6&&(c.impact?dt<0:dt<4);if(i<this.glints.length){const g=this.glints[i];g.position.copy(p);g.visible=c.mesh.visible&&dt<-.6;g.material.opacity=.7*Math.pow(Math.max(0,Math.sin(t*3.1+i*1.7)),6)+.15;g.scale.setScalar(1.2+Math.min(6,-dt)*.5);}});
      this.streakData.forEach((s,i)=>{const dt=t-s.at;if(dt<-1.4||dt>1.4){this.streaks.hide(i);return;}const head=s.closest.clone().addScaledVector(dir,s.speed*dt),tail=head.clone().addScaledVector(dir,-s.length);this.streaks.set(i,head,tail,warm,(1-Math.abs(dt)/1.4)*.9);});this.streaks.commit();
      const burn=pulse(t,8,14,.8);this.burn.forEach((m,i)=>{m.visible=burn>.01;m.material.uniforms.uPower.value=burn*(.75+.08*Math.sin(t*31+i));m.material.uniforms.uTime.value=t;});this.burnGlow.visible=burn>.01;this.burnGlow.material.opacity=burn;
      const flash=pulse(t,15.95,17.6,.25);this.impactFlash.visible=flash>.01;this.impactFlash.material.opacity=flash;this.impactFlash.scale.setScalar(1+5*lin(t,15.95,16.8));
      const spark=new T.Color('#ffc58a');for(let i=0;i<this.spall.count;i++){const u=(t-16-(i%7)*.03)/2.2;if(u<0||u>1){this.spall.hide(i);continue;}const a=i*2.399,el=(i*.618)%1,d=V(Math.cos(a)*Math.sin(el*1.4),Math.sin(a)*Math.sin(el*1.4),Math.cos(el*1.4)).multiplyScalar(4.5*u*(.5+(i%5)*.2));const p=this.hit.clone().add(d);this.spall.set(i,p.x,p.y,p.z,.08+.12*(1-u),(1-u)*(i%3?1:.6),spark);}this.spall.commit();
      this.scar.material.opacity=.85*ramp(t,16,16.6);this.cracks.forEach(c=>c.visible=t>=16.2);
      // Inspection robot flies from the airlock to the impact site and back.
      const watch=this.hit.clone().add(V(.6,-.4,2.2)),home=this.droneHome,wing=this.wingFrame;
      let p;if(t<18.6)p=home;else if(t<23)p=home.clone().lerp(watch,ramp(t,18.6,23));else if(t<29)p=watch.clone().add(V(Math.sin(t*.8)*.3,Math.cos(t*.6)*.2,0));else p=watch.clone().lerp(home,ramp(t,29,34));
      this.drone.root.position.copy(p);this.drone.root.visible=t>18.2&&t<33.8;this.drone.root.lookAt(wing.localToWorld(this.hit.clone()));this.drone.pose(t,{reach:.4,work:t>23&&t<29?1:0});
      const scan=pulse(t,23,29,.6);this.spot.visible=scan>.01;if(this.spot.visible){this.spot.position.copy(p);this.spot.quaternion.setFromUnitVectors(V(0,-1,0),this.hit.clone().sub(p).normalize());this.spot.scale.set(1,p.distanceTo(this.hit)/1.8,1);this.spot.material.uniforms.uPower.value=.35*scan;this.spot.material.uniforms.uTime.value=t;}
      this.facts.debris={burn:+burn.toFixed(3),impact:t>=16,inspection:+scan.toFixed(3),powerLoss:t>=16?.4:0};
    }
    // -------------------------------------------------- 天舟货运飞船交会对接
    makeResupply(){
      const f=this.follow('node');this.dockFrame=f;const ship=this.ship=K.cargoShip(this);ship.root.rotation.x=Math.PI/2;f.add(ship.root);this.track('cargo-ship',ship.root);
      this.dockY=this.at.nodeTop.y+2.56;this.rcs=new K.Particles(this,100,{soft:1.3,name:'姿控喷气'});f.add(this.rcs.points);
      this.ranging=this.line('激光雷达测距','#8cf0d0',.012,f);this.contact=K.sprite(this,'glow','#e6f6ff',2.4);f.add(this.contact);
      this.portRing=this.mesh(f,new T.TorusGeometry(.5,.03,10,48),this.glow('#7fe6c8',.0),'对接口指示环',this.at.nodeTop.clone().add(V(0,.04,0)));this.portRing.rotation.x=Math.PI/2;this.portRing.userData.noAO=true;
    }
    stepResupply(t){
      const top=this.at.nodeTop,ship=this.ship.root,dockY=this.dockY,lateral=V(2.2,0,-1.4);
      let y,off;if(t<4){y=mix(46,18,1-Math.pow(1-t/4,2.2));off=1;}else if(t<9){y=18+Math.sin(t*1.2)*.08;off=1-ramp(t,5,9)*.6;}else if(t<15.6){y=mix(18,dockY,smooth((t-9)/6.6));off=.4*(1-ramp(t,9,14.5));}else{y=dockY-.12*ramp(t,15.6,16.6);off=0;}
      ship.position.set(top.x,y,top.z).addScaledVector(lateral,off);ship.rotation.set(Math.PI/2,0,(1-ramp(t,8,15))*.18+Math.sin(t*.7)*.01*(t<15.6?1:0));
      const docked=t>=15.6;this.rcs.points.visible=!docked;const white=new T.Color('#f2f7ff');
      for(let i=0;i<this.rcs.count;i++){const quad=i%4,cycle=(t*2.4+i*.37)%1,on=!docked&&Math.sin(t*3.3+quad*1.9)>.55;if(!on){this.rcs.hide(i);continue;}const a=quad/4*TAU+Math.PI/4,base=V(Math.cos(a)*.95,ship.position.y+2.5,Math.sin(a)*.95).add(V(ship.position.x,0,ship.position.z));const p=base.clone().add(V(Math.cos(a),(i%3-1)*.3,Math.sin(a)).multiplyScalar(cycle*1.4));this.rcs.set(i,p.x,p.y,p.z,.25+cycle*.7,.5*(1-cycle),white);}this.rcs.commit();
      this.ranging.visible=t>9&&t<15.6;if(this.ranging.visible)this.join(this.ranging,V(ship.position.x+.55*Math.cos(0),ship.position.y-1.95,ship.position.z+.52),top.clone());
      const contact=pulse(t,15.5,17.2,.25);this.contact.visible=contact>.01;this.contact.material.opacity=contact;this.contact.position.copy(top).add(V(0,.1,0));this.contact.scale.setScalar(1.5+2.5*lin(t,15.5,16.4));
      this.portRing.material.opacity=t<15.6?.25+.25*Math.sin(t*4):.6*(1-ramp(t,17,19));
      this.facts.resupply={range:+Math.max(0,y-dockY).toFixed(3),docked,hold:t>=4&&t<9};
      this.syncCargo(t);
    }
    // -------------------------------------------------- 推进器误喷 · 姿态失控
    makeAttitude(){
      const f=this.follow('tianzhou');this.stuck=K.plume(this,4.2,.8,'#ffe1b8');this.stuck.position.copy(this.at.tianzhouSide).add(V(.12,0,0));this.stuck.rotation.z=Math.PI/2;f.add(this.stuck);
      this.stuckGlow=K.sprite(this,'glow','#ffd8a8',1.6);this.stuckGlow.position.copy(this.stuck.position);f.add(this.stuckGlow);
      const front=this.follow('tianhe');this.counter=[];// Opposing thrusters on the port side brake the spin (plumes point outward, -X).
      for(const [frame,p]of [[front,this.at.tianheFront.clone().add(V(-1.7,0,-.8))],[f,this.at.tianzhouAft.clone().add(V(-1.2,0,1.2))]]){const m=K.plume(this,2.6,.55,'#e8f0ff');m.position.copy(p);m.rotation.z=-Math.PI/2;frame.add(m);this.counter.push(m);}
      const env=this.s.environment,sun=this.s.sun;this.saved={env:env.quaternion.clone(),sun:sun.position.clone()};
      this.restores.push(()=>{env.quaternion.copy(this.saved.env);sun.position.copy(this.saved.sun);this.s.v.renderer.shadowMap.needsUpdate=true;});
    }
    attitudeAngle(t){
      // Integrated rate profile: thruster-driven spin-up, counter-firing, then return to nominal.
      const max=T.MathUtils.degToRad(40);if(t<1)return 0;if(t<16)return max*.04*(t-1)*(t-1)/15;if(t<24){const s=t-16;return max*(.6+.08*(s-s*s/16));}return max*.92*(1-smooth((t-24)/8));
    }
    stepAttitude(t){
      const angle=this.attitudeAngle(t),axis=V(.12,1,.06).normalize(),q=new T.Quaternion().setFromAxisAngle(axis,angle);
      this.s.environment.quaternion.copy(this.saved.env).premultiply(q);this.s.sun.position.copy(this.saved.sun).applyQuaternion(q);
      if(Math.abs((this.lastShadowAngle??-1)-angle)>.01){this.lastShadowAngle=angle;this.s.v.renderer.shadowMap.needsUpdate=true;}
      const stuck=pulse(t,1,12,.3);this.stuck.visible=stuck>.01;this.stuck.material.uniforms.uPower.value=stuck*(.85+.15*Math.sin(t*41));this.stuck.material.uniforms.uTime.value=t;this.stuckGlow.visible=stuck>.01;this.stuckGlow.material.opacity=stuck;
      this.counter.forEach((m,i)=>{const on=t>16&&t<24&&Math.sin(t*6+i*2.1)>-.1;m.visible=on;m.material.uniforms.uPower.value=on?.8:0;m.material.uniforms.uTime.value=t;});
      const rate=t<1?0:t<16?.08*(t-1)/15*40:t<24?.08*(1-(t-16)/8)*40:0;
      this.facts.attitude={angle:+T.MathUtils.radToDeg(angle).toFixed(2),rate:+rate.toFixed(2),stuckThruster:stuck>.01};
    }
    // -------------------------------------------------- 太阳风暴 · 质子事件
    makeSolar(){
      const cam=this.s.v.camera,fwd=cam.getWorldDirection(V()),up=V(0,1,0).applyQuaternion(cam.quaternion),right=fwd.clone().cross(up).normalize();
      // The Sun sits in the current view, upper left behind the station.
      const inverse=new T.Matrix4().copy(this.s.root.matrixWorld).invert();this.sunDir=fwd.clone().addScaledVector(up,.3).addScaledVector(right,-.36).normalize().transformDirection(inverse);
      this.sunGroup=this.group('太阳与日冕');this.sunCore=K.sprite(this,'glow','#fff4dc',90);this.sunCorona=K.sprite(this,'glow','#ffd9a0',260,.45);this.sunFlare=K.sprite(this,'spark','#fff0d0',520,.0);
      for(const s of [this.sunCorona,this.sunCore,this.sunFlare]){s.position.copy(this.sunDir).multiplyScalar(820);this.sunGroup.add(s);}
      this.ghosts=[];for(let i=0;i<4;i++){const g=K.sprite(this,i%2?'flare-ring':'glow',['#9fd3ff','#ffd29a','#c6b4ff','#a8ffd8'][i],1,.0);this.effects.add(g);this.ghosts.push(g);}
      this.flux=new K.Streaks(this,260,'高能粒子流');this.effects.add(this.flux.lines);const r=K.rand(5);this.fluxData=[];
      const a=Math.abs(this.sunDir.y)<.9?V(0,1,0):V(1,0,0),u1=this.sunDir.clone().cross(a).normalize(),u2=this.sunDir.clone().cross(u1).normalize();
      for(let i=0;i<260;i++){const rad=Math.sqrt(r())*46,ang=r()*TAU;this.fluxData.push({offset:u1.clone().multiplyScalar(Math.cos(ang)*rad).addScaledVector(u2,Math.sin(ang)*rad).add(V(-1.4,0,-6.75)),phase:r(),speed:.55+r()*.5,length:5+r()*9});}
      // Aurora on the Earth, centred where the current view meets the globe.
      const earth=this.s.earth;if(earth){earth.updateMatrixWorld(true);const center=earth.getWorldPosition(V()),camPos=cam.getWorldPosition(V()),toC=center.clone().sub(camPos),along=toC.dot(fwd),closest=camPos.clone().addScaledVector(fwd,along),axisWorld=closest.sub(center).normalize().lerp(this.s.root.localToWorld(V(-1.4,0,-6.75)).sub(center).normalize(),.45).normalize();
        const radius=earth.geometry?.parameters?.radius||105,axisLocal=axisWorld.clone().transformDirection(new T.Matrix4().copy(earth.matrixWorld).invert());this.aurora=K.aurora(this,radius,axisLocal,.2);earth.add(this.aurora);this.restores.push(()=>this.aurora.parent?.remove(this.aurora));}
      this.prepareWingFold();
      const sun=this.s.sun;this.saved={sun:sun.position.clone(),sunIntensity:sun.intensity,ambient:this.s.ambient.intensity};
      this.restores.push(()=>{sun.position.copy(this.saved.sun);sun.intensity=this.saved.sunIntensity;this.s.ambient.intensity=this.saved.ambient;this.s.v.renderer.shadowMap.needsUpdate=true;this.setWingFold(0);for(const m of this.wingMaterials||[]){const state=m.userData.stationWingFold;if(state)state.uniforms=state.uniforms.filter(u=>u!==this.wingUniform);}});
    }
    prepareWingFold(){
      // Accordion retraction of the lab modules' flexible wings, done in the
      // vertex shader so the original 2.1 M-triangle exterior is never copied.
      this.wingUniform={value:0};if(!this.tiangong)return;const uniform=this.wingUniform,seen=new Set();
      for(const id of ['wentian','mengtian'])this.s.modules.get(id)?.traverse(node=>{
        if(!node.isMesh||!/-(6|7|8|9|10)$/.test(node.name))return;
        for(const m of Array.isArray(node.material)?node.material:[node.material]){if(seen.has(m))continue;seen.add(m);
          const shared=m.userData.stationWingFold;if(shared){shared.uniforms.push(uniform);continue;}
          const state=m.userData.stationWingFold={uniforms:[uniform],value:{value:0}};
          m.onBeforeCompile=shader=>{shader.uniforms.uWingFold=state.value;shader.vertexShader='uniform float uWingFold;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nif(uWingFold>0.0&&(transformed.x<-14.6||transformed.x>11.9)&&abs(transformed.y)>1.25){float s=sign(transformed.y);transformed.y=s*(1.25+(abs(transformed.y)-1.25)*(1.0-uWingFold));}');};
          m.customProgramCacheKey=()=> 'station-wing-fold';m.needsUpdate=true;}
      });
      this.wingMaterials=[...seen];
    }
    setWingFold(value){if(!this.wingUniform)return;this.wingUniform.value=value;for(const m of this.wingMaterials||[]){const state=m.userData.stationWingFold;if(state)state.value.value=Math.max(...state.uniforms.map(u=>u.value));}}
    stepSolar(t){
      const flare=ramp(t,1,3.5)*(1-.55*ramp(t,8,14)),storm=pulse(t,13.5,29,2),light=ramp(t,0,4)*(1-ramp(t,32,36));
      this.sunCore.material.opacity=.85+.15*flare;this.sunCorona.material.opacity=.35+.4*flare;this.sunFlare.material.opacity=.75*flare;this.sunCore.scale.setScalar(90*(1+.25*flare));
      const sun=this.s.sun,target=this.sunDir.clone().multiplyScalar(this.saved.sun.length());sun.position.copy(this.saved.sun).lerp(target,light);this.s.ambient.intensity=this.saved.ambient*(1+.35*light);
      if(Math.abs((this.lastLight??-1)-light)>.02){this.lastLight=light;this.s.v.renderer.shadowMap.needsUpdate=true;}
      const pale=new T.Color('#ffe9c0');this.fluxData.forEach((p,i)=>{if(storm<.01){this.flux.hide(i);return;}const u=(t*p.speed*.5+p.phase)%1,head=p.offset.clone().addScaledVector(this.sunDir,mix(85,-85,u)),tail=head.clone().addScaledVector(this.sunDir,p.length);this.flux.set(i,head,tail,pale,storm*.55*Math.sin(u*Math.PI));});this.flux.commit();
      if(this.aurora){this.aurora.material.uniforms.uPower.value=ramp(t,12,18)*(1-ramp(t,30,35));this.aurora.material.uniforms.uTime.value=t;}
      this.setWingFold(.8*ramp(t,8,15.5)*(1-ramp(t,26.5,33)));
      this.facts.solar={protonFlux:Math.round(10+storm*12000),wingFold:+this.wingUniform.value.toFixed(3),aurora:+(this.aurora?.material.uniforms.uPower.value||0).toFixed(3),dose:+(.02+storm*.9).toFixed(2)};
    }
    updateGhosts(){
      if(this.id!=='solar'||!this.ghosts)return;const cam=this.s.v.camera,sunWorld=this.s.root.localToWorld(this.sunDir.clone().multiplyScalar(820)),ndc=sunWorld.clone().project(cam);
      const visible=ndc.z<1&&Math.abs(ndc.x)<1.2&&Math.abs(ndc.y)<1.2,flare=this.sunFlare.material.opacity;
      this.ghosts.forEach((g,i)=>{const k=[-.35,-.7,-1.05,-1.5][i],p=V(ndc.x*k,ndc.y*k,.2).unproject(cam);g.position.copy(this.effects.worldToLocal(p));const dist=p.distanceTo(cam.position);g.scale.setScalar(dist*[.05,.11,.035,.16][i]);g.material.opacity=visible?(.18+.5*flare)*[.6,.35,.8,.25][i]:0;g.visible=g.material.opacity>.01;});
    }
    // -------------------------------------------------- cabins: lights, cargo, loose items, robots
    captureCabinLights(){
      this.cabinLights=[];
      for(const room of this.s.rooms?.values()||[]){const light=room.materials?.light;if(!light)continue;const clone=light.clone();this.materials.add(clone);const base=clone.color.clone(),swaps=[];
        room.root.traverse(node=>{if(node.isMesh&&node.material===light){swaps.push(node);node.material=clone;}});
        const lamps=room.lights?.children||[],colors=lamps.map(l=>l.color.clone());this.cabinLights.push({clone,base,swaps,light,lamps,colors});}
      this.restores.push(()=>{for(const c of this.cabinLights){for(const n of c.swaps)n.material=c.light;c.lamps.forEach((l,i)=>l.color.copy(c.colors[i]));}});
    }
    syncCabinLights(t){
      if(!this.cabinLights)return;const amber=new T.Color('#ffb15c').convertSRGBToLinear(),k=(this.id==='solar'?.55:.75)*pulse(t,.5,this.duration-3,1)*(.55+.45*Math.max(0,Math.sin(t*4.2)));
      for(const c of this.cabinLights){c.clone.color.copy(c.base).lerp(amber,k);c.lamps.forEach((l,i)=>l.color.copy(c.colors[i]).lerp(amber,k*.6));}
    }
    // Each scene also staffs the main cabin with a free-flying helper robot,
    // so the collaboration reads even when the user placed no robots there.
    cabinHelpers(){
      if(this.helpers)return this.helpers;this.helpers=[];
      const rooms=this.story.pip.slice(0,this.id==='attitude'?3:2);
      for(const id of rooms){const room=this.s.getRoom?.(id);if(!room)continue;const frame=new T.Group();frame.name='事件舱内协作 / '+id;frame.userData.noAO=true;room.root.add(frame);this.restores.push(()=>frame.parent?.remove(frame));
        const robot=K.freeFlyer(this,{accent:'#4f86c6',scale:1.25});frame.add(robot.root);const spec=room.spec,W=spec.width,L=spec.length;
        const items=[];const count=this.id==='resupply'?4:this.id==='attitude'?4:this.id==='debris'?2:this.id==='solar'?1:0;
        for(let i=0;i<count;i++){const p=K.pouch(this,i+id.length);if(this.id==='solar'){p.scale.set(2.6,.5,3.2);p.children[0].material=this.material('#c9d7de',{roughness:.5});}frame.add(p);items.push(p);}
        let ring=null;if(this.id==='resupply'&&id==='node'){ring=this.mesh(frame,new T.TorusGeometry(.55,.07,12,40),this.material('#a9b4bb',{metalness:.7,roughness:.35}),'对接通道舱口',V(0,3.25,0));ring.rotation.x=Math.PI/2;}
        this.helpers.push({id,room,frame,robot,items,W,L,ring,primary:this.helpers.length===0});}
      return this.helpers;
    }
    syncCargo(t){this.syncHelpers(t);}
    syncHelpers(t){
      for(const h of this.cabinHelpers()){
        const {robot,items,W,L}=h,r=robot.root,phase=t*.6,base=V(-W*.18,1.55,-L*.12);let reach=.3,grip=.5,work=0;r.visible=t<this.duration-.5;
        if(this.id==='capture'){r.position.set(-W*.22,1.45+.05*Math.sin(t),-L*.28+.3*Math.sin(phase*.5));r.rotation.y=Math.PI/2;reach=.15;work=t>8&&t<26?1:0;}
        else if(this.id==='debris'){const u=ramp(t,3,10);r.position.copy(base).lerp(V(W*.28,1.2,L*.1),u);r.rotation.y=-Math.PI/2*u;reach=.8*u;grip=u>.95?.1:.6;items.forEach((p,i)=>{p.position.set(W*.3,.7+i*.25,L*.1+i*.3-.2*(1-u));p.rotation.set(0,.2*i,0);});work=u>.95&&u<1?1:0;}
        else if(this.id==='resupply'){
          // Bags come through the overhead docking hatch; the robot stows them.
          items.forEach((p,i)=>{const s=19+i*2.8,u=ramp(t,s,s+2.6),down=V(.05*i,3.15,0).lerp(V(-.1+.05*i,1.7,.2),ramp(t,s,s+1.1)),stow=V(W*.32,.6+i*.32,-L*.25+i*.18);p.visible=t>s-.2;p.position.copy(down).lerp(stow,ramp(t,s+1.1,s+2.6));p.rotation.set(.4*(1-u),i*.4+t*.2*(1-u),0);});
          const active=items.findIndex((p,i)=>t>19+i*2.8&&t<19+i*2.8+2.6);const target=active>=0?items[active].position.clone().add(V(-.18,.12,0)):V(-W*.12,1.6,-L*.18);r.position.lerp(target,.25);if(t<1)r.position.copy(target);reach=active>=0?.9:.3;grip=active>=0?.1:.6;work=active>=0?1:0;}
        else if(this.id==='attitude'){
          // Loose items drift with the rotating cabin, then the robot collects them.
          const drift=ramp(t,3,15);items.forEach((p,i)=>{const start=V(-W*.15+i*.25,1.1+i*.25,-L*.2+i*.35),wall=V(W*.36,1.6+Math.sin(i)*.4,L*.18+i*.15),stow=V(-W*.3,.7+i*.18,L*.3);const collect=ramp(t,18+i*2,20+i*2);p.position.copy(start).lerp(wall,drift).lerp(stow,collect);p.rotation.set(t*.5*(1-collect)+i,t*.3*(1-collect),i);});
          const idx=items.findIndex((p,i)=>t>17.4+i*2&&t<20+i*2);const target=idx>=0?items[idx].position.clone().add(V(-.2,.1,0)):V(-W*.1,1.5,L*.05);r.position.lerp(target,.2);if(t<1)r.position.copy(target);reach=idx>=0?.9:.2;grip=idx>=0?.1:.6;work=idx>=0?1:0;}
        else if(this.id==='solar'){const u=ramp(t,5,12),slab=items[0];if(slab){slab.position.copy(V(-W*.1,1.6,L*.1)).lerp(V(W*.42,1.5,-L*.3),u);slab.rotation.set(0,Math.PI/2*u,0);}r.position.copy(V(-W*.05,1.7,L*.1)).lerp(V(W*.3,1.6,-L*.3),u);r.rotation.y=-Math.PI/2*u;reach=.7*u;grip=u<.98?.1:.6;work=u>0&&u<1?1:0;}
        robot.pose(t,{reach,grip,work});robot.led.material.color.set(work?'#ffd27a':'#7ce8d8').convertSRGBToLinear();
      }
    }
    // Information for the picture-in-picture cabin view.
    pipInfo(){
      const t=this.time,f=this.facts||{};let metric='';
      if(this.id==='solar')metric='质子通量 '+(f.solar?.protonFlux||10)+' pfu · 舱内剂量率 '+(f.solar?.dose||.02)+' mGy/h';
      else if(this.id==='attitude')metric='姿态偏差 '+(f.attitude?.angle||0).toFixed(1)+'° · 角速度 '+(f.attitude?.rate||0).toFixed(1)+'°/s';
      else if(this.id==='capture')metric=t<16?'目标翻滚 '+((f.capture?.tumbleRate||0)*57.3).toFixed(1)+'°/s':t<24?'已捕获 · 机械臂载荷 '+(t<20?'稳定':'转移中'):'目标已释放';
      else if(this.id==='resupply')metric=f.resupply?.docked?'对接完成 · 货包转运':'相对距离 '+((f.resupply?.range||0)*1.9).toFixed(1)+' m';
      else if(this.id==='debris')metric=t<16?'碎片到达倒计时 '+Math.max(0,16-t).toFixed(0)+' s':'撞击点 梦天太阳翼 · 供电 -0.4%';
      return{modules:this.story.pip,metric,noise:this.id==='solar'?pulse(t,15,29,1.5):0,alert:!!this.story.alert&&t<this.duration-3};
    }
    announce(t){
      const chat=this.d.o?.chat;if(!chat)return;
      for(const [at,text]of this.story.beats)if(t>=at-1e-6&&!this.announced.has(at)){this.announced.add(at);if(at>0)chat.add(text,'空间站');}
      if(t>=this.duration-1.5&&!this.announced.has('end')){this.announced.add('end');chat.add(this.story.ending,'空间站');}
    }
    step(){
      const t=this.time;for(const b of this.beams)b.visible=false;
      this['step'+this.id[0].toUpperCase()+this.id.slice(1)](t);
      if(this.id!=='resupply')this.syncHelpers(t);this.syncCabinLights(t);
      this.facts.keySceneReached=t>=this.story.keyAt-1e-6;this.facts.completed=t>=this.duration-1e-6;const stage=t<5?0:t<12?1:t<23?2:3;if(!this.facts.beats.includes(stage))this.facts.beats.push(stage);
      if(t>=this.duration-3)this.d.outcome={code:this.id+'-resolved',title:this.story.ending,detail:'轨道事件已自动完成'};
      this.announce(t);this.effects.updateMatrixWorld(true);
    }
    tick(dt){if(!this.d.active||this.d.paused||!Number.isFinite(dt)||dt<=0)return;let left=Math.min(dt,this.duration-this.time);while(left>1e-8){const step=Math.min(1/30,left);this.time=Math.min(this.duration,this.time+step);this.d.time=this.time;this.step();left-=step;}if(this.time>=this.duration-1e-6){this.time=this.d.time=this.duration;this.step();}this.refreshUI();}
    narrative(){const t=this.time,beat=[...this.story.beats].reverse().find(([at])=>t>=at)||this.story.beats[0];return{stage:t>=this.duration?'事件已结束':t<5?'轨道事件 · 预警':t<12?'轨道事件 · 协同处置':t<23?'轨道事件 · 关键情景':'轨道事件 · 恢复',caption:t>=this.duration-3?this.story.ending:beat[1]};}
    choose(){return{message:'事件自动发展，可继续观测或发送“清除事件”。'};}
    refreshUI(){}
    render(){if(this.disposed)return;this.syncAnchor();this.updateGhosts();this.effects?.updateMatrixWorld(true);this.refreshUI();}
    snapshot(){return{active:this.d.active,orbitalEvent:this.id,scenario:'visitor',title:this.title,time:+this.time.toFixed(4),duration:this.duration,paused:this.d.paused,variant:this.variant,options:{...this.options},...this.narrative(),outcome:this.d.outcome?{...this.d.outcome}:null,facts:JSON.parse(JSON.stringify(this.facts)),objects:this.objects.map(({name,root})=>({name,position:root.position.toArray(),rotation:[root.rotation.x,root.rotation.y,root.rotation.z],visible:root.visible})),effects:{beams:this.beams.filter(b=>b.visible).length,helpers:(this.helpers||[]).length,cabinAlert:!!this.cabinLights}};}
    dispose(){if(this.disposed)return;this.disposed=true;for(const restore of this.restores.splice(0).reverse()){try{restore();}catch(error){console.warn(error);}}this.effects?.parent?.remove(this.effects);for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose();for(const t of this.textures)t.dispose();delete document.body.dataset.stationEvent;this.d.stageActors=[];this.d.robot=null;this.scene=null;}
  }
  C.StationOrbitalEvents=StationOrbitalEvents;C.stationOrbitalStories=stories;C.stationOrbitalLegacy=legacy;
})();
