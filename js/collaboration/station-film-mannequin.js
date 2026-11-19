/* Film-only mannequin faces; the station's source bodies and rigs stay intact. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE;
  const facePart=o=>/crew-(eyes|hair)-|ground-(head|hair|eyes|iris|lips|brow|glasses|hat|jaw)$/.test(o.name)||['Eyes','Hair'].includes(o.userData.MhObjectType);
  function smoothSeam(geometry,segments,rings){const n=geometry.attributes.normal,v=new T.Vector3(),w=new T.Vector3();for(let y=0;y<rings;y++){const a=y*(segments+1),b=a+segments;v.fromBufferAttribute(n,a).add(w.fromBufferAttribute(n,b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);}n.needsUpdate=true;}

  function headSurface(bounds,bindToHead){
    const height=bounds.max.y-bounds.min.y,bottom=bounds.min.y+height*.075,top=bounds.max.y-height*.025;
    const rx=(bounds.max.x-bounds.min.x)*.43,rz=(bounds.max.z-bounds.min.z)*.40,cx=(bounds.min.x+bounds.max.x)/2,cz=(bounds.min.z+bounds.max.z)/2;
    // A rounded cranium, flatter face and narrowing jaw retain adult scale.
    // The closed lower surface overlaps the neck blended on the original rig.
    const controls=[[0,0,0],[.012,.40,.38],[.06,.56,.55],[.14,.72,.73],[.25,.88,.88],[.40,.98,.98],[.57,1,1],[.72,.96,.98],[.85,.82,.86],[.94,.59,.63],[.985,.25,.28],[1,0,0]],curve=new T.CatmullRomCurve3(controls.map(([u,w,d])=>new T.Vector3(u,w,d)),false,'centripetal'),profile=curve.getPoints(44).map(p=>[p.x,Math.max(0,p.y),Math.max(0,p.z)]),segments=40,positions=[],indices=[];
    for(const [u,width,depth]of profile)for(let i=0;i<=segments;i++){
      const angle=i/segments*Math.PI*2,x=Math.sin(angle),z=Math.cos(angle),jawShift=.012*(1-u);
      positions.push(cx+x*rx*width,bottom+(top-bottom)*u,cz+z*rz*depth*(z>0?.94:1)+jawShift);
    }
    for(let y=0;y<profile.length-1;y++)for(let x=0;x<segments;x++){const a=y*(segments+1)+x,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();smoothSeam(geometry,segments,profile.length);geometry.applyMatrix4(bindToHead);geometry.computeBoundingBox();geometry.computeBoundingSphere();
    geometry.userData.filmMannequinOwned=true;return geometry;
  }

  C.makeStationFilmMannequin=root=>{
    if(root.userData.filmMannequin)return root;
    const rig=root.userData.stationRig,headBone=rig?.head;
    if(!headBone)throw Error('影片模特缺少原头部骨骼');
    const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
    const detail=meshes.filter(facePart),body=meshes.find(o=>o.isSkinnedMesh&&(o.name==='Human'||o.userData.MhObjectType==='Basemesh'));
    const metadata={version:1,style:'orange-featureless',sourceAsset:root.userData.stationAsset,head:null,neck:null,hiddenDetails:detail,bodyEdits:[],bodyRigPreserved:true};
    for(const mesh of detail){mesh.visible=false;mesh.userData.filmHiddenFacialDetail=true;}
    let geometry,referenceMaterial,neckGeometry;
    if(body){
      const source=body.geometry,positions=source.attributes.position,joints=source.attributes.skinIndex,weights=source.attributes.skinWeight,headIndex=body.skeleton.bones.indexOf(headBone),bounds=new T.Box3(),point=new T.Vector3();
      for(let i=0;i<positions.count;i++){let weight=0;for(let j=0;j<4;j++)if(joints.array[i*4+j]===headIndex)weight+=weights.array[i*4+j];if(weight>.5)bounds.expandByPoint(point.fromBufferAttribute(positions,i));}
      if(bounds.isEmpty())throw Error('影片模特找不到原头部蒙皮');
      const headBottom=bounds.min.y+(bounds.max.y-bounds.min.y)*.075,cutoff=bounds.min.y-.035,sourceIndex=source.index?.array||Array.from({length:positions.count},(_,i)=>i),kept=[];
      // Only the face triangle list changes; every surviving body/hand vertex,
      // skin weight, bind transform and bone is the original asset value.
      const isFace=i=>positions.getY(i)>cutoff&&Math.abs(positions.getX(i)-(bounds.min.x+bounds.max.x)/2)<(bounds.max.x-bounds.min.x)*.65;
      for(let i=0;i<sourceIndex.length;i+=3)if(!isFace(sourceIndex[i])&&!isFace(sourceIndex[i+1])&&!isFace(sourceIndex[i+2]))kept.push(sourceIndex[i],sourceIndex[i+1],sourceIndex[i+2]);
      const trimmed=source.clone();trimmed.setIndex(kept);trimmed.clearGroups();trimmed.userData={filmMannequinOwned:true,filmBodySourceUuid:source.uuid};body.geometry=trimmed;
      metadata.bodyEdits.push({mesh:body,sourceGeometry:source,removedTriangles:(sourceIndex.length-kept.length)/3,preservedVertexAttributes:true});
      geometry=headSurface(bounds,body.skeleton.boneInverses[headIndex].clone().multiply(body.bindMatrix));referenceMaterial=Array.isArray(body.material)?body.material[0]:body.material;
      // A soft neck joins the original collar to the head. Its lower ring uses
      // the real neck bone, its upper ring the head bone, so nodding cannot
      // expose a gap or a cut edge left by the detailed face.
      const neckIndex=body.skeleton.bones.indexOf(headBone.parent),cx=(bounds.min.x+bounds.max.x)/2,cz=(bounds.min.z+bounds.max.z)/2,neckPositions=[],neckIndices=[],skinIndices=[],skinWeights=[],segments=32,rings=6;
      for(let y=0;y<=rings;y++){const u=y/rings,blend=T.MathUtils.smoothstep(u,.3,1),radius=.039-.006*u;for(let x=0;x<=segments;x++){const angle=x/segments*Math.PI*2;neckPositions.push(cx+Math.sin(angle)*radius,cutoff-.018+(headBottom+.012-cutoff+.018)*u,cz-.022*(1-u)+Math.cos(angle)*radius*.87+.012*u);skinIndices.push(Math.max(0,neckIndex),headIndex,0,0);skinWeights.push(1-blend,blend,0,0);}}
      for(let y=0;y<rings;y++)for(let x=0;x<segments;x++){const a=y*(segments+1)+x,b=a+segments+1;neckIndices.push(a,a+1,b,b,a+1,b+1);}
      neckGeometry=new T.BufferGeometry();neckGeometry.setAttribute('position',new T.Float32BufferAttribute(neckPositions,3));neckGeometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndices,4));neckGeometry.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeights,4));neckGeometry.setIndex(neckIndices);neckGeometry.computeVertexNormals();smoothSeam(neckGeometry,segments,rings+1);neckGeometry.computeBoundingBox();neckGeometry.computeBoundingSphere();neckGeometry.userData.filmMannequinOwned=true;
    }else{
      // Native fallback already separates facial parts; reuse its head scale.
      const base=detail.find(o=>o.name==='ground-head');if(!base)throw Error('影片模特需要空间站乘员身体');
      const bounds=new T.Box3().setFromBufferAttribute(base.geometry.attributes.position),index=base.skeleton.bones.indexOf(headBone);geometry=headSurface(bounds,base.skeleton.boneInverses[index].clone().multiply(base.bindMatrix));referenceMaterial=Array.isArray(base.material)?base.material[0]:base.material;
    }
    const material=new T.MeshStandardMaterial({color:referenceMaterial.color.clone(),roughness:.79,metalness:0,envMapIntensity:.30});material.userData.filmMannequinOwned=true;material.userData.styleLocked=true;
    const head=new T.Mesh(geometry,material);head.name='film-featureless-mannequin-head';head.userData.filmMannequinHead=true;head.userData.noAO=true;head.frustumCulled=false;head.castShadow=head.receiveShadow=false;headBone.add(head);metadata.head=head;
    if(neckGeometry){const neckMaterial=material.clone();neckMaterial.skinning=true;const neck=new T.SkinnedMesh(neckGeometry,neckMaterial);neck.name='film-smooth-mannequin-neck';neck.userData.filmMannequinNeck=true;neck.userData.noAO=true;neck.frustumCulled=false;neck.skeleton=body.skeleton;neck.bindMatrix.copy(body.bindMatrix);neck.bindMatrixInverse.copy(body.bindMatrixInverse);body.parent.add(neck);metadata.neck=neck;}
    root.userData.filmMannequin=metadata;root.updateMatrixWorld(true);return root;
  };
})();
