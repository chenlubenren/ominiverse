/* Bundled realistic clay people and optional imported skins share GPU poses. */
(() => {
  'use strict';const L=window.IndoorLab,T=THREE,$=id=>document.getElementById(id),norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  const FPS=30,BAKE_SLICE_MS=6;
  const yieldToMain=()=>new Promise(resolve=>setTimeout(resolve,0));
  const builtinManifest=new URL('../assets/characters/manifest.json',document.currentScript.src).href;
  const mapBones=bones=>L.LuxMotionRig.mapBones(bones);
  class PoseAsset {
    constructor(meta,gltf){
      this.meta=meta;this.scene=gltf.scene;this.clips=gltf.animations;this.meshes=[];this.bones=[];
      this.scene.updateMatrixWorld(true);this.scene.traverse(o=>{if(o.isSkinnedMesh){this.meshes.push(o);for(const b of o.skeleton.bones)if(!this.bones.includes(b))this.bones.push(b);}});
      if(!this.meshes.length)throw Error('资产没有蒙皮网格。');this.rig=mapBones(this.bones);
      const required=['hips','head','leftArm','leftForeArm','rightArm','rightForeArm','leftUpLeg','leftLeg','rightUpLeg','rightLeg'];
      if(required.some(n=>!this.rig[n]))throw Error('骨骼命名尚未匹配：'+required.filter(n=>!this.rig[n]).join(', '));
      this.rest=this.bones.map(b=>({b,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));
      // In r128 Box3 reads unskinned mesh positions. Imported FBX rigs can have
      // centimetre bind transforms, so measure the actual rest skin in world
      // coordinates before normalizing and computing anatomical limb lengths.
      const box=new T.Box3(),vertex=new T.Vector3();
      for(const mesh of this.meshes){mesh.skeleton.update();const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){vertex.fromBufferAttribute(p,i);mesh.boneTransform(i,vertex);vertex.applyMatrix4(mesh.matrixWorld);if(!Number.isFinite(vertex.x)||!Number.isFinite(vertex.y)||!Number.isFinite(vertex.z))throw Error('人物蒙皮包含无效坐标。');box.expandByPoint(vertex);}}
      const size=box.getSize(new T.Vector3());
      if(size.y<.01||size.y>10000)throw Error('人物包围盒无效。');this.height=size.y;this.scale=1.789/size.y;const typingOrigin=box.getCenter(new T.Vector3());typingOrigin.y=box.min.y;this.motion=new L.LuxMotionRig(this.scene,this.bones,this.height,typingOrigin);
      this.normalise=new T.Matrix4().makeScale(this.scale,this.scale,this.scale);this.normalise.setPosition(-(box.min.x+box.max.x)*.5*this.scale,-box.min.y*this.scale,-(box.min.z+box.max.z)*.5*this.scale);
      this.meshMatrices=this.meshes.map(m=>this.normalise.clone().multiply(m.matrixWorld));this.mixer=new T.AnimationMixer(this.scene);this.ranges={};this.rangeCache=new Map();this.atlases=[];
      this.stats={height:this.height,normalisedHeight:size.y*this.scale,joints:this.bones.length,meshes:this.meshes.length,triangles:this.meshes.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0),clips:[],textures:0,preparation:{mode:meta.kind==='crew'?'direct-skeleton':'crowd-atlas',yieldCount:0,maxSliceMs:0,cpuMs:0,atlasBytes:0}};
    }
    reset(){this.motion.reset();}
    pose(state,t){this.motion.pose(state,t);}
    async prepare(){
      // Cabin actors animate independent skeletons directly. They never enter
      // AssetBatch, so office pose textures and injury masks would be unused.
      if(this.meta.kind==='crew')return this;
      await yieldToMain();L.prepareGoreRegions(this);await this.bake();await L.prepareCharacterLods(this);return this;
    }
    async bake(){
      const sources=[];
      for(const clip of this.clips){if(!clip.tracks.length)continue;const name=clip.name||'clip'+sources.length;const count=Math.max(2,Math.ceil(clip.duration*FPS));sources.push({name,count,duration:clip.duration,clip:name.startsWith('pose:')?null:clip,pose:name.startsWith('pose:')?name.slice(5):null});}
      for(const name of ['idle','walk','run','stairs','sit','typing','sit-talk','sit-phone','talk','phone','pull','grab','bite','chase','struggle','turn','air-shiver','air-head','air-lurch','air-run','sneeze','shelter','recover','hit','flinch','dead','down'])if(!sources.some(s=>s.name==='pose:'+name))sources.push({name:'pose:'+name,count:name.startsWith('air-')?36:60,duration:2,pose:name});
      const total=sources.reduce((n,s)=>n+s.count,0),shared=new Map(),writers=[];this.atlases=this.meshes.map(m=>{const key=m.skeleton.bones.map((b,i)=>b.uuid+':'+m.skeleton.boneInverses[i].elements.join(',')).join('|');if(shared.has(key))return shared.get(key);const width=T.MathUtils.ceilPowerOfTwo(m.skeleton.bones.length*4),data=new Float32Array(width*total*4),texture=new T.DataTexture(data,width,total,T.RGBAFormat,T.FloatType);texture.minFilter=texture.magFilter=T.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;const atlas={width,height:total,data,texture};shared.set(key,atlas);writers.push({skeleton:m.skeleton,atlas});return atlas;});
      this.rangeCache.clear();const metrics=this.stats.preparation;let sliceStart=performance.now();
      let index=0;for(const source of sources){this.ranges[source.name]={start:index,count:source.count,duration:source.duration};this.mixer.stopAllAction();this.reset();let action;if(source.clip){action=this.mixer.clipAction(source.clip);action.play();}
        for(let f=0;f<source.count;f++){const t=f/source.count*source.duration;if(source.clip){this.mixer.setTime(t);this.scene.updateMatrixWorld(true);}else this.pose(source.pose,t);
          for(const {skeleton,atlas}of writers){skeleton.update();atlas.data.set(skeleton.boneMatrices,(index+f)*atlas.width*4);}
          // Publish the asset only after every frame is ready, but yield often
          // enough for input and painting while preparing the same full atlas.
          if((f&3)===3&&performance.now()-sliceStart>=BAKE_SLICE_MS){const elapsed=performance.now()-sliceStart;metrics.cpuMs+=elapsed;metrics.maxSliceMs=Math.max(metrics.maxSliceMs,elapsed);metrics.yieldCount++;await yieldToMain();sliceStart=performance.now();}
        }index+=source.count;
      }this.mixer.stopAllAction();this.reset();const elapsed=performance.now()-sliceStart;metrics.cpuMs+=elapsed;metrics.maxSliceMs=Math.max(metrics.maxSliceMs,elapsed);for(const a of shared.values())a.texture.needsUpdate=true;metrics.atlasBytes=[...shared.values()].reduce((n,a)=>n+a.data.byteLength,0);this.stats.clips=Object.keys(this.ranges);this.stats.textures=shared.size;
    }
    range(...names){const cacheKey=names.join('|');if(this.rangeCache.has(cacheKey))return this.rangeCache.get(cacheKey);let result;for(const name of names){const key=Object.keys(this.ranges).find(k=>norm(k)===norm(name));if(key){result=this.ranges[key];break;}}result??=this.ranges['pose:idle'];this.rangeCache.set(cacheKey,result);return result;}
    action(a){if(a.sneezeUntil>(L.building?.society.time||0))return{key:'sneeze',range:this.range('pose:sneeze'),once:true,speed:2.4};if(a.reaction?.posture==='crouch'&&a.state!=='moving')return{key:'shelter',range:this.range('pose:shelter')};const anim=a.health==='dead'?'dead':a.zombieAnim,down=['dead','down'].includes(anim);if(down)return{key:anim,range:this.range('pose:'+anim),once:true};
      if(anim==='hit')return{key:'hit:'+(a.impactReaction?.sequence||0),range:this.range('pose:hit'),once:true,speed:4.3};if(anim==='flinch')return{key:'flinch',range:this.range('pose:flinch'),once:true,speed:6};if(['grab','bite','recover'].includes(anim))return{key:anim,range:this.range('pose:'+anim),once:true,speed:anim==='grab'?4.1:anim==='bite'?2.8:5.2};if(['struggle','turn','air-shiver','air-head','air-lurch','air-run'].includes(anim))return {key:anim,range:this.range('pose:'+anim)};
      const moving=a.pose!=='sit'&&a.state==='moving'&&Math.hypot(a.vx||0,a.vz||0)>.03;
      if(a.gesture==='typing'&&a.pose==='sit')return{key:'typing',range:this.range('pose:typing')};
      if(!moving&&a.gesture==='phone')return{key:a.pose==='sit'?'sit-phone':'phone',range:this.range(a.pose==='sit'?'pose:sit-phone':'pose:phone')};if(!moving&&a.gesture==='talk')return{key:a.pose==='sit'?'sit-talk':'talk',range:this.range(a.pose==='sit'?'Sitting_Talking_Loop':'Idle_Talking_Loop',a.pose==='sit'?'pose:sit-talk':'pose:talk')};
      if(a.pose==='pull')return{key:'pull',range:this.range('pose:pull')};if(a.pose==='sit')return{key:'sit',range:this.range('Sitting_Idle_Loop','pose:sit')};

      if(moving){const zombie=['zombie','turning'].includes(a.health),fast=L.Locomotion.isFast(a);return{key:zombie?'chase':fast?'run':'walk',gait:true,fast:zombie||fast,range:this.range('pose:'+(zombie?'chase':fast?'run':'walk')),speed:Math.max(.6,Math.min(3.1,Math.hypot(a.vx||0,a.vz||0)/(zombie||fast?1.36:.76)))};}
      return {key:'idle',range:this.range(a.health==='zombie'?'Zombie_Idle_Loop':'pose:idle','pose:idle')};
    }
  }
  function crowdMaterial(source,mesh,atlas){
    const mat=source.clone();mat.skinning=false;mat.transparent=false;mat.opacity=1;mat.depthWrite=true;mat.depthTest=true;if("transmission"in mat)mat.transmission=0;mat.alphaTest=0;mat.fog=false;mat.side=T.DoubleSide;mat.userData.styleLocked=true;
    if(source.userData.whiteAvatar)L.WhiteAvatar.applyMaterial(mat);
    mat.onBeforeCompile=shader=>{Object.assign(shader.uniforms,{luxAtlas:{value:atlas.texture},luxAtlasSize:{value:new T.Vector2(atlas.width,atlas.height)},luxBind:{value:mesh.bindMatrix},luxBindInverse:{value:mesh.bindMatrixInverse}});
      shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
        attribute vec4 skinIndex; attribute vec4 skinWeight; attribute vec4 luxFrames; attribute float luxRegion; attribute vec2 luxWounds; varying float vLuxRegion; varying vec2 vLuxWounds;
        uniform sampler2D luxAtlas; uniform vec2 luxAtlasSize; uniform mat4 luxBind; uniform mat4 luxBindInverse; varying float vLuxInfected;
        mat4 luxBone(float b,float f){float x=b*4.0;float y=(f+0.5)/luxAtlasSize.y;return mat4(texture2D(luxAtlas,vec2((x+0.5)/luxAtlasSize.x,y)),texture2D(luxAtlas,vec2((x+1.5)/luxAtlasSize.x,y)),texture2D(luxAtlas,vec2((x+2.5)/luxAtlasSize.x,y)),texture2D(luxAtlas,vec2((x+3.5)/luxAtlasSize.x,y)));}
        mat4 luxBoneBlend(float b){return luxBone(b,luxFrames.x)*(1.0-luxFrames.z)+luxBone(b,luxFrames.y)*luxFrames.z;}
      `).replace('#include <skinbase_vertex>',`mat4 boneMatX=luxBoneBlend(skinIndex.x);mat4 boneMatY=luxBoneBlend(skinIndex.y);mat4 boneMatZ=luxBoneBlend(skinIndex.z);mat4 boneMatW=luxBoneBlend(skinIndex.w);`).replace('#include <skinnormal_vertex>',`mat4 luxSkin=skinWeight.x*boneMatX+skinWeight.y*boneMatY+skinWeight.z*boneMatZ+skinWeight.w*boneMatW;objectNormal=mat3(luxBindInverse*luxSkin*luxBind)*objectNormal;`).replace('#include <skinning_vertex>',`transformed=(luxBindInverse*luxSkin*luxBind*vec4(transformed,1.0)).xyz;vLuxInfected=luxFrames.w;vLuxRegion=luxRegion;vLuxWounds=luxWounds;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vLuxInfected; varying float vLuxRegion; varying vec2 vLuxWounds;').replace('#include <color_fragment>','#include <color_fragment>\nif(vLuxRegion>0.5 && mod(floor(vLuxWounds.x/exp2(floor(vLuxRegion+0.5)-1.0)),2.0)>0.5) discard;\ndiffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(0.75,0.3,0.32),vLuxWounds.y*0.2);\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.8,0.012,0.018)*(0.6+0.4*diffuseColor.r),vLuxInfected*0.94);');
    };mat.customProgramCacheKey=()=> 'lux3d-pose-atlas-health-red-v3';return mat;
  }
  class AssetBatch {
    constructor(asset,group,capacity){this.asset=asset;this.capacity=capacity;this.group=new T.Group();this.group.name='角色 / '+(L.brandNeutralText?.(asset.meta.id)??asset.meta.id);this.group.userData.noAO=true;this.group.userData.characterAsset=true;group.add(this.group);this.states=new Map();
      this.levels=Array.from({length:asset.meshes.every(m=>m.geometry.userData.luxLods?.length>1)?2:1},(_,level)=>level).map(level=>asset.meshes.map((source,i)=>{const geometry=new T.BufferGeometry();geometry.setIndex(source.geometry.userData.luxLods?.[level]||source.geometry.index);for(const[k,a]of Object.entries(source.geometry.attributes))geometry.setAttribute(k,a);geometry.groups=(source.geometry.userData.luxLodGroups?.[level]||source.geometry.groups).map(g=>({...g}));geometry.setAttribute('luxWounds',new T.InstancedBufferAttribute(new Float32Array(capacity*2),2).setUsage(T.DynamicDrawUsage));geometry.setAttribute('luxFrames',new T.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(T.DynamicDrawUsage));const materials=Array.isArray(source.material)?source.material.map(m=>crowdMaterial(m,source,asset.atlases[i])):crowdMaterial(source.material,source,asset.atlases[i]);const mesh=new T.InstancedMesh(geometry,materials,capacity);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;mesh.userData.noAO=true;mesh.userData.agentIds=[];mesh.userData.lodLevel=level;this.group.add(mesh);return mesh;}));this.meshes=this.levels.flat();this.object=new T.Object3D();this.matrix=new T.Matrix4();this.mouth=new L.CharacterMouth(asset,this.group,capacity);this.wounds=new L.CharacterWounds(asset,this.group,capacity);this.worldCenter=new T.Vector3();this.cameraPosition=new T.Vector3();this.projected=new T.Vector3();
    }
    update(agents,time){const asset=this.asset;this.group.visible=agents.length>0;const counts=[0,0,0],view=L.app.view,camera=view.camera;camera.updateMatrixWorld();this.group.parent.updateWorldMatrix(true,false);const screenHeight=view.renderer.domElement?.clientHeight||1000,projectionScale=Math.abs(camera.projectionMatrix.elements[5])*screenHeight*.5;this.mouth.begin();this.wounds.begin();
      // A seated actor still animates every frame, but its world transform and
      // injury mask often stay identical. Track the changed span separately
      // from the pose-frame attribute, without sampling or dropping animation.
      for(const mesh of this.meshes){mesh.userData.matrixStart=mesh.userData.woundStart=Infinity;mesh.userData.matrixEnd=mesh.userData.woundEnd=0;}
      for(const a of agents){const action=asset.action(a);let state=this.states.get(a.id);if(!state||state.key!==action.key){state={key:action.key,start:time,old:state?.frame??null,frame:0,level:state?.level??0};this.states.set(a.id,state);}const r=action.range,elapsed=(time-state.start)*(action.speed||1)+(action.once?0:(a.id%17)*.071),position=action.gait?(L.Locomotion.phase(a,action.fast)%r.duration)/r.duration*r.count:action.once?Math.min(r.count-1,elapsed/r.duration*r.count):(elapsed/r.duration*r.count)%r.count,f0=r.start+Math.floor(position),f1=r.start+(action.once?Math.min(r.count-1,Math.floor(position)+1):(Math.floor(position)+1)%r.count);let mix=position%1,frame0=f0,frame1=f1;
        if(state.old!==null&&time-state.start<.16){frame0=state.old;frame1=f0;mix=(time-state.start)/.16;}state.frame=f0;
        this.worldCenter.set(a.x,(a.baseY||0)+.9,a.z).applyMatrix4(this.group.parent.matrixWorld);this.projected.copy(this.worldCenter).project(camera);if(this.projected.z>1||this.projected.z< -1||Math.abs(this.projected.x)>1.15||Math.abs(this.projected.y)>1.2)continue;
        // Use the same skin, material and animation at both distances. Hysteresis
        // avoids switching repeatedly while a person crosses the size threshold.
        const depth=-this.cameraPosition.copy(this.worldCenter).applyMatrix4(camera.matrixWorldInverse).z,pixels=1.789*(a.appearance?.height||1)*projectionScale/(camera.isOrthographicCamera?1:Math.max(.1,depth));
        const level=this.levels.length>1&&a.id!==view.selected&&!a.injuryMask&&pixels<(state.level===1?90:70)?1:0,n=counts[level]++;state.level=level;
        const jolt=L.proneJolt(a,time);this.object.position.set(a.x+(a.proneImpact?.x||0)*jolt,a.baseY||0,a.z+(a.proneImpact?.z||0)*jolt);this.object.rotation.set(action.prone?-Math.PI/2:0,a.angle||0,0);if(action.prone)this.object.position.y+=.2;this.object.scale.set(a.appearance?.build||1,a.appearance?.height||1,a.appearance?.build||1);this.object.updateMatrix();this.mouth.put(a,this.object.matrix,frame0,frame1,mix,time);this.wounds.put(a,this.object.matrix,frame0,frame1,mix);
        this.levels[level].forEach((mesh,i)=>{
          const data=mesh.userData,matrix=mesh.instanceMatrix.array,offset=n*16,newSlot=data.agentIds[n]!==a.id;
          this.matrix.multiplyMatrices(this.object.matrix,asset.meshMatrices[i]);
          // Compare the actual float32 upload values, so rounding does not mark
          // unchanged transforms dirty. Slot reordering and LOD changes write
          // the entire destination matrix before the next draw.
          let changed=newSlot;for(let j=0;j<16&&!changed;j++)changed=matrix[offset+j]!==Math.fround(this.matrix.elements[j]);
          if(changed){mesh.setMatrixAt(n,this.matrix);data.matrixStart=Math.min(data.matrixStart,n);data.matrixEnd=n+1;}
          mesh.geometry.attributes.luxFrames.setXYZW(n,frame0,frame1,mix,(L.isAgentAffected?.(a)??(a.health==='zombie'||a.hasMutated))?1:0);
          const wounds=mesh.geometry.attributes.luxWounds,mask=a.injuryMask||0,blood=a.bloodLevel||0;
          if(newSlot||wounds.array[n*2]!==Math.fround(mask)||wounds.array[n*2+1]!==Math.fround(blood)){wounds.setXY(n,mask,blood);data.woundStart=Math.min(data.woundStart,n);data.woundEnd=n+1;}
          data.agentIds[n]=a.id;
        });
      }
      this.mouth.end();this.mouth.group.visible=this.mouth.index>0;this.wounds.end();for(const mesh of this.meshes){const data=mesh.userData;mesh.count=counts[data.lodLevel];mesh.visible=mesh.count>0;if(!mesh.count)continue;for(const [attribute,start,end]of [[mesh.instanceMatrix,data.matrixStart,data.matrixEnd],[mesh.geometry.attributes.luxFrames,0,mesh.count],[mesh.geometry.attributes.luxWounds,data.woundStart,data.woundEnd]]){if(end<=start)continue;let first=start*attribute.itemSize,last=end*attribute.itemSize;const range=attribute.updateRange;if(range.count>=0&&attribute.version){first=Math.min(first,range.offset);last=Math.max(last,range.offset+range.count);}range.offset=first;range.count=last-first;attribute.needsUpdate=true;}}
    }
    dispose(){this.mouth.dispose();this.wounds.dispose();this.group.parent?.remove(this.group);L.characterAssets?.batches.delete(this);for(const m of this.meshes){m.geometry.setIndex(null);for(const k of Object.keys(m.geometry.attributes))if(k!=='luxFrames'&&k!=='luxWounds')m.geometry.deleteAttribute(k);m.geometry.dispose();for(const mat of Array.isArray(m.material)?m.material:[m.material])mat.dispose();}}
  }
  class CharacterAssets {
    constructor(){this.assets=new Map();this.loading=new Map();this.batches=new Set();this.identities=new Map();this.enabled={human:false,zombie:false};this.selected={human:'auto',zombie:'auto'};this.items=[];this.builtinItems=[];this.remoteItems=[];this.ui();this.ready=this.loadBuiltins();this.refresh();this.poll=setInterval(()=>{if(this.data?.jobs?.some(j=>j.status==='running'||j.status==='queued'))this.refresh();},8000);}
    ui(){const button=document.createElement('button');button.id='character-assets-open';button.textContent='3D 角色';button.title='选择基础人物或已有的精细角色';document.body.appendChild(button);const dialog=document.createElement('dialog');dialog.id='character-assets-panel';dialog.innerHTML='<div class="asset-heading"><div><small>SPATIAL SIMULATION / ASSETS</small><h2>角色资产</h2></div><button id="character-assets-close" aria-label="关闭角色资产">×</button></div><p class="asset-intro">写实素模人物 · 默认橙色<br>保留工作、行走与失重活动，也可使用已导入的角色。</p>'+['human','zombie'].map((kind,i)=>`<div class="asset-choice"><div><b>${i?'感染者':'办公人群'}</b><label class="asset-switch"><input type="checkbox" id="asset-${kind}-enabled"><span>使用高精度人物</span></label></div><select id="asset-${kind}-select" aria-label="${i?'感染者':'办公人群'}模型"><option value="auto">按人物性别自动匹配</option></select><small id="asset-${kind}-info">尚未载入</small></div>`).join('')+'<p id="character-population-progress"></p><button id="character-population-start">生成 / 继续 80 个配对角色</button><div id="character-asset-jobs"></div><p id="character-asset-status" role="status">读取本地资产…</p><div class="asset-buttons"><button id="character-assets-refresh">刷新资产</button><button id="character-assets-generate">生成四种预设</button></div><small class="asset-path">人物颜色可在楼层面板中调整。<br>Esc 退出鼠标锁定后，可随时切换角色。</small>';document.body.appendChild(dialog);this.dialog=dialog;button.onclick=()=>{if(document.pointerLockElement)document.exitPointerLock();dialog.showModal();this.refresh();};$('character-assets-close').onclick=()=>dialog.close();$('character-assets-refresh').onclick=()=>this.refresh();$('character-assets-generate').onclick=()=>this.generate();$('character-population-start').onclick=async()=>{try{const r=await fetch('/__character_models__',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({collection:'population'})}),d=await r.json();if(!r.ok)throw Error(d.error);await this.refresh();}catch(e){this.message(e.message);}};
      for(const kind of ['human','zombie']){$(`asset-${kind}-enabled`).onchange=e=>this.setEnabled(kind,e.target.checked).catch(error=>this.message(error.message));$(`asset-${kind}-select`).onchange=e=>{this.selected[kind]=e.target.value;if(kind==='human')this.identities.clear();if(this.enabled[kind])this.setEnabled(kind,true).catch(error=>this.message(error.message));};}
    }
    message(text){$('character-asset-status').textContent=L.brandNeutralText?.(text)??text;}
    syncItems(){
      this.items=[...new Map([...this.remoteItems,...this.builtinItems].map(item=>[item.id,item])).values()];
      for(const kind of ['human','zombie']){const select=$(`asset-${kind}-select`),value=this.selected[kind],items=this.items.filter(i=>i.kind===kind);select.replaceChildren(new Option('按人物性别自动匹配','auto'),...items.map(i=>new Option(L.brandNeutralText?.(i.name)??i.name,i.id)));select.value=value;$(`asset-${kind}-enabled`).disabled=!items.length;$(`asset-${kind}-enabled`).checked=this.enabled[kind];$(`asset-${kind}-info`).textContent=this.enabled[kind]?'高精度模型已启用 · 动作实时同步':items.length+' 种已就绪 · 当前使用基础人物';}
    }
    async loadBuiltins(){
      this.loadingBuiltins=true;this.officeDownloadsStarted=false;
      try{
        const response=await fetch(builtinManifest,{cache:'no-store'});if(!response.ok)throw Error('本地写实人物清单无法读取。');const manifest=await response.json();
        this.builtinItems=(manifest.items||[]).map(item=>({clay:true,...item,builtin:true,url:new URL(item.url,document.baseURI).href}));
        if(!this.builtinItems.some(item=>item.kind==='human'))throw Error('本地写实人物清单为空。');
        this.syncItems();this.message('正在载入写实人物与活动动作…');
        // Publish both office characters together. Cabin workwear is requested
        // only when the station opens, so it cannot delay the building screen.
        const pending=this.builtinItems.filter(item=>item.kind==='human').map(item=>this.load(item));this.officeDownloadsStarted=true;
        const results=await Promise.allSettled(pending),failed=results.find(result=>result.status==='rejected');
        if(failed)throw failed.reason;
        this.identities.clear();this.enabled.human=true;this.builtinReady=true;this.syncItems();this.message('写实人物已就绪，可开始观察办公楼。');return true;
      }catch(error){this.builtinError=error.message;this.enabled.human=false;this.syncItems();this.message(error.message+' 暂时显示基础人物。');return false;}
      finally{this.loadingBuiltins=false;}
    }
    ensureCrew(){
      if(this.crewReady)return Promise.resolve(true);if(this.loadingCrew)return this.loadingCrew;
      this.loadingCrew=(async()=>{
        await this.ready;const items=this.builtinItems.filter(item=>item.kind==='crew');this.crewErrors=[];
        await Promise.all(items.map(async item=>{try{await this.load(item);}catch(error){this.crewErrors.push({id:item.id,message:error.message});}}));
        this.crewReady=items.length>0&&!this.crewErrors.length;return this.crewReady;
      })().finally(()=>{this.loadingCrew=null;});
      return this.loadingCrew;
    }
    async refresh(){try{const r=await fetch('/__character_models__',{cache:'no-store'});if(!r.ok)throw Error('扩展角色服务暂不可用，本地写实人物仍可使用。');this.data=await r.json();this.remoteItems=this.data.items||[];this.syncItems();
        const population=this.data.population;$('character-population-progress').textContent=population?.total?`配对角色库 ${population.ready} / ${population.total} · ${population.creditBlocked?'积分不足 · 可续传':population.busy?'生成中':'本地已保存'}${population.failed?' · '+population.failed+' 项需继续':''}`:'20 男 + 20 女 + 40 个对应感染版本';$('character-population-start').disabled=!!population?.busy||population?.ready===80||!this.data.configured;$('character-asset-jobs').replaceChildren(...(this.data.jobs||[]).filter(j=>j.status==='running'||j.status==='error').slice(0,6).map(j=>{const row=document.createElement('div'),name=document.createElement('span'),status=document.createElement('span');name.textContent=L.brandNeutralText?.(j.name)??j.name;status.textContent=j.status==='ready'?'已绑定 · 动作就绪':j.status==='error'?'需要继续':({generate:'生成模型',rig:'绑定骨骼',retarget:'生成动作'}[j.stage]||'等待任务');row.append(name,status);if(j.error)row.title=L.brandNeutralText?.(j.error)??j.error;return row;}));
        const busy=this.data.jobs?.some(j=>['running','queued'].includes(j.status)),presets=(this.data.jobs||[]).filter(j=>['office-male','office-female','zombie-male','zombie-female'].includes(j.id));$('character-assets-generate').disabled=busy||!this.data.configured||presets.length===4&&presets.every(j=>j.status==='ready');$('character-assets-generate').textContent=this.data.jobs?.some(j=>j.status==='error')?'继续下载与绑定':'生成四种预设';if(!this.loadingBuiltins)this.message(population?.creditBlocked?'扩展角色生成额度不足，已下载的人物和内置人物仍可使用。':busy?'扩展角色正在生成，可继续观察办公楼。':this.builtinReady?'写实人物已就绪，也可选择已导入的角色。':this.remoteItems.length?`${this.remoteItems.length} 种扩展资产已下载。`:this.builtinError||'正在读取本地写实人物。');
      }catch(e){if(!this.loadingBuiltins)this.message(this.builtinReady?'写实人物已就绪，扩展角色服务暂不可用。':e.message);}}
    async generate(){try{const r=await fetch('/__character_models__',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:['office-male','office-female','zombie-male','zombie-female']})}),d=await r.json();if(!r.ok)throw Error(d.error||'生成未提交。');await this.refresh();}catch(e){this.message(e.message);}}
    async load(item){if(this.assets.has(item.id))return this.assets.get(item.id);if(this.loading.has(item.id))return this.loading.get(item.id);const promise=(async()=>{const gltf=await new Promise((resolve,reject)=>new T.GLTFLoader().load(item.animations||item.url,resolve,undefined,()=>reject(Error(item.name+' 载入失败，请刷新资产。'))));gltf.scene.traverse(o=>{for(const mat of o.material?Array.isArray(o.material)?o.material:[o.material]:[]){mat.transparent=false;mat.opacity=1;mat.depthWrite=true;if(item.clay)L.WhiteAvatar.applyMaterial(mat);for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap'])if(mat[key]){mat[key].anisotropy=L.app.view.renderer.capabilities.getMaxAnisotropy();mat[key].needsUpdate=true;}}});
      let asset;const parent=this.items.find(i=>i.id===item.sourceHuman);if(parent){const human=await this.load(parent),meshes=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});if(meshes.length!==human.meshes.length)throw Error('对应角色的网格数量不匹配。');asset=Object.create(human);asset.meta=item;asset.meshes=human.meshes.map((source,i)=>{const target=meshes[i],a=source.geometry.attributes.position.array,b=target.geometry.attributes.position.array;if(a.length!==b.length||a.some((v,k)=>Math.abs(v-b[k])>.00001))throw Error('感染模型与原人物的形体不一致，未应用替换。');const mesh=source.clone(false);mesh.material=target.material;return mesh;});asset.stats={...human.stats,sharedHumanGeometry:true};for(const m of meshes)m.geometry.dispose();}else{asset=new PoseAsset(item,gltf);await asset.prepare();}this.assets.set(item.id,asset);return asset;})();this.loading.set(item.id,promise);try{return await promise;}finally{this.loading.delete(item.id);}}
    async setEnabled(kind,enabled){if(!['human','zombie'].includes(kind))throw Error('未知角色类型。');if(enabled){const items=this.items.filter(i=>i.kind===kind&&(this.selected[kind]==='auto'||i.id===this.selected[kind]));if(!items.length)throw Error('对应模型尚未生成完成。');this.message('载入高精度角色与骨骼动作…');try{let next=0,done=0;const worker=async()=>{while(next<items.length){await this.load(items[next++]);this.message(`载入骨骼动作 ${++done} / ${items.length}`);}};await Promise.all(Array.from({length:Math.min(3,items.length)},worker));}catch(e){this.enabled[kind]=false;$(`asset-${kind}-enabled`).checked=false;throw e;}}
      if(kind==='human'&&enabled&&!this.enabled.human)this.identities.clear();this.enabled[kind]=enabled;$(`asset-${kind}-enabled`).checked=enabled;$(`asset-${kind}-info`).textContent=enabled?'高精度模型已启用 · 动作实时同步':'当前使用基础人物';this.message(enabled?'角色已替换，当前模拟继续运行。':'已恢复基础人物与原生关节动作。');L.app?.view?.pipeline&&(L.app.view.pipeline._aoExcluded=null);return enabled;
    }
    pick(a){if(a.type==='wheelchair'||a.type==='assisted'||a.type==='doctor')return null;let kind=L.building?.society.zombie.active&&(a.health==='zombie'||a.hasMutated)?'zombie':'human';if(kind==='zombie'&&!this.enabled.zombie&&this.enabled.human)kind='human';if(!this.enabled[kind])return null;const selected=this.selected[kind];if(selected!=='auto'){if(kind==='human')this.identities.set(a.id,selected);else if(this.enabled.human&&this.identities.has(a.id)){const source=this.identities.get(a.id),pair=this.items.find(i=>i.sourceHuman===source&&this.assets.has(i.id));return this.assets.get(pair?.id||source);}return this.assets.get(selected);}let identity=this.identities.get(a.id);if(!identity){const gender=a.gender||(a.id%2?'female':'male'),expected=`human-${gender}-${String(Math.floor(a.id/2)%20+1).padStart(2,'0')}`,humans=this.items.filter(i=>i.kind==='human'&&i.gender===gender&&this.assets.has(i.id)),bundled=humans.filter(i=>i.builtin),choices=bundled.length?bundled:humans;identity=choices[Math.abs(Math.floor(a.id/2))%choices.length]?.id;if(!bundled.length&&this.assets.has(expected))identity=expected;if(identity)this.identities.set(a.id,identity);}
      if(kind==='human')return this.assets.get(identity);const pair=this.items.find(i=>i.sourceHuman===identity&&this.assets.has(i.id));if(pair)return this.assets.get(pair.id);if(identity&&this.enabled.human)return this.assets.get(identity);const zombies=this.items.filter(i=>i.kind==='zombie'&&i.gender===a.gender&&this.assets.has(i.id));return this.assets.get(zombies[0]?.id);}
    pickCrew(person){
      const gender=person.gender||(person.id%2?'female':'male'),items=this.builtinItems.filter(item=>item.kind==='crew'&&item.gender===gender&&this.assets.has(item.id));
      // Cabin clothing has its own pool; selecting it never changes a ground
      // character's remembered identity or the office asset selector.
      const item=items[Math.abs(Math.floor(person.id/2))%items.length];
      if(item)return this.assets.get(item.id);
      return this.pick(person);
    }
    updateCrowd(renderer,agents,time,hiddenId){
      const groups=new Map(),covered=new Set();for(const a of agents){if(a.id===hiddenId)continue;const asset=this.pick(a);if(!asset)continue;covered.add(a.id);if(!groups.has(asset))groups.set(asset,[]);groups.get(asset).push(a);}
      renderer.luxBatches??=new Map();for(const [asset,list]of groups){let batch=renderer.luxBatches.get(asset);if(!batch||batch.capacity<list.length){batch?.dispose();batch=new AssetBatch(asset,renderer.group,T.MathUtils.ceilPowerOfTwo(Math.max(32,list.length)));renderer.luxBatches.set(asset,batch);this.batches.add(batch);}batch.update(list,time);}for(const [asset,batch]of renderer.luxBatches)if(!groups.has(asset))batch.update([],time);return covered;
    }
  }
  L.LuxPoseAsset=PoseAsset;L.LuxAssetBatch=AssetBatch;L.CharacterAssets=CharacterAssets;
})();
