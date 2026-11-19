/* Actual chipped wall surfaces before structural failure, with retained collision. */
(() => {
  'use strict';const L=window.IndoorLab,T=THREE,V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
  class ProgressiveWallDamage {
    constructor(physics){this.p=physics;this.records=new Set();}
    apply(record,worldPoint,power){
      if(record.glass||record.broken)return;
      let mesh=record.damageMesh;
      if(!mesh){
        const s=record.size,segments=[Math.min(48,Math.max(2,Math.ceil(s.x/.14))),Math.min(28,Math.max(2,Math.ceil(s.y/.13))),Math.min(48,Math.max(2,Math.ceil(s.z/.14)))];
        // Subdivide the two broad faces, with flat triangle normals on the chipped surface.
        const geometry=new T.BoxGeometry(s.x,s.y,s.z,...segments).toNonIndexed(),material=record.mesh.material.clone();material.flatShading=true;material.vertexColors=true;material.roughness=.94;
        mesh=new T.Mesh(geometry,material);mesh.name='逐步剥落的墙体';mesh.position.copy(record.position);mesh.quaternion.copy(record.quat);mesh.userData.damageSurfaceRecord=record;this.p.group.add(mesh);
        record.damageMesh=mesh;record.damageRest=new Float32Array(geometry.attributes.position.array);record.damageImpacts=[];this.records.add(record);
        if(record.index>=0){record.mesh.setMatrixAt(record.index,new T.Matrix4().makeScale(0,0,0));record.mesh.instanceMatrix.needsUpdate=true;}else record.mesh.visible=false;
      }
      const local=worldPoint.clone().sub(record.position).applyQuaternion(record.quat.clone().invert()),s=record.size,depthAxis=s.x<s.z?'x':'z',wideAxis=depthAxis==='x'?'z':'x',side=Math.sign(local[depthAxis])||1,radius=.2+Math.min(.25,power/190),strength=Math.min(s[depthAxis]*.22,.013+power*.00035);
      const previous=record.damageImpacts.find(p=>p.side===side&&Math.hypot(p.x-local[wideAxis],p.y-local.y)<.18);
      if(previous){previous.depth=Math.min(s[depthAxis]*.44,previous.depth+strength);previous.radius=Math.min(.72,previous.radius+.035);}else{record.damageImpacts.push({x:local[wideAxis],y:local.y,side,depth:strength,radius});if(record.damageImpacts.length>18)record.damageImpacts.shift();}
      const geometry=mesh.geometry,positions=geometry.attributes.position,normal=geometry.attributes.normal,rest=record.damageRest,color=record.mesh.material.color,colors=new Float32Array(positions.count*3);
      for(let i=0;i<positions.count;i++){
        const at=V(rest[i*3],rest[i*3+1],rest[i*3+2]);let depth=0;
        if(Math.abs(at[depthAxis])>s[depthAxis]*.48)for(const p of record.damageImpacts){if(Math.sign(at[depthAxis])!==p.side)continue;const u=at[wideAxis]-p.x,v=at.y-p.y,r=Math.hypot(u,v)/p.radius;if(r<1){const jag=.76+.24*Math.sin(Math.floor(at[wideAxis]*17)*47+Math.floor(at.y*19)*31);depth=Math.max(depth,p.depth*Math.pow(1-r, .55)*jag);}}
        at[depthAxis]-=Math.sign(at[depthAxis])*depth;positions.setXYZ(i,at.x,at.y,at.z);const shade=depth>.001?.62+Math.min(.2,depth*2):1;colors.set([color.r*shade,color.g*shade,color.b*shade],i*3);
      }
      positions.needsUpdate=true;if(geometry.attributes.color){geometry.attributes.color.array.set(colors);geometry.attributes.color.needsUpdate=true;}else geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));mesh.material.color.set('#ffffff');geometry.computeVertexNormals();geometry.computeBoundingSphere();record.model.aoVersion=(record.model.aoVersion||0)+1;
      if(this.p.totalTime>=(record.nextChip||0)){record.nextChip=this.p.totalTime+.1;const size=V(.12+radius*.3,.12+radius*.2,Math.min(.045,s[depthAxis]*.22)),cells=L.fractureCells(size,3,118);for(const cell of cells){const mat=new T.MeshStandardMaterial({color:'#b5b7b7',roughness:.98}),part=new T.Mesh(cell.geometry,mat),position=worldPoint.clone().add(cell.center.clone().applyQuaternion(record.quat)).addScaledVector(V(depthAxis==='x'?side:0,0,depthAxis==='z'?side:0).applyQuaternion(record.quat),.02);part.userData.convex=true;part.userData.materialKind='concrete';this.p.physical(part,cell.size,position,record.quat,V((Math.random()-.5)*.045,.012,(Math.random()-.5)*.045),.16);}}
    }
    remove(record){const mesh=record.damageMesh;if(!mesh)return;this.p.group.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();record.damageMesh=null;record.damageRest=null;record.damageImpacts=null;this.records.delete(record);}
    reset(){for(const record of [...this.records])this.remove(record);}
  }
  L.ProgressiveWallDamage=ProgressiveWallDamage;
})();
