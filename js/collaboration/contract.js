/* Shared contract for local preview and future provider adapters; no credentials. */
(function(root){
  'use strict';
  const stationTypes=['station_octo','station_flyer','station_jelly','station_star','station_gecko'];
  // Provider adapters support the ground rigs; orbital rigs are registered locally.
  const types=['humanoid','delivery','quadruped','carrier'];
  const allTypes=[...types,...stationTypes];
  const isStationType=type=>stationTypes.includes(type);
  const stationJoints=new Map();
  const copyJoint=joint=>({...joint,axis:Array.isArray(joint.axis)?[...joint.axis]:joint.axis});
  const setStationJoints=(type,joints)=>{if(!isStationType(type)||!Array.isArray(joints))throw new Error('空间站机器人关节配置无效。');stationJoints.set(type,joints.map(copyJoint));};
  const defaultTask=type=>({quadruped:'inspect',delivery:'deliver',carrier:'supply',station_octo:'inspect',station_flyer:'inspect',station_jelly:'assist',station_star:'supply',station_gecko:'inspect'}[type]||'assist');
  const palette={shell:'#e4eef6',accent:'#6b9bc4',dark:'#31475c'};
  let humanoidJoints=null;
  const setHumanoidJoints=joints=>{humanoidJoints=joints;};
  const jointSchema = type => {
    if(isStationType(type)){const joints=stationJoints.get(type);if(!joints)throw new Error('请先加载空间站机器人模型。');return joints.map(copyJoint);}
    if(type==='humanoid'){if(!humanoidJoints)throw new Error('人形关节尚未准备好。');return humanoidJoints.map(j=>({...j,axis:[...j.axis]}));}
    const entries = type==='quadruped' ? ['front_left','front_right','rear_left','rear_right'].flatMap(s=>[['abduction','侧摆',-.65,.65,'z'],['hip','髋',-.9,1.5,'x'],['knee','膝',-2.7,-.05,'x']].map(([n,l,a,b,axis])=>[s+'_'+n,({front_left:'左前',front_right:'右前',rear_left:'左后',rear_right:'右后'}[s])+l,a,b,axis])) : type==='delivery' ? [['head','交互屏',-.8,.8,'y'],['tray','托盘升降',0,.18,'y','prismatic'],...['left','right'].map(s=>[s+'_wheel',s+' 驱动轮',null,null,'x','continuous'])] : [['lift','货台升降',0,.22,'y','prismatic'],...['front_left','front_right','rear_left','rear_right'].map(s=>[s+'_wheel',s+' 车轮',null,null,'x','continuous'])];
    return entries.map(([name,label,lower,upper,axis,type='revolute'])=>({name,label,type,axis,lower,upper}));
  };

  function normalizeSpec(input={}){
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('机器人参数必须为对象。');
    const type=allTypes.includes(input.type)?input.type:'humanoid';
    const color=/^#[0-9a-f]{6}$/i.test(input.color||'')?input.color:palette.accent;
    const scale=Number.isFinite(Number(input.scale))?Math.max(.75,Math.min(1.25,Number(input.scale))):1;
    const rawName=String(input.name||'我的协作伙伴').trim().slice(0,24)||'我的协作伙伴';
    // Migrate names supplied by earlier versions; preserve names written by the user.
    const name=({'SPOT · 巡检伙伴':'四足巡检伙伴','Unitree G1':'人形协作伙伴','我的 G1 伙伴':'我的人形伙伴','NOVA · 人形伙伴':'人形协作伙伴','MILO · 送餐伙伴':'送餐服务伙伴','CARGO · 物流伙伴':'物流搬运伙伴'})[rawName]||rawName;
    const accessories=Array.isArray(input.accessories)?[...new Set(input.accessories.filter(a=>['screen','tray','sensor','cargo','antenna'].includes(a)))]:[];
    return{type,color,scale,name,accessories,appearanceVersion:3,inspectionCount:Number.isInteger(input.inspectionCount)?Math.max(1,Math.min(3,input.inspectionCount)):3,...(typeof input.taskText==='string'?{taskText:input.taskText.trim().slice(0,160)}:{}),...(typeof input.taskTarget==='string'?{taskTarget:input.taskTarget.slice(0,80),taskTargetName:String(input.taskTargetName||'').slice(0,40)}:{}),task:['assist','deliver','inspect','supply','inspect-deliver','inspect-supply','deliver-inspect'].includes(input.task)?input.task:defaultTask(type)};
  }
  function migrateSavedSpec(input={}){
    const next={...input};
    if((input.appearanceVersion||0)<3){
      const previousDefaults={humanoid:['#8c9ba9','#587da6'],quadruped:['#e5b321','#387c83'],delivery:['#52a99e'],carrier:['#8191c4']};
      if(previousDefaults[input.type]?.includes(input.color))next.color=palette.accent;
    }
    return normalizeSpec(next);
  }
  // Cloud output describes this model's existing rig; it cannot replace its topology or execute code.
  function validateJointConfiguration(type,input){
    const expected=jointSchema(type);
    if(!Array.isArray(input)||input.length!==expected.length)throw new Error('关节配置不完整，请重新生成。');
    const seen=new Set(),byName=new Map(input.map(j=>[j?.name,j]));
    return expected.map(base=>{
      const joint=byName.get(base.name);
      if(!joint||seen.has(joint.name)||joint.type!==base.type)throw new Error('关节名称或类型与当前模型不匹配。');
      seen.add(joint.name);
      const a=Array.isArray(base.axis)?base.axis:[base.axis],b=Array.isArray(joint.axis)?joint.axis:[joint.axis];
      if(a.length!==b.length||a.some((x,i)=>typeof x==='number'?typeof b[i]!=='number'||!Number.isFinite(b[i])||Math.abs(x-b[i])>1e-7:x!==b[i]))throw new Error('关节转轴与当前模型不匹配。');
      for(const field of ['lower','upper'])if(base[field]===null?joint[field]!==null:typeof joint[field]!=='number'||!Number.isFinite(joint[field])||Math.abs(base[field]-joint[field])>1e-7)throw new Error('关节限位与当前模型不匹配。');
      if(typeof joint.label!=='string'||!joint.label.trim()||joint.label.length>60)throw new Error('关节说明无效。');
      return{...base,label:joint.label.trim(),axis:Array.isArray(joint.axis)?[...joint.axis]:joint.axis,lower:joint.lower,upper:joint.upper};
    });
  }
  function interpret(text,previous={}){
    const spec=normalizeSpec(previous);
    if(isStationType(spec.type)){
      for(const [pattern,type]of [[/章鱼/,'station_octo'],[/飞球/,'station_flyer'],[/水母/,'station_jelly'],[/海星/,'station_star'],[/壁虎/,'station_gecko']])if(pattern.test(text))spec.type=type;
    }else if(/机器狗|四足|狗狗/.test(text))spec.type='quadruped';
    else if(/送餐|餐饮|餐盘/.test(text))spec.type='delivery';
    else if(/物流|搬运|货运|货箱/.test(text))spec.type='carrier';
    else if(/人形|双足|类人/.test(text))spec.type='humanoid';
    const palette=[[/蓝色|蓝白|白蓝/,'#2684ed'],[/薄荷|绿色|绿白/,'#52a99e'],[/橙色|橙白/,'#e99450'],[/黄色|金黄/,'#e8ad56'],[/紫色|薰衣草/,'#9682c7'],[/粉色|粉白/,'#d88fae'],[/黑色/,'#42566e'],[/银色|银灰/,'#a6b7c9']];
    for(const [re,color]of palette)if(re.test(text))spec.color=color;
    const hex=text.match(/#[0-9a-f]{6}/i);if(hex)spec.color=hex[0];
    if(/小巧|迷你|小一点/.test(text))spec.scale=.8;if(/高大|大一点|大型/.test(text))spec.scale=1.2;
    for(const [re,key]of [[/屏幕|显示屏/,'screen'],[/托盘|餐盘|送餐/,'tray'],[/传感器|巡检|雷达/,'sensor'],[/天线/,'antenna'],[/货箱|搬运|物流/,'cargo']])if(re.test(text)&&!spec.accessories.includes(key))spec.accessories.push(key);
    const match=text.match(/(?:叫做|名字是|取名为|命名为|叫)[“「"]?([^，。！、\n”」"]{1,24})/);if(match)spec.name=match[1].trim();
    spec.task=defaultTask(spec.type);return spec;
  }
  const api={types,allTypes,stationTypes,isStationType,palette,jointSchema,setHumanoidJoints,setStationJoints,normalizeSpec,migrateSavedSpec,interpret,validateJointConfiguration};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RobotContract=api;
})(typeof window==='undefined'?globalThis:window);
