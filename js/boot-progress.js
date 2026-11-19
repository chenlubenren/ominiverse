/* Estimated progress follows real milestones; only a ready scene reaches 100%. */
(() => {
  'use strict';
  const root=document.getElementById('building-boot');if(!root)return;
  const status=document.getElementById('boot-status'),detail=document.getElementById('boot-detail'),note=document.getElementById('boot-wait-note'),elapsed=document.getElementById('boot-elapsed'),retry=document.getElementById('boot-retry'),steps=[...root.querySelectorAll('.boot-steps li')];
  const started=performance.now(),stages=[['正在准备空间','办公楼和空间站，正在一起准备。'],['正在迎接空间里的伙伴','准备办公人物与空间站乘员。'],['正在准备空间站','提前载入舱段与道具，进入后即可切换。'],['正在点亮场景','整理两个空间的光影与观察视角。'],['准备就绪','办公楼与空间站已就绪，开始探索。']];
  const progressTrack=document.getElementById('boot-progress-track'),progressFill=document.getElementById('boot-progress-fill'),progressPercent=document.getElementById('boot-progress-percent'),progressFloors=[0,.16,.36,.92],progressCeilings=[.20,.38,.91,.98],progressDurations=[8500,15000,24000,14000];
  let tipImage=document.getElementById('boot-tip-image');
  const tipTitle=document.getElementById('boot-tip-title'),tipText=document.getElementById('boot-tip-text'),tipIndex=document.getElementById('boot-tip-index'),tipPrevious=document.getElementById('boot-tip-previous'),tipNext=document.getElementById('boot-tip-next'),tipStatus=document.getElementById('boot-tip-status'),tipCard=root.querySelector('.boot-tip'),tips=[
    {image:'story',title:'发消息，让故事发生',text:'在底部发消息：“12层发生火灾”，按 Enter 发送。\n观察火势与人员反应，为空间增加新的故事。',alt:'聊天框发送火灾指令，办公楼内出现火势与疏散反应'},
    {image:'first-person',title:'选一个角色，亲自探索',text:'点“角色扮演”，选择人、人形机器人或扫地机器人。\n用 WASD 移动、E 交互，按 Esc 可领取潜入任务。',alt:'角色扮演窗口中的人、人形机器人与扫地机器人三个选择'},
    {image:'scenes',title:'在三个场景间穿行',text:'点击顶部“楼外园区”“办公楼”或“空间站”。\n切换观察空间，探索楼宇日常与轨道生活。',alt:'顶部场景切换按钮与办公楼、空间站的真实场景'},
    {image:'robot-library',title:'挑选或设计机器人',text:'点“部署具身智能”，在下方素材库挑选机器人。\n也可点“定制机器人”，描述想要的外形与任务。',alt:'部署具身智能窗口中的定制机器人按钮与已有机器人素材库'},
    {image:'robot-placement',title:'把机器人放进场景',text:'在机器人库选择位置、楼层、数量与行为。\n点“调用到场景”，近距离观察机器人的行动。',alt:'机器人库的放置设置、机器狗模型与调用到场景按钮'},
    {image:'dragon',title:'召唤巨头飞龙机器人',text:'发送“生成1个飞龙机器人”，召唤预设飞龙。\n观察它在楼栋旁飞行，也可以发送“攻击大楼”。',alt:'通过聊天召唤的巨头飞龙机器人在办公楼旁展开翅膀飞行'}
  ];
  let previousStage=-1,requestedTip=0,nextTip=1,tipEpoch=0,tipReadyAt=null,tipPending=false,phaseStarted=started,phaseProgress=0,progress=0,timer,observer,done=false;
  const tipAssets=new Map();
  const write=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
  const guidesActive=()=>!done&&document.body.dataset.buildingReady!=='true';
  function decoded(image){
    const loaded=image.complete&&image.getAttribute('src')
      ?image.naturalWidth>0?Promise.resolve():Promise.reject(new Error('Guide image unavailable'))
      :new Promise((resolve,reject)=>{image.onload=()=>{image.onload=image.onerror=null;resolve();};image.onerror=()=>{image.onload=image.onerror=null;reject(new Error('Guide image unavailable'));};});
    return loaded.then(()=>image.decode?image.decode():undefined);
  }
  // Keep the complete current card on screen while the next image downloads.
  // Replacing it with an already decoded node makes image/text one visual update.
  function loadTip(index){
    if(tipAssets.has(index))return tipAssets.get(index);
    const tip=tips[index],image=new Image(960,540);
    image.id='boot-tip-image';image.alt=tip.alt;image.decoding='async';image.fetchPriority='low';
    const loaded=decoded(image).then(()=>image).catch(error=>{tipAssets.delete(index);throw error;});
    tipAssets.set(index,loaded);image.src='assets/loading-tips/'+tip.image+'.webp';return loaded;
  }
  function prepareTip(index=nextTip,manual=false){
    const epoch=++tipEpoch,tip=tips[index];requestedTip=index;nextTip=(index+1)%tips.length;tipPending=true;tipReadyAt=null;tipCard.setAttribute('aria-busy','true');
    if(manual)write(tipStatus,'正在载入第 '+(index+1)+' 个玩法…');
    loadTip(index).then(image=>{
      if(!guidesActive()||epoch!==tipEpoch)return;
      if(tipImage!==image)tipImage.replaceWith(image);tipImage=image;
      write(tipTitle,tip.title);write(tipText,tip.text);write(tipIndex,String(index+1).padStart(2,'0')+' · '+String(tips.length).padStart(2,'0'));
      tipReadyAt=performance.now();if(manual)write(tipStatus,'第 '+(index+1)+' 个玩法：'+tip.title);
    },()=>{
      // Skip unavailable artwork until the next cycle, retaining the last pair.
      if(guidesActive()&&epoch===tipEpoch){tipReadyAt=performance.now();if(manual)write(tipStatus,'这张玩法图片暂未载入，可继续左右切换。');}
    }).finally(()=>{if(epoch===tipEpoch){tipPending=false;tipCard.setAttribute('aria-busy','false');}});
  }
  const firstImage=tipImage,firstLoaded=decoded(firstImage).then(()=>firstImage).catch(error=>{tipAssets.delete(0);throw error;});tipAssets.set(0,firstLoaded);
  firstLoaded.then(()=>{if(guidesActive()&&tipEpoch===0)tipReadyAt=performance.now();},()=>{
    if(guidesActive()&&tipImage===firstImage)firstImage.style.visibility='hidden';
    if(guidesActive()&&tipEpoch===0)tipReadyAt=performance.now()-5000;
  });
  const navigateTip=direction=>{if(guidesActive())prepareTip((requestedTip+direction+tips.length)%tips.length,true);};
  tipPrevious.addEventListener('click',()=>navigateTip(-1));tipNext.addEventListener('click',()=>navigateTip(1));tipPrevious.disabled=tipNext.disabled=false;
  function update(){
    if(done)return;
    const lab=window.IndoorLab,assets=lab?.characterAssets,station=lab?.stationStartup,ready=document.body.dataset.buildingReady==='true';
    const officeCharactersReady=assets?.builtinReady||assets?.builtinError&&!assets.loadingBuiltins;
    const stage=ready?4:!lab?.building?0:!officeCharactersReady?(assets?.officeDownloadsStarted?1:0):station?.progress>=.94?3:2;
    if(stage!==previousStage){
      phaseStarted=performance.now();phaseProgress=Math.max(progress,progressFloors[stage]||0);
      previousStage=stage;root.dataset.bootStage=String(stage);write(status,stages[stage][0]);write(detail,stages[stage][1]);
      steps.forEach((step,index)=>{step.dataset.bootState=index<stage?'complete':index===stage?'current':'pending';if(index===stage)step.setAttribute('aria-current','step');else step.removeAttribute('aria-current');});
    }
    // Stage changes move forward immediately; elapsed time only eases toward a
    // bounded estimate. The independent CSS highlight keeps moving during work.
    const estimate=phaseProgress+(progressCeilings[stage]-phaseProgress)*(1-Math.exp(-(performance.now()-phaseStarted)/progressDurations[stage]));
    // Station progress follows received/parsed resources. Time only adds a small
    // allowance so a slow connection cannot appear finished ahead of its data.
    const stationProgress=Math.min(.91,.36+.52*Math.max(0,Math.min(1,station?.progress||0)));
    progress=ready?1:Math.max(progress,stage===2?Math.min(estimate,stationProgress+.025):estimate,stage===2?stationProgress:0);
    progressFill.style.transform='scaleX('+progress+')';
    const percent=ready?100:Math.min(99,Math.floor(progress*100));
    if(!ready&&station?.error){write(status,'空间站准备未完成');write(detail,station.error);}
    else if(stage===2&&station?.text)write(detail,station.text);
    write(progressPercent,percent+'%');progressTrack.setAttribute('aria-valuenow',String(percent));progressTrack.setAttribute('aria-valuetext',status.textContent+'，预计准备进度 '+percent+'%');
    const seconds=Math.floor((performance.now()-started)/1000),offline=navigator.onLine===false;
    if(!ready&&!tipPending&&tipReadyAt!==null&&performance.now()-tipReadyAt>=5000)prepareTip();
    write(elapsed,String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'));
    write(note,offline?'网络连接已中断，可恢复连接后重新载入':station?.error?'请重新载入，完成准备后再进入':seconds>=15?'两个空间都准备好后，将自动进入':'首次准备包含办公楼与空间站');
    retry.hidden=!offline&&!station?.error&&seconds<60;
    if(ready){done=true;tipEpoch++;tipPending=false;tipCard.setAttribute('aria-busy','false');tipPrevious.disabled=tipNext.disabled=true;root.querySelector('.boot-steps').setAttribute('aria-busy','false');clearInterval(timer);observer?.disconnect();window.removeEventListener('online',update);window.removeEventListener('offline',update);}
  }
  retry.addEventListener('click',()=>location.reload());
  observer=new MutationObserver(update);observer.observe(document.body,{attributes:true,attributeFilter:['data-building-ready']});
  window.addEventListener('online',update);window.addEventListener('offline',update);
  timer=setInterval(update,500);update();
})();
