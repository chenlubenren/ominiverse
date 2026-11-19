/* Complete, deterministic film. Every transfer is staged against physical props. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,clamp=T.MathUtils.clamp;
  const ease=u=>{u=clamp(u,0,1);return u*u*(3-2*u);};
  const ramp=(t,a,b)=>ease((t-a)/(b-a));
  const v=a=>new T.Vector3(...a);
  // Keyframes describe root motion, not hand contacts. Hands solve against props below.
  function track(keys,t){let a=keys[0],b=a;for(let i=1;i<keys.length;i++){b=keys[i];if(t<=b[0])break;a=b;}const u=b[0]===a[0]?0:ramp(t,a[0],b[0]);return a.slice(1).map((x,i)=>x+(i===3?Math.atan2(Math.sin(b[i+1]-x),Math.cos(b[i+1]-x)):b[i+1]-x)*u);}
  const dialogue=[
    [1.4,5.8,'江月','最后一份样本。做完就能回去了。'],
    [7.1,10.8,'江月','林岚……我头有点晕。'],
    [11.2,15.8,'伴飞器','生物告警。隔离门自动关闭。'],
    [17,21.4,'江月','请别把我关起来。我还能走。'],
    [22,26.6,'伴飞器','直接开门会扩大暴露。需要你的确认。'],
    [27,31.5,'林岚','先建立保护通道。我和你一起接江月。'],
    [32,36.5,'伴飞器','通道已稳定。请等待舱门完全打开。'],
    [38,42.5,'伴飞器','江月，抓住蓝色把手。我来控制速度。'],
    [44,47.5,'江月','我抓住了。你别走。'],
    [49,53.5,'林岚','我在门这边。看着我，慢慢过来。'],
    [60.5,65,'伴飞器','患者已通过。准备封闭污染侧。'],
    [67.5,71.8,'伴飞器','体征正在恢复。还需要留舱观察。'],
    [72,75.5,'江月','你也得和我一起隔离了。'],
    [76,80.5,'林岚','记录共同暴露。我们一起留舱观察。']
  ].map(([start,end,speaker,text])=>({start,end,speaker,text}));
  const shots=[
    [0,6.5,'机器人陪同最后一份样本',[2.45,2.75,4.75],[-.55,1.55,-.75],62],
    [6.5,11,'机器人捕捉到异常呼吸',[1.10,1.88,3.95],[.05,1.60,1.65],53],
    [11,16,'隔离门关闭',[2.8,2.35,3.9],[0,1.65,0],53],
    [16,22,'玻璃后的手',[-.38,2.15,.72],[-.41,1.92,-1],48],
    [22,27,'不能自动替你决定',[2.55,2.2,2.7],[.82,1.7,.8],53],
    [27,32,'人的授权',[1.9,1.65,.95],[1.34,1.45,.47],54],
    [32,37,'等待门锁释放',[2.65,2.3,3.65],[0,1.58,0],56],
    [37,43,'靠近，不要害怕',[2.65,2.45,-3.9],[-.15,1.55,-1.7],56],
    [43,49,'抓紧蓝色把手',[1.45,2.25,-3.3],[0,1.67,-1.9],46],
    [49,60.5,'穿过真正的门',[2.6,2.65,2.9],[0,1.55,-.05],62],
    [60.5,67.5,'封闭与接诊',[2.6,2.65,4.3],[-1,1.55,1.65],57],
    [67.5,72,'一只手的温度',[-2.3,2.1,1.15],[-1.4,1.65,2.55],54],
    [72,82,'一起等待',[-2.3,2.5,.7],[-1.05,1.6,2.75],58]
  ].map(([start,end,name,position,target,fov])=>({start,end,name,position,target,fov}));
  const paths={
    patient:[[0,-1.70,.48,-2.42,Math.PI],[6.5,-1.70,.48,-2.42,Math.PI],[11,-1.65,.48,-2.25,1.6],[16,-.50,.48,-.35,0],[22,-.50,.48,-.35,0],[28,-.9,.48,-1.55,0],[35,-.9,.48,-2.35,0],[38,-.9,.48,-2.35,0],[43,0,.50,-2.32,0],[48,0,.50,-2.32,0],[60,0,.50,1.7,0],[63,-.8,.48,2.05,-.8],[66,-1.72,.48,2.60,Math.PI],[82,-1.72,.48,2.60,Math.PI]],
    lead:[[0,1.15,.222,.699,Math.PI],[27,1.15,.222,.699,Math.PI],[32,1.15,.222,.699,Math.PI],[37,.91,.32,.86,Math.PI],[53,.91,.32,.86,Math.PI],[57,.9,.48,2.15,Math.PI],[62,.9,.48,2.15,Math.PI],[68,-.15,.48,3.1,-Math.PI/2],[82,-.15,.48,3.1,-Math.PI/2]],
    robot:[[0,.1,1.25,2.7,Math.PI],[23,.1,1.25,2.7,Math.PI],[31,.1,1.25,1.45,Math.PI],[37,.1,1.25,1.45,Math.PI],[41,0,1.25,-1.6,Math.PI],[43,0,1.25,-1.6,0],[48,0,1.25,-1.6,0],[60,0,1.25,2.42,0],[63,.1,1.25,2.65,-1.3],[66,-.95,1.25,2.2,-Math.PI/2],[82,-.95,1.25,2.2,-Math.PI/2]]
  };
  const isolationPaths={
    patient:[[27,...track(paths.patient,27)],[30,-.75,.48,-1.0,0],[36,-.5,.48,-.35,0],[50,-.5,.48,-.35,0],[56,-.8,.68,-1.4,-.15],[67,-.8,.82,-2.0,-.4],[82,-.8,.85,-2.1,-.45]],
    lead:[[27,...track(paths.lead,27)],[33,1.15,.222,.699,Math.PI],[39,.5,.48,.35,Math.PI],[82,.5,.48,.35,Math.PI]],
    robot:[[27,...track(paths.robot,27)],[36,-.45,1.25,.85,Math.PI],[48,-.45,1.25,.85,Math.PI],[57,-.45,1.25,1.05,Math.PI],[82,-.45,1.25,1.05,Math.PI]]
  };
  const isolationDialogue=[...dialogue.filter(a=>a.start<27),...[
    [27,31.5,'林岚','维持隔离。先把诊断传回来。'],
    [32,36.5,'伴飞器','门锁保持关闭。只能进行远程观察。'],
    [38,42.5,'林岚','江月，把手放在窗上。让我看见你。'],
    [44,47.5,'江月','你说，只是等一下。'],
    [49,53.5,'伴飞器','江月的反应正在减弱。请求进入护理。'],
    [54,58,'林岚','江月？看着我。回答我。'],
    [60.5,65,'伴飞器','患者失去回应。接触式护理仍未开始。'],
    [67.5,71.8,'伴飞器','隔离门保持关闭。人员跨舱记录为零。'],
    [73,77.8,'林岚','不要关闭通话。继续呼叫江月。']
  ].map(([start,end,speaker,text])=>({start,end,speaker,text}))];
  const isolationShots=[...shots.filter(a=>a.start<27),...[
    [27,32,'同一个按钮，另一种授权',[1.9,1.65,.95],[1.34,1.45,.47],54],
    [32,37,'没有开启的门',[2.65,2.3,3.65],[0,1.58,0],56],
    [37,43,'隔着玻璃的观察',[-1.65,2.15,1.85],[-.35,1.8,.15],52],
    [43,49,'只是等一下',[-.38,2.15,.72],[-.5,1.9,-.6],48],
    [49,56,'没有被抓住的手',[1.4,2.4,-2.8],[-.45,1.7,-.45],52],
    [56,60.5,'呼叫没有回答',[1.8,2.4,-3.8],[-.6,1.8,-1.2],58],
    [60.5,67.5,'机器人停在门外',[-1.8,2.3,2.5],[-.2,1.7,.25],55],
    [67.5,72,'零次跨舱',[2.4,2.6,-2.4],[-.65,1.8,-.8],60],
    [72,82,'通话仍然开启',[2.25,2.75,-3.8],[-.55,1.8,-1.15],61]
  ].map(([start,end,name,position,target,fov])=>({start,end,name,position,target,fov}))];
  class StationFilm {
    constructor(d){this.mediaUrls=new Set();this.mediaCache=new Map();this.mediaAbort=new AbortController();this.d=d;this.s=d.s;this.duration=82;this.title='请别把我关起来';this.dialogue=dialogue;this.shots=shots;this.events=[{time:7,type:'alarm'},{time:9,type:'door-close',duration:3},{time:28.5,type:'confirm'},{time:32,type:'latch'},{time:33,type:'door-open',duration:3.5},{time:44,type:'confirm'},{time:63,type:'door-close',duration:3},{time:66,type:'scan',duration:2},{time:67,type:'heartbeat',duration:10}];}
    start(options){
      this.headless=!!options.headless;this.branchId=options.branchId||null;this.configure(options.variant);const d=this.d;d.options={...options,film:true,variant:this.variant,layout:'partitioned',robot:'medical',cinematic:true};d.duration=this.duration;d.time=0;d.story=C.stationStories.infection;d.active=true;d.loading=false;d.paused=false;d.outcome=null;d.error=null;if(d.ui&&!this.headless)d.ui.hidden=true;d.stageActors=[];
      if(!this.headless){d.saved={controls:this.s.v.controls.enabled,exposure:this.s.v.renderer.toneMappingExposure};this.s.v.controls.enabled=false;document.body.dataset.stationStory='playing';document.body.dataset.stationFilm='playing';}
      this.scene=new T.Scene();this.scene.background=new T.Color('#07121b');this.scene.environment=this.s.scene.environment;this.set=C.buildStationFilmSet(this.s);this.scene.add(this.set.root);
      this.camera=new T.PerspectiveCamera(50,16/9,.035,80);d.camera=this.camera;this.actors=['林岚','江月'].map((name,i)=>{const crew=this.s.crewRoster.find(person=>person.name===name),crewIndex=crew?.globalIndex??(i?4:0),model=C.makeStationCrew(crewIndex);C.makeStationFilmMannequin?.(model);model.name=name;model.userData.filmCrewId=crew?.id;model.userData.filmCrewIndex=crewIndex;this.scene.add(model);return{name,id:i?'film-patient':'film-lead',crewIndex,model,radius:.26,x:0,y:0,z:0,angle:0,v:0,action:'idle'};});
      this.robot={name:'诺亚 · 医疗伴飞器',model:C.makeOrbitalRobot({role:'medical',color:'#9cc8ee',name:'诺亚',scale:1}),radius:.43,x:0,y:1.25,z:2.7,angle:0,status:'样本任务待命'};this.initialRobot=this.robot;this.scene.add(this.robot.model);C.stationFilmRobotGrip(this.robot.model,'rear');
      d.stageActors=this.actors;d.robot=this.robot;d.facts=this.facts={doorViolations:[],contacts:{},gripConfirmed:false,patientCrossed:false,receiverReady:false,treatmentComplete:false,authorization:false,crewCount:2};
      this.branchController=this.branchId&&C.createStationFilmBranch?C.createStationFilmBranch(this,this.branchId):null;
      if(!this.headless)this.makeUI();this.time=0;this.step(0);if(!this.headless){this.refreshUI();this.render();
      this.audio=new Audio();this.audio.preload='auto';this.audio.volume=.85;if(!options.manual)this.bindAudio();if(options.comparison)this.openComparison();}return this.snapshot();
    }
    configure(variant){this.variant=variant==='isolate'?'isolate':'rescue';this.dialogue=this.variant==='isolate'?isolationDialogue:dialogue;this.shots=this.variant==='isolate'?isolationShots:shots;this.audioPath=this.variant==='isolate'?'assets/media/station-film-isolate/audio/story-mix.m4a':'assets/media/station-film/audio/story-mix.m4a';this.ending=this.variant==='isolate'?{title:'隔离维持。\n患者失去回应。',detail:'无人跨越舱门。接触式护理没有开始。'}:{title:'救援完成。\n两人共同隔离。',detail:'江月恢复回应。接应者接受暴露追踪。'};this.events=this.variant==='isolate'?[{time:7,type:'alarm'},{time:9,type:'door-close',duration:3},{time:28.5,type:'confirm'},{time:36,type:'scan',duration:3},{time:50,type:'alarm'},{time:57,type:'alarm'}]:[{time:7,type:'alarm'},{time:9,type:'door-close',duration:3},{time:28.5,type:'confirm'},{time:32,type:'latch'},{time:33,type:'door-open',duration:3.5},{time:44,type:'confirm'},{time:63,type:'door-close',duration:3},{time:66,type:'scan',duration:2},{time:67,type:'heartbeat',duration:10}];}
    mediaSource(path){if(this.mediaCache.has(path))return this.mediaCache.get(path);const source=(async()=>{const head=await fetch(path,{method:'HEAD',signal:this.mediaAbort.signal});if(!head.ok)throw Error('影片暂时不可用');if(head.headers.get('Accept-Ranges')==='bytes')return path;const response=await fetch(path,{signal:this.mediaAbort.signal});if(!response.ok)throw Error('影片暂时不可用');const blob=await response.blob();if(this.disposed)throw Error('放映已结束');const url=URL.createObjectURL(blob);this.mediaUrls.add(url);return url;})();this.mediaCache.set(path,source);return source;}
    bindAudio(){const token=this.audioToken=(this.audioToken||0)+1;this.audio.pause();this.mediaSource(this.audioPath).then(source=>{if(this.disposed||token!==this.audioToken)return;this.audio.onloadedmetadata=()=>{if(this.disposed||token!==this.audioToken)return;this.audio.currentTime=this.time;if(!this.d.paused&&!this.d.options.manual&&!this.comparison)this.audio.play().catch(()=>{this.audioBlocked=true;});};this.audio.src=source;this.audio.load();}).catch(()=>{if(!this.disposed)this.audioBlocked=true;});}
    makeUI(){
      const ui=this.ui=document.createElement('section');ui.className='st-film-ui';ui.setAttribute('aria-label','完整故事短片');ui.innerHTML='<header><small>ORBITAL STORIES / 01</small><h2>请别把我关起来</h2><p data-film-chapter></p></header><nav class="st-film-controls"><button data-film-compare>双结局对照</button><button data-film-chat>聊天指令</button><button data-film-audio>声音开启</button><button data-film-pause>暂停</button><button data-film-replay>重播</button><button data-film-exit>返回空间站</button></nav><div class="st-film-choices"><small>同一抉择 / 两个结局 · 27秒前可切换</small><button data-film-choice="rescue">A · 接出患者</button><button data-film-choice="isolate">B · 维持隔离</button></div><div class="st-film-robot"><span>诺亚 · 医疗伴飞器</span><b></b></div><div class="st-film-caption"><small></small><p></p></div><div class="st-film-end" hidden><small>结局 / 接出患者</small><h2>门已关闭。<br>通话仍在继续。</h2><p>江月脱离危险。林岚接受共同隔离。</p></div><div class="st-film-timeline"><i></i></div>';
      document.body.append(ui);ui.querySelector('[data-film-compare]').onclick=()=>this.openComparison();ui.querySelectorAll('[data-film-choice]').forEach(b=>b.onclick=()=>this.choose(b.dataset.filmChoice));ui.querySelector('[data-film-chat]').onclick=()=>{document.body.classList.toggle('st-film-chat-open');document.querySelector('#co-observation-input')?.focus();};ui.querySelector('[data-film-pause]').onclick=()=>this.d.paused?this.d.resume():this.d.pause();ui.querySelector('[data-film-replay]').onclick=()=>this.d.play({scenario:'infection',film:true,variant:this.variant});ui.querySelector('[data-film-exit]').onclick=()=>this.d.stop();ui.querySelector('[data-film-audio]').onclick=()=>{if(this.audioBlocked){this.audioBlocked=false;this.audio.currentTime=this.d.time;this.audio.play().catch(()=>{});}else this.audio.muted=!this.audio.muted;this.refreshUI();};
    }
    tick(dt){const d=this.d;if(this.comparison)return;if(!d.active||d.paused||!Number.isFinite(dt)||dt<=0)return;let remaining=Math.min(dt,this.duration-d.time);while(remaining>1e-8){const step=Math.min(1/60,remaining);d.time=Math.min(this.duration,d.time+step);this.time=d.time;this.step(step);remaining-=step;}this.refreshUI();}
    place(a,position,dt){
      const [x,y,z,angle]=position,prior={x:a.x,z:a.z,angle:a.angle},velocity=a.velocity||{x:0,z:0};
      // Swept center/door-volume check. No actor may cross a closing door.
      const near=Math.min(a.z,z)<=.08+a.radius&&Math.max(a.z,z)>=-.08-a.radius;
      if(dt&&near&&(Math.abs(x)+a.radius>this.set.door.clearWidth/2||this.set.door.openAmount<.97)){this.facts.doorViolations.push({time:this.time,name:a.name,door:this.set.door.openAmount});return;}
      a.x=x;a.y=y;a.z=z;a.angle=angle;a.v=dt?Math.hypot(x-prior.x,z-prior.z)/dt:0;a.velocity=dt?{x:(x-prior.x)/dt,z:(z-prior.z)/dt}:{x:0,z:0};a.acceleration=dt?{x:clamp((a.velocity.x-velocity.x)/dt,-1.5,1.5),z:clamp((a.velocity.z-velocity.z)/dt,-1.5,1.5)}:{x:0,z:0};a.turn=dt?Math.atan2(Math.sin(angle-prior.angle),Math.cos(angle-prior.angle))/dt:0;a.model.position.set(x,y,z);a.model.rotation.set(0,angle,0);a.model.updateMatrixWorld(true);
    }
    stepAmbient(dt,time){if(!Number.isFinite(time)||time<=82)return;for(const actor of this.actors)C.animateStationFilmAmbient?.(actor.model,time);this.branchController?.stepAmbient?.(dt,time);this.ambientTime=time;}
    step(dt){
      if(this.branchController&&this.time>=27){this.branchController.step(dt);this.setCamera(this.branchController.shots||this.shots);return;}
      const t=this.time,f=this.facts,[lead,p]=this.actors,r=this.robot,targets=this.set.targets,isolated=this.variant==='isolate';
      let open=t<9?1:t<12?1-ramp(t,9,12):t<33?0:t<36.5?ramp(t,33,36.5):t<63?1:t<66?1-ramp(t,63,66):0;
      if(t>=12&&isolated||t>=33&&!f.authorization)open=0;
      // Closing waits for the entire body envelope to clear the threshold.
      if(open<this.set.door.openAmount&&[lead,p,r].some(a=>Math.abs(a.z)<a.radius+.23))open=this.set.door.openAmount;
      this.set.update(t,{doorOpen:open,alarm:t>=7&&(isolated||t<67)?1:.05,contained:!isolated&&t>=67,sampleFault:t>=7});
      const route=isolated&&t>=27?isolationPaths:paths;this.place(r,track(route.robot,t),dt);this.place(lead,track(route.lead,t),dt);this.place(p,track(route.patient,t),dt);if(isolated&&t>=51)p.model.rotation.z=.28*ramp(t,51,67);
      let ra=t<7?'scan':t<27?'report':t<33?'work':t<37?'guard':t<43?'move':t<48?'yield':t<60?'move':t<66?'yield':t<71?'work':'report';
      r.status=t<7?'扫描样本，待命':t<22?'隔离告警 · 保持语音联络':t<27?'等待林岚确认开门风险':t<33?'建立局部防护气流':t<37?'等待门叶完全打开':t<43?'低速靠近，展开救援把手':t<48?'等待江月抓稳蓝色把手':t<60?'牵引患者 · 限速通过门框':t<66?'确认通道清空 · 封闭污染侧':t<71?'接触式腕部监测':t<79?'体征恢复 · 继续共同隔离':'保持通话与生命监测';
      if(isolated&&t>=27){ra=t<36?'move':t<54?'scan':'report';r.status=t<36?'保持隔离门锁 · 接近观察窗':t<49?'透过观察窗监测 · 无接触护理':t<56?'反应减弱 · 请求人工授权进入':t<67?'未获进入授权 · 持续呼叫患者':'患者失去回应 · 保留通话记录';}
      C.animateOrbitalRobot(r.model,t,{action:ra,speed:r.v,thrust:{x:Math.cos(r.angle)*r.acceleration.x-Math.sin(r.angle)*r.acceleration.z,y:0,z:Math.sin(r.angle)*r.acceleration.x+Math.cos(r.angle)*r.acceleration.z},turn:r.turn,dt:dt||1/60,target:{x:0,y:.2,z:1}});
      const restPoint=(a,side)=>a.model.localToWorld(v([(a.model.userData.stationMotion?.armRest[side]?.out||(side==='left'?1:-1))*.21,1.12,.17]));
      const restingHands=a=>Object.fromEntries(['left','right'].map(side=>[side,{position:restPoint(a,side),free:true,weight:0,grip:.15}]));
      const contact=(a,side,point,normal,weight=1,grip=0,distance=.115)=>{const target=C.stationFilmContactTarget(a.model,side,point,normal,distance);return{...target,weight,grip};};
      const pHands=restingHands(p),lHands=restingHands(lead);let pa=t<6.5?'listen':t<12?'cough':t<43?'weak':t<60?'weak':t<66?'float':'steady',la=t<22?'listen':t<27?'listen':t<32?'press':t<49?'float':t<61?'beckon':t<71?'steady':'listen';
      if(t>=6.5&&t<12)delete pHands.right;
      if(t<6.5){pHands.right=contact(p,'right',targets.sampleLatch,[0,0,1],ramp(t,0,1),.2,.14);pHands.left=contact(p,'left',targets.sampleHandle,[0,0,1],1,.8,.09);}
      if(t>=6.5&&t<9){pHands.left=contact(p,'left',targets.sampleHandle,[0,0,1],1,.3,.09+.18*ramp(t,6.5,7.1));if(t>=7.1)pHands.left.position.lerp(p.model.localToWorld(v([.28,.98,.04])),ramp(t,7.1,8.6));}
      if(t>=16&&t<23.5){pHands.left=contact(p,'left',targets.labWindowPalm,[0,0,-1],ramp(t,16,17),0,.135);if(t>=21.2)pHands.left.position.add(v([0,0,-.25*ramp(t,21.2,22.4)]));if(t>=22.4)pHands.left.position.lerp(restPoint(p,'left'),ramp(t,22.4,23.5));}
      if((t>=19&&t<21.5)||(t>=27&&t<31.8))lHands.right=contact(lead,'right',targets.consoleButton,[0,0,1],ramp(t,t<22?19:27,t<22?19.6:27.7),.2,.22);
      if(t>=21.5&&t<27){lHands.right=contact(lead,'right',targets.consoleButton,[0,0,1],1,.1,.22);lHands.right.position.add(v([.18*ramp(t,21.5,22.3),0,.13*ramp(t,21.5,22.3)]));if(t>=22.3)lHands.right.position.lerp(lead.model.localToWorld(v([-.38,.95,-.025])),ramp(t,22.3,23.5));}
      if(!isolated&&t>=37&&t<53)lHands.right=contact(lead,'right',targets.doorHandrailNear,[0,0,1],ramp(t,37,38),.9,.10);
      if(!isolated&&t>=43&&t<60.5)pHands.right={...C.stationFilmContactTarget(p.model,'right',C.stationFilmRobotGrip(r.model,'rear'),v([0,0,-1]),.105),weight:ramp(t,43,44),grip:.7};
      if(!isolated&&t>=66){pHands.left=contact(p,'left',targets.careGripLeft,[0,0,-1],ramp(t,66,67),.9,.07);pHands.right={position:v([-1.20,1.65,2.60]),weight:ramp(t,66,67),grip:.2};}
      if(isolated&&t>=27){pa=t<36?'weak':t<51?'reach':'unresponsive';la=t<32?'press':t<39?'float':'reach';if(t>=36)pHands.left=contact(p,'left',targets.labWindowPalm,[0,0,-1],ramp(t,36,37));if(t>=39)lHands.left=contact(lead,'left',targets.careWindowPalm,[0,0,1],ramp(t,39,40));f.remoteMonitoring=t>=37;f.patientResponsive=t<55;}else f.patientResponsive=true;
      C.animateStationFilmActor(lead.model,t,{action:la,speed:lead.v,lookAt:p.model.position.clone().add(v([0,1.5,0])),handTargets:lHands});
      C.animateStationFilmActor(p.model,t,{action:pa,speed:isolated&&t>=36||!isolated&&t>=43&&t<60.5?0:p.v,lean:!isolated&&t>=43&&t<60.5?.10:t>=7&&t<12?.16:0,restHandOffsets:{right:[0,0,-.03*ramp(t,15,16)*(1-ramp(t,22,23))]},lookAt:isolated&&t>=51?undefined:t<12?targets.sampleWork:t<32||isolated?lead.model.position.clone().add(v([0,1.5,0])):r.model.position.clone().add(v([0,.5,0])),handTargets:pHands});
      lead.action=la;p.action=pa;
      if(!isolated&&t>=66&&t<72){const wrist=C.stationFilmHandPosition(p.model,'right');const contact=C.reachStationFilmRobot(r.model,'right',wrist,1);f.robotContact=contact?{error:contact.error,reachable:contact.reachable}:null;if(contact?.error<.05){f.monitorContactSeconds=(f.monitorContactSeconds||0)+dt;}}
      for(const a of this.actors)for(const [side,c]of Object.entries(a.model.userData.filmContacts||{})){if(c.weight>.95)f.contacts[a.name+'-'+side]={error:c.error,reachable:c.reachable,time:t};}
      if(t>=28&&t<32&&lead.model.userData.filmContacts?.right?.error<.05){f.authorizationHeld=(f.authorizationHeld||0)+dt;if(f.authorizationHeld>.7){f.authorization=true;f.authorizedAt??=t;}}
      if(!isolated&&t>=44&&t<49&&p.model.userData.filmContacts?.right?.error<.05)f.gripConfirmed=true;
      if(t>49&&p.z>.55)f.patientCrossed=true;if(t>45&&lead.z>.55)f.receiverReady=true;
      f.treatmentComplete=(f.monitorContactSeconds||0)>1.5;f.doorOpen=open;f.robotStatus=r.status;
      if(t>=79&&isolated)this.d.outcome={code:'isolated-unresponsive',title:'隔离维持，患者失去回应',detail:'无人跨越舱门。远程观察未能替代接触式护理，通话仍然开启。'};else if(t>=79)this.d.outcome={code:f.treatmentComplete?'treated':'observation',title:f.treatmentComplete?'江月被接回来了，两人一起隔离':'江月被接回来了，监测仍在继续',detail:'实体隔离门关闭。患者与接应者保持沟通，等待进一步诊断。'};
      this.setCamera(this.shots);
    }
    setCamera(shots=this.shots){const t=this.time,shot=shots.find(s=>t>=s.start&&t<s.end)||shots.at(-1);this.shot=shot;const drift=ramp(t,shot.start,shot.end);this.camera.position.fromArray(shot.position).add(v([-.1*drift,.025*drift,.07*drift]));this.camera.lookAt(...shot.target);this.camera.fov=shot.fov;this.camera.updateProjectionMatrix();}
    narrative(){return{stage:this.shot?.name||'',caption:this.dialogue.find(d=>this.time>=d.start&&this.time<d.end)?.text||this.robot.status};}
    refreshUI(){if(!this.ui)return;this.ui.querySelectorAll('[data-film-choice]').forEach(b=>{b.disabled=this.time>=27;b.setAttribute('aria-pressed',String(b.dataset.filmChoice===this.variant));});this.ui.querySelector('.st-film-end small').textContent=this.variant==='isolate'?'结局 B / 维持隔离':'结局 A / 接出患者';this.ui.querySelector('.st-film-end h2').textContent=this.ending.title;this.ui.querySelector('.st-film-end p').textContent=this.ending.detail;const d=this.d,line=this.dialogue.find(a=>this.time>=a.start&&this.time<a.end);this.ui.querySelector('[data-film-chapter]').textContent=this.shot.name;this.ui.querySelector('.st-film-caption small').textContent=line?.speaker||'';this.ui.querySelector('.st-film-caption p').textContent=line?.text||'';this.ui.querySelector('.st-film-robot b').textContent=this.robot.status;this.ui.querySelector('.st-film-end').hidden=this.time<80.5;this.ui.querySelector('.st-film-timeline i').style.width=this.time/this.duration*100+'%';this.ui.querySelector('[data-film-pause]').textContent=d.paused?'继续':'暂停';this.ui.querySelector('[data-film-audio]').textContent=this.audioBlocked?'点击开启声音':this.audio?.muted?'声音关闭':'声音开启';
      if(this.audio?.readyState>=1&&!d.options.manual){if(d.paused||this.time>=this.duration)this.audio.pause();else if(this.audio.paused&&!this.audioBlocked)this.audio.play().catch(()=>{this.audioBlocked=true;});if(Math.abs(this.audio.currentTime-this.time)>.65)this.audio.currentTime=this.time;}
    }
    render(){const renderer=this.s.v.renderer,canvas=renderer.domElement;this.camera.aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);this.camera.updateProjectionMatrix();renderer.toneMappingExposure=1.05;renderer.render(this.scene,this.camera);}
    exportPlan(){return{title:this.title,variant:this.variant,branchId:this.branchId,ending:this.ending,duration:this.duration,dialogue:this.dialogue,shots:this.shots,events:this.events,...this.branchController?.exportPlan?.()};}
    snapshot(){if(this.comparison)return{active:this.d.active,film:true,comparison:true,title:this.title,scenario:'infection',time:this.comparison.video.currentTime,duration:82,paused:this.comparison.video.paused,caption:'同一抉择，两个结局：接出患者 / 维持隔离'};return{active:this.d.active,film:true,title:this.title,scenario:'infection',variant:this.variant,branchId:this.branchId,time:+this.time.toFixed(4),duration:this.duration,paused:this.d.paused,shot:this.shot.name,...this.narrative(),options:{...this.d.options},doorOpen:this.set.door.openAmount,crew:this.actors.map(a=>({name:a.name,x:a.x,y:a.y,z:a.z,action:a.action})),robot:{x:this.robot.x,y:this.robot.y,z:this.robot.z,status:this.robot.status},facts:{...this.facts},outcome:this.d.outcome,...this.branchController?.snapshot?.()};}
    choose(variant){if(this.time>=27)throw Error('这一决定已执行。重播后可在27秒前切换结局。');if(!['rescue','isolate'].includes(variant))throw Error('完整短片可选择“接出患者”或“维持隔离”。');this.configure(variant);this.d.options.variant=this.variant;if(this.audio&&!this.d.options.manual)this.bindAudio();this.refreshUI();return{message:'已选择'+(variant==='isolate'?'维持隔离':'接出患者')+'，将在第27秒执行。'};}
    openComparison(){if(this.comparison)return;const wasPaused=this.d.paused;this.d.pause();const root=document.createElement('section');root.className='st-film-comparison';root.innerHTML='<video controls playsinline preload="metadata" aria-label="请别把我关起来双结局对照"></video><button>返回互动预演</button>';document.body.append(root);const video=root.querySelector('video');this.comparison={root,video,wasPaused};root.querySelector('button').onclick=()=>{video.pause();root.remove();this.comparison=null;this.d.paused=wasPaused;this.refreshUI();};this.mediaSource('assets/media/station-film-comparison/two-outcomes.mp4').then(source=>{if(this.disposed||this.comparison?.video!==video)return;video.src=source;video.play().catch(()=>{});}).catch(()=>{if(this.comparison?.video===video){const error=document.createElement('p');error.className='st-film-media-error';error.textContent='影片暂时无法读取，请返回后重试。';root.append(error);}});}
    dispose(){this.disposed=true;this.branchController?.dispose?.();this.mediaAbort.abort();for(const url of this.mediaUrls)URL.revokeObjectURL(url);if(this.comparison){this.comparison.video.pause();this.comparison.root.remove();this.comparison=null;}this.audio?.pause();if(this.audio){this.audio.removeAttribute('src');this.audio.load();}this.ui?.remove();for(const a of this.actors)C.disposeModel(a.model);C.disposeModel((this.initialRobot||this.robot).model);this.set.dispose();if(!this.headless){delete document.body.dataset.stationFilm;document.body.classList.remove('st-film-chat-open');}const d=this.d;d.stageActors=[];d.robot=null;if(!this.headless&&d.saved){this.s.v.controls.enabled=d.saved.controls;this.s.v.renderer.toneMappingExposure=d.saved.exposure;d.saved=null;}}
  }
  C.StationFilm=StationFilm;
})();
