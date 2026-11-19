/* Two real compartments around one pressure door, built for eye-level film shots. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,clamp=T.MathUtils.clamp;
  C.buildStationFilmSet=(station=window.IndoorLab?.collaboration?.stationExperience)=>{
    const root=new T.Group();root.name='隔离线 / 双舱电影布景';
    const hull=new T.Group(),equipment=new T.Group(),doorRoot=new T.Group(),lighting=new T.Group();
    root.add(hull,equipment,doorRoot,lighting);
    const colliders=[],textures=[],materials=[],geometries=[],targets={},W=5.2,H=3.5;
    const material=(color,options={})=>{const m=C.material(color,options);materials.push(m);return m;};
    const m={shell:material('#b8c1c4',{roughness:.68,metalness:.20}),ivory:material('#d9dcd3',{roughness:.57,metalness:.15}),dark:material('#142430',{roughness:.62,metalness:.35}),metal:material('#526d7b',{roughness:.34,metalness:.75}),floor:material('#52616a',{roughness:.81}),rubber:material('#142027',{roughness:.9}),cyan:material('#83c9d4',{emissive:'#4ca4bb',emissiveIntensity:.55}),amber:material('#d6a164',{emissive:'#d69c51',emissiveIntensity:.22}),red:material('#ec6c53',{emissive:'#e84432',emissiveIntensity:.8}),green:material('#82d6b4',{emissive:'#48ba91',emissiveIntensity:.7}),glass:material('#50869a',{metalness:.1,roughness:.08,transparent:true,opacity:.28,depthWrite:false}),screen:material('#0a2433',{roughness:.32,metalness:.3}),padding:material('#3f6570',{roughness:.94})};
    function own(g){geometries.push(g);return g;}
    const boxGeo=own(new T.BoxGeometry(1,1,1)),sphereGeo=own(new T.SphereGeometry(1,20,14)),cylinderGeo=own(new T.CylinderGeometry(1,1,1,20));
    function part(parent,name,mat,geometry,size,pos,rotation=[0,0,0]){const mesh=new T.Mesh(geometry,mat);mesh.name=name;mesh.scale.set(...size);mesh.position.set(...pos);mesh.rotation.set(...rotation);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
    const box=(parent,name,mat,size,pos,rotation)=>part(parent,name,mat,boxGeo,size,pos,rotation);
    const sphere=(parent,name,mat,size,pos)=>part(parent,name,mat,sphereGeo,size,pos);
    function rounded(parent,name,mat,size,pos,r=.04){const radius=Math.min(r,Math.min(...size)*.49),mesh=new T.Mesh(own(C.roundedRobotBox(...size,radius)),mat);mesh.name=name;mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
    function bar(parent,name,a,b,r=.025,mat=m.metal){const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);const mesh=part(parent,name,mat,cylinderGeo,[r,delta.length(),r],start.clone().add(end).multiplyScalar(.5).toArray());mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return mesh;}
    function collider(name,x,z,w,d,y=H/2,h=H){const c={name,x,z,w,d,y,h};colliders.push(c);return c;}
    function placard(parent,title,sub,size,pos,yaw=0,color='#a9dce0'){
      const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d');
      ctx.fillStyle='#102631';ctx.fillRect(0,0,1024,256);ctx.fillStyle=color;ctx.fillRect(0,0,12,256);ctx.font='600 62px "Microsoft YaHei",sans-serif';ctx.fillText(title,40,105,944);ctx.fillStyle='#94b2c1';ctx.font='25px "Microsoft YaHei",sans-serif';ctx.fillText(sub,42,181,940);
      const texture=new T.CanvasTexture(canvas);texture.encoding=T.sRGBEncoding;textures.push(texture);const mat=material('#ffffff',{map:texture,emissive:'#ffffff',emissiveMap:texture,emissiveIntensity:.24,roughness:.68});
      const mesh=new T.Mesh(own(new T.PlaneGeometry(...size)),mat);mesh.name=title;mesh.position.set(...pos);mesh.rotation.y=yaw;parent.add(mesh);return mesh;
    }
    function panelScreen(parent,name,width,height,pos,yaw=0){
      const holder=new T.Group();holder.name=name;holder.position.set(...pos);holder.rotation.y=yaw;parent.add(holder);
      rounded(holder,name+'框',m.dark,[width+.08,height+.08,.055],[0,0,0],.025);box(holder,name+'玻璃',m.screen,[width,height,.018],[0,0,.036]);
      for(let row=0;row<4;row++){box(holder,'读数轨迹',m.cyan,[width*(.45+row*.10),.012,.009],[-width*.15,.15-row*.10,.05]);for(let i=0;i<9;i++)box(holder,'遥测',row===3?m.amber:m.cyan,[.009,.018+((i*7+row)%5)*.01,.009],[-width*.4+i*width*.09,-height*.27,.052]);}
      return holder;
    }
    // Reuse the actual web cabin, including its instanced hull, materials,
    // textures, science rack and imported instrument. Only mission fittings
    // below are new. Borrowed geometries/textures are never disposed here.
    const source=station?.getRoom('wentian');if(!source)throw Error('问天原舱模型尚未就绪');
    const sourceToFilm=new T.Matrix4().makeScale(W/source.spec.width,H/source.ceiling,10.3/source.spec.length),sourceMaterials=new Map(),borrowedSurfaces=[],borrowedGeometry=new Set(),borrowedTextures=new Set(),borrowedMeshes=[];
    const roof=new T.Group(),cutawayEdge=new T.Group();roof.name='问天原舱可揭顶壳';cutawayEdge.name='问天原舱观察侧可揭结构';hull.add(roof,cutawayEdge);roof.visible=false;const cutawayMaterials=[];
    const reuse={sourceModuleId:'wentian',sourceRootUuid:source.root.uuid,sourceToFilm:sourceToFilm.toArray(),sourceDimensions:[source.spec.width,source.ceiling,source.spec.length],filmDimensions:[W,H,10.3],instanceCount:0,geometryUuids:[],textureUuids:[],sources:[],equipment:['生命科学机柜','植物培养单元','lab-instrument'],ownsSourceGeometry:false};
    const sourceMaterial=mat=>{if(!sourceMaterials.has(mat)){const copy=mat.clone();copy.userData={...mat.userData,filmBorrowedMaterial:true};sourceMaterials.set(mat,copy);materials.push(copy);for(const value of Object.values(mat))if(value?.isTexture)borrowedTextures.add(value.uuid);}return sourceMaterials.get(mat);};
    function sourcePlacement(meta){
      if(meta.section==='structure')return sourceToFilm.clone();
      if(meta.section==='science-plants')return new T.Matrix4().makeTranslation(2.15,0,-3.65).multiply(new T.Matrix4().makeScale(1,H/source.ceiling,.46)).multiply(new T.Matrix4().makeTranslation(-(source.spec.width/2-.48),0,-.3));
      if(meta.section==='science-instrument'){const instrumentZ=-source.spec.length/2+1.6+(Math.max(1,Math.floor((source.spec.length-3)/1.22))-1)*1.22;return new T.Matrix4().makeTranslation(-2.05,0,4.45).multiply(new T.Matrix4().makeScale(.82,.92,.82)).multiply(new T.Matrix4().makeTranslation(-(-source.spec.width/2+.55),0,-instrumentZ));}
      // Keep the original first science rack, relocated beyond the rescue path.
      if(meta.section==='equipment'&&meta.position[0]<-1.3&&meta.position[2]<-3.8&&meta.position[2]>-5.05)return new T.Matrix4().makeTranslation(0,0,-.77).multiply(sourceToFilm);
      return null;
    }
    for(const mesh of source.root.children.filter(o=>o.isInstancedMesh).concat(source.roof.children.filter(o=>o.isInstancedMesh))){
      const data=mesh.userData.stationSource;if(!data)continue;const groups=new Map();
      data.instances.forEach((meta,index)=>{const transform=sourcePlacement(meta);if(!transform)return;const matrix=new T.Matrix4();mesh.getMatrixAt(index,matrix);matrix.premultiply(transform);const nearEdge=meta.section==='structure'&&meta.position[1]>.3&&(meta.position[0]<-2.1||meta.position[2]>5.8),destination=data.top?roof:nearEdge?cutawayEdge:hull,key=destination.uuid;const group=groups.get(key)||{destination,items:[]};group.items.push({matrix,index,section:meta.section});groups.set(key,group);});
      for(const {destination,items}of groups.values()){
        let mat=sourceMaterial(mesh.material);if(destination===cutawayEdge){mat=mat.clone();materials.push(mat);cutawayMaterials.push({mat,opacity:mat.opacity});}
        const borrowed=new T.InstancedMesh(mesh.geometry,mat,items.length);borrowed.name='原问天 / '+data.key;borrowed.castShadow=mesh.castShadow;borrowed.receiveShadow=mesh.receiveShadow;borrowed.userData.filmBorrowed=true;borrowed.userData.sourceMeshUuid=mesh.uuid;destination.add(borrowed);borrowedMeshes.push(borrowed);borrowedGeometry.add(mesh.geometry.uuid);
        items.forEach(({matrix,index,section},i)=>{borrowed.setMatrixAt(i,matrix);const surface=new T.Mesh(mesh.geometry,borrowed.material);surface.name='问天原舱 / '+section+' / '+data.key;surface.matrixAutoUpdate=false;surface.matrix.copy(matrix);surface.matrixWorld.copy(matrix);surface.visible=destination!==roof;surface.userData={filmStaticSurface:true,filmBorrowed:true,sourceMeshUuid:mesh.uuid,sourceInstance:index,renderInstance:borrowed,instanceIndex:i};borrowedSurfaces.push(surface);});
        reuse.instanceCount+=items.length;reuse.sources.push({meshUuid:mesh.uuid,geometryUuid:mesh.geometry.uuid,instances:items.map(it=>it.index)});
      }
    }
    for(const detail of source.details.children){
      if(detail.userData.stationProp!=='lab-instrument'&&detail.name!=='植物培养单元'&&!(detail.userData.stationSourceSection==='equipment'&&detail.position.x< -1.3&&detail.position.z< -3.8))continue;
      const section=detail.userData.stationSourceSection||'science-instrument',matrix=sourcePlacement({section,position:detail.position.toArray()});if(!matrix)continue;const holder=new T.Group(),clone=detail.clone(true);holder.name='原问天细节 / '+detail.name;holder.matrixAutoUpdate=false;holder.matrix.copy(matrix);holder.add(clone);hull.add(holder);
      clone.traverse(o=>{o.userData.filmBorrowed=true;if(!o.isMesh)return;borrowedGeometry.add(o.geometry.uuid);o.material=Array.isArray(o.material)?o.material.map(sourceMaterial):sourceMaterial(o.material);});
    }
    reuse.geometryUuids=[...borrowedGeometry];reuse.textureUuids=[...borrowedTextures];
    const cutaway=value=>{const amount=cutaway.amount=clamp(value,0,1);roof.visible=false;cutawayEdge.visible=amount<.995;for(const {mat,opacity}of cutawayMaterials){const transparent=amount>.001;mat.opacity=opacity*(1-amount);if(mat.transparent!==transparent){mat.transparent=transparent;mat.depthWrite=!transparent;mat.needsUpdate=true;}}for(const surface of borrowedSurfaces)if(surface.userData.renderInstance.parent===cutawayEdge)surface.visible=cutawayEdge.visible;return amount;};cutaway.amount=0;cutaway.roof=roof;cutaway.edge=cutawayEdge;
    collider('问天原舱左边界',-2.64,0,.13,10.3);collider('问天原舱右边界',2.64,0,.13,10.3);
    // Full pressure bulkhead around the actual 1.65 m aperture.
    for(const sign of [-1,1]){
      const wallWidth=(W-1.65)/2;box(doorRoot,'隔离舱实体隔墙',m.ivory,[wallWidth,H,.40],[sign*(.825+wallWidth/2),H/2,0]);collider('中央隔墙',sign*(.825+wallWidth/2),0,wallWidth,.40);
      for(const face of [-1,1]){
        box(doorRoot,'门框深色密封槽',m.rubber,[.12,2.76,.045],[sign*.8625,1.575,face*.234]);
        box(doorRoot,'不锈钢门框',m.metal,[.095,2.85,.095],[sign*.935,1.575,face*.25]);
        for(let y=.45;y<2.8;y+=.32)sphere(doorRoot,'门框锁点',m.metal,[.027,.027,.014],[sign*1.015,y,face*.265]);
      }
    }
    box(doorRoot,'门顶隔墙',m.ivory,[1.65,.60,.40],[0,3.20,0]);box(doorRoot,'门槛',m.dark,[1.65,.25,.48],[0,.125,0]);
    collider('门槛',0,0,1.65,.48,.125,.25);collider('门顶',0,0,1.65,.40,3.2,.60);
    for(const face of [-1,1]){
      box(doorRoot,'门顶密封槽',m.rubber,[1.76,.095,.045],[0,2.935,face*.234]);box(doorRoot,'门框横梁',m.metal,[1.96,.12,.095],[0,3.02,face*.25]);
      placard(doorRoot,face>0?'B-07  生物隔离':'B-07  接应区',face>0?'BIO LAB  /  PRESSURE INTERLOCK':'MEDICAL BAY  /  PRESSURE INTERLOCK',[1.56,.36],[0,3.27,face*.211],face<0?Math.PI:0);
    }
    const door={root:doorRoot,leaves:[],openAmount:0,clearWidth:0,openingWidth:1.65,openingBottom:.25,openingTop:2.9,depth:.4,closed:true,colliders:[],indicators:[],bolts:[]};
    for(const sign of [-1,1]){
      const leaf=new T.Group();leaf.name=sign<0?'左隔离门叶':'右隔离门叶';leaf.position.set(sign*.4125,0,0);doorRoot.add(leaf);door.leaves.push(leaf);
      // Each leaf has a real observation-window opening instead of transparent metal.
      rounded(leaf,'舱门下装甲',m.metal,[.821,1.31,.13],[0,.905,0],.045);
      rounded(leaf,'舱门上装甲',m.metal,[.821,.69,.13],[0,2.555,0],.045);
      for(const side of [-1,1])rounded(leaf,'观察窗竖框',m.metal,[.205,.65,.13],[side*.3075,1.885,0],.018);
      box(leaf,'双层观察窗',m.glass,[.405,.65,.035],[0,1.885,0]);
      for(const face of [-1,1]){
        for(const y of [1.57,2.20])box(leaf,'观察窗密封圈',m.rubber,[.445,.035,.025],[0,y,face*.078]);
        for(const x of [-.22,.22])box(leaf,'观察窗密封圈',m.rubber,[.035,.65,.025],[x,1.885,face*.078]);
        box(leaf,'内置门缝警戒条',m.amber,[.018,2.35,.016],[-sign*.383,1.55,face*.078]);
        for(const x of [-.285,.285])box(leaf,'门叶加强筋',m.dark,[.018,.87,.015],[x,.91,face*.078]);
        bar(leaf,'门叶应急把手',[-sign*.17,1.11,face*.12],[-sign*.17,1.38,face*.12],.022,m.ivory);
      }
      const data={x:leaf.position.x,z:0,w:.825,d:.16,y:1.575,h:2.65,leaf};door.colliders.push(data);
    }
    const statusMaterial=m.red.clone();materials.push(statusMaterial);
    for(const face of [-1,1])for(const sign of [-1,1]){
      const indicator=box(doorRoot,'门锁红绿状态灯',statusMaterial,[.075,.20,.025],[sign*1.08,2.7,face*.27]);door.indicators.push(indicator);
      bar(doorRoot,'门前固定扶手',[sign*1.14,1.32,face*.43],[sign*1.14,2.03,face*.43],.029,m.amber);
      for(const y of [1.32,2.03])bar(doorRoot,'门前扶手支座',[sign*1.14,y,face*.22],[sign*1.14,y,face*.43],.02,m.metal);
    }
    const controls=new T.Group();controls.name='手动解除与授权面板';controls.position.set(1.43,1.55,.34);doorRoot.add(controls);
    rounded(controls,'解除面板密封底座',m.dark,[.55,.64,.12],[0,0,0],.035);panelScreen(controls,'压力互锁读数',.38,.24,[0,.13,.07]);
    const button=box(controls,'人工确认按钮',m.amber,[.16,.09,.045],[0,-.13,.085]);
    bar(controls,'红色应急解除柄',[-.18,-.18,.11],[-.18,-.03,.11],.024,m.red);
    placard(doorRoot,'人工确认','HOLD TO RELEASE',[.49,.12],[1.43,1.13,.414],0,'#f1bd79');
    targets.consoleButton=new T.Vector3(1.43,1.42,.455);targets.manualRelease=new T.Vector3(1.25,1.45,.46);
    // Palms touch the actual glazed aperture while the door is closed.
    targets.labWindowPalm=new T.Vector3(-.4125,1.88,-.028);targets.careWindowPalm=new T.Vector3(.4125,1.88,.028);
    targets.doorHandrailNear=new T.Vector3(.60,1.65,.53);targets.doorHandrailFar=new T.Vector3(-1.14,1.65,-.43);
    // Additional inside rails lie within arm's reach without reducing the central body passage.
    for(const [name,p]of [['near',targets.doorHandrailNear]]){
      const sign=Math.sign(p.z);bar(doorRoot,'门内接力扶手-'+name,[p.x,1.45,p.z],[p.x,1.93,p.z],.023,m.amber);
      bar(doorRoot,'接力扶手支架-'+name,[p.x,1.45,sign*.24],[p.x,1.45,p.z],.017,m.metal);
    }
    // Contained sample workstation. Its handle is a concrete interaction target.
    const sample=new T.Group();sample.name='密封样本柜';sample.position.set(-1.78,0,-3.20);equipment.add(sample);
    rounded(sample,'样本柜下机箱',m.dark,[1.10,1.16,.73],[0,.725,0],.05);
    rounded(sample,'样本柜上机箱',m.dark,[1.10,.49,.73],[0,2.25,0],.05);
    box(sample,'样本操作腔后壁',m.dark,[1.03,.76,.08],[0,1.65,.19]);
    for(const x of [-.50,.50])box(sample,'样本操作腔侧柱',m.ivory,[.11,.76,.73],[x,1.65,0]);
    rounded(sample,'样本柜下装甲',m.ivory,[1.03,1.05,.09],[0,.76,.39],.035);
    rounded(sample,'样本柜上装甲',m.ivory,[1.03,.41,.09],[0,2.25,.39],.035);
    box(sample,'柜内凹入样本托架',m.metal,[.95,.055,.16],[0,1.19,.23]);
    for(const x of [-.29,0,.29]){part(sample,'样本密封瓶',m.glass,cylinderGeo,[.065,.28,.065],[x,1.52,.36]);part(sample,'瓶盖',m.metal,cylinderGeo,[.07,.035,.07],[x,1.675,.36]);sphere(sample,'样本状态灯',m.cyan,[.018,.018,.008],[x,1.76,.23]);}
    bar(sample,'样本柜操作把手',[-.36,1.10,.48],[.36,1.10,.48],.023,m.amber);
    panelScreen(sample,'生物样本屏',.77,.35,[0,2.18,.45]);
    const sampleAlert=box(sample,'样本泄露告警条',m.red.clone(),[.77,.045,.022],[0,1.98,.46]);materials.push(sampleAlert.material);sampleAlert.material.emissiveIntensity=0;
    placard(sample,'SAMPLE  06','封闭操作 · LOCAL CONTAINMENT',[.76,.20],[0,.67,.45],0,'#d8ba80');
    targets.sampleHandle=new T.Vector3(-1.78,1.10,-2.697);targets.sampleLatch=new T.Vector3(-1.42,1.44,-2.7025);targets.sampleWork=new T.Vector3(-1.78,1.65,-2.73);
    collider('样本柜',-1.78,-3.2,1.12,.77,1.32,2.35);
    const sampleDoor=new T.Group();sampleDoor.name='样本门铰链';sampleDoor.position.set(-.445,1.65,.49);sample.add(sampleDoor);
    rounded(sampleDoor,'样本门透明盖',m.glass,[.81,.68,.018],[.445,0,0],.01);
    for(const x of [0,.89])box(sampleDoor,'样本门竖框',m.metal,[.04,.76,.045],[x,0,0]);
    for(const y of [-.36,.36])box(sampleDoor,'样本门横框',m.metal,[.89,.04,.045],[.445,y,0]);
    rounded(sampleDoor,'样本门锁扣',m.amber,[.08,.12,.035],[.805,-.21,-.01],.01);
    const tetherCanister=rounded(sample,'应急吸附盒',m.dark,[.22,.22,.12],[.34,1.10,.45],.025);
    // A sealed sampling socket gives the science/engineering tool a real endpoint.
    part(sample,'样本隔膜采样接口',m.metal,cylinderGeo,[.065,.035,.065],[.53,1.85,.49],[Math.PI/2,0,0]);
    part(sample,'采样接口密封膜',m.screen,cylinderGeo,[.040,.037,.040],[.53,1.85,.492],[Math.PI/2,0,0]);
    targets.samplePort=new T.Vector3(-1.25,1.85,-2.6895);
    // Care station has restraints and grips, not an Earth chair standing on the floor.
    const care=new T.Group();care.name='失重护理固定站';care.position.set(-1.72,0,3.15);equipment.add(care);
    rounded(care,'护理墙安装架',m.metal,[.85,2.45,.24],[0,1.42,0],.055);
    rounded(care,'躯干支承垫',m.padding,[.62,1.12,.16],[0,1.60,-.20],.08);rounded(care,'头部固定垫',m.padding,[.48,.34,.18],[0,2.29,-.21],.075);
    rounded(care,'髋部定位垫',m.padding,[.60,.20,.13],[0,.95,-.17],.04);
    for(const y of [1.23,1.86])box(care,'柔性固定束带',m.dark,[.66,.065,.035],[0,y,-.31]);
    for(const side of [-1,1]){bar(care,'护理位抓握扶手',[side*.46,1.35,-.38],[side*.46,1.96,-.38],.025,m.amber);bar(care,'护理扶手安装件',[side*.46,1.35,-.03],[side*.46,1.35,-.38],.018,m.metal);}
    panelScreen(care,'生命体征监测',.58,.43,[.75,1.94,-.1],Math.PI);placard(care,'CARE  02','RESTRAINT / ASSISTED TRANSFER',[.68,.19],[0,2.68,-.13],Math.PI,'#9addca');
    targets.careGrip=new T.Vector3(-1.26,1.66,2.77);targets.careGripLeft=new T.Vector3(-2.18,1.66,2.77);targets.carePatient=new T.Vector3(-1.72,.63,2.45);targets.careMonitor=new T.Vector3(-.97,1.94,3.02);
    collider('护理固定站',-1.72,3.15,.85,.40,1.42,2.45);
    const key=new T.DirectionalLight('#e8f2ff',1.1);key.position.set(2,7,5);lighting.add(key);
    const fill=new T.HemisphereLight('#b5d4e9','#1b252d',.55);lighting.add(fill);
    const labLight=new T.PointLight('#d9bb8b',1.15,7),careLight=new T.PointLight('#9dd7e4',1.15,7),alarmLight=new T.PointLight('#ec503b',0,6),doorLight=new T.PointLight('#a8d4df',.45,3.7);
    labLight.position.set(-.3,3.08,-2.9);careLight.position.set(.2,3.08,2.65);alarmLight.position.set(-.4,2.78,-1.9);doorLight.position.set(0,3.07,.65);lighting.add(labLight,careLight,alarmLight,doorLight);
    const lights={key,fill,lab:labLight,care:careLight,alarm:alarmLight,door:doorLight};
    let alarm=0;
    function setDoor(value){const amount=clamp(value,0,1);door.openAmount=amount;door.clearWidth=Math.min(1.65,amount*1.76);door.closed=amount<.005;door.leaves.forEach((leaf,i)=>{const sign=i?1:-1;leaf.position.x=sign*(.4125+.88*amount);door.colliders[i].x=leaf.position.x;});const free=amount>.97;statusMaterial.color.set(free?'#82d6b4':'#ec6c53');statusMaterial.emissive.set(free?'#48ba91':'#e84432');statusMaterial.emissiveIntensity=free?.65:.8;return amount;}
    function setAlarm(value){alarm=clamp(value,0,1);}
    function update(time,state={}){
      if(Number.isFinite(state.doorOpen))setDoor(state.doorOpen);if(Number.isFinite(state.alarm))setAlarm(state.alarm);
      const pulse=.58+.42*Math.sin(time*5);alarmLight.intensity=alarm*(.35+pulse*.8);sampleAlert.material.emissiveIntensity=alarm*(.35+pulse*1.2);sampleAlert.visible=alarm>.01;
      labLight.intensity=1.15-alarm*.35;doorLight.color.set(door.openAmount>.97?'#8ee1c7':alarm>.2?'#e9a16d':'#a8d4df');
      if(state.contained){sampleAlert.visible=true;sampleAlert.material.color.set('#82d6b4');sampleAlert.material.emissive.set('#48ba91');sampleAlert.material.emissiveIntensity=.55;}
      sampleDoor.rotation.y=state.sampleFault?-.14*Math.min(1,(time%100)/2):0;
    }
    setDoor(0);root.updateMatrixWorld(true);
    // The 12-view film reuses the same set. Batch fixed opaque details by material,
    // retaining their exact original surfaces for mesh-level clearance inspection.
    const surfaceMeshes=[...borrowedSurfaces],batches=new Map(),moving=new Set([...door.leaves,sampleDoor]);
    root.traverse(mesh=>{
      if(!mesh.isMesh||mesh.isInstancedMesh)return;surfaceMeshes.push(mesh);if(mesh.userData.filmBorrowed)return;
      let parent=mesh;while(parent){if(moving.has(parent))return;parent=parent.parent;}
      if(mesh.material.transparent||mesh.material===statusMaterial||mesh===sampleAlert||mesh===button||mesh.geometry.type==='PlaneGeometry')return;
      const group=batches.get(mesh.material)||[];group.push(mesh);batches.set(mesh.material,group);
    });
    let batchedMeshes=0;
    for(const [mat,meshes]of batches){
      if(meshes.length<2)continue;
      const chunks=meshes.map(mesh=>{const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();g.applyMatrix4(mesh.matrixWorld);return g;}),geometry=own(new T.BufferGeometry());
      for(const name of ['position','normal','uv']){
        const first=chunks[0].getAttribute(name);if(!first||chunks.some(g=>!g.getAttribute(name)))continue;
        const array=new Float32Array(chunks.reduce((sum,g)=>sum+g.getAttribute(name).array.length,0));let offset=0;
        for(const chunk of chunks){const attribute=chunk.getAttribute(name);array.set(attribute.array,offset);offset+=attribute.array.length;}
        geometry.setAttribute(name,new T.BufferAttribute(array,first.itemSize));
      }
      geometry.computeBoundingBox();geometry.computeBoundingSphere();const merged=new T.Mesh(geometry,mat);merged.name='合并固定布景-'+batchedMeshes++;merged.castShadow=true;merged.receiveShadow=true;root.add(merged);
      for(const mesh of meshes){mesh.parent.remove(mesh);mesh.userData.filmStaticSurface=true;}
      for(const chunk of chunks)chunk.dispose();
    }
    return{root,hull,roof,equipment,door,targets,lights,colliders,surfaceMeshes,batchedMeshes,reuse,sourceToFilm,cutaway,setCutaway:cutaway,sample:{root:sample,door:sampleDoor,alert:sampleAlert,canister:tetherCanister},care,controls,button,bounds:{minX:-2.6,maxX:2.6,minZ:-5.15,maxZ:5.15},height:H,setDoor,setAlarm,update,
      dispose(){root.parent?.remove(root);for(const g of new Set(geometries))g.dispose();for(const mat of new Set(materials))mat.dispose();for(const texture of new Set(textures))texture.dispose();}
    };
  };
})();
