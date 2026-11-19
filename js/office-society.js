/* A persistent office population: reservations, appointments, collision-safe routes and collective lift control. */
(() => {
  'use strict';const L=window.IndoorLab,RADIUS=.24;
  const jobs=['产品设计师','软件工程师','项目经理','研究员','运营专员','建筑师','市场顾问','财务专员'];
  const first=['林','陈','周','许','刘','沈','吴','赵','徐','陆','黄','郑','梁','宋','韩','唐','邓','杜','何','程','曹','袁','邹','谢','金','邵','高','叶','方','章','钟','夏'],last=['知远','雨桐','一帆','安宁','子墨','若溪','思齐','晓禾','嘉言','明哲','清岚','景行','亦晨','语乔','书涵','以安'];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
  function fastGrid(model,cell=.2){const g=new L.Grid(model.bounds,cell);for(const b of [...model.layoutItems,...(model.dynamicSolids||[]),...(model.doorSolids||[])]){if(b.destroyed||b.ignore||b.y+b.h/2<.08||b.y-b.h/2>1.8)continue;const ca=Math.cos(b.rotation),sa=Math.sin(b.rotation),ex=Math.abs(ca)*b.w/2+Math.abs(sa)*b.d/2,ez=Math.abs(sa)*b.w/2+Math.abs(ca)*b.d/2;
      const c0=clamp(Math.floor((b.x-ex-g.minX)/g.cell),0,g.cols-1),c1=clamp(Math.floor((b.x+ex-g.minX)/g.cell),0,g.cols-1),r0=clamp(Math.floor((b.z-ez-g.minZ)/g.cell),0,g.rows-1),r1=clamp(Math.floor((b.z+ez-g.minZ)/g.cell),0,g.rows-1);
      for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){const p=g.point(r*g.cols+c),dx=p.x-b.x,dz=p.z-b.z,lx=ca*dx-sa*dz,lz=sa*dx+ca*dz;if(Math.abs(lx)<b.w/2+.10&&Math.abs(lz)<b.d/2+.10)g.solid[r*g.cols+c]=1;}}
    g.finalize();g.nav(RADIUS);g.hasClosedDoors=!!model.doorSolids?.length;return g;}
  function nearest(g,p,component=g.nav(RADIUS).largest){const nav=g.nav(RADIUS),cc=Math.floor((p.x-g.minX)/g.cell),rr=Math.floor((p.z-g.minZ)/g.cell);let best=-1,score=Infinity;for(let rad=0;rad<18;rad++){for(let r=rr-rad;r<=rr+rad;r++)for(let c=cc-rad;c<=cc+rad;c++){if(rad&&Math.abs(r-rr)!==rad&&Math.abs(c-cc)!==rad||c<0||r<0||c>=g.cols||r>=g.rows)continue;const i=r*g.cols+c;if(!nav.valid[i]||component!==null&&nav.component[i]!==component)continue;const q=g.point(i),d=(q.x-p.x)**2+(q.z-p.z)**2;if(d<score){score=d;best=i;}}if(best>=0&&rad*g.cell>Math.sqrt(score)+g.cell)break;}return best<0?g.nearest(p,RADIUS,component??undefined):best;}
  function route(g,start,goal,avoid=[]){const base=g.nav(RADIUS),nav=avoid.length?{...base,valid:new Uint8Array(base.valid)}:base,si=nearest(g,start,g.hasClosedDoors?null:base.largest),gi=nearest(g,goal,g.hasClosedDoors?null:base.largest);if(si<0||gi<0||base.component[si]!==base.component[gi])return[];
    const clear=(a,b)=>{if(!g.lineClear(a,b,RADIUS+.025))return false;const dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz;return avoid.every(p=>{const t=length?clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/length,0,1):0;return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t)>=.49;});};
    for(const p of avoid){const cc=Math.floor((p.x-g.minX)/g.cell),rr=Math.floor((p.z-g.minZ)/g.cell);for(let r=rr-3;r<=rr+3;r++)for(let c=cc-3;c<=cc+3;c++){if(c<0||r<0||c>=g.cols||r>=g.rows)continue;const i=r*g.cols+c,q=g.point(i);if(i!==si&&i!==gi&&Math.hypot(q.x-p.x,q.z-p.z)<.51)nav.valid[i]=0;}}
    if(clear(start,g.point(gi)))return[g.point(gi)];const dist=new Float32Array(g.size),prev=new Int32Array(g.size);dist.fill(Infinity);prev.fill(-1);const heap=new L.Heap(),gp=g.point(gi),h=i=>{const p=g.point(i);return Math.hypot(p.x-gp.x,p.z-gp.z)/g.cell;};dist[si]=0;heap.push(si,h(si));let iterations=0;
    while(heap.length&&iterations++<g.size*3){const {id:i,cost}=heap.pop();if(i===gi)break;if(cost>dist[i]+h(i)+.01)continue;g.neighbors(i,nav.valid,(j,c)=>{const d=dist[i]+c;if(d<dist[j]){dist[j]=d;prev[j]=i;heap.push(j,d+h(j));}});}if(!Number.isFinite(dist[gi]))return[];const raw=[];for(let at=gi;at>=0;at=prev[at]){raw.push(g.point(at));if(at===si)break;}raw.reverse();const out=[];let a=start,i=0;while(i<raw.length){let j=i;while(j+1<raw.length&&j-i<35&&clear(a,raw[j+1]))j++;out.push(raw[j]);a=raw[j];i=j+1;}return out;}
  class OfficeLifts {
    constructor(society){this.society=society;this.calls=[];this.cars=[-1.6,1.6].map((x,i)=>({id:i,label:i?'B':'A',x,floor:i?16:1,velocity:0,capacity:10,passengers:[],door:0,state:'idle',direction:0,target:null,timer:0,stops:0}));this.completed=0;this.maxLoad=0;this.doorViolations=0;}
    get unavailable(){return !!this.outOfService||['fire','earthquake'].includes(this.society.emergency?.type);}
    setOutOfService(value){
      value=!!value;if(value===!!this.outOfService)return;this.outOfService=value;const s=this.society;
      if(value){
        const waiting=this.calls.splice(0);for(const q of waiting){q.agent.liftRequest=null;if(!q.agent.isPlayer)s.navigateToStair(q.agent,q.to,q.agent.id%2,1.2,'电梯停运，改走楼梯');}
        for(const c of this.cars){c.serviceStop=clamp(c.state==='moving'?(c.direction>0?Math.ceil(c.floor):Math.floor(c.floor)):Math.round(c.floor),1,30);for(const a of c.passengers)if(!a.manualLift)a.emergencyAlight=true;}
      }else for(const c of this.cars){c.serviceStop=null;c.manualHoldUntil=s.time+3.5;if(!this.unavailable){c.manualDestination=null;c.manualPickup=null;}}
    }
    request(a,to){if(this.unavailable){if(this.outOfService&&!a.isPlayer&&!a.emergencyType)this.society.navigateToStair(a,to,a.id%2,1.2,'电梯停运，改走楼梯');return false;}if(a.liftRequest)return;a.liftRequest={agent:a,from:Math.round(a.floor),to,direction:Math.sign(to-a.floor),time:this.society.time,car:null};this.calls.push(a.liftRequest);a.activity='lift-queue';a.state='waiting';a.gesture=null;a.zombieAnim='';a.reaction={code:'calm',posture:'upright'};a.action='等电梯';this.society.note(a,'呼叫电梯',`${a.floor}F → ${to}F`);}
    candidates(c){return this.calls.filter(q=>q.car===c.id&&!q.boarding&&q.agent.activity==='lift-queue'&&!q.overflow);}
    assign(){for(const q of this.calls){if(q.car!==null)continue;let best=null,cost=Infinity;for(const c of this.cars){const penalty=c.passengers.length>=c.capacity?20:0,reverse=c.direction&&Math.sign(q.from-c.floor)!==c.direction?8:0,v=Math.abs(q.from-c.floor)+penalty+reverse+this.calls.filter(r=>r.car===c.id).length*2;if(v<cost){cost=v;best=c;}}q.car=best.id;}
      for(const c of this.cars){const floors=new Set(this.calls.filter(q=>q.car===c.id).map(q=>q.from));for(const floor of floors){
        const queue=this.calls.filter(q=>q.car===c.id&&q.from===floor).sort((a,b)=>a.time-b.time||a.agent.id-b.agent.id);
        // Keep assigned places instead of making everyone cross the doorway
        // when the first waiter boards. Their place stays reserved until the
        // boarding motion finishes, including for newly arriving requests.
        const occupied=new Set(queue.filter(q=>!q.agent.isPlayer&&q.slot!==undefined).map(q=>q.slot));
        if(Math.abs(c.floor-floor)<.01)for(const a of c.passengers)if(a.liftStage==='boarding'&&a.liftQueueSlot!==undefined)occupied.add(a.liftQueueSlot);
        for(const q of queue){
          if(q.agent.isPlayer){q.overflow=false;continue;}
          if(q.agent.liftYield)continue;
          let index=q.slot;
          if(index===undefined||index>=10){let free=0;while(occupied.has(free))free++;if(index===undefined||free<10){occupied.delete(index);index=free;occupied.add(index);}}
          if(q.slot===index)continue;q.slot=index;
          const a=q.agent,near=index<10,p={x:c.x+(index%2?-.72:.72),z:near?3.3+Math.floor(index/2)*.60:9.2+Math.floor((index-10)/2)*.60};q.overflow=!near;
          this.society.setAction(a,'lift-reposition',near?'排队候梯':'在大厅等候电梯');this.society.navigate(a,p,()=>{a.activity='lift-queue';a.state='waiting';a.action=q.overflow?'在大厅等候电梯':'等电梯';});
        }
      }}
    }
    next(c){if(this.outOfService)return c.serviceStop;if(c.manualDestination!=null)return c.manualDestination;if(c.manualPickup!=null)return c.manualPickup;const passengers=c.passengers.filter(a=>a.liftStage==='riding'&&a.liftTo!=null),waiting=this.candidates(c);if(passengers.length){if(!c.direction)c.direction=Math.sign(passengers[0].liftTo-c.floor);const stops=[...passengers.map(a=>a.liftTo),...(passengers.length<c.capacity?waiting.filter(q=>q.direction===c.direction&&Math.sign(q.from-c.floor)===c.direction).map(q=>q.from):[])],ahead=stops.filter(f=>Math.sign(f-c.floor)===c.direction),list=ahead.length?ahead:stops;return list.sort((a,b)=>Math.abs(a-c.floor)-Math.abs(b-c.floor))[0];}if(!waiting.length)return null;const oldest=[...waiting].sort((a,b)=>a.time-b.time)[0];return this.society.time-oldest.time>35?oldest.from:[...waiting].sort((a,b)=>Math.abs(a.from-c.floor)-Math.abs(b.from-c.floor))[0].from;}
    tick(dt){for(const q of [...this.calls]){const a=q.agent;if(a.isPlayer||a.zombieControlled)continue;const crowd=this.calls.filter(r=>r.from===q.from).length,wait=this.society.time-q.time,longWait=wait>120;if((longWait||crowd>10&&(a.id%3===0||wait>35))&&this.society.navigateToStair(a,q.to,a.x<0?0:1,1.35,longWait?'候梯时间较长，改走楼梯':'候梯拥挤，改走楼梯')){this.calls=this.calls.filter(r=>r!==q);a.liftRequest=null;a.preferStairs=true;}}for(const c of this.cars){c.previous={floor:c.floor,door:c.door};for(const a of c.passengers)if(a.isPlayer)a.previous={x:a.x,z:a.z,angle:a.angle,gaitDistance:a.gaitDistance||0,gaitPhase: a.gaitPhase||0,sitBlend:0,floor:a.floor,location:a.location};}this.assign();const s=this.society;
      for(const c of this.cars){
        if(this.outOfService){c.manualDestination=c.serviceStop;c.manualPickup=c.serviceStop;c.manualHoldUntil=Infinity;if(c.state==='moving')c.target=c.serviceStop;else if(Math.abs(c.floor-c.serviceStop)<.01&&['idle','closing'].includes(c.state))c.state='opening';for(const a of c.passengers)if(!a.manualLift)a.emergencyAlight=true;}
        for(const a of [...c.passengers]){if(a.liftStage==='boarding'||a.liftStage==='alighting'){
            if(c.door<.999||Math.abs(c.floor-Math.round(c.floor))>.001){this.doorViolations++;continue;}
            const t=clamp((a.liftMotion||0)+dt/1.45,0,1),slot=a.liftSlot||0,seatX=c.x+(slot%2?-.62:.62),seatZ=-1.25+Math.floor(slot/2)*.72,boarding=a.liftStage==='boarding';
            const x=boarding?(t<.25?lerp(a.boardStart.x,c.x,t/.25):t>.8?lerp(c.x,seatX,(t-.8)/.2):c.x):lerp(a.alightStart.x,c.x,clamp(t/.25,0,1));
            const z=boarding?(t<.25?a.boardStart.z:lerp(a.boardStart.z,seatZ,clamp((t-.25)/.55,0,1))):lerp(a.alightStart.z,3.65,clamp((t-.25)/.75,0,1));
            const blocker=s.bodies.blocker(a,x,z,(c.floor-1)*3.6);
            if(blocker){s.yieldLiftDoorway(blocker,c,a);a.vx=a.vz=0;continue;}
            a.liftMotion=t;a.x=x;a.z=z;a.angle=boarding?Math.PI:0;a.pose='stand';a.state='moving';
            if(t===1){
              if(boarding){a.liftStage='riding';a.state='waiting';}
              else{c.passengers=c.passengers.filter(b=>b!==a);a.location='floor';a.floor=Math.round(c.floor);a.liftRequest=null;a.liftStage=null;a.emergencyAlight=false;a.baseY=0;this.completed++;s.note(a,'电梯到达',`${a.floor}F`);s.continuePlan(a);}
            }
          }if(a.location==='lift'){a.floor=c.floor;a.baseY=0;a.vx=0;a.vz=a.liftStage==='riding'?0:.6;}}
        if(c.state==='moving'){const pickup=this.candidates(c).filter(q=>q.direction===c.direction&&Math.sign(q.from-c.floor)===c.direction&&Math.abs(q.from-c.floor)<Math.abs(c.target-c.floor)&&Math.abs(q.from-c.floor)*3.6>c.velocity*c.velocity/3.4+.7).sort((a,b)=>Math.abs(a.from-c.floor)-Math.abs(b.from-c.floor))[0];if(pickup&&c.passengers.length<c.capacity)c.target=pickup.from;const dy=(c.target-c.floor)*3.6,sign=Math.sign(dy),maxV=Math.min(3.5,Math.sqrt(Math.max(0,2*1.7*Math.abs(dy))));c.velocity+=clamp(sign*maxV-c.velocity,-1.7*dt,1.7*dt);const step=c.velocity*dt/3.6;if(Math.abs(c.target-c.floor)<=Math.max(.012,Math.abs(step))){c.floor=c.target;c.velocity=0;c.state='opening';c.timer=0;}else c.floor+=step;continue;}
        if(c.state==='opening'){c.door=clamp(c.door+dt/.85,0,1);if(c.door===1){c.state='open';c.timer=0;c.openElapsed=0;c.stops++;if(c.manualPickup===Math.round(c.floor)){c.manualPickup=null;c.manualHoldUntil=s.time+12;}if(c.manualDestination===Math.round(c.floor))c.manualDestination=null;}continue;}
        if(c.state==='closing'){c.door=clamp(c.door-dt/.85,0,1);if(c.door===0){const next=this.next(c);if(next!==null&&Math.abs(next-c.floor)>.01){c.target=next;c.direction=Math.sign(next-c.floor);c.state='moving';}else{c.state='idle';c.direction=0;}}continue;}
        if(c.state==='idle'){const next=this.next(c);if(next!==null){if(Math.abs(next-c.floor)<.01){c.state='opening';c.timer=0;}else{c.target=next;c.direction=Math.sign(next-c.floor);c.state='moving';}}continue;}
        if(c.state==='open'){
          if(!c.passengers.some(a=>a.liftStage==='alighting'))for(const a of c.passengers)if(!a.manualLift&&a.liftStage==='riding'&&(a.liftTo===Math.round(c.floor)||a.emergencyAlight)){a.liftStage='alighting';a.liftMotion=0;a.alightStart={x:a.x,z:a.z};a.action='走出电梯';break;}
          const gettingOut=c.passengers.some(a=>a.liftStage==='alighting');
          if(!gettingOut){let waiting=this.candidates(c).filter(q=>q.from===Math.round(c.floor)).sort((a,b)=>a.time-b.time||a.agent.id-b.agent.id);if(!c.passengers.length&&waiting.length)c.direction=waiting[0].direction;
            for(const q of waiting){if(c.passengers.some(a=>a.liftStage==='boarding'))break;if(c.passengers.length>=c.capacity||q.direction!==c.direction)continue;const a=q.agent;if(a.activity!=='lift-queue'||Math.hypot(a.x-c.x,a.z-3.65)>3)continue;const used=new Set(c.passengers.map(p=>p.liftSlot));let slot=0;while(used.has(slot))slot++;a.liftSlot=slot;a.liftQueueSlot=q.slot;a.liftTo=q.to;a.liftStage='boarding';a.liftMotion=0;a.boardStart={x:a.x,z:a.z};a.location='lift';a.action='走进电梯';c.passengers.push(a);this.calls=this.calls.filter(v=>v!==q);c.timer=0;this.maxLoad=Math.max(this.maxLoad,c.passengers.length);s.note(a,'进入电梯',`${c.label} 梯 · ${q.to}F`);}}
          const busy=c.passengers.some(a=>a.liftStage!=='riding'),approaching=this.calls.some(q=>q.car===c.id&&q.from===Math.round(c.floor)&&q.direction===c.direction&&!q.overflow);c.timer+=dt;c.openElapsed+=dt;if(c.timer>=3.5&&s.time>(c.manualHoldUntil||0)&&!busy&&!(approaching&&c.passengers.length<c.capacity&&c.openElapsed<18))c.state='closing';
        }
      }
    }
  }
  class OfficeSociety {
    constructor(building){this.building=building;this.models=building.plates.map(p=>p.model);this.grids=new Map();this.seed=731943;this.running=true;this.speed=1;this.time=0;this.accumulator=0;this.agents=[];this.events=[];this.eventTotal=0;this.meetings=[];this.chats=[];this.resourceOwners=new Map();this.seatOwners=new Map();this.reservations=new Map();this.distance=0;this.arrivals=0;this.stairTrips=0;this.completedActivities=0;this.lifts=new OfficeLifts(this);this.nextCalendar=3;this.lastVisual=0;this.exterior=new L.OfficeExterior(this);this.bodies=new L.OfficeCrowdSpace(this);this.initialize();this.bodies.rebuild();this.activity=new L.CrowdActivity(this);this.initialIds=this.agents.map(a=>a.id).join(',');}
    random(){this.seed=(this.seed*1664525+1013904223)>>>0;return this.seed/4294967296;}
    model(f){return this.models[Math.round(f)-1];}
    toggleRoomDoor(f,id){
      const model=this.model(f),door=model?.doors.find(d=>d.id===id&&!d.external);if(!door)return false;
      if(door.open&&this.agents.some(a=>a.location==='floor'&&a.floor===f&&a.health!=='dead'&&Math.abs(a[door.axis]-door[door.axis])<door.width/2+.22&&Math.abs(a[door.axis==='x'?'z':'x']-door[door.axis==='x'?'z':'x'])<.32))return false;
      const open=!door.open;
      for(const copy of new Set([model,L.app?.model,L.continuousTower?.models[f-1]]))if(copy?.towerFloor===f)copy.setDoor(id,open);
      this.grids.delete(f);
      const view=this.building.view;
      if(view.model?.towerFloor===f){view.grid=this.grid(f);view.shadowDirty=true;view.pipeline._aoExcluded=null;}
      for(const a of this.agents)if(a.location==='floor'&&a.floor===f){
        a.zPath=[];a.zKind='';a.repath=a.nextHuntAt=a.escapeRetryAt=a.panicSearchAt=a.nextEgress=0;
        const trip=a.stairApproach;
        if(!open&&door.fire&&a.activity==='to-stairs'&&!a.zombieControlled&&trip&&L.TOWER.core.stairs[trip.side].id+'-door'===id){
          if(!this.navigateToStair(a,trip.to,1-trip.side,trip.speed,'改走另一侧楼梯'))this.navigateToLift(a,trip.to);
        }
      }
      return true;
    }
    grid(f){f=Math.round(f);if(!this.grids.has(f))this.grids.set(f,fastGrid(this.model(f)));return this.grids.get(f);}
    seatKey(f,id){return`${f}:${id}`;}
    seat(f,id){return this.model(f).seats.find(s=>s.id===id);}
    makeAgent(f,seat,role='employee'){
      const id=this.agents.length,age=22+(id*13%43),gender=id%2?'female':'male',height=(gender==='female'?.94:1.02)+(id%5-2)*.025;
      const a={id,health:'healthy',zombieHP:100,civilianHP:100,name:first[id%first.length]+last[(id+Math.floor(id/first.length))%last.length],role,job:role==='employee'?jobs[id%jobs.length]:role==='reception'?'接待专员':role==='security'?'安保专员':role==='visitor'?'来访人员':'咖啡服务',company:this.model(f).spec.company,age,gender,appearance:{gender,age,height,build:.93+(id%4)*.05,hair:id%5,glasses:id%4===0,outfit:id%6},type:'pedestrian',profile:{...L.PROFILES.pedestrian,radius:RADIUS,name:role==='employee'?'办公员工':role==='reception'?'接待人员':role==='security'?'站岗人员':'咖啡服务'},homeFloor:f,homeSeat:seat?.id,floor:f,location:'floor',x:seat?.x||0,z:seat?.z||0,angle:seat?.angle||0,vx:0,vz:0,state:'arrived',activity:'work',pose:seat?'sit':'stand',sitBlend:seat?1:0,seatId:seat?.id,trail:[],path:[],pathAt:0,search:6,distance:0,trip:0,waitTime:0,wait:0,action:'工位办公',until:80+this.random()*160};
      if(seat){this.seatOwners.set(this.seatKey(f,seat.id),id);this.reservations.set(this.seatKey(f,seat.id),id);}this.agents.push(a);return a;
    }
    initialize(){
      const lobby=this.models[0],staff=lobby.seats.filter(s=>s.kind==='staff');for(const seat of staff){const a=this.makeAgent(1,seat,'reception');a.action='接待与访客登记';a.gesture='typing';}for(const x of [-4.1,4.1]){const a=this.makeAgent(1,null,'security');a.x=x;a.z=10.6;a.angle=Math.PI;a.action='入口值守';a.until=20+a.id*7;}const bar=this.makeAgent(1,null,'barista');bar.x=-12.7;bar.z=-10.8;bar.action='咖啡服务';
      for(let f=2;f<=30;f++){const model=this.model(f),work=model.seats.filter(s=>s.kind==='work'||s.kind==='training'),count=Math.min(22,Math.max(10,Math.floor(work.length*.68)));for(let j=0;j<count&&j<work.length;j++){
          const seat=work[Math.floor(j*work.length/count)],a=this.makeAgent(f,seat);if(j===0){a.floor=0;a.location='outside';a.pose='stand';a.state='moving';a.sitBlend=0;a.activity='arrival';a.action='上班途中';a.outsidePath=this.arrivalPath(a);a.outsideAt=0;a.x=a.outsidePath[0].x;a.z=a.outsidePath[0].z;a.plan={floor:f,seatId:a.homeSeat,activity:'work'};}
          else if(j===1||j===2){a.pose='stand';a.seatId=null;const g=this.grid(f),p=g.point(nearest(g,seat.approach));a.x=p.x;a.z=p.z;a.until=1+j*2;}
        }}
      // Fixed visitors use lounge seats and the same circulation as employees.
      const lounge=lobby.seats.filter(s=>s.kind==='lounge');for(let i=0;i<8;i++){const a=this.makeAgent(1,null,'visitor'),s=lounge[i%lounge.length];a.x=s.x;a.z=s.z;a.angle=s.angle;a.pose='sit';a.sitBlend=1;a.seatId=s.id;a.activity='lounge';a.action='等候与交流';a.until=12+i*5;this.reservations.set(this.seatKey(1,s.id),a.id);}
      this.count=this.agents.length;
    }
    arrivalPath(a){const sign=a.homeFloor%2?1:-1,lane=sign*.65,first=a.homeFloor%3===0?[{x:sign*(10+(a.homeFloor-2)*1.4),z:46.4}]:[{x:sign*58.5,z:-25+(a.homeFloor-2)*1.7},{x:sign*58.5,z:34},{x:sign*57,z:40},{x:sign*53,z:45},{x:sign*46,z:46.4}];return[...first,{x:lane,z:46.4},{x:lane,z:27},{x:lane,z:21},{x:lane,z:12.1}];}
    note(a,from,to){const e={id:++this.eventTotal,time:this.time,agent:a.id,profile:'pedestrian',floor:Math.round(a.floor),type:'state_transition',from,to,reason:to,x:a.x,z:a.z,goal:a.goal?.name||to};this.events.push(e);if(this.events.length>1500)this.events.shift();}
    setAction(a,activity,text){if(a.activity!==activity)this.note(a,a.action,text);a.activity=activity;a.action=text;a.reaction={code:'calm',text:`${a.name} · ${text}`};}
    reserveSeat(a,f,seatId){const key=this.seatKey(f,seatId),owner=this.reservations.get(key);if(owner!==undefined&&owner!==a.id)return false;this.reservations.set(key,a.id);return true;}
    releaseSeat(a){if(a.seatId){const key=this.seatKey(a.floor,a.seatId);if(this.seatOwners.get(key)!==a.id)this.reservations.delete(key);}a.seatId=null;}
    featurePoint(a,feature){
      const g=this.grid(a.floor),nav=g.nav(RADIUS),cell=nearest(g,feature);
      if(cell<0)return;
      const center=g.point(cell);
      const people=this.agents.filter(b=>b!==a&&b.floor===a.floor&&b.location==='floor'&&!b.isPlayer);
      const free=p=>g.isClear(p.x,p.z,RADIUS+.045)&&nav.component[g.index(p.x,p.z)]===nav.largest
        &&g.lineClear(center,p,RADIUS)&&people.every(b=>Math.hypot(p.x-b.x,p.z-b.z)>=.68
          &&(!b.serviceSpot||b.state!=='moving'||b.zombieControlled||Math.hypot(p.x-b.serviceSpot.x,p.z-b.serviceSpot.z)>=.72));
      const slots=[center];
      for(const radius of [.92,1.72])for(let i=0;i<8;i++){
        const angle=(i+a.id%8)*Math.PI/4;
        const slot=g.index(center.x+Math.cos(angle)*radius,center.z+Math.sin(angle)*radius);
        if(slot>=0)slots.push(g.point(slot));
      }
      const cost=p=>Math.hypot(p.x-a.x,p.z-a.z)+.35*Math.hypot(p.x-center.x,p.z-center.z);
      slots.sort((p,q)=>cost(p)-cost(q));
      return slots.find(p=>free(p)&&(!a.serviceSpot||Math.hypot(p.x-a.serviceSpot.x,p.z-a.serviceSpot.z)>.65));
    }
    navigate(a,p,onArrival,path=route(this.grid(a.floor),a,p)){if(!path.length){a.state='waiting';a.until=this.time+4;a.path=[];a.serviceSpot=null;a.vx=a.vz=0;a.failedRoute=true;return false;}a.path=path;a.pathAt=0;a.onArrival=onArrival;a.state='moving';a.pose='stand';a.gesture='idle';a.stalledFor=0;a.stallChecks=0;a.failedRoute=false;a.goal={...p,name:a.plan?.name||a.action};a.progressCheck={time:this.time,x:a.x,z:a.z};return true;}
    navigateToStair(a,to,preferred,speed,label){
      const g=this.grid(a.floor),direction=Math.sign(to-a.floor);
      for(const side of [preferred,1-preferred]){
        const entry=L.sampleTowerStair(side,direction>0?0:1),path=route(g,a,entry);
        if(!path.length)continue;
        if(!this.bodies.canApproachStair(a,side)){a.stairApproach={side,to,speed};this.waitForStair(a,{side,to,speed,label});return true;}
        a.stairApproach={side,to,speed};
        this.setAction(a,'to-stairs',label);
        return this.navigate(a,entry,()=>{
          const first=L.officeStairPoint({from:a.floor,to:a.floor+direction,side,time:0,duration:1,start:a},.008);if(this.bodies.stairLandingBusy(a,side,a.floor,true)||this.bodies.blocks(a,first.x,first.z,first.y)){this.waitForStair(a,{side,to,speed,label});return;}
          a.stairWait=null;a.stairApproach=null;a.location='stairs';
          a.stair={from:a.floor,to:a.floor+direction,destination:to,side,time:0,duration:L.sampleTowerStair(side,0).length/speed,start:{x:a.x,z:a.z}};
          a.state='moving';this.setAction(a,'stairs',direction>0?'步行上楼':'步行下楼');
        },path);
      }
      return false;
    }
    waitForStair(a,trip){if(a.stairWait&&this.time<a.stairWait.until)return;const sign=Math.sign(L.TOWER.core.stairs[trip.side].x),goal={x:sign*(9.35-(a.id%3)*.62),z:-3.5+(Math.floor(a.id/3)%3)*.72};a.stairWait={...trip,until:this.time+2.1};a.action='在楼梯口侧面排队让行';const path=route(this.grid(a.floor),a,goal);if(path.length)this.navigate(a,goal,()=>{a.state='stair-wait';a.vx=a.vz=0;},path);else{a.state='stair-wait';a.vx=a.vz=0;}}
    navigateToLift(a,to){if(this.lifts.unavailable)return this.navigateToStair(a,to,a.id%2,1.2,'电梯停用，改走消防楼梯');
      a.stairApproach=null;
      const x=a.id%2?1.6:-1.6;
      this.setAction(a,'to-lift','前往电梯');
      return this.navigate(a,{x:x+(a.id%3-1)*.65,z:3.7+(Math.floor(a.id/3)%2)*.64},()=>this.lifts.request(a,to));
    }
    liftYieldObstacles(a){return this.agents.filter(b=>b!==a&&['floor','lift'].includes(b.location)&&Math.abs(b.floor-a.floor)<.01&&Math.hypot(b.x-a.x,b.z-a.z)<5);}
    yieldLiftDoorway(a,car,passenger){
      if(a.isPlayer||a.zombieControlled||a.health!=='healthy'||a.location!=='floor'||a.transition||a.pose==='sit'||a.liftYield)return;
      const g=this.grid(a.floor),sign=a.x<car.x?-1:1,others=this.liftYieldObstacles(a);
      for(const dz of [0,.8,1.6,-.8])for(const dx of [sign*1.15,-sign*1.15,sign*1.75,-sign*1.75]){
        const point={x:car.x+dx,z:Math.max(3.1,a.z+dz)};
        if(!g.isClear(point.x,point.z,RADIUS)||others.some(b=>Math.hypot(b.x-point.x,b.z-point.z)<.60))continue;
        const path=route(g,a,point,others);if(!path.length)continue;
        a.liftYield={car:car.id,passenger:passenger.id,activity:a.activity,action:a.action,goal:a.goal,onArrival:a.onArrival,moving:a.state==='moving'};
        this.setAction(a,'lift-yield','侧身让出电梯通道');
        this.navigate(a,point,()=>{a.state='lift-yield';a.vx=a.vz=0;},path);return;
      }
    }
    plan(a,plan){if(a.planning){a.state='waiting';a.until=this.time+4+(a.id%7)*.2;a.failedRoute=true;return false;}a.planning=true;try{return this.makePlan(a,plan);}finally{a.planning=false;}}
    makePlan(a,plan){if(a.robotCooperation&&plan.activity!=='robot-cooperation')a.robotCooperation=null;if(plan.seatId&&!this.reserveSeat(a,plan.floor,plan.seatId))return false;a.serviceSpot=null;const previous=a.pendingPlan||a.plan;if(previous?.seatId&&previous.seatId!==a.seatId&&(previous.floor!==plan.floor||previous.seatId!==plan.seatId)){const key=this.seatKey(previous.floor,previous.seatId);if(this.seatOwners.get(key)!==a.id)this.reservations.delete(key);}if(a.transition){a.pendingPlan=plan;return;}if(a.pose==='sit'){a.pendingPlan=plan;a.transition={kind:'stand',time:0,seat:this.seat(a.floor,a.seatId),start:{x:a.x,z:a.z}};a.action='起身离座';return;}this.releaseSeat(a);if(a.resourceKey&&a.resourceKey!==plan.resourceKey){this.resourceOwners.delete(a.resourceKey);a.resourceKey=null;}a.plan=plan;a.resourceKey=plan.resourceKey||null;this.continuePlan(a);}
    requestRobotCooperation(id,point,{token,seconds=25,reason='前往机器人交接点'}={}){
      const a=this.agents.find(a=>a.id===id);
      if(!a||a.isPlayer||a.health!=='healthy'||a.location!=='floor'||a.meetingId||a.chatId||a.emergencyType||a.zombieControlled||a.liftRequest||a.stairApproach||a.robotCooperation&&a.robotCooperation.token!==token)return false;
      const g=this.grid(a.floor),start=a.pose==='sit'?this.seat(a.floor,a.seatId)?.approach:a;
      if(!start||!g.isClear(point.x,point.z,RADIUS)||!route(g,start,point).length)return false;
      if(!a.robotCooperation)a.robotCooperation={token,previous:a.pendingPlan||a.plan||{floor:a.homeFloor,seatId:a.homeSeat,activity:'work'}};
      a.robotCooperation.expires=this.time+Math.min(40,seconds);
      this.plan(a,{floor:a.floor,activity:'robot-cooperation',feature:{...point,name:reason},name:reason});return true;
    }
    releaseRobotCooperation(id,token){
      const a=this.agents.find(a=>a.id===id),lease=a?.robotCooperation;if(!lease||lease.token!==token)return;
      a.robotCooperation=null;
      if(a.health==='healthy'&&a.location==='floor'&&!a.emergencyType&&!a.zombieControlled)this.plan(a,lease.previous);
    }
    continuePlan(a){const p=a.plan;if(!p)return;if(a.floor!==p.floor){const delta=p.floor-a.floor,wantsStairs=a.preferStairs||Math.abs(delta)<=2&&a.id%4===0;
        if(!wantsStairs||!this.navigateToStair(a,p.floor,a.id%2,.9+(a.id%4)*.08,'步行去楼梯'))this.navigateToLift(a,p.floor);
        return;}
      if(p.activity==='robot-cooperation'){this.setAction(a,p.activity,p.name);this.navigate(a,p.feature,()=>{a.state='arrived';a.until=a.robotCooperation?.expires||this.time+3;a.action='在交接点配合机器人';a.gesture='talk';});return;}
      if(p.seatId){const seat=this.seat(p.floor,p.seatId);if(!seat||!this.reserveSeat(a,p.floor,p.seatId)){this.returnHome(a);return;}this.setAction(a,`to-${p.activity}`,p.activity==='meeting'?'前往会议':p.activity==='chat'?'去和同事交流':p.activity==='lounge'?'前往休息座位':'返回工位');const g=this.grid(a.floor),approach=g.point(nearest(g,seat.approach,g.hasClosedDoors?null:g.nav(RADIUS).largest));this.navigate(a,approach,()=>{a.seatId=seat.id;a.transition={kind:'sit',time:0,seat,start:{x:a.x,z:a.z},activity:p.activity,duration:p.duration};a.action=seat.sofa?'准备坐沙发':'伸手拉开椅子';});}
      else{const feature=p.feature||this.model(a.floor).features.find(f=>f.kind===p.activity);if(!feature){this.returnHome(a);return;}this.setAction(a,`to-${p.activity}`,`前往${feature.name}`);const spot=this.featurePoint(a,feature);
        if(!spot){a.serviceSpot=null;a.vx=a.vz=0;a.state='arrived';a.until=this.time+4+(a.id%4);this.setAction(a,'service-wait',feature.name+'暂满 · 稍后再来');return;}
        a.serviceSpot=spot;this.navigate(a,spot,()=>{this.setAction(a,p.activity,p.activity==='toilet'?'使用卫生间':p.activity==='coffee'?'接水与咖啡':p.activity==='print'?'打印资料':p.activity==='reception'?'登记来访':p.activity==='chat'?'与同事交谈':'休息与交流');a.state='arrived';a.until=this.time+(p.duration||12+this.random()*16);this.arrivals++;});}
    }
    returnHome(a){if(a.role==='visitor'){const candidates=this.models[0].seats.filter(s=>s.kind==='lounge'&&!this.reservations.has(this.seatKey(1,s.id)));if(candidates.length)this.plan(a,{floor:1,seatId:candidates[a.id%candidates.length].id,activity:'lounge',duration:30});else{a.until=this.time+10;a.state='arrived';}return;}this.plan(a,{floor:a.homeFloor,seatId:a.homeSeat,activity:'work',duration:80+this.random()*160});}
    startChat(a){const peer=this.agents.find(b=>b!==a&&b.role==='employee'&&b.floor===a.floor&&b.location==='floor'&&b.activity==='work'&&!b.transition&&!b.meetingId&&!b.chatId&&!b.robotCooperation);if(!peer)return false;const seats=this.model(a.floor).seats.filter(s=>s.kind==='lounge'&&!this.reservations.has(this.seatKey(a.floor,s.id))),firstSeat=seats[0],second=firstSeat&&seats.find(s=>s.id!==firstSeat.id&&Math.hypot(s.x-firstSeat.x,s.z-firstSeat.z)<7);if(!second)return false;const id='chat-'+this.chats.length,session={id,floor:a.floor,ids:[a.id,peer.id],created:this.time,started:null,done:false};this.chats.push(session);for(const [i,person]of [a,peer].entries()){const seat=i?second:firstSeat;person.chatId=id;this.reserveSeat(person,a.floor,seat.id);this.plan(person,{floor:a.floor,seatId:seat.id,activity:'chat',duration:60});}return true;}
    chatsTick(){for(const c of this.chats){if(c.done)continue;const people=c.ids.map(id=>this.agents[id]),ready=people.every(a=>a.activity==='chat'&&a.pose==='sit'&&!a.transition);if(ready&&c.started===null){c.started=this.time;for(const a of people){a.until=Infinity;a.gesture='talk';}}if(c.started!==null&&this.time-c.started>20||this.time-c.created>100){c.done=true;for(const a of people){a.chatId=null;if(a.activity==='chat'&&!a.transition)this.returnHome(a);}}}}
    choose(a){if(a.robotCooperation)return;if(a.role!=='employee'&&a.role!=='visitor'){a.until=this.time+20;if(a.role==='security'){a.gesture='scan';a.angle+=.55;}return;}
      if(a.activity!=='work'&&a.activity!=='lounge'){this.completedActivities++;this.returnHome(a);return;}
      const r=this.random(),model=this.model(a.floor);if(a.role==='visitor'){const options=model.features.filter(f=>f.kind===(r<.5?'reception':'gallery')),f=options[a.id%options.length];this.plan(a,{floor:1,feature:f,activity:r<.5?'reception':'gallery',duration:15});return;}
      if(r<.18){const f=model.features.find(f=>f.kind==='toilet'&&!this.resourceOwners.has(`${a.floor}:${f.id}`));if(!f){a.until=this.time+5;return;}const key=`${a.floor}:${f.id}`;this.plan(a,{floor:a.floor,feature:f,activity:'toilet',duration:18,resourceKey:key});this.resourceOwners.set(key,a.id);}
      else if(r<.43){const f=model.features.filter(f=>f.kind==='coffee')[a.id%2];this.plan(a,{floor:a.floor,feature:f,activity:'coffee',duration:15});}
      else if(r<.57){const f=model.features.find(f=>f.kind==='print');this.plan(a,{floor:a.floor,feature:f,activity:'print',duration:12});}
      else if(r<.97){if(this.startChat(a))return;const seats=model.seats.filter(s=>s.kind==='lounge'&&!this.reservations.has(this.seatKey(a.floor,s.id)));if(seats.length)this.plan(a,{floor:a.floor,seatId:seats[Math.floor(this.random()*seats.length)].id,activity:'lounge',duration:25});else a.until=this.time+15;}
      else{const dest=clamp(a.homeFloor+(a.id%2?1:-1)*(1+a.id%3),2,30),f=this.model(dest).features.find(f=>f.kind==='chat')||this.model(dest).features.find(f=>f.kind==='coffee');this.plan(a,{floor:dest,feature:f,activity:'chat',duration:22});}
    }
    seating(a,dt){const tr=a.transition,s=tr.seat;if(!s){a.transition=null;return;}if(L.crossesClosedRoomDoor(this.model(a.floor),a,tr.kind==='sit'?s:s.approach)){a.vx=a.vz=0;return;}tr.time+=dt;const t=tr.time,back={x:s.x-Math.sin(s.angle)*.65,z:s.z-Math.cos(s.angle)*.65};a.angle=s.angle;a.vx=a.vz=0;a.state='arrived';
      if(tr.kind==='sit'){
        let offset=0;if(!s.sofa&&t<1.1){offset=.5*clamp(t/1.1,0,1);a.x=lerp(tr.start.x,back.x,clamp(t/.5,0,1));a.z=lerp(tr.start.z,back.z,clamp(t/.5,0,1));a.pose='pull';a.sitBlend=0;a.action='伸手拉出座椅';}
        else{const start=s.sofa?0:1.1,u=clamp((t-start)/1.3,0,1);offset=s.sofa?0:lerp(.5,.10,clamp((t-2.05)/.8,0,1));a.x=lerp(back.x,s.x-Math.sin(s.angle)*offset,u);a.z=lerp(back.z,s.z-Math.cos(s.angle)*offset,u);a.sitBlend=clamp((t-start-.35)/.8,0,1);a.pose='sit';a.action=u<1?'转身坐下':tr.activity==='work'?'就座使用电脑':tr.activity==='meeting'?'参加团队会议':tr.activity==='chat'?'坐下交流':'坐下休息';}
        this.setSeatOffset(a.floor,s.id,offset);
        if(t>(s.sofa?1.7:3.05)){a.transition=null;a.pose='sit';a.sitBlend=1;this.setAction(a,tr.activity,tr.activity==='work'?'工位办公':tr.activity==='meeting'?'团队会议':tr.activity==='chat'?'与同事交流':'沙发休息');a.until=this.time+(tr.duration||30+this.random()*50);a.gesture=tr.activity==='work'&&s.keyboard?'typing':tr.activity==='meeting'||tr.activity==='chat'?'talk':'idle';this.arrivals++;}
      }else{a.pose='sit';a.sitBlend=1-clamp(t/.8,0,1);a.x=lerp(tr.start.x,back.x,clamp(t/1.3,0,1));a.z=lerp(tr.start.z,back.z,clamp(t/1.3,0,1));this.setSeatOffset(a.floor,s.id,s.sofa?0:lerp(.1,0,clamp((t-.7)/.7,0,1)));if(t>1.45){const g=this.grid(a.floor),p=g.point(nearest(g,s.approach,g.hasClosedDoors?null:g.nav(RADIUS).largest));a.x=p.x;a.z=p.z;a.pose='stand';a.sitBlend=0;a.transition=null;a.gesture=null;this.releaseSeat(a);const plan=a.pendingPlan;a.pendingPlan=null;if(plan)this.plan(a,plan);}}
    }
    setSeatOffset(f,id,offset){this.model(f).setSeatOffset(id,offset);L.continuousTower?.models[Math.round(f)-1]?.setSeatOffset(id,offset);const current=L.app?.model;if(current?.towerFloor===Math.round(f)&&current!==this.model(f))current.setSeatOffset(id,offset);}
    stair(a,dt){const tr=a.stair,progress=this.bodies.stairProgress(a,clamp((tr.time+dt)/tr.duration,0,1)),p=L.officeStairPoint(tr,progress);
      const blocker=this.bodies.blocker(a,p.x,p.z,p.y);if(blocker){a.vx=a.vz=0;this.bodies.yieldLanding(blocker,a);return;}
      tr.time=progress*tr.duration;a.vx=(p.x-a.x)/dt;a.vz=(p.z-a.z)/dt;a.x=p.x;a.z=p.z;a.absoluteY=p.y;a.floor=tr.from;a.angle=p.angle;a.pose='stand';
      if(progress===1){a.floor=tr.to;a.location='floor';a.baseY=0;delete a.absoluteY;a.stair=null;this.stairTrips++;this.note(a,'楼梯跨层',`${a.floor}F`);this.continuePlan(a);}}
    calendar(){for(let f=2;f<=30;f++){if(this.meetings.some(m=>m.floor===f&&m.status!=='done')||this.time<18+(f%7)*9)continue;const model=this.model(f),room=model.features.find(q=>(q.kind==='meeting'||q.kind==='training')&&q.seats?.length>=4);if(!room)continue;const previous=this.meetings.filter(m=>m.floor===f).at(-1);if(previous&&this.time-previous.ended<160)continue;const seats=room.seats.filter(id=>!this.reservations.has(this.seatKey(f,id)));if(seats.length<3)continue;const own=this.agents.filter(a=>a.homeFloor===f&&a.role==='employee'&&a.location==='floor'&&a.activity==='work'&&!a.transition&&!a.meetingId&&!a.chatId&&!a.robotCooperation),visitor=this.agents.find(a=>a.homeFloor===clamp(f+(f%2?1:-1),2,30)&&a.role==='employee'&&a.location==='floor'&&a.activity==='work'&&!a.transition&&!a.meetingId&&!a.chatId&&!a.robotCooperation);const team=own.slice(0,3);if(visitor&&f%4===0)team.push(visitor);if(team.length<3)continue;const id=`meeting-${f}-${this.meetings.length}`,m={id,floor:f,room:room.name,status:'gathering',created:this.time,participants:team.map(a=>a.id),started:null};this.meetings.push(m);team.forEach((a,i)=>{a.meetingId=id;this.reserveSeat(a,f,seats[i]);this.plan(a,{floor:f,seatId:seats[i],activity:'meeting',duration:90,name:`${room.name} · 项目例会`});});}}
    meetingsTick(){for(const m of this.meetings){if(m.status==='done')continue;const team=m.participants.map(id=>this.agents[id]),arrived=team.filter(a=>a.floor===m.floor&&a.activity==='meeting'&&!a.transition);if(m.status==='gathering'&&(arrived.length===team.length||arrived.length>=2&&this.time-m.created>45)){m.status='active';m.started=this.time;for(const a of arrived){a.gesture='talk';a.until=Infinity;}}if(m.status==='active'&&this.time-m.started>32||m.status==='gathering'&&this.time-m.created>180){m.status='done';m.ended=this.time;for(const a of team){a.meetingId=null;if(a.activity==='meeting'&&!a.transition){a.until=this.time;this.returnHome(a);}}}}}
    tick(dt){if(this.building.combat?.hitStop>0)return;for(const a of this.agents)a.previous={x:a.x,z:a.z,angle:a.angle,gaitDistance:a.gaitDistance||0,gaitPhase:a.gaitPhase||0,sitBlend:a.sitBlend??(a.pose==='sit'?1:0),baseY:a.baseY||0,absoluteY:a.absoluteY,floor:a.floor,location:a.location};this.time+=dt;this.bodies.rebuild();this.lifts.tick(dt);if(!this.zombie?.active&&this.time>this.nextCalendar){this.nextCalendar=this.time+3;this.calendar();}this.meetingsTick();this.chatsTick();const buckets=new Map(),key=(f,x,z)=>`${f}:${Math.floor(x/.8)}:${Math.floor(z/.8)}`;for(const a of this.agents)if(a.location==='floor'&&a.pose!=='sit'){const k=key(a.floor,a.x,a.z);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(a);}
      for(const a of this.agents){if(a.robotCooperation&&this.time>=a.robotCooperation.expires)this.releaseRobotCooperation(a.id,a.robotCooperation.token);if(a.isPlayer||a.zombieControlled||a.respiratoryControlled||a.location==='escaped')continue;a.reaction={code:'calm',posture:'upright',text:`${a.name} · ${a.action}`};if(a.location==='lift')continue;if(a.location==='stairs'){this.stair(a,dt);continue;}
        if(a.stairWait){const trip=a.stairWait;if(this.time>=trip.until&&this.bodies.canApproachStair(a,trip.side)){a.stairWait=null;this.navigateToStair(a,trip.to,trip.side,trip.speed,trip.label);continue;}if(a.state==='stair-wait'||Math.hypot(a.x-a.goal.x,a.z-a.goal.z)<.38){a.state='stair-wait';a.vx=a.vz=0;continue;}}
        if(a.stairApproach&&!a.stairWait&&this.bodies.stairLandingBusy(a,a.stairApproach.side,a.floor,true)){this.waitForStair(a,{...a.stairApproach,label:'等待到达者离开平台'});}
        if(a.location==='outside'){const p=a.outsidePath[a.outsideAt],dx=p.x-a.x,dz=p.z-a.z,d=Math.hypot(dx,dz),step=Math.min(d,(1.01+(a.id%5)*.025)*dt);a.vx=d?dx/d:0;a.vz=d?dz/d:0;const nextX=a.x+a.vx*step,nextZ=a.z+a.vz*step;if(!this.bodies.blocks(a,nextX,nextZ)&&!L.crossesClosedRoomDoor(this.model(1),a,{x:nextX,z:nextZ})){a.x=nextX;a.z=nextZ;}else a.vx=a.vz=0;a.angle=Math.atan2(a.vx,a.vz);a.state='moving';if(d<.12)a.outsideAt++;if(a.outsideAt===a.outsidePath.length){a.location='floor';a.floor=1;a.baseY=0;this.note(a,'到达大门','进入一楼大厅');this.continuePlan(a);}continue;}
        if(a.transition){this.seating(a,dt);continue;}
        if(a.liftYield&&a.activity!=='lift-yield')a.liftYield=null;
        if(a.liftYield&&a.state==='lift-yield'){
          const wait=a.liftYield,car=this.lifts.cars[wait.car];
          if(car.passengers.some(p=>p.id===wait.passenger&&['boarding','alighting'].includes(p.liftStage)))continue;
          a.liftYield=null;this.setAction(a,wait.activity,wait.action);
          if(wait.goal&&wait.moving)this.navigate(a,wait.goal,wait.onArrival);
          else if(a.liftRequest){a.liftRequest.slot=undefined;a.activity='lift-queue';}
          else a.state='waiting';
        }
        if(a.activity==='lift-queue'){a.vx=a.vz=0;a.state='waiting';continue;}
        if(a.state==='moving'){
          const g=this.grid(a.floor);while(a.pathAt<a.path.length&&Math.hypot(a.path[a.pathAt].x-a.x,a.path[a.pathAt].z-a.z)<.045)a.pathAt++;if(a.pathAt>=a.path.length){a.vx=a.vz=0;a.state='arrived';const cb=a.onArrival;a.onArrival=null;if(cb)cb();continue;}
          const target=a.path[a.pathAt],dx=target.x-a.x,dz=target.z-a.z,d=Math.hypot(dx,dz)||1,speed=(a.age>57?.9:1.08)+(a.id%5)*.045,step=Math.min(d,speed*dt),neighbors=[],cx=Math.floor(a.x/.8),cz=Math.floor(a.z/.8);for(let r=cz-2;r<=cz+2;r++)for(let c=cx-2;c<=cx+2;c++)for(const other of buckets.get(a.floor+':'+c+':'+r)||[])if(other!==a&&Math.hypot(a.x-other.x,a.z-other.z)<1.6)neighbors.push(other);
          const heading=Math.atan2(dx,dz),service=!!a.serviceSpot,preferred=service||a.id%2?1:-1;
          const angles=[0,.3*preferred,-.3*preferred,.65*preferred,-.65*preferred,1.05*preferred,-1.05*preferred];
          if(service)angles.push(1.25,-1.25);
          else{
            angles.push(1.5*preferred,-1.5*preferred);
            if(a.stalledFor>1)angles.push(2.1*preferred,-2.1*preferred,Math.PI);
          }
          let best=null,score=-Infinity;
          for(const turn of angles){const nx=a.x+Math.sin(heading+turn)*step,nz=a.z+Math.cos(heading+turn)*step;if(!g.isClear(nx,nz,RADIUS)||this.bodies.blocks(a,nx,nz))continue;let repulsion=0;for(const b of neighbors){const after=Math.hypot(nx-b.x,nz-b.z);if(after<.9)repulsion+=(.9-after)*.8;}const value=Math.cos(turn)-Math.abs(turn)*.07-repulsion+(service&&turn>0?.012:0);if(value>score){score=value;best={x:nx,z:nz};}}
          const ox=a.x,oz=a.z;
          if(best){a.x=best.x;a.z=best.z;a.stalledFor=0;}
          else{
            a.waitTime+=dt;a.stalledFor=(a.stalledFor||0)+dt;
            if(!service&&a.stalledFor>1.5){
              const path=route(g,a,a.goal,a.liftYield?this.liftYieldObstacles(a):[]);
              if(path.length){a.path=path;a.pathAt=0;}
              a.stalledFor=1;
            }
          }
          const check=a.progressCheck;if(check&&this.time-check.time>2.5){if(Math.hypot(a.x-check.x,a.z-check.z)<.35){a.stallChecks=(a.stallChecks||0)+1;if(a.serviceSpot&&a.stallChecks>=2){this.continuePlan(a);continue;}const avoid=a.liftYield?this.liftYieldObstacles(a):this.agents.filter(b=>b!==a&&b.location==='floor'&&b.floor===a.floor&&b.pose!=='sit'&&Math.hypot(b.x-a.x,b.z-a.z)<3.2&&Math.hypot(b.x-a.goal.x,b.z-a.goal.z)>.8),detour=route(g,a,a.goal,avoid);if(detour.length){a.path=detour;a.pathAt=0;a.reroutes=(a.reroutes||0)+1;}}else a.stallChecks=0;a.progressCheck={time:this.time,x:a.x,z:a.z};}
          a.vx=(a.x-ox)/dt;a.vz=(a.z-oz)/dt;if(Math.hypot(a.vx,a.vz)>.02){const targetAngle=Math.atan2(a.vx,a.vz),da=Math.atan2(Math.sin(targetAngle-a.angle),Math.cos(targetAngle-a.angle));a.angle+=da*Math.min(1,dt*8);}a.distance+=Math.hypot(a.x-ox,a.z-oz);this.distance+=Math.hypot(a.x-ox,a.z-oz);
        }else if(this.time>=a.until&&!a.meetingId&&!a.chatId)this.choose(a);
        if(a.pose==='sit'){a.vx=a.vz=0;if(a.activity==='work')a.gesture=this.seat(a.floor,a.seatId)?.keyboard?'typing':'idle';else if(a.activity==='meeting'||a.activity==='chat')a.gesture='talk';else a.gesture=a.id%2?'phone':'idle';}
      }
      this.zombie?.tick(dt);this.exterior.tick(dt);this.bodies.rebuild();this.bodies.separate();this.recordLocomotion(dt);this.activity.tick(dt);for(const model of this.models)model.setElevators(this.lifts.cars);L.app?.model?.towerFloor&&L.app.model.setElevators(this.lifts.cars);
    }
    recordLocomotion(dt){for(const a of this.agents)L.Locomotion?.record(a,this.time,dt);}
    advance(dt){if(this.building.combat?.hitStop>0)return;this.accumulator+=Math.min(dt,2);let steps=0;while(this.accumulator>=.1&&steps++<30){this.tick(.1);this.accumulator-=.1;}}
    renderCar(c){const t=clamp(this.accumulator/.1,0,1);return c.previous?{...c,floor:lerp(c.previous.floor,c.floor,t),door:lerp(c.previous.door,c.door,t)}:c;}
    renderAgent(a){if(!this.zombie?.active&&['zombie','turning','grabbed'].includes(a.health))a={...a,health:'healthy',zombieAnim:'',alerted:false};const p=a.previous,t=clamp(this.accumulator/.1,0,1);if(!p||p.location!==a.location||a.location==='floor'&&p.floor!==a.floor)return a;return{...a,gaitPhase:lerp(p.gaitPhase||0,a.gaitPhase||0,t),gaitDistance:lerp(p.gaitDistance||0,a.gaitDistance||0,t),x:lerp(p.x,a.x,t),z:lerp(p.z,a.z,t),floor:lerp(p.floor,a.floor,t),absoluteY:a.absoluteY===undefined?undefined:lerp(p.absoluteY??a.absoluteY,a.absoluteY,t),angle:p.angle+Math.atan2(Math.sin(a.angle-p.angle),Math.cos(a.angle-p.angle))*t,sitBlend:lerp(p.sitBlend,a.sitBlend??(a.pose==='sit'?1:0),t)};}
    visibleAgents(f){const result=[];for(const source of this.agents){const a=this.renderAgent(source);if(a.location==='floor'&&a.floor===f)result.push(a);else if(a.location==='lift'&&Math.abs(a.floor-f)<.01&&this.lifts.cars.some(c=>c.passengers.some(p=>p.id===a.id)&&c.door>.95))result.push({...a,baseY:(a.floor-f)*3.6});else if(a.location==='stairs'&&a.absoluteY>=(f-1)*3.6&&a.absoluteY<f*3.6-.015)result.push({...a,baseY:a.absoluteY-(f-1)*3.6});}return result;}
    describe(floor){if(this.emergency?.type==='ventilation'){const h=this.emergency.hazard,m=h.summary(),f=h.floorSummary(floor||this.building.selected);return(floor?floor+'F':'办公楼')+'正在进行通风污染实验。本层覆盖 '+(f.coverage*100).toFixed(1)+'%，全楼已覆盖 '+Object.keys(m.floorTimes).length+' 层；人员继续日常活动。';}if(this.emergency?.type==='infection'){const h=this.emergency.hazard,m=h.summary(),people=this.agents.filter(a=>!floor||Math.round(a.floor)===floor),infected=people.filter(a=>h.states.get(a.id)?.stage).length;return(floor?floor+'F':'办公楼')+'正在进行日常呼吸道传播实验。本层感染 '+infected+' / '+people.length+' 人，全楼感染 '+m.infected+' / '+m.population+' 人。携带者随日程移动，喷嚏和交谈留下气溶胶；潜伏后才会继续传播。人员照常工作。已完整传播 '+Object.keys(m.floorTimes).length+' 层。';}if(this.emergency?.type==='earthquake'){const h=this.emergency.hazard,people=this.agents.filter(a=>(!floor||Math.round(a.floor)===floor)&&!a.isPlayer),sheltered=people.filter(a=>a.inShelter).length,escaped=this.agents.filter(a=>a.outdoorFlight&&a.hasMutated!==true).length;return(floor?floor+'F':'办公楼')+(h.shaking?'正在摇晃。人员先在当前房间寻找角落，蹲低保护头颈；已有 '+sheltered+' 人就位，暂不向楼梯疏散。':'摇晃已停止。人员离开避险位，经消防楼梯下楼，穿过首层入口后向街区分散；已有 '+escaped+' 人到达楼外。')+'地震及撤离期间电梯停用。';}if(this.emergency?.hazard){const kind=this.emergency.type==='fire'?'火灾':'地震',people=this.agents.filter(a=>!floor||Math.round(a.floor)===floor),aware=people.filter(a=>a.alertInfo).length,escaped=this.agents.filter(a=>a.health==='escaped').length;return(floor?floor+'F':'办公楼')+'正在进行'+kind+'实验。已有 '+aware+' 人发现危险或听到同伴警报，正在离座、避险并向楼梯疏散。全楼已有 '+escaped+' 人到达楼外。';}if(this.zombie?.active){const p=this.agents.filter(a=>!floor||Math.round(a.floor)===floor),infected=p.filter(a=>a.health==='zombie'||a.health==='turning').length,escaped=this.agents.filter(a=>a.health==='escaped').length;return (floor?floor+'F':'楼内')+'正处于丧尸逃生模式。当前感染 '+infected+' 人，全楼已有 '+escaped+' 人逃出。咬击会传播感染；生还者发现丧尸后会奔向楼梯，目标是穿过一楼主入口。';}const people=this.agents.filter(a=>!floor||Math.round(a.floor)===floor),working=people.filter(a=>a.activity==='work').length,moving=people.filter(a=>a.state==='moving').length,meeting=people.filter(a=>a.activity==='meeting').length,coffee=people.filter(a=>a.activity.includes('coffee')).length;const detail=people.find(a=>a.location==='stairs')||people.find(a=>a.location==='lift')||people.find(a=>a.state==='moving');return`${floor?floor+'F 的日常':'这座办公楼的日常'}持续展开。${working} 位同事正在工位办公，${moving} 人正在前往下一处目的地${meeting?'，'+meeting+' 人参与会议':''}${coffee?'，'+coffee+' 人前往茶水间或接水':''}。${detail?detail.name+'正在'+detail.action.replace(/^正在/,'')+'。':''}工作、短暂的休息与偶然的碰面，共同改变着楼里的活动节奏。`;}
    summary(){const count=kind=>this.agents.filter(a=>a.location===kind).length;return{total:this.agents.length,onFloor:count('floor'),outside:count('outside'),escaped:count('escaped'),inLifts:count('lift'),onStairs:count('stairs'),working:this.agents.filter(a=>a.activity==='work'&&!a.zombieControlled).length,seated:this.agents.filter(a=>a.pose==='sit').length,meetings:this.meetings.filter(m=>m.status==='active').length,queued:this.lifts.calls.length,completedLiftTrips:this.lifts.completed,stairTrips:this.stairTrips,completedActivities:this.completedActivities,identityStable:this.initialIds===this.agents.map(a=>a.id).join(','),time:this.time};}
  }
  class OfficeSocietySimulation {
    constructor(society,grid,model){this.society=society;this.grid=grid;this.floor=model.towerFloor;this.isOfficeSociety=true;this.settings={count:0,vision:120};this.history=[];this.sync();}
    sync(){this.agents=this.society.visibleAgents(this.floor);this.settings.count=this.agents.length;this.time=this.society.time+this.society.accumulator;this.arrivals=this.society.arrivals;this.distance=this.society.distance;this.events=this.society.events;this.eventTotal=this.events.length;}
    tick(dt){this.society.advance(dt*this.society.speed);this.sync();}
    summary(){return{...this.society.summary(),arrivals:this.arrivals,finishedTripArrivalRate:null,society:this.society.summary()};}
    clearHeat(){this.society.activity.clear();}
  }
  L.OfficeSociety=OfficeSociety;L.OfficeSocietySimulation=OfficeSocietySimulation;L.OfficeLifts=OfficeLifts;L.officeRoute=route;L.officeFastGrid=fastGrid;
})();
