/* Explicit chat commands invoke the existing simulation, never generated code. */
(() => {
  'use strict';const C=window.CoScene=window.CoScene||{};
  const names={fire:'火灾',earthquake:'地震',infection:'呼吸道传播',zombie:'丧尸'};
  const numeral=value=>{if(/^\d+$/.test(value))return Number(value);const digits={'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};if(value==='十')return 10;if(value.includes('十')){const [a,b]=value.split('十');return(digits[a]||1)*10+(digits[b]||0);}return digits[value];};
  const moduleNames={生活舱:'habitat',指令舱:'tianhe',天和:'tianhe',对接节点:'node',问天:'wentian',梦天:'mengtian',天舟:'tianzhou',货运舱:'tianzhou',神舟:'shenzhou',气闸:'airlock'};
  const colors={'橙色':'#e89b51','暖色':'#dba566','蓝色':'#5597cd','绿色':'#6ca891','紫色':'#aa91c9','白色':'#e8eef4','红色':'#d67874'};
  const storyNames={visitor:'第六位乘客',infection:'请别把我关起来',leak:'两边都在求救',spoof:'谁在替你下命令',storm:'它还在外面',evacuation:'最后一扇门'};
  const shortStoryNames={water:'失控的水球',visitor:'第六位乘客·捉迷藏',rescue:'接住我',zombie:'别让它学会开门'};
  const shortStoryAliases={水球短片:'water',失控的水球:'water',外星捉迷藏:'visitor','第六位乘客·捉迷藏':'visitor',第六位乘客捉迷藏:'visitor',接住我:'rescue',失重救援短片:'rescue',丧尸模拟:'zombie',别让它学会开门:'zombie',空间站丧尸:'zombie'};
  const shortPlay=id=>({action:'station-scenario',operation:'play',options:{scenario:'visitor',shortFilm:id}});
  const storyHelp='30秒无声十二宇宙短片：播放水球短片（失控的水球）、播放外星捉迷藏（第六位乘客·捉迷藏）、播放接住我（失重救援短片）、播放丧尸模拟（别让它学会开门）。每片从共同开场展开12种机器人组合，再汇回一个结局和原舱轴测视角。发送“播放十二宇宙矩阵”可从单画面展开12分屏，对比1/2/3台机器人与四种功能配置，无声放映，共104秒。结尾汇回一个世界，并回到舱段抽出的轴测视角。《请别把我关起来》默认播放这一版；指定“接出患者”或“维持隔离”可观看82秒单线短片。发送“播放双结局对照”可并排观看两种结果。指定布局或机器人可进入旧版设计对照演练。空间站故事：播放第六位乘客、预演《请别把我关起来》、预演《两边都在求救》、播放伪造指令、播放风暴救援、播放紧急撤离。发送“播放多重宇宙矩阵”可轮播3种布局×3种机器人，共9个平行宇宙并比较结局。可组合“播放第六位乘客，隔离分支，隔断布局，科研机器人”；支持接触/隔离/救援分支、开放/隔断/狭窄布局、科研探测球/医疗伴飞器/物资作业艇。在决策窗口内发送“选择接触”“选择隔离”或“选择救援”；感染故事也可选“先诊断/留舱隔离/接出患者”，漏气故事可选“定位封堵/分区保压/优先救人”；还可发送“暂停剧情”“继续剧情”“停止剧情”“剧情状态”。';
  function storyCommand(s){
    if(shortStoryAliases[s])return shortPlay(shortStoryAliases[s]);
    const exact=Object.entries(storyNames).find(([,title])=>s===title);if(exact)return{action:'station-scenario',operation:'play',options:{scenario:exact[0]}};
    const body=s.replace(/^(请帮我|帮我|请)/,'').replace(/^(在空间站|空间站)/,'');
    if(shortStoryAliases[body])return shortPlay(shortStoryAliases[body]);
    if(/^(剧情帮助|故事帮助|情景帮助|放映帮助|故事列表|情景列表)$/.test(body))return{action:'station-scenario',operation:'help'};
    const control=body.match(/^(暂停|继续|恢复|停止|结束|取消)(当前|正在播放的)?(剧情|故事|放映|情景)(播放|放映)?$/);
    if(control)return{action:'station-scenario',operation:control[1]==='暂停'?'pause':/继续|恢复/.test(control[1])?'resume':'stop'};
    const choice=body.match(/^(选择|采用|改为)(接触|隔离|救援|先诊断|诊断|维持隔离|留舱隔离|接出患者|定位封堵|封堵|分区保压|优先救人)(分支|路线|方案)?$/);
    if(choice)return{action:'station-scenario',operation:'choose',variant:({接触:'contact',隔离:'isolate',救援:'rescue',先诊断:'contact',诊断:'contact',维持隔离:'isolate',留舱隔离:'isolate',接出患者:'rescue',定位封堵:'contact',封堵:'contact',分区保压:'isolate',优先救人:'rescue'})[choice[2]]};
    if(/^(剧情|故事|放映)(状态|进度)$/.test(body))return{action:'station-scenario',operation:'status'};
    // Only explicit playback phrases can start a story. A crew member's name
    // or a casual mention of aliens in conversation must not reset the scene.
    const request=body.match(/^(播放|放映|演示|预演|预览|启动|开始|重播|模拟)(一下|一场|一个|一次)?(.+)$/);if(!request)return null;
    const text=request[3];if(shortStoryAliases[text])return shortPlay(shortStoryAliases[text]);if(/十二|12|机器人矩阵|分屏/.test(text))return{action:'station-scenario',operation:'play',options:{scenario:'infection',film:true,matrixFilm:true}};if(/双结局|冷峻对照/.test(text))return{action:'station-scenario',operation:'play',options:{scenario:'infection',film:true,comparison:true}};const matrix=/多重宇宙|平行宇宙|宇宙矩阵/.test(text);
    const scenario=/第六位乘客|第六名乘客|外星(人)?(入侵|侵入)|外星来客/.test(text)?'visitor':/船员感染|船员被感染|病毒感染|感染船员|请别把我关起来/.test(text)?'infection':/两边都在求救|漏气危机/.test(text)?'leak':/谁在替你下命令|伪造指令/.test(text)?'spoof':/太阳风暴|风暴救援|机器人回收|它还在外面/.test(text)?'storm':/最后一扇门|紧急撤离/.test(text)?'evacuation':null;
    if(!scenario&&!matrix)return null;
    const options={};if(scenario)options.scenario=scenario;
    // Match settings explicitly so the word "救援" in a story title does not
    // silently overwrite its branch; presets provide all unspecified values.
    const variant=/隔离(分支|路线|方案)|分支(为|是|选)?隔离|选择隔离|立即封舱|维持隔离|留舱隔离|分区保压/.test(text)?'isolate':/救援(分支|路线|方案)|分支(为|是|选)?救援|选择救援|直接开门|接出患者|优先救人/.test(text)?'rescue':/接触(分支|路线|方案)|分支(为|是|选)?接触|选择接触|和平接触|先诊断|定位封堵|封堵(分支|方案)/.test(text)?'contact':null;
    const layout=/隔断(布局|空间|舱)|布局(为|是|选)?隔断/.test(text)?'partitioned':/狭窄(布局|空间|舱)|布局(为|是|选)?狭窄/.test(text)?'narrow':/开放(布局|空间|舱)|布局(为|是|选)?开放/.test(text)?'open':null;
    const robot=/医疗伴飞器|医疗(机器人|机型)|机器人(为|是|选)?医疗/.test(text)?'medical':/物资作业艇|(运输|货运|物流)(机器人|机型)|机器人(为|是|选)?(运输|货运|物流)/.test(text)?'cargo':/科研探测球|科研(机器人|机型)|机器人(为|是|选)?科研/.test(text)?'science':null;
    if(variant)options.variant=variant;if(layout)options.layout=layout;if(robot)options.robot=robot;
    return{action:'station-scenario',operation:matrix?'matrix':'play',options};
  }
  function scope(s){const match=s.match(/(?:第)?([0-9一二两三四五六七八九十]+)(?:楼|层|[fF])/),floor=match?numeral(match[1]):null,module=Object.entries(moduleNames).find(([name])=>s.includes(name))?.[1]||null;return{floor,module,environment:module||/空间站|太空站|天宫/.test(s)?'station':/园区|楼外/.test(s)?'campus':floor!==null||/办公楼|楼栋|大楼/.test(s)?'office':null};}
  function parse(text){
    const raw=String(text).trim(),s=raw.replace(/[\s，,。！!《》“”「」『』]/g,'');
    if(/^(帮助|指令|支持什么|可以做什么)[?？]?$/.test(s))return{action:'help'};
    // Questions, reports and negated requests must never cause an incident.
    if(/不要|不能|别|不想|不需要|没有|不会|未发生|避免|防止|如果|假如|是否|能否|怎么办|如何|怎么|为什么|吗|[?？]/.test(s.replace('请别把我关起来','感染故事').replace('别让它学会开门','空间站短片')))return{action:'note'};
    const story=storyCommand(s);if(story)return story;
    for(const match of raw.matchAll(/([+-]?\d+(?:\.\d+)?)\s*(?:楼|层|[fF])/g))if(!Number.isInteger(Number(match[1]))||Number(match[1])<1)return{action:'invalid-floor'};
    const target=scope(s),bodyText=s.replace(/^(请帮我|帮我|请)/,'');
    if(/^(撤销|回退)(上一步|刚才|最近)?(装饰|布置|修改|操作)?$/.test(bodyText))return{action:'undo-decoration',...target};
    if(/^(清除|移除|恢复)(当前|所有|全部|原有)?(装饰|布置|新增物品|空间配色)$/.test(bodyText))return{action:'clear-decoration',...target};
    // Preserve task separators: removing punctuation can hide an unsupported next step.
    const robot=raw.match(/(?:放置|添加|加入|生成|创建)(?:一个|一台|一只|个|台|只)?(舱内章鱼|随行飞球|医护水母|理货海星|检修壁虎|章鱼|飞球|水母|海星|壁虎|人形机器人|工业人形|送餐机器人|巡检机器人|物流机器人|四足机器人|机器狗|机器人)([\s\S]*)$/);
    if(robot){const stationType=/章鱼/.test(robot[1])?'station_octo':/飞球/.test(robot[1])?'station_flyer':/水母/.test(robot[1])?'station_jelly':/海星/.test(robot[1])?'station_star':/壁虎/.test(robot[1])?'station_gecko':null;const type=stationType||(/送餐/.test(robot[1])?'delivery':/巡检|机器狗|四足/.test(robot[1])?'quadruped':/物流/.test(robot[1])?'carrier':/人形/.test(robot[1])?'humanoid':null);return{action:'robot',type,taskText:robot[2].replace(/^[\s，,。:：；;]+/,'').replace(/^(让它|让机器人|用于|来|并|任务是|执行任务)/,'').trim(),...target};}
    if(/装饰|装修|配色|地板|地面|墙面|空间|房间|舱内/.test(s)&&/改|换|设置|切换|变成/.test(s)){const color=Object.entries(colors).find(([name])=>s.includes(name));return{action:'decoration',surface:/地板|地面/.test(s)?'floor':/墙面/.test(s)?'wall':'accent',color:color?.[1],colorName:color?.[0],...target};}
    const object=bodyText.match(/(?:放置|添加|摆放|放入|放一|摆一)(?:一个|一盆|一把|一箱|一台|个|盆|把|箱|台)?(绿植|盆栽|座椅|椅子|补给箱|货物箱|货箱|实验仪器|仪器)(?:$|到|在)/);
    if(object)return{action:'place-object',kind:/绿植|盆栽/.test(object[1])?'plant':/座椅|椅子/.test(object[1])?'chair':/仪器/.test(object[1])?'instrument':'cargo',...target};
    const floorMatch=s.match(/(?:第)?([0-9一二两三四五六七八九十]+)(?:楼|层|[fF])/),floor=floorMatch?numeral(floorMatch[1]):null;
    const body=s.replace(/(?:第)?([0-9一二两三四五六七八九十]+)(?:楼|层|[fF])/g,'').replace(/^(请帮我|帮我|请)/,'').replace(/^(在|让|使)/,'').replace(/^(当前楼层|标记位置|标注位置|这个位置|这里|此处|办公楼|大楼|本层|当前|全楼|所有)/,'');
    if(/^(清除|结束|停止|取消)(当前|所有|全部)?(灾害|事件|情景|火灾|地震|呼吸道传播|传染病|丧尸)(实验|模拟)?$/.test(body)||/^(恢复日常|恢复正常|恢复日常办公)$/.test(body))return{action:'clear'};
    if(/^(恢复|重启|启用|开启)电梯(运行|服务)?$/.test(body)||/^电梯(恢复|恢复运行|恢复服务)$/.test(body))return{action:'lift',disabled:false};
    if(/^(电梯(停运|停用|停止运行|故障)|(?:停运|停用|关闭)电梯)$/.test(body))return{action:'lift',disabled:true};
    const incident=body.replace(/^(发生|触发|启动|开启|开始|模拟|制造|添加|来)(一场|一个|一次|场)?/,'');
    const scenario=Object.entries({fire:/^(火灾|起火|着火)(情景|场景|实验|模拟)?$/,earthquake:/^地震(情景|场景|实验|模拟)?$/,infection:/^(呼吸道传播|传染病)(情景|场景|实验|模拟)?$/,zombie:/^丧尸(感染|情景|场景|实验|模拟)?$/}).find(([,rule])=>rule.test(incident));
    if(scenario)return{action:'disaster',type:scenario[0],floor};
    return{action:/火灾|起火|地震|电梯|爆炸|洪水|停电|触发|模拟|启动|装饰|装修|家具|摆设|放置|添加|摆放|生成|创建/.test(s)?'unsupported':'note'};
  }
  class SceneCommands {
    constructor(owner){this.owner=owner;this.busy=false;this.routing=false;}
    async destination(command,location){
      const o=this.owner;if(command.environment&&location&&command.environment!==location.environment)throw Error('文字场景与位置标记不一致，请保留同一个目标场景。');
      if(command.floor&&location?.floor&&command.floor!==location.floor)throw Error('文字楼层与位置标记不一致，请保留同一个目标楼层。');
      if(command.module&&location?.module&&command.module!==location.module)throw Error('文字舱段与位置标记不一致，请保留同一个目标舱段。');
      const environment=command.environment||location?.environment||o.environment,floor=command.floor??location?.floor??o.b.selected,module=command.module||location?.module;
      if(command.floor!=null&&environment!=='office')throw Error('园区和空间站不使用办公楼层号，请指定一个场景或一个舱段。');
      if(environment==='office'&&(!Number.isInteger(floor)||floor<1||floor>30))throw Error('办公楼支持 1 至 30 层，请指定有效楼层。');
      this.routing=true;
      try{if(o.environment!==environment)await o.switchEnvironment(environment);if(o.environment!==environment)throw Error('未能进入目标场景，请重试。');this.busy=true;
        if(environment==='station'&&(o.stationExperience.shellStudy?.changed||o.stationExperience.morphBusy))throw Error('当前为外壳预览，请先点击“恢复原貌”，再调整舱内布置。');
        if(environment==='office'&&(o.b.phase!=='interior'||o.b.selected!==floor))await o.b.enterFloor(floor);
        if(environment==='station'&&(module&&o.stationExperience.selected!==module||o.stationExperience.phase!=='interior'))o.stationExperience.enter(module||o.stationExperience.selected,{animate:false});
      }finally{this.routing=false;}
    }
    async execute(text,location){
      const o=this.owner,chat=o.chat;let command=parse(text);
      if(o.environment==='station'&&C.routeStationEvent)command=C.routeStationEvent(text,command,{module:location?.environment==='station'?location.module:o.stationExperience?.selected,phase:o.stationExperience?.phase});
      if(command.action==='invalid-floor'){chat.add('办公楼层号必须是 1 至 30 的正整数，不能使用负数、小数或零。','未执行');return;}
      const events=window.IndoorLab?.eventIntegration;
      if(events?.recognizes(text,command)&&await events.tryHandle(text,location,command))return;
      if(command.action==='note')return;
      if(command.action==='station-scenario'){
        if(command.operation==='help'){const storyRequest=/剧情|故事|情景|放映/.test(text);chat.add(storyRequest?storyHelp:(C.stationEventHelp?.()||storyHelp),storyRequest?'剧情指令':'空间站提示');return;}
        const orbitalRequest=!!command.options?.orbitalEvent;
        if(o.environment!=='station'||location&&location.environment!=='station'){chat.add(orbitalRequest?'这些事件会发生在空间站里。请先切到空间站，并使用空间站的位置标记。':'这些故事在空间站放映。请先切到空间站，再发送“播放第六位乘客”或“播放多重宇宙矩阵”。','未执行');return;}
        if(this.busy||this.routing||o.switching||o.app.busy||o.robotInteraction?.pending){chat.add(orbitalRequest?'正在准备场景或放置机器人，请完成当前操作后再触发事件。':'正在准备场景或放置机器人，请完成当前操作后再放映故事。','未执行');return;}
        const director=o.stationExperience?.scenarios;
        if(!director){chat.add('空间站还没有准备好，请等待场景加载完成后重试。','未执行');return;}
        this.busy=true;
        try{
          if(command.operation==='status'){
            const state=director.snapshot?.();
            if(!state||state.active===false){chat.add('当前没有正在进行的事件。可以描述想观察的变化，或发送“帮助”。','空间站');return;}
            const liveEvent=!!(state.orbitalEvent||state.options?.orbitalEvent||director.options?.orbitalEvent||director.film?.liveEvent);
            const title=liveEvent?'空间站现场':state.title||storyNames[state.scenario]||'空间站故事',progress=Number.isFinite(state.time)?(liveEvent?' · 已进行 ':' · 已播放 ')+Math.floor(state.time)+' 秒':'';
            chat.add(title+(state.paused?' · 已暂停':liveEvent?' · 进行中':' · 放映中')+progress+(state.caption?' · '+state.caption:''),liveEvent?'空间站事件':'剧情');return;
          }
          if(command.operation==='replay'){
            const previous=director.options||this.lastStoryOptions;
            if(!previous){chat.add('当前还没有可以重新开始的事件。可以描述想观察的变化。','空间站');return;}
            command={...command,operation:'play',options:{...previous,manual:false}};
          }
          if(command.operation==='play'){
            if(await director.play(command.options)===false)return;
            this.lastStoryOptions={...command.options};
            if(command.options.orbitalEvent){
              const state=director.snapshot?.(),module=state?.resolvedModule||state?.targetModule||command.options.targetModule,moduleName=module&&(C.stationModule?.(module)?.name||C.stationEventModuleNames?.[module]||module);
              chat.add((moduleName?'位置：'+moduleName+'。':'')+(state?.caption||'正在观察空间站的变化。')+'可自由转动视角、进入舱段观察。发送“暂停”“继续”“再来一次”或“清除事件”控制本次事件。','空间站事件');return;
            }
            if(command.options.shortFilm){chat.add('开始放映《'+shortStoryNames[command.options.shortFilm]+'》：30秒无声十二宇宙短片。共同开场后，第6秒展开12种机器人数量与构型组合，第23秒汇回一个结局，最后回到原空间站舱段的轴测视角。各分支以真实人物、机器人和道具活动呈现不同结果。可发送“暂停剧情”“继续剧情”或“停止剧情”。','剧情');return;}
            chat.add(director.snapshot?.().matrixFilm?'开始104秒无声十二宇宙预演：共同开场，第27秒以舱内视角展开12分屏，对比机器人的数量、功能与协作结果；结尾汇回同一实验舱的抽出轴测视角。点击分屏可放大观察。':command.options.comparison?'开始播放冷峻双结局对照：同一求助、不同授权，救援与隔离的代价并排呈现。':director.snapshot?.().film?'开始放映《请别把我关起来》82秒完整短片：样本告警、人工授权、实体穿门、抓握接应与护理。右上角可暂停、重播、开启声音或打开聊天指令。':'开始放映《'+storyNames[command.options.scenario]+'》。人物、机器人和舱门会随剧情行动；可发送“暂停剧情”“停止剧情”，或“播放多重宇宙矩阵”比较不同发展。','剧情');
          }else if(command.operation==='matrix'){
            if(await director.playMatrix(command.options)===false)return;
            chat.add('开始多重宇宙对照放映：3种舱内布局×3种机器人，共9个宇宙依次放映，结束后比较结局。可发送“暂停剧情”或“停止剧情”。','剧情');
          }else if(command.operation==='choose'){
            if(director.film?.liveEvent||director.options?.orbitalEvent){chat.add('可继续观察人员与机器人的反应。发送“暂停”“继续”或“清除事件”控制本次事件。','空间站事件');return;}
            const result=await director.choose(command.variant);
            chat.add(result?.message||'已采用'+({contact:'接触',isolate:'隔离',rescue:'救援'}[command.variant])+'方案，观察人员与机器人的后续行动。','剧情选择');
          }else{
            const liveEvent=!!director.film?.liveEvent||!!director.options?.orbitalEvent;
            const result=await director[command.operation]();
            if(result===false){chat.add(liveEvent?'当前没有可'+({pause:'暂停',resume:'继续',stop:'清除'}[command.operation])+'的事件。可发送“来点好玩的”。':'当前没有可'+({pause:'暂停',resume:'继续',stop:'停止'}[command.operation])+'的故事。可发送“播放第六位乘客”。',liveEvent?'空间站事件':'剧情');return;}
            chat.add((liveEvent?{pause:'事件已暂停，可以继续自由观察；发送“继续”恢复事件。',resume:'事件继续进行，可以在当前空间站自由观察。',stop:'事件已清除，继续观察当前空间站。'}:{pause:'剧情已暂停，可发送“继续剧情”。',resume:'剧情继续放映。',stop:'剧情已停止，已返回日常观察。'})[command.operation],liveEvent?'空间站事件':'剧情');
          }
        }catch(error){chat.add(error.message||'故事未能开始，请重试。','未执行');}finally{this.busy=false;}
        return;
      }
      if(['robot','decoration','place-object','undo-decoration','clear-decoration'].includes(command.action)){
        const scenarios=o.stationExperience?.scenarios;if(scenarios?.blocksObservation??scenarios?.active){chat.add('请先发送“停止剧情”返回日常观察，再放置机器人或调整舱内布置。','未执行');return;}
        if(this.busy||this.routing||o.switching||o.app.busy||o.b.loading||o.b.matrixLab?.active||o.robotInteraction?.pending){chat.add('当前正在处理场景操作或选择放置位置，请完成当前操作后重试。','未执行');return;}
        if(command.action==='decoration'&&!command.color){chat.add('可以直接发送“装饰改成橙色”“地板改成蓝色”“墙面改成暖色”。也可发送“放置绿植”“放置补给箱”；附带位置标记可指定放置点。','指引');return;}
        try{
          await this.destination(command,location);
          if(command.action==='robot'){
            if(!command.type&&command.taskText)throw Error('任务已保留在聊天记录中，请补充机器人类型后重发，例如“放置'+(o.environment==='station'?'随行飞球':'送餐机器人')+'，先巡检再补给”。');
            if(command.type){const preset=(C.robotPresetsForEnvironment?.(o.environment)||C.presets).find(p=>p.type===command.type);if(!preset)throw Error(o.environment==='station'?'空间站可选择舱内章鱼、随行飞球、医护水母、理货海星或检修壁虎。':'该机器人用于空间站，请指定舱段或切换到空间站。');const mission=command.taskText?(C.parseRobotMission?C.parseRobotMission(command.taskText):{task:C.inferRobotTask(command.taskText)}):{};if(mission.error)throw Error(mission.error);o.robotInteraction.begin({...preset,...(mission.task?{task:mission.task}:{}),...(command.taskText?{taskText:command.taskText}:{})},{placementPoint:location?{x:location.x,z:location.z}:undefined});chat.add('已在'+o.locationName()+'打开'+preset.label+'任务设置。'+(location?'确认任务后放到标记位置；占用时会请你重新选点。':'确认任务后，请点击空闲位置放置。'),'指引');}
            else{o.openPanel();chat.add('已在'+o.locationName()+'打开机器人资产库。选择类型和任务后可放置；要按标记放置，请指定'+(o.environment==='station'?'“随行飞球”“舱内章鱼”等空间站机型。':'“送餐机器人”“机器狗”等机型。'),'指引');}
          }else{
            this.customization??=new C.SceneCustomization(o);let message;
            if(command.action==='decoration')message=this.customization.recolor(command.surface,command.color,command.colorName);
            else if(command.action==='place-object'){if(o.environment==='office'&&o.b.society.emergency.type!=='none')throw Error('请先清除当前灾害，再布置物品。');message=this.customization.place(command.kind,location);}
            else message=command.action==='undo-decoration'?this.customization.undo():this.customization.clear();chat.add(message,'已执行');
          }
        }catch(error){chat.add(error.message||'空间操作未完成，请重试。','未执行');}finally{this.busy=false;this.routing=false;}
        return;
      }
      if(command.action==='help'){chat.add('空间操作：装饰改成橙色、地板改成蓝色、放置绿植/座椅/补给箱/实验仪器、撤销装饰、清除装饰。机器人：在问天舱放置随行飞球、放置理货海星，先巡检再补给；地面可放置送餐机器人或机器狗。可附带位置标记，或写明楼层、园区、舱段。办公楼事件：3楼发生火灾、地震、呼吸道传播、丧尸、电梯停运、恢复电梯、清除灾害。新增事件：20层发生爆炸、通风污染、生成3台机器狗攻击人类、生成2个飞龙机器人、攻击这栋楼、灭火、复原。点击“事件实验”查看示例与统计。发送“剧情帮助”查看短片与放映操作。'+(C.stationEventHelp?.()||''),'指令');return;}
      if(command.action==='unsupported'){chat.add('这条描述尚未执行。可发送“放置绿植”“装饰改成橙色”“放置送餐机器人”，或发送“帮助”查看完整指令。','未执行');return;}
      if(this.busy||o.switching||o.app.busy||o.b.loading||o.b.matrixLab?.active||o.b.matrixLab?.busy){chat.add('场景正在处理上一项操作，请稍后再次发送。','未执行');return;}
      if(o.environment==='station'||location&&location.environment!==o.environment){chat.add('这些事件接入办公楼与园区。空间站使用独立剧情，请切回地面场景后发送。','未执行');return;}
      const floor=command.floor??location?.floor??o.b.selected;
      if(!Number.isInteger(floor)||floor<1||floor>30){chat.add('办公楼支持 1 至 30 层，请指定有效楼层。','未执行');return;}
      if(command.floor&&location&&command.floor!==location.floor){chat.add('文字楼层与位置标记不一致，请保留同一个目标楼层。','未执行');return;}
      this.busy=true;
      try{
        const s=o.b.society;
        if(command.action==='lift'){
          s.lifts.setOutOfService(command.disabled);
          chat.add(command.disabled?'全楼电梯已停运：停止接单，运行中的轿厢就近停靠，乘员下梯；跨层人员改走楼梯。':s.lifts.unavailable?'已解除手动停运；当前灾害仍要求停梯，清除灾害后恢复。':'电梯已恢复，重新接受呼梯与跨层乘坐。','已执行');return;
        }
        if(command.action==='clear'){if(window.IndoorLab?.scenarioRuntime)await window.IndoorLab.scenarioRuntime.restore({preserveCamera:true,preserveLiftOutage:true});else o.app.clearDisaster();chat.add('已清除灾害，恢复日常。'+(s.lifts.outOfService?'电梯仍为手动停运，可发送“恢复电梯”。':''),'已执行');return;}
        chat.add('正在'+floor+'F 启动'+names[command.type]+'…','现场');
        // The incident's floor is independent of the user's current view.
        // Only an explicit navigation action may enter or extract a floor.
        await o.app.startDisaster({type:command.type,floor,position:command.type==='fire'?location:null});
        if(s.emergency.type!==command.type)throw Error('事件没有启动，请重试。');
        const position=command.type==='fire'&&location?'，起火点位于标记附近的可用地面':'';
        chat.add(floor+'F '+names[command.type]+'已启动'+position+'。'+(command.type==='fire'?'火焰与烟气开始扩散，人员感知后疏散，电梯停用。':command.type==='earthquake'?'人员先避险，摇晃结束后经楼梯疏散。':'可在当前场景观察传播与人员反应。'),'已执行');
      }catch(error){chat.add(error.message||'事件执行失败，请重试。','未执行');}
      finally{this.busy=false;}
    }
  }
  C.parseSceneCommand=parse;C.SceneCommands=SceneCommands;
})();
