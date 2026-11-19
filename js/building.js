/* Building overview, camera-only floor focus, and the simulated interior workspace. */
(() => {
  'use strict';const L=window.IndoorLab,$=id=>document.getElementById(id);
  const THEMES=L.THEMES;
  class BuildingExperience {
    constructor(){
      this.app=L.app;this.view=this.app.view;this.phase='intro';this.selected=1;this.drawerFloor=null;this.exploded=false;this.mix=0;this.cameraTween=null;this.loading=false;this.pointer=null;this.lastFloorHit=null;
      this.world=new THREE.Group();this.world.name='SPATIAL SIMULATION';this.view.scene.add(this.world);this.plates=[];this.pickable=[];this.createWorld();this.society=new L.OfficeSociety(this);this.siteCrowd=new L.SiteArrivalCrowd(this.world,{society:this.society});this.createUI();this.createSocietyVisuals();this.floorFocus=new L.BuildingFloorFocus(this);
      this.indoorAmbient=this.view.scene.children.filter(o=>o.isHemisphereLight||o.isAmbientLight).map(light=>({light,intensity:light.intensity}));
      this.indoorShadow={bias:this.view.sun.shadow.bias,normalBias:this.view.sun.shadow.normalBias};
      this.aoEnabled=true;
      // City-scale AO has its own radius and high-precision depth, separate from indoor furniture AO.
      this.composer=new THREE.EffectComposer(this.view.renderer);
      // Default offscreen depth is too coarse at city scale: recessed glass can overwrite fins and roads.
      for(const target of [this.composer.renderTarget1,this.composer.renderTarget2])target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
      const beauty=new THREE.Pass();beauty.render=(renderer,writeBuffer)=>{renderer.setRenderTarget(beauty.renderToScreen?null:writeBuffer);renderer.clear();renderer.render(this.view.scene,this.view.camera);};
      this.beautyPass=beauty;
      this.aoPass=new THREE.SSAOPass(this.view.scene,this.view.camera,256,256);
      this.aoPass.beautyRenderTarget.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
      this.aoPass.normalRenderTarget.depthTexture.type=THREE.UnsignedIntType;
      this.aoPass.kernelRadius=3.1;
      this.aoPass.ssaoMaterial.uniforms.aoStrength={value:.74};this.aoPass.ssaoMaterial.uniforms.aoFadeNear={value:300};this.aoPass.ssaoMaterial.uniforms.aoFadeFar={value:490};
      this.aoPass.ssaoMaterial.fragmentShader=this.aoPass.ssaoMaterial.fragmentShader.replace('uniform float kernelRadius;','uniform float aoStrength;\n uniform float aoFadeNear;\n uniform float aoFadeFar;\n uniform float kernelRadius;').replace('float depth = getDepth( vUv );','float depth = getDepth( vUv ); if (depth >= 0.999999) { gl_FragColor = vec4(1.0); return; }').replace('vec3( 1.0 - occlusion )','vec3( max( 0.25, 1.0 - occlusion * aoStrength * (1.0 - smoothstep(aoFadeNear, aoFadeFar, -viewZ)) ) )');
      const overrideAO=this.aoPass.overrideVisibility.bind(this.aoPass);
      this.aoPass.overrideVisibility=()=>{overrideAO();this.view.scene.traverse(o=>{if(o.isSprite||o.userData.noAO||(o.material?.transparent&&o.material.opacity<.6))o.visible=false;});};
      L.cacheStaticAO(this.aoPass,()=>this.aoCacheKey());
      // Both the building and campus use offscreen passes, outside canvas MSAA.
      // Keep edge filtering after gamma correction, including the indoor fade.
      this.composer.addPass(beauty);this.composer.addPass(this.aoPass);this.composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));this.fxaa=new THREE.ShaderPass(THREE.FXAAShader);this.fxaa.enabled=true;this.composer.addPass(this.fxaa);
      this.renderSize=new THREE.Vector2();
      const originalRender=this.view.render.bind(this.view);this.view.render=()=>{
        this.update();L.eventIntegration?.presentFrame();
        // Wait until both office downloads have actually started before using
        // their network time to prepare architecture lighting. The final pass
        // still includes real character batches from updateSocietyVisuals.
        const assets=L.characterAssets;
        if(!assets?.loadingBuiltins)this.floorFocus.warmInteriorLighting();
        else if(assets.officeDownloadsStarted)this.floorFocus.warmInteriorLighting({final:false});
        if(this.phase==='interior'&&!this.floorFocus?.interior)originalRender();
        else{if(this.floorFocus?.interior){this.view.updateRescueVisual();this.view.disasterRenderer?.update();this.view.agentBubbles?.update(this.view.currentAgents);}this.renderBuilding();}
        // The welcome screen covers both destinations: entering the app must
        // not defer the station's first model download to the scene button.
        if(this.floorFocus.lightingWarmed){document.body.dataset.officeReady='true';if(L.stationStartup?.ready&&document.body.dataset.buildingReady!=='true')document.body.dataset.buildingReady='true';}
      };
      this.view.renderer.domElement.addEventListener('pointerdown',e=>{this.pointer={x:e.clientX,y:e.clientY};});
      this.view.renderer.domElement.addEventListener('click',e=>{
        if(this.phase!=='overview'||!this.pointer||e.button!==0||e.detail>1||Math.hypot(e.clientX-this.pointer.x,e.clientY-this.pointer.y)>5)return;
        const floor=this.pickFloor(e);if(floor===null){this.closeDrawer();return;}
        this.lastFloorHit={floor,x:e.clientX,y:e.clientY};this.select(floor);
      });
      this.view.renderer.domElement.addEventListener('dblclick',e=>{
        if(this.phase!=='overview'||this.loading)return;e.preventDefault();
        // Keep the first click's floor while the camera travels toward it.
        const previous=this.lastFloorHit,floor=previous&&Math.hypot(e.clientX-previous.x,e.clientY-previous.y)<9?previous.floor:this.pickFloor(e);
        if(floor!==null)this.enterFloor(floor);
      });
      document.addEventListener('click',e=>{
        const theme=e.target.closest('[data-building-theme-choice]');if(theme){this.setRenderStyle(theme.dataset.buildingThemeChoice);return;}
        if(this.phase==='overview'&&!e.target.closest('canvas,button,a,input,select,textarea,aside,dialog,[data-floor]'))this.closeDrawer();
      });
      window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable)return;if(e.key==='Escape'&&this.phase==='interior')this.setPhase('overview');else if(e.key==='Escape'&&this.phase==='overview')this.closeDrawer();});
      window.addEventListener('resize',()=>{if(L.collaboration&&L.collaboration.environment!=='office')return;if(this.floorFocus?.active)this.floorFocus.frame(false);else if(this.phase!=='interior')this.frameCamera(false);});
      this.view.controls.addEventListener('start',()=>{this.cameraTween=null;});
      let theme='blue';try{theme=localStorage.getItem('access-building-theme')||'blue';}catch{}
      this.setTheme('blue',{persist:false});this.setPhase('intro',false);this.setRenderStyle('access');
      if(new URLSearchParams(location.search).get('interior')==='1')this.enterFloor(1);
    }
    createSocietyVisuals(){
      this.societyPeople=new THREE.Group();this.societyPeople.userData.ignoreCollision=true;this.societyPeople.userData.noAO=true;this.world.add(this.societyPeople);this.societyRenderer=new L.CrowdRenderer(this.societyPeople,new Array(640));
      this.liftVisuals=this.society.lifts.cars.map(car=>{const group=new THREE.Group();for(const [w,h,d,x,y,z]of [[2.65,.10,4.25,0,0,0],[.06,2.6,4.25,-1.3,1.3,0],[.06,2.6,4.25,1.3,1.3,0],[2.65,2.6,.06,0,1.3,-2.1]]){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),this.towerMaterials.glass);m.position.set(x,y,z);group.add(m);}this.world.add(group);return group;});
      $('society-people-list').onclick=e=>{const b=e.target.closest('[data-society-person]');if(b)this.app.selectAgent(Number(b.dataset.societyPerson));};
    }

    updateSocietyVisuals(now,{people=true}={}){
      if(this.matrixLab?.active||this.matrixLab?.busy){this.societyPeople.visible=false;this.liftVisuals.forEach(o=>o.visible=false);return;}const society=this.society,interior=this.phase==='interior';this.societyPeople.visible=people&&this.world.visible&&(!interior||!!this.floorFocus?.interior);
      // Campus views keep the simulation and status live without preparing
      // character instances for the hidden population inside the tower.
      if(this.societyPeople.visible){const agents=[];for(const source of society.agents){const a=society.renderAgent(source);if(a.isPlayer||a.location==='escaped'||L.isOutdoorAgent(a)||L.disasterDirector?.physics?.destroyedFloors.has(Math.round(a.floor))||this.floorFocus?.interior&&Math.round(a.floor)===this.selected)continue;const f=Math.max(1,Math.min(30,a.floor)),lo=Math.floor(f),hi=Math.min(30,lo+1),u=f-lo,p=this.plates[lo-1].group.position,q=this.plates[hi-1].group.position;let y=(f-1)*(3.6+5.4*this.mix)+.82;if(a.location==='stairs'&&a.absoluteY!==undefined)y=a.absoluteY*(1+1.5*this.mix)+.82;agents.push({...a,x:a.x+p.x+(q.x-p.x)*u,z:a.z+p.z+(q.z-p.z)*u,baseY:y});}this.societyRenderer.update(agents,society.time+society.accumulator);}

      for(let i=0;i<2;i++){const c=society.renderCar(society.lifts.cars[i]),v=this.liftVisuals[i];v.visible=!interior;v.position.set(c.x,(c.floor-1)*(3.6+5.4*this.mix)+.82,0);}
      if(now<(this.nextSocietyUI||0))return;this.nextSocietyUI=now+350;const s=society.summary(),minutes=Math.floor(s.time/6),clock=`${String(9+Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`,lift=c=>`${c.label} 梯 ${c.floor.toFixed(1)}F · ${{idle:'待命',moving:c.direction>0?'上行':'下行',opening:'开门',open:'上下客',closing:'关门'}[c.state]} · ${c.passengers.length}/${c.capacity} 人`;
      const daily=interior&&this.app.simulation.isOfficeSociety;$('office-society-panel').hidden=!daily;document.body.classList.toggle('office-society-mode',daily);$('society-activity-panel').hidden=!daily;document.querySelector('.results-heading h2').textContent=daily?'日常观察':'人群观察';document.querySelector('.brand small').textContent='SPATIAL SIMULATION · 办公日常推演';
      const narrative=$('society-narrative');if(narrative)narrative.textContent=society.describe(interior?this.selected:null);
      if(daily){$('society-activity-metrics').innerHTML=`<b>${s.seated}<small>全楼就座人数</small></b><b>${s.working}<small>工位办公</small></b><b>${s.completedLiftTrips}<small>已完成电梯出行</small></b><b>${s.stairTrips}<small>已完成楼梯跨层</small></b>`;this.updateSocietyRoster(this.app.simulation.agents);}
    }
    updateSocietyRoster(agents){this.rosterNodes??=new Map();const parent=$('society-people-list'),ids=new Set(agents.map(a=>a.id));for(const [id,node]of this.rosterNodes)if(!ids.has(id)){node.remove();this.rosterNodes.delete(id);}for(const a of agents){let node=this.rosterNodes.get(a.id);if(!node){node=document.createElement('button');node.className='society-person';node.dataset.societyPerson=a.id;node.innerHTML='<b><span></span><small></small></b><span><i></i><small></small></span>';parent.appendChild(node);this.rosterNodes.set(a.id,node);}const values=[[node.querySelector('b>span'),a.name],[node.querySelector('b>small'),(a.gender==='female'?'女':'男')+' · '+a.age+' 岁'],[node.querySelector('span>i'),a.action],[node.querySelector('span>small'),a.job+' · 工位 '+a.homeFloor+'F']];for(const [el,value]of values)if(el.textContent!==value)el.textContent=value;node.setAttribute('aria-pressed',String(this.view.selected===a.id));}}
    closeDrawer(){if(this.floorFocus?.engaged){this.floorFocus.close();return;}this.drawerFloor=null;this.lastFloorHit=null;this.floorFocus?.syncCard();}
    setTheme(name,{persist=true}={}){
      this.theme=THEMES[name]?name:'blue';const palette=THEMES[this.theme];L.activeTheme=palette;document.body.dataset.buildingTheme=this.theme;
      for(const [key,value]of Object.entries(palette.css))document.body.style.setProperty(key,value);
      for(const source of [this.materials,this.towerMaterials])for(const [key,color]of Object.entries(palette.materials)){source[key].userData.officeRole=key;source[key].color.set(color).convertSRGBToLinear();}
      this.selection.material.color.set(palette.accent);this.drawerGuide.material.color.set(palette.accent);
      for(const plate of this.plates){
        this.applyThemeToFloor({group:plate.inside,towerFloor:true});
        const c=plate.tag.userData.labelCanvas,ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#ffffff';ctx.beginPath();ctx.roundRect(2,2,124,60,28);ctx.fill();ctx.fillStyle=palette.accent;ctx.font='bold 27px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`${plate.group.userData.floor}F`,64,33);plate.tag.material.map.needsUpdate=true;
      }
      this.applySceneTheme();this.siteCrowd.renderer.setTheme(palette);this.view.crowdRenderer?.setTheme(palette);
      for(const model of this.continuous?.models||[])this.applyThemeToFloor(model);
      this.view.updateGoals(this.app.model.goals);
      document.querySelectorAll('[data-building-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.buildingThemeChoice===this.theme)));
      this.view.shadowDirty=true;
      if(persist)try{localStorage.setItem('access-building-theme',this.theme);}catch{}
    }
    setRenderStyle(style){const p=L.RENDER_STYLES[style]||L.RENDER_STYLES.access,accent=p.accent;const picker=$('mirror-edge-color');if(picker){picker.parentElement.hidden=style!=='mirror-edge';if(style==='mirror-edge')picker.value=accent;}for(const key of ['--building-accent','--building-strong','--green','--green-dark'])document.body.style.setProperty(key,accent);this.view.pipeline.setStyle(style);$('render-style').value=style;for(const materials of [this.materials,this.towerMaterials])for(const [key,m]of Object.entries(materials)){if(['blue','water','dark','transom','reflection','glass'].includes(key)){const c=new THREE.Color(key==='water'?(p.plaza||accent):accent);if(['glass','reflection'].includes(key))c.lerp(new THREE.Color('white'),.52);if(['dark','transom'].includes(key))c.multiplyScalar(.65);m.color.copy(c).convertSRGBToLinear();}else if(['white','pale','soffit'].includes(key))m.color.set(p.city||'#f4f6f8').convertSRGBToLinear();else if(key==='road')m.color.set(p.road||'#dfe5e9').convertSRGBToLinear();}for(const model of [...this.plates.map(p=>p.model),...(this.continuous?.models||[])]){const current=this.view.model;this.view.model=model;this.view.pipeline.setStyle(style);this.view.model=current;}this.view.pipeline.setStyle(style);for(const mesh of this.continuous?.shaft?.children||[])mesh.material.color.set(p.wall).convertSRGBToLinear();this.selection.material.color.set(accent);this.drawerGuide.material.color.set(accent);document.querySelectorAll('[data-building-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.buildingThemeChoice===style)));}
    applyThemeToFloor(model){
      if(!model?.towerFloor&&model?.preset!=='office')return;const palette=THEMES[this.theme||'blue'].floor;
      model.group.traverse(o=>{
        const color=palette[o.name];if(color&&o.material?.color){o.material.color.set(color).convertSRGBToLinear();o.material.userData.presentationOriginalColor=o.material.color.clone();}
        if(o.userData.floorLabel){const {canvas,value}=o.userData.floorLabel,ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle=L.activeTheme.text;ctx.font='500 32px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(value,256,48,500);o.material.map.needsUpdate=true;}
      });
    }
    applySceneTheme(){
      const p=L.activeTheme,v=this.view;this.applyThemeToFloor(this.app.model);
      if(v.ground)v.ground.material.color.set(p.ground).convertSRGBToLinear();
      if(v.contextGrid){const colors=v.contextGrid.geometry.getAttribute('color');if(!v.contextGrid.userData.majorLines)v.contextGrid.userData.majorLines=Array.from({length:colors.count},(_,i)=>colors.getX(i)<.67);const major=new THREE.Color(p.grid.major),minor=new THREE.Color(p.grid.minor);for(let i=0;i<colors.count;i++){const c=v.contextGrid.userData.majorLines[i]?major:minor;colors.setXYZ(i,c.r,c.g,c.b);}colors.needsUpdate=true;v.contextGrid.material.color.set('#ffffff');}
      v.gridLines?.material.color.set(p.grid.floor);v.visionMesh?.material.color.set(p.accent);v.obstacles?.material.color.set(p.accent);for(const light of v.scene.children){if(light.isHemisphereLight){light.color.set(L.themeHsl(p.h,30,94));light.groundColor.set(L.themeHsl(p.h,13,43));}else if(light.isAmbientLight)light.color.set(L.themeHsl(p.h,25,93));}v.fill.color.set(L.themeHsl(p.h,32,88));
      if(v.contactShadow)v.contactShadow.material.color.set(p.shadow);
      if(v.model?.towerFloor){v.scene.background=new THREE.Color(p.background);if(v.pipeline.quality==='high')v.scene.background.convertSRGBToLinear();v.scene.fog.color.set(p.background).convertSRGBToLinear();}
      this.backgroundMode=null;v.shadowDirty=true;
    }
    pickFloor(event){
      const rect=this.view.renderer.domElement.getBoundingClientRect(),mouse=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
      this.view.camera.updateMatrixWorld(true);this.world.updateMatrixWorld(true);this.view.ray.setFromCamera(mouse,this.view.camera);
      for(const hit of this.view.ray.intersectObjects(this.pickable,true)){
        let visible=true;for(let p=hit.object;p;p=p.parent)if(!p.visible){visible=false;break;}if(!visible)continue;
        let floor=hit.object.userData.floor||hit.object.userData.floors?.[hit.instanceId];
        for(let p=hit.object.parent;p&&!floor;p=p.parent)floor=p.userData.floor;
                if(floor)return floor;
      }return null;
    }
    aoCacheKey(){
      const focus=this.floorFocus,physics=L.disasterDirector?.physics;
      // Fading and replacing a floor changes the AO geometry even with a stationary camera.
      return L.aoSceneKey(this.view)+'|'+this.mix.toFixed(3)+'|'+this.plates.map(p=>p.drawer.toFixed(3)+':'+(p.model.aoVersion||0)).join(',')+'|'+(this.matrixEpoch||0)+'|'+(focus?.revision||0)+'|'+(focus?.strength||0).toFixed(5)+'|'+[...(focus?.entries||[])].map(([floor,entry])=>floor+':'+entry.weight.toFixed(5)).join(',')+'|'+(physics?.destroyedFloors.size||0)+':'+(physics?.hiddenInstances.size||0)+':'+Number(!!physics?.cap);
    }
    renderBuilding(){
      const v=this.view,high=v.pipeline.quality!=='balanced';
      if(this.backgroundMode!==high&&v.pipeline.style==='access'){this.backgroundMode=high;v.scene.background=new THREE.Color(L.activeTheme.background);v.scene.fog.color.set(L.activeTheme.background).convertSRGBToLinear();if(high)v.scene.background.convertSRGBToLinear();}
      if(v.view!=='human')v.controls.update();
      if(!this.floorFocus?.prepareShadowFrame(performance.now())&&v.shadowDirty){v.renderer.shadowMap.needsUpdate=true;v.shadowDirty=false;}
      if(!high){v.renderer.render(v.scene,v.camera);return;}
      const size=v.renderer.getSize(this.renderSize),ratio=v.renderer.getPixelRatio();
      if(this.outputWidth!==size.x||this.outputHeight!==size.y||this.outputRatio!==ratio){
        this.outputWidth=size.x;this.outputHeight=size.y;this.outputRatio=ratio;
        this.composer.setPixelRatio(ratio);this.composer.setSize(size.x,size.y);
        this.fxaa.uniforms.resolution.value.set(1/(size.x*ratio),1/(size.y*ratio));
      }
      // Fade out city-scale screen-space shading as physical ceiling lights
      // take over. Their shadow maps remain stable when the camera moves indoors.
      const cityShading=1-(this.floorFocus?.strength||0);
      // A moving/fading tower invalidates the AO geometry every frame. Its
      // stable physical shadows suffice during the short entry/exit animation.
      this.aoPass.enabled=this.aoEnabled&&cityShading>.001&&!this.floorFocus?.transitioning;this.beautyPass.enabled=!this.aoPass.enabled;
      const range=v.camera.far-v.camera.near,u=this.aoPass.ssaoMaterial.uniforms;
      u.aoStrength.value=.74*cityShading;
      this.aoPass.minDistance=.045/range;this.aoPass.maxDistance=7/range;
      u.aoFadeNear.value=v.scene.fog.near+105;u.aoFadeFar.value=v.scene.fog.far;u.cameraNear.value=v.camera.near;u.cameraFar.value=v.camera.far;
      u.cameraProjectionMatrix.value.copy(v.camera.projectionMatrix);
      u.cameraInverseProjectionMatrix.value.copy(v.camera.projectionMatrixInverse);
      this.composer.render();
    }
    createWorld(){
      const standard=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.78,metalness:.015,envMapIntensity:.14,...extra});m.color.convertSRGBToLinear();return m;};
      this.materials={white:standard('#e5e9ee'),pale:standard('#cdd6e2'),blue:standard('#0063d9',{roughness:.2,metalness:.15,envMapIntensity:.45}),glass:standard('#4599df',{roughness:.11,metalness:.035,envMapIntensity:.28,transparent:true,opacity:.34,depthWrite:false}),road:standard('#cbd6e3'),water:standard('#258ed7',{roughness:.32,metalness:.07}),dark:standard('#557eaa'),soffit:standard('#a8b9cd'),transom:standard('#347bb8'),reflection:standard('#b4dbfb',{transparent:true,opacity:.065,depthWrite:false,side:THREE.DoubleSide})};
      this.landscapeMaterials=L.campusLandscapeMaterials(standard);
      this.landscapeAppearance=L.createCampusLandscapeAppearance(this.landscapeMaterials);
      const geo=new THREE.BoxGeometry(1,1,1),batches=new Map(),pose=new THREE.Object3D();
      this.outdoorBoxes=[];this.outdoorWalkways=[];const cube=(mat,w,h,d,x,y,z)=>{if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push([w,h,d,x,y,z]);this.outdoorBoxes.push({w,h,d,x,y,z});};
      // Natural planted grounds sit inside the original distant city model.
      // Extend the ground beyond the fog horizon so a modest ascent never reveals a square model edge.
      L.createCampusGroundRoads(this);this.outdoorBoxes.push({w:6000,h:.8,d:6000,x:0,y:-1.3,z:0});cube('siteEdge',133,.6,108,0,-.6,0);cube('lawn',126,.12,100,0,-.22,0);cube('white',51,.7,42,0,.25,0);
      L.createCampusLandscape(this);
      for(const x of [-73,73])this.outdoorBoxes.push({w:10,h:.06,d:500,x,y:-.79,z:0});for(const z of [-62,62])this.outdoorBoxes.push({w:500,h:.06,d:10,x:0,y:-.79,z});
      let seed=7349;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
      const cityFootprints=[];
      for(let gx=-9;gx<=9;gx++)for(let gz=-9;gz<=9;gz++){const cx=gx*27,cz=gz*25;if(Math.abs(cx)<83&&Math.abs(cz)<71)continue;const w=12+random()*8,d=11+random()*8,h=5+Math.pow(random(),1.9)*30;cube('white',w,h,d,cx,h/2-.78,cz);cityFootprints.push([cx,cz,w,d]);if(random()>.6){const wingW=w*.48;cube('white',wingW,h*.65,d*.7,cx+w*.6,h*.325-.78,cz+d*.25);}if(random()>.65)cube('white',w*.42,1.1,d*.35,cx,h-.23,cz);}
      for(const [key,items]of batches){const m=new THREE.InstancedMesh(geo.clone(),this.landscapeMaterials[key]||this.materials[key],items.length);items.forEach(([w,h,d,x,y,z],i)=>{pose.position.set(x,y,z);pose.scale.set(w,h,d);pose.updateMatrix();m.setMatrixAt(i,pose.matrix);});m.castShadow=true;m.receiveShadow=true;this.world.add(m);}
      // Broad contact shade supplements the directional shadows at city-model scale.
      const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const sc=shadowCanvas.getContext('2d');const gradient=sc.createRadialGradient(64,64,12,64,64,64);gradient.addColorStop(0,'rgba(58,85,126,.38)');gradient.addColorStop(.55,'rgba(58,85,126,.18)');gradient.addColorStop(1,'rgba(58,85,126,0)');sc.fillStyle=gradient;sc.fillRect(0,0,128,128);const shadowTexture=new THREE.CanvasTexture(shadowCanvas),shadowMaterial=new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,toneMapped:false});
      for(const [x,z,w,d]of [[0,0,43,34],...cityFootprints]){const shadow=new THREE.Mesh(new THREE.PlaneGeometry(w*1.65,d*1.65),shadowMaterial);shadow.userData.noAO=true;shadow.rotation.x=-Math.PI/2;shadow.position.set(x,x===0?.61:-.77,z);this.world.add(shadow);}
      this.tower=new THREE.Group();this.tower.position.y=.65;this.world.add(this.tower);this.towerMaterials=Object.fromEntries(Object.entries(this.materials).map(([key,material])=>{const m=material.clone();m.fog=true;return[key,m];}));
      const box=(parent,key,w,h,d,x,y,z,floor,role='base')=>{parent.userData.pending??=new Map();if(!parent.userData.pending.has(key))parent.userData.pending.set(key,[]);parent.userData.pending.get(key).push({w,h,d,x,y,z,floor,role});return null;};
      for(let n=1;n<=30;n++){
        const plate=new THREE.Group();plate.userData.floor=n;plate.position.y=(n-1)*3.6;this.tower.add(plate);
        const slab=null;for(const [w,d,x,z]of L.towerSlabTiles){box(plate,'white',w-.10,.24,d-.10,x,0,z,n);box(plate,'soffit',w-.12,.13,d-.12,x,-.18,z,n);}
        const facade=new THREE.Group();plate.add(facade);
        for(const z of [-12.15,12.15]){
          if(n===1&&z>0){for(const [a,b]of [[-17.6,-3.1],[3.1,17.6]]){box(facade,'glass',b-a,3.15,.12,(a+b)/2,1.78,z,n);box(facade,'blue',b-a,.34,.17,(a+b)/2,.34,z,n);}}
          else{box(facade,'glass',35.2,3.15,.12,0,1.78,z,n);box(facade,'blue',35.2,.34,.17,0,.34,z,n);}box(facade,'transom',35.5,.07,.18,0,2.65,z,n);
          if(n>8){for(let x=-17.7;x<=17.8;x+=1.08){if(z>0&&x>-6.1&&x<2)continue;box(facade,'white',.145,3.6,.48,x,1.8,z>0?13.01:-13.01,n,'fin');}for(const x of [-17.9,-6.2,2.1,17.9])box(facade,'white',.35,3.6,.95,x,1.8,z>0?13.03:-13.03,n,'fin');}
          else{for(const x of (n===1&&z>0?[-15.8,-4.1,4.1,15.8]:[-15.8,-2.3,15.8]))box(facade,'white',n===1&&z>0&&Math.abs(x)<5?1:x===-2.3?5.6:3.8,3.6,1.85,x,1.8,z>0?12.9:-12.9,n,n>1?'lowerPier':'entryPier');}
          // Exposed horizontal slab noses in the recessed blue slot make the storeys legible.
          box(facade,'white',8.3,.18,1.05,-2.05,.06,z>0?12.5:-12.5,n);
        }
        for(const x of [-17.15,17.15]){
          box(facade,'glass',.12,3.15,24.18,x,1.78,0,n);box(facade,'blue',.17,.34,24.13,x,.34,0,n);box(facade,'transom',.18,.07,24.12,x,2.65,0,n);
          if(n>8){for(let z=-12.6;z<=12.7;z+=1.08){if(x>0&&z>4.4)continue;box(facade,'white',.48,3.6,.145,x>0?18.01:-18.01,1.8,z,n,'fin');}for(const z of [-12.9,4.5,12.9])box(facade,'white',.95,3.6,.35,x>0?18.03:-18.03,1.8,z,n,'fin');}
          else for(const z of [-11.3,1,11.3])box(facade,'white',1.85,3.6,z===1?5.3:3.6,x>0?17.9:-17.9,1.8,z,n,n>1?'lowerPier':'entryPier');
        }
        // Pale diagonal reflections across the recessed glazing; actual facade geometry remains visible.
        const bandShape=new THREE.Shape();bandShape.moveTo(-5.9,.25);bandShape.lineTo(-3.1,.25);bandShape.lineTo(1.8,3.25);bandShape.lineTo(-1,3.25);bandShape.closePath();const band=new THREE.Mesh(new THREE.ShapeGeometry(bandShape),this.towerMaterials.reflection);band.position.z=12.23;facade.add(band);
        if(n===9){box(facade,'white',37.5,.7,27.5,0,-.05,0,n,'belt');box(facade,'soffit',36.9,.17,26.9,0,-.48,0,n,'belt');}
        if(n===1){box(facade,'white',8,.24,5,0,3.05,14.5,n);box(facade,'blue',7.4,.16,.08,0,3.05,17.02,n);for(const x of [-3.05,3.05])box(facade,'glass',.12,2.6,1.6,x,1.3,13,n);}
        if(n===2){box(facade,'white',12,.4,8,-11.3,0,15,n,'podium');box(facade,'blue',11.7,3,.12,-11.3,1.8,18.8,n,'podium');box(facade,'white',12,.35,8,-11.3,3.35,15,n,'podium');}
        if(n===24){box(facade,'white',22,.48,9,9.1,0,12.3,n,'cantilever');box(facade,'glass',21.8,2.9,.18,9.1,1.8,16.6,n,'cantilever');box(facade,'blue',21.8,.45,.2,9.1,.5,16.7,n,'cantilever');box(facade,'white',22,.48,9,9.1,3.5,12.3,n,'cantilever');}
        const floorModel=L.makeTowerFloor(n,{preview:true,shell:false}),inside=floorModel.group;inside.traverse(o=>{if(o.material)o.material.fog=true;if(o.isMesh)o.castShadow=false;});inside.position.y=.17;inside.visible=true;plate.add(inside);
        const tagCanvas=document.createElement('canvas');tagCanvas.width=128;tagCanvas.height=64;const c=tagCanvas.getContext('2d');c.fillStyle='#ffffff';c.beginPath();c.roundRect(2,2,124,60,28);c.fill();c.fillStyle='#237fd2';c.font='bold 27px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(`${n}F`,64,33);const texture=new THREE.CanvasTexture(tagCanvas);texture.encoding=THREE.sRGBEncoding;const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,toneMapped:false}));tag.position.set(22,2,0);tag.scale.set(5.3,2.65,1);tag.visible=false;tag.userData.floor=n;tag.userData.labelCanvas=tagCanvas;plate.add(tag);this.pickable.push(tag);
        this.plates.push({group:plate,slab,facade,inside,tag,model:floorModel,drawer:0});
      }
      this.crown=new THREE.Group();this.crown.position.y=108.1;this.tower.add(this.crown);for(const x of [-17.7,17.7])for(let z=-12.8;z<=12.9;z+=1.08)box(this.crown,'white',.7,3.3,.19,x,1.65,z);for(const z of [-12.8,12.8])box(this.crown,'white',36,.27,.5,0,3.35,z);box(this.crown,'blue',15,3.8,13,-1,1.9,1);
      this.world.traverse(parent=>{if(!parent.userData.pending)return;for(const [key,items]of parent.userData.pending){const mesh=new THREE.InstancedMesh(geo.clone(),this.towerMaterials[key],items.length);items.forEach((b,i)=>{pose.position.set(b.x,b.y,b.z);pose.scale.set(b.w,b.h,b.d);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);});mesh.castShadow=key!=='glass';mesh.receiveShadow=true;mesh.userData.floors=items.map(b=>b.floor);mesh.userData.instanceRoles=items.map(b=>b.role||'base');mesh.frustumCulled=false;parent.add(mesh);if(items.some(b=>b.floor))this.pickable.push(mesh);}delete parent.userData.pending;});
      this.selection=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(36.8,3.6,26.8)),new THREE.LineBasicMaterial({color:'#057bec',transparent:true,opacity:.9}));this.selection.visible=false;this.tower.add(this.selection);
      this.drawerGuide=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineDashedMaterial({color:'#3d96df',dashSize:.8,gapSize:.5,transparent:true,opacity:.7}));this.drawerGuide.visible=false;this.tower.add(this.drawerGuide);
      this.batchTower();
    }
    batchTower(){
      // Keep the canonical per-floor models for interaction, and draw the city
      // with shared instancing across storeys instead of hundreds of small draws.
      const batches=new Map(),relative=new THREE.Matrix4(),inverse=new THREE.Matrix4();this.tower.updateMatrixWorld(true);
      for(const plate of this.plates){inverse.copy(plate.group.matrixWorld).invert();plate.group.traverse(mesh=>{
        if(!mesh.isMesh||!mesh.geometry||!mesh.material||Array.isArray(mesh.material)||mesh.userData.zoneOverlay)return;
        const m=mesh.material,key=JSON.stringify([mesh.geometry.userData.furnitureKey||(mesh.geometry.parameters?null:mesh.geometry.uuid),m.map?.uuid,mesh.geometry.type,mesh.geometry.parameters,m.color?.getHex(),m.roughness,m.metalness,m.opacity,m.transparent,m.side,m.userData.officeRole]);
        if(!batches.has(key))batches.set(key,{geometry:mesh.geometry,material:m,items:[]});
        if(mesh.parent===plate.group)mesh.visible=false;relative.multiplyMatrices(inverse,mesh.matrixWorld);let parent=mesh,facade=false,interior=false;while(parent&&parent!==plate.group){if(parent===plate.facade)facade=true;if(parent===plate.inside)interior=true;parent=parent.parent;}
        const batch=batches.get(key);for(let i=0;i<(mesh.isInstancedMesh?mesh.count:1);i++)batch.items.push({source:mesh,index:i,relative:relative.clone(),plate,facade,interior});
      });}
      const previous=new Map((this.towerBatches||[]).map(b=>[b.key,b]));const oldMeshes=new Set((this.towerBatches||[]).map(b=>b.mesh));this.pickable=this.pickable.filter(m=>!oldMeshes.has(m));this.towerBatches=[...batches.entries()].map(([key,batch])=>{let mesh=previous.get(key)?.mesh;if(mesh&&mesh.instanceMatrix.count<batch.items.length){this.tower.remove(mesh);mesh.geometry.dispose();mesh.dispose?.();mesh=null;}if(!mesh)mesh=new THREE.InstancedMesh(batch.geometry.clone(),batch.material,Math.ceil(batch.items.length*1.25)+8);mesh.count=batch.items.length;mesh.material=batch.material;previous.delete(key);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.receiveShadow=true;mesh.castShadow=!batch.material.transparent;mesh.userData.floors=batch.items.map(p=>p.plate.group.userData.floor);this.tower.add(mesh);this.pickable.push(mesh);return{...batch,key,mesh};});for(const old of previous.values()){this.tower.remove(old.mesh);old.mesh.geometry.dispose();old.mesh.dispose?.();}
      this.batchMatrix=new THREE.Matrix4();this.batchLocal=new THREE.Matrix4();this.batchTranslation=new THREE.Matrix4();this.updateTowerBatches(true);
    }
    updateTowerBatches(force=false){
      const continuous=this.continuous,playable=continuous?.active?continuous.origin:0,radius=continuous?.active&&(Math.abs(this.view.camera.position.x)>10.5&&Math.abs(this.view.camera.position.z)<4.2)?1:0;const doors=this.society?.lifts.cars.map(c=>c.door.toFixed(3)).join(',')||'',staticKey=(L.disasterDirector?.physics?.destroyedFloors.size||0)+':'+(L.disasterDirector?.physics?.hiddenInstances?.size||0)+':'+(this.floorFocus?.revision||0)+':'+playable+':'+radius+':'+(this.matrixEpoch||0)+'|'+this.mix.toFixed(5)+'|'+this.plates.map(p=>p.drawer.toFixed(5)+':'+(p.model.aoVersion||0)).join(',');
      // Moving quake instances invalidate their storey's draw matrices only.
      // This revision stays fixed while paused/asleep and never enters AO keys.
      const quake=this.society?.emergency?.hazard?.physics,quakeFloor=quake?.model?.towerFloor||0,quakeKey=quakeFloor+':'+(quake?.batchRevision||0),key=staticKey+'|'+quakeKey+'|'+doors;
      if(!force&&this.towerBatchKey===key)return;const staticSame=!force&&this.towerStaticKey===staticKey,onlyDoors=staticSame&&this.towerQuakeKey===quakeKey,onlyQuake=staticSame&&this.towerDoorsKey===doors&&this.towerQuakeFloor===quakeFloor&&quakeFloor!==0;this.towerStaticKey=staticKey;this.towerQuakeKey=quakeKey;this.towerQuakeFloor=quakeFloor;this.towerDoorsKey=doors;this.towerBatchKey=key;
      this.floorFocus?.beginBatches();
      for(const batch of this.towerBatches){
        if(!batch.sunShadowMask){
          // Keep the tower in shared batches. A one-byte per-instance mask
          // excludes only extracted floors from orthographic sunlight shadows,
          // while perspective spotlight shadows still draw every instance.
          if(!this.towerShadowMaterial){
            const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
            depth.onBeforeCompile=shader=>{shader.vertexShader='attribute float towerSunShadow;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nif ( projectionMatrix[3][3] == 1.0 && towerSunShadow < 0.5 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );');};
            depth.customProgramCacheKey=()=> 'tower-sun-shadow-mask-v1';this.towerShadowMaterial=depth;
          }
          const previousMask=batch.mesh.geometry.getAttribute('towerSunShadow');
          batch.sunShadowMask=previousMask?.count===batch.mesh.instanceMatrix.count?previousMask:new THREE.InstancedBufferAttribute(new Uint8Array(batch.mesh.instanceMatrix.count).fill(1),1);batch.sunShadowMask.setUsage(THREE.DynamicDrawUsage);
          batch.mesh.geometry.setAttribute('towerSunShadow',batch.sunShadowMask);batch.mesh.customDepthMaterial=this.towerShadowMaterial;
        }
        let changed=false,shadowChanged=false;for(let i=0;i<batch.items.length;i++){const item=batch.items[i];if(!this.floorFocus?.engaged&&(onlyDoors&&item.source.isInstancedMesh||onlyQuake&&item.plate.group.userData.floor!==quakeFloor))continue;changed=true;const shadow=item.plate.drawer>0?0:1;if(batch.sunShadowMask.array[i]!==shadow){batch.sunShadowMask.array[i]=shadow;shadowChanged=true;}const p=item.plate.group.position,hidden=L.disasterDirector?.physics?.hiddenInstances?.has(item.source.uuid+':'+item.index)||L.disasterDirector?.physics?.destroyedFloors.has(item.plate.group.userData.floor)||item.facade&&(this.mix>=.22||item.plate.drawer>=.08)||playable&&Math.abs(item.plate.group.userData.floor-playable)<=radius;this.batchTranslation.makeTranslation(p.x,p.y,p.z);
          if(item.source.isInstancedMesh)item.source.getMatrixAt(item.index,this.batchLocal);else{item.source.updateMatrix();this.batchLocal.copy(item.source.matrix);}
          this.batchMatrix.multiplyMatrices(this.batchTranslation,item.relative);if(item.source.isInstancedMesh)this.batchMatrix.multiply(this.batchLocal);else{this.batchMatrix.copy(this.batchTranslation);this.batchMatrix.elements[13]+=.17;this.batchMatrix.multiply(this.batchLocal);}
          if(hidden)this.batchMatrix.makeScale(0,0,0);if(this.floorFocus?.writeInstance(batch,item,this.batchMatrix))this.batchMatrix.makeScale(0,0,0);batch.mesh.setMatrixAt(i,this.batchMatrix);
        }if(changed)batch.mesh.instanceMatrix.needsUpdate=true;if(shadowChanged){batch.sunShadowMask.needsUpdate=true;this.view.shadowDirty=true;}}
      this.floorFocus?.endBatches();
    }
    createUI(){
      const root=document.createElement('div');root.id='building-ui';root.innerHTML=`
        <header class="building-header"><div class="building-edition"><i></i> SPATIAL SIMULATION <span>LIVE / 30 FLOORS</span></div></header>
        <section class="building-intro" aria-label="Ominispace"><span class="intro-index">A WORKDAY, UNFOLDING</span><h1>Ominispace</h1><h2>空间全宇宙 —— AI驱动的 人-空间-机器人 交互模拟器</h2><button id="building-start" class="building-start"><span>开始观测<br><small>OBSERVE THE EVERYDAY</small></span><b>↗</b></button></section>
        <section class="building-heading"><span>SPATIAL SIMULATION / <b id="building-step">01</b></span><h1 id="building-title">日常，正在发生。</h1><p id="building-subtitle">单击抽出楼层 · 再次点击进入室内 · 拖动旋转 / 滚轮缩放</p></section>
        <div class="building-view-tools"><button id="building-explode">↑ 展开楼层</button><button id="building-reset-camera" aria-label="重置建筑视角">⌖</button><button id="building-back-intro" aria-label="返回欢迎页">↩</button></div>
        <aside class="building-floor-panel" aria-label="楼层选择"><div class="floor-panel-title"><span>楼层索引<small>FLOOR INDEX</small></span><b>30</b><button id="building-floor-toggle" type="button" aria-label="收起楼层索引" aria-expanded="true" aria-controls="building-floor-list">收起</button></div><div class="floor-panel-actions"><button id="building-top-floor">30F 顶层</button><button id="building-first-floor">1F 大厅</button></div><div id="building-floor-list" class="building-floor-list">${Array.from({length:30},(_,i)=>30-i).map(f=>`<button data-floor="${f}" aria-label="选择 ${f} 层"><span class="floor-plate-icon"></span><b>${String(f).padStart(2,'0')}</b><small>${f===1?'大厅':L.towerFloorSpec(f).family}</small><i></i></button>`).join('')}</div><p>单击抽出 · 再次点击进入<br>电梯 · 消防楼梯位置固定</p></aside>
        <div class="building-footer"><span>PEOPLE · ROUTINES · CONNECTIONS</span><span id="building-footer-hint">拖动探索建筑 / 点击开始进入</span><span>SPATIAL SIMULATION</span></div>
        <div class="building-loading" hidden>正在构建楼层空间…</div>`;document.body.appendChild(root);this.ui=root;
      $('building-start').onclick=()=>this.setPhase('overview');root.querySelectorAll('button[data-building-phase]').forEach(b=>b.onclick=()=>this.setPhase(b.dataset.buildingPhase));
      $('building-explode').onclick=()=>this.toggleExplode();
      $('building-floor-toggle').onclick=()=>{const button=$('building-floor-toggle'),collapsed=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!collapsed));button.setAttribute('aria-label',(collapsed?'展开':'收起')+'楼层索引');button.textContent=collapsed?'展开':'收起';button.closest('.building-floor-panel').classList.toggle('is-collapsed',collapsed);};
      $('building-back-intro').title='返回首页并恢复默认建筑';$('building-back-intro').onclick=()=>this.matrixLab?this.matrixLab.restoreDefaults():this.setPhase('intro');$('building-reset-camera').onclick=()=>this.frameCamera();$('building-first-floor').onclick=()=>this.select(1);$('building-top-floor').onclick=()=>{this.select(30);document.querySelector('[data-floor="30"]').scrollIntoView({block:'nearest'});};
      $('building-floor-list').onclick=e=>{const b=e.target.closest('[data-floor]');if(b)this.select(Number(b.dataset.floor));};$('building-floor-list').ondblclick=e=>{const b=e.target.closest('[data-floor]');if(b)this.enterFloor(Number(b.dataset.floor));};
      const back=document.createElement('div');back.id='interior-building-bar';back.innerHTML='<button id="interior-building-back">← 返回整栋建筑</button><span id="interior-floor-label"></span><button id="interior-floor-prev" aria-label="上一层">↓</button><select id="interior-floor-select" aria-label="切换建筑楼层">'+Array.from({length:30},(_,i)=>`<option value="${i+1}">${String(i+1).padStart(2,'0')}F · ${L.towerFloorSpec(i+1).name}</option>`).join('')+'</select><button id="interior-floor-next" aria-label="下一层">↑</button>';document.body.appendChild(back);$('interior-building-back').onclick=()=>this.setPhase('overview');$('interior-floor-select').onchange=e=>this.enterFloor(Number(e.target.value));$('interior-floor-prev').onclick=()=>this.enterFloor(Math.max(1,this.selected-1));$('interior-floor-next').onclick=()=>this.enterFloor(Math.min(30,this.selected+1));
      const sampling=document.createElement('select');sampling.id='render-output-scale';sampling.setAttribute('aria-label','画面输出采样');sampling.innerHTML='<option value="1">原生清晰</option><option value="1.5">1.5× 超采样</option>';sampling.value=String(this.view.pipeline.pixelScale);sampling.onchange=()=>this.view.pipeline.setPixelScale(Number(sampling.value));const themes=document.createElement('div');themes.innerHTML='<div id="building-theme-switch" role="group" aria-label="渲染材质风格">'+Object.entries(L.RENDER_STYLES).map(([id,{label}])=>`<button data-building-theme-choice="${id}" aria-label="${label}" aria-pressed="false">${label}</button>`).join('')+'</div>';const tint=document.createElement('label');tint.className='mirror-edge-color';tint.hidden=true;tint.innerHTML='RGB <input type="color" id="mirror-edge-color" aria-label="镜面光影 RGB 主题色">';
      const picker=tint.querySelector('input'),mirror=L.RENDER_STYLES['mirror-edge'];
      try{const saved=localStorage.getItem('mirror-edge-color');if(/^#[a-f0-9]{6}$/i.test(saved))mirror.accent=saved;}catch{}
      picker.value=mirror.accent;picker.onchange=()=>{mirror.accent=picker.value;try{localStorage.setItem('mirror-edge-color',picker.value);}catch{}this.setRenderStyle('mirror-edge');};
      themes.firstElementChild.append(tint,sampling);document.body.appendChild(themes.firstElementChild);this.select(1,{pull:false});
    }
    select(n,{pull=true}={}){const floor=L.towerFloorSpec(n).floor;if(pull&&this.phase==='overview'&&this.drawerFloor===floor){this.enterFloor(floor);return;}this.selected=floor;if(pull&&this.phase==='overview')this.drawerFloor=floor;document.querySelectorAll('[data-floor]').forEach(b=>{const active=Number(b.dataset.floor)===floor;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});this.selection.visible=this.phase!=='intro';if(pull&&this.exploded&&this.phase==='overview')this.focusExplodedFloor(floor);this.floorFocus?.syncCard();}
    focusExplodedFloor(n){const to=new THREE.Vector3(30,(n-1)*(this.exploded?9:3.6)+2,0),end=to.clone().add(new THREE.Vector3(68,45,84));if(matchMedia('(prefers-reduced-motion: reduce)').matches){this.view.camera.position.copy(end);this.view.controls.target.copy(to);this.view.controls.update();}else this.cameraTween={start:performance.now(),position:this.view.camera.position.clone(),target:this.view.controls.target.clone(),end,to};}
    toggleExplode(){if(this.matrixLab?.busy)return;this.floorFocus?.close({immediate:true,restoreCamera:false});if(this.matrixLab?.active){this.matrixLab.stop().then(()=>this.toggleExplode());return;}this.drawerFloor=null;this.exploded=!this.exploded;this.syncExplode();this.frameCamera();}
    syncExplode(){$('building-explode').textContent=this.exploded?'↓ 合拢建筑':'↗ 展开楼层';$('building-title').textContent=this.exploded?'展开每一层日常。':'日常，正在发生。';$('building-subtitle').textContent=this.exploded?'单击抽出楼层 · 再次点击进入室内 · 点击空白收回':'拖动旋转 · 滚轮缩放 · 点击建筑或右侧任意楼层';$('building-step').textContent=this.exploded?'02':'01';this.matrixLab?.sync();}
    setPhase(phase,animate=true){
      if(this.matrixLab?.busy)return;if(this.matrixLab?.active){this.matrixLab.stop().then(()=>this.setPhase(phase,animate));return;}
      if(this.loading)return;if(phase==='overview'&&this.floorFocus?.interior){this.floorFocus.returnToOverview(animate);return;}this.floorFocus?.unmountInterior();this.floorFocus?.close({immediate:true,restoreCamera:false});if(this.app.running)$('play-button').click();
      if(phase!=='interior'&&this.continuous?.active){this.continuous.leave();if(document.pointerLockElement===this.view.renderer.domElement)document.exitPointerLock();animate=false;}
      this.phase=phase;if(phase!=='interior'){this.society.running=true;this.view.pipeline.archviz.updateLighting(null);}document.body.dataset.buildingPhase=phase;
      if(phase!=='interior')this.journey?.cancel();const interior=phase==='interior';this.world.visible=!interior;this.ui.hidden=interior;$('interior-building-bar').hidden=!interior;
      this.view.model.group.visible=interior;for(const key of ['avatarGroup','goalGroup','heatGroup','overlayGroup','trailMesh','visionMesh','gridLines','contactShadow'])if(this.view[key])this.view[key].visible=interior&&({heatGroup:$('heat-visible').checked,overlayGroup:$('obstacles-visible').checked,trailMesh:$('trails-visible').checked,visionMesh:$('vision-visible').checked}[key]??true);
      this.view.agentBubbles?.group&&(this.view.agentBubbles.group.visible=interior);
      if(!interior){this.view.view='perspective';this.view.camera.fov=40;this.view.controls.enabled=true;this.view.controls.enableRotate=true;this.view.controls.maxDistance=650;this.view.camera.near=2;this.view.camera.far=1600;this.view.camera.updateProjectionMatrix();this.view.scene.background=new THREE.Color('#d9e0e8');this.view.scene.fog=new THREE.Fog('#d9e0e8',195,490);this.view.scene.fog.color.convertSRGBToLinear();this.backgroundMode=null;this.view.ground.visible=false;this.view.contextGrid.visible=false;this.view.renderer.toneMappingExposure=.98;this.view.sun.position.set(-85,160,75);this.view.sun.target.position.set(0,30,0);this.view.sun.intensity=2.45;this.view.fill.intensity=.18;for(const {light}of this.indoorAmbient)light.intensity=light.isHemisphereLight?.38:.035;Object.assign(this.view.sun.shadow.camera,{left:-180,right:180,top:180,bottom:-180,near:1,far:500});this.view.sun.shadow.camera.updateProjectionMatrix();this.view.sun.shadow.mapSize.set(4096,4096);if(this.view.sun.shadow.map&&this.view.sun.shadow.map.width!==4096){this.view.sun.shadow.map.dispose();this.view.sun.shadow.map=null;}this.view.sun.shadow.bias=-.000025;this.view.sun.shadow.normalBias=.02;this.view.shadowDirty=true;this.view.renderer.shadowMap.needsUpdate=true;this.view.camera.up.set(0,1,0);if(phase==='intro'){this.exploded=false;this.drawerFloor=null;this.syncExplode();}this.select(this.selected,{pull:false});this.frameCamera(animate);}
      else {this.view.sun.shadow.bias=this.indoorShadow.bias;this.view.sun.shadow.normalBias=this.indoorShadow.normalBias;for(const {light,intensity}of this.indoorAmbient)light.intensity=intensity;this.cameraTween=null;this.view.camera.near=.05;this.view.camera.updateProjectionMatrix();this.view.ground.visible=true;this.view.contextGrid.visible=true;this.applyThemeToFloor(this.app.model);this.setRenderStyle(this.view.pipeline.style);this.view.setView('perspective');this.view.shadowDirty=true;}
    }
    frameCamera(animate=true){this.view.camera.near=2;this.view.camera.far=1600;this.view.camera.updateProjectionMatrix();this.view.controls.maxDistance=this.exploded?1400:750;const intro=this.phase==='intro',aspect=this.view.camera.aspect,small=aspect<1,expanded=this.exploded;const target=expanded?new THREE.Vector3(0,100,0):new THREE.Vector3(intro?(small?2:43):0,intro?49:48,0);const pos=expanded?new THREE.Vector3(354,356,464):intro?new THREE.Vector3(164,125,199):new THREE.Vector3(124,125,146);if(small){pos.sub(target).multiplyScalar(1.55).add(target);if(intro)target.set(0,52,0);}if(animate&&!this.floorFocus.reducedMotion())this.cameraTween={start:this.floorFocus.presentationTime,presentation:true,duration:1200,smooth:true,position:this.view.camera.position.clone(),target:this.view.controls.target.clone(),end:pos,to:target};else{this.view.camera.position.copy(pos);this.view.controls.target.copy(target);this.view.controls.update();this.cameraTween=null;}}
    async enterFloor(n){
      if(this.matrixLab?.busy||this.loading||this.app.busy)return;if(this.matrixLab?.active)await this.matrixLab.stop();
      n=L.towerFloorSpec(n).floor;if(this.floorFocus.interior&&this.selected===n)return;
      if(this.journey?.trip&&!this.journey.changing)this.journey.cancel();
      const focus=this.floorFocus;focus.unmountInterior();const saved=focus.capturePresentation();
      this.select(n,{pull:false});focus.focus(n);this.loading=true;
      document.querySelectorAll('#interior-floor-select,#interior-floor-prev,#interior-floor-next').forEach(b=>b.disabled=true);
      try{
        if(this.app.model.towerFloor!==n||this.app.model.hasTowerShell!==false)await this.app.loadTowerFloor(n,{shell:false});
        focus.restorePresentation(saved);$('demo-preset').value='building';this.loading=false;
        focus.mountInterior();focus.showInteriorUI();focus.startBlend(450);this.app.play(true);
      }catch(e){focus.restorePresentation(saved);focus.returnToOverview(false);console.error(e);$('toast').textContent='楼层加载失败：'+(L.brandNeutralText?.(e.message)??e.message);$('toast').hidden=false;}
      finally{this.loading=false;$('interior-floor-select').disabled=false;$('interior-floor-prev').disabled=n===1;$('interior-floor-next').disabled=n===30;}
    }
    update(){
      const now=performance.now(),dt=this.lastUpdate?Math.min(1,(now-this.lastUpdate)/1000):.016;this.lastUpdate=now;this.matrixLab?.update(now);this.floorFocus?.update(now);
      if(!document.hidden&&this.phase!=='interior'&&this.society.running)this.society.advance(Math.min(.2,dt)*this.society.speed);if(this.phase!=='interior')this.siteCrowd.update(0);this.updateSocietyVisuals(now);this.journey?.updateContext();if(this.combat&&!this.journey?.continuous?.active)this.combat.effects.update(Math.min(.1,dt));if(this.phase==='interior'&&!this.floorFocus?.interior)return;
      if(now>(this.nextArrivalUI||0)){const s=this.siteCrowd.summary();$('building-footer-hint').textContent=`固定人员 ${this.society.count} 人 · 室外 ${s.walking} 人 · 已入楼 ${s.entered} 人 / 单击抽出 · 再次点击进入室内`;this.nextArrivalUI=now+500;}
      const target=this.exploded?1:0,previous=this.mix;if(!this.floorFocus?.engaged)this.mix+=(target-this.mix)*(1-Math.exp(-dt*6));const t=this.mix;this.view.scene.fog.near=195+175*t;this.view.scene.fog.far=490+560*t;
      if(Math.abs(t-previous)>.0001&&now>(this.nextBuildingShadow||0)){this.view.shadowDirty=true;this.nextBuildingShadow=now+180;}
      for(let i=0;i<30;i++){
        const p=this.plates[i],wanted=this.drawerFloor===i+1&&this.phase==='overview'?1:0;
        if(!this.floorFocus?.engaged){p.drawer+=(wanted-p.drawer)*(1-Math.exp(-dt*6));if(Math.abs(p.drawer-wanted)<.0001)p.drawer=wanted;
        p.group.position.set(46*p.drawer,i*(3.6+5.4*t),10*p.drawer);}
        p.facade.visible=false;p.inside.visible=false;p.tag.visible=!this.floorFocus?.engaged&&(t>.35||p.drawer>.18)&&!L.disasterDirector?.physics?.destroyedFloors.has(i+1);
      }
      this.updateTowerBatches();
      this.crown.visible=t<.2&&!L.disasterDirector?.physics?.cap;const plate=this.plates[this.selected-1];this.selection.position.copy(plate.group.position).add(new THREE.Vector3(0,1.8,0));this.selection.visible=this.phase==='overview'&&!L.disasterDirector?.physics?.collapseComplete&&!L.disasterDirector?.physics?.destroyedFloors.has(this.selected);
      this.drawerGuide.visible=plate.drawer>.05&&this.phase==='overview'&&!L.disasterDirector?.physics?.collapseComplete&&!L.disasterDirector?.physics?.destroyedFloors.has(this.selected);
      if(this.drawerGuide.visible){const y=plate.group.position.y+.12;this.drawerGuide.geometry.setFromPoints([new THREE.Vector3(18,y,13),new THREE.Vector3(plate.group.position.x-18,y,plate.group.position.z+13)]);this.drawerGuide.computeLineDistances();}
      if(this.cameraTween){const c=this.cameraTween,clock=c.presentation?this.floorFocus.presentationTime:performance.now();c.start??=clock;const u=Math.min(1,Math.max(0,(clock-c.start)/(c.duration||1000))),e=c.smooth?u*u*u*(u*(u*6-15)+10):1-Math.pow(1-u,3);this.view.camera.position.lerpVectors(c.position,c.end,e);this.view.controls.target.lerpVectors(c.target,c.to,e);if(c.endUp)this.view.camera.up.lerpVectors(c.up,c.endUp,e).normalize();if(c.endFov!==undefined&&c.fov!==c.endFov){this.view.camera.fov=c.fov+(c.endFov-c.fov)*e;this.view.camera.updateProjectionMatrix();}if(u===1)this.cameraTween=null;}
    }
  }
  function initialize(){if(!L.app?.model||L.app.busy){setTimeout(initialize,80);return;}L.building=new BuildingExperience();L.building.journey=new L.TowerJourney(L.building);L.building.continuous=new L.ContinuousTower(L.building.journey);L.building.society.zombie=new L.ZombieSociety(L.building);L.building.reactions=new L.CivilianReactions(L.building);L.building.society.emergency=new L.OfficeEmergency(L.building);new L.MeleeCombat(L.building,L.building.continuous);L.characterAssets=new L.CharacterAssets();L.app.reset();L.building.matrixLab=new L.MatrixEvolution(L.building);}
  initialize();
})();
