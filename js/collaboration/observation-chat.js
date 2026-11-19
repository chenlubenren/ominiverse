/* In-scene chat. Register before the original game keyboard handlers. */
(() => {
  'use strict';
  const C=window.CoScene=window.CoScene||{};
  window.addEventListener('keydown',event=>window.IndoorLab?.collaboration?.chat?.handleKey(event),true);
  for(const type of ['pointerdown','pointerup','click','dblclick','contextmenu'])window.addEventListener(type,event=>window.IndoorLab?.collaboration?.chat?.handlePointer(event),true);
  class ObservationChat {
    constructor(owner){
      this.owner=owner;this.markers=new C.SceneMarkers(owner);this.commands=new C.SceneCommands(owner);this.messages=[];this.editing=false;this.composing=false;this.compositionEnded=-Infinity;
      this.root=document.createElement('section');this.root.id='co-observation-chat';this.root.hidden=true;this.root.setAttribute('aria-label','场景聊天');
      this.root.innerHTML='<div id="co-observation-log" role="log" aria-label="消息记录" aria-live="polite" aria-relevant="additions" tabindex="0"></div><button id="co-chat-activate" type="button"><span>↵</span> 按 Enter 输入消息</button><form id="co-observation-form" hidden><label for="co-observation-input">我</label><textarea id="co-observation-input" rows="1" maxlength="500" placeholder="说点什么…" autocomplete="off" aria-label="发送场景消息" title="Enter 发送 · Shift+Enter 换行 · Esc 收起"></textarea><button type="submit" aria-label="发送消息" title="Enter 发送">↵</button><div class="co-chat-tools"><button id="co-chat-pin" type="button" aria-pressed="false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 18s6-6.3 6-11A6 6 0 0 0 4 7c0 4.7 6 11 6 11Z"/><circle cx="10" cy="7" r="2"/></svg>标记位置</button><div id="co-chat-location" hidden><span></span><button type="button" aria-label="移除位置标记">×</button></div><span class="co-chat-escape">Esc 收起</span></div></form>';
      document.body.appendChild(this.root);this.log=document.getElementById('co-observation-log');this.input=document.getElementById('co-observation-input');this.form=document.getElementById('co-observation-form');this.activate=document.getElementById('co-chat-activate');
      this.locationChip=document.getElementById('co-chat-location');this.pinButton=document.getElementById('co-chat-pin');this.pinButton.onclick=()=>this.togglePick();this.locationChip.querySelector('button').onclick=()=>{this.markers.remove(this.pendingLocation.id);this.pendingLocation=null;this.locationChip.hidden=true;this.input.focus();};
      this.pickHint=document.createElement('div');this.pickHint.id='co-location-pick-hint';this.pickHint.hidden=true;this.pickHint.textContent='点击场景标记位置 · Esc 取消';document.body.appendChild(this.pickHint);
      this.activate.onclick=()=>this.open();this.form.onsubmit=e=>{e.preventDefault();if(!this.composing)this.send();};
      this.input.addEventListener('compositionstart',()=>this.composing=true);
      this.input.addEventListener('compositionend',()=>{this.composing=false;this.compositionEnded=performance.now();});
      this.input.addEventListener('input',()=>this.resizeInput());
      this.root.addEventListener('click',e=>e.stopPropagation());
      document.addEventListener('pointerdown',e=>{if(this.editing&&!this.picking&&!this.root.contains(e.target))this.close(false);},true);
      document.addEventListener('focusin',e=>{if(this.editing&&!this.picking&&!this.root.contains(e.target))this.close(false);});
      document.addEventListener('pointerlockchange',()=>{if(this.editing&&!document.pointerLockElement)this.input.focus({preventScroll:true});});
      window.addEventListener('blur',()=>this.close(false));
      this.phaseObserver=new MutationObserver(()=>this.sync());this.phaseObserver.observe(document.body,{attributes:true,attributeFilter:['data-building-phase','data-co-environment','data-exploration']});
      this.layoutObserver=new ResizeObserver(()=>{if(this.inputWidth!==this.input.clientWidth){this.inputWidth=this.input.clientWidth;this.resizeInput();}this.syncLayout();});this.layoutObserver.observe(this.root);
      window.addEventListener('resize',()=>{this.resizeInput();this.syncLayout();});
      this.sync();
    }
    available(){return !window.IndoorLab.firstPersonMode?.active&&(this.owner.environment!=='office'||this.owner.b.phase!=='intro');}
    syncLayout(){
      const clearance=this.root.hidden?0:Math.ceil(innerHeight-this.root.getBoundingClientRect().top+12);
      if(this.clearance===clearance)return;this.clearance=clearance;document.body.style.setProperty('--co-chat-clearance',clearance+'px');
    }
    resizeInput(){
      // Draft growth never changes the log height selected with the resize handle.
      if(!this.editing){this.root.style.removeProperty('--co-chat-input-height');this.input.style.removeProperty('overflow-y');this.syncLayout();return;}
      const lineHeight=parseFloat(getComputedStyle(this.input).lineHeight)||20;
      this.input.style.height='0px';const contentHeight=this.input.scrollHeight;
      const height=Math.max(28,Math.min(contentHeight,lineHeight*5+6,innerHeight*.24));
      this.input.style.removeProperty('height');this.root.style.setProperty('--co-chat-input-height',height+'px');this.input.style.overflowY=contentHeight>height?'auto':'hidden';this.syncLayout();
    }
    sync(){
      const available=this.available();this.root.hidden=!available;document.body.toggleAttribute('data-co-chat',available);this.markers.update();this.syncLayout();
      if(!available){this.close(false);return;}
      if(!this.started){this.started=true;this.add('观测已开始。按 F 隐藏或恢复界面，聊天保留；按 Enter 输入。试试“放置绿植”“装饰改成橙色”“放置送餐机器人”，或发送“帮助”查看场景操作。','现场');}
    }
    stopMovement(){this.owner.v.walkKeys.clear();const fp=this.owner.v.firstPerson;if(fp){fp.velocity.set(0,0);fp.speed=0;fp.jumpRequested=false;}}
    open(){
      if(!this.available()||document.querySelector('dialog[open]')||this.owner.switching)return;
      // An unsent pin from another scene would send the next command back there.
      if(this.pendingLocation&&this.pendingLocation.environment!==this.owner.environment){this.markers.remove(this.pendingLocation.id);this.pendingLocation=null;this.locationChip.hidden=true;}
      this.sync();this.editing=true;this.root.classList.add('is-editing');this.form.hidden=false;this.activate.hidden=true;
      this.stopMovement();if(document.pointerLockElement)document.exitPointerLock();
      this.resizeInput();requestAnimationFrame(()=>{if(this.editing)this.resizeInput();});
      this.input.focus({preventScroll:true});this.log.scrollTop=this.log.scrollHeight;
    }
    close(focusScene=true){
      if(!this.editing)return;this.abandonPick();this.editing=false;this.composing=false;this.form.hidden=true;this.activate.hidden=false;this.root.classList.remove('is-editing');this.stopMovement();
      this.resizeInput();
      this.log.scrollTop=this.log.scrollHeight;
      if(focusScene)this.owner.v.renderer.domElement.focus({preventScroll:true});
    }
    handleKey(event){
      if(!this.available())return;
      if(!this.editing&&event.target.closest?.('.co-message-location'))return;
      if(this.editing&&this.root.contains(event.target)){
        // Stop the original movement, interaction and menu shortcuts while typing.
        event.stopImmediatePropagation();
        if(event.isComposing||event.keyCode===229||this.composing)return;
        if(event.key==='Escape'){event.preventDefault();if(this.picking)this.abandonPick();else this.close();}
        else if(event.key==='Enter'&&event.target===this.input){if(event.shiftKey&&!event.ctrlKey&&!event.metaKey&&!event.altKey)return;event.preventDefault();if(!event.repeat&&performance.now()-this.compositionEnded>80){if(this.picking)this.cancelPick();else this.send();}}
        return;
      }
      const typing=event.target.closest?.('input,textarea,select,[contenteditable="true"]')||event.target.closest?.('button,a[href],summary,[role="button"],[role="tab"]')?.matches(':focus-visible');
      if(event.key==='Enter'&&!event.repeat&&!event.isComposing&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!typing&&!document.querySelector('dialog[open]')&&!this.owner.switching){event.preventDefault();event.stopImmediatePropagation();this.open();}
    }
    togglePick(){
      const o=this.owner,scenarios=o.stationExperience?.scenarios;if(scenarios?.blocksObservation??scenarios?.active){this.cancelPick();this.add('请先发送“停止剧情”返回日常观察，再标记舱内位置。','未执行');return;}
      if(o.environment==='station'&&(o.stationExperience.shellStudy?.changed||o.stationExperience.morphBusy)){this.cancelPick();this.add('当前为外壳预览，请先恢复原貌，再标记舱内位置。','未执行');return;}
      if(this.picking){this.abandonPick();return;}const station=o.stationExperience,back=o.environment==='station'&&station.phase!=='interior'?{phase:station.phase,selected:station.selected,key:o.key()}:null;if(back)station.enter(station.selected,{animate:false});this.picking=true;this.pickReturn=back;this.pinButton.setAttribute('aria-pressed','true');this.pickHint.textContent='点击场景标记位置 · Esc 取消';this.pickHint.hidden=false;document.body.classList.add('co-picking-location');this.input.focus({preventScroll:true});
    }
    // A cancelled pick leaves the cabin that picking entered on its own; a placed pin stays inside.
    abandonPick(){const back=this.picking&&this.pickReturn,o=this.owner,s=o.stationExperience;this.cancelPick();if(!back||back.key!==o.key()||o.environment!=='station'||s.phase!=='interior'||s.selected!==back.selected)return;if(back.phase==='focus')s.returnToSelection();else s.overview();}
    cancelPick(){this.picking=false;this.pickReturn=null;this.pinButton.setAttribute('aria-pressed','false');this.pickHint.hidden=true;document.body.classList.remove('co-picking-location');}
    handlePointer(event){
      if(!this.picking||event.target!==this.owner.v.renderer.domElement)return;
      event.preventDefault();event.stopImmediatePropagation();if(event.type!=='click'||event.button!==0)return;
      const location=this.markers.pick(event);if(!location){this.pickHint.textContent='请点击建筑楼层或场景内的地面 · Esc 取消';return;}
      if(this.pendingLocation)this.markers.remove(this.pendingLocation.id);this.pendingLocation=location;this.markers.show(location,true);this.locationChip.querySelector('span').textContent='⌖ '+(window.IndoorLab.brandNeutralText?.(this.markers.label(location))??this.markers.label(location));this.locationChip.hidden=false;this.cancelPick();this.input.focus({preventScroll:true});
    }
    send(){const text=this.input.value.trim(),location=this.pendingLocation;if(text||location){this.add(text||'位置标记','我',location);if(location)this.markers.show(location);this.input.value='';this.pendingLocation=null;this.locationChip.hidden=true;}this.close();if(text)this.lastCommand=this.commands.execute(text,location);}

    add(text,sender='现场',location=null){
      const content=String(text).trim().slice(0,500);if(!content)return;
      const stickToBottom=!this.editing||this.log.scrollHeight-this.log.scrollTop-this.log.clientHeight<35;
      const message={text:content,sender,scene:this.owner.key(),time:Date.now(),location};this.messages.push(message);
      const row=document.createElement('p');row.className='co-observation-message';const label=document.createElement('span');label.textContent=window.IndoorLab.brandNeutralText?.(sender)??sender;const body=document.createElement('span');body.textContent=window.IndoorLab.brandNeutralText?.(content)??content;if(location){const pin=document.createElement('button');pin.type='button';pin.className='co-message-location';pin.textContent='⌖ '+(window.IndoorLab.brandNeutralText?.(this.markers.label(location))??this.markers.label(location));pin.title='查看标记位置';pin.onclick=()=>this.markers.reveal(location);body.appendChild(pin);}row.append(label,body);this.log.appendChild(row);
      while(this.messages.length>80){this.messages.shift();this.log.firstElementChild.remove();}
      if(stickToBottom)this.log.scrollTop=this.log.scrollHeight;
    }
    event(event){if(['join','remove','complete','task','reset'].includes(event.type))this.add(event.text);}
  }
  C.ObservationChat=ObservationChat;
})();
