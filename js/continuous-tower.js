/* One persistent, connected tower. Floor changes only move the floating origin. */
(() => {
  'use strict';const L=window.IndoorLab,$=id=>document.getElementById(id);
  class ContinuousTower {
    constructor(journey){
      this.journey=journey;this.building=journey.building;this.view=journey.view;this.society=journey.society;this.fp=journey.firstPerson;this.active=false;this.origin=1;this.stair=null;
      this.root=new THREE.Group();this.root.name='连续的 30 层室内';this.root.visible=false;this.view.scene.add(this.root);this.models=[];
      this.people=new THREE.Group();this.people.userData.noAO=true;this.root.add(this.people);this.renderer=new L.CrowdRenderer(this.people,new Array(640));
      this.cars=[journey.cabin.clone(true),journey.cabin.clone(true)];this.cars.forEach(c=>{c.visible=true;this.root.add(c);});
      const oldView=this.view.setView.bind(this.view);this.view.setView=mode=>{if(mode!=='walk'&&this.active)this.leave();oldView(mode);if(mode==='walk'&&this.view.model?.towerFloor)this.enter();};
      const oldWalk=this.view.updateWalk.bind(this.view);this.view.updateWalk=dt=>this.active?this.step(dt):oldWalk(dt);
      const oldContext=journey.updateContext.bind(journey);journey.updateContext=()=>{if(this.view.view==='walk'&&this.building.phase==='interior'){if(!this.active)this.enter();return;}if(this.active)this.leave();oldContext();};
      const oldInteract=journey.interact.bind(journey);journey.interact=action=>this.active?this.interact(action):oldInteract(action);
      const oldEnter=this.building.enterFloor.bind(this.building);this.building.enterFloor=async f=>{if(this.active){this.leave();this.view.setView('perspective');}return oldEnter(f);};
      const oldClear=this.fp.clear.bind(this.fp);this.fp.clear=(x,z)=>this.active?this.clear(x,z,oldClear):oldClear(x,z);
      this.worldWalk=new L.TowerWorld(this);journey.continuous=this;L.continuousTower=this;
    }
    build(){if(this.models.length)return;const shaft=new THREE.Group();shaft.name='连续楼梯井围护';const shaftMat=new THREE.MeshStandardMaterial({color:'#e9edf0',roughness:.9,side:THREE.DoubleSide});for(const s of L.TOWER.core.stairs){const sign=Math.sign(s.x);for(const [w,d,x,z]of [[4.24,.04,s.x,-3.61],[4.24,.04,s.x,3.61],[.04,7.25,sign*16.61,0]]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,108,d),shaftMat);mesh.position.set(x,52.2,z);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.structural=true;mesh.userData.ignoreCollision=true;shaft.add(mesh);}}this.root.add(shaft);this.shaft=shaft;const ceilingMat=new THREE.MeshStandardMaterial({color:'#edf1f4',roughness:.9}),pose=new THREE.Object3D();
      for(let f=1;f<=30;f++){const model=L.makeTowerFloor(f,{preview:true,shell:true,connected:true});model.group.name=`continuous-${f}F`;model.group.userData.continuousFloor=f;
        const ceiling=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),ceilingMat,L.towerSlabTiles.length);ceiling.name='连续楼层天花板';ceiling.userData.ceiling=true;ceiling.receiveShadow=true;ceiling.frustumCulled=false;
        // Keep ceiling side faces behind the facade band; shared interior tile joins stay exact.
        L.towerSlabTiles.forEach(([w,d,x,z],i)=>{const left=Math.max(-17.92,x-w/2),right=Math.min(17.92,x+w/2),back=Math.max(-12.92,z-d/2),front=Math.min(12.92,z+d/2);pose.position.set((left+right)/2,3.31,(back+front)/2);pose.scale.set(right-left,.14,front-back);pose.updateMatrix();ceiling.setMatrixAt(i,pose.matrix);});model.group.add(ceiling);
        // Full-height partitions meet the ceiling in first-person mode.
        model.group.traverse(o=>{if(!o.isInstancedMesh||!o.userData.wall)return;const m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);m.decompose(p,q,s);if(s.y>2.6&&s.y<3){const glass=o.name==='glass';p.y=glass?1.66:1.635;s.y=glass?3.24:3.27;m.compose(p,q,s);o.setMatrixAt(i,m);}}o.instanceMatrix.needsUpdate=true;});
        for(const b of [...model.layoutItems,...(model.shellItems||[])])if(b.wall&&b.h>2.6&&b.h<3){b.originalY=b.y;b.originalH=b.h;b.y=b.key==='glass'?1.66:1.635;b.h=b.key==='glass'?3.24:3.27;}
        this.building.applyThemeToFloor(model);const previousModel=this.view.model;this.view.model=model;this.view.pipeline.setStyle(this.view.pipeline.style);this.view.model=previousModel;this.models.push(model);this.root.add(model.group);
      }
    }
    createPlayer(){if(this.player)return this.player;const a=this.society.makeAgent(this.building.selected,null,'player');Object.assign(a,{name:'玩家',job:'逃生者',isPlayer:true,manualLift:true,health:'healthy',zombieControlled:true,activity:'player',action:'探索办公楼',pose:'stand',sitBlend:0,seatId:null,homeSeat:null,until:Infinity,appearance:{gender:'female',height:1,build:1,hair:1,outfit:1},x:0,z:this.building.selected===1?9:3.9});this.player=a;this.society.count=this.society.agents.length;this.society.initialIds=this.society.agents.map(a=>a.id).join(',');return a;}
    enter(){if(this.active)return;this.build();this.original={model:this.view.model,grid:this.view.grid,bounds:this.view.bounds,worldY:this.building.world.position.y,cameraFar:this.view.camera.far};this.active=true;const p=this.createPlayer();this.origin=L.clamp(Math.round(this.building.selected),1,30);this.spawnFloor=this.origin;p.floor=this.origin;p.location='floor';p.x=0;p.z=this.origin===1?9:3.9;this.fp.reset();this.building.mix=0;this.building.exploded=false;this.building.drawerFloor=null;for(const [i,plate]of this.building.plates.entries()){plate.drawer=0;plate.group.position.set(0,i*3.6,0);}this.building.crown.visible=true;for(const plate of this.building.plates)plate.tag.visible=false;this.building.selection.visible=false;this.building.drawerGuide.visible=false;this.building.updateTowerBatches(true);this.journey.context.visible=false;this.journey.cabin.visible=false;this.switchFloor(this.origin,false);this.view.camera.position.set(p.x,1.65,p.z);this.view.walkYaw=Math.PI;this.view.walkPitch=0;this.root.visible=true;this.society.bodies.rebuild();this.building.app.play(true);document.body.dataset.continuousTower='true';this.update();}
    leave(){if(!this.active)return;this.active=false;this.society.zombie?.air?.hide();this.root.visible=false;this.stair=null;this.exitCar();this.view.model=this.original.model;this.view.grid=this.society.grid(this.original.model.towerFloor);this.view.bounds=this.original.bounds;this.view.model.group.visible=true;this.view.avatarGroup.visible=true;this.building.selected=this.original.model.towerFloor;if(this.building.app.simulation.isOfficeSociety)this.building.app.simulation.floor=this.building.selected;this.building.world.visible=false;this.building.tower.visible=true;this.building.world.position.y=this.original.worldY;this.journey.panel.hidden=true;this.view.pipeline._aoExcluded=null;document.body.dataset.continuousTower='false';this.view.camera.near=.05;this.view.camera.far=this.original.cameraFar;this.view.camera.updateProjectionMatrix();this.view.pipeline.immersive.update();if(this.combat){this.combat.hands.visible=false;this.combat.hitStop=0;this.combat.current=null;this.combat.queue=[];}}
    switchFloor(f,preserve=true){f=L.clamp(Math.round(f),1,30);if(preserve)this.view.camera.position.y+=(this.origin-f)*3.6;this.origin=f;if(this.shaft)this.shaft.position.y=-(f-1)*3.6;this.building.selected=f;this.view.model=this.models[f-1];this.view.grid=this.society.grid(f);this.view.bounds=this.view.model.bounds;if(this.building.app.simulation.isOfficeSociety)this.building.app.simulation.floor=f;this.view.camera.near=.04;this.view.camera.far=1600;this.view.camera.updateProjectionMatrix();for(let i=0;i<30;i++)this.models[i].group.position.y=(i+1-f)*3.6;this.building.world.position.y=-(f-1)*3.6-.82;if($('interior-floor-label'))$('interior-floor-label').textContent=`SPATIAL SIMULATION / ${String(f).padStart(2,'0')}F`;$('interior-floor-select').value=String(f);this.fp.collisionModel=null;this.view.pipeline._aoExcluded=null;this.view.shadowDirty=true;}
    update(){if(!this.active)return;const b=this.building,v=this.view,s=this.society;
      document.body.dataset.journeyView='walk';
      this.original.model.group.visible=false;v.avatarGroup.visible=false;v.goalGroup.visible=false;v.heatGroup.visible=false;v.overlayGroup.visible=false;v.contextGrid.visible=false;v.ground.visible=false;if(v.gridLines)v.gridLines.visible=false;if(v.contactShadow)v.contactShadow.visible=false;if(v.agentBubbles?.group)v.agentBubbles.group.visible=false;
      const outside=this.worldWalk.outside,nearStairs=Math.abs(v.camera.position.x)>10.5&&Math.abs(v.camera.position.z)<4.2,visibleRadius=nearStairs?1:0;b.world.visible=true;b.tower.visible=outside;for(const plate of b.plates)plate.tag.visible=false;const depthFar=outside?1600:180;if(v.camera.far!==depthFar){v.camera.far=depthFar;v.camera.updateProjectionMatrix();}if(outside!==this.wasOutside){this.wasOutside=outside;v.pipeline._aoExcluded=null;v.shadowDirty=true;}b.updateTowerBatches();v.scene.fog.near=650;v.scene.fog.far=1500;b.societyPeople.visible=false;b.liftVisuals.forEach(o=>o.visible=false);b.siteCrowd.update(0);this.root.visible=true;
      for(let i=0;i<30;i++){const model=this.models[i];model.group.visible=Math.abs(i+1-this.origin)<=visibleRadius;model.setElevators(s.lifts.cars.map(c=>s.renderCar(c)));}
      this.cars.forEach((group,i)=>{const c=s.renderCar(s.lifts.cars[i]);group.position.set(c.x,(c.floor-this.origin)*3.6,0);group.visible=i===this.carIndex||Math.abs(c.floor-this.origin)<3;const doors=group.children.slice(-2);doors.forEach((d,j)=>d.position.x=(j?1:-1)*(.65+c.door*1.3));});
      const agents=[];for(const source of s.agents){const a=s.renderAgent(source);if(a.isPlayer||a.location==='escaped'||L.isOutdoorAgent(a)||L.disasterDirector?.physics?.destroyedFloors.has(Math.round(a.floor)))continue;const y=a.absoluteY??((a.floor-1)*3.6);if(Math.abs(y/3.6+1-this.origin)>visibleRadius+.8)continue;agents.push({...a,baseY:y-(this.origin-1)*3.6});}this.renderer.update(agents,s.time+s.accumulator);v.observation.update(agents,s.time+s.accumulator);
      s.zombie?.air?.draw(this);this.updatePanel();this.fp.refreshHUD();this.combat?.updateUI();
    }
    clear(x,z,original){const p=this.player;if(p&&this.society.bodies.blocks(p,x,z,this.worldWalk.absoluteFeet(),true,this.view.camera.position))return false;const car=this.carIndex===undefined?null:this.society.lifts.cars[this.carIndex];
      if(p?.location!=='lift'&&z<2.5&&z>1.7&&this.society.lifts.cars.some(c=>Math.abs(c.floor-this.origin)<.02&&Math.abs(x-c.x)<.95&&c.passengers.length>=c.capacity))return false;
      if(p?.location==='lift'&&car){const door=car.door>.95&&Math.abs(car.floor-Math.round(car.floor))<.015;if(Math.abs(x-car.x)<1.02&&z>-1.85&&z<1.9)return true;if(!door)return false;if(Math.abs(x-car.x)<.59&&z>1.8&&z<2.65)return true;}
      if(this.origin===1&&Math.abs(x)<2.8&&z>12&&z<24)return !this.combat?.physics?.blocks(x,z,this.fp.feet);
      if(this.combat?.physics?.blocks(x,z,this.fp.feet))return false;
      return original(x,z);
    }
    syncPresentation(){
      this.update();
      if(this.presentationOrigin!==this.origin||this.presentationOutside!==this.worldWalk.outside){
        this.presentationOrigin=this.origin;this.presentationOutside=this.worldWalk.outside;
        // These renderers run outside the movement wrapper. Rebase their
        // absolute-world geometry in this frame, not on the next animation tick.
        L.robotSystems?.syncPresentation();L.megastructureFleet?.syncFrame();
      }
    }
    step(dt){if(!this.active)return;try{const p=this.player,v=this.view,s=this.society;if(this.combat?.hitStop>0){this.combat.update(dt);this.fp.look();return;}
      if(['grabbed','turning','zombie','dead'].includes(p.health)){this.fp.velocity.set(0,0);v.walkKeys.clear();this.combat?.update(dt);this.fp.look();this.updatePlayer();return;}
      if(this.stair){const tr=this.stair,input=this.fp.onPath(dt),sample=L.sampleTowerStair(tr.side,tr.direction>0?tr.progress:1-tr.progress),heading=sample.angle+(tr.direction>0?0:Math.PI),speed=this.fp.locked?this.fp.velocity.x*Math.sin(heading)+this.fp.velocity.y*Math.cos(heading):input.forward*this.fp.speed;const next=L.clamp(tr.progress+speed*dt/tr.length,0,1),probe=L.sampleTowerStair(tr.side,tr.direction>0?next:1-next),base=(Math.min(tr.from,tr.to)-1)*3.6;
        if(!s.bodies.blocks(p,probe.x,probe.z,base+probe.y+this.fp.feet,true,v.camera.position))tr.progress=next;
        const a=L.sampleTowerStair(tr.side,tr.direction>0?tr.progress:1-tr.progress);v.camera.position.set(a.x,(Math.min(tr.from,tr.to)-this.origin)*3.6+a.y+(this.fp.eyeHeight||1.65)+this.fp.feet+this.fp.bob-this.fp.landing,a.z);
        if(!this.fp.locked&&input.forward){const angle=a.angle+(tr.direction>0?0:Math.PI),da=Math.atan2(Math.sin(angle-v.walkYaw),Math.cos(angle-v.walkYaw));v.walkYaw+=da*Math.min(1,dt*6);}
        p.absoluteY=(Math.min(tr.from,tr.to)-1)*3.6+a.y+this.fp.feet;p.location='stairs';p.stair=tr;
        if(tr.progress===1){this.stair=null;this.switchFloor(tr.to,true);p.floor=tr.to;p.location='floor';delete p.absoluteY;p.stair=null;}else if(tr.progress===0&&speed<0){this.stair=null;p.location='floor';delete p.absoluteY;p.stair=null;}
      }else{const car=this.carIndex===undefined?null:s.lifts.cars[this.carIndex];if(car&&p.location==='lift'){const floor=Math.round(s.renderCar(car).floor);if(car.door>.95&&Math.abs(car.floor-floor)<.02&&floor!==this.origin){const delta=(this.origin-floor)*3.6;this.switchFloor(floor,true);this.fp.feet+=delta;}}this.worldWalk.update(dt);
        if(p.location!=='lift'){for(const c of s.lifts.cars)if(c.door>.95&&Math.abs(c.floor-this.origin)<.02&&Math.abs(v.camera.position.x-c.x)<1&&v.camera.position.z<1.95&&v.camera.position.z>-1.85){this.carIndex=c.id;this.worldWalk.rideY=(s.renderCar(c).floor-1)*3.6;p.location='lift';p.liftStage='riding';p.liftTo=null;p.manualLift=true;if(!c.passengers.includes(p)&&c.passengers.length<c.capacity)c.passengers.push(p);else if(!c.passengers.includes(p)){p.location='floor';this.carIndex=undefined;}break;}}
        else if(car&&car.door>.95&&Math.abs(car.floor-Math.round(car.floor))<.02&&v.camera.position.z>2.6){const f=Math.round(car.floor),delta=(this.origin-f)*3.6;this.exitCar();this.switchFloor(f,true);this.fp.feet+=delta;}
      }
      this.updatePlayer();this.combat?.update(dt);this.fp.look();
      }finally{this.syncPresentation();}
    }
    updatePlayer(){const p=this.player,v=this.view;if(!p)return;p.x=v.camera.position.x;p.z=v.camera.position.z;p.angle=v.walkYaw;p.floor=p.location==='lift'?this.society.lifts.cars[this.carIndex]?.floor||this.origin:this.stair?.from||this.origin;p.vx=this.fp.velocity.x;p.vz=this.fp.velocity.y;p.state=this.fp.speed>.1?'moving':'waiting';p.pose=this.fp.crouched?'crouch':'stand';p.feetY=(this.origin-1)*3.6+v.camera.position.y-(this.fp.eyeHeight||1.65);}
    exitCar(){if(this.carIndex!==undefined&&this.player){const c=this.society.lifts.cars[this.carIndex];c.passengers=c.passengers.filter(a=>a!==this.player);this.player.location='floor';this.player.liftStage=null;this.player.liftTo=null;}this.carIndex=undefined;this.worldWalk.rideY=undefined;}
    startStairs(side,direction){
      if(this.stair||this.player.location==='lift')return;
      const to=this.origin+direction;if(to<1||to>30)return;
      const p=L.sampleTowerStair(side,direction>0?0:1),from=this.view.camera.position;
      if(!this.society.grid(this.origin).lineClear(from,p,.24)||L.crossesClosedRoomDoor(this.view.model,from,p)||this.society.bodies.blocks(this.player,p.x,p.z,(this.origin-1)*3.6,true,from))return;
      this.stair={side,direction,from:this.origin,to,progress:0,length:p.length};this.fp.reset();from.set(p.x,1.65,p.z);this.view.walkYaw=p.angle+(direction>0?0:Math.PI);this.view.walkPitch=-.2;
    }
    aimedRoomDoor(){
      if(!this.active||this.stair||this.worldWalk.outside||this.player.location==='lift')return null;
      const v=this.view,cos=Math.cos(v.walkPitch),direction=new THREE.Vector3(Math.sin(v.walkYaw)*cos,Math.sin(v.walkPitch),Math.cos(v.walkYaw)*cos);
      return L.roomDoorAt(v.model,new THREE.Ray(v.camera.position,direction),2.9);
    }
    useRoomDoor(){
      if(this.player?.health!=='healthy'&&this.player?.health!=='escaped')return false;
      const door=this.aimedRoomDoor();if(!door)return false;
      this.doorBlockedUntil=this.society.toggleRoomDoor(this.origin,door.id)?0:performance.now()+1500;return true;
    }
    interact(){if(!this.active)return false;const p=this.view.camera.position,s=this.society;if(this.stair||this.useRoomDoor())return true;
      if(this.player.location==='lift'){if(s.lifts.unavailable)return true;const car=s.lifts.cars[this.carIndex],to=Number($('journey-target')?.value||this.origin);if(car&&Number.isInteger(to)&&to>=1&&to<=30&&to!==Math.round(car.floor)){car.manualDestination=to;car.manualHoldUntil=s.time;car.timer=5;this.building.app.play(true);s.running=true;}return true;}
      const side=L.TOWER.core.stairs.findIndex(a=>Math.hypot(a.entry.x-p.x,a.entry.z-p.z)<2.25);if(side>=0){this.startStairs(side,this.origin===30||this.origin>1&&this.view.walkPitch<-.28?-1:1);return true;}
      if(Math.abs(p.x)<3.1&&p.z>2.3&&p.z<5.8){if(s.lifts.unavailable)return false;const car=s.lifts.cars[p.x>0?1:0];car.manualPickup=this.origin;car.manualHoldUntil=s.time+12;if(Math.abs(car.floor-this.origin)<.02&&car.state==='closing')car.state='opening';return true;}return false;
    }
    updatePanel(){const p=this.view.camera.position,inside=this.player.location==='lift',side=L.TOWER.core.stairs.findIndex(a=>Math.hypot(a.entry.x-p.x,a.entry.z-p.z)<2.25),near=Math.abs(p.x)<3.1&&p.z>2.3&&p.z<5.8,key=this.stair?'stairs-trip':inside?'car:'+this.carIndex:side>=0?'stairs:'+side+':'+this.origin:near?'call:'+this.origin:'walk:'+this.origin;
      this.journey.panel.hidden=false;this.journey.panel.dataset.lift=String(inside);this.journey.context.visible=false;this.journey.cabin.visible=false;if(this.panelKey!==key){this.panelKey=key;const actions=$('journey-actions');actions.onclick=null;actions.innerHTML='';if(inside){$('journey-title').textContent=`${this.carIndex?'B':'A'} 梯 · 轿厢内选层`;actions.innerHTML='<label>目的楼层 <select id="journey-target" aria-label="轿厢内选择停靠楼层">'+Array.from({length:30},(_,i)=>`<option value="${i+1}" ${i+1===(this.origin<30?this.origin+1:1)?'selected':''}>${i+1}F</option>`).join('')+'</select></label><button type="button" id="journey-go">确认前往</button>';actions.onclick=e=>{if(e.target.closest('#journey-go'))this.interact();};}
        else if(this.stair)$('journey-title').textContent=`${this.stair.from}F → ${this.stair.to}F · 楼梯`;
        else if(side>=0)$('journey-title').textContent=`${this.origin}F · 楼梯 ${side?'B':'A'}`;
        else if(near)$('journey-title').textContent=`${this.origin}F · 电梯厅`;
        else $('journey-title').textContent=`${this.origin}F · ${this.society.zombie?.active?'逃离办公楼':'连续漫游'}`;
      }
      const door=this.aimedRoomDoor();
      if($('journey-target'))$('journey-target').disabled=false;if($('journey-go'))$('journey-go').disabled=false;
      if(!door&&(near||inside)&&this.society.lifts.unavailable){$('journey-status').textContent='电梯停用，请使用楼梯；轿厢中的乘员等待就近停靠后出梯。';if($('journey-target'))$('journey-target').disabled=true;if($('journey-go'))$('journey-go').disabled=true;return;}
      $('journey-status').textContent=door?(door.name+(performance.now()<this.doorBlockedUntil?' · 门口有人，稍后再关':' · E '+(door.open?'关门':'开门'))):this.stair?'沿阶梯转弯前进 · Shift 奔跑 · 空格跳跃':inside?`当前 ${this.society.renderCar(this.society.lifts.cars[this.carIndex]).floor.toFixed(1)}F · 目标 ${this.society.lifts.cars[this.carIndex].manualDestination||$('journey-target')?.value||this.origin}F · 滚轮选层，E 确认；也可按 Esc 后点击选层并确认前往。`:side>=0?'沿实体台阶行走 · E 引导上楼，低头按 E 下楼':near?'E 呼梯。等待开门后，向前走进轿厢。':this.society.zombie?.active?'目标：到达 1F，穿过主入口，逃出大厅之外。':'所有楼层在同一场景中，楼梯与电梯连续相接。';
    }
  }
  L.ContinuousTower=ContinuousTower;
})();
