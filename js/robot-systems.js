/* Robot/stealth integration. The existing collaboration renderer owns every frame. */
(() => {
  'use strict';
  const L=window.IndoorLab,C=window.CoScene,$=id=>document.getElementById(id);
  const ordinary=sim=>!sim.world.microgravity&&(sim.world.root.name==='campus'||sim.world.root.name.startsWith('office-'));
  const context=sim=>({floor:sim.world.root.name==='campus'?1:Number(sim.world.root.name.slice(7)),location:sim.world.root.name==='campus'?'outside':'floor'});
  function prepare(sim,r){Object.assign(r,context(sim));r.root=r.model;r.height=r.model.userData.height||1.32;r.angle=r.model.rotation.y;r.contactOwner=sim;r.contactContext=sim;return r;}
  function installPartnerContacts(){
    const p=C.Simulation.prototype;if(p.robotSystemContacts)return;p.robotSystemContacts=true;
    const actors=p.actors,move=p.move,place=p.canPlace,free=p.freePoint,add=p.addRobot,remove=p.removeRobot,step=p.step;
    p.actors=function(){const own=actors.call(this);if(!ordinary(this))return own;const c=context(this);return own.concat(L.robotContacts.entries().filter(r=>r.contactOwner!==this&&r.location===c.location&&r.floor===c.floor));};
    p.canPlace=function(spec,point){if(!place.call(this,spec,point))return false;if(!ordinary(this))return true;return L.robotContacts.canPlace({...context(this),spec,radius:this.robotRadius(spec),height:1.4,angle:0},point.x,point.z);};
    p.freePoint=function(point,radius,exclude){const found=free.call(this,point,radius,exclude);if(!ordinary(this)||!found)return found;const candidate={...context(this),spec:exclude?.spec||{type:'delivery'},radius,height:exclude?.height||1.4,angle:0};const clear=q=>L.robotContacts.entries().every(r=>r!==exclude&&(!L.robotContacts.sameLevel(candidate,r)||L.robotContacts.gap(L.robotContacts.shape(candidate,q.x,q.z),L.robotContacts.shape(r))>=.025));if(clear(found))return found;let best=null,distance=Infinity;for(const i of this.grid.nav(radius).mainFree){const q=this.grid.point(i),d=(q.x-point.x)**2+(q.z-point.z)**2;if(d>=distance||this.actors().some(r=>r!==exclude&&Math.hypot(r.x-q.x,r.z-q.z)<r.radius+radius+.18)||!clear(q))continue;best=q;distance=d;}return best;};
    p.addRobot=function(...args){const result=add.apply(this,args);if(ordinary(this))prepare(this,result);L.robotContacts.invalidate();return result;};
    p.removeRobot=function(...args){const result=remove.apply(this,args);L.robotContacts.invalidate();return result;};
    p.move=function(a,dt,isRobot){if(ordinary(this)&&isRobot){prepare(this,a);if(a.balance){a.moving=false;return;}const q=a.path.find(q=>Math.hypot(q.x-a.x,q.z-a.z)>.001);if(q){const d=Math.hypot(q.x-a.x,q.z-a.z),amount=Math.min(d,a.speed*dt),x=a.x+(q.x-a.x)/d*amount,z=a.z+(q.z-a.z)/d*amount;if(!L.robotContacts.canMove(a,x,z)){a.moving=false;a.blockedTime=(a.blockedTime||0)+dt;a.status='等待机器人让行，保留当前任务';if(a.blockedTime>.7&&this.time>=(a.nextReplan||0)){a.nextReplan=this.time+1.2;this.go(a,a.goal||a.endpoint||q);}return;}}}return move.call(this,a,dt,isRobot);};
    p.step=function(dt){
      if(!ordinary(this))return step.call(this,dt);
      const all=this.robots,held=[];
      for(const r of all){prepare(this,r);const was=!!r.balance,state=r.balanceSaved?.state||r.state;const recovering=L.robotContacts.step(r,dt);
        if(recovering){if(!r.balanceSaved)r.balanceSaved={state,status:r.status,goal:r.goal||r.endpoint};r.status=r.state;r.state=r.balanceSaved.state;r.moving=false;r.startedAt+=dt;r.lastProgress+=dt;held.push(r);}
        else if(was||r.balanceSaved){const saved=r.balanceSaved;delete r.balanceSaved;r.state=saved?.state||state;r.speed=saved?.speed||r.speed;r.status='已站稳，继续原任务';if(saved?.goal)this.go(r,saved.goal);}
      }
      this.robots=all.filter(r=>!held.includes(r));
      try{step.call(this,dt);}finally{this.robots=all;for(const r of held){this.sync(r);C.animateRobot(r.model,r.phase,false,false,this.time);L.robotContacts.pose(r);}}
    };
  }
  class RobotSystems {
    constructor(b){
      this.b=b;this.environment=L.collaboration?.environment||'office';this.ready=false;
      L.robotArmy=new L.RobotArmy(b);L.robotDutyFleet=new L.DutyFleet(b);this.army=L.robotArmy;this.duty=L.robotDutyFleet;
      this.army.environment=this.duty.environment=this.environment;
      if(L.RobotConflict){L.robotConflict=new L.RobotConflict(b);L.robotConflict.ready=true;}if(L.RobotCargo)L.robotCargo=new L.RobotCargo();
      installPartnerContacts();
      if(L.OfficeRobots&&L.RobotModels){L.officeRobots=new L.OfficeRobots(b);this.legacy=L.officeRobots;this.legacy.environment=this.environment;}
      this.installUI();
      this.initializing=this.duty.initialize().then(()=>{for(const r of this.duty.robots)L.robotCargo?.attach(r);L.firstPersonMode=new L.FirstPersonMode(b);this.mode=L.firstPersonMode;this.ready=true;this.update(0,performance.now(),L.collaboration?.environment||'office',!!L.collaboration?.switching);this.syncPresentation();try{b.floorFocus?.warmInteriorObjects(this.duty.group);}catch(error){console.warn('办公机器人光照预热未完成',error);}return this;}).catch(error=>{this.error=error.message;this.duty.group.visible=false;this.army.toast('办公机器人准备未完成：'+error.message);return this;});
    }
    installUI(){
      const button=document.createElement('button');button.id='robot-army-open';button.className='co-action';button.textContent='机器人对抗实验';button.onclick=()=>{const panel=$('collaboration-panel');panel?.close();this.army.open();};
      const host=$('collaboration-panel');if(host)host.querySelector('.co-panel-actions')?.after(button);else document.body.append(button);this.armyButton=button;
      const library=document.createElement('button');library.id='robot-library-open';library.className='co-action';library.textContent='机器人库与生成';library.onclick=()=>{host?.close();L.robotLibrary?.open();};host?.querySelector('.co-panel-actions')?.append(library);this.libraryButton=library;
    }
    open(){return this.army.open();}
    update(dt,now=performance.now(),environment=L.collaboration?.environment||'office',switching=false){
      this.environment=environment;this.army.environment=this.duty.environment=environment;L.robotContacts.invalidate();
      const station=environment==='station',hidden=station||switching;
      this.armyButton.hidden=hidden;this.libraryButton.hidden=hidden;
      if(L.robotConflict)L.robotConflict.fx.group.visible=!hidden;if(L.robotCargo)L.robotCargo.fx.group.visible=!hidden;
      if(this.legacy){this.legacy.environment=environment;$('office-robots-options').hidden=hidden||environment!=='office';if(hidden||environment!=='office'){this.legacy.group.visible=false;this.legacy.dialog.close();$('robot-monitor').hidden=true;}}
      if(this.mode){this.mode.launchButton.hidden=hidden||this.mode.active;if(this.mode.buildingButton){this.mode.buildingButton.hidden=hidden||environment!=='office'||this.b.phase!=='overview'||this.mode.active;this.mode.buildingButton.disabled=this.mode.starting||!!(this.b.matrixLab?.active||this.b.matrixLab?.busy);}if((this.mode.active||this.mode.starting)&&environment!=='office'&&!switching)this.mode.stop(false);this.mode.cameraGroup.visible=!hidden&&environment==='office';$('exploration-hud').hidden=hidden||!this.mode.active;}
      if(hidden){L.robotLibrary?.close();this.army.group.visible=this.duty.group.visible=false;if(station){$('robot-army-panel')?.close();$('stealth-task-dialog')?.close();}return;}
      const running=!document.hidden&&(environment==='campus'?L.collaboration?.externalRunning:this.b.phase==='interior'?L.app.running:this.b.society.running)&&!this.b.matrixLab?.active&&!L.robotLibrary?.panel?.open&&!L.robotLibrary?.studio?.open;
      const seconds=running&&Number.isFinite(dt)?Math.max(0,dt):0;
      this.army.group.visible=true;this.duty.group.visible=environment==='office';
      const steps=Math.max(1,Math.ceil(seconds/.1)),step=seconds/steps;
      for(let i=0;i<steps;i++){L.robotConflict?.update(step,false,running);this.army.update(step,false,running);if(this.duty.ready)this.duty.update(step,false,running);if(this.legacy&&environment==='office'&&step)this.legacy.tick(step);this.mode?.update(step,now,false);L.robotCargo?.update(step,false);}
      this.framePending=true;this.frameNow=now;
    }
    presentFrame(){if(this.environment==='station'||L.collaboration?.switching||!this.framePending)return;this.framePending=false;this.army.draw();if(this.duty.ready)this.duty.draw();if(this.legacy&&this.environment==='office')this.legacy.draw();this.mode?.presentFrame(this.frameNow);L.robotConflict?.render();L.robotCargo?.render();}
    syncPresentation(){if(this.environment==='station'||L.collaboration?.switching)return;this.framePending=true;this.frameNow=performance.now();if(this.mode)this.mode.nextVisual=0;this.presentFrame();}
    async refreshLayout(){if(!this.ready)await this.initializing;L.robotConflict?.reset();L.robotCargo?.reset();this.b.reactions?.resetRobotDanger?.();this.mode?.refreshLayout();if(this.duty.ready)this.duty.refreshLayout();L.robotContacts.invalidate();this.syncPresentation();}
    reset({preserveCamera=false}={}){L.robotLibrary?.close();L.robotConflict?.reset();L.robotCargo?.reset();this.b.reactions?.resetRobotDanger?.();this.mode?.stop(false,{preserveCamera});this.army.clear({hostileOnly:false});this.duty.restoreDefaults();if(this.legacy)for(const r of this.legacy.robots)L.robotContacts.reset(r);L.robotContacts.invalidate();}
  }
  L.initializeRobotSystems=b=>L.robotSystems||(L.robotSystems=new RobotSystems(b));
})();
