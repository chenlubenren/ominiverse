/* Robot tracks and obstruction-clipped sight volumes share the crowd controls. */
(() => {
 'use strict';const L=window.IndoorLab,T=THREE,V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
 class RobotObservation {
  constructor(army){this.army=army;this.group=new T.Group();this.group.name='机器人 · 行动轨迹与视野';this.group.userData.noAO=true;army.group.add(this.group);
   this.clipper=Object.create(L.CrowdObservation.prototype);this.clipper.boxCache=new WeakMap();
   const make=(name,capacity,material,lines=false)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(capacity*3),3).setUsage(T.DynamicDrawUsage));g.setDrawRange(0,0);const mesh=lines?new T.LineSegments(g,material):new T.Mesh(g,material);mesh.name=name;mesh.frustumCulled=false;this.group.add(mesh);return mesh;};
   this.trails=make('机器人轨迹',24000,new T.LineBasicMaterial({color:'#d57820',transparent:true,opacity:.95,depthWrite:false,toneMapped:false}),true);
   this.cones=make('机器人视野',120*32*3,new T.MeshBasicMaterial({color:'#e8a138',transparent:true,opacity:.10,depthWrite:false,side:T.DoubleSide,toneMapped:false}));
   this.outline=make('机器人视野边界',120*80,new T.LineBasicMaterial({color:'#bd791b',transparent:true,opacity:.55,depthWrite:false,toneMapped:false}),true);
  }
  record(r){const path=r.trail??=[],last=path[path.length-1];if(!last||last.floor!==r.floor||last.location!==r.location||Math.hypot(last.x-r.x,last.z-r.z,last.y-r.worldBase)>.14){path.push({x:r.x,y:r.worldBase,z:r.z,floor:r.floor,location:r.location});if(path.length>240)path.shift();}}
  update(){const a=this.army,mode=L.firstPersonMode,vr=!!mode?.active,tracks=vr?mode.vrTrails:!!document.getElementById('trails-visible')?.checked,vision=vr?mode.vrVision:!!document.getElementById('vision-visible')?.checked;
   this.trails.visible=tracks;this.cones.visible=this.outline.visible=vision;const key=[Math.floor(a.time*(vr?12:5)),a.b.phase,a.floor(),a.b.continuous.active,a.b.mix.toFixed(3),a.b.drawerFloor,tracks,vision,a.robots.length,a.b.society.model(a.floor()).physicsVersion||0].join(':');if(key===this.key)return;this.key=key;
   const fill=(mesh,values)=>{const attr=mesh.geometry.attributes.position;attr.array.set(values.slice(0,attr.array.length));attr.updateRange.offset=0;attr.updateRange.count=Math.min(values.length,attr.array.length);attr.needsUpdate=true;mesh.geometry.setDrawRange(0,Math.min(values.length,attr.array.length)/3);};
   const values=[],faces=[],edges=[];
   for(const r of a.robots){if(tracks){const path=r.trail||[];for(let i=1;i<path.length;i++){const p=path[i-1],q=path[i];if(p.floor!==q.floor||p.location!==q.location||!a.isVisible(p)||!a.isVisible(q)||Math.hypot(q.x-p.x,q.z-p.z)>3)continue;for(const point of [p,q]){const v=a.displayPoint({...point,y:point.y+.07});values.push(v.x,v.y,v.z);}if(values.length>=72000)break;}}
    if(!vision||!a.isVisible(r)||r.stair)continue;
    const range=r.visionRange||18,half=(r.visionAngle||Math.PI*.75)/2,height=Math.max(.35,r.turret.position.y),eye=V(r.x,height,r.z),outside=r.location==='outside',model=a.b.society.model(r.floor),boxes=outside?a.b.outdoorBoxes.filter(b=>b.h>.3):(L.securityVisibility?L.securityVisibility.boxes(model):this.clipper.boxes(model)),near=boxes.filter(b=>Math.hypot(b.x-r.x,b.z-r.z)<range+Math.hypot(b.w,b.d)/2),ends=[];
    // Closed upper/lower fans show the true horizontal field of view.
    for(const up of [-1,1])for(let i=0;i<=12;i++){const u=up<0?i/12:1-i/12,angle=r.angle-half+u*half*2,delta=V(Math.sin(angle)*range,up*Math.min(2.6,range*.18),Math.cos(angle)*range),local=outside?V(r.x,r.worldBase+height,r.z):eye;
     const hit=this.clipper.clip(local,delta,near).point;if(!outside)hit.y+=r.worldBase;ends.push(a.displayPoint({x:hit.x,y:hit.y,z:hit.z,floor:r.floor,location:r.location}));}
    const center=a.displayPoint({x:r.x,y:r.worldBase+height,z:r.z,floor:r.floor,location:r.location});
    for(let i=0;i<ends.length;i++){const p=ends[i],q=ends[(i+1)%ends.length];faces.push(center.x,center.y,center.z,p.x,p.y,p.z,q.x,q.y,q.z);edges.push(p.x,p.y,p.z,q.x,q.y,q.z);if(i%6===0)edges.push(center.x,center.y,center.z,p.x,p.y,p.z);}
   }
   fill(this.trails,values);fill(this.cones,faces);fill(this.outline,edges);
  }
 }
 L.RobotObservation=RobotObservation;
})();
