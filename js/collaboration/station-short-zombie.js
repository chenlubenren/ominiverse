/* A non-graphic infection chase. Original station bodies, limbs and real hatch.
 * Eight shared seconds precede deployment-dependent diagnosis/lure/lock choices.
 */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,PI=Math.PI,clamp=T.MathUtils.clamp,V=p=>new T.Vector3(...p);
  const smooth=u=>{u=clamp(u,0,1);return u*u*(3-2*u);},ramp=(t,a,b)=>smooth((t-a)/(b-a));
  const point=p=>({point:p}),actor=(id,anchor='chest')=>({actor:id,anchor}),hand=target=>({target,grip:.16});
  const shot=(start,end,name,position,target,fov=49)=>({start,end,name,position,target,fov});
  const cue=(start,end,action,lookAt,hands,extra={})=>({start,end,action,lookAt,...hands&&{hands},...extra});
  const samplePos=[-.32,1.58,-2.08],panelPos=[1.43,1.42,-.455];
  const initialInfected=[[0,-.55,.48,-2.45,0],[2.4,-.55,.48,-2.45,0],[3.4,-.49,.50,-2.31,.22],[4.8,-.18,.54,-1.78,.45],[6.2,-.35,.53,-1.28,.25],[8,-.85,.50,-1.1,.15]];
  const initialLead=[[0,.75,.48,-1.55,PI],[2.5,.75,.48,-1.55,PI],[3.4,1.63,.39,-.68,0],[4.0,1.63,.39,-.68,0],[4.6,.75,.51,-.73,.1],[5.5,0,.51,-.59,0],[7,0,.49,.63,PI],[8,-.55,.48,1.15,PI]];
  const base={
    id:'zombie',title:'别让它学会开门',aliases:['别让它学会开门','丧尸短片','空间站丧尸','感染追逐','丧尸开门'],duration:30,sourceModuleId:'wentian',branchAt:8,
    logline:'孢子让同伴突然扑抓。门能挡住他，却挡不住模仿；一台机器人引开追逐，另一台用真实探针把人找回来。',
    crew:[
      {id:'lead',name:'林岚',crewIndex:0,keys:[...initialLead,[14,-.85,.48,1.6,PI],[22,-.85,.49,1.6,PI],[30,-.65,.49,1.25,PI]],cues:[cue(0,2.6,'listen',actor('infected')),cue(2.6,4.6,'press',point(panelPos),{right:hand(point(panelPos))}),cue(4.6,8,'reach',actor('infected'),{left:hand(point([-.35,1.75,.35]))}),cue(8,25,'beckon',actor('infected')),cue(25,30,'beckon',actor('infected'))]},
      {id:'infected',name:'江月',crewIndex:4,keys:[...initialInfected,[13,-.30,.51,-1.65,PI/2],[18,0,.48,-2.85,0],[24,0,.48,-2.85,0],[30,-.15,.49,-1.6,0]],cues:[cue(0,3,'grip',{prop:'sample'},{right:hand({prop:'sample'})}),cue(3,30,'reach',actor('lead'))]}
    ],
    robots:[
      {id:'science',role:'science',name:'萤火 · 诱导飞球',keys:[[0,.25,1.22,3.35,PI],[30,.25,1.22,3.35,PI]],cues:[]},
      {id:'medical',role:'medical',name:'水母 · 诊断伙伴',keys:[[0,-.8,1.22,3.5,PI],[30,-.8,1.22,3.5,PI]],cues:[]}
    ],
    doorKeys:[[0,0],[3.5,0],[4.8,1],[18,1],[19.2,0],[26,0],[27.2,1],[30,1]],
    props:[
      {id:'sample',kind:'cup',position:samplePos,size:[.09,.16,.09],keys:[[0,...samplePos],[3,...samplePos],[5,-.75,1.85,-2.50],[30,-.86,1.88,-2.8]],stateKeys:[{time:0,open:0,filled:true},{time:1.9,open:1,filled:true},{time:3.3,filled:false}],description:'带绿光的样本杯，打开后孢子飘向腕部。'},
      {id:'lure',kind:'alien',variant:'lightDot',position:[0,1.8,-1.8],size:[.085,.085,.085],stateKeys:[{time:0,visible:false}],description:'机器人前方跳动的青色光标，感染者双手追着光标而去。'}
    ],
    events:[
      {start:1.9,end:3.5,id:'spore-exposure',type:'infection',actor:'infected',target:'sample',description:'孢子从杯口漂到腕部，感染者全身变红，腕环和胸徽脉冲亮起。'},
      {start:3.5,end:8,id:'first-chase',type:'chase',actor:'infected',target:'lead',description:'感染者连续扑抓，林岚触碰真实面板开门，侧身逃到另一舱。'},
      {start:8,end:19,id:'robot-choice',type:'branch',actor:'science',target:'infected',description:'诱导、诊断和门控的机器人数量与分工改变追逐方向。'},
      {start:19,end:25,id:'probe-contact',type:'diagnosis',actor:'medical',target:'infected',description:'只有真实探针接触腕部达到持续时间才解除感染。'},
      {start:25,end:30,id:'different-fates',type:'outcome',actor:'infected',target:'lead',description:'恢复挥手、持续隔离或模仿开门，是可见的人机协作后果。'}
    ],
    shots:[
      shot(0,2.6,'样本杯与腕部',[.18,2.02,-1.20],[-.47,1.61,-2.24],39),
      shot(2.6,5,'全身变红与第一次扑抓',[1.26,2.24,-.85],[-.12,1.62,-1.92],49),
      shot(5,8,'同伴先逃过真实舱门',[-.90,2.24,1.77],[0,1.57,-.41],56),
      shot(8,11,'机器人接管抉择',[1.12,2.30,2.44],[.08,1.60,.15],53),
      shot(11,15,'扑抓转向光标',[-1.10,2.28,-.45],[.05,1.58,-1.90],52),
      shot(15,19,'门后分工',[1.22,2.43,-.68],[.03,1.60,-2.44],51),
      shot(19,23.5,'探针与躁动的手腕',[1.22,2.10,-2.24],[.01,1.67,-2.49],52),
      shot(23.5,27,'解除感染或模仿开门',[1.13,2.27,.95],[.12,1.68,-.80],54),
      shot(27,30,'被救者先挥手',[-.97,2.35,2.08],[.03,1.65,-.63],52)
    ],ending:{start:26,hold:false,outcome:'cooperation-restores-crew',motion:'挥手或隔门扑抓持续，腕环直接显示是否恢复。'}
  };
  C.stationShortStories=C.stationShortStories||[];if(!C.stationShortStories.some(s=>s.id==='zombie'))C.stationShortStories.push(base);

  function interpolate(keys,t){let a=keys[0],b=a;for(let i=1;i<keys.length;i++){b=keys[i];if(t<=b[0])break;a=b;}const u=b[0]===a[0]?0:ramp(t,a[0],b[0]);return a.slice(1).map((n,i)=>n+(i===3?Math.atan2(Math.sin(b[i+1]-n),Math.cos(b[i+1]-n)):b[i+1]-n)*u);}
  function local(pose,xyz){return V(xyz).applyAxisAngle(V([0,1,0]),pose[3]||0).add(V(pose.slice(0,3)));}
  // Crew GLB materials are shared across matrix worlds. Give this subject its
  // own tintable copies, including the mannequin head, and retain the originals
  // for the normal actor disposal path. Bones, geometry and skinning stay intact.
  function isolateInfectionMaterials(model){
    const meshes=[],materials=new Map();
    const copy=original=>{
      if(!materials.has(original)){
        const material=original.clone();material.userData={...material.userData,sharedCharacterAsset:false,styleLocked:true};
        materials.set(original,{material,color:material.color?.clone(),emissive:material.emissive?.clone(),emissiveIntensity:material.emissiveIntensity,map:material.map,vertexColors:material.vertexColors,toneMapped:material.toneMapped,roughness:material.roughness,metalness:material.metalness,envMapIntensity:material.envMapIntensity});
      }
      return materials.get(original).material;
    };
    model.traverse(mesh=>{if(!mesh.isMesh||!mesh.material)return;const original=mesh.material;meshes.push({mesh,original});mesh.material=Array.isArray(original)?original.map(copy):copy(original);});
    return{meshes,materials:[...materials.values()],infected:null};
  }
  function showInfection(appearance,infected){
    if(appearance.infected===infected)return;appearance.infected=infected;
    for(const entry of appearance.materials){
      const m=entry.material;
      // Keep a saturated warning red under the very bright film lights. The
      // cinematic tone map otherwise washes red into pink in the 12-way view.
      if(infected){m.color?.set('#9e0000');m.emissive?.set('#320000');if(m.emissive)m.emissiveIntensity=.08;m.map=null;m.vertexColors=false;m.toneMapped=false;if(m.isMeshStandardMaterial){m.roughness=.94;m.metalness=0;m.envMapIntensity=.05;}}
      else{if(entry.color)m.color.copy(entry.color);if(entry.emissive)m.emissive.copy(entry.emissive);m.emissiveIntensity=entry.emissiveIntensity;m.map=entry.map;m.vertexColors=entry.vertexColors;m.toneMapped=entry.toneMapped;if(m.isMeshStandardMaterial){m.roughness=entry.roughness;m.metalness=entry.metalness;m.envMapIntensity=entry.envMapIntensity;}}
      m.needsUpdate=true;
    }
  }
  function reinforceIsolationDoor(film){
    const armor=film.material('#c7d1cf',{roughness:.65,metalness:.3}),dark=film.material('#1c2e38',{roughness:.7}),warning=film.material('#f1b34f',{roughness:.45,emissive:'#9c4f12',emissiveIntensity:.16});
    for(const m of [armor,dark,warning])m.userData.keepObservationOpaque=true;
    const groups=[],leafMaterials=new Map();
    const solidLeafMaterial=original=>{
      if(original.transparent)return original;
      if(!leafMaterials.has(original)){const material=original.clone();material.userData={...material.userData,keepObservationOpaque:true};film.materials.push(material);leafMaterials.set(original,material);}
      return leafMaterials.get(original);
    };
    for(const leaf of film.set.door.leaves){
      // The set shares wall and door materials. Clone only the opaque leaf
      // surfaces so an observation cutaway cannot turn this door into glass.
      leaf.traverse(mesh=>{if(mesh.isMesh&&mesh.material)mesh.material=Array.isArray(mesh.material)?mesh.material.map(solidLeafMaterial):solidLeafMaterial(mesh.material);});
      const group=new T.Group();group.name='实体隔离门装甲与警戒纹';group.userData.keepObservationOpaque=true;leaf.add(group);groups.push(group);
      const box=(name,size,position,material)=>{const mesh=film.mesh(group,new T.BoxGeometry(...size),material,name,position);mesh.userData.keepObservationOpaque=true;return mesh;};
      for(const face of [-1,1]){
        box('不透明隔离门下装甲',[.75,1.19,.012],[0,.905,face*.073],armor);
        box('不透明隔离门上装甲',[.75,.57,.012],[0,2.555,face*.073],armor);
        // Keep a small, framed viewing slit while the bulk of each leaf reads
        // as metal. These plates move with the original real sliding door.
        box('观察孔下方实体护板',[.445,.27,.012],[0,1.69,face*.073],armor);
        box('观察孔上方实体护板',[.445,.15,.012],[0,2.125,face*.073],armor);
        box('窄观察孔下沿',[.48,.035,.014],[0,1.8275,face*.084],dark);
        box('窄观察孔上沿',[.48,.035,.014],[0,2.0475,face*.084],dark);
        box('隔离门横向警戒带',[.75,.16,.014],[0,.63,face*.084],dark);
        for(const x of [-.28,-.14,0,.14,.28]){const stripe=box('隔离门黄色警戒斜纹',[.055,.16,.008],[x,.63,face*.096],warning);stripe.rotation.z=-.48;}
      }
    }
    return groups;
  }
  function config(film){const x=film.zombieConfig||{},strategy=['lure','diagnose','seal','mixed'].includes(x.strategy)?x.strategy:'mixed',count=clamp(Math.round(x.count||2),1,3),roles=(x.roles?.slice(0,count)||[]);while(roles.length<count)roles.push(strategy==='diagnose'?'medical':strategy==='seal'?'cargo':strategy==='mixed'?(roles.length===0?'science':roles.length===1?'medical':'cargo'):'science');return{strategy,count,roles,branchId:x.branchId||strategy+'-'+count};}
  const commonDoor=[[0,0],[3.5,0],[4.8,1]];
  function plan(film,cfg){
    const s=film.zombie,signature=JSON.stringify(cfg);if(signature===s.signature)return;s.signature=signature;s.config=cfg;
    s.willRecover=(cfg.strategy==='mixed'||cfg.strategy==='diagnose')&&cfg.count>=2;
    s.willBreach=(cfg.count===1&&cfg.strategy!=='lure')||(cfg.strategy==='lure'&&cfg.count===3);
    s.contactSeconds=0;s.recovered=false;s.recoveryAt=null;s.doorBreached=false;s.initialPressAt=null;s.breachPressAt=null;
    const expected=cfg.roles.join(','),actual=film.robots.map(r=>r.role).join(',');
    if(expected!==actual){for(const robot of film.robots)C.disposeModel(robot.model);film.robots=[];const counts={};for(const [i,role]of cfg.roles.entries()){const n=counts[role]=(counts[role]||0)+1,id=({science:'science',medical:'medical',cargo:'engineer'}[role])+(n>1?'-'+n:''),model=C.makeStationShortRobot({role,name:({science:'诱导飞球',medical:'医护水母',cargo:'门控章鱼'}[role])});const scale=role==='cargo'?.75:1;model.scale.setScalar(scale);film.scene.add(model);film.robots.push({id,name:model.name,role,model,scale,x:0,y:0,z:0,angle:0,v:0,radius:({science:.45,medical:.50,cargo:.65}[role])*scale,keys:[],cues:[]});}}
    s.healer=film.robots.find(r=>r.role==='medical')||null;
    s.lurer=cfg.strategy==='seal'?null:film.robots.find(r=>r.role==='science')||(cfg.count>=2?film.robots.find(r=>r!==s.healer):null);
    s.gate=film.robots.find(r=>r.role==='cargo')||film.robots.find(r=>r!==s.healer&&r!==s.lurer)||null;
    for(const [i,r]of film.robots.entries()){
      const start=[[0,(i-1)*.65,1.22,3.35,PI],[8,(i-1)*.65,1.22,3.35,PI]];
      if(r===s.lurer)r.keys=[...start,[9,.25,1.22,1.48,PI],[10,.25,1.22,.62,PI],[11,.25,1.22,-.65,PI],[12,.50,1.22,-1.8,.2],[15,.15,1.24,-2.95,.1],[18,.08,1.25,-3.62,0],[23,-.42,1.25,-3.68,.20],[27,-.52,1.25,-2.45,.25],[30,-.58,1.27,-2.25,.3]];
      // The source GLB's offered right wrist sits left of its root in this
      // restrained pose. Park the probe shoulder over that measured wrist;
      // do not extend bones or enlarge the physical contact tolerance.
      else if(r===s.healer&&cfg.strategy!=='seal')r.keys=[...start,[11.5,0,1.22,2.1,PI],[13,0,1.23,.72,PI],[14.5,0,1.24,-.72,PI],[17,.23,1.26,-1.9,PI],[19.2,s.willRecover?.09:.80,1.26,s.willRecover?-2.12:-1.7,PI],[24,s.willRecover?.09:.80,1.26,s.willRecover?-2.12:-1.7,PI],[27,.65,1.25,-1.90,-PI/2],[30,.65,1.27,-1.90,-PI/2]];
      else if(cfg.strategy==='seal'&&i===1)r.keys=[...start,[8.9,0,1.22,1.18,PI],[10,0,1.23,-.70,PI],[12,1.06,1.05,-.75,0],[21,1.06,1.05,-.75,0],[30,1.06,1.07,-.75,0]];
      else r.keys=[...start,[10,i===2?-1.30:1.55,1.20,1.28,PI],[14,i===2?-1.30:1.55,1.07,.82,PI],[24,i===2?-1.30:1.55,1.07,.82,PI],[30,i===2?-1.30:1.55,1.09,.82,PI]];
      r.cues=[{start:0,end:8,action:'observe',target:actor('lead'),mood:'idle'},{start:8,end:30,action:r===s.lurer?'scan':r===s.healer?'work':'guard',target:actor('infected'),work:r===s.healer?.7:.35,mood:'alert'}];
    }
    const infected=film.actor('infected'),lead=film.actor('lead');
    const chase=s.lurer?[[11,-.80,.51,-1.18,PI/2],[13,-.30,.51,-1.65,PI/2],[16,-.05,.49,-2.40,.25],[19,0,.48,-2.85,0]]:[[11,-.72,.52,-1.07,0],[14,-.38,.51,-1.58,.25],[17,0,.49,-2.20,0],[19,0,.48,-2.85,0]];
    if(cfg.strategy==='seal')infected.keys=[...initialInfected,[12,-.35,.50,-.72,.2],[16,.35,.51,-.72,.6],[20,.75,.50,-.78,.35]];
    else infected.keys=[...initialInfected,...chase];
    if(s.willBreach)infected.keys.push([22,1.63,.39,-.68,0],[24,1.63,.39,-.68,0],[25,0,.51,-.65,0],[26.4,0,.51,.70,0],[28,.10,.53,1.40,0],[30,-.10,.52,2.2,0]);
    else if(s.willRecover)infected.keys.push([22,0,.48,-2.85,0],[24,0,.48,-2.85,0],[26,-.05,.48,-2.1,0],[28,-.15,.49,-1.55,0],[30,-.15,.50,-1.55,0]);
    else infected.keys.push([23,.75,.50,-.78,.5],[27,.55,.51,-.70,.1],[30,.15,.51,-.72,0]);
    // Collapse duplicate boundary times so seeking and sequential play agree.
    infected.keys=infected.keys.filter((key,i,a)=>!i||key[0]>a[i-1][0]);
    lead.keys=[...initialLead,[14,-.85,.48,1.6,PI],[22,-.85,.49,1.6,PI],...(s.willBreach?[[25,-.65,.51,2.0,PI],[28,-.50,.52,2.8,PI],[30,-.4,.51,3.6,PI]]:[[30,-.65,.50,1.25,PI]])];
    s.infectedPath=infected.keys;s.leadPath=lead.keys;
    s.doorPlan=s.willBreach?[...commonDoor,[16,1],[17.4,0],[22.6,0],[24,1],[30,1]]:s.willRecover?[...commonDoor,[17.4,1],[18.8,0],[25.8,0],[27.2,1],[30,1]]:[...commonDoor,[cfg.strategy==='seal'?11:17,1],[cfg.strategy==='seal'?12.4:18.4,0],[30,0]];
    film.story.doorKeys=s.doorPlan;
    film.story.shots=base.shots.map(shot=>({...shot}));
    if(s.willRecover)film.story.shots[7]=shot(23.5,27,'门内确认同伴恢复',[1.10,2.22,-.55],[-.05,1.60,-2.30],54);
    if(s.willBreach)film.story.shots.splice(6,3,
      shot(19,23.5,'感染者记住了按钮',[.36,1.92,-1.01],[1.43,1.55,-.60],54),
      shot(23.5,27,'门被他重新打开',[-.95,2.26,2.06],[.15,1.62,.05],53),
      shot(27,30,'追逐进入下一舱',[1.12,2.36,3.95],[-.05,1.65,2.45],51));
    else if(!s.willRecover)film.story.shots.splice(6,3,
      shot(19,23.5,'门内仍在扑抓',[-.72,2.12,-.40],[.48,1.65,-.78],58),
      shot(23.5,27,'机械腕守住门控',[-.92,2.24,1.76],[.55,1.63,.02],51),
      shot(27,30,'隔离成功但尚未恢复',[1.10,2.30,2.10],[0,1.67,-.25],51));
  }

  C.stationShortZombie={
    setup(film){
      if(film.zombie)return;film.story={...film.story,doorKeys:film.story.doorKeys.map(k=>k.slice()),shots:film.story.shots.map(s=>({...s}))};
      const group=new T.Group();group.name='孢子感染与机器人协作';film.owned.add(group);
      const green=film.material('#a9fa65',{emissive:'#65f323',emissiveIntensity:1.0,roughness:.35}),dark=film.material('#142a32',{roughness:.45}),orange=film.material('#efb164',{roughness:.4}),cyan=film.material('#78ebdf',{emissive:'#36cfb8',emissiveIntensity:.7,roughness:.3});
      const mesh=(p,g,m,n,xyz=[0,0,0])=>film.mesh(p,g,m,n,xyz);
      const chest=new T.Group(),wrist=new T.Group();group.add(chest,wrist);chest.name='感染胸徽';wrist.name='感染腕环';
      mesh(chest,new T.TorusGeometry(.064,.012,8,32),green,'胸徽绿色感染脉冲');mesh(chest,new T.SphereGeometry(.031,14,10),green,'胸徽状态芯').scale.z=.25;
      mesh(wrist,new T.TorusGeometry(.044,.010,8,24),green,'腕环绿色感染脉冲');
      const panel=new T.Group();panel.name='实验舱内侧真实门控';panel.position.fromArray([1.43,1.55,-.34]);group.add(panel);mesh(panel,C.roundedRobotBox(.44,.49,.10,.025),dark,'门控面板');
      mesh(panel,C.roundedRobotBox(.22,.12,.015,.006),cyan,'门控显示屏',[0,.10,-.06]);const button=mesh(panel,C.roundedRobotBox(.16,.09,.045,.012),orange,'感染者模仿的实体按钮',[0,-.13,-.085]);
      const backupPanel=new T.Group();backupPanel.name='双机互锁副控制器';backupPanel.position.set(-1.43,1.55,.34);group.add(backupPanel);mesh(backupPanel,C.roundedRobotBox(.32,.40,.10,.025),dark,'副门控面板');mesh(backupPanel,C.roundedRobotBox(.16,.09,.045,.012),cyan,'副门控确认键',[0,-.13,.085]);
      const spores=[];for(let i=0;i<15;i++){const m=mesh(group,new T.SphereGeometry(.010+(i%3)*.003,10,8),green,'漂浮样本孢子');spores.push(m);}
      const beam=mesh(group,new T.CylinderGeometry(.007,.007,1,6),cyan,'诱导光束');beam.visible=false;
      const scanBeams=[],decoys=[];for(let i=0;i<3;i++){const line=mesh(group,new T.CylinderGeometry(.005,.005,1,6),cyan,'协作诊断扫描线');line.visible=false;scanBeams.push(line);const dot=mesh(group,new T.SphereGeometry(.038,12,8),cyan,'并行诱导光标');dot.visible=false;decoys.push(dot);}
      const appearance=isolateInfectionMaterials(film.actor('infected').model),doorArmor=reinforceIsolationDoor(film);
      const s=film.zombie={group,green,cyan,chest,wrist,panel,backupPanel,button,spores,beam,scanBeams,decoys,appearance,doorArmor,signature:null,config:null,contactSeconds:0,recovered:false,recoveryAt:null,doorBreached:false};
      plan(film,config(film));film.zombieSnapshot={strategy:s.config.strategy,count:s.config.count,infected:false,recovered:false};
    },
    before(film,t,dt){
      if(!film.zombie)this.setup(film);const s=film.zombie;plan(film,config(film));
      const infected=film.actor('infected'),lead=film.actor('lead');infected.keys=s.infectedPath;lead.keys=s.leadPath;
      let door=interpolate(s.doorPlan,t)[0];if(t<8)door=s.initialPressAt===null?0:ramp(t,s.initialPressAt+.05,s.initialPressAt+.95);else if(s.willBreach&&t>21)door=s.breachPressAt===null?0:ramp(t,s.breachPressAt+.05,s.breachPressAt+.95);
      film.story.doorKeys=[[0,door],[60,door]];
      if(t>=5.5&&t<8&&door<.97)lead.keys=[[0,0,.51,-.59,0],[60,0,.51,-.59,0]];
      if(s.willBreach&&t>=24.4&&door<.97)infected.keys=[[0,1.63,.39,-.68,0],[60,1.63,.39,-.68,0]];
      const pose=interpolate(infected.keys,t),leadPose=interpolate(lead.keys,t);
      for(const robot of film.robots)robot.model.visible=t>=8;
      const infectedNow=t>=3&&!s.recovered,pulse=Math.sin(t*5.4),left=local(pose,[-.23+.065*Math.sin(t*4.5),1.15+.10*Math.sin(t*4.8),.40+.09*Math.sin(t*4.0)]),right=local(pose,[.23+.065*Math.sin(t*4.1+1),1.14+.10*Math.sin(t*5+.5),.42+.09*Math.sin(t*4.5+.8)]);
      let look=actor('lead'),action=t<3?'grip':infectedNow?'reach':'beckon',hands={};
      if(t<3){look={prop:'sample'};hands.right=hand({prop:'sample'});}
      else if(s.recovered){hands.left=hand(point(local(pose,[-.30+.07*Math.sin(t*5),1.42+.08*Math.sin(t*4.5),.34]).toArray()));hands.right=hand(point(local(pose,[.24,1.08+.03*Math.sin(t*2),.30]).toArray()));look=actor(s.healer?.id||'lead');}
      else{
        hands.left=hand(point(left.toArray()));hands.right=hand(point(right.toArray()));
        if(s.lurer&&t>10&&t<20)look=actor(s.lurer.id);
        if(s.willRecover&&t>=19&&t<25){hands.right=hand(point(local(pose,[.20,1.15,.43]).toArray()));look=actor(s.healer.id);action='steady';}
        if((s.willBreach&&t>=21.3&&t<24.5)||(s.config.strategy==='seal'&&t>19&&t<25)){hands.right=hand(point(panelPos));look=point(panelPos);action='press';}
      }
      infected.cues=[cue(0,31,action,look,hands,{lean:infectedNow?.075+.015*pulse:.018})];
      if(s.willBreach&&t>24)lead.cues=[cue(0,31,'reach',actor('infected'),{left:hand(point(local(leadPose,[-.26,1.2+.1*Math.sin(t*4),.40]).toArray())),right:hand(point(local(leadPose,[.26,1.2+.1*Math.cos(t*4),.40]).toArray()))},{lean:.06})];
      else if(t>=8)lead.cues=[cue(0,31,s.recovered?'beckon':'reach',actor('infected'),{left:hand(point(local(leadPose,[-.28,1.37+.07*Math.sin(t*4.6),.34]).toArray()))})];
      const sample=film.props.get('sample');if(sample?.parts.fill){sample.parts.fill.material.color.set('#91ed67');sample.parts.fill.material.emissive?.set('#356e21');}
      s.infectedNow=infectedNow;
    },
    after(film,t,dt){
      const s=film.zombie;if(!s)return;const inf=film.actor('infected'),lead=film.actor('lead'),sample=film.props.get('sample'),lure=film.props.get('lure');
      const chest=C.stationFilmChestPosition(inf.model),wrist=C.stationFilmHandPosition(inf.model,'right');
      s.chest.position.copy(chest).add(V([0,.10,.18]).applyQuaternion(inf.model.quaternion));s.chest.quaternion.copy(inf.model.quaternion);s.wrist.position.copy(wrist);s.wrist.quaternion.copy(inf.model.quaternion);
      s.chest.visible=s.wrist.visible=t>=2.75;s.green.color.set(s.recovered?'#76e4db':'#a9fa65');s.green.emissive.set(s.recovered?'#35baa8':'#65ef27');s.green.emissiveIntensity=s.recovered?.05+.03*Math.sin(t*2):.06+.13*(.5+.5*Math.sin(t*8));
      const source=sample?.root.position||V(samplePos);for(const [i,m]of s.spores.entries()){const u=clamp((t-2.1-i*.035)/1.2,0,1);m.visible=t>2.1+i*.035&&u<1;m.position.copy(source).lerp(wrist,u).add(V([Math.sin(i*2.1+t*3)*.10,Math.sin(i*1.7+t*4)*.09,Math.cos(i+t*3)*.07]).multiplyScalar(Math.sin(u*PI)));}
      if(s.lurer&&t>=9.5&&t<24&&!s.recovered){const tip=C.stationShortRobotTarget(s.lurer.model,'capture')||s.lurer.model.localToWorld(V([0,.30,.28])),pos=tip.clone().add(V([Math.sin(t*3)*.12,.12+.06*Math.sin(t*3.3),.35]).applyQuaternion(s.lurer.model.quaternion));if(lure){lure.root.visible=true;lure.root.position.copy(pos);}const delta=pos.clone().sub(tip);s.beam.visible=true;s.beam.position.copy(pos).add(tip).multiplyScalar(.5);s.beam.scale.y=delta.length();s.beam.quaternion.setFromUnitVectors(V([0,1,0]),delta.normalize());}else{s.beam.visible=false;if(lure)lure.root.visible=false;}
      if(s.healer&&t>=19&&t<=25&&!s.recovered){
        const contact=C.reachStationFilmRobot(s.healer.model,'right',wrist,1);s.lastContact=contact?{error:contact.error,reachable:contact.reachable}:null;
        if(contact?.reachable&&contact.error<.045&&s.willRecover){s.contactSeconds+=Math.max(0,dt);film.contact('zombie-probe-contact',contact.actual,wrist,.045,{actor:s.healer.id,prop:'infected-wrist'});}else s.contactSeconds=Math.max(0,s.contactSeconds-Math.max(0,dt)*.7);
        const required=s.config.count>=3?.65:1.20;if(s.contactSeconds>=required){s.recovered=true;s.recoveryAt=t;film.facts.resultFlags['infection-cleared']=true;film.facts.resultFlags['crew-recovered']=true;}
      }
      if(t>2.6&&t<4.6&&film.contact('lead-opens-real-door',C.stationFilmHandPosition(lead.model,'right'),V(panelPos),.045,{actor:'lead',prop:'door-panel'})){s.initialPressAt??=t;s.button.position.z=-.093;}
      if(t>12&&t<24)for(const robot of film.robots){if(robot===s.healer||robot===s.lurer||!robot.model.userData.arms?.length)continue;const target=V([robot.x<0?-1.43:1.43,1.42,robot.z<0?-.455:.455]),side=robot.role==='science'?'left':'right',contact=C.reachStationFilmRobot(robot.model,side,target,1);if(contact?.reachable&&contact.error<.05)film.contact('robot-door-control-'+robot.id,contact.actual,target,.05,{actor:robot.id,prop:'door-panel'});}
      for(let i=0;i<3;i++){const robot=film.robots[i],line=s.scanBeams[i],dot=s.decoys[i];line.visible=dot.visible=false;if(!robot||t<10||t>25||s.recovered)continue;const from=robot.model.localToWorld(V([0,.45,.20]));if(s.config.strategy==='diagnose'&&robot!==s.healer){const to=chest.clone().add(V([.05*Math.sin(t*3+i),.10*Math.sin(t*4+i),.16])),delta=to.clone().sub(from);line.visible=true;line.position.copy(from).add(to).multiplyScalar(.5);line.scale.y=delta.length();line.quaternion.setFromUnitVectors(V([0,1,0]),delta.normalize());}if(s.config.strategy==='lure'&&robot!==s.lurer){dot.visible=true;dot.position.copy(from).add(V([Math.sin(t*3+i)*.18,.09*Math.cos(t*4+i),-.3]));}}
      // The isolated subject copies the same control action shown in the opening.
      if(s.willBreach&&t>=21&&t<24.4){const handPos=C.stationFilmHandPosition(inf.model,'right');if(film.contact('infected-learned-button',handPos,V(panelPos),.045,{actor:'infected',prop:'door-panel'})){s.breachPressAt??=t;s.button.position.z=-.093;}}
      s.doorBreached=!!(s.willBreach&&inf.z>.30&&t>24);const contained=t>19&&!s.doorBreached&&!s.recovered;
      if(t>=3)film.facts.resultFlags['spore-exposure']=true;if(t>=7.1)film.facts.resultFlags['lead-escaped-first']=lead.z>.25;if(s.doorBreached)film.facts.resultFlags['door-breached']=true;if(contained)film.facts.resultFlags['infection-contained']=true;
      if(s.recovered){film.facts.resultFlags['infection-contained']=false;film.facts.resultFlags['recovered-wave']=t>27;}
      if(s.doorBreached)film.facts.resultFlags['infection-contained']=false;
      showInfection(s.appearance,t>=3&&!s.recovered);
      const alarm=t<3?0:s.recovered?0:.65;film.set.update(t,{alarm,contained:s.recovered});
      const outcome=t<8?'shared-incident':s.recovered?'recovered':s.doorBreached?'door-breached':contained?'contained-infection':'pursuit';
      film.zombieSnapshot={strategy:s.config.strategy,count:s.config.count,roles:film.robots.map(r=>r.role),branchId:s.config.branchId,infected:t>=3&&!s.recovered,recovered:s.recovered,contained,doorBreached:s.doorBreached,probeContactSeconds:+s.contactSeconds.toFixed(3),lastContact:s.lastContact||null,recoveryAt:s.recoveryAt,initialPressAt:s.initialPressAt,breachPressAt:s.breachPressAt,outcome};
    },
    snapshot:film=>film.zombieSnapshot||null,
    dispose(film){if(!film.zombie)return;const s=film.zombie;s.group.parent?.remove(s.group);for(const {mesh,original}of s.appearance.meshes)mesh.material=original;for(const {material}of s.appearance.materials)material.dispose();for(const group of s.doorArmor)group.parent?.remove(group);delete film.zombie;delete film.zombieSnapshot;}
  };
})();
