/* Server-only configuration. Values are never logged, returned, or shell-evaluated. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const allowed=new Set(['AHOLO_API_KEY','FABLE_API_KEY','FABLE_BASE_URL','FABLE_MODEL','FABLE_ALLOW_MODEL_ALIAS','DEEPSEEK_API_KEY','DEEPSEEK_MODEL','BLENDER_PATH']);
function loadLocalConfig(directory,{env=process.env}={}){
  const filename=path.join(directory,'.env.local');let text;
  try{text=fs.readFileSync(filename,'utf8');}catch(error){if(error.code==='ENOENT')return{loaded:[]};throw new Error('无法读取本地服务配置。');}
  const parsed=[];
  for(const [index,line]of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
    const row=line.trim();if(!row||row.startsWith('#'))continue;
    const match=row.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if(!match)throw new Error(`本地服务配置第 ${index+1} 行格式不正确。`);
    const name=match[1];let value=match[2].trim();
    if(!allowed.has(name))continue;
    if(value.startsWith('"')||value.startsWith("'")){
      if(value.length<2||value.at(-1)!==value[0])throw new Error(`本地服务配置第 ${index+1} 行引号不完整。`);
      value=value.slice(1,-1);
    }
    if(/[\u0000-\u001f\u007f]/.test(value))throw new Error(`本地服务配置第 ${index+1} 行含有无效字符。`);
    parsed.push([name,value]);
  }
  const loaded=[];
  for(const [name,value]of parsed)if(env[name]===undefined){env[name]=value;loaded.push(name);}
  return{loaded};
}
module.exports={loadLocalConfig};
