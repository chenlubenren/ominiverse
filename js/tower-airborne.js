/* Concentration and inhaled dose for the fictional ventilation experiment. */
(() => {
  'use strict';
  const L=window.IndoorLab,roomAt=(rooms,a)=>rooms.find(r=>a.x>r.minX&&a.x<r.maxX&&a.z>r.minZ&&a.z<r.maxZ);
  class TowerAirborne {
    constructor(zombie,intensity){
      this.zombie=zombie;this.s=zombie.society;this.intensity=intensity;this.started=this.s.time;
      this.exposures=0;
      this.floors=this.s.models.map((model,i)=>{
        const rooms=model.rooms.map(r=>({...r,volume:Math.max(15,(r.maxX-r.minX)*(r.maxZ-r.minZ)*3),air:0,next:0,door:model.doors.find(d=>d.id===r.id),population:0}));
        for(const a of this.s.agents)if(!a.isPlayer&&a.floor===i+1&&a.location==='floor'){
          const room=roomAt(rooms,a);if(room)room.population++;
        }
        const weights=rooms.map(r=>1+2*r.population*r.population);
        let selection=zombie.random()*weights.reduce((sum,w)=>sum+w,0);
        const source=rooms.find((r,j)=>(selection-=weights[j])<0)||rooms[0];
        return {rooms,source:null,duct:{volume:22,air:0,next:0},hall:{volume:850,air:0,next:0}};
      });
      // A few occupied rooms seed the building; unaffected floors start clean.
      this.sources=[];const candidates=this.floors.flatMap((f,i)=>f.rooms.filter(r=>r.population).map(r=>({r,floor:i+1})));
      const count=Math.min(candidates.length,Math.max(1,Math.round(intensity*1.5)));
      for(let i=0;i<count;i++){const weights=candidates.map(q=>1+q.r.population*q.r.population),sum=weights.reduce((a,b)=>a+b,0);let at=0,roll=zombie.random()*sum;while(at<weights.length-1&&(roll-=weights[at])>0)at++;const q=candidates.splice(at,1)[0];q.r.source=true;this.floors[q.floor-1].source??=q.r;this.sources.push(q);const people=this.s.agents.filter(a=>a.location==='floor'&&Math.round(a.floor)===q.floor&&roomAt([q.r],a));q.quota=Math.max(1,Math.round(people.length*L.clamp(.15+intensity*.3,.12,.85)));for(let j=people.length-1;j>0;j--){const k=Math.floor(zombie.random()*(j+1));[people[j],people[k]]=[people[k],people[j]];}for(const [j,a]of people.entries())a.airThreshold=j<q.quota?.35+zombie.random()*.45:5+zombie.random()*5;}
    }
    tick(dt){
      const age=this.s.time-this.started,exchange=(a,b,rate)=>{
        const flow=(a.air-b.air)*rate*dt;a.next-=flow/a.volume;b.next+=flow/b.volume;
      };
      for(const [i,floor] of this.floors.entries()){
        const {rooms,duct,hall,source}=floor;
        for(const room of rooms){
          exchange(room,duct,2.5);
          exchange(room,hall,room.door?.open===false?.015:3.8);
        }
        exchange(duct,hall,1.65);
        if(i>0)exchange(duct,this.floors[i-1].duct,2.25);
        for(const room of rooms)if(room.source&&age<22)room.next+=dt*.065*this.intensity;
      }
      for(const a of this.s.agents){
        if(a.location!=='floor'||a.isPlayer&&!L.continuousTower?.active)continue;
        const floor=this.floors[Math.round(a.floor)-1];if(!floor)continue;
        const zone=roomAt(floor.rooms,a)||floor.hall;
        if(a.health==='zombie'){zone.next+=1.8*dt/zone.volume;continue;}
        if(a.health!=='healthy')continue;
        if(a.airLatent!==undefined){
          a.airLatent-=dt;
          if(a.airLatent<=0&&a.downUntil<=this.s.time)this.zombie.infect(a,null,false,true);
          continue;
        }
        if(zone.air<.003)continue;
        a.airDose=(a.airDose||0)+zone.air*dt;
        if(a.airThreshold===undefined)a.airThreshold=1.1+this.zombie.random()*2.8;
        if(a.airDose>=a.airThreshold){
          a.airLatent=8+this.zombie.random()*8;this.exposures++;
          this.s.note(a,'吸入病毒','进入潜伏期');
        }
      }
      for(const {rooms,duct,hall} of this.floors)for(const zone of [...rooms,duct,hall]){
        zone.air=Math.min(8,Math.max(0,(zone.air+zone.next)*Math.exp(-.025*dt)));zone.next=0;
      }
    }
    draw(tower){
      const view=tower.view?.scene?tower.view:tower,continuous=L.continuousTower,origin=tower.origin||view.model?.towerFloor;if(!origin||continuous?.active&&continuous.worldWalk.outside||L.building.phase!=='interior'){this.hide();return;}
      if(!this.particles){
        this.positions=new Float32Array(480*3);
        const geo=new THREE.BufferGeometry(),attribute=new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('position',attribute);geo.setDrawRange(0,0);
        const mat=new THREE.ShaderMaterial({
          transparent:true,depthWrite:false,
          vertexShader:'void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(32.0/-p.z,2.0,9.0);}',
          fragmentShader:'void main(){float r=length(gl_PointCoord-.5);gl_FragColor=vec4(.56,.96,.28,(1.0-smoothstep(.10,.5,r))*.72);}'
        });
        this.particles=new THREE.Points(geo,mat);this.particles.name='玩家可见的病毒示踪粒子';this.particles.frustumCulled=false;this.particles.userData.noAO=true;view.scene.add(this.particles);
      }
      const f=this.floors[origin-1],time=this.s.time+this.s.accumulator;
      let count=0;
      const add=(x,y,z)=>{if(count>=480)return;const i=count++*3;this.positions[i]=x;this.positions[i+1]=y;this.positions[i+2]=z;};
      for(const [index,r] of f.rooms.entries()){
        const quantity=Math.min(34,Math.floor(Math.sqrt(r.air)*27));
        for(let i=0;i<quantity;i++){
          const phase=(i*.61803399+time*(.12+(i%5)*.014)+index*.271)%1,angle=i*2.39996+time*.6;
          add(r.vent.x+Math.cos(angle)*phase*(r.maxX-r.minX)*.39,3.15-phase*2.64,r.vent.z+Math.sin(angle)*phase*(r.maxZ-r.minZ)*.39);
        }
        if(r.door?.open&&r.air>.065)for(let i=0;i<5;i++){
          const d=r.door,t=(time*.45+i*.2)%1,ax=d.axis==='x';
          add(d.x+(ax?Math.sin(i*2)*d.width*.29:(d.x-r.vent.x)*.17*t),1.15+i*.17,d.z+(ax?(d.z-r.vent.z)*.17*t:Math.sin(i*2)*d.width*.29));
        }
      }
      const ducts=Math.min(16,Math.floor(f.duct.air*22));
      for(let i=0;i<ducts;i++)add(((i*.618+time*.22)%1-.5)*17.6,3.07,3.42+Math.sin(i*2.39996)*.08);
      this.particles.geometry.setDrawRange(0,count);
      const offset=view.floorOrigin;this.particles.position.set(offset?.x||0,offset?.y||0,offset?.z||0);
      this.particles.geometry.attributes.position.needsUpdate=true;this.particles.visible=count>0;
    }
    hide(){if(this.particles)this.particles.visible=false;}
    dispose(){if(this.particles){this.particles.parent?.remove(this.particles);this.particles.geometry.dispose();this.particles.material.dispose();this.particles=null;}}
  }
  L.TowerAirborne=TowerAirborne;
})();
