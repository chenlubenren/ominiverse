/* Short-film partners: compact free-flying instruments inspired by 轨道机械志.
 * Keeps the orbital actor API; every story contact names a real visible tool.
 */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,clamp=T.MathUtils.clamp;
  const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
  const designs={science:'flyer',medical:'jelly',cargo:'octopus'};
  C.makeStationShortRobot=(spec={})=>{
    const root=C.makeOrbitalRobot(spec),d=root.userData,role=d.role,body=d.body;
    const shell=C.material('#f1eee5',{metalness:.22,roughness:.32}),dark=C.material('#1a2830',{metalness:.52,roughness:.35}),metal=C.material('#758b94',{metalness:.8,roughness:.28}),orange=C.material('#f4a54b',{metalness:.35,roughness:.3}),soft=C.material('#dae6e7',{roughness:.85,metalness:.03});
    const light=C.material(role==='medical'?'#a4f5df':'#b1f7f1',{emissive:role==='medical'?'#65d9b2':'#75e5df',emissiveIntensity:.65,roughness:.35});
    const rig={petals:[],fins:[],ribs:[],aux:[],eyes:[],pulses:[],motors:[],pump:null,toolSpinner:null},tools={};
    function mesh(p,g,m,n,xyz=[0,0,0]){const o=new T.Mesh(g,m);o.name=n;o.position.set(...xyz);o.castShadow=!m.transparent;o.receiveShadow=true;p.add(o);return o;}
    function sphere(p,r,xyz,m,n){const o=mesh(p,new T.SphereGeometry(1,24,16),m,n,xyz);o.scale.set(...r);return o;}
    function box(p,s,xyz,m,n,r=.012){return mesh(p,C.roundedRobotBox(...s,Math.min(r,...s.map(v=>v*.4))),m,n,xyz);}
    function ring(p,r,t,xyz,m,n){return mesh(p,new T.TorusGeometry(r,t,8,40),m,n,xyz);}
    function group(p,n,xyz=[0,0,0]){const o=new T.Group();o.name=n;o.position.set(...xyz);p.add(o);return o;}
    function marker(p,n,xyz){const o=group(p,'physical-'+n+'-contact',xyz);tools[n]=o;return o;}
    function tube(p,points,r,m,n){return mesh(p,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(a=>V(...a))),Math.max(12,points.length*3),r,6,false),m,n);}
    function cylinder(p,r,h,xyz,m,n){return mesh(p,new T.CylinderGeometry(r,r,h,20),m,n,xyz);}
    const obsolete=role==='science'?/^(sealed-spherical-core|equatorial-service-band|protective-gimbal|gimbal-navigation-light|gimbal-bearing|bearing-cap)$/:
      role==='medical'?/^(sealed-medical-capsule|medical-service-band|protected-instrument-pod|instrument-pod-accent|care-beacon-|diagnostic-)/:
      /^(sealed-engineering-payload|payload-|structural-cage-rail|sealed-payload-hatch|recessed-service-fastener|protected-side-vent|rotary-seal-tool|seal-status)/;
    root.traverse(o=>{if(o.isMesh&&(obsolete.test(o.name)||/^(optical-|sensor-visor|spectral-lens|peripheral-sensor)/.test(o.name)))o.visible=false;});
    // Existing electric ducts remain operational; thin vanes protect each port.
    for(const port of root.children.filter(o=>o.name.startsWith('duct-'))){
      const r=role==='science'?.047:role==='medical'?.056:.076;
      if(port.name.startsWith('duct-y')){
        const outward=port.position.y>d.height/2?1:-1;
        port.position.y=d.height/2+(role==='medical'?(outward>0?.30:-.09):outward*(role==='cargo'?.25:.245));
        port.position.z=-.11;
      }
      if(port.name.startsWith('duct-z'))port.position.y=d.height/2-(role==='medical'?.09:.10);
      if(role==='cargo'&&port.name.startsWith('duct-x'))port.position.x=Math.sign(port.position.x)*.43;
      for(let i=-1;i<=1;i++)box(port,[r*1.35,.004,.012],[0,i*r*.36,.035],shell,'duct-safety-louvre',.001);
    }
    if(role==='cargo')for(const port of root.children.filter(o=>o.name.startsWith('attitude-duct-'))){port.position.x=Math.sign(port.position.x)*.25;port.position.z=Math.sign(port.position.z)*.15;}
    const sensor=d.sensor;sensor.position.set(0,role==='medical'?.005:.07,role==='cargo'?.265:role==='medical'?.314:.223);
    sphere(sensor,[role==='cargo'?.19:.15,.087,.041],[0,0,0],dark,'short-expression-screen');
    for(const sign of [-1,1]){
      const eye=sphere(sensor,[.022,.035,.008],[sign*.058,.008,.040],light,'short-expression-eye');rig.eyes.push(eye);
      const bezel=ring(sensor,.028,.003,[sign*.058,.008,.042],metal,'optical-eye-bezel');bezel.scale.y=1.2;
    }
    box(sensor,[.045,.006,.007],[0,-.047,.040],orange,'expression-mouth',.002);
    // Shared top pan/tilt camera has a real lens and amber bearing collars.
    const camera=group(body,'top-inspection-gimbal',[0,role==='medical'?.34:.255,-.025]);rig.camera=camera;
    cylinder(camera,.025,.055,[0,.015,0],metal,'camera-pedestal');
    sphere(camera,[.055,.041,.038],[0,.059,0],shell,'camera-head');ring(camera,.023,.006,[0,.059,.037],dark,'camera-optic');
    sphere(camera,[.017,.017,.006],[0,.059,.041],light,'camera-optic-glass');
    if(role==='science'){
      sphere(body,[.245,.245,.230],[0,0,0],dark,'flyer-seam-underbody');
      // Separate ivory shell sectors leave actual narrow dark panel seams.
      for(let i=0;i<6;i++)mesh(body,new T.SphereGeometry(.255,12,12,i*Math.PI/3+.015,Math.PI/3-.03,.12,Math.PI-.24),shell,'flyer-shell-sector-'+i).scale.z=.945;
      const belt=ring(body,.257,.011,[0,-.005,0],orange,'flyer-orange-equator');belt.rotation.x=Math.PI/2;
      for(const sign of [-1,1]){
        const fan=group(body,'flyer-side-fan',[sign*.302,-.015,0]);fan.rotation.y=sign*Math.PI/2;
        const shroud=cylinder(fan,.087,.065,[0,0,0],shell,'flyer-ducted-fan-shell');shroud.rotation.x=Math.PI/2;
        ring(fan,.071,.013,[0,0,.036],dark,'flyer-ducted-fan-rim');ring(fan,.080,.005,[0,0,.035],orange,'flyer-fan-safety-rim');
        const rotor=group(fan,'flyer-fan-rotor',[0,0,.038]);rig.motors.push(rotor);
        for(let i=0;i<4;i++){const b=box(rotor,[.12,.008,.007],[0,0,0],metal,'flyer-fan-blade',.002);b.rotation.z=i*Math.PI/4;}
        for(let i=-1;i<=1;i++)box(fan,[.12,.004,.008],[0,i*.032,.046],shell,'flyer-fan-guard',.001);
      }
      // Petalled scoop: the centre is the capture attachment, never the root.
      const basket=group(body,'water-capture-basket',[0,-.14,.31]);
      cylinder(basket,.030,.15,[0,.015,-.08],metal,'basket-support-neck').rotation.x=Math.PI/2;
      ring(basket,.107,.009,[0,0,0],orange,'capture-basket-rim');
      ring(basket,.074,.006,[0,0,-.028],dark,'capture-basket-back');
      for(let i=0;i<6;i++){
        const pivot=group(basket,'capture-petal-pivot-'+i,[Math.cos(i*Math.PI/3)*.104,Math.sin(i*Math.PI/3)*.104,0]);pivot.rotation.z=i*Math.PI/3;
        const petal=group(pivot,'capture-petal-'+i);rig.petals.push(petal);
        tube(petal,[[0,0,0],[.022,0,.04],[.015,0,.085],[-.012,0,.12]],.007,shell,'capture-soft-petal');
        sphere(petal,[.010,.015,.018],[-.012,0,.12],soft,'capture-silicone-fingertip');
      }
      marker(basket,'capture',[0,0,.066]);
      // A separate folding arm holds the cup away from the water basket.
      // Its .55 m deployed reach is used only for contact; transit is folded.
      const shoulder=group(body,'leftShoulder',[-.185,-.11,.02]);
      sphere(shoulder,[.035,.035,.035],[0,0,0],metal,'cup-arm-shoulder-bearing');
      box(shoulder,[.028,.22,.033],[0,-.11,0],shell,'cup-arm-upper-link',.009);
      const elbow=group(shoulder,'leftElbow',[0,-.22,0]);sphere(elbow,[.029,.029,.029],[0,0,0],orange,'cup-arm-elbow-bearing');
      box(elbow,[.023,.23,.027],[0,-.115,0],metal,'cup-arm-lower-link',.008);
      const wrist=group(elbow,'leftWrist',[0,-.23,0]);sphere(wrist,[.025,.025,.025],[0,0,0],dark,'cup-arm-wrist-coupler');
      cylinder(wrist,.014,.062,[0,-.038,0],shell,'cup-gripper-neck');
      const claws=[];
      for(const sign of [-1,1]){
        const finger=group(wrist,'cup-soft-gripper-'+sign,[sign*.029,-.065,0]);
        box(finger,[.011,.053,.024],[0,-.018,0],shell,'cup-claw-finger',.004);
        box(finger,[.016,.020,.028],[-sign*.005,-.038,0],soft,'cup-claw-silicone-pad',.004);claws.push(finger);
      }
      const arm={sign:-1,shoulder,elbow,wrist,claws,filmTipLength:.10,shortCupArm:true};d.arms.push(arm);rig.cupArm=arm;
      Object.assign(d.joints,{leftShoulder:shoulder,leftElbow:elbow,leftWrist:wrist});marker(wrist,'cup',[0,-.10,0]);
      d.radius=.45;
    }else if(role==='medical'){
      const rim=cylinder(body,.311,.068,[0,-.01,0],shell,'jelly-service-rim');
      const upper=ring(body,.31,.008,[0,.025,0],orange,'jelly-orange-rim');upper.rotation.x=Math.PI/2;
      const lower=ring(body,.304,.008,[0,-.048,0],dark,'jelly-bottom-rim');lower.rotation.x=Math.PI/2;
      const glass=C.material('#c5eef0',{transparent:true,opacity:.17,roughness:.08,metalness:.15,depthWrite:false,side:T.DoubleSide});
      mesh(body,new T.SphereGeometry(.305,32,16,0,Math.PI*2,0,Math.PI/2),glass,'jelly-transparent-dome',[0,.025,0]);
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6,pts=[];for(let j=0;j<=8;j++){const th=j*Math.PI/16;pts.push([Math.cos(a)*.307*Math.cos(th),.025+.307*Math.sin(th),Math.sin(a)*.307*Math.cos(th)]);}
        const rib=tube(body,pts,.006,shell,'jelly-umbrella-rib-'+i);rig.ribs.push(rib);
      }
      const pump=group(body,'visible-medical-pump',[0,.10,0]);rig.pump=pump;
      cylinder(pump,.092,.14,[0,0,0],metal,'pump-canister');cylinder(pump,.096,.026,[0,.082,0],orange,'pump-orange-cap');
      for(let i=0;i<4;i++){const a=i*Math.PI/2;const tank=cylinder(body,.035,.13,[Math.cos(a)*.17,.10,Math.sin(a)*.17],soft,'sterile-fluid-cartridge');ring(tank,.035,.005,[0,.043,0],orange,'fluid-cartridge-ring').rotation.x=Math.PI/2;}
      for(const sign of [-1,1])tube(body,[[sign*.17,.1,0],[sign*.20,.19,-.04],[sign*.07,.20,-.04],[sign*.06,.14,0]],.008,light,'visible-fluid-line');
      // Vital dots move around the rim; no fine print is required in the film.
      for(let i=0;i<16;i++){const a=i*Math.PI/8;const pulse=sphere(body,[.011,.012,.006],[Math.sin(a)*.311,-.008,Math.cos(a)*.311],light,'jelly-vital-band');pulse.rotation.y=a;rig.pulses.push(pulse);}
      for(const sign of [-1,1]){
        const aux=group(body,'jelly-auxiliary-instrument',[sign*.23,-.055,-.12]);rig.aux.push({root:aux,sign});
        sphere(aux,[.025,.025,.025],[0,0,0],orange,'aux-shoulder');
        tube(aux,[[0,0,0],[sign*.027,-.07,.006],[sign*.04,-.12,.028],[sign*.025,-.16,.06]],.015,shell,'jelly-articulated-soft-arm');
        for(let i=1;i<=4;i++)sphere(aux,[.018,.010,.018],[sign*(i<3?i*.013:.025),-i*.037,i*.012],dark,'aux-joint-collar');
        const cuff=ring(aux,.030,.009,[sign*.025,-.17,.065],soft,'aux-oximeter-cuff');cuff.rotation.x=Math.PI/2;
      }
      d.radius=.50;
    }else{
      sphere(body,[.302,.228,.268],[0,.035,0],dark,'octopus-underbody');
      mesh(body,new T.SphereGeometry(.32,32,18,0,Math.PI*2,.0,Math.PI*.57),shell,'octopus-rounded-main-shell',[0,.035,0]).scale.set(1,.79,.90);
      const band=ring(body,.312,.013,[0,.015,0],orange,'octopus-equatorial-service-ring');band.rotation.x=Math.PI/2;band.scale.y=.90;
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4,tubePts=[];for(let j=0;j<=6;j++){const th=.15+j*.23;tubePts.push([Math.cos(a)*.322*Math.sin(th),.035+.254*Math.cos(th),Math.sin(a)*.290*Math.sin(th)]);}
        tube(body,tubePts,.0035,dark,'octopus-shell-panel-seam');
      }
      for(const sign of [-1,1]){
        // Two low-reach auxiliary arms hold inspection lights while main wrists work.
        const aux=group(body,'octopus-auxiliary-arm',[sign*.20,-.11,-.12]);rig.aux.push({root:aux,sign});
        const joints=[];let parent=aux;
        for(let i=0;i<5;i++){
          const j=group(parent,'octopus-flex-segment-'+i,[i?0:0,i?-.045:0,0]);sphere(j,[.027,.027,.027],[0,0,0],dark,'flex-joint');
          const casing=cylinder(j,.026,.040,[0,-.023,0],shell,'flex-white-link');ring(j,.026,.003,[0,-.022,0],orange,'flex-collar').rotation.x=Math.PI/2;
          j.rotation.z=sign*.15;j.rotation.x=-.13;joints.push(j);parent=j;
        }
        sphere(parent,[.030,.028,.030],[0,-.045,0],metal,'inspection-tool-head');sphere(parent,[.021,.009,.021],[0,-.070,0],light,'inspection-lamp');rig.aux[rig.aux.length-1].joints=joints;
      }
      d.radius=.65;
    }
    // Preserve the original articulated arm joints so the film IK remains valid.
    for(const arm of d.arms){
      const side=arm.sign<0?'left':'right';
      if(role==='cargo')arm.shoulder.position.x=arm.sign*.27;
      for(const joint of [arm.shoulder,arm.elbow]){
        const ringJoint=ring(joint,joint===arm.shoulder?.039:.031,.006,[0,0,0],orange,'precision-orange-bearing');ringJoint.rotation.y=Math.PI/2;
      }
      if(role==='medical'){
        cylinder(arm.wrist,.010,.074,[0,-.074,0],metal,'medical-wrist-contact-probe');
        if(side==='right'){
          sphere(arm.wrist,[.017,.016,.017],[0,-.12,0],soft,'medical-soft-contact-tip');marker(arm.wrist,'probe',[0,-.12,0]);
        }else{
          const rail=group(arm.wrist,'medical-front-rescue-handgrip',[0,-.12,0]);
          cylinder(rail,.014,.13,[0,0,0],orange,'front-rescue-soft-grip').rotation.z=Math.PI/2;
          for(const sign of [-1,1])sphere(rail,[.020,.020,.020],[sign*.065,0,0],soft,'front-rescue-soft-grip-stop');
          marker(arm.wrist,'frontRescue',[0,-.12,0]);rig.rescueArm=arm;
        }
        arm.filmTipLength=.12;
      }else if(role==='cargo'&&side==='right'){
        cylinder(arm.wrist,.022,.065,[0,-.065,0],metal,'sealing-tool-spindle');
        const spin=group(arm.wrist,'seal-tool-bearing',[0,-.11,0]);rig.toolSpinner=spin;
        cylinder(spin,.069,.025,[0,0,0],dark,'seal-pad-backing');cylinder(spin,.063,.014,[0,-.018,0],soft,'seal-compliant-contact-pad');
        const rim=ring(spin,.063,.006,[0,-.025,0],orange,'seal-pressure-ring');rim.rotation.x=Math.PI/2;
        arm.filmTipLength=.135;marker(arm.wrist,'seal',[0,-.135,0]);
      }
    }
    // Rear rescue rail is mounted to the shell. Its marker is the actual grasp.
    const railZ=role==='cargo'?-.36:-.32,rail=group(body,'short-rear-rescue-rail',[0,-.01,railZ]);
    cylinder(rail,.016,.24,[0,0,0],orange,'rescue-handgrip').rotation.z=Math.PI/2;
    for(const sign of [-1,1]){const stem=cylinder(rail,.010,.10,[sign*.12,0,.05],metal,'rescue-handrail-stem');stem.rotation.x=Math.PI/2;}
    marker(rail,'rescue',[0,0,0]);
    d.short={design:designs[role],capture:0,work:0,mood:'idle',toolTip:V(),contact:null,cupTip:V(),cupContact:null,rescueTip:V(),rescueContact:null};d.shortRig=rig;d.shortTools=tools;
    root.traverse(o=>{if(o.isMesh)o.userData.robotRoot=root;});
    C.animateStationShortRobot(root,0,{action:'scan'});return root;
  };
  C.stationShortRobotTarget=(root,name)=>{
    const point=root?.userData?.shortTools?.[name];if(!point)return null;
    root.updateWorldMatrix(true,true);return point.getWorldPosition(V());
  };
  C.animateStationShortRobot=(root,time,state={})=>{
    if(!root?.userData?.short||!Number.isFinite(time))return;
    C.animateOrbitalRobot(root,time,state);
    const d=root.userData,s=d.short,r=d.shortRig,work=clamp(state.work??(state.action==='work'?1:0),0,1),capture=clamp(state.capture??0,0,1),mood=state.mood||(work?'focus':'idle');
    s.capture=capture;s.work=work;s.mood=mood;s.contact=null;s.cupContact=null;s.rescueContact=null;
    for(const petal of r.petals)petal.rotation.y=-capture*.78;
    for(const [i,motor]of r.motors.entries())motor.rotation.z=time*(7+Math.min(state.speed||0,1)*12)*(i?1:-1);
    r.camera.rotation.y=Math.sin(time*.8)*.35;r.camera.rotation.x=Math.sin(time*.95+.4)*.08;
    const blink=Math.pow(Math.max(0,Math.cos(time*2.3)),32),alert=mood==='alert',happy=mood==='happy';
    for(const [i,eye]of r.eyes.entries()){
      eye.scale.y=.035*Math.max(.12,1-.9*blink)*(alert?1.15:happy?.62:1);eye.scale.x=.022*(happy?1.2:1);
      eye.position.x=(i?1:-1)*.058+Math.sin(time*.71)*.004;eye.rotation.z=happy?(i?-.25:.25):0;
      eye.material.emissiveIntensity=alert?.85+.2*Math.sin(time*8):.65;
    }
    for(const [i,pulse]of r.pulses.entries())pulse.scale.y=.009+.007*(.5+.5*Math.sin(time*5-i*.7));
    if(r.pump)r.pump.position.y=.10+.003*Math.sin(time*6);
    for(const [i,aux]of r.aux.entries()){
      aux.root.rotation.x=-.08+Math.sin(time*1.9+i*1.7)*.11+work*.12;aux.root.rotation.z=aux.sign*(.12+.06*Math.sin(time*1.5+i));
      if(aux.joints)for(const [j,joint]of aux.joints.entries()){joint.rotation.x=-.13+.07*Math.sin(time*2-j*.6+i);joint.rotation.z=aux.sign*(.15+.045*Math.sin(time*1.7-j*.5));}
    }
    if(r.toolSpinner)r.toolSpinner.rotation.y=work*time*4;
    if(r.cupArm){
      const a=r.cupArm;a.shoulder.rotation.set(-.18+.025*Math.sin(time*1.7),0,-.04);a.elbow.rotation.set(-2.15+.035*Math.sin(time*1.4),0,0);a.wrist.rotation.set(0,0,.025*Math.sin(time*1.9));
      for(const [i,claw]of a.claws.entries())claw.rotation.z=(i?1:-1)*(.10+clamp(state.cupGrip??.65,0,1)*.30);
    }
    const target=state.toolTarget;
    if(target&&Number.isFinite(target.x)&&C.reachStationFilmRobot&&d.arms.length){
      s.contact=C.reachStationFilmRobot(root,state.toolSide||'right',target,state.toolWeight??1);
    }
    if(r.cupArm&&state.cupTarget&&Number.isFinite(state.cupTarget.x)&&C.reachStationFilmRobot)s.cupContact=C.reachStationFilmRobot(root,'left',state.cupTarget,state.cupWeight??1);
    if(r.rescueArm&&state.rescueTarget&&Number.isFinite(state.rescueTarget.x)&&C.reachStationFilmRobot)s.rescueContact=C.reachStationFilmRobot(root,'left',state.rescueTarget,state.rescueWeight??1);
    root.updateWorldMatrix(true,true);
    const tool=C.stationShortRobotTarget(root,d.role==='science'?'capture':d.role==='medical'?'probe':'seal');
    if(tool)s.toolTip.copy(tool);
    const cup=C.stationShortRobotTarget(root,'cup'),rescue=C.stationShortRobotTarget(root,'frontRescue');if(cup)s.cupTip.copy(cup);if(rescue)s.rescueTip.copy(rescue);
  };
})();
