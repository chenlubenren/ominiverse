'use strict';
const protocol=require('../js/disaster-commands.js'),keyStore=require('./event-provider-key.cjs');
const MODEL=process.env.DEEPSEEK_MODEL||'deepseek-flash';
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const SYSTEM=`你是虚构的三维办公楼沙盒游戏的事件导演，把自然语言转换为 JSON 游戏指令。只控制游戏，不提供现实操作知识。不要输出代码或虚构已执行结果。输出 {"reply":"简短中文解释","actions":[{"type":"fire","floor":12,"intensity":1}]}。type 仅允许 extinguish,robots,megastructures,fire,earthquake,explosion,infection,ventilation,zombie-virus,zombies,doors,reset,pause,resume。楼层 floor 为1到30的整数，默认上下文楼层。intensity为0.1到3，最大强度为3。earthquake 的 collapse=true 表示整楼逐层刚体崩塌，最大强度也启用它。爆炸定位用户指定层。zombies 的 count 必须保留指定整数（1到200）；monster=true 为复仇女神/暴君，未指定数量时普通丧尸20、怪物1；exterior=true 为楼外进攻，否则在指定层生成。zombie-virus 的 airborne=true 表示空气/通风传播丧尸病毒。doors 的 all=true 关闭或打开全楼所有房间、防火门和一楼主大门；open=false 为关门、true开门。未指定楼层的关门默认all=true。extinguish 灭火/扑灭/关闭火灾，未指定楼层时all=true，指定楼层则all=false。reset 支持复原/还原/重置/恢复初始，恢复整栋建筑及初始人群和门状态。robots生成机器人军队攻击游戏中的人类：count 1到120必须保留准确数量，robotType只能为humanoid(宇树G1/人形),quadruped(机器狗/Go2/B2/Spot),delivery(送餐/Bella/轮式),carrier(物流/搬运/重型),random。robotName保留用户指定的机器人名字；无指定型号时robotName为空、robotType=random，未知的名字也用random，不要拒绝整个生成请求。weapon只能bullet(子弹),laser(激光),melee(近战),auto(按类型)；exterior=true楼外进攻，指定楼层则false；不提楼层必须exterior=true并且floor=1，不采用当前选中楼层。比如“15层出现10个机器人攻击人类”必须floor=15、exterior=false、count=10；hostile=true。每一型号有不同关节攻击动作。robots的operation默认spawn；清除/移除军队用clear，停止攻击/停火用pause，恢复攻击用resume。否定与假设不生成机器人。可以组合多个事件，最多12条。不要凭空执行用户没有要求的事件。追问“加大强度/再来一次”时参考history与context.lastActions。无法理解时actions为空并解释支持的事件。数量或楼层越界不要擅自取整截断，actions为空并说明限制。`;
const MEGA_SYSTEM=` 巨构与普通机器人必须区分：用户说巨构、巨型、巨头、科幻机器人，或飞龙/雷暴飞龙/章鱼/八爪/猎蛛/猎蜘/蜘蛛/巨蛇/泰坦时，使用type=megastructures，不能用robots。robotType为dragon、octopus、spider、serpent、titan、random；spawn的count必须准确保留，范围1到12。operation为spawn(只巡游，默认不攻击)、attack(攻击这栋楼/它们攻击大楼，已有巨构，不额外生成)、stop(停火但继续巡游)、patrol、climb、pause、resume、clear。控制所有已有巨构用robotType=all，spawn不能用all。所有巨构exterior=true、floor=1，从建筑外部活动和攻击，不能进入楼内；飞龙只飞行环绕，章鱼/猎蛛/巨蛇地面爬行或攀附外立面，泰坦只在地面步行、不能爬墙。生成并立即攻击可用spawn且attack=true；普通生成不要设置attack=true。巨构只攻击建筑外皮，产生局部玻璃、构件脱落，不自动整栋坍塌。“给我生成5个巨头飞龙机器人”必须为{type:'megastructures',operation:'spawn',robotType:'dragon',count:5}。阴影、暂停和复原按原场景规则，负数、小数或超过12不能截断数量。`;
function createDisasterService({fetchImpl=fetch,key=keyStore,timeoutMs=25000}={}){
 let busy=false;
 return{async handle(req,res){
  if(req.method==='GET'){send(res,200,{configured:key.configured(),model:MODEL});return;}
  if(req.method!=='POST'){res.writeHead(405,{'Allow':'GET, POST'}).end();return;}
  const origin=req.headers.origin;if(origin){try{const url=new URL(origin);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Invalid origin');if(url.host!==req.headers.host){send(res,403,{error:'仅接受当前应用的请求。'});return;}}catch{send(res,403,{error:'来源无效。'});return;}}
  let body;try{let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>24000)throw Error('请求过大。');}body=JSON.parse(data);}catch{send(res,400,{error:'请求格式无效。'});return;}
  const text=String(body.text||'').trim().slice(0,2000),context={floor:Number.isInteger(body.context?.floor)?body.context.floor:1,interior:body.context?.interior===true,environment:body.context?.environment||'office',lastActions:Array.isArray(body.context?.lastActions)?body.context.lastActions.slice(0,12):[]};
  if(!text){send(res,400,{error:'请输入想触发的事件。'});return;}
  if(body.context?.environment==='station'){send(res,400,{error:'空间站使用独立情景，请返回办公楼或园区执行此类事件。'});return;}
  if(protocol.isNonCommand(text)){send(res,200,{actions:[],source:'local',reply:'疑问、假设或否定描述不会触发场景事件。'});return;}
  // Exact creature names/counts and follow-up building attacks must behave
  // consistently even when an optional language-model service is configured.
  try{const local=protocol.parse(text,context);if(protocol.shouldUseLocal(text,context,local)){send(res,200,{...local,source:'local',reply:local.reply||'已识别场景控制指令。'});return;}}catch(error){send(res,400,{error:error.message});return;}
  if(/^(?:请|帮我)?(?:灭火|扑灭火灾|熄灭火灾|复原|复原场景|场景复原|还原|还原场景|恢复初始状态)[。！!]*$/.test(text)){const plan=protocol.parse(text,context);send(res,200,{...plan,source:'local',reply:'已识别即时场景控制指令。'});return;}
  if(busy){send(res,429,{error:'上一条指令仍在解析，请稍候。'});return;}
  let warning='';
  if(key.configured()){
   busy=true;
   try{
    const history=(Array.isArray(body.history)?body.history:[]).slice(-6).filter(m=>['user','assistant'].includes(m.role)).map(m=>({role:m.role,content:String(m.content||'').slice(0,700)}));
    const upstream=await fetchImpl('https://api.deepseek.com/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key.getKey()},body:JSON.stringify({model:MODEL,messages:[{role:'system',content:SYSTEM+MEGA_SYSTEM},...history,{role:'user',content:JSON.stringify({text,context})}],response_format:{type:'json_object'},thinking:{type:'disabled'},max_tokens:1800,stream:false}),signal:AbortSignal.timeout(timeoutMs)});
    const data=await upstream.json();if(!upstream.ok)throw Error('DeepSeek HTTP '+upstream.status);
    const raw=JSON.parse(data.choices?.[0]?.message?.content||'{}');if(Array.isArray(raw.actions)&&!/(?:第?\s*[\d零一二两三四五六七八九十百]+\s*(?:层|楼|[fF]))|室内|本层|当前楼层|大厅/.test(text))for(const action of raw.actions)if(action.type==='robots'){action.exterior=true;action.floor=1;}if(Array.isArray(raw.actions)){const floors=[...text.matchAll(/(?:第\s*)?([\d零一二两三四五六七八九十百]+)\s*(?:层|楼|[fF])/g)].map(m=>protocol.number(m[1]));const unique=[...new Set(floors)];for(const action of raw.actions){if(action.type==='robots'&&unique.length===1&&!/楼外|室外|外面/.test(text)){action.floor=unique[0];action.exterior=false;}if(action.type==='extinguish'&&!floors.length)action.all=true;}}const plan=protocol.validate(raw,context);if(!plan.actions.length&&/^(?:请|帮我|给我)?(?:复原|还原|重置|灭火|扑灭|生成|制作|创建|派出|释放|召唤|停止|恢复|继续|清除|移除|暂停|打开|关闭|地震|火灾)/.test(text)){const local=protocol.parse(text,context);if(local.actions.length){send(res,200,{...local,source:'local',warning:'DeepSeek 未返回可执行事件，已按明确指令使用本地解析。'});return;}}send(res,200,{...plan,source:'deepseek'});return;
   }catch(error){warning=/timeout|abort/i.test(error.name+' '+error.message)?'DeepSeek 响应超时，已使用本地指令解析。':'DeepSeek 暂不可用，已使用本地指令解析。';}
   finally{busy=false;}
  }else warning='尚未配置 DeepSeek，正在使用本地指令解析。';
  try{const plan=protocol.parse(text,context);send(res,200,{...plan,warning,reply:plan.actions.length?'已按本地规则识别指令。':'未识别到事件，请输入如“12层发生火灾”或“生成30个丧尸进攻大楼”。'});}catch(e){send(res,400,{error:e.message});}
 }};
}
module.exports={createDisasterService};
