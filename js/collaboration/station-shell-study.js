/* Original and designed exteriors, cached independently of the live interiors. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,base=new URL('../',document.currentScript.src),loads=new Map();
  // Audited from the unchanged Tiangong asset (SHA256 212c5917fcf3028d...).
  // Count each complete wing once; area includes both large and auxiliary
  // blankets, with opposite faces and thickness excluded.
  const POWER_REFERENCE={area:563.6525094079049,panelCount:12,majorPanelCount:4,majorAreaShare:395.2247326128932/563.6525094079049,layers:[7,8,9,11,12]};
  const ROOM_FOR_ROLE={command:'tianhe',habitat:'habitat',biology:'wentian',physics:'mengtian',cargo:'tianzhou',airlock:'airlock'},TAU=Math.PI*2;
  const outside=(value,min,max)=>Math.max(min-value,0,value-max);
  // Distance to the declared functional region, in the unscaled design frame.
  // Ring halves and decks cannot be picked reliably by their centre alone.
  function slotDistance(slot,point){
    if(slot.bounds)return new T.Box3(new T.Vector3(...slot.bounds.min),new T.Vector3(...slot.bounds.max)).distanceToPoint(point);
    const layout=slot.layout;
    if(!layout)return point.distanceTo(new T.Vector3(...slot.position));
    if(layout.type==='annular-sector'){
      const delta=point.clone().sub(new T.Vector3(...layout.center)),radius=Math.hypot(delta.x,delta.z),angle=(Math.atan2(delta.x,delta.z)+TAU)%TAU,start=layout.startAngle,end=layout.endAngle;
      const inSector=angle>=start&&angle<=end,angleDistance=inSector?0:Math.min(...[start,end].map(edge=>Math.abs(Math.atan2(Math.sin(angle-edge),Math.cos(angle-edge)))));
      return Math.hypot(outside(radius,layout.innerRadius,layout.outerRadius),Math.max(0,Math.abs(delta.y)-layout.height/2),angleDistance*radius);
    }
    if(layout.type==='tower-deck'){
      const delta=point.clone().sub(new T.Vector3(...layout.center));
      return Math.hypot(Math.max(0,Math.hypot(delta.x,delta.z)-layout.outerRadius),Math.max(0,Math.abs(delta.y)-layout.height/2));
    }
    if(layout.type==='axial-zone'||layout.type==='tapered-axial-zone'){
      const axis=new T.Vector3(...layout.axis).normalize(),along=point.dot(axis),radial=point.clone().addScaledVector(axis,-along).length(),[min,max]=layout.range;
      const radius=layout.type==='tapered-axial-zone'?T.MathUtils.lerp(layout.radiusAtMin,layout.radiusAtMax,T.MathUtils.clamp((along-min)/(max-min),0,1)):layout.outerRadius;
      return Math.hypot(outside(along,min,max),Math.max(0,radial-radius));
    }
    if(layout.type==='petal-zone'){
      const radius=Math.hypot(point.x,point.z),angle=Math.atan2(-point.z,point.x)-layout.rotationY,turn=Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)));
      return Math.hypot(outside(radius,...layout.localRadialRange),Math.max(0,turn-Math.PI/6)*radius);
    }
    return point.distanceTo(new T.Vector3(...slot.position));
  }
  function script(path){
    const url=new URL(path,base).href;
    if(!loads.has(url))loads.set(url,new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src=url;tag.onload=resolve;tag.onerror=()=>{loads.delete(url);tag.remove();reject(Error('无法读取外壳方案'));};document.head.appendChild(tag);}));
    return loads.get(url);
  }
  class StationShellStudy {
    constructor(station){this.s=station;this.root=new T.Group();this.root.name='six-bay-shell-studies';this.root.visible=false;station.root.add(this.root);this.pool=[];this.bag=[];this.changed=false;this.bounds=new T.Box3();}
    roomIdFor(slot){return this.current?.plan.kind==='original'?slot.id:ROOM_FOR_ROLE[slot.id]||null;}
    slotPosition(slot){
      const plan=this.current?.plan;
      return new T.Vector3(...slot.position).multiplyScalar(plan?.coordinateScale??1).add(new T.Vector3(...(plan?.coordinateOffset||[0,0,0])));
    }
    pickSlot(raycaster){
      const entry=this.current;if(!this.changed||!this.root.visible||!entry?.model.visible)return null;
      entry.model.updateWorldMatrix(true,true);
      const hit=raycaster.intersectObject(entry.model,true).find(hit=>{for(let object=hit.object;object;object=object.parent){if(!object.visible)return false;if(object===entry.model)break;}return true;});
      if(!hit)return null;
      let moduleId;
      for(let object=hit.object;object;object=object.parent){
        // The foremost visible panel blocks picking; do not click through it
        // into an unrelated cabin on the far side of the station.
        if(object.userData.shellPart==='solar'||object.userData.solarPanelId||object.userData.solarSupportId)return null;
        moduleId??=object.userData.moduleId;
        if(entry.plan.kind==='original'&&object.userData.layerIndex>=7&&object.userData.layerIndex<=13)return null;
        if(object===entry.model)break;
      }
      const material=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex||0]:hit.object.material;
      if(material&&material===window.StationShellKit?.materials.solar)return null;
      const slots=entry.plan.slots;
      if(entry.plan.kind==='original'&&moduleId){const exact=slots.find(slot=>slot.id===moduleId);if(exact)return exact;}
      const point=this.s.root.worldToLocal(hit.point.clone()).sub(new T.Vector3(...entry.plan.coordinateOffset)).divideScalar(entry.plan.coordinateScale||1);
      let nearest=null,distance=Infinity;
      for(const slot of slots){const score=slotDistance(slot,point)+point.distanceTo(new T.Vector3(...slot.position))*1e-6;if(score<distance){distance=score;nearest=slot;}}
      return nearest;
    }
    async prepare(){
      if(this.prepared)return;if(this.preparing)return this.preparing;
      this.preparing=this.buildPool();
      try{await this.preparing;this.prepared=true;}catch(error){for(const entry of this.pool){if(entry.ownsGeometry!==false)entry.model.traverse(o=>o.geometry?.dispose());for(const material of entry.ownedMaterials||[])material.dispose();}this.root.clear();this.pool=[];throw error;}finally{this.preparing=null;}
    }
    async buildPool(){
      if(!T.BufferGeometryUtils)await script('vendor/three-r128/utils/BufferGeometryUtils.js');
      if(!window.StationShellKit)await script('station-designs/kit.js');
      if(!window.StationSixBayDesign)await script('station-designs/six-bay.js');
      if(!window.StationConcepts?.some(d=>d.id==='halo'))await script('station-designs/orbital.js');
      if(!window.StationConcepts?.some(d=>d.id==='spindle'))await script('station-designs/speculative.js');
      if(!window.StationFutureBayDesign)await script('station-designs/future-bays.js');
      if(!window.StationPowerArrays)await script('station-designs/power-arrays.js');
      const design=window.StationSixBayDesign,K=window.StationShellKit;
      this.bounds.makeEmpty();
      const requests=design.families.flatMap((family,index)=>[0,1].map(variant=>({family,seed:7103+index*211+variant*1409,design})));
      requests.push(...window.StationFutureBayDesign.families.map((family,index)=>({family,seed:30001+index,design:window.StationFutureBayDesign})));
      const calibrator=this.createCalibrator();
      try{for(const {family,seed,design:factory}of requests){
        const source=factory.build(K,family.id,seed,{includeSolar:false}),plan=source.userData.sixBayPlan;
        if(plan?.slots?.length!==6)throw Error('外壳方案需要六个舱位');
        const center=new T.Box3().setFromObject(source).getCenter(new T.Vector3());source.position.sub(center);
        // Hulls and power collectors have independent budgets. Never enlarge
        // the cabins to compensate for missing photovoltaic surface area.
        const occupied=calibrator.measure(source,o=>o.material===K.materials.hull),scale=Math.sqrt(this.reference.hullArea*1.12/occupied.area);
        source.scale.setScalar(scale);source.position.copy(center).multiplyScalar(-scale);source.updateMatrixWorld(true);
        let power;
        try{power=window.StationPowerArrays.build(K,source,{family:family.id,seed,targetArea:POWER_REFERENCE.area,pairCount:6,majorPanelCount:POWER_REFERENCE.majorPanelCount,majorAreaShare:POWER_REFERENCE.majorAreaShare});}
        catch(error){const geometries=new Set();source.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});for(const geometry of geometries)geometry.dispose();throw error;}
        const bodyCenter=new T.Box3().setFromObject(source).getCenter(new T.Vector3()),body=K.batch(source);body.position.copy(bodyCenter);body.userData.shellPart='body';
        const model=new T.Group();power.group.userData.shellPart='solar';model.add(body,power.group);model.position.copy(this.reference.center);
        const displayPlan=JSON.parse(JSON.stringify(plan));displayPlan.kind??='modular';
        displayPlan.coordinateScale=scale;displayPlan.coordinateOffset=this.reference.center.clone().addScaledVector(center,-scale).toArray();
        displayPlan.power={...power.metadata,referenceArea:POWER_REFERENCE.area,referencePanelCount:POWER_REFERENCE.panelCount,coordinateSpace:'model-local'};displayPlan.panels=displayPlan.power.panels;
        model.userData.sixBayPlan=displayPlan;model.visible=false;
        // Detailed hulls and panels have baked seams; avoid a moving shadow
        // atlas and expensive shadow passes during the 180 ms display cycle.
        model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
        const entry={family:family.id,seed,plan:displayPlan,model,name:family.name,description:family.description,calibration:{scale,sourceHullArea:occupied.area,referenceHullArea:this.reference.hullArea}};
        this.pool.push(entry);this.root.add(model);this.bounds.union(new T.Box3().setFromObject(model));
        await new Promise(resolve=>setTimeout(resolve,0));
      }this.addOriginal();}finally{calibrator.dispose();}
      // Upload each cached shape before cycling, using an offscreen camera.
      // Neither the real camera nor its OrbitControls are touched here.
      const renderer=this.s.v.renderer,target=new T.WebGLRenderTarget(4,4),previous=renderer.getRenderTarget(),scene=new T.Scene(),camera=new T.PerspectiveCamera(40,1,.1,1000);
      scene.add(new T.HemisphereLight(0xffffff,0x8899aa,1),new T.DirectionalLight(0xffffff,1));camera.position.set(70,60,80);camera.lookAt(this.bounds.getCenter(new T.Vector3()));
      try{for(const entry of this.pool){scene.add(entry.model);entry.model.visible=true;renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(previous);entry.model.visible=false;this.root.add(entry.model);await new Promise(resolve=>setTimeout(resolve,0));}}
      finally{renderer.setRenderTarget(previous);for(const entry of this.pool){entry.model.visible=false;this.root.add(entry.model);}target.dispose();}
    }
    addOriginal(){
      // Keep every original mesh, texture and local transform. Geometry is
      // borrowed, while materials are isolated from live extraction fades.
      const model=this.s.exterior.clone(true),materials=new Map();
      const materialFor=source=>{if(!materials.has(source)){const material=source.clone();material.opacity=1;material.transparent=false;material.depthWrite=true;material.emissive?.set(0);materials.set(source,material);}return materials.get(source);};
      model.traverse(o=>{
        o.visible=true;if(o.userData.moduleId&&!o.isMesh)o.position.set(0,0,0);
        if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(materialFor):materialFor(o.material);o.castShadow=!!o.userData.stationShadow;}
      });
      model.name='原始天宫';model.visible=false;
      const plan={kind:'original',family:'original',seed:0,coordinateScale:1,coordinateOffset:[0,0,0],power:{referenceArea:POWER_REFERENCE.area,totalArea:POWER_REFERENCE.area,referencePanelCount:POWER_REFERENCE.panelCount,panelCount:POWER_REFERENCE.panelCount,majorPanelCount:POWER_REFERENCE.majorPanelCount,sourceLayers:POWER_REFERENCE.layers},slots:C.stationModules.map(m=>({id:m.id,name:m.name,role:m.kind,position:m.anchor.slice(),layoutLabel:m.description}))};
      const entry={family:'original',seed:0,name:'原始天宫',description:'最初的天宫组合，保留原始舱体、太阳翼、尺度与排布。',plan,model,ownsGeometry:false,ownedMaterials:[...materials.values()]};
      this.pool.push(entry);this.root.add(model);this.bounds.union(new T.Box3().setFromObject(model));
    }
    createCalibrator(){
      const renderer=this.s.v.renderer,resolution=384,target=new T.WebGLRenderTarget(resolution,resolution),pixels=new Uint8Array(resolution*resolution*4),scene=new T.Scene(),mask=new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide,toneMapped:false}),camera=new T.OrthographicCamera(-64,64,64,-64,.1,600);
      scene.background=new T.Color(0);scene.overrideMaterial=mask;
      camera.position.set(47,32,58).normalize().multiplyScalar(220);camera.lookAt(0,0,0);
      const measure=(model,filter)=>{
        const proxy=model.clone(true);proxy.visible=true;scene.add(proxy);
        if(filter)proxy.traverse(o=>{if(o.isMesh)o.visible=filter(o);});
        const previous=renderer.getRenderTarget(),shadows=renderer.shadowMap.enabled;
        try{renderer.shadowMap.enabled=false;renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,resolution,resolution,pixels);}
        finally{renderer.setRenderTarget(previous);renderer.shadowMap.enabled=shadows;scene.remove(proxy);}
        let area=0,minX=resolution,minY=resolution,maxX=0,maxY=0;
        for(let i=0;i<pixels.length;i+=4)if(pixels[i]>127){area++;const x=(i/4)%resolution,y=Math.floor(i/4/resolution);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
        if(!area)throw Error('无法校准空间站外壳体量');return{area,span:Math.max(maxX-minX+1,maxY-minY+1)};
      };
      const original=this.s.exterior.clone(true);original.visible=true;
      // Extraction offsets belong to the interactive preview, not its baseline.
      original.traverse(o=>{o.visible=true;if(o.userData.moduleId&&!o.isMesh)o.position.set(0,0,0);});
      const center=new T.Box3().setFromObject(original).getCenter(new T.Vector3());original.position.sub(center);
      this.reference={center,...measure(original),hullArea:measure(original,o=>o.userData.layerIndex===0).area,power:POWER_REFERENCE};
      return{measure,dispose:()=>{target.dispose();mask.dispose();}};
    }
    showNext(){
      if(!this.prepared)return;
      if(!this.bag.length){this.bag=this.pool.slice();for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}}
      // Prefer a different family as well as a different size seed each time.
      let index=this.bag.findIndex(entry=>entry.family!==this.current?.family);if(index<0)index=0;
      if(this.current)this.current.model.visible=false;this.current=this.bag.splice(index,1)[0];this.current.model.visible=true;this.changed=true;this.root.visible=true;
    }
    restore(){if(this.current)this.current.model.visible=false;this.root.visible=false;this.changed=false;}
  }
  C.StationShellStudy=StationShellStudy;
})();
