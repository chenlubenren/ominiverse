/* Articulated, metre-scale visual proxies. No manufacturer meshes or controllers. */
(() => {
  'use strict';
  const L=window.IndoorLab,TAU=Math.PI*2;
  const catalog=[
    {id:'g1',name:'人形协作机器人',brand:'通用构型',kind:'humanoid',category:'人形机器人',size:'约 1.32 m 高 · 23 轴基础构型',radius:.30,height:1.32,speed:.7,color:'#aeb6bf',task:'工位协作 / 文件递送',url:'https://www.unitree.com/g1/'},
    {id:'go2',name:'轻型巡检机器狗',brand:'通用构型',kind:'dog',category:'四足机器狗',size:'0.70 × 0.31 × 0.40 m · 12 轴',length:.70,width:.31,height:.40,radius:.39,speed:.65,color:'#d6dce2',task:'办公巡检',url:'https://www.unitree.com/go2/'},
    {id:'b2',name:'工业巡检机器狗',brand:'通用构型',kind:'dog',category:'工业机器狗',size:'约 1.10 × 0.45 × 0.645 m · 12 轴',length:1.10,width:.45,height:.645,radius:.61,speed:.65,color:'#c4cbd1',task:'设施巡检',url:'https://www.unitree.com/b2/'},
    {id:'spot',name:'四足巡检机器人',brand:'通用构型',kind:'dog',category:'四足机器狗',size:'1.10 × 0.50 × 0.61 m · 12 轴',length:1.10,width:.50,height:.61,radius:.62,speed:.65,color:'#e6b82c',task:'办公巡检',url:'https://support.bostondynamics.com/s/article/spot-specifications'},
    {id:'ur5e',name:'六轴协作机械臂',brand:'通用构型',kind:'arm',category:'协作机械臂',size:'6 轴 · 标称臂展 850 mm',radius:.78,height:1.65,speed:0,color:'#77b8dd',axes:6,task:'工作台取放 / 人机交接',url:'https://www.universal-robots.com/manuals/EN/HTML/SW10_6/Content/prod-usr-man/hardware/arm_e-Series/UR5e/H_g5_sections/appendix_g5/tech_spec_sheet.htm'},
    {id:'fr3',name:'七轴协作机械臂',brand:'通用构型',kind:'arm',category:'协作机械臂',size:'7 轴 · 标称臂展 855 mm',radius:.78,height:1.65,speed:0,color:'#f0f1f2',axes:7,task:'柔性取放 / 人机交接',url:'https://franka.de/franka-research-3-cobot-arm'},
    {id:'bella',name:'室内配送机器人',brand:'通用构型',kind:'delivery',category:'轮式配送机器人',size:'0.565 × 0.537 × 1.29 m',radius:.40,height:1.29,speed:.55,color:'#eceef0',task:'茶水 / 文件配送',url:'https://www.pudurobotics.com/en/products/bellabotpro'},
    {id:'roomba',name:'地面清扫机器人',brand:'通用构型',kind:'vacuum',category:'扫地机器人',size:'约 Ø 0.348 × 0.086 m',radius:.19,height:.086,speed:.28,color:'#343c45',task:'分区清扫',url:'https://www.irobot.com/en_US/roomba-j9plus-self-emptying-robot-vacuum/J955020.html'}
  ];
  const material=(color,metalness=.35,roughness=.42)=>{const m=new THREE.MeshStandardMaterial({color,metalness,roughness});m.color.convertSRGBToLinear();return m;};
  function mesh(parent,geo,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
  const box=(p,w,h,d,m,x=0,y=0,z=0)=>mesh(p,new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const sphere=(p,r,m,x=0,y=0,z=0)=>mesh(p,new THREE.SphereGeometry(r,16,12),m,x,y,z);
  const cylinder=(p,r,h,m,x=0,y=0,z=0)=>mesh(p,new THREE.CylinderGeometry(r,r,h,24),m,x,y,z);
  function joint(rig,parent,name,axis,x,y,z,min=-Math.PI,max=Math.PI){const g=new THREE.Group();g.position.set(x,y,z);g.name=name;parent.add(g);const j={name,node:g,axis,min,max,value:0};rig.joints.push(j);rig.byName[name]=j;return g;}
  function set(rig,name,value){const j=rig.byName[name];if(j){j.value=L.clamp(value,j.min,j.max);j.node.rotation[j.axis]=j.value;}}
  function limb(p,length,width,mat,dark){box(p,width,length,width*.8,mat,0,-length/2,0);cylinder(p,width*.56,width*1.2,dark).rotation.z=Math.PI/2;}
  function dog(rig,s,m){
    const body=rig.body=new THREE.Group();rig.root.add(body);body.position.y=s.height*.81;
    const len=s.length*.65,w=s.width*.66,h=s.height*.27;
    box(body,w,h,len,m.shell);box(body,w*.8,h*.55,len*.88,m.dark,0,h*.35,0);
    for(let i=0;i<6;i++)box(body,w*.65,.006,.012,m.dark,0,h*.51,-len*.27+i*len*.1);
    const sensor=cylinder(body,s.width*.17,.055,m.dark,0,h*.72,len*.38);sensor.name='LiDAR';
    box(body,w*.8,h*.7,.035,m.dark,0,0,len/2+.015);
    for(const side of [-1,1])sphere(body,.018,m.lens,side*w*.22,.01,len/2+.037);
    const upper=s.height*.43,lower=s.height*.44;rig.legs=[];
    for(const front of [1,-1])for(const side of [-1,1]){
      const id=`${front>0?'front':'rear'}-${side>0?'right':'left'}`;
      const ab=joint(rig,body,id+'-abduction','z',side*s.width*.43,0,front*len*.38,-.7,.7);
      cylinder(ab,s.width*.14,s.width*.20,m.dark).rotation.z=Math.PI/2;
      const hip=joint(rig,ab,id+'-hip','x',0,0,0,-1.6,1.6);limb(hip,upper,s.width*.17,m.shell,m.dark);
      const knee=joint(rig,hip,id+'-knee','x',0,-upper,0,.15,2.65);limb(knee,lower,s.width*.105,m.dark,m.dark);sphere(knee,s.width*.09,m.rubber,0,-lower,0);
      rig.legs.push({id,side,front,upper,lower});
    }
  }
  function humanoid(rig,s,m){
    const pelvis=rig.body=new THREE.Group();rig.root.add(pelvis);pelvis.position.y=.69;
    box(pelvis,.23,.14,.15,m.dark);
    const waist=joint(rig,pelvis,'waist-yaw','y',0,.075,0,-1.5,1.5);
    box(waist,.27,.28,.16,m.shell,0,.14,0);box(waist,.20,.14,.018,m.dark,0,.19,.09);
    for(const side of [-1,1])box(waist,.035,.008,.009,m.lens,side*.065,.2,.102);
    const head=rig.head=new THREE.Group();head.position.y=.43;waist.add(head);
    sphere(head,.105,m.shell,0,0,0).scale.set(.92,1.22,.85);box(head,.16,.09,.038,m.dark,0,.005,.077);
    for(const side of [-1,1])sphere(head,.012,m.lens,side*.039,.01,.101);
    cylinder(head,.045,.032,m.dark,0,.115,0);
    rig.legs=[];
    for(const side of [-1,1]){
      const id=side<0?'left':'right';
      const yaw=joint(rig,pelvis,id+'-hip-yaw','y',side*.09,-.06,0,-.8,.8);
      const roll=joint(rig,yaw,id+'-hip-roll','z',0,0,0,-.6,.6);
      const hip=joint(rig,roll,id+'-hip-pitch','x',0,0,0,-1.8,1.8);limb(hip,.285,.075,m.shell,m.dark);
      const knee=joint(rig,hip,id+'-knee','x',0,-.285,0,0,2.4);limb(knee,.285,.06,m.shell,m.dark);
      const ankle=joint(rig,knee,id+'-ankle-pitch','x',0,-.285,0,-.9,.9);
      const ar=joint(rig,ankle,id+'-ankle-roll','z',0,0,0,-.5,.5);box(ar,.095,.055,.21,m.dark,0,-.025,.045);
      rig.legs.push({id,side,upper:.285,lower:.285});
      const shoulder=joint(rig,waist,id+'-shoulder-pitch','x',side*.18,.25,0,-2.5,2.5);
      const sr=joint(rig,shoulder,id+'-shoulder-roll','z',0,0,0,-1.6,1.6);
      const sy=joint(rig,sr,id+'-shoulder-yaw','y',0,0,0,-2,2);limb(sy,.18,.055,m.shell,m.dark);
      const elbow=joint(rig,sy,id+'-elbow','x',0,-.18,0,-2.3,.1);limb(elbow,.17,.045,m.shell,m.dark);
      const wrist=joint(rig,elbow,id+'-wrist-roll','y',0,-.17,0,-1.8,1.8);box(wrist,.055,.075,.04,m.dark,0,-.03,0);
    }
    rig.payload=box(waist,.24,.045,.17,m.paper,0,.07,.25);rig.payload.visible=false;
  }
  function arm(rig,s,m){
    // A dedicated workcell stays inside the navigation footprint.
    box(rig.root,1.08,.065,.88,m.table,0,.73,0);
    for(const x of [-.45,.45])for(const z of [-.35,.35])box(rig.root,.04,.70,.04,m.dark,x,.35,z);
    rig.arm=new THREE.Group();rig.arm.position.set(0,.77,-.17);rig.root.add(rig.arm);
    cylinder(rig.arm,.09,.10,m.dark,0,.05,0);
    const lengths=s.axes===6?[.13,.30,.27,.075,.065,.055]:[.13,.23,.10,.20,.09,.06,.045];
    const axes=s.axes===6?['y','x','x','y','x','y']:['y','x','y','x','y','x','y'];
    let parent=rig.arm;rig.chain=[];
    lengths.forEach((length,i)=>{
      const p=joint(rig,parent,`axis-${i+1}`,axes[i],0,i?lengths[i-1]:.07,0,i===0?-2.8:-2.5,i===0?2.8:2.5);
      cylinder(p,.053,.09,i%2?m.shell:m.dark).rotation.z=axes[i]==='x'?Math.PI/2:0;
      cylinder(p,.036,length,m.shell,0,length/2,0);sphere(p,.047,m.shell,0,length,0);
      rig.chain.push(rig.byName[`axis-${i+1}`]);parent=p;
    });
    rig.effector=new THREE.Group();rig.effector.position.y=lengths[lengths.length-1];parent.add(rig.effector);
    box(rig.effector,.10,.035,.055,m.dark);
    rig.fingers=[-1,1].map((side,i)=>{const p=joint(rig,rig.effector,`gripper-${i}`,'z',side*.045,.025,0,-.45,.45);box(p,.015,.07,.025,m.dark,0,.03,0);return p;});
    rig.parcel=box(rig.root,.09,.065,.09,m.paper,-.33,.795,.22);
    for(const x of [-.33,.33])box(rig.root,.19,.012,.19,m.tray,x,.772,.22);
    rig.armTarget=new THREE.Vector3();rig.tip=new THREE.Vector3();
    // Bent initial configuration avoids the collinear CCD singularity.
    set(rig,'axis-2',.8);set(rig,'axis-3',-.7);set(rig,'axis-4',.65);
  }
  function wheeled(rig,s,m){
    const vacuum=s.kind==='vacuum',r=vacuum?.174:.26;
    cylinder(rig.root,r,vacuum?.068:.15,m.shell,0,vacuum?.05:.15,0);
    cylinder(rig.root,r*.96,.016,m.dark,0,vacuum?.015:.07,0);
    rig.wheels=[];
    for(const side of [-1,1]){const p=joint(rig,rig.root,`wheel-${side}`,'x',side*r*.78,vacuum?.034:.07,0,-1e8,1e8);cylinder(p,vacuum?.031:.065,.026,m.rubber).rotation.z=Math.PI/2;box(p,.012,.045,.01,m.shell,0,0,.025);rig.wheels.push(p);}
    if(vacuum){
      cylinder(rig.root,.04,.018,m.dark,0,.083,-.055);box(rig.root,.09,.026,.012,m.dark,0,.053,.166);sphere(rig.root,.012,m.lens,0,.06,.175);
      const brush=joint(rig,rig.root,'side-brush','y',.12,.012,.09,-1e8,1e8);
      for(let i=0;i<3;i++){const b=box(brush,.012,.005,.14,m.rubber);b.rotation.y=i*TAU/3;}
      const roller=joint(rig,rig.root,'roller','x',0,.016,0,-1e8,1e8);cylinder(roller,.025,.17,m.tray).rotation.z=Math.PI/2;
    }else{
      for(const side of [-1,1])box(rig.root,.045,.91,.055,m.shell,side*.23,.71,-.1);
      for(let i=0;i<4;i++){cylinder(rig.root,.245,.035,m.dark,0,.34+i*.22,0);if(i<3){cylinder(rig.root,.035,.07,m.paper,.09,.39+i*.22,.04);box(rig.root,.11,.025,.11,m.tray,-.09,.37+i*.22,.02);}}
      box(rig.root,.35,.19,.14,m.dark,0,1.12,.02);
      for(const side of [-1,1]){const ear=box(rig.root,.065,.09,.05,m.shell,side*.13,1.245,.02);ear.rotation.z=-side*.3;sphere(rig.root,.022,m.lens,side*.085,1.13,.098);}
    }
  }
  function create(spec){
    const rig={root:new THREE.Group(),joints:[],byName:{},spec};rig.root.name=spec.name;
    const m={shell:material(spec.color),dark:material('#242c36'),rubber:material('#161d24',.05,.9),lens:material('#48d7f2',.5,.16),paper:material('#d6b781',.02,.8),table:material('#c6d0d4',.2,.6),tray:material('#5b91b2',.25,.5)};
    rig.materials=m;
    if(spec.kind==='dog')dog(rig,spec,m);else if(spec.kind==='humanoid')humanoid(rig,spec,m);else if(spec.kind==='arm')arm(rig,spec,m);else wheeled(rig,spec,m);
    rig.root.traverse(o=>{o.userData.robot=true;});return rig;
  }
  function legIK(rig,leg,z,y){
    const a=leg.upper,b=leg.lower,d=L.clamp(Math.hypot(z,y),Math.abs(a-b)+.001,a+b-.001);
    const knee=Math.PI-Math.acos(L.clamp((a*a+b*b-d*d)/(2*a*b),-1,1));
    const hip=Math.atan2(-z,-y)-Math.acos(L.clamp((a*a+d*d-b*b)/(2*a*d),-1,1));
    set(rig,leg.id+(rig.spec.kind==='dog'?'-hip':'-hip-pitch'),hip);set(rig,leg.id+'-knee',knee);
    if(rig.spec.kind==='humanoid')set(rig,leg.id+'-ankle-pitch',-hip-knee);
  }
  function solveArm(rig,target){
    const t=rig.armTarget.copy(target);rig.root.localToWorld(t);
    const inv=new THREE.Quaternion(),axis=new THREE.Vector3(),u=new THREE.Vector3(),v=new THREE.Vector3(),origin=new THREE.Vector3();
    for(let iter=0;iter<12;iter++)for(let i=rig.chain.length-1;i>=0;i--){
      const j=rig.chain[i];rig.root.updateMatrixWorld(true);j.node.getWorldPosition(origin);rig.effector.getWorldPosition(rig.tip);
      inv.copy(j.node.parent.getWorldQuaternion(new THREE.Quaternion())).invert();u.copy(rig.tip).sub(origin).applyQuaternion(inv);v.copy(t).sub(origin).applyQuaternion(inv);
      axis.set(j.axis==='x'?1:0,j.axis==='y'?1:0,0);u.addScaledVector(axis,-u.dot(axis));v.addScaledVector(axis,-v.dot(axis));
      if(u.lengthSq()<1e-8||v.lengthSq()<1e-8)continue;u.normalize();v.normalize();
      const angle=Math.atan2(axis.dot(new THREE.Vector3().crossVectors(u,v)),u.dot(v));set(rig,j.name,j.value+L.clamp(angle,-.2,.2));
    }
  }
  function animate(rig,r,dt){
    const s=rig.spec,moving=r.speed>.015,phase=r.distance/(s.kind==='dog'?s.height*.9:.48)*TAU;
    if(s.kind==='dog'||s.kind==='humanoid'){
      const dog=s.kind==='dog',stride=dog?s.height*.42:.22,base=dog?s.height*.81:.69;
      rig.body.position.y=base+(moving?Math.sin(phase*2)*.005:0);
      for(const leg of rig.legs){
        const p=((phase/TAU+(dog?(leg.front===leg.side?0:.5):(leg.side>0?0:.5)))%1+1)%1;
        const swing=p>.62,progress=swing?(p-.62)/.38:p/.62;
        const z=moving?(swing?-.5+progress:.5-progress)*stride:0;
        const lift=moving&&swing?Math.sin(progress*Math.PI)*(dog?s.height*.15:.065):0;
        legIK(rig,leg,z,-(dog?base:base-.09)+.03+lift);
        if(dog)set(rig,leg.id+'-abduction',leg.side*.045+(moving?Math.sin(phase)*.015:0));
        else{set(rig,leg.id+'-hip-roll',moving?Math.sin(phase)*.025:0);set(rig,leg.id+'-ankle-roll',moving?-Math.sin(phase)*.025:0);}
      }
      if(!dog){
        const handoff=r.state==='working',carrying=r.state==='moving'||r.state==='yielding';rig.payload.visible=carrying||handoff&&r.workTime<3.5;
        set(rig,'waist-yaw',moving?Math.sin(phase)*.035:handoff?Math.sin(r.workTime*1.2)*.06:0);
        for(const side of [-1,1]){const id=side<0?'left':'right';set(rig,id+'-shoulder-pitch',handoff?-.95:carrying?-.75:moving?Math.sin(phase+(side>0?Math.PI:0))*.22:0);set(rig,id+'-shoulder-roll',side*.12);set(rig,id+'-shoulder-yaw',handoff?side*.12:Math.sin(phase)*.035);set(rig,id+'-elbow',handoff||carrying?-.6:-.18);set(rig,id+'-wrist-roll',handoff?Math.sin(r.workTime)*.15:0);}
      }
    }else if(s.kind==='arm'){
      if(r.state==='safety-stop')return;
      const t=(r.workTime%10)/10,source=t<.5?-.33:.33,dest=-source;
      const stage=(t%.5)*2;
      let target;
      if(stage<.2)target=new THREE.Vector3(source,.88,.22);
      else if(stage<.42)target=new THREE.Vector3(source,1.07,.22);
      else if(stage<.75)target=new THREE.Vector3(source+(dest-source)*(stage-.42)/.33,1.07,.22);
      else target=new THREE.Vector3(dest,.88,.22);
      solveArm(rig,target);
      const holding=stage>=.2&&stage<.85;
      set(rig,'gripper-0',holding?.06:.35);set(rig,'gripper-1',holding?-.06:-.35);
      if(holding){rig.effector.getWorldPosition(rig.tip);rig.root.worldToLocal(rig.tip);rig.parcel.position.copy(rig.tip);rig.parcel.position.y+=.04;}
      else rig.parcel.position.set(stage<.2?source:dest,.81,.22);
    }else{
      set(rig,'wheel--1',r.distance/(s.kind==='vacuum'?.031:.065)-r.angle*2);set(rig,'wheel-1',r.distance/(s.kind==='vacuum'?.031:.065)+r.angle*2);
      if(s.kind==='vacuum'){set(rig,'side-brush',r.distance*40);set(rig,'roller',r.distance*32);}
    }
  }
  L.RobotModels={catalog,create,animate,set,solveArm};
})();
