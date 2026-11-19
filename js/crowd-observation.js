/* Readable world-space tracks and volumetric, obstruction-clipped sight cones. */
(() => {
  'use strict'; const L=window.IndoorLab,T=THREE,V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
  class CrowdObservation {
    constructor(view){
      this.view=view;this.group=new T.Group();this.group.userData.noAO=true;view.scene.add(this.group);
      view.scene.remove(view.trailMesh,view.visionMesh);view.trailMesh.geometry.dispose();view.trailMesh.material.dispose();view.visionMesh.geometry.dispose();view.visionMesh.material.dispose();
      const trailGeometry=new T.PlaneGeometry(1,1).rotateX(Math.PI/2);
      this.trailStyle=new T.InstancedBufferAttribute(new Float32Array(12000*4),4).setUsage(T.DynamicDrawUsage);
      trailGeometry.setAttribute('trailStyle',this.trailStyle);this.trackOffsets=new WeakMap();
      const trailMaterial=new T.ShaderMaterial({
        uniforms:{flowTime:{value:0},blue:{value:new T.Color('#298ed0').convertSRGBToLinear()},cyan:{value:new T.Color('#70d9ff').convertSRGBToLinear()}},
        vertexShader:`
          attribute vec4 trailStyle;
          varying vec2 trailUV;
          varying float pathDistance;
          varying float trailFade;
          varying float emphasis;
          void main(){
            trailUV=uv;pathDistance=trailStyle.x+uv.y*trailStyle.y;
            trailFade=trailStyle.z;emphasis=trailStyle.w;
            gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);
          }`,
        fragmentShader:`
          uniform float flowTime;uniform vec3 blue;uniform vec3 cyan;
          varying vec2 trailUV;varying float pathDistance;varying float trailFade;varying float emphasis;
          void main(){
            float across=abs(trailUV.x*2.0-1.0);
            float aa=max(fwidth(across),0.025);
            float core=1.0-smoothstep(0.14-aa,0.14+aa,across);
            float halo=exp(-across*across*5.0)*(1.0-smoothstep(0.75,1.0,across));
            // Increasing path distance follows the recorded walking direction.
            float tail=mod(flowTime*1.65-pathDistance,4.8);
            float pulse=exp(-tail*tail/0.32);
            float head=exp(-tail*tail/0.015);
            float alpha=min(0.94,(core*0.62+halo*0.18+pulse*(core*0.28+halo*0.28))*trailFade*(1.0+emphasis*0.18));
            if(alpha<0.008)discard;
            vec3 color=mix(blue,cyan,0.22+pulse*0.50+emphasis*0.12);
            color=mix(color,vec3(0.88,0.97,1.0),head*core*0.85);
            gl_FragColor=vec4(color,alpha);
            #include <encodings_fragment>
          }`,
        transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,fog:false,toneMapped:false,extensions:{derivatives:true}
      });
      this.trails=new T.InstancedMesh(trailGeometry,trailMaterial,12000);this.trails.name='流光行走轨迹';this.trails.userData.ignoreCollision=true;
      this.trails.count=0;this.trails.frustumCulled=false;this.trails.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(this.trails);this.trails.visible=false;
      this.reduceMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.cones=new T.Mesh(new T.BufferGeometry(),new T.MeshBasicMaterial({color:'#149dca',transparent:true,opacity:.11,depthWrite:false,side:T.DoubleSide,fog:false,toneMapped:false}));this.cones.frustumCulled=false;this.group.add(this.cones);this.cones.visible=false;
      this.outline=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:'#167fad',transparent:true,opacity:.68,depthWrite:false,fog:false,toneMapped:false}));this.outline.frustumCulled=false;this.group.add(this.outline);for(const mesh of [this.cones,this.outline]){mesh.geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(36*24*9),3).setUsage(T.DynamicDrawUsage));mesh.geometry.setDrawRange(0,0);}
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const context=canvas.getContext('2d'),gradient=context.createRadialGradient(64,64,6,64,64,62);gradient.addColorStop(0,'rgba(21,35,51,.6)');gradient.addColorStop(.5,'rgba(21,35,51,.2)');gradient.addColorStop(1,'rgba(21,35,51,0)');context.fillStyle=gradient;context.fillRect(0,0,128,128);this.shadows=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas),transparent:true,opacity:.5,depthWrite:false,toneMapped:false}),640);this.shadows.frustumCulled=false;this.shadows.count=0;this.group.add(this.shadows);
      view.trailMesh=this.trails;view.trailGeo=this.trails.geometry;view.visionMesh=this.cones;this.pose=new T.Object3D();this.results=new Map();this.boxCache=new WeakMap();
    }
    boxes(model){let cached=this.boxCache.get(model);if(cached?.version===(model.physicsVersion||0))return cached.items;const items=[...(model.layoutItems||[]),...(model.shellItems||[]),...(model.dynamicSolids||[])].filter(b=>!b.ignore&&!b.destroyed&&b.h>.3);items.push({x:0,y:-.11,z:0,w:36,h:.22,d:26,rotation:0,name:'地板'},{x:0,y:3.31,z:0,w:36,h:.14,d:26,rotation:0,name:'天花板'});this.boxCache.set(model,{version:model.physicsVersion||0,items});return items;}
    clip(origin,delta,boxes){let distance=1,object=null;for(const b of boxes){const co=Math.cos(b.rotation||0),si=Math.sin(b.rotation||0),dx=origin.x-b.x,dz=origin.z-b.z,o=[co*dx-si*dz,origin.y-b.y,si*dx+co*dz],d=[co*delta.x-si*delta.z,delta.y,si*delta.x+co*delta.z],half=[b.w/2,b.h/2,b.d/2];let lo=0,hi=1;for(let k=0;k<3;k++){if(Math.abs(d[k])<1e-7){if(Math.abs(o[k])>half[k]){lo=2;break;}}else{const a=(-half[k]-o[k])/d[k],c=(half[k]-o[k])/d[k];lo=Math.max(lo,Math.min(a,c));hi=Math.min(hi,Math.max(a,c));}}if(lo<=hi&&lo>.025&&lo<distance){distance=lo;object=b;}}return{point:origin.clone().addScaledVector(delta,distance),object};}
    update(agents,time){
      const v=this.view,tracks=document.getElementById('trails-visible')?.checked,vision=document.getElementById('vision-visible')?.checked,fp=L.continuousTower?.active,floor=fp?L.continuousTower.origin:v.model?.towerFloor;
      let shadowCount=0;for(const a of agents){if(a.isPlayer||a.id===v.selected&&v.view==='human'||a.location==='lift'||Math.abs(a.baseY||0)>.15)continue;this.pose.position.set(a.x,.018,a.z);this.pose.rotation.set(-Math.PI/2,0,0);this.pose.scale.set(.65,.48,1);this.pose.updateMatrix();this.shadows.setMatrixAt(shadowCount++,this.pose.matrix);}this.shadows.count=shadowCount;this.shadows.instanceMatrix.needsUpdate=true;
      this.trails.visible=!!tracks;this.trails.material.uniforms.flowTime.value=this.reduceMotion?0:time;this.cones.visible=this.outline.visible=!!vision;
      const infoStatus=document.getElementById('vision-status');if(infoStatus)infoStatus.hidden=!vision;if(!tracks&&!vision)return;const key=floor+':'+Math.floor(time*5)+':'+tracks+':'+vision+':'+v.selected+':'+agents.length+':'+(v.model?.physicsVersion||0);if(key===this.lastKey)return;this.lastKey=key;
      if(tracks){
        let n=0;for(const a of agents){
          const path=a.trail||[],selected=a.id===v.selected,phase=(a.id*1.37)%4.8;
          for(let i=1;i<path.length&&n<12000;i++){
            const p=path[i-1],q=path[i];if(p.floor!==floor||q.floor!==floor)continue;
            const dx=q.x-p.x,dz=q.z-p.z,length=Math.hypot(dx,dz);if(length<.008||length>3)continue;
            // Keep distance origins stable when the oldest samples leave the bounded history.
            const offset=this.trackOffsets.get(p)??0;this.trackOffsets.set(p,offset);this.trackOffsets.set(q,offset+length);
            this.pose.position.set((p.x+q.x)/2,.075,(p.z+q.z)/2);this.pose.rotation.set(0,Math.atan2(dx,dz),0);this.pose.scale.set(selected?.38:.30,1,length);this.pose.updateMatrix();
            this.trails.setMatrixAt(n,this.pose.matrix);this.trailStyle.setXYZW(n++,offset+phase,length,.18+.82*Math.pow(i/(path.length-1),.7),selected?1:0);
          }
        }
        this.trails.count=n;this.trails.instanceMatrix.needsUpdate=true;this.trailStyle.updateRange.offset=0;this.trailStyle.updateRange.count=n*4;this.trailStyle.needsUpdate=true;
      }
      if(!vision)return;this.cones.material.opacity=.11;const positions=[],edges=[],model=fp?L.continuousTower.models[floor-1]:v.model,all=this.boxes(model);this.results.clear();
      const selected=agents.find(a=>a.id===v.selected),observers=agents.filter(a=>!a.isPlayer&&!['dead','escaped'].includes(a.health));
      for(const a of observers){const height=(a.pose==='sit'?1.13:1.54)*(a.appearance?.height||1),baseY=a.baseY||0,observerFloor=fp?Math.max(1,Math.min(30,Math.round(a.floor)||floor)):floor,offset=fp?(observerFloor-floor)*3.6:0,eye=V(a.x,height+baseY,a.z),localEye=eye.clone().add(V(0,-offset,0)),observerBoxes=fp?this.boxes(L.continuousTower.models[observerFloor-1]):all,angle=a.angle||0,range=4.5,forward=V(Math.sin(angle),0,Math.cos(angle)),right=V(Math.cos(angle),0,-Math.sin(angle)),boxes=observerBoxes.filter(b=>Math.hypot(a.x-b.x,a.z-b.z)<range+Math.hypot(b.w,b.d)*.5),ends=[],seen=new Set();
        for(let i=0;i<24;i++){const p=i/24*Math.PI*2,delta=forward.clone().multiplyScalar(range).addScaledVector(right,Math.cos(p)*range*.66);delta.y=Math.sin(p)*range*.30;const hit=this.clip(localEye,delta,boxes);hit.point.y+=offset;ends.push(hit.point);if(hit.object)seen.add(hit.object.name);}
        for(let i=0;i<ends.length;i++){const p=ends[i],q=ends[(i+1)%ends.length];positions.push(...eye.toArray(),...p.toArray(),...q.toArray());edges.push(...p.toArray(),...q.toArray());if(i%6===0)edges.push(...eye.toArray(),...p.toArray());}
        this.results.set(a.id,{objects:[...seen].filter(Boolean),people:agents.filter(b=>b!==a&&Math.hypot(a.x-b.x,a.z-b.z)<range&&forward.dot(V(b.x-a.x,0,b.z-a.z).normalize())>.7&&L.building.reactions.canSee(a,b)).map(b=>b.id)});
      }
      for(const [mesh,values]of [[this.cones,positions],[this.outline,edges]]){let attribute=mesh.geometry.attributes.position;if(attribute.array.length<values.length){const old=mesh.geometry;mesh.geometry=new T.BufferGeometry();attribute=new T.BufferAttribute(new Float32Array(3*2**Math.ceil(Math.log2(values.length/3))),3).setUsage(T.DynamicDrawUsage);mesh.geometry.setAttribute('position',attribute);old.dispose();}attribute.array.set(values);attribute.updateRange.offset=0;attribute.updateRange.count=values.length;attribute.needsUpdate=true;mesh.geometry.setDrawRange(0,values.length/3);}
      const info=document.getElementById('vision-status');if(info){info.hidden=!vision;const result=selected&&this.results.get(selected.id);info.textContent=result?'全体 '+this.results.size+' 人 · '+selected.name+'：看见 '+result.people.length+' 人；'+result.objects.slice(0,4).join('、'):'当前显示 '+this.results.size+' 人的视线；视锥在墙体和家具处截断，点选人物查看观测对象。';}
    }
  }
  L.CrowdObservation=CrowdObservation;
})();
