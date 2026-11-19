/* Keep the full authored surface nearby; recover its pre-subdivision topology
 * for small projected office characters. All skin/normal/UV attributes stay shared. */
(() => {
  'use strict';
  const L=window.IndoorLab,T=THREE;
  const bundled={
    'clay-male':{source:'Male_Adult_02',triangles:43872,sourceTriangles:7312,vertices:23772},
    'clay-female':{source:'Female_Adult_01',triangles:52392,sourceTriangles:8732,vertices:28514}
  };
  const yieldToMain=()=>new Promise(resolve=>setTimeout(resolve,0));

  function cornersOf(indices,start,geometry,weld=false){
    // One original triangular face became three quads, each exported as two
    // triangles. Its three old corners occur in one quad each; edge points
    // occur twice and the face point occurs in all three. This recovers faces,
    // rather than dropping triangles and leaving holes in a distant person.
    const vertices=new Map(),quads=[],position=geometry.attributes.position,uv=geometry.attributes.uv;
    for(let q=0;q<3;q++){
      const quad=new Set();
      for(let i=start+q*6;i<start+q*6+6;i++){
        const index=indices[i],key=weld?position.getX(index)+','+position.getY(index)+','+position.getZ(index)+'|'+(uv?uv.getX(index)+','+uv.getY(index):''):index;
        if(!vertices.has(key))vertices.set(key,{index,count:0});quad.add(key);
      }
      if(quad.size!==4)return null;
      for(const key of quad)vertices.get(key).count++;
      quads.push(quad);
    }
    const values=[...vertices.values()],corners=values.filter(v=>v.count===1),edges=values.filter(v=>v.count===2),centers=values.filter(v=>v.count===3);
    if(values.length!==7||corners.length!==3||edges.length!==3||centers.length!==1)return null;
    if(quads.some(quad=>[...quad].filter(key=>vertices.get(key).count===1).length!==1))return null;
    const result=corners.map(v=>v.index);
    // Match the summed fine-surface winding even if an exporter chooses a
    // different diagonal/order for an individual quad.
    let nx=0,ny=0,nz=0;
    const cross=(a,b,c)=>{
      const ax=position.getX(b)-position.getX(a),ay=position.getY(b)-position.getY(a),az=position.getZ(b)-position.getZ(a),bx=position.getX(c)-position.getX(a),by=position.getY(c)-position.getY(a),bz=position.getZ(c)-position.getZ(a);
      return [ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx];
    };
    for(let i=start;i<start+18;i+=3){const n=cross(indices[i],indices[i+1],indices[i+2]);nx+=n[0];ny+=n[1];nz+=n[2];}
    const n=cross(...result);if(n[0]*nx+n[1]*ny+n[2]*nz<0)[result[1],result[2]]=[result[2],result[1]];
    return result;
  }

  L.prepareCharacterLods=async asset=>{
    const full=asset.stats.triangles,meta=asset.meta,expected=bundled[meta.id];
    asset.stats.lodTriangles=[full];
    if(!meta.builtin||!meta.clay||meta.kind!=='human'||!expected||meta.sourceName!==expected.source||meta.sourceTriangles!==expected.sourceTriangles||full!==expected.triangles||asset.meshes.length!==3||asset.meshes.reduce((n,m)=>n+m.geometry.attributes.position.count,0)!==expected.vertices||asset.meshes.reduce((n,m)=>n+(m.geometry.index?.count||0)/3,0)!==full)return asset;
    const prepared=[];let matched=0,total=0,welded=0,sliceStart=performance.now(),yieldCount=0;
    for(const mesh of asset.meshes){
      const geometry=mesh.geometry,index=geometry.index;if(!index||index.count%18)return asset;
      const groups=geometry.groups||[];
      if(groups.some(g=>!Number.isInteger(g.start)||!Number.isInteger(g.count)||g.start<0||g.count<0||g.start%18||g.count%18||g.start+g.count>index.count))return asset;
      const indices=index.array,coarse=[],offsets=new Map();
      for(let start=0;start<indices.length;start+=18){
        offsets.set(start,coarse.length);
        let corners=cornersOf(indices,start,geometry);
        // Five male faces contain duplicate tangent seam vertices with the
        // same position and UV. Weld only for recognizing their topology;
        // the output still references the original, unchanged attributes.
        if(!corners){corners=cornersOf(indices,start,geometry,true);if(corners)welded++;}
        total++;if(corners){matched++;coarse.push(...corners);}else for(let i=start;i<start+18;i++)coarse.push(indices[i]);
        if((total&127)===0&&performance.now()-sliceStart>=6){await yieldToMain();yieldCount++;sliceStart=performance.now();}
      }
      offsets.set(indices.length,coarse.length);
      prepared.push({geometry,index,coarse:new T.BufferAttribute(new indices.constructor(coarse),1),groups:groups.map(g=>({...g,start:offsets.get(g.start),count:offsets.get(g.start+g.count)-offsets.get(g.start)}))});
    }
    asset.stats.lodRecovery={matched,total,welded,yieldCount};
    // A future replacement with a different topology must keep its complete
    // geometry. Publishing only after validation also avoids half-ready LODs.
    // Never mix a partially recovered surface with the full mesh. A single
    // unknown face can leave a visible T-junction, so an unfamiliar asset
    // stays on its authored topology until every face is verified.
    if(!total||matched!==total)return asset;
    for(const {geometry,index,coarse,groups}of prepared){geometry.userData.luxLods=[index,coarse];geometry.userData.luxLodGroups=[geometry.groups||[],groups];}
    asset.stats.lodTriangles=[full,prepared.reduce((n,p)=>n+p.coarse.count/3,0)];
    return asset;
  };
})();
