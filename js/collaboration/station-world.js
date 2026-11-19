/* A complete exterior → selected module → persistent cabin journey, sharing the app renderer. */
(() => {
  'use strict';const C=window.CoScene,T=THREE,$=id=>document.getElementById(id),base=new URL('../../assets/station/',document.currentScript.src);
  const ease=t=>t*t*t*(t*(t*6-15)+10);
  // r128 raycasting reads integer positions without the GPU's normalization.
  // Decode once after loading so picking and bounds match the rendered hull.
  function normalizeStationPickingGeometry(root){
    const seen=new Set(),limits={Uint8Array:255,Uint8ClampedArray:255,Uint16Array:65535,Uint32Array:4294967295,Int8Array:127,Int16Array:32767,Int32Array:2147483647};
    root.traverse(mesh=>{
      const geometry=mesh.geometry;if(!mesh.isMesh||!geometry||seen.has(geometry))return;seen.add(geometry);
      const position=geometry.getAttribute('position');if(!position?.normalized)return;
      const array=position.isInterleavedBufferAttribute?position.data.array:position.array,max=limits[array.constructor.name];if(!max)return;
      const stride=position.isInterleavedBufferAttribute?position.data.stride:position.itemSize,offset=position.isInterleavedBufferAttribute?position.offset:0,values=new Float32Array(position.count*position.itemSize);
      for(let i=0;i<position.count;i++)for(let j=0;j<position.itemSize;j++)values[i*position.itemSize+j]=Math.max(array[i*stride+offset+j]/max,-1);
      const decoded=new T.BufferAttribute(values,position.itemSize);decoded.name=position.name;decoded.setUsage(position.usage??position.data?.usage??T.StaticDrawUsage);
      geometry.setAttribute('position',decoded);geometry.computeBoundingBox();geometry.computeBoundingSphere();
    });
  }
  C.normalizeStationPickingGeometry=normalizeStationPickingGeometry;
  const stationAssets={exterior:{url:'tiangong-exterior.66ddca6afe0d.glb',bytes:12667816},props:{'cargo-bag':{url:'props/cargo-bag/interior.b4ea3c0c3e27.glb',bytes:537672},'lab-instrument':{url:'props/lab-instrument/interior.2bbbef1d169f.glb',bytes:1483284},'eva-suit':{url:'props/eva-suit/interior.3e5bcb02188e.glb',bytes:431080}}};
  class StationExperience {
    constructor(owner){
      this.o=owner;this.v=owner.v;this.selected='tianhe';this.phase='overview';this.rooms=new Map();this.modules=new Map();this.scene=new T.Scene();this.scene.background=new T.Color('#050c16').convertSRGBToLinear();this.root=new T.Group();this.scene.add(this.root);this.exterior=new T.Group();this.root.add(this.exterior);this.environment=new T.Group();this.root.add(this.environment);this.scene.environment=this.v.scene.environment;this.elapsed=0;this.exploded=false;this.lightMode='day';this.serial=0;this.crewManifest=C.stationCrewManifest||{tianhe:2,habitat:1,node:1,wentian:1,mengtian:0,tianzhou:0,shenzhou:0,airlock:0};C.stationCrewManifest=this.crewManifest;this.crewRoster=[['crew-01','林岚','tianhe'],['crew-02','陈亦','tianhe'],['crew-03','周宁','habitat'],['crew-04','许知','node'],['crew-05','江月','wentian']].map(([id,name,cabin],globalIndex)=>({id,name,cabin,globalIndex}));this.traffic=C.StationTraffic?new C.StationTraffic(this):null;
      this.ambient=new T.HemisphereLight('#b1d2f4','#1f3144',.65);this.sun=new T.DirectionalLight('#fff0d9',2.6);this.sun.position.set(-35,40,30);this.fill=new T.DirectionalLight('#80b9e6',.45);this.fill.position.set(25,-4,-30);this.scene.add(this.ambient,this.sun,this.fill);
      this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-36,right:36,top:36,bottom:-36,near:1,far:160});this.sun.shadow.bias=-.00008;this.sun.shadow.normalBias=.025;this.sun.shadow.camera.updateProjectionMatrix();this.createSpace();this.createUI();this.bind();this.scenarios=C.StationScenarios?new C.StationScenarios(this):null;
    }
    ensurePost(){
      if(this.composer)return;const v=this.v;this.composer=new T.EffectComposer(v.renderer);this.ao=new T.SSAOPass(this.scene,v.camera,512,512);this.ao.kernelRadius=.19;this.ao.minDistance=.00002;this.ao.maxDistance=.0018;this.ao.normalRenderTarget.depthTexture.type=T.UnsignedIntType;
      const override=this.ao.overrideVisibility.bind(this.ao);this.ao.overrideVisibility=()=>{override();this.environment.traverse(o=>{o.visible=false;});this.scene.traverse(o=>{if(o.userData.noAO)o.visible=false;});};
      // Dynamic crew do not contribute to the cached architecture AO. Their
      // visible depth must still mask it, or cabinet edges show through bodies.
      this.ao.beautyRenderTarget.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
      const copy=this.ao.copyMaterial;Object.assign(copy.uniforms,{cabinBeauty:{value:this.ao.beautyRenderTarget.texture},cabinDepth:{value:this.ao.beautyRenderTarget.depthTexture},cabinArchitectureDepth:{value:this.ao.normalRenderTarget.depthTexture},cabinMask:{value:false}});
      copy.fragmentShader=copy.fragmentShader.replace('uniform float opacity;','uniform sampler2D cabinBeauty; uniform sampler2D cabinDepth; uniform sampler2D cabinArchitectureDepth; uniform bool cabinMask; uniform float opacity;').replace('gl_FragColor = opacity * texel;','gl_FragColor = opacity * texel; if(cabinMask){vec3 ao=texel.rgb;if(texture2D(cabinDepth,vUv).r < texture2D(cabinArchitectureDepth,vUv).r - 0.00000002) ao=vec3(1.0);gl_FragColor=vec4(texture2D(cabinBeauty,vUv).rgb*ao,1.0);}');
      const renderPass=this.ao.renderPass.bind(this.ao);this.ao.renderPass=(renderer,material,...rest)=>{if(material===copy){if(copy.uniforms.tDiffuse.value===this.ao.beautyRenderTarget.texture)return;copy.uniforms.cabinMask.value=copy.uniforms.tDiffuse.value===this.ao.blurRenderTarget.texture;copy.blending=T.NoBlending;}return renderPass(renderer,material,...rest);};
      this.composer.addPass(this.ao);this.composer.addPass(new T.ShaderPass(T.GammaCorrectionShader));
      window.IndoorLab.cacheStaticAO(this.ao,()=>{v.camera.updateMatrixWorld();return this.selected+':'+this.room.roof.visible+':'+v.camera.matrixWorld.elements.map(x=>x.toFixed(5)).join(',')+':'+v.camera.projectionMatrix.elements.join(',')+':'+this.room.hatches.map(h=>h.leaf.position.x.toFixed(2)).join(',');});
    }
    prepare(onProgress){
      if(this.prepared){onProgress?.(.92,'空间站模型已就绪');return Promise.resolve();}
      this.prepareListeners??=new Set();if(onProgress)this.prepareListeners.add(onProgress);
      if(this.preparing){if(this.prepareProgress)onProgress?.(...this.prepareProgress);return this.preparing;}
      this.preparedAssets??=new Map();const token=this.prepareToken=(this.prepareToken||0)+1,controller=new AbortController(),signal=controller.signal,loaded=new Map(),crewBytes=4053336,textureBytes=2420036,earthBytes=512606;
      const resources=[['exterior',stationAssets.exterior],...Object.entries(stationAssets.props)],total=resources.reduce((sum,[,asset])=>sum+asset.bytes,crewBytes+textureBytes+earthBytes);let crewDone=false,texturesDone=false,earthDone=false;
      const emit=(fraction,text)=>{if(signal.aborted||token!==this.prepareToken)return;this.prepareProgress=[fraction,text];for(const callback of this.prepareListeners)callback(fraction,text);};
      const report=()=>{const bytes=[...loaded.values()].reduce((a,b)=>a+b,0)+(crewDone?crewBytes:0)+(texturesDone?textureBytes:0)+(earthDone?earthBytes:0),pending=resources.filter(([name,asset])=>(loaded.get(name)||0)<asset.bytes).map(([name])=>name);const text=pending.includes('exterior')?'正在下载空间站外观与舱内设备…':pending.length?'正在准备舱内设备…':!crewDone?'正在准备空间站乘员…':!texturesDone||!earthDone?'正在准备舱内材质与地球背景…':'正在解析空间站模型…';emit(.04+.84*Math.min(1,bytes/total),text);};
      const load=async(name,asset)=>{
        const url=new URL(asset.url,base).href;if(this.preparedAssets.has(url)){loaded.set(name,asset.bytes);report();return this.preparedAssets.get(url);}
        const response=await fetch(url,{signal});if(!response.ok)throw Error('空间站模型下载失败（'+response.status+'），请重新尝试。');
        let data;
        if(response.body?.getReader){const reader=response.body.getReader(),chunks=[];let count=0;while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);count+=value.length;loaded.set(name,Math.min(asset.bytes*.98,count));report();}const buffer=new Uint8Array(count);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}data=buffer.buffer;}
        else data=await response.arrayBuffer();
        if(signal.aborted)throw Error('空间站准备已中止，请重新尝试。');
        const loader=new T.GLTFLoader();if(window.MeshoptDecoder)loader.setMeshoptDecoder(window.MeshoptDecoder);
        const gltf=await new Promise((resolve,reject)=>loader.parse(data,new URL('.',url).href,resolve,reject));this.preparedAssets.set(url,gltf);loaded.set(name,asset.bytes);report();return gltf;
      };
      let timeout;const deadline=new Promise((_,reject)=>{timeout=setTimeout(()=>{controller.abort();reject(Error('空间站下载等待较久，请检查网络后重新尝试。'));},120000);});
      this.preparing=Promise.race([(async()=>{
        report();const props=new Map(),[gltf]=await Promise.all([
          load('exterior',stationAssets.exterior),
          (async()=>{const assets=window.IndoorLab.characterAssets;if(assets?.ensureCrew&&await assets.ensureCrew()===false)throw Error('空间站乘员未能下载完成，请重新尝试。');crewDone=true;report();})(),
          (async()=>{await C.prepareStationTextures();texturesDone=true;report();})(),
          (async()=>{await this.prepareEarthTexture();earthDone=true;report();})(),
          ...Object.entries(stationAssets.props).map(async([name,asset])=>props.set(name,(await load(name,asset)).scene))
        ]);
        if(signal.aborted||token!==this.prepareToken)throw Error('空间站准备已中止，请重新尝试。');
        emit(.90,'模型已下载，正在整理空间站舱段…');
        // Attach only a complete resource set. Failed retries keep successful
        // parsed assets without duplicating the station or building partial cabins.
        if(!this.exteriorPrepared){
          normalizeStationPickingGeometry(gltf.scene);
          for(const group of gltf.scene.children){const id=group.userData.moduleId||group.name,spec=C.stationModule(id);if(!spec)continue;group.userData.moduleId=id;this.modules.set(id,group);group.traverse(mesh=>{if(!mesh.isMesh)return;mesh.userData.moduleId=id;mesh.material=mesh.material.clone();mesh.material.envMapIntensity=.28;mesh.castShadow=mesh.userData.layerIndex===0;mesh.userData.stationShadow=mesh.castShadow;mesh.receiveShadow=true;mesh.material.side=T.FrontSide;mesh.userData.baseColor=mesh.material.color.clone();});}
          this.exterior.add(gltf.scene);this.exteriorPrepared=true;
        }
        C.stationProps=props;if(!this.guide)this.createExtractionGuide();this.morphology??=new C.StationMorphology(this);this.shellStudy??=new C.StationShellStudy(this);this.shellCabins??=new C.StationShellCabins(this);
        this.initializeContexts();for(const room of this.rooms.values())room.root.visible=false;this.prepared=true;emit(.92,'空间站模型已就绪');
      })(),deadline]).catch(error=>{controller.abort();if(error?.name==='AbortError'||error instanceof TypeError)throw Error('空间站下载连接中断，请检查网络后重新尝试。');throw error;}).finally(()=>{clearTimeout(timeout);if(token===this.prepareToken){this.preparing=null;this.prepareListeners.clear();}});
      return this.preparing;
    }
    warmTravel(){
      if(this.travelWarmed)return;
      const renderer=this.v.renderer,previousTarget=renderer.getRenderTarget(),exposure=renderer.toneMappingExposure,autoClear=renderer.autoClear,shadowUpdate=renderer.shadowMap.needsUpdate,target=new T.WebGLRenderTarget(16,16),camera=new T.PerspectiveCamera(48,1.5,.05,2000),materials=new Map(),meshes=[];
      target.texture.encoding=renderer.outputEncoding;camera.position.set(64,44,73);camera.lookAt(0,0,-4);
      this.exterior.traverse(mesh=>{if(!mesh.isMesh)return;meshes.push([mesh,mesh.castShadow]);if(!materials.has(mesh.material))materials.set(mesh.material,{opacity:mesh.material.opacity,transparent:mesh.material.transparent,depthWrite:mesh.material.depthWrite});});
      try{
        renderer.autoClear=true;renderer.toneMappingExposure=1.12;renderer.setRenderTarget(target);renderer.render(this.scene,camera);
        // Arrival fades the hull; warm that shader variant as well as the opaque overview.
        for(const material of materials.keys()){material.opacity=.5;material.transparent=true;material.depthWrite=false;material.needsUpdate=true;}for(const [mesh]of meshes)mesh.castShadow=false;
        renderer.render(this.scene,camera);this.travelWarmed=true;
      }finally{
        for(const [material,state]of materials){Object.assign(material,state);material.needsUpdate=true;}for(const [mesh,castShadow]of meshes)mesh.castShadow=castShadow;
        renderer.setRenderTarget(previousTarget);renderer.toneMappingExposure=exposure;renderer.autoClear=autoClear;renderer.shadowMap.needsUpdate=shadowUpdate;target.dispose();
      }
    }
    createSpace(){
      let seed=741;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      const positions=[],colors=[];for(let i=0;i<2100;i++){const theta=random()*Math.PI*2,u=random()*2-1,r=300+random()*350,s=Math.sqrt(1-u*u);positions.push(r*s*Math.cos(theta),r*u,r*s*Math.sin(theta));const b=.5+random()*.5;colors.push(b*.85,b*.93,b);}
      const stars=new T.BufferGeometry();stars.setAttribute('position',new T.Float32BufferAttribute(positions,3));stars.setAttribute('color',new T.Float32BufferAttribute(colors,3));this.starColors=new T.Float32BufferAttribute(colors,3);stars.setAttribute('color',this.starColors);this.starBase=colors.slice();this.environment.add(new T.Points(stars,new T.PointsMaterial({vertexColors:true,size:.45,sizeAttenuation:true,depthWrite:false,toneMapped:false})));
      this.earth=new T.Mesh(new T.SphereGeometry(105,96,64),new T.MeshStandardMaterial({color:'#b8d8ef',roughness:1,metalness:0}));this.earth.position.set(55,-140,-150);this.earth.rotation.set(.22,2.2,-.16);this.environment.add(this.earth);this.prepareEarthTexture().catch(()=>{});
      const atmosphere=new T.Mesh(new T.SphereGeometry(108,64,48),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.BackSide,blending:T.AdditiveBlending,uniforms:{glow:{value:new T.Color('#3e9ce0')}},vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 n;varying vec3 v;uniform vec3 glow;void main(){float a=pow(1.0-abs(dot(normalize(n),normalize(v))),3.5);gl_FragColor=vec4(glow,a*.48);}'}));atmosphere.position.copy(this.earth.position);this.environment.add(atmosphere);
    }
    prepareEarthTexture(){
      if(this.earthTextureReady)return Promise.resolve();if(this.earthTexturePromise)return this.earthTexturePromise;
      this.earthTexturePromise=new Promise((resolve,reject)=>{const texture=new T.TextureLoader().load(new URL('earth-day.jpg',base).href,()=>{this.earthTextureReady=true;resolve();},undefined,()=>reject(Error('地球背景未能下载完成，请重新尝试。')));texture.encoding=T.sRGBEncoding;texture.anisotropy=4;const previous=this.earth.material.map;this.earth.material.map=texture;this.earth.material.needsUpdate=true;previous?.dispose();}).finally(()=>{this.earthTexturePromise=null;});return this.earthTexturePromise;
    }
    createUI(){
      this.ui=document.createElement('section');this.ui.id='station-ui';this.ui.hidden=true;this.ui.setAttribute('aria-label','天宫空间站探索');this.ui.innerHTML=`
      <header class="st-header"></header>
      <div class="st-heading"><span>SPATIAL SIMULATION / <b>ORBITAL</b></span><h1>轨道上的共同日常。</h1><p>单击抽出舱段 · 再次点击进入舱内 · 拖动旋转 / 滚轮缩放</p></div>
      <div class="st-observation-dock"><aside class="st-panel" aria-label="舱段观察"><span class="st-kicker" id="st-kicker">STATION / LIVE</span><h2 id="st-title">整站空间</h2><p id="st-description">首次点击抽出舱段，再次点击进入舱内。</p>
      <div class="st-facts"><div><b id="st-number">08</b><small id="st-number-label">可进入空间</small></div><div><b id="st-connections">07</b><small id="st-connections-label">舱门连接</small></div><div><b id="st-mode">整站</b><small>当前视角</small></div></div>
      <div class="st-actions" id="st-actions" hidden><button id="st-return" class="st-secondary" hidden>← 返回整站总览</button><button id="st-enter" class="st-primary">进入舱内模式 <span>↗</span></button></div>
      <div class="st-neighbors" id="st-neighbors" hidden><small>相邻空间 · 通过舱门前往</small><div id="st-links"></div></div>
      </aside><button id="st-walk" class="ob-st-walk" hidden>第一人称</button><button id="st-partners" class="st-back" title="部署具身智能">部署具身智能</button></div>
      <nav class="st-tools" aria-label="空间站视角"><button id="st-random-shape" aria-pressed="false" title="随机切换六舱位外壳">◎ 随机形态</button><button id="st-restore-shape" hidden title="恢复原始天宫形态">恢复原貌</button><button id="st-explode" aria-label="展开舱段" aria-pressed="false">↑ <span>展开舱段</span></button><button id="st-cutview" hidden>空间透视</button><button id="st-top" hidden>平面总览</button><button id="st-reset" title="复位镜头" aria-label="复位视角">⌖</button></nav>
      <p id="st-shape-status" role="status" aria-live="polite" hidden></p>
      <div class="st-bottom"><div class="st-view-bar"><div id="st-help" hidden></div></div><nav class="st-modules" aria-label="空间站舱段"><div class="st-index-title"><span>舱段索引<small>MODULE INDEX</small></span><b>08</b></div><div class="st-module-list">${C.stationModules.map(m=>`<button data-st-module="${m.id}" aria-label="${m.index} ${m.name}" aria-pressed="false" style="--cabin-color:${m.color}"><i class="st-module-icon" aria-hidden="true"></i><b>${m.index}</b><span class="st-module-copy"><strong>${m.name}</strong><small>${m.english.split(' / ')[0]}</small></span><em aria-hidden="true"></em></button>`).join('')}</div><p class="st-index-help">单击抽出 · 再次点击进入<br>保留整站关系，观察舱内日常</p></nav><div class="st-foot"><span>PEOPLE · ORBITS · CONNECTIONS</span><span id="st-status">八个独立空间 · 轨道上的共同日常</span></div></div>
      <div id="st-touch-move" hidden aria-label="失重移动控制"><button data-st-move="w" aria-label="向前">↑</button><button data-st-move="a" aria-label="向左">←</button><button data-st-move="s" aria-label="向后">↓</button><button data-st-move="d" aria-label="向右">→</button><button data-st-move=" " aria-label="上浮">上浮</button><button data-st-move="c" aria-label="下沉">下沉</button></div><div id="st-hatch-prompt" hidden><span id="st-hatch-text"></span><button id="st-hatch-use">E · 开启舱门</button></div><div id="st-transfer" hidden role="status">正在通过舱门…</div>`;
      document.body.appendChild(this.ui);
      $('st-return').onclick=()=>this.phase==='interior'?this.returnToSelection():this.overview();$('st-enter').onclick=()=>this.enter(this.selected);$('st-reset').onclick=()=>this.cameraMode(this.phase==='interior'?'detail':'perspective');$('st-explode').onclick=()=>{if(this.shellStudy?.changed||this.morphBusy)return;this.exploded=!this.exploded;this.syncUI();};$('st-cutview').onclick=()=>this.cameraMode('detail');$('st-top').onclick=()=>this.cameraMode('top');$('st-walk').onclick=()=>this.cameraMode('walk');$('st-partners').onclick=()=>this.o.openRobotLibrary();$('st-hatch-use').onclick=()=>this.interact();
      $('st-random-shape').onclick=()=>this.toggleMorphology();$('st-restore-shape').onclick=()=>this.restoreMorphology();
      this.ui.querySelectorAll('[data-st-module]').forEach(button=>button.onclick=()=>{if(this.phase==='interior')this.enter(button.dataset.stModule);else this.select(button.dataset.stModule);});
      this.ui.querySelectorAll('[data-st-move]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);this.v.walkKeys.add(b.dataset.stMove);};for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>this.v.walkKeys.delete(b.dataset.stMove));});
      $('st-links').onclick=e=>{const door=e.target.closest('[data-st-door]');if(door){this.toggleHatch(door.dataset.stDoor);return;}const b=e.target.closest('[data-st-link]');if(b)this.transfer(b.dataset.stLink);};
      $('st-links').onchange=e=>{if(e.target.id==='st-neighbor-select')this.refreshHatchUI();};
    }
    async toggleMorphology(){
      if(this.morphing||this.morphBusy){this.stopMorphology();return;}
      if(!this.shellStudy||this.o.environment!=='station'||this.o.switching||this.transferring||this.phase!=='overview'||this.scenarios?.blocksObservation)return;
      this.shellCabins?.close({focus:false});
      const token=this.morphToken=(this.morphToken||0)+1;
      this.morphWasRunning=this.o.externalRunning;this.o.externalRunning=false;this.morphBusy=true;this.morphCount=0;this.morphError=null;this.tween=null;this.o.robotInteraction.cancel();this.o.chat?.cancelPick();this.syncMorphologyUI();
      try{
        await this.shellStudy.prepare();
        if(token!==this.morphToken||this.o.environment!=='station'||this.o.switching)return;
        this.morphBusy=false;this.morphing=true;this.nextMorphology();
      }catch(error){console.error('Station shell:',error);if(token===this.morphToken){this.morphError='外壳方案暂未就绪，请重试';this.stopMorphology();}}
    }
    nextMorphology(now=performance.now()){
      this.shellCabins?.close({focus:false});
      this.shellStudy.showNext();this.morphCount++;this.nextMorphAt=now+180;
      this.exterior.visible=false;for(const room of this.rooms.values())room.root.visible=false;
      if(this.morphology)this.morphology.corridorGroup.visible=false;
      this.guide.visible=false;this.syncMorphologyUI();
    }
    updateMorphology(now){
      if(this.morphing&&!this.o.switching&&!document.hidden&&this.o.environment==='station'&&now>=this.nextMorphAt)this.nextMorphology(now);
    }
    stopMorphology(){
      if(!this.morphing&&!this.morphBusy)return;
      this.morphToken=(this.morphToken||0)+1;this.morphing=false;this.morphBusy=false;this.o.externalRunning=this.morphWasRunning;this.syncMorphologyUI();
    }
    clearMorphologyCamera(){
      this.exploded=false;this.overviewCamera=null;this.extractionCamera=null;this.extractionId=null;this.pullOffset=null;this.closingPreview=null;this.tween=null;
      for(const group of this.modules.values())group.position.set(0,0,0);
    }
    frameMorphologyLight(){
      const changed=this.morphology?.changed&&this.phase!=='interior',center=changed?this.morphology.bounds.getCenter(new T.Vector3()):new T.Vector3(),radius=changed?Math.max(36,this.morphology.bounds.getBoundingSphere(new T.Sphere()).radius*1.12):36;
      this.scene.add(this.sun.target);this.sun.target.position.copy(center);this.sun.target.updateMatrixWorld();this.sun.position.copy(center).add(new T.Vector3(-35,40,30).multiplyScalar(Math.max(1,radius/36)));
      Object.assign(this.sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:1,far:Math.max(160,radius*5)});this.sun.shadow.camera.updateProjectionMatrix();
    }
    morphologyPose(viewport){
      const center=this.morphology.bounds.getCenter(new T.Vector3()),direction=new T.Vector3(47,32,54).normalize(),right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),direction).normalize(),up=new T.Vector3().crossVectors(direction,right).normalize();
      const phone=viewport.width<=760,index=this.ui.querySelector('.st-modules').getBoundingClientRect(),panel=this.ui.querySelector('.st-panel').getBoundingClientRect(),toolbar=this.ui.querySelector('.st-tools').getBoundingClientRect(),status=$('st-shape-status'),statusBox=status.getBoundingClientRect(),chat=$('co-observation-chat')?.getBoundingClientRect();
      const x0=phone?12:panel.right-viewport.left+20,x1=index.left-viewport.left-20,y0=Math.max(toolbar.bottom,status.hidden?0:statusBox.bottom)-viewport.top+24,y1=phone?panel.top-viewport.top-18:(chat?.top||viewport.bottom)-viewport.top-20;
      const left=2*x0/viewport.width-1,rightEdge=2*x1/viewport.width-1,top=1-2*y0/viewport.height,bottom=1-2*y1/viewport.height,cx=(left+rightEdge)/2,cy=(top+bottom)/2,hx=Math.max(.12,(rightEdge-left)/2)/1.08,hy=Math.max(.12,(top-bottom)/2)/1.08,tangent=Math.tan(this.v.camera.fov*Math.PI/360),aspect=this.v.camera.aspect;
      let distance=12;this.root.updateMatrixWorld(true);
      // Fit the individual hull and array bounds; one large sphere would make
      // tall or diagonal stations unnecessarily small beside the cabin index.
      const fit=point=>{const corner=point.sub(center),depth=corner.dot(direction),x=corner.dot(right)/(tangent*aspect),y=corner.dot(up)/tangent;distance=Math.max(distance,(x+(cx+hx)*depth)/hx,(-x-(cx-hx)*depth)/hx,(y+(cy+hy)*depth)/hy,(-y-(cy-hy)*depth)/hy);};
      for(const group of this.modules.values())group.traverse(mesh=>{if(!mesh.isMesh)return;const b=mesh.geometry.boundingBox;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])fit(new T.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld));});
      for(const link of this.morphology.corridorGroup.children)for(const p of link.userData.points)fit(new T.Vector3(...p));
      const target=center.clone().addScaledVector(right,-cx*distance*tangent*aspect).addScaledVector(up,-cy*distance*tangent);return{position:target.clone().addScaledVector(direction,distance),target};
    }
    restoreMorphology(){
      if(!this.shellStudy||this.o.environment!=='station'||this.o.switching||this.phase!=='overview'||this.scenarios?.blocksObservation)return;
      this.shellCabins?.close({focus:false});
      this.stopMorphology();this.shellStudy.restore();this.morphError=null;this.exterior.visible=true;this.syncUI();this.v.renderer.shadowMap.needsUpdate=true;
    }
    syncMorphologyUI(){
      const overview=this.phase==='overview',changed=!!this.shellStudy?.changed,busy=!!this.morphBusy,button=$('st-random-shape'),status=$('st-shape-status'),entry=this.shellStudy?.current,future=entry?.plan.kind==='future',original=entry?.plan.kind==='original';
      button.hidden=!overview;button.textContent=busy?'取消准备':this.morphing?'停止并采用':'◎ 随机形态';button.title='随机切换原始天宫、常规与未来外壳，保持当前镜头';button.setAttribute('aria-pressed',String(!!this.morphing||busy));
      $('st-restore-shape').hidden=!overview||!changed;
      $('st-explode').disabled=busy||changed;$('st-explode').hidden=!overview||changed;$('st-reset').hidden=this.phase==='focus'||changed;
      status.hidden=!overview||!changed&&!busy&&!this.morphError;
      status.textContent=this.morphError||(busy?'正在准备空间站外壳…':(this.morphing?'随机形态 · ':'已采用 · ')+(entry?.name||'')+(this.morphing?' · 180 毫秒 / 次':''));
      // Frequent switching is visual; announce only the adopted result to readers.
      status.setAttribute('aria-live',this.morphing?'off':'polite');
      this.ui.dataset.morphing=String(!!this.morphing);this.ui.dataset.shellStudy=String(changed);
      const rail=this.ui.querySelector('.st-modules');let summary=rail.querySelector('.st-shell-index');
      if(!summary){summary=document.createElement('div');summary.className='st-shell-index';rail.insertBefore(summary,rail.querySelector('.st-index-help'));}
      summary.hidden=!changed;rail.querySelector('.st-module-list').hidden=changed;this.ui.querySelectorAll('[data-st-module]').forEach(b=>b.disabled=changed||busy);
      rail.querySelector('.st-index-title>span').innerHTML=changed?(original?'原始舱段配置<small>ORIGINAL STATION</small>':future?'六功能分区<small>FUTURE CONCEPT</small>':'六舱位配置<small>HULL VOLUMES</small>'):'舱段索引<small>MODULE INDEX</small>';rail.querySelector('.st-index-title>b').textContent=changed?String(entry.plan.slots.length).padStart(2,'0'):'08';
      rail.querySelector('.st-index-help').innerHTML=changed?(this.morphing?'停止并采用后可点击舱室<br>每种形态均有对应内部空间':'点击外壳或列表弹出舱室<br>点击空白或按 Esc 收回'):'单击抽出 · 再次点击进入<br>保留整站关系，观察舱内日常';
      this.ui.querySelector('.st-heading>p').textContent=changed?'点击舱区弹出内部空间 · 拖动旋转 / 滚轮缩放':'单击抽出舱段 · 再次点击进入舱内 · 拖动旋转 / 滚轮缩放';
      if(changed){
        $('st-kicker').textContent=original?'STATION / ORIGINAL':future?'STATION / FUTURE':'STATION / SIX BAYS';$('st-title').textContent=entry.name;$('st-description').textContent=entry.description||'按六个功能舱位的尺度与排布生成外壳。';
        $('st-number').textContent=String(entry.plan.slots.length).padStart(2,'0');$('st-number-label').textContent=original?'原始舱段':future?'功能分区':'功能舱位';$('st-connections').textContent=entry.plan.power.panels?.length||entry.plan.power.panelCount;$('st-connections-label').textContent='太阳翼组';$('st-mode').textContent='外壳';
        $('st-status').textContent='空间站外壳 · '+entry.name+' · 4 组主翼 / 8 组辅助翼';
        const scale=entry.plan.coordinateScale;
        summary.innerHTML=entry.plan.slots.map((slot,i)=>`<button type="button" class="st-shell-slot" data-st-shell-slot="${slot.id}" aria-label="弹出${slot.name}" aria-pressed="false"><b>${String(i+1).padStart(2,'0')}</b><div><strong>${slot.name}</strong><small>${future||original?slot.layoutLabel:'长 '+(slot.length*scale).toFixed(1)+' · 直径 '+(slot.radius*2*scale).toFixed(1)+' m'}</small>${future||original?'':`<i style="width:${Math.round(slot.volume/Math.max(...entry.plan.slots.map(s=>s.volume))*100)}%"></i>`}</div></button>`).join('');
      }
      this.shellCabins?.sync();
    }
    stopFloat(){this.floatVelocity?.set(0,0,0);this.verticalSpeed=0;this.v.walkKeys.clear();}
    bind(){
      const canvas=this.v.renderer.domElement;let down,touch;canvas.addEventListener('pointerdown',e=>{if(this.scenarios?.blocksObservation)return;if(e.pointerType==='touch'&&this.o.environment==='station'&&this.v.view==='walk')touch={x:e.clientX,y:e.clientY};});canvas.addEventListener('pointermove',e=>{if(this.scenarios?.blocksObservation||!touch||e.pointerType!=='touch'||this.v.view!=='walk')return;this.v.walkYaw-=(e.clientX-touch.x)*.003;this.v.walkPitch=T.MathUtils.clamp(this.v.walkPitch-(e.clientY-touch.y)*.003,-1.1,1.1);touch={x:e.clientX,y:e.clientY};});for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,()=>touch=null);
      document.addEventListener('pointerdown',e=>{down=!this.scenarios?.blocksObservation&&e.target===canvas&&e.button===0?{x:e.clientX,y:e.clientY,id:e.pointerId,moved:false}:null;},true);
      document.addEventListener('pointermove',e=>{if(down&&e.pointerId===down.id&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)down.moved=true;},true);
      document.addEventListener('pointercancel',()=>down=null,true);
      document.addEventListener('click',e=>{
        if(this.morphBusy||this.morphing||this.scenarios?.blocksObservation||this.o.environment!=='station'||this.o.switching||this.transferring||e.button!==0||e.target!==canvas||document.querySelector('dialog[open]')||this.o.robotInteraction?.pending||this.o.robotInteraction?.draft||this.o.chat?.picking||this.o.chat?.editing||this.o.chat?.commands?.busy||!down||down.moved||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;
        const rect=canvas.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),this.v.camera);
        if(this.shellStudy?.changed){this.shellCabins.handleClick(ray);e.stopImmediatePropagation();return;}
        if(this.phase!=='interior'){
          const preview=this.phase==='focus'?ray.intersectObject(this.room.root,true).find(h=>h.object.visible):null;const hit=ray.intersectObject(this.exterior,true)[0];if(preview&&(!hit||preview.distance<=hit.distance||hit.object.userData.moduleId===this.selected))this.enter(this.selected);else if(hit?.object.userData.moduleId)this.select(hit.object.userData.moduleId);else if(this.phase==='focus')this.overview();e.stopImmediatePropagation();
        }else if(this.v.view!=='walk'&&!document.pointerLockElement){
          // Test the cabin's whole local volume so clicking gaps between floor
          // panels or equipment never counts as clicking outside the room.
          const room=this.room;room.root.updateWorldMatrix(true,false);const localRay=ray.ray.clone().applyMatrix4(room.root.matrixWorld.clone().invert()),bounds=new T.Box3(new T.Vector3(-room.spec.width/2-.35,-.2,-room.spec.length/2-.35),new T.Vector3(room.spec.width/2+.35,3.65,room.spec.length/2+.35));
          if(!localRay.intersectsBox(bounds)){this.returnToSelection();e.stopImmediatePropagation();return;}
          const hits=ray.intersectObject(this.room.details,true);const hit=hits.find(h=>h.object.userData.hatch);if(hit){this.toggleHatch(hit.object.userData.hatch);e.stopImmediatePropagation();}
        }
      },true);
      this.v.controls.addEventListener('start',()=>{if(!this.scenarios?.blocksObservation)this.tween=null;});
      this.resizeObserver=new ResizeObserver(()=>{if(this.scenarios?.blocksObservation||this.o.environment!=='station'||this.o.switching)return;if(this.shellStudy?.changed)return;if(this.morphBusy)return;if(this.phase==='overview')this.overview(false);else if(this.phase==='interior'&&this.v.view!=='walk'&&!this.transferring)this.cameraMode('detail',false);});this.resizeObserver.observe(this.v.container);
      window.addEventListener('keydown',e=>{if(this.scenarios?.blocksObservation||this.o.environment!=='station'||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;if(e.code==='Escape'&&this.v.view!=='walk'){if(this.phase==='focus')this.overview();else if(this.phase==='interior')this.returnToSelection();}if(e.code==='KeyR'&&!e.repeat&&this.v.view!=='walk'&&!this.o.robotInteraction?.pending&&!this.o.chat?.picking)this.cameraMode(this.phase==='interior'?'detail':'perspective');});
      window.addEventListener('blur',()=>{if(this.o.environment==='station')this.stopFloat();});
      document.addEventListener('pointerlockchange',()=>{if(this.o.environment==='station'&&!document.pointerLockElement)this.stopFloat();});
    }
    get room(){return this.getRoom(this.selected);}
    getRoom(id){
      if(!this.rooms.has(id)){
        const room=C.buildStationInterior(C.stationModule(id));
        // Crew traffic is shared by all cabin-local simulations. Keep the
        // callbacks on the room as a small stable interface for the simulation
        // extension, while the traffic controller owns reservations and doors.
        room.requestCrewTransfer=person=>this.requestCrewTransfer(id,person);
        room.stepCrewTransfer=(person,dt)=>this.stepCrewTransfer(id,person,dt);
        room.cancelCrewTransfer=person=>this.cancelCrewTransfer(id,person);
        room.canTransferCrew=(person,point)=>this.canTransferCrew(id,person,point);
        room.onCrewAtHatch=(person,point)=>this.onCrewAtHatch(id,person,point);
        this.rooms.set(id,room);this.root.add(room.root);
      }
      return this.rooms.get(id);
    }
    crewForCabin(id){return this.crewRoster.filter(crew=>crew.cabin===id);}
    prepareContext(id,ctx){
      if(!ctx?.sim||ctx.stationCrewReady)return ctx;const slots=this.crewForCabin(id),people=ctx.sim.people;
      for(const [index,person] of people.entries()){
        const slot=slots[index];if(!slot)continue;
        person.id=slot.id;person.name=slot.name;person.crewIndex=slot.globalIndex;person.currentCabin=id;person.cabinVisits??={};person.cabinVisits[id]=(person.cabinVisits[id]||0)+1;
        if(!person.model.userData.stationCrew){const model=C.makeStationCrew(slot.globalIndex);model.position.copy(person.model.position);person.model.parent?.remove(person.model);person.model=model;ctx.sim.group.add(model);person.radius=.28;}
        person.crewInitialized=false;ctx.sim.initCrew(person,slot.globalIndex);
      }
      ctx.stationCrewReady=true;return ctx;
    }
    contextFor(id){
      const key='station-'+id,existing=this.o.contexts.get(key);if(existing)return this.prepareContext(id,existing);
      const world=this.getRoom(id);world.displayName='空间站 · '+world.spec.name;world.root.visible=false;
      const ctx={key,world,sim:new C.Simulation(world)};ctx.sim.group.userData.noAO=true;ctx.sim.routes.userData.noAO=true;ctx.sim.onEvent=event=>this.o.chat?.event(event);this.o.contexts.set(key,ctx);return this.prepareContext(id,ctx);
    }
    initializeContexts(){
      for(const module of C.stationModules)this.contextFor(module.id);
      this.traffic?.initialize();this.contextsReady=true;
    }
    requestCrewTransfer(sourceId,person,preferred){return this.traffic?.request(sourceId,person,preferred)||false;}
    stepCrewTransfer(sourceId,person,dt){return this.traffic?.owns(person)||false;}
    cancelCrewTransfer(sourceId,person){return this.traffic?.cancel(person)||false;}
    canTransferCrew(sourceId,person,point){return this.traffic?.available(sourceId,point?.id,person)||false;}
    onCrewAtHatch(sourceId,person,point){return this.traffic?.request(sourceId,person,point?.id)||false;}
    activate(){
      this.saved={running:this.o.externalRunning,scene:this.v.scene,exposure:this.v.renderer.toneMappingExposure,maxPolar:this.v.controls.maxPolarAngle,minPolar:this.v.controls.minPolarAngle,minDistance:this.v.controls.minDistance,maxDistance:this.v.controls.maxDistance,up:this.v.camera.up.clone()};
      this.o.externalRunning=true;this.v.scene=this.scene;this.root.visible=true;this.ui.hidden=false;this.v.renderer.toneMappingExposure=1.12;this.phase='overview';this.selected='tianhe';for(const g of this.modules.values())g.position.set(0,0,0);this.initializeContexts();this.applyLighting();this.overview(false,true);if(this.shellStudy?.changed){this.exterior.visible=false;this.shellStudy.root.visible=true;}
    }
    deactivate(){
      this.eventPip?.hide();
      this.shellCabins?.close({focus:false});
      this.stopMorphology();
      this.scenarios?.stop();
      this.o.externalRunning=this.saved.running;
      this.restoreStationFrame();this.stopFloat();this.overviewCamera=null;this.closingPreview=null;++this.serial;clearTimeout(this.transferTimer);this.transferring=false;$('st-transfer').hidden=true;this.o.robotInteraction.cancel();if(document.pointerLockElement)document.exitPointerLock();this.v.firstPerson.viewChanged('perspective');this.v.view='perspective';this.v.scene=this.saved.scene;this.v.renderer.toneMappingExposure=this.saved.exposure;this.v.controls.maxPolarAngle=this.saved.maxPolar;this.v.controls.minPolarAngle=this.saved.minPolar;this.v.controls.minDistance=this.saved.minDistance;this.v.controls.maxDistance=this.saved.maxDistance;this.v.controls.enableRotate=true;this.v.camera.up.copy(this.saved.up);this.root.visible=false;this.ui.hidden=true;for(const room of this.rooms.values())room.root.visible=false;this.tween=null;delete document.body.dataset.stationPhase;delete document.body.dataset.stationView;
    }
    setModel(){
      const r=this.room;this.v.model={group:r.root,zones:r.zones,bounds:r.bounds,layoutItems:r.colliders,shellItems:[],doors:[],preset:'station',name:r.spec.name};const ctx=this.contextFor(this.selected);this.prepareContext(this.selected,ctx);
      this.v.grid=ctx.sim.grid;this.v.bounds=r.bounds;return ctx;
    }
    // The preview and the walkable cabin are the same persistent object. This
    // frame maps cabin-local navigation coordinates into its pressure-hull slot.
    cabinFrame(id,offset=new T.Vector3()){
      if(this.morphology)return this.morphology.frame(id,offset);
      const m=C.stationModule(id),q=new T.Quaternion(),axis=new T.Vector3(0,1,0);
      if(id==='wentian')q.setFromAxisAngle(axis,Math.PI/2);
      if(id==='mengtian')q.setFromAxisAngle(axis,-Math.PI/2);
      if(id==='airlock')q.setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2);
      const scale={tianhe:.73,habitat:.68,node:.48,wentian:.73,mengtian:.73,tianzhou:.65,shenzhou:.59,airlock:.62}[id];
      const p=new T.Vector3(...m.anchor).add(offset).sub(new T.Vector3(0,1.7,0).applyQuaternion(q).multiplyScalar(scale));
      return new T.Matrix4().compose(p,q,new T.Vector3(scale,scale,scale));
    }
    placeCabin(id){const r=this.getRoom(id),frame=this.cabinFrame(id,this.modules.get(id).position);frame.decompose(r.root.position,r.root.quaternion,r.root.scale);r.root.updateMatrixWorld(true);return frame;}
    createExtractionGuide(){
      this.guide=new T.Group();this.guide.visible=false;this.root.add(this.guide);
      this.slot=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1,1,1)),new T.LineDashedMaterial({color:'#9fddd8',transparent:true,opacity:.65,dashSize:.22,gapSize:.13,depthWrite:false}));this.slot.computeLineDistances();this.guide.add(this.slot);
      this.tether=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineDashedMaterial({color:'#9fddd8',transparent:true,opacity:.75,dashSize:.3,gapSize:.22,depthWrite:false}));this.guide.add(this.tether);
    }
    restoreStationFrame(){
      if(!this.interiorFrame)return;
      const frame=this.interiorFrame,q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().extractRotation(frame));
      this.v.camera.position.applyMatrix4(frame);this.v.controls.target.applyMatrix4(frame);this.v.camera.up.applyQuaternion(q).normalize();
      this.root.position.set(0,0,0);this.root.quaternion.identity();this.root.scale.setScalar(1);this.root.updateMatrixWorld(true);this.interiorFrame=null;this.v.controls.update();
    }
    select(id,{returning=false}={}){
      if(this.shellStudy?.changed||this.morphBusy||this.transferring||!C.stationModule(id))return;if(this.phase==='focus'&&this.selected===id&&!returning){this.enter(id);return;}
      this.stopMorphology();
      if(this.phase==='overview'&&!this.overviewCamera)this.overviewCamera={position:this.v.camera.position.clone(),target:this.v.controls.target.clone()};
      this.restoreStationFrame();this.o.robotInteraction.cancel();this.o.following=false;
      this.selected=id;this.phase='focus';this.exploded=false;this.closingPreview=null;this.exterior.visible=true;this.environment.visible=true;
      // Extract away from the docking node: front cabins move forward, lateral
      // labs move to their own side, and the lower airlock moves downwards.
      if(!returning||!this.pullOffset||this.extractionId!==id){const spec=C.stationModule(id);this.pullOffset=this.extractionDirection(id).multiplyScalar(Math.max(14,spec.length*1.35));if(Math.abs(this.pullOffset.y)<.001)this.pullOffset.y=['tianhe','habitat'].includes(id)?9:4;}
      for(const [key,r]of this.rooms)r.root.visible=key===id;
      const room=this.room;room.root.visible=true;room.roof.visible=false;this.placeCabin(id);this.setModel();
      this.v.view='perspective';this.v.firstPerson.viewChanged('perspective');this.v.controls.enabled=true;this.v.controls.enableRotate=true;this.v.controls.maxPolarAngle=Math.PI;this.v.controls.minDistance=2;this.v.controls.maxDistance=500;this.v.camera.fov=40;this.v.camera.updateProjectionMatrix();
      this.tween=null;
      if(returning&&this.extractionCamera&&this.extractionId===id)this.fly(this.extractionCamera.position,this.extractionCamera.target);
      else this.framePreview();
      this.applyLighting();this.syncUI();
    }
    framePreview(){if(this.phase!=='focus')return;const target=new T.Vector3(...this.room.spec.anchor).add(this.pullOffset),direction=this.v.camera.position.clone().sub(this.v.controls.target).normalize();this.fly(target.clone().addScaledVector(direction,Math.max(23,23/this.v.camera.aspect)),target);}
    returnToSelection(){if(this.transferring)return;this.select(this.selected,{returning:true});}
    overview(animate=true,sceneArrival=false){
      if(this.transferring||!sceneArrival&&(this.shellStudy?.changed||this.morphBusy))return;const previous=this.phase;this.restoreStationFrame();this.o.robotInteraction.cancel();this.o.following=false;this.closingPreview=previous!=='overview'?this.selected:null;this.phase='overview';this.exploded=false;this.exterior.visible=true;this.environment.visible=true;for(const [id,r]of this.rooms)r.root.visible=id===this.closingPreview;this.v.view='perspective';this.v.firstPerson.viewChanged('perspective');this.v.controls.enabled=true;this.v.controls.enableRotate=true;this.v.controls.maxPolarAngle=Math.PI;this.v.controls.minDistance=6;this.v.controls.maxDistance=500;this.v.camera.near=.05;this.v.camera.far=1200;this.v.camera.fov=40;this.v.camera.updateProjectionMatrix();this.applyLighting();
      const viewport=this.v.renderer.domElement.getBoundingClientRect(),aspect=viewport.width/Math.max(1,viewport.height),distance=1.35*Math.max(1,1.25/aspect),target=new T.Vector3(0,0,-4),position=new T.Vector3(47,32,54).multiplyScalar(distance),saved=this.overviewCamera;
      if(this.morphology?.changed){
        this.syncUI();const radius=this.morphology.bounds.getBoundingSphere(new T.Sphere()).radius,pose=this.morphologyPose(viewport);target.copy(pose.target);position.copy(pose.position);
        this.v.controls.maxDistance=Math.max(500,radius*12);this.v.camera.far=Math.max(1200,radius*16);this.v.camera.updateProjectionMatrix();
      }
      if(viewport.width<=760&&!this.morphology?.changed){
        // Keep the station centered in the space beside the mobile cabin index.
        const direction=position.clone().sub(target),right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),direction).normalize(),shift=right.multiplyScalar(2*Math.tan(this.v.camera.fov*Math.PI/360)*direction.length()*aspect*58/viewport.width);
        position.add(shift);target.add(shift);
      }
      this.fly(saved?.position||position,saved?.target||target,animate);this.overviewCamera=null;this.syncUI();
    }
    enter(id,{walk=false,from=null,animate=true}={}){
      if(this.shellStudy?.changed||this.morphBusy||this.transferring||!C.stationModule(id)||this.o.environment!=='station')return;
      this.stopMorphology();
      const fromPreview=this.phase==='focus'&&this.selected===id;
      if(fromPreview)this.extractionId=id;if(fromPreview)this.extractionCamera={position:this.v.camera.position.clone(),target:this.v.controls.target.clone()};
      this.restoreStationFrame();this.o.robotInteraction.cancel();this.o.following=false;this.selected=id;this.closingPreview=null;
      const room=this.room,frame=this.placeCabin(id);this.interiorFrame=frame.clone();
      const inverse=frame.clone().invert(),q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().extractRotation(inverse));
      // Rebase camera and the entire scene together: entering never teleports
      // the visible cabin, while the simulation continues in local metres.
      this.v.camera.position.applyMatrix4(inverse);this.v.controls.target.applyMatrix4(inverse);this.v.camera.up.applyQuaternion(q).normalize();inverse.decompose(this.root.position,this.root.quaternion,this.root.scale);this.root.updateMatrixWorld(true);this.v.controls.update();
      this.phase='interior';this.instantInteriorFade=!animate;this.exterior.visible=true;this.environment.visible=true;for(const [key,r]of this.rooms)r.root.visible=key===id;room.root.visible=true;this.setModel();this.applyLighting();this.cameraMode(walk?'walk':'detail',animate);
      if(walk&&from){const door=room.hatches.find(h=>h.id===from);if(door){this.v.camera.position.set(door.x*.64,1.65,door.z*.69);this.v.walkYaw=Math.atan2(-door.x,-door.z);this.v.firstPerson.look();}}
      this.syncUI();this.o.refreshUI();
    }
    cameraMode(mode,animate=true){
      if(this.shellStudy?.changed||this.morphBusy)return;
      if(mode==='walk'&&this.phase!=='interior'){this.enter(this.selected,{walk:true});return;}
      if(this.phase!=='interior'){if(mode==='top'){this.v.controls.enableRotate=false;this.fly(new T.Vector3(0,75,-3.99),new T.Vector3(0,0,-4),animate);}else if(this.phase==='focus'){this.v.controls.enableRotate=true;this.framePreview();}else this.overview(animate);return;}
      const r=this.room,v=this.v;this.cameraView=mode;this.tween=null;v.view=mode==='walk'?'walk':'perspective';v.firstPerson.viewChanged(v.view);v.controls.enabled=mode!=='walk';v.controls.enableRotate=mode!=='top';v.controls.maxPolarAngle=Math.PI;v.controls.minDistance=1;v.controls.maxDistance=Math.max(35,v.camera.position.distanceTo(v.controls.target)+1);v.camera.near=.025;v.camera.far=400;v.camera.fov=mode==='walk'?67:40;v.camera.updateProjectionMatrix();
      if(mode==='walk'){v.camera.up.set(0,1,0);r.roof.visible=true;v.camera.position.set(r.spawn.x,1.65,r.spawn.z);this.verticalSpeed=0;this.floatVelocity=new T.Vector3();v.walkYaw=Math.PI;v.walkPitch=0;v.walkKeys.clear();v.firstPerson.reset();v.firstPerson.look();}
      else{
        r.roof.visible=false;this.syncUI();
        const viewport=v.renderer.domElement.getBoundingClientRect();let frame=null;
        if(viewport.width<=760){
          const index=this.ui.querySelector('.st-modules').getBoundingClientRect(),panel=this.ui.querySelector('.st-panel').getBoundingClientRect(),tools=this.ui.querySelector('.st-tools').getBoundingClientRect();
          frame={left:24/viewport.width-1,right:2*(index.left-viewport.left-12)/viewport.width-1,top:1-2*(tools.bottom-viewport.top+14)/viewport.height,bottom:1-2*(panel.top-viewport.top-18)/viewport.height};
        }
        const scale=Math.max(1,1.05/v.camera.aspect),pose=window.IndoorLab.interiorOverviewPose(r.bounds,v.camera.aspect,v.camera.fov,frame),position=mode==='top'?new T.Vector3(0,Math.max(12,r.spec.length*1.3)*scale,.01):pose.position,target=mode==='top'?new T.Vector3(0,1,0):pose.target;
        v.controls.maxDistance=Math.max(v.controls.maxDistance,position.distanceTo(target)+1);this.fly(position,target,animate);
      }
      this.syncUI();
    }
    fly(end,target,animate=true){const v=this.v;const damping=v.controls.enableDamping;v.controls.enableDamping=false;v.controls.update();v.controls.enableDamping=damping;if(!animate||this.o.reducedSceneMotion()){v.camera.up.set(0,1,0);v.camera.position.copy(end);v.controls.target.copy(target);v.controls.update();this.tween=null;return;}this.tween={elapsed:0,duration:1100,start:v.camera.position.clone(),up:v.camera.up.clone(),from:v.controls.target.clone(),end:end.clone(),target:target.clone()};}
    extractionDirection(id){return id==='node'?new T.Vector3(0,1,0):new T.Vector3(...C.stationModule(id).anchor).sub(new T.Vector3(...C.stationModule('node').anchor)).normalize();}
    offset(id){if((this.phase==='focus'||this.phase==='interior')&&id===this.selected)return this.pullOffset?.clone()||new T.Vector3();if(this.exploded)return this.extractionDirection(id).multiplyScalar(5);return new T.Vector3();}
    applyLighting(){const indoor=this.phase==='interior',night=this.lightMode==='night';this.frameMorphologyLight();this.ambient.intensity=indoor?(night?.16:.38):(night?.18:.38);this.sun.intensity=indoor?(night?.10:.35):(night?.35:1.7);this.fill.intensity=indoor?.14:.28;this.v.renderer.toneMappingExposure=indoor?.90:1.0;this.v.renderer.shadowMap.needsUpdate=true;this.scene.background.set(indoor?'#111d2b':'#050c16').convertSRGBToLinear();for(const r of this.rooms.values())r.lights.children.forEach(light=>{light.intensity=night?.45:.50;});}
    async transfer(id){
      if(this.transferring||this.phase!=='interior'||!this.room.spec.links.includes(id))return false;
      const from=this.selected,serial=++this.serial,walk=this.v.view==='walk',hatch=this.room.hatches.find(h=>h.id===id);this.transferring=true;this.o.robotInteraction.cancel();this.v.walkKeys.clear();this.traffic?.setOpen(from,id,true);if(this.o.reducedSceneMotion()&&this.traffic){const door=this.traffic.door(from,id);door.fraction=1;this.traffic.syncDoor(door,0);}if(hatch)hatch.open=1;$('st-transfer').hidden=false;$('st-transfer').textContent='舱门已开启 · 前往'+C.stationModule(id).name;
      await new Promise(resolve=>setTimeout(resolve,this.o.reducedSceneMotion()?0:650));if(serial!==this.serial||this.o.environment!=='station')return false;
      this.traffic?.setOpen(from,id,false);if(hatch){hatch.open=0;}this.transferring=false;this.enter(id,{walk,from,animate:false});$('st-transfer').hidden=true;this.o.chat?.add('已通过舱门，进入'+C.stationModule(id).name+'。');return true;
    }
    refreshHatchUI(){const id=$('st-neighbor-select')?.value;if(!id)return;const door=this.traffic?.door(this.selected,id),button=$('st-links').querySelector('[data-st-door]'),link=$('st-links').querySelector('[data-st-link]');if(button){button.dataset.stDoor=id;button.textContent=door?.manualOpen?'关门':'开门';button.setAttribute('aria-label',(door?.manualOpen?'关闭':'开启')+'通往'+C.stationModule(id).name+'的舱门');}if(link)link.dataset.stLink=id;}
    toggleHatch(id){if(this.phase!=='interior'||!this.room.spec.links.includes(id))return false;const hatch=this.room.hatches.find(h=>h.id===id);if(!hatch)return false;const door=this.traffic?.door(this.selected,id);if(door)this.traffic.toggle(this.selected,id);else hatch.open=hatch.open?0:1;this.refreshHatchUI();return true;}
    interact(){if(this.o.environment!=='station'||this.phase!=='interior')return false;if(this.nearHatch){const door=this.traffic?.door(this.selected,this.nearHatch.id);if(door&&!door.manualOpen){this.toggleHatch(this.nearHatch.id);return true;}this.transfer(this.nearHatch.id);}return true;}
    walk(dt){
      if(this.o.chat?.editing||document.querySelector('dialog[open]')||document.hidden){this.stopFloat();this.nearHatch=null;$('st-hatch-prompt').hidden=true;return;}
      if(this.transferring)return;const v=this.v,fp=v.firstPerson,ctx=this.o.currentContext(),p=v.camera.position,k=v.walkKeys;const forward=(k.has('w')||k.has('arrowup')?1:0)-(k.has('s')||k.has('arrowdown')?1:0),side=(k.has('d')||k.has('arrowright')?1:0)-(k.has('a')||k.has('arrowleft')?1:0),speed=k.has('shift')?2.5:1.45,norm=Math.max(1,Math.hypot(forward,side)),velocity=this.floatVelocity??=new T.Vector3(),blend=1-Math.exp(-dt*2.2);velocity.x=T.MathUtils.lerp(velocity.x,(Math.sin(v.walkYaw)*forward-Math.cos(v.walkYaw)*side)*speed/norm,blend);velocity.z=T.MathUtils.lerp(velocity.z,(Math.cos(v.walkYaw)*forward+Math.sin(v.walkYaw)*side)*speed/norm,blend);const dx=velocity.x*dt,dz=velocity.z*dt,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.04));
      const clear=(x,z)=>ctx.sim.grid.isClear(x,z,.22)&&![...ctx.sim.people,...ctx.sim.robots].some(a=>Math.hypot(x-a.x,z-a.z)<a.radius+.22);
      for(let i=0;i<steps;i++){if(clear(p.x+dx/steps,p.z+dz/steps)){p.x+=dx/steps;p.z+=dz/steps;}else{if(clear(p.x+dx/steps,p.z))p.x+=dx/steps;if(clear(p.x,p.z+dz/steps))p.z+=dz/steps;}}
      const vertical=(k.has(' ')?1:0)-(k.has('c')?1:0);this.verticalSpeed=T.MathUtils.lerp(this.verticalSpeed||0,vertical*.85,1-Math.exp(-dt*2.2));p.y=T.MathUtils.clamp(p.y+this.verticalSpeed*dt,1.1,2.45);fp.look();this.nearHatch=this.room.hatches.find(h=>Math.hypot(h.x-p.x,h.z-p.z)<1.8);$('st-hatch-prompt').hidden=!this.nearHatch;if(this.nearHatch){const door=this.traffic?.door(this.selected,this.nearHatch.id);$('st-hatch-text').textContent='通往 '+C.stationModule(this.nearHatch.id).name;$('st-hatch-use').textContent=door?.manualOpen?'E · 通过舱门':'E · 开启舱门';}
    }
    syncUI(){
      const m=C.stationModule(this.selected),indoor=this.phase==='interior',focus=this.phase==='focus';document.body.dataset.stationPhase=this.phase;document.body.dataset.stationView=this.v.view;this.ui.dataset.phase=this.phase;this.ui.dataset.view=this.v.view;
      $('st-kicker').textContent=indoor?'STATION / '+m.index+' · INTERIOR':focus?'STATION / '+m.index+' · PREVIEW':'STATION / LIVE';$('st-title').textContent=indoor||focus?m.name:'整站空间';$('st-description').textContent=indoor?m.description:focus?m.description+' 再次点击进入舱内。':'首次点击抽出舱段，再次点击进入舱内。';$('st-number').textContent=indoor||focus?m.index:'08';$('st-number-label').textContent=indoor||focus?'舱段编号':'可进入空间';$('st-connections').textContent=indoor||focus?String(m.links.length).padStart(2,'0'):String(C.stationModules.reduce((n,spec)=>n+spec.links.length,0)/2).padStart(2,'0');$('st-connections-label').textContent=indoor||focus?'相邻舱段':'舱门连接';$('st-mode').textContent=indoor?(this.v.view==='walk'?'漫游':'舱内'):focus?'抽出':'整站';$('st-actions').hidden=this.phase==='overview';$('st-enter').hidden=indoor||this.phase==='overview';$('st-enter').innerHTML='进入舱内模式 <span>↗</span>';$('st-return').hidden=this.phase==='overview';$('st-return').textContent=indoor?'← 返回抽出预览':'← 收回舱段';$('st-neighbors').hidden=!indoor;
      const first=m.links[0],firstDoor=this.traffic?.door(this.selected,first);$('st-links').innerHTML=`<select id="st-neighbor-select" aria-label="选择相邻舱段">${m.links.map(id=>`<option value="${id}">${C.stationModule(id).name}</option>`).join('')}</select><button data-st-door="${first}" aria-label="切换所选舱门">${firstDoor?.manualOpen?'关门':'开门'}</button><button data-st-link="${first}" aria-label="通过舱门前往所选相邻舱段">前往 ↗</button>`;
      for(const id of ['st-cutview','st-top','st-walk'])$(id).hidden=!indoor;$('st-explode').hidden=indoor||focus;$('st-reset').hidden=focus;
      $('st-explode').innerHTML=this.exploded?'↓ <span>收拢舱段</span>':'↑ <span>展开舱段</span>';$('st-explode').setAttribute('aria-pressed',String(this.exploded));$('st-explode').setAttribute('aria-label',this.exploded?'收拢舱段':'展开舱段');
      $('st-walk').classList.toggle('active',this.v.view==='walk');$('st-top').classList.toggle('active',this.v.view!=='walk'&&this.cameraView==='top');$('st-cutview').classList.toggle('active',this.v.view!=='walk'&&this.cameraView!=='top');
      $('st-help').hidden=!(indoor&&this.v.view==='walk');
      $('st-help').textContent=indoor?(this.v.view==='walk'?(matchMedia('(pointer:coarse)').matches?'拖动场景环视 · 方向按钮移动 · 上浮 / 下沉 · 靠近舱门开启，再次点击通过':'点击场景控制视角 · WASD 移动 · 空格上浮 / C 下沉 · E 开门，再按 E 通过 · Esc 释放鼠标'):'拖动观察细节 · 点击舱门开关 · 选择相邻舱段并前往 · 点击空间外围返回抽出预览'):'单击抽出空间 · 再次点击进入 · 点击空白收回 · 拖动环视';
      this.ui.querySelectorAll('[data-st-module]').forEach(b=>b.setAttribute('aria-pressed',String(this.phase!=='overview'&&b.dataset.stModule===m.id)));$('st-hatch-prompt').hidden=true;$('st-touch-move').hidden=!(indoor&&this.v.view==='walk');
      this.syncMorphologyUI();
    }
    update(dt,now){
      if(this.scenarios?.blocksObservation){this.stopMorphology();this.scenarios.update(dt,now);return;}
      this.updateMorphology(now);
      // Live events add objects to this station; the normal camera, navigation,
      // daily simulations and renderer still run below, including shell previews.
      if(this.scenarios?.active&&this.scenarios.film?.liveEvent){
        const director=this.scenarios;
        if(!director.options.manual&&!director.paused&&this.o.externalRunning&&!document.hidden)director.tick(Math.min(.1,Math.max(0,dt))*this.o.rate);
        director.film.render();
      }
      this.eventReactions?.sync();
      if(this.shellStudy?.changed){
        this.exterior.visible=false;this.guide.visible=false;
        for(const room of this.rooms.values())room.root.visible=false;
        const simulationDt=this.o.externalRunning&&!document.hidden?dt*this.o.rate:0,preview=this.shellCabins?.preview;
        this.elapsed+=simulationDt;
        for(const [key,ctx]of this.o.contexts)if(key.startsWith('station-')){
          const visible=!!preview&&key==='station-'+preview.roomId;ctx.world.root.visible=visible;
          if(simulationDt)ctx.sim.tick(simulationDt,{visuals:visible});else if(visible)ctx.sim.refreshFlightVisuals?.();
        }
        if(this.traffic){if(simulationDt)this.traffic.update(simulationDt);else this.traffic.updateDoors(Math.min(1/30,Math.max(0,dt)));}
        if(!this.o.switching)this.shellCabins.update(dt);
        this.v.renderer.render(this.scene,this.v.camera);this.eventPip?.hide();return;
      }
      // Shader compilation and slow frames must not consume an unseen transition.
      // Camera motion and hull fading share the time actually presented, capped
      // at one 30 Hz frame; simulation time remains independent.
      const simulationDt=this.o.externalRunning&&!document.hidden?dt*this.o.rate:0;this.elapsed+=simulationDt;const indoor=this.phase==='interior',presentationDt=Math.min(1/30,Math.max(0,this.presentationAt?(now-this.presentationAt)/1000:dt)),instant=this.o.reducedSceneMotion()||indoor&&this.instantInteriorFade;this.presentationAt=now;let geometryMoving=false,maxExteriorOpacity=0;
      for(const [id,group]of this.modules){
        const offset=this.offset(id),alpha=instant?1:1-Math.exp(-presentationDt*5);if(!indoor&&group.position.distanceToSquared(offset)>.00001)geometryMoving=true;
        if(!indoor)group.position.lerp(offset,alpha);
        const selected=this.phase==='focus'&&id===this.selected,arrival=this.o.travel&&!this.o.travel.outward&&this.o.trip.to==='station',desired=indoor?0:this.phase==='focus'?(selected?.10:.62):arrival?this.o.stationArrivalReveal:1;
        group.traverse(mesh=>{if(!mesh.isMesh)return;const material=mesh.material;material.opacity+=(desired-material.opacity)*(arrival?1:alpha);if(Math.abs(material.opacity-desired)<.001)material.opacity=desired;maxExteriorOpacity=Math.max(maxExteriorOpacity,material.opacity);const transparent=material.opacity<.999;if(material.transparent!==transparent){material.transparent=transparent;material.depthWrite=!transparent;material.needsUpdate=true;}mesh.castShadow=!transparent&&mesh.userData.stationShadow;material.emissive.set(selected?'#123c43':'#000000');});
        if(!indoor&&this.rooms.has(id)){const r=this.rooms.get(id);this.placeCabin(id);r.root.visible=(this.phase==='focus'&&id===this.selected)||id===this.closingPreview;}
      }
      this.morphology?.update();
      if(this.closingPreview&&this.modules.get(this.closingPreview).position.lengthSq()<.002){this.getRoom(this.closingPreview).root.visible=false;this.closingPreview=null;}
      this.guide.visible=this.phase==='focus';
      if(this.guide.visible){const spec=C.stationModule(this.selected),frame=this.cabinFrame(this.selected),center=new T.Vector3(0,1.7,0).applyMatrix4(frame),size=new T.Matrix4().makeScale(spec.width,3.4,spec.length),local=new T.Matrix4().makeTranslation(0,1.7,0);frame.clone().multiply(local).multiply(size).decompose(this.slot.position,this.slot.quaternion,this.slot.scale);const end=center.clone().add(this.modules.get(this.selected).position),points=this.tether.geometry.attributes.position;points.setXYZ(0,...center.toArray());points.setXYZ(1,...end.toArray());points.needsUpdate=true;this.tether.computeLineDistances();this.tether.geometry.computeBoundingSphere();}
      if(!this.o.switching){if(this.tween){this.tween.elapsed+=presentationDt*1000;const t=this.o.reducedSceneMotion()?1:Math.min(1,this.tween.elapsed/this.tween.duration),u=ease(t);this.v.camera.up.copy(this.tween.up).lerp(new T.Vector3(0,1,0),u).normalize();this.v.camera.position.lerpVectors(this.tween.start,this.tween.end,u);this.v.controls.target.lerpVectors(this.tween.from,this.tween.target,u);this.v.controls.update();if(t===1)this.tween=null;}else if(indoor&&this.v.view==='walk')this.walk(dt);else this.v.controls.update();}
      // The live event cabin view needs posed crew even while that cabin is hidden.
      const pipKey=this.eventPip?.activeKey;
      for(const [key,ctx]of this.o.contexts){if(!key.startsWith('station-'))continue;const visible=(indoor||this.phase==='focus')&&key==='station-'+this.selected||key==='station-'+this.closingPreview,posed=visible||key===pipKey;ctx.world.root.visible=visible;if(simulationDt)ctx.sim.tick(simulationDt,{visuals:posed});else if(posed)ctx.sim.refreshFlightVisuals?.();}
      if(this.traffic){if(simulationDt)this.traffic.update(simulationDt);else this.traffic.updateDoors(presentationDt);}
      if(indoor&&!this.traffic)for(const h of this.room.hatches)h.leaf.position.x+=(h.open*1.43-h.leaf.position.x)*(1-Math.exp(-dt*8));
      if(indoor&&this.o.following&&!this.o.switching){const robot=this.o.currentContext().sim.robots.find(r=>r.id===this.o.selected);if(robot){const target=robot.model.position.clone().add(new T.Vector3(0,.8,0)),delta=target.clone().sub(this.v.controls.target);this.v.camera.position.add(delta);this.v.controls.target.copy(target);}}
      this.earth.rotation.y+=simulationDt*.003;
      if(simulationDt&&now>(this.nextTwinkle||0)){const colors=this.starColors.array;for(let i=0;i<this.starColors.count;i+=17){const brightness=.65+.35*Math.sin(this.elapsed*.42+i*1.37);for(let c=0;c<3;c++)colors[i*3+c]=this.starBase[i*3+c]*brightness;}this.starColors.needsUpdate=true;this.nextTwinkle=now+180;}
      this.v.camera.updateMatrixWorld(true);
      if(geometryMoving||this.transferring)this.v.renderer.shadowMap.needsUpdate=true;
      // Orbit controls may cancel a camera tween; the surrounding hull still
      // finishes fading. Keep the same post-processing path for every indoor
      // frame so completing the fade never swaps rendering or brightness.
      if(indoor){this.exterior.visible=maxExteriorOpacity>0;this.ensurePost();const size=this.v.renderer.getSize(new T.Vector2()),ratio=this.v.renderer.getPixelRatio(),key=size.x+':'+size.y+':'+ratio;if(key!==this.postSize){this.postSize=key;this.composer.setPixelRatio(ratio);this.composer.setSize(size.x,size.y);}this.composer.render();}else this.v.renderer.render(this.scene,this.v.camera);
      if(this.scenarios?.film?.liveEvent&&C.StationEventPip)this.eventPip??=new C.StationEventPip(this);
      this.eventPip?.update(dt);
      if(now>(this.nextStats||0)){
        const ctx=this.o.contexts.get('station-'+this.selected),activities=[...new Set((ctx?.sim.people||[]).map(p=>p.action||p.activity?.name||p.activityName).filter(Boolean))].slice(0,2);
        $('st-status').textContent=indoor||this.phase==='focus'?this.room.spec.name+' · '+(this.v.view==='walk'?'失重漫游':'失重日常')+(activities.length?' · '+activities.join(' / '):''):'八个独立空间 · 轨道上的共同日常';this.nextStats=now+1000;
      }
    }
  }
  C.StationExperience=StationExperience;
})();
