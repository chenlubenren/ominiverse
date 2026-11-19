/* Office coexistence: separate robot population, swept envelopes and human priority. */
(() => {
  'use strict';
  const L=window.IndoorLab,$=id=>document.getElementById(id),clamp=L.clamp;
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const sweep=(a,b,p)=>{const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(a.x+dx*t-p.x,a.z+dz*t-p.z);};
  const states={idle:'待命',moving:'执行路线',working:'协作交接',cleaning:'分区清扫',yielding:'优先让人',blocked:'通道受阻',paused:'已暂停','safety-stop':'保护停车'};
  class OfficeRobots {
    constructor(building){
      this.b=building;this.s=building.society;this.view=building.view;this.robots=[];this.serial=0;this.enabled=false;this.safety=.45;this.speedScale=1;this.showSpace=true;this.showTrails=false;this.selected=null;this.events=[];this.lastUI=0;
      this.group=new THREE.Group();this.group.name='办公人机共处';this.group.userData.noAO=true;this.view.scene.add(this.group);this.ui();
    }
    floor(){return this.b.continuous?.active?this.b.continuous.origin:this.b.selected||1;}
    humans(floor){return this.s.agents.filter(a=>Math.round(a.floor)===floor&&a.location==='floor'&&a.health!=='dead'&&(!a.isPlayer||this.b.continuous?.active));}
    note(r,text){this.events.unshift({time:this.s.time,id:r.id,floor:r.floor,text:r.spec.name+' · '+text});this.events.length=Math.min(80,this.events.length);}
    state(r,state){if(r.state!==state){if(['yielding','safety-stop','blocked'].includes(state)){if(state==='yielding')r.yields++;if(state==='safety-stop')r.stops++;this.note(r,states[state]);}r.state=state;}}
    occupied(p,radius,floor,except=null){
      return this.humans(floor).some(h=>dist(p,h)<radius+.29)||this.robots.some(r=>r!==except&&r.floor===floor&&dist(p,r)<radius+r.spec.radius+this.safety+.12);
    }
    valid(p,radius,floor,except=null){const g=this.s.grid(floor);return Math.abs(p.x)<12.3&&g.isClear(p.x,p.z,radius+.035)&&!this.occupied(p,radius,floor,except)&&(!L.robotContacts||L.robotContacts.canPlace(except||{x:p.x,z:p.z,floor,radius,spec:{height:1.32}},p.x,p.z));}
    spawnPoint(spec,floor){
      const g=this.s.grid(floor),nav=g.nav(spec.radius+.035),anchors=[{x:-5.4,z:6.5},{x:5.4,z:6.5},{x:0,z:8.5},{x:7,z:8.5},{x:-7,z:8.5},{x:8,z:-7}];
      const start=this.robots.filter(r=>r.floor===floor).length%anchors.length;anchors.push(...anchors.splice(0,start));
      for(const anchor of anchors)for(let ring=0;ring<5;ring++)for(let i=0;i<(ring?12:1);i++){
        const p={x:anchor.x+Math.sin(i*Math.PI/6)*ring*.65,z:anchor.z+Math.cos(i*Math.PI/6)*ring*.65},cell=g.index(p.x,p.z);
        if(nav.component[cell]===nav.largest&&this.valid(p,spec.radius,floor))return p;
      }
      for(const cell of nav.mainFree){const p=g.point(cell);if(this.valid(p,spec.radius,floor))return p;}
      return null;
    }
    add(id,floor=this.floor()){
      const spec=L.RobotModels.catalog.find(s=>s.id===id);if(!spec||!Number.isInteger(floor)||floor<1||floor>30)return null;
      if(this.robots.length>=24||this.robots.filter(r=>r.floor===floor).length>=12){this.message('每层最多 12 台，全楼最多 24 台。');return null;}
      if(this.b.matrixLab?.active){this.message('请先停止空间矩阵演化，再部署机器人。');return null;}
      const p=this.spawnPoint(spec,floor);if(!p){this.message('当前楼层没有足够的净空，请换一种体型或调整布局。');return null;}
      const rig=L.RobotModels.create(spec),r={id:++this.serial,spec,rig,floor,...p,angle:0,vx:0,vz:0,speed:0,distance:0,state:'idle',workTime:0,wait:0,path:[],pathAt:0,retryAt:0,until:0,yields:0,stops:0,blockedTime:0,nearTime:0,minGap:Infinity,contacts:0,contacting:false,tasks:0,cooperations:0,reroutes:0,trail:[],manual:false,paused:false,grid:this.s.grid(floor)};
      this.makeOverlay(r);this.group.add(rig.root);this.robots.push(r);L.robotContacts.invalidate();this.selected=r.id;this.enabled=true;$('robot-enabled').checked=true;
      this.note(r,`${floor}F 部署 · ${spec.task}`);this.message(`${spec.name} 已加入 ${floor}F。关闭面板后点击“开始模拟”观察工作。`);this.refresh();this.draw();return r;
    }
    releasePartner(r){const a=this.s.agents.find(a=>a.id===r.partner);if(a?.robotPartner===r.id){if(a.gesture==='talk')a.gesture=r.previousGesture;delete a.robotPartner;}r.partner=null;}
    remove(id){const r=this.robots.find(r=>r.id===id);if(!r)return;this.releasePartner(r);this.group.remove(r.rig.root);L.dispose(r.rig.root);if(this.previewId===id){this.previewScene.remove(this.previewRig.root);L.dispose(this.previewRig.root);this.previewRig=null;this.previewId=null;}this.robots=this.robots.filter(q=>q!==r);L.robotContacts.invalidate();if(this.selected===id)this.selected=this.robots[0]?.id??null;this.refresh();}
    clearFloor(){for(const r of [...this.robots])if(r.floor===this.floor())this.remove(r.id);this.message('已移除当前楼层机器人。');}
    makeOverlay(r){
      const ring=new THREE.Mesh(new THREE.RingGeometry(r.spec.radius,r.spec.radius+.025,64),new THREE.MeshBasicMaterial({color:'#28a6a5',transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.014;r.rig.root.add(ring);r.ring=ring;
      const buffer=new Float32Array(600*3),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(buffer,3));g.setDrawRange(0,0);r.line=new THREE.Line(g,new THREE.LineBasicMaterial({color:'#279d9d',transparent:true,opacity:.6}));r.line.frustumCulled=false;r.rig.root.add(r.line);
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=80;const ctx=canvas.getContext('2d');ctx.fillStyle='#20394de8';ctx.fillRect(0,0,512,80);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='26px Microsoft YaHei';ctx.fillText(r.spec.name+'  #'+r.id,256,50);
      const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true,transparent:true}));sprite.position.y=r.spec.height+.21;sprite.scale.set(1.35,.21,1);r.rig.root.add(sprite);r.label=sprite;
    }
    // Radius-specific A*: dynamic obstacles affect only this search, never the shared grid.
    route(r,goal,dynamic=false){
      const g=L.robotContacts.navigation(this.s.grid(r.floor)),rad=r.spec.radius+.035,base=g.nav(rad),gi=g.index(goal.x,goal.z);let si=g.index(r.x,r.z);
      if(!base.valid[si]){
        const col=Math.floor((r.x-g.minX)/g.cell),row=Math.floor((r.z-g.minZ)/g.cell);let best=Infinity;
        for(let z=Math.max(0,row-2);z<=Math.min(g.rows-1,row+2);z++)for(let x=Math.max(0,col-2);x<=Math.min(g.cols-1,col+2);x++){const i=z*g.cols+x,p=g.point(i),d=dist(r,p);if(base.valid[i]&&d<best&&g.lineClear(r,p,rad)){si=i;best=d;}}
      }
      if(!base.valid[si]||!base.valid[gi]||base.component[si]!==base.component[gi])return[];
      const obstacles=dynamic?[...this.humans(r.floor).filter(h=>dist(h,r)<5&&dist(h,goal)>1.3).map(h=>({...h,radius:.28})),...this.robots.filter(q=>q!==r&&q.floor===r.floor).map(q=>({...q,radius:q.spec.radius}))]:this.robots.filter(q=>q!==r&&q.floor===r.floor&&q.spec.kind==='arm').map(q=>({...q,radius:q.spec.radius}));
      const margin=dynamic?this.safety+.04:.08;
      for(const o of obstacles)o.margin=Math.min(margin,Math.max(.015,dist(r,o)-o.radius-rad-.025));
      const clear=(a,b)=>g.lineClear(a,b,rad)&&obstacles.every(o=>sweep(a,b,o)>o.radius+rad+o.margin);
      if(clear(r,goal))return[{x:goal.x,z:goal.z}];
      const valid=new Uint8Array(base.valid);
      for(const o of obstacles){const reach=Math.ceil((o.radius+rad+o.margin)/g.cell),c=Math.floor((o.x-g.minX)/g.cell),row=Math.floor((o.z-g.minZ)/g.cell);for(let z=Math.max(0,row-reach);z<=Math.min(g.rows-1,row+reach);z++)for(let x=Math.max(0,c-reach);x<=Math.min(g.cols-1,c+reach);x++){const i=z*g.cols+x;if(i!==si&&dist(g.point(i),o)<o.radius+rad+o.margin)valid[i]=0;}}
      if(!valid[gi])return[];
      const costs=new Float32Array(g.size),prev=new Int32Array(g.size);costs.fill(Infinity);prev.fill(-1);costs[si]=0;const heap=new L.Heap(),h=i=>dist(g.point(i),goal)/g.cell;heap.push(si,h(si));
      while(heap.length){const item=heap.pop(),i=item.id;if(i===gi)break;if(item.cost>costs[i]+h(i)+.001)continue;g.neighbors(i,valid,(j,c)=>{const score=costs[i]+c;if(score<costs[j]){costs[j]=score;prev[j]=i;heap.push(j,score+h(j));}});}
      if(!Number.isFinite(costs[gi]))return[];
      const raw=[];for(let i=gi;i>=0;i=prev[i]){raw.push(g.point(i));if(i===si)break;}raw.reverse();let anchor=r,index=0;const path=[];
      while(index<raw.length){let end=index;while(end+1<raw.length&&end-index<40&&clear(anchor,raw[end+1]))end++;if(!clear(anchor,raw[end]))return[];path.push(raw[end]);anchor=raw[end];index=end+1;}return path;
    }
    chooseTask(r){
      const model=this.s.model(r.floor),g=this.s.grid(r.floor),rad=r.spec.radius+.035,nav=g.nav(rad);
      const humans=this.humans(r.floor).filter(h=>!h.isPlayer&&!h.zombieControlled&&h.pose==='sit'&&!h.robotPartner&&!r.recentPartners?.includes(h.id));
      const candidates=[];
      if(r.spec.kind==='vacuum'){
        if(r.cleanGrid!==g){
          r.cleanGrid=g;r.cleanPoints=[];r.cleaned=new Set();
          const rows=Math.max(1,Math.ceil(.32/g.cell)),cols=Math.max(1,Math.ceil(.6/g.cell));let reverse=false;
          for(let row=0;row<g.rows;row+=rows){const stripe=[];for(let col=0;col<g.cols;col+=cols){const i=row*g.cols+col,p=g.point(i);if(nav.valid[i]&&nav.component[i]===nav.largest&&Math.abs(p.x)<12.2)stripe.push(p);}if(reverse)stripe.reverse();r.cleanPoints.push(...stripe);reverse=!reverse;}
          r.cleanCursor=0;let nearest=Infinity;r.cleanPoints.forEach((p,i)=>{const d=dist(r,p);if(d<nearest){nearest=d;r.cleanCursor=i;}});
        }
        for(let i=0;i<32&&r.cleanPoints.length;i++){const index=r.cleanCursor+i,p=r.cleanPoints[index%r.cleanPoints.length];if(dist(r,p)>.18&&this.valid(p,r.spec.radius,r.floor,r))candidates.push({...p,cleanOrder:i,cleanIndex:index});}
      }
      if(['humanoid','delivery'].includes(r.spec.kind))for(const h of humans){
        const seat=model.seats.find(s=>s.id===h.seatId),center=seat?.approach||h;
        for(let i=0;i<8;i++){const angle=i*Math.PI/4,p={x:center.x+Math.sin(angle)*.85,z:center.z+Math.cos(angle)*.85};if(dist(p,r)>.9&&dist(p,h)>r.spec.radius+.26+this.safety+.12&&dist(p,h)<1.9&&this.valid(p,r.spec.radius,r.floor,r))candidates.push({...p,partner:h.id});}
      }
      // A deterministic stride scans free space without teleporting or changing layout.
      if(!candidates.length){const list=nav.mainFree;for(let i=0;i<48&&list.length;i++){const index=(r.id*317+r.tasks*181+i*541)%list.length,p=g.point(list[index]);if(Math.abs(p.x)>12.2||dist(p,r)<1.8||!this.valid(p,r.spec.radius,r.floor,r))continue;candidates.push(p);}}
      candidates.sort((a,b)=>r.spec.kind==='vacuum'?(a.cleanOrder??0)-(b.cleanOrder??0):dist(a,r)-dist(b,r));
      for(const goal of candidates){const path=this.route(r,goal,true);if(path.length){if(goal.cleanIndex!==undefined)r.cleanCursor=goal.cleanIndex+1;r.goal=goal;r.path=path;r.pathAt=0;r.targetPartner=goal.partner;r.retryAt=this.s.time+3;this.state(r,'moving');return true;}}
      if(r.spec.kind==='vacuum')r.cleanCursor+=32;
      r.path=[];r.retryAt=this.s.time+4;this.state(r,'blocked');return false;
    }
    beginWork(r){
      r.path=[];r.vx=r.vz=r.speed=0;r.workDuration=r.spec.kind==='vacuum'?.25:r.spec.kind==='dog'?3:5;r.until=this.s.time+r.workDuration;r.workTime=0;this.state(r,'working');
      const a=this.s.agents.find(a=>a.id===r.targetPartner);
      if(a&&a.location==='floor'&&a.floor===r.floor&&a.pose==='sit'&&!a.robotPartner&&dist(r,a)<2){r.partner=a.id;r.previousGesture=a.gesture;a.robotPartner=r.id;a.gesture='talk';r.recentPartners??=[];r.recentPartners.push(a.id);if(r.recentPartners.length>2)r.recentPartners.shift();r.angle=Math.atan2(a.x-r.x,a.z-r.z);this.note(r,`与 ${a.name} 开始工位交接`);}
    }
    safetyFor(r,vx,vz){
      let factor=1,emergency=false,near=false;
      const g=this.s.grid(r.floor),others=[...this.humans(r.floor).map(h=>({x:h.x,z:h.z,vx:h.vx||0,vz:h.vz||0,radius:.24*(h.appearance?.build??1),human:true})),...this.robots.filter(q=>q!==r&&q.floor===r.floor).map(q=>({x:q.x,z:q.z,vx:q.vx,vz:q.vz,radius:q.spec.radius,human:false,id:q.id}))];
      for(const h of others){
        const gap=dist(r,h)-r.spec.radius-h.radius;
        if(h.human)r.minGap=Math.min(r.minGap,gap);
        if(gap>3)continue;if(gap>.1&&!g.lineClear(r,h,.015))continue;
        const dx=h.x-r.x,dz=h.z-r.z,rvx=h.vx-vx,rvz=h.vz-vz,closing=dx*rvx+dz*rvz,t=clamp(-closing/(rvx*rvx+rvz*rvz||1),0,.95),predicted=Math.hypot(dx+rvx*t,dz+rvz*t)-r.spec.radius-h.radius;
        if(closing>=0&&gap>.12)continue;
        if(gap<.035){emergency=true;factor=0;}
        else if(predicted<this.safety){
          near=true;
          if(gap<.16||t<.24)factor=0;else factor=Math.min(factor,clamp((predicted-.12)/Math.max(.05,this.safety-.12),0,1));
        }
        // Robots resolve ties consistently. Humans always have priority.
        if(!h.human&&h.id<r.id&&predicted<this.safety+.15)factor=0;
      }
      return {factor,emergency,near};
    }
    safeMove(r,p){
      const g=this.s.grid(r.floor),radius=r.spec.radius+.035;if(!g.isClear(p.x,p.z,radius)||!g.lineClear(r,p,radius))return false;
      if(!L.robotContacts.canMove(r,p.x,p.z))return false;
      if(this.humans(r.floor).some(h=>sweep(r,p,h)<r.spec.radius+.265))return false;
      return !this.robots.some(q=>q!==r&&q.floor===r.floor&&sweep(r,p,q)<r.spec.radius+q.spec.radius+.035);
    }
    tick(dt){
      if(!this.enabled||this.b.matrixLab?.active||this.environment!=='office')return;
      for(const r of this.robots){
        if(r.alive===false)continue;
        r.previous={x:r.x,z:r.z,angle:r.angle,distance:r.distance,workTime:r.workTime};
        let minimum=Infinity;for(const h of this.humans(r.floor))minimum=Math.min(minimum,dist(r,h)-r.spec.radius-.24*(h.appearance?.build??1));
        r.minGap=Math.min(r.minGap,minimum);const contact=minimum<-.003;if(contact&&!r.contacting){r.contacts++;this.note(r,'检测到包络重叠');}r.contacting=contact;
        r.vx=r.vz=0;
        if(L.robotContacts.step(r,dt))continue;
        if(r.paused||r.manual){r.speed=0;continue;}
        if(L.robotConflict?.control(r,this,dt))continue;
        // Layout edits invalidate old routes. Hold the robot if its footprint no longer fits.
        const g=this.s.grid(r.floor);if(r.grid!==g){r.grid=g;r.path=[];r.retryAt=0;}
        if(!g.isClear(r.x,r.z,r.spec.radius+.015)){r.speed=0;r.blockedTime+=dt;this.state(r,'blocked');continue;}
        if(r.spec.kind==='arm'){
          const close=this.humans(r.floor).some(h=>dist(r,h)<1.1);
          if(close){this.state(r,'safety-stop');r.wait+=dt;continue;}
          this.state(r,'working');const before=Math.floor(r.workTime/5);r.workTime+=dt;if(Math.floor(r.workTime/5)>before){r.tasks++;this.note(r,'完成工作台取放');}continue;
        }
        if(r.state==='working'&&r.partner!=null){const a=this.s.agents.find(a=>a.id===r.partner);if(!a||a.location!=='floor'||a.floor!==r.floor||a.pose!=='sit'||a.health!=='healthy'){r.aborted=true;r.workTime=r.workDuration;this.note(r,'协作对象离开，取消交接');this.releasePartner(r);}else a.gesture='talk';}
        if(r.state==='working'&&r.workTime<r.workDuration){r.workTime=Math.min(r.workDuration,r.workTime+dt);continue;}
        if(r.state==='working'){if(r.partner!=null&&!r.aborted){r.cooperations++;this.note(r,'完成工位交接');}this.releasePartner(r);if(!r.aborted)r.tasks++;r.aborted=false;r.retryAt=0;r.state='idle';}
        if(!r.path.length){r.speed=0;if(this.s.time>=r.retryAt)this.chooseTask(r);if(!r.path.length){r.blockedTime+=dt;continue;}}
        while(r.pathAt<r.path.length&&dist(r,r.path[r.pathAt])<.065)r.pathAt++;
        if(r.pathAt>=r.path.length){this.beginWork(r);continue;}
        const target=r.path[r.pathAt],d=dist(r,target),heading=Math.atan2(target.x-r.x,target.z-r.z),desired=r.spec.speed*this.speedScale;
        const safety=this.safetyFor(r,Math.sin(heading)*desired,Math.cos(heading)*desired);
        if(safety.near)r.nearTime+=dt;
        const targetSpeed=desired*safety.factor;r.speed=safety.emergency?0:Math.max(0,Math.min(targetSpeed,r.speed+.55*dt));
        let next=null;
        if(r.speed>.01)for(const turn of [0,.25,-.25,.55,-.55,.95,-.95]){const step=Math.min(d,r.speed*dt),p={x:r.x+Math.sin(heading+turn)*step,z:r.z+Math.cos(heading+turn)*step};if(this.safeMove(r,p)){next=p;break;}}
        if(next){
          const dx=next.x-r.x,dz=next.z-r.z;r.vx=dx/dt;r.vz=dz/dt;r.x=next.x;r.z=next.z;r.distance+=Math.hypot(dx,dz);const angle=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(angle-r.angle),Math.cos(angle-r.angle));r.angle+=clamp(delta,-dt*2,dt*2);r.wait=0;this.state(r,safety.factor<.65?'yielding':r.spec.kind==='vacuum'?'cleaning':'moving');
          if(r.spec.kind==='vacuum'){const cell=g.index(r.x,r.z);if(cell>=0)r.cleaned?.add(cell);}
          if(!r.trail.length||dist(r,r.trail[r.trail.length-1])>.14){r.trail.push({x:r.x,z:r.z});if(r.trail.length>600)r.trail.shift();}
        }else{
          r.speed=0;r.wait+=dt;r.blockedTime+=dt;this.state(r,safety.emergency?'safety-stop':safety.near?'yielding':'blocked');
          if(r.wait>2&&this.s.time>=r.retryAt){const path=this.route(r,r.goal,true);r.retryAt=this.s.time+3;if(path.length){r.path=path;r.pathAt=0;r.reroutes++;this.note(r,'绕开占用区，重新规划');}else if(r.wait>9){r.path=[];r.retryAt=this.s.time+1;r.wait=0;this.releasePartner(r);}}
        }
      }
    }
    // Used by the existing NPC and first-person collision system. Swept, with floor/height tests.
    blocker(a,x,z,feet,from=a){
      if(!this.enabled||this.environment!=='office')return false;
      const radius=.24*(a.appearance?.build??1),floor=Math.round(a.floor);
      for(const r of this.robots){if(r.alive===false||r.floor!==floor)continue;const y=(floor-1)*3.6;if(feet>=y+r.spec.height-.005||feet+1.7<=y)continue;const limit=radius+r.spec.radius,old=dist(from,r),next=Math.hypot(x-r.x,z-r.z);if(next<limit&&next<old-1e-7||old>=limit&&sweep(from,{x,z},r)<limit)return r;}
      return false;
    }
    draw(){
      const active=this.enabled&&this.environment==='office',continuous=this.b.continuous?.active,floor=this.floor(),interior=this.b.phase==='interior';this.group.visible=active;this.group.position.set(0,0,0);
      for(const r of this.robots){
        const root=r.rig.root;root.visible=r.alive!==false&&active&&(continuous?r.floor===floor:interior?r.floor===floor:true);if(!root.visible)continue;
        const alpha=this.s.running&&!r.paused&&!r.manual&&!this.b.matrixLab?.active?clamp(this.s.accumulator/.1,0,1):1,previous=r.previous||r;
        const render={...r,x:previous.x+(r.x-previous.x)*alpha,z:previous.z+(r.z-previous.z)*alpha,distance:previous.distance+(r.distance-previous.distance)*alpha,workTime:r.workTime>=previous.workTime?previous.workTime+(r.workTime-previous.workTime)*alpha:r.workTime};
        render.angle=previous.angle+Math.atan2(Math.sin(r.angle-previous.angle),Math.cos(r.angle-previous.angle))*alpha;
        let x=render.x,y=0,z=render.z;
        if(continuous)y=(r.floor-this.b.continuous.origin)*3.6;else if(!interior){const p=this.b.plates[r.floor-1].group.position;x+=p.x;y=p.y+.82;z+=p.z;}
        if(r.conflictManaged){const base=L.robotConflict.base(r);y=continuous?base-(this.b.continuous.origin-1)*3.6:interior?base-(floor-1)*3.6:base+.82+(this.b.plates[r.floor-1]?.group.position.y||0)-(r.floor-1)*3.6;}
        root.position.set(x,y,z);if(interior&&this.view.floorOrigin)root.position.add(this.view.floorOrigin);root.rotation.y=render.angle;
        const animationKey=render.distance+':'+render.workTime+':'+r.state+':'+(r.balance?.time||0);
        if(!r.manual&&r.animationKey!==animationKey){L.RobotModels.animate(r.rig,render,0);r.animationKey=animationKey;if(this.view.view==='walk')this.view.shadowDirty=true;}
        L.robotContacts.pose(r);
        const alert=['yielding','blocked','safety-stop'].includes(r.state);r.ring.material.color.set(alert?'#e29637':'#28a6a5');r.ring.visible=this.showSpace&&!r.balance;r.label.visible=this.showSpace&&!r.balance;r.line.visible=this.showTrails&&!r.balance;
        if(this.showTrails){const a=r.line.geometry.attributes.position;const ca=Math.cos(render.angle),sa=Math.sin(render.angle);r.trail.forEach((p,i)=>{const dx=p.x-render.x,dz=p.z-render.z;a.setXYZ(i,ca*dx-sa*dz,.022,sa*dx+ca*dz);});a.needsUpdate=true;r.line.geometry.setDrawRange(0,r.trail.length);}
      }
      this.preview();const now=performance.now();if(now-this.lastUI>450){this.lastUI=now;this.refreshLive();}
    }
    preview(){
      if(!this.dialog.open)return;const r=this.robots.find(q=>q.id===this.selected);if(!r)return;
      if(!this.previewRenderer){
        this.previewRenderer=new THREE.WebGLRenderer({antialias:true,alpha:false});this.previewRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.previewRenderer.setSize(360,230);this.previewRenderer.outputEncoding=THREE.sRGBEncoding;this.previewRenderer.toneMapping=THREE.ACESFilmicToneMapping;
        this.previewScene=new THREE.Scene();this.previewScene.background=new THREE.Color('#e6edf2');this.previewScene.add(new THREE.HemisphereLight('#ffffff','#697b8e',1.2));const light=new THREE.DirectionalLight('#ffffff',2);light.position.set(3,5,4);this.previewScene.add(light);this.previewCamera=new THREE.PerspectiveCamera(36,360/230,.01,20);$('robot-preview').append(this.previewRenderer.domElement);
      }
      if(this.previewId!==r.id){if(this.previewRig){this.previewScene.remove(this.previewRig.root);L.dispose(this.previewRig.root);}this.previewRig=L.RobotModels.create(r.spec);this.previewScene.add(this.previewRig.root);this.previewId=r.id;}
      const rig=this.previewRig;
      for(const j of r.rig.joints)L.RobotModels.set(rig,j.name,j.value);
      if(rig.body)rig.body.position.copy(r.rig.body.position);if(rig.payload)rig.payload.visible=r.rig.payload.visible;if(rig.parcel)rig.parcel.position.copy(r.rig.parcel.position);
      const height=r.spec.height,size=Math.max(height,r.spec.radius*2,.35);this.previewCamera.position.set(size*1.05,height*.5+size*.5,size*1.5);this.previewCamera.lookAt(0,height*.49,0);this.previewRenderer.render(this.previewScene,this.previewCamera);
    }
    focus(id){const r=this.robots.find(q=>q.id===id);if(!r)return;this.selected=id;this.refresh();if(r.floor!==this.floor()||this.b.phase!=='interior'||this.view.view==='walk')return;const v=this.view;v.controls.target.set(r.x,r.spec.height*.5,r.z);v.camera.position.set(r.x+2.8,6,r.z+3.5);v.camera.up.set(0,1,0);v.controls.update();}
    message(text){$('robot-message').textContent=L.brandNeutralText?.(text)??text;}
    ui(){
      const open=document.createElement('button');open.id='office-robots-open';open.textContent='机器人';open.title='添加机器人并观察人机共处';open.className='co-action';open.textContent='打开扩展机器人库';const options=document.createElement('details');options.id='office-robots-options';const title=document.createElement('summary');title.textContent='更多机器人 · 机械臂、清扫与配送';options.append(title,open);document.getElementById('collaboration-panel')?.append(options);
      const dialog=document.createElement('dialog');dialog.id='office-robots-panel';dialog.innerHTML=`<div class="robot-heading"><div><small>OFFICE / HUMAN + ROBOT</small><h2>让机器人加入办公室</h2></div><button id="robot-close" aria-label="关闭机器人面板">×</button></div><p class="robot-intro">巡检、配送、清扫和工位协作。按真实尺寸构建可动关节模型，观察通道占用与人机让行。</p><div class="robot-controls"><label><input id="robot-enabled" type="checkbox"> 启用机器人共处</label><label>部署楼层 <select id="robot-floor" aria-label="机器人部署楼层">${Array.from({length:30},(_,i)=>`<option value="${i+1}">${i+1}F</option>`).join('')}</select></label><label>人机预留间距 <select id="robot-safety"><option value=".25">0.25 m · 紧凑</option><option value=".45" selected>0.45 m · 常规</option><option value=".75">0.75 m · 宽松</option></select></label><label>办公速度 <select id="robot-speed"><option value=".6">慢速 ×0.6</option><option value="1" selected>常规 ×1.0</option><option value="1.3">快速 ×1.3</option></select></label><label><input id="robot-space" type="checkbox" checked> 显示占用包络 / 名称</label><label><input id="robot-trails" type="checkbox"> 显示机器人轨迹</label></div><div class="robot-catalog">${L.RobotModels.catalog.map(s=>`<article class="robot-card"><small>${s.brand} / ${s.category}</small><b>${s.name}</b><span>${s.size}</span><p>${s.task}</p><div><a href="${s.url}" target="_blank" rel="noopener noreferrer">产品参考 ↗</a><button data-robot-add="${s.id}">＋ 添加</button></div></article>`).join('')}</div><p id="robot-message" role="status">默认不部署机器人。选择类型后添加到指定楼层。</p><div class="robot-fleet-heading"><b>已部署 <span id="robot-total">0</span></b><button id="robot-clear">清空当前楼层</button></div><div id="robot-fleet"></div><section id="robot-inspector" hidden><div class="robot-fleet-heading"><b id="robot-inspector-title"></b><label><input id="robot-manual" type="checkbox"> 手动检查关节</label></div><p id="robot-inspector-status"></p><div id="robot-preview" aria-label="选中机器人的关节模型预览"></div><div id="robot-joints"></div></section><details class="robot-assumptions"><summary>模型与避让假设</summary><p>几何模型为程序化近似，关节层级、外形与尺寸参考厂商资料；不是官方 CAD、控制器或动力学数字孪生。人形机器人使用 23 轴基础构型与简化末端，四足每腿 3 轴；机械臂 6 / 7 轴加夹爪。办公速度、间距与预测时间属于本场景设置。</p><p>机器人只在部署楼层工作，不自动乘梯或上下楼。采用保守圆形包络、0.95 秒相对运动预测、优先让人、保护停车与受阻重规划。清扫路线覆盖可通行区域，尚未模拟桌下净高、传感器噪声或真实制动误差。机械臂为独立工作台取放，近人保护停车；移动机器人可与在座员工协作交接。体验记录不构成真机安全验证。</p></details>`;
      document.body.appendChild(dialog);this.dialog=dialog;
      open.onclick=()=>{if(L.collaboration?.environment!=='office')return;document.getElementById('collaboration-panel')?.close();if(document.pointerLockElement)document.exitPointerLock();$('robot-floor').value=this.floor();this.refresh();dialog.showModal();};$('robot-close').onclick=()=>dialog.close();
      dialog.addEventListener('click',e=>{const add=e.target.closest('[data-robot-add]');if(add)this.add(add.dataset.robotAdd,Number($('robot-floor').value));const focus=e.target.closest('[data-robot-focus]');if(focus)this.focus(Number(focus.dataset.robotFocus));const remove=e.target.closest('[data-robot-remove]');if(remove)this.remove(Number(remove.dataset.robotRemove));const pause=e.target.closest('[data-robot-pause]');if(pause){const r=this.robots.find(r=>r.id===Number(pause.dataset.robotPause));r.paused=!r.paused;r.speed=r.vx=r.vz=0;this.refresh();}});
      $('robot-enabled').onchange=e=>{this.enabled=e.target.checked;for(const r of this.robots){r.speed=r.vx=r.vz=0;if(!this.enabled)this.releasePartner(r);}this.draw();this.refreshLive();};
      $('robot-safety').onchange=e=>this.safety=Number(e.target.value);$('robot-speed').onchange=e=>this.speedScale=Number(e.target.value);$('robot-space').onchange=e=>{this.showSpace=e.target.checked;this.draw();};$('robot-trails').onchange=e=>{this.showTrails=e.target.checked;this.draw();};$('robot-clear').onclick=()=>this.clearFloor();
      $('robot-manual').onchange=e=>{const r=this.robots.find(r=>r.id===this.selected);if(r){r.manual=e.target.checked;r.animationKey=null;r.speed=r.vx=r.vz=0;this.releasePartner(r);}this.refresh();};
      const monitor=document.createElement('section');monitor.id='robot-monitor';monitor.hidden=true;monitor.innerHTML='<div class="robot-fleet-heading"><b>人机共处观察</b><button id="robot-monitor-open">管理 ↗</button></div><p id="robot-live-summary"></p><div class="robot-metrics" id="robot-live-metrics"></div><div id="robot-live-list"></div><div id="robot-live-events" aria-label="近期人机共处事件"></div><small id="robot-live-note">净距为包络边缘距离；暂停时保持记录。</small>';
      dialog.append(monitor);$('robot-monitor-open').onclick=()=>open.click();
    }
    refresh(){
      $('robot-total').textContent=this.robots.length;
      $('robot-fleet').innerHTML=this.robots.map(r=>`<div class="robot-fleet-row"><button data-robot-focus="${r.id}" class="${r.id===this.selected?'selected':''}"><b>${r.spec.name} #${r.id}</b><small>${r.floor}F · <span data-robot-state="${r.id}">${states[r.state]}</span></small></button><button data-robot-pause="${r.id}">${r.paused?'继续':'暂停'}</button><button data-robot-remove="${r.id}" aria-label="移除 ${r.spec.name} ${r.id}">移除</button></div>`).join('')||'<p class="robot-empty">办公室里还没有机器人。</p>';
      const r=this.robots.find(r=>r.id===this.selected);$('robot-inspector').hidden=!r;if(r){$('robot-inspector-title').textContent=r.spec.name+' · '+r.rig.joints.length+' 个可动轴';$('robot-manual').checked=r.manual;
        $('robot-joints').innerHTML=r.rig.joints.map((j,i)=>`<label>${j.name}<input type="range" data-robot-joint="${i}" aria-label="${j.name}" min="${Math.max(j.min,-Math.PI)}" max="${Math.min(j.max,Math.PI)}" step="0.01" value="${clamp(j.value,-Math.PI,Math.PI)}" ${r.manual?'':'disabled'}><output>${Math.round(j.value*180/Math.PI)}°</output></label>`).join('');
        for(const input of $('robot-joints').querySelectorAll('input'))input.oninput=e=>{if(!r.manual)return;const j=r.rig.joints[Number(e.target.dataset.robotJoint)];L.RobotModels.set(r.rig,j.name,Number(e.target.value));e.target.nextElementSibling.value=Math.round(j.value*180/Math.PI)+'°';this.view.shadowDirty=true;};
      }this.refreshLive();
    }
    summary(floor=this.floor()){
      const robots=this.robots.filter(r=>r.floor===floor),sum=k=>robots.reduce((n,r)=>n+r[k],0),gaps=robots.map(r=>r.minGap).filter(Number.isFinite);
      return{floor,total:robots.length,yields:sum('yields'),stops:sum('stops'),blockedSeconds:sum('blockedTime'),tasks:sum('tasks'),cooperations:sum('cooperations'),contacts:sum('contacts'),minGap:gaps.length?Math.min(...gaps):null,distance:sum('distance')};
    }
    refreshLive(){
      const summary=this.summary(),list=this.robots.filter(r=>r.floor===summary.floor);$('robot-monitor').hidden=!list.length;
      $('robot-live-summary').textContent=`${summary.floor}F · ${summary.total} 台 · ${!this.enabled?'未启用':this.environment!=='office'?'当前场景暂停':this.b.matrixLab?.active?'布局演化暂停':this.s.running?'人机共处运行中':'跟随场景暂停'}`;
      $('robot-live-metrics').innerHTML=`<span><b>${summary.yields}</b>让行次数</span><span><b>${summary.blockedSeconds.toFixed(1)} s</b>受阻累计</span><span><b>${summary.cooperations}</b>工位交接</span><span><b>${summary.minGap===null?'—':summary.minGap.toFixed(2)+' m'}</b>最小人机净距</span><span><b>${summary.tasks}</b>完成任务</span><span><b>${summary.contacts}</b>包络重叠</span>`;
      $('robot-live-list').replaceChildren(...list.map(r=>{const button=document.createElement('button');button.textContent=`${r.spec.name} #${r.id} · ${!this.enabled?'未启用':r.manual?'关节检查':r.paused?'已暂停':states[r.state]}`;button.onclick=()=>this.focus(r.id);return button;}));
      for(const r of this.robots){const el=document.querySelector(`[data-robot-state="${r.id}"]`);if(el)el.textContent=!this.enabled?'未启用':r.manual?'关节检查':r.paused?'已暂停':states[r.state]||r.state;}
      $('robot-live-events').replaceChildren(...this.events.filter(e=>e.floor===summary.floor).slice(0,4).map(e=>{const line=document.createElement('div');line.textContent=`${Math.floor(e.time/60)}:${String(Math.floor(e.time%60)).padStart(2,'0')} · ${e.text}`;return line;}));
      const r=this.robots.find(r=>r.id===this.selected);if(r){$('robot-inspector-status').textContent=`${r.floor}F · ${r.distance.toFixed(1)} m · 让行 ${r.yields} 次 · 保护停车 ${r.stops} 次 · 重规划 ${r.reroutes} 次`;
        if(!r.manual&&this.dialog.open)for(const input of $('robot-joints').querySelectorAll('input')){const j=r.rig.joints[Number(input.dataset.robotJoint)];input.value=clamp(j.value,-Math.PI,Math.PI);input.nextElementSibling.value=Math.round(j.value*180/Math.PI)+'°';}}
    }
  }
  L.OfficeRobots=OfficeRobots;
})();
