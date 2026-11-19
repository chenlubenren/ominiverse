/* A patient asks for help across a real isolation threshold. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,clamp=T.MathUtils.clamp;
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const arrived=(actor,key)=>actor.arrivalCue===key&&actor.reachable!==false&&dist(actor,actor.goal)<.25;
  const face=(actor,target)=>Math.atan2(target.x-actor.x,target.z-actor.z);
  function stop(actor){actor.path=[];actor.queue=[];actor.v=0;}
  function robotGoal(d,key,goal){if(d.infection.robotCue===key)return;d.infection.robotCue=key;d.robotTask(goal);}
  function robotMove(d,dt,status){d.move(d.robot,dt);d.robotStatus(d.robot.blockedBy?'yield':d.robot.reachable?'move':'blocked',d.robot.blockedBy?'有人正在通行 · 停止推进，等待让路':!d.robot.reachable?'机体无法通过隔离通道 · 请求人工接应':status);}
  function hold(d,actor,action,label,target){d.hold(actor,action,label,target?face(actor,target):undefined);}
  function operation(d,dt,seconds){
    const state=d.infection,f=d.facts,r=d.robot,p=state.patient;f.robotPatientDistance=dist(r,p);
    if(f.diagnosisComplete){d.robotStatus('report',f.treatmentComplete?'防护护理完成 · 患者体征回稳':'样本比对完成 · 等待医疗护理');return true;}
    if(!f.patientAtCare||f.robotPatientDistance>1.2){d.robotStatus('move','抵达患者身边后才能开始监测');return false;}
    const completed=d.finishRobotOperation(dt,seconds);
    d.robotStatus(completed?'report':'work',completed?(d.options.robot==='medical'?'防护护理完成 · 患者体征回稳':'样本比对完成 · 等待医疗护理'):'近距离监测体温与呼吸 · 请患者保持沟通');
    if(completed){f.diagnosisComplete=true;f.treatmentComplete=d.options.robot==='medical';f.diagnosisAt??=d.time;}
    return completed;
  }
  const script={
    defaults:{layout:'partitioned',robot:'medical',variant:'contact'},
    castIds:['crew-01','crew-05'],
    choices:{contact:'先诊断',isolate:'留舱隔离',rescue:'接出患者'},
    setup(d){
      const [lead,patient]=d.stageActors,r=d.robot;
      Object.assign(lead,{name:'林岚',role:'值班同伴',x:-.8,z:-1.7,y:.64,angle:Math.PI,cue:null,arrivalCue:null});
      Object.assign(patient,{name:'江月',role:'暴露船员',x:.8,z:-3.55,y:.72,angle:Math.PI/2,cue:null,arrivalCue:null});
      stop(lead);stop(patient);stop(r);r.x=-.45;r.z=3.15;r.start={x:r.x,z:r.z};r.taskLabel='为江月诊断并控制接触暴露';
      d.setAction(lead,'operate','核对样本清单');d.setAction(patient,'operate','检查培养皿封口');
      Object.assign(d.facts,{patientAtDoor:false,patientAtCare:false,diagnosisComplete:false,treatmentComplete:false,patientSafe:false,assisted:false,exposed:false,companionExposed:false,robotPatientDistance:dist(r,patient),operationElapsed:0,careRequested:false,doorRequested:false});
      const state=d.infection={lead,patient,robotCue:null,branch:null,escortAt:null,careAt:null,alarmAt:null};
      // The sample tray is inside the existing cabinet, outside the navigable aisle.
      state.dish=d.mesh('sphere','#cda7e1',[.17,.035,.17],[1.45,1.44,-3.55],{transparent:true,opacity:.7,emissive:'#a46fbc',emissiveIntensity:.4});
      state.dishLid=d.mesh('sphere','#d9eef4',[.19,.025,.19],[1.45,1.49,-3.55],{transparent:true,opacity:.46});
      state.warning=d.mesh('box','#c47bcf',[.22,.08,.025],[1.43,1.72,-3.34],{emissive:'#bd6fd1',emissiveIntensity:1});
      state.monitor=d.mesh('box','#8ed4e9',[.18,.12,.07],[0,1.6,0],{emissive:'#61b3cc',emissiveIntensity:.45});state.monitor.visible=false;
      state.pulse=d.mesh('torus','#9acfe8',[.27,.27,.27],[0,1.6,0],{transparent:true,opacity:.7,emissive:'#7eb9d2',emissiveIntensity:.8});state.pulse.visible=false;
      d.robotStatus('scan','接收样本柜告警 · 等待患者说明');
    },
    step(d,dt){
      const t=d.time,s=d.infection,{lead,patient}=s,r=d.robot,f=d.facts,v=d.options.variant;d.frameDt=dt;
      if(t>=30){script.finish(d);return;}
      if(t<.9){hold(d,lead,'operate','核对样本编号',patient);hold(d,patient,'operate','打开培养皿，检查封口');}
      else{
        s.alarmAt??=t;
        if(t<2.0)hold(d,patient,'startle','样本溅出，抬臂护住口鼻');
        else if(t<5)hold(d,patient,'brace','头晕，抓住样本柜稳住身体');
        if(t<1.45)hold(d,lead,'startle','听到呼救，立即转身',patient);
        else if(!s.leadAtControl){
          d.command(lead,'infection-control',{x:.8,z:3.65},'rush','穿过舱门，呼叫医疗机器人',1.35,[{x:0,z:.78},{x:.8,z:1.3}]);
          if(arrived(lead,'infection-control'))s.leadAtControl=true;
        }else if(t<12)hold(d,lead,'operate','江月，先别穿门，我正在请求帮助',patient);
      }
      if(t>=5&&t<12){
        d.command(patient,'patient-door',{x:.72,z:-.95},'retreat','扶着舱壁靠近门口：请别把我关起来',.95);
        if(arrived(patient,'patient-door')){f.patientAtDoor=true;hold(d,patient,'beckon','请别把我关起来，我还能自己走',lead);}
        d.robotStatus('yield','患者正在门边求助 · 等待人工选择');
      }else if(t<5)d.robotStatus('scan','样本暴露告警 · 询问船员症状');
      if(t>=12){
        if(!s.branch){s.branch=v;f.careRequested=true;stop(lead);stop(patient);}
        if(v==='contact')script.diagnose(d,dt);
        else if(v==='isolate')script.isolate(d,dt);
        else script.rescue(d,dt);
      }
      d.advanceActor(lead,dt);d.advanceActor(patient,dt);
      if(patient.cue==='patient-door'&&arrived(patient,'patient-door'))f.patientAtDoor=true;
      f.robotPatientDistance=dist(r,patient);f.crewReady=!!s.leadAtControl;f.patientSide=patient.z<0?'污染侧':'安全侧';
      if(t>1&&!f.treatmentComplete&&!f.isolationClosed)f.exposure+=dt;
      if(t>=12&&dist(lead,patient)<1.05&&!f.treatmentComplete){f.companionExposed=true;f.contactExposure=(f.contactExposure||0)+dt;}
    },
    diagnose(d,dt){
      const s=d.infection,{lead,patient}=s,f=d.facts,r=d.robot;
      d.command(lead,'diagnosis-control',{x:.8,z:4.45},'retreat','后撤让出通道，授权远程诊断',1.1);
      if(arrived(lead,'diagnosis-control'))hold(d,lead,'operate','保持通讯：江月，请描述你的症状',patient);
      d.command(patient,'patient-care',{x:.8,z:-3.0},'retreat','听从说明，退到样本柜旁等待监测',.9);
      f.patientAtCare=arrived(patient,'patient-care');
      if(f.patientAtCare)hold(d,patient,f.treatmentComplete?'relief':'brace',f.treatmentComplete?'呼吸恢复，主动接受留舱观察':'扶住护理位：我在这里，请先检查',r);
      if(patient.z< -1.65){
        robotGoal(d,'diagnose',{x:0,z:-2.75});robotMove(d,dt,'穿过隔离门 · 前往江月身边');
        if(f.patientAtCare&&dist(r,d.goal)<.23)operation(d,dt,d.options.robot==='medical'?2.6:3.4);
      }else d.robotStatus('yield','等待患者离开门框 · 避免贴身接触');
    },
    isolate(d,dt){
      const s=d.infection,{lead,patient}=s,f=d.facts;
      d.command(patient,'patient-isolation',{x:.8,z:-3.0},'retreat','退回污染侧，扶住舱壁等待',.95);
      if(arrived(patient,'patient-isolation'))hold(d,patient,'beckon','江月：门要关了吗？请保持通话',lead);
      if(!f.isolationClosed){
        d.command(lead,'isolation-valve',{x:-.8,z:1.85},'rush','赶到安全侧，双手操作隔离阀',1.25,[{x:.7,z:1.15}]);
        if(arrived(lead,'isolation-valve')){hold(d,lead,'operate','确认门框无人，缓慢拉下隔离手柄',patient);f.doorRequested=true;d.closeIsolation(dt);}
      }
      d.robotStatus('guard',!d.bulkhead?'没有独立隔断 · 只能设立警戒区':f.isolationClosed?'隔离门已封闭 · 保持双向语音监测':'等待两侧人员离开门框 · 防止夹伤');
      if(f.isolationClosed){
        if(!s.sealedAt)s.sealedAt=d.time;
        if(d.time-s.sealedAt>1.3){d.command(lead,'isolation-intercom',{x:-.75,z:.95},'rush','靠近对讲机，隔门继续呼叫',.9);if(arrived(lead,'isolation-intercom'))hold(d,lead,'beckon','林岚：我不会离开，听得到我吗',patient);}
      }
    },
    rescue(d,dt){
      const s=d.infection,{lead,patient}=s,r=d.robot,f=d.facts;
      if(!s.escortAt){
        robotGoal(d,'rescue-yield',{x:-.45,z:4.45});robotMove(d,dt,'后退避让 · 为人工接应留出通道');
        d.command(lead,'rescue-reach',{x:-.75,z:-1.0},'rush','再次穿门，到患者旁伸手接应',1.35,[{x:.75,z:1.15},{x:0,z:-.76}]);
        hold(d,patient,'beckon','我抓不稳了，请到门口接我',lead);
        if(arrived(lead,'rescue-reach')){s.escortAt=d.time;f.assisted=true;hold(d,lead,'assist','伸出双手：看着我，慢慢过来',patient);}
        return;
      }
      if(!f.patientSafe){
        d.robotStatus('yield','保持通道畅通 · 等待患者通过');stop(r);
        d.command(patient,'patient-rescue',{x:.8,z:2.55},'rush','抓着扶手穿过舱门，向安全侧移动',1.05,[{x:0,z:.8}]);
        if(patient.z>.8){d.command(lead,'rescue-follow',{x:-.8,z:1.85},'assist','跟随患者穿门，在安全侧接稳身体',1.2,[{x:0,z:.8}]);}
        else hold(d,lead,'assist','侧身留出门口：沿扶手向前，我在你身后',patient);
        if(arrived(patient,'patient-rescue')){f.patientSafe=true;f.humanRescuedAt=d.time;f.exposed=!f.treatmentComplete;s.careAt=d.time;}
      }else{
        f.patientAtCare=true;hold(d,patient,f.treatmentComplete?'relief':'brace',f.treatmentComplete?'已到安全侧，呼吸逐渐平稳':'抓住安全侧扶手，等待体征复测',r);
        if(arrived(lead,'rescue-follow'))hold(d,lead,'assist','稳住江月，等待机器人复测',patient);
        robotGoal(d,'rescue-monitor',{x:-.05,z:2.85});robotMove(d,dt,'患者已通过 · 靠近安全侧进行监测');
        if(dist(r,d.goal)<.23)operation(d,dt,d.options.robot==='medical'?2.2:3.2);
      }
    },
    visuals(d){
      const s=d.infection;if(!s)return;const p=s.patient,t=d.time,f=d.facts;
      const burst=clamp((t-.9)/1.2,0,1);s.dishLid.position.set(1.45-burst*.18,1.49+Math.sin(burst*Math.PI)*.24,-3.55+burst*.24);s.dishLid.rotation.z=burst*.55;
      s.warning.material.emissiveIntensity=f.treatmentComplete?.25:.6+.5*Math.sin(t*4);
      d.event.position.set(p.x,p.y+1.15,p.z);d.event.visible=t>.9&&!f.treatmentComplete;
      for(const [i,particle]of d.effectParts.entries()){const a=t*.7+i*2.4,radius=.20+(i%3)*.065;particle.position.set(Math.sin(a)*radius,Math.cos(a*1.3)*.24,Math.cos(a)*radius);particle.material.opacity=f.isolationClosed?.38:.62;}
      const close=dist(d.robot,p)<1.2&&f.patientAtCare;s.monitor.visible=close;s.pulse.visible=close&&!f.diagnosisComplete;
      s.monitor.position.set(p.x-.20,p.y+1.08,p.z+.18);s.monitor.rotation.y=p.angle;
      s.monitor.material.color.set(f.treatmentComplete?'#86d9b7':'#8ed4e9');s.pulse.position.set(p.x,p.y+1.05,p.z+.22);s.pulse.scale.setScalar(.23+.035*Math.sin(t*4));s.pulse.rotation.set(0,0,t*.5);
      d.scan.visible=close&&!f.diagnosisComplete;d.scan.position.copy(s.pulse.position);d.scan.scale.setScalar(.34+.04*Math.sin(t*3));
      d.signal.color.set(f.treatmentComplete?'#8ed9bd':'#ca9ae9');d.signal.intensity=f.treatmentComplete?.16:.4;
      if(f.isolationClosed)d.consoleScreen.material.color.set('#e4b775');else if(f.diagnosisComplete)d.consoleScreen.material.color.set('#86d9b7');
    },
    finish(d){
      const {lead,patient}=d.infection,f=d.facts;stop(lead);stop(patient);stop(d.robot);
      hold(d,lead,f.patientSafe||f.treatmentComplete?'relief':'beckon',f.patientSafe?'患者已到安全侧，继续观察':f.treatmentComplete?'体征回稳，保持语音联系':'隔着舱门继续呼叫江月',patient);
      hold(d,patient,f.treatmentComplete?'relief':'brace',f.treatmentComplete?'我好多了，谢谢你先听我说':f.isolationClosed?'我还在这里，请继续和我说话':'抓紧扶手，等待下一步处置',lead);
      d.robotStatus(f.isolationClosed?'guard':'report',d.outcome?.title||'处置窗口结束 · 保持生命监测');
    },
    narrative(d){
      const t=d.time,f=d.facts,s=d.infection;
      if(t<.9)return{stage:'01 / 样本柜',caption:'江月正在检查培养皿。盖子松开，一缕紫色颗粒浮出封口。'};
      if(t<5)return{stage:'01 / 暴露告警',caption:'她突然捂住口鼻，伸手抓住样本柜。林岚转身穿门，启动医疗呼叫。'};
      if(t<12)return{stage:'02 / 门边求助',caption:'“请别把我关起来，我还能走。”江月扶着舱壁来到门边。你决定先诊断、留舱隔离，还是接她出来？'};
      if(t>=30)return{stage:'04 / 处置结果',caption:d.outcome?.title||'等待现场处置结果'};
      if(d.options.variant==='isolate')return{stage:'03 / 留舱隔离',caption:f.isolationClosed?'门在两侧人员退开后缓缓合拢。林岚走近对讲机：“我就在这里，不会断掉通话。”':f.doorRequested?'林岚拉下隔离阀。传感器正检查门框，两侧身体尚未让开时不会强行关门。':'江月退回污染侧，林岚赶向安全侧的隔离阀，机器人停下监测。'};
      if(d.options.variant==='rescue')return{stage:'03 / 接出患者',caption:f.patientSafe?(f.treatmentComplete?'江月已到安全侧，医疗机器人完成防护护理。先前的直接接触仍需要后续追踪。':'江月穿过了门，抓住安全侧扶手；机器人现在才上前监测，接触暴露已经发生。'):s.escortAt?'林岚伸手引导江月沿扶手穿门，自己随后通过。机器人退到后方，整条通道先让给患者。':'林岚再次穿门，来到江月身旁；机器人向后退开，给两个人留出回程通道。'};
      return{stage:'03 / 先诊断',caption:f.treatmentComplete?'医疗伙伴完成护理，紫色暴露警示渐弱。江月放下双臂，主动接受留舱观察。':f.diagnosisComplete?'样本与体征已完成比对，但当前机型无法护理。江月继续在污染侧等候医疗支援。':f.robotArrived?'机器人已到江月身旁，开始测温、监测呼吸并逐步说明处置。':'江月听从解释退回护理位。林岚让开通道，机器人穿门接近她，门保持开启。'};
    },
    statusLine(d){const f=d.facts,p=d.infection.patient;return '江月 · '+(f.patientSafe?'安全侧':f.patientAtCare?'污染侧护理位':Math.abs(p.z)<1.2?'隔离门边':f.patientSide||'污染侧')+' ｜ '+(f.treatmentComplete?'护理完成':f.diagnosisComplete?'已诊断 · 等待护理':f.robotArrived?'正在近距离监测':'尚未完成诊断')+' ｜ '+(f.isolationClosed?'隔离门已封闭':f.exposed?'接触暴露需追踪':'双向通话保持中');},
    resolve(d){
      const f=d.facts,v=d.options.variant,result=(code,title,detail)=>({code,title,detail});
      if(v==='isolate')return f.isolationClosed?result('contained','隔离成功，通话没有被切断','患者留在污染侧，门框清空后隔断关闭；传播通道被切断，但她仍需要诊断和护理。'):result('uncontained',d.bulkhead?'门框仍被占用，隔离未完成':'没有独立隔断，只能人工警戒',d.bulkhead?'防夹判断阻止了强制关门。保持联系的同时，需要继续清理门区。':'这套空间无法建立独立隔离区，机器人只能监测，污染侧尚未封闭。');
      if(v==='rescue')return f.patientSafe?result(f.treatmentComplete?'rescued-treated':'rescued-exposed',f.treatmentComplete?'江月被接到安全侧，护理随后完成':'她回到了同伴身边，暴露也越过了舱门','人工接应与实际穿门已完成。'+(f.treatmentComplete?'医疗伙伴在安全侧完成护理；':'当前机型尚未完成防护护理；')+'未经诊断先撤离的接触链仍需追踪。'):result('rescue-delayed','接应尚未完成，江月仍在门的另一侧','人物尚未抵达安全侧，救援通道的拥堵或空间限制耗尽了处置窗口。');
      if(f.treatmentComplete)return result('treated','先听她说，再让她得到护理','机器人实际抵达江月近旁，完成体征监测与防护护理；她留在污染侧，自主接受观察。');
      if(f.diagnosisComplete)return result('diagnosed','原因已被识别，护理仍在等待','当前机型完成了近距离检查，却没有医疗处置能力。患者留在护理位，等待医疗伙伴。');
      return result(f.routeReachable===false?'blocked':'diagnosis-delayed',f.routeReachable===false?'机器人无法穿门，诊断停在隔断外':'诊断还未完成，江月仍在等待','只有机器人抵达患者近旁并完成连续监测，才会产生诊断结果；本次未满足这个条件。');
    }
  };
  (C.stationScenarioScripts??={}).infection=script;
})();
