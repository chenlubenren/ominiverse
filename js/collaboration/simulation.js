/* Rule-based collaboration: navigable routes, human priority, real handoff events. */
(() => {
  'use strict';const C=window.CoScene,T=THREE;
  const names=['林岚','陈亦','周宁','许知','江月','沈青','陆遥','苏禾','顾川','孟夏','季白','温言','方可','程予'];
  const taskNames={assist:'工位交接',deliver:'物品递送',inspect:'自主巡检',supply:'定点补给','inspect-deliver':'巡检后递送','inspect-supply':'巡检后补给','deliver-inspect':'递送后巡检'};
  const taskSteps=task=>({'inspect-deliver':['inspect','deliver'],'inspect-supply':['inspect','supply'],'deliver-inspect':['deliver','inspect']}[task]||[task]);
  C.robotTaskNames=taskNames;C.robotTaskSteps=taskSteps;
  class CollaborationSimulation{
    constructor(world){
      this.world=world;this.grid=world.grid||C.makeNavigation(world);this.robots=[];this.people=[];this.time=0;this.serial=0;this.completed=0;this.yields=0;this.distance=0;this.events=[];this.history=[0];this.nextSample=10;this.group=new T.Group();this.routes=new T.Group();world.root.add(this.group,this.routes);
      this.routeMaterial=new T.LineBasicMaterial({color:'#278bdd',transparent:true,opacity:.40});
      const positions=world.getPeople?[]:world.peoplePoints;
      positions.forEach(([x,z],i)=>{const p=this.freePoint({x,z},.28),model=world.nativePeople?new T.Group():C.makeHuman(i,world.root.name==='station');const a={id:'person-'+i,name:names[i%names.length],x:p.x,z:p.z,radius:.28,speed:.65+(i%3)*.1,model,path:[],phase:i,wait:3+i*1.7,assigned:null,moving:false};this.people.push(a);this.group.add(model);this.sync(a);});
      if(world.getPeople)this.syncExternalPeople();
      this.record('场景就绪，等待加入机器人伙伴。','start');
    }
    syncExternalPeople(){
      const old=new Map(this.people.map(p=>[p.id,p]));
      this.people=this.world.getPeople().map(source=>{
        const id='source-'+source.id,p=old.get(id)||{id,name:source.name,radius:.28,external:true,model:new T.Group(),path:[],assigned:null};
        p.x=source.x;p.z=source.z;p.source=source;p.model.position.set(p.x,source.baseY||0,p.z);return p;
      });
      for(const r of this.robots)if(r.partner&&!this.people.includes(r.partner)){this.release(r);r.state='idle';r.wait=.5;r.status='伙伴已离开，寻找新的协作目标';}
    }
    freePoint(point,radius,exclude){
      const nav=this.grid.nav(radius);let best=null,score=Infinity;
      for(const i of nav.mainFree){const p=this.grid.point(i),d=(point.x-p.x)**2+(point.z-p.z)**2;if(d>=score)continue;if([...this.people,...this.robots].some(a=>a!==exclude&&Math.hypot(a.x-p.x,a.z-p.z)<a.radius+radius+.18))continue;best=p;score=d;}
      return best;
    }
    record(text,type='event'){this.events.unshift({time:Number(this.time.toFixed(2)),text,type});this.events.length=Math.min(this.events.length,60);this.revision=(this.revision||0)+1;this.onEvent?.(this.events[0]);}
    robotRadius(spec){return Math.ceil(({humanoid:.39,delivery:.44,quadruped:.68,carrier:.64}[spec.type]||.4)*(spec.scale||1)*20)/20;}
    canPlace(spec,point){
      if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.z))return false;
      if(this.world.getPeople)this.syncExternalPeople();
      const radius=this.robotRadius(spec),nav=this.grid.nav(radius),i=this.grid.index(point.x,point.z);
      return i>=0&&nav.component[i]===nav.largest&&this.grid.isClear(point.x,point.z,radius)&&![...this.people,...this.robots].some(a=>Math.hypot(a.x-point.x,a.z-point.z)<a.radius+radius+.18);
    }
    intent(r){
      const task=taskNames[r.task]||'协作',p=r.partner,action=(r.mission?.steps.length>1?'步骤 '+(r.mission.index+1)+'/'+r.mission.steps.length+' · ':'')+r.status;
      if(['pickup','loaded'].includes(r.state))return{task,action,target:r.pickupName||'补给点',point:r.endpoint||this.world.pickup};
      if(['inspection','checking','dropoff','navigation-wait'].includes(r.state))return{task,action,target:r.destinationName||'任务点',point:r.pendingNavigation?.target||r.endpoint};
      if(r.meeting)return{task,action,target:'会合交接点',point:r.meeting.robot};
      if(p)return{task,action,target:p.name+(r.action==='inspect'?' · 核对巡检':' · 交接物品'),point:{x:p.x,z:p.z}};
      return{task,action,target:null,point:null};
    }
    addRobot(spec,{silent=false,position}={}){
      if(this.robots.length>=16)throw new Error('当前场景最多放置 16 位机器人伙伴。');
      if(spec.task&&!taskNames[spec.task])throw new Error('暂不支持该任务，请选择已有任务或明确的两段顺序。');
      const radius=this.robotRadius(spec);
      if(position&&!this.canPlace(spec,position))throw Error('此处被占用或不可通行，请选择空闲地面。');
      const p=position?{x:position.x,z:position.z}:this.freePoint({x:this.world.spawn.x+(this.serial%3)*1.4,z:this.world.spawn.z+Math.floor(this.serial%6/3)*1.6},radius);
      if(!p)throw new Error('当前没有足够的空闲放置区域，请先移出一位伙伴。');
      const model=C.makeRobot(spec),id='robot-'+(++this.serial),r={id,spec:{...spec},name:spec.name,model,x:p.x,z:p.z,radius,speed:spec.type==='quadruped'?1.25:spec.type==='carrier'?.8:1,task:spec.task||'assist',state:'idle',status:'准备执行任务',startedAt:this.time,lastProgress:this.time,path:[],phase:0,wait:.5,partner:null,moving:false,completed:0,distance:0,blockedTime:0,lastYield:-10,lastPartner:null};
      const ring=new T.Mesh(new T.RingGeometry(radius+.12,radius+.16,48),new T.MeshBasicMaterial({color:'#278bdd',transparent:true,opacity:.65,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.045;ring.userData.isRing=true;model.add(ring);r.ring=ring;r.placement={...p};
      r.line=new T.Line(new T.BufferGeometry(),this.routeMaterial);this.routes.add(r.line);this.robots.push(r);this.group.add(model);this.configureMission(r);this.sync(r);if(!silent)this.record(`${r.name} 加入${(this.world.displayName||C.environments[this.world.root.name]?.name||this.world.root.name)}。`,'join');return r;
    }
    removeRobot(id){const r=this.robots.find(r=>r.id===id);if(!r)return;this.release(r);r.line.geometry.dispose();r.line.parent?.remove(r.line);C.disposeModel(r.model);this.robots.splice(this.robots.indexOf(r),1);this.record(`${r.name} 已移出场景。`,'remove');}
    release(r){if(r.partner){this.world.releasePerson?.(r.partner,r.id);r.partner.cooperating=false;r.partner.assigned=null;r.partner.wait=3;r.partner.path=[];r.partner=null;}r.path=[];r.endpoint=null;r.meeting=null;r.blockedTime=0;r.pendingNavigation=null;r.navigationGoal=null;if(r.line)this.drawRoute(r);}
    configureMission(r,resume=false){
      const old=r.mission,steps=taskSteps(r.task),index=resume&&old&&old.status!=='complete'?old.index:0;
      r.mission={steps:[...steps],index,results:resume&&old?old.results.filter(result=>result.index<index):[],status:'running',startedAt:resume&&old?old.startedAt:this.time};
      this.startStage(r,index);
    }
    startStage(r,index){
      this.release(r);r.mission.index=index;r.action=r.mission.steps[index];r.mission.stageStartedAt=this.time;r.inspected=false;r.meetingAttempted=false;r.reassigned=0;r.excludedPartners=new Set();r.checkpoints=null;r.checked=[];r.skipped=[];r.navigationFailure=null;r.startedAt=r.lastProgress=this.time;r.state='idle';r.wait=.3;r.status='准备执行'+taskNames[r.action];r.moving=false;r.pendingPickup=false;r.navigationGoal=null;this.drawRoute(r);
      const bounds=this.world.bounds,span=bounds?Math.hypot(bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ):0;r.stageTimeout=Math.max(120,Math.min(600,span*(r.action==='inspect'?3.5:2)/r.speed+30));
    }
    setTask(id,task,{preserveText=false}={}){const r=this.robots.find(r=>r.id===id);if(!r||!taskNames[task])return false;if(r.carrying&&r.task!==task){this.record(r.name+' 仍携带物品，请先完成或重试当前递送，再更换任务。','task');return false;}const same=preserveText&&r.task===task,carried=r.task===task&&r.carrying;r.carrying=!!carried;r.task=task;r.spec.task=task;if(!preserveText){r.spec.taskText=C.robotTaskSuggestions?.[task]||taskNames[task];r.spec.inspectionCount=3;}this.configureMission(r,same);this.record(`${r.name} ${same?'重试':'开始'}${taskNames[task]}，从第 ${r.mission.index+1} 步执行。`,'task');return true;}
    cancelTask(id){const r=this.robots.find(r=>r.id===id);if(!r||['complete','partial','deposited','attention','cancelled'].includes(r.state))return false;this.complete(r,'任务已取消'+(r.carrying?'，物品仍保留在机器人上':''),'cancelled');return true;}
    invalidateNavigation(grid,{relocate=false}={}){
      this.grid=grid;this.world.grid=grid;
      for(const r of this.robots){
        if(relocate&&!grid.isClear(r.x,r.z,r.radius)){const point=this.freePoint(r,r.radius,r);if(!point){this.complete(r,'新布局没有可容纳当前机型的空位，请移出后重新放置','attention');continue;}r.x=point.x;r.z=point.z;r.placement={...point};this.sync(r);this.record(r.name+' 已移至新布局中的最近空位。','task');}
        if(['complete','partial','deposited','attention','cancelled'].includes(r.state))continue;
        if(relocate){this.startStage(r,r.mission.index);this.record(r.name+' 按新布局重新执行当前步骤，已完成步骤与携带物品保留。','task');continue;}
        if(r.pendingNavigation){const pending=r.pendingNavigation;r.pendingNavigation=null;r.state=pending.state;r.navigationGoal={...pending.target};r.status='空间已调整，正在重新规划路线';continue;}
        if(!r.path.length)continue;const goal=r.goal||r.endpoint;r.path=[];r.blockedTime=0;r.nextReplan=0;r.navigationGoal=null;if(goal&&!this.go(r,goal)){r.navigationGoal={...goal};r.status='空间已调整，正在重新规划路线';}this.drawRoute(r);
      }
      for(const p of this.people)if(!p.external&&p.path.length&&!p.path.every((point,i)=>grid.lineClear(i?p.path[i-1]:p,point,p.radius)))p.path=[];
    }
    actors(){return [...this.people,...this.robots];}
    navigationActors(){return this.actors();}
    segmentClear(a,end,start=a){
      if(!this.grid.lineClear(start,end,a.radius+.015))return false;
      const dx=end.x-start.x,dz=end.z-start.z,len=dx*dx+dz*dz;
      return !this.navigationActors(a).some(b=>{
        if(b===a)return false;
        const t=len?Math.max(0,Math.min(1,((b.x-start.x)*dx+(b.z-start.z)*dz)/len)):0;
        return Math.hypot(start.x+dx*t-b.x,start.z+dz*t-b.z)<a.radius+b.radius+.10;
      });
    }
    plan(a,target){
      const grid=this.grid,nav=grid.nav(a.radius+.02),start=grid.nearest(a,a.radius+.02),end=grid.index(target.x,target.z);
      if(start<0||end<0||!nav.valid[end]||nav.component[start]!==nav.component[end])return null;
      // Keep the shared static grid untouched. This search includes the current
      // people/robot footprints, so waiting never repeats the same blocked line.
      const valid=nav.valid.slice();
      for(const b of this.navigationActors(a)){
        if(b===a)continue;const radius=a.radius+b.radius+.12;
        const c0=Math.max(0,Math.floor((b.x-radius-grid.minX)/grid.cell)),c1=Math.min(grid.cols-1,Math.floor((b.x+radius-grid.minX)/grid.cell));
        const r0=Math.max(0,Math.floor((b.z-radius-grid.minZ)/grid.cell)),r1=Math.min(grid.rows-1,Math.floor((b.z+radius-grid.minZ)/grid.cell));
        for(let row=r0;row<=r1;row++)for(let col=c0;col<=c1;col++){const i=row*grid.cols+col,p=grid.point(i);if(Math.hypot(p.x-b.x,p.z-b.z)<radius)valid[i]=0;}
      }
      if(!valid[end])return null;valid[start]=1;
      const costs=new Float64Array(grid.size),previous=new Int32Array(grid.size),closed=new Uint8Array(grid.size);costs.fill(Infinity);previous.fill(-1);costs[start]=0;
      const heap=new window.IndoorLab.Heap(),goal=grid.point(end),heuristic=i=>{const p=grid.point(i);return Math.hypot(p.x-goal.x,p.z-goal.z)/grid.cell;};heap.push(start,heuristic(start));
      while(heap.length){const i=heap.pop().id;if(closed[i])continue;closed[i]=1;if(i===end)break;
        grid.neighbors(i,valid,(j,cost)=>{if(closed[j]||!grid.lineClear(grid.point(i),grid.point(j),a.radius+.015))return;const next=costs[i]+cost;if(next>=costs[j])return;costs[j]=next;previous[j]=i;heap.push(j,next+heuristic(j));});
      }
      if(!closed[end])return null;
      const raw=[];for(let i=end;i!==start;i=previous[i])raw.push(grid.point(i));raw.push(grid.point(start));raw.reverse();
      const path=[];let anchor=a,index=0;
      while(index<raw.length){
        let far=index;if(!this.segmentClear(a,raw[far],anchor))return null;
        while(far+1<raw.length&&far-index<30&&this.segmentClear(a,raw[far+1],anchor))far++;
        path.push(raw[far]);anchor=raw[far];index=far+1;
      }
      return {path,endpoint:goal};
    }
    routeCandidates(a,target){
      if(!target)return [];
      const nav=this.grid.nav(a.radius),start=this.grid.nearest(a,a.radius);if(start<0)return [];
      return nav.free.map(i=>({i,p:this.grid.point(i)})).filter(({i,p})=>nav.component[i]===nav.component[start]&&Math.hypot(p.x-target.x,p.z-target.z)<1.5).sort((a,b)=>Math.hypot(a.p.x-target.x,a.p.z-target.z)-Math.hypot(b.p.x-target.x,b.p.z-target.z)).slice(0,16);
    }
    canReachStatically(a,target){
      // This diagnosis never creates an executable route. Motion still requires
      // the dynamic planner and its full people/robot collision footprints.
      const grid=this.grid,nav=grid.nav(a.radius+.02),start=grid.nearest(a,a.radius+.02);
      if(start<0||!grid.lineClear(a,grid.point(start),a.radius+.015))return false;
      const ends=new Set(this.routeCandidates(a,target).filter(({i})=>nav.valid[i]&&nav.component[i]===nav.component[start]).map(({i})=>i));
      if(!ends.size)return false;
      const seen=new Uint8Array(grid.size),queue=[start];seen[start]=1;
      for(let head=0;head<queue.length;head++){const i=queue[head];if(ends.has(i))return true;grid.neighbors(i,nav.valid,j=>{if(!seen[j]&&grid.lineClear(grid.point(i),grid.point(j),a.radius+.015)){seen[j]=1;queue.push(j);}});}
      return false;
    }
    go(a,target){
      for(const {p}of this.routeCandidates(a,target)){const route=this.plan(a,p);if(!route)continue;a.path=route.path;a.endpoint=route.endpoint;a.goal={x:target.x,z:target.z};a.blockedTime=0;if(a.spec)this.drawRoute(a);return true;}return false;
    }
    drawRoute(r){r.line.geometry.dispose();r.line.geometry=new T.BufferGeometry().setFromPoints([new T.Vector3(r.x,.06,r.z),...r.path.map(p=>new T.Vector3(p.x,.06,p.z))]);}
    canInteract(r,p){
      if(!p)return false;const distance=Math.hypot(r.x-p.x,r.z-p.z);
      if(distance>r.radius+1.15)return false;
      if(this.world.colliders){
        // Handoff happens at arm height, not on the floor navigation grid:
        // chairs/table legs must not block a reachable seated colleague.
        const height=1.15,steps=Math.max(1,Math.ceil(distance/.08));
        return !this.world.colliders.some(b=>{
          if(b.ignore||b.y-b.h/2>height||b.y+b.h/2<height)return false;
          const c=Math.cos(b.rotation||0),s=Math.sin(b.rotation||0);
          for(let i=0;i<=steps;i++){const t=i/steps,x=r.x+(p.x-r.x)*t-b.x,z=r.z+(p.z-r.z)*t-b.z;if(Math.abs(x*c-z*s)<b.w/2+.04&&Math.abs(x*s+z*c)<b.d/2+.04)return true;}
          return false;
        });
      }
      // Seated people occupy a chair cell. Check the space up to their body,
      // rather than treating their own chair as a wall between the partners.
      const t=Math.max(0,(distance-.45)/Math.max(distance,.001));
      return this.grid.lineClear(r,{x:r.x+(p.x-r.x)*t,z:r.z+(p.z-r.z)*t},.08);
    }
    approach(r,p){
      const nav=this.grid.nav(r.radius),start=this.grid.nearest(r,r.radius);if(start<0)return false;
      const candidates=[];
      for(const i of nav.free){if(nav.component[i]!==nav.component[start])continue;const q=this.grid.point(i),d=Math.hypot(q.x-p.x,q.z-p.z);if(d<r.radius+p.radius+.14||d>r.radius+1.05||!this.canInteract({...r,...q},p))continue;candidates.push(q);}
      candidates.sort((a,b)=>Math.hypot(a.x-r.x,a.z-r.z)-Math.hypot(b.x-r.x,b.z-r.z));
      for(const q of candidates.slice(0,16)){const route=this.plan(r,q);if(!route)continue;r.path=route.path;r.endpoint=route.endpoint;r.partnerPosition={x:p.x,z:p.z};r.nextTrack=this.time+1;r.blockedTime=0;this.drawRoute(r);return true;}return false;
    }
    askPerson(p,point,r,reason,seconds=25){
      if(p.external)return !!this.world.requestPerson?.(p,point,{token:r.id,seconds,reason});
      if(!this.go(p,point))return false;p.cooperating=true;p.wait=0;p.cooperateUntil=this.time+seconds;return true;
    }
    rendezvous(r,p){
      const nav=this.grid.nav(r.radius+.02),start=this.grid.nearest(r,r.radius+.02);if(start<0)return false;
      const spots=nav.free.filter(i=>nav.component[i]===nav.component[start]).map(i=>this.grid.point(i)).filter(q=>this.grid.isClear(q.x,q.z,r.radius+.15));
      spots.sort((a,b)=>(Math.hypot(a.x-r.x,a.z-r.z)+.7*Math.hypot(a.x-p.x,a.z-p.z))-(Math.hypot(b.x-r.x,b.z-r.z)+.7*Math.hypot(b.x-p.x,b.z-p.z)));
      for(const q of spots.filter((_,i)=>i%4===0).slice(0,24)){
        const route=this.plan(r,q);if(!route)continue;
        for(let i=0;i<8;i++){
          const angle=i*Math.PI/4,d=r.radius+p.radius+.26,person={x:q.x+Math.cos(angle)*d,z:q.z+Math.sin(angle)*d};
          if(!this.grid.isClear(person.x,person.z,p.radius+.03)||!this.canInteract({...r,...q},person)||this.actors().some(a=>a!==p&&a!==r&&Math.hypot(a.x-person.x,a.z-person.z)<a.radius+p.radius+.15))continue;
          if(!this.askPerson(p,person,r,'前往机器人交接点'))continue;
          r.meetingAttempted=true;r.partner=p;p.assigned=r.id;r.meeting={robot:q,person,until:this.time+25};r.path=route.path;r.endpoint=route.endpoint;r.state='approach';r.lastProgress=this.time;r.status='已约定交接点，与'+p.name+'会合';this.drawRoute(r);return true;
        }
      }
      return false;
    }
    requestPassage(r,p){
      if(!p||p.spec||p.assigned||this.time<(p.nextRequest||0)||p.source?.pose==='sit')return false;
      p.nextRequest=this.time+10;const q=r.path[0]||r,dx=q.x-r.x,dz=q.z-r.z,length=Math.hypot(dx,dz)||1;
      for(const side of [1,-1])for(const offset of [1.1,1.7,2.3]){
        const point={x:p.x-dz/length*side*offset,z:p.z+dx/length*side*offset};
        if(!this.grid.isClear(point.x,point.z,p.radius+.05)||!this.grid.lineClear(p,point,p.radius)||this.actors().some(a=>a!==p&&Math.hypot(a.x-point.x,a.z-point.z)<a.radius+p.radius+.2))continue;
        if(this.askPerson(p,point,r,'移到通道侧边让机器人通过',8)){r.status='同事正在侧移让行';return true;}
      }
      return false;
    }
    taskPoints(r,kind){
      const source=kind==='dropoff'?(this.world.dropoffPoints||this.world.taskPoints||[]):(this.world.taskPoints||[]);
      return source.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&!p.transfer&&!/卫生间|楼梯/.test(p.name||''));
    }
    waitForNavigation(r,point,state){
      r.pendingNavigation={target:{...point},state,deadline:r.lastProgress+10,nextRetry:this.time+1};r.state='navigation-wait';r.path=[];r.endpoint=null;r.goal={x:point.x,z:point.z};r.wait=0;r.moving=false;r.status='前往'+r.destinationName+'的通道暂被占用，等待通行（最多 10 秒）';this.drawRoute(r);return true;
    }
    failNavigation(r,state,reason){
      r.pendingNavigation=null;r.navigationGoal=null;r.path=[];
      if(state==='inspection'){r.skipped.push(r.destinationName);r.navigationFailure=reason;this.record(r.name+'：'+r.destinationName+'未完成，'+reason,'task');this.nextCheckpoint(r);}
      else this.complete(r,reason+'，物品保留在机器人上','attention');
    }
    retryNavigation(r){
      const pending=r.pendingNavigation;if(!pending)return;
      if(this.time>=pending.deadline){this.failNavigation(r,pending.state,'通道持续拥堵，等待 10 秒后仍无法通行');return;}
      if(this.time<pending.nextRetry)return;
      pending.nextRetry=this.time+1;
      if(this.go(r,pending.target)){r.pendingNavigation=null;r.state=pending.state;r.status='通道已恢复，继续前往'+r.destinationName;}
      else if(!this.canReachStatically(r,pending.target))this.failNavigation(r,pending.state,'当前布局中已无可通行路线');
    }
    nextCheckpoint(r){
      if(!r.checkpoints){
        const unique=[];for(const p of this.taskPoints(r,'inspect'))if(!unique.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<2))unique.push(p);
        r.checkpoints=unique.slice(0,Math.max(1,Math.min(3,r.spec.inspectionCount||3)));r.checked=[];r.skipped=[];r.checkpointTotal=r.checkpoints.length;
      }
      while(r.checkpoints.length){const point=r.checkpoints.shift();r.destinationName=point.name||'巡检点 '+(r.checked.length+r.skipped.length+1);if(this.go(r,point)){r.state='inspection';r.lastProgress=this.time;r.status='前往'+r.destinationName+' · '+(r.checked.length+1)+'/'+r.checkpointTotal;return true;}if(this.canReachStatically(r,point))return this.waitForNavigation(r,point,'inspection');r.skipped.push(point.name||'不可达巡检点');}
      if(r.checked.length){this.complete(r,'巡检结束：已检查 '+r.checked.length+' 个点'+(r.skipped.length?'，'+r.skipped.length+' 个点未完成，已记录':'')+(r.navigationFailure?'；'+r.navigationFailure:''),r.skipped.length?'partial':'complete');}
      else this.complete(r,r.navigationFailure||'没有可达巡检点，请更换位置或机型','attention');return false;
    }
    dropoff(r,pending=false){
      r.recipientName=r.spec.taskTargetName||r.partner?.name||'同事';this.release(r);
      const points=this.taskPoints(r,'dropoff').filter(p=>!r.pickupPoint||Math.hypot(p.x-r.pickupPoint.x,p.z-r.pickupPoint.z)>2&&(!p.sourcePoint||Math.hypot(p.sourcePoint.x-r.pickupPoint.x,p.sourcePoint.z-r.pickupPoint.z)>2)).sort((a,b)=>Number(!!a.serviceFallback)-Number(!!b.serviceFallback)||Math.hypot(a.x-r.x,a.z-r.z)-Math.hypot(b.x-r.x,b.z-r.z));
      let blocked=null;
      for(const point of points){if(this.go(r,point)){r.destinationName=point.name||'公共交接点';r.pendingPickup=pending;r.state='dropoff';r.lastProgress=this.time;r.status='前往'+r.destinationName+(pending?'存放物品，供收件人领取':'补给');return true;}if(!blocked&&this.canReachStatically(r,point))blocked=point;}
      if(blocked){r.destinationName=blocked.name||'公共交接点';r.pendingPickup=pending;return this.waitForNavigation(r,blocked,'dropoff');}
      this.complete(r,'没有可达投递点，物品仍在机器人上，请重新安排','attention');return false;
    }
    complete(r,status,state='complete'){
      const mission=r.mission;
      if(mission){mission.results=mission.results.filter(result=>result.index!==mission.index);mission.results.push({index:mission.index,task:r.action,startedAt:Number(mission.stageStartedAt.toFixed(2)),finishedAt:Number(this.time.toFixed(2)),state,summary:status,checked:[...(r.checked||[])],skipped:[...(r.skipped||[])]});
        if(state==='complete'&&mission.index+1<mission.steps.length){const finished=mission.index+1;this.startStage(r,mission.index+1);this.record(r.name+'：第 '+finished+' 步已完成；开始第 '+(mission.index+1)+' 步'+taskNames[r.action]+'。','task');return;}
        mission.status=state;mission.finishedAt=this.time;
      }
      this.release(r);r.state=state;r.status=status;r.wait=0;r.moving=false;
      if(state==='complete'){r.completed++;this.completed++;}
      this.record(r.name+'：'+status,state);
    }
    recover(r){
      if(r.partner&&!r.meetingAttempted&&['approach','handoff'].includes(r.state)&&this.rendezvous(r,r.partner))return;
      if(r.action==='assist'&&!r.spec.taskTarget&&(r.reassigned||0)<2){const previous=r.partner?.id;this.release(r);r.excludedPartners??=new Set();if(previous)r.excludedPartners.add(previous);r.reassigned=(r.reassigned||0)+1;r.lastProgress=this.time;r.state='idle';r.wait=.2;r.status='改为协助另一位可达同事';return;}
      if(r.state==='inspection'){this.failNavigation(r,'inspection','巡检通道持续不可达，10 秒内没有前进');return;}
      if(r.carrying){if(r.state==='dropoff')this.failNavigation(r,'dropoff','投递通道持续不可达，10 秒内没有前进');else this.dropoff(r,true);return;}
      if(r.state==='idle'&&['deliver','supply'].includes(r.action)){this.complete(r,'没有可达补给点，本次任务未取件','attention');return;}
      this.complete(r,r.spec.taskTarget?'无法与'+(r.spec.taskTargetName||'指定同事')+'会合，本次任务未完成':'暂无可执行的交接任务，请更换目标或执行方式','attention');
    }
    assign(r){
      const available=this.people.filter(p=>!p.assigned&&!p.source?.meetingId&&!p.source?.chatId&&!p.source?.emergencyType&&!r.excludedPartners?.has(p.id)&&(!r.spec.taskTarget||p.id===r.spec.taskTarget)).sort((a,b)=>(Number(a.id===r.lastPartner)-Number(b.id===r.lastPartner))*10000+Math.hypot(a.x-r.x,a.z-r.z)-Math.hypot(b.x-r.x,b.z-r.z));
      for(const p of available){
        if(!this.approach(r,p))continue;
        r.partner=p;p.assigned=r.id;p.path=[];p.moving=false;r.state='approach';r.status=`前往与${p.name}${r.action==='inspect'?'共同巡检':'交接'}`;return true;
      }
      for(const p of available.slice(0,4))if(this.rendezvous(r,p))return true;
      r.status=available.length?'当前机型无法接近'+(r.spec.taskTarget?(r.spec.taskTargetName||'指定伙伴'):'伙伴')+'，等待通道恢复或伙伴走近':r.spec.taskTarget?'等待'+(r.spec.taskTargetName||'指定伙伴')+'回到本层并空闲':'等待空闲的协作伙伴';r.wait=2;return false;
    }
    finish(r){
      const p=r.partner;if(!p)return;r.lastPartner=p.id;r.carrying=false;
      this.complete(r,'已与'+p.name+'完成'+taskNames[r.action]);
    }
    move(a,dt,isRobot){
      a.moving=false;if(!a.path.length)return;
      while(a.path.length&&Math.hypot(a.path[0].x-a.x,a.path[0].z-a.z)<.001)a.path.shift();if(!a.path.length)return;
      const q=a.path[0],dx=q.x-a.x,dz=q.z-a.z,d=Math.hypot(dx,dz),step=Math.min(d,a.speed*dt),nx=a.x+dx/d*step,nz=a.z+dz/d*step;
      const other=[...this.people,...this.robots].find(b=>b!==a&&Math.hypot(nx-b.x,nz-b.z)<a.radius+b.radius+.10&&Math.hypot(nx-b.x,nz-b.z)<Math.hypot(a.x-b.x,a.z-b.z)+.001);
      if(other||!this.grid.lineClear(a,{x:nx,z:nz},a.radius)){
        a.blockedTime=(a.blockedTime||0)+dt;
        if(isRobot&&other&&!other.spec){a.status=`礼让${other.name}`;if(this.time-a.lastYield>4){a.lastYield=this.time;this.yields++;if(this.time-(a.yieldEvent||-10)>15){this.record(`${a.name} 主动让行，等待${other.name}通过。`,'yield');a.yieldEvent=this.time;}}}
        if(isRobot&&a.blockedTime>2)this.requestPassage(a,other);
        if(a.blockedTime>.7&&this.time>=(a.nextReplan||0)){
          a.nextReplan=this.time+1.2+Number(a.id.split('-').at(-1))%3*.15;
          const replanned=isRobot&&a.state==='approach'&&a.partner?this.approach(a,a.partner):this.go(a,a.goal||a.endpoint);
          if(replanned){a.blockedTime=0;if(isRobot)a.status='绕开拥堵，继续当前任务';}
          else if(isRobot)a.status=a.carrying?'通道暂不可达，保留物品并等待通行':'通道暂不可达，等待通行后继续';
        }
        return;
      }
      a.blockedTime=0;a.x=nx;a.z=nz;a.moving=true;a.phase+=step*(a.spec?.type==='quadruped'?C.quadrupedKinematics.phasePerMetre/(a.spec.scale||1):5.8);
      const target=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(target-a.model.rotation.y),Math.cos(target-a.model.rotation.y));a.model.rotation.y+=delta*Math.min(1,dt*8);
      if(isRobot){a.lastProgress=this.time;a.distance+=step;this.distance+=step;if(a.state==='approach')a.status=`前往与${a.partner?.name||'伙伴'}${a.action==='inspect'?'核对巡检':'交接'}`;else if(a.state==='pickup')a.status='前往'+(a.pickupName||'补给点')+'取件';else if(a.state==='inspection')a.status='前往'+a.destinationName;else if(a.state==='dropoff')a.status='前往'+a.destinationName+(a.pendingPickup?'存放物品':'补给');}
    }
    step(dt){
      this.time+=dt;if(this.world.getPeople)this.syncExternalPeople();
      for(const p of this.people){
        if(p.external)continue;
        if(this.world.microgravity&&this.world.eventReactions?.stepCrew(this,p,dt))continue;
        if(this.world.microgravity&&this.stepCrew){this.stepCrew(p,dt);continue;}
        p.moving=false;
        if(p.cooperating){if(p.path.length)this.move(p,dt,false);else if(this.time>p.cooperateUntil)p.cooperating=false;}
        else if(p.assigned){const r=this.robots.find(r=>r.id===p.assigned);if(r?.state==='inspection')this.move(p,dt,false);if(r?.state==='handoff')p.model.rotation.y=Math.atan2(r.x-p.x,r.z-p.z);}
        else if(p.wait>0)p.wait-=dt;
        else if(!p.path.length){const index=(Math.floor(this.time/7)+Number(p.id.split('-')[1])*3)%this.world.peoplePoints.length,[x,z]=this.world.peoplePoints[index];this.go(p,{x,z});p.wait=2+Number(p.id.split('-')[1])%4;}
        else this.move(p,dt,false);
        this.sync(p);p.model.userData.limbs&&C.animateHuman(p.model,p.phase,p.moving,!!p.assigned&&this.robots.some(r=>r.id===p.assigned&&r.state==='handoff'));
      }
      for(const r of this.robots){
        if(this.world.microgravity&&this.world.eventReactions?.stepRobot(this,r,dt))continue;
        r.moving=false;
        const terminal=['complete','partial','deposited','attention','cancelled'].includes(r.state);
        if(r.pendingNavigation&&!terminal){if(this.time-r.startedAt>(r.stageTimeout||120))this.complete(r,'任务超时未完成'+(r.carrying?'，物品仍在机器人上':''),'attention');else this.retryNavigation(r);this.sync(r);if(!this.deferActorVisuals)C.animateRobot(r.model,r.phase,false,false,this.time);continue;}
        if(r.navigationGoal&&!terminal){const goal=r.navigationGoal;if(this.go(r,goal)){r.navigationGoal=null;r.lastProgress=this.time;}else{r.status='空间已调整，等待可通行路线';if(this.time-r.lastProgress>10){r.navigationGoal=null;this.recover(r);}this.sync(r);if(!this.deferActorVisuals)C.animateRobot(r.model,r.phase,false,false,this.time);continue;}}
        if(!terminal&&this.time-r.startedAt>(r.stageTimeout||120)){this.complete(r,'任务超时未完成'+(r.carrying?'，物品仍在机器人上':''),'attention');}
        else if(!terminal&&this.time-r.lastProgress>10&&!(r.meeting&&this.time<r.meeting.until)&&r.state!=='checking'&&r.state!=='handoff'){this.recover(r);}
        else if(r.wait>0){r.wait-=dt;}
        else if(r.state==='idle'){
          if(r.action==='inspect'){this.nextCheckpoint(r);}
          else if(['deliver','supply'].includes(r.action)&&!r.carrying){
            const points=[...(this.world.pickupPoints||[]),this.world.pickup].filter(Boolean);
            const pickup=points.find(point=>this.go(r,point));
            if(pickup){r.pickupName=pickup.name||'补给点';r.pickupPoint={x:pickup.x,z:pickup.z};r.state='pickup';r.lastProgress=this.time;r.status='前往'+r.pickupName+'取件';}
            else{r.status='正在尝试其他取件点';r.wait=1;}
          }else if(r.action==='supply'&&r.carrying)this.dropoff(r);else this.assign(r);
        }else if(r.state==='pickup'){
          if(r.path.length)this.move(r,dt,true);else{r.carrying=true;r.state='loaded';r.wait=1.5;r.lastProgress=this.time;r.status='正在领取物品';}
        }else if(r.state==='loaded'){
          r.carrying=true;if(r.action==='supply')this.dropoff(r);else this.assign(r);
        }else if(r.state==='approach'){
          const near=this.canInteract(r,r.partner);
          if(r.meeting&&this.time>=r.meeting.until){r.meeting=null;this.recover(r);}
          else if(near){r.path=[];this.drawRoute(r);r.state='handoff';r.handoff=0;r.status='正在与'+r.partner.name+'确认交接';}
          else if(r.meeting){if(r.path.length)this.move(r,dt,true);else r.status='已到交接点，同事正在走来';}
          else if(r.partner&&this.time>=(r.nextTrack||0)&&(!r.path.length||Math.hypot(r.partner.x-(r.partnerPosition?.x??r.partner.x),r.partner.z-(r.partnerPosition?.z??r.partner.z))>.6)){
            r.nextTrack=this.time+1;if(!this.approach(r,r.partner)&&!this.rendezvous(r,r.partner)){r.path=[];r.status='正在寻找双方可达的交接点';r.wait=1;this.drawRoute(r);}
          }else if(r.path.length)this.move(r,dt,true);
        }else if(r.state==='inspection'){
          if(r.path.length)this.move(r,dt,true);else{r.state='checking';r.wait=2;r.status='正在检查'+r.destinationName;}
        }else if(r.state==='checking'){
          r.checked.push(r.destinationName);r.lastProgress=this.time;this.nextCheckpoint(r);
        }else if(r.state==='dropoff'){
          if(r.path.length)this.move(r,dt,true);else{r.carrying=false;this.complete(r,'物品已送至'+r.destinationName+(r.pendingPickup?'，待'+r.recipientName+'领取':'，补给完成'),r.pendingPickup?'deposited':'complete');}
        }else if(r.state==='handoff'){
          if(!r.partner){r.state='idle';continue;}
          if(!this.canInteract(r,r.partner)){r.handoff=0;r.state='approach';r.path=[];r.meeting=null;r.nextTrack=0;r.status='重新约定交接位置';}
          else{r.model.rotation.y=Math.atan2(r.partner.x-r.x,r.partner.z-r.z);r.handoff+=dt;if(r.handoff>=3)this.finish(r);}
        }
        this.sync(r);if(!this.deferActorVisuals)C.animateRobot(r.model,r.phase,r.moving,r.state==='handoff'||r.state==='loaded',this.time);
      }
      if(this.time>=this.nextSample){this.history.push(this.completed);this.history=this.history.slice(-20);this.nextSample+=10;}
    }
    tick(dt){let remaining=Math.min(dt,.4);while(remaining>0){const step=Math.min(remaining,.05);this.step(step);remaining-=step;}}
    sync(a){a.model.position.set(a.x,0,a.z);}
    reset(){
      const specs=this.robots.map(r=>({spec:{...r.spec,task:r.task},position:{...r.placement}}));for(const r of [...this.robots])this.removeRobot(r.id);this.time=this.completed=this.yields=this.distance=this.serial=0;this.events=[];this.history=[0];this.nextSample=10;
      this.people.forEach((p,i)=>{if(p.external){p.assigned=null;return;}const [x,z]=this.world.peoplePoints[i]||[p.x,p.z],q=this.freePoint({x,z},p.radius,p);if(q){p.x=q.x;p.z=q.z;}p.assigned=null;p.path=[];p.wait=3+i;p.phase=0;p.blockedTime=0;p.moving=false;this.sync(p);p.model.userData.limbs&&C.animateHuman(p.model,0,false,false);});
      specs.forEach(({spec,position})=>this.addRobot(spec,{silent:true,...(this.canPlace(spec,position)?{position}:{})}));this.record('当前实验已重置，机器人配置已保留。','reset');
    }
    report(){return{schemaVersion:2,scene:this.world.root.name,sceneName:(this.world.displayName||C.environments[this.world.root.name]?.name||this.world.root.name),simulationSeconds:Number(this.time.toFixed(2)),model:'rule-based-local',metrics:{completedCollaborations:this.completed,yields:this.yields,robotDistanceMeters:Number(this.distance.toFixed(2))},people:this.people.length,robots:this.robots.map(r=>({id:r.id,name:r.name,type:r.spec.type,source:r.spec.source||'preset',task:r.task,taskText:r.spec.taskText||taskNames[r.task],taskTarget:r.spec.taskTarget||null,status:r.status,state:r.state,carrying:!!r.carrying,checked:r.checked||[],skipped:r.skipped||[],mission:r.mission?{steps:[...r.mission.steps],currentStep:r.mission.index+1,status:r.mission.status,results:r.mission.results.map(result=>({...result,checked:[...result.checked],skipped:[...result.skipped]}))}:null,completed:r.completed,distanceMeters:Number(r.distance.toFixed(2)),position:{x:r.x,z:r.z},joints:r.model.userData.jointDescriptors})),events:[...this.events].reverse()};}
  }
  C.Simulation=CollaborationSimulation;
})();
