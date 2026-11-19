/* Office instance-aware earthquake adapter. Never release a whole material batch. */
(() => {
 'use strict';const L=window.IndoorLab,T=THREE;
 class OfficeQuakePhysics {
  constructor(view,model,grid,C,{maxBodies=48,maxFragments=96}={}){
   this.view=view;this.model=model;this.grid=grid;this.C=C;this.maxBodies=maxBodies;this.maxFragments=maxFragments;this.records=[];this.fragments=[];this.byId=new Map();this.steps=0;this.impacts=0;this.brokenObjects=0;this.fallenObjects=0;this.original=model.group.position.clone();this.group=new T.Group();this.group.name='地震 · 单件家具与不规则墙体碎片';this.group.userData.noAO=true;view.scene.add(this.group);
   this.world=new C.World({gravity:new C.Vec3(0,-9.81,0)});this.world.broadphase=new C.SAPBroadphase(this.world);this.world.allowSleep=true;this.world.solver.iterations=7;this.world.defaultContactMaterial.friction=.72;this.world.defaultContactMaterial.restitution=.015;
   for(const [w,d,x,z]of L.towerSlabTiles)this.world.addBody(new C.Body({mass:0,shape:new C.Box(new C.Vec3(w/2,.12,d/2)),position:new C.Vec3(x,-.12,z),collisionFilterGroup:1,collisionFilterMask:6}));
   this.collect();this.descriptors=this.records.map(r=>({id:r.id,name:r.name,kind:r.wall?'wall':'furniture',width:r.size.x,height:r.size.y,depth:r.size.z,center:{x:r.center.x,z:r.center.z},fragility:r.wall?.8:r.size.y>1.2?1.05:.62,fracturable:r.wall}));
  }
  indexTargets(copies){
   const lookup=new Map();for(const copy of copies)copy.group.traverse(mesh=>{if(!mesh.isInstancedMesh||!mesh.userData.instanceMetadata)return;mesh.userData.instanceMetadata.forEach((meta,index)=>{
    const matrix=new T.Matrix4();mesh.getMatrixAt(index,matrix);const position=new T.Vector3().setFromMatrixPosition(matrix);
    for(const p of meta.logicalParts||[meta]){const key=[p.key||mesh.name,(p.x??position.x).toFixed(3),(p.z??position.z).toFixed(3),p.name].join('|');let visualOffset;
     if(meta.logicalParts){const semantic=new T.Matrix4().compose(new T.Vector3(p.x,p.y,p.z),new T.Quaternion().setFromEuler(new T.Euler(p.pitch||0,p.rotation||0,0)),new T.Vector3(p.w,p.h,p.d));visualOffset=semantic.invert().multiply(matrix);}
     if(!lookup.has(key))lookup.set(key,[]);lookup.get(key).push({mesh,index,matrix,copy,visualOffset,logicalPart:meta.logicalParts?p:undefined,logicalY:meta.logicalParts?p.y:undefined});}
   });});return lookup;
  }
  targetsFor(p,lookup){const key=[p.key,p.x.toFixed(3),p.z.toFixed(3),p.name].join('|');return(lookup.get(key)||[]).filter(q=>q.logicalPart?['x','y','z','w','h','d','rotation','pitch'].every(k=>Math.abs((q.logicalPart[k]||0)-(p[k]||0))<1e-6):Math.abs(new T.Vector3().setFromMatrixPosition(q.matrix).y-p.y)<.5);}
  collect(){
   const model=this.model,C=this.C,b=L.building,s=b.society,copies=[...new Set([model,s.model(model.towerFloor),L.app.model,...(b.continuous?.models.filter(m=>m.towerFloor===model.towerFloor)||[])])].filter(m=>m?.towerFloor===model.towerFloor);
   this.modelOrigins=new Map(copies.map(copy=>[copy,copy.group.position.clone()]));const lookup=this.indexTargets(copies);
   const groups=new Map();let serial=0;
   for(const p of [...model.layoutItems,...(model.shellItems||[])]){
    if(p.destroyed||p.navigationOnly||['floor','blue','doorTrim','doorPanel','roomGlass','glass','plant'].includes(p.key)||/梯段|楼梯|平台|门框|新风|风管|送风|坐便|洗手台/.test(p.name)||p.y+p.h/2<.04||p.y-p.h/2>2.8)continue;
    const core=Math.abs(p.x)<3.5&&Math.abs(p.z)<3.1,wall=p.wall&&p.h>1.2&&!core&&Math.min(p.w,p.d)<.5;
    if(p.wall&&!wall||!wall&&p.ignore&&!p.assemblyId)continue;
    const key=wall?'wall-'+serial++:p.assemblyId||'object-'+serial++;
    if(!groups.has(key))groups.set(key,{wall,parts:[],name:p.name});groups.get(key).parts.push(p);
   }
   const sets=[];
   for(const group of groups.values()){
    const anchors=group.parts.filter(p=>p.key==='desk'&&p.y>.6&&p.w>1&&p.h<.2);
    if(anchors.length>1){for(const anchor of anchors){const parts=group.parts.filter(p=>anchors.reduce((best,q)=>Math.hypot(p.x-q.x,p.z-q.z)<Math.hypot(p.x-best.x,p.z-best.z)?q:best,anchors[0])===anchor);if(parts.length)sets.push({...group,parts});}}
    else sets.push(group);
   }
   let dynamics=0;
   for(const group of sets){
    const parts=group.parts.map(p=>{const matrix=new T.Matrix4().compose(new T.Vector3(p.x,p.y,p.z),new T.Quaternion().setFromEuler(new T.Euler(p.pitch||0,p.rotation||0,0)),new T.Vector3(p.w,p.h,p.d));return{p,matrix,targets:this.targetsFor(p,lookup)};}).filter(p=>p.targets.length);
    if(!parts.length)continue;const box=new T.Box3();for(const p of parts)box.union(new T.Box3(new T.Vector3(-.5,-.5,-.5),new T.Vector3(.5,.5,.5)).applyMatrix4(p.matrix));const size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());if(size.x>19||size.z>19||!group.wall&&Math.max(size.x,size.z)>6)continue;
    const dynamic=!group.wall&&dynamics++<this.maxBodies,r={id:'office-quake-'+this.records.length,name:group.name,parts,wall:group.wall,dynamic,size,center,mass:Math.min(95,Math.max(3,parts.reduce((n,q)=>n+q.p.w*q.p.h*q.p.d*85,0))),released:false,broken:false};
    r.body=new C.Body({mass:0,position:new C.Vec3(center.x,center.y,center.z),linearDamping:.38,angularDamping:.65,allowSleep:true,sleepSpeedLimit:.08,sleepTimeLimit:1,collisionFilterGroup:group.wall?1:2,collisionFilterMask:group.wall?6:7});
    for(const {p}of parts){if(p.ignore||p.w*p.h*p.d<.00012)continue;const shape=new C.Box(new C.Vec3(Math.max(.012,p.w/2-.006),Math.max(.012,p.h/2-.006),Math.max(.012,p.d/2-.006))),q=new C.Quaternion();q.setFromEuler(p.pitch||0,p.rotation||0,0);r.body.addShape(shape,new C.Vec3(p.x-center.x,p.y-center.y,p.z-center.z),q);}
    if(!r.body.shapes.length)r.body.addShape(new C.Box(new C.Vec3(size.x/2,size.y/2,size.z/2)));
    for(const p of parts){p.relative=p.matrix.clone();p.relative.elements[12]-=center.x;p.relative.elements[13]-=center.y;p.relative.elements[14]-=center.z;}
    this.world.addBody(r.body);this.records.push(r);this.byId.set(r.id,r);
   }
  }
  bindModel(model){
   if(!model||model.towerFloor!==this.model.towerFloor||this.modelOrigins.has(model))return false;
   // Entering a storey creates a fresh indoor copy. Attach it to the existing
   // bodies and saved originals so damage and later restoration stay shared.
   this.modelOrigins.set(model,model.group.position.clone());const lookup=this.indexTargets([model]);
   for(const r of this.records){for(const part of r.parts)part.targets.push(...this.targetsFor(part.p,lookup));if(r.released||r.broken)this.invalidate(r,model);}
   this.syncInstances(true);return true;
  }
  release(id){const r=this.byId.get(id);if(!r?.dynamic||r.released||r.broken)return;r.released=true;r.body.type=this.C.Body.DYNAMIC;r.body.mass=r.mass;r.body.updateMassProperties();r.body.wakeUp();
   // Slender objects overturn about their narrow support edge. A persistent
   // rotational load supplies the tip; no upward impulse launches the object.
   if(r.size.y>.6&&r.size.y/Math.min(r.size.x,r.size.z)>1.05){r.tipAxis=r.size.x<r.size.z?'z':'x';r.tipSign=this.records.indexOf(r)%2?1:-1;}
   this.fallenObjects++;this.invalidate(r);}
  invalidate(r,onlyModel=null){
   const copies=new Set();for(const part of r.parts)for(const target of part.targets){if(onlyModel&&target.copy!==onlyModel)continue;copies.add(target.copy);const p=part.p;for(const b of [...target.copy.layoutItems,...(target.copy.shellItems||[])])if(Math.hypot(b.x-p.x,b.z-p.z)<.015&&b.name===p.name){this.savedSolids??=new Map();if(!this.savedSolids.has(b))this.savedSolids.set(b,b.destroyed);b.destroyed=true;}}
   for(const m of copies){m.physicsVersion=(m.physicsVersion||0)+1;m.wallVersion=(m.wallVersion||0)+1;m.aoVersion=(m.aoVersion||0)+1;}L.building.society.grids.delete(this.model.towerFloor);this.view.firstPerson&&(this.view.firstPerson.collisionModel=null);
  }
  fractureWall(id,scenario){const r=this.byId.get(id);if(!r?.wall||r.broken||this.fragments.length>this.maxFragments-5)return;r.broken=true;this.world.removeBody(r.body);for(const part of r.parts)for(const q of part.targets){q.mesh.setMatrixAt(q.index,new T.Matrix4().makeScale(0,0,0));q.mesh.instanceMatrix.needsUpdate=true;}this.invalidate(r);
   const C=this.C,p=r.parts[0].p,size=new T.Vector3(p.w,p.h,p.d),q=new T.Quaternion().setFromEuler(new T.Euler(0,p.rotation||0,0)),count=Math.min(this.maxFragments-this.fragments.length,7+this.records.indexOf(r)%5),cells=L.fractureCells(size,count,this.records.indexOf(r)*97+43);
   const surface=r.parts[0].targets[0].mesh.material,outer=surface.clone(),inner=new T.MeshStandardMaterial({color:'#d1cbc4',roughness:.96});outer.onBeforeCompile=()=>{};outer.customProgramCacheKey=()=>'';outer.roughness=.87;
   for(const cell of cells){const vertices=cell.geometry.userData.colliderVertices,indices=cell.geometry.userData.colliderIndices,verts=[];for(let i=0;i<vertices.length;i+=3)verts.push(new C.Vec3(vertices[i]*.96,vertices[i+1]*.96,vertices[i+2]*.96));const faces=[];for(let i=0;i<indices.length;i+=3)faces.push([indices[i],indices[i+1],indices[i+2]]);const shape=new C.ConvexPolyhedron({vertices:verts,faces}),at=cell.center.clone().applyQuaternion(q).add(new T.Vector3(p.x,p.y,p.z));
    const body=new C.Body({mass:Math.max(.3,r.mass/cells.length),shape,position:new C.Vec3(at.x,at.y,at.z),linearDamping:.48,angularDamping:.65,allowSleep:true,collisionFilterGroup:4,collisionFilterMask:3});body.quaternion.set(q.x,q.y,q.z,q.w);body.velocity.set((scenario.random()-.5)*.16,0,(scenario.random()-.5)*.16);body.angularVelocity.set(.12,0,-.12);this.world.addBody(body);
    const mesh=new T.Mesh(cell.geometry,[outer,inner]);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.ignoreCollision=true;this.group.add(mesh);this.fragments.push({id:r.id+'-piece-'+this.fragments.length,body,mesh,size:cell.size,parent:r.id,energy:.65});
   }this.brokenObjects++;scenario.record({type:'wall-fracture',id:r.id,name:r.name,...r.center});
  }
  step(dt,scenario){if(this.disposed)return;this.scenario=scenario;const C=this.C,h=Math.min(.1,dt),substeps=Math.max(1,Math.ceil(h/(1/60)));
   for(let i=0;i<substeps;i++){
    for(const r of this.records)if(r.released&&!r.broken&&scenario.shaking){r.body.wakeUp();r.body.force.x=-r.mass*scenario.groundAcceleration;r.body.force.z=-r.mass*scenario.groundAccelerationZ;const tilt=Math.min(1.6,r.size.y)*.18;r.body.torque.x=-r.mass*scenario.groundAccelerationZ*tilt;r.body.torque.z=r.mass*scenario.groundAcceleration*tilt;
     if(r.tipAxis&&!r.tipped){const q=r.body.quaternion,upright=1-2*(q.x*q.x+q.z*q.z);if(upright<.23)r.tipped=true;else r.body.torque[r.tipAxis]+=r.tipSign*r.mass*9.81*Math.min(r.size.x,r.size.z)*.72;}
    }
    this.world.step(h/substeps);this.steps++;
    for(const body of [...this.records.filter(r=>r.released&&!r.broken).map(r=>r.body),...this.fragments.map(f=>f.body)]){const speed=body.velocity.length();if(speed>4.5)body.velocity.scale(4.5/speed,body.velocity);body.velocity.y=Math.min(body.velocity.y,1.1);const spin=body.angularVelocity.length();if(spin>3)body.angularVelocity.scale(3/spin,body.angularVelocity);}
   }
   this.syncVisuals();
  }
  syncContext(){if(this.disposed)return;const b=L.building,t=b.continuous,f=this.model.towerFloor,current=this.view.model;this.bindModel(current);
   const frame=t.active?t.models[f-1]:b.phase==='interior'&&current?.towerFloor===f?current:b.society.model(f),original=this.modelOrigins.get(frame)||frame.group.position;
   this.group.visible=L.collaboration?.environment!=='station'&&!L.collaboration?.switching&&!L.disasterDirector?.physics?.destroyedFloors.has(f)&&(!t.active||!!frame.group.visible);
   // Canonical previews already include their slab offset; indoor copies have
   // their own parent frame. Derive the world origin once from that hierarchy.
   this.group.position.set(original.x,frame.group.position.y,original.z);frame.group.parent?.updateWorldMatrix(true,false);frame.group.parent?.localToWorld(this.group.position);
  }
  syncVisuals(){if(this.disposed)return;this.syncContext();const d=this.scenario,sx=d?.groundDisplacement||0,sz=d?.groundDisplacementZ||0;for(const[model,origin]of this.modelOrigins){model.group.position.x=origin.x+sx;model.group.position.z=origin.z+sz;}this.syncInstances();
   for(const f of this.fragments){f.mesh.position.copy(f.body.position);f.mesh.quaternion.copy(f.body.quaternion);}this.view.shadowDirty=true;
  }
  syncInstances(force=false){let changed=false;const transform=new T.Matrix4(),pose=new T.Matrix4(),scale=new T.Vector3(1,1,1),hidden=new T.Matrix4().makeScale(0,0,0);for(const r of this.records)if(r.broken){if(!force&&r.visualBroken)continue;changed||=!r.visualBroken;r.visualBroken=true;for(const part of r.parts)for(const target of part.targets){target.mesh.setMatrixAt(target.index,hidden);target.mesh.instanceMatrix.needsUpdate=true;}}else if(r.released){const p=r.body.position,q=r.body.quaternion,values=[p.x,p.y,p.z,q.x,q.y,q.z,q.w],moved=!r.visualPose||values.some((v,i)=>v!==r.visualPose[i]);if(!force&&!moved)continue;changed||=moved;r.visualPose=values;transform.compose(new T.Vector3(p.x,p.y,p.z),new T.Quaternion(q.x,q.y,q.z,q.w),scale);for(const part of r.parts){pose.multiplyMatrices(transform,part.relative);for(const target of part.targets){target.mesh.setMatrixAt(target.index,target.visualOffset?pose.clone().multiply(target.visualOffset):pose);target.mesh.instanceMatrix.needsUpdate=true;}}}if(changed)this.batchRevision=(this.batchRevision||0)+1;}
  footprints(){return [...this.fragments,...this.records.filter(r=>r.released&&!r.broken)].filter(r=>r.body.position.y<1.8).map(r=>({id:r.id,name:r.name||'不规则墙体碎片',kind:'debris',x:r.body.position.x,z:r.body.position.z,radius:Math.min(.65,Math.max(r.size.x,r.size.z)/2),energy:.6}));}
  contactAt(x,z,r=.25){return this.footprints().find(p=>Math.hypot(x-p.x,z-p.z)<p.radius+r)||null;}
  summary(){return{engine:'cannon-es · office compound instances',rigidBodies:this.records.filter(r=>r.dynamic).length,physicsSteps:this.steps,fragments:this.fragments.length,fallenObjects:this.fallenObjects,brokenObjects:this.brokenObjects};}
  reset(){for(const r of this.records){delete r.tipped;delete r.visualPose;delete r.visualBroken;for(const p of r.parts)for(const q of p.targets){q.mesh.setMatrixAt(q.index,q.matrix);q.mesh.instanceMatrix.needsUpdate=true;q.copy.physicsVersion=(q.copy.physicsVersion||0)+1;q.copy.wallVersion=(q.copy.wallVersion||0)+1;}}this.batchRevision=(this.batchRevision||0)+1;for(const [p,value]of this.savedSolids||[])p.destroyed=value;for(const[model,origin]of this.modelOrigins){model.group.position.x=origin.x;model.group.position.z=origin.z;}L.building.society.grids.delete(this.model.towerFloor);}
  dispose(){if(this.disposed)return;this.reset();this.disposed=true;const materials=new Set();for(const f of this.fragments){f.mesh.geometry.dispose();for(const m of f.mesh.material)materials.add(m);}for(const m of materials)m.dispose();this.group.parent?.remove(this.group);this.world.bodies.slice().forEach(b=>this.world.removeBody(b));}
 }
 L.OfficeQuakePhysics=OfficeQuakePhysics;
})();
