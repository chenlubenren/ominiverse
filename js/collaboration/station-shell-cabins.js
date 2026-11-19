/* Functional cabin previews shared by every cached exterior design. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE;
  const cameraKeys=['fov','near','far'];
  const controlKeys=['enabled','enableRotate','enablePan','enableZoom','minDistance','maxDistance','minPolarAngle','maxPolarAngle'];
  const transform=object=>({position:object.position.clone(),quaternion:object.quaternion.clone(),scale:object.scale.clone(),visible:object.visible});
  function restoreTransform(object,saved){object.position.copy(saved.position);object.quaternion.copy(saved.quaternion);object.scale.copy(saved.scale);object.visible=saved.visible;object.updateMatrixWorld(true);}
  class StationShellCabins {
    constructor(station){
      this.s=station;this.preview=null;
      this.card=document.createElement('aside');this.card.className='st-shell-preview-card';this.card.hidden=true;this.card.setAttribute('aria-label','舱室弹出预览');
      this.card.innerHTML='<small></small><h2></h2><p></p><button type="button" data-st-shell-close>← 收回舱室</button>';station.ui.querySelector('.st-observation-dock').insertBefore(this.card,station.ui.querySelector('#st-walk'));
      this.card.querySelector('button').onclick=()=>this.close();
      station.ui.addEventListener('click',event=>{const button=event.target.closest('[data-st-shell-slot]');if(button&&!button.disabled)this.open(button.dataset.stShellSlot);});
      this.resizeObserver=new ResizeObserver(()=>{if(this.preview&&!(station.scenarios?.blocksObservation??station.scenarios?.active)){this.finishMotion();this.frame(false);}});this.resizeObserver.observe(station.v.container);
      station.v.controls.addEventListener('start',()=>{if(this.preview)this.finishMotion();});
      window.addEventListener('keydown',event=>{
        if(!this.preview||station.o.environment!=='station'||(station.scenarios?.blocksObservation??station.scenarios?.active)||document.querySelector('dialog[open]')||['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName))return;
        if(event.code==='Escape'){event.preventDefault();this.close();}
      });
    }
    sync(){
      const s=this.s,available=!!s.shellStudy?.changed&&!s.morphing&&!s.morphBusy;
      s.ui.dataset.shellPreview=String(!!this.preview);
      for(const button of s.ui.querySelectorAll('[data-st-shell-slot]')){button.disabled=!available;button.setAttribute('aria-pressed',String(this.preview?.slot.id===button.dataset.stShellSlot));}
      this.card.hidden=!this.preview;
    }
    open(slotId){
      const s=this.s,study=s.shellStudy;
      if(!study?.changed||s.morphing||s.morphBusy||s.phase!=='overview'||s.o.switching||(s.scenarios?.blocksObservation??s.scenarios?.active)||s.o.environment!=='station')return false;
      const slot=study.current.plan.slots.find(item=>item.id===slotId),roomId=slot&&study.roomIdFor(slot);if(!roomId)return false;
      if(this.preview?.slot.id===slot.id)return true;
      if(this.preview)this.close({focus:false});
      const v=s.v,room=s.getRoom(roomId),camera={position:v.camera.position.clone(),target:v.controls.target.clone(),up:v.camera.up.clone()},controls={};
      for(const key of cameraKeys)camera[key]=v.camera[key];for(const key of controlKeys)controls[key]=v.controls[key];
      const source=study.slotPosition(slot),bounds=new T.Box3().setFromObject(study.current.model),sphere=bounds.getBoundingSphere(new T.Sphere()),direction=v.camera.position.clone().sub(v.controls.target).normalize(),right=new T.Vector3().crossVectors(v.camera.up,direction).normalize();
      const destination=sphere.center.clone().addScaledVector(right,sphere.radius+Math.hypot(room.spec.width,room.spec.length)*.65+3).addScaledVector(direction,4);destination.y-=1.7;
      const start=source.clone().add(new T.Vector3(0,-1.7,0));
      this.preview={slot,roomId,room,source,destination,start,camera,controls,saved:transform(room.root),roof:room.roof.visible,focus:document.activeElement,elapsed:0};
      s.tween=null;s.o.robotInteraction.cancel();s.o.chat?.cancelPick();
      room.root.quaternion.identity();room.root.scale.setScalar(1);room.root.position.copy(start);room.root.visible=true;room.roof.visible=false;
      this.card.querySelector('small').textContent=study.current.name+' · '+(slot.layoutLabel||slot.name);
      this.card.querySelector('h2').textContent=slot.name;
      this.card.querySelector('p').textContent=room.spec.description+' 拖动旋转查看，点击空白收回。';
      this.sync();v.controls.enabled=true;v.controls.enableRotate=true;v.controls.minDistance=2;v.controls.maxDistance=500;v.controls.maxPolarAngle=Math.PI;v.camera.fov=40;v.camera.near=.05;v.camera.far=1600;v.camera.updateProjectionMatrix();
      this.frame(!s.o.reducedSceneMotion());
      if(s.o.reducedSceneMotion())this.finishMotion();
      this.card.querySelector('button').focus({preventScroll:true});return true;
    }
    frame(animate){
      const p=this.preview;if(!p)return;const s=this.s,v=s.v,rect=v.renderer.domElement.getBoundingClientRect(),card=this.card.getBoundingClientRect(),index=s.ui.querySelector('.st-modules').getBoundingClientRect(),heading=s.ui.querySelector('.st-heading').getBoundingClientRect(),tools=s.ui.querySelector('.st-tools').getBoundingClientRect(),status=document.getElementById('st-shape-status').getBoundingClientRect(),chat=document.getElementById('co-observation-chat')?.getBoundingClientRect(),phone=rect.width<=760;
      const x0=phone?12:card.right-rect.left+20,x1=index.left-rect.left-16,y0=Math.max(heading.bottom,tools.bottom,status.bottom)-rect.top+16,y1=phone?card.top-rect.top-16:Math.min(rect.height-65,chat?.top>y0+140?chat.top-rect.top-14:rect.height-65);
      const frame={left:2*x0/rect.width-1,right:2*Math.max(x0+90,x1)/rect.width-1,top:1-2*y0/rect.height,bottom:1-2*Math.max(y0+100,y1)/rect.height};
      const pose=window.IndoorLab.interiorOverviewPose(p.room.bounds,v.camera.aspect,v.camera.fov,frame),end=pose.position.clone().add(p.destination),target=pose.target.clone().add(p.destination);
      if(animate)p.motion={start:v.camera.position.clone(),from:v.controls.target.clone(),up:v.camera.up.clone(),end,target,elapsed:0};
      else{p.motion=null;v.camera.up.set(0,1,0);v.camera.position.copy(end);v.controls.target.copy(target);v.controls.update();}
    }
    finishMotion(){
      const p=this.preview;if(!p)return;const v=this.s.v;
      if(p.motion){v.camera.up.set(0,1,0);v.camera.position.copy(p.motion.end);v.controls.target.copy(p.motion.target);v.controls.update();}
      p.motion=null;p.elapsed=700;p.room.root.position.copy(p.destination);p.room.root.updateMatrixWorld(true);
    }
    close({focus=true}={}){
      const p=this.preview;if(!p)return false;const s=this.s,v=s.v;
      restoreTransform(p.room.root,p.saved);p.room.roof.visible=p.roof;
      const damping=v.controls.enableDamping;v.controls.enableDamping=false;v.controls.update();v.controls.enableDamping=damping;
      v.camera.position.copy(p.camera.position);v.camera.up.copy(p.camera.up);v.controls.target.copy(p.camera.target);
      for(const key of cameraKeys)v.camera[key]=p.camera[key];for(const key of controlKeys)v.controls[key]=p.controls[key];v.camera.updateProjectionMatrix();v.controls.update();
      this.preview=null;this.sync();
      if(focus){const button=s.ui.querySelector('.st-shell-index [data-st-shell-slot="'+p.slot.id+'"]');(button||p.focus)?.focus?.({preventScroll:true});}
      return true;
    }
    handleClick(ray){
      const p=this.preview;
      if(p){
        p.room.root.updateMatrixWorld(true);const local=ray.ray.clone().applyMatrix4(p.room.root.matrixWorld.clone().invert()),spec=p.room.spec,box=new T.Box3(new T.Vector3(-spec.width/2-.4,-.3,-spec.length/2-.4),new T.Vector3(spec.width/2+.4,3.7,spec.length/2+.4));
        if(local.intersectsBox(box))return;
      }
      const slot=this.s.shellStudy.pickSlot(ray);if(slot)this.open(slot.id);else if(p)this.close();
    }
    update(dt){
      const s=this.s,p=this.preview,v=s.v;
      if(p){
        const step=Math.min(1/30,Math.max(0,dt))*1000;p.elapsed=Math.min(700,p.elapsed+step);const t=p.elapsed/700,u=t*t*(3-2*t);
        p.room.root.position.lerpVectors(p.start,p.destination,u);p.room.root.visible=true;
        if(p.motion){const m=p.motion;m.elapsed=Math.min(700,m.elapsed+step);const t=m.elapsed/700,u=t*t*(3-2*t);v.camera.position.lerpVectors(m.start,m.end,u);v.controls.target.lerpVectors(m.from,m.target,u);v.camera.up.copy(m.up).lerp(new T.Vector3(0,1,0),u).normalize();if(t===1)p.motion=null;}
      }
      v.controls.update();v.camera.updateMatrixWorld(true);
    }
  }
  C.StationShellCabins=StationShellCabins;
})();
