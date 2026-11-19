/* Body envelopes shared by walking, flight and the first-person capsule. */
(() => {
  'use strict';
  const L=window.IndoorLab,CELL=1.4;
  const radius=a=>a.collisionRadius??.24*(a.appearance?.build??1);
  const height=(a,time)=>(a.health==='dead'||a.downUntil>time)?.31:a.isPlayer&&L.continuousTower?.fp.crouched?.88:a.pose==='sit'?1.23:1.7;
  const paired=(a,b)=>a.attack?.target===b.id||b.attack?.target===a.id;
  L.isOutdoorAgent=a=>a.location==='outside'||a.location==='escaped'&&!!(a.outdoorFlight||a.isPlayer)||!!(a.isPlayer&&L.continuousTower?.active&&L.continuousTower.worldWalk.outside);
  L.officeStairPoint=(tr,progress)=>{
    const up=tr.to>tr.from,t=up?progress:1-progress,p=L.sampleTowerStair(tr.side,t),span=.45/p.length;
    const before=L.sampleTowerStair(tr.side,t-span),after=L.sampleTowerStair(tr.side,t+span);
    p.angle=Math.atan2(after.x-before.x,after.z-before.z);
    // Arrival and departure use separate tracks across each shared landing.
    const ramp=1-L.clamp((-2.08-p.z)/.38,0,1);
    const lane=(up?1:-1)*(.06+.27*ramp)*Math.min(1,progress*p.length/.85,(1-progress)*p.length/.85);
    p.x+=Math.cos(p.angle)*lane;p.z-=Math.sin(p.angle)*lane;
    const startAt=tr.startAt||0,fromStart=(progress-startAt)*p.length;
    if(tr.start&&fromStart>=0&&fromStart<.85){
      const weight=1-fromStart/.85,entry=L.sampleTowerStair(tr.side,up?startAt:1-startAt);
      p.x+=(tr.start.x-entry.x)*weight;p.z+=(tr.start.z-entry.z)*weight;
    }
    p.y+=(Math.min(tr.from,tr.to)-1)*3.6;
    if(!up)p.angle+=Math.PI;
    return p;
  };

  class OfficeCrowdSpace {
    constructor(society){this.s=society;this.cells=new Map();}
    stairLandingBusy(a,side,floor,departing=false){
      const length=L.sampleTowerStair(side,0).length;
      return this.s.agents.some(b=>{
        const trip=b.stair;
        if(a===b||b.location!=='stairs'||!trip||trip.side!==side||b.health==='dead'||b.isPlayer)return false;
        const distance=trip.time/trip.duration*length,up=trip.to>trip.from;
        if(departing)return trip.to===floor&&length-distance<(up?4.85:2.6)-.01;
        return trip.from===floor&&distance<(up?2.6:4.85);
      });
    }
    stairProgress(a,progress){
      const trip=a.stair,length=L.sampleTowerStair(trip.side,0).length;
      const edge=1-(trip.to>trip.from?4.85:2.6)/length;
      if(trip.time/trip.duration<=edge+1e-6&&progress>edge&&this.stairLandingBusy(a,trip.side,trip.to))return edge;
      return progress;
    }
    canApproachStair(a,side){
      if(this.stairLandingBusy(a,side,a.floor,true))return false;
      // Reserve the short doorway approach before people enter it, rather
      // than letting every waiter occupy the stair's arrival platform.
      return !this.s.agents.some(b=>b!==a&&b.location==='floor'&&b.floor===a.floor
        &&b.stairApproach?.side===side&&!b.stairWait&&!b.zombieControlled);
    }
    yieldLanding(a,incoming){
      if(a.isPlayer||a.location!=='floor'||a.health!=='healthy'||a.pose==='sit'||this.s.time<(a.stairYieldUntil||0))return;
      const s=this.s,side=incoming.stair?.side;if(side===undefined)return;
      a.stairYieldUntil=s.time+3;
      if(!a.zombieControlled){const trip=a.stairApproach;if(trip)s.waitForStair(a,{...trip,label:'依次通过楼梯口'});return;}
      const goal={x:Math.sign(incoming.x)*(9.45-(a.id%3)*.55),z:-3.2+(a.id%3)*.65},route=L.officeRoute(s.grid(a.floor),a,goal);
      if(route.length)Object.assign(a,{zPath:route,zAt:0,zKind:'stair-yield',zGoal:goal,blockedFor:0});
    }
    feet(a){
      if(a.isPlayer)return a.feetY??(a.floor-1)*3.6;
      return L.isOutdoorAgent(a)?this.s.exterior.ground(a.x,a.z)-.82:a.absoluteY??(a.floor-1)*3.6;
    }
    rebuild(){
      this.cells.clear();
      for(const a of [...this.s.agents,...(this.s.robotBodies?.()||[])]){
        if(a.isPlayer&&!this.s.building.continuous?.active)continue;
        if(a.location==='escaped'&&!a.isPlayer&&!a.outdoorFlight)continue;
        const key=this.key(Math.floor(a.x/CELL),Math.floor(a.z/CELL),Math.floor(this.feet(a)/2.4));
        if(!this.cells.has(key))this.cells.set(key,[]);
        this.cells.get(key).push(a);
      }
    }
    key(x,z,y){return x+':'+z+':'+y;}
    *near(x,z,feet){
      const cx=Math.floor(x/CELL),cz=Math.floor(z/CELL),cy=Math.floor(feet/2.4);
      for(let i=cx-1;i<=cx+1;i++)for(let j=cz-1;j<=cz+1;j++)for(let y=cy-1;y<=cy+1;y++){
        const cell=this.cells.get(this.key(i,j,y));if(cell)yield* cell;
      }
    }
    blocks(...args){return !!this.blocker(...args);}
    blocker(a,x,z,feet=this.feet(a),visual=false,from=a){
      const vx=x-from.x,vz=z-from.z,stepSquared=vx*vx+vz*vz;
      if(!stepSquared)return false;
      const robot=L.robotContacts?.blocker(a,x,z,feet,from,visual);if(robot)return robot;
      const top=feet+height(a,this.s.time),bodyRadius=radius(a),t=L.clamp(this.s.accumulator/.1,0,1);
      for(const b of this.near(x,z,feet)){
        if(b===a||paired(a,b)||b.isPlayer&&!this.s.building.continuous?.active)continue;
        const tr=a.stair,other=b.stair;
        if(!a.isPlayer&&a.location==='stairs'&&b.location==='stairs'&&tr&&other&&tr.side===other.side&&tr.from===other.from&&tr.to===other.to&&tr.time/tr.duration>other.time/other.duration+.001)continue;
        const dx=x-b.x,dz=z-b.z,limit=bodyRadius+radius(b);
        if(Math.abs(dx)>limit+.42||Math.abs(dz)>limit+.42)continue;
        let bx=b.x,bz=b.z,by=this.feet(b);
        if(visual&&!b.isPlayer&&b.previous?.location===b.location&&Math.abs(b.floor-b.previous.floor)<1.01){
          bx=b.previous.x+(bx-b.previous.x)*t;bz=b.previous.z+(bz-b.previous.z)*t;
          if(b.previous.absoluteY!==undefined)by=b.previous.absoluteY+(by-b.previous.absoluteY)*t;
        }
        if(by>=top-.08||by+height(b,this.s.time)<=feet+.08)continue;
        const next=(x-bx)**2+(z-bz)**2,previous=(from.x-bx)**2+(from.z-bz)**2;
        if(next<limit*limit&&next<previous+1e-8)return b;
        if(previous>=limit*limit){
          const along=L.clamp(((bx-from.x)*vx+(bz-from.z)*vz)/stepSquared,0,1);
          if((from.x+vx*along-bx)**2+(from.z+vz*along-bz)**2<limit*limit)return b;
        }
      }
      return false;
    }
    separate(){
      const canShift=a=>!a.isPlayer&&!a.transition&&!a.rise&&!a.attack&&a.grabbedBy==null&&a.pose!=='sit'
        &&a.health!=='dead'&&!(a.downUntil>this.s.time)&&(a.location==='floor'||L.isOutdoorAgent(a));
      for(const a of this.s.agents){
        if(!canShift(a))continue;
        let dx=0,dz=0;
        const feet=this.feet(a);
        for(const b of this.near(a.x,a.z,feet)){
          if(a===b||paired(a,b))continue;
          const by=this.feet(b);
          if(by>=feet+1.34||by+height(b,this.s.time)<=feet+.10)continue;
          const vx=a.x-b.x,vz=a.z-b.z,d=Math.hypot(vx,vz),gap=radius(a)+radius(b)-d;
          if(gap<.005)continue;
          const angle=(Math.min(a.id,b.id)*2.399963+.6)+(a.id<b.id?0:Math.PI);
          dx+=(d?vx/d:Math.cos(angle))*gap;dz+=(d?vz/d:Math.sin(angle))*gap;
        }
        const d=Math.hypot(dx,dz);if(d<.005)continue;
        const step=Math.min(.11,d*.57),x=a.x+dx/d*step,z=a.z+dz/d*step;
        const grid=L.isOutdoorAgent(a)?this.s.exterior.grid:this.s.grid(a.floor);
        if(grid?.isClear(x,z,.24)&&!this.blocks(a,x,z,feet)){a.x=x;a.z=z;}
      }
    }
  }

  class OfficeExterior {
    constructor(society){
      this.s=society;
      this.surfaces=society.building.outdoorBoxes.filter((b,i)=>i<4||b.h<=.14);
    }
    ground(x,z){
      let top=-.9;
      for(const b of this.surfaces)if(Math.abs(x-b.x)<=b.w/2&&Math.abs(z-b.z)<=b.d/2)top=Math.max(top,b.y+b.h/2);
      const rounded=(px,pz,w,d,r)=>Math.hypot(Math.max(0,px-w/2+r),Math.max(0,pz-d/2+r))<=r;
      for(const b of this.s.building.outdoorWalkways){
        const px=Math.abs(x-b.x),pz=Math.abs(z-b.z);
        if(!rounded(px,pz,b.w,b.d,b.r))continue;
        if(!b.width||!rounded(px,pz,b.w-b.width*2,b.d-b.width*2,Math.max(2,b.r-b.width)))top=Math.max(top,b.y);
      }
      if(Math.abs(x)<3&&z>=21&&z<=27)top=Math.max(top,.65-(z-21)*.09);
      return top;
    }
    prepare(){
      const g=this.grid=new L.Grid({minX:-102,maxX:102,minZ:-87,maxZ:87},.75);
      const solid=(x,z,w,d)=>{
        const c0=Math.max(0,Math.ceil((x-w/2-g.minX)/g.cell-.5)),c1=Math.min(g.cols-1,Math.floor((x+w/2-g.minX)/g.cell-.5));
        const r0=Math.max(0,Math.ceil((z-d/2-g.minZ)/g.cell-.5)),r1=Math.min(g.rows-1,Math.floor((z+d/2-g.minZ)/g.cell-.5));
        for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++)g.solid[r*g.cols+c]=1;
      };
      solid(0,0,36,26);
      for(const b of this.s.building.outdoorBoxes.slice(4))if(b.h>.30&&b.y-b.h/2<1.28)solid(b.x,b.z,b.w+.5,b.d+.5);
      g.finalize();
      this.destinations=g.nav(.24).mainFree.filter(i=>g.distance[i]>1.05).map(i=>g.point(i)).filter(p=>Math.hypot(p.x,p.z)>31);
    }
    navigation(){if(!this.grid)this.prepare();return this.grid;}
    canSee(a,b){
      const g=this.navigation();
      if(L.isOutdoorAgent(a)&&L.isOutdoorAgent(b))return g.lineClear(a,b,.04);
      const outside=L.isOutdoorAgent(a)?a:b,inside=outside===a?b:a;
      if(inside.location!=='floor'||Math.round(inside.floor)!==1||outside.z<=13||inside.z>=13)return false;
      const crossing=z=>({x:inside.x+(outside.x-inside.x)*(z-inside.z)/(outside.z-inside.z),z});
      const portal=crossing(13);
      return Math.abs(portal.x)<2.65&&this.s.grid(1).lineClear(inside,crossing(12.75),.04)&&
        (outside.z<=13.5||g.lineClear(crossing(13.5),outside,.04));
    }
    begin(a,reason){
      this.navigation();
      const s=this.s;
      s.note(a,'一楼主入口',reason);
      a.location='escaped';a.health='escaped';a.floor=0;a.zPath=[];a.zombieControlled=true;
      a.state='moving';a.pose='stand';a.sitBlend=0;a.action='正在向街区分散';a.zombieAnim='flee';a.outdoorFlight={path:[],at:0,retryAt:s.time};
    }
    frighten(a,point,infection=false){
      const s=this.s,f=a.outdoorFlight;
      if(f?.dangerUntil>s.time&&f.infection===infection&&Math.hypot(f.threat.x-point.x,f.threat.z-point.z)<4){
        f.dangerUntil=Math.max(f.dangerUntil,s.time+3);
        return;
      }
      this.navigation();
      const origin=f?.origin||(a.location==='outside'&&a.outsidePath?{x:a.x,z:a.z}:null);
      a.outdoorFlight={path:[],at:0,retryAt:s.time,origin,threat:{x:point.x,z:point.z},infection,
        dangerUntil:s.time+(infection?12:6)+(a.id%5)*.65};
      a.zombieControlled=true;a.pose='stand';a.sitBlend=0;a.alerted=true;
      a.action=infection?'在街区发现感染者，跑向安全处':'在街区受惊，四散躲避';
      s.note(a,'街区避险',a.action);
    }
    enterZombie(a){
      this.navigation();
      Object.assign(a,{location:'outside',floor:0,zPath:[],zKind:'',streetHunt:null,outdoorFlight:null,action:'进入街区追捕'});
    }
    route(a){
      const s=this.s,f=a.outdoorFlight;
      if(f.origin&&s.time>=f.dangerUntil){
        const {x,z}=f.origin,returnPoint={x,z:Math.abs(x)<2.6&&z>11.8&&z<13.8?13.8:z};
        f.path=L.officeRoute(this.grid,a,returnPoint);f.at=0;f.returning=true;
        return;
      }
      const occupied=s.agents.filter(b=>b!==a&&b.outdoorFlight).map(b=>b.outdoorFlight.destination||b);
      const dispersed=f.done;
      let best=null,score=-Infinity;
      for(let i=0;i<22;i++){
        let p;
        if(f.threat&&s.time<f.dangerUntil&&i<16){
          const angle=Math.atan2(a.z-f.threat.z,a.x-f.threat.x)+(s.random()-.5)*2.7,range=5+s.random()*9;
          const cell=this.grid.index(a.x+Math.cos(angle)*range,a.z+Math.sin(angle)*range),nav=this.grid.nav(.24);
          if(!nav.valid[cell]||nav.component[cell]!==nav.largest)continue;
          p=this.grid.point(cell);
        }else p=this.destinations[Math.floor(s.random()*this.destinations.length)];
        if(dispersed&&Math.hypot(p.x-a.x,p.z-a.z)<12)continue;
        const separation=occupied.reduce((d,q)=>Math.min(d,(p.x-q.x)**2+(p.z-q.z)**2),100);
        const away=f.threat&&s.time<f.dangerUntil?Math.min(22,Math.hypot(p.x-f.threat.x,p.z-f.threat.z))*2:0;
        const value=separation+s.random()*13+away-(dispersed?Math.hypot(p.x-a.x,p.z-a.z)*.19:0);
        if(value>score){best=p;score=value;}
      }
      if(!best)return;
      f.destination=best;
      f.path=L.officeRoute(this.grid,a,best);f.at=0;
    }
    advance(a,p,dt,speed){
      const heading=Math.atan2(p.x-a.x,p.z-a.z),distance=Math.hypot(p.x-a.x,p.z-a.z),step=Math.min(distance,speed*dt);
      for(const turn of [0,.3,-.3,.65,-.65,1.05,-1.05,1.42,-1.42]){
        const x=a.x+Math.sin(heading+turn)*step,z=a.z+Math.cos(heading+turn)*step;
        if(!this.grid.isClear(x,z,.24)||L.crossesClosedRoomDoor(this.s.model(1),a,{x,z})||this.s.bodies.blocks(a,x,z))continue;
        a.vx=(x-a.x)/dt;a.vz=(z-a.z)/dt;a.x=x;a.z=z;a.state='moving';a.angle+=Math.atan2(Math.sin(heading+turn-a.angle),Math.cos(heading+turn-a.angle))*Math.min(1,dt*8);
        return true;
      }
      a.vx=a.vz=0;
      return false;
    }
    chase(a,target,dt){
      const s=this.s,g=this.navigation();
      const route=a.streetHunt??={path:[],at:0,retryAt:0,target:null};
      // Direct visibility needs no A* search over the entire street grid.
      const direct=target&&g.lineClear(a,target,.24);
      if(direct){route.path=[];route.at=0;if(this.advance(a,target,dt,3.7))return;}
      if(this.huntTick!==s.time){this.huntTick=s.time;this.huntPlans=0;}
      if(!direct&&s.time>=route.retryAt&&this.huntPlans<5){
        this.huntPlans++;
        route.retryAt=s.time+.65+(a.id%6)*.11;
        const goal=target||(!route.path.length||route.at>=route.path.length?this.destinations[Math.floor(s.random()*this.destinations.length)]:null);
        if(goal){route.path=L.officeRoute(g,a,goal);route.at=0;}
      }
      while(route.at<route.path.length&&Math.hypot(a.x-route.path[route.at].x,a.z-route.path[route.at].z)<.17)route.at++;
      const goal=route.path[route.at];
      if(goal&&this.advance(a,goal,dt,target?3.7:1.6))return;
      a.vx=a.vz=0;a.state='waiting';
    }
    tick(dt){
      const s=this.s;
      let plans=0;
      for(const a of s.agents){
        const f=a.outdoorFlight;if(!f||!L.isOutdoorAgent(a)||!['healthy','escaped'].includes(a.health))continue;
        if(a.downUntil>s.time||a.fearFlinchUntil>s.time){a.zombieAnim=a.downUntil>s.time?'down':a.zombieAnim;a.vx=a.vz=0;continue;}
        if(f.threat&&!f.returning)a.zombieAnim='flee';
        if(f.origin&&!f.returning&&s.time>=f.dangerUntil){f.path=[];f.retryAt=s.time;}
        if(!f.path.length&&s.time>=f.retryAt&&plans<5){plans++;this.route(a);f.retryAt=s.time+.8+(a.id%6)*.08;}
        while(f.at<f.path.length&&Math.hypot(a.x-f.path[f.at].x,a.z-f.path[f.at].z)<.15)f.at++;
        const p=f.path[f.at];
        if(!p){
          a.vx=a.vz=0;a.state='waiting';
          if(f.path.length&&f.returning){
            a.outdoorFlight=null;a.zombieControlled=false;a.alerted=false;a.fear=null;a.zombieAnim='';a.action='继续通勤';
          }else if(f.path.length){
            f.done=!f.threat||s.time>=f.dangerUntil;f.path=[];
            if(f.done){a.zombieAnim='';a.action='在街区步行避险';}
          }
          continue;
        }
        if(this.advance(a,p,dt,(f.done||f.returning?1.35:2.65)+a.id%5*.10))f.stalled=0;
        else{f.stalled=(f.stalled||0)+dt;if(f.stalled>1.4){f.path=[];f.stalled=0;}}
      }
    }
  }
  L.OfficeCrowdSpace=OfficeCrowdSpace;
  L.OfficeExterior=OfficeExterior;
})();
