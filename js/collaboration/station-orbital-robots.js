/* Sealed free-flying cabin partners. Ports indicate electric air-jet force, never flames. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,clamp=T.MathUtils.clamp;
  const dimensions={science:{radius:.32,height:.70,color:'#66e2d4'},medical:{radius:.43,height:.85,color:'#83cfff'},cargo:{radius:.69,height:1.0,color:'#e9b56d'}};
  C.makeOrbitalRobot=(input={})=>{
    const role=dimensions[input.role]?input.role:'science',d=dimensions[role],spec={...input,role},root=new T.Group(),center=d.height/2;
    root.name=input.name||({science:'光谱探测球',medical:'悬浮医疗舱',cargo:'轨道工程舱'}[role]);
    const mat=(color,options={})=>C.material(color,options),shell=mat('#e9f0f4',{metalness:.48,roughness:.3}),dark=mat('#142635',{metalness:.6,roughness:.32}),metal=mat('#718b9c',{metalness:.8,roughness:.24}),trim=mat(input.color||d.color,{metalness:.5,roughness:.3}),glass=mat('#061a29',{metalness:.45,roughness:.14});
    const glow=mat(d.color,{emissive:d.color,emissiveIntensity:.65,metalness:.2,roughness:.3}),joints={},thrusters=[],arms=[];
    function mesh(parent,geometry,material,name,pos=[0,0,0]){const m=new T.Mesh(geometry,material);m.name=name;m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
    function sphere(parent,size,pos,material,name){const m=mesh(parent,new T.SphereGeometry(1,28,18),material,name,pos);m.scale.set(...size);return m;}
    function box(parent,size,pos,material,name,r=.02){return mesh(parent,C.roundedRobotBox(...size,r),material,name,pos);}
    function ring(parent,radius,tube,pos,material,name){return mesh(parent,new T.TorusGeometry(radius,tube,10,56),material,name,pos);}
    function joint(name,parent,pos){const g=new T.Group();g.name=name;g.position.set(...pos);parent.add(g);joints[name]=g;return g;}
    const body=joint('body',root,[0,center,0]);
    if(role==='science'){
      sphere(body,[.235,.285,.225],[0,0,0],shell,'sealed-spherical-core');
      sphere(body,[.242,.085,.231],[0,-.025,0],dark,'equatorial-service-band');
      const gimbal=joint('ring',body,[0,0,0]);ring(gimbal,.272,.011,[0,0,0],metal,'protective-gimbal');ring(gimbal,.272,.004,[0,0,.009],glow,'gimbal-navigation-light');gimbal.rotation.y=.2;
      for(const sign of [-1,1]){box(body,[.045,.14,.09],[sign*.235,0,0],dark,'gimbal-bearing');sphere(body,[.025,.025,.025],[sign*.266,0,0],trim,'bearing-cap');}
    }else if(role==='medical'){
      sphere(body,[.285,.33,.245],[0,0,-.025],shell,'sealed-medical-capsule');
      sphere(body,[.292,.075,.252],[0,-.04,-.025],dark,'medical-service-band');
      for(const sign of [-1,1]){box(body,[.055,.35,.22],[sign*.275,-.025,-.04],metal,'protected-instrument-pod');box(body,[.018,.23,.12],[sign*.307,-.02,-.04],trim,'instrument-pod-accent');}
      box(body,[.055,.16,.018],[0,.07,.224],glow,'care-beacon-vertical');box(body,[.15,.05,.018],[0,.07,.225],glow,'care-beacon-horizontal');
      const diagnostic=joint('ring',body,[0,-.18,.20]);ring(diagnostic,.13,.011,[0,0,0],metal,'diagnostic-aperture');ring(diagnostic,.105,.004,[0,0,.01],glow,'diagnostic-light-ring');
    }else{
      box(body,[.90,.66,.63],[0,0,-.035],shell,'sealed-engineering-payload',.10);
      box(body,[.92,.13,.65],[0,-.08,-.035],dark,'payload-restraint-belt',.045);
      for(const sign of [-1,1]){box(body,[.10,.73,.53],[sign*.40,0,-.035],metal,'structural-cage-rail',.035);box(body,[.028,.56,.25],[sign*.456,.015,-.035],trim,'payload-identity-strip',.012);}
      box(body,[.44,.40,.035],[0,-.01,.292],dark,'sealed-payload-hatch',.04);box(body,[.38,.33,.02],[0,-.01,.315],shell,'payload-hatch-cover',.035);
      for(const x of [-.145,.145])box(body,[.018,.19,.018],[x,-.01,.333],trim,'payload-latch');
      for(const y of [-.23,.24])box(body,[.58,.009,.012],[0,y,.286],dark,'payload-panel-seam',.003);
      for(const x of [-.27,.27])for(const y of [-.23,.24])box(body,[.031,.027,.015],[x,y,.297],metal,'recessed-service-fastener',.007);
      for(let i=0;i<6;i++)box(body,[.045,.008,.16],[.465,.11+i*.027,-.03],dark,'protected-side-vent',.003);
      const mechanism=joint('ring',body,[0,-.01,.336]);ring(mechanism,.075,.009,[0,0,0],metal,'rotary-seal-tool');ring(mechanism,.054,.003,[0,0,.009],glow,'seal-status');
    }
    const sensor=joint('sensor',body,[0,role==='cargo'?.20:.15,role==='cargo'?.30:.15]);
    const sr=role==='science'?.13:role==='medical'?.15:.17;
    sphere(sensor,[sr,sr*.68,.075],[0,0,0],dark,'optical-gimbal-housing');sphere(sensor,[sr*.84,sr*.48,.032],[0,0,.060],glass,'sensor-visor');
    const lens=ring(sensor,sr*.24,.009,[0,0,.092],metal,'optical-lens-rim');sphere(sensor,[sr*.20,sr*.20,.012],[0,0,.096],glow,'spectral-lens');
    for(const sign of [-1,1])box(sensor,[.025,.008,.01],[sign*sr*.55,0,.087],glow,'peripheral-sensor');
    if(role!=='science')for(const sign of [-1,1]){
      const side=sign<0?'left':'right',large=role==='cargo',upperLength=large?.16:.105,lowerLength=large?.12:.09;
      const shoulder=joint(side+'Shoulder',body,[sign*(large?.365:.17),-.07,large?.17:.105]);
      sphere(shoulder,[.040,.040,.040],[0,0,0],metal,side+'-shoulder-bearing');
      box(shoulder,[.038,upperLength,.045],[0,-upperLength/2,0],shell,side+'-upper-manipulator',.012);
      const elbow=joint(side+'Elbow',shoulder,[0,-upperLength,0]);sphere(elbow,[.032,.032,.032],[0,0,0],trim,side+'-elbow-bearing');
      box(elbow,[.028,lowerLength,.034],[0,-lowerLength/2,0],metal,side+'-forearm',.01);
      const wrist=joint(side+'Wrist',elbow,[0,-lowerLength,0]);sphere(wrist,[.027,.025,.027],[0,0,0],dark,side+'-tool-coupler');
      const claws=[];for(const finger of [-1,1]){const claw=joint(side+'Claw'+(finger<0?'Inner':'Outer'),wrist,[finger*.021,-.005,0]);box(claw,[.012,.045,.024],[0,-.025,0],shell,side+'-soft-gripper',.004);claws.push(claw);}
      if(role==='medical')sphere(wrist,[.012,.014,.018],[0,-.033,.024],glow,side+'-diagnostic-tip');
      arms.push({sign,shoulder,elbow,wrist,claws});
    }
    // In-cabin electric duct ports: outward opening points opposite thrust.
    const portRadius=role==='science'?.046:role==='medical'?.055:.075;
    for(const axis of ['x','y','z'])for(const sign of [-1,1]){
      const direction=new T.Vector3();direction[axis]=sign;const outward=direction.clone().negate();
      const position=new T.Vector3(0,center,0),offset=axis==='y'?d.height*.45:role==='science'?.25:role==='medical'?.30:axis==='x'?.50:.38;position[axis]+=outward[axis]*offset;
      const housing=new T.Group();housing.name='duct-'+axis+(sign>0?'-positive-force':'-negative-force');housing.position.copy(position);housing.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),outward);root.add(housing);
      const neckLength=role==='cargo'?.16:.105,neck=mesh(housing,new T.CylinderGeometry(portRadius*.75,portRadius*.92,neckLength,24),metal,'sealed-duct-neck',[0,0,-neckLength/2]);neck.rotation.x=Math.PI/2;
      ring(housing,portRadius*1.04,.009,[0,0,-.018],shell,'duct-mounting-collar');
      const shroud=mesh(housing,new T.CylinderGeometry(portRadius,portRadius,.038,24),dark,'recessed-air-duct');shroud.rotation.x=Math.PI/2;
      ring(housing,portRadius*.88,.006,[0,0,.022],metal,'duct-guard');
      const rotor=joint('rotor'+axis+sign,housing,[0,0,.023]);
      for(let i=0;i<5;i++){const blade=box(rotor,[portRadius*.95,.007,.007],[0,0,0],metal,'enclosed-impeller',.002);blade.rotation.z=i*Math.PI/5;}
      const rim=mat(d.color,{emissive:d.color,emissiveIntensity:.05,roughness:.4}),visual=ring(housing,portRadius*.76,.004,[0,0,.028],rim,'thrust-indicator');
      thrusters.push({direction,visual,rotor,throttle:0});
    }
    // Offset opposing jets form a yaw couple with zero net translation.
    const attitudeJets=[];
    for(const xsign of [-1,1])for(const torqueSign of [-1,1]){
      const forceZ=-xsign*torqueSign,direction=new T.Vector3(0,0,forceZ),housing=new T.Group(),offset=role==='science'?.18:role==='medical'?.24:.40;
      housing.name='attitude-duct-'+xsign+'-'+torqueSign;housing.position.set(xsign*offset,center-.06,-forceZ*(role==='cargo'?.30:.17));housing.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),direction.clone().negate());root.add(housing);
      const casing=mesh(housing,new T.CylinderGeometry(.025,.025,.035,16),dark,'attitude-duct-shroud');casing.rotation.x=Math.PI/2;
      ring(housing,.022,.004,[0,0,.021],metal,'attitude-duct-guard');const m=mat(d.color,{emissive:d.color,emissiveIntensity:.04}),visual=ring(housing,.015,.003,[0,0,.025],m,'attitude-thrust-indicator');
      attitudeJets.push({direction,visual,torqueSign,throttle:0});
    }
    root.userData={spec,role,orbitalRobot:true,microgravity:true,height:d.height,radius:d.radius,joints,jointDescriptors:[],thrusters,attitudeJets,arms,sensor,body,lens,frameTime:null,actionBlend:0,sensorYaw:0,sensorPitch:0};
    root.traverse(o=>{if(o.isMesh)o.userData.robotRoot=root;});C.animateOrbitalRobot(root,0,{action:'scan',speed:0,thrust:{x:0,y:0,z:0}});return root;
  };
  C.animateOrbitalRobot=(root,time,state={})=>{
    const data=root?.userData;if(!data?.orbitalRobot||!Number.isFinite(time))return;
    const action=state.action||'guard',key=JSON.stringify([time,action,state.speed||0,state.thrust||{},state.turn||0,state.target||{}]);if(data.frameKey===key)return;
    const dt=data.frameTime===null?0:Math.max(0,time-data.frameTime),alpha=dt>0&&dt<.5?1-Math.exp(-dt*7):1,working=action==='work',wanted=working?1:action==='yield'?.35:0;
    data.actionBlend+=(wanted-data.actionBlend)*alpha;const w=data.actionBlend,s=Math.sin(time*1.8),q=Math.sin(time*1.8+.8),target=state.target;
    const targetYaw=target?clamp(Math.atan2(target.x,target.z),-.65,.65):0,targetPitch=target?clamp(-Math.atan2(target.y,Math.hypot(target.x,target.z)),-.45,.45):0;
    const yaw=clamp(targetYaw+(['scan','guard','blocked'].includes(action)?Math.sin(time*.85)*.18:working?s*.045:0),-.65,.65),pitch=clamp(targetPitch+(working?.035*q:.025*Math.sin(time*.65)),-.45,.45);
    data.sensorYaw+=(yaw-data.sensorYaw)*alpha;data.sensorPitch+=(pitch-data.sensorPitch)*alpha;data.sensor.rotation.y=data.sensorYaw;data.sensor.rotation.x=data.sensorPitch;
    if(data.joints.ring){if(data.role==='science'){data.joints.ring.rotation.y=.2+Math.sin(time*.5)*.13;data.joints.ring.rotation.z=Math.sin(time*.7)*.10;}else data.joints.ring.rotation.z=working?time*.32:Math.sin(time*.35)*.08;}
    for(const arm of data.arms){const {sign,shoulder,elbow,wrist,claws}=arm;shoulder.rotation.x=-.12-w*(.85+.08*s);shoulder.rotation.z=sign*(.05+w*.03);elbow.rotation.x=-.25-w*(.42+.11*q);wrist.rotation.z=sign*w*Math.sin(time*1.5)*.16;
      for(const [i,claw]of claws.entries())claw.rotation.z=(i?1:-1)*(.10+w*(.12+.10*Math.sin(time*2.0)));
    }
    const thrust=state.thrust||{},force=new T.Vector3(thrust.x||0,thrust.y||0,thrust.z||0);
    for(const port of data.thrusters){port.throttle=clamp(force.dot(port.direction),0,1);port.visual.material.emissiveIntensity=.04+port.throttle*1.9;port.visual.material.color.set(port.throttle>.02?dimensions[data.role].color:'#46616d');port.rotor.rotation.z=time*port.throttle*14;}
    for(const port of data.attitudeJets){port.throttle=clamp((state.turn||0)*port.torqueSign*.4,0,1);port.visual.material.emissiveIntensity=.04+port.throttle*1.9;}
    data.frameTime=time;data.frameKey=key;
  };
})();
