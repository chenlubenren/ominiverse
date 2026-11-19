/* Instanced clean furniture; semantic layout and navigation stay in OfficeKit. */
(() => {
  'use strict';
  const L=window.IndoorLab,T=THREE;
  class FurnitureAssets {
    constructor(){this.templates=new Map();this.errors=[];this.ready=Promise.resolve();}
    has(kind){return L.FurnitureLibrary.types.includes(kind);}
    parts(kind,level,columns,dimensions={}){const key=kind+':'+level+':'+columns+':'+(dimensions.width||0)+':'+(dimensions.depth||0);if(!this.templates.has(key))this.templates.set(key,L.FurnitureLibrary.build(kind,level==='interior',columns,dimensions));return this.templates.get(key);}
    addToFloor(group,specs,seatParts,preview){
      const byKind=new Map(),pose=new T.Object3D();
      for(const spec of specs){const columns=['office-cabinet','bookcase','reception','coffee-station'].includes(spec.kind)?Math.max(2,Math.min(8,Math.round(spec.width/.72))):2,dimensions=['workstation','meeting-table','coffee-station'].includes(spec.kind)?{width:Math.round(spec.width*4)/4,depth:Math.round(spec.depth*10)/10}:{},key=spec.kind+':'+columns+':'+(dimensions.width||0)+':'+(dimensions.depth||0);if(!byKind.has(key))byKind.set(key,{kind:spec.kind,columns,dimensions,items:[]});byKind.get(key).items.push(spec);}
      for(const {kind,columns,dimensions,items} of byKind.values()){
        for(const part of this.parts(kind,preview?'overview':'interior',columns,dimensions)){
          // Own geometry/material per floor; shared immutable image textures survive disposal.
          const mesh=new T.InstancedMesh(part.geometry.clone(),part.material.clone(),items.length);
          mesh.name='Office / '+kind;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
          mesh.userData.furnitureAsset=kind;mesh.userData.instanceMetadata=[];
          items.forEach((s,i)=>{
            pose.position.set(s.x,0,s.z);pose.rotation.set(0,s.angle,0);pose.scale.set(s.width,s.height,s.depth);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);
            mesh.userData.instanceMetadata.push({x:s.x,y:s.height/2,z:s.z,key:'furniture',name:s.name||kind,kind:'furniture',seatId:s.seatId,assemblyId:s.assemblyId,logicalParts:s.logicalParts});
            if(s.seatId){if(!seatParts.has(s.seatId))seatParts.set(s.seatId,[]);seatParts.get(s.seatId).push({mesh,index:i,base:pose.matrix.clone()});}
          });
          group.add(mesh);
        }
      }
    }
  }
  L.FurnitureAssets=FurnitureAssets;L.furnitureAssets=new FurnitureAssets();
})();
