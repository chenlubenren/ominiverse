/* Explicit placement and readable, live robot intentions. */
(() => {
  'use strict';const clean=value=>window.IndoorLab?.brandNeutralText?.(value)??String(value??''),C=window.CoScene,T=THREE,$=id=>document.getElementById(id);
  C.robotTaskSuggestions={assist:'与一位空闲同事核对交接；工位不便靠近时，到附近交接点会合。',deliver:'从补给点领取物品，送给同事；无法会合时，送到公共交接点待领取。',inspect:'独立检查本层最多三个公共区域，记录已检查和无法到达的地点。',supply:'从补给点领取物资，运送到另一个可达的公共服务点，完成定点补给。','inspect-deliver':'先巡检三个公共区域，再从补给点取件并递送给同事。','inspect-supply':'先巡检三个公共区域，再领取物资，送到公共服务点完成定点补给。','deliver-inspect':'先从补给点取件并递送给同事，再巡检三个公共区域。'};
  C.parseRobotMission=text=>{
    const value=String(text||'').trim();if(!value)return{task:null,error:'请写下任务，或选择一条建议。'};
    if(value.length>160)return{task:null,error:'任务描述超过 160 字，请缩短后重新确认。原文已保留，不会只执行其中一部分。'};
    const preset=Object.entries(C.robotTaskSuggestions).find(([,description])=>description===value);if(preset)return{task:preset[0],error:null};
    if(/不要|不需要|取消|跳舞|唱歌|做饭|烹饪|维修|修理|灭火|急救|打扫|清洁|消毒|拍照|摄影|录像|摄像|测温|测量|战斗|攻击|飞出|出舱|上楼|下楼|跨层|跨舱|如果|假如|一旦|直到|每隔|每分钟|每天|循环|反复|一直|定时|所有|全部|[0-9一二两三四五六七八九十]+(?:楼|层|秒|分钟|米)|(?:[2-9]|[1-9][0-9]+|[二两三四五六七八九十]+)次|[四五六七八九十]+(?:个|处)|(?:^|[^0-9])(?:[4-9]|[1-9][0-9]+)(?:个|处)/.test(value))return{task:null,error:'这段描述包含尚未接入的动作、次数、范围或条件。当前支持当前空间内的一轮任务、最多三个巡检点，以及明确的两段顺序。请调整任务。'};
    const recipientGroup=value.match(/(?:给|与)([^，。；;\s]+)/)?.[1]||'';
    if(/[、和及与]|以及/.test(recipientGroup))return{task:null,error:'当前一轮只支持一位协作对象，请只保留一个收件人。'};
    if((value.match(/递送(?:给)?|送餐|送水|送给|送到|交给|配送|deliver/gi)||[]).length>1)return{task:null,error:'当前一轮只支持一次递送，多个递送动作请分成独立任务。'};
    // Temporal clauses must be checked even when their next action is unknown.
    // Keep 后/时 inside location or equipment words such as 后台、后勤、计时器.
    const separated=value.replace(/完成后|之后|以后|过后|的时候|期间|(?<!然|最|随|售|幕|背|前)后(?!台|勤|方|门|院|排|侧|部|备|座|端|区|舱|续)|(?<!临|实|计|按|准|及|定|超|同|工|过)时(?!间|钟|段|区|限|序|效|刻)/g,'，');
    const clauses=separated.split(/[，,。；;\r\n]+|然后|接着|最后|随后|并且|并|以及|同时|和|再|\b(?:and\s+)?then\b|\band\b/i).map(clause=>clause.replace(/^[，,。；;\s]*(?:请|先)?/,'').trim()).filter(Boolean);
    const kinds=clauses.map(clause=>{
      const inspect=/巡检|检查|巡逻|inspect|patrol/i.test(clause),supply=/定点|物流补给|物资补给|补给(?!点)/.test(clause),deliver=/递送|送餐|送水|送给|送到|交给|运送|搬运|配送|deliver|transport/i.test(clause),assist=/协助|交接|协作|assist|handoff/i.test(clause),pickup=/取件|取货|领取|取物|拿取/.test(clause);
      if(inspect&&(supply||deliver||assist)||supply&&/送给|递送给|交给|协助|协作/.test(clause)||deliver&&/协助|协作/.test(clause))return'unknown';
      return inspect?'inspect':supply?'supply':deliver?'deliver':assist?'assist':pickup?'pickup':/^(?:记录|汇总|报告)(?:巡检|检查)?(?:结果|记录|情况)[。！!]?$/.test(clause)?'report':'unknown';
    });
    const steps=[];for(let i=0;i<kinds.length;i++){if(kinds[i]==='pickup'&&['deliver','supply'].includes(kinds[i+1]))continue;if(kinds[i]==='report'&&steps.at(-1)==='inspect')continue;if(kinds[i]==='assist'&&steps.at(-1)==='deliver'&&/^完成交接[。！!]?$/.test(clauses[i]))continue;steps.push(kinds[i]);}
    if(steps.includes('unknown')||steps.includes('pickup'))return{task:null,error:'有步骤尚无法执行，或顺序不明确。请用“先巡检，再取件递送”等明确步骤；取件后需说明递送或补给。'};
    if(steps.length>2||new Set(steps).size!==steps.length)return{task:null,error:'当前支持一次巡检与一次递送或补给的两段顺序；重复递送、重复巡检和第三个动作请另开任务。'};
    const task=steps.join('-');if(!['assist','deliver','inspect','supply','inspect-deliver','inspect-supply','deliver-inspect'].includes(task))return{task:null,error:'暂不支持这个步骤组合。可选择巡检后递送、巡检后补给，或递送后巡检。'};
    const amount=value.match(/(?:巡检|检查)\s*([123一二两三])(?:个|处)/)?.[1];return{task,error:null,inspectionCount:amount?({一:1,二:2,两:2,三:3}[amount]||Number(amount)):3};
  };
  C.inferRobotTask=text=>C.parseRobotMission(text).task;
  class RobotInteraction {
    constructor(owner){
      this.o=owner;this.serial=0;this.labels=new Map();
      this.overlay=document.createElement('div');this.overlay.id='co-robot-labels';document.body.appendChild(this.overlay);
      this.hint=document.createElement('div');this.hint.id='co-placement';this.hint.hidden=true;this.hint.innerHTML='<span role="status" id="co-placement-message"></span><button id="co-placement-cancel">取消 · Esc</button>';document.body.appendChild(this.hint);$('co-placement-cancel').onclick=()=>this.abandon();
      this.taskDialog=document.createElement('dialog');this.taskDialog.id='co-task-dialog';this.taskDialog.setAttribute('aria-labelledby','co-task-title');this.taskDialog.innerHTML=`<form id="co-task-form"><div class="co-task-heading"><div><small>ROBOT / MISSION</small><h2 id="co-task-title">安排机器人任务</h2></div><button type="button" id="co-task-close" aria-label="取消任务设置">×</button></div><p id="co-task-robot"></p><label for="co-task-input">希望它做什么？</label><textarea id="co-task-input" rows="3" maxlength="160" required placeholder="例如：从补给点取文件，递送给一位同事。"></textarea><div id="co-task-suggestions" aria-label="任务建议"><button type="button" data-mission="assist">工位交接</button><button type="button" data-mission="deliver">递送物品</button><button type="button" data-mission="inspect">自主巡检</button><button type="button" data-mission="supply">定点补给</button></div><div class="co-task-fields"><label>执行方式<select id="co-task-kind"><option value="assist">协作交接</option><option value="deliver">取件与递送</option><option value="inspect">自主巡检</option><option value="supply">定点补给</option></select></label><label>协作对象<select id="co-task-target"><option value="">自动选择空闲伙伴</option></select></label></div><p id="co-task-plan"></p><p id="co-task-error" role="status"></p><div class="co-task-buttons"><button type="button" id="co-task-cancel">取消</button><button type="submit" id="co-task-confirm">确认任务，选择放置位置 →</button></div></form>`;document.body.appendChild(this.taskDialog);
      this.taskDialog.addEventListener('keydown',e=>e.stopPropagation());
      for(const task of ['inspect-deliver','inspect-supply','deliver-inspect']){const label=C.robotTaskNames[task],option=document.createElement('option'),button=document.createElement('button');option.value=task;option.textContent=label;$('co-task-kind').appendChild(option);button.type='button';button.dataset.mission=task;button.textContent=label;$('co-task-suggestions').appendChild(button);}
      $('co-task-close').onclick=$('co-task-cancel').onclick=()=>this.abandon();this.taskDialog.addEventListener('cancel',e=>{e.preventDefault();this.abandon();});
      $('co-task-suggestions').onclick=e=>{const button=e.target.closest('[data-mission]');if(button)this.chooseTask(button.dataset.mission);};
      $('co-task-input').oninput=()=>{const inferred=C.inferRobotTask($('co-task-input').value);if(inferred)$('co-task-kind').value=inferred;this.syncRecipient($('co-task-input').value);this.taskPlan();};
      $('co-task-kind').onchange=()=>this.chooseTask($('co-task-kind').value);$('co-task-target').onchange=()=>this.taskPlan();
      $('co-task-form').onsubmit=e=>{e.preventDefault();this.submitTask();};
      const canvas=owner.v.renderer.domElement;
      // Capture on document so floor/seat picking and pointer-lock never receive a placement click.
      for(const type of ['pointerdown','pointerup','click','dblclick'])document.addEventListener(type,e=>{
        if(!this.pending||e.target!==canvas)return;e.preventDefault();e.stopImmediatePropagation();
        if(type==='pointerdown')this.down={x:e.clientX,y:e.clientY};
        if(type==='click'&&e.button===0&&this.down&&Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)<5){this.point(e);this.confirm();}
      },true);
      canvas.addEventListener('pointermove',e=>{if(this.pending)this.point(e);});
      canvas.addEventListener('pointerleave',()=>{if(this.pending){this.pending.point=null;this.pending.ghost.visible=false;}});
      document.addEventListener('keydown',e=>{if(!this.pending||e.key!=='Escape')return;e.preventDefault();e.stopImmediatePropagation();this.abandon();},true);
    }
    begin(spec,{onPlaced,placementPoint}={}){
      this.cancel();this.textRecipient=null;const o=this.o;if(o.switching||o.app.busy)throw Error('场景正在切换，请稍后设置任务。');
      if(C.robotAllowedInEnvironment&&!C.robotAllowedInEnvironment(spec,o.environment))throw Error(o.environment==='station'?'请从空间站预设中选择舱内机器人。':'此机器人用于空间站，请切换到空间站后放置。');
      if(o.environment==='station'&&(o.stationExperience.shellStudy?.changed||o.stationExperience.morphBusy))throw Error('当前为外壳预览，请先恢复原貌再进入舱内放置机器人。');
      // Remember where the user started so cancelling the whole flow returns there.
      const returnTo=o.environment==='station'?(o.stationExperience.phase!=='interior'?{environment:'station',phase:o.stationExperience.phase,selected:o.stationExperience.selected}:null):o.environment==='office'&&o.b.phase!=='interior'?{environment:'office',phase:o.b.phase}:null;
      if(o.environment==='station'&&o.stationExperience.phase!=='interior')o.stationExperience.enter(o.stationExperience.selected);
      if(document.pointerLockElement)document.exitPointerLock();o.chat?.close(false);
      this.draft={spec:{...spec},onPlaced,placementPoint,returnTo,key:o.key()};const ctx=o.currentContext();if(ctx.world.getPeople)ctx.sim.syncExternalPeople();
      const select=$('co-task-target');select.replaceChildren();const any=document.createElement('option');any.value='';any.textContent='自动选择空闲伙伴';select.appendChild(any);
      for(const person of ctx.sim.people){const option=document.createElement('option');option.value=person.id;option.textContent=person.name;select.appendChild(option);}
      select.value=ctx.sim.people.some(p=>p.id===spec.taskTarget)?spec.taskTarget:'';
      $('co-task-robot').textContent=clean(spec.name+' · '+o.locationName());$('co-task-error').textContent='';$('co-task-confirm').disabled=false;
      this.chooseTask(spec.task||'assist');if(spec.taskText){$('co-task-input').value=spec.taskText;const parsed=C.parseRobotMission(spec.taskText);if(parsed.task)$('co-task-kind').value=parsed.task;this.syncRecipient(spec.taskText);}this.taskPlan();
      $('collaboration-panel').close();$('robot-studio').close();this.taskDialog.showModal();$('co-task-input').focus();
    }
    chooseTask(task){
      if(!C.robotTaskSuggestions[task])return;$('co-task-kind').value=task;$('co-task-input').value=C.robotTaskSuggestions[task];this.taskPlan();
    }
    recipientError(text,task){
      if(!C.robotTaskSteps(task).some(step=>['assist','deliver'].includes(step)))return null;
      const people=this.o.currentContext().sim.people,mentioned=people.filter(person=>String(text).includes(person.name));if(mentioned.length>1)return'当前一轮只支持一位协作对象，请只保留一个名字。';
      const requested=String(text).match(/(?:送给|递送给|交给|与|协助)([^，。；;\s]{1,18})/)?.[1];
      if(!requested||/同事|伙伴|人员|工作人员|乘组|航天员|一位|自动|空闲/.test(requested))return null;
      if(people.some(person=>requested.startsWith(person.name)))return null;
      return '当前空间没有找到“'+requested+'”。请使用协作对象列表中的名字，或改为自动选择空闲伙伴。';
    }
    syncRecipient(text){const people=this.o.currentContext().sim.people,mentioned=people.filter(person=>String(text).includes(person.name));if(mentioned.length===1){$('co-task-target').value=mentioned[0].id;this.textRecipient=mentioned[0].id;}else if(this.textRecipient){$('co-task-target').value='';this.textRecipient=null;}return mentioned;}
    taskPlan(){
      const mentioned=this.syncRecipient($('co-task-input').value),task=$('co-task-kind').value,target=$('co-task-target').value;
      const person=this.o.currentContext().sim.people.find(p=>p.id===target),who=person?person.name:'空闲伙伴';
      const steps=C.robotTaskSteps(task),independent=!steps.some(step=>['assist','deliver'].includes(step)),named=!independent&&mentioned.length===1;$('co-task-target').disabled=independent||named;$('co-task-target').title=named?'对象由任务文字指定；修改文字中的姓名即可更换。':'';
      const parsed=C.parseRobotMission($('co-task-input').value),count=parsed.inspectionCount||3,plans={assist:`前往${who}身边核对交接；工位不可达时，邀请对方到可达交接点。`,deliver:`取件 → 与${who}交接；会合失败则送至公共交接点，标记待领取。`,inspect:'独立前往最多'+['','一个','两个','三个'][count]+'公共区域，每处停留检查；跳过不可达地点并记录，不等待人物陪同。',supply:'取件 → 另一个可达的公共服务点 → 卸货完成。不要求人物在场。'};
      const error=parsed.error||this.recipientError($('co-task-input').value,task);$('co-task-error').textContent=clean(error||'');$('co-task-confirm').disabled=!!error;
      $('co-task-plan').textContent='将按「'+C.robotTaskNames[task]+'」执行：'+steps.map((step,i)=>(steps.length>1?'第 '+(i+1)+' 步：':'')+plans[step]).join(' → ')+(named?' 对象由任务文字指定；修改文字中的姓名即可更换。':'')+' 本次任务执行一轮。每段完成后才进入下一段；部分完成、待领取或失败会停止后续步骤。可在伙伴列表观察进度、取消或重试。';
    }
    async submitTask(){
      const draft=this.draft;if(!draft||this.submitting)return;
      const taskText=$('co-task-input').value.trim();if(!taskText){$('co-task-error').textContent='请写下任务，或选择一条建议。';$('co-task-input').focus();return;}
      const parsed=C.parseRobotMission(taskText),error=parsed.error||this.recipientError(taskText,parsed.task);if(error){$('co-task-error').textContent=clean(error);return;}const task=parsed.task;$('co-task-kind').value=task;
      this.syncRecipient(taskText);
      if(draft.key!==this.o.key()){$('co-task-error').textContent='场景已改变，请重新选择机器人。';return;}
      const independent=!C.robotTaskSteps(task).some(step=>['assist','deliver'].includes(step)),target=independent?'':$('co-task-target').value,person=this.o.currentContext().sim.people.find(p=>p.id===target);
      if(target&&!person){$('co-task-error').textContent='这位伙伴已离开当前场景，请重新选择。';return;}
      const spec={...draft.spec,task,inspectionCount:parsed.inspectionCount||3,taskText:taskText.slice(0,160),taskTarget:target,taskTargetName:independent?'':person?.name||''};
      this.submitting=true;$('co-task-confirm').disabled=true;$('co-task-error').textContent='正在准备机器人…';
      const operation=this.startPlacement(spec,{onPlaced:draft.onPlaced,returnTo:draft.returnTo}),serial=this.serial;
      try{await operation;if(this.pending&&draft.placementPoint){this.previewPoint(draft.placementPoint);this.confirm();}}
      catch(error){if(serial===this.serial&&!this.pending){this.draft=draft;this.taskDialog.showModal();$('co-task-error').textContent=clean(error.message);}}
      finally{this.submitting=false;$('co-task-confirm').disabled=false;}
    }
    async startPlacement(spec,{onPlaced,returnTo=null}={}){
      this.cancel();const serial=this.serial,o=this.o,key=o.key();
      await C.prepareRobot(spec);if(serial!==this.serial)return;
      if(key!==o.key())throw Error('场景已改变，请重新选择机器人。');
      if(o.switching||o.app.busy)throw Error('场景正在切换，请稍后放置。');
      if(o.environment==='office'&&o.b.phase!=='interior')await o.b.enterFloor(o.b.selected);
      if(serial!==this.serial)return;
      if(key!==o.key())throw Error('场景已改变，请重新选择机器人。');
      const walked=o.v.view==='walk'||o.v.view==='human';if(walked){if(o.environment==='office')o.v.setView('perspective');else o.externalCamera('perspective');}
      if(document.pointerLockElement)document.exitPointerLock();o.chat?.close(false);o.following=false;
      // The plan view is only for picking a spot; the previous view returns after placement or cancel.
      const view=this.captureView(walked);o.b.cameraTween=null;
      if(o.environment==='office')o.v.setView('top');else if(o.environment==='station')o.stationExperience.cameraMode('top',false);else o.externalCamera('top');
      const ctx=o.currentContext();if(o.environment==='office'){ctx.world.root.position.copy(o.v.floorOrigin||new T.Vector3());ctx.world.root.updateMatrixWorld(true);}
      if(ctx.sim.robots.length>=16)throw Error('当前场景最多放置 16 位机器人伙伴。');
      const ghost=C.makeRobot(spec);ghost.traverse(node=>{if(!node.material)return;for(const material of Array.isArray(node.material)?node.material:[node.material]){material.transparent=true;material.opacity=.38;material.depthWrite=false;}node.castShadow=false;});
      if(ctx.world.microgravity){ghost.userData.microgravity=true;C.animateRobot(ghost,0,false,false,ctx.sim.time);}
      const radius=ctx.sim.robotRadius(spec),ring=new T.Mesh(new T.RingGeometry(radius,radius+.09,48),new T.MeshBasicMaterial({color:'#2589df',transparent:true,opacity:.9,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=ctx.world.microgravity?(ghost.userData.height||1.6)/(2*(spec.scale||1)):.04;ghost.add(ring);ghost.visible=false;ctx.world.root.add(ghost);
      this.pending={spec:{...spec},ctx,key:o.key(),ghost,ring,point:null,valid:false,onPlaced,returnTo,view,controls:o.v.controls.enabled};o.v.controls.enabled=false;
      this.hint.hidden=false;document.body.classList.add('co-placing-robot');this.message('任务：'+(spec.taskText||C.robotTaskSuggestions[spec.task])+' · '+(ctx.world.microgravity?'点击舱内空闲位置悬浮放置 ':'点击空闲地面放置 ')+spec.name);
      $('collaboration-panel').close();$('robot-studio').close();
    }
    message(text){$('co-placement-message').textContent=clean(text);}
    placementError(){return this.pending?.ctx.world.microgravity?'此处空间不足或被占用，请选择舱内空闲位置':'此处被占用或不可通行，请选择空闲地面';}
    previewPoint(point){
      const p=this.pending;if(!p)return;
      const position=p.ctx.world.microgravity?p.ctx.sim.placementPoint(p.spec,point):point;
      p.point=position&&{x:position.x,...(p.ctx.world.microgravity?{y:position.y}:{}),z:position.z};p.valid=!!p.point&&p.ctx.sim.canPlace(p.spec,p.point);p.ghost.visible=!!position;
      if(position)p.ghost.position.set(position.x,position.y||0,position.z);p.ring.material.color.set(p.valid?'#2589df':'#ef5350');
      this.message(p.valid?(p.ctx.world.microgravity?'点击悬浮放置 ':'点击放置 ')+p.spec.name+' · 任务：'+(p.spec.taskText||C.robotTaskSuggestions[p.spec.task]):this.placementError());
    }
    point(event){
      const p=this.pending;if(!p)return;const o=this.o,v=o.v,rect=v.renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();
      v.camera.updateWorldMatrix(true,false);p.ctx.world.root.updateWorldMatrix(true,false);
      ray.setFromCamera(new T.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),v.camera);
      const point=new T.Vector3();
      if(p.ctx.world.microgravity){
        // Select in the cabin's own suspended plane, including extracted or rotated cabins.
        const placement=p.ctx.sim.placementPoint(p.spec,{x:0,z:0});
        const localRay=ray.ray.clone().applyMatrix4(new T.Matrix4().copy(p.ctx.world.root.matrixWorld).invert());
        if(!placement||!localRay.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-placement.y),point)){p.point=null;p.valid=false;p.ghost.visible=false;return;}
        this.previewPoint(point);return;
      }
      const origin=p.ctx.world.root.getWorldPosition(new T.Vector3());let ground=origin.y;
      if(!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-ground),point)){p.point=null;p.ghost.visible=false;return;}
      if(o.environment==='campus'){ground=o.b.society.exterior.ground(point.x,point.z);if(!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-ground),point)){p.point=null;p.ghost.visible=false;return;}}
      p.ctx.world.root.worldToLocal(point);this.previewPoint(point);
    }
    confirm(){
      const p=this.pending,o=this.o;if(!p)return;if(p.key!==o.key()||o.switching){this.cancel();return;}
      if(!p.point||!p.ctx.sim.canPlace(p.spec,p.point)){this.message(this.placementError());return;}
      try{const r=p.ctx.sim.addRobot(p.spec,{position:p.point});this.cancel();o.selected=r.id;o.v.shadowDirty=true;o.refreshUI();p.onPlaced?.(r);o.toast(r.name+' 已放置 · '+(o.environment==='office'&&!o.app.running||o.environment!=='office'&&!o.externalRunning?'模拟已暂停，继续后执行任务':'开始执行任务'));return r;}
      catch(error){this.message(error.message);}
    }
    cancel(){
      this.serial++;this.draft=null;this.taskDialog?.close();const p=this.pending;this.pending=null;this.down=null;
      if(p){C.disposeModel(p.ghost);if(p.key===this.o.key())this.restoreView(p.view);this.o.v.controls.enabled=p.controls;}
      this.hint.hidden=true;document.body.classList.remove('co-placing-robot');
    }
    // User cancel: also leave the floor or cabin that the flow entered on its own.
    abandon(){
      const back=(this.pending||this.draft)?.returnTo,key=(this.pending||this.draft)?.key;this.cancel();const o=this.o;if(!back||key!==o.key()||o.switching||back.environment!==o.environment)return;
      if(back.environment==='office'){if(o.b.phase==='interior')o.b.setPhase('overview');return;}
      const s=o.stationExperience;if(s.phase!=='interior'||s.selected!==back.selected)return;if(back.phase==='focus')s.returnToSelection();else s.overview();
    }
    captureView(walked){
      const o=this.o,v=o.v,s=o.stationExperience,station=o.environment==='station';
      return{walked,environment:o.environment,phase:station?s.phase:o.b.phase,tweening:!!(station?s.tween:o.b.cameraTween),camera:v.captureCameraState(),projection:{near:v.camera.near,far:v.camera.far,fov:v.camera.fov},limits:{minDistance:v.controls.minDistance,maxDistance:v.controls.maxDistance,maxPolarAngle:v.controls.maxPolarAngle},stationView:station?s.cameraView:null};
    }
    restoreView(view){
      const o=this.o,v=o.v,s=o.stationExperience,station=o.environment==='station';
      if(!view||view.environment!==o.environment||o.switching||(station?s.phase:o.b.phase)!==view.phase)return;
      // First person needs a new pointer lock, and a half-finished fly-in has no stable pose: use the standard view.
      if(view.walked||view.tweening||!view.camera){if(o.environment==='office')v.setView('perspective');else if(station)s.cameraMode(s.phase==='interior'?'detail':'perspective',false);else o.externalCamera('perspective');v.shadowDirty=true;return;}
      Object.assign(v.camera,view.projection);v.camera.updateProjectionMatrix();Object.assign(v.controls,view.limits);v.restoreCameraState(view.camera);v.firstPerson?.viewChanged(v.view);
      if(o.environment==='office')document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v.view));
      if(station){s.tween=null;s.cameraView=view.stationView;s.syncUI();}
      v.shadowDirty=true;
    }
    update(){
      const o=this.o,v=o.v;if(this.draft&&(this.draft.key!==o.key()||o.switching))this.cancel();if(this.pending&&(this.pending.key!==o.key()||o.switching||o.environment==='office'&&o.b.phase!=='interior'))this.cancel();
      if(this.pending)v.controls.enabled=false;
      const live=new Set(),rect=v.renderer.domElement.getBoundingClientRect();v.camera.updateWorldMatrix(true,false);
      for(const [key,ctx]of o.contexts){if(!ctx.world.root.visible)continue;
        for(const r of ctx.sim.robots){
          const id=key+':'+r.id;live.add(id);let item=this.labels.get(id);
          if(!item){const badge=document.createElement('div');badge.className='co-robot-badge';badge.innerHTML='<b></b><span></span><small></small>';this.overlay.appendChild(badge);
            const goal=new T.Mesh(new T.RingGeometry(.35,.45,40),new T.MeshBasicMaterial({color:'#278bdd',transparent:true,opacity:.85,side:T.DoubleSide,depthWrite:false}));goal.rotation.x=-Math.PI/2;goal.userData.noAO=true;ctx.world.root.add(goal);
            const target=document.createElement('div');target.className='co-robot-goal';this.overlay.appendChild(target);item={badge,goal,target};this.labels.set(id,item);}
          const intent=ctx.sim.intent(r),paused=o.environment==='office'?(o.b.phase==='interior'?!o.app.running:!o.b.society.running):!o.externalRunning;
          item.badge.querySelector('b').textContent='机器人 · '+clean(r.name);item.badge.querySelector('span').textContent=clean(paused?'已暂停 · '+intent.action:intent.action);item.badge.querySelector('small').textContent=clean('任务：'+(r.spec.taskText||intent.task)+(intent.target?' · 目标：'+intent.target:''));item.badge.title=item.badge.querySelector('small').textContent;
          const head=ctx.world.microgravity?ctx.world.root.localToWorld(new T.Vector3().copy(ctx.sim.actorCenter(r)).add(new T.Vector3(0,ctx.sim.actorHeight(r)/2+.25,0))):r.model.getWorldPosition(new T.Vector3());if(!ctx.world.microgravity)head.y+=(r.model.userData.height||1.6)+.25;this.project(item.badge,head,rect);
          item.goal.visible=!!intent.point;item.target.hidden=!intent.point;
          if(intent.point){const target=ctx.world.microgravity?ctx.sim.flightPoint(r,intent.point):{x:intent.point.x,y:o.environment==='campus'?o.b.society.exterior.ground(intent.point.x,intent.point.z)+.06:.06,z:intent.point.z};item.goal.position.copy(target);item.target.textContent=clean(r.name+' → '+intent.target);this.project(item.target,item.goal.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.12,0)),rect);}
        }
      }
      for(const [id,item]of this.labels)if(!live.has(id)){item.badge.remove();item.target.remove();item.goal.parent?.remove(item.goal);item.goal.geometry.dispose();item.goal.material.dispose();this.labels.delete(id);}
    }
    project(element,point,rect){point.project(this.o.v.camera);element.hidden=point.z< -1||point.z>1||Math.abs(point.x)>1||Math.abs(point.y)>1;if(!element.hidden){element.style.left=(rect.left+(point.x+1)*rect.width/2)+'px';element.style.top=(rect.top+(1-point.y)*rect.height/2)+'px';}}
  }
  C.RobotInteraction=RobotInteraction;
})();
