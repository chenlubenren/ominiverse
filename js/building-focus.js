/* Continuous entry from an extracted storey into the existing indoor workspace. */
(() => {
  'use strict';
  const L=window.IndoorLab,T=THREE,$=id=>document.getElementById(id);
  // Both buildings and station cabins use the same near isometric overview.
  // Fit all eight room corners in perspective, with room beside the model for
  // the observation card, rather than using a city-scale fixed distance.
  L.interiorOverviewPose=(bounds,aspect,fov=40,frame=null)=>{
    const b=bounds||L.TOWER?.bounds||{minX:-18,maxX:18,minZ:-13,maxZ:13};
    const target=new T.Vector3((b.minX+b.maxX)/2,1.2,(b.minZ+b.maxZ)/2);
    const direction=new T.Vector3(1,1,1).normalize(),right=new T.Vector3(1,0,-1).normalize(),up=new T.Vector3(-1,2,-1).normalize();
    const ratio=Math.max(.25,aspect||1),tangent=Math.tan(Math.max(10,Math.min(100,fov))*Math.PI/360),horizontal=ratio>=1.2?.74:.94;
    const cx=frame?(frame.left+frame.right)/2:0,cy=frame?(frame.bottom+frame.top)/2:0;
    const hx=frame?Math.max(.05,(frame.right-frame.left)/2)/1.20:horizontal/1.20,hy=frame?Math.max(.05,(frame.top-frame.bottom)/2)/1.20:1/1.20;
    let distance=0;
    for(const x of [b.minX,b.maxX])for(const y of [b.minY??0,b.maxY??3.65])for(const z of [b.minZ,b.maxZ]){
      const corner=new T.Vector3(x,y,z).sub(target),depth=corner.dot(direction);
      const projectedX=corner.dot(right)/(tangent*ratio),projectedY=corner.dot(up)/tangent;
      distance=Math.max(distance,(projectedX+(cx+hx)*depth)/hx,(-projectedX-(cx-hx)*depth)/hx,(projectedY+(cy+hy)*depth)/hy,(-projectedY-(cy-hy)*depth)/hy);
    }
    distance=Math.max(4,distance);
    // Shift both camera and look-at point together to keep the same angle
    // while placing the room inside the space left by the mobile controls.
    target.addScaledVector(right,-cx*distance*tangent*ratio).addScaledVector(up,-cy*distance*tangent);
    return{position:target.clone().addScaledVector(direction,distance),target};
  };
  // Ceiling fixtures and their lights share the selected floor's world origin.
  // Only this floor gets shadow maps; the transparent tower remains context.
  class FloorPracticalLighting {
    constructor(view){
      this.view=view;this.group=new T.Group();this.group.name='楼层顶灯';
      this.group.userData.noAO=true;this.group.userData.ignoreCollision=true;this.group.visible=false;
      this.housing=new T.MeshStandardMaterial({color:'#e6e9ed',roughness:.8,transparent:true});
      this.diffuser=new T.MeshBasicMaterial({color:'#fff4e6',toneMapped:false,transparent:true});
      const bodyGeometry=new T.BoxGeometry(1.22,.07,.62),lensGeometry=new T.PlaneGeometry(1.12,.52);
      this.lamps=[];
      for(const z of [-7.8,7.8])for(const x of [-13.2,-4.4,4.4,13.2]){
        const fixture=new T.Group(),body=new T.Mesh(bodyGeometry,this.housing),lens=new T.Mesh(lensGeometry,this.diffuser);
        fixture.name='吸顶面板灯';fixture.position.set(x,3.18,z);lens.rotation.x=Math.PI/2;lens.position.y=-.036;fixture.add(body,lens);
        const light=new T.SpotLight('#fff4e6',0,18,Math.PI*.4,.45,1);
        light.position.set(x,3.12,z);light.target.position.set(x,0,z);light.castShadow=true;
        light.shadow.mapSize.set(512,512);light.shadow.camera.near=.1;light.shadow.camera.far=18;
        light.shadow.bias=-.0001;light.shadow.normalBias=.015;
        light.shadow.autoUpdate=false;light.shadow.needsUpdate=true;
        this.group.add(fixture,light,light.target);this.lamps.push({fixture,light});
      }
      view.scene.add(this.group);
    }
    start(origin){
      if(this.sunIntensity===undefined)this.sunIntensity=this.view.sun.intensity;
      this.style=this.view.pipeline?.style;this.group.position.copy(origin);this.group.visible=true;
      this.shadowPending=true;this.view.shadowDirty=true;
    }
    update(strength){
      if(this.sunIntensity===undefined)return;
      const v=this.view;
      if(this.style!==v.pipeline?.style){this.style=v.pipeline?.style;this.sunIntensity=v.sun.intensity;}
      // Replace most of the overhead daylight with local fixtures, keeping the
      // existing exposure and ambient bounce instead of brightening everything.
      v.sun.intensity=this.sunIntensity*(1-.74*strength);
      const intensity=2.5*(this.sunIntensity/2.45)*strength;
      for(const {light}of this.lamps)light.intensity=intensity;
      this.housing.opacity=this.diffuser.opacity=strength;const visible=strength>.001;if(visible&&!this.group.visible)this.shadowPending=true;this.group.visible=visible;
      if(v.contactShadow)v.contactShadow.visible=false;
    }
    stop(){
      if(this.sunIntensity!==undefined)this.view.sun.intensity=this.sunIntensity;
      this.sunIntensity=undefined;this.group.visible=false;this.view.shadowDirty=true;
    }
  }
  class BuildingFloorFocus {
    constructor(building){
      this.b=building;this.active=false;this.strength=0;this.entries=new Map();this.revision=0;this.presentationTime=0;this.presentationAt=performance.now();
      const card=document.createElement('aside');card.id='building-floor-sidebar';card.className='building-focus-card';card.setAttribute('aria-label','楼层观察');card.innerHTML=`<span class="building-kicker" id="focus-kicker">BUILDING / LIVE</span><h2 id="focus-title">整栋建筑</h2><p id="focus-description">首次点击抽出楼层，再次点击进入室内。</p><div class="focus-metrics"><span><b id="focus-people">—</b><small id="focus-people-label">楼内人数</small></span><span><b id="focus-working">—</b><small>正在办公</small></span><span><b id="focus-area">30</b><small id="focus-area-label">楼层</small></span></div><div class="focus-actions"><button id="focus-back">← 整栋建筑</button><button id="focus-interior">进入室内模式 ↗</button></div>`;
      document.body.appendChild(card);card.appendChild($('interior-building-bar'));this.card=card;$('focus-back').onclick=()=>building.closeDrawer();$('focus-interior').onclick=()=>building.enterFloor(building.selected);
      if(L.WhiteAvatar){const setting=document.createElement('label');setting.className='focus-avatar-color';setting.innerHTML='人物颜色 <input id="focus-avatar-color" type="color" aria-label="设置人物颜色">';card.appendChild(setting);$('focus-avatar-color').value=L.WhiteAvatar.base;$('focus-avatar-color').oninput=e=>L.WhiteAvatar.setColor(e.target.value);}
      this.bindInteriorExit();this.bindInteriorZoom();this.syncCard();
      this.installExteriorShadowFilter();
    }
    get engaged(){return this.entries.size>0;}
    get transitioning(){return this.engaged&&this.blend&&this.presentationTime<this.blend.start+this.blend.duration;}
    prepareShadowFrame(now){
      if(!this.engaged)return false;
      const b=this.b,v=b.view,r=v.renderer,rig=this.lighting;
      const dirty=!!(v.shadowDirty||r.shadowMap.needsUpdate);this.shadowPending||=dirty;
      v.shadowDirty=false;r.shadowMap.needsUpdate=false;
      // Neither moving the camera nor changing light intensity changes depth.
      // Cache those maps through the short fade, but invalidate real geometry.
      const quake=b.society?.emergency?.hazard?.physics;
      const geometry=[v.model?.group?.uuid,v.model?.aoVersion||0,v.model?.physicsVersion||0,quake?.batchRevision||0,b.matrixEpoch||0].join(':');
      if(this.shadowGeometryKey!==geometry){this.shadowGeometryKey=geometry;this.geometryShadowPending=true;}
      const robots=L.collaboration?.currentContext(false)?.sim.robots,legacy=L.officeRobots;
      const dynamic=this.interior&&b.app.running&&(robots?.length>0||legacy?.enabled&&legacy.robots.some(robot=>robot.floor===b.selected&&!robot.paused));
      const initial=this.sunShadowPending||rig?.shadowPending&&rig.group.visible;
      const refresh=now>=(this.nextShadowFrame||0)&&(this.geometryShadowPending||!this.transitioning&&(this.shadowPending||dynamic));
      if(!initial&&!refresh){if(dirty)(this.shadowStats??={frames:0,sunUpdates:0,indoorUpdates:0,deferredFrames:0}).deferredFrames++;return true;}
      const stats=this.shadowStats??={frames:0,sunUpdates:0,indoorUpdates:0,deferredFrames:0};
      const sun=this.sunShadowPending||refresh&&!this.isExtracted(b.selected);
      v.sun.shadow.needsUpdate=!!sun;if(sun)stats.sunUpdates++;
      if(this.interior&&rig?.group.visible){for(const {light}of rig.lamps)light.shadow.needsUpdate=true;rig.shadowPending=false;stats.indoorUpdates++;}
      r.shadowMap.needsUpdate=true;stats.frames++;this.sunShadowPending=false;this.shadowPending=false;this.geometryShadowPending=false;this.nextShadowFrame=now+180;
      return true;
    }
    isExtracted(floor){return (this.b.plates[floor-1]?.drawer||0)>0;}
    excludesSunShadow(node){
      if(node.userData.floorFocusOverlay)return this.isExtracted(node.userData.floor);
      if(!this.interior||!this.isExtracted(this.b.selected))return false;
      for(let parent=node;parent;parent=parent.parent)if(parent===this.root)return true;
      return false;
    }
    installExteriorShadowFilter(){
      const focus=this,view=this.b.view,renderer=view.renderer,draw=renderer.renderBufferDirect;
      if(!draw)return;
      // Three r128 has no per-light mesh shadow callback. Filter only draws
      // made by the outdoor sun's shadow camera; normal colour passes and
      // the eight indoor spotlight shadow maps keep their original geometry.
      renderer.renderBufferDirect=function(camera,scene,geometry,material,object,group){
        if(camera===view.sun.shadow.camera&&focus.excludesSunShadow(object))return;
        return draw.call(this,camera,scene,geometry,material,object,group);
      };
      this.exteriorShadowFilterInstalled=true;
    }
    warmInteriorLighting({final=true}={}){
      if(this.lightingWarmed||!final&&this.staticLightingWarmed)return;
      const b=this.b,v=b.view,renderer=v.renderer,target=renderer.getRenderTarget(),autoClear=renderer.autoClear,shadowUpdate=renderer.shadowMap.needsUpdate;
      this.lighting??=new FloorPracticalLighting(v);
      // Prepare the visible tower's eight-light variants while models download.
      // The canonical per-floor meshes stay hidden behind their shared batches;
      // Three r128's default compile traversal otherwise includes all of them.
      // The final pass adds the real skin/hair variants before releasing boot.
      // Match the linear offscreen target used by the building composer.
      const visible=this.lighting.group.visible,room=v.model?.group,roomVisible=room?.visible,roomCulling=[],start=performance.now(),programsBefore=renderer.info?.programs?.length;
      try{
        this.lighting.group.visible=true;if(room){room.visible=true;room.traverse(node=>{if(node.isMesh){roomCulling.push([node,node.frustumCulled]);node.frustumCulled=false;}});}
        renderer.setRenderTarget(b.composer.renderTarget1);
        const traverse=v.scene.traverse,compileStart=performance.now(),shadowCasters=[];let compiledObjects=0;
        try{v.scene.traverse=callback=>v.scene.traverseVisible(node=>{if(node.material)compiledObjects++;if(node.castShadow&&node.geometry)shadowCasters.push(node.uuid+':'+node.geometry.uuid+':'+(node.count??1));callback(node);});renderer.compile(v.scene,v.camera);}finally{v.scene.traverse=traverse;}
        const compileMs=performance.now()-compileStart;
        // Exercise the compiled programs and allocate shadow maps before the
        // loading screen leaves; compile alone does not upload these resources.
        // The final character batches do not cast shadows. Reuse the maps
        // allocated by the architecture pass; entering/moving a real floor
        // still invalidates them through the normal shadow scheduler.
        const shadowKey=shadowCasters.join('|')+':'+(v.model?.aoVersion||0)+':'+(b.matrixEpoch||0),shadowWarmup=!this.staticLightingWarmed||this.warmupShadowKey!==shadowKey;
        renderer.autoClear=true;renderer.shadowMap.needsUpdate=shadowWarmup;
        if(shadowWarmup)for(const {light}of this.lighting.lamps)light.shadow.needsUpdate=true;
        const renderStart=performance.now();renderer.render(v.scene,v.camera);const renderMs=performance.now()-renderStart;
        (this.lightingWarmupStats??=[]).push({phase:final?'complete':'architecture',startMs:start,compileMs,renderMs,totalMs:performance.now()-start,compiledObjects,shadowWarmup,programsBefore,programsAfter:renderer.info?.programs?.length});
        this.staticLightingWarmed=true;this.warmupShadowKey=shadowKey;if(final)this.lightingWarmed=true;
      }finally{this.lighting.group.visible=visible;if(room)room.visible=roomVisible;for(const [node,culled]of roomCulling)node.frustumCulled=culled;renderer.autoClear=autoClear;renderer.shadowMap.needsUpdate=shadowUpdate;renderer.setRenderTarget(target);}
    }
    warmInteriorObjects(root){
      this.warmedInteriorObjects??=new WeakSet();if(!root||this.warmedInteriorObjects.has(root))return;
      const v=this.b.view,r=v.renderer,scene=new T.Scene(),samples=[],lights=new Set(),start=performance.now();
      scene.fog=v.scene.fog;scene.environment=v.scene.environment;
      // Late robot/cargo batches arrive after the main loading screen. Compile
      // their actual materials with the indoor lights, keeping those materials
      // alive on the fleet so their warmed programs survive the next floor load.
      const addLight=source=>{if(lights.has(source))return;lights.add(source);const light=source.clone();if(light.shadow)light.shadow.map=source.shadow.map;scene.add(light);if(light.target)scene.add(light.target);};
      v.scene.traverseVisible(node=>{if(node.isLight)addLight(node);});
      this.lighting??=new FloorPracticalLighting(v);for(const {light}of this.lighting.lamps)addLight(light);
      root.traverseVisible(node=>{if(!node.isMesh||!node.geometry||!node.material)return;
        const mesh=node.isInstancedMesh?new T.InstancedMesh(node.geometry,node.material,1):new T.Mesh(node.geometry,node.material);
        if(node.instanceColor)mesh.instanceColor=node.instanceColor;mesh.receiveShadow=node.receiveShadow;mesh.frustumCulled=false;samples.push(mesh);scene.add(mesh);
      });
      if(!samples.length)return;
      const target=r.getRenderTarget(),autoClear=r.autoClear,shadowUpdate=r.shadowMap.needsUpdate,programsBefore=r.info?.programs?.length;
      try{
        r.setRenderTarget(this.b.composer.renderTarget1);r.autoClear=true;r.shadowMap.needsUpdate=false;
        r.compile(scene,v.camera);r.render(scene,v.camera);this.warmedInteriorObjects.add(root);
        (this.objectLightingWarmupStats??=[]).push({name:root.name,meshes:samples.length,totalMs:performance.now()-start,programsBefore,programsAfter:r.info?.programs?.length});
      }finally{r.autoClear=autoClear;r.shadowMap.needsUpdate=shadowUpdate;r.setRenderTarget(target);for(const mesh of samples)mesh.dispose?.();}
    }
    reducedMotion(){return L.collaboration?.reducedSceneMotion()??matchMedia('(prefers-reduced-motion: reduce)').matches;}
    canZoomInterior(){
      const b=this.b,v=b.view,c=L.collaboration;
      return this.interior&&b.phase==='interior'&&v.controls.enabled&&v.controls.enableZoom!==false&&!['walk','human'].includes(v.view)&&!b.continuous?.active&&(!c||c.environment==='office'&&!c.switching);
    }
    beginInteriorZoom(){
      if(this.zoomLimit!==undefined||!this.canZoomInterior())return;
      const v=this.b.view;this.zoomLimit=v.controls.maxDistance;
      v.controls.maxDistance=Math.min(this.zoomLimit,this.interiorZoomMax??v.camera.position.distanceTo(v.controls.target));
    }
    endInteriorZoom(){
      if(this.zoomLimit===undefined)return;
      this.b.view.controls.maxDistance=this.zoomLimit;this.zoomLimit=undefined;
    }
    resetInteriorZoomBaseline(position=this.b.view.camera.position,target=this.b.view.controls.target){
      this.endInteriorZoom();
      this.interiorZoomMax=this.interior?position.distanceTo(target):undefined;
    }
    bindInteriorZoom(){
      const v=this.b.view,canvas=v.renderer.domElement;if(!canvas)return;
      // Each framing pose supplies one fixed outer limit. Zooming closer must
      // not tighten it: every gesture can return to the original room framing.
      // Apply it only to input so camera presets and transitions remain free.
      canvas.addEventListener('wheel',event=>{
        if(event.deltaY!==0)this.beginInteriorZoom();
      },{capture:true,passive:true});
      canvas.addEventListener('pointerdown',event=>{if(event.button===1)this.beginInteriorZoom();},true);
      v.controls.addEventListener('end',()=>this.endInteriorZoom());
      (canvas.ownerDocument||document).addEventListener('pointercancel',()=>this.endInteriorZoom(),true);
      (canvas.ownerDocument||document).addEventListener('pointerup',event=>{if(event.button===1)this.endInteriorZoom();},true);
    }
    canExitInterior(){
      const b=this.b,v=b.view,c=L.collaboration;
      return this.interior&&b.phase==='interior'&&!b.loading&&!b.app.busy&&!b.matrixLab?.busy&&v.controls.enabled&&
        !['walk','human'].includes(v.view)&&!v.firstPerson?.locked&&!document.pointerLockElement&&
        (!c||c.environment==='office'&&!c.switching&&!c.robotInteraction?.pending&&!c.robotInteraction?.draft&&!c.chat?.picking&&!c.chat?.editing&&!c.chat?.commands?.busy)&&!document.querySelector?.('dialog[open]');
    }
    isInteriorPeripheral(event){
      const v=this.b.view,canvas=v.renderer.domElement,rect=canvas.getBoundingClientRect(),ray=new T.Raycaster();
      v.scene.updateMatrixWorld(true);v.camera.updateWorldMatrix(true,false);
      ray.setFromCamera(new T.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),v.camera);
      // Protect the room's volume, including empty floor and upper furniture.
      // Its ray may miss the ground while still touching a desk or a person.
      const b=v.model.bounds||v.bounds||L.TOWER?.bounds||{minX:-18,maxX:18,minZ:-13,maxZ:13},local=ray.ray.clone();local.origin.sub(this.origin);
      const room=new T.Box3(new T.Vector3(b.minX-.15,b.minY??-.35,b.minZ-.15),new T.Vector3(b.maxX+.15,b.maxY??3.65,b.maxZ+.15));
      if(local.intersectsBox(room)||v.pickAgent?.(ray.ray))return false;
      const context=L.collaboration?.currentContext(false),roots=[v.model.group,v.avatarGroup,context?.world.root].filter(Boolean);
      for(const hit of ray.intersectObjects(roots,true)){
        let visible=true;for(let p=hit.object;p;p=p.parent)if(!p.visible){visible=false;break;}
        if(visible)return false;
      }
      return true;
    }
    bindInteriorExit(){
      const canvas=this.b.view.renderer.domElement;if(!canvas)return;
      let gesture=null;
      canvas.addEventListener('pointerdown',event=>{
        if(event.isPrimary===false||event.button!==0){gesture=null;return;}
        gesture={id:event.pointerId,x:event.clientX,y:event.clientY,distance:0,eligible:this.canExitInterior(),peripheral:false};
      },true);
      // OrbitControls tracks drags on the document, including excursions off
      // the canvas. Follow that same path before accepting a click on return.
      (canvas.ownerDocument||document).addEventListener('pointermove',event=>{if(gesture&&event.pointerId===gesture.id)gesture.distance=Math.max(gesture.distance,Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y));},true);
      (canvas.ownerDocument||document).addEventListener('pointercancel',()=>{gesture=null;},true);
      canvas.addEventListener('pointerup',event=>{
        if(!gesture||event.pointerId!==gesture.id||!gesture.eligible||!this.canExitInterior())return;
        gesture.distance=Math.max(gesture.distance,Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y));
        gesture.peripheral=gesture.distance<=5&&event.button===0&&this.isInteriorPeripheral(event);
        // Scene selection listens on pointerup. An outside click belongs only
        // to navigation; a completed orbit gesture must not select a person.
        if(gesture.peripheral||gesture.distance>5)event.indoorNavigationHandled=true;
      },true);
      canvas.addEventListener('click',event=>{
        const down=gesture;gesture=null;if(!down?.eligible||!this.canExitInterior())return;
        if(down.distance>5){event.preventDefault();event.stopImmediatePropagation();return;}
        if(!down.peripheral||event.button!==0||event.detail>1)return;
        event.preventDefault();event.stopImmediatePropagation();this.returnToOverview();
      },true);
    }
    focus(floor){
      const b=this.b;if(!['intro','overview','interior'].includes(b.phase)||b.loading||b.matrixLab?.busy)return;
      if(b.matrixLab?.active){b.matrixLab.stop().then(()=>this.focus(floor));return;}
      if(this.active&&b.selected===floor&&this.entries.has(floor))return;
      b.cameraTween=null;
      if(!this.engaged){
        this.overview={position:b.view.camera.position.clone(),target:b.view.controls.target.clone(),up:b.view.camera.up.clone(),fov:b.view.camera.fov,min:b.view.controls.minDistance,max:b.view.controls.maxDistance};
        this.prepareContext();
      }
      this.active=true;b.selected=floor;
      if(!this.entries.has(floor)){this.entries.set(floor,{weight:this.strength===0?1:0,parts:new Map()});this.revision++;}
      this.startBlend();document.body.dataset.buildingFocus='true';
      this.syncCard();b.updateTowerBatches(true);
    }
    frame(animate=true){
      if(!this.active)return;
      const b=this.b,v=b.view,p=b.plates[b.selected-1].group;
      if(this.interior){
        const pose=L.interiorOverviewPose(v.model.bounds||v.bounds,v.camera.aspect,40);
        v.view='perspective';v.controls.enableRotate=true;this.moveCamera(pose.position,pose.target,animate,{up:new T.Vector3(0,1,0),fov:40,duration:420});return;
      }
      b.world.updateMatrixWorld(true);const center=p.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,1.6,0));
      if(this.interior)center.sub(this.origin);
      const halfFov=Math.atan(Math.tan(v.camera.fov*Math.PI/360)*Math.min(1,v.camera.aspect));
      const comfortable=24/Math.sin(halfFov)*1.18,distance=v.camera.position.distanceTo(center);
      // Keep nearby views exactly as the user left them. A distant view only
      // moves toward the floor; translate its orbit target equally to avoid a turn.
      if(distance<=comfortable*1.65)return;
      const end=center.clone().addScaledVector(v.camera.position.clone().sub(center),comfortable/distance);
      const to=v.controls.target.clone().add(end.clone().sub(v.camera.position));
      this.moveCamera(end,to,animate);
    }
    moveCamera(end,to,animate=true,{up,fov,duration=650}={}){
      const b=this.b,v=b.view;
      this.resetInteriorZoomBaseline(end,to);
      // Flush OrbitControls' residual damping before starting a deterministic camera path.
      const damping=v.controls.enableDamping;v.controls.enableDamping=false;v.controls.update();v.controls.enableDamping=damping;
      if(animate&&!this.reducedMotion())b.cameraTween={start:null,duration,position:v.camera.position.clone(),target:v.controls.target.clone(),end,to,up:v.camera.up.clone(),endUp:up||v.camera.up.clone(),fov:v.camera.fov,endFov:fov??v.camera.fov};
      else{b.cameraTween=null;v.camera.position.copy(end);v.controls.target.copy(to);if(up)v.camera.up.copy(up);if(fov!==undefined&&v.camera.fov!==fov){v.camera.fov=fov;v.camera.updateProjectionMatrix();}v.controls.update();}
    }
    startBlend(duration=850){this.presentationAt=performance.now();this.blend={start:this.presentationTime,duration,strength:this.strength,weights:new Map([...this.entries].map(([f,e])=>[f,e.weight]))};}
    close({immediate=false}={}){
      if(this.interior){this.returnToOverview(!immediate);return;}
      if(!this.engaged)return;
      this.active=false;document.body.dataset.buildingFocus='false';this.startBlend(340);
      this.b.cameraTween=null;
      const v=this.b.view,distance=v.camera.position.distanceTo(v.controls.target);v.controls.minDistance=Math.min(this.overview.min,distance);v.controls.maxDistance=Math.max(this.overview.max,distance);
      if(immediate){this.strength=0;this.release();this.b.updateTowerBatches(true);}
      this.syncCard();this.b.syncExplode();
    }
    capturePresentation(){
      const v=this.b.view;return{camera:v.captureCameraState(),controls:{minDistance:v.controls.minDistance,maxDistance:v.controls.maxDistance},near:v.camera.near,far:v.camera.far,fov:v.camera.fov,background:v.scene.background.clone(),fog:v.scene.fog.clone(),exposure:v.renderer.toneMappingExposure,lights:v.scene.children.filter(o=>o.isLight).map(light=>({light,position:light.position.clone(),intensity:light.intensity,color:light.color.clone()})),sunTarget:v.sun.target.position.clone(),shadow:Object.fromEntries(['left','right','top','bottom','near','far'].map(k=>[k,v.sun.shadow.camera[k]]))};
    }
    restorePresentation(saved){
      const v=this.b.view;Object.assign(v.camera,{near:saved.near,far:saved.far,fov:saved.fov});v.camera.updateProjectionMatrix();v.scene.background.copy(saved.background);v.scene.fog=saved.fog;v.renderer.toneMappingExposure=saved.exposure;
      for(const {light,position,intensity,color}of saved.lights){light.position.copy(position);light.intensity=intensity;light.color.copy(color);}v.sun.target.position.copy(saved.sunTarget);Object.assign(v.sun.shadow.camera,saved.shadow);v.sun.shadow.camera.updateProjectionMatrix();Object.assign(v.controls,saved.controls);v.restoreCameraState(saved.camera);v.shadowDirty=true;
    }
    mountInterior(){
      const b=this.b,v=b.view;this.origin=b.plates[b.selected-1].group.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.17,0));
      this.root??=new T.Group();this.root.name='Floor coordinate frame';this.root.position.copy(this.origin);v.scene.add(this.root);this.root.visible=true;this.interior=true;v.floorOrigin=this.origin;
      // Indoor simulation stays in floor-local coordinates. The camera and its
      // scene share that frame, preserving every world-space building transform.
      this.cameraParent=v.camera.parent;this.root.add(v.camera);v.camera.position.sub(this.origin);v.controls.target.sub(this.origin);
      this.originalLookAt=v.camera.lookAt;const focus=this;v.camera.lookAt=function(x,y,z){const target=x?.isVector3?x.clone():new T.Vector3(x,y,z);return focus.originalLookAt.call(this,target.add(focus.origin));};
      this.syncRoot();v.floorPlane.constant=-this.origin.y;v.model.group.visible=true;v.avatarGroup.visible=true;v.ground.visible=false;v.contextGrid.visible=false;v.camera.near=.05;v.camera.updateProjectionMatrix();v.controls.minDistance=Math.min(this.overview.min,v.camera.position.distanceTo(v.controls.target));v.controls.maxDistance=Math.max(this.overview.max,v.camera.position.distanceTo(v.controls.target));v.controls.enabled=true;if(!['perspective','detail','top'].includes(v.view))v.view='perspective';
      this.lighting??=new FloorPracticalLighting(v);this.lighting.start(this.origin);this.lighting.update(this.strength);
      this.root.updateMatrixWorld(true);v.controls.update();this.revision++;b.updateTowerBatches(true);this.frame();
    }
    localNodes(){const v=this.b.view;return[v.model?.group,v.avatarGroup,v.goalGroup,v.heatGroup,v.overlayGroup,v.observation?.group,v.gridLines,v.contactShadow,v.cellHighlight,v.rescueVisual,v.disasterRenderer?.group,v.infectionRenderer?.group,this.b.journey?.context,this.b.journey?.cabin].filter(Boolean);}
    syncRoot(){for(const node of this.localNodes())if(node.parent!==this.root)this.root.add(node);}
    unmountInterior(){
      if(!this.interior)return;const v=this.b.view;
      this.endInteriorZoom();this.interiorZoomMax=undefined;
      if(v.view==='human'){const direction=v.camera.getWorldDirection(new T.Vector3());v.controls.target.copy(v.camera.position).addScaledVector(direction,20);v.view='perspective';}
      this.interior=false;v.floorOrigin=null;
      v.camera.lookAt=this.originalLookAt;v.camera.position.add(this.origin);v.controls.target.add(this.origin);
      this.root.remove(v.camera);if(this.cameraParent)this.cameraParent.add(v.camera);
      for(const node of [...this.root.children])v.scene.add(node);v.scene.remove(this.root);v.floorPlane.constant=0;this.revision++;v.controls.update();
    }
    showInteriorUI(){
      const b=this.b,v=b.view;b.phase='interior';document.body.dataset.buildingPhase='interior';b.ui.hidden=true;$('interior-building-bar').hidden=false;
      for(const [key,id]of [['heatGroup','heat-visible'],['overlayGroup','obstacles-visible'],['trailMesh','trails-visible'],['visionMesh','vision-visible']])if(v[key])v[key].visible=$(id).checked;
      if(v.gridLines)v.gridLines.visible=true;if(v.contactShadow)v.contactShadow.visible=false;
      $('interior-floor-select').value=String(b.selected);$('interior-floor-label').textContent=`SPATIAL SIMULATION / ${String(b.selected).padStart(2,'0')}F`;
      if(v.observation)v.observation.group.visible=true;if(v.disasterRenderer)v.disasterRenderer.group.visible=true;if(v.infectionRenderer)v.infectionRenderer.group.visible=true;
      b.world.visible=true;b.drawerGuide.visible=false;b.selection.visible=false;this.syncCard();v.shadowDirty=true;
    }
    returnToOverview(animate=true){
      const b=this.b,v=b.view,home=this.overview;this.unmountInterior();b.phase='overview';document.body.dataset.buildingPhase='overview';b.ui.hidden=false;$('interior-building-bar').hidden=true;
      b.journey?.cancel();if(!['perspective','detail','top'].includes(v.view))v.view='perspective';v.controls.enabled=true;v.camera.near=.5;v.camera.updateProjectionMatrix();
      for(const node of this.localNodes())node.visible=false;v.agentBubbles?.group&&(v.agentBubbles.group.visible=false);
      document.body.classList.remove('office-society-mode');b.app.play(false);b.society.running=true;b.world.visible=true;this.close({immediate:!animate});
      if(home){v.controls.enableRotate=true;this.moveCamera(home.position.clone(),home.target.clone(),animate,{up:home.up?.clone()||new T.Vector3(0,1,0),fov:home.fov??40,duration:420});}
    }
    leaveForWalk(){
      const b=this.b;this.unmountInterior();this.close({immediate:true,restoreCamera:false});b.world.visible=false;
    }
    cloneMaterial(source){
      const material=source.clone();material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=source.customProgramCacheKey;return material;
    }
    prepareContext(){
      this.sunShadowAutoUpdate=this.b.view.sun.shadow.autoUpdate;this.b.view.sun.shadow.autoUpdate=false;this.sunShadowPending=true;this.shadowGeometryKey=null;
      this.contextNodes=[];this.contextMaterials=new Map();this.originalMaterials=new Map();this.contextSeen=new WeakSet();this.canonicalFloors=new Set(this.b.plates.map(p=>p.group));
      this.captureContext();
    }
    captureContext(){
      for(const root of [this.b.world,L.megastructureFleet?.group].filter(Boolean))root.traverse(node=>{
        if(!node.material||this.contextSeen.has(node)||node.userData.floorFocusOverlay||node===this.b.selection||node===this.b.drawerGuide)return;
        for(let parent=node;parent;parent=parent.parent)if(this.canonicalFloors.has(parent))return;
        this.contextSeen.add(node);
        const original=node.material,materials=Array.isArray(original)?original:[original];
        const copies=materials.map(source=>{if(!this.contextMaterials.has(source)){const material=this.cloneMaterial(source);this.contextMaterials.set(source,{source,material});this.originalMaterials.set(material,source);}return this.contextMaterials.get(source).material;});
        this.contextNodes.push({node,original,castShadow:node.castShadow,renderOrder:node.renderOrder});node.material=Array.isArray(original)?copies:copies[0];
      });
    }
    beginBatches(){for(const entry of this.entries.values())for(const part of entry.parts.values())part.mesh.count=0;}
    writeInstance(batch,item,matrix){
      const floor=item.plate.group.userData.floor,entry=this.entries.get(floor);if(!entry)return false;
      if(this.interior&&floor===this.b.selected&&item.interior)return true;
      const key=batch.mesh.uuid+':'+Number(item.facade);let part=entry.parts.get(key);
      if(!part){
        const source=this.originalMaterials.get(batch.mesh.material)||batch.mesh.material,material=this.cloneMaterial(source);
        const capacity=batch.items.filter(i=>i.plate===item.plate&&i.facade===item.facade).length;
        const mesh=new T.InstancedMesh(batch.mesh.geometry,material,capacity);mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
        mesh.userData.floor=floor;mesh.userData.floorFocusOverlay=true;this.b.tower.add(mesh);this.b.pickable.push(mesh);
        const castShadow=this.contextNodes.find(record=>record.node===batch.mesh)?.castShadow??batch.mesh.castShadow;
        part={mesh,material,source,castShadow,facade:item.facade};entry.parts.set(key,part);
      }
      part.mesh.setMatrixAt(part.mesh.count++,matrix);return true;
    }
    endBatches(){for(const entry of this.entries.values())for(const part of entry.parts.values())part.mesh.instanceMatrix.needsUpdate=true;}
    opacity(material,source,factor){
      const transparent=source.transparent||factor<.999,depthWrite=source.depthWrite&&!transparent;
      if(material.transparent!==transparent||material.depthWrite!==depthWrite){material.transparent=transparent;material.depthWrite=depthWrite;material.needsUpdate=true;}
      material.opacity=source.opacity*factor;
    }
    update(now){
      // Keep opacity changes gradual across long frames. The entry camera has
      // its own clock so low frame rates do not stretch a short turn into seconds.
      this.presentationTime+=Math.min(100,Math.max(0,now-this.presentationAt));this.presentationAt=now;
      if(this.interior)this.syncRoot();
      if(now>(this.nextCard||0)){this.syncCard();this.nextCard=now+400;}
      if(!this.engaged)return;
      if(now>(this.nextCapture||0)){this.captureContext();this.nextCapture=now+400;}
      const reduced=this.reducedMotion();
      const u=reduced?1:Math.min(1,(this.presentationTime-this.blend.start)/this.blend.duration),ease=u*u*u*(u*(u*6-15)+10);
      this.strength=this.blend.strength+((this.active?1:0)-this.blend.strength)*ease;
      this.lighting?.update(this.strength);
      const context=1-this.strength;
      // The live floor and its lights have their own scene roots. Hide the
      // fully faded exterior to remove its draw calls, then reveal it on exit.
      this.b.world.visible=!this.interior||context>0;
      for(const {source,material}of this.contextMaterials.values())this.opacity(material,source,context);
      for(const record of this.contextNodes){record.node.castShadow=false;record.node.renderOrder=this.strength>.001?2:record.renderOrder;}
      for(const [floor,entry]of this.entries){
        const from=this.blend.weights.get(floor)??0,target=this.active&&floor===this.b.selected?1:0;entry.weight=from+(target-from)*ease;
        for(const {mesh,material,source,castShadow,facade}of entry.parts.values()){
          const factor=(context+(1-context)*entry.weight)*(facade?1-.94*this.strength*entry.weight:1);
          this.opacity(material,source,factor);mesh.renderOrder=material.transparent?1:0;
          mesh.castShadow=castShadow&&!facade&&floor===this.b.selected;
        }
        if(u===1&&this.active&&floor!==this.b.selected){this.disposeEntry(entry);this.entries.delete(floor);this.revision++;}
      }
      if(u===1&&!this.active){this.release();this.b.updateTowerBatches(true);}
    }
    disposeEntry(entry){for(const {mesh,material}of entry.parts.values()){this.b.tower.remove(mesh);this.b.pickable=this.b.pickable.filter(o=>o!==mesh);mesh.dispose?.();material.dispose();}}
    release(){
      this.endInteriorZoom();this.interiorZoomMax=undefined;
      this.lighting?.stop();
      for(const entry of this.entries.values())this.disposeEntry(entry);this.entries.clear();
      for(const {node,original,castShadow,renderOrder}of this.contextNodes||[]){node.material=original;node.castShadow=castShadow;node.renderOrder=renderOrder;}
      for(const {material}of this.contextMaterials?.values()||[])material.dispose();
      this.contextNodes=[];this.contextMaterials?.clear();this.originalMaterials?.clear();this.blend=null;this.revision++;this.b.view.shadowDirty=true;
      this.b.view.sun.shadow.autoUpdate=this.sunShadowAutoUpdate??true;this.b.view.sun.shadow.needsUpdate=true;this.sunShadowPending=false;this.shadowPending=false;this.geometryShadowPending=false;
    }
    syncCard(){
      const b=this.b,indoor=b.phase==='interior',focused=indoor||this.active||b.drawerFloor===b.selected,spec=L.towerFloorSpec(b.selected),people=b.society.agents.filter(a=>!a.isPlayer&&!['dead','zombie','turning'].includes(a.health)&&a.location==='floor'&&(!focused||Math.round(a.floor)===b.selected));
      $('focus-kicker').textContent=indoor?`INTERIOR / ${String(b.selected).padStart(2,'0')}F / LIVE`:focused?`FLOOR / ${String(b.selected).padStart(2,'0')}F / LIVE`:'BUILDING / LIVE';
      $('focus-title').textContent=focused?`${String(b.selected).padStart(2,'0')}F · ${spec.company}`:'整栋建筑';
      $('focus-description').textContent=focused?spec.family+' · '+spec.centralName:'首次点击抽出楼层，再次点击进入室内。';
      $('focus-people').textContent=people.length;$('focus-people-label').textContent=focused?'本层人数':'楼内人数';$('focus-working').textContent=people.filter(a=>a.activity==='work').length;
      $('focus-area').textContent=focused?spec.area:30;$('focus-area-label').textContent=focused?'面积 / ㎡':'楼层';
      this.card.querySelector('.focus-actions').hidden=indoor||!focused;
      $('interior-building-bar').hidden=!indoor;
      if(this.active){$('building-title').textContent=`聚焦 ${String(b.selected).padStart(2,'0')}F`;$('building-subtitle').textContent=indoor?'拖动环视 · 滚轮缩放 · 点击楼层外退出':'拖动环视 · 滚轮缩放 · 返回整栋建筑';$('building-step').textContent=String(b.selected).padStart(2,'0');}
    }
  }
  L.BuildingFloorFocus=BuildingFloorFocus;
})();
