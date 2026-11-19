/* Walkable vertical circulation shares the society's stair geometry and lift controller. */
(() => {
  'use strict';const L=window.IndoorLab,$=id=>document.getElementById(id);
  class TowerJourney {
    constructor(building){
      this.building=building;this.view=building.view;this.society=building.society;this.trip=null;this.changing=false;this.firstPerson=new L.FirstPersonController(this.view);
      this.context=new THREE.Group();this.context.name='相邻楼层与跨层人群';this.context.userData.ignoreCollision=true;this.view.scene.add(this.context);
      this.people=new THREE.Group();this.context.add(this.people);this.crowd=new L.CrowdRenderer(this.people,this.society.agents);
      this.cabin=new THREE.Group();this.cabin.name='观察者乘坐的电梯轿厢';this.view.scene.add(this.cabin);const cabinMat=new THREE.MeshStandardMaterial({color:'#b9cbd9',roughness:.44,metalness:.35}),floorMat=new THREE.MeshStandardMaterial({color:'#e4ebf1',roughness:.8});
      for(const [w,h,d,x,y,z]of [[2.65,.12,4.25,0,-.06,0],[2.65,.08,4.25,0,2.65,0],[.06,2.65,4.25,-1.3,1.325,0],[.06,2.65,4.25,1.3,1.325,0],[2.65,2.65,.06,0,1.325,-2.1]]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),y<0?floorMat:cabinMat);mesh.position.set(x,y,z);this.cabin.add(mesh);}
      const doorMat=cabinMat.clone();doorMat.userData.officeRole='doorPanel';
      this.cabinDoors=[-1,1].map(sign=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(1.3,2.65,.06),doorMat);mesh.position.set(sign*.65,1.325,2.13);this.cabin.add(mesh);return mesh;});this.cabin.visible=false;
      const panel=document.createElement('aside');panel.id='journey-panel';panel.hidden=true;panel.innerHTML='<b id="journey-title"></b><p id="journey-status"></p><div id="journey-actions"></div><small>WASD 移动 · 按住左键转头 · 楼梯上 W 前进 / S 后退</small>';document.body.appendChild(panel);this.panel=panel;
      this.panel.addEventListener('click',e=>{const b=e.target.closest('[data-journey]');if(!b)return;const action=b.dataset.journey;if(action==='stairs')this.startStairs(Number(b.dataset.side),Number(b.dataset.direction));if(action==='lift')this.callLift(Number($('journey-target').value));if(action==='cancel')this.cancel();});
      const original=this.view.updateWalk.bind(this.view);this.view.updateWalk=dt=>{if(this.building.phase!=='interior'||!this.view.model.towerFloor)return original(dt);if(this.changing)return;if(this.trip){this.firstPerson.onPath(dt);this.move(dt);if(this.trip)this.view.camera.position.y+=this.firstPerson.feet+this.firstPerson.bob-this.firstPerson.landing;}else original(dt);this.look();};
    }
    look(){if(this.firstPerson)return this.firstPerson.look();const v=this.view,p=v.camera.position;v.camera.lookAt(p.x+Math.sin(v.walkYaw)*Math.cos(v.walkPitch),p.y+Math.sin(v.walkPitch),p.z+Math.cos(v.walkYaw)*Math.cos(v.walkPitch));}
    interact(action='use'){
      if(L.collaboration?.environment==='station')return L.collaboration.stationExperience.interact();
      if(L.collaboration?.environment==='campus')return false;
      if(this.view.view!=='walk'||this.changing)return false;if(this.trip)return true;const p=this.view.camera.position,stair=L.TOWER.core.stairs.findIndex(s=>Math.hypot(p.x-s.entry.x,p.z)<2.5);
      if(stair>=0){this.startStairs(stair,action==='down'||this.building.selected===30?-1:1);return true;}
      if(Math.abs(p.x)<3.2&&p.z>2.3&&p.z<5.8&&action==='use'){this.callLift(Number($('journey-target')?.value||(this.building.selected<30?this.building.selected+1:29)));return true;}return false;
    }
    async changeFloor(floor,{x,z,yaw=this.view.walkYaw,mode='walk',id=-1}={}){
      const held=[...this.view.walkKeys],pitch=this.view.walkPitch,motion={feet:this.firstPerson.feet,verticalSpeed:this.firstPerson.verticalSpeed,grounded:this.firstPerson.grounded,bob:this.firstPerson.bob,landing:this.firstPerson.landing},velocity=this.firstPerson.velocity.clone();this.changing=true;
      try{await this.building.enterFloor(floor);if(this.view.model.towerFloor!==floor)throw Error('未能进入目标楼层');this.view.setView(mode);this.view.selected=id;if(mode==='walk'){Object.assign(this.firstPerson,motion);this.firstPerson.velocity.copy(velocity);}this.view.camera.position.set(x,1.65+(mode==='walk'?motion.feet+motion.bob-motion.landing:0),z);this.view.walkYaw=yaw;this.view.walkPitch=pitch;if(this.firstPerson.locked)for(const key of held)this.view.walkKeys.add(key);this.view.walkClock=performance.now();this.look();}finally{this.changing=false;this.contextFloor=null;}
    }
    startStairs(side,direction){
      if(this.trip||this.changing)return;const from=this.building.selected,to=from+direction,s=L.TOWER.core.stairs[side];if(to<1||to>30||Math.hypot(this.view.camera.position.x-s.entry.x,this.view.camera.position.z)>2.5)return;
      const path=L.sampleTowerStair(side,direction>0?0:1);this.trip={kind:'stairs',side,direction,from,to,progress:0,length:path.length};this.firstPerson.reset();this.view.camera.position.set(path.x,1.65,path.z);this.view.walkYaw=path.angle+(direction>0?0:Math.PI);this.view.walkPitch=-.25;this.view.walkKeys.clear();this.lastSignature=null;
    }
    callLift(to){if(this.society.lifts.unavailable)return false;
      if(this.trip||this.changing||to===this.building.selected||to<1||to>30)return;const v=this.view,p=v.camera.position;if(Math.abs(p.x)>3.2||p.z<2.3||p.z>5.8)return;const from=this.building.selected;
      const a={id:-900,name:'第一人称观察者',isPlayer:true,type:'pedestrian',profile:L.PROFILES.pedestrian,appearance:{gender:'male'},floor:from,location:'floor',x:p.x,z:p.z,angle:Math.PI,pose:'stand',state:'waiting',activity:'lift-queue',action:'等电梯',trail:[]};
      this.society.lifts.request(a,to);const q=a.liftRequest;q.car=p.x>0?1:0;a.x=this.society.lifts.cars[q.car].x;a.z=3.65;
      this.trip={kind:'lift',from,to,agent:a,car:q.car};this.view.walkKeys.clear();this.building.app.play(true);this.lastSignature=null;
    }
    move(dt){
      const tr=this.trip,v=this.view;if(tr.kind==='stairs'){
        const input=this.firstPerson.input(),sample=L.sampleTowerStair(tr.side,tr.direction>0?tr.progress:1-tr.progress),heading=sample.angle+(tr.direction>0?0:Math.PI),forward=this.firstPerson.locked?(this.firstPerson.velocity.x*Math.sin(heading)+this.firstPerson.velocity.y*Math.cos(heading)):input.forward*this.firstPerson.speed;
        tr.progress=L.clamp(tr.progress+forward*dt/tr.length,0,1);const p=L.sampleTowerStair(tr.side,tr.direction>0?tr.progress:1-tr.progress),base=(Math.min(tr.from,tr.to)-tr.from)*3.6;
        v.camera.position.set(p.x,base+p.y+1.65,p.z);if(forward&&!this.firstPerson.locked){const angle=p.angle+(tr.direction>0?0:Math.PI),delta=Math.atan2(Math.sin(angle-v.walkYaw),Math.cos(angle-v.walkYaw));v.walkYaw+=delta*Math.min(1,dt*5);}
        if(tr.progress===1){this.trip=null;if(!this.firstPerson.locked)v.walkKeys.clear();this.changeFloor(tr.to,{x:p.x,z:p.z});}
        else if(tr.progress===0&&forward<0)this.cancel();
      }else{
        const a=this.society.renderAgent(tr.agent),c=this.society.renderCar(this.society.lifts.cars[tr.car]);v.camera.position.set(a.x,(a.location==='lift'?c.floor-tr.from:0)*3.6+1.65,a.z);
        if(a.location==='floor'&&!a.liftRequest){this.trip=null;this.changeFloor(Math.round(a.floor),{x:a.x,z:a.z,yaw:0});}
      }
    }
    cancel(){
      const tr=this.trip;if(tr?.kind==='lift'){
        this.society.lifts.calls=this.society.lifts.calls.filter(q=>q.agent!==tr.agent);for(const c of this.society.lifts.cars)c.passengers=c.passengers.filter(a=>a!==tr.agent);
      }
      if(tr?.kind==='stairs')this.view.camera.position.set(L.TOWER.core.stairs[tr.side].entry.x,1.65,0);
      this.trip=null;this.lastSignature=null;this.context.visible=false;this.cabin.visible=false;this.panel.hidden=true;this.view.walkKeys.clear();
    }
    rebuildContext(floors,origin){
      const key=origin+':'+floors.join(',');if(this.contextFloor===key)return;this.contextFloor=key;for(const clone of this.floorClones||[])this.context.remove(clone);this.floorClones=[];
      for(const f of floors){if(f===origin||f<1||f>30)continue;const clone=this.building.plates[f-1].inside.clone(true);clone.position.set(0,(f-origin)*3.6,0);clone.visible=true;this.context.add(clone);this.floorClones.push(clone);}
    }
    updateContext(){
      const b=this.building,v=this.view,active=b.phase==='interior'&&v.model.towerFloor;
      this.firstPerson.refreshHUD();
      document.body.dataset.journeyView=active?v.view:'';
      if(active)v.goalGroup.visible=false;
      const followed=v.view==='human'?this.society.agents.find(a=>a.id===v.selected):null,followCar=followed?.location==='lift'?this.society.lifts.cars.find(c=>c.passengers.some(a=>a.id===followed.id)):null;
      this.cabin.visible=!!(active&&(this.trip?.kind==='lift'&&this.trip.agent.location==='lift'||followCar));
      if(this.cabin.visible){const c=this.society.renderCar(followCar||this.society.lifts.cars[this.trip.car]);this.cabin.position.set(c.x,(c.floor-b.selected)*3.6,0);this.cabinDoors.forEach((door,i)=>door.position.x=(i?1:-1)*(.65+c.door*1.3));}
      if(active)this.view.model.setElevators(this.society.lifts.cars.map(c=>this.society.renderCar(c)));
      if(!active||!['walk','human'].includes(v.view)){this.panel.hidden=true;this.context.visible=false;if(this.trip)this.cancel();return;}
      const f=b.selected,tr=this.trip,car=tr?.kind==='lift'?this.society.lifts.cars[tr.car]:null,center=car?Math.round(car.floor):followed?.location==='lift'?Math.round(followed.floor):f;
      this.rebuildContext([center-1,center,center+1],f);this.context.visible=true;
      const people=[];for(const source of this.society.agents){const a=this.society.renderAgent(source);if(a.location==='floor'&&a.floor!==f&&Math.abs(a.floor-center)<=1)people.push({...a,baseY:(a.floor-f)*3.6});else if(a.location==='stairs'&&(a.absoluteY<(f-1)*3.6-.2||a.absoluteY>=f*3.6+.1)&&Math.abs(a.absoluteY/3.6+1-center)<2)people.push({...a,baseY:a.absoluteY-(f-1)*3.6});else if(a.location==='lift'&&Math.abs(a.floor-f)>=.62&&Math.abs(a.floor-center)<2)people.push({...a,baseY:(a.floor-f)*3.6});}
      this.crowd.update(people,this.society.time+this.society.accumulator,v.view==='human'?v.selected:-1);
      if(v.view==='human'){
        this.panel.hidden=true;const a=this.society.agents.find(a=>a.id===v.selected);if(a&&a.location==='floor'&&a.floor!==f&&!this.changing)this.changeFloor(a.floor,{x:a.x,z:a.z,mode:'human',id:a.id});return;
      }
      this.panel.hidden=false;
      const p=v.camera.position,stair=L.TOWER.core.stairs.findIndex(s=>Math.hypot(p.x-s.entry.x,p.z)<2.5),nearLift=Math.abs(p.x)<3.2&&p.z>2.3&&p.z<5.8;
      const signature=tr?tr.kind+':'+tr.from+':'+tr.to:stair>=0?'stairs:'+stair+':'+f:nearLift?'lift:'+f:'walk:'+f;
      if(this.lastSignature!==signature){this.lastSignature=signature;const actions=$('journey-actions');
        if(tr){$('journey-title').textContent=tr.kind==='stairs'?`${tr.from}F → ${tr.to}F · 步行${tr.direction>0?'上楼':'下楼'}`:`${tr.from}F → ${tr.to}F · 乘坐电梯`;actions.innerHTML=tr.kind==='stairs'?'':'<button data-journey="cancel" id="journey-cancel">取消呼梯</button>';}
        else if(stair>=0){$('journey-title').textContent=`${f}F · 楼梯 ${stair?'B':'A'}`;actions.innerHTML=(f<30?`<button data-journey="stairs" data-side="${stair}" data-direction="1">↑ 步行到 ${f+1}F</button>`:'')+(f>1?`<button data-journey="stairs" data-side="${stair}" data-direction="-1">↓ 步行到 ${f-1}F</button>`:'');}
        else if(nearLift){$('journey-title').textContent=`${f}F · 电梯厅`;actions.innerHTML='<select id="journey-target" aria-label="电梯目的楼层">'+Array.from({length:30},(_,i)=>i+1).filter(n=>n!==f).map(n=>`<option value="${n}" ${n===(f<30?f+1:f-1)?'selected':''}>${n}F</option>`).join('')+'</select><button data-journey="lift">呼梯并乘坐</button>';}
        else{$('journey-title').textContent=`${f}F · 第一人称漫游`;actions.innerHTML='';}
      }
      $('journey-status').textContent=tr?.kind==='stairs'?`已走过 ${Math.round(tr.progress*100)}% · 可奔跑、跳跃，沿踏步与平台前进。`:car?`${car.label} 梯 · ${car.floor.toFixed(1)}F · ${tr.agent.location==='floor'?'已呼梯，正在等候':tr.agent.liftStage==='boarding'?'正在走进轿厢':tr.agent.liftStage==='alighting'?'到站开门，正在出梯':car.state==='moving'?'轿厢运行中':'轿厢停靠'}`:stair>=0?'E 上楼 · Q 下楼 · 进入楼梯后沿方向前进。':nearLift?'滚轮选择目的楼层 · E 呼梯并乘坐。':'走近电梯厅或左右楼梯，继续前往其他楼层。';
      const cancel=$('journey-cancel');if(cancel)cancel.hidden=tr.agent.location==='lift';
    }
  }
  L.TowerJourney=TowerJourney;
})();
