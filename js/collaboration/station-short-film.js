/* Thirty-second visual stories using the existing cabin, crew rig and tools. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,clamp=T.MathUtils.clamp,V=p=>p?.isVector3?p.clone():new T.Vector3(...(p||[0,0,0]));
  const ease=u=>{u=clamp(u,0,1);return u*u*(3-2*u);},ramp=(t,a,b)=>ease((t-a)/Math.max(.001,b-a));
  function track(keys,t,fallback=[0,0,0]){
    if(!keys?.length)return fallback.slice();let a=keys[0],b=a;
    for(let i=1;i<keys.length;i++){b=keys[i];if(t<=b[0])break;a=b;}
    const u=b[0]===a[0]?0:ramp(t,a[0],b[0]);return a.slice(1).map((v,i)=>v+(i===3?Math.atan2(Math.sin(b[i+1]-v),Math.cos(b[i+1]-v)):b[i+1]-v)*u);
  }
  const cueAt=(items,t)=>items?.find(c=>t>=c.start&&t<c.end)||items?.filter(c=>c.end<=t).at(-1)||{};
  class StationShortFilm {
    constructor(d){this.d=d;this.s=d.s;this.time=0;this.duration=30;this.actors=[];this.robots=[];this.props=new Map();this.materials=[];this.geometries=[];this.urls=new Set();}
    start(options={}){
      this.options=options;this.headless=!!options.headless;this.story=JSON.parse(JSON.stringify(C.stationShortStories.find(s=>s.id===options.shortFilm)||C.stationShortStories[0]));if(!this.story)throw Error('短片尚未准备好');
      this.id=this.story.id;this.title=this.story.title;this.duration=this.story.duration||30;
      const d=this.d;d.options={...options,shortFilm:this.id,manual:!!options.manual};d.active=true;d.loading=false;d.paused=false;d.time=0;d.duration=this.duration;d.ui.hidden=true;d.story={title:this.title};d.outcome=null;
      this.saved={controls:this.s.v.controls.enabled,exposure:this.s.v.renderer.toneMappingExposure};if(!this.headless){this.s.v.controls.enabled=false;document.body.dataset.stationStory='playing';document.body.dataset.stationFilm='short';}
      this.scene=new T.Scene();this.scene.background=new T.Color('#07121b');this.scene.environment=this.s.scene.environment;this.set=C.buildStationFilmSet(this.s);this.scene.add(this.set.root);this.clearWorkArea();this.camera=new T.PerspectiveCamera(53,16/9,.035,120);d.camera=this.camera;
      this.owned=new T.Group();this.owned.name='短片可动道具';this.scene.add(this.owned);
      this.facts={contactEvents:[],doorViolations:[],resultFlags:{},cameraShots:[],sourceModuleId:this.set.reuse.sourceModuleId};
      for(const spec of this.story.crew){const model=C.makeStationCrew(spec.crewIndex);C.makeStationFilmMannequin(model);model.name=spec.name;this.scene.add(model);this.actors.push({...spec,model,x:0,y:0,z:0,angle:0,v:0,radius:.27,action:'idle'});}
      for(const spec of this.story.robots){const model=C.makeStationShortRobot(spec);if(spec.scale)model.scale.setScalar(spec.scale);this.scene.add(model);this.robots.push({...spec,model,x:0,y:0,z:0,angle:0,v:0,radius:({science:.45,medical:.50,cargo:.65}[spec.role])*(spec.scale||1)});}
      for(const spec of this.story.props||[])this.props.set(spec.id,this.makeProp(spec));
      this.makeParticles();if(this.id==='zombie')C.stationShortZombie?.setup(this);if(options.branch)this.branchController=C.createStationShortBranch(this,options.branch);if(!this.headless)this.makeUI();this.step(0);if(!this.headless){this.refreshUI();this.render();}return this.snapshot();
    }
    material(color,options={}){const m=new T.MeshStandardMaterial({color,roughness:.4,metalness:.25,...options});this.materials.push(m);return m;}
    clearWorkArea(){
      // Relocate the original plant rack intact into the other compartment.
      // Only film instance matrices change; web geometry/materials are reused.
      const shift=new T.Matrix4().makeTranslation(0,0,7),changed=new Set();
      for(const surface of this.set.surfaceMeshes||[])if(surface.name.includes('science-plants')){const {renderInstance,instanceIndex}=surface.userData;if(!renderInstance)continue;const matrix=new T.Matrix4();renderInstance.getMatrixAt(instanceIndex,matrix);matrix.premultiply(shift);renderInstance.setMatrixAt(instanceIndex,matrix);renderInstance.instanceMatrix.needsUpdate=true;surface.matrix.copy(matrix);surface.matrixWorld.copy(matrix);changed.add(renderInstance);}
      this.set.hull.traverse(n=>{if(n.name==='原问天细节 / 植物培养单元'){n.matrix.premultiply(shift);n.matrixWorldNeedsUpdate=true;}});
    }
    mesh(parent,geometry,material,name,position=[0,0,0]){this.geometries.push(geometry);const m=new T.Mesh(geometry,material);m.name=name;m.position.fromArray(position);parent.add(m);return m;}
    makeProp(spec){
      const root=new T.Group();root.name='短片道具 / '+spec.id;this.owned.add(root);root.position.fromArray(spec.position||[0,1.6,-2]);
      const p={...spec,root,owner:null,attached:false,parts:{},released:false},white=this.material('#e5eef1'),dark=this.material('#152b3c'),metal=this.material('#718897',{metalness:.8,roughness:.25}),cyan=this.material('#69e4de',{emissive:'#36aebd',emissiveIntensity:.35}),amber=this.material('#edaf60');
      const sphere=(r,m,pos=[0,0,0],name='sphere')=>this.mesh(root,new T.SphereGeometry(r,28,18),m,name,pos);
      const box=(size,m,pos=[0,0,0],name='box')=>this.mesh(root,C.roundedRobotBox(...size,.025),m,name,pos);
      if(spec.kind==='water'){
        p.parts.ball=sphere(.20,this.material('#078ad0',{transparent:true,opacity:.85,roughness:.16,metalness:.05,depthWrite:false}),[0,0,0],'蓝色失重水球');
        sphere(.045,this.material('#e5fdff',{emissive:'#c6f8ff',emissiveIntensity:.5}),[-.065,.09,.125],'水球高光');
        p.parts.drops=[];for(let i=0;i<7;i++){const a=i*2.4,m=sphere(.025+(i%3)*.009,cyan,[Math.cos(a)*.29,Math.sin(a*.7)*.25,Math.sin(a)*.25],'卫星水滴');p.parts.drops.push(m);}
      }else if(spec.kind==='alien'&&spec.variant==='lightDot'){
        sphere(.035,this.material('#ffe6a0',{emissive:'#ffc55a',emissiveIntensity:1.4}),[0,0,0],'引导光点');
      }else if(spec.kind==='alien'){
        const skin=this.material('#74e5bd',{roughness:.27,emissive:'#1e7a69',emissiveIntensity:.2});sphere(.22,skin,[0,.04,0],'外星团子');
        for(const x of [-.075,.075]){sphere(.064,white,[x,.10,.18],'大眼白');sphere(.028,dark,[x,.10,.235],'追踪瞳孔');}
        p.parts.tentacles=[];for(let i=0;i<6;i++){const g=new T.Group();g.rotation.y=i*Math.PI/3;root.add(g);const joint=new T.Group();joint.position.set(0,-.05,.14);g.add(joint);const limb=this.mesh(joint,new T.SphereGeometry(.065,14,10),skin,'柔软的外星触须',[0,-.08,.07]);limb.scale.set(.8,2.2,.9);limb.rotation.x=-.7;p.parts.tentacles.push(joint);}
      }else if(spec.kind==='cup'){
        const glass=this.material('#b0e7ef',{transparent:true,opacity:.28,roughness:.18,depthWrite:false});this.mesh(root,new T.CylinderGeometry(.105,.10,.25,32),glass,'透明密封水杯');
        for(const y of [-.125,.125])this.mesh(root,new T.CylinderGeometry(.112,.112,.035,32),metal,'杯盖',[0,y,0]);this.mesh(root,new T.TorusGeometry(.11,.012,8,32),cyan,'杯身功能环').rotation.x=Math.PI/2;
        p.parts.lid=new T.Group();p.parts.lid.position.set(0,.14,-.105);root.add(p.parts.lid);this.mesh(p.parts.lid,new T.CylinderGeometry(.108,.108,.025,24),amber,'可闭合杯口',[0,0,.105]);p.parts.fill=this.mesh(root,new T.CylinderGeometry(.088,.085,.17,24),this.material('#54bceb',{transparent:true,opacity:.65}), '回收的清水',[0,-.025,0]);
      }else if(spec.kind==='crate'){
        box([.7,.45,.52],dark);for(const x of [-.33,.33])box([.05,.47,.54],white,[x,0,0]);
        p.parts.lid=new T.Group();p.parts.lid.position.set(0,.23,-.26);root.add(p.parts.lid);this.mesh(p.parts.lid,C.roundedRobotBox(.72,.05,.54,.02),white,'弹开的货箱盖',[0,0,.26]);box([.14,.06,.025],amber,[0,.15,.28],'货箱锁扣');
      }else if(spec.kind==='electric'){
        box([.46,.60,.18],dark);for(let i=0;i<5;i++)box([.29,.025,.025],i%2?cyan:amber,[0,.2-i*.09,.105]);p.parts.light=sphere(.045,cyan,[.16,.23,.12],'电气状态灯');
      }else if(spec.kind==='patch'){
        box([.36,.34,.035],amber);box([.28,.26,.038],dark,[0,0,.015]);for(const x of [-.14,.14])for(const y of [-.13,.13])sphere(.018,metal,[x,y,.035]);
      }else if(spec.kind==='tool'){
        this.mesh(root,new T.CylinderGeometry(.025,.025,.34,12),metal,'漂浮扳手柄');const ring=this.mesh(root,new T.TorusGeometry(.066,.019,8,16),metal,'扳手开口',[0,.19,0]);ring.rotation.x=Math.PI/2;box([.04,.11,.04],amber,[0,-.03,0]);
      }else if(spec.kind==='rift'){
        box([.68,.72,.035],metal);const pts=[[-.035,-.27],[.04,-.15],[-.01,-.03],[.07,.09],[-.015,.27],[.10,.12],[.05,-.03],[.10,-.17],[.035,-.29]],shape=new T.Shape(pts.map(a=>new T.Vector2(...a)));this.mesh(root,new T.ShapeGeometry(shape),this.material('#010609'), '裂缝',[0,0,.022]);
        p.parts.warning=this.mesh(root,new T.TorusGeometry(.28,.015,8,40),this.material('#ff8060',{emissive:'#ff4e2c',emissiveIntensity:.7}),'裂缝警戒环',[0,0,.035]);
      }else if(spec.kind==='net'){
        const radius=spec.variant==='rescueHandle'?.15:.31,ring=this.mesh(root,new T.TorusGeometry(radius,.018,10,48),cyan,'捕获环');
        p.parts.ring=ring;if(spec.variant!=='rescueHandle'){p.parts.bubble=sphere(radius,this.material('#a1eedf',{transparent:true,opacity:.10,roughness:.15,depthWrite:false}),[0,0,0],'透明收容罩');p.parts.ring2=ring.clone();p.parts.ring2.rotation.y=Math.PI/2;root.add(p.parts.ring2);}
      }else sphere(.07,cyan);
      C.enhanceStationShortProp?.(this,p);
      if(spec.kind==='patch'||spec.kind==='rift'||spec.kind==='electric'){const face=new T.Group();for(const child of [...root.children])face.add(child);face.rotation.y=-Math.PI/2;root.add(face);}
      if(spec.size){root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root).getSize(new T.Vector3()),dimensions=typeof spec.size==='number'?[spec.size,spec.size,spec.size]:spec.size;root.scale.set(...dimensions.map((v,i)=>v/Math.max(.001,bounds.getComponent(i))));}
      p.baseScale=root.scale.clone();return p;
    }
    makeParticles(){
      this.streaks=[];const m=this.material('#b6ecff',{transparent:true,opacity:.45,emissive:'#6faac6',emissiveIntensity:.45});
      for(let i=0;i<24;i++){const mesh=this.mesh(this.owned,new T.CylinderGeometry(.006,.006,.22,5),m,'气流示意');mesh.visible=false;this.streaks.push(mesh);}
      this.link=this.mesh(this.owned,new T.CylinderGeometry(.008,.008,1,8),this.material('#72ded4',{transparent:true,opacity:.55,emissive:'#4bafa7',emissiveIntensity:.5}),'机器人引导光');this.link.visible=false;
    }
    actor(id){return[...this.actors,...this.robots].find(a=>a.id===id);}
    anchor(id,name='body',offset){const a=this.actor(id),prop=this.props.get(id);if(!a){if(!prop)return null;const p=prop.root.getWorldPosition(new T.Vector3());return offset?p.add(V(offset)):p;}let p;if(a.role){const tool=name==='robotLeft'?'cup':name==='robotRight'?(a.role==='science'?'capture':a.role==='cargo'?'seal':'probe'):name;p=C.stationShortRobotTarget(a.model,tool)||a.model.localToWorld(V([0,.3,0]));}else if(name==='leftHand'||name==='rightHand')p=C.stationFilmHandPosition(a.model,name==='leftHand'?'left':'right');else if(name==='chest')p=C.stationFilmChestPosition(a.model);else p=a.model.localToWorld(V([0,1.3,.25]));return offset?p.add(V(offset).applyQuaternion(a.model.quaternion)):p;}
    target(ref){if(!ref)return null;if(Array.isArray(ref)||ref.isVector3)return V(ref);if(typeof ref==='string')return this.props.get(ref)?.root.getWorldPosition(new T.Vector3())||this.anchor(ref);if(ref.prop)return this.props.get(ref.prop)?.root.getWorldPosition(new T.Vector3());if(ref.actor)return this.anchor(ref.actor,ref.anchor,ref.offset);if(ref.point)return V(ref.point);return null;}
    place(a,pose,dt){
      const old=new T.Vector3(a.x,a.y,a.z),next=V(pose),near=Math.min(a.z,next.z)<a.radius+.24&&Math.max(a.z,next.z)>-a.radius-.24;
      if(dt&&near&&(a.z*next.z<0)&&(this.set.door.openAmount<.97||Math.abs(next.x)+a.radius>this.set.door.clearWidth/2))this.facts.doorViolations.push({id:a.id,time:this.time,x:next.x,z:next.z,opening:this.set.door.openAmount});
      a.v=dt?old.distanceTo(next)/dt:0;a.x=next.x;a.y=next.y;a.z=next.z;a.angle=pose[3]||0;a.model.position.copy(next);const drift=!a.role&&a.id==='lead'?(ramp(this.time,3,5)*(1-ramp(this.time,9,12))):0;a.model.rotation.set(drift*(this.id==='rescue'?.12:.045),a.angle,-drift*(this.id==='rescue'?.16:.04),'YXZ');a.model.updateMatrixWorld(true);
    }
    updateProps(t,dt){
      for(const p of this.props.values()){
        const desired=track(p.keys,t,p.position||[0,1.6,-2]);if(!p.attached)p.root.position.fromArray(desired);
        if(p.rotationKeys)p.root.rotation.fromArray([...track(p.rotationKeys,t,[0,0,0]),'XYZ']);else if(p.kind==='tool')p.root.rotation.set(t*1.2,t*.8,t*.42);
        if(p.scaleKeys){const scales=track(p.scaleKeys,t,[1]);p.root.scale.copy(p.baseScale).multiply(scales.length===1?V([scales[0],scales[0],scales[0]]):V(scales));}
        const state=Object.assign({},...p.stateKeys?.filter(k=>k.time<=t)||[]);p.state=state;p.root.visible=state.visible!==false;
        if(p.parts.lid){const desired=state.open??0;p.parts.lid.rotation.x+=(-desired*1.6-p.parts.lid.rotation.x)*(dt?1-Math.exp(-dt*6):1);}
        if(p.parts.fill)p.parts.fill.visible=!!state.filled;
        if(p.parts.ring2)p.parts.ring2.rotation.y=Math.PI/2+(state.open||0)*.35*Math.sin(t*1.2);
        p.shortUpdate?.(t,dt,state);
        if(p.parts.drops)p.parts.drops.forEach((m,i)=>{const a=i*2.4+t*.6;m.position.set(Math.cos(a)*.27,Math.sin(a*.7)*.24,Math.sin(a)*.25);m.scale.setScalar(.85+.15*Math.sin(t*2+i));});
        if(p.parts.ball)p.parts.ball.scale.set(1+.08*Math.sin(t*4),1+.07*Math.sin(t*3.4+1),1+.06*Math.sin(t*3.1+2));
        if(p.kind==='cup'&&p.owner==='lead'&&t>26)p.root.rotation.z=.09*ramp(t,26,27)*Math.sin(t*4);
        if(p.parts.tentacles)p.parts.tentacles.forEach((joint,i)=>{joint.rotation.x=.4+Math.sin(t*4+i)*.4;joint.rotation.z=Math.sin(t*2.8+i)*.2;});
        const key=p.ownerKeys?.filter(k=>k.time<=t).at(-1);if(key&&key!==p.appliedOwnerKey){if(!key.owner||key.owner==='world'){p.attached=false;p.owner=null;p.appliedOwnerKey=key;}else if(key.time===0){p.owner=key.owner;p.anchor=key.anchor;p.offset=key.offset;p.attached=true;p.appliedOwnerKey=key;}}
      }
    }
    contact(id,a,b,tolerance=.15,extra={}){const distance=a.distanceTo(b);if(distance>tolerance)return false;if(!this.facts.contactEvents.some(e=>e.id===id))this.facts.contactEvents.push({id,time:+this.time.toFixed(4),actual:a.toArray(),target:b.toArray(),distance,tolerance,...extra});return true;}
    step(dt){
      const t=this.time;this.branchController?.before?.(t,dt);if(this.id==='zombie')C.stationShortZombie?.before(this,t,dt);this.set.update(t,{doorOpen:track(this.story.doorKeys,t,[1])[0],alarm:(this.id==='rescue'&&t<18||this.id==='zombie'&&t>3&&t<23)?.8:0,sampleFault:false});
      for(const a of [...this.actors,...this.robots])this.place(a,track(a.keys,t),dt);
      this.updateProps(t,dt);
      for(const r of this.robots){const cue=cueAt(r.cues,t),point=this.target(cue.target),local=point?r.model.worldToLocal(point.clone()):V([0,.1,1]),extra=this.robotTools(r,t);C.animateStationShortRobot(r.model,t,{action:cue.action||'scan',speed:r.v,turn:Math.sin(t)*.1,thrust:{x:0,y:Math.sin(t*2)*.035,z:Math.min(.5,r.v*.3)},target:local,capture:cue.capture||0,work:cue.work??(cue.action==='work'?1:0),mood:cue.mood||(t>25?'happy':'focus'),toolTarget:cue.toolTarget?this.target(cue.toolTarget):undefined,...extra});r.action=cue.action||'scan';}
      for(const a of this.actors){const cue=cueAt(a.cues,t),hands={};for(const [side,h]of Object.entries(cue.hands||{})){const ref=h.target||h,p=this.props.get(ref.prop);let point=this.target(ref);if(p?.owner===a.id)point=V(track(p.keys,t,p.position)).sub(V(p.offset));if(point){if(t>26&&side==='left'&&this.id!=='rescue')point.add(V([.07*Math.sin(t*5),.065*Math.cos(t*5),.025*Math.sin(t*3)]).multiplyScalar(ramp(t,26,27)));hands[side]={position:point,grip:h.grip??.35,weight:(t===0?1:ramp(t,cue.start,cue.start+.40))*(h.weight??1)};}}a.action=cue.action||'idle';const look=this.target(cue.lookAt)||this.robots[0]?.model.position.clone().add(V([0,.4,0]));C.animateStationFilmActor(a.model,t,{action:a.action,speed:a.v,lean:cue.lean||0,lookAt:look,handTargets:hands});}
      this.interactions(t,dt);if(this.id==='zombie')C.stationShortZombie?.after(this,t,dt);this.branchController?.after?.(t,dt);this.updateAttachments();this.effects(t);this.setCamera();
      if(t>=this.duration-.01)this.d.outcome={title:this.title,...this.facts.resultFlags};
    }
    updateAttachments(){for(let pass=0;pass<2;pass++)for(const p of this.props.values())if(p.attached){const a=this.anchor(p.owner,p.anchor,p.offset);if(a)p.root.position.copy(a);}this.scene.updateMatrixWorld(true);}
    robotTools(r,t){
      if(this.id==='water'){
        const cup=this.props.get('cup'),p=V(track(cup.keys,t,cup.position));
        return{capture:ramp(t,10,12)*(1-ramp(t,16,18)),cupTarget:t>=9?p:undefined,mood:t>25?'happy':t>5?'alert':'idle'};
      }
      if(this.id==='rescue'&&r.id==='engineer')return{toolTarget:this.target('rift'),work:ramp(t,10,13)*(1-ramp(t,18,19)),mood:t>18?'happy':'alert'};
      if(this.id==='rescue'&&r.id==='medical'){
        const handle=this.props.get('rescueHandle');return{rescueTarget:t>10?V(track(handle.keys,t,handle.position)):undefined,toolTarget:t>24&&t<28.3?this.anchor('lead','rightHand'):undefined,mood:t>24?'happy':'alert'};
      }
      return{};
    }
    bind(p,owner,anchor='body',offset=[0,0,0]){p.owner=owner;p.anchor=anchor;p.offset=offset;p.attached=true;}
    approach(p,target,a,b,t,id,owner,anchor='body',offset=[0,0,0]){
      if(p.attached&&p.owner===owner)return true;if(!target)return false;const current=V(track(p.keys,t,p.position));p.root.position.copy(current.lerp(target,ramp(t,a,b)));
      if(t>=b-.02&&this.contact(id,p.root.position,target,.055,{actor:owner,prop:p.id})){this.bind(p,owner,anchor,offset);this.facts.resultFlags[id]=true;return true;}return false;
    }
    interactions(t,dt){
      this.updateAttachments();
      if(this.id==='water'){
        const cup=this.props.get('cup'),water=this.props.get('water'),hood=this.props.get('hood'),r=this.actor('science');
        hood.root.visible=false; // The detailed robot has its own six-petal collector.
        if(t>=10&&t<20)this.approach(cup,this.anchor('science','cup'),10,12.5,t,'catch-cup','science','cup');
        if(t>=13&&t<17)this.approach(water,this.anchor('science','capture'),13,16,t,'water-caught','science','capture');
        if(t>=17&&t<19.1){water.attached=false;const a=this.anchor('science','capture'),b=cup.root.position.clone();water.root.position.copy(a.lerp(b,ramp(t,17,19)));water.root.scale.copy(water.baseScale).multiplyScalar(2.2*(1-ramp(t,17,19)));if(t>=19-.02&&this.contact('water-bottled',water.root.position,b,.055,{actor:'science',prop:'water'}))this.facts.resultFlags['water-bottled']=true;}
        if(t>=20.5&&t<25.5){const target=this.anchor('lead','rightHand',[0,.03,0]);if(t>23.5&&cup.root.position.distanceTo(target)<.15){this.contact('return-cup',cup.root.position,target,.15,{actor:'lead',prop:'cup'});this.bind(cup,'lead','rightHand',[0,.03,0]);this.facts.resultFlags['return-cup']=true;}}
      }else if(this.id==='visitor'){
        const alien=this.props.get('alien'),bubble=this.props.get('bubble'),lure=this.props.get('lure');
        if(t>=15&&t<21)this.approach(alien,bubble.root.position.clone().add(V([0,.015,0])),15,19.5,t,'visitor-contained','bubble','body',[0,.015,0]);
        if(t>17&&t<19.5)lure.root.position.lerp(bubble.root.position,ramp(t,17,19.5));
        if(t>26.5){alien.parts.tentacles[0].rotation.x=-.5+.6*Math.sin((t-27)*5);alien.parts.tentacles[1].rotation.x=-.5+.6*Math.sin((t-27)*5+.5);this.facts.resultFlags['visitor-waves-back']=true;}
      }else if(this.id==='rescue'){
        const handle=this.props.get('rescueHandle'),patch=this.props.get('patch'),rift=this.props.get('rift');
        this.bind(handle,'medical','frontRescue');
        if(t>=12&&t<24){const left=this.anchor('lead','leftHand'),grip=this.anchor('medical','frontRescue');if(this.contact('crew-caught',left,grip,.14,{actor:'lead',prop:'rescueHandle'}))this.facts.resultFlags['crew-caught']=true;}
        if(t>=13&&t<=18){const target=rift.root.position.clone().add(V([-.035,0,0])),tip=this.anchor('engineer','seal');patch.root.position.copy(tip);if(t>=17&&this.contact('seal-leak',tip,target,.10,{actor:'engineer',prop:'patch'})){patch.attached=false;patch.owner=null;patch.root.position.copy(target);this.facts.resultFlags['seal-leak']=true;}}
        if(t>=18&&this.facts.resultFlags['seal-leak']){patch.attached=false;patch.owner=null;patch.root.position.copy(rift.root.position).x-=.035;}
        if(t>=24&&this.facts.resultFlags['crew-caught']&&this.actor('lead').z>.7)this.facts.resultFlags['safe-tow']=true;
        if(t>=24&&t<28.3&&this.contact('wrist-safe',this.anchor('medical','probe'),this.anchor('lead','rightHand'),.12,{actor:'medical',prop:'lead'}))this.facts.resultFlags['wrist-safe']=true;
      }
    }
    effects(t){
      this.link.visible=false;
      if(this.id==='visitor'&&t>11&&t<19.5){const from=this.anchor('science','capture'),to=this.props.get('lure').root.position,delta=to.clone().sub(from);this.link.visible=true;this.link.position.copy(from).add(to).multiplyScalar(.5);this.link.scale.y=delta.length();this.link.quaternion.setFromUnitVectors(V([0,1,0]),delta.normalize());}
      if(this.id==='rescue'){const rift=[...this.props.values()].find(p=>p.kind==='rift'),origin=rift?.root.position||V([1.8,1.7,-3.2]),active=t>2.3&&t<18;for(let i=0;i<this.streaks.length;i++){const m=this.streaks[i],u=1-(t*1.1+i*.073)%1;m.visible=active;m.position.copy(origin).add(V([-u*2.8,Math.sin(i*1.7)*.5*u,Math.cos(i*2.1)*.8*u]));m.quaternion.setFromUnitVectors(V([0,1,0]),V([1,0,0]));m.scale.y=(.6+u*1.5)*(1-ramp(t,16.5,18));}}
    }
    setCamera(){
      const shots=this.story.shots,shot=shots.find(s=>this.time>=s.start&&this.time<s.end)||shots.at(-1),index=shots.indexOf(shot),u=ramp(this.time,shot.start,shot.end);
      this.shot=shot;if(!this.facts.cameraShots.includes(index))this.facts.cameraShots.push(index);
      const pos=V(shot.position),target=this.target(shot.target)||V(shot.target);if(shot.positionEnd)pos.lerp(V(shot.positionEnd),u);else pos.add(V([Math.sin(u*Math.PI)*.12,.045*u,-.12*u]));if(shot.targetEnd)target.lerp(V(shot.targetEnd),u);
      const override=C.stationShortCamera?.(this,shot,this.time);this.camera.position.copy(override?V(override.position):pos);this.camera.lookAt(override?V(override.target):target);this.camera.fov=override?.fov||shot.fov||54;this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);
    }
    tick(dt){if(this.comparison||!this.d.active||this.d.paused||!Number.isFinite(dt)||dt<=0)return;let remaining=Math.min(dt,this.duration-this.time);while(remaining>1e-8){const step=Math.min(1/60,remaining);this.time=Math.min(this.duration,this.time+step);this.d.time=this.time;this.step(step);remaining-=step;}this.refreshUI();}
    makeUI(){const ui=this.ui=document.createElement('section');ui.className='st-short-ui';ui.innerHTML='<div class="st-short-title"><small>ORBITAL TALES</small><h2></h2></div><nav class="st-short-controls"></nav><div class="st-short-clock"><i></i></div>';ui.querySelector('h2').textContent=this.title;const nav=ui.querySelector('nav');for(const [text,fn,key]of [['暂停',()=>this.d.paused?this.d.resume():this.d.pause(),'pause'],['重播',()=>this.d.play({shortFilm:this.id,scenario:'visitor'}),'replay'],['观看成片',()=>this.openVideo(),'video'],['返回空间站',()=>this.d.stop(),'exit']]){const b=document.createElement('button');b.textContent=text;b.dataset.shortControl=key;b.onclick=fn;nav.append(b);}const select=document.createElement('select');select.setAttribute('aria-label','选择短片');for(const story of C.stationShortStories){const option=document.createElement('option');option.value=story.id;option.textContent=story.title;option.selected=story.id===this.id;select.append(option);}select.onchange=()=>this.d.play({shortFilm:select.value,scenario:'visitor'});nav.prepend(select);document.body.append(ui);}
    refreshUI(){if(!this.ui)return;this.ui.querySelector('.st-short-title').style.opacity=String(1-ramp(this.time,1.5,2.3));this.ui.querySelector('.st-short-clock i').style.width=this.time/this.duration*100+'%';this.ui.querySelector('[data-short-control="pause"]').textContent=this.d.paused?'继续':'暂停';}
    render(){const renderer=this.s.v.renderer,canvas=renderer.domElement;this.camera.aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);this.camera.updateProjectionMatrix();renderer.toneMappingExposure=1.05;renderer.render(this.scene,this.camera);}
    narrative(){return{stage:this.shot?.name||'',caption:''};}
    exportPlan(){return{...this.story,dialogue:[],resolution:[1920,1080],fps:30,audio:false};}
    snapshot(){return{active:this.d.active,film:true,shortFilm:this.id,title:this.title,time:+this.time.toFixed(4),duration:this.duration,paused:this.d.paused,...this.narrative(),facts:this.facts,doorOpen:this.set.door.openAmount,crew:this.actors.map(a=>({id:a.id,name:a.name,x:a.x,y:a.y,z:a.z,action:a.action})),robots:(this.branchController?.units||this.robots).map(a=>({id:a.id,role:a.role,x:a.model.position.x,y:a.model.position.y,z:a.model.position.z,position:a.model.position.toArray(),quaternion:a.model.quaternion.toArray(),visible:a.model.visible,action:a.action,design:a.model.userData.short?.design})),props:[...this.props.values()].map(p=>({id:p.id,kind:p.kind,position:p.root.position.toArray(),quaternion:p.root.quaternion.toArray(),visible:p.root.visible,owner:p.owner})),outcome:this.d.outcome};}
    choose(id){if(!C.stationShortStories.some(s=>s.id===id))throw Error('请用右上角选择另一支短片');return this.d.play({scenario:'visitor',shortFilm:id});}
    async openVideo(){if(this.comparison)return;const wasPaused=this.d.paused;this.d.pause();const root=document.createElement('section');root.className='st-film-comparison';root.innerHTML='<video controls playsinline></video><button>返回互动短片</button>';document.body.append(root);const video=root.querySelector('video');video.setAttribute('aria-label',this.title);this.comparison={root,video,wasPaused};root.querySelector('button').onclick=()=>{video.pause();root.remove();this.comparison=null;this.d.paused=wasPaused;};try{const path='assets/media/station-shorts/'+this.id+'.mp4',response=await fetch(path);if(!response.ok)throw Error();const url=URL.createObjectURL(await response.blob());if(this.disposed){URL.revokeObjectURL(url);return;}this.urls.add(url);video.src=url;video.play().catch(()=>{});}catch{root.querySelector('button').textContent='成片暂不可用 · 返回互动短片';}}
    dispose(){this.disposed=true;this.comparison?.video.pause();this.comparison?.root.remove();this.ui?.remove();this.branchController?.dispose?.();if(this.id==='zombie')C.stationShortZombie?.dispose?.(this);for(const a of [...this.actors,...this.robots])C.disposeModel(a.model);this.set.dispose();for(const g of new Set(this.geometries))g.dispose();for(const m of new Set(this.materials))m.dispose();for(const url of this.urls)URL.revokeObjectURL(url);if(!this.headless){this.s.v.controls.enabled=this.saved.controls;this.s.v.renderer.toneMappingExposure=this.saved.exposure;delete document.body.dataset.stationFilm;}this.d.stageActors=[];this.d.robot=null;}
  }
  C.StationShortFilm=StationShortFilm;
})();
