/* Live, rule-based architectural evolution with validation and explicit adoption. */
(() => {
 'use strict';const L=window.IndoorLab,$=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x));
 function connectedNear(grid,nav,point,radius){
  const origin=grid.index(point.x,point.z);
  if(origin<0)return false;
  const row=Math.floor(origin/grid.cols),col=origin%grid.cols,reach=Math.ceil(radius/grid.cell);
  for(let y=Math.max(0,row-reach);y<=Math.min(grid.rows-1,row+reach);y++){
   for(let x=Math.max(0,col-reach);x<=Math.min(grid.cols-1,col+reach);x++){
    const i=y*grid.cols+x;if(nav.component[i]!==nav.largest||!nav.valid[i])continue;
    const p=grid.point(i);
    if(Math.hypot(p.x-point.x,p.z-point.z)<=radius)return true;
   }
  }
  return false;
 }
 class MatrixEvolution {
  constructor(building){this.b=building;this.active=false;this.busy=false;this.generation=0;this.accepted=0;this.rejected=0;this.randomState=(Date.now()>>>0)||1;this.originalHomeSeats=new Map(building.society.agents.map(a=>[a.id,a.homeSeat]));this.envelope=new L.ParametricEnvelope(building);this.status=document.createElement('div');this.status.id='matrix-status';this.status.setAttribute('role','status');this.status.hidden=true;building.ui.appendChild(this.status);$('building-reset-camera').onclick=()=>this.toggle();if(L.matrixDesign.envelope)this.applyEnvelope(L.matrixDesign.envelope);this.sync();}
  random(){this.randomState=(this.randomState*1664525+1013904223)>>>0;return this.randomState/4294967296;}
  sync(){
   const button=$('building-reset-camera'),mode=this.b.exploded?'随机布局':'随机立面',stats=this.envelope.stats,names={vertical:'竖向条带',diagrid:'斜交网格',braid:'编织曲线',stagger:'错位条带',horizontal:'横向条带',mixed:'混合条带'};
   button.textContent=this.active?'■ 停止并采用':mode;button.title=this.b.exploded?'持续演化室内布局，再次点击停止并采用':'持续演化建筑立面参数，再次点击停止并采用';button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(this.active));button.disabled=this.busy;
   this.status.hidden=!this.active&&!this.busy;
   const detail=this.mode==='layout'?' · 全楼同步 '+this.generation+' 轮 / 准备 '+(this.pending?.size||0)+'/30 层':stats?' · '+names[stats.pattern]+' / 底部 '+stats.podiums+' · 悬挑 '+stats.cantilevers+' · 屋顶 '+stats.rooftops:'';
   this.status.textContent=this.busy?'正在采用当前空间…':`${this.mode==='layout'?'空间':'立面'}矩阵 · GEN ${String(this.generation).padStart(3,'0')}${detail}`;
  }
  async toggle(){if(this.busy)return;if(this.active)return this.stop();if(this.b.phase==='interior')return;this.mode=this.b.exploded?'layout':'envelope';this.active=true;this.wasRunning=this.b.society.running;this.b.app.clearDisaster();this.b.app.play(false);this.b.society.running=false;this.generation=0;this.accepted=0;this.rejected=0;this.discardPending();this.nextAt=0;if(this.mode==='envelope')this.b.closeDrawer();this.sync();}
  update(now){
   if(!this.active||this.busy||now<this.nextAt)return;
   if(this.mode==='layout'){this.prepareCohort();return;}
   this.nextAt=now+180;this.generation++;this.applyEnvelope(this.envelope.random(()=>this.random()));this.sync();
  }
  discardPending(){if(this.pending)for(const p of this.pending.values())L.dispose(p.model.group);this.pending=null;this.preparingFloor=1;}
  prepareCohort(){
   this.pending??=new Map();this.preparingFloor??=1;
   const started=performance.now();let made=0;
   while(this.preparingFloor<=30&&(made===0||made<7&&performance.now()-started<20)){
    const f=this.preparingFloor,old=L.matrixDesign.floors[f],plan=L.randomFloorPlan(f,()=>this.random()),base=L.towerFloorSpec(f),gene={central:base.central,rooms:base.rooms,plan};let model;
    L.matrixDesign.floors[f]=gene;
    try{
     model=L.makeTowerFloor(f,{preview:true,shell:false});const required=this.b.society.agents.filter(a=>!a.isPlayer&&a.homeFloor===f).length,g=L.officeFastGrid(model),nav=g.nav(.24);
     const usable=p=>g.isClear(p.x,p.z,.24)&&connectedNear(g,nav,p,.21);
     const valid=model.features.filter(q=>q.doorApproach).every(q=>usable(q.doorApproach))
      &&model.seats.length>=required&&model.goals.every(usable)
      &&model.seats.every(s=>connectedNear(g,nav,s.approach,.75));
     if(!valid)throw Error('layout constraint');
     this.pending.set(f,{model,gene});this.preparingFloor++;
    }catch(error){if(model)L.dispose(model.group);this.rejected++;}
    finally{if(old)L.matrixDesign.floors[f]=old;else delete L.matrixDesign.floors[f];}made++;
   }
   if(this.pending.size===30){
    const old=[];for(const [f,p]of this.pending){L.matrixDesign.floors[f]=p.gene;old.push(this.replaceFloor(f,p.model,false));}
    this.b.batchTower();for(const group of old)L.dispose(group);this.pending=null;this.preparingFloor=1;this.generation++;this.accepted+=30;this.nextAt=performance.now()+80;
   }
   this.sync();
  }
  replaceFloor(f,model,batch=true){
   const b=this.b,plate=b.plates[f-1],old=plate.model,oldGroup=plate.inside;model.group.position.y=.17;model.group.traverse(o=>{if(o.material)o.material.fog=true;if(o.isMesh)o.castShadow=false;});b.applyThemeToFloor(model);const current=b.view.model;b.view.model=model;b.view.pipeline.setStyle(b.view.pipeline.style);b.view.model=current;plate.group.remove(oldGroup);plate.group.add(model.group);plate.inside=model.group;plate.model=model;model.aoVersion=(old.aoVersion||0)+1;b.matrixEpoch=(b.matrixEpoch||0)+1;if(batch){b.batchTower();L.dispose(oldGroup);}b.view.shadowDirty=true;return oldGroup;
  }
  async restoreDefaults(){
   if(this.busy)return;this.active=false;this.discardPending();this.busy=true;this.sync();const b=this.b;b.app.clearDisaster();b.society.running=false;
   try{
    L.matrixDesign={floors:{},envelope:null};this.envelope.restore();const old=[];for(let f=1;f<=30;f++)old.push(this.replaceFloor(f,L.makeTowerFloor(f,{preview:true,shell:false}),false));b.batchTower();for(const group of old)L.dispose(group);
    for(const plate of b.plates)for(const door of plate.model.doors)if(!door.external)plate.model.setDoor(door.id,true);
    b.selected=1;await this.adoptLayout(true);this.generation=this.accepted=this.rejected=0;L.matrixSave();
   }finally{this.busy=false;this.sync();}b.setPhase('intro');
  }
  applyEnvelope(gene){L.matrixDesign.envelope=clone(gene);this.envelope.apply(gene);}
  async adoptLayout(original=false){
   const b=this.b,s=b.society,v=b.view;
   s.models=b.plates.map(p=>p.model);s.grids.clear();
   for(let f=1;f<=30;f++){
    const people=s.agents.filter(a=>!a.isPlayer&&!a.directorSpawn&&a.homeFloor===f),seats=[...s.model(f).seats].sort((a,b)=>(b.kind==='work'||b.kind==='training')-(a.kind==='work'||a.kind==='training'));
    const used=new Set();for(const a of people){if(original){a.homeSeat=this.originalHomeSeats.get(a.id);continue;}if(['security','barista'].includes(a.role)){a.homeSeat=undefined;continue;}const kind=a.role==='reception'?'staff':a.role==='visitor'?'lounge':'work',seat=seats.find(q=>q.kind===kind&&!used.has(q.id))||seats.find(q=>!used.has(q.id));a.homeSeat=seat?.id;if(seat)used.add(seat.id);}
   }
   s.zombie.restore();b.combat.reset();
   const tower=b.continuous;
   for(const model of tower.models){tower.root.remove(model.group);L.dispose(model.group);}tower.models=[];
   if(tower.shaft){tower.root.remove(tower.shaft);L.dispose(tower.shaft);tower.shaft=null;}
   // Installing a single floor reframes SceneView. Keep the city camera and
   // clipping/shadow ranges, otherwise folding clips the base and exploding
   // puts every storey behind the floor camera's 252 m far plane.
   const camera=v.captureCameraState(),projection={near:v.camera.near,far:v.camera.far,fov:v.camera.fov},limits={minDistance:v.controls.minDistance,maxDistance:v.controls.maxDistance},sun=v.sun.position.clone(),target=v.sun.target.position.clone(),shadow=Object.fromEntries(['left','right','top','bottom','near','far'].map(k=>[k,v.sun.shadow.camera[k]]));
   try{
    await b.app.loadTowerFloor(b.selected);
    v.model.group.visible=false;v.avatarGroup.visible=false;v.ground.visible=false;v.contextGrid.visible=false;
    b.app.reset();b.setRenderStyle(v.pipeline.style);
   }finally{
    Object.assign(v.camera,projection);v.camera.updateProjectionMatrix();Object.assign(v.controls,limits);v.restoreCameraState(camera);
    v.sun.position.copy(sun);v.sun.target.position.copy(target);Object.assign(v.sun.shadow.camera,shadow);v.sun.shadow.camera.updateProjectionMatrix();v.shadowDirty=true;
   }
   // The adopted geometry and newly assigned seats become this session's
   // restore point. Keep the normal floor installation/context hooks intact.
   L.scenarioRuntime?.captureBaseline({validateLayout:true});
   await L.robotSystems?.refreshLayout?.();
  }
  async stop(){
   if(!this.active||this.busy)return;this.active=false;this.discardPending();this.busy=true;this.sync();
   try{if(this.mode==='layout'&&this.accepted)await this.adoptLayout();L.matrixSave();this.b.society.running=this.wasRunning;this.b.updateTowerBatches(true);}
   finally{this.busy=false;this.sync();}
  }
 }
 L.MatrixEvolution=MatrixEvolution;
})();
