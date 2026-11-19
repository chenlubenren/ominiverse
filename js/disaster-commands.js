/* Shared, bounded command protocol. Model output is data, never executable code. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DisasterCommands=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const Army=typeof require==='function'?require('./robot-army-protocol.js'):window.RobotArmyProtocol;
 const Mega=typeof require==='function'?require('./megastructure-protocol.js'):window.MegastructureProtocol;
 const Control=typeof require==='function'?require('./robot-control-protocol.js'):window.RobotControlProtocol;
 const TYPES=new Set(['robot-rebellion','robot-design','robot-library','extinguish','robots','megastructures','fire','earthquake','explosion','infection','ventilation','zombie-virus','zombies','doors','reset','pause','resume']);
 // Apply this guard before both local parsing and optional model inference.
 function isNonCommand(text){const s=String(text||'').replace(/(?:不要|别)(攻击|进攻|开火)/g,'停止$1');return /不要|不许|请勿|禁止|别让|别生成|别释放|不想|不需要|没有|未发生|尚未|从未|未曾|未被|未遭|未受|并未|不会|不攻击|不进攻|避免|防止|如果|假如|假设|是否|能否|可否|会不会|怎么样|会怎样|是什么|介绍|怎么办|如何|怎么|为什么|吗|[?？]/.test(s);}
 function validExplicitNumbers(text){for(const match of String(text).matchAll(/([+-]?\d+(?:\.\d+)?)\s*(?:个|只|台|名|头|架|条|具|层|楼|[fF])/g))if(!Number.isInteger(Number(match[1]))||Number(match[1])<1)throw Error('数量和楼层必须是正整数，不能使用负数、小数或零。');for(const match of String(text).matchAll(/(?:第\s*)?([\d零一二两三四五六七八九十百]+)\s*(?:层|楼|[fF])/g))if(number(match[1])>30)throw Error('楼层范围为 1–30 层。');}
 function weaponModifier(text){const match=String(text).trim().match(/^(?:(?:请)?(?:用|使用|改用|配备|装备|采用|发射))?(激光|镭射|子弹|射击|机枪|近战|拳击|拳头|冲撞)(?:(?:去|来)?(?:攻击|进攻|射击)(?:场景中的)?(?:人类|人员|员工|目标)?)?[。！!\s]*$/);return match?(/激光|镭射/.test(match[1])?'laser':/近战|拳|冲撞/.test(match[1])?'melee':'bullet'):null;}
 const number=s=>{s=String(s).replace(/两/g,'二');if(/^\d+$/.test(s))return Number(s);const digits='零一二三四五六七八九';let n=0,v=0;for(const c of s){if(digits.includes(c))v=digits.indexOf(c);else if(c==='十'){n+=(v||1)*10;v=0;}else if(c==='百'){n+=(v||1)*100;v=0;}}return n+v;};
 function unavailableCreature(text){
  const named=/鳄鱼|鱷魚|crocodile|alligator|恐龙|恐龍|霸王龙|哥斯拉|狼人|独角兽|麒麟/i.exec(text),generic=/怪物|怪兽|异兽|动物|生物/.test(text);
  if(!named&&!generic)return '';
  if(!named&&(/丧尸|僵尸|复仇女神|暴君|机器人|机器狗|机械人/.test(text)||Mega.catalog.some(c=>c.aliases.test(text))))return '';
  return (named?named[0]+'模型':'这种怪物或动物的模型')+'尚未入库，请先在机器人库生成并确认模型，再按名称调用。';
 }
 function shouldUseLocal(text,context={},plan=parse(text,context)){return !!(plan.notices?.length||plan.actions.some(a=>a.type==='infection'&&a.demo)||plan.actions.some(a=>['megastructures','robot-rebellion','robot-design','robot-library','reset','extinguish'].includes(a.type)));}
 function validate(raw,context={}){
  if(!raw||!Array.isArray(raw.actions)||raw.actions.length>12)throw Error('指令格式无效，单次最多 12 个事件。');
  if(context.environment==='station'&&raw.actions.length)throw Error('空间站使用独立情景，请返回办公楼或园区执行此类事件。');
  const actions=raw.actions.map(a=>{
   if(!a||!TYPES.has(a.type))throw Error('无法执行未知事件。');
   if(a.type==='megastructures')return Mega.validate(a);
   if(a.type==='robot-rebellion'||a.type==='robot-design')return Control.validate(a,context);
   if(a.type==='robot-library'){if(typeof a.entryId!=='string'||!a.entryId.trim()||a.entryId.length>200)throw Error('请选择已入库机器人。');return {...Control.validate({...a,type:'robot-design'},context),type:'robot-library',entryId:a.entryId,modelSize:['small','medium','giant'].includes(a.modelSize)?a.modelSize:undefined};}
   const floor=a.floor==null?(context.floor||1):Number(a.floor),intensity=a.intensity==null?1:Number(a.intensity),count=a.count==null?20:Number(a.count);
   if(!Number.isInteger(floor)||floor<1||floor>30)throw Error('楼层范围为 1–30 层。');
   if(!Number.isFinite(intensity)||intensity<.1||intensity>3)throw Error('强度范围为 0.1–3。');
   if(a.type==='zombies'&&(!Number.isInteger(count)||count<1||count>200))throw Error('每次可生成 1–200 个进攻者。');
   if(a.type==='robots'){const normalized=Army.validate(a);return{...normalized,floor:normalized.exterior?1:floor,intensity};}
   return{type:a.type,floor,intensity,count,...(a.type==='infection'?{demo:a.demo===true}:{}),all:a.all===true,open:a.open===true,collapse:a.collapse===true,monster:a.monster===true,exterior:a.exterior!==false,airborne:a.airborne===true};
  });const notices=Array.isArray(raw.notices)?raw.notices.filter(n=>typeof n==='string').slice(0,12).map(n=>n.slice(0,300)):[];return{actions,notices,reply:typeof raw.reply==='string'?raw.reply.slice(0,500):'',source:raw.source||'local'};
 }
 function parse(text,context={}){
  text=String(text||'').trim();const actions=[],notices=[];let adjacentRobot=null;
  if(isNonCommand(text))return validate({actions,source:'local'},context);
  validExplicitNumbers(text);
  // Whole robot descriptions preserve comma-separated appearance and placement details.
  if(!/然后|接着|并且|同时|[；;\n]/.test(text)&&text.split(/[，,]/).slice(1).every(p=>/^\s*(?:(?:用|使用|配备|装备)(?:激光|子弹|近战)|(?:在|放在|部署到|位于)(?:第?\s*[\d一二两三四五六七八九十百]+[层楼fF]|楼外|室外|楼前|楼后|楼左|楼右)|(?:蓝|红|白|黑|绿|银|金)色|小型|中型|大型|巡游|巡逻|乱走|待命|攻击人类)/.test(p))){const wholeMega=Mega.wholeSpawn?.(text,context),design=wholeMega?null:Control.wholeDesign?.(text,context);if(wholeMega||design){const unavailable=unavailableCreature(text);return validate({actions:unavailable?[]:wholeMega?[wholeMega]:design.action?[design.action]:[],notices:unavailable?[unavailable]:[],reply:unavailable,source:'local'},context);}}
  if(/如果|假设|会不会|会怎么样|会怎样/.test(text)&&(Mega.catalog.some(c=>c.aliases.test(text))||/巨构|巨型/.test(text)))return validate({actions,source:'local'},context);
  for(const part of text.split(/然后|接着|并且|同时|[，,；;\n]/).map(part=>part.trim()).filter(Boolean)){
   const previousRobot=adjacentRobot;adjacentRobot=null;
   const weapon=weaponModifier(part);if(weapon&&previousRobot){previousRobot.weapon=weapon;adjacentRobot=previousRobot;continue;}
   if(/如果|假设|会不会|是什么|介绍|能否/.test(part)&&(Mega.catalog.some(c=>c.aliases.test(part))||/巨构|巨型/.test(part)))continue;
   const unavailable=unavailableCreature(part);if(unavailable){if(!notices.includes(unavailable))notices.push(unavailable);continue;}
   const control=Control.parsePart(part,context);
   const mega=Mega.parsePart(part,context);if(mega){actions.push(mega);continue;}
   if(control){if(control.action){actions.push(control.action);if(control.action.type==='robot-design')adjacentRobot=control.action;}continue;}
   validExplicitNumbers(part);
   const floorMatch=part.match(/(?:第\s*)?([\d零一二两三四五六七八九十百]+)\s*(?:层|楼|[fF])/),floor=floorMatch?number(floorMatch[1]):context.floor||1;
   const max=/最大|最强|最高|夸张|毁灭|崩塌|倒塌|全部坍塌/.test(part),intensity=max?3:/强烈|大火|猛烈|严重/.test(part)?2:/轻微|小火/.test(part)?.6:1;
   const a={floor,intensity};
   if(/复原|还原|恢复初始|重来|重新开始/.test(part))a.type='reset';
   else if(/灭火|熄火|熄灭|扑灭|关闭火灾|停止火灾|清除火灾/.test(part)){a.type='extinguish';a.all=!floorMatch;}
   else if(/取消|停止|关闭|清除|重置|恢复/.test(part)&&/灾害|实验|所有事件|所有实验|场景|日常/.test(part)||/^(重置|清除|恢复日常)$/.test(part))a.type='reset';
   else if(/门/.test(part)&&/关|封锁|锁闭|打开|开启/.test(part)){a.type='doors';a.open=/打开|开启|开门/.test(part);a.all=!floorMatch||/所有|全楼|全部|大门/.test(part);}
   else if(/暂停/.test(part)&&!/机器人|机器狗/.test(part))a.type='pause';
   else if(/继续|恢复模拟/.test(part)&&!/机器人|机器狗/.test(part))a.type='resume';
   else if(/机器人|机器狗|机器人大军|\bg1\b|go2|spot|钢铁军团/i.test(part)){a.type='robots';a.operation=/清除|移除|收回/.test(part)?'clear':/停止|停火|别攻击/.test(part)?'pause':/恢复|继续/.test(part)?'resume':'spawn';const m=part.match(/([\d零一二两三四五六七八九十百]+)\s*(?:个|只|台|名|架|具)/);a.count=m?number(m[1]):12;const known=Army.catalog.find(s=>s.aliases.test(part));a.robotType=known?.type||'random';a.robotName=known?'':part.replace(/(?:第\s*)?[\d零一二两三四五六七八九十百]+(?:层|楼|[fF])|出现|生成|制作|给我|召唤|释放|去?进攻.*|去?攻击.*|人类|一堆|大军|[\d零一二两三四五六七八九十百]+[个只台名架具]/g,'').trim();if(/^机器人$/.test(a.robotName))a.robotName='';a.weapon=/激光|镭射/.test(part)?'laser':/近战|拳|冲撞/.test(part)?'melee':/子弹|射击|机枪/.test(part)?'bullet':'auto';a.exterior=!floorMatch||/楼外|进攻这栋|攻击大楼/.test(part);if(a.exterior)a.floor=1;}
   else if(/爆炸|引爆|炸弹/.test(part))a.type='explosion';
   else if(/地震|崩塌|倒塌|坍塌/.test(part)){a.type='earthquake';a.collapse=max||/倒塌|崩塌|坍塌/.test(part);}
   else if(/火灾|着火|起火|大火|点燃/.test(part))a.type='fire';
   else if(/丧尸病毒|丧尸感染|生化病毒/.test(part)){a.type='zombie-virus';a.airborne=/通风|空气|呼吸/.test(text);}
   else if(/丧尸|僵尸|复仇女神|暴君|怪物/.test(part)){a.type='zombies';a.monster=/复仇女神|暴君|怪物/.test(part);const m=part.match(/([\d零一二两三四五六七八九十百]+)\s*(?:个|只|名|头|具)/);a.count=m?number(m[1]):a.monster?1:20;a.exterior=!floorMatch||/进攻|攻击这栋|楼外|室外/.test(part);}
   else if(/逐层.*(?:传播|感染)|(?:传播|感染).*逐层/.test(part)){a.type='infection';a.demo=true;}
   else if(/通风|出风口|空气污染/.test(part))a.type='ventilation';
   else if(/呼吸|传染|感染/.test(part))a.type='infection';
   else if(/强度|最大/.test(part)&&actions.length){actions[actions.length-1].intensity=intensity;if(actions[actions.length-1].type==='earthquake'&&max)actions[actions.length-1].collapse=true;continue;}
   else continue;
   actions.push(a);
   if(a.type==='robots'&&a.operation==='spawn')adjacentRobot=a;
  }
  return validate({actions,notices,reply:notices.join('\n'),source:'local'},context);
 }
 return{parse,validate,number,shouldUseLocal,unavailableCreature,isNonCommand,validExplicitNumbers,TYPES:[...TYPES]};
});
