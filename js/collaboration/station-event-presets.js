/* Every station description resolves to an event; existing scene tools keep their actions. */
(() => {
  'use strict';
  const C=window.CoScene=window.CoScene||{};
  const presets=C.stationEventPresets=[
    {id:'capture',title:'失效卫星抵近 · 机械臂捕获',description:'一颗失效卫星翻滚着漂近，乘员手控机械臂，巡检机器人出舱减旋，机械臂抓住后把它推离。',command:'有一颗失效卫星正在靠近空间站',keywords:/舰队|战舰|战机|飞船|海盗|星际|星球大战|外星|ufo|不明飞行|不明物体|卫星|激光|攻击|进攻|突袭|入侵|开火|丧尸|僵尸|怪兽|巨兽|鲸|鲨鱼|海豚|章鱼|八爪鱼|太空生物|宇宙生物|抓捕|捕获|机械臂|抵近|拦截/i},
    {id:'debris',title:'空间碎片预警 · 紧急规避',description:'碎片云逼近，天舟点火规避；碎片高速掠过并击中太阳翼，巡检机器人飞去检查损伤。',command:'空间碎片云正在逼近空间站',keywords:/陨石|流星|小行星|彗星|碎片|太空垃圾|撞击|碰撞|弹珠|地震|规避|变轨|躲避|避让|击中|撞上/},
    {id:'resupply',title:'天舟货运飞船交会对接',description:'货运飞船自主交会、停泊、对接节点舱，机器人把新货包从对接通道搬进舱内。',command:'天舟货运飞船来送补给',keywords:/货运飞船|补给飞船|货船|对接|交会|补给|快递|外卖|包裹|物资|送货|到货|蹭饭|喂食|投喂|送餐/},
    {id:'attitude',title:'推进器误喷 · 姿态失控',description:'一台姿控推进器误喷，整站开始旋转，地球在舷窗外转动；乘员抓牢扶手，机器人收拢漂浮物，反向喷气制动。',command:'空间站姿态失控开始旋转',keywords:/重力|失重|洗衣机|翻滚|转圈|倒立|旋转|滚筒|黑洞|虫洞|姿态|(?<!卫星|飞船|目标)失控|打转|自转|眩晕|陀螺|推进器|喷气/},
    {id:'solar',title:'太阳风暴 · 质子事件',description:'太阳爆发耀斑，高能粒子流掠过空间站，地球亮起极光；太阳翼收拢，乘员进入屏蔽区，机器人加装屏蔽水袋。',command:'来一场太阳风暴',keywords:/太阳风暴|太阳耀斑|耀斑|日冕|太阳风|太阳活动|辐射|射线|质子|极光|磁暴|空间天气|宇宙线|粒子风暴/},
    {id:'breach',title:'舱壁破损漏气',scope:'cabin',description:'舱壁出现破口，气流和冰晶喷出，机器人检漏并压上补片。',command:'让当前舱的舱壁破损漏气',keywords:/漏气|泄压|失压|减压|气压|氧气泄漏|舱壁|破损|损坏|坏了|故障|破裂|破口|破洞|裂缝|裂开|撞穿|击穿|穿孔|舱门打开|打开舱门/},
    {id:'fire',title:'设备电弧火情',scope:'cabin',description:'设备柜爆出电弧，失重火团与烟雾扩散，机器人断电并喷射灭火剂。',command:'让当前舱的设备发生电弧火情',keywords:/火灾|火情|起火|着火|电弧|火花|冒烟|烟雾|烟气|短路|烧起来|燃烧|点燃|爆炸|引爆/},
    {id:'coolant',title:'冷却管爆裂',scope:'cabin',description:'冷却管接头崩开，液滴漂满舱内，机器人吸回液滴并装上新卡箍。',command:'让当前舱的冷却管爆裂',keywords:/冷却|冷凝|冷媒|冷液|管道|水管|管线|管路|爆管|爆裂|漏水|漏液|液体泄漏|淹水|洪水/},
    {id:'blackout',title:'舱段断电',scope:'cabin',description:'舱内屏幕与灯带熄灭，应急指示闪烁，机器人接入备用电源。',command:'让当前舱断电',keywords:/断电|停电|断供|跳闸|配电|没电|电力|电源|熄灯|关灯|黑屏|灯灭|失去照明|电梯/},
    {id:'spill',title:'餐包破裂 · 漂浮物回收',scope:'cabin',description:'热汤餐包破裂，液滴、面条和碎屑四散漂浮，乘员抓取大块，机器人用吸嘴回收。',command:'当前舱的餐包破了',keywords:/泡面|方便面|拉面|面条|食物|食品|零食|厨房|吃饭|做饭|用餐|进餐|餐包|餐食|汤|饮料|咖啡|打翻|洒了|洒落|漂浮物/},
    {id:'broadcast',title:'天宫课堂 · 天地通话',scope:'cabin',description:'天地通话接通，乘员向地面挥手并演示失重水球，机器人掌镜补光。',command:'开一堂天宫课堂',keywords:/迪斯科|蹦迪|跳舞|舞会|派对|音乐|唱歌|演唱会|disco|party|课堂|上课|讲课|直播|天地通话|视频通话|通话|采访|表演|拍照|合影|自拍|庆祝|生日|过年|春节|节日|你好|您好|嗨|hello|\bhi\b|早上好|晚上好|问候|打招呼|挥手/i}
  ];
  const preserved=new Set(['help','decoration','place-object','undo-decoration','clear-decoration']);
  const moduleNames=C.stationEventModuleNames={tianhe:'天和 · 指令舱',habitat:'天和 · 生活舱',node:'多向对接节点',wentian:'问天 · 生命实验舱',mengtian:'梦天 · 物理实验舱',tianzhou:'天舟 · 货运舱',shenzhou:'神舟 · 轨道舱',airlock:'气闸 · 出舱准备舱'};
  const moduleAliases=[['habitat',/(?:天和[·・]?)?(?:生活舱|居住舱)|habitat/i],['tianhe',/天和(?:[·・]?(?:核心舱|指令舱|舱))?|指令舱|核心舱|tianhe/i],['node',/多向对接节点|对接节点|节点舱|对接舱|\bnode\b/i],['wentian',/问天(?:[·・]?(?:生命实验舱|实验舱|舱))?|生命实验舱|wentian/i],['mengtian',/梦天(?:[·・]?(?:物理实验舱|实验舱|舱))?|物理实验舱|mengtian/i],['tianzhou',/天舟(?:[·・]?(?:货运舱|舱))?(?!货运飞船|飞船)|货运舱|货舱|tianzhou/i],['shenzhou',/神舟(?:[·・]?(?:轨道舱|返回舱|舱))?|轨道舱|返回舱|shenzhou/i],['airlock',/气闸(?:[·・]?(?:出舱准备舱|舱))?|出舱准备舱|airlock/i]];
  const play=(preset,target,fallback=false)=>({action:'station-scenario',operation:'play',options:{scenario:'visitor',orbitalEvent:preset.id,...(target.module?{targetModule:target.module}:{}),...(target.auto?{targetAuto:true}:{})},routeReason:(fallback?'这条描述接入':'触发')+'《'+preset.title+'》'+(target.module?'，位置：'+moduleNames[target.module]:''),fallback});
  const control=operation=>({action:'station-scenario',operation});
  // Stable choice for free text: different messages reach different scenes.
  const pick=(list,text)=>{let h=2166136261;for(const ch of text){h^=ch.codePointAt(0);h=Math.imul(h,16777619)>>>0;}return list[h%list.length];};
  C.stationEventHelp=()=> '可以直接描述想观察的变化，例如“有一颗失效卫星正在靠近空间站”“来一场太阳风暴”“天舟货运飞船来送补给”“问天舱漏气”“当前舱断电”“开一堂天宫课堂”；也可从事件实验面板填入示例，再按 Enter 执行。可自由转动视角、进入舱段观察；左侧舱内画面实时显示乘员和机器人的反应，点击可进入该舱。支持“暂停”“继续”“再来一次”“清除事件”，也可以标注位置、放置机器人或调整布置。';
  C.routeStationEvent=function(text,command={action:'note'},context={}){
    if(preserved.has(command.action))return command;
    const raw=String(text||'').trim(),s=raw.replace(/[\s，,。！!《》“”「」『』]/g,'').replace(/仓/g,'舱');
    if(!raw)return command;
    if(command.action==='station-scenario'){
      const options=command.options||{};
      const dedicated=options.orbitalEvent||options.shortFilm||options.film||options.matrixFilm||options.comparison||options.layout||options.robot||options.variant||/第六位乘客|请别把我关起来|两边都在求救|谁在替你下命令|它还在外面|最后一扇门|风暴救援|机器人回收/.test(s);
      if(command.operation!=='play'||dedicated)return command;
    }
    // Explicit cooperative placement remains a scene tool; combat or dancing is an event.
    if(command.action==='robot'&&!/攻击|进攻|突袭|入侵|开火|激光|跳舞|蹦迪|舞会|迪斯科|派对|disco|party/i.test(s))return command;
    const body=s.replace(/^(请帮我|帮我|请|给我)/,'').replace(/^(在空间站|空间站|在太空站|太空站)/,'');
    if(/^(事件帮助|事件列表|预设列表|动画列表|空间站玩法|趣味事件|有哪些玩法|有哪些事件)$/.test(body))return control('help');
    if(/^(暂停|暂停一下|先暂停|先停一下|暂停播放|暂停动画|暂停事件|暂停模拟|暂停当前动画)$/.test(body))return control('pause');
    if(/^(继续|继续吧|继续播放|继续动画|继续事件|继续模拟|恢复播放|恢复动画|恢复模拟)$/.test(body))return control('resume');
    if(/^(停止|停下|结束|取消|停止播放|结束播放|停止动画|停止事件|结束事件|停止攻击|停火|返回日常|回到日常|恢复日常|恢复正常|复原|还原|重置|清除事件|清除灾害|清除所有事件)$/.test(body)||command.action==='clear')return control('stop');
    if(/^(停止|结束|取消|清除)(当前的?|这场|这段|正在进行的|正在播放的)?/.test(body)&&presets.some(p=>p.keywords.test(body))||/^关闭/.test(body)&&presets.some(p=>body.includes(p.title.replace(/\s/g,''))))return control('stop');
    if(/^(重播|重播一次|重播一遍|再播一次|再来一次|重新播放|重播动画|重播事件|重播剧情|再看一次)$/.test(body))return control('replay');
    if(/^(动画|事件)(状态|进度)$/.test(body))return control('status');
    // Resolve a named cabin first, even when the legacy parser classified the text as a note.
    const named=moduleAliases.map(([id,rule])=>({id,match:rule.exec(s)})).filter(item=>item.match).sort((a,b)=>a.match.index-b.match.index||b.match[0].length-a.match[0].length)[0]?.id;
    const current=moduleNames[context.module]?context.module:'tianhe';
    const target=preset=>{if(named)return{module:named};if(moduleNames[command.module])return{module:command.module};if(/当前舱|这个舱|本舱|这里|此处/.test(s))return{module:current};return preset.scope==='cabin'?{module:current,auto:true}:{};};
    const norm=x=>x.replace(/[\s，,。！!《》“”「」『』]/g,''),exact=presets.find(p=>body===norm(p.title)||body===norm(p.command))||presets.find(p=>body.includes(norm(p.title)));if(exact)return play(exact,target(exact));
    // A specific cabin event wins over generic impact, attack or greeting wording.
    const ordered=['coolant','fire','blackout','spill','breach','solar','attitude','resupply','debris','capture','broadcast'].map(id=>presets.find(p=>p.id===id));
    const match=ordered.find(p=>p.keywords.test(body));if(match)return play(match,target(match));
    const pool=presets.filter(p=>context.phase==='interior'?p.scope==='cabin'&&p.id!=='broadcast':!p.scope),fallback=pick(pool,body);
    return play(fallback,target(fallback),true);
  };
})();
