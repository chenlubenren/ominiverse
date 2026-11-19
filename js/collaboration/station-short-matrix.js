/* The shared thirty-second template: one incident, twelve worlds, one return. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,clamp=T.MathUtils.clamp,ease=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
  const sourceTime=t=>t<=6?t*4/3:t<=8?8+t-6:t<=23?10+(t-8)*1.2:28+t-23;
  const robotIcon=role=>role==='science'?'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M3 9v6M21 9v6M9 11h1m4 0h1M10 16h4"/></svg>':role==='medical'?'<svg viewBox="0 0 24 24"><path d="M4 14a8 8 0 0 1 16 0ZM7 14l-2 6m7-6v7m5-7 2 6M12 5v6m-3-3h6"/></svg>':'<svg viewBox="0 0 24 24"><path d="M5 12a7 7 0 0 1 14 0ZM6 13l-3 3 2 4m13-7 3 3-2 4M9 13l-1 7m7-7 1 7"/></svg>';
  class StationShortMatrix {
    constructor(d){this.d=d;this.s=d.s;this.children=[];this.time=0;this.duration=30;this.splitAt=6;this.expandUntil=8;this.mergeAt=23;this.mergeEnd=25;this.axisEnd=28;this.selectedEnding=11;this.focus=null;this.urls=new Set();}
    start(options={}){
      this.options=options;this.id=options.shortFilm||'water';const story=C.stationShortStories.find(s=>s.id===this.id);if(!story)throw Error('未找到这个空间站故事');
      this.title=story.title+' · 十二宇宙';this.catalog=C.stationShortBranches;if(this.catalog?.length!==12)throw Error('十二宇宙配置尚未准备好');
      const d=this.d;d.options={...options,manual:!!options.manual};d.active=true;d.loading=true;d.paused=false;d.time=0;d.duration=30;d.story={title:this.title};d.outcome=null;d.ui.hidden=true;
      this.saved={controls:this.s.v.controls.enabled,exposure:this.s.v.renderer.toneMappingExposure};this.s.v.controls.enabled=false;document.body.dataset.stationStory='playing';document.body.dataset.stationFilm='short-matrix';
      for(const spec of this.catalog){const childD={s:this.s,o:this.s.o,ui:{hidden:true},options:{},active:true,paused:false,time:0},film=new C.StationShortFilm(childD);childD.film=film;this.children.push({spec,d:childD,film});film.start({shortFilm:this.id,scenario:'visitor',manual:true,headless:true,branch:spec});}
      // Reuse the established extraction template and its actual web models.
      C.StationFilmMatrix.prototype.prepareExtraction.call(this);
      this.prepareObservationCutaway();
      d.camera=this.children[0].film.camera;this.makeUI();d.loading=false;this.refreshUI();this.render();return this.snapshot();
    }
    tick(dt){
      if(this.comparison||this.d.paused||!this.d.active||!Number.isFinite(dt)||dt<=0)return;
      let remaining=Math.min(dt,this.duration-this.time);
      while(remaining>1e-8){const step=Math.min(1/60,remaining),before=sourceTime(this.time);this.time=Math.min(this.duration,this.time+step);for(const edge of [6,8,23,25,28,30])if(Math.abs(this.time-edge)<1e-7)this.time=edge;
        const t=sourceTime(this.time),delta=t-before;this.d.time=this.time;
        for(const child of this.children){child.film.time=child.d.time=t;child.film.step(delta);this.frameBranch(child,t);}
        if(this.time>=this.mergeAt)this.focus=null;remaining-=step;
      }
      if(this.time>=this.mergeEnd){C.StationFilmMatrix.prototype.updateEndingCamera.call(this);this.prepareOrtho();}
      if(this.observationCut)this.observationCut.value=ease((this.time-25.7)/2.3)*.88;
      if(this.time>=this.duration)this.d.outcome=this.children[this.selectedEnding].film.branchController?.snapshot?.().outcome||{title:this.title};
      this.refreshUI();
    }
    prepareOrtho(){
      if(!this.axisOrtho)this.axisOrtho=new T.OrthographicCamera(-9,9,5.0625,-5.0625,.035,2200);
      this.axisOrtho.position.copy(this.axisCamera.position);this.axisOrtho.quaternion.copy(this.axisCamera.quaternion);this.axisOrtho.updateMatrixWorld(true);
    }
    frameBranch(child,t){
      if(this.time<8||this.time>=23||!['water','visitor'].includes(this.id))return;
      const f=child.film,contained=this.id==='visitor'&&f.facts.resultFlags['visitor-contained'],close=contained?ease((this.time-17)/1.5):0,k=ease((t-10)/2.5)*(1-close),position=new T.Vector3(-.12+.05*Math.sin(t*.28),2.50,-.36),target=new T.Vector3(.35,1.66,this.id==='visitor'?-2.85:-2.55);
      f.camera.position.lerp(position,k);const old=f.camera.position.clone().addScaledVector(f.camera.getWorldDirection(new T.Vector3()),3);f.camera.lookAt(old.lerp(target,k));f.camera.fov+= (76-f.camera.fov)*k;f.camera.updateProjectionMatrix();f.camera.updateMatrixWorld(true);
    }
    prepareObservationCutaway(){
      const f=this.children[this.selectedEnding].film,uniform=this.observationCut={value:0},seen=new Set();
      f.set.root.traverse(node=>{if(!node.isMesh||node.isInstancedMesh||node.userData.filmBorrowed||node.userData.keepObservationOpaque)return;for(const mat of Array.isArray(node.material)?node.material:[node.material]){if(seen.has(mat)||!mat.isMeshStandardMaterial||mat.userData.keepObservationOpaque)return;seen.add(mat);const prior=mat.onBeforeCompile;mat.transparent=true;mat.onBeforeCompile=shader=>{prior?.(shader);shader.uniforms.observerCut=uniform;shader.vertexShader='varying vec3 shortFilmWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nshortFilmWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');shader.fragmentShader='varying vec3 shortFilmWorld; uniform float observerCut;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\nfloat wallSection=(1.0-step(0.30,abs(shortFilmWorld.z)))*step(0.36,shortFilmWorld.y);gl_FragColor.a*=1.0-observerCut*wallSection;');};mat.needsUpdate=true;}});
    }
    cellRect(index,w,h){const gap=Math.max(4,w*.003),cw=(w-5*gap)/4,ch=Math.min(cw*9/16,(h-4*gap)/3),top=(h-(ch*3+gap*2))/2;return{x:gap+index%4*(cw+gap),y:top+Math.floor(index/4)*(ch+gap),w:cw,h:ch};}
    draw(child,rect,reveal=null){
      const r=this.s.v.renderer,canvas=r.domElement,W=canvas.clientWidth,H=canvas.clientHeight;
      r.setViewport(rect.x,H-rect.y-rect.h,rect.w,rect.h);r.setScissor(rect.x,H-rect.y-rect.h,rect.w,rect.h);r.clear(true,true,true);
      const ending=this.time>=this.mergeEnd&&child===this.children[this.selectedEnding],camera=ending?(this.time>=this.axisEnd?this.axisOrtho:this.axisCamera):child.film.camera;
      if(camera.isOrthographicCamera){const half=9;camera.left=-half;camera.right=half;camera.top=half*rect.h/rect.w;camera.bottom=-camera.top;}else camera.aspect=rect.w/rect.h;camera.updateProjectionMatrix();
      if(ending&&this.time<this.axisEnd){const k=ease((this.time-this.mergeEnd)/(this.axisEnd-this.mergeEnd)),o=this.axisOrtho;o.left=-9;o.right=9;o.top=9*rect.h/rect.w;o.bottom=-o.top;o.updateProjectionMatrix();for(let i=0;i<16;i++)camera.projectionMatrix.elements[i]+=(o.projectionMatrix.elements[i]-camera.projectionMatrix.elements[i])*k;camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();}
      if(reveal!==null&&reveal<1){const full=new T.PerspectiveCamera(camera.fov,W/H,camera.near,camera.far);full.setViewOffset(W,H,rect.x,rect.y,rect.w,rect.h);for(let i=0;i<16;i++)camera.projectionMatrix.elements[i]=full.projectionMatrix.elements[i]+(camera.projectionMatrix.elements[i]-full.projectionMatrix.elements[i])*reveal;camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();}
      r.render(child.film.scene,camera);
    }
    render(){
      if(!this.children.length)return;const r=this.s.v.renderer,c=r.domElement,w=c.clientWidth,h=c.clientHeight,auto=r.autoClear;r.toneMappingExposure=1.05;r.autoClear=false;r.setScissorTest(false);r.setViewport(0,0,w,h);r.setClearColor('#050e17',1);r.clear(true,true,true);r.setScissorTest(true);
      try{
        if(this.time<this.splitAt)this.draw(this.children[0],{x:0,y:0,w,h});
        else if(this.time>=this.mergeAt){const k=ease((this.time-this.mergeAt)/(this.mergeEnd-this.mergeAt));if(k<1)for(let i=0;i<12;i++)if(i!==this.selectedEnding)this.draw(this.children[i],this.cellRect(i,w,h));const base=this.cellRect(this.selectedEnding,w,h);this.draw(this.children[this.selectedEnding],{x:base.x*(1-k),y:base.y*(1-k),w:base.w+(w-base.w)*k,h:base.h+(h-base.h)*k});}
        else if(this.focus!==null)this.draw(this.children[this.focus],{x:0,y:0,w,h});
        else{const k=ease((this.time-this.splitAt)/(this.expandUntil-this.splitAt));for(let i=0;i<12;i++)this.draw(this.children[i],this.cellRect(i,w,h),k);}
      }finally{r.setScissorTest(false);r.setViewport(0,0,w,h);r.autoClear=auto;}
    }
    makeUI(){
      const root=this.ui=document.createElement('section');root.className='st-short-matrix-ui';root.setAttribute('aria-label','十二宇宙短片');root.innerHTML='<div class="st-short-matrix-title"><small>ORBITAL MULTIVERSE / 12</small><h2></h2></div><nav class="st-short-matrix-controls"></nav><div class="st-short-matrix-cells"></div><div class="st-short-matrix-clock"><i></i></div>';root.querySelector('h2').textContent=this.title;
      const nav=root.querySelector('nav'),select=document.createElement('select');select.setAttribute('aria-label','选择平行宇宙故事');for(const s of C.stationShortStories){const o=document.createElement('option');o.value=s.id;o.textContent=s.title;o.selected=s.id===this.id;select.append(o);}select.onchange=()=>this.d.play({scenario:'visitor',shortFilm:select.value});nav.append(select);
      for(const [key,label,fn]of [['focus','返回12分屏',()=>{this.focus=null;this.refreshUI();}],['pause','暂停',()=>this.d.paused?this.d.resume():this.d.pause()],['replay','重播',()=>this.d.play({scenario:'visitor',shortFilm:this.id})],['video','观看成片',()=>this.openVideo()],['exit','返回空间站',()=>this.d.stop()]]){const b=document.createElement('button');b.dataset.shortMatrixControl=key;b.textContent=label;b.onclick=fn;nav.append(b);}
      this.cards=this.children.map(({spec},index)=>{const b=document.createElement('button');b.className='st-short-matrix-cell';b.dataset.universe=index+1;b.setAttribute('aria-label','放大第'+(index+1)+'宇宙：'+spec.name);b.innerHTML='<span class="st-short-matrix-badge"><i>'+String(index+1).padStart(2,'0')+'</i>'+spec.roles.map(robotIcon).join('')+'</span>';b.onclick=()=>this.choose(index+1);root.querySelector('.st-short-matrix-cells').append(b);return b;});document.body.append(root);
    }
    refreshUI(){
      if(!this.ui)return;const c=this.s.v.renderer.domElement,w=c.clientWidth,h=c.clientHeight,appear=ease((this.time-6)/2),merge=ease((this.time-23)/2);
      this.ui.querySelector('.st-short-matrix-title').style.opacity=String(1-ease((this.time-1.5)/.8));this.ui.querySelector('[data-short-matrix-control="pause"]').textContent=this.d.paused?'继续':'暂停';this.ui.querySelector('[data-short-matrix-control="focus"]').hidden=this.focus===null;
      this.cards.forEach((card,i)=>{const rect=this.cellRect(i,w,h);if(this.time>=23&&i===this.selectedEnding){rect.x*=1-merge;rect.y*=1-merge;rect.w+=(w-rect.w)*merge;rect.h+=(h-rect.h)*merge;}Object.assign(card.style,{left:rect.x+'px',top:rect.y+'px',width:rect.w+'px',height:rect.h+'px',opacity:String(appear*(1-merge)),pointerEvents:this.time>=8&&this.time<23?'auto':'none'});card.hidden=this.time<6||this.time>=25||this.focus!==null;});this.ui.querySelector('.st-short-matrix-clock i').style.width=this.time/30*100+'%';
    }
    narrative(){return{stage:this.time<6?'同一事故':this.time<8?'分裂十二宇宙':this.time<23?'十二种人机协作':this.time<25?'汇回第十二宇宙':this.time<28?'回到轴测观察':'同一空间站',caption:''};}
    choose(value){const index=Number(value)-1;if(this.time<8||this.time>=23||index<0||index>11)throw Error('请在十二分屏出现时选择一个宇宙');this.focus=index;this.refreshUI();this.render();return{message:'正在观察第'+value+'宇宙'};}
    snapshot(){return{active:this.d.active,paused:this.d.paused,film:true,matrixFilm:true,shortMatrix:true,shortFilm:this.id,title:this.title,time:+this.time.toFixed(4),duration:30,splitAt:6,expandUntil:8,mergeAt:23,mergeEnd:25,axisEnd:28,focused:this.focus,visibleWindows:this.time<6||this.time>=25||this.focus!==null?1:12,merging:this.time>=23&&this.time<25,axonometric:this.time>=28,projectionType:this.time>=28?'orthographic':'perspective',selectedEnding:11,...this.narrative(),extraction:{sourceModuleId:this.extraction?.sourceModuleId,reusesStoryScene:true},branches:this.children.map(({spec,film})=>({...film.snapshot(),branchId:spec.id,robotCount:spec.count,roles:spec.roles,...film.branchController?.snapshot?.()})),outcome:this.d.outcome};}
    exportPlan(){return{title:this.title,id:this.id,duration:30,resolution:[1920,1080],fps:30,audio:false,splitAt:6,expandUntil:8,mergeAt:23,mergeEnd:25,axisEnd:28,selectedEnding:11,branches:this.catalog,dialogue:[],shots:[{start:0,end:3,name:'共同起点'},{start:3,end:6,name:'事故升级'},{start:6,end:8,name:'人视角裂成十二宇宙'},{start:8,end:13,name:'不同机器人介入'},{start:13,end:18,name:'不同协作过程'},{start:18,end:23,name:'不同结果'},{start:23,end:25,name:'十二路汇回一个世界'},{start:25,end:28,name:'抽出舱段 / 视角转换'},{start:28,end:30,name:'轴测观察'}]};}
    async openVideo(){if(this.comparison)return;const wasPaused=this.d.paused;this.d.pause();const root=document.createElement('section');root.className='st-film-comparison';root.innerHTML='<video controls playsinline></video><button>返回十二宇宙</button>';document.body.append(root);const video=root.querySelector('video');video.setAttribute('aria-label',this.title);this.comparison={root,video,wasPaused};root.querySelector('button').onclick=()=>{video.pause();root.remove();this.comparison=null;this.d.paused=wasPaused;};try{const res=await fetch('assets/media/station-short-matrix/'+this.id+'.mp4');if(!res.ok)throw Error();const url=URL.createObjectURL(new Blob([await res.arrayBuffer()],{type:'video/mp4'}));if(this.disposed){URL.revokeObjectURL(url);return;}this.urls.add(url);video.src=url;video.play().catch(()=>{});}catch{root.querySelector('button').textContent='成片尚未就绪 · 返回十二宇宙';}}
    dispose(){this.disposed=true;this.comparison?.video.pause();this.comparison?.root.remove();this.ui?.remove();if(this.extraction){this.extraction.root.parent?.remove(this.extraction.root);for(const {mat}of this.extraction.materials)mat.dispose();}for(const child of this.children)child.film.dispose();this.children=[];for(const url of this.urls)URL.revokeObjectURL(url);const r=this.s.v.renderer;r.setScissorTest(false);r.setViewport(0,0,r.domElement.clientWidth,r.domElement.clientHeight);this.s.v.controls.enabled=this.saved.controls;r.toneMappingExposure=this.saved.exposure;delete document.body.dataset.stationFilm;this.d.stageActors=[];this.d.robot=null;}
  }
  C.StationShortMatrix=StationShortMatrix;
})();
