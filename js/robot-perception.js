/* Bounded visual/hearing search. Memory stores sensed locations, not hidden people. */
(() => {
 'use strict';const L=window.IndoorLab,distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 const alive=a=>!a.isPlayer&&!['dead','zombie','turning'].includes(a.health);
 const onLevel=(r,a)=>r.location==='outside'?L.isOutdoorAgent(a):a.location==='floor'&&Math.round(a.floor)===Math.round(r.floor);
 class RobotPerception {
  constructor(army){this.army=army;this.noises=[];}
  noise(point,range=22){this.noises.push({...point,range,at:this.army.time});if(this.noises.length>100)this.noises.shift();}
  sense(r,humans){
   const army=this.army,now=army.time,range=r.visionRange||18,half=(r.visionAngle||Math.PI*.75)/2;
   const candidates=humans.filter(a=>alive(a)&&onLevel(r,a));let seen=null,heard=null,heardDistance=Infinity;
   for(const a of candidates){const d=distance(r,a),angle=Math.atan2(a.x-r.x,a.z-r.z),relative=Math.abs(Math.atan2(Math.sin(angle-r.angle),Math.cos(angle-r.angle)));
    if(d<=range&&(d<1.8||relative<=half)&&army.sees(r,a)&&(!seen||d<distance(r,seen)))seen=a;
    const loud=(a.warningUntil||0)>army.b.society.time||a.fear||a.alerted,walking=Math.hypot(a.vx||0,a.vz||0)>.2;
    if(!loud&&!walking)continue;const hearing=loud?18:10,attenuation=army.sees(r,a)?1:.45;
    if(d<hearing*attenuation&&d<heardDistance){heard={x:a.x,z:a.z,floor:r.floor,location:r.location,at:now,kind:loud?'voice':'footsteps'};heardDistance=d;}
   }
   if(seen){r.target=seen;r.memory={x:seen.x,z:seen.z,floor:r.floor,location:r.location,at:now,kind:'sight'};r.searchGoal=null;r.state='target-visible';return;}
   r.target=null;
   if(!heard)for(const noise of this.noises){if(now-noise.at>2||Math.round(noise.floor)!==Math.round(r.floor)||distance(r,noise)>noise.range)continue;heard={...noise,kind:'sound'};}
   if(heard){r.memory=heard;r.state='investigate-sound';r.searchGoal=null;}
   if(r.memory&&(now-r.memory.at>9||r.memory.floor!==r.floor)){r.memory=null;r.searchGoal=null;}
  }
  patrol(r,dt){
   const army=this.army,s=army.b.society,now=army.time;
   if(r.memory){const d=distance(r,r.memory);if(d>.55){r.state=r.memory.kind==='sight'?'search-last-seen':'investigate-sound';army.move(r,r.memory,dt);return;}
    r.state='searching';r.speed=0;r.angle+=dt*.95;if(now-r.memory.at<3)return;r.memory=null;r.searchGoal=null;
   }
   if(!r.searchGoal||distance(r,r.searchGoal)<.5||now>(r.patrolUntil||0)){
    const g=r.location==='outside'?s.exterior.navigation():L.robotContacts.navigation(s.grid(r.floor)),nav=g.nav(r.radius),at=g.nearest(r,r.radius),component=at>=0?nav.component[at]:nav.largest;
    if(r.patrolGrid!==g||r.patrolComponent!==component){r.patrolGrid=g;r.patrolComponent=component;r.patrolCells=[];for(let i=0;i<g.size;i++)if(nav.valid[i]&&nav.component[i]===component)r.patrolCells.push(i);}
    const cells=r.patrolCells;let goal=null;
    for(let n=0;n<12&&cells.length;n++){const i=cells[Math.floor((L.disasterDirector?.random()??Math.random())*cells.length)],p=g.point(i),d=distance(r,p);if(d>2&&d<13){goal=p;break;}}
    r.searchGoal=goal;r.patrolUntil=now+6+(r.id%5);r.path=[];r.pathAt=0;r.repath=0;
   }
   r.state='patrolling';if(r.searchGoal)army.move(r,r.searchGoal,dt);else{r.speed=0;r.angle+=dt*.6;}
  }
 }
 L.RobotPerception=RobotPerception;
})();
