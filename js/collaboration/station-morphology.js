/* Rigid modular layouts: original detailed hulls, matching cabin frames and pressure links. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,UP=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1);
  const names=['放射星港','垂直叠站','折线长廊'];
  const vec=a=>new T.Vector3(...a),clone=value=>JSON.parse(JSON.stringify(value));
  const finite=a=>Array.isArray(a)&&a.every(Number.isFinite);
  function random(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
  function overlap(a,b,gap=.8){return a.min.x<b.max.x+gap&&a.max.x+gap>b.min.x&&a.min.y<b.max.y+gap&&a.max.y+gap>b.min.y&&a.min.z<b.max.z+gap&&a.max.z+gap>b.min.z;}
  function intersectsSegment(a,b,box){
    let lo=0,hi=1;for(const k of ['x','y','z']){const d=b[k]-a[k];if(Math.abs(d)<1e-8){if(a[k]<=box.min[k]||a[k]>=box.max[k])return false;continue;}let p=(box.min[k]-a[k])/d,q=(box.max[k]-a[k])/d;if(p>q)[p,q]=[q,p];lo=Math.max(lo,p);hi=Math.min(hi,q);if(lo>=hi)return false;}return hi>1e-6&&lo<1-1e-6;
  }
  function simplify(points){const out=[];for(const p of points){if(out.length&&p.distanceToSquared(out[out.length-1])<1e-8)continue;while(out.length>1){const a=out[out.length-1].clone().sub(out[out.length-2]).normalize(),b=p.clone().sub(out[out.length-1]).normalize();if(a.dot(b)<.99999)break;out.pop();}out.push(p);}return out;}
  function smoothRoute(points,obstacles){
    const out=[points[0]];let from=0;while(from<points.length-1){let to=points.length-1;while(to>from+1&&obstacles.some(box=>intersectsSegment(points[from],points[to],box)))to--;out.push(points[to]);from=to;}return simplify(out);
  }
  // Compressed orthogonal visibility grid. Obstacle face coordinates guarantee
  // a way around separate hulls without routing links through another module.
  function route(a,b,obstacles){
    if(!obstacles.some(box=>intersectsSegment(a,b,box)))return[a,b];
    const axes=['x','y','z'],coords=axes.map(k=>[a[k],b[k],...obstacles.flatMap(box=>[box.min[k]-.08,box.max[k]+.08])].sort((x,y)=>x-y).filter((x,i,all)=>!i||Math.abs(x-all[i-1])>1e-6));
    const [nx,ny,nz]=coords.map(c=>c.length),count=nx*ny*nz,encode=(x,y,z)=>(x*ny+y)*nz+z,decode=i=>{const z=i%nz,y=Math.floor(i/nz)%ny;return[Math.floor(i/(ny*nz)),y,z];};
    const index=p=>encode(...axes.map((k,j)=>coords[j].findIndex(v=>Math.abs(v-p[k])<1e-6))),point=i=>vec(decode(i).map((v,j)=>coords[j][v]));
    const start=index(a),end=index(b),cost=new Float64Array(count).fill(Infinity),previous=new Int32Array(count).fill(-1),closed=new Uint8Array(count),free=new Int8Array(count),heap=[];
    const push=(i,f)=>{let n=heap.length;heap.push({i,f});while(n){const parent=(n-1)>>1;if(heap[parent].f<=f)break;heap[n]=heap[parent];n=parent;}heap[n]={i,f};};
    const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let n=0;while(n*2+1<heap.length){let child=n*2+1;if(child+1<heap.length&&heap[child+1].f<heap[child].f)child++;if(heap[child].f>=last.f)break;heap[n]=heap[child];n=child;}heap[n]=last;}return first.i;};
    cost[start]=0;push(start,a.distanceTo(b));
    while(heap.length){const current=pop();if(closed[current])continue;if(current===end){const path=[];for(let i=end;i!==-1;i=previous[i])path.push(point(i));return smoothRoute(simplify(path.reverse()),obstacles);}closed[current]=1;const xyz=decode(current),p=point(current);
      for(let axis=0;axis<3;axis++)for(const step of [-1,1]){const next=xyz.slice();next[axis]+=step;if(next[axis]<0||next[axis]>=coords[axis].length)continue;const id=encode(...next);if(closed[id]||free[id]===-1)continue;const q=point(id);if(!free[id])free[id]=obstacles.some(box=>box.containsPoint(q))?-1:1;if(free[id]===-1||obstacles.some(box=>intersectsSegment(p,q,box)))continue;const distance=cost[current]+p.distanceTo(q);if(distance>=cost[id])continue;cost[id]=distance;previous[id]=current;push(id,distance+Math.abs(q.x-b.x)+Math.abs(q.y-b.y)+Math.abs(q.z-b.z));}
    }
    throw Error('未找到无穿模的舱间连接通道');
  }
  class StationMorphology {
    constructor(station){
      this.station=station;this.originals=new Map();this.transforms=new Map();this.current=null;this.changed=false;this.generation=0;this._bounds=new T.Box3();
      for(const spec of C.stationModules){const group=station.modules.get(spec.id);group.updateWorldMatrix(true,true);const inverse=group.matrixWorld.clone().invert(),bounds=new T.Box3();group.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));});
        const parts=group.children.map(child=>{child.updateMatrix();return{child,matrix:child.matrix.clone(),auto:child.matrixAutoUpdate};});
        this.originals.set(spec.id,{anchor:spec.anchor.slice(),frame:station.cabinFrame(spec.id),bounds,parts});this.transforms.set(spec.id,new T.Matrix4());this._bounds.union(bounds);
      }
      this.corridorGroup=new T.Group();this.corridorGroup.name='随机形态 · 舱间压力通道';this.corridorGroup.visible=false;station.root.add(this.corridorGroup);
      this.materials={body:new T.MeshStandardMaterial({color:'#c5d0d8',metalness:.42,roughness:.57}),joint:new T.MeshStandardMaterial({color:'#657e91',metalness:.65,roughness:.4}),light:new T.MeshStandardMaterial({color:'#80d8e8',emissive:'#1b5967',emissiveIntensity:.6,metalness:.3,roughness:.35})};
      this.geometries={tube:new T.CylinderGeometry(.62,.62,1,12),joint:new T.SphereGeometry(.64,12,8),ring:new T.TorusGeometry(.64,.045,6,16)};
    }
    get bounds(){return this._bounds.clone();}
    frame(id,offset=new T.Vector3()){
      const frame=this.transforms.get(id).clone().multiply(this.originals.get(id).frame);frame.elements[12]+=offset.x;frame.elements[13]+=offset.y;frame.elements[14]+=offset.z;return frame;
    }
    prepare(plan){
      if(!plan||!Array.isArray(plan.modules)||plan.modules.length!==this.originals.size)throw Error('空间站形态缺少舱段');const ids=new Set(),transforms=new Map(),boxes=new Map();
      for(const item of plan.modules){const original=this.originals.get(item.id);if(!original||ids.has(item.id)||!finite(item.anchor)||item.anchor.length!==3||!finite(item.quaternion)||item.quaternion.length!==4||Math.max(...item.anchor.map(Math.abs))>300)throw Error('空间站形态参数无效');ids.add(item.id);
        const q=new T.Quaternion(...item.quaternion);if(Math.abs(q.length()-1)>.001)throw Error('空间站舱段朝向无效');const oldQ=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().extractRotation(original.frame)),rotation=q.multiply(oldQ.invert()),matrix=new T.Matrix4().makeRotationFromQuaternion(rotation),position=vec(item.anchor).sub(vec(original.anchor).applyQuaternion(rotation));matrix.setPosition(position);transforms.set(item.id,matrix);boxes.set(item.id,original.bounds.clone().applyMatrix4(matrix));
      }
      const entries=[...boxes];for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++)if(overlap(entries[i][1],entries[j][1]))throw Error('空间站舱段或太阳翼发生相交');return{transforms,boxes};
    }
    propose(seed){
      if(seed===undefined){seed=Math.floor(Math.random()*4294967293);if(this.current)seed=seed-seed%3+(this.current.family+1)%3;}else seed=Number(seed)>>>0;const r=random(seed),family=seed%3,spread=1+r()*.22,spin=(r()-.5)*.6;
      const positions=family===0?{node:[0,0,0],habitat:[0,0,-15],tianhe:[0,0,-29],tianzhou:[0,0,-43],wentian:[-30,0,5],mengtian:[30,0,5],shenzhou:[0,0,23],airlock:[0,18,4]}:family===1?{node:[0,0,0],habitat:[0,14,-11],tianhe:[0,29,-19],tianzhou:[0,44,-26],wentian:[-28,18,5],mengtian:[28,-12,5],shenzhou:[0,-18,5],airlock:[0,-31,14]}:{node:[0,0,0],habitat:[-15,0,-3],tianhe:[-29,3,-6],tianzhou:[-43,8,-9],wentian:[16,8,-29],mengtian:[34,-4,28],shenzhou:[17,-13,4],airlock:[0,17,15]};
      const parent={habitat:'node',tianhe:'habitat',tianzhou:'tianhe',wentian:'node',mengtian:'node',shenzhou:'node',airlock:'node'},global=new T.Quaternion().setFromAxisAngle(UP,spin);
      const modules=C.stationModules.map(spec=>{const p=vec(positions[spec.id]);if(spec.id!=='node'){p.x+=(r()-.5)*3;p.y+=(r()-.5)*2;p.z+=(r()-.5)*3;}p.multiplyScalar(spread).applyQuaternion(global);
        let q;if(spec.id==='node')q=global.clone();else{const aim=vec(positions[parent[spec.id]]).sub(vec(positions[spec.id])).normalize().applyQuaternion(global);q=new T.Quaternion().setFromUnitVectors(Z,aim);q.multiply(new T.Quaternion().setFromAxisAngle(Z,(r()-.5)*(family===1?.65:.3)));}return{id:spec.id,anchor:p.toArray(),quaternion:q.toArray()};});
      // The source contains long solar arrays. Grow the entire arrangement
      // until even their conservative boxes clear, retaining the chosen form.
      for(let attempt=0;attempt<18;attempt++){const factor=1+attempt*.16,plan={version:1,seed,family,name:names[family],modules:modules.map(m=>({...m,anchor:m.anchor.map(v=>v*factor)}))};try{const prepared=this.prepare(plan);this.connections(prepared.transforms,prepared.boxes);plan.validation={clearance:true,moduleCount:8,connectionCount:7};return plan;}catch(error){if(attempt===17)throw error;}}
    }
    port(id,to,transforms){
      const spec=C.stationModule(id),index=spec.links.indexOf(to),half=spec.length/2;let x=0,z=index===0?half:-half;
      if(spec.kind==='node'&&index>1){x=(index%2?1:-1)*spec.width/2;z=index===4?1.2:-1.2;}
      const frame=transforms.get(id).clone().multiply(this.originals.get(id).frame),point=new T.Vector3(x,1.2,z).applyMatrix4(frame),normal=new T.Vector3(x?Math.sign(x):0,0,x?0:Math.sign(z)).transformDirection(frame);return{point,normal};
    }
    escape(port,box){box=box.clone().expandByScalar(1.1);let distance=Infinity;for(const k of ['x','y','z']){const n=port.normal[k];if(Math.abs(n)<1e-5)continue;const face=n>0?box.max[k]:box.min[k],d=(face-port.point[k])/n;if(d>=0)distance=Math.min(distance,d);}return port.point.clone().addScaledVector(port.normal,(Number.isFinite(distance)?distance:0)+.2);}
    connections(transforms,boxes){
      const routes=[],seen=new Set(),obstacles=[...boxes.values()].map(box=>box.clone().expandByScalar(.85));
      for(const spec of C.stationModules)for(const to of spec.links){const key=[spec.id,to].sort().join(':');if(seen.has(key))continue;seen.add(key);const a=this.port(spec.id,to,transforms),b=this.port(to,spec.id,transforms),start=this.escape(a,boxes.get(spec.id)),end=this.escape(b,boxes.get(to));
        // A port extension must also clear neighboring modules before routing.
        for(const [id,box]of boxes){if(id!==spec.id&&intersectsSegment(a.point,start,box.clone().expandByScalar(.7)))throw Error('舱口延伸与相邻空间冲突');if(id!==to&&intersectsSegment(b.point,end,box.clone().expandByScalar(.7)))throw Error('舱口延伸与相邻空间冲突');}
        routes.push({from:spec.id,to,points:simplify([a.point,...route(start,end,obstacles),b.point])});
      }return routes;
    }
    buildCorridors(routes){
      const root=new T.Group(),dummy=new T.Object3D();
      for(const link of routes){const group=new T.Group();group.name=link.from+' ↔ '+link.to;group.userData={from:link.from,to:link.to,points:link.points.map(p=>p.toArray())};const segments=link.points.slice(1).map((b,i)=>({a:link.points[i],b})),body=new T.InstancedMesh(this.geometries.tube,this.materials.body,segments.length),joints=new T.InstancedMesh(this.geometries.joint,this.materials.joint,link.points.length),rings=[];
        segments.forEach(({a,b},i)=>{const d=b.clone().sub(a),length=d.length();dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(UP,d.clone().normalize());dummy.scale.set(1,length,1);dummy.updateMatrix();body.setMatrixAt(i,dummy.matrix);const q=new T.Quaternion().setFromUnitVectors(Z,d.normalize());for(let t=.25;t<length;t+=3.2)rings.push({p:a.clone().lerp(b,t/length),q});});
        link.points.forEach((p,i)=>{dummy.position.copy(p);dummy.quaternion.identity();dummy.scale.setScalar(1);dummy.updateMatrix();joints.setMatrixAt(i,dummy.matrix);});const bands=new T.InstancedMesh(this.geometries.ring,this.materials.light,rings.length);rings.forEach(({p,q},i)=>{dummy.position.copy(p);dummy.quaternion.copy(q);dummy.scale.setScalar(1);dummy.updateMatrix();bands.setMatrixAt(i,dummy.matrix);});
        for(const mesh of [body,joints,bands]){mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}root.add(group);
      }return root;
    }
    apply(plan){
      const prepared=this.prepare(plan),routes=this.connections(prepared.transforms,prepared.boxes),newCorridors=this.buildCorridors(routes),bounds=new T.Box3();for(const box of prepared.boxes.values())bounds.union(box);for(const link of routes)for(const point of link.points)bounds.expandByPoint(point);bounds.expandByScalar(.7);
      for(const item of plan.modules){const original=this.originals.get(item.id),matrix=prepared.transforms.get(item.id);for(const {child,matrix:base}of original.parts){child.matrixAutoUpdate=false;child.matrix.copy(matrix).multiply(base);child.matrixWorldNeedsUpdate=true;}C.stationModule(item.id).anchor=item.anchor.slice();this.station.modules.get(item.id).position.set(0,0,0);}
      this.transforms=prepared.transforms;this.current=clone(plan);this.changed=true;this.generation++;this._bounds=bounds;this.clearCorridors();for(const child of [...newCorridors.children])this.corridorGroup.add(child);this.station.root.updateMatrixWorld(true);this.update();return this.current;
    }
    restore(){
      for(const [id,original]of this.originals){for(const {child,matrix,auto}of original.parts){child.matrix.copy(matrix);matrix.decompose(child.position,child.quaternion,child.scale);child.matrixAutoUpdate=auto;child.matrixWorldNeedsUpdate=true;}C.stationModule(id).anchor=original.anchor.slice();this.transforms.set(id,new T.Matrix4());this.station.modules.get(id).position.set(0,0,0);}
      this.current=null;this.changed=false;this.generation=0;this.clearCorridors();this.corridorGroup.visible=false;this._bounds.makeEmpty();for(const original of this.originals.values())this._bounds.union(original.bounds);this.station.root.updateMatrixWorld(true);
    }
    clearCorridors(){this.corridorGroup.traverse(mesh=>{if(mesh.isInstancedMesh)mesh.dispose?.();});this.corridorGroup.clear();}
    update(){
      const s=this.station;this.corridorGroup.visible=this.changed&&s.phase!=='interior'&&!s.exploded;if(!this.corridorGroup.visible)return;const opacity=s.phase==='focus'?.48:1;for(const material of Object.values(this.materials)){if(material.opacity!==opacity){material.opacity=opacity;material.transparent=opacity<1;material.depthWrite=opacity===1;material.needsUpdate=true;}}
      for(const link of this.corridorGroup.children)link.visible=!(s.phase==='focus'&&(link.userData.from===s.selected||link.userData.to===s.selected));
    }
  }
  C.StationMorphology=StationMorphology;
})();
