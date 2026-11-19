/* Workday fleet uses the migrated rigs, independent of director-created attackers. */
(() => {
 'use strict';const L=window.IndoorLab,T=THREE;
 function DutyFleet(b){
  Object.assign(this,{b,v:b.view,app:L.app,robots:[],serial:0,time:0,shots:[],beams:[],batches:[],batchDirty:true,geometryKeys:new WeakMap(),pose:new T.Object3D(),stats:{bullet:0,laser:0,melee:0,hits:0,kills:0},routeBudget:5});
  this.group=new T.Group();this.group.name='默认办公机器人 · 巡检配送协作';this.group.userData.noAO=true;b.view.scene.add(this.group);this.virtual=new T.Group();this.virtual.visible=false;this.group.add(this.virtual);this.effects();this.observation=new L.RobotObservation(this);this.perception=new L.RobotPerception(this);this.refresh=()=>{};
 }
  Object.setPrototypeOf(DutyFleet.prototype,L.RobotArmy.prototype);
  DutyFleet.prototype.initialize=async function(){
   const presets=CoScene.presets;for(let floor=1;floor<=30;floor++){
    const types=floor<=3?['quadruped','humanoid','delivery']:[['quadruped','humanoid','delivery','carrier'][(floor-4)%4]];
    for(const type of types){const spec=presets.find(p=>p.type===type),r=await this.spawnOne({...spec},{floor,exterior:false,hostile:false,weapon:'auto',index:this.robots.length});r.turret.scale.setScalar(0);r.security=['quadruped','humanoid'].includes(type);r.visionRange=r.security?12:8;r.visionAngle=Math.PI*.65;r.duty={quadruped:'设施巡检',humanoid:'工位协作',delivery:'文件与茶水配送',carrier:'办公物资搬运'}[type];r.home={x:r.x,z:r.z,angle:r.angle};this.makeGoals(r);}
   }this.ready=true;this.update(0);
  };
  DutyFleet.prototype.makeGoals=function(r){const s=this.b.society,g=L.robotContacts.navigation(s.grid(r.floor)),nav=g.nav(r.radius),anchors=[{x:-9,z:4},{x:9,z:4},{x:0,z:9},{x:0,z:-5}];
   if(r.spec.type!=='quadruped')anchors.push(...s.model(r.floor).features.filter(p=>['print','coffee','reception'].includes(p.kind)),...s.model(r.floor).seats.slice(0,5).map(p=>p.approach||p));
   r.workPoints=[];for(const anchor of anchors){const i=g.nearest(anchor,r.radius,nav.largest);if(i>=0){const p=g.point(i);if(!r.workPoints.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<1))r.workPoints.push(p);}}
   r.workAt=r.id%Math.max(1,r.workPoints.length);r.workUntil=0;r.completed=0;
  };
  DutyFleet.prototype.restoreDefaults=function(){this.time=0;for(const r of this.robots){L.robotContacts.reset(r);Object.assign(r,r.home,{path:[],pathAt:0,repath:0,speed:0,distance:0,phase:0,trail:[],pursuit:null,workUntil:0,falls:0,recoveries:0});this.makeGoals(r);}this.observation.key=null;this.update(0);};
  DutyFleet.prototype.refreshLayout=function(){
   const s=this.b.society;for(const r of this.robots)r.alive=false;L.robotContacts.invalidate();
   for(const r of this.robots){const g=L.robotContacts.navigation(s.grid(r.floor)),free=g.nav(r.radius).mainFree,anchor=r.home||r;let spot=null,distance=Infinity;
    for(const i of free){const p=g.point(i),d=(p.x-anchor.x)**2+(p.z-anchor.z)**2;if(d>=distance||!L.robotContacts.canPlace(r,p.x,p.z)||s.agents.some(a=>a.location==='floor'&&Math.round(a.floor)===r.floor&&Math.hypot(a.x-p.x,a.z-p.z)<r.radius+.3))continue;spot=p;distance=d;}
    r.home=spot?{...spot,angle:r.angle}:null;r.alive=!!spot;r.dutyGrid=s.grid(r.floor);r.hiddenElapsed=0;r.memory=r.target=r.meleeTarget=r.stair=null;r.stairY=undefined;
    if(spot)Object.assign(r,spot);else r.state='新布局暂无可用部署空间';L.robotContacts.invalidate();
   }this.restoreDefaults();
  };
  DutyFleet.prototype.move=function(r,goal,dt){const distance=Math.hypot(goal.x-r.x,goal.z-r.z)||1,step=Math.min(distance,dt*1.55),next={x:r.x+(goal.x-r.x)/distance*step,z:r.z+(goal.z-r.z)/distance*step};
   const occupied=this.b.society.agents.some(a=>a.location==='floor'&&Math.round(a.floor)===r.floor&&a.health!=='dead'&&!(a.isPlayer&&r.pursuit)&&Math.hypot(a.x-next.x,a.z-next.z)<r.radius+.32&&Math.hypot(a.x-next.x,a.z-next.z)<Math.hypot(a.x-r.x,a.z-r.z));
   if(occupied){r.speed=0;r.state='停车让行，等待通道净空';return;}L.RobotArmy.prototype.move.call(this,r,goal,dt*.45);
  };
  DutyFleet.prototype.update=function(dt,present=true,running=this.b.society.running){const s=this.b.society,run=dt>0&&running&&!this.b.matrixLab?.active;this.routeBudget=5;if(run)this.time+=dt;
   for(const r of this.robots){if(r.alive===false)continue;const visible=this.isVisible(r);r.hiddenElapsed=(r.hiddenElapsed||0)+dt;const stepDt=visible?dt:r.hiddenElapsed>=.15?r.hiddenElapsed:0;if(!visible&&stepDt===0)continue;r.hiddenElapsed=0;if(r.dutyGrid!==s.grid(r.floor)){r.dutyGrid=s.grid(r.floor);r.path=[];r.repath=0;this.makeGoals(r);}const broken=L.disasterDirector?.physics?.destroyedFloors.has(r.floor)||L.disasterDirector?.physics?.collapseComplete;
    const recovering=L.robotContacts.step(r,run&&!broken?stepDt:0);
    if(run&&!broken&&!recovering){const managed=L.robotConflict?.control(r,this,stepDt);if(!managed){
     const chase=r.security&&L.firstPersonMode?.mode==='mission'&&L.firstPersonMode.state==='active'&&r.pursuit;
     if(chase&&this.time-r.pursuit.at<7){r.state='识别未授权人员，前往最后发现处';this.move(r,r.pursuit,stepDt);}
     else{r.pursuit=null;const goal=r.workPoints[r.workAt];if(this.time<r.workUntil){r.speed=0;r.state=r.duty+' · 作业中';if(r.spec.type==='humanoid')r.root.userData.dutyArm=Math.sin(this.time*2)*.15;}
      else if(goal){r.state=r.duty+' · 执行工作路线';if(Math.hypot(goal.x-r.x,goal.z-r.z)<.55){r.workUntil=this.time+3+(r.id%4);r.workAt=(r.workAt+1)%r.workPoints.length;r.completed++;r.path=[];r.repath=0;}else this.move(r,goal,stepDt);}
     }
    }}else r.speed=0;
    if(visible){this.animate(r);if(!recovering&&r.spec.type==='humanoid'&&this.time<r.workUntil){const joints=r.root.userData.joints||{};const descriptors=r.root.userData.jointDescriptors||[];for(const name of ['right_elbow_joint','left_elbow_joint']){const j=joints[name],d=descriptors.find(d=>d.name===name);if(j&&d)j.quaternion.copy(j.userData.baseQuaternion).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(...d.axis),.55+Math.sin(this.time*2)*.18));}}
    r.worldBase=r.stairY??(r.floor-1)*3.6;this.observation.record(r);}
   }if(present)this.draw();
  };
  L.DutyFleet=DutyFleet;
})();
