/* Keep imported experiments inside the existing chat and single render loop. */
(() => {
  'use strict';
  const L=window.IndoorLab,C=window.CoScene,$=id=>document.getElementById(id);
  const ignored=/不要|不能|别生成|不想|不需要|没有|不会|未发生|避免|防止|如果|假如|假设|是否|能否|怎么办|如何|怎么|为什么|介绍|是什么|吗|[?？]/;
  const subjects=/火灾|起火|着火|灭火|地震|爆炸|坍塌|崩塌|感染|传染|通风|污染|丧尸|僵尸|怪物|复仇女神|巨构|巨型|飞龙|章鱼|八爪|猎蛛|猎蜘|巨蛇|泰坦|机器人|机器狗|钢铁军团|\bG1\b|\bGo2\b|\bSpot\b|门|这栋楼|大楼/i;
  const verbs=/调用|打造|定制|设计|叛变|叛乱|平息|解除|生成|制作|制造|创建|派|部署|出现|释放|召唤|发生|触发|启动|模拟|点燃|引爆|攻击|进攻|巡逻|爬|停火|停止|清除|移除|收回|暂停|继续|恢复|关闭|打开|开启|封锁|灭火|扑灭|复原|还原|重置/;
  const examples=['12层发生火灾，然后关闭所有房间的门','灭火','15层生成3台机器狗，用激光攻击人类','打造3个蓝色机器狗在11层乱走','11层机器人叛变','解除全楼机器人叛变','生成2个飞龙机器人','攻击这栋楼','停止攻击这栋楼','20层发生爆炸','地震，强度最大','通风污染','逐层传播演示','复原'];
  class EventIntegration {
    constructor(owner){
      this.owner=owner;this.lastUI=-Infinity;this.lastEnvironment=owner.environment;this.allowRemote=false;this.busy=false;
      L.initializeDisasterExtensions?.(owner.b);
      L.initializeRobotSystems?.(owner.b);
      L.initializeRobotLibrary?.();
      this.createUI();this.installResize();
    }
    createUI(){
      const open=document.createElement('button');open.id='co-event-tools';open.className='co-action';open.textContent='事件与机器人实验';open.onclick=()=>this.open();
      $('collaboration-panel').querySelector('.co-panel-actions').append(open);
      const shortcut=document.createElement('button');shortcut.id='co-event-shortcut';shortcut.type='button';shortcut.textContent='事件实验';shortcut.onclick=()=>this.open();
      this.owner.chat.root.append(shortcut);
      const dialog=document.createElement('dialog');dialog.id='co-event-dialog';dialog.setAttribute('aria-labelledby','co-event-title');
      dialog.innerHTML='<header class="co-heading"><div><small>SCENE EXPERIMENTS</small><h2 id="co-event-title">事件与机器人实验</h2></div><button class="co-close" aria-label="关闭事件实验">×</button></header><p class="co-note">在现有空间里观察事件、机器人与人员反应。选择示例会填入聊天框，按 Enter 执行。</p><p id="co-event-scope" role="status"></p><div id="co-event-stats" aria-live="polite"></div><p id="co-event-robot-status"></p><div id="co-event-examples"></div><div class="co-panel-actions"><button id="co-event-library" class="co-action">机器人库与生成</button><button id="co-event-army" class="co-action">机器人对抗实验</button><button id="co-event-observe" class="co-action">第一人称观察</button><button id="co-event-reset" class="co-action">复原实验</button></div><label class="co-event-cloud"><input id="co-event-cloud" type="checkbox"> 使用已配置的智能服务理解事件描述</label><p class="co-note">未开启时使用本地指令。智能服务需要有效配置；新外形可在“机器人库与生成”中使用自己的模型生成服务密钥生成，预览后确认入库。</p><div id="co-event-air"></div><details id="co-event-appearance"><summary>主题与画面</summary><label>场景风格<select id="co-event-style"></select></label><label>输出采样<select id="co-event-sampling"><option value="1">原生清晰</option><option value="1.5">1.5× 超采样</option></select></label><p class="co-note">默认保留当前白蓝空间。空间站使用独立灯光。</p></details>';
      document.body.append(dialog);this.dialog=dialog;
      dialog.querySelector('.co-close').onclick=()=>dialog.close();
      this.renderExamples();
      $('co-event-cloud').onchange=e=>{this.allowRemote=e.target.checked;};
      $('co-event-library').onclick=()=>{dialog.close();L.robotLibrary?.open();};
      $('co-event-army').onclick=()=>{dialog.close();L.robotSystems?.open?.();};
      $('co-event-observe').onclick=async()=>{dialog.close();await L.firstPersonMode?.start('observe');};
      $('co-event-reset').onclick=async()=>{dialog.close();if(this.owner.environment==='station')await this.owner.chat.commands.execute(this.owner.stationExperience?.scenarios?.blocksObservation?'停止剧情':'清除事件');else await this.run('复原');};
      for(const id of ['virus-lifetime-control','air-experiment-metrics']){const node=$(id);if(node)$('co-event-air').append(node);}
      const styles=$('co-event-style');for(const [value,style]of Object.entries(L.RENDER_STYLES)){const option=document.createElement('option');option.value=value;option.textContent=style.label;styles.append(option);}
      styles.value=this.owner.v.pipeline.style;styles.onchange=()=>{if(this.owner.environment!=='station')this.owner.b.setRenderStyle(styles.value);};
      const tint=this.owner.themeTint||$('mirror-edge-color')?.closest('label');if(tint){$('co-event-appearance').append(tint);tint.hidden=styles.value!=='mirror-edge';}
      $('co-event-sampling').value=String(this.owner.v.pipeline.pixelScale);$('co-event-sampling').onchange=e=>this.owner.v.pipeline.setPixelScale(Number(e.target.value));
      const badge=document.createElement('button');badge.id='co-event-population';badge.type='button';badge.hidden=true;badge.onclick=()=>this.open();badge.setAttribute('aria-label','查看事件人数统计');this.owner.chat.root.prepend(badge);this.badge=badge;
      this.refresh();
    }
    installResize(){
      const chat=this.owner.chat,grip=document.createElement('button');grip.id='co-chat-resize';grip.type='button';grip.setAttribute('aria-label','拖动或按上下箭头调整聊天记录高度');grip.innerHTML='<span></span>';
      chat.root.prepend(grip);
      const resize=height=>{chat.root.style.setProperty('--co-chat-log-height',Math.max(80,Math.min(innerHeight*.55,height))+'px');chat.syncLayout();};
      grip.onpointerdown=e=>{e.preventDefault();const y=e.clientY,height=chat.log.getBoundingClientRect().height;grip.setPointerCapture(e.pointerId);grip.onpointermove=next=>resize(height+y-next.clientY);};
      grip.onpointerup=grip.onpointercancel=()=>{grip.onpointermove=null;};
      grip.onkeydown=e=>{if(!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();resize(chat.log.getBoundingClientRect().height+(e.key==='ArrowUp'?32:-32));};
    }
    renderExamples(){
      const station=this.owner.environment==='station',key=station?'station':'ground';
      if(this.examplesEnvironment===key)return;this.examplesEnvironment=key;
      const list=$('co-event-examples');list.replaceChildren();list.dataset.environment=key;
      const entries=station?(C.stationEventPresets||[]):examples.map(command=>({command,title:command}));
      for(const entry of entries){
        const button=document.createElement('button');button.type='button';button.dataset.eventPreset=entry.id||'';
        button.textContent=entry.command;
        button.onclick=()=>{this.dialog.close();this.owner.chat.open();this.owner.chat.input.value=entry.command;this.owner.chat.resizeInput?.();};
        list.append(button);
      }
    }
    open(){
      if(this.owner.switching)return;
      $('collaboration-panel')?.close();this.owner.chat.close(false);if(document.pointerLockElement)document.exitPointerLock();this.dialog.showModal();this.refresh();
    }
    recognizes(text,command){
      if(window.DisasterCommands?window.DisasterCommands.isNonCommand(text):ignored.test(text))return false;
      if(/^逐层传播演示$/.test(text.trim()))return true;
      if(command.action!=='station-scenario'){if(/叛变|叛乱|造反|反叛|暴走/.test(text)&&/机器人|机器狗|机械人/.test(text))return true;try{if(L.robotLibrary?.plan(text,{floor:this.owner.b?.selected,interior:this.owner.b?.phase==='interior'}))return true;}catch{return true;}}
      if(command.action==='disaster'&&this.owner.environment==='campus')return true;
      if(['station-scenario','help','lift','decoration','place-object','undo-decoration','clear-decoration','disaster','clear'].includes(command.action))return false;
      // Singular cooperative placement keeps its existing task and placement flow.
      if(command.action==='robot'&&!/攻击|进攻|子弹|激光|近战|大军|军队|打造|定制|待命|乱走|巡游|[2-9二三四五六七八九十百]\s*(台|个|只)/.test(text))return false;
      if(/^(?:第?\s*[0-9零一二两三四五六七八九十百]+\s*[楼层fF]\s*)?(呼吸道感染|呼吸感染|通风污染|空气污染|通风感染)$/.test(text.trim()))return true;
      if(/^(?:第?\s*[0-9零一二两三四五六七八九十百]+\s*[楼层fF]\s*)?(最大|最强|最高|强烈|轻微|严重)(强度)?(地震|爆炸|火灾)$/.test(text.trim()))return true;
      return /^(复原|还原|重置|暂停|暂停模拟|继续|继续模拟|恢复模拟|恢复初始状态|呼吸感染|通风污染|通风感染|灭火)$/.test(text.trim())||/^(?:第?\s*[0-9零一二两三四五六七八九十百]+\s*[楼层fF]\s*)?(地震|爆炸|火灾|通风污染|呼吸感染)[，,\s]*(强度)?[为是：:\s]*(最大|最强|最高|强烈|轻微|严重)$/.test(text.trim())||subjects.test(text)&&verbs.test(text);
    }
    async tryHandle(text,location,command){
      if(!this.recognizes(text,command))return false;
      await this.run(command.action==='disaster'&&command.type==='zombie'?'丧尸感染':text,location);return true;
    }
    async run(text,location){
      const o=this.owner,chat=o.chat;
      if(o.environment==='station'||location?.environment==='station'){chat.add('这些事件接入办公楼与园区。空间站保留独立剧情，请切回地面场景后执行。','未执行');return;}
      if(location&&location.environment!==o.environment){chat.add('位置标记与当前场景不同，请先回到标记所在场景。','未执行');return;}
      if(this.busy||o.chat.commands.busy||o.chat.commands.routing||o.switching||o.app.busy||o.b.loading||o.b.matrixLab?.active||o.robotInteraction?.pending){chat.add('场景正在处理上一项操作，请稍后再次发送。','未执行');return;}
      if(!L.disasterDirector){chat.add('事件系统还在准备，请稍后重试。','未执行');return;}
      const floorMatch=text.match(/(?:第\s*)?([0-9零一二两三四五六七八九十百]+)\s*(?:楼|层|[fF])/);
      if(floorMatch&&location?.floor&&window.DisasterCommands.number(floorMatch[1])!==location.floor){chat.add('文字楼层与位置标记不一致，请保留同一个目标楼层。','未执行');return;}
      this.busy=true;const environment=o.environment;
      try{
        const result=await L.disasterDirector.executeText(text,{environment,floor:location?.floor||o.b.selected,position:location?{x:location.x,z:location.z}:undefined,allowRemote:this.allowRemote});
        if(o.environment!==environment)return;
        chat.add(result?.message||result?.reply||(result?.actions?.length?'事件已执行。':'这条事件描述没有执行，请使用事件面板中的示例。'),result?.actions?.length?'已执行':'未执行');
        if(result?.warning)chat.add(result.warning,'提示');
      }catch(error){chat.add(error.message||'事件执行失败，请重试。','未执行');}
      finally{this.busy=false;this.refresh();}
    }
    refresh(){
      const o=this.owner,station=o.environment==='station',counts=L.scenarioRuntime?.counts?.();
      $('co-event-robot-status').hidden=station;const conflict=L.robotConflict;if(conflict){const records=[...conflict.records];$('co-event-robot-status').textContent='机器人：叛变 '+records.filter(r=>r.alive!==false&&r.robotCombat?.rebel).length+' · 反击 '+records.filter(r=>r.alive!==false&&!r.robotCombat?.rebel&&r.robotCombat?.known?.size).length+' · 损毁 '+(conflict.stats.destroyed||0)+' · 掉落物品 '+(L.robotCargo?.fx.parts.length||0);}
      $('co-event-air').hidden=station;if(this.dialog.open&&!station)L.app.refreshAirMetrics?.();
      this.renderExamples();
      $('co-event-title').textContent=station?'空间站事件实验':'事件与机器人实验';
      this.dialog.querySelector('.co-note').textContent=station?'在当前空间站观察事件与人员、机器人的反应。选择示例会填入聊天框，按 Enter 执行；事件自动发展，左侧舱内画面实时显示乘员与机器人，可自由转动视角和进入舱段观察。':'在现有空间里观察事件、机器人与人员反应。选择示例会填入聊天框，按 Enter 执行。';
      $('co-event-scope').textContent=station?'当前：空间站 · 轨道交会、空间碎片、太阳风暴、舱段故障与天地通话。':'当前：'+o.locationName();
      $('co-event-tools').textContent=station?'空间站事件实验':'事件与机器人实验';$('co-event-shortcut').textContent='事件实验';
      for(const id of ['co-event-library','co-event-army','co-event-observe','co-event-cloud','co-event-style'])$(id).disabled=station;
      $('co-event-reset').disabled=false;$('co-event-reset').textContent=station?(o.stationExperience?.scenarios?.blocksObservation?'停止剧情 · 返回日常':'清除事件'):'复原实验';
      for(const node of [$('co-event-library'),$('co-event-army'),$('co-event-observe'),this.dialog.querySelector('.co-event-cloud'),this.dialog.querySelector('.co-event-cloud').nextElementSibling,$('co-event-appearance')])node.hidden=station;
      $('co-event-observe').disabled=station||!L.firstPersonMode||L.firstPersonMode.starting;
      if(station){const director=o.stationExperience?.scenarios,state=director?.snapshot?.(),liveEvent=!!director?.film?.liveEvent||!!state?.orbitalEvent;$('co-event-stats').textContent=state?.active?(liveEvent?'当前空间站事件：':'正在放映：')+state.title+(state.paused?' · 已暂停':''):(C.stationEventPresets?.length||0)+' 种事件 · 在当前空间站自由观察';this.badge.hidden=true;this.statsText=null;}
      else if(counts){const summary='存活 '+counts.alive+' / '+counts.initial+' · 感染 '+counts.infected+' · 丧尸 '+counts.zombies+' · 伤亡 '+counts.dead;
        const details=summary+' · 楼内 '+counts.inside+' · 楼外 '+counts.outside;
        if(this.statsText!==details){this.statsText=details;$('co-event-stats').textContent=details;this.badge.textContent=summary;}
        this.badge.hidden=station||!(counts.dead||counts.infected||counts.zombies||L.disasterDirector?.fires.size||L.disasterDirector?.physics||L.robotArmy?.robots.length||L.megastructureFleet?.robots?.length);
      }
    }
    presentFrame(){
      L.robotSystems?.presentFrame?.();
      L.robotLibrary?.render();
      L.disasterDirector?.syncPresentation?.();
    }
    update(dt,now){
      const o=this.owner,environment=o.environment,active=environment!=='station'&&!o.switching&&!document.hidden&&!$('robot-studio')?.open&&!L.robotLibrary?.panel?.open&&!L.robotLibrary?.studio?.open;
      const running=environment==='campus'?o.externalRunning:o.b.phase==='interior'?o.app.running:o.b.society.running;
      const elapsed=active&&running?dt*(environment==='campus'?o.rate:o.b.society.speed*(o.b.phase==='interior'?o.app.rate:1)):0;
      L.robotSystems?.update(elapsed,now,environment,o.switching);
      L.disasterDirector?.update(elapsed,{active,running,isTransitioning:o.switching,environment});
      if(o.switching||environment!==this.lastEnvironment){L.robotLibrary?.close();this.lastEnvironment=environment;this.refresh();}
      if(now-this.lastUI>500){this.lastUI=now;this.refresh();}
    }
  }
  C.EventIntegration=EventIntegration;
  function boot(){if(!L.collaboration?.ready||!L.initializeDisasterExtensions||!L.initializeRobotSystems){setTimeout(boot,100);return;}L.eventIntegration=new EventIntegration(L.collaboration);}
  boot();
})();
