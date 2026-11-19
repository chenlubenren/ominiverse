(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RobotArmyProtocol=api;})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 const catalog=[
  {type:'humanoid',name:'工业人形机器人',weapon:'bullet',aliases:/\bg1\b|人形|双足|类人|宇树人形/i},
  {type:'quadruped',name:'工业机器狗',weapon:'laser',aliases:/机器狗|四足|go2|\bb2\b|spot|波士顿|巡检狗/i},
  {type:'delivery',name:'轮式突击机器人',weapon:'melee',aliases:/送餐|配送|bella|普渡|轮式/i},
  {type:'carrier',name:'重型物流机器人',weapon:'bullet',aliases:/物流|搬运|货运|履带|重型/i}
 ];
 function resolve(name='',type='random',random=Math.random){
  const match=catalog.find(s=>s.aliases.test(name));if(match)return{...match,randomized:false};
  const explicit=catalog.find(s=>s.type===type);if(explicit&&!name)return{...explicit,randomized:false};
  // An unrecognized name never invents an unavailable model.
  return{...catalog[Math.min(catalog.length-1,Math.floor(random()*catalog.length))],randomized:true};
 }
 function validate(action){
  const count=Number(action.count??12);if(!Number.isInteger(count)||count<1||count>120)throw Error('每次可生成 1–120 台机器人。');
  return{...action,type:'robots',count,operation:['clear','pause','resume'].includes(action.operation)?action.operation:'spawn',robotName:String(action.robotName||'').slice(0,60),robotType:catalog.some(s=>s.type===action.robotType)?action.robotType:'random',weapon:['bullet','laser','melee'].includes(action.weapon)?action.weapon:'auto',exterior:action.exterior!==false,hostile:action.hostile!==false};
 }
 return{catalog,resolve,validate};
});
