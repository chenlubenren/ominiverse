/* Procedural, articulated partners. All dimensions are metres. */
(() => {
  'use strict';
  const C = window.CoScene = window.CoScene || {};
  const T = THREE;
  C.presets = [
    {type:'humanoid',name:'人形协作伙伴',label:'工业人形机器人',subtitle:'工业结构 / 29 个活动关节',color:'#6b9bc4',scale:1,accessories:['screen'],task:'assist'},
    {type:'delivery',name:'送餐服务伙伴',label:'送餐机器人',subtitle:'递送 / 服务',color:'#6b9bc4',scale:1,accessories:['tray','screen'],task:'deliver'},
    {type:'quadruped',name:'四足巡检伙伴',label:'机器狗',subtitle:'巡检 / 陪伴',color:'#6b9bc4',scale:1,accessories:['sensor'],task:'inspect'},
    {type:'carrier',name:'物流搬运伙伴',label:'物流机器人',subtitle:'搬运 / 补给',color:'#6b9bc4',scale:1,accessories:['cargo'],task:'supply'}
  ];
  C.presets.forEach(spec=>{spec.appearanceVersion=3;spec.color=window.RobotContract.palette.accent;});
  C.robotPalette=window.RobotContract.palette;
  C.material = (color, opts={}) => {
    const m = new T.MeshStandardMaterial({color,roughness:.53,metalness:.12,...opts});
    m.color.convertSRGBToLinear(); return m;
  };
  const geometries = {
    box:new T.BoxGeometry(1,1,1), sphere:new T.SphereGeometry(1,20,14),
    cylinder:new T.CylinderGeometry(1,1,1,24), torus:new T.TorusGeometry(1,.12,8,28)
  };
  C.part = function(parent,geometry,material,size,position=[0,0,0],rotation=[0,0,0]) {
    const m = new T.Mesh(typeof geometry==='string'?geometries[geometry]:geometry,material);
    m.scale.set(...size);m.position.set(...position);m.rotation.set(...rotation);
    m.castShadow=!material.transparent;m.receiveShadow=true;parent.add(m);return m;
  };
  C.jointSchema = window.RobotContract.jointSchema;
  C.applyRobotRig=(root,rig)=>{
    if(!rig)return root;
    const joints=window.RobotContract.validateJointConfiguration(root.userData.spec.type,rig.joints);
    if(joints.some(j=>!root.userData.joints[j.name]))throw new Error('关节配置无法绑定当前模型。');
    root.userData.jointDescriptors=joints;root.userData.rigProvider=rig.provider;root.userData.rigGeneration=rig.generation||null;return root;
  };
  // Current presets are built locally. The async boundary remains for future generated assets.
  C.prepareRobot = async()=>{};
  C.roundedRobotBox = (width,height,depth,radius)=>{
    const geometry=new T.BoxGeometry(width,height,depth,6,6,8),position=geometry.attributes.position;
    const inner=new T.Vector3(width/2-radius,height/2-radius,depth/2-radius),low=inner.clone().negate(),p=new T.Vector3(),q=new T.Vector3();
    for(let i=0;i<position.count;i++){p.fromBufferAttribute(position,i);q.copy(p).clamp(low,inner);p.sub(q).normalize().multiplyScalar(radius).add(q);position.setXYZ(i,p.x,p.y,p.z);}
    geometry.computeVertexNormals();return geometry;
  };
  // Rounded industrial casing lofted through [height, width, depth, forward offset] sections.
  C.robotHousing = sections=>{
    const vertices=[],indices=[],segments=6,n=4*(segments+1);
    for(const [y,w,d,z=0]of sections){
      const radius=Math.min(w,d)*.24;
      const centers=[[w/2-radius,-d/2+radius],[w/2-radius,d/2-radius],[-w/2+radius,d/2-radius],[-w/2+radius,-d/2+radius]];
      for(let c=0;c<4;c++)for(let i=0;i<=segments;i++){const angle=-Math.PI/2+c*Math.PI/2+i*Math.PI/(2*segments);vertices.push(centers[c][0]+radius*Math.cos(angle),y,z+centers[c][1]+radius*Math.sin(angle));}
    }
    for(let r=0;r<sections.length-1;r++)for(let i=0;i<n;i++){const a=r*n+i,b=r*n+(i+1)%n,c=b+n,d=a+n;indices.push(a,d,b,b,d,c);}
    for(let i=1;i<n-1;i++){indices.push(0,i,i+1);const a=(sections.length-1)*n;indices.push(a,a+i+1,a+i);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
  };
  C.makeRobot = function(input={}) {
    const spec={...C.presets.find(p=>p.type===input.type)||C.presets[0],...input};
    if(spec.type==='quadruped')return C.makeQuadruped(spec);
    const root=new T.Group();root.name=spec.name;root.scale.setScalar(spec.scale||1);
    const white=C.material('#f0f5fc'),accent=C.material(spec.color),dark=C.material('#28415e',{roughness:.36,metalness:.48}),metal=C.material('#9bb1c9',{roughness:.3,metalness:.65}),glass=C.material('#122f4b',{roughness:.16}),light=C.material('#8dd9ff',{emissive:'#398bc4',emissiveIntensity:.55});
    const joints={},register=(name,parent,xyz)=>{const g=new T.Group();g.name=name;g.position.set(...xyz);parent.add(g);joints[name]=g;return g;};
    const part=(p,g,m,s,pos,rot)=>C.part(p,g,m,s,pos,rot);
    const eye=(p,x,y,z)=>part(p,'sphere',light,[.025,.025,.012],[x,y,z]);
    const wheel=(name,x,z,r=.17,y=.19)=>{const j=register(name,root,[x,y,z]);part(j,'cylinder',dark,[r,.10,r],[0,0,0],[0,0,Math.PI/2]);part(j,'cylinder',metal,[r*.52,.115,r*.52],[0,0,0],[0,0,Math.PI/2]);return j;};
    if(spec.type==='delivery'){
      part(root,'cylinder',dark,[.34,.16,.34],[0,.19,0]);part(root,'cylinder',white,[.34,.23,.34],[0,.32,0]);part(root,'cylinder',accent,[.345,.04,.345],[0,.46,0]);
      for(const x of [-.255,.255])part(root,'cylinder',metal,[.027,.75,.027],[x,.84,-.16]);
      const tray=register('tray',root,[0,.6,0]);
      for(const y of [0,.28,.56]){part(tray,'box',white,[.65,.035,.5],[0,y,0]);part(tray,'box',accent,[.66,.065,.035],[0,y+.02,-.25]);}
      if(spec.accessories?.includes('tray'))for(const x of [-.15,.13]){part(tray,'cylinder',white,[.105,.035,.105],[x,.61,0]);part(tray,'sphere',accent,[.06,.065,.06],[x,.66,0]);}
      const head=register('head',root,[0,1.38,-.13]);part(head,'sphere',white,[.25,.19,.13]);part(head,'box',glass,[.34,.19,.04],[0,0,.12],[.10,0,0]);eye(head,-.07,.015,.15);eye(head,.07,.015,.15);
      wheel('left_wheel',-.33,0);wheel('right_wheel',.33,0);
    }else{
      part(root,'box',dark,[.86,.20,1.12],[0,.22,0]);part(root,'box',white,[.85,.22,1.08],[0,.40,0]);part(root,'box',accent,[.88,.055,1.1],[0,.53,0]);
      const lift=register('lift',root,[0,.58,0]);lift.userData.restY=.58;part(lift,'box',metal,[.76,.07,.94]);
      if(spec.accessories?.includes('cargo')){part(lift,'box',white,[.65,.40,.72],[0,.24,0]);part(lift,'box',accent,[.13,.41,.73],[0,.24,0]);part(lift,'box',dark,[.25,.08,.015],[0,.30,.37]);}
      for(const [f,z]of [['front',.36],['rear',-.36]])for(const [s,x]of [['left',-.44],['right',.44]])wheel(f+'_'+s+'_wheel',x,z,.17,.17);
      part(root,'box',glass,[.42,.10,.025],[0,.40,.554]);for(const x of [-.28,.28])part(root,'box',light,[.1,.045,.025],[x,.22,.57]);part(root,'cylinder',dark,[.095,.1,.095],[.3,.65,-.43]);
    }
    if(spec.accessories?.includes('antenna')){const headHeight=spec.type==='delivery'?1.60:1.0;part(root,'cylinder',metal,[.012,.20,.012],[.1,headHeight,0]);part(root,'sphere',accent,[.035,.035,.035],[.1,headHeight+.1,0]);}
    const descriptors=C.jointSchema(spec.type);
    root.userData={spec,joints,jointDescriptors:descriptors,height:({delivery:1.60,carrier:1.1}[spec.type])*(spec.scale||1)};
    root.traverse(o=>{if(o.isMesh)o.userData.robotRoot=root;});
    return C.applyRobotRig(root,spec.rig);
  };
  C.animateRobot=(root,phase,moving=false,interacting=false,time=0)=>{
    if(root.userData.industrialQuadruped)return C.animateQuadruped(root,phase,moving,interacting,time);
    const {joints:j}=root.userData;
    // Reset pose first so pausing or changing tasks never leaves stale limbs.
    for(const d of root.userData.jointDescriptors){const q=j[d.name];if(!q)continue;if(d.type==='prismatic')q.position.y=q.userData.restY??(q.userData.restY=q.position.y);else q.rotation[d.axis]=0;}
    for(const d of root.userData.jointDescriptors)if(d.type==='continuous')j[d.name].rotation.x=phase;else if(d.type==='prismatic'){const g=j[d.name];
      // This carrier has a fixed cargo deck, not an exposed lifting mechanism.
      // Keep it supported by the chassis in pickup and handoff states too.
      if(root.userData.spec.type==='carrier'&&d.name==='lift'){g.position.y=g.userData.restY;continue;}
      g.position.y=g.userData.restY+(interacting?(Math.sin(time*2)+1)*Math.min(d.upper,.18)/2:0);}else j[d.name].rotation.y=Math.sin(time)*.12;
  };
  C.makeHuman = (index=0,space=false)=>{
    const root=new T.Group(),skin=C.material('#d9b69f'),shirt=C.material(space?'#edf4fa':['#3b7dc2','#94b4d3','#ced9e6','#667f9f'][index%4]),pants=C.material('#4b5f7c'),hair=C.material('#4a4d55'),sole=C.material('#314359'),accent=C.material('#4a9bea');
    const torso=new T.Group();torso.position.y=1.03;root.add(torso);C.part(torso,'sphere',shirt,[.19,.29,.13],[0,.21,0]);C.part(torso,'sphere',skin,[.13,.16,.13],[0,.67,0]);C.part(torso,'sphere',hair,[.134,.07,.132],[0,.78,-.01]);
    if(space){C.part(torso,'sphere',C.material('#bce3ff',{transparent:true,opacity:.22,depthWrite:false}),[.185,.21,.185],[0,.68,0]);C.part(torso,'box',accent,[.17,.14,.04],[0,.26,.13]);C.part(torso,'box',shirt,[.30,.35,.14],[0,.29,-.19]);}
    const limbs={};for(const [s,x]of [['left',-.22],['right',.22]]){const arm=new T.Group();arm.position.set(x,.39,0);torso.add(arm);C.part(arm,'cylinder',shirt,[.06,.30,.06],[0,-.14,0]);C.part(arm,'cylinder',skin,[.045,.26,.045],[0,-.40,0]);C.part(arm,'sphere',skin,[.05,.065,.045],[0,-.55,0]);limbs[s+'Arm']=arm;const leg=new T.Group();leg.position.set(x*.48,1.02,0);root.add(leg);C.part(leg,'cylinder',pants,[.075,.83,.075],[0,-.44,0]);C.part(leg,'box',sole,[.14,.12,.25],[0,-.95,.06]);limbs[s+'Leg']=leg;}
    root.userData.limbs=limbs;return root;
  };
  C.animateHuman=(root,phase,moving,interacting)=>{const j=root.userData.limbs;for(const [s,offset]of [['left',0],['right',Math.PI]]){j[s+'Leg'].rotation.x=moving?Math.sin(phase+offset)*.26:0;j[s+'Arm'].rotation.x=moving?-Math.sin(phase+offset)*.24:0;}if(interacting)j.rightArm.rotation.x=-.9;};
  C.disposeModel=root=>{const materials=new Set(),geos=new Set();root.traverse(o=>{if(o.userData.stationCrew)C.disposeStationCrew?.(o);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(!m.userData.sharedCharacterAsset)materials.add(m);});if(o.geometry&&!o.geometry.userData.sharedRobotAsset&&!o.geometry.userData.sharedCharacterAsset&&!Object.values(geometries).includes(o.geometry))geos.add(o.geometry);});materials.forEach(m=>{if(!m.map?.userData?.sharedCharacterAsset)m.map?.dispose();m.dispose();});geos.forEach(g=>g.dispose());root.parent?.remove(root);};
})();
