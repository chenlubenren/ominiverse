'use strict';
const fs=require('node:fs'),path=require('node:path');
const lux=require('./lux3d-characters.cjs'),{configured}=require('./lux3d-key.cjs'),{localRequest}=require('./lux3d-service.cjs');
const {spawn}=require('node:child_process');
function populationBusy(){try{const pid=Number(fs.readFileSync(path.join(__dirname,'..','.runtime','lux3d-population.lock'),'utf8'));if(!pid)return false;try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}}catch{return false;}}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function catalogue(){let items=[];try{items=JSON.parse(fs.readFileSync(path.join(lux.ASSETS,'manifest.json'),'utf8')).items||[];}catch{}const population=lux.population().jobs;return {region:'cn',configured:configured(),busy:lux.running,items,jobs:[...lux.load().jobs,...population].map(lux.publicJob),population:{total:population.length,ready:population.filter(j=>j.status==='ready').length,failed:population.filter(j=>j.status==='error').length,creditBlocked:!!lux.population().creditBlocked,busy:populationBusy()}};}
async function handle(req,res){
  if(req.method==='GET'){json(res,200,catalogue());return;}
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');json(res,405,{error:'仅支持 GET / POST。'});return;}
  if(!localRequest(req)){req.resume();json(res,403,{error:'仅允许本机应用发起生成。'});return;}
  if(lux.running||lux.load().jobs.some(j=>['queued','running'].includes(j.status))){req.resume();json(res,409,{error:'已有任务正在生成。保留任务记录，等待完成后刷新资产。'});return;}
  let text='';for await(const chunk of req){text+=chunk;if(text.length>2048){json(res,413,{error:'请求过大。'});return;}}
  let ids;try{const request=JSON.parse(text||'{}');if(request.collection==='population'){if(populationBusy()){json(res,409,{error:'80 个配对资产正在生成。'});return;}if(!configured()){json(res,503,{error:'尚未配置中国区密钥。'});return;}const child=spawn(process.execPath,[path.join(__dirname,'lux3d-population.cjs'),'all'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,detached:true,stdio:'ignore'});child.unref();json(res,202,{accepted:true,region:'cn',total:80});return;}ids=request.ids;if(!Array.isArray(ids)||!ids.length||ids.length>4||ids.some(id=>!lux.SPECS.some(s=>s.id===id)))throw Error();}catch{json(res,400,{error:'请选择有效的人物预设。'});return;}
  if(!configured()){json(res,503,{error:'请先在本机配置 Lux3D 中国区密钥。'});return;}
  json(res,202,{accepted:true,region:'cn'});lux.generate({ids}).catch(()=>{});
}
function asset(req,res,pathname){
  const rel=pathname.slice('/__character_assets__/'.length);if(!/^(office-male|office-female|zombie-male|zombie-female|(?:human|infected)-(?:male|female)-\d{2})\/(original|rigged|animations)\.glb$/.test(rel)){res.writeHead(404).end();return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  const [id,name]=rel.split('/'),file=lux.assetFile(id,name);fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':'model/gltf-binary','Content-Length':stat.size,'Cache-Control':'no-cache'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);});
}
module.exports={handle,asset,catalogue};
