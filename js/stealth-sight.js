/* Infiltration sight fans: what each camera / security robot on the player's floor can actually detect.
   Uses the sensor values that FirstPersonMode.sense() passes to securityVisibility.sees(): range, horizontal fov,
   pitch/vertical fov, eye height, the two player body samples and the same blocker boxes. Each ray is sampled
   radially at the player's current sample heights, so standing vs crouching and low cover change the fan. */
(() => {
  'use strict';const L=window.IndoorLab,T=THREE,RAYS=28,SAMPLES=10,MAX_SENSORS=10,MAX_SPANS=3,FLOOR_Y=.03,KEY='agentSociety.stealthSight';
  const COLORS={calm:new T.Color('#3aa7dc'),suspicious:new T.Color('#f2a33a'),alarmed:new T.Color('#e8453c')};
  class StealthSight {
    constructor(mode,parent){
      this.mode=mode;this.enabled=true;try{this.enabled=localStorage.getItem(KEY)!=='off';}catch{}
      this.next=0;this.near=[];this.nearCo=new Float32Array(4096);this.nearSi=new Float32Array(4096);this.sensors=[];this.spans=Array.from({length:RAYS},()=>({count:0,s:new Float32Array(MAX_SPANS),e:new Float32Array(MAX_SPANS)}));
      this.used=new Uint8Array(MAX_SPANS);this.stats={sensors:0,rays:0,triangles:0,updates:0};
      const fillVerts=MAX_SENSORS*(RAYS-1)*MAX_SPANS*2*6,lineVerts=MAX_SENSORS*((RAYS-1)*MAX_SPANS*2+MAX_SPANS*4+6)+MAX_SENSORS*2;
      const make=(verts,lines)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(verts*3),3).setUsage(T.DynamicDrawUsage));g.setAttribute('color',new T.BufferAttribute(new Float32Array(verts*4),4).setUsage(T.DynamicDrawUsage));g.setDrawRange(0,0);return g;};
      this.group=new T.Group();this.group.name='潜入 · 安防视线';this.group.userData.noAO=true;this.group.visible=false;
      this.fill=new T.Mesh(make(fillVerts),new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));
      this.lines=new T.LineSegments(make(lineVerts),new T.LineBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,toneMapped:false}));
      for(const m of [this.fill,this.lines]){m.frustumCulled=false;m.renderOrder=6;m.userData.noAO=true;this.group.add(m);}
      this.fill.name='安防视线 · 地面扇区';this.lines.name='安防视线 · 边界与注视线';
      parent.add(this.group);
    }
    setEnabled(on){this.enabled=!!on;this.next=0;try{localStorage.setItem(KEY,on?'on':'off');}catch{}}
    // Same rejection rule as CrowdObservation.clip + SecurityVisibility.ray: hits within the first 2.5% are ignored,
    // and a hit closer than max(3.5 cm, 0.5% length) to the target still counts as clear.
    clear(ox,oy,oz,tx,ty,tz){
      const dx=tx-ox,dy=ty-oy,dz=tz-oz,len=Math.hypot(dx,dy,dz),tol=Math.max(.035,len*.005)/Math.max(len,1e-6),boxes=this.near,cos=this.nearCo,sin=this.nearSi;
      for(let n=0;n<boxes.length;n++){
        const b=boxes[n],co=cos[n],si=sin[n],rx=ox-b.x,rz=oz-b.z,o0=co*rx-si*rz,o1=oy-b.y,o2=si*rx+co*rz,d0=co*dx-si*dz,d2=si*dx+co*dz,h0=b.w/2,h1=b.h/2,h2=b.d/2;
        let lo=0,hi=1,a,c;
        if(Math.abs(d0)<1e-7){if(Math.abs(o0)>h0)continue;}else{a=(-h0-o0)/d0;c=(h0-o0)/d0;if(a>c){const s=a;a=c;c=s;}if(a>lo)lo=a;if(c<hi)hi=c;}
        if(Math.abs(dy)<1e-7){if(Math.abs(o1)>h1)continue;}else{a=(-h1-o1)/dy;c=(h1-o1)/dy;if(a>c){const s=a;a=c;c=s;}if(a>lo)lo=a;if(c<hi)hi=c;}
        if(Math.abs(d2)<1e-7){if(Math.abs(o2)>h2)continue;}else{a=(-h2-o2)/d2;c=(h2-o2)/d2;if(a>c){const s=a;a=c;c=s;}if(a>lo)lo=a;if(c<hi)hi=c;}
        if(lo<=hi&&lo>.025&&1-lo>tol)return false;
      }
      return true;
    }
    // Horizontal distances at which a target at height h passes the range and vertical-fov tests.
    band(s,h,out){
      const dy=h-s.y,range=s.range,low=s.pitch-s.vfov/2,high=s.pitch+s.vfov/2;let min=0,max=range*range-dy*dy;
      if(max<=0){out[0]=1;out[1]=0;return out;}max=Math.sqrt(max);
      if(dy<0){if(low>-Math.PI/2)min=Math.max(min,low<0?dy/Math.tan(low):Infinity);if(high<0)max=Math.min(max,dy/Math.tan(high));}
      else if(dy>0){if(high<Math.PI/2)min=Math.max(min,high>0?dy/Math.tan(high):Infinity);if(low>0)max=Math.min(max,dy/Math.tan(low));}
      else if(low>0||high<0)max=0;
      out[0]=Math.max(min,.05);out[1]=max;return out;
    }
    visible(s,a,d,bands){const x=s.x+Math.sin(a)*d,z=s.z+Math.cos(a)*d;for(let k=0;k<2;k++){const b=bands[k];if(d>=b[0]&&d<=b[1]&&this.clear(s.x,s.y,s.z,x,b[2],z))return true;}return false;}
    collect(){
      const m=this.mode,t=m.t,floor=t.origin,p=m.v.camera.position,list=this.sensors,reach=6;list.length=0;
      const push=(owner,x,y,z,angle,range,fov,pitch,vfov)=>{if(list.length>=MAX_SENSORS)return;const d=Math.hypot(x-p.x,z-p.z);if(d>range+reach)return;list.push({owner,x,y,z,angle,range,fov,pitch,vfov,d});};
      for(const c of m.cameras)if(c.floor===floor)push(c,c.x,c.y,c.z,c.angle,c.range||12,c.fov||Math.PI*.65,c.pitch||0,c.verticalFov||Math.PI*.75);
      for(const r of L.robotDutyFleet?.robots||[])if(r.alive!==false&&r.security&&r.floor===floor)push(r,r.x,Math.max(.45,r.turret.position.y),r.z,r.angle,r.visionRange||12,r.visionAngle||Math.PI*.65,0,Math.PI*.75);
      list.sort((a,b)=>a.d-b.d);return list;
    }
    // Calm: not seeing the player. Suspicious: this sensor currently passes the detection test (identity check running). Alarmed: alarm raised on this floor.
    state(s){const m=this.mode;return m.alarm?'alarmed':m.seenSensors?.has(s.owner)?'suspicious':'calm';}
    update(now=performance.now()){
      const m=this.mode,t=m.t,on=this.enabled&&m.active&&m.mode==='mission'&&m.state==='active'&&t.active&&m.b.phase==='interior'&&(!L.collaboration?.environment||L.collaboration.environment==='office');
      this.group.visible=on;if(!on||now<this.next)return;this.next=now+70;
      const model=t.models[t.origin-1];if(!model||!L.securityVisibility)return;
      const all=L.securityVisibility.boxes(model),sensors=this.collect(),fp=t.fp,h=fp.eyeHeight||1.65,feet=fp.feet||0,bands=[[0,0,feet+h*.94],[0,0,feet+h*.56]];
      const pos=this.fill.geometry.attributes.position.array,col=this.fill.geometry.attributes.color.array,lpos=this.lines.geometry.attributes.position.array,lcol=this.lines.geometry.attributes.color.array;
      let fv=0,lv=0,rays=0;
      const vert=(x,z,c,alpha)=>{pos[fv*3]=x;pos[fv*3+1]=FLOOR_Y;pos[fv*3+2]=z;col[fv*4]=c.r;col[fv*4+1]=c.g;col[fv*4+2]=c.b;col[fv*4+3]=alpha;fv++;};
      const line=(x1,y1,z1,x2,y2,z2,c,alpha)=>{if((lv+2)*3>lpos.length)return;lpos[lv*3]=x1;lpos[lv*3+1]=y1;lpos[lv*3+2]=z1;lcol[lv*4]=c.r;lcol[lv*4+1]=c.g;lcol[lv*4+2]=c.b;lcol[lv*4+3]=alpha;lv++;lpos[lv*3]=x2;lpos[lv*3+1]=y2;lpos[lv*3+2]=z2;lcol[lv*4]=c.r;lcol[lv*4+1]=c.g;lcol[lv*4+2]=c.b;lcol[lv*4+3]=alpha;lv++;};
      for(const s of sensors){
        const near=this.near;near.length=0;
        for(const b of all){if(near.length>=this.nearCo.length||Math.hypot(b.x-s.x,b.z-s.z)>s.range+Math.hypot(b.w,b.d)/2)continue;this.nearCo[near.length]=Math.cos(b.rotation||0);this.nearSi[near.length]=Math.sin(b.rotation||0);near.push(b);}
        for(let k=0;k<2;k++)this.band(s,bands[k][2],bands[k]);
        const lo=Math.min(bands[0][0],bands[1][0]),hi=Math.max(bands[0][1],bands[1][1]);if(!(hi>lo))continue;
        const state=this.state(s),c=COLORS[state],nearAlpha=state==='calm'?.24:.36,farAlpha=state==='calm'?.06:.12,alpha=d=>nearAlpha+(farAlpha-nearAlpha)*Math.min(1,d/s.range);
        // Visible intervals per ray, bisected at every visibility change.
        for(let i=0;i<RAYS;i++){
          const a=s.angle-s.fov/2+s.fov*i/(RAYS-1),sp=this.spans[i];sp.count=0;let prevD=lo,prev=this.visible(s,a,lo,bands),start=prev?lo:0;
          for(let j=1;j<SAMPLES;j++){
            const d=lo+(hi-lo)*j/(SAMPLES-1),v=this.visible(s,a,d,bands);
            if(v!==prev){let x0=prevD,x1=d;for(let q=0;q<4;q++){const mid=(x0+x1)/2;if(this.visible(s,a,mid,bands)===prev)x0=mid;else x1=mid;}const edge=(x0+x1)/2;if(prev){if(sp.count<MAX_SPANS){sp.s[sp.count]=start;sp.e[sp.count++]=edge;}}else start=edge;prev=v;}
            prevD=d;
          }
          if(prev&&sp.count<MAX_SPANS){sp.s[sp.count]=start;sp.e[sp.count++]=hi;}
          rays++;
        }
        const dir=(i,mid=0)=>s.angle-s.fov/2+s.fov*(i+mid)/(RAYS-1),X=(a,d)=>s.x+Math.sin(a)*d,Z=(a,d)=>s.z+Math.cos(a)*d;
        const quad=(a1,s1,e1,a2,s2,e2)=>{if((fv+6)*3>pos.length)return;vert(X(a1,s1),Z(a1,s1),c,alpha(s1));vert(X(a1,e1),Z(a1,e1),c,alpha(e1));vert(X(a2,e2),Z(a2,e2),c,alpha(e2));vert(X(a1,s1),Z(a1,s1),c,alpha(s1));vert(X(a2,e2),Z(a2,e2),c,alpha(e2));vert(X(a2,s2),Z(a2,s2),c,alpha(s2));};
        for(let i=0;i<RAYS-1;i++){
          const A=this.spans[i],B=this.spans[i+1],a1=dir(i),a2=dir(i+1),am=dir(i,.5);this.used.fill(0);
          for(let u=0;u<A.count;u++){
            let best=-1,score=-.35;for(let w=0;w<B.count;w++){const o=Math.min(A.e[u],B.e[w])-Math.max(A.s[u],B.s[w]);if(o>score){score=o;best=w;}}
            if(best>=0){this.used[best]=1;quad(a1,A.s[u],A.e[u],a2,B.s[best],B.e[best]);line(X(a1,A.e[u]),FLOOR_Y+.01,Z(a1,A.e[u]),X(a2,B.e[best]),FLOOR_Y+.01,Z(a2,B.e[best]),c,.8);}
            else{quad(a1,A.s[u],A.e[u],am,A.s[u],A.e[u]);line(X(a1,A.e[u]),FLOOR_Y+.01,Z(a1,A.e[u]),X(am,A.e[u]),FLOOR_Y+.01,Z(am,A.e[u]),c,.8);}
          }
          for(let w=0;w<B.count;w++)if(!this.used[w]){quad(am,B.s[w],B.e[w],a2,B.s[w],B.e[w]);line(X(am,B.e[w]),FLOOR_Y+.01,Z(am,B.e[w]),X(a2,B.e[w]),FLOOR_Y+.01,Z(a2,B.e[w]),c,.8);}
        }
        // Side edges and the sensor apex, so each fan reads as coming from its camera / robot head.
        for(const i of [0,RAYS-1]){const sp=this.spans[i],a=dir(i);for(let u=0;u<sp.count;u++)line(X(a,sp.s[u]),FLOOR_Y+.01,Z(a,sp.s[u]),X(a,sp.e[u]),FLOOR_Y+.01,Z(a,sp.e[u]),c,.7);if(sp.count)line(s.x,s.y,s.z,X(a,sp.s[0]),FLOOR_Y,Z(a,sp.s[0]),c,.38);}
        if(m.seenSensors?.has(s.owner)){const p=m.v.camera.position;line(s.x,s.y,s.z,p.x,feet+h*.7,p.z,c,.95);}
      }
      const g=this.fill.geometry,lg=this.lines.geometry;
      for(const [geom,count] of [[g,fv],[lg,lv]]){for(const key of ['position','color']){const attr=geom.attributes[key];attr.updateRange.offset=0;attr.updateRange.count=count*attr.itemSize;attr.needsUpdate=true;}geom.setDrawRange(0,count);}
      this.stats.sensors=sensors.length;this.stats.rays=rays;this.stats.triangles=fv/3;this.stats.updates++;
    }
  }
  L.StealthSight=StealthSight;
})();
