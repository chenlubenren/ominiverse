/* Two independently visible pressure failures, with physical rescue/repair routes. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,clamp=T.MathUtils.clamp;
  const SOUTH=0,NORTH=1,near=(a,p,r=.28)=>Math.hypot(a.x-p.x,a.z-p.z)<r;
  const outcome=(code,title,detail)=>({code,title,detail});
  const positions={southValve:{x:.8,z:.95},northValve:{x:.8,z:-.95},southRefuge:{x:.8,z:4.35},northService:{x:.8,z:-2.05}};

  function plate(d,text,z){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const texture=new T.CanvasTexture(canvas);texture.encoding=T.sRGBEncoding;
    const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthTest:false}));
    const side=z>0?-1:1,width=d.world.spec.width;
    sprite.position.set(side*(width/2+.45),2.95,z);sprite.scale.set(2.35,.59,1);sprite.renderOrder=8;d.owned.add(sprite);
    return{canvas,texture,sprite,text,last:''};
  }
  function paint(site,value,sealed){
    const label=site.board,text=label.text+' '+Math.round(value)+'% · '+(sealed?'已封堵':'正在失压');if(text===label.last)return;label.last=text;
    const c=label.canvas.getContext('2d');c.clearRect(0,0,512,128);c.fillStyle='rgba(8,22,34,.91)';c.fillRect(0,0,512,128);c.fillStyle=sealed?'#91edc4':'#ffc0ab';c.font='bold 31px "Microsoft YaHei",sans-serif';c.textAlign='center';c.fillText(text,256,51);c.fillStyle='#28485b';c.fillRect(22,80,468,18);c.fillStyle=sealed?'#74d9ad':value<55?'#f27a63':'#f2b269';c.fillRect(22,80,468*value/100,18);label.texture.needsUpdate=true;
  }
  function site(d,index,z){
    const root=new T.Group(),side=-1;root.name=index===SOUTH?'南侧独立漏点':'北侧独立漏点';root.position.set(side*(d.world.spec.width/2-.96),1.45,z);root.rotation.y=-side*Math.PI/2;d.owned.add(root);
    const add=(shape,color,size,p,opts)=>{const m=d.mesh(shape,color,size,p,opts);root.add(m);return m;};
    add('box','#29485b',[.8,.82,.13],[0,0,0]);
    const crack=add('box','#b8f2ff',[.055,.58,.15],[0,0,.02],{emissive:'#67dfff',emissiveIntensity:1.7});crack.rotation.z=-.32;
    for(const [x,y,angle]of [[-.1,.12,.8],[.12,-.1,.8]]){const branch=add('box','#c6f7ff',[.04,.25,.16],[x,y,.02],{emissive:'#67dfff',emissiveIntensity:1.4});branch.rotation.z=angle;}
    const lamp=add('sphere','#f38167',[.09,.09,.09],[.44,.48,.06],{emissive:'#ff442c',emissiveIntensity:2});
    const light=new T.PointLight('#ef715b',.8,3);light.position.set(0,.25,.4);root.add(light);
    const patch=add('box','#8cd5ba',[.84,.84,.08],[0,0,.14],{metalness:.5,roughness:.35});patch.visible=false;
    const particles=[];for(let i=0;i<24;i++){const p=add('box','#b5edff',[.022,.022,.2],[0,0,0],{emissive:'#81cfe8',emissiveIntensity:.7,transparent:true,opacity:.55});particles.push(p);}
    const valve=d.mesh('torus','#ed9c73',[.22,.22,.22],[1.03,1.55,index===SOUTH?.95:-.95],{metalness:.4,roughness:.4});valve.rotation.y=Math.PI/2;
    const valveHub=d.mesh('box','#b1d0d5',[.035,.32,.035],[1.03,1.55,index===SOUTH?.95:-.95]);
    const result={index,root,crack,light,lamp,patch,particles,valve,valveHub,board:plate(d,index===SOUTH?'A侧压力':'B侧压力',z)};paint(result,100,false);return result;
  }
  function resetActor(d,a,x,z,role){
    Object.assign(a,{x,z,v:0,travel:0,motionDistance:0,path:[],queue:[],cue:null,arrivalCue:null,role,roleLabel:role,angle:Math.PI/2});
    d.hold(a,'brace','双手抓住扶手，抵抗漏气气流',Math.PI/2);
  }
  function arrived(a,key){return a.arrivalCue===key;}
  function moveCrew(d,dt){for(const a of d.stageActors)d.advanceActor(a,dt);}
  function valveSouth(d,dt){
    const s=d.leakState,f=d.facts,a=d.stageActors[0];
    if(!f.valvesClosed[SOUTH]&&arrived(a,'south-valve')){d.hold(a,'operate','双手转动 A 侧阀门，压住漏气管路',Math.PI/2);s.valveWork+=dt;if(s.valveWork>=2.4){f.valvesClosed[SOUTH]=true;f.repaired[SOUTH]=true;f.southSealedAt=d.time;}}
  }
  function updatePressure(d,dt){
    const f=d.facts;
    for(const side of [SOUTH,NORTH]){const rate=side===SOUTH?.95:1.45;if(!f.repaired[side])f.pressure[side]=Math.max(12,f.pressure[side]-rate*dt);}
    // Until a real partition seals, the unrepaired side also drains the repaired side.
    if(!f.isolationClosed&&f.repaired[SOUTH]&&!f.repaired[NORTH])f.pressure[SOUTH]=Math.max(12,f.pressure[SOUTH]-.28*dt);
    f.repairCompleted=f.repaired.every(Boolean);f.pressureStable=f.repairCompleted||f.isolationClosed&&f.repaired[SOUTH];
  }
  function readyAtValves(d){return d.stageActors.every((a,i)=>arrived(a,i?'north-valve':'south-valve'));}
  function contact(d,dt){
    const s=d.leakState,f=d.facts,[lead,scout]=d.stageActors,r=d.robot;
    valveSouth(d,dt);
    if(f.valvesClosed[SOUTH]){d.command(lead,'repair-refuge',positions.southRefuge,'retreat','A 侧阀已锁紧，后撤为补给艇让行',1.1);if(arrived(lead,'repair-refuge'))d.hold(lead,f.repairCompleted?'relief':'beckon',f.repairCompleted?'双侧压力稳定，放下警戒手势':'挥臂指引：封堵物资送到 B 侧',Math.PI);}
    if(d.time>=13){d.command(scout,'north-service',s.northService,'rush','B 侧后撤让出门口，前往漏点准备固定补丁',1.05);if(arrived(scout,'north-service'))d.hold(scout,f.repaired[NORTH]?'relief':'operate',f.repaired[NORTH]?'补丁锁紧，确认 B 侧气流停止':'伸臂等待密封物资，准备压紧补丁',-Math.PI/2);}
    else d.hold(scout,'beckon','B 侧继续漏气，呼叫机器人送来补丁',0);
    d.move(r,dt);
    const worked=d.finishRobotOperation(dt,d.options.robot==='cargo'?2.7:2.1);
    if(worked&&d.options.robot==='cargo'&&arrived(scout,'north-service')){s.patchWork+=dt;f.patchProgress=clamp(s.patchWork/1.25,0,1);if(f.patchProgress>=1){f.repaired[NORTH]=true;f.northSealedAt??=d.time;}}
    if(f.repaired[NORTH])d.robotStatus('report','密封物资已固定 · 两侧漏点处置完成');
    else if(!f.routeReachable&&!r.path.length)d.robotStatus('blocked','物资作业艇无法过窄门 · B 侧补丁仍未送达');
    else if(r.blockedBy)d.robotStatus('yield','让船员先通过 · 等待封堵路线清空');
    else if(f.robotArrived)d.robotStatus('work',d.options.robot==='cargo'?'送出密封补丁 · 等待船员压紧':'已定位漏点 · 当前机型未携带密封物资');
    else d.robotStatus('move','运送封堵物资到 B 侧 · A 侧由船员关阀');
  }
  function isolate(d,dt){
    const f=d.facts,[lead,scout]=d.stageActors;
    valveSouth(d,dt);
    if(f.valvesClosed[SOUTH]){d.command(lead,'isolate-refuge',positions.southRefuge,'retreat','A 侧阀已锁紧，退到避险位让出门口',1.25);if(arrived(lead,'isolate-refuge'))d.hold(lead,'operate','守住隔断开关，等待同伴退出门框',Math.PI);}
    if(f.valvesClosed[SOUTH]&&lead.z>2.05){d.command(scout,'isolate-cross',{x:.8,z:2.35},'retreat','放弃 B 侧物资，穿门撤向 A 侧',1.3,[{x:0,z:.72}]);if(arrived(scout,'isolate-cross'))d.hold(scout,'brace','抓住 A 侧扶手，确认身后无人',Math.PI);}
    else d.hold(scout,'beckon','B 侧压力下降，等待同伴让出通道',0);
    f.evacuated=d.stageActors.every(a=>a.z>.8)&&arrived(scout,'isolate-cross');
    f.isolationUnavailable=!d.bulkhead;
    if(f.evacuated&&f.valvesClosed[SOUTH]){d.closeIsolation(dt);if(f.isolationClosed){f.materialsAbandoned=true;f.isolatedAt??=d.time;}}
    d.robotStatus('guard',f.isolationClosed?'隔断已关闭 · A 侧保压，B 侧物资留置':!d.bulkhead?'这里没有可关闭隔断 · 无法分区保压':f.evacuated?'门口已清空 · 正在关闭隔断':'等待两人撤到 A 侧 · 保持门口畅通');
  }
  function rescue(d,dt){
    const s=d.leakState,f=d.facts,[lead,scout]=d.stageActors,r=d.robot;
    if(!s.rescueConnected){
      d.command(scout,'rescue-retreat',{x:.8,z:-3.15},'retreat','气流骤强，沿 B 侧扶手后撤求助',1.05);
      if(arrived(scout,'rescue-retreat'))d.hold(scout,'beckon','抓紧扶手，伸出另一只手请求接应',0);
      if(scout.z< -2.1){d.command(lead,'rescue-enter',{x:.8,z:-1.65},'rush','穿过中门，前往 B 侧接应同伴',1.35,[{x:0,z:-.72}]);if(arrived(lead,'rescue-enter')){d.hold(lead,'assist','伸臂接应，示意同伴沿扶手返回',Math.PI);s.assistTime+=dt;if(s.assistTime>1.0&&arrived(scout,'rescue-retreat')){s.rescueConnected=true;f.rescueContactAt=d.time;}}}
    }else{
      d.command(lead,'rescue-lead-home',positions.southRefuge,'retreat','先穿回 A 侧，腾出接应通道',1.35,[{x:0,z:.72}]);
      if(arrived(lead,'rescue-lead-home'))d.hold(lead,'assist','安全侧伸手接应，持续呼叫同伴',Math.PI);
      if(lead.z>.95){d.command(scout,'rescue-home',{x:.8,z:2.35},'retreat','跟随接应指引，穿门返回安全侧',1.30,[{x:0,z:.72}]);if(arrived(scout,'rescue-home')){d.hold(scout,'brace','抓稳 A 侧扶手，等待生命体征检查',Math.PI);f.evacuated=true;f.humanRescuedAt??=d.time;}}
    }
    if(f.evacuated){
      if(!s.robotRetasked){d.robotTask({x:-.45,z:2.35});s.robotRetasked=true;}
      d.move(r,dt);const complete=d.finishRobotOperation(dt,1.5);f.medicalSupported=complete&&d.options.robot==='medical';
      d.robotStatus(f.robotArrived?'work':'move',f.medicalSupported?'生命体征已复核 · 两人回到 A 侧':f.robotArrived?'两人已撤离 · 持续监测失压，等待外部支援':'靠近撤离船员 · 留出通道进行检查');
    }else d.robotStatus('yield','船员穿门救人 · 停在 A 侧让出通道');
    f.materialsAbandoned=true;
  }

  (C.stationScenarioScripts??={}).leak={
    defaults:{layout:'partitioned',robot:'cargo',variant:'contact'},
    choices:{contact:'定位封堵',isolate:'分区保压',rescue:'优先救人'},
    setup(d){
      const [lead,scout]=d.stageActors;
      resetActor(d,lead,.8,3.8,'A 侧阀门员');resetActor(d,scout,.8,-3.55,'B 侧检修员');
      d.leakState={sites:[site(d,SOUTH,3.15),site(d,NORTH,-3.15)],northService:{x:d.world.spec.width>5?-1.8:.8,z:-2.75},valveWork:0,patchWork:0,assistTime:0,rescueConnected:false,robotRetasked:false,branch:null};
      Object.assign(d.facts,{leakCount:2,pressure:[100,100],repaired:[false,false],valvesClosed:[false,false],repairCompleted:false,pressureStable:false,evacuated:false,materialsAbandoned:false,medicalSupported:false,patchProgress:0});
      d.robot.taskLabel='两侧失压应急';d.robotTask({x:-.45,z:-2.8});
      // Preserve a left-side waypoint: a simplified direct path cuts across
      // the valve operator's return lane before reaching the central hatch.
      if(d.options.robot==='cargo'){
        const r=d.robot,radius=r.radius+.025,first=d.grid.route(r,{x:-.45,z:1},radius);
        if(first.reachable){const second=d.grid.route(first.endpoint,d.goal,radius);r.path=(second.reachable?[...first.path,...second.path]:first.path).map(p=>({...p}));r.reachable=second.reachable;r.endpoint=second.reachable?second.endpoint:first.endpoint;r.routeDistance=r.path.reduce((n,p,i)=>n+Math.hypot(p.x-(i?r.path[i-1].x:r.x),p.z-(i?r.path[i-1].z:r.z)),0);if(r.path.length&&near(r,r.path[0],.12))r.path.shift();Object.assign(d.facts,{routeReachable:r.reachable,routeDistance:r.routeDistance});d.updateRobotRoute?.();}
      }
      d.event.visible=false;d.robotStatus('scan','检测到 A / B 两侧失压 · 等待处置选择');
    },
    step(d,dt){
      const t=d.time,f=d.facts,s=d.leakState,[lead,scout]=d.stageActors;
      updatePressure(d,dt);
      if(t<5){for(const a of d.stageActors)d.hold(a,t>1&&t<2?'startle':'brace',t>1&&t<2?'气流突起，抬臂护脸后抓紧扶手':'两侧同时漏气，抓住扶手抵抗气流',Math.PI/2);d.robotStatus('scan','两个独立漏点 · A / B 压力持续下降');return;}
      if(t<12||!s.branch){
        d.command(lead,'south-valve',positions.southValve,'rush','沿 A 侧扶手前进，寻找应急关断阀',1.15);
        d.command(scout,'north-valve',positions.northValve,'rush','沿 B 侧扶手靠近中门，报告另一处漏点',1.15);
        if(arrived(lead,'south-valve'))d.hold(lead,'operate','握住 A 侧阀门，等待处置决定',Math.PI/2);
        if(arrived(scout,'north-valve'))d.hold(scout,'beckon','B 侧也在漏气，隔门呼叫 A 侧同伴',0);
        if(t>=12&&readyAtValves(d)){s.branch=d.options.variant;f.crewReady=true;}else{d.robotStatus('yield','船员分头确认阀门 · 让出应急通道');moveCrew(d,dt);return;}
      }
      if(s.branch==='isolate')isolate(d,dt);else if(s.branch==='rescue')rescue(d,dt);else contact(d,dt);
      moveCrew(d,dt);
    },
    visuals(d){
      if(!d.leakState)return;d.event.visible=false;d.scan.visible=false;const f=d.facts,t=d.time;
      for(const s of d.leakState.sites){
        const repaired=f.repaired[s.index],strength=repaired?0:clamp(f.pressure[s.index]/100,.2,1);s.root.visible=true;s.crack.visible=!repaired;s.patch.visible=repaired;
        s.lamp.material.color.set(repaired?'#80d7b1':'#f38167');s.lamp.material.emissive.set(repaired?'#30b87f':'#ff442c');s.lamp.material.emissiveIntensity=repaired?.5:1.1+.8*Math.sin(t*6+s.index);
        s.light.color.set(repaired?'#75dbac':'#ef715b');s.light.intensity=repaired?.16:.4+.3*Math.sin(t*6+s.index);
        const work=s.index===SOUTH?clamp(d.leakState.valveWork/2.4,0,1):f.patchProgress;s.valve.rotation.x=work*Math.PI*2;s.valveHub.rotation.x=work*Math.PI*2;
        for(const [i,p]of s.particles.entries()){p.visible=!repaired;const u=(t*(.65+strength*.45)+i/24)%1;p.position.set(Math.sin(i)*.25*(1-u),Math.sin(i*2.3)*.30*(1-u),.18+(1-u)*1.25);p.scale.z=.12+.25*strength;p.material.opacity=(.2+.5*u)*strength;p.rotation.y=0;}
        paint(s,f.pressure[s.index],repaired);
      }
      if(d.bulkhead)d.bulkhead.position.x=d.bulkhead.userData.openX*(1-d.isolationAmount);
      for(const h of d.world.hatches)h.leaf.position.x=0;
      d.pathLine.visible=d.time>=12&&d.time<30&&d.options.variant==='contact';
    },
    narrative(d){
      const t=d.time,f=d.facts;if(t<5)return{stage:'01 / 两侧同时失压',caption:'A、B 两侧各有一道裂缝。两名船员隔门抓住扶手，气流同时拉扯他们。'};
      if(t<12)return{stage:'02 / 处置窗口',caption:'两人分头冲向阀门。定位封堵、撤到一侧保压，还是先穿门救人？'};
      if(t>=30)return{stage:'04 / 失压后的选择',caption:d.outcome?.title||'正在确认人员与压力状态'};
      if(d.options.variant==='isolate')return{stage:'03 / 分区保压',caption:f.isolationClosed?'两人已撤到 A 侧，隔断关闭。A 侧停止失压，B 侧物资留在危险区。':f.evacuated?'船员已退出门框，等待隔断合拢。': 'A 侧船员关阀后退让；B 侧船员穿门撤离，机器人等待通道清空。'};
      if(d.options.variant==='rescue')return{stage:'03 / 穿门接应',caption:f.evacuated?'两名船员回到 A 侧，机器人检查撤离情况；两处裂缝仍在漏气。':d.leakState.rescueConnected?'接应建立：先行船员让出门口，同伴沿扶手穿门返回。':'A 侧船员穿门寻找同伴；B 侧船员抵抗气流，伸臂呼救。'};
      return{stage:'03 / 两侧协同封堵',caption:f.repairCompleted?'A 侧阀门锁紧，B 侧补丁固定；两束气流停止，压力趋于稳定。':!f.routeReachable&&!d.robot.path.length?'宽机体停在窄门前，B 侧仍收不到封堵物资；A 侧阀门已由船员控制。':f.robotArrived?'机器人抵达 B 侧漏点，船员等待可用的密封补丁。':'机器人跨门运送密封物资；A 侧船员独立操作阀门，B 侧船员负责接应。'};
    },
    statusLine(d){const f=d.facts;return'A 侧压力 '+Math.round(f.pressure[SOUTH])+'% · B 侧压力 '+Math.round(f.pressure[NORTH])+'% · 已处理 '+f.repaired.filter(Boolean).length+'/2 处漏点';},
    finish(d){
      const f=d.facts;for(const a of d.stageActors){a.path=[];a.queue=[];a.v=0;d.hold(a,f.repairCompleted?'relief':f.evacuated?'brace':'beckon',f.repairCompleted?'确认气流停止，解除应急姿态':f.evacuated?'抓稳安全侧扶手，等待下一步撤离':'保持扶手支撑，持续请求处置',Math.PI);}
      d.robot.path=[];d.robot.v=0;d.robotStatus(f.repairCompleted?'report':f.isolationClosed?'guard':!f.routeReachable?'blocked':'report',d.outcome?.title||'本轮行动结束，等待后续指令');
    },
    resolve(d){
      const f=d.facts,v=d.options.variant;
      if(v==='rescue')return f.evacuated?outcome(f.medicalSupported?'crew-stabilized':'crew-rescued',f.medicalSupported?'两人获救并完成检查，两个漏点仍在失压':'两人穿门获救，未修复的舱段继续失压','优先接应保护了两名船员；封堵作业被放弃，必须继续撤向外部安全舱。'):outcome('rescue-incomplete','接应尚未完成，必须继续保持舱门开启','船员仍在救援路线上；任何一人未安全到达，均不宣告撤离完成。');
      if(v==='isolate')return f.isolationClosed&&f.evacuated?outcome('pressure-contained','保住 A 侧与两名船员，B 侧物资被放弃','A 侧阀门已关闭；两人撤出门框后隔断才合拢，B 侧漏点仍持续失压。'):outcome(d.bulkhead?'isolation-pending':'no-pressure-partition',d.bulkhead?'人员仍在撤离，保压隔断尚未关闭':'人员退到 A 侧，但这里无法建立保压分区',d.bulkhead?'关闭条件未满足，门保持开启以免夹住船员。':'开放或窄门布局没有可关闭的中间隔断，未修漏点仍会影响整个舱段。');
      if(f.repairCompleted)return outcome('dual-sealed','两处漏点全部封堵，人员与物资都被保住','船员关闭 A 侧阀门，运输机器人跨门送达密封物资，另一名船员完成 B 侧补丁固定。');
      if(!f.routeReachable)return outcome('supply-blocked','A 侧阀门锁紧，B 侧补丁被窄门挡住','船员能够过门，但运输机体无法穿越该通道；B 侧漏点持续失压。');
      if(d.options.robot!=='cargo'&&f.robotArrived)return outcome('seal-kit-missing','漏点已定位，当前机器人没有封堵物资','A 侧船员完成关阀；B 侧需要密封补丁，扫描或护理能力不能替代物资运输。');
      return outcome('repair-window-missed','只完成一侧处置，另一侧仍在等待补给','实际路线、让行与固定补丁所需时间已超出本轮行动窗口。');
    }
  };
})();
