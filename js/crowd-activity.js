/* Measured occupancy, movement and visit counts, independent of collision analytics. */
(() => {
 'use strict';const L=window.IndoorLab;
 class CrowdActivity {
  constructor(society){this.s=society;this.floors=new Map();this.previous=new Map();this.version=0;this.interval=0;}
  data(f){if(!this.floors.has(f)){const g=this.s.grid(f);this.floors.set(f,{grid:g,density:new Float32Array(g.size),traffic:new Float32Array(g.size),visits:new Uint32Array(g.size),samples:0});}return this.floors.get(f);}
  tick(dt){for(const a of this.s.agents){if(a.isPlayer||a.location!=='floor'||a.floor<1||a.floor>30)continue;const f=Math.round(a.floor),d=this.data(f),i=d.grid.index(a.x,a.z);if(i<0)continue;d.density[i]+=dt;if(a.state==='moving')d.traffic[i]+=Math.hypot(a.vx||0,a.vz||0)*dt;const last=this.previous.get(a.id);if(!last||last.floor!==f||last.cell!==i)d.visits[i]++;this.previous.set(a.id,{floor:f,cell:i});d.samples++;if(a.state==='moving'&&this.s.time>=(a.nextTrailSample||0)){a.nextTrailSample=this.s.time+.25;a.trail??=[];a.trail.push({x:a.x,z:a.z,floor:f});if(a.trail.length>110)a.trail.shift();}}this.interval+=dt;if(this.interval>=.4){this.interval=0;this.version++;}}
  clear(){this.floors.clear();this.previous.clear();this.version++;}
 }
 L.CrowdActivity=CrowdActivity;
})();
