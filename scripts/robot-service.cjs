/* Same-origin orchestration boundary. Provider wire formats are intentionally unclaimed. */
'use strict';
const {randomUUID,createHash}=require('node:crypto');
const {createRobotProvider}=require('./robot-provider.cjs');
const {normalizeSpec,interpret,jointSchema,setHumanoidJoints}=require('../js/collaboration/contract.js');
setHumanoidJoints(require('../assets/robots/unitree-g1/joints.json'));
const PREFIX='/api/robots';
const json=(res,status,payload)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload));};
function readJSON(req){return new Promise((resolve,reject)=>{let body='',bytes=0,tooLarge=false;req.on('data',chunk=>{bytes+=chunk.length;if(bytes>32768){tooLarge=true;return;}body+=chunk;});req.on('end',()=>{if(tooLarge){reject(Object.assign(new Error('描述内容过长。'),{status:413}));return;}try{resolve(JSON.parse(body||'{}'));}catch{reject(Object.assign(new Error('请求必须是有效 JSON。'),{status:400}));}});req.on('error',reject);});}
function createRobotService({provider=createRobotProvider()}={}){
  // Entries are retained for two hours; UI-created custom partners persist in the browser.
  const designs=new Map(),requests=new Map();
  function prune(){const cutoff=Date.now()-7200000;for(const [id,d]of designs)if(d.createdAt<cutoff&&!d.rigPromise)designs.delete(id);while(designs.size>200){const first=[...designs].find(([,d])=>!d.rigPromise);if(!first)break;designs.delete(first[0]);}for(const [id,r]of requests)if(r.at<cutoff)requests.delete(id);}
  function status(){
    const fable=provider.status();
    return{mode:fable.ready?'cloud-assisted':'local-preview',aholo:{credentialsConfigured:!!process.env.AHOLO_API_KEY?.trim(),adapterReady:false},fable,message:fable.message+'自由造型服务尚未连接；当前使用现有工业模型。'};
  }
  async function handle(req,res,pathname){
    if(req.method==='GET'&&pathname===PREFIX+'/status'){await provider.verify();json(res,200,status());return;}
    if(req.method!=='POST'){json(res,405,{error:'此接口不支持该请求方法。'});return;}
    const origin=req.headers.origin;if(origin){try{if(new URL(origin).host!==req.headers.host){json(res,403,{error:'仅接受当前应用的请求。'});return;}}catch{json(res,403,{error:'来源无效。'});return;}}
    if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json')){json(res,415,{error:'请使用 application/json。'});return;}
    let body;try{body=await readJSON(req);}catch(e){json(res,e.status||400,{error:e.message});return;}
    if(!body||typeof body!=='object'||Array.isArray(body)){json(res,400,{error:'请求内容必须为对象。'});return;}
    const mode=body.mode||'local-preview';
    if(!['local-preview','cloud'].includes(mode)){json(res,400,{error:'不支持的定制模式。'});return;}
    if(mode==='cloud'){const readiness=await provider.verify();if(!readiness.ready){json(res,503,{code:readiness.connectionState==='model-mismatch'?'MODEL_MISMATCH':'PROVIDER_NOT_CONNECTED',error:readiness.message});return;}}
    prune();
    if(pathname===PREFIX+'/designs'){
      if(body.prompt!==undefined&&(typeof body.prompt!=='string'||body.prompt.length>1200)){json(res,400,{error:'造型描述最多 1200 字。'});return;}
      if(body.history!==undefined&&(!Array.isArray(body.history)||body.history.length>10||body.history.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>1200))){json(res,400,{error:'对话历史格式不正确。'});return;}
      if(body.requestId!==undefined&&(typeof body.requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(body.requestId))){json(res,400,{error:'请求编号格式不正确。'});return;}
      let initial;try{initial=normalizeSpec(body.spec);}catch(e){json(res,400,{error:e.message});return;}
      const fingerprint=createHash('sha256').update(JSON.stringify({mode,spec:initial,prompt:body.prompt||'',history:body.history||[]})).digest('hex');
      const previous=body.requestId&&requests.get(body.requestId);
      if(previous&&previous.fingerprint!==fingerprint){json(res,409,{error:'请求编号与当前修改不一致。'});return;}
      if(!previous&&requests.size>=200){json(res,429,{error:'定制请求过多，请稍后重试。'});return;}
      const work=async()=>{
        let spec=initial,generation,message='本地预览已更新。可以确认当前造型；自由造型服务尚未连接。';
        if(body.prompt?.trim()){
          if(mode==='cloud'){const result=await provider.design(spec,body.prompt,body.history||[]);({spec,generation,message}=result);}
          else spec=interpret(body.prompt,spec);
        }
        const design={id:randomUUID(),status:'preview-ready',source:spec.type==='humanoid'?'unitree-visual':'local-procedural',provider:generation?(generation.provider||'fable'):'local',spec,createdAt:Date.now(),...(generation?{generation}:{})};designs.set(design.id,design);
        return{design:{...design},message};
      };
      const promise=previous?.promise||work();if(body.requestId&&!previous)requests.set(body.requestId,{promise,fingerprint,at:Date.now()});
      try{json(res,201,await promise);}catch(error){json(res,error.status||502,{code:error.code||'GENERATION_FAILED',error:error.status?error.message:'智能定制未完成，当前预览已保留。'});}return;
    }
    if(pathname===PREFIX+'/rigs'){
      if(body.confirmed!==true){json(res,409,{error:'请先确认当前造型，再构建关节。'});return;}
      const design=designs.get(body.designId);if(!design){json(res,404,{error:'造型预览已过期，请重新确认造型。'});return;}
      // Concurrent confirmations share one promise; mode changes require a new design.
      if(design.rigMode&&design.rigMode!==mode){json(res,409,{error:'定制模式已改变，请重新确认当前造型。'});return;}
      design.rigMode=mode;
      if(design.rigError){const error=design.rigError;json(res,error.status||502,{code:error.code||'GENERATION_FAILED',error:error.status?error.message:'关节配置未完成。'});return;}
      if(!design.rigPromise&&!design.rig){
        design.rigPromise=(async()=>{
          const generated=mode==='cloud'?await provider.rig(design.spec):null;
          design.rig={id:randomUUID(),designId:design.id,status:'completed',source:generated?'cloud-joint-configuration':design.spec.type==='humanoid'?'unitree-urdf':'local-articulated',provider:generated?(generated.generation?.provider||'fable'):'local',spec:design.spec,joints:generated?.joints||jointSchema(design.spec.type),format:'existing-model-joint-configuration',createdAt:Date.now(),...(generated?{generation:generated.generation,message:generated.message}:{})};
          if(!generated)design.rig.format=design.spec.type==='humanoid'?'urdf-link-hierarchy':'procedural-joint-hierarchy';
          return design.rig;
        })().catch(error=>{design.rigError=error;throw error;}).finally(()=>{design.rigPromise=null;});
      }
      try{const rig=design.rig||await design.rigPromise;json(res,200,{rig,message:rig.provider!=='local'?'智能关节配置已生成并通过校验，可放入场景。':'本地预设关节已准备好，可放入场景。'});}
      catch(error){json(res,error.status||502,{code:error.code||'GENERATION_FAILED',error:error.status?error.message:'关节配置未完成，未放入场景。'});}return;
    }
    json(res,404,{error:'机器人接口不存在。'});
  }
  return{handle,status};
}
module.exports={createRobotService};
