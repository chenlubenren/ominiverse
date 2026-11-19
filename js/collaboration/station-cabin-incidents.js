/* Local cabin events in the live station. All effects are owned by the event;
   existing cameras, controls, people, geometry and lamps stay live. Wall
   failures appear on the hull and inside the cabin; the food spill and the
   live space class happen inside only and are shown in the cabin view. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,K=C.StationEventKit,V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),TAU=Math.PI*2;
  const clamp=T.MathUtils.clamp,ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x);},ramp=(t,a,b)=>ease((t-a)/(b-a)),pulse=(t,a,b,f=.6)=>ramp(t,a,a+f)*(1-ramp(t,b-f,b));
  const catalog={
    breach:{title:'舱壁破损漏气',duration:40,color:'#8bdcff',wall:true,intro:'舱壁密封层撕裂，碎屑和冰晶沿着压力喷流逸出。',working:'维修机器人追踪漏点，将柔性补片压向破口。',ending:'补片锁紧，压力恢复；舱壁留下了一块新补丁。',
      beats:[[7,'舱压持续下降，乘员避开漏点并抓牢扶手。'],[11,'维修机器人用超声检漏仪锁定破口位置。'],[19,'机器人压上柔性补片，乘员协助扣紧快锁。']]},
    fire:{title:'设备电弧火情',duration:40,color:'#ffad62',wall:true,intro:'设备接线端出现电弧，失重火焰在机柜前聚成一团。',working:'机器人切断故障回路，用灭火剂包围火团。',ending:'电弧停止，火团熄灭，机器人封住烧蚀面板。',
      beats:[[6,'烟雾告警：乘员戴好面罩，远离故障机柜。'],[12,'维修机器人切断该机柜供电。'],[19,'机器人喷射灭火剂，失重火团被压灭。']]},
    coolant:{title:'冷却管爆裂',duration:40,color:'#5de9dc',wall:true,intro:'冷却接头崩开，冷却液在舱内凝成大大小小的漂浮液滴。',working:'机器人吸回液滴，装上新的管路卡箍。',ending:'卡箍闭合，喷流消失，冷却回路重新稳定。',
      beats:[[7,'乘员避开喷流，用吸水布收拢身边的液滴。'],[14,'维修机器人启动吸液嘴回收漂浮液滴。'],[19,'机器人装上新卡箍，回路压力回升。']]},
    blackout:{title:'舱段断电',duration:40,color:'#ffcf82',wall:true,intro:'本舱设备屏幕依次熄灭，应急指示灯开始闪烁。',working:'机器人取出故障电源盒，接通便携电源。',ending:'供电恢复，状态灯逐排亮起；备用电池继续值守。',
      beats:[[6,'乘员打开应急照明，核对关键设备状态。'],[12,'维修机器人取出备用电池。'],[22,'跨接电缆接通，设备逐排恢复供电。']]},
    spill:{title:'餐包破裂 · 漂浮物回收',duration:36,color:'#ffc27a',wall:false,intro:'一袋热汤餐包在失重中破裂，汤汁液滴、面条和碎屑四散漂浮。',working:'乘员抓取大块漂浮物，机器人用吸嘴回收液滴和碎屑。',ending:'漂浮物回收完毕，通风口滤网已清理。',
      beats:[[5,'乘员先抓住破裂的餐包，避免液滴继续扩散。'],[10,'服务机器人展开吸嘴，沿液滴云边缘回收。'],[24,'机器人清理通风口滤网，舱内恢复整洁。']]},
    broadcast:{title:'天宫课堂 · 天地通话',duration:36,color:'#9fd6ff',wall:false,intro:'天地通话接通，乘员在舱内向地面课堂打招呼。',working:'乘员演示失重水球实验，机器人稳住摄像机并补光跟拍。',ending:'课堂结束，乘员与地面的同学们挥手告别。',
      beats:[[4,'服务机器人架好摄像机和补光灯，信号已上行。'],[10,'乘员在水球中放入泡腾片，气泡在失重中不上浮。'],[26,'地面课堂提问，乘员边演示边回答。']]}
  };
  class StationCabinIncidents extends C.StationOrbitalEvents {
    constructor(d){super(d);this.duration=40;this.units=[];this.materialSwaps=[];this.incident=true;}
    start(options={}){
      this.id=catalog[options.orbitalEvent]?options.orbitalEvent:'breach';this.story=catalog[this.id];this.duration=this.story.duration;this.spec=C.stationModule(options.targetModule||'tianhe')||C.stationModule('tianhe');this.targetModule=this.spec.id;this.title=this.spec.name+' · '+this.story.title;this.options={...options,scenario:'visitor',orbitalEvent:this.id,targetModule:this.targetModule};
      const d=this.d;d.options=this.options;d.active=true;d.loading=false;d.paused=false;d.time=0;d.duration=this.duration;d.story={title:this.title};d.outcome=null;d.ui.hidden=true;d.stageActors=[];d.robot=null;document.body.dataset.stationEvent=this.id;
      try{
        this.scene=this.s.scene;this.camera=this.s.v.camera;this.room=this.s.getRoom(this.targetModule);
        this.effects=this.group('目标舱段事件 / '+this.targetModule,this.s.root);this.effects.userData.noAO=true;this.effects.userData.stationEvent=this.id;
        this.outsideFrame=this.group('舱外事件锚点',this.effects);this.insideFrame=this.group('舱内事件锚点',this.room.root);this.insideFrame.userData.noAO=true;this.insideFrame.userData.stationEvent=this.id;
        const inside=this.makeUnit('interior');this.insideFrame.add(inside.root);
        if(this.story.wall){const outside=this.makeUnit('exterior');this.outsideFrame.add(outside.root);outside.root.position.set(this.spec.width*.36,4.3,-this.spec.length*.18);outside.root.rotation.set(-Math.PI*.34,.36,0);outside.root.scale.setScalar(2.1);}
        this.placeInside();
        this.facts={liveEvent:true,independentStage:false,keyScene:this.id,keySceneReached:false,keySceneAt:10,completed:false,targetModule:this.targetModule,repairProgress:0,leakRate:0,temperature:22,pressure:101.3,power:1,beats:[],sourceModel:'tiangong',screenMaterials:0};
        if(this.id==='blackout')this.captureLocalPower();this.syncAnchor();this.step();this.render();return this.snapshot();
      }catch(error){d.active=false;this.dispose();throw error;}
    }
    placeInside(){const W=this.room.spec.width,L=this.room.spec.length;if(this.story.wall){this.insideFrame.position.set(-W/2+1.0,1.8,-L*.18);this.insideFrame.rotation.set(0,Math.PI/2,0);}else{this.insideFrame.position.set(0,1.55,-L*.12);this.insideFrame.rotation.set(0,this.id==='broadcast'?Math.PI/2:0,0);}}
    makeUnit(view){
      const root=new T.Group();root.name=view+' / '+this.story.title;const u={view,root,leds:[],arcs:[],cables:[],droplets:[],items:[]};this.units.push(u);
      const p=K.palette(this),metal=this.material('#a0b4c2',{metalness:.72,roughness:.38}),dark=this.material('#192938',{roughness:.65}),yellow=this.material('#e3b04f',{roughness:.5}),black=this.material('#070b10',{roughness:.9});
      u.robot=K.freeFlyer(this,{scale:view==='exterior'?1.45:1.15,accent:'#4f86c6'});root.add(u.robot.root);u.robot.root.name='舱段维修机器人';
      if(this.id==='spill')return this.makeSpill(u,p);
      if(this.id==='broadcast')return this.makeBroadcast(u,p);
      K.add(this,root,K.roundedBox(1.55,1.5,.13,.03),p.white,'维修口金属基座',V(0,0,-.06));K.add(this,root,K.roundedBox(1.37,1.32,.06,.015),dark,'设备凹槽',V(0,0,.025));
      for(const x of [-.69,.69])for(const y of [-.65,.65]){K.cyl(this,root,.045,.05,.06,p.steel,'紧固螺钉',V(x,y,.055),[Math.PI/2,0,0],12);this.box(root,[.05,.009,.008],dark,'螺钉凹槽',V(x,y,.088));}
      for(const side of [-1,1])for(let i=0;i<5;i++){const strip=this.box(root,[.12,.035,.012],yellow,'检修口警戒斜纹',V(side*.69,-.4+i*.2,.09));strip.rotation.z=-.65;}
      for(const x of [-.53,.53]){const m=this.sphere(root,.06,this.glow('#ff9260'),'局部警示灯',V(x,.59,.11));u.leds.push(m);}
      if(view==='exterior'){u.hazardRing=this.ring(root,1.03,this.glow(this.story.color,.45),'外舱局部故障信标',V(0,0,.12),.03);u.hazardRing.userData.noAO=true;}
      u.patch=this.group('维修补片',root);K.add(this,u.patch,K.roundedBox(1.08,1.06,.07,.03),p.silver,'压紧补片');K.add(this,u.patch,K.roundedBox(.86,.82,.02,.01),p.gold,'补片耐压层',V(0,0,.045));for(const x of [-.42,.42])for(const y of [-.4,.4])K.cyl(this,u.patch,.035,.035,.03,p.dark,'快锁卡扣',V(x,y,.06),[Math.PI/2,0,0],12);u.patch.visible=false;
      u.scan=K.plume(this,1,.18,'#9ff3ff');root.add(u.scan);
      if(this.id==='breach'){
        const pts=[];for(let i=0;i<18;i++){const a=i/18*TAU,r=.3+(i%3)*.05+Math.sin(i*2.7)*.03;pts.push(new T.Vector2(Math.cos(a)*r,Math.sin(a)*r));}this.mesh(root,new T.ShapeGeometry(new T.Shape(pts)),black,'撕裂后的暗色破口',V(0,0,.075));
        for(let i=0;i<10;i++){const a=i/10*TAU,petal=K.add(this,root,new T.BoxGeometry(.2,.16,.018),metal,'外翻的舱壁碎边',V(Math.cos(a)*.38,Math.sin(a)*.38,.11));petal.rotation.set(Math.sin(a)*.7,-Math.cos(a)*.7,a);}
        for(let i=0;i<6;i++){const a=i*TAU/6+.2,pts3=[V(Math.cos(a)*.36,Math.sin(a)*.36,.08),V(Math.cos(a+.12)*.5,Math.sin(a+.12)*.5,.085),V(Math.cos(a-.05)*.64,Math.sin(a-.05)*.64,.08)];this.mesh(root,new T.TubeGeometry(new T.CatmullRomCurve3(pts3),12,.008,5,false),black,'舱壁放射裂缝');}
        u.jet=new K.Particles(this,view==='exterior'?160:120,{additive:false,soft:2.2,name:'泄压气流'});u.ice=new K.Particles(this,60,{soft:1,core:.8,name:'冰晶'});root.add(u.jet.points,u.ice.points);
        u.debris=[];for(let i=0;i<9;i++){const m=K.fragment(this,i%2?'foil':'metal',i+20,.04);root.add(m);u.debris.push(m);}
      }else if(this.id==='fire'){
        K.add(this,root,new T.BoxGeometry(1.12,.95,.1),this.material('#1a1612',{roughness:.95}),'烧蚀设备面板',V(0,-.06,.1));for(let i=0;i<5;i++){this.box(root,[.68,.08,.04],this.material(i%2?'#6a7e8e':'#b59465',{metalness:.5}),'供电端子',V(0,.29-i*.16,.18));for(const x of [-.43,.43])K.cyl(this,root,.04,.04,.04,metal,'接线螺母',V(x,.29-i*.16,.19),[Math.PI/2,0,0],6);}
        for(let i=0;i<5;i++){const line=new T.Line(new T.BufferGeometry().setFromPoints(Array.from({length:10},()=>V())),new T.LineBasicMaterial({color:new T.Color('#c4ecff').convertSRGBToLinear(),transparent:true,opacity:.95,toneMapped:false,blending:T.AdditiveBlending}));line.name='跳动电弧';line.userData.noAO=true;this.geometries.add(line.geometry);this.materials.add(line.material);root.add(line);u.arcs.push(line);}
        u.arcGlow=K.sprite(this,'glow','#bfe6ff',.9);u.arcGlow.position.set(0,.15,.3);root.add(u.arcGlow);
        u.flame=new K.Particles(this,140,{soft:1.6,core:.35,name:'失重火团'});u.smoke=new K.Particles(this,90,{additive:false,soft:1.8,name:'设备烟雾'});u.sparks=new K.Particles(this,60,{soft:.8,core:1,name:'飞散火花'});u.agent=new K.Particles(this,120,{additive:false,soft:2,name:'灭火剂雾'});root.add(u.smoke.points,u.flame.points,u.sparks.points,u.agent.points);
      }else if(this.id==='coolant'){
        for(const side of [-1,1]){const pipe=K.cyl(this,root,.11,.11,.54,metal,'断开的冷却管',V(side*.44,0,.3),[0,0,Math.PI/2],24);void pipe;for(const x of [side*.21,side*.63]){const ring=this.ring(root,.15,metal,'冷却管法兰',V(x,0,.3),.03);ring.rotation.y=Math.PI/2;}K.add(this,root,K.roundedBox(.24,.39,.1,.02),dark,'管路支架',V(side*.57,0,.12));}
        const water=new T.MeshPhysicalMaterial({color:new T.Color('#7fe3ea').convertSRGBToLinear(),roughness:.04,metalness:0,transparent:true,opacity:.72,clearcoat:1,clearcoatRoughness:.05,depthWrite:false});this.materials.add(water);
        for(let i=0;i<38;i++){const m=this.mesh(root,new T.SphereGeometry(.022+(i%5)*.011,16,12),water,'漂浮冷却液滴');u.droplets.push(m);}
        u.spray=new K.Particles(this,90,{soft:1.6,core:.3,name:'冷却液喷雾'});root.add(u.spray.points);
        u.clamp=this.group('可闭合维修卡箍',root);u.clampHalves=[];for(const side of [-1,1]){const ring=this.mesh(u.clamp,new T.TorusGeometry(.19,.05,12,30,Math.PI),yellow,'卡箍半环');ring.rotation.set(0,Math.PI/2,side<0?Math.PI:0);u.clampHalves.push(ring);}
        u.suction=new K.Particles(this,50,{soft:1.4,name:'吸液气流'});root.add(u.suction.points);
      }else{
        for(let i=0;i<4;i++){K.add(this,root,K.roundedBox(1.04,.2,.08,.015),dark,'供电模组',V(0,.36-i*.25,.14));for(let j=0;j<6;j++){const light=this.box(root,[.085,.035,.02],this.glow('#78ead3'),'供电指示格',V(-.38+j*.15,.36-i*.25,.19));u.leds.push(light);}}
        u.battery=this.group('便携电源盒',root);K.add(this,u.battery,K.roundedBox(.45,.63,.3,.04),yellow,'备用电池');K.add(this,u.battery,K.roundedBox(.3,.37,.02,.008),dark,'电池面板',V(0,0,.155));for(let i=0;i<3;i++)this.box(u.battery,[.2,.035,.02],this.glow('#72e8cf'),'电池电量',V(0,-.1+i*.1,.17));K.add(this,u.battery,new T.TorusGeometry(.09,.02,8,16,Math.PI),p.dark,'电池提手',V(0,.33,0));
        for(let i=0;i<2;i++){const cable=this.mesh(root,new T.TubeGeometry(new T.CatmullRomCurve3([V(.4,-.5,.2),V(.8,-.8,.6),V(.9,-.3,1.1),V(.7,0,1.5)]),24,.022,8,false),this.material(i?'#cc6e50':'#3c5866',{roughness:.7}),'应急跨接线');cable.position.x=i*.07;u.cables.push(cable);}
        u.sparks=new K.Particles(this,40,{soft:.8,core:1,name:'断路火花'});root.add(u.sparks.points);
      }
      return u;
    }
    makeSpill(u,p){
      const root=u.root;
      // Torn soup pouch, utensils, noodle strands, droplets and crumbs.
      const bag=u.bag=K.pouch(this,7);bag.scale.set(.9,1.2,.5);bag.children[0].material=this.material('#d8cfbf',{map:K.texture('mli-silver'),roughness:.4,metalness:.5});root.add(bag);
      const soup=new T.MeshPhysicalMaterial({color:new T.Color('#c9853f').convertSRGBToLinear(),roughness:.12,transparent:true,opacity:.85,clearcoat:.8,depthWrite:false});this.materials.add(soup);
      for(let i=0;i<34;i++){const m=this.mesh(root,new T.SphereGeometry(.02+(i%5)*.012,14,10),soup,'漂浮汤汁液滴');u.droplets.push(m);}
      const noodle=this.material('#e8d39a',{roughness:.6});u.noodles=[];for(let i=0;i<7;i++){const r=K.rand(i+40),pts=[];for(let j=0;j<6;j++)pts.push(V((r()-.5)*.22,(r()-.5)*.22,j*.05));const m=this.mesh(root,new T.TubeGeometry(new T.CatmullRomCurve3(pts),24,.006,5,false),noodle,'漂浮面条');u.noodles.push(m);}
      const spoon=this.group('漂浮餐勺',root);K.add(this,spoon,new T.BoxGeometry(.012,.004,.13),p.steel,'勺柄',V(0,0,-.07));K.add(this,spoon,new T.SphereGeometry(.03,16,8,0,TAU,0,Math.PI/2),p.steel,'勺头',V(0,0,.02),[Math.PI,0,0]);u.items.push(spoon);
      const lid=K.add(this,root,new T.CylinderGeometry(.06,.06,.008,24),this.material('#c8462d',{roughness:.5}),'餐盒盖');u.items.push(lid);
      u.crumbs=new K.Particles(this,160,{additive:false,soft:1.2,name:'食物碎屑'});u.suction=new K.Particles(this,60,{soft:1.4,name:'吸嘴气流'});root.add(u.crumbs.points,u.suction.points);
      u.nozzle=this.group('机器人吸嘴',u.robot.tool);K.cyl(this,u.nozzle,.018,.03,.12,p.dark,'吸嘴管',V(0,-.06,0),null,14);K.add(this,u.nozzle,new T.TorusGeometry(.035,.008,8,20),p.steel,'吸嘴口',V(0,-.12,0),[Math.PI/2,0,0]);
      return u;
    }
    makeBroadcast(u,p){
      const root=u.root;
      // Camera carried by the robot, a light panel, the live screen and the water-ball demo.
      const cam=u.camera=this.group('直播摄像机',u.robot.tool);K.add(this,cam,K.roundedBox(.12,.1,.18,.015),p.black,'摄像机机身',V(0,-.06,.04));K.cyl(this,cam,.035,.04,.08,p.glass,'摄像机镜头',V(0,-.06,.16),[Math.PI/2,0,0],18);u.tally=this.sphere(cam,.01,this.glow('#ff4a4a'),'录制指示灯',V(.05,-.02,.13));
      const panel=u.light=this.group('补光灯',root);panel.position.set(.9,.35,-.5);panel.rotation.y=-.6;K.add(this,panel,K.roundedBox(.42,.3,.04,.012),p.dark,'补光灯框');u.lightFace=this.mesh(panel,new T.PlaneGeometry(.38,.26),this.glow('#fff4e2'),'补光灯面',V(0,0,.022));K.cyl(this,panel,.01,.01,.5,p.steel,'灯架',V(0,-.4,0),null,8);
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=288;const g=canvas.getContext('2d');const grad=g.createLinearGradient(0,0,0,288);grad.addColorStop(0,'#16324c');grad.addColorStop(1,'#0b1a28');g.fillStyle=grad;g.fillRect(0,0,512,288);
      for(let row=0;row<3;row++)for(let i=0;i<9;i++){const x=40+i*52+(row%2)*20,y=120+row*48;g.fillStyle='#2c4d6a';g.fillRect(x-16,y+16,32,26);g.fillStyle='#d9c6a8';g.beginPath();g.arc(x,y+6,11,0,TAU);g.fill();g.fillStyle=['#3d6fb0','#b04848','#3c8a5e','#c08a2c'][(i+row)%4];g.fillRect(x-14,y+18,28,20);}
      g.fillStyle='#ffffff';g.font='bold 30px Microsoft YaHei,sans-serif';g.fillText('天宫课堂 · 地面分课堂',24,48);g.fillStyle='#ff5a5a';g.beginPath();g.arc(470,38,9,0,TAU);g.fill();g.font='18px Microsoft YaHei,sans-serif';g.fillStyle='#d2e6f5';g.fillText('LIVE  天地通话已接通',24,82);
      const tex=new T.CanvasTexture(canvas);tex.encoding=T.sRGBEncoding;this.textures.add(tex);
      const screen=this.group('天地通话屏幕',root);screen.position.set(-.2,.55,-.95);K.add(this,screen,K.roundedBox(.82,.5,.04,.015),p.black,'屏幕外框');this.mesh(screen,new T.PlaneGeometry(.76,.43),new T.MeshBasicMaterial({map:tex,toneMapped:false}),'地面课堂画面',V(0,0,.022));this.materials.add(screen.children.at(-1).material);
      const water=new T.MeshPhysicalMaterial({color:new T.Color('#cfefff').convertSRGBToLinear(),roughness:.02,metalness:0,transparent:true,opacity:.42,clearcoat:1,clearcoatRoughness:.02,depthWrite:false,side:T.DoubleSide});this.materials.add(water);
      u.ball=this.mesh(root,new T.SphereGeometry(.13,48,32),water,'失重水球',V(.15,.05,.2));u.dye=this.mesh(root,new T.SphereGeometry(.12,32,24),new T.MeshBasicMaterial({color:new T.Color('#2f6fe0').convertSRGBToLinear(),transparent:true,opacity:0,depthWrite:false}),'泡腾片染色',V(.15,.05,.2));this.materials.add(u.dye.material);
      u.bubbles=new K.Particles(this,70,{additive:false,soft:.6,name:'水球内气泡'});root.add(u.bubbles.points);u.tablet=K.add(this,root,new T.CylinderGeometry(.02,.02,.008,18),this.material('#f2f2f0',{roughness:.7}),'泡腾片');
      return u;
    }
    captureLocalPower(){
      const poweredMaterials=this.room.materials?new Set(['screen','light','green','amber'].map(key=>this.room.materials[key]).filter(Boolean)):null;
      const clones=new Map();this.room.root.traverse(node=>{if(!node.isMesh||node===this.insideFrame||node.parent===this.insideFrame)return;for(let p=node;p;p=p.parent)if(p===this.insideFrame)return;const source=Array.isArray(node.material)?node.material:[node.material];let changed=false;const next=source.map(material=>{const powered=poweredMaterials?poweredMaterials.has(material):material?.isMeshBasicMaterial||material?.emissiveIntensity>.25;if(!powered||!material.color)return material;if(!clones.has(material)){const clone=material.clone();this.materials.add(clone);clones.set(material,{material:clone,source,color:clone.color.clone(),emissive:clone.emissive?.clone(),intensity:clone.emissiveIntensity||0});}changed=true;return clones.get(material).material;});if(changed){this.materialSwaps.push({node,original:node.material});node.material=Array.isArray(node.material)?next:next[0];}});
      this.powerMaterials=[...clones.values()];this.facts.screenMaterials=this.materialSwaps.length;this.syncPower();
    }
    syncPower(){const t=this.time,off=.7+.3*ramp(t,0,5);this.powerMaterials?.forEach((item,i)=>{const power=1-off+off*ramp(t,28+i%7*.45,32+i%7*.45),factor=.035+.965*power;item.material.color.copy(item.color).multiplyScalar(factor);if(item.emissive)item.material.emissive.copy(item.emissive).multiplyScalar(factor);item.material.emissiveIntensity=item.intensity*factor;});}
    syncAnchor(){
      const shell=this.s.shellStudy,entry=shell?.changed?shell.current:null;this.effects.visible=true;
      const rebind=id=>{for(const item of this.materialSwaps)item.node.material=item.original;this.materialSwaps=[];this.room=this.s.getRoom(id);this.room.root.add(this.insideFrame);this.placeInside();if(this.id==='blackout')this.captureLocalPower();};
      if(entry){const slots=entry.plan.slots,fallbackRole={node:'command',shenzhou:'airlock'}[this.targetModule];const slot=slots.find(slot=>shell.roomIdFor(slot)===this.targetModule)||slots.find(slot=>slot.role===this.spec.kind)||slots.find(slot=>slot.id===fallbackRole)||slots[0];if(slot){const position=shell.slotPosition(slot),scale=entry.plan.coordinateScale||1;this.outsideFrame.position.copy(position);this.outsideFrame.quaternion.identity();const radius=slot.radius?slot.radius*scale:2.5;this.outsideFrame.scale.setScalar(Math.max(.55,Math.min(2.5,radius/2)));this.facts.sourceModel='selected-shell';this.facts.shellSlot=slot.id;const roomId=shell.roomIdFor(slot)||this.targetModule;if(this.room.spec.id!==roomId)rebind(roomId);this.facts.displayModule=roomId;}else{this.effects.visible=false;this.facts.sourceModel='unavailable-shell-slot';}}
      else{const offset=this.s.modules.get(this.targetModule)?.position||V(),frame=this.s.cabinFrame(this.targetModule,offset);frame.decompose(this.outsideFrame.position,this.outsideFrame.quaternion,this.outsideFrame.scale);this.facts.sourceModel=this.s.morphology?.changed?'morphed-station':'tiangong';if(this.room.spec.id!==this.targetModule)rebind(this.targetModule);this.facts.displayModule=this.targetModule;}
      // The interior root follows the real cabin through selection, extraction,
      // walk mode and alternate-shell previews, with no extra coordinate copy.
      this.outsideFrame.visible=this.story.wall&&!(this.s.phase==='interior'&&this.s.selected===this.targetModule);this.effects.updateMatrixWorld(true);this.insideFrame.updateMatrixWorld(true);
    }
    step(){
      const t=this.time,develop=.4+.6*ramp(t,0,7),repair=ramp(t,18,31),hazard=develop*(1-repair),finished=ramp(t,30,37);
      for(const u of this.units){
        if(this.id==='spill')this.stepSpill(u,t);else if(this.id==='broadcast')this.stepBroadcast(u,t);else this.stepWall(u,t,{develop,repair,hazard,finished});
      }
      if(this.id==='blackout')this.syncPower();
      Object.assign(this.facts,{keySceneReached:t>=10-1e-6,completed:t>=this.duration-1e-6,repairProgress:+(this.story.wall?repair:ramp(t,10,30)).toFixed(4),leakRate:this.id==='breach'?+hazard.toFixed(3):0,temperature:this.id==='fire'?+(22+hazard*260).toFixed(1):22,pressure:this.id==='breach'?+(101.3-develop*18+finished*18).toFixed(1):101.3,power:this.id==='blackout'?+(.3*(1-ramp(t,0,5))+ramp(t,28,35)).toFixed(3):1,flowRate:this.id==='coolant'?+hazard.toFixed(3):0});const beat=t<7?0:t<18?1:t<32?2:3;if(!this.facts.beats.includes(beat))this.facts.beats.push(beat);
      if(t>=this.duration-3)this.d.outcome={code:this.id+'-repaired',title:this.spec.name+'：'+this.story.ending,detail:this.story.wall?'事故已处置 · 可继续观察或清除事件':'事件已完成 · 可继续观察或清除事件'};
      this.announce(t);
    }
    stepWall(u,t,{develop,repair,hazard,finished}){
      const arrive=ramp(t,10,20),departure=ramp(t,34,40),r=u.robot.root;r.visible=t>8;
      r.position.set((1-arrive)*.9+.65*departure,-.7*(1-arrive)-.4*departure,1.8-1.15*arrive+.6*departure);r.rotation.set(.12*Math.sin(t*.8),Math.PI+.12*Math.sin(t*.7),.06*Math.sin(t*.6));
      const working=t>11&&t<32;u.robot.pose(t,{reach:.25+.65*arrive*(1-departure),grip:t>17&&t<26?.1:.6,work:working?1:0});u.robot.led.material.color.set(working?'#ffd27a':'#7ce8d8').convertSRGBToLinear();
      if(u.hazardRing){u.hazardRing.material.opacity=(.35+.2*Math.sin(t*4))*(1-finished*.7);u.hazardRing.rotation.z=t*.4;}
      const scan=pulse(t,11,19,.6)*(this.id==='breach'||this.id==='coolant'?1:.6);u.scan.visible=scan>.01;if(u.scan.visible){const from=r.position.clone(),to=V(0,0,.15);u.scan.position.copy(from);u.scan.quaternion.setFromUnitVectors(V(0,-1,0),to.clone().sub(from).normalize());u.scan.scale.set(1,from.distanceTo(to),1);u.scan.material.uniforms.uPower.value=.4*scan;u.scan.material.uniforms.uTime.value=t;}
      u.leds.forEach((led,i)=>{led.material.color.set(this.id==='blackout'?(i<2?'#ffad65':finished>(i-2)/Math.max(1,u.leds.length-2)?'#7ce5d0':'#142638'):finished>.5?'#7de2c9':'#ff9562').convertSRGBToLinear();led.visible=this.id==='blackout'&&i>1?true:finished>.5||Math.sin(t*6+i)>-.4;});
      if(u.patch){u.patch.visible=(this.id==='breach'||this.id==='fire')&&t>17;const hold=r.position.clone().add(V(0,-.12,-.32));u.patch.position.copy(hold).lerp(V(0,0,.16),ramp(t,19,25));u.patch.rotation.set(0,.4*(1-ramp(t,19,25)),0);}
      if(this.id==='breach'){
        const ext=u.view==='exterior',reach=ext?3.6:2.2,fog=new T.Color('#dfeef6'),ice=new T.Color('#e8fbff');
        for(let i=0;i<u.jet.count;i++){const c=(t*1.9+i*.618)%1,on=hazard>.02;if(!on){u.jet.hide(i);continue;}const a=i*2.399,spread=.04+c*.55;u.jet.set(i,Math.cos(a)*spread*c,Math.sin(a)*spread*c,.12+c*reach,(.08+c*.45)*(ext?1.6:1),hazard*.32*(1-c),fog);}u.jet.commit();
        for(let i=0;i<u.ice.count;i++){const c=(t*1.3+i*.37)%1;if(hazard<.05){u.ice.hide(i);continue;}const a=i*1.7;u.ice.set(i,Math.cos(a)*c*.7,Math.sin(a*1.3)*c*.5,.15+c*reach*1.1,.02+.02*(i%3),hazard*.8*(1-c),ice);}u.ice.commit();
        u.debris.forEach((m,i)=>{const k=clamp((t-2-i*.4)/9,0,1);m.visible=t>2+i*.4&&t<18;m.position.set(Math.sin(i*2)*k*.8,Math.cos(i*3)*k*.6,.2+k*4);m.rotation.set(t+i,t*.7,t*.4);});
      }else if(this.id==='fire'){
        const blue=new T.Color('#5d8cff'),orange=new T.Color('#ff9a3c'),yellow=new T.Color('#ffd27a'),smoke=new T.Color('#55606a'),spark=new T.Color('#ffcf7a'),white=new T.Color('#e9f2f7');
        // Microgravity flame: a near-spherical ball, blue rim, yellow soot core.
        for(let i=0;i<u.flame.count;i++){if(hazard<.02){u.flame.hide(i);continue;}const a=i*2.399+t*(.6+(i%7)*.05),el=Math.acos(1-2*((i*.618)%1)),rad=.18*(.5+.5*((i*.37)%1))*(.85+.15*Math.sin(t*7+i));const p=V(Math.sin(el)*Math.cos(a)*rad,Math.sin(el)*Math.sin(a)*rad,Math.cos(el)*rad*.8+.38);const outer=rad>.13;u.flame.set(i,p.x,p.y,p.z,(.06+.06*((i*.29)%1))*hazard*(1.1+.2*Math.sin(t*9+i)),.55*hazard,outer?blue:i%3?orange:yellow);}u.flame.commit();
        for(let i=0;i<u.smoke.count;i++){const c=(t*.1+i*.618)%1,a=i*2.399+t*.12;if(t>36){u.smoke.hide(i);continue;}u.smoke.set(i,Math.cos(a)*c*.7+c*.2,Math.sin(a)*c*.5+c*.35,.45+c*1.3,(.12+c*.55),(.22*(1-c)*hazard+.04*(1-finished)),smoke);}u.smoke.commit();
        for(let i=0;i<u.sparks.count;i++){const c=(t*1.6+i*.313)%1;if(hazard<.05||c>.6){u.sparks.hide(i);continue;}u.sparks.set(i,Math.sin(i*2.4)*c*.9,Math.cos(i*3.1)*c*.7+.1,.22+c*1.3,.025,(1-c/.6),spark);}u.sparks.commit();
        const spray=pulse(t,19,27,.5),nozzle=r.position.clone().add(V(0,-.2,-.25));for(let i=0;i<u.agent.count;i++){const c=(t*1.4+i*.618)%1;if(spray<.02){u.agent.hide(i);continue;}const a=i*2.399,p=nozzle.clone().lerp(V(Math.cos(a)*.25*c,Math.sin(a)*.25*c,.4),c);u.agent.set(i,p.x,p.y,p.z,.05+c*.25,.4*spray*(1-c*.7),white);}u.agent.commit();
        u.arcs.forEach((line,i)=>{const position=line.geometry.attributes.position;for(let j=0;j<10;j++){const k=j/9;position.setXYZ(j,-.43+k*.86,.3-i*.15+Math.sin(t*31+j*4+i)*.06*Math.sin(k*Math.PI),.23+Math.sin(j*2+t*22)*.03);}position.needsUpdate=true;line.geometry.computeBoundingSphere();line.visible=hazard>.05&&t<12&&Math.sin(t*17+i)>-.15;});
        u.arcGlow.visible=u.arcs.some(l=>l.visible);u.arcGlow.material.opacity=.6+.4*Math.sin(t*40);
      }else if(this.id==='coolant'){
        const tealColor=new T.Color('#8eeaf0');
        u.droplets.forEach((m,i)=>{const c=(t*.17+i*.618)%1,angle=i*2.399+t*.1;m.visible=t<34;const p=V(Math.cos(angle)*c*.9,Math.sin(angle)*c*.7,.3+c*2.3);const nozzle=r.position.clone().add(V(0,-.2,-.2));p.lerp(nozzle,ramp(t,14+i*.12,20+i*.12));m.position.copy(p);m.scale.set(1+.15*Math.sin(t*3+i),1-.12*Math.sin(t*3+i),1).multiplyScalar((.4+develop*.6)*(1-ramp(t,18+i*.1,21+i*.1)));});
        for(let i=0;i<u.spray.count;i++){const c=(t*2+i*.618)%1;if(hazard<.03){u.spray.hide(i);continue;}const a=i*2.399;u.spray.set(i,Math.cos(a)*c*.3,Math.sin(a)*c*.25,.3+c*1.6,.02+c*.06,hazard*.5*(1-c),tealColor);}u.spray.commit();
        const suck=pulse(t,14,22,.5),nozzle=r.position.clone().add(V(0,-.2,-.2));for(let i=0;i<u.suction.count;i++){const c=(t*1.8+i*.618)%1;if(suck<.02){u.suction.hide(i);continue;}const a=i*2.399,p=nozzle.clone().add(V(Math.cos(a)*.35*(1-c),Math.sin(a)*.35*(1-c),-.3*(1-c)));u.suction.set(i,p.x,p.y,p.z,.02,.45*suck*c,tealColor);}u.suction.commit();
        u.clamp.visible=t>17;u.clamp.position.copy(r.position.clone().add(V(0,-.15,-.3))).lerp(V(0,0,.3),ramp(t,19,24));u.clampHalves.forEach((half,i)=>half.position.y=(i?1:-1)*.26*(1-repair));
      }else{
        const dock=ramp(t,18,29);u.battery.visible=t>11;u.battery.position.copy(r.position.clone().add(V(0,-.25,-.2))).lerp(V(.7,-.3,.15),dock);u.battery.rotation.y=.35*(1-dock);u.cables.forEach(m=>m.visible=t>21);
        const spark=new T.Color('#ffd27a');for(let i=0;i<u.sparks.count;i++){const c=(t*1.5+i*.313)%1;if(!(t>3&&t<10)||c>.55){u.sparks.hide(i);continue;}u.sparks.set(i,Math.sin(i*2.4)*c*1.1,Math.cos(i*3.1)*c*.9,.2+c*1.6,.02,(1-c/.55),spark);}u.sparks.commit();
      }
    }
    stepSpill(u,t){
      const burst=ramp(t,0,4),collect=ramp(t,11,30),r=u.robot.root,soup=1-collect;
      const hover=V(.55,.15,.85);r.visible=t>7;const path=V(1.6,.4,1.2).lerp(hover,ramp(t,7,11));const sweep=V(Math.sin(t*.45)*.45,Math.cos(t*.35)*.25,Math.sin(t*.3)*.3).multiplyScalar(ramp(t,11,13)*(1-ramp(t,28,31)));r.position.copy(path).add(sweep);if(t>30)r.position.lerp(V(-.3,.9,-1.6),ramp(t,30,34));r.lookAt(u.root.localToWorld(V()));
      u.robot.pose(t,{reach:.9*ramp(t,9,11),grip:.5,work:t>11&&t<30?1:0});u.robot.led.material.color.set(t>11&&t<30?'#ffd27a':'#7ce8d8').convertSRGBToLinear();
      const nozzle=u.root.worldToLocal(u.nozzle.getWorldPosition(V()));
      u.bag.position.set(0,0,0).add(V(.1,.05,0).multiplyScalar(burst));u.bag.rotation.set(.3*Math.sin(t*.4),t*.15,.2);
      u.droplets.forEach((m,i)=>{const a=i*2.399,el=(i*.618)%1,dir=V(Math.cos(a)*Math.sin(el*3),Math.sin(a)*.6,Math.cos(el*3)).normalize(),out=V().addScaledVector(dir,(.15+(i%7)*.09)*burst+.02*Math.sin(t*.7+i));const k=ramp(t,12+i*.45,13.4+i*.45);m.position.copy(out).lerp(nozzle,k);m.visible=k<.98;m.scale.set(1+.12*Math.sin(t*2.6+i),1-.1*Math.sin(t*2.6+i),1);});
      u.noodles.forEach((m,i)=>{const a=i*1.3;m.position.set(Math.cos(a)*.4*burst,Math.sin(a*1.7)*.25*burst,Math.sin(a)*.35*burst).lerp(nozzle,ramp(t,15+i*1.5,16.4+i*1.5));m.rotation.set(t*.2+i,t*.13,i);m.visible=t<16.4+i*1.5;});
      u.items.forEach((m,i)=>{m.position.set(-.35+i*.2,.25*burst+.05*Math.sin(t+i),.3);m.rotation.set(t*.3+i,t*.5,i);m.visible=t<20+i*3;});
      const crumb=new T.Color('#d9b27a');for(let i=0;i<u.crumbs.count;i++){const a=i*2.399,el=(i*.37)%1,rad=(.1+el*.75)*burst,k=ramp(t,11+(i%40)*.45,12.4+(i%40)*.45),p=V(Math.cos(a)*rad,Math.sin(a*1.3)*rad*.6,Math.sin(a)*rad).lerp(nozzle,k);if(k>.97){u.crumbs.hide(i);continue;}u.crumbs.set(i,p.x,p.y,p.z,.008+.006*(i%3),.9*soup+.1,crumb);}u.crumbs.commit();
      const suck=pulse(t,11,30,.6),air=new T.Color('#e8f2f8');for(let i=0;i<u.suction.count;i++){const c=(t*2+i*.618)%1;if(suck<.02){u.suction.hide(i);continue;}const a=i*2.399,p=nozzle.clone().add(V(Math.cos(a)*.18*(1-c),Math.sin(a)*.18*(1-c),.16*(1-c)));u.suction.set(i,p.x,p.y,p.z,.012,.35*suck*c,air);}u.suction.commit();
    }
    stepBroadcast(u,t){
      const r=u.robot.root;r.visible=true;const set=ramp(t,1,4);r.position.copy(V(1.2,.3,1.3)).lerp(V(.85,.12,.95),set).add(V(Math.sin(t*.4)*.05,Math.sin(t*.7)*.03,0));r.lookAt(u.root.localToWorld(V(.15,.05,.1)));u.robot.pose(t,{reach:.55,grip:.1,work:0});
      u.tally.visible=t>4&&Math.sin(t*4)>-.6;u.lightFace.material.color.set(t>3?'#fff4e2':'#3a3a3a').convertSRGBToLinear();
      // Water ball wobbles; the tablet dissolves and its gas stays inside.
      const wob=Math.sin(t*3.1),tablet=ramp(t,9.5,11),dissolve=ramp(t,11,20);u.ball.scale.set(1+.05*wob,1-.045*wob,1+.02*Math.sin(t*2.3));u.ball.visible=t>5;u.ball.position.set(.15,.05+.01*Math.sin(t*.8),.2);
      u.tablet.visible=t>8&&t<20;u.tablet.position.copy(V(-.1,.25,.2)).lerp(V(.15,.05,.2),tablet);u.tablet.scale.setScalar(1-dissolve*.95);u.tablet.rotation.set(t,t*.6,0);
      u.dye.visible=t>11;u.dye.position.copy(u.ball.position);u.dye.scale.copy(u.ball.scale).multiplyScalar(.2+.75*dissolve);u.dye.material.opacity=.55*dissolve;
      const bubble=new T.Color('#f4fbff');for(let i=0;i<u.bubbles.count;i++){const on=t>11&&t<34;if(!on){u.bubbles.hide(i);continue;}const a=i*2.399,el=Math.acos(1-2*((i*.618)%1)),rad=.1*Math.cbrt(((i*.37)%1))*Math.min(1,(t-11)/4);const p=u.ball.position.clone().add(V(Math.sin(el)*Math.cos(a+t*.05)*rad,Math.cos(el)*rad,Math.sin(el)*Math.sin(a+t*.05)*rad));u.bubbles.set(i,p.x,p.y,p.z,.004+.004*(i%3),.8,bubble);}u.bubbles.commit();
    }
    pipInfo(){const t=this.time,f=this.facts||{};const metric=this.id==='breach'?'舱压 '+(f.pressure||101.3).toFixed(1)+' kPa':this.id==='fire'?'设备温度 '+(f.temperature||22).toFixed(0)+' °C':this.id==='coolant'?'冷却回路流失 '+((f.flowRate||0)*100).toFixed(0)+'%':this.id==='blackout'?'本舱供电 '+Math.round((f.power??1)*100)+'%':this.id==='spill'?'漂浮物回收 '+Math.round(ramp(t,11,30)*100)+'%':'天地通话 · 信号良好';return{modules:[this.facts?.displayModule||this.targetModule],metric,noise:0,alert:this.story.wall&&t<this.duration-4};}
    tick(dt){if(!this.d.active||this.d.paused||!Number.isFinite(dt)||dt<=0)return;let left=Math.min(dt,this.duration-this.time);while(left>1e-8){const step=Math.min(1/30,left);this.time=Math.min(this.duration,this.time+step);this.d.time=this.time;this.step();left-=step;}if(this.time>=this.duration-1e-6){this.time=this.d.time=this.duration;this.step();}this.render();}
    render(){if(this.disposed)return;this.syncAnchor();}
    refreshUI(){}
    choose(){return{message:this.story.wall?'维修机器人正在自动处置本舱事故，可以继续自由观察。':'事件自动发展，可以继续自由观察。'};}
    narrative(){const t=this.time,d=this.duration;return{stage:t>=d?(this.story.wall?'事故已处置':'事件已完成'):t<7?(this.story.wall?'局部故障':'开始'):t<18?(this.story.wall?'故障发展':'展开'):t<32?(this.story.wall?'机器人抢修':'人机协作'):'恢复运行',caption:t<18?this.story.intro:t<d-4?this.story.working:this.story.ending};}
    snapshot(){const count=(key,filter)=>this.units.reduce((n,u)=>n+(u[key]?(u[key].alpha?Array.from(u[key].alpha).filter(a=>a>.01).length:u[key].filter?u[key].filter(filter||(m=>m.visible)).length:0):0),0);
      return{active:this.d.active,liveEvent:true,incident:this.id,orbitalEvent:this.id,targetModule:this.targetModule,resolvedModule:this.facts.displayModule||this.targetModule,scenario:'visitor',title:this.title,time:+this.time.toFixed(4),duration:this.duration,paused:this.d.paused,options:{...this.options},...this.narrative(),outcome:this.d.outcome?{...this.d.outcome}:null,facts:{...this.facts,beats:[...this.facts.beats]},
        objects:this.units.flatMap(u=>[{name:u.view+'-robot',position:u.robot.root.position.toArray(),visible:u.robot.root.visible},...(u.patch?[{name:u.view+'-patch',position:u.patch.position.toArray(),visible:u.patch.visible}]:[])]),
        effects:{exterior:this.effects.visible&&this.outsideFrame.visible,interior:this.room.root.visible,plumes:count('jet'),sparks:count('sparks'),flames:count('flame'),smoke:count('smoke'),droplets:count('droplets')}};}
    dispose(){if(this.disposed)return;this.disposed=true;for(const item of this.materialSwaps)item.node.material=item.original;for(const restore of this.restores.splice(0).reverse()){try{restore();}catch(e){console.warn(e);}}this.effects?.parent?.remove(this.effects);this.insideFrame?.parent?.remove(this.insideFrame);for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose();for(const t of this.textures)t.dispose();delete document.body.dataset.stationEvent;this.d.stageActors=[];this.d.robot=null;this.scene=null;}
  }
  C.StationCabinIncidents=StationCabinIncidents;C.stationCabinIncidentStories=catalog;
})();
