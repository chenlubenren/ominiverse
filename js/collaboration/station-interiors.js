/* Independent, persistent cabin interiors. Dimensions are design visualizations in metres. */
(() => {
  'use strict';const C=window.CoScene,T=THREE;
  const assetBase=new URL('../../assets/station/',document.currentScript.src);
  const defs=[
    ['tianhe','01','天和 · 指令舱','TIANHE / COMMAND','control',4.8,10.8,'#83dbe1','飞行控制、遥测与全站系统管理。','指令终端 / 遥测机柜 / 通信台',[-.1,0,-10.5],['habitat','tianzhou']],
    ['habitat','02','天和 · 生活舱','TIANHE / HABITAT','habitat',4.6,8.4,'#edc693','休息、饮食与日常健康维护。','独立睡眠区 / 太空厨房 / 运动设备',[-.1,0,-3.4],['node','tianhe']],
    ['node','03','多向对接节点','DOCKING / TRANSFER','node',5.4,7.2,'#b3b7ec','连接核心舱、实验舱与对接飞船。','多向舱门 / 对接状态 / 应急装备',[-.1,0,.93],['habitat','wentian','mengtian','shenzhou','airlock']],
    ['wentian','04','问天 · 生命实验舱','WENTIAN / LIFE SCIENCE','biology',4.8,12,'#a4d5b5','植物培养、生物样本与生命支持研究。','培养架 / 样本冷柜 / 生物操作台',[-8.4,0,.93],['node']],
    ['mengtian','05','梦天 · 物理实验舱','MENGTIAN / MICROGRAVITY','physics',4.8,12,'#9abfee','流体、材料与微重力实验。','光学平台 / 流体回路 / 材料实验柜',[8.3,0,.93],['node']],
    ['tianzhou','06','天舟 · 货运舱','TIANZHOU / LOGISTICS','cargo',4.6,8.4,'#d9b37d','物资存储、补给与设备维护。','软包货架 / 固定绑带 / 维护工作台',[-.1,0,-19],['tianhe']],
    ['shenzhou','07','神舟 · 轨道舱','SHENZHOU / ORBITAL','flight',3.8,6,'#dfa9b7','乘组对接、待命与轨道观测。','飞行座椅 / 导航面板 / 观测舷窗',[-.1,0,8.2],['node']],
    ['airlock','08','气闸 · 出舱准备舱','AIRLOCK / EVA','eva',4.2,5.8,'#f0c46e','出舱装备检查与工具准备。','航天服 / 工具固定架 / 气密舱门',[-.1,-5.8,.93],['node']]
  ];
  // Shared station manifest: five staff total, never more than two in a
  // cabin. The empty modules are useful for showing scale and transit.
  C.stationCrewManifest={tianhe:2,habitat:1,node:1,wentian:1,mengtian:0,tianzhou:0,shenzhou:0,airlock:0};
  C.stationModules=defs.map(([id,index,name,english,kind,width,length,color,description,features,anchor,links])=>({id,index,name,english,kind,width,length,color,description,features,anchor,links}));
  C.stationModule=id=>C.stationModules.find(m=>m.id===id);
  const material=(color,opts={})=>C.material(color,opts);
  let library;
  function textures(){
    if(library)return library;
    const tex=(draw,w=1024,h=1024)=>{const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;draw(canvas.getContext('2d'),w,h);const t=new T.CanvasTexture(canvas);t.encoding=T.sRGBEncoding;t.anisotropy=4;return t;};
    const fabric=tex((c,w,h)=>{c.fillStyle='#e5e3da';c.fillRect(0,0,w,h);c.strokeStyle='#b9bdb6';c.lineWidth=2;for(let i=-h;i<w+h;i+=80){c.beginPath();c.moveTo(i,0);c.lineTo(i+h,h);c.stroke();c.beginPath();c.moveTo(i,h);c.lineTo(i+h,0);c.stroke();}c.fillStyle='#ffffff50';for(let i=0;i<12000;i++){const x=(i*97)%w,y=(i*127)%h;c.fillRect(x,y,1,2);}});
    const panel=tex((c,w,h)=>{c.fillStyle='#d9e0e2';c.fillRect(0,0,w,h);c.strokeStyle='#a0aeb5';c.lineWidth=5;c.strokeRect(15,15,w-30,h-30);for(const x of [32,w-32])for(const y of [32,h-32]){c.fillStyle='#72828d';c.beginPath();c.arc(x,y,7,0,7);c.fill();c.strokeStyle='#cdd4d7';c.lineWidth=2;c.beginPath();c.moveTo(x-5,y);c.lineTo(x+5,y);c.stroke();}c.fillStyle='#8a9ba7';c.font='17px monospace';c.fillText('CSS  /  SERVICE PANEL',40,h-40);for(let i=0;i<24;i++)c.fillRect(42+i*4,h-90,i%3===0?2:1,20);});
    const screen=tex((c,w,h)=>{c.fillStyle='#071d29';c.fillRect(0,0,w,h);c.fillStyle='#72d4d8';c.font='25px monospace';c.fillText('CSS  /  SYSTEM MONITOR',36,45);c.fillStyle='#c9f2ed';c.font='bold 64px monospace';c.fillText('NOMINAL',36,124);c.strokeStyle='#1b4553';c.lineWidth=1;for(let i=0;i<12;i++){c.beginPath();c.moveTo(30,170+i*23);c.lineTo(w-30,170+i*23);c.stroke();}for(let j=0;j<3;j++){c.strokeStyle=['#67d7d7','#c9b273','#79a8da'][j];c.lineWidth=3;c.beginPath();for(let i=0;i<180;i++){const x=35+i*5,y=245+j*53+Math.sin(i*.12+j)*18+Math.sin(i*.41)*5;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}c.fillStyle='#789aaa';c.font='20px monospace';c.fillText('TELEMETRY   //   LOCAL DEMONSTRATION',36,h-30);},1024,512);
    const loader=new T.TextureLoader(),load=(name,color=false)=>{const t=loader.load(new URL('textures/'+name,assetBase).href);t.encoding=color?T.sRGBEncoding:T.LinearEncoding;t.anisotropy=8;return t;};
    library={fabric:load('fabric-color.jpg',true),fabricNormal:load('fabric-normal.jpg'),fabricRough:load('fabric-rough.jpg'),panel:load('equipment-panel.jpg',true),panelNormal:load('equipment-panel-normal.png'),metal:load('brushed-metal.jpg',true),metalRough:load('brushed-metal-roughness.jpg'),instruments:load('instrument-controls.jpg',true),screen};fabric.dispose();panel.dispose();return library;
  }
  C.buildStationInterior=function(spec){
    const root=new T.Group();root.name='station-'+spec.id;const zones=new T.Group(),roof=new T.Group(),details=new T.Group();root.add(zones,roof,details);
    const W=spec.width,L=spec.length,H=3.4,half=L/2,tx=textures(),colliders=[],batches=new Map(),hatches=[],equipment=[],labels=[];
    const mats={shell:material('#d8dfe1',{map:tx.panel,normalMap:tx.panelNormal,normalScale:new T.Vector2(.25,.25),roughness:.68}),white:material('#e3e7e5'),frame:material('#adb5ba',{map:tx.metal,roughnessMap:tx.metalRough,metalness:.75,roughness:.46}),dark:material('#263a47'),floor:material('#657984',{roughness:.85}),fabric:material('#eee9dc',{map:tx.fabric,normalMap:tx.fabricNormal,normalScale:new T.Vector2(.28,.28),roughnessMap:tx.fabricRough,roughness:.95}),accent:material(spec.color),gold:material('#b99d65',{metalness:.65,roughness:.42}),black:material('#132631'),rubber:material('#283239',{roughness:.92}),instruments:material('#dfdcd1',{map:tx.instruments,roughness:.7,metalness:.16}),screen:material('#ffffff',{map:tx.screen,emissive:'#ffffff',emissiveMap:tx.screen,emissiveIntensity:.6,roughness:.3}),light:new T.MeshBasicMaterial({color:'#d1f4f5',toneMapped:false}),green:new T.MeshBasicMaterial({color:'#72c9af',toneMapped:false}),amber:new T.MeshBasicMaterial({color:'#f3ba62',toneMapped:false}),red:material('#b8554d'),glass:material('#547989',{metalness:.2,roughness:.2,transparent:true,opacity:.42,depthWrite:false}),leaf:material('#528b70'),blue:material('#487b9e')};
    const geo={box:new T.BoxGeometry(1,1,1),cylinder:new T.CylinderGeometry(1,1,1,12),sphere:new T.SphereGeometry(1,12,8),ring:new T.TorusGeometry(1,.075,8,48)};
    let sourceSection='structure';
    function part(key,size,pos,rot=[0,0,0],shape='box',top=false){const batchKey=key+':'+shape+':'+top;if(!batches.has(batchKey))batches.set(batchKey,{key,shape,top,items:[]});batches.get(batchKey).items.push({size,pos,rot,section:sourceSection});}
    function box(k,w,h,d,x,y,z,top=false){part(k,[w,h,d],[x,y,z],[0,0,0],'box',top);}
    function label(text,sub,pos,w=1.1,h=.26,rotation=0){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#e3e9e7';c.fillRect(0,0,1024,256);c.fillStyle=spec.color;c.fillRect(0,0,18,256);c.fillStyle='#28424e';c.font='bold 54px sans-serif';c.fillText(text,45,108,940);c.fillStyle='#63808d';c.font='25px monospace';c.fillText(sub,45,184,930);const texture=new T.CanvasTexture(canvas);texture.encoding=T.sRGBEncoding;const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));m.name=text;m.userData.stationSourceSection=sourceSection;m.position.set(...pos);m.rotation.y=rotation;details.add(m);labels.push(m);return m;}
    // A pressure hull with separately removable overhead panels.
    for(let z=-half+.6;z<half;z+=1.2){
      for(let x=-W/2+.4;x<W/2;x+=.8){box('floor',.78,.10,1.18,x,-.05,z);for(const dx of [-.27,.27])box('dark',.018,.012,.8,x+dx,.008,z);}
      for(const side of [-1,1]){
        const sideDoor=spec.kind==='node'&&((side===-1&&Math.abs(Math.abs(z)-1.2)<1.1)||(side===1&&Math.abs(z+1.2)<1.1));
        if(!sideDoor)box('shell',.12,2.5,1.17,side*(W/2+.08),1.65,z,true);else box('shell',.12,.75,1.17,side*(W/2+.08),2.96,z,true);
        part('shell',[.6,.12,1.17],[side*(W/2-.15),.20,z],[0,0,side*Math.PI/4],'box',true);
        part('shell',[.90,.12,1.17],[side*(W/2-.26),3.10,z],[0,0,-side*Math.PI/4],'box',true);
        part('frame',[.14,.12,.045],[side*(W/2-.26),3.10,z-.58],[0,0,-side*Math.PI/4],'box',true);
        box('frame',.10,2.6,.065,side*(W/2-.03),1.6,z-.58);
        box('accent',.045,.035,1.1,side*(W/2-.22),.08,z);
        box('light',.075,.035,1.12,side*(W/2-.52),2.95,z,true);
        for(const y of [.40,2.72]){box('frame',.06,.045,1.12,side*(W/2-.16),y,z);for(const dz of [-.44,.44])part('black',[.025,.022,.025],[side*(W/2-.19),y,z+dz],[0,0,Math.PI/2],'cylinder');}
      }
      box('fabric',W-.95,.10,1.17,0,H,z,true);
      for(const x of [-.55,.55]){box('frame',.12,.06,1.15,x,H-.08,z,true);for(const dz of [-.4,0,.4])box('dark',.07,.04,.045,x,H-.12,z+dz,true);}
    }
    // End bulkheads surround an actual clear doorway rather than blocking navigation.
    for(const sign of [-1,1]){if(spec.rehearsalCutaway&&sign===1)continue;const z=sign*half;
      for(const x of [-1,1])box('white',(W-1.55)/2,H,.14,x*(W+1.55)/4,H/2,z);
      box('white',1.55,H-2.4,.14,0,(H+2.4)/2,z);box('dark',1.75,.07,.42,0,.035,z);
      for(const x of [-.83,.83])box('frame',.12,2.48,.28,x,1.24,z);
      box('frame',1.75,.12,.28,0,2.48,z);box('light',1.4,.035,.08,0,2.39,z-sign*.15);
      for(const x of [-.96,.96])for(let y=.25;y<2.4;y+=.26)part('gold',[.045,.045,.018],[x,y,z-sign*.16],[Math.PI/2,0,0],'cylinder');
    }
    sourceSection='equipment';
    function prop(name,size,pos,yaw=0){const source=C.stationProps?.get(name);if(!source)return null;const node=source.clone(true),bounds=new T.Box3().setFromObject(node),extent=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),scale=size/Math.max(extent.x,extent.y,extent.z);node.scale.setScalar(scale);node.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);const holder=new T.Group();holder.name='TRELLIS / '+name;holder.userData.stationProp=name;holder.userData.stationSourceSection=sourceSection;holder.add(node);holder.position.set(...pos);holder.rotation.y=yaw;node.traverse(o=>{if(!o.isMesh)return;o.castShadow=o.receiveShadow=true;o.material=o.material.clone();o.material.envMapIntensity=.24;});details.add(holder);return holder;}
    const getFront=(sign,x,y,z,dx,dy,dz)=>[x+sign*dz,y+dy,z-sign*dx];
    function rack(sign,z,index,type=spec.kind){const x=sign*(W/2-.45),yaw=-sign*Math.PI/2;
      const add=(key,size,p,shape='box')=>part(key,size,getFront(-sign,x,0,z,...p),[0,yaw,0],shape);
      add('dark',[1.06,2.34,.68],[0,1.35,0]);add('white',[1.00,2.26,.07],[0,1.35,.36]);
      for(const dx of [-.52,.52])add('frame',[.045,2.4,.09],[dx,1.35,.40]);
      for(const y of [.30,1.09,1.85,2.5])add('frame',[1.04,.045,.10],[0,y,.42]);
      if(type==='cargo'||type==='habitat'){
        for(let y=.55;y<2.3;y+=.57){if(type==='cargo'&&C.stationProps?.has('cargo-bag')){prop('cargo-bag',.90,getFront(-sign,x,0,z,0,y-.24,.45),yaw+Math.PI/2);}else add('fabric',[.91,.49,.38],[0,y,.48]);for(const dx of [-.3,.3])add('dark',[.045,.50,.025],[dx,y,.69]);add('white',[.29,.10,.014],[.05,y,.705]);add('gold',[.10,.07,.028],[-.3,y,.71]);}
      }else{
        add('screen',[.85,.44,.018],[0,2.13,.408]);
        for(let row=0;row<5;row++){
          const y=.48+row*.25;add(row===2?'instruments':row%2?'shell':'dark',[.91,.20,.055],[0,y,.42]);
          for(let j=0;j<9;j++)add('black',[.032,.045,.015],[-.36+j*.055,y,.457]);
          add(row===3?'amber':'green',[.027,.027,.022],[.34,y,.46]);add('frame',[.11,.05,.045],[.2,y,.48]);
        }
        if(type==='biology')for(let k=0;k<4;k++){add('glass',[.07,.28,.07],[-.30+k*.2,1.65,.52],'cylinder');add('blue',[.077,.035,.077],[-.30+k*.2,1.81,.52],'cylinder');}
      }
      for(const dx of [-.45,.45])for(let y=.4;y<2.5;y+=.34)add('gold',[.018,.018,.025],[dx,y,.47],'sphere');
      label((type==='biology'?'生命科学':type==='physics'?'物理实验':type==='cargo'?'物资储存':'系统机柜')+' '+String(index+1).padStart(2,'0'),'CSS / '+spec.index+'-'+String(index+1).padStart(2,'0'),getFront(-sign,x,0,z,0,2.69,.43),.94,.20,yaw);
      colliders.push({x,z,w:.95,d:1.09,y:1.4,h:2.8});equipment.push({name:'设备机柜 '+(index+1),x,y:1.5,z});
    }
    function consoleAt(x,z,yaw=0){
      const starts=new Map([...batches].map(([key,b])=>[key,b.items.length]));
      box('dark',2.5,.82,.7,x,.41,z);box('white',2.6,.08,.84,x,.86,z);
      for(let k=-1;k<=1;k++){part('dark',[.77,.55,.065],[x+k*.82,1.27,z-.16],[-.15,0,0]);part('screen',[.70,.46,.014],[x+k*.82,1.27,z-.116],[-.15,0,0]);}
      for(let k=0;k<30;k++)box('rubber',.045,.017,.035,x-.85+(k%10)*.06,.914,z+.13+Math.floor(k/10)*.048);
      for(const dx of [-1.13,1.13]){box('accent',.12,.035,.38,x+dx,.92,z+.12);for(let i=0;i<3;i++)part('green',[.019,.012,.019],[x+dx,.944,z+i*.08],[0,0,0],'cylinder');}
      if(yaw)for(const [key,batch]of batches)for(const item of batch.items.slice(starts.get(key)||0)){
        const dx=item.pos[0]-x,dz=item.pos[2]-z,c=Math.cos(yaw),s=Math.sin(yaw);
        item.pos[0]=x+dx*c+dz*s;item.pos[2]=z-dx*s+dz*c;
        const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw).multiply(new T.Quaternion().setFromEuler(new T.Euler(...item.rot)));
        const rotation=new T.Euler().setFromQuaternion(q);item.rot=[rotation.x,rotation.y,rotation.z];
      }
      colliders.push({x,z,w:2.6,d:.88,y:.6,h:1.2,rotation:yaw});
    }
    const count=Math.max(1,Math.floor((L-3)/1.22));
    for(const sign of [-1,1])for(let i=0;i<count;i++){
      const z=-half+1.6+i*1.22;
      if(spec.kind==='node')continue;
      if(spec.kind==='control'&&sign===-1&&i<3)continue;
      if(spec.kind==='habitat'&&sign===1&&i<3)continue;
      if(spec.kind==='biology'&&sign===1&&i>=2&&i<=4)continue;
      if(['biology','physics'].includes(spec.kind)&&sign===-1&&i===count-1)continue;
      if(spec.kind==='flight'&&sign===1)continue;
      if(spec.kind==='eva'&&sign===1)continue;
      rack(sign,z,i+(sign===1?count:0));
    }
    sourceSection='science-instrument';
    if(['biology','physics'].includes(spec.kind)){const x=-W/2+.55,z=-half+1.6+(count-1)*1.22;box('white',.95,.80,1.12,x,.40,z);box('frame',1.01,.08,1.14,x,.84,z);prop('lab-instrument',.95,[x,.89,z],Math.PI/2);colliders.push({x,z,w:1.05,d:1.2,h:2,y:1});}
    sourceSection='equipment';
    if(spec.kind==='control'){consoleAt(-W/2+.55,-half+2.3,Math.PI/2);label('天和 · 飞行控制','COMMAND / TELEMETRY',[0,2.92,-half+.10],2.6,.42);}
    if(spec.kind==='habitat'){
      for(let i=0;i<3;i++){const z=-half+1.7+i*1.28,x=W/2-.55;box('dark',.92,2.45,1.14,x,1.42,z);box('fabric',.88,2.04,1.03,x-.05,1.38,z);box('accent',.05,1.93,.035,x-.50,1.4,z-.37);box('frame',.09,.33,.06,x-.51,1.6,z+.30);label('休息区 0'+(i+1),'PRIVATE / CREW',[x-.53,2.65,z],.92,.19,-Math.PI/2);colliders.push({x,z,w:1,d:1.14,h:2.5,y:1.3});}
      box('white',.75,.95,1.55,W/2-.42,.48,half-1.5);box('dark',.65,.08,1.4,W/2-.48,1.0,half-1.5);
      box('blue',.62,.52,.6,W/2-.46,1.3,half-1.6);label('饮用水 / 加热','GALLEY',[W/2-.84,1.8,half-1.5],1.1,.23,-Math.PI/2);
      // Compact exercise cycle: flywheel, pedals, saddle and restraint bar.
      part('dark',[.38,.12,.38],[-W/2+.65,.4,half-1.1],[0,0,Math.PI/2],'cylinder');box('frame',.12,.8,.14,-W/2+.65,.5,half-1.1);box('rubber',.45,.08,.40,-W/2+.65,.94,half-1.1);box('frame',.75,.04,.06,-W/2+.65,.35,half-1.1);
    }
    if(spec.kind==='biology'){
      sourceSection='science-plants';
      const x=W/2-.48;for(let tier=0;tier<4;tier++){const y=.4+tier*.56;box('frame',.80,.055,3.5,x,y,.3);box('light',.64,.025,3.3,x,y+.45,.3);for(let z=-1.1;z<1.8;z+=.36){part('white',[.13,.12,.13],[x,y+.08,z],[0,0,0],'cylinder');for(let k=0;k<3;k++)part('leaf',[.13,.05,.075],[x+Math.sin(k*2)*.09,y+.21,z],[0,k,Math.sin(k)*.5],'sphere');}}box('glass',.025,2.4,3.5,x-.43,1.45,.3);colliders.push({x,z:.3,w:.95,d:3.5,h:2.6,y:1.3});label('植物培养单元','GROWTH CHAMBER',[x-.46,2.8,.3],2,.23,-Math.PI/2);
    }
    sourceSection='equipment';
    if(spec.kind==='physics'){
      // Optical rail and experiment vessel; leaves a navigable central aisle.
      box('dark',.7,.9,2.1,W/2-.65,.45,half-1.6);for(let i=0;i<8;i++)box('frame',.56,.018,.025,W/2-.65,.92,half-2.5+i*.25);
      for(let i=0;i<3;i++){part('gold',[.12,.22,.12],[W/2-.65,1.2,half-2.2+i*.6],[Math.PI/2,0,0],'cylinder');box('frame',.04,.22,.06,W/2-.65,1.01,half-2.2+i*.6);}label('光学平台','OPTICAL BENCH',[W/2-1.03,1.7,half-1.6],1.5,.25,-Math.PI/2);
    }
    if(spec.kind==='cargo'){
      for(const z of [-2.4,0,2.4])for(const side of [-1,1]){const x=side*(W/2-.5);box('fabric',.8,.65,1,x,.4,z);box('dark',.82,.045,1.02,x,.5,z);}
      for(const z of [-2,0,2]){box('gold',1.8,.014,.035,0,.018,z);for(let i=0;i<10;i++)part('dark',[.08,.015,.05],[-.82+i*.18,.02,z],[0,.5,0]);}
    }
    if(spec.kind==='flight'){
      for(let z=-1.35;z<=1.35;z+=1.35){const x=.95;box('dark',.72,.35,.70,x,.28,z);part('fabric',[.72,1.05,.18],[x,.96,z-.25],[-.18,0,0]);box('fabric',.72,.14,.7,x,.5,z);for(const dx of [-.36,.36])box('frame',.035,.35,.7,x+dx,.56,z);part('dark',[.04,.92,.025],[x-.17,1,z-.12],[-.18,0,-.22]);part('dark',[.04,.92,.025],[x+.17,1,z-.12],[-.18,0,.22]);colliders.push({x,z,w:.9,d:1,h:1.7,y:.85});}
      for(const z of [-1.5,1.5]){part('frame',[.42,.42,.42],[W/2-.1,2.4,z],[0,Math.PI/2,0],'ring');part('glass',[.35,.02,.35],[W/2-.09,2.4,z],[0,0,Math.PI/2],'cylinder');}
    }
    if(spec.kind==='eva'){
      for(const z of [-1,1]){const x=W/2-.60;if(C.stationProps?.has('eva-suit')){prop('eva-suit',1.96,[x,.04,z],-Math.PI/2);box('frame',.08,2,.11,x+.28,1,z);colliders.push({x,z,w:1,d:1.2,h:2.4,y:1.2});continue;}part('white',[.30,.55,.24],[x,1.48,z],[0,0,0],'sphere');part('white',[.25,.25,.25],[x,2.15,z],[0,0,0],'sphere');part('gold',[.04,.17,.19],[x-.24,2.16,z],[0,0,0],'sphere');for(const k of [-1,1]){part('fabric',[.11,.62,.11],[x,.83,z+k*.16],[.08*k,0,0],'cylinder');part('white',[.11,.57,.11],[x-.05,1.5,z+k*.37],[k*.24,0,0],'cylinder');box('white',.32,.16,.22,x-.10,.43,z+k*.16);}box('dark',.22,.67,.53,x+.26,1.5,z);colliders.push({x,z,w:1,d:1.1,h:2.5,y:1.25});}label('出舱装备检查','EVA PREPARATION',[0,2.95,-half+.10],2.7,.32);
    }
    sourceSection='structure';
    for(const side of [-1,1])for(let k=0;k<3;k++){const x=side*(W/2-.26-k*.07),y=2.83+k*.07;part(k===1?'blue':'frame',[.025,L-.6,.025],[x,y,0],[Math.PI/2,0,0],'cylinder',true);for(let z=-half+.5;z<half;z+=.65)box('dark',.28,.025,.05,side*(W/2-.32),y-.03,z,true);}
    sourceSection='equipment';
    for(let z=-half+1.3;z<half-1;z+=2.4){const side=z>0?1:-1,x=side*(W/2-.88);for(let i=0;i<12;i++){const t=i/11;part('rubber',[.026,.11,.026],[x+.08*Math.sin(t*Math.PI),.48+t*.85,z+.05*Math.sin(t*5)],[0,0,.12*Math.cos(t*3)],'cylinder');}part('gold',[.06,.04,.06],[x,1.37,z],[0,0,0],'cylinder');}
    // Hatches remain interactive in both the cutaway and first-person view.
    spec.links.forEach((id,i)=>{
      let x=0,z=i===0?half:-half,yaw=i===0?Math.PI:0;
      if(spec.kind==='node'&&i>1){x=(i%2?1:-1)*W/2;z=i===4?1.2:-1.2;yaw=x>0?-Math.PI/2:Math.PI/2;}
      const frame=new T.Group();frame.position.set(x,0,z);frame.rotation.y=yaw;frame.name='通往'+C.stationModule(id).name;frame.userData.hatch=id;
      const leaf=new T.Mesh(new T.BoxGeometry(1.44,2.25,.10),mats.shell);leaf.position.set(0,1.18,.02);leaf.userData.hatch=id;frame.add(leaf);
      const wheel=new T.Mesh(new T.TorusGeometry(.23,.027,10,32),mats.frame);wheel.position.set(.30,1.2,.09);leaf.add(wheel);wheel.position.y=0;
      for(const side of [-1,1]){const jamb=new T.Mesh(new T.BoxGeometry(.12,2.48,.24),mats.frame);jamb.position.set(side*.82,1.24,0);frame.add(jamb);}const lintel=new T.Mesh(new T.BoxGeometry(1.75,.12,.24),mats.frame);lintel.position.y=2.48;frame.add(lintel);
      for(let k=0;k<6;k++){const bolt=new T.Mesh(new T.CylinderGeometry(.035,.035,.08,8),mats.gold);bolt.rotation.x=Math.PI/2;bolt.position.set(Math.cos(k*Math.PI/3)*.23,Math.sin(k*Math.PI/3)*.23,.02);wheel.add(bolt);}
      details.add(frame);label('→ '+C.stationModule(id).name,'HATCH / '+C.stationModule(id).index,[x-Math.sin(yaw)*.12,2.75,z+Math.cos(yaw)*.12],1.65,.28,yaw);
      hatches.push({id,frame,leaf,x,z,open:0});
    });
    for(const {key,shape,top,items}of batches.values()){
      const mesh=new T.InstancedMesh(geo[shape],mats[key],items.length),dummy=new T.Object3D();items.forEach((it,i)=>{dummy.position.set(...it.pos);dummy.rotation.set(...it.rot);dummy.scale.set(...it.size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.name=spec.id+' / '+key;mesh.userData.stationSource={moduleId:spec.id,key,shape,top,instances:items.map(it=>({section:it.section,position:it.pos.slice(),size:it.size.slice(),rotation:it.rot.slice()}))};mesh.castShadow=!['light','green','amber','glass'].includes(key);mesh.receiveShadow=true;(top?roof:root).add(mesh);
    }
    const lights=new T.Group();root.add(lights);
    for(const z of [-L*.32,0,L*.32]){const light=new T.PointLight('#d4edf5',.65,8,1.2);light.position.set(0,2.8,z);lights.add(light);}
    // Blind ends are sealed; only linked spaces receive an operable hatch.
    for(const sign of [-1,1])if(!hatches.some(h=>Math.abs(h.z-sign*half)<.01&&Math.abs(h.x)<.01)){const seal=new T.Mesh(new T.BoxGeometry(1.55,2.4,.14),mats.white);seal.position.set(0,1.2,sign*half);details.add(seal);label('密封端壁','PRESSURE BULKHEAD',[0,1.65,sign*(half-.09)],1.1,.22,sign>0?Math.PI:0);}
    Object.values(mats).forEach(m=>{if(m.isMeshStandardMaterial)m.envMapIntensity=.20;});mats.screen.metalness=0;
    // Keep everyday cabin work beside the central transit lane. Heights refer
    // to the crew model's root; both people and robots move in this volume.
    const routines={
      control:[['work','查看飞行遥测',24],['inspect','检查通信设备',18],['chat','交流值班情况',16],['rest','短暂放松',15]],
      habitat:[['rest','在休息区放松',28],['eat','进餐与补充饮水',24],['chat','交流日常安排',18],['maintenance','整理生活用品',20]],
      node:[['inspect','核对对接状态',20],['maintenance','整理转运装备',22],['chat','协调舱间通行',16],['observe','观察舱门状态',15]],
      biology:[['experiment','观察植物培养',26],['work','记录生物样本数据',22],['maintenance','检查生命支持设备',20],['chat','讨论实验结果',18]],
      physics:[['experiment','操作微重力实验',26],['work','整理物理实验记录',22],['inspect','检查实验仪器',20],['chat','讨论测量结果',18]],
      cargo:[['maintenance','整理补给物资',24],['work','登记库存',22],['inspect','检查货物固定带',18],['rest','补给间歇休息',16]],
      flight:[['work','执行对接待命',22],['observe','通过舷窗观察轨道',26],['chat','交流飞行计划',18],['inspect','核对导航面板',20]],
      eva:[['inspect','检查出舱装备',24],['maintenance','整理工具固定架',22],['chat','交流出舱准备',18],['rest','准备间隙休息',16]]
    }[spec.kind];
    // A fixed manifest keeps cabin occupancy sparse; transit preserves identities.
    const laneX=spec.kind==='flight'?-.35:.6;
    const candidatePoints=L>=10?[[-laneX,-L*.20],[laneX,0],[-laneX,L*.20]]:[[spec.kind==='flight'?laneX:-laneX,-L*.20],[laneX,L*.20]];
    const manifest=C.stationCrewManifest;
    const peoplePoints=candidatePoints.slice(0,Math.max(0,Math.min(2,manifest[spec.id]??0)));
    const transferPoints=hatches.map(h=>({id:h.id,x:h.x+(Math.abs(h.x)>0?(h.x>0?-0.9:0.9):0),z:h.z+(Math.abs(h.x)<.01?(h.z>0?-0.88:0.88):0),y:.72,angle:h.x>0?Math.PI/2:h.x<0?-Math.PI/2:h.z>0?Math.PI:0}));
    // Activity locations follow the installed equipment rather than a generic
    // four-point circuit. The hover positions leave the central aisle clear;
    // heading faces the actual panel, habitat bay, hatch or experiment unit.
    const activityStations={
      control:[
        ['work','读取飞行遥测屏幕',-.90,-half+2.3,.22,-Math.PI/2],
        ['inspect','检查右侧通信机柜',.90,-half+1.6+4*1.22,.52,Math.PI/2],
        ['work','核对左侧系统机柜读数',-.90,-half+1.6+4*1.22,.62,-Math.PI/2],
        ['rest','在值班区短暂放松',.75,half-1.65,.38,Math.PI/2]
      ],
      habitat:[
        ['rest','在独立休息区放松',.70,-half+1.7,.38,Math.PI/2],
        ['eat','在太空厨房进餐与补充饮水',.65,half-1.5,.35,Math.PI/2],
        ['inspect','检查左侧生活物资固定带',-.80,-half+1.6+1.22,.30,-Math.PI/2],
        ['maintenance','整理左侧生活物资柜',-.80,-half+1.6+3*1.22,.40,-Math.PI/2]
      ],
      node:[
        ['inspect','检查生活舱连接舱门',0,half-.95,.22,0],
        ['inspect','检查问天连接舱门',0,-half+.95,.22,Math.PI],
        ['observe','观察梦天连接舱门',-1.75,-1.2,.45,-Math.PI/2],
        ['inspect','检查气闸连接舱门',-1.75,1.2,.22,-Math.PI/2]
      ],
      biology:[
        ['experiment','检查右侧植物培养单元',.90,.30,.30,Math.PI/2],
        ['work','读取左侧生物实验机柜数据',-.90,-half+1.6+2*1.22,.62,-Math.PI/2],
        ['maintenance','检查左侧生命支持机柜',-.90,-half+1.6+4*1.22,.30,-Math.PI/2],
        ['inspect','检查左侧实验仪器',-.60,-half+1.6+(count-1)*1.22,.22,-Math.PI/2]
      ],
      physics:[
        ['experiment','核对右侧光学平台测量',.90,half-1.6,.22,Math.PI/2],
        ['work','读取左侧物理实验机柜数据',-.90,-half+1.6+2*1.22,.62,-Math.PI/2],
        ['inspect','检查左侧实验仪器',-.60,-half+1.6+(count-1)*1.22,.22,-Math.PI/2],
        ['maintenance','检查右侧实验机柜',.90,-half+1.6+3*1.22,.30,Math.PI/2]
      ],
      cargo:[
        ['maintenance','整理左侧补给货包',-.80,-half+1.6,.30,-Math.PI/2],
        ['work','核对右侧物资标签与库存',.80,-half+1.6+2*1.22,.42,Math.PI/2],
        ['inspect','检查左侧货包固定带',-.80,-half+1.6+3*1.22,.22,-Math.PI/2],
        ['rest','在补给通道旁短暂休息',.60,half-1.4,.38,Math.PI/2]
      ],
      flight:[
        ['work','读取左侧飞行系统机柜',-.18,-half+1.6,.55,-Math.PI/2],
        ['observe','通过右侧舷窗观察轨道',-.18,1.5,.82,Math.PI/2],
        ['inspect','检查右侧飞行座椅固定带',-.18,-1.35,.22,Math.PI/2],
        ['inspect','核对左侧系统面板',-.18,-half+1.6+1.22,.42,-Math.PI/2]
      ],
      eva:[
        ['inspect','检查右侧前部出舱装备',.30,-1,.22,Math.PI/2],
        ['maintenance','检查左侧工具与设备柜',-.55,-half+1.6,.28,-Math.PI/2],
        ['inspect','检查右侧后部出舱装备',.30,1,.22,Math.PI/2],
        ['observe','核对出舱通道与舱门',0,half-1,.42,0]
      ]
    }[spec.kind];
    const activityPoints=activityStations.map(([activity,name,x,z,y,angle],i)=>({activity,name,x,z,y,angle,duration:Math.max(10,routines[i][2]*.65)}));
    root.visible=false;
    return {root,zones,roof,details,lights,colliders,hatches,equipment,materials:mats,spec,microgravity:true,ceiling:H,activityPoints,transferPoints,bounds:{minX:-W/2+.12,maxX:W/2-.12,minZ:-half+.22,maxZ:half-.22},spawn:{x:0,z:Math.min(half-1.3,2.8)},pickup:{x:0,z:half-1.3},peoplePoints,taskPoints:[{name:'前部设备巡检',x:0,z:-half+1.8},{name:'中央设备巡检',x:0,z:0},{name:'舱口检查',x:0,z:half-1.4}],nativePeople:true};
  };
})();
