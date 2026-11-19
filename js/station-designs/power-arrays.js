/* Surface-mounted power wings, sized independently of the pressure hull. */
(() => {
  'use strict';
  const T=THREE,EPS=1e-6;
  const V=a=>new T.Vector3(...a),axis=i=>new T.Vector3(i===0?1:0,i===1?1:0,i===2?1:0);
  const boundsData=b=>({min:b.min.toArray(),max:b.max.toArray()});
  function random(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
  function sourceGeometry(body){
    body.updateWorldMatrix(true,true);
    const parentWorld=body.parent?body.parent.matrixWorld.clone():new T.Matrix4(),inverse=parentWorld.clone().invert(),records=[];
    body.traverse(mesh=>{
      if(!mesh.isMesh||!mesh.visible||!mesh.geometry.attributes.position)return;
      const geometry=mesh.geometry;if(!geometry.boundingBox)geometry.computeBoundingBox();
      const matrix=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),bounds=geometry.boundingBox.clone().applyMatrix4(matrix),size=bounds.getSize(new T.Vector3()),dims=size.toArray().sort((a,b)=>a-b);
      records.push({mesh,matrix,bounds,positions:geometry.attributes.position,index:geometry.index,vertices:null,mountable:dims[1]>.65&&dims[2]>1&&dims[0]>.15});
    });
    const bounds=new T.Box3();for(const record of records)bounds.union(record.bounds);
    return{records,bounds,parentWorld};
  }
  function makeCollision(records){
    const triangle=new T.Triangle(),vertex=new T.Vector3();
    return box=>{
      for(const record of records){
        if(!box.intersectsBox(record.bounds))continue;
        if(!record.vertices){
          const p=record.positions,out=new Float32Array(p.count*3);
          for(let i=0;i<p.count;i++){vertex.fromBufferAttribute(p,i).applyMatrix4(record.matrix);out[i*3]=vertex.x;out[i*3+1]=vertex.y;out[i*3+2]=vertex.z;}
          record.vertices=out;
        }
        const vertices=record.vertices,index=record.index,count=index?index.count:record.positions.count;
        for(let i=0;i<count;i+=3){
          const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
          triangle.a.fromArray(vertices,a*3);triangle.b.fromArray(vertices,b*3);triangle.c.fromArray(vertices,c*3);
          if(box.intersectsTriangle(triangle))return true;
        }
      }
      return false;
    };
  }
  function mountsFor(source,seed,family){
    const {records,bounds,parentWorld}=source,size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),extent=size.length()+10,raycaster=new T.Raycaster(),commonRay=new T.Ray(),normalMatrix=new T.Matrix3(),inverse=parentWorld.clone().invert(),mounts=[],rng=random(seed);
    const fractions=[0,-.34,.34,-.66,.66,-.87,.87],crossFractions=[0,-.32,.32,-.65,.65];
    for(let normalAxis=0;normalAxis<3;normalAxis++)for(const sign of [-1,1]){
      const normal=axis(normalAxis).multiplyScalar(sign),tangents=[0,1,2].filter(i=>i!==normalAxis).sort((a,b)=>size.getComponent(b)-size.getComponent(a)),u=axis(tangents[0]),v=axis(tangents[1]);
      const longitudinal=fractions.slice(),levels=crossFractions.slice();
      // Explicitly sample the real centers of substantial annular hulls. A
      // uniform grid can fall into the empty gap between a station's two rings.
      for(const record of records)if(record.mesh.geometry.type==='LatheGeometry'&&record.bounds.getSize(new T.Vector3()).length()>size.length()*.4){
        const level=(record.bounds.getCenter(new T.Vector3()).getComponent(tangents[1])-center.getComponent(tangents[1]))*2/size.getComponent(tangents[1]);
        if(Math.abs(level)<.95&&!levels.some(g=>Math.abs(g-level)<.015))levels.push(level);
      }
      if(family==='spindle'&&normalAxis!==1)for(const record of records){
        const dimensions=record.bounds.getSize(new T.Vector3());
        if(record.mesh.geometry.type!=='CylinderGeometry'||dimensions.x<size.x*.35||dimensions.z<size.z*.35||dimensions.y>size.y*.15)continue;
        const tangentIndex=tangents.indexOf(1),values=tangentIndex===0?longitudinal:levels,level=(record.bounds.getCenter(new T.Vector3()).y-center.y)*2/size.y;
        if(Math.abs(level)<.95&&!values.some(g=>Math.abs(g-level)<.008))values.push(level);
      }
      for(const f of longitudinal)for(const g of levels){
        const origin=center.clone().addScaledVector(u,f*size.getComponent(tangents[0])/2).addScaledVector(v,g*size.getComponent(tangents[1])/2).addScaledVector(normal,extent),direction=normal.clone().negate();
        commonRay.set(origin,direction);
        const originWorld=origin.clone().applyMatrix4(parentWorld),directionWorld=direction.clone().transformDirection(parentWorld);raycaster.set(originWorld,directionWorld);raycaster.near=0;raycaster.far=Infinity;
        const hits=[];
        for(const record of records){if(commonRay.intersectsBox(record.bounds))record.mesh.raycast(raycaster,hits);}
        hits.sort((a,b)=>a.distance-b.distance);if(!hits.length)continue;
        const exteriorPoint=hits[0].point.clone().applyMatrix4(inverse);
        // Thin window trims are cladding, not a structural mounting surface.
        // A bracket may seat on the actual hull immediately under that trim.
        const hit=hits.find(h=>records.find(r=>r.mesh===h.object).mountable&&h.point.clone().applyMatrix4(inverse).distanceTo(exteriorPoint)<.28);if(!hit)continue;
        const record=records.find(r=>r.mesh===hit.object);
        const point=hit.point.clone().applyMatrix4(inverse),surfaceNormal=hit.face.normal.clone().applyNormalMatrix(normalMatrix.getNormalMatrix(record.matrix)).normalize();
        if(Math.abs(surfaceNormal.dot(normal))<.12)continue;
        if(surfaceNormal.dot(normal)<0)surfaceNormal.negate();
        if(mounts.some(m=>m.face===normalAxis*2+(sign>0?1:0)&&m.point.distanceToSquared(point)<.3))continue;
        mounts.push({point,normal,u,v,surfaceNormal,face:normalAxis*2+(sign>0?1:0),sourceUUID:hit.object.uuid,sourceName:hit.object.name||hit.object.geometry.type,triangleIndex:hit.faceIndex,rank:Math.abs(f)*.18+Math.abs(g)*.24+rng()*.08});
      }
    }
    return mounts;
  }
  function panelAt(center,u,v,width,height){
    const normal=new T.Vector3().crossVectors(u,v).normalize(),quaternion=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(u,v,normal)),corners=[];
    for(const a of [-1,1])for(const b of [-1,1])corners.push(center.clone().addScaledVector(u,a*width/2).addScaledVector(v,b*height/2));
    const bounds=new T.Box3().setFromPoints(corners);
    // Solar blanket, edge rails and grid are all included in the clearance.
    bounds.expandByVector(new T.Vector3(.16,.16,.16));
    return{center,u,v,normal,quaternion,width,height,area:width*height,corners,bounds};
  }
  function pairAt(mount,width,height,offset,style,swap){
    const n=mount.normal,u=(swap?mount.v:mount.u).clone(),v=(swap?mount.u:mount.v).clone(),hinge=mount.point.clone().addScaledVector(n,offset),panels=[],segments=[];
    const segment=(a,b,width)=>segments.push({a:a.clone(),b:b.clone(),width});
    segment(mount.point.clone().addScaledVector(n,-.12),hinge,.24);
    segment(hinge.clone().addScaledVector(u,-.55),hinge.clone().addScaledVector(u,.55),.18);
    for(const sign of [-1,1]){
      let center,root,panelV;
      if(style==='outboard'){
        panelV=n;root=hinge.clone().addScaledVector(u,sign*(width/2+.65)).addScaledVector(n,.65);center=root.clone().addScaledVector(n,height/2);
      }else{
        panelV=v;root=hinge.clone().addScaledVector(v,sign*.9);center=root.clone().addScaledVector(v,sign*height/2);
      }
      panels.push(panelAt(center,u,panelV,width,height));
      const left=root.clone().addScaledVector(u,-width/2),right=root.clone().addScaledVector(u,width/2);
      segment(left,right,.14);
      segment(hinge.clone().addScaledVector(u,-.4),left,.115);
      segment(hinge.clone().addScaledVector(u,.4),right,.115);
    }
    return{mount,hinge,panels,segments,style,offset};
  }
  function segmentBox(segment,trimStart=0){const direction=segment.b.clone().sub(segment.a),a=segment.a.clone().addScaledVector(direction.normalize(),trimStart);return new T.Box3().setFromPoints([a,segment.b]).expandByScalar(segment.width*.6);}
  function segmentDistanceSquared(first,second){
    const d1=first.b.clone().sub(first.a),d2=second.b.clone().sub(second.a),r=first.a.clone().sub(second.a),a=d1.lengthSq(),e=d2.lengthSq(),f=d2.dot(r),clamp=v=>Math.max(0,Math.min(1,v));let s,t;
    if(a<EPS&&e<EPS)return r.lengthSq();
    if(a<EPS){s=0;t=clamp(f/e);}else{
      const c=d1.dot(r);if(e<EPS){t=0;s=clamp(-c/a);}else{
        const b=d1.dot(d2),denominator=a*e-b*b;s=denominator>EPS?clamp((b*f-c*e)/denominator):0;t=(b*s+f)/e;
        if(t<0){t=0;s=clamp(-c/a);}else if(t>1){t=1;s=clamp((b-c)/a);}
      }
    }
    return r.addScaledVector(d1,s).addScaledVector(d2,-t).lengthSq();
  }
  function clearPair(pair,placed,collides){
    for(const panel of pair.panels){
      if(collides(panel.bounds))return false;
      for(const previous of placed)for(const other of previous.panels)if(panel.bounds.intersectsBox(other.bounds))return false;
    }
    for(let i=0;i<pair.segments.length;i++){
      const box=segmentBox(pair.segments[i],i===0?.5:0);
      if(collides(box))return false;
      for(const previous of placed)for(const panel of previous.panels)if(box.intersectsBox(panel.bounds))return false;
      for(const previous of placed)for(const segment of previous.segments){
        const clearance=(pair.segments[i].width+segment.width)*.75+.04;
        if(segmentDistanceSquared(pair.segments[i],segment)<clearance*clearance)return false;
      }
    }
    for(const previous of placed)for(const segment of previous.segments){const box=segmentBox(segment);for(const panel of pair.panels)if(box.intersectsBox(panel.bounds))return false;}
    return true;
  }
  // The overview uses this fixed viewing direction. Scoring only chooses a
  // mounting site: it never changes the camera, hull scale or collector area.
  const overviewDirection=V([47,32,58]).normalize(),overviewRight=new T.Vector3().crossVectors(axis(1),overviewDirection).normalize(),overviewUp=new T.Vector3().crossVectors(overviewDirection,overviewRight).normalize();
  function projectedBounds(points){
    const result={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
    for(const p of points){const x=p.dot(overviewRight),y=p.dot(overviewUp);result.minX=Math.min(result.minX,x);result.maxX=Math.max(result.maxX,x);result.minY=Math.min(result.minY,y);result.maxY=Math.max(result.maxY,y);}
    return result;
  }
  const projectedOverlap=(a,b)=>Math.max(0,Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX))*Math.max(0,Math.min(a.maxY,b.maxY)-Math.max(a.minY,b.minY));
  function pairScore(pair,placed,bodyProjection,major,preferHorizontal){
    let score=0,minX=bodyProjection.minX,maxX=bodyProjection.maxX,minY=bodyProjection.minY,maxY=bodyProjection.maxY;
    const previous=placed.flatMap(p=>p.panels);
    for(const panel of previous){const b=panel.projection;minX=Math.min(minX,b.minX);maxX=Math.max(maxX,b.maxX);minY=Math.min(minY,b.minY);maxY=Math.max(maxY,b.maxY);}
    for(const panel of pair.panels){
      const projection=projectedBounds(panel.corners),visibleArea=panel.area*Math.abs(panel.normal.dot(overviewDirection));panel.projection=projection;
      score+=visibleArea;
      // Keep the tall main blankets beside the readable body, and spread the
      // smaller collectors into the remaining open parts of the overview.
      score-=Math.min(visibleArea,projectedOverlap(projection,bodyProjection))*(major?.4:.18);
      for(const other of previous)score-=Math.min(visibleArea,other.area,projectedOverlap(projection,other.projection))*.95;
      if(preferHorizontal&&Math.abs(panel.normal.y)>.9)score+=panel.area*.45;
      minX=Math.min(minX,projection.minX);maxX=Math.max(maxX,projection.maxX);minY=Math.min(minY,projection.minY);maxY=Math.max(maxY,projection.maxY);
    }
    score+=.025*((maxX-minX)**2+(maxY-minY)**2);
    score-=placed.filter(p=>p.mount.face===pair.mount.face).length*pair.panels[0].area*.08;
    score-=Math.max(0,pair.offset-2.8)*.4;
    return score;
  }
  function allocate(source,options){
    const mounts=mountsFor(source,options.seed,options.family),collides=makeCollision(source.records),sizes=[];
    const bodyCorners=[];for(const x of [source.bounds.min.x,source.bounds.max.x])for(const y of [source.bounds.min.y,source.bounds.max.y])for(const z of [source.bounds.min.z,source.bounds.max.z])bodyCorners.push(V([x,y,z]));
    const bodyProjection=projectedBounds(bodyCorners);
    const majorPairs=options.majorPanelCount/2,minorPairs=options.pairCount-majorPairs;
    for(let i=0;i<options.pairCount;i++){
      const major=i<majorPairs,share=major?options.majorAreaShare:1-options.majorAreaShare,count=major?majorPairs:minorPairs;
      sizes.push({area:options.targetArea*share/(count*2),major});
    }
    if(!mounts.length)throw Error('No exterior mounting surfaces for '+options.family);
    for(let attempt=0;attempt<6;attempt++){
      const placed=[],rng=random(options.seed+attempt*1361);
      for(let index=0;index<sizes.length;index++){
        const size=sizes[index],candidates=[],aspect=size.major?[4.3,4.2,4.4][attempt%3]:[2.5,2.3,2.7][attempt%3],width=Math.sqrt(size.area/aspect),height=size.area/width;
        for(const mount of mounts){
          if(placed.some(p=>p.mount.point.distanceTo(mount.point)<2.7))continue;
          for(const style of size.major?['butterfly']:['butterfly','outboard'])for(const swap of [false,true]){
            // All four main collectors extend vertically, as on the original
            // station. Auxiliary pairs retain varied planes and directions.
            if(size.major&&Math.abs((swap?mount.u:mount.v).y)<.9)continue;
            for(const offset of [options.hingeOffset,Math.min(4,options.hingeOffset+.8)]){
              const pair=pairAt(mount,width,height,offset,style,swap);
              let score=pairScore(pair,placed,bodyProjection,size.major,index===majorPairs||index===majorPairs+1)-mount.rank*.1+rng()*(attempt?.5:.06);
              // The tall tower needs collectors at the platform perimeter,
              // leaving its layered central spine readable from the overview.
              if(options.family==='spindle'&&size.major)score+=Math.abs(pair.hinge.dot(overviewRight))*12-Math.abs(pair.hinge.y)*.5;
              candidates.push({pair,score});
            }
          }
        }
        candidates.sort((a,b)=>b.score-a.score);let chosen;
        for(const {pair}of candidates)if(clearPair(pair,placed,collides)){chosen={...pair,major:size.major};break;}
        if(!chosen)break;placed.push(chosen);
      }
      if(placed.length===options.pairCount)return placed;
    }
    throw Error('Unable to mount '+options.pairCount+' clear solar pairs on '+options.family);
  }
  function build(K,body,settings={}){
    const pairCount=Math.max(2,Math.min(8,Math.round(settings.pairCount||6))),majorPanelCount=Math.max(2,Math.min(pairCount*2-2,Math.round((settings.majorPanelCount||4)/2)*2));
    const options={family:settings.family||'station',seed:Number(settings.seed)>>>0,targetArea:Number(settings.targetArea)||563.6525,pairCount,majorPanelCount,majorAreaShare:Math.max(.2,Math.min(.9,settings.majorAreaShare??.70)),hingeOffset:Math.max(2,Math.min(4,settings.hingeOffset||2.8))};
    if(options.targetArea<=0)throw Error('Solar area must be positive');
    const source=sourceGeometry(body),layout=allocate(source,options),group=new T.Group();group.name='Surface-mounted power arrays';
    const metadata={version:1,...options,panelCount:pairCount*2,totalArea:0,panels:[],pairs:[]};
    for(let i=0;i<layout.length;i++){
      const pair=layout[i],pairId=options.family+'-power-pair-'+(i+1),panelIds=[];
      for(let j=0;j<pair.panels.length;j++){
        const panel=pair.panels[j],id=pairId+'-'+(j+1),temporary=new T.Group();
        K.solar(temporary,{width:panel.width,height:panel.height,cols:4,rows:Math.max(5,Math.round(panel.height)),position:[0,0,0]});
        const mesh=K.batch(temporary);mesh.position.copy(panel.center);mesh.quaternion.copy(panel.quaternion);mesh.name=id;mesh.userData.solarPanelId=id;mesh.userData.solarPairId=pairId;mesh.userData.solarRole=pair.major?'main':'secondary';group.add(mesh);panelIds.push(id);
        metadata.totalArea+=panel.area;
        metadata.panels.push({id,pairId,width:panel.width,height:panel.height,area:panel.area,role:pair.major?'main':'secondary',position:panel.center.toArray(),quaternion:panel.quaternion.toArray(),normal:panel.normal.toArray(),corners:panel.corners.map(v=>v.toArray()),bounds:boundsData(panel.bounds)});
      }
      const supports=new T.Group();
      for(const segment of pair.segments)K.beam(supports,'silver',segment.a.toArray(),segment.b.toArray(),segment.width);
      K.sphere(supports,'graphite',.34,pair.hinge.toArray());
      const supportCenter=new T.Box3().setFromObject(supports).getCenter(new T.Vector3()),supportMesh=K.batch(supports);supportMesh.position.copy(supportCenter);supportMesh.name=pairId+'-support';supportMesh.userData.solarSupportId=pairId;group.add(supportMesh);
      metadata.pairs.push({id:pairId,mount:pair.mount.point.toArray(),surfaceNormal:pair.mount.surfaceNormal.toArray(),outward:pair.mount.normal.toArray(),hinge:pair.hinge.toArray(),hingeOffset:pair.offset,sourceUUID:pair.mount.sourceUUID,sourceName:pair.mount.sourceName,triangleIndex:pair.mount.triangleIndex,panels:panelIds,style:pair.style,supportSegments:pair.segments.map(s=>({from:s.a.toArray(),to:s.b.toArray(),width:s.width}))});
    }
    group.updateMatrixWorld(true);metadata.bounds=boundsData(new T.Box3().setFromObject(group));group.userData.solarArrays=metadata;
    return{group,metadata};
  }
  window.StationPowerArrays={build};
})();
