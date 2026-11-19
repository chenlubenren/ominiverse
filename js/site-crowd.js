/* Background arrivals follow the site's white promenades; independent of indoor experiment statistics. */
(() => {
  'use strict';const L=window.IndoorLab;
  class SiteArrivalCrowd {
    constructor(parent,{count=38,seed,society}={}){
      this.group=new THREE.Group();this.group.name='场地到达办公楼的人群';this.group.userData.noAO=true;this.group.userData.ignoreCollision=true;parent.add(this.group);
      this.seed=(seed??globalThis.crypto?.getRandomValues?.(new Uint32Array(1))?.[0]??Date.now())>>>0;this.society=society;this.time=0;this.entered=0;this.agents=[];if(society){this.agents=society.agents.filter(a=>a.location==='outside');this.initialOutside=this.agents.length;count=this.agents.length;}
      for(let i=0;i<(society?0:count);i++){
        const a={id:10000+i,type:'pedestrian',profile:{radius:.25,color:'#248bdb'},speed:.86+this.random()*.46,state:'moving',vx:0,vz:0,angle:0};
        for(let attempt=0;attempt<80;attempt++){this.assignRoute(a);a.progress=this.random()*(a.route.length-3);this.place(a);if(this.agents.every(b=>Math.hypot(a.x-b.x,a.z-b.z)>1.1))break;}
        this.agents.push(a);
      }
      this.renderer=new L.CrowdRenderer(this.group,new Array(Math.max(640,this.agents.length)));
      const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,3,32,32,31);g.addColorStop(0,'rgba(39,64,95,.4)');g.addColorStop(1,'rgba(39,64,95,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
      const geometry=new THREE.PlaneGeometry(.95,.7);geometry.rotateX(-Math.PI/2);
      this.shadows=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,toneMapped:false}),Math.max(640,count));this.shadows.frustumCulled=false;this.shadows.userData.noAO=true;this.group.add(this.shadows);this.pose=new THREE.Object3D();this.update(0);
    }
    random(){this.seed=(this.seed*1664525+1013904223)>>>0;return this.seed/4294967296;}
    assignRoute(a){
      const side=this.random()<.5?-1:1,lane=side*(.5+(a.id%2)*1.25),kind=Math.floor(this.random()*3),frontZ=46.4+side*.7;
      const pts=kind===0?[[side*(14+this.random()*31),frontZ]]:[[side*(58.5+lane*.35),-24+this.random()*50],[side*(58.5+lane*.35),34],[side*57,40],[side*53,45],[side*46,frontZ]];
      pts.push([lane,frontZ],[lane,27],[lane,21],[lane,16],[lane,10.6]);
      const points=pts.map(([x,z])=>({x,z})),segments=[],cumulative=[0];let length=0;
      for(let i=1;i<points.length;i++){const d=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);segments.push(d);length+=d;cumulative.push(length);}
      a.route={points,segments,cumulative,length};a.progress=0;a.state='moving';
    }
    sample(a,distance){const r=a.route,d=Math.max(0,Math.min(r.length,distance));let i=0;while(i<r.segments.length-1&&r.cumulative[i+1]<d)i++;const t=(d-r.cumulative[i])/Math.max(.001,r.segments[i]),p=r.points[i],q=r.points[i+1];return{x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t};}
    place(a){const p=this.sample(a,a.progress),next=this.sample(a,a.progress+.2);a.x=p.x;a.z=p.z;a.baseY=p.z<=21?.65:p.z>=27?.11:.65-(p.z-21)*.09;a.angle=Math.atan2(next.x-p.x,next.z-p.z);}
    update(dt){
      if(this.society){this.time=this.society.time+this.society.accumulator;const visible=this.society.agents.filter(a=>L.isOutdoorAgent(a)&&!a.isPlayer).map(source=>{const a=this.society.renderAgent(source);return{...a,baseY:this.society.exterior.ground(a.x,a.z)};});this.agents=visible;this.entered=this.initialOutside-visible.filter(a=>a.location==='outside').length;this.renderer.update(visible,this.time);let i=0;for(const a of visible){this.pose.position.set(a.x,a.baseY+.015,a.z);this.pose.rotation.set(0,a.angle,0);this.pose.scale.set(1,1,1);this.pose.updateMatrix();this.shadows.setMatrixAt(i++,this.pose.matrix);}this.shadows.count=i;this.shadows.instanceMatrix.needsUpdate=true;return;}
      this.time+=dt;
      for(const a of this.agents){
        if(a.state==='waiting-spawn'){
          if(this.time<a.respawnAt)continue;this.assignRoute(a);this.place(a);
          if(this.agents.some(b=>b!==a&&b.state==='moving'&&Math.hypot(a.x-b.x,a.z-b.z)<1.05)){a.state='waiting-spawn';a.respawnAt=this.time+.6;continue;}
        }
        const next=this.sample(a,a.progress+.25),dx=next.x-a.x,dz=next.z-a.z,length=Math.hypot(dx,dz)||1;
        let factor=1;
        for(const b of this.agents){if(a===b||b.state!=='moving')continue;const bx=b.x-a.x,bz=b.z-a.z,d=Math.hypot(bx,bz);if(d<1.35&&(bx*dx+bz*dz)/length>.12)factor=Math.min(factor,Math.max(0,(d-.72)/.63));}
        const oldX=a.x,oldZ=a.z;a.progress=Math.min(a.route.length,a.progress+a.speed*factor*dt);this.place(a);a.vx=dt?(a.x-oldX)/dt:0;a.vz=dt?(a.z-oldZ)/dt:0;
        if(a.progress>=a.route.length-.001){this.entered++;a.state='waiting-spawn';a.vx=a.vz=0;a.respawnAt=this.time+2+this.random()*7;}
      }
      const visible=this.agents.filter(a=>a.state==='moving');this.renderer.update(visible,this.time);
      let i=0;for(const a of visible){this.pose.position.set(a.x,a.baseY+.015,a.z);this.pose.rotation.set(0,a.angle,0);this.pose.scale.set(1,1,1);this.pose.updateMatrix();this.shadows.setMatrixAt(i++,this.pose.matrix);}this.shadows.count=i;this.shadows.instanceMatrix.needsUpdate=true;
    }
    summary(){return{walking:this.agents.filter(a=>a.state==='moving').length,entered:this.entered,time:this.time};}
  }
  L.SiteArrivalCrowd=SiteArrivalCrowd;
})();
