/* Add human–robot experiments to the existing application, never recreate its office. */
(() => {
  'use strict';
  const L=window.IndoorLab,C=window.CoScene,T=THREE,$=id=>document.getElementById(id);
  const escape=s=>String(L.brandNeutralText?.(s)??s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  C.robotPresetsForEnvironment=environment=>environment==='station'?(C.stationPresets||[]):C.presets;
  C.robotAllowedInEnvironment=(spec,environment)=>window.RobotContract.isStationType(spec?.type)===(environment==='station');
  class OriginalCollaboration {
    constructor(building){
      this.b=building;this.app=L.app;this.v=this.app.view;this.environment='office';this.contexts=new Map();this.switching=false;this.externalRunning=true;this.rate=1;this.lastFrame=performance.now();this.lastUI=0;this.selected=null;this.following=false;this.originalRender=this.v.render.bind(this.v);this.originalSetPhase=building.setPhase.bind(building);this.originalSetView=this.v.setView.bind(this.v);this.originalFrameCamera=building.frameCamera.bind(building);this.originalEnterFloor=building.enterFloor.bind(building);
      this.b.society.robotBodies=()=>[...this.contexts.values()].filter(ctx=>ctx.key.startsWith('office-')).flatMap(ctx=>ctx.sim.robots.map((r,i)=>({id:100000+Number(ctx.key.slice(7))*100+i,x:r.x,z:r.z,floor:Number(ctx.key.slice(7)),location:'floor',pose:'stand',health:'healthy',collisionRadius:r.radius+.08})));
      this.createUI();document.body.dataset.coEnvironment='office';this.syncSceneNav();
      this.phaseObserver=new MutationObserver(()=>this.syncSceneNav());this.phaseObserver.observe(document.body,{attributes:true,attributeFilter:['data-building-phase']});
      this.v.render=()=>this.render();
      building.setPhase=(phase,animate)=>{if(this.environment!=='office'){if(phase==='intro')this.switchEnvironment('office');else this.externalCamera('perspective');return;}return this.originalSetPhase(phase,animate);};
      building.frameCamera=(animate)=>this.environment==='office'?this.originalFrameCamera(animate):this.externalCamera('perspective');
      building.enterFloor=async floor=>{if(this.environment!=='office')await this.switchEnvironment('office');return this.originalEnterFloor(floor);};
      const setStyle=building.setRenderStyle.bind(building);building.setRenderStyle=(style='access')=>{if(this.environment==='station'){this.stationExperience.applyLighting();return;}setStyle(style);};
      this.v.setView=mode=>this.environment==='office'?this.originalSetView(mode):this.externalCamera(mode);
      const canvas=this.v.renderer.domElement;let down;
      canvas.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY},true);
      canvas.addEventListener('click',e=>{const scenarios=this.stationExperience?.scenarios;if((scenarios?.blocksObservation??scenarios?.active)||this.v.view==='walk'||!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;const ctx=this.currentContext(false);if(!ctx)return;const rect=canvas.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),this.v.camera);const hit=ray.intersectObjects(ctx.sim.robots.map(r=>r.model),true).find(h=>h.object.userData.robotRoot);if(hit){e.stopImmediatePropagation();this.selected=ctx.sim.robots.find(r=>r.model===hit.object.userData.robotRoot)?.id;this.openPanel();}},true);
      this.v.controls.addEventListener('start',()=>this.following=false);
      // Exterior clicks must not pull office floors out of the original tower.
      for(const event of ['click','dblclick'])canvas.addEventListener(event,e=>{if(this.environment!=='office'){const scenarios=this.stationExperience?.scenarios;if(event==='click'&&!(scenarios?.blocksObservation??scenarios?.active)&&this.v.view==='walk'&&!this.v.firstPerson.locked)this.v.firstPerson.lock();e.stopImmediatePropagation();}},true);
      $('reset-button').addEventListener('click',()=>{const ctx=this.currentContext(false);ctx?.sim.reset();});
      this.studio=new C.OriginalRobotStudio(this);
      this.chat=new C.ObservationChat(this);
      this.robotInteraction=new C.RobotInteraction(this);
      this.themeTint=$('mirror-edge-color')?.closest('label');this.themeTint?.remove();$('building-theme-switch')?.remove();
      this.ready=true;document.body.dataset.collaborationReady='true';
    }
    createUI(){
      document.title='Ominispace · 空间全宇宙';
      const dock=document.createElement('section');dock.id='building-action-dock';dock.setAttribute('aria-label','楼栋观察与操作');document.body.appendChild(dock);const floorCard=$('building-floor-sidebar');if(floorCard)dock.appendChild(floorCard);
      const interiorControls=document.createElement('section');interiorControls.id='co-interior-controls';interiorControls.setAttribute('aria-label','模拟与图层控制');interiorControls.hidden=true;dock.prepend(interiorControls);this.interiorControls=interiorControls;
      const interiorToggle=document.createElement('button');interiorToggle.id='co-interior-toggle';interiorToggle.type='button';interiorToggle.textContent='⋯';interiorToggle.hidden=true;interiorToggle.setAttribute('aria-controls',dock.id);document.body.appendChild(interiorToggle);this.interiorToggle=interiorToggle;
      interiorToggle.onclick=()=>this.setInteriorControlsOpen(interiorToggle.getAttribute('aria-expanded')!=='true',true);this.setInteriorControlsOpen(false);
      this.interiorMobileQuery=matchMedia('(max-width:760px)');this.interiorMobileQuery.addEventListener('change',()=>this.setInteriorControlsOpen(false));
      // Move the original nodes, preserving their listeners and live state. Anchors
      // return them to the original scene hierarchy when leaving the office interior.
      this.interiorControlNodes=['.playback-bar','.stage-bottom'].map(selector=>{const node=document.querySelector(selector);if(!node)return null;const anchor=document.createComment('indoor control home');node.before(anchor);return{node,anchor};}).filter(Boolean);
      const interiorWalk=document.querySelector('.view-tabs [data-view="walk"]');if(interiorWalk){interiorWalk.classList.add('ob-interior-walk');dock.appendChild(interiorWalk);}
      const open=document.createElement('button');open.id='collaboration-open';open.textContent='部署具身智能';open.title='部署具身智能';open.onclick=()=>this.openRobotLibrary();dock.appendChild(open);$('character-assets-open')?.remove();
      const sceneNav=document.createElement('nav');sceneNav.id='co-scene-nav';sceneNav.setAttribute('aria-label','场景视角');sceneNav.innerHTML='<button data-scene-view="campus">楼外园区</button><button data-scene-view="office">办公楼</button><button data-scene-view="station">空间站</button>';document.body.appendChild(sceneNav);sceneNav.querySelectorAll('button').forEach(button=>button.onclick=()=>this.switchEnvironment(button.dataset.sceneView));this.sceneNav=sceneNav;this.syncSceneNav();
      const panel=document.createElement('dialog');panel.id='collaboration-panel';panel.innerHTML=`<div class="co-heading"><div><small>SPATIAL SIMULATION / HUMAN × ROBOT</small><h2>部署具身智能</h2></div><button class="co-close" id="co-panel-close" aria-label="关闭部署具身智能面板">×</button></div><div class="co-scene-options" aria-label="选择观察场景"><button data-co-scene="office" aria-pressed="true">办公楼</button><button data-co-scene="campus" aria-pressed="false">楼外园区</button><button data-co-scene="station" aria-pressed="false">空间站</button></div><p class="co-note" id="co-location">保留原建筑与人物，机器人放入当前观察的楼层。</p><div class="co-library-tabs" role="tablist" aria-label="机器人资产"><button id="co-preset-tab" role="tab" aria-selected="true" aria-controls="co-preset-list">预设伙伴 <span>04</span></button><button id="co-saved-tab" role="tab" aria-selected="false" aria-controls="co-saved-list" tabindex="-1">我的收藏 <span id="co-saved-count">0</span></button></div><div class="co-asset-list" id="co-preset-list" role="tabpanel" aria-labelledby="co-preset-tab">${C.presets.map((p,i)=>`<button class="co-robot-card" data-co-preset="${i}" aria-label="放入${escape(p.label)}"><span class="co-card-art"><img alt="${escape(p.label)}三维模型" hidden><span class="co-card-placeholder">载入模型图示</span><span class="co-card-add" aria-hidden="true">＋</span></span><span class="co-card-caption"><b>${escape(p.label)}</b><small>${escape(p.subtitle)}</small></span></button>`).join('')}</div><div class="co-asset-list" id="co-saved-list" role="tabpanel" aria-labelledby="co-saved-tab" hidden></div><button class="co-action primary co-create-robot" id="co-open-studio"><span><b>打造自己的机器人</b><small>从一句描述，开始设计</small></span><span aria-hidden="true">↗</span></button><div class="co-metrics"><span><b id="co-robot-count">0</b><small>当前场景机器人</small></span><span><b id="co-completed">0</b><small>已完成任务</small></span><span><b id="co-yields">0</b><small>主动让行</small></span></div><div class="co-roster-heading"><h3>当前伙伴</h3><label><input id="co-show-routes" type="checkbox" checked> 行走路线</label></div><div id="co-robot-list" class="co-robot-list"></div><div id="co-events" class="co-events"></div><div class="co-panel-actions"><button class="co-action" id="co-export">导出协同记录</button><button class="co-action" id="co-clear">移出当前机器人</button></div><p class="co-note" id="co-panel-status" role="status"></p>`;
      const motionLabel=document.createElement('label');motionLabel.className='co-mode-label';motionLabel.innerHTML='切换动画<select id="co-scene-motion"><option value="full">完整动画</option><option value="system">跟随系统</option><option value="reduced">减少动态</option></select>';panel.querySelector('.co-scene-options').after(motionLabel);
      // Camera travel has its own preference; OS motion applies only when selected.
      let savedMotion;try{savedMotion=localStorage.getItem('co-scene-motion');}catch{}
      const motion=motionLabel.querySelector('select');this.sceneMotion=['full','system','reduced'].includes(savedMotion)?savedMotion:'full';motion.value=this.sceneMotion;motion.onchange=()=>{this.sceneMotion=motion.value;try{localStorage.setItem('co-scene-motion',this.sceneMotion);}catch{}};
      document.body.appendChild(panel);$('co-panel-close').onclick=()=>panel.close();panel.querySelectorAll('[data-co-scene]').forEach(button=>button.onclick=async()=>{const id=button.dataset.coScene;if(id!==this.environment&&!this.switching&&!this.chat?.commands.busy&&!this.app.busy)panel.close();await this.switchEnvironment(id);if(!this.switching)panel.close();});
      $('co-preset-list').onclick=async e=>{const button=e.target.closest('[data-co-preset]');if(!button||button.disabled)return;const spec=C.robotPresetsForEnvironment(this.environment)[Number(button.dataset.coPreset)];if(!spec)return;button.disabled=true;button.classList.add('is-placing');$('co-panel-status').textContent='正在准备机器人…';try{await this.robotInteraction.begin(spec);panel.close();}catch(error){$('co-panel-status').textContent=L.brandNeutralText?.(error.message)??error.message;}finally{button.disabled=false;button.classList.remove('is-placing');}};
      const tabs=[$('co-preset-tab'),$('co-saved-tab')];
      tabs.forEach((tab,index)=>{tab.onclick=()=>{tabs.forEach((item,i)=>{const selected=i===index;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;$(item.getAttribute('aria-controls')).hidden=!selected;});};tab.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?1:1-index;tabs[next].click();tabs[next].focus();}};});
      $('co-show-routes').onchange=()=>{const ctx=this.currentContext(false);if(ctx)ctx.sim.routes.visible=$('co-show-routes').checked;};
      $('co-robot-list').onchange=e=>{if(e.target.matches('[data-co-task]')){this.currentContext(false)?.sim.setTask(e.target.dataset.id,e.target.value);this.refreshUI();}};
      $('co-open-studio').onclick=()=>{panel.close();this.studio.open();};$('co-export').onclick=()=>this.export();$('co-clear').onclick=()=>{const ctx=this.currentContext(false);if(ctx)for(const r of [...ctx.sim.robots])ctx.sim.removeRobot(r.id);this.refreshUI();};
      $('co-robot-list').onclick=e=>{const button=e.target.closest('button[data-id]');if(!button)return;const ctx=this.currentContext(false),r=ctx?.sim.robots.find(r=>r.id===button.dataset.id);if(!r)return;if(button.dataset.action==='retry'){ctx.sim.setTask(r.id,r.task,{preserveText:true});this.refreshUI();}else if(button.dataset.action==='cancel'){ctx.sim.cancelTask(r.id);this.refreshUI();}else if(button.dataset.action==='remove'){ctx.sim.removeRobot(r.id);this.refreshUI();}else{this.selected=r.id;this.focusRobot(r);this.following=true;panel.close();}};
      const transition=document.createElement('div');transition.id='co-scene-transition';transition.innerHTML='<div class="co-travel-loading" aria-labelledby="co-travel-title"><img src="assets/ominispace-icon-64.png" width="48" height="48" alt=""><span class="co-travel-brand">Ominispace</span><h2 id="co-travel-title">正在准备空间站</h2><p id="co-travel-detail">正在连接轨道空间，首次进入需要下载模型。</p><div class="co-travel-progress-heading"><span>预计准备进度</span><b id="co-travel-percent">0%</b></div><div id="co-travel-progress" role="progressbar" aria-label="空间站预计准备进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="co-travel-fill"></i></div><div class="co-travel-loading-foot"><span id="co-travel-note">下载完成后会自动升空进入</span><span id="co-travel-elapsed">00:00</span></div><div id="co-travel-actions" hidden><button id="co-travel-retry" type="button">重新尝试</button><button id="co-travel-dismiss" type="button">返回观察</button></div></div><span id="co-travel-status" role="status" aria-live="polite"></span>';document.body.appendChild(transition);
      $('co-travel-retry').onclick=()=>{const destination=this.travelFailure;this.dismissTravelFailure();if(destination)this.switchEnvironment(destination);};$('co-travel-dismiss').onclick=()=>this.dismissTravelFailure();
      const external=document.createElement('div');external.id='co-environment-ui';external.hidden=true;external.innerHTML=`<div class="co-env-title"><small id="co-env-code"></small><h1 id="co-env-title"></h1><p id="co-env-description"></p></div><aside class="co-env-panel" aria-labelledby="co-env-panel-title"><small class="co-env-kicker">CAMPUS OBSERVATORY</small><h2 id="co-env-panel-title">步道上的协作</h2><p>递送、巡检与主动让行，在同一条步道上自然发生。</p><div class="co-env-metrics"><span><b id="co-env-robots-count">0</b><small>机器人</small></span><span><b id="co-env-completed-count">0</b><small>完成任务</small></span><span><b id="co-env-yields-count">0</b><small>主动让行</small></span></div><div class="co-env-actions"><button id="co-env-play">Ⅱ 暂停模拟</button><button data-co-camera="walk">第一人称</button><button id="co-env-robots" title="部署具身智能">部署具身智能</button></div></aside><div class="co-env-controls"><button id="co-return-office">← 办公楼</button><button data-co-camera="perspective" class="active">空间透视</button><button data-co-camera="top">平面总览</button></div><div class="co-env-status" id="co-env-status"></div>`;document.body.appendChild(external);external.querySelectorAll('[data-co-camera]').forEach(button=>button.onclick=()=>this.externalCamera(button.dataset.coCamera));$('co-return-office').onclick=()=>this.switchEnvironment('office');$('co-env-play').onclick=()=>{this.externalRunning=!this.externalRunning;$('co-env-play').textContent=this.externalRunning?'Ⅱ 暂停模拟':'▶ 继续模拟';};$('co-env-robots').onclick=()=>this.openRobotLibrary();
      const toast=document.createElement('div');toast.id='co-toast';toast.hidden=true;toast.setAttribute('role','status');document.body.appendChild(toast);
    }
    refreshRobotLibrary(){
      const environment=this.environment==='station'?'station':'ground';if(this.robotLibraryEnvironment===environment)return;
      this.robotLibraryEnvironment=environment;const presets=C.robotPresetsForEnvironment(this.environment);
      $('co-preset-tab').querySelector('span').textContent=String(presets.length).padStart(2,'0');
      $('co-preset-list').innerHTML=presets.map((p,i)=>`<button class="co-robot-card" data-co-preset="${i}" data-robot-type="${escape(p.type)}" aria-label="放入${escape(p.label)}"><span class="co-card-art"><img alt="${escape(p.label)}三维模型" hidden><span class="co-card-placeholder">载入模型图示</span><span class="co-card-add" aria-hidden="true">＋</span></span><span class="co-card-caption"><b>${escape(p.label)}</b><small>${escape(p.subtitle)}</small></span></button>`).join('');
      this.studio?.renderSaved();if($('collaboration-panel').open)this.studio?.loadLibraryImages();
    }
    async openRobotLibrary(){
      if(this.b.phase==='intro'||this.switching)return;
      try{
        this.robotInteraction?.cancel();this.chat?.close(false);if(document.pointerLockElement)document.exitPointerLock();$('collaboration-panel')?.close();
        L.initializeRobotLibrary?.();if(!L.robotLibrary)throw Error('机器人库正在准备，请稍后重试。');await L.robotLibrary.open();
      }catch(error){this.toast(error.message||'机器人库暂时无法打开，请稍后重试。');}
    }
    openPanel(){if(this.b.phase==='intro')return;this.robotInteraction?.cancel();this.chat?.close(false);$('co-panel-status').textContent='';if(document.pointerLockElement)document.exitPointerLock();this.refreshUI();this.studio?.renderSaved();$('collaboration-panel').showModal();this.studio?.loadLibraryImages();}
    toast(message){$('co-toast').textContent=L.brandNeutralText?.(message)??message;$('co-toast').hidden=false;clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>$('co-toast').hidden=true,3500);}
    setTravelStatus(text){const value=L.brandNeutralText?.(text)??text;$('co-travel-status').textContent=value;if(document.body.dataset.coTravelPhase==='loading')$('co-travel-detail').textContent=value;}
    startTravelLoading(){
      this.stopTravelLoading();this.travelFailure=null;delete document.body.dataset.coLoadError;$('co-travel-actions').hidden=true;$('co-travel-title').textContent='正在准备空间站';
      this.travelLoading={started:performance.now(),value:0,target:0};this.setTravelStatus('正在连接轨道空间，首次进入需要下载模型。');
      const update=()=>{const state=this.travelLoading;if(!state)return;const seconds=(performance.now()-state.started)/1000,estimate=.04*(1-Math.exp(-seconds/12));state.value=Math.min(.99,Math.max(state.value,state.target,estimate));const percent=Math.floor(state.value*100);$('co-travel-percent').textContent=percent+'%';$('co-travel-fill').style.transform='scaleX('+state.value+')';$('co-travel-progress').setAttribute('aria-valuenow',String(percent));$('co-travel-elapsed').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(Math.floor(seconds)%60).padStart(2,'0');$('co-travel-note').textContent=navigator.onLine===false?'网络已断开，正在等待连接恢复':seconds>=15?'首次下载较多，完成后会自动进入':'下载完成后会自动升空进入';};
      this.travelLoading.update=update;this.travelLoading.timer=setInterval(update,500);update();
    }
    updateTravelLoading(progress,text){if(!this.travelLoading)return;this.travelLoading.target=Math.max(this.travelLoading.target,Math.min(.99,progress));if(text)this.setTravelStatus(text);this.travelLoading.update();}
    stopTravelLoading(){if(this.travelLoading)clearInterval(this.travelLoading.timer);this.travelLoading=null;}
    dismissTravelFailure(){this.stopTravelLoading();this.travelFailure=null;delete document.body.dataset.coLoadError;delete document.body.dataset.coTravel;delete document.body.dataset.coTravelPhase;$('co-scene-transition').classList.remove('active');$('co-travel-actions').hidden=true;this.setTravelStatus('');}
    showTravelFailure(error,id){this.stopTravelLoading();this.travelFailure=id;document.body.dataset.coTravel=id;document.body.dataset.coTravelPhase='loading';document.body.dataset.coLoadError='true';$('co-travel-title').textContent='空间站暂未准备完成';this.setTravelStatus(error?.message||'网络连接失败，请重新尝试。');$('co-travel-note').textContent='已下载完成的模型会保留，可继续重试';$('co-travel-actions').hidden=false;$('co-scene-transition').classList.add('active');}
    paintTravelFeedback(){return new Promise(resolve=>{if(document.hidden){setTimeout(resolve,0);return;}requestAnimationFrame(()=>requestAnimationFrame(resolve));});}
    syncSceneNav(){const locked=this.b.phase==='intro'||this.switching;document.querySelectorAll('[data-scene-view],[data-co-scene]').forEach(button=>{const active=(button.dataset.sceneView||button.dataset.coScene)===this.environment;button.setAttribute('aria-pressed',String(active));button.disabled=locked;});this.syncInteriorControls();}
    syncInteriorControls(){
      if(!this.interiorControls)return;
      const active=this.environment==='office'&&this.b.phase==='interior';
      if(active!==this.interiorControlsActive)this.setInteriorControlsOpen(false);
      this.interiorControlsActive=active;this.interiorToggle.hidden=!active;
      for(const{node,anchor}of this.interiorControlNodes){if(active){if(node.parentElement!==this.interiorControls)this.interiorControls.appendChild(node);}else if(node.parentNode!==anchor.parentNode)anchor.after(node);}
      this.interiorControls.hidden=!active;
    }
    setInteriorControlsOpen(open,returnFocus=false){
      if(open&&(!this.interiorMobileQuery?.matches||this.environment!=='office'||this.b.phase!=='interior'))return;
      if(open)document.body.dataset.coInteriorControls='open';else delete document.body.dataset.coInteriorControls;
      const label=open?'收起室内控制卡片':'展开室内控制卡片';this.interiorToggle.setAttribute('aria-expanded',String(open));this.interiorToggle.setAttribute('aria-label',label);this.interiorToggle.title=label;
      if(open)$('building-action-dock').scrollTop=0;else if(returnFocus)this.interiorToggle.focus({preventScroll:true});
    }
    reducedSceneMotion(){return this.sceneMotion==='reduced'||this.sceneMotion==='system'&&matchMedia('(prefers-reduced-motion: reduce)').matches;}
    travelPose(){
      const v=this.v;v.camera.updateWorldMatrix(true,false);const position=v.camera.getWorldPosition(new T.Vector3()),target=v.controls.target.clone();v.camera.parent?.localToWorld(target);if(['walk','human'].includes(v.view))target.copy(position).addScaledVector(v.camera.getWorldDirection(new T.Vector3()),20);
      // Continuous walking uses a floating ground origin even without a camera parent.
      if(this.b.continuous.active){position.y-=this.b.world.position.y;target.y-=this.b.world.position.y;}
      return{position,target,up:v.camera.up.clone(),fov:v.camera.fov,background:v.scene.background.clone()};
    }
    async travelCamera(outward){
      this.b.cameraTween=null;if(this.stationExperience)this.stationExperience.tween=null;
      const v=this.v,ground=this.trip.ground,reduced=this.trip.reduced,finalCamera=v.captureCameraState(),projection={near:v.camera.near,far:v.camera.far,fov:v.camera.fov},pose=this.travelPose(),native=ground?this.trip.source.background.clone():v.scene.background.clone(),fog=v.scene.fog?.clone();
      const source=outward||ground?this.trip.source:pose,distance=source.position.distanceTo(source.target),lift=Math.min(155,Math.max(90,distance*.48)),high=source.position.clone().add(new T.Vector3(0,lift,0)),bridge=new T.Color('#173b60').convertSRGBToLinear();
      let start=source.position.clone(),end=high,from=source.target.clone(),to=source.target.clone(),startFov=source.fov,endFov=Math.min(64,source.fov+18),radial=null;
      if(ground){end=pose.position.clone();to=pose.target.clone();endFov=projection.fov;}
      else if(outward&&this.trip.from==='station'){
        const earth=this.stationExperience.earth.getWorldPosition(new T.Vector3()),axis=start.clone().sub(earth).normalize();end=earth.clone().addScaledVector(axis,135);to=earth.clone().addScaledVector(axis,104);endFov=Math.min(58,source.fov+8);
      }
      else if(outward)endFov=Math.min(58,source.fov+8);
      else if(!outward){
        end=pose.position.clone();to=pose.target.clone();startFov=Math.min(64,projection.fov+18);endFov=projection.fov;
        if(this.trip.to==='station'){
          const earth=this.stationExperience.earth.position.clone(),axis=end.clone().sub(earth).normalize(),radius=end.distanceTo(earth);
          start=earth.clone().addScaledVector(axis,135);from=earth.clone().addScaledVector(axis,104);radial={earth,axis,radius,arc:new T.Vector3(1,0,0).multiplyScalar(50)};
        }else{start=end.clone().add(new T.Vector3(0,lift,0));from=to.clone();startFov=Math.min(58,projection.fov+8);}
      }
      if(reduced){start=end=pose.position.clone();from=to=pose.target.clone();startFov=endFov=projection.fov;radial=null;}
      // Prepare the overlap before moving: its first shader compilation must not
      // interrupt the hand-off between the ascent and the orbital camera.
      if(outward&&!reduced){this.captureTravelLayer();this.warmTravelLayer();}
      document.body.dataset.coTravelPhase=ground?'ground':outward?'departure':'arrival';
      this.stopTravelLoading();this.setTravelStatus(ground?'正在调整观察视角…':this.trip.to==='station'?(outward?'正在升空 · 穿越大气层':'正在接近空间站'):'正在返回地面…');
      await new Promise((resolve,reject)=>{
        this.trip.preparing=false;this.travel={ground,outward,reduced,lift,landscapeStart:this.b.landscapeAppearance.mix.value,startUp:source.up.clone(),at:performance.now(),last:performance.now(),elapsed:0,duration:reduced?120:ground?850:outward?850:1250,start,end,from,to,radial,startFov,endFov,startColor:ground?native:outward?native:bridge,endColor:ground?native:outward?bridge:native,scene:v.scene,resolve,reject,finalCamera,projection,native,fog};
        v.controls.enabled=false;v.walkKeys.clear();this.applyTravel(performance.now());
      });
      if(outward&&!reduced)this.syncTravelLayer();else if(!outward)v.restoreCameraState(finalCamera);
      Object.assign(v.camera,projection);v.camera.updateProjectionMatrix();v.scene.background.copy(native);if(fog){v.scene.fog.color.copy(fog.color);v.scene.fog.near=fog.near;v.scene.fog.far=fog.far;}this.travel=null;
    }
    captureTravelLayer(sourceScene=this.v.scene){
      // Retain a small, static scene graph, not a screenshot. Its separate camera
      // keeps rising during the overlap while the destination is also rendered.
      this.travelMaterialCache??=new WeakMap();
      const v=this.v,materials=new Map(),scene=new T.Scene(),cloneMaterial=source=>{
        if(!materials.has(source)){
          let cached=this.travelMaterialCache.get(source),m=cached?.material;
          if(m){const uniforms=m.isShaderMaterial?m.uniforms:null;m.copy(source);if(uniforms){for(const key of Object.keys(uniforms))if(!(key in m.uniforms))delete uniforms[key];for(const [key,value]of Object.entries(m.uniforms))uniforms[key]=Object.assign(uniforms[key]||{},value);m.uniforms=uniforms;}if(cached.version!==source.version||cached.hook!==source.onBeforeCompile||cached.key!==source.customProgramCacheKey)m.needsUpdate=true;}
          else{m=source.clone();cached={material:m};this.travelMaterialCache.set(source,cached);const dispose=()=>{m.dispose();this.travelMaterialCache.delete(source);source.removeEventListener('dispose',dispose);};source.addEventListener('dispose',dispose);}
          Object.assign(cached,{version:source.version,hook:source.onBeforeCompile,key:source.customProgramCacheKey});m.onBeforeCompile=source.onBeforeCompile;m.customProgramCacheKey=source.customProgramCacheKey;materials.set(source,m);
        }
        return materials.get(source);
      };
      const cloneNode=source=>{
        if(!source.visible||source.isCamera)return null;let node;
        if(source.isHemisphereLight)node=new T.HemisphereLight(source.color,source.groundColor,source.intensity);
        else if(source.isAmbientLight)node=new T.AmbientLight(source.color,source.intensity);
        else if(source.isDirectionalLight){node=new T.DirectionalLight(source.color,source.intensity);node.target.position.copy(source.target.getWorldPosition(new T.Vector3()));scene.add(node.target);}
        else if(source.isLight)return null;
        else if(source.material){const material=Array.isArray(source.material)?source.material.map(cloneMaterial):cloneMaterial(source.material);
          if(source.isInstancedMesh){node=new T.InstancedMesh(source.geometry,material,source.count);node.instanceMatrix=source.instanceMatrix.clone();if(source.instanceColor)node.instanceColor=source.instanceColor.clone();}
          else if(source.isSkinnedMesh)return null;
          else if(source.isMesh)node=new T.Mesh(source.geometry,material);
          else if(source.isPoints)node=new T.Points(source.geometry,material);
          else if(source.isLineSegments)node=new T.LineSegments(source.geometry,material);
          else if(source.isLine)node=new T.Line(source.geometry,material);
          else return null;
        }else node=new T.Group();
        node.position.copy(source.position);node.quaternion.copy(source.quaternion);node.scale.copy(source.scale);node.renderOrder=source.renderOrder;node.frustumCulled=false;
        for(const child of source.children){const copy=cloneNode(child);if(copy)node.add(copy);}return node;
      };
      for(const child of sourceScene.children){const copy=cloneNode(child);if(copy)scene.add(copy);}scene.background=sourceScene.background.clone();scene.fog=sourceScene.fog?.clone()||null;scene.environment=sourceScene.environment;
      const pose=this.travelPose();if(this.b.continuous.active){pose.position.y+=this.b.world.position.y;pose.target.y+=this.b.world.position.y;}const camera=new T.PerspectiveCamera(v.camera.fov,v.camera.aspect,.05,5000);camera.position.copy(pose.position);camera.up.copy(v.camera.up);camera.lookAt(pose.target);
      const size=v.renderer.getDrawingBufferSize(new T.Vector2()),target=new T.WebGLRenderTarget(size.x,size.y);target.texture.encoding=T.sRGBEncoding;
      const material=new T.ShaderMaterial({uniforms:{image:{value:target.texture},alpha:{value:1}},vertexShader:'varying vec2 uvOut;void main(){uvOut=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D image;uniform float alpha;varying vec2 uvOut;void main(){gl_FragColor=vec4(texture2D(image,uvOut).rgb,alpha);}',transparent:true,depthTest:false,depthWrite:false,toneMapped:false}),overlay=new T.Scene(),quad=new T.Mesh(new T.PlaneGeometry(2,2),material);overlay.add(quad);
      this.travelLayer={scene,camera,target,material,overlay,quad,materials,pose,exposure:v.renderer.toneMappingExposure};
    }
    warmTravelLayer(){
      const layer=this.travelLayer,renderer=this.v.renderer,target=renderer.getRenderTarget(),autoClear=renderer.autoClear,exposure=renderer.toneMappingExposure,shadowUpdate=renderer.shadowMap.needsUpdate,preview=new T.WebGLRenderTarget(16,16);
      preview.texture.encoding=renderer.outputEncoding;
      try{renderer.autoClear=true;renderer.toneMappingExposure=layer.exposure;renderer.setRenderTarget(layer.target);renderer.clear();renderer.render(layer.scene,layer.camera);renderer.setRenderTarget(preview);renderer.render(layer.overlay,layer.camera);}
      finally{renderer.setRenderTarget(target);renderer.autoClear=autoClear;renderer.toneMappingExposure=exposure;renderer.shadowMap.needsUpdate=shadowUpdate;preview.dispose();}
    }
    syncTravelLayer(){
      const layer=this.travelLayer,v=this.v,pose=this.travelPose();if(this.b.continuous.active){pose.position.y+=this.b.world.position.y;pose.target.y+=this.b.world.position.y;}
      layer.pose=pose;layer.camera.position.copy(pose.position);layer.camera.up.copy(pose.up);layer.camera.fov=v.camera.fov;layer.camera.updateProjectionMatrix();layer.camera.lookAt(pose.target);layer.scene.background.copy(v.scene.background);if(layer.scene.fog){layer.scene.fog.color.copy(v.scene.fog.color);layer.scene.fog.near=v.scene.fog.near;layer.scene.fog.far=v.scene.fog.far;}
    }
    releaseTravelLayer(){const layer=this.travelLayer;if(!layer)return;layer.target.dispose();layer.material.dispose();layer.quad.geometry.dispose();layer.scene.traverse(node=>{if(node.isInstancedMesh)node.dispose?.();});this.travelLayer=null;}
    applyTravel(now){
      const travel=this.travel;if(!travel)return;travel.elapsed+=Math.min(1000/30,Math.max(0,now-travel.last));travel.last=now;const v=this.v,t=Math.min(1,travel.elapsed/travel.duration),u=travel.ground?t*t*(3-2*t):travel.outward?t*t*(2-t):1-(1-t)*(1-t),theme=travel.ground?0:travel.outward?u*.55:.55+u*.45;
      if(travel.ground)this.b.landscapeAppearance.setMix(T.MathUtils.lerp(travel.landscapeStart,this.trip.to==='campus'?1:0,u));
      const position=new T.Vector3().lerpVectors(travel.start,travel.end,u),target=new T.Vector3().lerpVectors(travel.from,travel.to,u);
      if(travel.radial){const r=travel.radial;position.copy(r.earth).addScaledVector(r.axis,T.MathUtils.lerp(135,r.radius,u)).addScaledVector(r.arc,Math.sin(Math.PI*u));}
      if(this.b.continuous.active){position.y+=this.b.world.position.y;target.y+=this.b.world.position.y;}if(v.camera.parent){v.camera.parent.worldToLocal(position);v.camera.parent.worldToLocal(target);}v.camera.position.copy(position);v.controls.target.copy(target);v.camera.up.copy(travel.startUp).lerp(travel.finalCamera.up,u).normalize();v.camera.fov=T.MathUtils.lerp(travel.startFov,travel.endFov,u);v.camera.far=Math.max(travel.projection.far,5000);v.camera.updateProjectionMatrix();v.camera.lookAt(v.controls.target);v.camera.updateMatrixWorld(true);
      travel.scene.background.copy(travel.startColor).lerp(travel.endColor,u);if(travel.scene.fog)travel.scene.fog.color.copy(travel.scene.background);
      const panel=new T.Color(this.trip.from==='station'?'#10151d':'#f7fbfe').lerp(new T.Color(this.trip.to==='station'?'#10151d':'#f7fbfe'),theme),ink=new T.Color(this.trip.from==='station'?'#dce6ef':'#617f98').lerp(new T.Color(this.trip.to==='station'?'#dce6ef':'#617f98'),theme);
      document.body.style.setProperty('--co-transition-panel','#'+panel.getHexString());document.body.style.setProperty('--co-transition-ink','#'+ink.getHexString());document.body.style.setProperty('--co-travel-reveal',String(travel.ground?1:travel.outward?1-u:Math.max(0,(u-.65)/.35)));
      this.stationArrivalReveal=!travel.outward&&this.trip.to==='station'?T.MathUtils.smoothstep(u,.4,.85):1;
      if(this.travelLayer&&!travel.outward){const layer=this.travelLayer;layer.material.uniforms.alpha.value=1-T.MathUtils.smoothstep(t,0,.65);layer.camera.position.copy(layer.pose.position);if(this.trip.to==='station')layer.camera.position.y+=100*u;else layer.camera.position.lerp(layer.pose.target,Math.min(.52,u*.52));layer.camera.lookAt(layer.pose.target);}
      travel.done=t===1;
    }
    renderTravel(now){
      if(this.trip?.preparing&&!this.travel)return;
      const v=this.v,update=v.controls.update,renderer=v.renderer,autoClear=renderer.autoClear,exposure=renderer.toneMappingExposure;v.controls.update=()=>{};
      try{
        this.applyTravel(now);
        if(this.environment==='station')this.stationExperience.update(0,now);
        else if(this.b.phase==='interior'&&!this.b.floorFocus?.interior)v.pipeline.render();
        else{this.b.backgroundMode=v.pipeline.quality!=='balanced';this.b.renderBuilding();}
        const layer=this.travelLayer;if(layer&&this.travel&&!this.travel.outward&&layer.material.uniforms.alpha.value>0){renderer.toneMappingExposure=layer.exposure;renderer.setRenderTarget(layer.target);renderer.clear();renderer.render(layer.scene,layer.camera);renderer.setRenderTarget(null);renderer.autoClear=false;renderer.render(layer.overlay,layer.camera);}
        if(this.travel?.done&&!this.travel.resolved){this.travel.resolved=true;this.travel.resolve();}
      }catch(error){if(this.travel&&!this.travel.resolved){this.travel.resolved=true;this.travel.reject(error);}else console.error(error);}
      finally{v.controls.update=update;renderer.setRenderTarget(null);renderer.autoClear=autoClear;renderer.toneMappingExposure=exposure;}
    }
    key(){return this.environment==='office'?'office-'+this.b.selected:this.environment==='station'?'station-'+this.stationExperience.selected:this.environment;}
    updateOfficeWorld(world,floor){
      const model=this.b.society.model(floor),colliders=[...model.layoutItems,...model.shellItems].filter(b=>!b.ignore&&b.y+b.h/2>.28&&b.y-b.h/2<1.8);
      for(const x of [-14.4,14.4])colliders.push({x,z:0,w:5.8,d:7,h:4,y:2,rotation:0});
      const dropoffPoints=model.features.filter(f=>['print','coffee','reception','chat'].includes(f.kind)),serviceDoors=new Set();
      // A wide robot can serve a pantry at its actual doorway without entering
      // a narrow room. Keep the equipment destinations ahead of these fallbacks.
      for(const feature of [...dropoffPoints]){
        const room=model.rooms?.find(r=>r.id===feature.id||r.id===feature.room),door=room&&model.doors?.find(d=>d.id===room.id&&!d.external&&!d.fire&&d.open!==false);
        if(!door||serviceDoors.has(door.id))continue;serviceDoors.add(door.id);
        dropoffPoints.push({id:door.id+'-robot-handoff',kind:feature.kind,name:(door.name||feature.name)+'门口交接点',x:door.x,z:door.z,serviceFallback:true,serviceDoorId:door.id,sourceServiceId:feature.id,sourcePoint:{x:feature.x,z:feature.z}});
      }
      Object.assign(world,{sourceModel:model,bounds:model.bounds,colliders,spawn:{x:0,z:floor===1?8:4},pickup:{x:5.5,z:3.5},requestPerson:(p,point,options)=>this.b.society.requestRobotCooperation(p.source.id,point,options),releasePerson:(p,token)=>this.b.society.releaseRobotCooperation(p.source.id,token),pickupPoints:model.features.filter(f=>['print','coffee','reception'].includes(f.kind)),dropoffPoints,taskPoints:model.goals.filter(g=>!g.transfer&&!/卫生间|茶水间/.test(g.name)),getPeople:()=>this.b.society.agents.filter(a=>a.location==='floor'&&Math.round(a.floor)===floor&&!a.isPlayer&&a.health==='healthy').map(a=>this.b.society.renderAgent(a))});
    }
    currentContext(create=true){
      if(this.environment==='station'&&!create&&this.stationExperience?.phase!=='interior')return null;
      const key=this.key();if(this.contexts.has(key)){
        const ctx=this.contexts.get(key);
        if(this.environment==='office'&&!this.b.matrixLab?.active&&!this.b.matrixLab?.busy&&ctx.world.sourceModel!==this.b.society.model(this.b.selected)){
          this.updateOfficeWorld(ctx.world,this.b.selected);
          const customization=this.chat?.commands.customization;
          if(!customization?.refreshContext(ctx)){ctx.world.grid=C.makeNavigation(ctx.world);ctx.sim.invalidateNavigation(ctx.world.grid,{relocate:true});}
        }
        return ctx;
      }if(!create)return null;
      let world;
      if(this.environment==='station')world=this.stationExperience.room;
      else{
        const root=new T.Group();root.name=key;this.v.scene.add(root);
        if(this.environment==='campus'){
          const nav=this.b.society.exterior.navigation();
          // Use the original exterior navigation but constrain partners to real promenade surfaces.
          const grid=new L.Grid({minX:-64,maxX:64,minZ:-51,maxZ:51},.5);
          for(let i=0;i<grid.size;i++){const p=grid.point(i),n=nav.index(p.x,p.z),dock=[-7,-5,5,7].some(x=>Math.abs(p.x-x)<.8&&Math.abs(p.z-34)<.45);if(n<0||nav.blocked(n)||dock||this.b.society.exterior.ground(p.x,p.z)<-.01)grid.solid[i]=1;}grid.finalize();
          world={root,zones:new T.Group(),bounds:{minX:-64,maxX:64,minZ:-51,maxZ:51},grid,spawn:{x:0,z:38},pickup:{x:0,z:29},taskPoints:[{x:0,z:30},{x:44,z:30},{x:-44,z:30}],getPeople:()=>this.b.society.agents.filter(a=>L.isOutdoorAgent(a)&&!a.isPlayer).map(a=>this.b.society.renderAgent(a))};
        }else{
          world={root,zones:new T.Group()};this.updateOfficeWorld(world,this.b.selected);
        }
      }
      world.displayName=this.locationName();const ctx={key,world,sim:new C.Simulation(world)};ctx.sim.group.userData.noAO=true;ctx.sim.routes.userData.noAO=true;ctx.sim.onEvent=event=>this.chat?.event(event);this.contexts.set(key,ctx);return ctx;
    }
    async addRobot(spec){
      const key=this.key();await C.prepareRobot(spec);if(key!==this.key())throw Error('场景已改变，请在当前场景重新放置。');
      const ctx=this.currentContext(),r=ctx.sim.addRobot({...spec,name:spec.name||'协作机器人'});this.selected=r.id;this.v.pipeline._aoExcluded=null;this.v.shadowDirty=true;this.refreshUI();
      if(this.environment==='office'&&this.b.phase!=='interior')await this.b.enterFloor(this.b.selected);
      this.toast(`${r.name} 已加入${this.locationName()}`);return r;
    }
    locationName(){return this.environment==='office'?`${this.b.selected}F 办公楼`:this.environment==='campus'?'楼外园区':('空间站 · '+C.stationModule(this.stationExperience.selected).name);}
    focusRobot(r){
      if(this.environment==='office'&&this.b.phase!=='interior'){this.b.enterFloor(this.b.selected).then(()=>this.focusRobot(r));return;}
      if(this.environment==='office')this.originalSetView('detail');else this.externalCamera('detail',false);
      const target=r.model.getWorldPosition(new T.Vector3());target.y+=.8;if(this.v.floorOrigin)target.sub(this.v.floorOrigin);this.v.controls.target.copy(target);this.v.camera.position.copy(target).add(new T.Vector3(4,3,5));this.v.controls.update();
    }
    saveOffice(){
      this.office={phase:this.b.phase,selected:this.b.selected,exploded:this.b.exploded,mix:this.b.mix,drawerFloor:this.b.drawerFloor,drawers:this.b.plates.map(p=>p.drawer),camera:this.v.captureCameraState(),running:this.app.running,societyRunning:this.b.society.running};
      this.office.focusOverview=this.b.floorFocus?.active?{...this.b.floorFocus.overview,position:this.b.floorFocus.overview.position.clone(),target:this.b.floorFocus.overview.target.clone()}:null;
      this.office.projection={near:this.v.camera.near,far:this.v.camera.far,fov:this.v.camera.fov};this.office.limits={minDistance:this.v.controls.minDistance,maxDistance:this.v.controls.maxDistance};
      if(document.pointerLockElement)document.exitPointerLock();this.officeModel=this.app.model;
      const v=this.v,c=v.sun.shadow.camera;
      this.office.lighting={sun:v.sun.position.clone(),target:v.sun.target.position.clone(),shadow:{left:c.left,right:c.right,top:c.top,bottom:c.bottom,near:c.near,far:c.far},fog:v.scene.fog.clone(),background:v.scene.background.clone()};
    }
    async switchEnvironment(id){
      if(this.b.phase==='intro')return;
      if(this.chat?.commands.busy||this.app.busy||this.b.matrixLab?.busy){this.toast('正在应用场景操作，请稍候再切换。');return;}
      if(this.switching||id===this.environment)return;this.studio?.close();L.robotLibrary?.close();this.b.floorFocus?.endInteriorZoom();this.dismissTravelFailure();this.chat?.close(false);this.robotInteraction?.cancel();this.following=false;this.switching=true;this.trip={from:this.environment,to:id,ground:this.environment!=='station'&&id!=='station',source:this.travelPose(),reduced:this.reducedSceneMotion(),preparing:id==='station'};document.body.dataset.coTravel=id;document.body.dataset.coTravelPhase='loading';this.syncSceneNav();this.setTravelStatus('正在进入'+({office:'办公楼',campus:'楼外园区',station:'空间站'}[id])+'…');$('co-scene-transition').classList.add('active');
      try{
        if(this.b.matrixLab?.active)await this.b.matrixLab.stop();
        if(id==='station'&&(!this.stationExperience?.prepared||!this.stationExperience.travelWarmed)){this.startTravelLoading();await this.paintTravelFeedback();this.stationExperience??=new C.StationExperience(this);await this.stationExperience.prepare((progress,text)=>this.updateTravelLoading(progress,text));this.updateTravelLoading(.94,'正在准备空间站光影，即将开始升空。');await this.paintTravelFeedback();this.stationExperience.warmTravel();this.updateTravelLoading(.98,'空间站已准备好，正在连接观察视角。');await this.paintTravelFeedback();}
        const previous=this.environment;if(previous==='office')this.saveOffice();
        if(!this.trip.ground)await this.travelCamera(true);
        this.trip.preparing=true;if(previous==='office'&&this.b.continuous.active)this.b.continuous.leave();if(previous==='station'){this.stationExperience.deactivate();this.station.root.visible=false;this.v.model=this.officeModel;this.v.grid=this.app.grid;this.v.bounds=this.officeModel.bounds;}
        if(this.v.view==='walk'){this.v.firstPerson.viewChanged('perspective');this.v.walkKeys.clear();}
        this.environment=id;document.body.dataset.coEnvironment=id;this.selected=null;this.following=false;
        if(!this.trip.ground&&id!=='station')this.b.landscapeAppearance.setMix(id==='campus'?1:0);
        for(const ctx of this.contexts.values())ctx.world.root.visible=false;
        if(id==='office'){
          this.b.selected=this.office.selected;this.b.exploded=this.office.exploded;this.b.mix=this.office.mix;this.b.drawerFloor=this.office.drawerFloor;
          this.b.plates.forEach((p,i)=>{p.drawer=this.office.drawers[i];p.group.position.set(46*p.drawer,i*(3.6+5.4*this.b.mix),10*p.drawer);});this.b.updateTowerBatches(true);this.b.syncExplode();
          if(this.office.phase==='interior')await this.originalEnterFloor(this.office.selected);else this.originalSetPhase(this.office.phase,false);
          const light=this.office.lighting;this.v.sun.position.copy(light.sun);this.v.sun.target.position.copy(light.target);Object.assign(this.v.sun.shadow.camera,light.shadow);this.v.sun.shadow.camera.updateProjectionMatrix();this.v.scene.fog=light.fog.clone();this.v.scene.background.copy(light.background);
          if(this.office.phase==='interior'&&!this.office.focusOverview)this.originalSetView(this.office.camera.view);Object.assign(this.v.camera,this.office.projection);this.v.camera.updateProjectionMatrix();Object.assign(this.v.controls,this.office.limits);this.v.restoreCameraState(this.office.camera);
          if(this.office.focusOverview){const focus=this.b.floorFocus;focus.overview=this.office.focusOverview;this.b.cameraTween=null;this.v.restoreCameraState(this.office.camera);focus.blend.start-=1250;focus.update(performance.now());}
          if(this.v.view==='walk'){const fp=this.v.firstPerson;fp.feet=this.v.camera.position.y-1.65;const p=this.b.continuous.player;if(p){p.x=this.v.camera.position.x;p.z=this.v.camera.position.z;}}
          this.app.play(this.office.running);this.b.society.running=this.office.societyRunning;$('co-environment-ui').hidden=true;
        }else{
          this.v.model=this.officeModel;this.originalSetPhase('overview',false);this.app.play(false);this.b.society.running=false;this.b.exploded=false;this.b.mix=0;this.b.drawerFloor=null;this.b.plates.forEach((p,i)=>{p.drawer=0;p.group.position.set(0,i*3.6,0);p.tag.visible=false;});this.b.updateTowerBatches(true);this.b.crown.visible=true;this.b.selection.visible=false;this.b.drawerGuide.visible=false;this.b.cameraTween=null;this.b.world.position.y=0;
          if(id==='campus'){
            this.b.world.visible=true;this.addCampusAmenities();this.currentContext();this.v.scene.fog.near=200;this.v.scene.fog.far=600;
          }else{
            this.b.world.visible=false;
            this.stationExperience.activate();this.station={root:this.stationExperience.root};

          }
          $('co-environment-ui').hidden=false;$('co-env-code').textContent=id==='campus'?'SPATIAL SIMULATION / CAMPUS':'SPATIAL SIMULATION / ORBITAL STATION';$('co-env-title').textContent=id==='campus'?'园区里的协作日常。':'轨道上的共同日常。';$('co-env-description').textContent=id==='campus'?'沿原园区步道，观察递送、巡检与人机同行。':'实验舱、生活舱与补给区，共享一套协作空间。';if(id==='campus')this.externalCamera('perspective');
        }
        // Discard the previous world's depth map when the same renderer changes scene.
        if(!this.trip.ground&&this.v.sun.shadow.map){this.v.sun.shadow.map.dispose();this.v.sun.shadow.map=null;}
        this.chat?.add('已进入'+this.locationName()+'。');this.lastFrame=performance.now();this.v.pipeline._aoExcluded=null;this.v.shadowDirty=true;this.v.nextShadow=0;this.v.renderer.shadowMap.needsUpdate=true;this.refreshUI();
        const url=new URL(location.href);if(id==='office')url.searchParams.delete('scene');else url.searchParams.set('scene',id);history.replaceState(null,'',url);this.syncSceneNav();await this.travelCamera(false);
      }catch(error){const travel=this.travel;if(travel){Object.assign(this.v.camera,travel.projection);this.v.camera.updateProjectionMatrix();this.v.restoreCameraState(travel.finalCamera);travel.scene.background.copy(travel.native);if(travel.fog)travel.scene.fog=travel.fog;}console.error(error);if(id==='station'&&this.environment===this.trip.from&&!travel)this.showTravelFailure(error,id);else this.toast('场景切换失败：'+error.message);}
      finally{this.stopTravelLoading();this.travel=null;this.releaseTravelLayer();this.b.landscapeAppearance.setMix(this.environment==='campus'?1:0);this.stationArrivalReveal=1;this.chat?.markers.update();this.switching=false;this.syncSceneNav();if(!this.travelFailure){$('co-scene-transition').classList.remove('active');this.setTravelStatus('');delete document.body.dataset.coTravel;delete document.body.dataset.coTravelPhase;}for(const property of ['--co-transition-panel','--co-transition-ink','--co-travel-reveal'])document.body.style.removeProperty(property);this.lastFrame=performance.now();this.b.lastUpdate=this.lastFrame;}
    }
    addCampusAmenities(){
      if(this.campusAmenities)return;const group=new T.Group();group.name='原园区机器人补给设施';this.b.world.add(group);this.campusAmenities=group;
      const white=this.b.materials.white,blue=this.b.materials.blue,dark=this.b.materials.dark;
      // Add only small docks alongside the original promenade; never rebuild the site.
      for(const x of [-7,-5,5,7]){C.part(group,'box',white,[1.1,.48,.38],[x,.34,34]);C.part(group,'box',blue,[.75,.06,.40],[x,.60,34]);C.part(group,'box',dark,[.32,.10,.02],[x,.42,34.20]);}
    }
    externalCamera(mode,animate=true){
      if(this.environment==='office')return this.originalSetView(mode);
      if(this.environment==='station')return this.stationExperience.cameraMode(mode,animate);
      this.following=false;this.v.view=mode==='detail'?'perspective':mode;this.v.firstPerson?.viewChanged(this.v.view);this.v.camera.near=.04;this.v.camera.far=1600;this.v.camera.fov=mode==='walk'?65:40;this.v.camera.up.set(0,1,0);this.v.camera.updateProjectionMatrix();this.v.controls.enabled=mode!=='walk';this.v.controls.enableRotate=mode!=='top';this.v.controls.minDistance=1;this.v.controls.maxDistance=500;
      if(mode==='walk'){
        const ctx=this.currentContext(),start=ctx.sim.grid.nearest(ctx.world.spawn,.25),p=ctx.sim.grid.point(start),ground=this.environment==='campus'?this.b.society.exterior.ground(p.x,p.z):0;this.v.firstPerson.feet=ground;this.v.camera.position.set(p.x,ground+1.65,p.z);this.v.walkYaw=Math.PI;this.v.walkPitch=0;this.v.walkKeys.clear();this.v.firstPerson.look();
      }else{
        const campus=this.environment==='campus',target=new T.Vector3(0,campus?3:1,campus?16:0),position=mode==='top'?new T.Vector3(0,campus?105:68,campus?16:.01):mode==='detail'?new T.Vector3(22,18,42):campus?new T.Vector3(58,38,65):new T.Vector3(39,35,44);
        if(campus&&mode==='perspective'&&this.v.camera.aspect<.8){position.set(45,42,78);target.set(0,2,25);this.v.camera.fov=48;this.v.camera.updateProjectionMatrix();}
        else position.sub(target).multiplyScalar(Math.max(1,1.3/this.v.camera.aspect)).add(target);
        this.v.camera.position.copy(position);this.v.controls.target.copy(target);this.v.controls.update();
      }
      document.querySelectorAll('[data-co-camera]').forEach(b=>b.classList.toggle('active',b.dataset.coCamera===mode));this.v.shadowDirty=true;
    }
    updateExternalWalk(dt){
      const v=this.v,fp=v.firstPerson,ctx=this.currentContext(),input=fp.prepare(dt),p=v.camera.position,n=Math.max(1,Math.ceil(fp.speed*dt/.04));
      for(let i=0;i<n;i++){const x=p.x+fp.velocity.x*dt/n,z=p.z+fp.velocity.y*dt/n;if(ctx.sim.grid.isClear(x,z,.25)){p.x=x;p.z=z;}else if(ctx.sim.grid.isClear(x,p.z,.25))p.x=x;else if(ctx.sim.grid.isClear(p.x,z,.25))p.z=z;}
      const ground=this.environment==='campus'?this.b.society.exterior.ground(p.x,p.z):0;fp.vertical(dt,ground);fp.animate(dt,input);p.y=fp.feet+1.65+fp.bob-fp.landing;fp.look();
    }
    refreshUI(){
      this.refreshRobotLibrary();
      const ctx=this.currentContext(false),s=ctx?.sim;$('co-location').textContent='当前：'+this.locationName()+(this.environment==='station'?' · 选择空间站机器人后，点击舱内空闲位置悬浮放置。':' · 选择机器人后，点击空闲地面放置。');document.querySelectorAll('[data-co-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.coScene===this.environment)));$('co-robot-count').textContent=s?.robots.length||0;$('co-completed').textContent=s?.completed||0;$('co-yields').textContent=s?.yields||0;
      $('co-env-robots-count').textContent=s?.robots.length||0;$('co-env-completed-count').textContent=s?.completed||0;$('co-env-yields-count').textContent=s?.yields||0;
      $('co-show-routes').checked=s?.routes.visible??true;
      const robots=s?.robots||[],list=$('co-robot-list'),roster=ctx?.key+':'+robots.map(r=>r.id).join(',');
      // Preserve focused buttons and the scroll position while statuses change.
      if(this.roster!==roster){this.roster=roster;list.innerHTML=robots.map(r=>`<div class="co-robot-item"><div><b>${escape(r.name)}</b><small></small><select data-co-task data-id="${r.id}" aria-label="${escape(r.name)}的任务">${Object.entries(C.robotTaskNames).map(([task,label])=>`<option value="${task}">${label}</option>`).join('')}</select></div><button data-id="${r.id}" data-action="cancel">取消</button><button data-id="${r.id}" data-action="retry">重试</button><button data-id="${r.id}" data-action="follow">观察</button><button data-id="${r.id}" data-action="remove">移出</button></div>`).join('');}
      robots.forEach((r,i)=>{const row=list.children[i],text=row.querySelector('small'),progress=r.mission?.steps.length>1?r.mission.steps.map((step,j)=>(j<r.mission.index||r.state==='complete'?'✓ ':j===r.mission.index?'→ ':'○ ')+C.robotTaskNames[step]).join(' / ')+' · ':'';const description=(r.spec.taskText?'任务：'+r.spec.taskText+' · ':'')+progress+r.status;const display=L.brandNeutralText?.(description)??description;if(text.textContent!==display)text.textContent=display;const task=row.querySelector('select');if(task.value!==r.task)task.value=r.task;row.querySelector('[data-action="cancel"]').disabled=['complete','partial','deposited','attention','cancelled'].includes(r.state);});
      const events=(s?.events||[]).slice(0,4).map(e=>`<div>${escape(e.text)}</div>`).join('');if(this.eventMarkup!==events){this.eventMarkup=events;$('co-events').innerHTML=events;}if(this.environment!=='office')$('co-env-status').textContent=this.v.view==='walk'?'点击画面进入漫步 · WASD 移动 · Esc 释放鼠标':this.v.view==='top'?'右键拖动平移 · 滚轮缩放 · 点击机器人观察':'拖动旋转 · 滚轮缩放 · 点击机器人观察';
    }
    export(){const ctx=this.currentContext(false);if(!ctx){this.toast('当前尚未放置机器人。');return;}const report=ctx.sim.report();report.scene=this.key();report.sceneName=this.locationName();const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='人机协同观察-'+this.key()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    render(){
      const now=performance.now(),dt=Math.min(.1,(now-this.lastFrame)/1000);this.lastFrame=now;this.chat?.markers.update();L.eventIntegration?.update(dt,now);
      // Every transition frame is drawn. Camera movement must never run behind a frozen canvas.
      if(this.switching){this.renderTravel(now);return;}
      if(this.studio.isOpen()){this.studio.render(now);return;}
      if(this.environment==='station'&&!this.switching){this.stationExperience.update(dt,now);L.robotLibrary?.render();this.robotInteraction?.update();if(now-this.lastUI>500){this.lastUI=now;this.refreshUI();}return;}
      if(this.environment!=='office'&&!this.switching){
        if(this.environment==='campus'){if(this.externalRunning&&!document.hidden)this.b.society.advance(dt*this.rate);this.b.siteCrowd.update(0);this.b.updateSocietyVisuals(now,{people:false});}
        if(this.v.view==='walk')this.updateExternalWalk(dt);else this.v.controls.update();
      }
      const current=this.currentContext(false);
      for(const [key,ctx]of this.contexts){
        const floor=key.startsWith('office-')?Number(key.slice(7)):null;
        const visible=this.environment==='office'?(floor&&(this.b.phase!=='interior'||floor===this.b.selected)):key===this.environment;
        ctx.world.root.visible=!!visible;if(!visible)continue;
        if(floor){if(this.b.phase==='interior'){if(this.v.floorOrigin)ctx.world.root.position.copy(this.v.floorOrigin);else ctx.world.root.position.set(0,this.b.continuous.active?(floor-this.b.continuous.origin)*3.6:0,0);}else{const p=this.b.plates[floor-1];ctx.world.root.position.copy(p.group.position);ctx.world.root.position.y+=.82;}}
        if(ctx===current&&!this.switching&&!document.hidden){const running=this.environment==='office'?(this.b.phase==='interior'?this.app.running:this.b.society.running):this.externalRunning;if(running)ctx.sim.tick(dt*(this.environment==='office'?this.b.society.speed*(this.b.phase==='interior'?this.app.rate:1):this.rate));}
        if(key==='campus')for(const r of ctx.sim.robots)r.model.position.y=this.b.society.exterior.ground(r.x,r.z);
        if(key==='station'&&this.station.crowd){const source=this.b.society.agents.filter(a=>a.role==='employee');this.station.crowd.update(ctx.sim.people.map((p,i)=>({...source[i%source.length],id:30000+i,x:p.x,z:p.z,angle:p.model.rotation.y,baseY:0,floor:1,location:'floor',pose:'stand',sitBlend:0,transition:null,state:p.moving?'moving':'waiting',vx:p.moving?.6:0,vz:0,gaitPhase:p.phase,gaitDistance:p.phase/5.8,health:'healthy',gesture:p.assigned?'talk':'idle',seatId:null})),ctx.sim.time);}
      }
      if(this.following&&current){const r=current.sim.robots.find(r=>r.id===this.selected);if(r){const target=r.model.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.8,0));if(this.v.floorOrigin)target.sub(this.v.floorOrigin);const delta=target.clone().sub(this.v.controls.target);this.v.camera.position.add(delta);this.v.controls.target.copy(target);}}
      if(this.environment==='office')this.originalRender();
      else if(!this.switching){this.v.renderer.shadowMap.needsUpdate=this.v.shadowDirty;this.v.shadowDirty=false;if(this.environment==='campus'){
        const update=this.v.controls.update;if(this.v.view==='walk')this.v.controls.update=()=>{};
        try{L.eventIntegration?.presentFrame();this.b.renderBuilding();}finally{this.v.controls.update=update;}
      }else this.v.pipeline.render();}
      this.robotInteraction?.update();this.studio?.render(now);
      if(now-this.lastUI>500){this.lastUI=now;this.refreshUI();if(current?.sim.robots.length)this.v.shadowDirty=true;}
    }
  }
  function boot(){
    if(!L.building?.matrixLab||!C.OriginalRobotStudio||!C.ObservationChat||!C.SceneMarkers||!C.SceneCommands||!C.RobotInteraction||!C.StationExperience||!L.characterAssets){setTimeout(boot,100);return;}
    const owner=L.collaboration=new OriginalCollaboration(L.building),startup=L.stationStartup={progress:0,text:'正在准备空间站',ready:false,error:null};
    // Build the station alongside office downloads, but keep the office scene,
    // intro camera and its lighting warm-up in charge of the shared renderer.
    startup.promise=(async()=>{
      await owner.paintTravelFeedback();const station=owner.stationExperience=new C.StationExperience(owner);
      await station.prepare((progress,text)=>{startup.progress=Math.max(startup.progress,progress);startup.text=text;});
      while(!L.building.floorFocus.lightingWarmed)await new Promise(resolve=>setTimeout(resolve,50));
      startup.progress=.94;startup.text='正在准备空间站光影';await owner.paintTravelFeedback();station.warmTravel();
      // Keep compiled overlap materials for the first scene switch as well as
      // later returns. Only the temporary scene graphs and targets are released.
      startup.progress=.97;startup.text='正在准备办公楼与空间站的切换动画';
      for(const scene of [owner.v.scene,station.scene]){await owner.paintTravelFeedback();try{owner.captureTravelLayer(scene);owner.warmTravelLayer();}finally{owner.releaseTravelLayer();}}
      startup.progress=1;startup.text='空间站已准备就绪';startup.ready=true;
    })().catch(error=>{startup.error=error?.message||'空间站准备失败，请重新载入。';startup.text=startup.error;console.warn('Station startup:',error);});
    const scene=new URLSearchParams(location.search).get('scene');if(scene==='station'||scene==='campus'){const enter=()=>{if(document.body.dataset.buildingReady!=='true'){setTimeout(enter,100);return;}L.building.setPhase('overview',false);owner.switchEnvironment(scene);};enter();}
  }
  boot();
})();
