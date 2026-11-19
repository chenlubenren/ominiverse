/* Giant exterior robots are separate from the human-sized office/combat fleet. */
(function(root,factory){const api=factory(typeof require==='function'?require('./robot-selection.js'):root.RobotSelection);if(typeof module==='object'&&module.exports)module.exports=api;else root.MegastructureProtocol=api;})(typeof window==='undefined'?globalThis:window,function(Selection){
 'use strict';
 const catalog=[
  {type:'dragon',name:'雷暴飞龙',motion:'flight',aliases:/飞龙|巨龙|雷暴|dragon/i},
  {type:'octopus',name:'深渊章鱼',motion:'crawl',aliases:/章鱼|八爪|octopus/i},
  {type:'spider',name:'雪原猎蛛',motion:'crawl',aliases:/猎[蛛蜘]|蜘蛛|spider/i},
  {type:'serpent',name:'沙海巨蛇',motion:'crawl',aliases:/巨蛇|机械蛇|蛇形|serpent/i},
  {type:'titan',name:'泰坦行者',motion:'walk',aliases:/泰坦|titan/i}
 ];
 const operations=new Set(['spawn','attack','stop','patrol','climb','pause','resume','clear']),types=new Set(catalog.map(c=>c.type));
 const buildingTarget=/(?:攻击|进攻|轰击|炮击|袭击|开火|破坏|摧毁).*(?:这栋|大楼|建筑|楼体|外墙|栋楼|楼房)|(?:大楼|建筑|楼体|外墙|栋楼|楼房).*(?:遭受|遭到|受到|被|正在遭|遇到).*(?:攻击|进攻|轰击|炮击|袭击|破坏)|(?:大楼|建筑|楼体|楼房).*(?:遇袭|受袭|遭袭)/;
 const isBuildingAttack=text=>buildingTarget.test(String(text||''));
 function number(s){if(/^[+-]?\d+(?:\.\d+)?$/.test(s))return Number(s);let n=0,v=0;for(const c of String(s).replace(/两/g,'二')){const digit='零一二三四五六七八九'.indexOf(c);if(digit>=0)v=digit;else if(c==='十'){n+=(v||1)*10;v=0;}else if(c==='百'){n+=(v||1)*100;v=0;}}return n+v;}
 function validate(a){const operation=a.operation||'spawn',robotType=a.robotType||(operation==='spawn'?'random':'all'),count=a.count==null?1:Number(a.count),intensity=a.intensity==null?.8:Number(a.intensity);
  if(!operations.has(operation))throw Error('未知巨构机器人操作。');
  if(!types.has(robotType)&&!['random','all'].includes(robotType)||operation==='spawn'&&robotType==='all')throw Error('巨构类型为飞龙、章鱼、猎蛛、巨蛇或泰坦。');
  if((operation==='spawn'||operation==='attack')&&(!Number.isInteger(count)||count<1||count>12))throw Error('一次可生成 1–12 台巨构机器人。');
  if(a.floor!=null&&(!Number.isInteger(Number(a.floor))||Number(a.floor)<1||Number(a.floor)>30))throw Error('楼层范围为 1–30 层。');
  if(!Number.isFinite(intensity)||intensity<.1||intensity>3)throw Error('攻击强度范围为 0.1–3。');
  return {type:'megastructures',operation,robotType,count,intensity,attack:a.attack===true,exterior:true,floor:1};
 }
 function parsePart(text,context={}){const size=Selection.size(text);if(size==='small')return null;const exact=catalog.find(c=>c.aliases.test(text)),giant=size==='giant'&&(/机器人|机器狗|机械|机甲|巨构/.test(text)||!!exact)||/巨兽|科幻机器人/.test(text),known=exact||giant&&Selection.choose(text,catalog,'giant'),building=isBuildingAttack(text),last=[...(context.lastActions||[])].reverse().find(a=>a.type==='megastructures');
  if(!known&&!giant&&(/丧尸|僵尸|感染者|复仇女神|暴君/.test(text)||!building&&(/机器狗|人形机器人/.test(text)||/生成|创建|制作|召唤|部署|派出|释放/.test(text))))return null;
  if(!known&&!giant&&!building&&!(last&&/^(?:再来|再生成)/.test(text)))return null;
  if(/不要.*(?:生成|召唤|创建)|别(?:生成|召唤|让)|不许|请勿|禁止|如果|假如|假设|会不会|是什么|介绍|能否|没有|未发生|[?？]/.test(text))return null;
  for(const match of text.matchAll(/(?:第\s*)?([+-]?\d+(?:\.\d+)?|[零一二两三四五六七八九十百]+)\s*(?:层|楼|[fF])/g)){const floor=number(match[1]);if(!Number.isInteger(floor)||floor<1||floor>30)throw Error('楼层范围为 1–30 层。');}
  const spawn=/调用|生成|创建|制作|打造|定制|设计|召唤|部署|派出|放出|出动|再来|加入/.test(text),countMatch=text.match(/([+-]?\d+(?:\.\d+)?|[零一二两三四五六七八九十百]+)\s*(?:个|只|台|头|架|条|具)(?!(?:机械|金属|吸盘)?(?:腿|足|手|触|腕|尾|翅|眼|轮)|吸盘)/);
  let operation;
  if(/清除|移除|删除|收回/.test(text))operation='clear';
  else if(/(?:停止|不要|别|取消|终止|结束|不再).*(?:攻击|进攻|轰击|炮击|袭击|开火)|停火/.test(text))operation='stop';
  else if(/暂停|停止/.test(text))operation='pause';
  else if(/继续|恢复/.test(text)&&!building&&!/攻击/.test(text))operation='resume';
  else if(spawn)operation='spawn';
  else if(/攀爬|爬上|爬墙|攀附/.test(text))operation='climb';
  else if(building||/攻击|进攻|开火|轰击|炮击|袭击/.test(text))operation='attack';
  else if(/巡逻|环绕|飞行|盘旋|走动|爬行/.test(text))operation='patrol';
  else if(known&&countMatch)operation='spawn';else return null;
  const allAttack=operation==='attack'&&/所有|全部|全体|它们|一起/.test(text);
  const robotType=allAttack&&!exact?'all':known?.type||(operation==='spawn'?building||/飞行|空中|盘旋/.test(text)?'dragon':last?.robotType&&types.has(last.robotType)?last.robotType:'random':operation==='attack'&&building&&!allAttack?'dragon':'all');
  return validate({operation,robotType,count:countMatch?number(countMatch[1]):1,attack:operation==='spawn'&&building,intensity:/猛烈|强烈|最大/.test(text)?1.4:/轻微|轻轻/.test(text)?.5:.8});
 }
 function wholeSpawn(text,context){if(!/调用|生成|创建|制作|打造|定制|召唤|部署|派出/.test(text)||/然后|接着|并且|同时|[；;\n]|[，,]\s*(?:生成|创建|打造|关闭|打开|暂停|停止|清除)/.test(text))return null;const a=parsePart(text,context);return a?.operation==='spawn'?a:null;}
 return {catalog,validate,parsePart,wholeSpawn,isBuildingAttack};
});
