/* Existing robots change allegiance; natural-language creation deploys directly. */
(function(root,factory){const api=factory(typeof require==='function'?require('./robot-army-protocol.js'):root.RobotArmyProtocol,typeof require==='function'?require('./robot-selection.js'):root.RobotSelection);if(typeof module==='object'&&module.exports)module.exports=api;else root.RobotControlProtocol=api;})(typeof window==='undefined'?globalThis:window,(Army,Selection)=>{
 'use strict';
 const number=s=>{if(/^[+-]?\d+(?:\.\d+)?$/.test(s))return Number(s);let n=0,v=0;for(const c of s.replace(/两/g,'二')){const d='零一二三四五六七八九'.indexOf(c);if(d>=0)v=d;else if(c==='十'){n+=(v||1)*10;v=0;}else if(c==='百'){n+=(v||1)*100;v=0;}}return n+v;};
 const create=/调用|打造|定制|自定义|设计|生成|创建|制作|召唤|部署|放入|添加|出现/;
 function describe(text,context={}){
  const floorText=text.replace(/这(?:一)?(?:楼)?层|本层|当前楼层/g,'本层'),match=floorText.match(/(?:第\s*)?([\d零一二两三四五六七八九十百]+)\s*(?:层|楼|[fF])/);
  const count=text.match(/([+-]?\d+(?:\.\d+)?|[零一二两三四五六七八九十百]+)\s*(?:个|台|只|具|名|架)(?!(?:机械|金属|吸盘)?(?:腿|足|手|触|腕|尾|翅|眼|轮)|吸盘)/),known=Selection.choose(text,Army.catalog,'small');
  const outside=/楼外|室外|建筑外|外面|广场|入口外|楼前|楼后|楼左|楼右|大楼[前后左右]/.test(text),inside=!!match||/这(?:一)?层|本层|当前(?:楼)?层|室内|楼内|大厅/.test(text);
  const exterior=outside||!inside&&context.interior!==true,floor=match?number(match[1]):context.floor||1;
  const peaceful=/(?:不要|不许|不能|别|禁止|停止|避免|不)[^，。；;]{0,8}(?:攻击|进攻|伤害|袭击|叛变|叛乱)/.test(text),attack=!peaceful&&(/(?:攻击|进攻|袭击|追杀|猎杀|消灭|打击)[^，。；;]{0,10}(?:人类|人群|员工|玩家|人)|叛变|叛乱|暴走/.test(text));
  return {floor,count:count?number(count[1]):1,robotType:known?.type||'humanoid',exterior,site:/楼后|大楼后|建筑后|后面/.test(text)?'back':/楼左|大楼左|左侧/.test(text)?'left':/楼右|大楼右|右侧/.test(text)?'right':'entrance',behavior:attack?'attack':/待命|原地|站岗|静止|不动|守候|等候|停止移动/.test(text)?'standby':'wander',weapon:/激光|镭射/.test(text)?'laser':/近战|拳|冲撞/.test(text)?'melee':/子弹|射击|机枪/.test(text)?'bullet':'auto'};
 }
 function validate(a,context={}){
  let floor=Number(a.floor??context.floor??1);if(!Number.isInteger(floor)||floor<1||floor>30)throw Error('楼层范围为 1–30 层。');
  if(a.type==='robot-rebellion')return {type:a.type,floor,all:a.all===true,operation:a.operation==='pacify'?'pacify':'rebel'};
  if(a.type!=='robot-design')throw Error('未知机器人控制类型。');const prompt=String(a.prompt||'').trim();if(!prompt||prompt.length>1200)throw Error('机器人描述需要 1–1200 字。');
  const inferred=describe(prompt,context),count=Number(a.count??inferred.count);if(!Number.isInteger(count)||count<1||count>120)throw Error('每次可生成 1–120 台机器人。');
  if(a.floor==null)floor=inferred.floor;if(!Number.isInteger(floor)||floor<1||floor>30)throw Error('楼层范围为 1–30 层。');
  const exterior=typeof a.exterior==='boolean'?a.exterior:inferred.exterior,behavior=['wander','standby','attack'].includes(a.behavior)?a.behavior:inferred.behavior;
  return {type:a.type,prompt,operation:'deploy',floor:exterior?1:floor,count,robotType:Army.catalog.some(s=>s.type===a.robotType)?a.robotType:inferred.robotType,exterior,site:['entrance','back','left','right'].includes(a.site)?a.site:inferred.site,behavior,hostile:behavior==='attack',weapon:['bullet','laser','melee','auto'].includes(a.weapon)?a.weapon:inferred.weapon};
 }
 function parsePart(text,context={}){
  const robot=/机器人|机器狗|机械人|\bG1\b|\bGo2\b|\bSpot\b/i.test(text),design=robot&&create.test(text),rebellion=robot&&(/叛变|叛乱|造反|反叛|暴走/.test(text)||/(?:这一层|这层|本层|当前(?:楼)?层).*机器人判断[。！!\s]*$/.test(text));
  if(!rebellion&&!design)return null;
  if(design&&Selection.size(text)==='giant')return null;
  if(/如果|假如|假设|会不会|会怎样/.test(text)||/(?:不要|不许|不能|别|禁止|不再|不想|不需要)[^，。；;]{0,8}(?:打造|定制|设计|生成|创建|制作|召唤|部署|放入|添加|出现)/.test(text)||!design&&/不要|不许|别让|别把|不能/.test(text))return {handled:true};
  const details=describe(text,context);
  if(rebellion&&!design)return {handled:true,action:validate({type:'robot-rebellion',floor:details.floor,all:/全楼|所有楼层|全部楼层/.test(text),operation:/停止|解除|平息|取消|恢复正常/.test(text)?'pacify':'rebel'},context)};
  return {handled:true,action:validate({type:'robot-design',...details,prompt:text},context)};
 }
 function wholeDesign(text,context){
  if(!create.test(text)||/然后|接着|并且|同时|[；;\n]/.test(text))return null;
  const prefix=text.slice(0,text.search(create));if(/[，,]|关闭|打开|起火|爆炸|地震/.test(prefix))return null;
  if(Selection.size(text)==='giant'||Selection.size(text)!=='small'&&/飞龙|章鱼|猎[蛛蜘]|蜘蛛|巨蛇|泰坦/.test(text))return null;
  const r=parsePart(text,context);return r?.action?.type==='robot-design'||r?.handled&&!r.action?r:null;
 }
 return {validate,parsePart,wholeDesign};
});
