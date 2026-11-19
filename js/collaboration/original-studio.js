/* Optional dialog added to the original application. Provider work remains server-side. */
(() => {
  'use strict';const clean=value=>window.IndoorLab?.brandNeutralText?.(value)??String(value??''),C=window.CoScene,T=THREE,$=id=>document.getElementById(id),STORE='co-scene-custom-partners-v1';
  class OriginalRobotStudio {
    constructor(owner){
      this.owner=owner;this.spec={...C.presets[0],name:'我的人形伙伴'};this.saved=[];this.revision=0;this.busy=false;this.previewSerial=0;this.mode='local-preview';this.history=[];this.design=null;this.modeTouched=false;
      try{const data=JSON.parse(localStorage.getItem(STORE)||'[]');if(Array.isArray(data))this.saved=data.slice(0,30).map(s=>({...RobotContract.migrateSavedSpec(s),id:String(s.id||''),source:RobotContract.isStationType(s.type)?'station-reference':s.rig?.provider==='fable'?'cloud-joint-configuration':s.type==='humanoid'?'unitree-urdf':'local-articulated',...(s.rig?.provider==='fable'&&Array.isArray(s.rig.joints)&&s.rig.joints.length<=40?{rig:s.rig}:{})}));}catch{}
      const dialog=document.createElement('dialog');dialog.id='robot-studio';dialog.innerHTML=`<div class="co-heading"><div><small>SPATIAL SIMULATION / ROBOT STUDIO</small><h2>定制机器人</h2></div><button id="co-studio-close" class="co-close" aria-label="关闭机器人定制">×</button></div><div class="co-studio-grid"><section><label class="co-mode-label" for="co-generation-mode">定制方式<select id="co-generation-mode"><option value="cloud" disabled>智能定制</option><option value="local-preview" selected>本地预览</option></select></label><div id="co-chat" role="log" aria-live="polite"></div><form id="co-chat-form"><label for="co-prompt" class="co-note">描述外形、颜色与用途</label><textarea id="co-prompt" maxlength="1200" placeholder="例如：白蓝色的工业人形机器人，用于协助设备巡检。"></textarea><button id="co-send" class="co-action primary" type="submit">更新预览</button></form><p id="co-provider-status" class="co-note" role="status">目前使用本地预设进行外观预览。自由造型与完整关节生成等待云端服务接入。</p></section><section><div id="co-preview" aria-label="机器人三维预览"></div><div class="co-studio-form"><label class="co-name">机器人名称<input id="co-design-name" maxlength="24" value="我的人形伙伴"></label><label>基础形态<select id="co-design-type"><option value="humanoid">真实工业人形</option><option value="delivery">送餐机器人</option><option value="quadruped">巡检机器狗</option><option value="carrier">物流机器人</option></select></label><label>配色<input id="co-design-color" type="color" value="#6b9bc4"></label></div><div class="co-studio-steps">01 确认造型 → 02 准备关节 → 03 放入场景</div><p id="co-design-status" class="co-studio-status" role="status">人形机器人采用工业机械结构与真实关节层级，动画为本地演示。</p><button id="co-confirm" class="co-action primary">确认当前造型</button><button id="co-place" class="co-action primary" hidden>放入当前场景</button></section></div>`;document.body.appendChild(dialog);
      $('co-studio-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{if(this.savedRun){this.owner.app.play(this.savedRun.app);this.owner.b.society.running=this.savedRun.society;this.owner.externalRunning=this.savedRun.external;this.savedRun=null;}});
      $('co-generation-mode').onchange=()=>{this.mode=$('co-generation-mode').value;this.modeTouched=true;this.invalidate();};
      $('co-chat-form').onsubmit=e=>{e.preventDefault();this.send();};$('co-confirm').onclick=()=>this.confirm();$('co-place').onclick=()=>this.place();
      for(const id of ['co-design-name','co-design-type','co-design-color'])$(id).oninput=()=>{const type=$('co-design-type').value,preset=this.presets().find(p=>p.type===type);if(!preset)return;if(type!==this.spec.type)this.spec={...this.spec,task:preset.task,accessories:[...(preset.accessories||[])]};this.spec={...this.spec,name:$('co-design-name').value,type,color:$('co-design-color').value};this.invalidate();this.preview();};
      $('co-saved-list').onclick=async e=>{const button=e.target.closest('[data-saved]');if(!button)return;button.disabled=true;try{await this.owner.robotInteraction.begin(this.saved[Number(button.dataset.saved)]);$('collaboration-panel').close();}catch(error){$('co-panel-status').textContent=clean(error.message);}finally{button.disabled=false;}};
      this.renderSaved();window.addEventListener('resize',()=>this.resize());
    }
    presets(){return C.robotPresetsForEnvironment?.(this.owner.environment)||C.presets;}
    allowed(spec){return C.robotAllowedInEnvironment?.(spec,this.owner.environment)??true;}
    syncEnvironment(){
      const environment=this.owner.environment==='station'?'station':'ground',presets=this.presets();
      if(this.studioEnvironment!==environment){
        this.environmentDrafts??=new Map();if(this.studioEnvironment)this.environmentDrafts.set(this.studioEnvironment,{spec:{...this.spec},mode:this.mode,modeTouched:this.modeTouched});
        const draft=this.environmentDrafts.get(environment);this.spec=draft?.spec||this.spec;
        if(!this.allowed(this.spec))this.spec=RobotContract.normalizeSpec({...presets[0],name:'我的'+presets[0].name});
        this.mode=environment==='station'?'local-preview':draft?.mode||'local-preview';this.modeTouched=draft?.modeTouched||false;
        this.studioEnvironment=environment;this.history=[];$('co-chat').replaceChildren();this.invalidate();
      }
      const types=$('co-design-type');types.replaceChildren();for(const preset of presets){const option=document.createElement('option');option.value=preset.type;option.textContent=clean(preset.label||preset.name);types.appendChild(option);}
      $('co-design-name').value=clean(this.spec.name);types.value=this.spec.type;$('co-design-color').value=this.spec.color;$('co-generation-mode').value=this.mode;
      $('co-prompt').placeholder=environment==='station'?'例如：蓝色的随行飞球，取名为小蓝，用于自主巡检。':'例如：白蓝色的工业人形机器人，用于协助设备巡检。';
      $('co-generation-mode').querySelector('[value="cloud"]').disabled=environment==='station';
      this.renderSaved();
    }
    initPreview(){
      if(this.renderer)return;this.scene=new T.Scene();this.scene.background=new T.Color('#e7eef5');this.scene.environment=this.owner.v.scene.environment;
      this.camera=new T.PerspectiveCamera(37,1,.02,30);this.renderer=new T.WebGLRenderer({antialias:true});this.renderer.outputEncoding=T.sRGBEncoding;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.95;this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;$('co-preview').appendChild(this.renderer.domElement);
      this.scene.add(new T.HemisphereLight('#e1edff','#65768f',.65),new T.AmbientLight('#d9e8ff',.1));const sun=new T.DirectionalLight('#fff9ef',2.1);sun.position.set(-3,5,4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-2;sun.shadow.camera.right=2;sun.shadow.camera.top=2;sun.shadow.camera.bottom=-2;sun.shadow.normalBias=.01;this.scene.add(sun);
      const floor=new T.Mesh(new T.CircleGeometry(3,64),C.material('#d3deeb',{roughness:.8}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-.01;this.scene.add(floor);
      this.controls=new T.OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.enablePan=false;this.controls.maxPolarAngle=Math.PI*.49;this.controls.minDistance=1.2;this.controls.maxDistance=5;
    }
    async thumbnail(spec){
      this.thumbnails??=new Map();const key=JSON.stringify([spec.type,spec.color,spec.scale,spec.accessories]);
      if(this.thumbnails.has(key))return this.thumbnails.get(key);
      await C.prepareRobot(spec);this.initPreview();
      const robot=C.makeRobot(spec),cameraState={position:this.camera.position.clone(),quaternion:this.camera.quaternion.clone(),aspect:this.camera.aspect},size=this.renderer.getSize(new T.Vector2()),pixelRatio=this.renderer.getPixelRatio(),visible=this.model?.visible;
      if(this.model)this.model.visible=false;this.scene.add(robot);
      try{
        C.animateRobot(robot,0,false,false,0);const bounds=new T.Box3().setFromObject(robot),center=bounds.getCenter(new T.Vector3()),extent=bounds.getSize(new T.Vector3());
        const distance=Math.max(extent.y,extent.x/1.45,extent.z)*2.15;this.camera.aspect=1.5;this.camera.position.copy(center).add(new T.Vector3(.8,.48,1).normalize().multiplyScalar(distance));this.camera.lookAt(center);this.camera.updateProjectionMatrix();this.renderer.setPixelRatio(1);this.renderer.setSize(420,280,false);this.renderer.render(this.scene,this.camera);
        const url=this.renderer.domElement.toDataURL('image/png');this.thumbnails.set(key,url);while(this.thumbnails.size>40)this.thumbnails.delete(this.thumbnails.keys().next().value);return url;
      }finally{C.disposeModel(robot);if(this.model)this.model.visible=visible;this.camera.position.copy(cameraState.position);this.camera.quaternion.copy(cameraState.quaternion);this.camera.aspect=cameraState.aspect;this.camera.updateProjectionMatrix();this.renderer.setPixelRatio(pixelRatio);this.renderer.setSize(size.x,size.y,false);}
    }
    loadLibraryImages(){
      const cards=[...document.querySelectorAll('[data-co-preset],[data-saved]')];
      for(const card of cards){if(card.dataset.previewState)continue;const spec=card.hasAttribute('data-co-preset')?this.presets()[Number(card.dataset.coPreset)]:this.saved[Number(card.dataset.saved)];if(!spec||!this.allowed(spec))continue;card.dataset.previewState='loading';
        this.thumbnail(spec).then(url=>{if(!card.isConnected)return;const img=card.querySelector('img');img.src=url;img.hidden=false;card.querySelector('.co-card-placeholder').hidden=true;card.dataset.previewState='ready';}).catch(()=>{delete card.dataset.previewState;card.querySelector('.co-card-placeholder').textContent='模型预览暂不可用';});
      }
    }
    async open(){
      const o=this.owner;this.syncEnvironment();this.savedRun={app:o.app.running,society:o.b.society.running,external:o.externalRunning};o.app.play(false);o.b.society.running=false;o.externalRunning=false;
      $('robot-studio').showModal();this.initPreview();this.resize();this.refreshProviderStatus();if(!$('co-chat').children.length)this.message(o.environment==='station'?'选择空间站机器人，可以调整名称、配色和尺寸，再安排巡检、交接或补给任务。':'先选择一类机器人，再描述你想调整的外观。\n人形预览采用真实工业人形模型；当前可调整名字、配色和整体尺寸。任意新造型将在造型服务接入后生成。');await this.preview();
    }
    async refreshProviderStatus(){
      const target=$('co-provider-status'),environment=this.owner.environment;
      if(environment==='station'){this.mode='local-preview';$('co-generation-mode').value=this.mode;$('co-generation-mode').querySelector('[value="cloud"]').disabled=true;target.textContent='空间站机器人可直接预览和调整，确认后即可安排任务并放入舱内。';return;}
      try{
        const response=await fetch('/api/robots/status',{cache:'no-store',signal:AbortSignal.timeout(18000)});if(!response.ok)throw new Error();const status=await response.json();
        if(this.owner.environment!==environment)return;target.textContent=clean(status.fable?.message||'智能定制暂时不可用。')+'当前使用现有工业造型，自由造型服务尚未连接。';
        $('co-generation-mode').querySelector('[value="cloud"]').disabled=!status.fable?.ready;
        if(!this.busy&&!this.modeTouched&&!this.design&&!this.rig){this.mode=status.fable?.ready?'cloud':'local-preview';$('co-generation-mode').value=this.mode;}
      }catch{if(this.owner.environment===environment)target.textContent='服务状态暂时无法读取。可选择本地预览；智能定制状态未确认。';}
    }

    resize(){if(!this.renderer||!$('robot-studio').open)return;const r=$('co-preview').getBoundingClientRect();this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();}
    async preview(){
      const serial=++this.previewSerial;try{$('co-design-status').textContent=this.spec.type==='humanoid'?'正在载入工业人形模型…':'正在更新本地预览…';await C.prepareRobot(this.spec);if(serial!==this.previewSerial)return;
        const model=C.makeRobot(this.spec);if(this.model)C.disposeModel(this.model);this.model=model;this.scene.add(model);const bounds=new T.Box3().setFromObject(model),center=bounds.getCenter(new T.Vector3()),extent=bounds.getSize(new T.Vector3()),h=Math.max(extent.x,extent.y,extent.z,.5);this.camera.position.copy(center).add(new T.Vector3(h*1.6,h*.5,h*1.9));this.controls.target.copy(center);this.controls.update();this.resize();$('co-design-status').textContent=this.owner.environment==='station'?clean(this.presets().find(p=>p.type===this.spec.type)?.label||this.spec.name)+' · 空间站动作预览':this.spec.type==='humanoid'?'工业人形 · 29 个活动关节 · 本地动作演示':this.spec.type==='quadruped'?'工业四足 · 12 个活动关节 · 本地动作演示':'本地预设预览 · 云端造型与关节服务待接入。';
      }catch(error){$('co-design-status').textContent=clean(error.message);}
    }
    invalidate(){this.revision++;this.rig=null;this.design=null;$('co-place').hidden=true;$('co-confirm').hidden=false;}
    message(text,user=false){const p=document.createElement('div');p.className='co-message'+(user?' user':'');p.textContent=clean(text);$('co-chat').appendChild(p);while($('co-chat').children.length>20)$('co-chat').firstElementChild.remove();$('co-chat').scrollTop=$('co-chat').scrollHeight;}
    setBusy(value){this.busy=value;for(const id of ['co-send','co-confirm','co-place','co-design-name','co-design-type','co-design-color','co-generation-mode'])$(id).disabled=value;}
    async api(path,body){const r=await fetch('/api/robots'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(110000)});const d=await r.json();if(!r.ok)throw Object.assign(new Error(d.error||'服务不可用，请重试。'),{code:d.code,status:r.status});return d;}
    async send(){
      if(this.busy)return;const prompt=$('co-prompt').value.trim();if(!prompt)return;
      this.setBusy(true);this.message(prompt,true);$('co-design-status').textContent=this.mode==='cloud'?'正在理解描述并更新预览…':'正在更新本地预览…';
      try{
        let result;
        if(this.owner.environment==='station'){
          const previous=this.spec,spec=RobotContract.interpret(prompt,previous);
          if(!this.allowed(spec))spec.type=previous.type;
          if(spec.type===previous.type&&!/用于|负责|任务[是为：:]|先(?:巡检|检查|取件|从|送|领取)/.test(prompt))spec.task=previous.task;
          result={design:{id:crypto.randomUUID(),spec:RobotContract.normalizeSpec(spec)},message:'空间站机器人预览已更新。'};
        }else result=await this.api('/designs',{mode:this.mode,prompt,spec:this.spec,history:this.history.slice(-10),requestId:crypto.randomUUID()});
        this.spec=result.design.spec;const missionText=prompt.match(/(?:用于|负责|任务[是为：:])([\s\S]+)/)?.[1]||prompt.match(/先(?:巡检|检查|取件|从|送|领取)[\s\S]*/)?.[0];let missionIssue='';if(missionText){const mission=C.parseRobotMission(missionText);this.spec.taskText=missionText;if(mission.task){this.spec.task=mission.task;this.spec.inspectionCount=mission.inspectionCount||3;}else missionIssue=mission.error;}
        $('co-design-name').value=clean(this.spec.name);$('co-design-type').value=this.spec.type;$('co-design-color').value=this.spec.color;
        this.invalidate();this.design=result.design;await this.preview();$('co-prompt').value='';this.message((this.mode==='local-preview'?'本地方案：'+(this.presets().find(p=>p.type===this.spec.type)?.label||this.spec.type)+'「'+this.spec.name+'」，配色 '+this.spec.color+'，尺寸 '+Math.round(this.spec.scale*100)+'%。已按现有模型更新预览；自由造型描述不会生成新的机械结构。':result.message)+(missionIssue?' 任务未接受：'+missionIssue:missionText?' 任务将在放置前逐步确认。':''));
        this.history.push({role:'user',content:prompt},{role:'assistant',content:result.message});this.history=this.history.slice(-10);
      }catch(error){this.message('未能更新：'+error.message);$('co-design-status').textContent=clean(error.message);this.refreshProviderStatus();}
      finally{this.setBusy(false);}
    }
    async confirm(){
      if(this.busy)return;this.setBusy(true);$('co-design-status').textContent=this.mode==='cloud'?'正在生成并校验完整关节配置…':'正在准备本地预设关节…';
      try{
        await C.prepareRobot(this.spec);
        let rig,message;
        if(this.owner.environment==='station'){
          if(!this.allowed(this.spec))throw new Error('请选择空间站机器人。');
          await this.preview();if(this.model?.userData.spec.type!==this.spec.type)throw new Error('模型仍在准备，请稍后再确认。');
          rig={id:crypto.randomUUID(),provider:'local',source:'station-reference',joints:RobotContract.jointSchema(this.spec.type)};message='空间站关节已准备好，可以安排任务。';
        }else{
          if(!this.design)this.design=(await this.api('/designs',{mode:this.mode,spec:this.spec,requestId:crypto.randomUUID()})).design;
          ({rig,message}=await this.api('/rigs',{mode:this.mode,designId:this.design.id,confirmed:true}));
        }
        C.applyRobotRig(this.model,rig);this.rig=rig;$('co-confirm').hidden=true;$('co-place').hidden=false;$('co-place').textContent='放入'+this.owner.locationName();
        $('co-design-status').textContent=rig.joints.length+' 个活动关节 · '+clean(message);
      }catch(error){if(!['TimeoutError','AbortError'].includes(error.name))this.design=null;$('co-design-status').textContent=clean(error.message);this.refreshProviderStatus();}
      finally{this.setBusy(false);}
    }
    async place(){
      if(!this.rig||this.busy)return;this.setBusy(true);
      try{
        const rig={provider:this.rig.provider,joints:this.rig.joints,generation:this.rig.generation||null};
        const spec={...this.spec,id:this.rig.id,source:this.rig.source,...(rig.provider==='fable'?{rig}:{})};await this.owner.robotInteraction.begin(spec,{onPlaced:r=>{Object.assign(spec,{task:r.task,inspectionCount:r.spec.inspectionCount,taskText:r.spec.taskText,taskTarget:r.spec.taskTarget,taskTargetName:r.spec.taskTargetName});
        if(!this.saved.some(s=>s.id===spec.id)){this.saved.unshift(spec);this.saved=this.saved.slice(0,30);try{localStorage.setItem(STORE,JSON.stringify(this.saved));}catch{this.owner.toast('机器人已加入场景；本浏览器暂不能保存收藏。');}}
        this.renderSaved();}});this.invalidate();$('robot-studio').close();
      }catch(error){$('co-design-status').textContent=clean(error.message);}finally{this.setBusy(false);}
    }
    renderSaved(){const list=$('co-saved-list'),saved=this.saved.map((spec,index)=>({spec,index})).filter(({spec})=>this.allowed(spec));list.replaceChildren();$('co-saved-count').textContent='· '+saved.length;if(!saved.length){const p=document.createElement('p');p.className='co-note';p.textContent='确认并放置的'+(this.owner.environment==='station'?'空间站':'地面')+'机器人会保存在这里。';list.appendChild(p);}saved.forEach(({spec:s,index:i})=>{const b=document.createElement('button');b.dataset.saved=i;b.className='co-robot-card';b.setAttribute('aria-label','放入'+clean(s.name));b.innerHTML='<span class="co-card-art"><img hidden><span class="co-card-placeholder">载入模型图示</span><span class="co-card-add" aria-hidden="true">＋</span></span><span class="co-card-caption"><b></b><small></small></span>';b.querySelector('img').alt=clean(s.name)+'三维模型';b.querySelector('b').textContent=clean(s.name);b.querySelector('small').textContent=this.owner.environment==='station'?'空间站 · 你的专属伙伴':s.type==='humanoid'?'人形 · 你的专属伙伴':'你的专属伙伴';list.appendChild(b);});}
    render(now){if(!$('robot-studio').open||!this.renderer)return;this.controls.update();if(this.model)C.animateRobot(this.model,now*.0017,!!this.rig,false,now*.001);this.renderer.render(this.scene,this.camera);}
  }
  C.OriginalRobotStudio=OriginalRobotStudio;
})();
