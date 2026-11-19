/* Twelve physical response teams. The first eight seconds belong to the
 * shared story; deployment, task allocation and outcomes diverge afterward.
 * A branch never awards the original film's contact events to a missing tool.
 */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,PI=Math.PI,V=p=>p?.isVector3?p.clone():new T.Vector3(...(p||[0,0,0]));
  const clamp=T.MathUtils.clamp,ease=u=>{u=clamp(u,0,1);return u*u*(3-2*u);},ramp=(t,a,b)=>ease((t-a)/(b-a));
  const clone=value=>JSON.parse(JSON.stringify(value));
  function track(keys,t){let a=keys[0],b=a;for(let i=1;i<keys.length;i++){b=keys[i];if(t<=b[0])break;a=b;}const u=a[0]===b[0]?0:ramp(t,a[0],b[0]);return a.slice(1).map((v,i)=>v+(i===3?Math.atan2(Math.sin(b[i+1]-v),Math.cos(b[i+1]-v)):b[i+1]-v)*u);}
  const names={science:'光学捕获组',medical:'医疗接应组',cargo:'工程封控组',mixed:'混合协作组'},colors={science:'#6fd9ee',medical:'#8fe5b4',cargo:'#eeb76a',mixed:'#c8b4f1'};
  C.stationShortBranches=[1,2,3].flatMap(count=>['science','medical','cargo','mixed'].map(design=>({id:design+'-'+count,name:count+'台 · '+names[design],count,roles:design==='mixed'?['science','medical','cargo'].slice(0,count):Array(count).fill(design),design,color:colors[design]})));

  C.createStationShortBranch=(film,spec)=>{
    if(typeof spec==='number')spec=C.stationShortBranches[spec];
    if(typeof spec==='string')spec=C.stationShortBranches.find(item=>item.id===spec);
    spec=spec||C.stationShortBranches[11];
    const baseStory=film.story,story=film.story=clone(baseStory),baseRobots=[...film.robots],baseCrew=[...film.actors],original={interactions:film.interactions,robotTools:film.robotTools,contact:film.contact,effects:film.effects},owned=new T.Group();owned.name='平行分支 / '+spec.id;film.scene.add(owned);
    const materials=[],geometries=[],extras=[],retired=[],active=[],contacts=[],outcomes={},roleSlots=spec.roles.slice(),branch={id:spec.id,design:spec.design,count:spec.count,roles:spec.roles.slice(),deployed:false},isZombie=film.id==='zombie';
    const capability={science:spec.roles.includes('science'),medical:spec.roles.includes('medical'),cargo:spec.roles.includes('cargo')};
    const winner=spec.id==='mixed-3',hasLure=capability.science,visitorCapture=hasLure&&(spec.count>1||spec.design==='mixed');
    let deployed=false,disposed=false,lastTime=0;
    const resources={drops:[],lights:[],barriers:[],pulse:null};
    const zombieConfig=()=>({strategy:({science:'lure',medical:'diagnose',cargo:'seal',mixed:'mixed'})[spec.design],count:spec.count,roles:spec.roles.slice(),branchId:spec.id});
    if(isZombie)film.zombieConfig=zombieConfig();
    const material=(color,options={})=>{const m=new T.MeshStandardMaterial({color,roughness:.3,metalness:.2,...options});materials.push(m);return m;};
    const sphere=(name,r,color)=>{const g=new T.SphereGeometry(r,16,10),m=material(color,{emissive:color,emissiveIntensity:.22,transparent:true,opacity:.75});geometries.push(g);const mesh=new T.Mesh(g,m);mesh.name=name;owned.add(mesh);mesh.visible=false;return mesh;};
    function beam(name,color){const g=new T.CylinderGeometry(.006,.006,1,5);geometries.push(g);const mesh=new T.Mesh(g,material(color,{emissive:color,emissiveIntensity:.7,transparent:true,opacity:.5,depthWrite:false}));mesh.name=name;owned.add(mesh);mesh.visible=false;return mesh;}
    function setBeam(mesh,a,b){const delta=b.clone().sub(a);mesh.visible=true;mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=delta.length();mesh.quaternion.setFromUnitVectors(V([0,1,0]),delta.normalize());}
    function point(record,name){return C.stationShortRobotTarget(record.model,name)||record.model.localToWorld(V([0,.30,.25]));}
    function recordContact(id,a,b,tolerance,extra={}){const distance=a.distanceTo(b);if(distance>tolerance)return false;if(!contacts.some(c=>c.id===id)){const event={id,time:+lastTime.toFixed(4),actual:a.toArray(),target:b.toArray(),distance,tolerance,...extra};contacts.push(event);film.facts.contactEvents.push({...event,branch:spec.id});}return true;}
    function position(record,keys,t,dt,action,target,tool={}){
      const pose=track(keys,t),old=record.model.position.clone();record.model.position.fromArray(pose);record.model.rotation.set(0,pose[3]||0,0);record.x=pose[0];record.y=pose[1];record.z=pose[2];record.angle=pose[3]||0;record.model.updateWorldMatrix(true,true);const speed=dt?old.distanceTo(record.model.position)/dt:0;
      const local=target?record.model.worldToLocal(target.clone()):V([0,0,1]);C.animateStationShortRobot(record.model,t,{action,speed,target:local,thrust:{x:0,y:Math.sin(t*2.1)*.025,z:Math.min(.4,speed*.15)},capture:action==='catch'?1:.2,work:action==='work'?1:.2,mood:action==='work'||action==='catch'?'focus':t>25?'happy':'alert',...tool});record.action=action;record.v=speed;
    }
    function tail(actor,keys,cues){actor.keys=[[8,...track(actor.keys,8)],...keys];if(cues)actor.cues=cues;const item=story.crew.find(a=>a.id===actor.id)||story.robots.find(a=>a.id===actor.id);if(item){item.keys=clone(actor.keys);item.cues=clone(actor.cues||[]);}}
    function makeExtra(role,index){const model=C.makeStationShortRobot({role}),scale=role==='cargo'?.75:1;model.scale.setScalar(scale);model.visible=false;owned.add(model);const record={id:'branch-'+role+'-'+index,role,model,scale,index,extra:true,action:'deploy',radius:({science:.45,medical:.50,cargo:.65}[role])*scale};extras.push(record);active.push(record);return record;}
    if(!isZombie){
      for(const robot of baseRobots){const i=roleSlots.indexOf(robot.role);if(i>=0){roleSlots.splice(i,1);active.push(robot);}else retired.push(robot);}
      roleSlots.forEach((role,i)=>makeExtra(role,i));
      for(let i=0;i<2;i++){const drop=sphere('分支未收回的水滴-'+i,.065+i*.012,'#53c6fa');resources.drops.push(drop);if(film.id==='water')film.props.set('branch-water-'+i,{id:'branch-water-'+i,kind:'branch-water',root:drop,position:[0,1.6,-3],baseScale:drop.scale.clone(),parts:{},stateKeys:[{time:0,visible:false}],owner:null,attached:false});resources.lights.push(sphere('接力引导光-'+i,.038,'#f5d481'));resources.barriers.push(beam('机器人协同光束-'+i,spec.color));}
    }
    function canEvent(id){if(lastTime<8||isZombie)return true;if(film.id==='water')return !['catch-cup','water-caught','water-bottled','return-cup'].includes(id)||capability.science;if(film.id==='visitor')return id!=='visitor-contained'||visitorCapture;if(film.id==='rescue'){if(['crew-caught','wrist-safe'].includes(id))return capability.medical;if(id==='seal-leak')return capability.cargo;}return true;}
    film.contact=function(id,...args){return canEvent(id)?original.contact.call(this,id,...args):false;};
    film.interactions=function(t,dt){
      if(t<8||isZombie)return original.interactions.call(this,t,dt);
      if(film.id==='water'&&!capability.science)return;
      if(film.id==='visitor'&&!visitorCapture)return;
      original.interactions.call(this,t,dt);
    };
    // Original instrument IK remains unchanged for all retained tools. The
    // controller's additional tools receive their own measured world targets.
    film.robotTools=function(robot,t){return original.robotTools.call(this,robot,t);};
    film.effects=function(t){original.effects.call(this,t);if(t<8||isZombie)return;if(film.id==='visitor'&&!visitorCapture)this.link.visible=hasLure&&t<17;if(film.id==='rescue'&&!capability.cargo&&t>18){const rift=this.props.get('rift');this.streaks.forEach((mesh,i)=>{const u=1-(t*1.1+i*.073)%1;mesh.visible=true;mesh.position.copy(rift.root.position).add(V([-u*2.8,Math.sin(i*1.7)*.5*u,Math.cos(i*2.1)*.8*u]));mesh.scale.y=.6+u*1.5;});}};

    function deploy(){
      if(deployed||isZombie)return;deployed=true;branch.deployed=true;
      for(const r of retired){const p=track(r.keys,8),side=p[2]>0?1:-1;r.branchRetire=[[8,...p],[10.2,side>0?.85:-.55,p[1],side>0?4.25:-4.7,p[3]],[35,side>0?.85:-.55,p[1],side>0?4.25:-4.7,p[3]]];}
      const lead=baseCrew.find(a=>a.id==='lead');
      if(film.id==='water'&&!capability.science)tail(lead,[[12,-.24,.51,-2.13,1.88],[17,-.77,.47,-1.92,2.2],[23,-.92,.47,-1.45,2.18],[35,-.92,.49,-1.45,2.18]],[{start:8,end:35,action:'reach',lookAt:{prop:'water'},hands:{right:{target:{prop:'water'},grip:.08}}}]);
      if(film.id==='visitor'&&!visitorCapture)tail(lead,[[12,-.62,.51,-1.92,2.55],[17,-.75,.47,-2.03,2.36],[23,-.70,.47,-2.12,2.40],[35,-.70,.49,-2.12,2.40]],[{start:8,end:35,action:'reach',lookAt:{prop:'alien'},hands:{left:{target:{prop:'alien'},grip:.08}}}]);
      if(film.id==='rescue'&&!capability.medical)tail(lead,[[12,.83,.60,-2.40,-.55],[17,1.08,.61,-2.19,-.68],[23,1.13,.62,-1.98,-.9],[35,1.13,.64,-1.98,-.9]],[{start:8,end:35,action:'reach',lookAt:{actor:'partner'},hands:{left:{target:{point:[.67,1.95,-1.65]},grip:.10}}}]);
      // Extras enter from the rear of the appropriate compartment. Their
      // transform never jumps from another branch's hero position.
      extras.forEach((r,i)=>{r.model.visible=retired.length===0;const side=film.id==='rescue'&&r.role==='medical'?1:-1;r.deployOrigin=[[-.65,.60,1.65][i],1.17+(i===2?.30:0),side*(i===2?3.65:4.65),side>0?PI:0];r.model.position.fromArray(r.deployOrigin);});
    }
    function deployPath(record,endpoint,t,end=14){const origin=record.deployOrigin||[.5,1.24,-4.65,0],mid=[origin[0],origin[1],origin[2],origin[3]];return[[8,...origin],[10.5,...mid],[end,...endpoint],[35,...endpoint]];}
    function retire(t,dt){for(const r of retired){r.model.visible=t<10;if(r.model.visible)position(r,r.branchRetire,t,dt,'float',V([0,1.7,r.branchRetire[1][3]]));}}
    function liveRobots(t,dt){
      for(const r of active)if(!r.extra)r.model.visible=true;
      for(const r of extras){const i=r.index,role=r.role,roleIndex=active.filter(a=>a.role===role).indexOf(r),lead=film.actor('lead'),goal=film.anchor('lead','chest');let endpoint,action='scan',target=goal,tool={};
        r.model.visible=retired.length===0||t>=10;
        if(film.id==='water'){
          if(role==='science'){endpoint=roleIndex===1?[-.35,1.24,-3.60,.25]:[.95,1.34,-3.75,-.25];target=resources.drops[Math.max(0,roleIndex-1)%2].position.clone();action=t>16?'catch':'scan';}
          else if(role==='cargo'){endpoint=roleIndex===0?[1.85,1.19,-1.67,PI/2]:roleIndex===1?[1.35,1.29,-3.40,.2]:[-.40,1.26,-3.9,.3];target=roleIndex===0?film.props.get('electric').root.position.clone().add(V([-.16,.08,0])):resources.drops[(roleIndex-1)%2].position.clone();action='work';tool.toolTarget=target;}
          else{endpoint=roleIndex===0?[1.75,1.65,-2.15,-.6]:roleIndex===1?[-.40,1.27,-3.60,.4]:[.95,1.23,-4.05,-.3];target=roleIndex===0?film.anchor('partner','rightHand'):film.anchor('lead','chest');action='medical';if(roleIndex===0)tool.toolTarget=target;}
        }else if(film.id==='visitor'){
          if(role==='science'){endpoint=roleIndex===1?[-.55,1.30,-3.98,.3]:[1.05,1.38,-3.90,-.3];action='scan';target=film.props.get('alien').root.position.clone();}
          else if(role==='cargo'){endpoint=roleIndex===0?[1.35,1.3,-2.90,-PI/2]:roleIndex===1?[-.45,1.28,-3.85,.3]:[1.45,1.22,-4.3,.4];action='work';target=film.props.get('alien').root.position.clone();tool.toolTarget=target;}
          else{endpoint=roleIndex===0?[-.55,1.28,-3.85,.25]:roleIndex===1?[.95,1.33,-3.8,-.3]:[1.65,1.70,-2.40,-1.2];action='medical';target=film.props.get('alien').root.position.clone();tool.toolTarget=target;}
        }else{
          if(role==='medical'){endpoint=roleIndex===1?[-.67,1.28,3.70,PI]:[.75,1.28,3.70,PI];action='medical';target=film.anchor('partner','leftHand');tool.toolTarget=target;}
          else if(role==='cargo'){endpoint=roleIndex===1?[.90,1.28,-3.55,1.0]:[-.45,1.28,-3.9,.3];action='work';target=film.props.get('tool')?.root.position.clone()||goal;tool.toolTarget=target;}
          else{endpoint=roleIndex===0?[-.45,1.27,-3.55,0]:roleIndex===1?[.90,1.27,-3.85,-.3]:[1.45,1.34,-1.0,-1.2];if(spec.design==='mixed'&&spec.count===1)endpoint=[.45,1.29,-3.60,.4];action='scan';target=film.props.get('tool')?.root.position.clone()||goal;}
        }
        let keys=deployPath(r,endpoint,t,14+i*.6);if(film.id==='rescue'&&role==='medical')keys=[[8,...r.deployOrigin],[11,...r.deployOrigin],[16,...endpoint],[35,...endpoint]];
        if(film.id==='water'&&role==='medical'&&roleIndex===0)keys=[[8,...r.deployOrigin],[10.5,...r.deployOrigin],[13,.20,1.95,-4.10,0],[16,1.75,1.95,-3.05,-.3],[20,...endpoint],[35,...endpoint]];
        position(r,keys,t,dt,action,target,tool);
      }
    }
    function water(t,dt){
      const water=film.props.get('water'),cup=film.props.get('cup'),electric=film.props.get('electric');if(!water||!cup)return;
      if(!capability.science){
        water.attached=false;water.owner=null;water.root.visible=true;water.root.position.fromArray(track([[8,.59,1.80,-2.52],[12,1.48,1.84,-1.99],[17,1.98,1.72,-1.70],[23,1.55,1.91,-1.52],[35,1.50,1.96,-1.52]],t));water.root.scale.copy(water.baseScale).multiplyScalar(2.4+.12*Math.sin(t*1.8));cup.attached=false;cup.owner=null;cup.root.position.fromArray(track([[8,.32,1.42,-2.68],[15,.18,1.35,-3.35],[35,.12,1.4,-3.40]],t));if(cup.parts.fill)cup.parts.fill.visible=false;
        const engineer=active.find(r=>r.role==='cargo');let powered=true;
        if(engineer&&t>14){const switchPoint=electric.root.position.clone().add(V([-.16,.08,0]));if(recordContact('electric-disconnected',point(engineer,'seal'),switchPoint,.12,{robot:engineer.id}))outcomes.electricDisconnected=true;powered=!outcomes.electricDisconnected;}
        electric.shortUpdate?.(t,dt,{warning:powered?1:0});if(electric.parts.electricAlarm)electric.parts.electricAlarm.visible=powered;outcomes.waterRecovered=false;outcomes.waterStillFloating=true;
      }else{outcomes.waterRecovered=!!film.facts.resultFlags['water-bottled'];outcomes.cupReturned=!!film.facts.resultFlags['return-cup'];}
      // Two secondary droplets make additional hands consequential. They are
      // separate visible bodies and only disappear after a real tool contact.
      resources.drops.forEach((drop,i)=>{
        if(t<11){drop.visible=false;return;}const helper=active.filter(r=>r.extra&&r.role==='science')[i],sweep=winner?active.find(r=>r.role==='cargo'):spec.design==='mixed'&&spec.count===1&&i===0?active.find(r=>r.role==='science'):helper;
        if(drop.userData.collected){drop.visible=false;return;}
        drop.visible=t>=11;const free=[.20+i*.65,1.65+.09*Math.sin(t*1.4+i),-3.08+i*.25];drop.position.fromArray(free);
        if(sweep&&t>15){const tool=point(sweep,sweep.role==='science'?'capture':'seal'),u=ramp(t,15+i*1.2,21+i*1.2);drop.position.lerp(tool,u);if(u>.985&&recordContact('secondary-water-'+i,drop.position,tool,.035,{robot:sweep.id})){drop.userData.collected=true;drop.visible=false;}}
      });
      outcomes.looseDroplets=resources.drops.filter(d=>!d.userData.collected).length;
      if(capability.science&&outcomes.looseDroplets&&t>23&&spec.count===1){electric.shortUpdate?.(t,dt,{warning:1});outcomes.electricalRisk=true;}else if(outcomes.looseDroplets===0)outcomes.electricalRisk=false;
      for(const r of active.filter(r=>r.role==='medical'))if(t>16){const wrist=film.anchor('partner','rightHand');if(recordContact('steady-partner-'+r.id,point(r,'probe'),wrist,.13,{robot:r.id}))outcomes.partnerSteadied=true;}
    }
    function visitor(t,dt){
      const alien=film.props.get('alien'),bubble=film.props.get('bubble'),lure=film.props.get('lure');if(!alien)return;
      if(visitorCapture){
        outcomes.visitorContained=!!film.facts.resultFlags['visitor-contained'];outcomes.visitorWaves=!!film.facts.resultFlags['visitor-waves-back'];
        const guides=active.filter(r=>r.extra);
        guides.forEach((r,i)=>{const light=resources.lights[i],line=resources.barriers[i];if(!light||!line)return;light.visible=t>11&&t<20;if(!light.visible){line.visible=false;return;}const to=bubble.root.position.clone().add(V([0,.015,0])),from=point(r,r.role==='science'?'capture':r.role==='medical'?'probe':'seal');light.position.copy(alien.root.position).lerp(to,ramp(t,12,18));light.position.y+=.06*Math.sin(t*3+i);setBeam(line,from,light.position);});
      }else{
        alien.attached=false;alien.owner=null;alien.root.visible=true;bubble.root.visible=false;lure.root.visible=hasLure&&t<17;film.link.visible=hasLure&&t<17;
        const rear=spec.count===1?[-.26,2.40,-4.35]:spec.count===2?[-1.02,2.36,-3.71]:[.45,2.62,-2.80];
        const p=track([[8,.73,2.03,-3.26],[12,-.35,2.20,-3.6],[16,.14,2.35,-2.75],[21,...rear],[35,...rear]],t);alien.root.position.fromArray(p);alien.root.position.x+=.13*Math.sin(t*1.4);alien.root.position.y+=.09*Math.sin(t*2.1);alien.root.rotation.y=t*.55;
        for(const [i,r]of active.entries()){const line=resources.barriers[i%2];if(i>1)continue;const endpoint=point(r,r.role==='science'?'capture':r.role==='medical'?'probe':'seal');if(t>12&&t<23)setBeam(line,endpoint,alien.root.position);else line.visible=false;}
        outcomes.visitorContained=false;outcomes.visitorEscaped=true;outcomes.escapeLocation=spec.count===1?'rear-ceiling':spec.count===2?'sample-cabinet-roof':'central-ceiling';
        if(hasLure)outcomes.lureInterrupted=true;
      }
      if(t>22&&capability.cargo&&!visitorCapture){const ring=bubble.parts.ring;outcomes.perimeterHeld=true;if(ring)ring.visible=true;}
    }
    function rescue(t,dt){
      const handle=film.props.get('rescueHandle'),patch=film.props.get('patch'),rift=film.props.get('rift'),tool=film.props.get('tool');
      if(!capability.medical){handle.root.visible=false;delete film.facts.resultFlags['crew-caught'];delete film.facts.resultFlags['safe-tow'];delete film.facts.resultFlags['wrist-safe'];outcomes.crewLeftInLab=true;}
      if(!capability.cargo){patch.root.visible=false;patch.attached=false;patch.owner=null;delete film.facts.resultFlags['seal-leak'];outcomes.leakOpen=true;rift.shortUpdate?.(t,dt,{sealed:false});if(t>18)film.streaks.forEach((mesh,i)=>{const u=1-(t*1.1+i*.073)%1;mesh.visible=true;mesh.position.copy(rift.root.position).add(V([-u*2.8,Math.sin(i*1.7)*.5*u,Math.cos(i*2.1)*.8*u]));mesh.scale.y=.6+u*1.5;});}
      outcomes.crewTowed=!!film.facts.resultFlags['safe-tow'];outcomes.leakSealed=!!film.facts.resultFlags['seal-leak'];outcomes.wristChecked=!!film.facts.resultFlags['wrist-safe'];
      // A spare instrument retrieves the still-floating wrench. This changes
      // the actual prop's owner and location only at the measured meeting.
      const retriever=spec.count>1||spec.design==='mixed'?active.find(r=>r.extra&&r.role!=='medical'):null;
      if(retriever&&tool&&t>18){const endpoint=point(retriever,retriever.role==='science'?'capture':'seal');if(!outcomes.toolRecovered){tool.attached=false;tool.owner=null;tool.root.position.lerp(endpoint,ramp(t,18,23));if(t>22.8&&recordContact('loose-tool-recovered',tool.root.position,endpoint,.055,{robot:retriever.id})){outcomes.toolRecovered=true;}}else{tool.attached=false;tool.owner=null;tool.root.position.copy(endpoint);}}
    }
    return{
      get units(){return isZombie?film.robots:[...baseRobots,...extras];},
      before(t,dt){lastTime=t;if(isZombie){film.zombieConfig=zombieConfig();branch.deployed=t>=8;return;}if(t>=8)deploy();},
      after(t,dt){lastTime=t;if(isZombie)return;if(t<8)return;retire(t,dt);liveRobots(t,dt);if(film.id==='water')water(t,dt);else if(film.id==='visitor')visitor(t,dt);else if(film.id==='rescue')rescue(t,dt);film.scene.updateMatrixWorld(true);},
      snapshot(){const zombie=isZombie?(C.stationShortZombie?.snapshot?.(film)||film.zombieSnapshot||{}):null;return{...branch,deployed:lastTime>=8,time:lastTime,capability:{...capability},activeRobots:isZombie?undefined:active.map(r=>({id:r.id,role:r.role,position:r.model.position.toArray(),visible:r.model.visible,action:r.action})),retiring:isZombie?[]:retired.filter(r=>r.model.visible&&lastTime>=8).map(r=>r.id),contactEvents:contacts.map(c=>({...c})),outcome:zombie||{...outcomes}};},
      dispose(){if(disposed)return;disposed=true;film.interactions=original.interactions;film.robotTools=original.robotTools;film.contact=original.contact;film.effects=original.effects;film.story=baseStory;for(const r of baseRobots)r.model.visible=true;for(const r of extras)C.disposeModel(r.model);for(let i=0;i<2;i++)film.props.delete('branch-water-'+i);owned.parent?.remove(owned);for(const g of new Set(geometries))g.dispose();for(const m of new Set(materials))m.dispose();}
    };
  };
})();
