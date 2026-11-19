/* Node.js application server; publish only the browser's entry points and assets. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
require('./scripts/local-config.cjs').loadLocalConfig(__dirname);
const {createUsdzService}=require('./scripts/usdz-service.cjs');
const {createLux3dService}=require('./scripts/lux3d-service.cjs');
const characters=require('./scripts/character-service.cjs');
const {createRobotService}=require('./scripts/robot-service.cjs');
const {createDisasterService}=require('./scripts/disaster-service.cjs');
const {createRobotDeepseekProvider}=require('./scripts/robot-deepseek-provider.cjs');
const eventKey=require('./scripts/event-provider-key.cjs');
const {createRobotLibraryService}=require('./scripts/robot-library-service.cjs');
const appPrefix=__dirname+path.sep;
const vendorPrefix=path.join(__dirname,'js','vendor')+path.sep;
const appPath='/',legacyPrefixes=new Set([path.basename(__dirname),'app']),pageRoutes=new Map([['/','index.html'],['/asset-studio','asset-studio.html'],['/station-designs','station-designs.html']]);
const healthPath='/__access_lab_health__',convertPath='/__access_usdz_convert__',lux3dPath='/__lux3d_generate__',lux3dAssets='/__lux3d_assets__/',aiPath='/__ai_interpret__',modelLibraryPath='/__model_library__',modelLibraryRoot=path.resolve(__dirname,process.env.MODEL_LIBRARY_ROOT||'assets/furniture'),VERSION=24;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.cjs':'text/plain; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.png':'image/png','.json':'application/json','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.m4a':'audio/mp4','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.vtt':'text/vtt; charset=utf-8'};
const seekableMedia=new Set(['.mp4','.webm','.mov','.m4a','.mp3','.wav','.ogg']);
const workspaceTag=require('node:crypto').createHash('sha256').update(__dirname).digest('hex').slice(0,16);
const appURL=(port,host='127.0.0.1')=>`http://${host.includes(':')&&!host.startsWith('[')?'['+host+']':host}:${port}${appPath}`;
const aiModel=process.env.ACCESS_AI_MODEL||'gpt-5.6';
const aiSchema={type:'object',additionalProperties:false,properties:{profile:{type:'object',additionalProperties:false,properties:{type:{type:'string',enum:['wheelchair','electricWheelchair','assisted','blind','upper','pedestrian']},width:{type:['number','null']},length:{type:['number','null']},speed:{type:['number','null']},reach:{type:['number','null']},maxHeight:{type:['number','null']},doorEffort:{type:['number','null']}},required:['type','width','length','speed','reach','maxHeight','doorEffort']},schedule:{type:'array',items:{type:'object',additionalProperties:false,properties:{targetId:{type:['string','null']},name:{type:'string'},x:{type:['number','null']},z:{type:['number','null']},time:{type:'string'}},required:['targetId','name','x','z','time']}},notes:{type:'string'}},required:['profile','schedule','notes']};
function sendJson(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload));}
function sendStaticFile(req,res,file,stat){
  const extension=path.extname(file).toLowerCase(),media=seekableMedia.has(extension),etag='W/"'+stat.size.toString(16)+'-'+stat.mtimeMs.toString(16)+'"',headers={'Content-Type':types[extension]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache','ETag':etag,'Last-Modified':stat.mtime.toUTCString()};
  if(media)headers['Accept-Ranges']='bytes';
  // Revalidate stable models/scripts without transferring the entire asset again.
  const match=req.headers['if-none-match'],modified=req.headers['if-modified-since'];
  if(match?(match.trim()==='*'||match.split(',').some(value=>value.trim().replace(/^W\//,'')===etag.replace(/^W\//,''))):modified&&Math.floor(stat.mtimeMs/1000)*1000<=Date.parse(modified)){
    const {'Content-Length':length,...cached}=headers;res.writeHead(304,cached).end();return;
  }
  let status=200,start=0,end=stat.size-1;
  // Browsers seek to a story moment by requesting its media bytes. HEAD returns
  // the full representation's metadata; unsupported units/multipart ranges are
  // ignored, and If-Range falls back to a full response without a validator.
  const range=req.headers.range;
  if(media&&req.method==='GET'&&range&&!req.headers['if-range']&&/^bytes=/i.test(range)&&!range.includes(',')){
    const match=/^bytes=(\d*)-(\d*)$/i.exec(range.trim());let valid=!!match&&(match[1]!==''||match[2]!=='')&&stat.size>0;
    if(valid){
      if(match[1]===''){const suffix=Number(match[2]);valid=Number.isSafeInteger(suffix)&&suffix>0;start=Math.max(0,stat.size-suffix);}
      else{start=Number(match[1]);const requestedEnd=match[2]===''?end:Number(match[2]);valid=Number.isSafeInteger(start)&&Number.isSafeInteger(requestedEnd)&&start<stat.size&&start<=requestedEnd;end=Math.min(end,requestedEnd);}
    }
    if(!valid){res.writeHead(416,{...headers,'Content-Length':0,'Content-Range':'bytes */'+stat.size}).end();return;}
    status=206;headers['Content-Range']='bytes '+start+'-'+end+'/'+stat.size;headers['Content-Length']=end-start+1;
  }
  res.writeHead(status,headers);if(req.method==='HEAD'){res.end();return;}
  const stream=fs.createReadStream(file,status===206?{start,end}:undefined);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
}
function readJson(req,maxBytes=256*1024){return new Promise((resolve,reject)=>{let size=0,body='';req.setEncoding('utf8');req.on('data',chunk=>{size+=Buffer.byteLength(chunk);if(size>maxBytes){reject(new Error('请求内容过大。'));req.destroy();return;}body+=chunk;});req.on('end',()=>{try{resolve(body?JSON.parse(body):{});}catch{reject(new Error('请求不是有效 JSON。'));}});req.on('error',reject);});}
function responseText(data){if(typeof data?.output_text==='string')return data.output_text;for(const item of data?.output||[])for(const part of item.content||[]){if(typeof part.text==='string')return part.text;if(typeof part.text?.value==='string')return part.text.value;}return '';}
async function handleAI(req,res){if(req.method!=='POST'){res.writeHead(405,{'Allow':'POST'}).end('Method not allowed');return;}if(!process.env.OPENAI_API_KEY){sendJson(res,503,{error:'未配置 OPENAI_API_KEY。请在启动本地服务的进程中设置环境变量；前端会自动回退本地解析。'});return;}let body;try{body=await readJson(req);}catch(error){sendJson(res,400,{error:error.message});return;}const person=String(body.person||''),schedule=String(body.schedule||''),scene=Array.isArray(body.scene)?body.scene.slice(0,100):[];if(!person&&!schedule){sendJson(res,400,{error:'缺少人物描述或行程描述。'});return;}const system=`你是室内无障碍仿真助手。只根据给出的场景实体选择人物类型、人体包络参数和一日行程。目的地必须优先使用 scene 中已有实体的 targetId 与坐标；不要创造场景外坐标。人物参数单位：宽度、长度、触达、最高触达为米，速度为米每秒，门操作阻力为 0 到 1。把“床、沙发、冰箱、卫生间、入户门”等词映射到最匹配实体。输出严格符合 JSON Schema。`;const user=`人物描述：${person||'普通步行者'}\n行程描述：${schedule||'未提供'}\n场景实体：${JSON.stringify(scene)}`;try{const upstream=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:aiModel,input:[{role:'system',content:[{type:'input_text',text:system}]},{role:'user',content:[{type:'input_text',text:user}]}],text:{format:{type:'json_schema',name:'indoor_schedule',strict:true,schema:aiSchema}}})});const data=await upstream.json().catch(()=>({}));if(!upstream.ok){sendJson(res,upstream.status>=400&&upstream.status<500?upstream.status:502,{error:data?.error?.message||'GPT-5.6 请求失败。'});return;}let parsed;try{parsed=JSON.parse(responseText(data).replace(/^```json\s*|\s*```$/g,''));}catch{sendJson(res,502,{error:'GPT-5.6 返回的结构化结果无法解析。'});return;}parsed.source='gpt-5.6';sendJson(res,200,parsed);}catch(error){sendJson(res,502,{error:`GPT-5.6 服务不可用：${error.message}`});}}
async function readArticulationMetadata(folder){
  const candidates=['关节检查.json','model_spec.json','visual_metadata.json'];
  for(const name of candidates){
    try{
      const raw=await fs.promises.readFile(path.join(folder,name),'utf8');
      const parsed=JSON.parse(raw);
      const joints=Array.isArray(parsed?.joints)?parsed.joints:[];
      if(joints.length||name==='model_spec.json'){
        return {source:name,joints:joints.map(j=>({
          name:j.name||j.label||'',label:j.label||j.name||'',type:j.type||'revolute',
          axis:Array.isArray(j.axis)?j.axis.slice(0,3):Array.isArray(j.axis_gltf)?j.axis_gltf.slice(0,3):null,
          lower:Number.isFinite(Number(j.lower))?Number(j.lower):0,
          upper:Number.isFinite(Number(j.upper))?Number(j.upper):1,
          origin:Array.isArray(j.origin)?j.origin.slice(0,3):null
        }))};
      }
    }catch{}
  }
  return null;
}
async function listModelLibrary(){const items=[];const allowed=/^(model|articulated_pbr)\.glb$/i;const previewNames=['preview_closed.png','preview_view0.png','preview_open.png','reference.jpg','reference.png','preview.jpg','thumbnail.png'];async function findPreview(folder,relativeDir){for(const name of previewNames){try{const file=path.join(folder,name),stat=await fs.promises.stat(file);if(stat.isFile())return `${modelLibraryPath}/${path.join(relativeDir,name).split(path.sep).map(encodeURIComponent).join('/')}`;}catch{}}return null;}async function walk(dir,relative=''){let entries=[];try{entries=await fs.promises.readdir(dir,{withFileTypes:true});}catch{return;}for(const entry of entries){if(entry.name.startsWith('.'))continue;const full=path.join(dir,entry.name),rel=path.join(relative,entry.name);if(entry.isDirectory())await walk(full,rel);else if(allowed.test(entry.name)&&relative.split(path.sep).length===2){const category=relative.split(path.sep)[0]||'未分类',id=path.basename(path.dirname(rel)),key=`${category}/${id}`,folder=path.dirname(full),articulation=await readArticulationMetadata(folder),preview=await findPreview(folder,path.dirname(rel)),item={id:`${key}/${entry.name}`,category,variant:id,name:`${category} · ${id}`,url:`${modelLibraryPath}/${rel.split(path.sep).map(encodeURIComponent).join('/')}`,preview,articulation},existing=items.find(candidate=>candidate.category===category&&candidate.variant===id);if(existing){if(/model\.glb$/i.test(entry.name)){items.splice(items.indexOf(existing),1,item);}continue;}items.push(item);}}}await walk(modelLibraryRoot);return items;}
async function handleModelLibrary(req,res,pathname){if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'}).end('Method not allowed');return;}if(pathname===modelLibraryPath){try{sendJson(res,200,{root:'local-test-models',items:await listModelLibrary()});}catch(error){sendJson(res,500,{error:error.message||'模型库读取失败。'});}return;}const prefix=modelLibraryPath+'/';if(!pathname.startsWith(prefix)){res.writeHead(404).end('Not found');return;}let rel;try{rel=pathname.slice(prefix.length).split('/').filter(Boolean).map(decodeURIComponent).join(path.sep);}catch{res.writeHead(400).end('Bad URL');return;}const file=path.resolve(modelLibraryRoot,rel);if(!file.startsWith(modelLibraryRoot+path.sep)||!/\.(glb|gltf|bin|png|jpe?g|webp)$/i.test(file)){res.writeHead(403).end('Forbidden');return;}fs.stat(file,(error,stat)=>{if(error||!stat.isFile()){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-cache'});if(req.method==='HEAD'){res.end();return;}fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);});}
function createServer({robotProvider,disasterService,robotLibraryService}={}){const usdz=createUsdzService(__dirname),lux3d=createLux3dService(__dirname,{endpoint:lux3dPath}),configuredRobotProvider=robotProvider||(!process.env.FABLE_API_KEY?.trim()&&eventKey.configured()?createRobotDeepseekProvider():null),robots=createRobotService(configuredRobotProvider?{provider:configuredRobotProvider}:undefined),director=disasterService||createDisasterService(),library=robotLibraryService||createRobotLibraryService(__dirname);return http.createServer((req,res)=>{
  let requestURL,pathname;try{requestURL=new URL(req.url,'http://localhost');pathname=requestURL.pathname;}catch{res.writeHead(400).end('Bad URL');return;}
  if(pathname==='/api/robot-library'||pathname.startsWith('/api/robot-library/')){library.handle(req,res,pathname).catch(()=>{if(!res.headersSent)sendJson(res,500,{error:'机器人库服务暂不可用。'});});return;}
  if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
  if(pathname==='/__disaster_director__'){director.handle(req,res).catch(()=>{if(!res.headersSent)sendJson(res,500,{error:'事件服务暂时不可用，请重试。'});});return;}
  if(pathname.startsWith('/api/robots/')){robots.handle(req,res,pathname).catch(()=>{if(!res.headersSent)sendJson(res,500,{error:'机器人服务暂时不可用，请重试。'});});return;}
  if(pathname==='/__character_models__'){characters.handle(req,res).catch(()=>{if(!res.headersSent)sendJson(res,500,{error:'人物资产服务暂时不可用。'});});return;}
  if(pathname.startsWith('/__character_assets__/')){characters.asset(req,res,pathname);return;}
  if(pathname==='/__access_lab_ready__'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}).end(JSON.stringify({app:'access-spatial-twin',workspace:workspaceTag,version:VERSION}));return;}
  if(pathname===healthPath){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({app:'access-spatial-twin',root:__dirname,version:VERSION,pid:process.pid,usdz:{ready:usdz.ready(),busy:usdz.busy,endpoint:convertPath,maxBytes:180*1024*1024,timeoutSeconds:180},lux3d:{configured:lux3d.ready(),busy:lux3d.busy,endpoint:lux3dPath,region:'cn'},ai:{configured:!!process.env.OPENAI_API_KEY,model:aiModel,endpoint:aiPath}}));return;}
  if(pathname===convertPath){usdz.handle(req,res).catch(()=>{if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({error:'USDZ 转换服务异常。'}));});return;}
  if(pathname===lux3dPath){lux3d.handle(req,res).catch(()=>{if(!res.headersSent)res.writeHead(502,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Lux3D 生成服务异常。'}));});return;}
  if(pathname===aiPath){handleAI(req,res).catch(error=>{if(!res.headersSent)sendJson(res,502,{error:error.message||'AI 服务异常。'});});return;}
  if(pathname===modelLibraryPath||pathname.startsWith(modelLibraryPath+'/')){handleModelLibrary(req,res,pathname);return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'}).end('Method not allowed');return;}
  let file,generatedAsset=false;try{let name=decodeURIComponent(pathname);
    // Older bookmarks and assets included the checkout/deployment directory.
    // Serve those assets in place, but keep every browser page on its clean URL.
    const prefix=name.split('/')[1];if(legacyPrefixes.has(prefix))name=name.slice(prefix.length+1)||'/';
    for(const [route,page]of pageRoutes){
      if(name==='/'+page||name===route||(route!=='/'&&name===route+'/')){
        if(pathname!==route){res.writeHead(308,{Location:route+requestURL.search}).end();return;}
        name='/'+page;break;
      }
    }
    if(name.startsWith(lux3dAssets)){const asset=name.slice(lux3dAssets.length);if(!/^[a-f0-9]{12,64}\.glb$/i.test(asset)){res.writeHead(404).end('Not found');return;}file=path.join(lux3d.cacheRoot,asset);generatedAsset=true;}
    else if(name.startsWith('/js/vendor/')) file=path.join(vendorPrefix,name.slice('/js/vendor/'.length));
    else file=path.resolve(__dirname,'.'+name);
  }catch{res.writeHead(400).end('Bad URL');return;}
  if(!file.startsWith(appPrefix)&&!file.startsWith(vendorPrefix)&&!file.startsWith(lux3d.cacheRoot+path.sep)&&!file.startsWith(modelLibraryRoot+path.sep)){res.writeHead(403).end('Forbidden');return;}
  if(file.startsWith(appPrefix)&&!generatedAsset){
    const relative=path.relative(__dirname,file),parts=relative.split(path.sep),extension=path.extname(file).toLowerCase();
    const publicRootFile=parts.length===1&&(['index.html','asset-studio.html','station-designs.html'].includes(parts[0].toLowerCase())||extension==='.css');
    const publicDirectory=['js','assets'].includes(parts[0].toLowerCase());
    if(parts.some(p=>p.startsWith('.')||p.toLowerCase()==='node_modules')||['.cjs','.py','.bat'].includes(extension)||(!publicRootFile&&!publicDirectory)){res.writeHead(403).end('Forbidden');return;}
  }
  fs.stat(file,(error,stat)=>{if(error||!stat.isFile()){res.writeHead(404).end('Not found');return;}sendStaticFile(req,res,file,stat);});
});}
async function start({port=Number(process.env.PORT||process.env.ACCESS_PORT||8910),host=process.env.HOST||'127.0.0.1',log=console.log,maxAttempts=1}={}){
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('PORT 必须是 0 到 65535 之间的整数。');
  if(!Number.isInteger(maxAttempts)||maxAttempts<1)throw new Error('maxAttempts 必须为正整数。');
  for(let offset=0;offset<maxAttempts&&port+offset<=65535;offset++){
    const candidate=port+offset,server=createServer();
    const error=await new Promise(resolve=>{server.once('error',resolve);server.listen(candidate,host,()=>{server.removeListener('error',resolve);resolve(null);});});
    if(!error){const actualPort=server.address().port,url=appURL(actualPort,host);log(`AI AGENT SOCIETY 已启动\n${url}`);return{server,host,port:actualPort,url,reused:false};}
    if(error.code!=='EADDRINUSE')throw error;
    if(offset+1>=maxAttempts||candidate===65535)throw error;
  }
  throw new Error('没有找到可用端口。请设置 PORT 后重试。');
}
if(require.main===module)start().catch(error=>{console.error(`启动失败：${error.message}`);process.exitCode=1;});
module.exports={start,createServer,appURL,VERSION};
