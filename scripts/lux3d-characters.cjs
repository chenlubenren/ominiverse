'use strict';
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path');
const {getKey,saveKey,configured}=require('./lux3d-key.cjs');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'assets','characters','imported'),STATE=path.join(ROOT,'.runtime','lux3d-characters.json'),POPSTATE=path.join(ROOT,'.runtime','lux3d-population.json');
const BASE='https://api.aholo3d.cn';
const humanActions=['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop','Sitting_Idle_Loop','Sitting_Talking_Loop','Idle_Talking_Loop','Jump_Start','Jump_Land','Hit_Chest'];
const zombieActions=['Zombie_Idle_Loop','Zombie_Walk_Fwd_Loop','Zombie_Scratch','Sprint_Loop','Hit_Chest','Hit_Knockback','Death01','LayToIdle','Punch_Jab','Melee_Hook'];
const pose='Single adult human, entire body including feet and hands, neutral symmetrical T-pose with straight arms horizontal, palms down and all fingers separated, legs straight shoulder-width apart. Anatomically correct realistic proportions, 7.5 heads tall, no base, no props, no accessories in hands, no floor, one person only. Face forward +Z, vertical Y up. Detailed face, ears, individual fingers, fitted clothing and shoes. Clean deformation-friendly topology, realistic PBR skin and fabric materials.';
const SPECS=[
 {id:'office-male',name:'办公职员 · 男',kind:'human',gender:'male',prompt:`${pose} East Asian male office worker age 30, short black hair, blue business shirt with rolled sleeves, dark charcoal fitted trousers, black low shoes, ID badge on chest.`},
 {id:'office-female',name:'办公职员 · 女',kind:'human',gender:'female',prompt:`${pose} East Asian female office worker age 28, tied-back dark hair, light ivory blouse with long sleeves, navy blue tailored trousers, flat black low shoes, ID badge on chest.`},
 {id:'zombie-male',name:'感染职员 · 男',kind:'zombie',gender:'male',prompt:`${pose} Infected adult male office worker, short messy dark hair, bloodshot eyes, pale grey skin with muted red inflammation around eyes and neck, ripped blue business shirt stained with dark red blood, charcoal trousers, black shoes. Human silhouette and intact limbs, subtle scratches and bloody torn fabric, menacing exhausted face, no exposed organs, no dismemberment.`},
 {id:'zombie-female',name:'感染职员 · 女',kind:'zombie',gender:'female',prompt:`${pose} Infected adult female office worker, tied-back messy dark hair, bloodshot eyes, pale grey skin with muted red inflammation around eyes and neck, ripped ivory blouse stained with dark red blood, navy trousers, flat black shoes. Human silhouette and intact limbs, subtle scratches and bloody torn fabric, menacing exhausted face, no exposed organs, no dismemberment.`},
];
function parseLossless(text){return JSON.parse(text.replace(/([:\[,]\s*)(-?\d{16,})(?=\s*[,}\]])/g,'$1"$2"'));}
async function api(route,body){
  const key=getKey();let response;
  try{response=await fetch(BASE+route,{method:body?'POST':'GET',headers:{Authorization:key,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});}catch(e){throw Object.assign(new Error('Lux3D 中国区连接失败：'+(e.cause?.code||e.code||e.name)),{unknown:Boolean(body)});}
  let data;try{data=parseLossless(await response.text());}catch{throw Object.assign(new Error(`Lux3D 返回非 JSON（HTTP ${response.status}）。`),{unknown:Boolean(body)});}
  if(!response.ok||String(data.c??'0')!=='0'||(data.f!=null&&Number(data.f)!==0)){
    let code=String(data.c||response.status).replace(/[^a-zA-Z0-9_.:-]/g,'').slice(0,80);if(code.includes(key))code='REJECTED';
    const message=String(data.m||'').replaceAll(key,'[REDACTED]').slice(0,300),noCredits=/no credits|积分不足|余额不足/i.test(message);throw Object.assign(new Error(noCredits?'Lux3D 中国区积分不足（no credits），补充后可续传。':`Lux3D 中国区拒绝请求（${code}）：${message}`),{code,rejected:true,noCredits,status:response.status});
  }
  return data.d??data;
}
function load(){try{return JSON.parse(fs.readFileSync(STATE,'utf8'));}catch{return {version:1,region:'cn',baseUrl:BASE,jobs:[]};}}
function save(state){const file=state.collection==='population'?POPSTATE:STATE;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(state,null,2));fs.renameSync(file+'.tmp',file);}
function population(){try{return JSON.parse(fs.readFileSync(POPSTATE,'utf8'));}catch{return{version:1,collection:'population',region:'cn',jobs:[]};}}
// Published animations contain the complete mesh, skin and rest pose. Reuse them
// when an imported character no longer has separate generation intermediates.
function assetFile(id,name='rigged.glb'){
  if(!/^[a-z0-9-]+$/.test(id)||!['original.glb','rigged.glb','animations.glb'].includes(name))throw new Error('无效的角色资产路径。');
  const file=path.join(ASSETS,id,name),published=path.join(ASSETS,id,'animations.glb');
  return fs.existsSync(file)||name==='animations.glb'||!fs.existsSync(published)?file:published;
}
function inspectGlb(buffer){
  if(buffer.length<20||buffer.toString('ascii',0,4)!=='glTF'||buffer.readUInt32LE(4)!==2||buffer.readUInt32LE(8)!==buffer.length)throw new Error('文件不是完整的 GLB 2.0。');
  const json=JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12)).trim());
  let vertices=0,triangles=0,skinnedMeshes=0;
  for(const mesh of json.meshes||[])for(const p of mesh.primitives||[]){vertices+=json.accessors?.[p.attributes.POSITION]?.count||0;triangles+=(json.accessors?.[p.indices]?.count||json.accessors?.[p.attributes.POSITION]?.count||0)/3;if(p.attributes.JOINTS_0!==undefined&&p.attributes.WEIGHTS_0!==undefined)skinnedMeshes++;}
  return {json,stats:{vertices,triangles:Math.round(triangles),skins:json.skins?.length||0,joints:json.skins?.[0]?.joints?.length||0,skinnedMeshes,animations:(json.animations||[]).map(a=>({name:a.name||'',channels:a.channels?.length||0}))}};
}
async function download(url,file,{rig=false,animation=false}={}){
  if(!/^https:\/\//.test(url))throw new Error('模型地址必须为服务商返回的 HTTPS 地址。');
  const response=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!response.ok)throw new Error(`模型下载失败（HTTP ${response.status}）。`);
  const buffer=Buffer.from(await response.arrayBuffer()),{stats}=inspectGlb(buffer);
  if(rig&&(!stats.skins||!stats.skinnedMeshes||stats.joints<15))throw new Error('下载模型没有有效的人形蒙皮骨骼。');
  if(animation&&!stats.animations.some(a=>a.channels>0))throw new Error('下载模型没有骨骼动画通道。');
  await fsp.mkdir(path.dirname(file),{recursive:true});await fsp.writeFile(file+'.part',buffer);await fsp.rename(file+'.part',file);return {...stats,bytes:buffer.length};
}
function taskId(data){const id=String(data?.taskId??data?.bizId??data);if(!/^\d+$/.test(id))throw Object.assign(new Error('Lux3D 没有返回有效任务 ID。'),{unknown:true});return id;}
function publicJob(j){return {id:j.id,name:j.name,kind:j.kind,gender:j.gender,pairId:j.pairId||null,sourceHuman:j.sourceHuman||null,status:j.status,stage:j.stage,error:j.error||null,stats:j.stats||null,animationSource:j.animationSource||null,animationNote:j.animationNote||null,updated:j.updated};}
async function manifest(state){await fsp.mkdir(ASSETS,{recursive:true});const items=[...load().jobs,...population().jobs].filter(j=>j.status==='ready').map(j=>({...publicJob(j),url:`/__character_assets__/${j.id}/animations.glb`,animations:`/__character_assets__/${j.id}/animations.glb`,actions:j.actions,nominalHeight:1.789}));const output=path.join(ASSETS,'manifest.json'),temp=output+'.tmp-'+process.pid+'-'+Date.now()+'-'+Math.random().toString(16).slice(2);await fsp.writeFile(temp,JSON.stringify({version:1,region:'cn',items},null,2));await fsp.rename(temp,output);}
async function stage(state,j,name,route,body){
  j.tasks??={};let t=j.tasks[name];if(t?.status==='submission_unknown')throw new Error(`${j.name} 的 ${name} 提交结果未知，请先核对服务端任务记录，避免重复计费。`);
  if(t&&t.status==='submitting'&&!t.id)throw new Error('此前提交结果未确认，请核对任务记录，避免重复提交。');if(!t){t=j.tasks[name]={status:'submitting',started:Date.now()};save(state);try{t.id=taskId(await api(route,body));t.status='pending';save(state);}catch(e){t.status=e.rejected?'submission_rejected':'submission_unknown';t.rejectionReason=e.message;t.noCredits=!!e.noCredits;save(state);throw e;}}
  if(t.status==='submission_rejected')throw new Error('此前任务被拒绝，修正配置后才可重新提交。');
    if(t.status==='succeeded'){const fresh=await api('/lux3d/v1/generate/task/get?taskid='+encodeURIComponent(t.id));if(Number(fresh.status)===3){t.outputs=fresh.outputs||t.outputs;save(state);}return t.outputs;}
  j.stage=name;j.status='running';save(state);
  const deadline=Date.now()+50*60000;let previous;
  while(Date.now()<deadline){
    const data=await api('/lux3d/v1/generate/task/get?taskid='+encodeURIComponent(t.id));const status=Number(data.status);t.providerStatus=status;j.updated=Date.now();
    if(previous!==status){console.log(`${j.id} / ${name}: ${status}`);previous=status;}
    if(status===3){t.status='succeeded';t.outputs=data.outputs||[];save(state);return t.outputs;}
    if([4,5,6].includes(status)){t.status='failed';t.outputs=data.outputs||[];save(state);throw new Error(`Lux3D ${name} 失败（状态 ${status}，任务 ${t.id}）。`);}
    save(state);await new Promise(resolve=>setTimeout(resolve,12000));
  }
  throw new Error(`Lux3D ${name} 尚未完成，任务已保留，可继续查询。`);
}
function urls(outputs){return outputs.map(o=>o.content).filter(v=>typeof v==='string'&&/^https:\/\//.test(v));}
async function runOne(state,j){
  const dir=path.join(ASSETS,j.id);j.status='running';j.error=null;save(state);
  try{
    const generated=await stage(state,j,'generate','/lux3d/v1/generate/text-to-3d/task/create',{version:'G1',prompt:j.prompt,style:'photorealistic',faceCount:200000,outputFormat:['glb'],customSize:1750});
    const candidates=urls(generated);const modelUrl=candidates.find(u=>/\.glb(?:\?|$)/i.test(u))||candidates[1];if(!modelUrl)throw new Error('生成结果中没有 GLB 地址。');
    if(!fs.existsSync(path.join(dir,'original.glb')))await download(modelUrl,path.join(dir,'original.glb'));
    let rigUrl;
    try {if(j.localRig)throw new Error('本地同骨骼自动蒙皮');const rig=await stage(state,j,'rig','/lux3d/v1/animations/rig/task/create',{modelUrl});rigUrl=urls(rig)[0];if(!rigUrl)throw new Error('自动绑定结果中没有 GLB 地址。');j.stats=await download(rigUrl,path.join(dir,'rigged.glb'),{rig:true});j.rigSource='lux3d-auto-rig';}
    catch(error){if(!j.localRig&&j.tasks.rig?.status!=='failed')throw error;const originalData=inspectGlb(await fsp.readFile(path.join(dir,'original.glb'))).json,accessor=originalData.accessors[originalData.meshes[0].primitives[0].attributes.POSITION],ratio=(accessor.max[0]-accessor.min[0])/(accessor.max[1]-accessor.min[1]),reference=assetFile(ratio>.98?'office-male':'office-female');if(!fs.existsSync(reference))throw error;const transfer=require('./transfer-character-rig.cjs').transfer,primary=transfer(reference,path.join(dir,'original.glb'),path.join(dir,'rigged.glb'));j.rigTransfer=primary;if(primary.p95Distance>.12){const alternative=assetFile(ratio>.98?'office-female':'office-male'),candidate=path.join(dir,'rigged-alternative.glb'),other=transfer(alternative,path.join(dir,'original.glb'),candidate);if(other.p95Distance<primary.p95Distance){fs.renameSync(candidate,path.join(dir,'rigged.glb'));j.rigTransfer=other;}else fs.unlinkSync(candidate);}if(j.rigTransfer.p95Distance>.16)throw new Error('人物姿态偏离标准，蒙皮质量检查未通过。');j.rigSource='lux3d-reference-skin-transfer';j.stats=inspectGlb(await fsp.readFile(path.join(dir,'rigged.glb'))).stats;}
    save(state);
    const actions=j.kind==='zombie'?zombieActions:humanActions;
    try {
    if(!rigUrl||j.localActions)throw new Error('采用本地骨骼动作适配，与办公及丧尸行为状态同步。');
    const retarget=await stage(state,j,'retarget','/lux3d/v1/animations/retarget/task/create',{rigModelUrl:rigUrl,animationIds:actions,animationOutputMode:'combined',outFormat:'glb',animateInPlace:true});
    let output;for(const item of retarget){try{const v=JSON.parse(item.content);if(v.actions)output=v;}catch{}}
    if(!output)throw new Error('动画返回格式不符合 actions 契约。');
    const failed=output.actions.filter(a=>!a.animationGlbUrl);if(failed.length)throw new Error(`动作未生成：${failed.map(a=>a.animation_id).join(', ')}`);
    j.animationStats=await download(output.actions[0].animationGlbUrl,path.join(dir,'animations.glb'),{rig:true,animation:true});
    j.actions=output.actions.map(a=>a.animation_id);j.animationSource='lux3d-retarget';
    } catch(error) {
      // Keep the successful cloud skin. The original simulation's poses are
      // applied to its actual bones and exported as usable animation channels.
      j.animationNote=error.message;j.stage='local-animation';save(state);
      const baked=require('./bake-character-actions.cjs').bake(path.join(dir,'rigged.glb'),path.join(dir,'animations.glb'));
      j.actions=baked.actions;j.animationSource=baked.source;j.animationStats=inspectGlb(await fsp.readFile(path.join(dir,'animations.glb'))).stats;
      console.log(`${j.id}: exported ${baked.clips.length} local bone clips`);
    }
    j.status='ready';j.stage='complete';j.updated=Date.now();save(state);
    await fsp.writeFile(path.join(dir,'asset.json'),JSON.stringify({...publicJob(j),actions:j.actions,animationStats:j.animationStats,nominalHeight:1.75,generation:{version:'G1',faceCount:200000,region:'cn'}},null,2));
    await manifest(state);console.log(`${j.id}: ready / ${j.stats.joints} joints / ${j.animationStats.animations.length} clips`);
  }catch(e){if(e.noCredits)state.creditBlocked=true;j.status='error';j.error=e.message;j.updated=Date.now();save(state);console.error(`${j.id}: ${e.message}`);}
}
let running=false;
async function generate({ids=SPECS.map(s=>s.id)}={}){
  if(running)throw new Error('人物资产生成正在执行。');running=true;const state=load();
  try{
    for(const id of ids){if(!SPECS.some(s=>s.id===id))throw new Error('未知的人物预设。');if(!state.jobs.find(j=>j.id===id)){state.jobs.push({...SPECS.find(s=>s.id===id),status:'queued',created:Date.now(),updated:Date.now()});}}
    save(state);await manifest(state);
    // Four tasks at most: below the documented free-account shared limit of 5.
    await Promise.all(state.jobs.filter(j=>ids.includes(j.id)&&j.status!=='ready').map(j=>runOne(state,j)));
    return state.jobs.map(publicJob);
  }finally{running=false;}
}
async function check(){const d=await api('/lux3d/v1/generate/task/list?page=1&pagesize=1');console.log(JSON.stringify({authenticated:true,region:'cn',baseUrl:BASE,listShape:Array.isArray(d)?'array':Object.keys(d||{}),configured:configured()}));return true;}
async function diagnose(){for(const j of load().jobs)for(const [stage,t]of Object.entries(j.tasks||{})){if(t.status!=='failed')continue;const d=await api('/lux3d/v1/generate/task/get?taskid='+t.id),key=getKey();console.log(JSON.stringify({id:j.id,stage,data:d},(k,v)=>typeof v==='string'?v.split(key).join('[credential]').replace(/https?:\/\/[^\s"<>]+/g,'[asset-url]'):v));}}
async function repairZombie(){const state=load(),j=state.jobs.find(j=>j.id==='zombie-male');if(!j||j.tasks?.rig?.status!=='failed')throw Error('仅修复已明确失败的男感染者骨骼任务。');j.history??=[];j.history.push({tasks:j.tasks,error:j.error});j.tasks={};j.status='queued';j.prompt=`${pose} Adult male office worker, short black hair, both arms fully extended perfectly horizontal in a straight T shape, flat open hands, separate fingers. Blue shirt with red blood stains on chest, dark tailored trousers, black shoes. Intact normal human anatomy. Pale face, irritated red eyes. No hunched pose, no raised shoulders, no bending elbows.`;const original=path.join(ASSETS,j.id,'original.glb');if(fs.existsSync(original))fs.renameSync(original,path.join(ASSETS,j.id,'original-rejected.glb'));save(state);return generate({ids:[j.id]});}
async function main(){const command=process.argv[2]||'status';if(command==='configure'){process.stdout.write('等待密钥输入（不会回显）\n');if(process.stdin.isTTY)process.stdin.setRawMode(true);process.stdin.resume();let input='';process.stdin.on('data',chunk=>{input+=chunk.toString();if(!/[\r\n]/.test(input))return;try{saveKey(input.trim());console.log('Lux3D 中国区密钥已加密保存。');if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();process.exit(0);}catch{console.error('无法为当前 Windows 用户加密保存密钥。');process.exit(1);}});return;}if(command==='check')await check();else if(command==='generate')await generate(process.argv[3]?{ids:process.argv[3].split(',')}:{});else console.log(JSON.stringify({configured:configured(),region:'cn',jobs:load().jobs.map(publicJob)},null,2));}
module.exports={generate,check,load,population,save,stage,runOne,download,urls,pose,publicJob,manifest,inspectGlb,parseLossless,assetFile,api,BASE,ASSETS,SPECS,get running(){return running;}};
if(require.main===module)(process.argv[2]==='diagnose'?diagnose():process.argv[2]==='repair-zombie'?repairZombie():main()).catch(e=>{console.error(e.message);process.exitCode=1;});
