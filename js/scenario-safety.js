/* Shared game casualties and fire-aware escape routing. */
(() => {
 'use strict';const L=window.IndoorLab;
 L.killDisasterAgent=(a,cause,physics=null,fallen=false)=>{
  if(!a||a.health==='dead')return false;
  if(physics&&!physics.agentState.has(a))physics.agentState.set(a,{health:a.health,absoluteY:a.absoluteY,civilianHP:a.civilianHP});
  Object.assign(a,{health:'dead',civilianHP:0,zombieHP:0,zombieControlled:true,zombieAnim:'dead',deathTime:L.building.society.time,deathCause:cause,action:cause,state:'dead',pose:'stand',sitBlend:0,vx:0,vz:0,path:[],zPath:[],transition:null,rise:null,attack:null,fear:null,onArrival:null});
  if(fallen)a.absoluteY=-1.15;L.building.society.releaseSeat(a);return true;
 };
 L.fireForAgent=a=>L.disasterDirector?.fires.get(Math.round(a.floor));
 L.fireExitBlocked=(a,side)=>{
  if(a.health==='zombie')return false;const h=L.fireForAgent(a),stair=L.TOWER.core.stairs[side];if(!h||!stair)return false;
  const points=[stair.entry,{x:Math.sign(stair.doorX)*(Math.abs(stair.doorX)-.9),z:stair.entry.z}];
  return points.some(p=>{const i=h.grid.index(p.x,p.z);return i>=0&&(h.flame[i]>.35||h.temperature[i]>150);});
 };
 L.safeEscapeRoute=(s,a,goal)=>{const h=a.health==='zombie'?null:L.fireForAgent(a);if(!h)return L.officeRoute(s.grid(a.floor),a,goal);const result=h.route(a,goal,.24);return result.reachable?result.path:[];};
 L.fireRouteUnsafe=a=>{
  const h=L.fireForAgent(a);if(!h)return false;if(a.zKind==='stairs'&&L.fireExitBlocked(a,a.zStairSide))return true;
  const path=a.zPath||[];let prior=a;for(let n=a.zAt||0;n<Math.min(path.length,(a.zAt||0)+4);n++){const next=path[n],steps=Math.ceil(Math.hypot(next.x-prior.x,next.z-prior.z)/.3);for(let j=1;j<=steps;j++){const p={x:prior.x+(next.x-prior.x)*j/steps,z:prior.z+(next.z-prior.z)*j/steps},i=h.grid.index(p.x,p.z);if(i>=0&&h.isHazardBlocked(i))return true;}prior=next;}return false;
 };
 class ScenarioSafety {
  constructor(b){this.b=b;}
  update(dt,{running=this.b.society.running}={}){if(running&&L.disasterDirector?.fires.size)this.burnPeople(dt);}
  burnPeople(dt){const s=this.b.society;if(!L.disasterDirector?.fires.size)return;
   for(const a of s.agents){if(a.health==='dead'||a.location!=='floor')continue;const h=L.fireForAgent(a);if(!h)continue;const i=h.grid.index(a.x,a.z);if(i<0)continue;
    const flame=h.flame[i],heat=Math.max(0,(h.temperature[i]-65)/90),smoke=Math.max(0,h.smoke[i]-.6);const damage=dt*(flame*26+Math.min(4,heat)*9+Math.min(3,smoke)*3);
    if(damage>0){a.fireDamage=(a.fireDamage||0)+damage;a.civilianHP=Math.max(0,(a.civilianHP??100)-damage);if(a.civilianHP<=0)L.killDisasterAgent(a,'火灾灼烧与烟气导致死亡');}
   }
  }
 }
 L.ScenarioSafety=ScenarioSafety;
})();
