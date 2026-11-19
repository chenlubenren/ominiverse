/* A lightweight first-person capsule: mouse look, momentum, sprint and jump. */
(() => {
  'use strict';const L=window.IndoorLab,LOOK_KEY='agentSociety.lookSensitivity',LOOK_YAW=.00095,LOOK_PITCH=.00082,LOOK_SMOOTH=42;
  class FirstPersonController {
    constructor(view){
      this.view=view;view.firstPerson=this;this.velocity=new THREE.Vector2();this.feet=0;this.eyeHeight=1.65;this.bodyHeight=1.8;this.crouched=false;this.verticalSpeed=0;this.grounded=true;this.phase=0;this.landing=0;this.jumpRequested=false;this.speed=0;this.bob=0;this.roll=0;
      const canvas=view.renderer.domElement;this.canvas=canvas;
      const hud=document.createElement('div');hud.id='first-person-hud';hud.hidden=true;hud.innerHTML='<div class="fp-top"><b>SPATIAL SIMULATION <span id="fp-floor"></span></b><small id="fp-mouse-status"></small></div><i class="fp-reticle"></i><div class="fp-controls">WASD 移动 <span>SHIFT 奔跑</span> <span>SPACE 跳跃</span> <span>左键左拳 / 右键右拳</span> <span>E 交互</span> <span>ESC 释放鼠标</span></div>';document.body.appendChild(hud);this.hud=hud;
      canvas.addEventListener('click',()=>{if(view.view==='walk'&&!this.locked)this.lock();});
      document.addEventListener('pointerlockchange',()=>{document.body.classList.toggle('first-person-locked',this.locked);view.walkKeys.clear();this.pendingYaw=this.pendingPitch=0;this.lockedAt=performance.now();});
      // Mouse look: about 45% of the former 0.0021 rad/px, per-event spike clamp (pointer-lock entry and edge jumps), short exponential smoothing in look().
      this.sensitivity=1;try{const s=Number(localStorage.getItem(LOOK_KEY));if(s>=.2&&s<=2.5)this.sensitivity=s;}catch{}this.pendingYaw=this.pendingPitch=0;this.lockedAt=0;
      document.addEventListener('mousemove',e=>{if(view.view!=='walk'||!this.locked||performance.now()-this.lockedAt<90)return;const k=this.sensitivity||1;this.pendingYaw-=L.clamp(e.movementX||0,-140,140)*LOOK_YAW*k;this.pendingPitch-=L.clamp(e.movementY||0,-110,110)*LOOK_PITCH*k;});
      window.addEventListener('keydown',e=>{
        if(view.view!=='walk'||document.querySelector('dialog[open]')||e.target.isContentEditable||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)&&!(e.target.id==='journey-target'&&e.code==='KeyE'))return;
        if(e.code==='Space'){e.preventDefault();if(!e.repeat)this.jumpRequested=true;}
        if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(L.firstPersonMode?.active){if(!e.repeat)L.firstPersonMode.openMenu();}else if(this.locked)document.exitPointerLock();view.walkKeys.clear();}
        if(!e.repeat&&e.code==='KeyE'&&L.building?.journey.interact()){e.preventDefault();e.stopImmediatePropagation();L.building?.combat?.gesture?.('reach');}
      },true);
      canvas.addEventListener('wheel',e=>{if(!this.locked||view.view!=='walk')return;const select=document.getElementById('journey-target');if(select&&!L.building.journey.trip){e.preventDefault();select.selectedIndex=L.clamp(select.selectedIndex+(e.deltaY>0?1:-1),0,select.options.length-1);}}, {passive:false});
      window.addEventListener('blur',()=>{view.walkKeys.clear();this.velocity.set(0,0);});
    }
    get locked(){return document.pointerLockElement===this.canvas;}
    lock(){try{const request=this.canvas.requestPointerLock?.();request?.catch?.(()=>{});}catch{}this.canvas.focus();}
    setSensitivity(value){this.sensitivity=L.clamp(Number(value)||1,.2,2.5);try{localStorage.setItem(LOOK_KEY,String(this.sensitivity));}catch{}return this.sensitivity;}
    setRole(role='humanoid'){this.role=['human','humanoid','vacuum'].includes(role)?role:'humanoid';this.eyeHeight=this.role==='vacuum'?.38:1.65;this.bodyHeight=this.role==='vacuum'?.44:1.8;this.crouched=false;this.bob=this.landing=this.roll=0;}
    reset(){this.pendingYaw=this.pendingPitch=0;this.velocity.set(0,0);this.feet=0;this.setRole(this.role);this.verticalSpeed=0;this.grounded=true;this.jumpRequested=false;this.landing=0;this.bob=0;this.speed=0;}
    input(){if(document.querySelector('dialog[open]')||window.IndoorLab.collaboration?.chat?.editing){this.view.walkKeys.clear();this.velocity.set(0,0);this.jumpRequested=false;}const k=this.view.walkKeys,forward=(k.has('w')||k.has('arrowup')?1:0)-(k.has('s')||k.has('arrowdown')?1:0),side=(k.has('d')||k.has('arrowright')?1:0)-(k.has('a')||k.has('arrowleft')?1:0);return{forward,side,running:k.has('shift')&&forward>0};}
    prepare(dt){
      const v=this.view,input=this.input();input.running=input.running&&!this.crouched;const n=Math.max(1,Math.hypot(input.forward,input.side)),speed=input.running?(this.sprintSpeed||5.6):(this.walkSpeed||2.2),dx=(Math.sin(v.walkYaw)*input.forward-Math.cos(v.walkYaw)*input.side)*speed/n,dz=(Math.cos(v.walkYaw)*input.forward+Math.sin(v.walkYaw)*input.side)*speed/n,speeding=dx*dx+dz*dz>this.velocity.lengthSq()+.01,blend=1-Math.exp(-dt*(this.grounded?(speeding?10:15):4));
      this.velocity.x+=(dx-this.velocity.x)*blend;this.velocity.y+=(dz-this.velocity.y)*blend;this.speed=this.velocity.length();
      if(this.jumpRequested&&this.grounded&&this.role!=='vacuum'){this.verticalSpeed=5.2;this.grounded=false;}this.jumpRequested=false;
      return input;
    }
    buildColliders(){const model=this.view.model;if(this.collisionModel===model&&this.collisionVersion===(model.physicsVersion||0))return;this.collisionModel=model;this.collisionVersion=model.physicsVersion||0;this.cells=new Map();const key=p=>[p.x,p.y,p.z].map(v=>Math.round((v+.0001)*100)).join(':'),destroyed=new Set((model.destroyedBounds||[]).map(key));
      for(const b of [...(model.layoutItems||[]),...(model.shellItems||[]),...(model.dynamicSolids||[]),...(model.doorSolids||[])]){if(b.navigationOnly||b.ignore||b.destroyed||b.y+b.h/2<.08||destroyed.has(key(b)))continue;const co=Math.cos(b.rotation||0),si=Math.sin(b.rotation||0),ex=Math.abs(co)*b.w/2+Math.abs(si)*b.d/2,ez=Math.abs(si)*b.w/2+Math.abs(co)*b.d/2,item={...b,co,si,bottom:b.y-b.h/2,top:b.y+b.h/2};
        for(let z=Math.floor((b.z-ez-.3)/2);z<=Math.floor((b.z+ez+.3)/2);z++)for(let x=Math.floor((b.x-ex-.3)/2);x<=Math.floor((b.x+ex+.3)/2);x++){const key=x+':'+z;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(item);}
      }
    }
    nearby(x,z){return this.cells.get(Math.floor(x/2)+':'+Math.floor(z/2))||[];}
    overlaps(b,x,z,r=.24){const dx=x-b.x,dz=z-b.z,lx=b.co*dx-b.si*dz,lz=b.si*dx+b.co*dz,ox=Math.max(0,Math.abs(lx)-b.w/2),oz=Math.max(0,Math.abs(lz)-b.d/2);return ox*ox+oz*oz<r*r;}
    clear(x,z){const v=this.view,b=v.model.bounds;if(x<b.minX+.25||x>b.maxX-.25||z<b.minZ+.25||z>b.maxZ-.25)return false;
      if(!v.model.towerFloor)return v.grid.isClear(x,z,.24);
      if(this.feet<2.25&&(v.model.liftDoors||[]).some(pair=>pair.some(d=>Math.abs(x-d.node.position.x)<.625&&Math.abs(z-d.node.position.z)<.28)))return false;
      // A two-dimensional wall grid alone would prevent jumping over low furniture.
      if(this.nearby(x,z).some(b=>b.top>this.feet+.045&&b.bottom<this.feet+(this.bodyHeight||1.8)&&this.overlaps(b,x,z)))return false;
      const i=v.grid.index(x,z);return i>=0&&(this.feet>.15||v.grid.support[i]);
    }
    vertical(dt,support=0){const before=this.feet;this.verticalSpeed-=15.5*dt;this.feet+=this.verticalSpeed*dt;if(this.feet<=support&&before>=support-.08){if(!this.grounded)this.landing=Math.min(.12,Math.abs(this.verticalSpeed)*.013);this.feet=support;this.verticalSpeed=0;this.grounded=true;}else this.grounded=false;}
    animate(dt,input){const v=this.view;this.phase+=this.speed*dt*4.6;const bobTarget=this.grounded&&this.role!=='vacuum'?Math.sin(this.phase)*(input.running?.032:.016)*Math.min(1,this.speed/2):0;this.bob+=(bobTarget-this.bob)*(1-Math.exp(-dt*18));this.landing*=Math.exp(-dt*13);
      const rollTarget=-input.side*Math.min(this.speed/5.6,1)*.022;this.roll+=(rollTarget-this.roll)*(1-Math.exp(-dt*8));v.camera.fov+=(65+Math.min(1,this.speed/5.6)*(input.running?6:.5)-v.camera.fov)*(1-Math.exp(-dt*5));v.camera.updateProjectionMatrix();
    }
    look(){const v=this.view,p=v.camera.position,now=performance.now(),dt=Math.min(.1,Math.max(0,(now-(this.lookClock||now))/1000));this.lookClock=now;if(this.pendingYaw||this.pendingPitch){const blend=1-Math.exp(-dt*LOOK_SMOOTH),near=Math.abs(this.pendingYaw)+Math.abs(this.pendingPitch)<2e-5,yaw=near?this.pendingYaw:this.pendingYaw*blend,pitch=near?this.pendingPitch:this.pendingPitch*blend;v.walkYaw+=yaw;v.walkPitch=L.clamp(v.walkPitch+pitch,-1.38,1.38);this.pendingYaw-=yaw;this.pendingPitch-=pitch;}v.camera.up.set(0,1,0);v.camera.lookAt(p.x+Math.sin(v.walkYaw)*Math.cos(v.walkPitch),p.y+Math.sin(v.walkPitch),p.z+Math.cos(v.walkYaw)*Math.cos(v.walkPitch));v.camera.rotateZ(this.roll+(L.building?.combat?.motionRoll||0)*.22);const shake=L.building?.combat?.shake||0;if(shake){v.camera.rotateX(Math.sin(performance.now()*.08)*shake);v.camera.rotateZ(Math.cos(performance.now()*.07)*shake*.6);}}
    update(dt){this.buildColliders();const v=this.view,p=v.camera.position,input=this.prepare(dt),steps=Math.max(1,Math.ceil(this.speed*dt/.055)),dx=this.velocity.x*dt/steps,dz=this.velocity.y*dt/steps;
      for(let i=0;i<steps;i++){if(this.clear(p.x+dx,p.z+dz)){p.x+=dx;p.z+=dz;}else{if(this.clear(p.x+dx,p.z))p.x+=dx;else this.velocity.x=0;if(this.clear(p.x,p.z+dz))p.z+=dz;else this.velocity.y=0;}}
      let support=0;if(v.model.towerFloor)for(const b of this.nearby(p.x,p.z))if(b.top<=this.feet+.08&&b.top>support&&this.overlaps(b,p.x,p.z,.12))support=b.top;
      this.vertical(dt,support);this.animate(dt,input);p.y=(this.eyeHeight||1.65)+this.feet+this.bob-this.landing;this.look();this.refreshHUD();
    }
    onPath(dt){const input=this.prepare(dt);this.vertical(dt,0);this.animate(dt,input);this.refreshHUD();return input;}
    refreshHUD(){const active=this.view.view==='walk'&&(!L.building||L.building.phase==='interior');this.hud.hidden=!active;document.getElementById('fp-floor').textContent=this.view.model?.towerFloor?String(this.view.model.towerFloor).padStart(2,'0')+'F':'';document.getElementById('fp-mouse-status').textContent=this.locked?'鼠标视角已捕获':'点击场景，进入第一人称控制';}
    viewChanged(mode){if(mode!=='walk')this.setRole('humanoid');this.reset();if(mode!=='walk'&&this.locked&&!L.building?.journey.changing)document.exitPointerLock();this.refreshHUD();}
  }
  L.FirstPersonController=FirstPersonController;
})();
