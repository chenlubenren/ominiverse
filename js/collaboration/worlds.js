/* Three persistent environments sharing the original white / blue model language. */
(() => {
  'use strict';const C=window.CoScene,T=THREE,L=window.IndoorLab;
  C.environments={
    office:{name:'办公楼',detail:'06F · 共创办公层',number:'01',english:'WORKPLACE',title:'一起工作的<br>另一种可能。',caption:'人在创造，机器人在协作。',coordinate:'31° N · EARTH',brief:'共享办公，协作发生的地方',description:'在熟悉的工位、会议室与茶水间，观察递送、引导与主动让行如何融入日常。',tags:['物品交接','共享通道','办公协助'],background:'#eff4fa',camera:[36,34,42],target:[0,0,0],distance:65},
    campus:{name:'楼外园区',detail:'GROUND · 开放式共生园区',number:'02',english:'OPEN CAMPUS',title:'让协作，<br>走出建筑边界。',caption:'从一段同行，到一整个园区。',coordinate:'31° N · EARTH',brief:'从室内，到开放的共同生活',description:'办公塔楼与环形步道相连。穿过水庭、绿岛、配送驿站和充电区，探索开放空间中的人机协作。',tags:['园区巡检','最后一程配送','人机共行'],background:'#edf3f9',camera:[73,58,83],target:[0,1,11],distance:150},
    station:{name:'轨道空间站',detail:'ORBITAL · 共生研究舱',number:'03',english:'ORBITAL HABITAT',title:'在更远的地方，<br>依然彼此协作。',caption:'一座空间站，也是一处共同的家。',coordinate:'LEO · 408 KM',brief:'在轨道上，重新想象工作与生活',description:'剖开舱体，走进实验区、生活区与观景廊。伙伴共同巡检、补给、交接，远处是蓝色地球。',tags:['科研补给','设备巡检','舱内协作'],background:'#15243b',camera:[39,35,44],target:[0,1,-1],distance:70}
  };
  function builder(id,bounds){
    const root=new T.Group(),zones=new T.Group(),colliders=[],batches=new Map();root.name=id;root.add(zones);
    const materials={white:C.material('#eef3f9'),floor:C.material('#dce5ee'),blue:C.material('#3989de'),pale:C.material('#bed1e5'),dark:C.material('#486583'),metal:C.material('#91a8c1',{metalness:.52,roughness:.38}),glass:C.material('#96c9ed',{transparent:true,opacity:.19,depthWrite:false,roughness:.12}),green:C.material('#9ebcb5'),leaf:C.material('#abc8c2'),water:C.material('#6db1dd',{roughness:.23,metalness:.25}),screen:C.material('#244967',{emissive:'#1b4669',emissiveIntensity:.14}),glow:C.material('#b0e9ff',{emissive:'#5dbde9',emissiveIntensity:.7}),road:C.material('#c8d7e7'),wood:C.material('#b3c4d3'),fabric:C.material('#b5cce0'),chair:C.material('#488bd0'),desk:C.material('#f2f6fa'),plant:C.material('#9ebcb5'),key:C.material('#6a8cae')};
    function box(key,w,h,d,x,y,z,{solid=false,rotation=0,shape='box',name=''}={}){
      const record={w,h,d,x,y,z,rotation,key,name};const batch=key+':'+shape;
      if(!batches.has(batch))batches.set(batch,{key,shape,items:[]});batches.get(batch).items.push(record);
      if(solid&&h>.12)colliders.push(record);
    }
    function label(text,x,z,width=4){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=80;const ctx=canvas.getContext('2d');ctx.fillStyle=id==='station'?'#5884b1':'#7298ba';ctx.font='500 28px "Microsoft YaHei", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,40,490);const texture=new T.CanvasTexture(canvas);texture.encoding=T.sRGBEncoding;const mesh=new T.Mesh(new T.PlaneGeometry(width,width*80/512),new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.035,z);zones.add(mesh);}
    function beam(a,b,r=.05,key='metal'){const av=new T.Vector3(...a),bv=new T.Vector3(...b),direction=bv.clone().sub(av);const m=C.part(root,'cylinder',materials[key],[r,direction.length(),r],av.clone().add(bv).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());return m;}
    function finish(){const pose=new T.Object3D();for(const {key,shape,items}of batches.values()){const geo=shape==='sphere'?new T.SphereGeometry(.5,12,8):shape==='cylinder'?new T.CylinderGeometry(.5,.5,1,20):new T.BoxGeometry(1,1,1);const mesh=new T.InstancedMesh(geo,materials[key],items.length);items.forEach((b,i)=>{pose.position.set(b.x,b.y,b.z);pose.scale.set(b.w,b.h,b.d);pose.rotation.set(0,b.rotation,0);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);});mesh.castShadow=!materials[key].transparent;mesh.receiveShadow=true;mesh.name=id+'-'+key;root.add(mesh);}return{root,zones,colliders,bounds,materials};}
    const kit=new L.OfficeKit({box:(key,w,h,d,x,y,z,opts={})=>box(key,w,h,d,x,y,z,{...opts,solid:!opts.ignore&&y-h/2<1.8&&y+h/2>.25}),seat:()=>{},feature:f=>f,label});
    return{root,zones,colliders,materials,box,label,beam,finish,kit};
  }
  function station(){
    const w=builder('station',{minX:-21,maxX:21,minZ:-13,maxZ:13}),{box,label,beam,kit}=w;
    box('dark',44,.7,28,0,-.75,0);box('metal',43,.24,27,0,-.28,0);box('floor',42,.18,26,0,-.09,0);
    for(let x=-20;x<=20;x+=2)for(let z=-12;z<=12;z+=2){box('white',1.97,.018,1.97,x,.01,z);}
    for(const z of [-2.8,2.8]){box('blue',40,.02,.09,0,.03,z);box('glow',39,.025,.035,0,.045,z+.15);}
    // Rear panoramic windows, low front sill, exposed ribs and open roof for observation.
    box('white',42,1,.35,0,.5,-13);box('glass',40,4,.08,0,3,-13);box('white',42,.3,.6,0,5.2,-13);
    for(let x=-20;x<=20;x+=4){box('white',.18,4.6,.5,x,2.7,-13);box('blue',.28,.28,.58,x,5.1,-13);}
    for(const x of [-21,21]){box('white',.4,3.7,26,x,1.85,0,{solid:true});box('blue',.06,.12,24,x-Math.sign(x)*.23,2,0);}
    box('white',42,.55,.35,0,.275,13);box('blue',40,.06,.39,0,.59,13);
    for(const x of [-18,-9,0,9,18]){
      const curve=new T.CatmullRomCurve3([new T.Vector3(x,2.8,-13),new T.Vector3(x,5.6,-11),new T.Vector3(x,7.2,-5),new T.Vector3(x,7.6,0),new T.Vector3(x,7.2,5),new T.Vector3(x,5.6,11),new T.Vector3(x,2.8,13)]);
      const rib=new T.Mesh(new T.TubeGeometry(curve,32,.11,6,false),w.materials.white);rib.castShadow=true;w.root.add(rib);
      for(const z of [-12.6,12.6]){box('metal',.42,2.4,.42,x,1.2,z,{solid:true});box('glow',.07,1.8,.04,x,.95,z-Math.sign(z)*.23);}
    }
    // Lab benches, sample cartridges and instrument racks.
    for(const x of [-15,-9]){box('metal',4.4,.83,1.5,x,.415,-8,{solid:true});box('white',4.6,.12,1.7,x,.89,-8);for(let i=0;i<3;i++){box('screen',.75,.5,.06,x-1.35+i*1.35,1.32,-8.5);box('metal',.06,.32,.08,x-1.35+i*1.35,1.08,-8.5);box('glow',.55,.025,.02,x-1.35+i*1.35,1.35,-8.46);}for(const dx of [-.8,0,.8]){box('glass',.22,.45,.22,x+dx,1.18,-7.65,{shape:'cylinder'});box('blue',.24,.045,.24,x+dx,1.42,-7.65,{shape:'cylinder'});}}
    for(let i=0;i<5;i++){const x=-18+i*2.3;box('white',1.8,2.4,.8,x,1.2,-11.4,{solid:true});box('screen',1.45,1.5,.03,x,1.4,-10.98);for(let j=0;j<6;j++){box('metal',1.3,.07,.04,x,.8+j*.23,-10.95);box(j%2?'glow':'blue',.06,.035,.04,x+.47,.9+j*.23,-10.92);}}
    label('01 / RESEARCH LAB',-12,-4.7,7);
    // Medical / systems alcove, with articulated service tools and storage.
    for(const x of [7,12,17]){box('white',3.4,.85,1.5,x,.425,-10.8,{solid:true});box('pale',3.5,.12,1.6,x,.91,-10.8);box('screen',2.4,1.25,.08,x,2,-11.3);box('blue',1,.035,.02,x,2.15,-11.25);box('glow',1.8,.025,.02,x,1.8,-11.25);}
    kit.table(11,-6,{w:5,d:1.3,chairs:4,kind:'work'});label('02 / MISSION CONTROL',12,-3.9,8);
    // Habitat: bunks, shared table, galley and plant growth rack.
    for(const x of [-17,-13]){box('white',3.3,2.6,2.2,x,1.3,10.8,{solid:true});box('dark',2.9,2.2,.05,x,1.35,9.68);for(const y of [.55,1.7]){box('pale',2.75,.16,1.8,x,y,10.6);box('fabric',.6,.14,1.3,x-1,y+.15,10.5);box('glow',2.4,.035,.025,x,y+.84,9.65);}}
    kit.table(-12,6,{w:4.2,d:1.2,chairs:4,kind:'work'});kit.coffee(-5.4,10.9,0,3.8);
    for(const x of [-19.5,-18.8,-18.1])for(const y of [.5,1.1,1.7]){box('white',.6,.09,1.2,x,y,5.6);box('green',.4,.22,.85,x,y+.13,5.6,{shape:'sphere'});}label('03 / LIVING QUARTERS',-12,3.5,8);
    // Cargo handling and robot repair bay.
    for(const x of [7,12,17])for(const z of [8,11]){box('metal',2.1,1.1,1.7,x,.55,z,{solid:true});box('white',2.15,.1,1.75,x,1.15,z);box('blue',.25,1.08,1.76,x,.55,z);box('dark',.65,.2,.025,x,.8,z+.88);}
    for(const x of [6,8.5,11]){box('blue',1.7,.05,1.9,x,.04,4.8);box('white',1.7,.7,.16,x,.35,5.7,{solid:true});box('glow',1,.035,.03,x,.57,5.8);}label('04 / LOGISTICS BAY',13,3.5,8);
    for(const z of [-7,7]){box('white',.12,2.3,7,-2,1.15,z,{solid:true});box('glass',.025,1.3,6.5,-2,2.85,z);}
    // Docking hatch at the side of the central corridor.
    box('dark',.14,3.1,3.8,20.76,1.55,0);for(const z of [-1.85,1.85])box('blue',.25,3.4,.13,20.62,1.7,z);box('glow',.1,.08,3.5,20.50,3.3,0);label('AIRLOCK',18.4,0,2.6);
    label('CO-SCENE / ORBITAL HABITAT',0,0,12);
    // Spherical Earth, translucent atmosphere and deterministic star field.
    const earth=new T.Group();earth.position.set(-6,-5,-52);
    const atlas=document.createElement('canvas');atlas.width=1024;atlas.height=512;const ctx=atlas.getContext('2d');
    ctx.fillStyle='#27628d';ctx.fillRect(0,0,1024,512);
    // A hand-drawn equirectangular atlas keeps the globe fully local and stylized.
    const continents=[
      [[-168,65],[-147,71],[-128,70],[-115,75],[-88,70],[-62,55],[-53,48],[-65,43],[-80,26],[-86,19],[-80,8],[-96,16],[-110,28],[-118,33],[-126,50],[-145,58]],
      [[-81,12],[-65,10],[-51,4],[-35,-6],[-41,-22],[-53,-34],[-66,-55],[-74,-47],[-73,-24],[-81,-5]],
      [[-54,60],[-40,59],[-21,70],[-29,83],[-49,83],[-63,75]],
      [[-10,36],[-18,24],[-15,10],[-7,5],[10,4],[10,-5],[15,-17],[19,-35],[30,-34],[40,-16],[51,11],[43,12],[34,29],[23,33],[9,37]],
      [[-10,36],[-10,44],[-3,49],[4,52],[10,55],[5,61],[20,71],[33,70],[44,65],[60,70],[90,76],[120,72],[150,70],[179,65],[165,55],[143,48],[135,35],[122,30],[119,19],[108,10],[101,4],[98,17],[88,22],[80,7],[72,20],[57,25],[48,30],[43,12],[35,16],[31,30],[25,39],[13,45],[10,40],[2,43]],
      [[112,-22],[114,-34],[132,-35],[145,-39],[153,-27],[144,-12],[132,-12],[123,-17]],
      [[47,-13],[50,-16],[47,-26],[44,-25]],[[129,31],[135,34],[141,42],[144,44],[142,35],[135,31]],
      [[-8,50],[-5,59],[0,58],[2,52]],[[94,5],[104,-4],[115,-8],[129,-3],[119,2]],
      [[166,-34],[179,-39],[175,-46],[168,-46]],[[43,12],[50,15],[57,24],[46,30],[36,29]]
    ];
    ctx.fillStyle='#93b0aa';for(const points of continents){ctx.beginPath();points.forEach(([lon,lat],i)=>{const x=(lon+180)/360*1024,y=(90-lat)/180*512;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.fill();}
    ctx.fillStyle='#d2e5eb';ctx.beginPath();ctx.moveTo(0,488);for(let x=0;x<=1024;x+=12)ctx.lineTo(x,485+Math.sin(x*.043)*7);ctx.lineTo(1024,512);ctx.lineTo(0,512);ctx.fill();
    // Soft cloud bands follow the sphere through the texture, avoiding floating polygons.
    ctx.strokeStyle='rgba(235,247,255,.21)';ctx.lineCap='round';for(let i=0;i<18;i++){ctx.lineWidth=2+(i%4)*2;ctx.beginPath();const x=(i*137)%1024,y=95+(i*37)%310;ctx.moveTo(x,y);ctx.bezierCurveTo(x+25,y-14,x+58,y+14,x+105,y-4);ctx.stroke();}
    const earthMap=new T.CanvasTexture(atlas);earthMap.encoding=T.sRGBEncoding;earthMap.anisotropy=4;
    C.part(earth,new T.SphereGeometry(16,64,48),C.material('#ffffff',{map:earthMap,roughness:1,metalness:0}),[1,1,1]);
    C.part(earth,new T.SphereGeometry(16.24,48,32),C.material('#8fcfff',{transparent:true,opacity:.15,depthWrite:false,side:T.BackSide,emissive:'#6ca9e1',emissiveIntensity:.25}),[1,1,1]);earth.rotation.set(.12,-2.0,-.25);w.root.add(earth);
    const stars=[];let seed=12345;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<650;i++){const x=(rand()-.5)*250,y=rand()*95-15,z=-70-rand()*100;stars.push(x,y,z);}const sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(stars,3));const starPoints=new T.Points(sg,new T.PointsMaterial({color:'#bcd7f4',size:.16,sizeAttenuation:true}));w.root.add(starPoints);
    // Exterior solar wings remain visible beside the cutaway habitat.
    for(const sign of [-1,1]){box('metal',10,.2,1,sign*27,-.7,-5);for(let i=0;i<3;i++){box('dark',7,.12,5,sign*31,-.5,-13+i*6);for(let k=0;k<7;k++)box('blue',.04,.025,4.7,sign*31-3+k,-.42,-13+i*6);for(let k=0;k<5;k++)box('metal',6.8,.025,.025,sign*31,-.40,-15+k+i*6);}}
    const result=w.finish();result.pickup={x:14,z:4};result.spawn={x:0,z:1};result.peoplePoints=[[-9,0],[9,0],[-15,-5],[-7,-5],[12,-4],[6,-6],[-13,3.8],[-7,3.8],[16,4],[0,-8],[0,8]];result.taskPoints=[{x:-12,z:-5},{x:11,z:-4},{x:-12,z:3.5},{x:14,z:4},{x:18,z:0}];return result;
  }
  C.buildWorld=id=>{if(id!=='station')throw new Error('办公楼与园区由原项目提供。');return station();};
  C.makeNavigation=world=>{
    const grid=new L.Grid(world.bounds,world.root.name==='campus'?.45:.30);
    // Rasterize true oriented furniture footprints; ignore ceiling / floor decoration.
    for(const b of world.colliders){const r=b.rotation||0,c=Math.cos(r),s=Math.sin(r),ex=(Math.abs(c)*b.w+Math.abs(s)*b.d)/2+.25,ez=(Math.abs(s)*b.w+Math.abs(c)*b.d)/2+.25;
      const c0=Math.max(0,Math.floor((b.x-ex-grid.minX)/grid.cell)),c1=Math.min(grid.cols-1,Math.ceil((b.x+ex-grid.minX)/grid.cell)),r0=Math.max(0,Math.floor((b.z-ez-grid.minZ)/grid.cell)),r1=Math.min(grid.rows-1,Math.ceil((b.z+ez-grid.minZ)/grid.cell));
      for(let row=r0;row<=r1;row++)for(let col=c0;col<=c1;col++){const i=row*grid.cols+col,p=grid.point(i),dx=p.x-b.x,dz=p.z-b.z;if(Math.abs(dx*c-dz*s)<=b.w/2+grid.cell*.6&&Math.abs(dx*s+dz*c)<=b.d/2+grid.cell*.6)grid.solid[i]=1;}
    }
    grid.finalize();return grid;
  };
})();
