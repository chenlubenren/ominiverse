/* Reversible, deterministic story rehearsals. Daily crew records remain in their cabins. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,L=window.IndoorLab,clamp=T.MathUtils.clamp;
  const layouts={open:{name:'开放布局',width:6.8,opening:0},partitioned:{name:'隔断布局',width:6.8,opening:1.8},narrow:{name:'狭窄布局',width:4.6,opening:1.12}};
  const robots={science:{name:'科研探测球',radius:.32,speed:.85,color:'#86cfce',ability:'光谱辨识 / 翻译'},medical:{name:'医疗伴飞器',radius:.43,speed:.70,color:'#9cc8ee',ability:'生命监测 / 防护'},cargo:{name:'物资作业艇',radius:.69,speed:.55,color:'#e3b278',ability:'密封补给 / 舱壁封堵'}};
  const variants={contact:'谨慎接触',isolate:'原地隔离',rescue:'紧急救援'};
  const stories={
    visitor:{title:'第六位乘客',module:'tianzhou',color:'#92e4c0',intro:'名单上只有五人，货舱却传来第六个生命信号。',decision:'它敲了三下。先建立交流，封闭隔断，还是冲进去救人？',action:'船员分头控制舱门，机器人先让出撤离通道，再靠近异常。',effect:'alien'},
    infection:{title:'请别把我关起来',module:'wentian',color:'#cda6e9',intro:'江月的体温正在上升，样本柜里的一只培养皿空了。',decision:'她请求开门。先诊断、隔离接触区，还是立即接走她？',action:'机器人接近患者，另一名船员在隔断旁准备处置。',effect:'infection'},
    leak:{title:'两边都在求救',module:'tianhe',color:'#8bd4ef',intro:'货舱压力骤降。裂缝旁有人，另一侧的空气也在流失。',decision:'确认漏点、分区隔离，还是优先把船员送到安全侧？',action:'气流正在扩大，机器人向破损设备移动。',effect:'leak'},
    spoof:{title:'谁在替你下命令',module:'tianhe',color:'#e7b67e',intro:'控制屏要求打开外舱门，但指挥员说她从未下令。',decision:'核验指令、隔离可疑控制器，还是接管救援通道？',action:'机器人接入终端，船员抵达人工确认开关。',effect:'spoof'},
    storm:{title:'它还在外面',module:'airlock',color:'#f0b383',intro:'太阳风暴即将抵达，一台取样设备仍滞留在外侧。',decision:'先读取状态、封闭防护门，还是立即回收它？',action:'干扰让通讯闪烁，机器人向气闸侧的回收点前进。',effect:'storm'},
    evacuation:{title:'最后一扇门',module:'shenzhou',color:'#c4c0ef',intro:'撤离倒计时开始。返回舱只剩一条可通行的通道。',decision:'先检查门锁、封闭危险侧，还是立即组织通行？',action:'船员让出主通道，机器人前往返回舱门。',effect:'evacuation'}
  };
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const resources=root=>{const geometry=new Set(),material=new Set(),texture=new Set();root?.traverse(o=>{if(o.geometry)geometry.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){material.add(m);for(const v of Object.values(m))if(v?.isTexture)texture.add(v);}});return{geometry,material,texture};};

  class StationScenarios {
    constructor(station){this.s=station;this.o=station.o;this.active=false;this.serial=0;this.duration=36;this.time=0;this.matrixResults=[];this.makeUI();}
    get blocksObservation(){return this.active&&!this.film?.liveEvent;}
    makeUI(){
      const ui=this.ui=document.createElement('section');ui.className='st-story-ui';ui.hidden=true;ui.setAttribute('aria-label','空间站情景放映');
      ui.innerHTML='<header class="st-story-header"><div><small>ORBITAL STORIES / 情景演练</small><h2 data-story-title></h2><p data-story-design></p></div><div class="st-story-controls"><button data-story-pause>暂停</button><button data-story-replay>重播</button><button data-story-stop>返回日常 ↗</button></div></header><aside class="st-story-matrix" hidden><small>同一策略 · 九种设计</small><div data-story-matrix></div></aside><footer class="st-story-caption"><div class="st-story-stage"><b data-story-stage></b><span data-story-clock></span></div><p data-story-caption aria-live="polite"></p><div class="st-story-progress"><i></i></div><div class="st-story-choices"><button data-story-choice="contact">01 · 谨慎接触</button><button data-story-choice="isolate">02 · 原地隔离</button><button data-story-choice="rescue">03 · 紧急救援</button></div><small data-story-facts></small></footer>';
      document.body.appendChild(ui);this.nodes={};for(const key of ['title','design','stage','clock','caption','facts','matrix'])this.nodes[key]=ui.querySelector('[data-story-'+key+']');
      ui.querySelector('[data-story-stop]').onclick=()=>this.stop();ui.querySelector('[data-story-pause]').onclick=()=>this.paused?this.resume():this.pause();ui.querySelector('[data-story-replay]').onclick=()=>this.play({...this.options,manual:false});
      ui.querySelectorAll('[data-story-choice]').forEach(b=>b.onclick=()=>{try{this.choose(b.dataset.storyChoice);}catch(e){this.o.chat?.add(e.message,'剧情');}});
    }
    crewedModule(preferred){const count=id=>(this.o.contexts?.get('station-'+id)?.sim.people||[]).filter(p=>!p.external&&!p.stationTransfer).length;if(preferred&&count(preferred))return preferred;const best=(C.stationModules||[]).map(m=>m.id).sort((a,b)=>count(b)-count(a))[0];return best&&count(best)?best:(preferred||'tianhe');}
    normalize(options={}){const defaults=C.stationScenarioScripts?.[options.scenario||'visitor']?.defaults||{};const out={scenario:'visitor',variant:'contact',layout:'open',robot:'science',cinematic:false,manual:false,...defaults,...options};for(const [key,table]of Object.entries({scenario:stories,variant:variants,layout:layouts,robot:robots}))if(!table[out[key]])throw Error('未知的剧情设置：'+key);return out;}
    async play(options={}){if(options.scenario==='infection'&&options.film===undefined&&!options.variant&&!options.layout&&!options.robot)options={...options,film:true,matrixFilm:true};this.stop();this.matrix=null;this.matrixResults=[];if(options.scenario==='infection'&&options.film!==false&&!options.layout&&!options.robot&&(!options.variant||['rescue','isolate'].includes(options.variant)))options={...options,film:true,variant:options.variant||'rescue'};return this.start(this.normalize(options));}
    async playMatrix(options={}){
      this.stop();this.matrixResults=[];const normalized=this.normalize(options);this.matrix=Object.keys(layouts).flatMap(layout=>Object.keys(robots).map(robot=>({...normalized,layout,robot})));this.matrixAt=0;this.matrixFinished=false;return this.start(this.matrix[0]);
    }
    async start(options){
      if(options.orbitalEvent){
        const EventClass=C.stationCabinIncidentStories?.[options.orbitalEvent]?C.StationCabinIncidents:C.StationOrbitalEvents;
        // A cabin event without a named cabin goes where crew can react to it.
        if(EventClass===C.StationCabinIncidents&&options.targetAuto)options={...options,targetModule:this.crewedModule(options.targetModule)};
        if(!EventClass)throw Error('空间站事件正在准备，请稍后重试。');
        this.options=options;this.film=new EventClass(this);
        try{const result=await this.film.start(options);if(result===false)return false;if(C.StationEventReactions){this.s.eventReactions??=new C.StationEventReactions(this.s);this.s.eventReactions.sync();}return this.snapshot();}catch(error){this.stop();this.error=error.message;throw error;}
      }
      this.s.shellCabins?.close({focus:false});
      this.s.stopMorphology?.();
      if(options.shortFilm){if(!C.StationShortFilm)throw Error('空间站短片还没有准备好，请稍后重试。');this.options=options;this.film=new (!options.singleFilm&&C.StationShortMatrix?C.StationShortMatrix:C.StationShortFilm)(this);try{return this.film.start(options);}catch(error){this.stop();throw error;}}
      if(options.matrixFilm&&C.StationFilmMatrix){this.options=options;this.film=new C.StationFilmMatrix(this);return this.film.start(options);}
      if(options.film&&!this.matrix&&C.StationFilm){this.options=options;this.film=new C.StationFilm(this);return this.film.start(options);}
      this.duration=36;
      const serial=++this.serial;this.options=options;this.story=stories[options.scenario];this.script=C.stationScenarioScripts?.[options.scenario]||null;this.time=0;this.outcome=null;this.paused=false;this.active=true;this.loading=true;this.error=null;
      this.o.chat?.cancelPick();this.saved={controls:this.s.v.controls.enabled,exposure:this.s.v.renderer.toneMappingExposure};this.s.v.controls.enabled=false;document.body.dataset.stationStory='playing';this.ui.hidden=false;
      try{
        const design=robots[options.robot],spec={role:options.robot,name:design.name,color:design.color,scale:1};
        if(serial!==this.serial)return false;
        this.protected=resources(this.s.scene);this.scene=new T.Scene();this.scene.background=new T.Color('#0b1b2a');this.scene.environment=this.s.scene.environment;
        const cabin={...C.stationModule(this.story.module),width:layouts[options.layout].width,length:10.8,rehearsalCutaway:true,kind:options.scenario==='visitor'?'cargo':options.scenario==='infection'?'biology':'physics',links:['tianhe']};
        this.world=C.buildStationInterior(cabin);this.world.root.visible=true;this.world.roof.visible=false;this.scene.add(this.world.root);this.scene.add(new T.HemisphereLight('#cfe4ff','#425061',.65));const key=new T.DirectionalLight('#fff2dc',1.5);key.position.set(-5,12,9);this.scene.add(key);const fill=new T.DirectionalLight('#80c9df',.65);fill.position.set(5,6,-8);this.scene.add(fill);
        this.owned=new T.Group();this.scene.add(this.owned);this.buildLayout();this.makeGrid();this.camera=new T.PerspectiveCamera(40,1,.05,160);this.setCinemaCamera();if(!options.cinematic){this.storyControls=new T.OrbitControls(this.camera,this.s.v.renderer.domElement);this.storyControls.target.set(0,.8,0);this.storyControls.enableDamping=true;this.storyControls.dampingFactor=.08;this.storyControls.enablePan=false;this.storyControls.minDistance=7;this.storyControls.maxDistance=34;this.storyControls.maxPolarAngle=Math.PI*.48;this.storyControls.update();}
        this.borrowCrew();const model=C.makeOrbitalRobot(spec);this.scene.add(model);this.robot={model,spec,radius:design.radius,speed:design.speed,x:-.45,z:3.15,y:.7,angle:Math.PI,v:0,path:[],travel:0,status:'正在监听异常信号',action:'scan',actionHistory:[],name:design.name};
        // The cargo platform's circumscribed envelope is wider than the narrow hatch.
        this.robot.y=1.65-(model.userData.height||1.4)/2;this.robot.start={x:-.45,z:3.15};this.goal={x:0,z:-2.8};this.plan(this.robot,this.goal);if(options.robot==='cargo')this.planRobotPassage();
        this.facts={routeReachable:this.robot.reachable,routeDistance:this.robot.routeDistance,robotRadius:this.robot.radius,robotArrived:false,robotProgress:0,arrivedAt:null,crewReady:false,isolationClosed:false,exposure:0,actionCompleted:false,openingWidth:layouts[options.layout].opening||null,crewSafeAt:null,doorWaitReason:'',crewDistance:[],crewActions:[],robotStatus:'正在监听异常信号'};
        this.buildEvent();this.script?.setup(this);this.updateRobotRoute();this.labels=C.StationStoryLabels?new C.StationStoryLabels(this):null;this.loading=false;this.syncVisuals(0);this.refreshUI();this.render();return this.snapshot();
      }catch(error){if(serial===this.serial){this.stop();this.error=error.message;}throw error;}
    }
    mesh(shape,color,size,position,opts={}){const geometry=shape==='sphere'?new T.SphereGeometry(1,24,16):shape==='torus'?new T.TorusGeometry(1,.025,8,64):new T.BoxGeometry(1,1,1);const material=C.material(color,opts);const mesh=new T.Mesh(geometry,material);mesh.scale.set(...size);mesh.position.set(...position);this.owned.add(mesh);return mesh;}
    buildLayout(){
      const config=layouts[this.options.layout],W=config.width;this.bulkhead=null;this.isolationAmount=0;
      if(config.opening){
        const w=(W-config.opening)/2;for(const sign of [-1,1]){this.mesh('box',this.options.layout==='narrow'?'#8a9da7':'#bac9d0',[w,2.65,.46],[sign*(config.opening+w)/2,1.325,0],{transparent:true,opacity:.75});this.world.colliders.push({x:sign*(config.opening+w)/2,z:0,w,d:.46,y:1.325,h:2.65});for(const y of [.3,2.4])this.mesh('box','#eeb779',[w,.055,.49],[sign*(config.opening+w)/2,y,0]);}
        this.mesh('box','#668392',[config.opening+.24,.15,.5],[0,2.72,0]);
        if(this.options.layout==='partitioned'){this.bulkhead=this.mesh('box','#789aa9',[config.opening,2.58,.14],[config.opening,1.32,-.02],{transparent:true,opacity:.68});this.bulkhead.userData.openX=config.opening;}
      }
      this.console=this.mesh('box','#315a70',[.2,.5,.4],[-1.4,1.5,1.85]);this.consoleScreen=this.mesh('box','#73e5da',[.025,.23,.3],[-1.28,1.57,1.85],{emissive:'#49b9b2',emissiveIntensity:.8});
      this.world.colliders.push({x:-1.4,z:1.85,w:.2,d:.4,y:1.5,h:.5});
      this.mesh('box','#315a70',[.2,.65,.55],[1.25,1.55,3.65]);this.mesh('box','#72d8d2',[.025,.3,.38],[1.13,1.65,3.65],{emissive:'#49b9b2',emissiveIntensity:.8});this.world.colliders.push({x:1.25,z:3.65,w:.2,d:.55,y:1.55,h:.65});
      this.beacon=this.mesh('sphere',this.story.color,[.09,.09,.09],[0,2.5,-3.6],{emissive:this.story.color,emissiveIntensity:1.5});
      for(const x of [-.38,.38])for(let z=-3;z<3.7;z+=.4)this.mesh('box','#7daec2',[.035,.018,.2],[x,.04,z],{emissive:'#395c72',emissiveIntensity:.5});
    }
    makeGrid(){
      const grid=this.grid=new L.Grid(this.world.bounds,.08);
      for(const b of this.world.colliders){if(b.ignore)continue;const c=Math.cos(b.rotation||0),s=Math.sin(b.rotation||0);for(let i=0;i<grid.size;i++){const p=grid.point(i),x=p.x-b.x,z=p.z-b.z;if(Math.abs(x*c-z*s)<b.w/2+grid.cell*.5&&Math.abs(x*s+z*c)<b.d/2+grid.cell*.5)grid.solid[i]=1;}}
      grid.finalize();this.world.grid=grid;
    }
    borrowCrew(){
      const people=[...this.o.contexts].filter(([k])=>k.startsWith('station-')).flatMap(([,ctx])=>ctx.sim.people);this.stageActors=[];
      const cast=this.script?.castIds?this.script.castIds.map(id=>people.find(p=>p.id===id)).filter(Boolean):people.slice(0,2);
      for(const [i,source]of cast.entries()){
        const model=source.model,saved={parent:model.parent,pose:model.userData.stationPose,nodes:[]};model.traverse(node=>saved.nodes.push({node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone(),visible:node.visible}));
        const actor={source,model,saved,id:source.id,role:i?'现场船员':'值班指挥',x:i?.80:-.80,z:i?-2.8:-1.15,y:.64+i*.08,radius:.28,speed:1.2,angle:i?Math.PI:0,v:0,path:[],travel:0,motionDistance:0,action:'brace',actionLabel:'检查货舱',actionHistory:[],cue:null,arrivalCue:null,queue:[]};C.resetStationStoryCrew?.(model);this.scene.add(model);this.stageActors.push(actor);model.visible=true;this.setAction(actor,'brace',i?'抓住扶手，检查异常':'检查舱门控制');
      }
    }
    setAction(actor,action,label){
      if(actor.action!==action||actor.actionLabel!==label){actor.action=action;actor.actionLabel=label;actor.actionHistory.push({time:+this.time.toFixed(2),action,label});}
    }
    command(actor,key,goal,action,label,speed=1.2,via=[]){
      if(actor.cue===key)return;actor.cue=key;actor.arrivalCue=null;actor.queue=[...via.map(p=>({...p})),{...goal}];actor.speed=speed;this.setAction(actor,action,label);this.plan(actor,actor.queue.shift());
    }
    hold(actor,action,label,angle){this.setAction(actor,action,label);if(Number.isFinite(angle)){const d=Math.atan2(Math.sin(angle-actor.angle),Math.cos(angle-actor.angle));actor.angle+=d*Math.min(1,(this.frameDt||1/60)*3);}}
    crewDirector(dt){
      const t=this.time,[lead,scout]=this.stageActors,v=this.options.variant,f=this.facts;
      if(t<1.15){this.hold(lead,'operate','检查货舱门锁',Math.PI);this.hold(scout,'brace',this.options.scenario==='infection'?'身体不适，抓住扶手':'检查样本货架',Math.PI);return;}
      if(t<1.85)this.hold(lead,'startle','异常突现，抬臂护脸',Math.PI);
      else if(!lead.evacuated){this.command(lead,'evacuate',{x:.8,z:3.65},'retreat','紧急后撤，抢占控制台',1.35,[{x:0,z:.72},{x:.8,z:1.3}]);if(lead.arrivalCue==='evacuate'){lead.evacuated=true;this.hold(lead,'operate','双手操纵紧急控制台',Math.PI/2);}}
      if(t<3.35)this.hold(scout,t<2.25?'startle':'beckon',t<2.25?'受惊蜷身，护住面部':'挥臂呼救，请求撤离',0);
      else if(!scout.evacuated){this.command(scout,'evacuate',{x:.8,z:1.55},'retreat',this.options.scenario==='infection'?'捂住面罩，撤向隔离线':'蹬离货架，穿门撤退',1.25,[{x:0,z:.72}]);if(scout.arrivalCue==='evacuate'){scout.evacuated=true;this.hold(scout,'brace','抓稳扶手，等待指令',Math.PI);}}
      if(lead.evacuated&&scout.evacuated&&f.crewSafeAt===null)f.crewSafeAt=t;
      if(t<12){if(lead.evacuated)this.hold(lead,'operate','接管舱门，等待你的选择',Math.PI/2);if(scout.evacuated)this.hold(scout,'beckon','挥臂示意：未知生命就在门后',Math.PI);}
      else if(lead.evacuated&&scout.evacuated){
        if(v==='isolate'){
          if(t<22){this.hold(lead,'operate','双手拉下隔离手柄',Math.PI/2);this.command(scout,'seal-check',{x:-.8,z:1.85},'rush','冲向应急阀，配合封舱',1.1);if(scout.arrivalCue==='seal-check')this.hold(scout,'operate','压紧应急阀，确认密封',Math.PI);}
          else{this.command(lead,'isolate-shelter',{x:.8,z:4.5},'retreat','离开控制台，撤入防护位',.95);if(lead.arrivalCue==='isolate-shelter')this.hold(lead,'brace','抓住防护扶手',Math.PI);this.command(scout,'isolate-door',{x:.72,z:.93},'rush','靠近舱门，检查隔离状态',.95);if(scout.arrivalCue==='isolate-door')this.hold(scout,'beckon','隔着舱门呼叫另一侧',Math.PI);}
        }else if(v==='rescue'){
          this.command(lead,'rescue-support',{x:.84,z:2.6},'rush','冲到舱门，准备接应',1.25);if(lead.arrivalCue==='rescue-support')this.hold(lead,'assist','伸手接应，呼叫船员返回',Math.PI);
          if(!scout.atRisk){this.command(scout,'rescue-entry',{x:.8,z:-2.05},'rush','再次冲入危险侧，寻找幸存者',1.25,[{x:0,z:-.72}]);if(scout.arrivalCue==='rescue-entry'){scout.atRisk=true;scout.riskAt=t;}}
          else if(t-scout.riskAt<1.2)this.hold(scout,'recoil','信号骤强，急停护脸',Math.PI);
          else if(!scout.rescued){this.command(scout,'rescue-return',{x:.80,z:1.50},'retreat','转身撤退，伸手寻求接应',1.35,[{x:0,z:.72}]);if(scout.arrivalCue==='rescue-return'){scout.rescued=true;f.humanRescuedAt=t;}}
          else{this.hold(scout,'assist','抓住接应扶手，稳定身体',Math.PI/2);if(t>29)this.hold(lead,'relief','确认船员回到安全侧',-Math.PI/2);}
        }else{
          if(t>=17){this.command(lead,'contact-backup',{x:.8,z:4.45},'retreat','后撤让行，继续远程指挥',.95);if(lead.arrivalCue==='contact-backup')this.hold(lead,t>30?'relief':'beckon',t>30?'放下双臂，解除警戒':'挥臂引导机器人向前',Math.PI);}
          else this.hold(lead,'operate','打开通道，授权机器人先行',Math.PI/2);
          if(this.robot.z< -1.0){this.command(scout,'contact-follow',{x:.8,z:-1.55},'rush','跟随机器人，再次穿过舱门',1.05,[{x:0,z:-.72}]);if(scout.arrivalCue==='contact-follow')this.hold(scout,t>30?'relief':'assist',t>30?'放松警戒，与来客保持距离':'伸手示意，协助建立交流',Math.PI);}
          else this.hold(scout,'beckon','侧身让路，示意机器人先行',Math.PI);
        }
      }
      for(const actor of this.stageActors){this.move(actor,dt);if(!actor.path.length){if(actor.queue.length)this.plan(actor,actor.queue.shift());else if(actor.cue)actor.arrivalCue=actor.cue;}}
    }
    advanceActor(actor,dt){
      this.move(actor,dt);
      if(!actor.path.length){
        if(actor.queue?.length)this.plan(actor,actor.queue.shift());
        else if(actor.cue&&actor.reachable&&distance(actor,actor.goal)<.28)actor.arrivalCue=actor.cue;
      }
    }
    robotTask(goal){
      const r=this.robot;this.goal={...goal};this.plan(r,goal);r.v=0;r.blockedBy=null;r.taskTravelStart=r.travel;
      Object.assign(this.facts,{routeReachable:r.reachable,routeDistance:r.routeDistance,robotArrived:false,arrivedAt:null,actionCompleted:false,operationElapsed:0,elapsedToAction:null});
      this.updateRobotRoute();return r.reachable;
    }
    updateRobotRoute(){
      if(!this.pathLine||!this.robot)return;const geometry=new T.BufferGeometry().setFromPoints([new T.Vector3(this.robot.x,.12,this.robot.z),...this.robot.path.map(p=>new T.Vector3(p.x,.12,p.z))]);this.pathLine.geometry.dispose();this.pathLine.geometry=geometry;this.pathLine.computeLineDistances();this.pathLine.material.color.set(this.robot.reachable?'#83ccda':'#e5b479');
    }
    robotStatus(action,status){
      const r=this.robot;if(r.action!==action||r.status!==status)r.actionHistory.push({time:+this.time.toFixed(2),action,status});r.action=action;r.status=status;this.facts.robotStatus=status;
      if(action!=='move'){r.v=Math.max(0,r.v-(this.frameDt||1/60)*.8);const target=this.goal||{x:0,z:-2.8};let angle=Math.atan2(target.x-r.x,target.z-r.z);if(action==='scan')angle+=Math.sin(this.time*1.5)*.18;r.angle+=Math.atan2(Math.sin(angle-r.angle),Math.cos(angle-r.angle))*Math.min(1,(this.frameDt||1/60)*2.5);}
    }
    finishRobotOperation(dt,seconds){
      const r=this.robot,f=this.facts,arrived=r.reachable&&distance(r,this.goal)<.24;if(f.actionCompleted)return true;
      if(arrived){if(!f.robotArrived){f.robotArrived=true;f.arrivedAt=this.time;}f.operationElapsed=(f.operationElapsed||0)+dt;if(f.operationElapsed>=seconds){f.actionCompleted=true;f.elapsedToAction=+this.time.toFixed(2);}}
      else if(!f.actionCompleted)f.operationElapsed=0;
      return !!f.actionCompleted;
    }
    closeIsolation(dt){
      const f=this.facts;if(!this.bulkhead){f.isolationUnavailable=true;f.doorWaitReason='当前布局没有独立隔断';return false;}
      const clear=[...this.stageActors,this.robot].every(a=>Math.abs(a.z-this.bulkhead.position.z)>a.radius+this.bulkhead.scale.z/2+.18);
      f.doorWaitReason=clear?'':'等待人员和机器人离开门框';
      if(clear){if(f.crewSafeAt===null)f.crewSafeAt=this.time;this.isolationAmount=Math.min(1,this.isolationAmount+dt*.65);f.isolationClosed=this.isolationAmount>=.98;}
      return !!f.isolationClosed;
    }
    choiceLabel(variant){return this.script?.choices?.[variant]||variants[variant];}
    plan(actor,goal){
      const route=this.grid.route(actor,goal,actor.radius+.025);actor.reachable=route.reachable;actor.goal={...goal};actor.path=route.path.map(p=>({...p}));actor.routeDistance=actor.path.reduce((n,p,i)=>n+distance(p,i?actor.path[i-1]:actor),0);actor.endpoint=route.endpoint;
      if(actor.path.length&&distance(actor,actor.path[0])<.12)actor.path.shift();
    }
    planRobotPassage(){
      // Keep the wide carrier on the left until it has passed the crew refuge.
      // Both segments use the same collision grid; their joining waypoint is
      // retained so path simplification cannot cut through a waiting person.
      const r=this.robot,via={x:-.45,z:1.0},radius=r.radius+.025,first=this.grid.route(r,via,radius);
      if(!first.reachable)return;
      const second=this.grid.route(first.endpoint,this.goal,radius);
      r.path=(second.reachable?[...first.path,...second.path]:first.path).map(p=>({...p}));r.reachable=second.reachable;r.endpoint=second.reachable?second.endpoint:first.endpoint;
      r.routeDistance=r.path.reduce((n,p,i)=>n+distance(p,i?r.path[i-1]:r),0);if(r.path.length&&distance(r,r.path[0])<.12)r.path.shift();
    }
    buildEvent(){
      const kind=this.story.effect;this.event=new T.Group();this.owned.add(this.event);this.event.position.set(0,1.55,-3.5);this.effectParts=[];
      const attach=(shape,color,size,pos,opts)=>{const m=this.mesh(shape,color,size,pos,opts);this.event.add(m);return m;};
      if(kind==='alien'){
        attach('sphere','#76bfa7',[.38,.56,.32],[0,0,0],{metalness:.5,roughness:.28});attach('sphere','#d3f9d9',[.23,.25,.25],[0,.52,0],{emissive:'#78b08f',emissiveIntensity:.4});
        for(const x of [-.10,.10])attach('sphere','#183f46',[.065,.09,.03],[x,.56,.23]);
        for(let i=0;i<6;i++){const a=i*Math.PI/3,m=attach('sphere','#6abda7',[.065,.50,.065],[Math.sin(a)*.30,-.45,Math.cos(a)*.28]);m.rotation.z=Math.sin(a)*.55;this.effectParts.push(m);}
      }else if(kind==='infection'){
        this.event.position.set(.85,1.55,-3.1);for(let i=0;i<12;i++){const a=i*Math.PI/6,m=attach('sphere','#ca9ae9',[.045,.045,.045],[Math.cos(a)*.6,(i%3-.8)*.35,Math.sin(a)*.6],{emissive:'#9b5cc0',emissiveIntensity:.7,transparent:true,opacity:.8});this.effectParts.push(m);}
      }else{
        attach('box',kind==='storm'?'#d5ac72':'#59849b',[.8,.75,.4],[0,-.25,0]);
        if(kind==='evacuation'){attach('box','#c4c9e6',[1.45,2.4,.15],[0,0,-.12]);attach('box','#8de2ce',[1.2,.08,.17],[0,1.05,0],{emissive:'#44b29e',emissiveIntensity:1});}
        for(let i=0;i<22;i++){const m=attach('sphere',this.story.color,[.025,.025,.025],[Math.sin(i*2.4)*.6,Math.cos(i*1.4)*.6,(i%7)*.16],{emissive:this.story.color,emissiveIntensity:1,transparent:true,opacity:.7});this.effectParts.push(m);}
      }
      this.scan=this.mesh('torus',this.story.color,[.6,.6,.6],[0,1.6,-3.3],{emissive:this.story.color,emissiveIntensity:1,transparent:true,opacity:.6});
      this.signal=new T.PointLight(this.story.color,.8,5);this.event.add(this.signal);
      this.pathLine=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0,.12,3.15),...this.robot.path.map(p=>new T.Vector3(p.x,.12,p.z))]),new T.LineDashedMaterial({color:this.robot.reachable?'#83ccda':'#e5b479',dashSize:.14,gapSize:.1}));this.pathLine.computeLineDistances();this.owned.add(this.pathLine);
    }
    move(actor,dt,enabled=true){
      const point=enabled?actor.path[0]:null;
      if(!point){actor.v=Math.max(0,actor.v-dt*.8);return;}
      const d=distance(actor,point);if(d<.07){actor.path.shift();return;}
      const urgent=!!actor.source,target=actor.speed*Math.min(1,d/.20),dv=clamp(target-actor.v,-(urgent?2:1.0)*dt,(urgent?1.7:.7)*dt);actor.v+=dv;
      const step=Math.min(d,actor.v*dt),x=actor.x+(point.x-actor.x)/d*step,z=actor.z+(point.z-actor.z)/d*step;
      const blocker=[...this.stageActors,this.robot].find(other=>other!==actor&&Math.hypot(other.x-x,other.z-z)<=other.radius+actor.radius+.10),bodyClear=!blocker;actor.blockedBy=blocker||null;
      const panel=this.bulkhead,doorClear=!panel||this.isolationAmount<=.001||Math.hypot(Math.max(Math.abs(x-panel.position.x)-panel.scale.x/2,0),Math.max(Math.abs(z-panel.position.z)-panel.scale.z/2,0))>=actor.radius+.04;
      if(this.grid.lineClear(actor,{x,z},actor.radius+.01)&&bodyClear&&doorClear){actor.x=x;actor.z=z;actor.travel+=step;actor.motionDistance=actor.travel;}else actor.v=0;
      const angle=Math.atan2(point.x-actor.x,point.z-actor.z);actor.angle+=Math.atan2(Math.sin(angle-actor.angle),Math.cos(angle-actor.angle))*Math.min(1,dt*3.5);
    }
    choose(variant){if(this.film)return this.film.choose(variant);if(!this.active||this.loading)throw Error('请先开始放映故事。');if(!variants[variant])throw Error('请选择接触、隔离或救援。');if(this.time>=12)throw Error('这一宇宙的决定已经执行。重播剧情可尝试另一种选择。');if(this.matrix)throw Error('矩阵对照保持同一策略。请停止矩阵，单独播放后选择。');this.options.variant=variant;this.refreshUI();return{message:'已选择“'+this.choiceLabel(variant)+'”，决定将在第 12 秒执行。'};}
    pause(){if(this.film?.comparison){this.film.comparison.video.pause();return true;}if(!this.active)return false;this.paused=true;this.refreshUI();return true;}
    resume(){if(this.film?.comparison){this.film.comparison.video.play().catch(()=>{});return true;}if(!this.active)return false;this.paused=false;this.refreshUI();return true;}
    tick(dt){
      if(this.film){const result=this.film.tick(dt);this.s.eventReactions?.sync();return result;}
      if(!this.active||this.loading||this.paused||!Number.isFinite(dt)||dt<=0)return;
      // A bounded fixed integration step makes videos and interactive playback agree.
      let remaining=Math.min(dt,this.duration-this.time);while(remaining>1e-8){const step=Math.min(1/60,remaining);this.time=Math.min(this.duration,this.time+step);this.step(step);remaining-=step;}
      this.refreshUI();
      if(this.time>=this.duration-1e-6&&this.matrix&&!this.advancing&&!this.matrixFinished){
        this.advancing=true;this.matrixResults.push(this.snapshot(false));if(this.matrixAt+1<this.matrix.length){const queue=this.matrix,results=this.matrixResults,next=++this.matrixAt;this.release();this.matrix=queue;this.matrixResults=results;this.start(queue[next]).then(()=>{this.advancing=false;}).catch(e=>{this.error=e.message;this.advancing=false;this.o.chat?.add('矩阵放映中断：'+e.message,'剧情');});}else{this.advancing=false;this.matrixFinished=true;}
      }
    }
    step(dt){
      this.frameDt=dt;
      if(this.script){
        if(this.time<=30)this.script.step(this,dt);
        const f=this.facts,r=this.robot;f.crewDistance=this.stageActors.map(a=>+a.motionDistance.toFixed(2));f.crewActions=this.stageActors.map(a=>a.actionLabel);f.robotProgress=clamp((r.travel-(r.taskTravelStart||0))/Math.max(.1,f.routeDistance),0,1);f.robotStatus=r.status;
        if(this.time>=30&&!this.outcome){this.outcome=this.script.resolve(this);this.script.finish?.(this);}
        this.syncVisuals();return;
      }
      this.frameDt=dt;const t=this.time,variant=this.options.variant,f=this.facts,r=this.robot;
      this.crewDirector(dt);const ready=f.crewSafeAt!==null,delay=this.options.layout==='partitioned'?2.4:0;
      const peopleClear=this.stageActors.every(a=>a.z>a.radius+.45);
      if(t>=12&&t<30){
        if(variant==='isolate'){
          f.isolationUnavailable=!this.bulkhead;f.doorWaitReason=!ready||!peopleClear?'等待两名船员退出门框':'';
          if(this.bulkhead&&ready&&peopleClear){this.isolationAmount=Math.min(1,this.isolationAmount+dt*.65);f.isolationClosed=this.isolationAmount>=.98;}
        }else if(t>=12+delay&&ready&&(variant!=='rescue'||this.stageActors[1].rescued))this.move(r,dt);
        if(!f.robotArrived&&distance(r,this.goal)<.23&&r.reachable){f.robotArrived=true;f.arrivedAt=t;}
        const actionTime=variant==='contact'?(this.options.robot==='science'?2.4:4.5):variant==='rescue'?(this.options.robot==='medical'?2.2:3.8):2.4;
        if(f.robotArrived&&t-f.arrivedAt>=actionTime)f.actionCompleted=true;
        f.crewReady=ready;
        if(t>18&&!f.isolationClosed&&!f.actionCompleted)f.exposure+=dt;
      }
      f.robotProgress=clamp(r.travel/Math.max(.1,f.routeDistance),0,1);f.elapsedToAction=f.actionCompleted?+(f.arrivedAt+(variant==='contact'?(this.options.robot==='science'?2.4:4.5):variant==='rescue'?(this.options.robot==='medical'?2.2:3.8):2.4)).toFixed(2):null;
      f.crewDistance=this.stageActors.map(a=>+a.motionDistance.toFixed(2));f.crewActions=this.stageActors.map(a=>a.actionLabel);
      if(t>=30&&!this.outcome)this.outcome=this.resolve();
      this.robotDirector(dt);this.syncVisuals(dt);
    }
    robotDirector(dt){
      const t=this.time,r=this.robot,f=this.facts,v=this.options.variant;let action='scan',status='监听异常 · 转向生命信号';
      if(t>=1.2&&t<5)status='检测到异常 · 请求船员撤离';
      else if(t>=5&&t<12){action='yield';status='等待船员穿门 · 保持通道畅通';}
      else if(t>=12&&t<30){
        if(v==='isolate'){action='guard';status=!this.bulkhead?'缺少隔断 · 请求船员人工警戒':f.isolationClosed?'隔离已完成 · 持续监测舱门':'等待人员清空 · 准备封舱';}
        else if(!f.crewReady||v==='rescue'&&!this.stageActors[1].rescued){action='yield';status='船员优先 · 悬停让出救援通道';}
        else if(t<12+(this.options.layout==='partitioned'?2.4:0)){action='scan';status='核验门禁 · 等待通行许可';}
        else if(!f.routeReachable&&!r.path.length){action='blocked';status='机体过宽 · 窄门无法通过';}
        else if(f.actionCompleted){action='report';status=this.options.robot==='science'?'信号识别完成 · 向船员报告':'现场检查完成 · 等待人工确认';}
        else if(f.robotArrived){action='work';status=this.options.scenario==='visitor'?(this.options.robot==='science'?'正在扫描光谱 · 翻译三次敲击':this.options.robot==='medical'?'正在监测生命体征':'正在检查密封运输箱'):({infection:'检测异常样本 · 监测生命信号',leak:'扫描舱壁 · 定位漏气点',spoof:'正在核验控制终端指令',storm:'读取外侧设备回收状态',evacuation:'正在检查最后一扇舱门'}[this.options.scenario]);}
        else if(r.blockedBy){action='yield';status='通道有人 · 悬停等候通行';}else{action='move';status='前往异常源 · 避让船员与设备';}
      }else if(t>=30){action=f.isolationClosed?'guard':!f.routeReachable?'blocked':'report';status=this.outcome?.title||'现场行动结束';}
      if(r.action!==action){r.actionHistory.push({time:+t.toFixed(2),action,status});r.action=action;}r.status=status;f.robotStatus=status;
      if(action!=='move'){
        r.v=Math.max(0,r.v-dt*.8);const target=action==='yield'?this.stageActors[1]:{x:0,z:-3.5};let angle=Math.atan2(target.x-r.x,target.z-r.z);if(action==='scan')angle+=Math.sin(t*1.8)*.28;r.angle+=Math.atan2(Math.sin(angle-r.angle),Math.cos(angle-r.angle))*Math.min(1,dt*2.5);
      }
    }
    resolve(){
      const f=this.facts,v=this.options.variant,r=this.options.robot,s=this.options.scenario;const outcome=(code,title,detail)=>({code,title,detail});
      if(v==='isolate'&&f.isolationClosed&&f.crewReady)return outcome('contained',s==='visitor'?'舱门合拢，谜团留在另一侧':s==='infection'?'隔离成功，她仍等待下一次诊断':'危险被分区隔断，等待支援','隔断封闭；船员抵达人工控制台。阻止扩散也中断了直接接触。');
      if(v==='isolate'&&!this.bulkhead)return outcome('uncontained','船员完成后撤，这里却没有隔断','控制台没有独立隔离门，机器人停下警戒，船员以手动方式保护通道。');
      if(!f.routeReachable)return outcome('blocked',f.humanRescuedAt?'船员手动接应，机器人仍被窄门挡住':'机器人无法穿过窄门，行动窗口关闭','机体包络 '+(this.robot.radius*2).toFixed(2)+' 米；门宽 '+layouts[this.options.layout].opening.toFixed(2)+' 米，设备间无可用通路。');
      if(!f.actionCompleted)return outcome('late',f.robotArrived?'它赶到了，但处置时间已经用尽':'还在途中，行动窗口已经关闭','航行、门禁等待与操作都计入 18 秒行动窗口。');
      if(v==='isolate')return outcome('waiting','人员尚未完成撤离，隔断保持开启','机器人优先保障通行，关闭动作因人员仍在门区而延迟。');
      if(s==='visitor')return v==='contact'&&r==='science'?outcome('translated','它并非入侵者，而是迷路的信使','科研机器人完成光谱辨识和信号翻译；船员撤销警戒。'):v==='rescue'?outcome('startled','伸出的援手，让它误以为遭到捕捉','直接救援触发回避反应；未知生命退回货架后方。'):outcome('untranslated','生命体被发现，语言仍是关闭的门','机器人完成接近，但当前机型没有信号翻译能力。');
      if(s==='infection')return r==='medical'?outcome('treated','防护护理完成，船员自主接受观察','医疗机型完成近距离监测与护理，保留了患者沟通。'):v==='contact'&&r==='science'?outcome('diagnosed','样本被识别，治疗仍需医疗伙伴','先诊断保住了选择窗口，但科研设备不能完成护理。'):outcome('exposed','撤离完成，接触暴露也随之发生','直接接走患者，却没有完成防护处置。');
      if(s==='leak')return r==='cargo'?outcome('sealed','密封补给送达，裂缝暂时封住','运输平台送达封堵物资。'):v==='rescue'&&r==='medical'?outcome('saved','伤员离开漏点，货物留在失压侧','优先护理保护了船员。'):outcome('located','漏点定位成功，压力仍在下降','现场已经查明，封堵能力尚未到位。');
      if(s==='spoof')return v==='contact'&&r==='science'?outcome('verified','伪造指令被拒绝，舱门保持关闭','核验终端签名后，机器人请求了人工确认。'):outcome('manual','控制权交给船员，自动通路暂停','无法核验的指令转交人工，付出通行延迟。');
      if(s==='storm')return r==='cargo'?outcome('recovered','样本设备被带回，观测记录完整','运输平台完成固定和回收。'):outcome('sheltered','船员进入防护区，设备留在外侧','设备载荷超出当前机型回收能力。');
      return v==='rescue'&&r==='medical'?outcome('evacuated','协助通行完成，船员抵达返回舱','医疗伙伴先检查生命体征，再协助通过最后一扇门。'):outcome('checked','门锁已经核验，撤离进入人工接力','机器人完成前方检查，船员接管后续撤离。');
    }
    animateStoryRobot(r,t){
      if(r.model.userData.orbitalRobot){
        const subject=this.options.scenario==='infection'?this.infection?.patient:null,goal=subject||(['work','scan','report'].includes(r.action)?this.goal:r.path[0])||this.goal;
        const dx=(goal?.x??r.x)-r.x,dz=(goal?.z??r.z)-r.z,c=Math.cos(r.angle),s=Math.sin(r.angle),target={x:c*dx-s*dz,y:subject?subject.y+1.3-1.65:0,z:s*dx+c*dz};
        C.animateOrbitalRobot(r.model,t,{action:r.action,speed:r.v,thrust:r.thrust||{x:0,y:0,z:0},turn:r.turnRate||0,target,dt:this.frameDt||1/60});return;
      }
      C.animateRobot(r.model,t,r.v>.04,['work','report','scan','guard','yield'].includes(r.action),t);
      const data=r.model.userData,j=data.joints;
      if(data.officialG1){
        const values={},wave=Math.sin(t*1.7),working=r.action==='work',yielding=r.action==='yield',scanning=r.action==='scan'||r.action==='guard';
        values.waist_yaw_joint=scanning?Math.sin(t*.9)*.23:working?wave*.08:0;values.waist_pitch_joint=working?.12:.015;
        for(const [side,sign]of [['left',1],['right',-1]]){
          values[side+'_shoulder_pitch_joint']=working?-.75+wave*.16:yielding?(side==='right'?-.95:-.20):scanning?(side==='right'?-.55:-.2):-.22;
          values[side+'_shoulder_roll_joint']=sign*(yielding?.25:.15);
          values[side+'_elbow_joint']=working?.9+wave*.18:yielding?1.0:scanning?.7:.4;
          values[side+'_wrist_yaw_joint']=working?sign*wave*.32:yielding?wave*.14:0;
        }
        r.jointPose??={};const alpha=1-Math.exp(-(this.frameDt||1/60)*7);
        for(const descriptor of data.jointDescriptors){if(values[descriptor.name]===undefined)continue;const node=j[descriptor.name],target=clamp(values[descriptor.name],descriptor.lower,descriptor.upper);r.jointPose[descriptor.name]=(r.jointPose[descriptor.name]??target)+(target-(r.jointPose[descriptor.name]??target))*alpha;node.quaternion.copy(node.userData.baseQuaternion).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(...descriptor.axis),r.jointPose[descriptor.name]));}
      }else{
        if(j?.head){j.head.rotation.y=Math.sin(t*(r.action==='scan'?1.5:.65))*(r.action==='scan'?.42:.15);j.head.rotation.x=r.action==='work'?.12+Math.sin(t*1.8)*.06:Math.sin(t)*.025;}
        if(j?.tray)j.tray.rotation.x=r.action==='work'?Math.sin(t*2)*.07:0;
      }
    }
    syncVisuals(){
      const t=this.time;for(const [i,a]of this.stageActors.entries()){
        const moving=a.v>.06,dt=this.frameDt||1/60,turn=a.poseAngle===undefined?0:Math.atan2(Math.sin(a.angle-a.poseAngle),Math.cos(a.angle-a.poseAngle))/dt;
        a.poseAngle=a.angle;a.poseLean??=0;a.poseRoll??=0;const blend=1-Math.exp(-dt*4);
        a.poseLean+=((moving?.10*Math.min(1,a.v):.015*Math.sin(t*.8+i))-a.poseLean)*blend;a.poseRoll+=(clamp(-turn*.055,-.09,.09)+.018*Math.sin(t*.7+i)-a.poseRoll)*blend;
        a.model.position.set(a.x,a.y+.025*Math.sin(t*.85+i),a.z);a.model.rotation.set(a.poseLean,a.angle,a.poseRoll);C.animateStationStoryCrew(a.model,t+i*.31,a.action,moving,{speed:a.v,turn});
      }
      const r=this.robot,previous=r.flightFrame;
      if(!previous){r.flightVelocity={x:0,y:0,z:0};r.flightThrust={x:0,y:0,z:0};r.thrust={x:0,y:0,z:0};r.turnRate=0;r.flightPitch=0;r.flightRoll=0;}
      else if(t>previous.time){
        const dt=t-previous.time,alpha=1-Math.exp(-dt*7),v=r.flightVelocity;
        // Position changes drive paired attitude-control ducts. Coasting needs
        // no sustained lift in zero gravity; stopping fires the opposite pair.
        const next={x:v.x+((r.x-previous.x)/dt-v.x)*alpha,y:0,z:v.z+((r.z-previous.z)/dt-v.z)*alpha};
        r.flightThrust={x:clamp((next.x-v.x)/dt,-1.5,1.5),y:0,z:clamp((next.z-v.z)/dt,-1.5,1.5)};r.flightVelocity=next;
        const c=Math.cos(r.angle),s=Math.sin(r.angle);r.thrust={x:c*r.flightThrust.x-s*r.flightThrust.z,y:0,z:s*r.flightThrust.x+c*r.flightThrust.z};
        r.turnRate=Math.atan2(Math.sin(r.angle-previous.angle),Math.cos(r.angle-previous.angle))/dt;
        r.flightPitch+=(clamp(-r.thrust.z*.035,-.045,.045)-r.flightPitch)*alpha;r.flightRoll+=(clamp(r.thrust.x*.035,-.045,.045)-r.flightRoll)*alpha;
      }
      r.flightFrame={time:t,x:r.x,z:r.z,angle:r.angle};r.model.position.set(r.x,r.y,r.z);r.model.rotation.set(r.flightPitch,r.angle,r.flightRoll);this.animateStoryRobot(r,t);
      if(this.bulkhead)this.bulkhead.position.x=this.bulkhead.userData.openX*(1-this.isolationAmount);
      const end=this.outcome?.code,success=['translated','treated','sealed','verified','recovered','evacuated'].includes(end);
      this.event.position.y=1.55+.08*Math.sin(t*.9);if(this.story.effect==='alien'){this.event.rotation.y=.12*Math.sin(t*.6);const surge=t>=1.15&&t<5.2?Math.sin((t-1.15)/4.05*Math.PI)*1.05:0;this.event.position.z=-3.5+surge-(end==='startled'?clamp((t-30)/3,0,1)*.8:0);for(const [i,p]of this.effectParts.entries())p.rotation.x=.22*Math.sin(t*1.2+i);}
      else for(const [i,p]of this.effectParts.entries()){p.position.x=Math.sin(i*2.4+t*.5)*(.35+(i%3)*.15);p.position.y=Math.cos(i*1.4+t)*.65;p.position.z=this.story.effect==='leak'?((t*1.8+i*.13)%2.8):Math.sin(i+t)*.45;}
      if(this.story.effect==='infection'){const patient=this.stageActors[1];this.event.position.set(patient.x,patient.y+1,patient.z);}this.event.visible=t>.8;this.signal.intensity=success?.35:.65+.25*Math.sin(t*3);this.beacon.material.emissiveIntensity=success?.4:.7+.5*Math.sin(t*4);
      this.scan.visible=['scan','work','blocked'].includes(r.action)&&t>1;this.scan.position.set(r.x,1.65,r.z-.55);this.scan.scale.setScalar(.5+.12*Math.sin(t*2));this.scan.rotation.y=t*.8;
      if(success){this.signal.color.set('#87e0c1');this.consoleScreen.material.color.set('#8de3c6');}if(this.facts.isolationClosed)this.consoleScreen.material.color.set('#e4b775');
      for(const hatch of this.world.hatches){const open=t>3&&t<30&&this.options.variant!=='isolate';hatch.leaf.position.x=open?1.43*clamp((t-3)/2,0,1):t>=30?1.43*(1-clamp((t-30)/2,0,1)):0;}
      this.pathLine.visible=t>=5&&t<30;this.script?.visuals(this);
    }
    narrative(){
      if(this.film)return this.film.narrative();
      if(this.loading)return{stage:'准备放映',caption:'正在布置情景空间…'};
      if(this.script)return this.time>=30?{stage:'04 / 演练结局',caption:this.outcome?.title||'等待现场反馈'}:this.script.narrative(this);
      if(this.time<1.15)return{stage:'01 / 异常信号',caption:this.story.intro};if(this.time<5)return{stage:'01 / 紧急后撤',caption:this.options.scenario==='visitor'?'货架后突然探出陌生生命。两名船员抬臂护脸，立即蹬舱后撤。':this.options.scenario==='infection'?'船员突然失去平衡，扶住样本柜呼救；同伴转身启动应急控制。':'警报突响，船员抓住扶手稳住身体，随即冲向撤离通道。'};
      if(this.time<12)return{stage:'02 / 穿门撤离与决策',caption:this.facts.crewSafeAt===null?'船员依次穿过舱门，机器人侧身等待。'+this.story.decision:this.story.decision};
      if(this.time<30){let caption=this.story.action;
        if(this.options.variant==='rescue')caption=!this.stageActors[1].atRisk?'船员再次冲入危险侧；同伴冲到门边伸手接应，机器人暂停让行。':!this.stageActors[1].rescued?'异常骤强，现场船员急停护脸、转身回撤；门口同伴持续呼叫。':'船员已回到安全侧，机器人接手后续检查。';
        else if(this.facts.isolationClosed)caption='一人双手锁紧应急阀，另一人后撤；舱门合拢，他们隔门呼叫。';
        else if(this.options.variant==='isolate'&&this.bulkhead)caption='两人分头操纵紧急手柄；门框清空后，隔断才开始关闭。';
        else if(this.stageActors[1].cue==='contact-follow')caption='船员跟随机器人再次穿门，伸手示意；指挥员在安全侧引导。';
        else if(!this.facts.routeReachable&&!this.robot.path.length)caption='机器人悬停在窄门前，请求人工接应；船员挥臂引导。';
        else if(this.facts.actionCompleted)caption='机器人报告辨识结果，现场船员放缓动作，尝试建立交流。';
        return{stage:'03 / 协同行动',caption};}
      return{stage:'04 / 宇宙结局',caption:this.outcome?.title||'等待现场反馈'};
    }
    refreshUI(){
      if(this.film)return this.film.refreshUI();
      if(!this.active)return;const n=this.nodes,narrative=this.narrative();n.title.textContent=this.story.title;n.design.textContent=layouts[this.options.layout].name+' × '+robots[this.options.robot].name+' · '+this.choiceLabel(this.options.variant)+(this.options.cinematic?'':' · 拖动观察');n.stage.textContent=narrative.stage;n.caption.textContent=narrative.caption;n.clock.textContent=this.paused?'已暂停':this.time<12?Math.ceil(12-this.time)+' 秒后执行':this.time<30?'行动剩余 '+Math.ceil(30-this.time)+' 秒':Math.floor(this.time)+' / 36 秒';this.ui.querySelector('.st-story-progress i').style.width=this.time/this.duration*100+'%';
      n.facts.textContent=this.outcome?this.outcome.detail:this.script?.statusLine?.(this)||robots[this.options.robot].ability+' · 全站五名船员 · 当前演练两人';this.ui.querySelector('[data-story-pause]').textContent=this.paused?'继续':'暂停';
      this.ui.querySelectorAll('[data-story-choice]').forEach((b,i)=>{b.textContent='0'+(i+1)+' · '+this.choiceLabel(b.dataset.storyChoice);b.disabled=this.time>=12||!!this.matrix||this.loading;b.setAttribute('aria-pressed',String(b.dataset.storyChoice===this.options.variant));});
      this.ui.querySelector('.st-story-matrix').hidden=!this.matrix;
      if(this.matrix){n.matrix.replaceChildren();this.matrix.forEach((opt,i)=>{const cell=document.createElement('div');cell.className=i===this.matrixAt?'current':'';cell.textContent=layouts[opt.layout].name+' / '+robots[opt.robot].name;const result=this.matrixResults[i];const small=document.createElement('small');small.textContent=result?.outcome?.title||(i===this.matrixAt?'正在观察':'等待放映');cell.appendChild(small);n.matrix.appendChild(cell);});}
    }
    snapshot(includeMatrix=true){if(this.film){const state=this.film.snapshot();if(this.film.liveEvent)state.reactions=this.s.eventReactions?.snapshot();return state;}const narrative=this.active?this.narrative():{stage:'未放映',caption:''};return{active:this.active,paused:!!this.paused,title:this.story?.title,...this.options,time:+this.time.toFixed(4),duration:this.duration,...narrative,outcome:this.outcome?{...this.outcome}:null,options:{...this.options},facts:{...this.facts},matrixResults:includeMatrix?this.matrixResults.map(s=>({...s,matrixResults:undefined})):undefined};}
    setCinemaCamera(){if(!this.camera)return;const canvas=this.s.v.renderer.domElement,aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);this.camera.aspect=aspect;this.camera.position.set(aspect<1.1?7:9,aspect<1.1?13:11.8,aspect<1.1?15:11.5);this.camera.lookAt(0,.8,0);this.camera.fov=aspect<1.1?44:40;this.camera.updateProjectionMatrix();}
    render(){if(this.film)return this.film.render();if(!this.scene||this.loading)return;const canvas=this.s.v.renderer.domElement,aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);if(this.camera.aspect!==aspect){this.camera.aspect=aspect;this.camera.updateProjectionMatrix();}this.storyControls?.update();this.s.v.renderer.toneMappingExposure=.95;this.s.v.renderer.render(this.scene,this.camera);this.labels?.update();}
    update(dt){if(!this.options.manual&&!this.paused&&!document.hidden)this.tick(Math.min(.1,Math.max(0,dt)));this.render();}
    release(){
      if(this.film){this.film.dispose();this.film=null;return;}
      this.storyControls?.dispose();this.storyControls=null;this.labels?.dispose();this.labels=null;
      for(const actor of this.stageActors||[]){C.resetStationStoryCrew?.(actor.model);for(const item of actor.saved.nodes){item.node.position.copy(item.p);item.node.quaternion.copy(item.q);item.node.scale.copy(item.s);item.node.visible=item.visible;}actor.model.userData.stationPose=actor.saved.pose;actor.saved.parent?.add(actor.model);actor.model.updateMatrixWorld(true);}this.stageActors=[];
      if(this.robot){C.disposeModel(this.robot.model);this.robot=null;}
      if(this.scene){const all=resources(this.scene);for(const g of all.geometry)if(!this.protected.geometry.has(g))g.dispose();for(const m of all.material)if(!this.protected.material.has(m))m.dispose();for(const texture of all.texture)if(!this.protected.texture.has(texture))texture.dispose();}
      this.script?.dispose?.(this);this.scene=null;this.world=null;this.grid=null;if(this.saved){this.s.v.controls.enabled=this.saved.controls;this.s.v.renderer.toneMappingExposure=this.saved.exposure;this.saved=null;}
    }
    stop(){const was=this.active;++this.serial;this.active=false;this.loading=false;this.paused=false;this.matrix=null;this.advancing=false;this.matrixFinished=false;this.s.eventReactions?.sync();this.release();this.ui.hidden=true;delete document.body.dataset.stationStory;return was;}
  }
  C.StationScenarios=StationScenarios;C.stationStories=stories;
})();
