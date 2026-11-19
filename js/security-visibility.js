/* Security rays test the full height of real furniture, walls and closed doors. */
(() => {
 'use strict';const L=window.IndoorLab,T=THREE;
 class SecurityVisibility {
  constructor(){this.cache=new WeakMap();this.clipper=Object.create(L.CrowdObservation.prototype);}
  boxes(model){const key=(model.physicsVersion||0)+':'+model.doors.map(d=>d.id+':'+d.open).join(','),cached=this.cache.get(model);if(cached?.key===key)return cached.items;
   const cuts=model.destroyedBounds||[],items=[...(model.layoutItems||[]),...(model.shellItems||[]),...(model.dynamicSolids||[]),...(model.doorSolids||[])].filter(p=>!p.destroyed&&!p.navigationOnly&&p.w>0&&p.d>0&&p.h>.025&&!['floor','blue'].includes(p.key)&&!cuts.some(c=>Math.abs(c.x-p.x)<.05&&Math.abs(c.z-p.z)<.05&&Math.abs(c.y-p.y)<.1));this.cache.set(model,{key,items});return items;
  }
  ray(start,end,model){const delta=new T.Vector3(end.x-start.x,end.y-start.y,end.z-start.z),hit=this.clipper.clip(new T.Vector3(start.x,start.y,start.z),delta,this.boxes(model)),distance=delta.length();return{clear:hit.point.distanceTo(new T.Vector3(end.x,end.y,end.z))<Math.max(.035,distance*.005),hit};}
  sees(sensor,target,model){const dx=target.x-sensor.x,dz=target.z-sensor.z,dy=target.y-sensor.y,distance=Math.hypot(dx,dy,dz);if(distance>(sensor.range||12)||distance<.01)return false;
   const yaw=Math.atan2(dx,dz),angle=Math.abs(Math.atan2(Math.sin(yaw-sensor.angle),Math.cos(yaw-sensor.angle)));if(angle>(sensor.fov||Math.PI*.65)/2)return false;
   if(Math.abs(Math.atan2(dy,Math.hypot(dx,dz))-(sensor.pitch||0))>(sensor.verticalFov||Math.PI*.75)/2)return false;
   return this.ray(sensor,target,model).clear;
  }
 }
 L.SecurityVisibility=SecurityVisibility;L.securityVisibility=new SecurityVisibility();
})();
