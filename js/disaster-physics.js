/* Progressive, top-down rigid-body fractures with a residual podium and separate dust/debris. Rapier runs a fixed 60 Hz step;
 * concrete slabs, facade panels and interior fragments collide and settle.
 * This is a game model, not a structural engineering solver. */
(() => {
 'use strict';const L=window.IndoorLab,T=THREE;
 class DisasterPhysics {
  constructor(director){this.d=director;this.b=director.b;this.v=this.b.view;this.destroyedFloors=new Set();this.items=[];this.saved=[];this.solidState=new Map();this.agentState=new Map();this.time=0;this.accumulator=0;this.steps=0;this.queue=[];this.batches=[];this.pose=new T.Object3D();this.group=new T.Group();this.group.name='灾害 · 刚体结构碎片';this.group.userData.noAO=true;this.v.scene.add(this.group);this.maxBodies=1024;this.hiddenInstances=new Set();this.batchMap=new Map();this.failedPatches=0;this.impactDustAt=0;}
  async prepare(){if(this.world)return;if(this.preparing)return this.preparing;this.preparing=this.initialize();try{return await this.preparing;}finally{this.preparing=null;}}
  async initialize(){
   if(this.world)return;const R=await import(new URL('js/vendor/rapier/rapier.mjs',document.baseURI).href);await R.init();if(this.disposed)return;this.R=R;this.world=new R.World({x:0,y:-9.81,z:0});this.world.timestep=1/60;this.world.integrationParameters.numSolverIterations=5;
   this.world.createCollider(R.ColliderDesc.cuboid(150,.4,150).setTranslation(0,-1.22,0).setFriction(.85));this.slabs=new Map();
   for(let f=1;f<=30;f++){const colliders=[];for(const[w,d,x,z]of L.towerSlabTiles)colliders.push(this.world.createCollider(R.ColliderDesc.cuboid(w/2,.11,d/2).setTranslation(x,(f-1)*3.6-.11,z).setFriction(.72)));this.slabs.set(f,colliders);}
   this.b.continuous.build();
   this.templates=L.fractureCells(new T.Vector3(1,1,1),8,197).map(cell=>{const geometry=cell.geometry;geometry.scale(1/cell.size.x,1/cell.size.y,1/cell.size.z);const p=geometry.attributes.position;geometry.computeBoundingBox();const center=geometry.boundingBox.getCenter(new T.Vector3());geometry.translate(-center.x,-center.y,-center.z);return geometry;});
   this.boxGeometry=new T.BoxGeometry(1,1,1);for(let material=0;material<5;material++)for(let variant=0;variant<=this.templates.length;variant++){const mesh=new T.InstancedMesh(variant===this.templates.length?this.boxGeometry:this.templates[variant],new T.MeshStandardMaterial({color:['#878176','#b7b4aa','#646765','#8b6847','#92cfed'][material],roughness:material===4?.16:.96,transparent:material===4,opacity:material===4?.6:1,depthWrite:material!==4}),this.maxBodies);mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(mesh);this.batchMap.set(material+':'+variant,this.batches.length);this.batches.push(mesh);}
   for(const mesh of this.batches){mesh.material.color.convertSRGBToLinear();mesh.material.envMapIntensity=.22;mesh.material.userData.styleLocked=true;}
   this.vfx=new L.CollapseVFX(this.group,()=>this.d.random());
  }
  get engine(){return this.R?'Rapier '+this.R.version():'未初始化';}
  piece(f,position,size,material,impulse,spin,box=false){
   if(this.items.length>=this.maxBodies)return;const R=this.R,mass=Math.max(.3,size.x*size.y*size.z*(material===0?700:120));
   const body=this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(position.x,position.y,position.z).setLinearDamping(.16).setAngularDamping(.28).setCanSleep(true).setCcdEnabled(true));
   const variant=box?this.templates.length:this.items.length%this.templates.length,geometry=box?this.boxGeometry:this.templates[variant];let collider;if(material===0&&!box){const source=geometry.attributes.position.array,vertices=new Float32Array(source.length);for(let i=0;i<vertices.length;i+=3){vertices[i]=source[i]*size.x;vertices[i+1]=source[i+1]*size.y;vertices[i+2]=source[i+2]*size.z;}collider=R.ColliderDesc.convexHull(vertices);}collider??=R.ColliderDesc.cuboid(Math.max(.025,size.x/2),Math.max(.025,size.y/2),Math.max(.025,size.z/2));this.world.createCollider(collider.setMass(mass).setFriction(.82).setRestitution(.025),body);
   body.setLinvel(impulse,true);body.setAngvel(spin,true);const item={body,size,material,floor:f,batch:this.batchMap.get(material+':'+variant),birth:this.time,dust:false};this.items.push(item);return item;
  }
  models(f){return [...new Set([this.b.society.model(f),this.b.plates[f-1].model,this.b.continuous.models[f-1],L.app.model])].filter(m=>m?.towerFloor===f);}
  hideInstance(mesh,index){
   this.heatHidden??=new Set();const key=mesh.uuid+':'+index;if(this.heatHidden.has(key))return;this.heatHidden.add(key);this.hiddenInstances.add(key);
   const matrix=new T.Matrix4();mesh.getMatrixAt(index,matrix);this.saved.push(()=>{mesh.setMatrixAt(index,matrix);mesh.instanceMatrix.needsUpdate=true;});mesh.setMatrixAt(index,new T.Matrix4().makeScale(0,0,0));mesh.instanceMatrix.needsUpdate=true;
  }
  thermalDamage(f,{furniture=false}={}){
   if(!this.world||this.disposed||this.destroyedFloors.has(f)||this.items.length>360)return;
   const base=(f-1)*3.6,matrix=new T.Matrix4(),local=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),size=new T.Vector3();let chosen;
   for(const batch of this.b.towerBatches){if(!batch.material.transparent)continue;for(const item of batch.items){if(!item.facade||item.plate.group.userData.floor!==f||this.hiddenInstances.has(item.source.uuid+':'+item.index))continue;
     if(item.source.isInstancedMesh)item.source.getMatrixAt(item.index,local);else local.copy(item.source.matrix);matrix.multiplyMatrices(item.relative,local);matrix.decompose(position,rotation,size);
     if(size.y>1&&Math.min(size.x,size.z)<.4&&(position.z>10||position.x>15)){chosen={item,p:position.clone(),q:rotation.clone(),size:size.clone()};break;}
    }if(chosen)break;}
   if(chosen){const {item,p,size}=chosen;if(item.source.isInstancedMesh)this.hideInstance(item.source,item.index);else{const scale=item.source.scale.clone();this.saved.push(()=>item.source.scale.copy(scale));item.source.scale.setScalar(0);this.hiddenInstances.add(item.source.uuid+':'+item.index);}
    const normal=Math.abs(p.x)>16?{x:Math.sign(p.x),z:0}:{x:0,z:Math.sign(p.z)},vertical=Math.abs(p.x)>16;
    for(let i=0;i<6;i++){const y=p.y+(i%3-1)*size.y*.25,along=(Math.floor(i/3)-.5)*Math.max(size.x,size.z)*.45,at={x:p.x+(vertical?0:along),y:base+y,z:p.z+(vertical?along:0)};this.piece(f,at,new T.Vector3(vertical?.07:Math.max(.2,size.x*.45),Math.max(.2,size.y*.32),vertical?Math.max(.2,size.z*.45):.07),4,{x:normal.x*(1.2+this.d.random()),y:-.6,z:normal.z*(1.2+this.d.random())},{x:this.d.random()*2,y:.6,z:this.d.random()*2});}
    this.thermalGlass=(this.thermalGlass||0)+1;
    for(const model of this.models(f)){const bounds={x:p.x,z:p.z,y:p.y,w:Math.max(size.x,.2),h:size.y,d:Math.max(size.z,.2)};model.destroyedBounds??=[];model.destroyedBounds.push(bounds);this.saved.push(()=>{const i=model.destroyedBounds.indexOf(bounds);if(i>=0)model.destroyedBounds.splice(i,1);});model.physicsVersion=(model.physicsVersion||0)+1;}
   }
   if(furniture){
    this.heatFurniture??=new Set();const model=this.b.society.model(f),part=model.layoutItems.find(p=>!p.destroyed&&p.assemblyId&&!this.heatFurniture.has(f+':'+p.assemblyId)&&['desk','wood','fabric'].includes(p.key)),parts=part?model.layoutItems.filter(p=>p.assemblyId===part.assemblyId&&!p.destroyed):[];
    if(part){this.heatFurniture.add(f+':'+part.assemblyId);for(const p of parts.slice(0,10)){
      for(const copy of this.models(f)){copy.group.traverse(mesh=>{if(!mesh.isInstancedMesh)return;const data=mesh.userData.instanceMetadata||[];for(let i=0;i<data.length;i++){const q=data[i];if(q.assemblyId===p.assemblyId&&q.key===p.key&&Math.hypot(q.x-p.x,q.z-p.z)<.03&&Math.abs(q.y-p.y)<.03)this.hideInstance(mesh,i);}});
       for(const solid of copy.layoutItems)if(solid.assemblyId===p.assemblyId){if(!this.solidState.has(solid))this.solidState.set(solid,solid.destroyed);solid.destroyed=true;}copy.physicsVersion=(copy.physicsVersion||0)+1;
      }
      this.piece(f,{x:p.x,y:base+p.y,z:p.z},new T.Vector3(p.w,p.h,p.d),3,{x:.3,y:0,z:.25},{x:.35,y:.12,z:1.3},true);
     }this.thermalObjects=(this.thermalObjects||0)+1;}
   }
   this.b.society.grids.delete(f);this.v.firstPerson.collisionModel=null;this.b.updateTowerBatches(true);this.v.shadowDirty=true;
  }
  facadeTarget(normal,preferred){
   const local=new T.Matrix4(),matrix=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),size=new T.Vector3();let nearest=null,distance=Infinity;
   for(const batch of this.b.towerBatches)for(const item of batch.items){const f=item.plate.group.userData.floor;if(this.destroyedFloors.has(f)||this.hiddenInstances.has(item.source.uuid+':'+item.index))continue;
    const glass=batch.material===this.b.towerMaterials.glass||item.source.userData.instanceMetadata?.[item.index]?.key==='glass';
    if(item.source.isInstancedMesh)item.source.getMatrixAt(item.index,local);else{item.source.updateMatrix();local.copy(item.source.matrix);}matrix.multiplyMatrices(item.relative,local);matrix.decompose(p,q,size);
    if(normal.x?Math.abs(p.x-normal.x*18)>1:Math.abs(p.z-normal.z*13)>1)continue;
    if(size.length()<.04||Math.min(Math.abs(size.x),Math.abs(size.z))>.7||(!glass&&(Math.max(Math.abs(size.x),Math.abs(size.z))>=6||Math.abs(size.y)>=5)))continue;
    const point=p.clone();point.y+=(f-1)*3.6;point.addScaledVector(normal,(normal.x?Math.abs(size.x):Math.abs(size.z))/2);
    // Keep the hit inside this real facade element while varying the mark.
    if(normal.x)point.z=L.clamp(preferred.z,point.z-Math.abs(size.z)*.45,point.z+Math.abs(size.z)*.45);else point.x=L.clamp(preferred.x,point.x-Math.abs(size.x)*.45,point.x+Math.abs(size.x)*.45);
    point.y=L.clamp(preferred.y,point.y-Math.abs(size.y)*.42,point.y+Math.abs(size.y)*.42);
    const d=point.distanceToSquared(preferred)+(glass?0:2000);if(d<distance){distance=d;nearest=point;}
   }return nearest;
  }
  facadeImpact(point,normal,intensity=.8,contactRadius=.7){
   if(!this.world||this.disposed)return {glass:0,panels:0};
   const f=L.clamp(Math.floor(point.y/3.6)+1,1,30);if(this.destroyedFloors.has(f))return {glass:0,panels:0};
   const base=(f-1)*3.6,matrix=new T.Matrix4(),local=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),size=new T.Vector3(),candidates=[];
   for(const batch of this.b.towerBatches)for(const item of batch.items){
    if(item.plate.group.userData.floor!==f||this.hiddenInstances.has(item.source.uuid+':'+item.index))continue;
    if(item.source.isInstancedMesh)item.source.getMatrixAt(item.index,local);else{item.source.updateMatrix();local.copy(item.source.matrix);}matrix.multiplyMatrices(item.relative,local);matrix.decompose(p,q,size);
    if(size.length()<.04||Math.min(Math.abs(size.x),Math.abs(size.z))>.7)continue;
    const face=normal.x?Math.abs(p.x-normal.x*18)<1:Math.abs(p.z-normal.z*13)<1;if(!face)continue;
    const glass=batch.material===this.b.towerMaterials.glass||item.source.userData.instanceMetadata?.[item.index]?.key==='glass',short=Math.max(size.x,size.z)<6&&size.y<5;if(!glass&&!short)continue;
    const dx=Math.max(0,Math.abs(point.x-p.x)-size.x/2),dy=Math.max(0,Math.abs(point.y-base-p.y)-size.y/2),dz=Math.max(0,Math.abs(point.z-p.z)-size.z/2),distance=dx*dx+dy*dy+dz*dz;
    if(distance>16)continue;candidates.push({item,p:p.clone(),size:size.clone(),glass,distance});
   }
   // Recheck actual contact: a different giant may already have removed this element.
   if(!candidates.some(c=>c.distance<=(contactRadius+.08)**2))return {glass:0,panels:0,floor:f};
   candidates.sort((a,b)=>a.distance-b.distance);const selected=[],glass=candidates.find(c=>c.glass),panel=candidates.find(c=>!c.glass);if(glass)selected.push(glass);if(panel)selected.push(panel);
   let glassCount=0,panels=0;this.impactItems??=[];
   for(const c of selected){const source=c.item.source,meta=source.userData.instanceMetadata?.[c.item.index],key=meta?.key||Object.entries(this.b.towerMaterials).find(([,m])=>m===source.material)?.[0]||source.name;
    const matches=part=>c.glass?part.key==='glass'&&(normal.x?part.x*normal.x>17:part.z*normal.z>12):meta&&part.key===key&&Math.hypot(part.x-meta.x,part.z-meta.z)<.1;
    if(source.isInstancedMesh)this.hideInstance(source,c.item.index);else{const prior=source.scale.clone();this.saved.push(()=>source.scale.copy(prior));source.scale.setScalar(0);this.hiddenInstances.add(source.uuid+':'+c.item.index);}
    // Keep the batched overview, full floors, navigation and first-person
    // facade in agreement, and retain exact originals for scene restoration.
    for(const model of this.models(f)){
     model.group.traverse(mesh=>{if(!mesh.isInstancedMesh)return;const data=mesh.userData.instanceMetadata||[];for(let i=0;i<data.length;i++)if(matches(data[i]))this.hideInstance(mesh,i);});
     for(const part of [...model.layoutItems,...(model.shellItems||[])])if(matches(part)){if(!this.solidState.has(part))this.solidState.set(part,part.destroyed);part.destroyed=true;}
     model.physicsVersion=(model.physicsVersion||0)+1;model.aoVersion=(model.aoVersion||0)+1;
    }
    // Local broken patches and frames, with outward impulse and gravity. Do not
    // invoke a whole-floor explosion or the building-collapse sequence.
    const count=c.glass?10:5;for(let i=0;i<count;i++){
     while(this.impactItems.length>=220){const old=this.impactItems.shift(),at=this.items.indexOf(old);if(at>=0){this.items.splice(at,1);this.world.removeRigidBody(old.body);}}
     const tangent=new T.Vector3(-normal.z,0,normal.x),spread=c.glass?3:Math.min(1,Math.max(c.size.x,c.size.z)*.3),at={x:c.p.x+tangent.x*(this.d.random()-.5)*spread,y:base+c.p.y+(this.d.random()-.5)*Math.min(c.size.y,2.4),z:c.p.z+tangent.z*(this.d.random()-.5)*spread};
     const dims=c.glass?new T.Vector3(normal.x?.055:.3+this.d.random()*.6,.25+this.d.random()*.55,normal.z?.055:.3+this.d.random()*.6):new T.Vector3(Math.max(.08,Math.min(.6,c.size.x)),Math.min(.7,c.size.y/2),Math.max(.08,Math.min(.6,c.size.z)));
     const fragment=this.piece(f,at,dims,c.glass?4:1,{x:normal.x*(1+intensity*2)+tangent.x*(this.d.random()-.5),y:-.3-this.d.random(),z:normal.z*(1+intensity*2)+tangent.z*(this.d.random()-.5)},{x:(this.d.random()-.5)*3,y:this.d.random(),z:(this.d.random()-.5)*3});if(fragment)this.impactItems.push(fragment);
    }
    if(c.glass)glassCount++;else panels++;
   }
   if(!selected.length)return {glass:0,panels:0,floor:f};
   this.vfx.burst(point,.65+intensity*.25);this.impactDamage=(this.impactDamage||0)+selected.length;this.d.impactShake={at:this.d.time,intensity:Math.min(.04,intensity*.025)};
   this.b.society.grids.delete(f);this.v.firstPerson.collisionModel=null;this.b.updateTowerBatches(true);this.v.shadowDirty=true;
   return {glass:glassCount,panels,floor:f};
  }
  hideFloor(f){
   if(this.destroyedFloors.has(f))return;this.destroyedFloors.add(f);
   for(const c of this.slabs.get(f)||[])if(c.isValid())this.world.removeCollider(c,true);
   for(const model of this.models(f)){
    model.group.traverse(o=>{if(!o.isMesh)return;if(o.isInstancedMesh){const array=o.instanceMatrix.array.slice();this.saved.push(()=>{o.instanceMatrix.array.set(array);o.instanceMatrix.needsUpdate=true;});o.instanceMatrix.array.fill(0);o.instanceMatrix.needsUpdate=true;}else{const scale=o.scale.clone();this.saved.push(()=>o.scale.copy(scale));o.scale.setScalar(0);}});
    for(const solid of [...model.layoutItems,...(model.shellItems||[]),...(model.dynamicSolids||[])]){if(!this.solidState.has(solid))this.solidState.set(solid,solid.destroyed);solid.destroyed=true;}
    model.physicsVersion=(model.physicsVersion||0)+1;model.aoVersion=(model.aoVersion||0)+1;
   }
   for(const a of this.b.society.agents)if(Math.round(a.floor)===f&&!L.isOutdoorAgent(a)&&a.location!=='escaped'){
    L.killDisasterAgent?.(a,'楼层坍塌导致死亡',this,true);
   }
   this.b.society.grids.delete(f);this.v.firstPerson.collisionModel=null;this.b.updateTowerBatches(true);this.v.shadowDirty=true;
  }
  shedFacade(f){
   if(this.destroyedFloors.has(f))return;let hidden=0;const matrix=new T.Matrix4(),local=new T.Matrix4();
   for(const batch of this.b.towerBatches)for(const item of batch.items){if(!item.facade||item.plate.group.userData.floor!==f)continue;if(item.source.isInstancedMesh)item.source.getMatrixAt(item.index,local);else local.copy(item.source.matrix);matrix.multiplyMatrices(item.relative,local);const x=matrix.elements[12],z=matrix.elements[14];if(x>12||z>10&&x>0){this.hiddenInstances.add(item.source.uuid+':'+item.index);hidden++;}}
   this.failedPatches+=hidden;this.b.updateTowerBatches(true);const base=(f-1)*3.6;
   for(let i=0;i<6;i++){const p={x:18.6+(this.d.random()-.5),y:base+.4+this.d.random()*2.8,z:-10+i*4};this.piece(f,p,new T.Vector3(.25,.8+this.d.random(),1.4),1,{x:1+this.d.random(),y:-.4,z:1},{x:.2,y:.2,z:.5});}
   this.vfx.burst({x:18,y:base+2,z:5},.7);
  }
  destroyFloor(f,{blast=false,intensity=1}={}){
   if(this.destroyedFloors.has(f))return;const base=(f-1)*3.6,random=()=>this.d.random();
   const parts=this.b.society.model(f).layoutItems.filter(p=>!p.destroyed&&!p.ignore&&p.key!=='floor'&&p.w*p.h*p.d>.08&&p.w<5&&p.d<5),interior=[],count=Math.min(blast?28:3,parts.length);for(let i=0;i<count;i++)interior.push(parts[Math.floor(i*parts.length/count)]);
   this.hideFloor(f);
   const velocity=p=>{const radial=blast?3.5+intensity*2:.5;return{x:(blast?p.x/18:1.2)*radial+(random()-.5)*1.4,y:blast?1+random()*intensity*2:-.3-random()*.6,z:(blast?p.z/13:.6)*radial+(random()-.5)};};
   // Smaller irregular slab segments replace the old room-sized flat sheets.
   for(let x=0;x<6;x++)for(let z=0;z<4;z++){const p={x:-15+x*6+(random()-.5)*.6,y:base-.12,z:-9.75+z*6.5+(random()-.5)*.5};this.piece(f,p,new T.Vector3(4.5+random()*.9,.32+random()*.16,4.9+random()),0,velocity(p),{x:(random()-.5)*.4,y:(random()-.5)*.3,z:(random()-.5)*.5});}
   for(let i=0;i<4;i++){const p={x:i%2?18:-18,y:base+1.3,z:i<2?-7:7};this.piece(f,p,new T.Vector3(.5,2.4,3+random()),1,velocity(p),{x:.2,y:.15,z:(random()-.5)*.7});}
   for(const p of interior){const at={x:p.x,y:base+p.y,z:p.z};this.piece(f,at,new T.Vector3(p.w,p.h,p.d),p.key==='desk'||p.key==='wood'?3:2,velocity(at),{x:(random()-.5),y:(random()-.5),z:(random()-.5)});}
   for(const p of [{x:18,z:8},{x:-17,z:-7},{x:10,z:13},{x:-9,z:-13}])this.vfx.burst({...p,y:base+1.6},blast?1.4:1);
   if(blast)this.d.pulse({x:0,y:base+1.5,z:0},intensity);
  }
  releaseCrown(){
   if(this.cap)return;const R=this.R,source=this.b.crown,copy=source.clone(true);copy.position.set(0,0,0);this.group.add(copy);const visible=source.visible;this.saved.push(()=>source.visible=visible);source.visible=false;
   const body=this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0,108.1,0).setLinearDamping(.09).setAngularDamping(.16).setCcdEnabled(true));this.world.createCollider(R.ColliderDesc.cuboid(17.6,1.7,12.6).setTranslation(0,1.7,0).setMass(42000).setFriction(.6),body);body.setLinvel({x:5.7,y:.1,z:2.1},true);body.setAngvel({x:.12,y:0,z:-.25},true);this.cap={mesh:copy,body,impact:false,birth:this.time};this.vfx.burst({x:16,y:108,z:9},1.4);
  }
  async explosion(f,intensity){await this.prepare();this.destroyFloor(f,{blast:true,intensity});this.d.b.reactions.frighten({x:0,y:(f-1)*3.6,z:0},{radius:28,reason:f+'层发生爆炸'});return this.summary();}
  async quake(intensity,collapse){await this.prepare();this.quakeState={start:this.time,duration:16,intensity};if(collapse){this.queue=[];this.residualFloors=3;for(let f=30;f>this.residualFloors;f--){const at=this.time+1.9+(30-f)*.29+this.d.random()*.11;this.queue.push({kind:'patch',floor:f,at:at-.7},{kind:'floor',floor:f,at});}this.queue.push({kind:'crown',at:this.time+1.2});this.queue.sort((a,b)=>a.at-b.at);const shaft=this.b.continuous.shaft;if(shaft){const prior=shaft.visible;this.saved.push(()=>shaft.visible=prior);shaft.visible=false;}}}
  advance(dt){
   this.time+=dt;
   if(this.quakeState&&this.time>=this.quakeState.start+this.quakeState.duration)this.quakeState=null;
   // Limit structural releases to one floor per rendered frame.
   for(let n=0;n<2&&this.queue[0]?.at<=this.time;n++){const event=this.queue.shift();if(event.kind==='crown')this.releaseCrown();else if(event.kind==='patch')this.shedFacade(event.floor);else this.destroyFloor(event.floor);}
   if(this.crownAt&&this.time>=this.crownAt){this.b.crown.scale.setScalar(0);this.crownAt=0;}
   if(this.cap&&this.time-this.cap.birth<3.2){const mass=this.cap.body.mass();this.cap.body.applyTorqueImpulse({x:mass*18*dt,y:0,z:-mass*50*dt},true);this.cap.body.applyImpulse({x:mass*1.5*dt,y:0,z:mass*.35*dt},true);}
   this.accumulator+=dt;while(this.accumulator>=1/60-1e-9){this.world.step();this.steps++;this.accumulator=Math.max(0,this.accumulator-1/60);}
   if(this.time>=(this.nextCrushCheck||0)){this.nextCrushCheck=this.time+.12;this.crushPeople();}
   if(this.residualFloors&&!this.queue.length&&!this.collapseComplete){this.collapseComplete=true;for(const a of this.b.society.agents)if(!L.isOutdoorAgent(a)&&a.location!=='escaped')L.killDisasterAgent?.(a,'整楼坍塌，被结构掩埋',this,true);}
  }
  update(dt){
   if(!this.world||!Number.isFinite(dt)||dt<=0)return;
   // The coordinator has already applied simulation speed. Consume all of
   // that time in bounded steps, then upload debris transforms once.
   for(let remaining=dt;remaining>1e-9;){const step=Math.min(.1,remaining);this.advance(step);this.vfx.update(step);remaining-=step;}
   const alpha=this.accumulator*60;this.batchCounts??=new Uint16Array(this.batches.length);const counts=this.batchCounts;counts.fill(0);this.syncFrame();
   for(const item of this.items){const p=item.body.translation(),q=item.body.rotation(),v=item.body.linvel();this.pose.position.set(p.x+v.x*alpha/60,p.y+v.y*alpha/60,p.z+v.z*alpha/60);this.pose.quaternion.set(q.x,q.y,q.z,q.w);this.pose.scale.copy(item.size);this.pose.updateMatrix();this.batches[item.batch].setMatrixAt(counts[item.batch]++,this.pose.matrix);if(!item.dust&&p.y<5&&this.time-item.birth>.7&&this.time>=this.impactDustAt){item.dust=true;this.impactDustAt=this.time+.05;this.vfx.burst({x:p.x,y:Math.max(0,p.y),z:p.z},1.1,true);}}
   this.batches.forEach((mesh,i)=>{mesh.count=counts[i];mesh.instanceMatrix.needsUpdate=true;});
   if(this.cap){const p=this.cap.body.translation(),q=this.cap.body.rotation();this.cap.mesh.position.set(p.x,p.y,p.z);this.cap.mesh.quaternion.set(q.x,q.y,q.z,q.w);if(!this.cap.impact&&p.y<5){this.cap.impact=true;for(let i=0;i<7;i++)this.vfx.burst({x:p.x+(this.d.random()-.5)*24,y:0,z:p.z+(this.d.random()-.5)*20},2,true);}}
  }
  syncFrame(){L.syncDisasterFrame(this.group,this.b);}
  summary(){return{engine:this.engine,bodies:this.items.length,steps:this.steps,destroyedFloors:[...this.destroyedFloors],residualFloors:this.residualFloors||0,failedFacadeInstances:this.failedPatches,dust:this.vfx?.count||0,fineDebris:this.vfx?.fragments.length||0,thermalGlass:this.thermalGlass||0,thermalObjects:this.thermalObjects||0,fractureVariants:this.templates?.length||0};}
  blocks(x,z,feet){
   if(!this.world)return false;let blocked=false;this.world.intersectionsWithShape({x,y:feet+.93,z},{x:0,y:0,z:0,w:1},new this.R.Capsule(.6,.24),collider=>{if(collider.parent()?.isDynamic()){blocked=true;return false;}return true;});return blocked;
  }
  crushPeople(){
   if(!this.items.length&&!this.cap)return;const s=this.b.society;this.crushShape??=new this.R.Capsule(.42,.23);
   for(const a of s.agents){if(a.health==='dead')continue;const feet=s.bodies.feet(a);if(!Number.isFinite(feet))continue;let hit=false;
    this.world.intersectionsWithShape({x:a.x,y:feet+.7,z:a.z},{x:0,y:0,z:0,w:1},this.crushShape,collider=>{const body=collider.parent();if(!body?.isDynamic())return true;const v=body.linvel(),energy=body.mass()*(v.x*v.x+v.y*v.y+v.z*v.z);if(body.mass()>40||energy>80){hit=true;return false;}return true;});
    if(hit)L.killDisasterAgent?.(a,'被坠落构件或坍塌废墟压倒',this,true);
   }
  }
  surface(x,z,feet){
   if(!this.world||!this.destroyedFloors.size)return null;const hit=this.world.castRay(new this.R.Ray({x,y:feet+.305,z},{x:0,y:-1,z:0}),160,false);return hit?feet+.305-hit.timeOfImpact:null;
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.destroyedFloors.clear();this.hiddenInstances.clear();for(const restore of this.saved.reverse())restore();for(const[p,state]of this.solidState)p.destroyed=state;for(const[a,state]of this.agentState)Object.assign(a,state);for(const f of this.slabs?.keys()||[]){this.b.society.grids.delete(f);for(const m of this.models(f)){m.physicsVersion=(m.physicsVersion||0)+1;m.aoVersion=(m.aoVersion||0)+1;}}this.b.updateTowerBatches(true);this.world?.free();this.vfx?.dispose();this.cap?.mesh.parent?.remove(this.cap.mesh);for(const m of this.batches){m.material.dispose();}this.boxGeometry?.dispose();for(const geometry of this.templates||[])geometry.dispose();this.group.parent?.remove(this.group);this.v.firstPerson.collisionModel=null;this.v.shadowDirty=true;}
 }
 L.DisasterPhysics=DisasterPhysics;
})();
