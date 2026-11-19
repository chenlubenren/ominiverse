/* Deterministic tenant floors, shared furniture recipes and explicit activity anchors. */
(() => {
  'use strict';const L=window.IndoorLab;
  const CORE={elevators:[{id:'lift-west',x:-1.6,z:0},{id:'lift-east',x:1.6,z:0}],stairs:[{id:'stair-A',name:'消防楼梯 A',x:-14.4,z:0,doorX:-10.8,entry:{x:-11.65,z:-2.43}},{id:'stair-B',name:'消防楼梯 B',x:14.4,z:0,doorX:10.8,entry:{x:11.65,z:-2.43}}]};
  L.TOWER={floors:30,height:3.6,bounds:{minX:-18,maxX:18,minZ:-13,maxZ:13},core:CORE};
  // The same stairwell, landings and two flights serve people and the walk camera.
  L.towerSlabTiles=[[36,9.4,0,-8.3],[36,9.4,0,8.3],[24.6,1.35,0,-2.925],[24.6,1.35,0,2.925],[9.1,4.5,-7.75,0],[9.1,4.5,7.75,0],[1.5,7.2,-17.25,0],[1.5,7.2,17.25,0]];
  L.towerStairPath=side=>{const s=CORE.stairs[side],sign=Math.sign(s.x);return[
    {x:s.entry.x,z:-2.30,y:0},{x:s.x-sign*2.45,z:-2.49,y:0},
    {x:s.x-sign*.98,z:-2.49,y:0},
    {x:s.x-sign*.98,z:2.1,y:1.8},{x:s.x+sign*.98,z:2.1,y:1.8},
    {x:s.x+sign*.98,z:-2.6,y:3.6},{x:s.x+sign*.98,z:-3.16,y:3.6},
    {x:s.x-sign*2.45,z:-3.16,y:3.6},{x:s.entry.x,z:-3.04,y:3.6}];};
  const stairPaths=CORE.stairs.map((_,side)=>{
    const nodes=L.towerStairPath(side),lengths=nodes.slice(1).map((n,i)=>Math.hypot(n.x-nodes[i].x,n.z-nodes[i].z,n.y-nodes[i].y));
    return{nodes,lengths,total:lengths.reduce((a,b)=>a+b,0)};
  });
  L.sampleTowerStair=(side,t)=>{const {nodes,lengths,total}=stairPaths[side];let d=Math.max(0,Math.min(1,t))*total,i=0;while(i<lengths.length-1&&d>lengths[i])d-=lengths[i++];const a=nodes[i],b=nodes[i+1],u=d/lengths[i];return{x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u,y:a.y+(b.y-a.y)*u,angle:Math.atan2(b.x-a.x,b.z-a.z),length:total};};
  L.towerStairRails=CORE.stairs.flatMap(s=>{
    const sign=Math.sign(s.x),rails=[{x:s.x-sign*2.1,z0:-2.20,z1:3.42,y0:0,y1:0}];
    for(const side of [-1,1]){
      rails.push({x:s.x-sign*.98+side*.93,z0:-2.21,z1:2.04,y0:.15,y1:1.78});
      rails.push({x:s.x+sign*.98+side*.93,z0:-2.21,z1:2.04,y0:3.45,y1:1.82});
    }
    return rails;
  });
  const companies=['序点科技','共生设计','知行学苑','云图数据','木石建筑','向量研究','星河传媒','森屿创意','微光教育','知序咨询','方舟产品','蓝图工程','栖木工作室','原点软件','织物实验室','经纬智造','远山文化','启明项目组','墨白策划','合一科技','集思创新','望野设计','清和研究','未来工坊','数境科技','观澜传媒','格物学院','众合事务所','天际总部'];
  const families=['数字化开放办公','联合办公空间','培训与项目中心'],programs=['董事会议与接待','专注办公与项目工坊','培训中心与洽谈','图书交流与会议','团队会议与独立办公室','设计研究与共享工作'];
  L.towerFloorSpec=n=>{n=Math.max(1,Math.min(30,Math.round(Number(n)||1)));const type=(n+1)%3,gene=L.matrixFloorGene?.(n),central=n>1&&gene?gene.central:(n+3)%6;
    const rooms=[[-12.9,-8.7],[-12.9,8.7],[12.9,-8.7],[12.9,8.7]].map(([x,z],i)=>({x,z,kind:gene?.rooms?.[i]?.kind??(n*7+i*3+Math.floor(n/4))%8,seed:gene?.rooms?.[i]?.seed??n*29+i*7}));
    return{floor:n,plan:gene?.plan,seed:n*7919,type,variant:n-1,central,centralName:programs[central],rooms,company:n===1?'SPATIAL SIMULATION / 办公大厅':companies[n-2],family:n===1?'接待 · 会客 · 展示':families[type],name:n===1?'办公大厅':`${companies[n-2]} · ${families[type]}`,area:936,height:3.6,core:JSON.parse(JSON.stringify(CORE)),signature:JSON.stringify({n,central,rooms,plan:gene?.plan})};};
  L.makeTowerFloor=(n=1,{preview=false,shell=true,connected=false}={})=>{
    const spec=L.towerFloorSpec(n),group=new THREE.Group(),zones=new THREE.Group();group.name=`tower-floor-${spec.floor}`;zones.userData.ignoreCollision=true;group.add(zones);
    const material=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.63,metalness:.04,...extra});m.color.convertSRGBToLinear();return m;};
    const mats={floor:material('#e3eaf0'),wall:material('#f4f7fa'),blue:material('#1684e8'),desk:material('#eff5fa'),chair:material('#277dcb'),metal:material('#8598ab',{metalness:.5}),fabric:material('#adc7df'),wood:material('#b9cbd9'),plant:material('#8daea8'),glass:material('#57a4e7',{transparent:true,opacity:.2,depthWrite:false,side:THREE.FrontSide}),screen:material('#2e577c'),key:material('#547087')};
    mats.metal.userData.officeRole='metal';
    mats.doorTrim=mats.metal.clone();
    mats.doorTrim.userData.officeRole='doorTrim';
    mats.doorPanel=mats.metal.clone();mats.doorPanel.userData.officeRole='doorPanel';
    mats.roomGlass=new THREE.MeshStandardMaterial({color:0xa7beca,transparent:true,opacity:.095,roughness:.16,metalness:.10,depthWrite:false,side:THREE.FrontSide,envMapIntensity:.49});
    mats.roomGlass.userData.styleLocked=true;
    mats.roomGlass.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
        float angleToGlass = abs(dot(normal, normalize(vViewPosition)));
        diffuseColor.a = mix(diffuseColor.a, 0.25, pow(1.0-angleToGlass, 3.0));
      `);
    };
    const visualAssets=new Set(),batches=new Map(),layoutItems=[],shellItems=[],seats=[],features=[],doorNodes={},doors=[],rooms=[],doorSolids=[],liftDoors=[],seatParts=new Map(),pose=new THREE.Object3D();let shellPart=false;
    function box(key,w,h,d,x,y,z,opts={}){const {ignore=false,wall=false,rotation=0,pitch=0,name='',shape='box',seatId,assemblyId,originalY}=opts,b={key,w,h,d,x,y,z,ignore,wall,rotation,pitch,shape,seatId,assemblyId,originalY,name:name||({desk:'办公桌',chair:'办公椅',fabric:'软包家具',wood:'储物柜',screen:'显示屏'}[key]||'建筑构件')};if(key==='glass'&&b.y-b.h/2<.006){b.h-=.032;b.y+=.016;}
      (shellPart?shellItems:layoutItems).push({...b});
      // Standalone reception/coffee tables also get proper floor supports.
      if(!opts.visualAsset&&!wall&&key==='desk'&&L.furnitureAssets){const type=/前台/.test(b.name)?'reception':b.h<.14&&b.y<.55&&b.w>.7&&b.d>.5?'coffee-table':null;if(type&&L.furnitureAssets.has(type)){visualAssets.add({kind:type,x,z,angle:rotation,width:w,height:y+h/2,depth:d,name:b.name,assemblyId,logicalParts:[b]});return;}}
      if(opts.visualAsset&&L.furnitureAssets?.has(opts.visualAsset.kind)){(opts.visualAsset.logicalParts??=[]).push(b);visualAssets.add(opts.visualAsset);return;}const shadow=!ignore||name==='上行梯段'||name==='折返梯段'||name==='楼梯半层平台',id=`${key}-${ignore}-${wall}-${shape}-${shadow}`;if(!batches.has(id))batches.set(id,{key,ignore,wall,shape,shadow,items:[]});batches.get(id).items.push(b);}
    function wall(w,d,x,z,{key='wall',h=2.65,exterior=false}={}){
      const height=connected&&h>=2.3?3.24:h;
      if(exterior&&shell){layoutItems.push({key:'glass',w,d,x,z,y:height/2,h:height,rotation:0,wall:true,navigationOnly:true});return;}
      const roomGlass=key==='glass';
      box(roomGlass?'roomGlass':exterior?'glass':key,w<.2&&(roomGlass||exterior)?.034:w,height,d<.2&&(roomGlass||exterior)?.034:d,x,height/2,z,{wall:true,originalY:height!==h?h/2:undefined,name:roomGlass?'通透玻璃隔断':exterior?'外窗':'办公隔墙'});
    }
    function doorWall(axis,c,a,b,p,width=1.9,opts={}){
      for(const [s,e] of [[a,p-width/2],[p+width/2,b]])if(e>s)axis==='x'?wall(e-s,.16,(s+e)/2,c,opts):wall(.16,e-s,c,(s+e)/2,opts);
      const head=opts.roomId?2.23:2.35,top=Math.max(head+.12,opts.h||2.65),height=(connected?3.24:top)-head;
      const header={wall:true,originalY:connected?(head+top)/2:undefined};
      axis==='x'?box('wall',width,height,.12,p,head+height/2,c,header):box('wall',.12,height,width,c,head+height/2,p,header);
      if(!opts.roomId)return;
      const door={id:opts.roomId,name:opts.name||'房间门',axis,x:axis==='x'?p:c,z:axis==='x'?c:p,width,height:head,open:true,fire:!!opts.fire};
      doors.push(door);
      if(preview&&!connected)return;
      const frame=new THREE.Group(),leaf=new THREE.Group();
      frame.position.set(door.x,0,door.z);
      if(axis==='z')frame.rotation.y=Math.PI/2;
      const piece=(parent,mat,w,h,d,x,y,z=0)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.userData.ignoreCollision=true;mesh.userData.roomDoor=door.id;mesh.castShadow=mat!==mats.roomGlass;mesh.receiveShadow=true;parent.add(mesh);};
      for(const edge of [-1,1])piece(frame,mats.doorTrim,.045,head,.088,edge*width/2,head/2);
      piece(frame,mats.doorTrim,width,.045,.088,0,head);
      piece(frame,mats.doorTrim,width,.016,.12,0,.008);
      // Park an open fire door against the corridor wall, outside the clear opening.
      const hinge=door.fire?-width/2:0,openAngle=door.fire?Math.PI:0,openOffset=door.fire?-Math.sign(c)*.116:0;
      leaf.position.x=hinge;
      piece(leaf,door.fire?mats.doorPanel:opts.key==='glass'?mats.roomGlass:mats.desk,width-.045,head-.055,.042,-hinge,head/2);
      for(const edge of [-1,1])piece(leaf,mats.metal,.036,head-.055,.051,edge*(width/2-.036)-hinge,head/2);
      piece(leaf,mats.metal,.22,.035,.096,width*.3-hinge,1.04);
      frame.add(leaf);group.add(frame);leaf.visible=door.fire;leaf.rotation.y=openAngle;leaf.position.z=openOffset;
      doorNodes[door.id]={leaf,openAngle,openOffset};
    }
    function registerRoom(id,name,minX,maxX,minZ,maxZ){
      const room={id,name,minX,maxX,minZ,maxZ,vent:{x:(minX+maxX)/2,z:(minZ+maxZ)/2}};
      rooms.push(room);
      if(connected){const {x,z}=room.vent;box('metal',.52,.055,.34,x,3.218,z,{ignore:true,name:'空调送风口'});for(let i=-2;i<=2;i++)box('screen',.43,.01,.013,x,3.184,z+i*.054,{ignore:true,name:'送风口格栅'});}
      return room;
    }
    function text(value,x,z,w=3){if(preview)return;const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle=L.activeTheme?.text||'#5790be';ctx.font='500 31px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(value,256,48,500);const tex=new THREE.CanvasTexture(c);tex.encoding=THREE.sRGBEncoding;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,w*96/512),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));m.rotation.x=-Math.PI/2;m.position.set(x,.027,z);m.userData.floorLabel={canvas:c,value};zones.add(m);}
    const kit=new L.OfficeKit({box,variantSeed:spec.floor,seat:s=>{s.floor=spec.floor;seats.push(s);},feature:f=>{features.push(f);return f;},label:text});
    function anchor(id,kind,name,x,z,extra={}){const f={id,kind,name,x,z,floor:spec.floor,...extra};features.push(f);return f;}
    function semanticDoor(id,name,x,z,axis,width,extra={}){const frame=new THREE.Group(),leaf=new THREE.Group();frame.position.set(x,0,z);const panel=new THREE.Mesh(new THREE.BoxGeometry(axis==='x'?width:.08,2.8,axis==='x'?.08:width),mats.roomGlass||mats.glass);panel.position.y=1.4;panel.userData.ignoreCollision=true;panel.userData.roomDoor=id;leaf.add(panel);leaf.visible=false;frame.add(leaf);group.add(frame);doorNodes[id]={leaf};doors.push({id,name,x,z,axis,width,height:2.8,open:true,...extra});}
    for(const [w,d,x,z]of L.towerSlabTiles){box('floor',w,.22,d,x,-.11,z);if(!connected)box('blue',w,.10,d,x,-.28,z);}
    if(connected){
      box('desk',18,.13,.28,0,3.175,3.42,{ignore:true,name:'楼层新风总管'});
      for(const x of [-7,-3.5,0,3.5,7])box('metal',.026,.14,.30,x,3.17,3.42,{ignore:true,name:'风管连接箍'});
    }
    if(shell){shellPart=true;for(const z of [-12.85,12.85]){if(spec.floor===1&&z>0){for(const[a,b]of [[-17.8,-3],[3,17.8]])box('glass',b-a,2.8,.06,(a+b)/2,1.4,z,{wall:true});}else box('glass',35.7,2.8,.06,0,1.4,z,{wall:true});for(let x=-17.5;x<=17.5;x+=2.5)if(!(spec.floor===1&&z>0&&Math.abs(x)<3))box('wall',.11,2.85,.16,x,1.425,z,{wall:true});}for(const x of [-17.85,17.85]){box('glass',.06,2.8,25.7,x,1.4,0,{wall:true});for(let z=-12.5;z<=12.5;z+=2.5)box('wall',.16,2.85,.11,x,1.425,z,{wall:true});}shellPart=false;}
    // Fixed lift bank and two protected stair cores on every floor.
    wall(6.4,.18,0,-2.25);for(const x of [-3.2,0,3.2])wall(.18,4.5,x,0);
    for(const[i,x]of [-1.6,1.6].entries()){
      doorWall('x',2.25,x-1.55,x+1.55,x,1.6);box('metal',2.5,2.25,.08,x,1.125,-2.12,{name:'电梯轿厢后壁'});
      const pair=[];for(const sign of [-1,1]){const node=new THREE.Mesh(new THREE.BoxGeometry(.77,2.25,.065),mats.doorPanel);node.position.set(x+sign*.395,1.125,2.23);node.userData.ignoreCollision=true;group.add(node);pair.push({node,sign,rest:x+sign*.395});}liftDoors.push(pair);
      const trim={ignore:true,name:'电梯门框'};
      for(const side of [-1,1])box('doorTrim',.055,2.25,.055,x+side*.823,1.125,2.354,trim);
      box('doorTrim',1.7,.055,.055,x,2.26,2.354,trim);
      box('doorTrim',1.6,.016,.15,x,.008,2.27,trim);
      box('screen',.21,.28,.04,x+1.03,1.35,2.38,{ignore:true,name:'电梯呼梯按钮'});text(`${i?'B':'A'} / LIFT`,x,3.03,1.6);
    }
    for(const s of CORE.stairs){const sign=Math.sign(s.x),outer=sign*16.5,depth=Math.abs(outer-s.doorX)+.08,center=(outer+s.doorX)/2;wall(depth,.18,center,-3.5);wall(depth,.18,center,3.5);wall(.18,7,outer,0);
      doorWall('z',s.doorX,-3.5,3.5,s.entry.z,1.8,{roomId:s.id+'-door',name:s.name+' · 防火门',fire:true});
      for(let i=0;i<10;i++){box('wall',1.86,.18,.47,s.x-sign*.98,(i+1)*.18-.09,-2.365+i*.47,{ignore:true,name:'上行梯段'});box('wall',1.86,.18,.47,s.x+sign*.98,1.8+(i+1)*.18-.09,1.865-i*.47,{ignore:true,name:'折返梯段'});}
      box('wall',4.08,.18,1.37,s.x,1.71,2.725,{ignore:true,name:'楼梯半层平台'});
      box('floor',4.2,.18,1.26,s.x,-.09,-2.82,{ignore:true,name:'楼层梯口平台'});
      if(!connected||spec.floor===L.TOWER.floors)box('floor',4.2,.18,1.26,s.x,3.51,-2.82,{ignore:true,name:'上层梯口平台'});
      if(spec.floor===1)box('floor',4.2,.18,6.4,s.x,-.09,0,{ignore:true,name:'首层楼梯地面'});
      anchor(s.id,'stairs',s.name,s.entry.x,s.entry.z);text(s.id==='stair-A'?'楼梯 A ↑↓':'楼梯 B ↑↓',s.entry.x,s.entry.z+.95,2.6);
    }
    for(const {x,z0,z1,y0,y1} of L.towerStairRails){
      const d=z1-z0,rise=y1-y0,rail={ignore:true,name:'楼梯防护栏杆'};
      for(const y of [.46,1.04])box(y>1?'doorTrim':'metal',.055,.055,Math.hypot(d,rise),x,(y0+y1)/2+y,(z0+z1)/2,{...rail,pitch:-Math.atan2(rise,d)});
      const posts=Math.ceil(d/1.05);
      for(let i=0;i<=posts;i++)box('metal',.047,1.04,.047,x,y0+rise*i/posts+.52,z0+d*i/posts,rail);
    }
    // Close the outer perimeter of the half landing without fencing off the U-turn.
    for(const s of CORE.stairs){
      const rail={ignore:true,name:'楼梯平台连续防护栏杆'};
      for(const side of [-1,1]){
        const x=s.x+side*1.91;
        for(const y of [.46,1.04])box(y>1?'doorTrim':'metal',.055,.055,1.38,x,1.8+y,2.73,rail);
        for(const z of [2.04,2.73,3.42])box('metal',.047,1.04,.047,x,2.32,z,rail);
      }
      for(const y of [.46,1.04])box(y>1?'doorTrim':'metal',3.82,.055,.055,s.x,1.8+y,3.42,rail);
    }
    // Proper washrooms and pantry rooms, outside the clear lift / stair circulation.
    if(!spec.plan)for(const sign of [-1,1]){
      const cx=sign*5.5;wall(2.6,.16,cx,-2.8);wall(2.6,.16,cx,2.8);wall(.16,5.6,sign*4.2,0);wall(2.6,.16,cx,0);
      for(const [kind,name,z] of [['wc','卫生间',-1.35],['coffee','茶水间',1.35]]){
        const id=kind+'-'+sign,minZ=z<0?-2.8:0,maxZ=z<0?0:2.8;
        doorWall('z',sign*6.8,minZ,maxZ,z,1.25,{roomId:id,name});
        registerRoom(id,name,cx-1.3,cx+1.3,minZ,maxZ);
      }
      box('desk',.6,.46,.75,cx,.23,-2.15,{name:'卫生间坐便器'});box('desk',.8,.83,.45,cx,.415,-.35,{name:'洗手台'});kit.coffee(cx,2.35,0,1.8);anchor(`wc-${sign}`,'toilet','卫生间',cx,-1.35);anchor(`coffee-${sign}`,'coffee','茶水间',cx,1.15);text('WC',cx,-1.1,1.1);text('茶水',cx,1.1,1.4);
    }
    const goals=[];
    if(spec.plan){L.buildFlexibleFloor({spec,kit,box,wall,doorWall,registerRoom,anchor,text,goals,seats,semanticDoor});}
    else if(spec.floor===1){
      // Arrival hall: staffed reception, security, cafe, exhibition and varied lounge groups.
      for(const sign of [-1,1]){const x=sign*8.7;kit.room=sign<0?'reception-west':'reception-east';box('desk',2.4,1.03,1,x,.515,4.6,{name:sign<0?'西侧接待前台':'东侧接待前台'});box('blue',2.2,.2,.04,x,.72,5.12,{ignore:true});kit.desk(x,3.85,Math.PI,{seat:false});kit.chair(x,3.15,0,{kind:'staff',name:'接待人员工作椅',keyboard:true,target:{x,z:3.615}});anchor(sign<0?'reception':'reception-east','reception',sign<0?'西侧前台接待':'东侧前台接待',x,6.1);text('RECEPTION / 接待',x,6.65,3.3);}
      for(const sign of [-1,1]){box('metal',.42,.92,1.5,sign*4.8,.46,4.15,{name:'访客闸机'});box('glass',.08,.65,.9,sign*4.2,.76,4.15,{ignore:true});anchor(`guard-${sign}`,'guard','入口值守',sign*4.1,10.6);kit.plant(sign*7.1,10.8,.8);}
      kit.room='lobby-west';kit.sofa(-12.7,7.6,0,{width:3.1});kit.sofa(-15.5,9.9,Math.PI/2,{width:2.4});box('desk',2.4,.08,1.15,-12.6,.44,9.3,{name:'访客等候茶几'});kit.plant(-16.7,6.2,.8);text('访客等候',-12.6,11.5,3.7);
      kit.room='lobby-east';kit.sofa(12.7,7.7,0,{width:3.4});kit.sofa(12.7,11.2,Math.PI,{width:3.4});box('desk',2.2,.08,1.0,12.7,.45,9.45,{name:'商务会客茶几'});kit.plant(16.4,10.8,.85);text('商务会客',12.6,5.9,3.7);
      for(const [side,id,name] of [[-1,'cafe','咖啡吧'],[1,'gallery','企业展廊']]){
        const minX=side<0?-17.65:8.15,maxX=side<0?-8.15:17.65;
        doorWall('x',-4.7,minX,maxX,side*9.8,2.1,{roomId:id,name,key:'glass'});
        wall(.16,8,side*8.15,-8.7);wall(.16,8,side*17.65,-8.7,{exterior:true});wall(9.5,.16,side*12.9,-12.7,{exterior:true});
        registerRoom(id,name,minX,maxX,-12.7,-4.7);
      }
      kit.room='cafe';kit.coffee(-12.7,-11.8,0,6);box('wood',5.8,.98,.7,-12.7,.49,-9.8,{name:'大厅咖啡接待吧台'});anchor('barista','staff','咖啡服务',-12.7,-10.8);for(const x of [-15.4,-11.7])kit.table(x,-6.7,{w:1.6,d:.9,chairs:2,kind:'lounge'});anchor('lobby-cafe','coffee','咖啡吧',-9.3,-8.3);text('咖啡与等候',-12.7,-4.9,4.8);
      kit.room='gallery';for(const x of [10,13.4,16]){box('wood',1.7,.7,1.6,x,.35,-10.6,{name:'企业展品基座'});box('glass',1.1,.7,1,x,1.05,-10.6,{ignore:true,name:'展览模型'});}kit.screen(13,-12.1,0,4.8);kit.sofa(13.3,-6.4,Math.PI,{width:3.7});anchor('gallery','gallery','企业展廊',13,-8.4);text('企业展廊 / GALLERY',13,-4.9,4.8);
      kit.room='information';box('wood',4,.8,.65,-2.1,.4,-9.1,{name:'楼宇导览与资料台'});kit.screen(3.9,-10.8,0,2.8);kit.plant(-5.6,-11.6,.9);anchor('information','chat','楼宇导览',0,-7);text('城市会客厅',0,-5,5);
      semanticDoor('mainExitDoor','一楼主入口 / 室外出口',0,12.2,'x',6,{external:true});anchor('entry','entry','一楼主入口',0,12.1);goals.push({id:1,name:'西侧接待',x:-8.7,z:6.1},{id:2,name:'访客等候',x:-10,z:9.4},{id:3,name:'商务会客',x:10,z:9.4},{id:4,name:'企业展廊',x:13,z:-8.4},{id:5,name:'电梯前厅',x:0,z:5.1},{id:8,name:'大厅主入口',x:0,z:12.1,external:true},{id:11,name:'东侧接待',x:8.7,z:6.1});
    }else{
      // Corner work suites use the same digital / cowork / training furniture as the menu presets.
      for(let i=0;i<spec.rooms.length;i++){const r=spec.rooms[i],side=Math.sign(r.x),sz=Math.sign(r.z),front=sz*4.7,back=sz*12.7;
        const minX=side<0?-17.65:7.5,maxX=side<0?-7.5:17.65,roomId='corner-'+i,name=['开放工位','共享长桌','培训教室','项目工坊','独立办公室','专注工区','阅读交流','研究团队'][r.kind];
        const start=layoutItems.length;kit.roomLayout(r.kind,r.x,r.z,{seed:r.seed});
        const furniture=layoutItems.slice(start).filter(b=>!b.ignore&&b.y-b.h/2<1.8);
        const entry=[9.8,10.2,10.6,11.0,11.4,9.45].map(x=>side*x).find(x=>[.25,.55,.85].every(offset=>furniture.every(b=>{
          const z=front+sz*offset,dx=x-b.x,dz=z-b.z,cos=Math.cos(b.rotation),sin=Math.sin(b.rotation);
          return Math.abs(dx*cos-dz*sin)>b.w/2+.36||Math.abs(dx*sin+dz*cos)>b.d/2+.36;
        })))??side*9.8;
        doorWall('x',front,minX,maxX,entry,2.1,{roomId,name,key:(spec.floor+i)%3===0?'glass':'wall'});
        wall(.16,8,side*7.5,r.z);
        wall(.16,8,side*17.65,r.z,{exterior:true});wall(maxX-minX,.16,(minX+maxX)/2,back,{exterior:true});
        registerRoom(roomId,name,minX,maxX,Math.min(front,back),Math.max(front,back));
        text(name,r.x,r.z-3.2,4.5);goals.push({id:i+1,name,x:entry,z:front-sz*.65});
      }
      function central(z,parts){let x=-7.5;for(let j=0;j<parts.length;j++){const part=parts[j],w=part.w,cx=x+w/2,room=`central-${z}-${j}`,start=seats.length;kit.room=room;
        const front=z<0?-6.25:6.25,back=z<0?-12.7:12.7,name={meeting:'团队会议室',training:'项目培训厅',office:'独立办公室',project:'跨团队项目区',lounge:'阅读与会客'}[part.type];
        doorWall('x',front,x,x+w,cx,1.85,{roomId:room,name,key:part.glass?'glass':'wall'});
        if(j>0)wall(.16,6.45,x,(front+back)/2);
        wall(w,.16,cx,back,{exterior:true});registerRoom(room,name,x,x+w,Math.min(front,back),Math.max(front,back));
        if(part.type==='meeting'){kit.table(cx,z,{w:Math.min(w-2.3,6.8),d:1.7,chairs:Math.max(4,2*Math.floor((w-1.5)/1.3)),kind:'meeting'});kit.screen(cx,back-Math.sign(z)*.3,z<0?0:Math.PI,Math.min(w-1.3,3.3));}
        else if(part.type==='office'){kit.desk(cx,z-.6,0,{width:1.7,name:'专注工作台'});kit.storage(cx,back-Math.sign(z)*.45,0,{w:w-1.2,h:1.2});}
        else if(part.type==='project'){for(const sx of [-1,1])kit.table(cx+sx*w*.24,z,{w:Math.min(2.5,w*.36),d:1.2,chairs:4,kind:'work'});kit.storage(cx,back-Math.sign(z)*.4,0,{w:w-1.4,h:1.5,open:true});}
        else if(part.type==='training'){for(let col=0;col<4;col++)for(let row=0;row<2;row++){const xx=cx+(col-1.5)*2.8,zz=z+(row-.5)*2.35;kit.desk(xx,zz,z<0?0:Math.PI,{seat:false,width:1.6});kit.chair(xx,zz-Math.sign(z)*.70,z<0?Math.PI:0,{kind:'training',name:'项目培训座椅',keyboard:true,target:{x:xx,z:zz-Math.sign(z)*.235}});}kit.screen(cx,back-Math.sign(z)*.35,z<0?0:Math.PI,3.5);}
        else{kit.sofa(cx-w*.3,z,Math.PI/2,{width:2.5});kit.sofa(cx+w*.3,z,-Math.PI/2,{width:2.5});box('desk',Math.min(2.5,w*.3),.08,1.3,cx,.44,z,{name:'会客茶几'});kit.storage(cx,back-Math.sign(z)*.45,0,{w:w-1.2,h:1.6,open:true});kit.plant(cx-w*.32,z+2.2);}
        const roomSeats=seats.slice(start).map(s=>s.id);anchor(room,part.type,part.type==='meeting'?'团队会议室':part.type==='training'?'项目培训厅':part.type==='office'?'独立办公室':part.type==='project'?'跨团队项目区':'阅读与会客',cx,front+Math.sign(z)*.9,{seats:roomSeats});text(part.type==='meeting'?'会议':part.type==='training'?'培训':part.type==='office'?'专注':part.type==='project'?'项目协作':'阅读会客',cx,front+Math.sign(z)*.48,Math.min(w*.7,3.8));x+=w;}}
      const recipes=[[[{w:15,type:'meeting',glass:true}],[{w:7,type:'lounge'},{w:8,type:'office'}]],[[{w:5,type:'office'},{w:5,type:'office'},{w:5,type:'office'}],[{w:15,type:'project',glass:true}]],[[{w:15,type:'training',glass:true}],[{w:7.5,type:'meeting'},{w:7.5,type:'lounge'}]],[[{w:15,type:'lounge'}],[{w:15,type:'meeting',glass:true}]],[[{w:8.5,type:'meeting',glass:true},{w:6.5,type:'meeting'}],[{w:5,type:'office'},{w:5,type:'office'},{w:5,type:'office'}]],[[{w:15,type:'project',glass:true}],[{w:7.5,type:'meeting'},{w:7.5,type:'office'}]]];
      central(-9.45,recipes[spec.central][0]);central(9.45,recipes[spec.central][1]);kit.room='print';kit.printer(-10.1,2.8,0);kit.storage(10.45,2.25,-Math.PI/2,{w:2.2,h:1.2});anchor('print','print','共享打印区',-10.1,1.85);anchor('social','chat','交流碰面',10,-2.7);text(`${String(spec.floor).padStart(2,'0')}F / ${spec.company}`,0,5.2,5.5);goals.push({id:5,name:'公共交流区',x:0,z:-4.5},{id:8,name:'电梯厅',x:0,z:3.7});
    }
    for(const s of CORE.stairs)goals.push({id:s.id==='stair-A'?6:7,name:s.name,...s.entry,transfer:true,stairId:s.id});const wc=spec.plan?features.find(f=>f.kind==='toilet'):{x:-5.5,z:-1.35},coffee=spec.plan?features.find(f=>f.kind==='coffee'):{x:5.5,z:1.15};goals.push({id:9,name:'卫生间',x:wc.x,z:wc.z},{id:10,name:'茶水间',x:coffee.x,z:coffee.z});anchor('lift-lobby','lift','电梯前厅',0,3.8);
    const layoutFingerprint=JSON.stringify(layoutItems);group.userData.layoutFingerprint=layoutFingerprint;
    const geo=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(.5,8,6);
    for(const batch of batches.values()){const mesh=new THREE.InstancedMesh((batch.shape==='sphere'?sphere:geo).clone(),mats[batch.key],batch.items.length);batch.items.forEach((b,i)=>{pose.position.set(b.x,b.y,b.z);pose.rotation.set(b.pitch,b.rotation,0);pose.scale.set(b.w,b.h,b.d);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);if(b.seatId){if(!seatParts.has(b.seatId))seatParts.set(b.seatId,[]);seatParts.get(b.seatId).push({mesh,index:i,base:pose.matrix.clone()});}});mesh.name=batch.key;mesh.castShadow=batch.shadow&&!mats[batch.key].transparent;mesh.receiveShadow=!mats[batch.key].transparent;mesh.userData.wall=batch.wall;mesh.userData.ignoreCollision=batch.ignore;mesh.userData.instanceMetadata=batch.items.map(b=>({x:b.x,y:b.y,z:b.z,key:b.key,name:b.name,kind:b.wall?'wall':'furniture',seatId:b.seatId,assemblyId:b.assemblyId}));mesh.frustumCulled=false;group.add(mesh);}
    L.furnitureAssets?.addToFloor(group,visualAssets,seatParts,preview);
    geo.dispose();sphere.dispose();zones.traverse(o=>o.userData.ignoreCollision=true);const seatById=new Map(seats.map(s=>[s.id,s]));
    const model={group,zones,hasTowerShell:shell,layoutItems,shellItems,layoutFingerprint,seats,features,liftDoors,bounds:{...L.TOWER.bounds},goals,doors,doorNodes,rooms,doorSolids,name:`SPATIAL SIMULATION / ${String(spec.floor).padStart(2,'0')}F · ${spec.name}`,displayName:`${String(spec.floor).padStart(2,'0')}F · ${spec.company}`,sceneSubtitle:spec.floor===1?'接待 · 值守 · 会客 · 展廊 · 咖啡服务':`${spec.family} · ${spec.centralName}`,layoutName:spec.name,layoutId:'building',demo:true,preset:'office',towerFloor:spec.floor,spec,
      setDoor(id,open){
        const door=doors.find(d=>d.id===id);if(!door||door.open===open)return false;
        door.open=open;const node=doorNodes[id];if(node){node.leaf.visible=door.fire||!open;node.leaf.rotation.y=open?node.openAngle||0:0;node.leaf.position.z=open?node.openOffset||0:0;}
        doorSolids.splice(0,doorSolids.length,...doors.filter(d=>d.open===false).map(d=>({x:d.x,z:d.z,y:d.height/2,h:d.height,w:d.axis==='x'?d.width:.07,d:d.axis==='x'?.07:d.width,rotation:0,wall:true,key:'wall'})));
        this.physicsVersion=(this.physicsVersion||0)+1;this.aoVersion=(this.aoVersion||0)+1;
        return true;
      },
      setSeatOffset(id,offset){this.aoVersion=(this.aoVersion||0)+1;const seat=seatById.get(id);if(!seat||seat.sofa)return;for(const p of seatParts.get(id)||[]){pose.matrix.copy(p.base);pose.matrix.elements[12]-=Math.sin(seat.angle)*offset;pose.matrix.elements[14]-=Math.cos(seat.angle)*offset;p.mesh.setMatrixAt(p.index,pose.matrix);p.mesh.instanceMatrix.needsUpdate=true;}},
      setElevators(cars){for(let i=0;i<2;i++){const c=cars[i],open=c&&Math.abs(c.floor-spec.floor)<.02?c.door:0;for(const d of liftDoors[i])d.node.position.x=d.rest+d.sign*.70*open;}}
    };
    const previous=L.building?.society?.model(spec.floor);
    if(previous?.layoutFingerprint===layoutFingerprint||previous?.spec.signature===spec.signature){
      for(const door of previous.doors)if(door.open===false)model.setDoor(door.id,false);
    }
    return model;
  };
  L.crossesClosedRoomDoor=(model,from,to)=>{
    if(!model?.doorSolids?.length)return false;
    return model.doors.some(door=>{
      if(door.open!==false)return false;
      const along=door.axis,normal=along==='x'?'z':'x';
      const t=(door[normal]-from[normal])/(to[normal]-from[normal]);
      return t>=0&&t<=1&&Math.abs(from[along]+(to[along]-from[along])*t-door[along])<door.width/2+.24;
    });
  };
  const wallCache=new WeakMap();
  L.towerSightWalls=model=>{
    if(!model)return [];
    const version=(model.physicsVersion||0)+':'+(model.wallVersion||0),cached=wallCache.get(model);
    if(cached?.version===version)return cached.walls;
    const walls=[...model.layoutItems,...model.shellItems,...model.doorSolids,...(model.dynamicSolids||[])].filter(b=>
      b.wall&&!b.destroyed&&!b.navigationOnly&&!model.destroyedBounds?.some(p=>Math.hypot(p.x-b.x,p.y-b.y,p.z-b.z)<.045));
    wallCache.set(model,{version,walls});return walls;
  };
  L.roomDoorAt=(model,ray,far)=>{
    if(!model?.towerFloor||!model.doors)return null;
    let picked=null,range=far;
    for(const door of model.doors){
      if(door.external)continue;
      const normal=door.axis==='x'?'z':'x',along=door.axis;
      const test=(plane,center)=>{
        const t=(plane-ray.origin[normal])/ray.direction[normal];
        if(!(t>.08&&t<range))return;
        const y=ray.origin.y+t*ray.direction.y,x=ray.origin[along]+t*ray.direction[along];
        if(y<0||y>door.height+.04||Math.abs(x-center)>door.width/2+.03)return;
        range=t;picked=door;
      };
      test(door[normal],door[along]);
      const node=model.doorNodes[door.id];
      if(door.fire&&door.open&&node&&Math.sign(door.x)*(ray.origin.x-door.x)<0)test(door.x+node.openOffset,door.z+door.width);
    }
    if(!picked)return null;
    const box=new THREE.Box3(),point=new THREE.Vector3();
    for(const b of L.towerSightWalls(model)){
      if(model.doorSolids.includes(b))continue;
      box.min.set(b.x-b.w/2,b.y-b.h/2,b.z-b.d/2);box.max.set(b.x+b.w/2,b.y+b.h/2,b.z+b.d/2);
      if(ray.intersectBox(box,point)&&point.distanceToSquared(ray.origin)<(range-.09)**2)return null;
    }
    return picked;
  };
  // Explicit topology for future multi-floor agents; no upper-floor facade is an outside exit.
  L.towerNavigationGraph=()=>{
    const nodes=[],edges=[];for(let f=1;f<=30;f++){for(const s of CORE.stairs){const id=`${f}:${s.id}`;nodes.push({id,floor:f,x:s.entry.x,z:s.entry.z,kind:'stair'});if(f>1)edges.push({from:id,to:`${f-1}:${s.id}`,kind:'stairs',bidirectional:true,rise:3.6,length:10.3});edges.push({from:`${f}:lift-lobby`,to:id,kind:'floor',bidirectional:true,waypoints:[{x:0,z:3.4},{x:Math.sign(s.x)*6,z:3.4},{x:Math.sign(s.x)*7.1,z:0},{...s.entry}]});}nodes.push({id:`${f}:lift-lobby`,floor:f,x:0,z:3.4,kind:'lift'});if(f>1)edges.push({from:`${f}:lift-lobby`,to:`${f-1}:lift-lobby`,kind:'elevator',bidirectional:true,fireAllowed:false,rise:3.6});}
    nodes.push({id:'1:lobby-exit',floor:1,x:0,z:12.25,kind:'exit'},{id:'outside',floor:0,x:0,z:21,kind:'assembly'});
    for(const s of CORE.stairs)edges.push({from:`1:${s.id}`,to:'1:lobby-exit',kind:'lobby',bidirectional:true,waypoints:[{x:s.entry.x,z:0},{x:Math.sign(s.x)*10.5,z:0},{x:Math.sign(s.x)*10.5,z:6},{x:0,z:9},{x:0,z:12.25}]});edges.push({from:'1:lobby-exit',to:'outside',kind:'exit',bidirectional:true});return{nodes,edges};
  };
})();

