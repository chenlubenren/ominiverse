/* Fire anchors follow real storeys or live debris; no particles in vacant floors. */
(() => {
 'use strict';const L=window.IndoorLab;
 class BuildingFireAttachment {
  constructor(d){this.d=d;this.detached=[];this.thermal=new Map();}
  async ensurePhysics(){const d=this.d;d.physics??=new L.DisasterPhysics(d);await d.physics.prepare();return d.physics;}
  extinguish(a={}){
   const d=this.d,s=d.b.society,e=s.emergency,all=a.all!==false,targets=all?[...d.fires.keys()]:[a.floor];
   for(const f of targets){const h=d.fires.get(f);if(!h)continue;h.flame?.fill(0);h.smoke?.fill(0);h.ceilingSmoke?.fill(0);h.temperature?.fill(20);for(const source of h.sources||[])source.active=false;if(h!==e.hazard)h.dispose?.();d.fires.delete(f);d.fireState?.delete(f);this.thermal.delete(f);}
   this.detached=this.detached.filter(p=>!all&&p.floor!==a.floor);
   if(e.type==='fire'){const first=d.fires.entries().next().value;if(first){e.floor=first[0];e.hazard=first[1];}else{const evac=s.agents.filter(a=>a.emergencyType==='fire'&&!a.fear&&a.health==='healthy');e.clear();for(const a of evac){a.zombieControlled=false;a.alerted=false;a.zPath=[];a.path=[];a.onArrival=null;a.state='waiting';a.until=s.time+2+(a.id%5);a.action='火势已扑灭，等待恢复通行';}d.v.setDisaster(null);}}
   d.revision=(d.revision||0)+1;if(d.firePoints)this.update(0,false);return all?'已扑灭全部火焰和烟气，停止火势蔓延。':a.floor+'层火灾已扑灭。';
  }
  clear(){this.detached=[];this.thermal.clear();}
  update(dt,run){
   const d=this.d,b=d.b,s=b.society,e=s.emergency,physics=d.physics;
   for(const[f,h]of [...d.fires])if(physics?.destroyedFloors.has(f)){
    const items=physics.items.filter(p=>p.floor===f&&[2,3].includes(p.material)).slice(0,8);for(const item of items)this.detached.push({item,floor:f,until:d.time+18});
    h.flame?.fill(0);h.smoke?.fill(0);for(const source of h.sources||[])source.active=false;d.fires.delete(f);d.fireState?.delete(f);this.thermal.delete(f);d.revision=(d.revision||0)+1;
   }
   if(e.type==='fire'&&!d.fires.has(e.floor)){const first=d.fires.entries().next().value;if(first){e.floor=first[0];e.hazard=first[1];}else{e.clear();d.v.setDisaster(null);}}
   for(const[f,h]of d.fires){if(run&&h!==e.hazard)h.tick(dt);const state=d.fireState?.get(f);if(!state)continue;const age=d.time-state.start;
    if(run&&!state.spread&&age>9/Math.max(.5,state.intensity)){state.spread=true;if(f<30&&!d.fires.has(f+1)&&!physics?.destroyedFloors.has(f+1)){d.fires.set(f+1,L.createOfficeFire(s,f+1,Math.max(.4,state.intensity*.8)));d.fireState.set(f+1,{start:d.time,intensity:Math.max(.4,state.intensity*.8)});d.revision=(d.revision||0)+1;}}
    const stage=this.thermal.get(f)||0,wanted=age>20/state.intensity?3:age>13/state.intensity?2:age>6/state.intensity?1:0;
    if(run&&wanted>stage&&!physics?.quakeState){this.thermal.set(f,wanted);const token=d.generation,context=d.context();this.ensurePhysics().then(p=>{if(d.requestValid(token,context)&&this.d.fires.has(f)&&p&&!p.disposed)p.thermalDamage(f,{furniture:wanted>=3});else if(token===d.generation)this.thermal.set(f,stage);}).catch(error=>{this.thermal.set(f,stage);console.warn('火灾结构效果未完成',error.message);});}
   }
   if(!d.firePoints)return;
   const frameKey=b.phase+':'+b.selected+':'+b.continuous.origin+':'+d.revision;
   d.fireMaterial.uniforms.time.value=d.time;
   if(this.frameKey===frameKey&&d.time<(this.nextAnchors||0)&&!this.detached.length)return;
   this.frameKey=frameKey;this.nextAnchors=d.time+.1;
   let n=0;const array=d.firePoints.geometry.attributes.position.array;
   const capacity=array.length/3,add=(x,y,z)=>{if(n>=capacity)return;const j=n++*3;array[j]=x;array[j+1]=y;array[j+2]=z;};
   const interior=b.phase==='interior',origin=b.continuous.active?b.continuous.origin:d.v.model?.towerFloor;
   for(const[f,h]of d.fires){if(physics?.destroyedFloors.has(f))continue;const plate=b.plates[f-1],transform=interior?{x:0,y:(f-1)*3.6,z:0}:plate.group.position;
    if(interior){
     if(Math.abs(f-origin)>(b.continuous.active?1:0))continue;
     // Every burning patch contributes; do not keep only the six strongest clusters.
     const cells=[];for(let i=0;i<h.size;i++)if(h.flame[i]>.08)cells.push(i);const stride=Math.max(1,Math.ceil(cells.length/900));
     for(let k=0;k<cells.length;k+=stride){const p=h.grid.point(cells[k]);for(let layer=0;layer<5;layer++)add(p.x+(layer%3-1)*.12,transform.y+.08,p.z+(layer%2-.5)*.16);}
    }
    // Indoor flames come from actual burning cells, rather than facade ribbons.
    if(!interior){
     const expansion=Math.min(1.1,.2+(d.time-(d.fireState.get(f)?.start||0))*.025);
     for(let side=0;side<4;side++)for(let i=0;i<72;i++)for(let layer=0;layer<2;layer++){
      const u=i/71,normal=side%2?-1:1;add(transform.x+(side<2?-17.9+u*35.8:normal*(18.3+expansion*layer*.6)),transform.y+.25+layer*1.25,transform.z+(side<2?normal*(13.35+expansion*layer*.6):-12.8+u*25.6));
     }
    }
   }
   this.detached=this.detached.filter(p=>p.until>d.time&&physics?.items.includes(p.item));
   for(const fire of this.detached){const p=fire.item.body.translation();for(let i=0;i<5;i++)add(p.x+(i-2)*.14,p.y+.2,p.z+(i%2-.5)*.2);}
   d.firePoints.geometry.setDrawRange(0,n);d.firePoints.geometry.attributes.position.needsUpdate=true;d.fireMaterial.uniforms.time.value=d.time;d.fireMaterial.uniforms.scale.value=interior?.65:1.25;
  }
 }
 L.BuildingFireAttachment=BuildingFireAttachment;
})();
