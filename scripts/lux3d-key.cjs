'use strict';
// Windows CurrentUser DPAPI: no plaintext credential is stored or served.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const file=path.join(__dirname,'..','.runtime','lux3d-key.dpapi');
let cached='';
function transform(input,decrypt){
  const command=`Add-Type -AssemblyName System.Security; $v=[Console]::In.ReadToEnd(); ${decrypt?'$b=[Convert]::FromBase64String($v); [Console]::Out.Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))':'$b=[Text.Encoding]::UTF8.GetBytes($v); [Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))'}`;
  return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{input,encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe']}).trim();
}
function configured(){return Boolean(process.env.LUX3D_CN_API_KEY?.trim()||fs.existsSync(file));}
function getKey(){if(process.env.LUX3D_CN_API_KEY?.trim())return process.env.LUX3D_CN_API_KEY.trim();if(!cached){if(!fs.existsSync(file))throw new Error('尚未配置 Lux3D 中国区密钥。');try{cached=transform(fs.readFileSync(file,'utf8'),true);}catch{throw Error('无法解密本机 Lux3D 密钥，请使用原 Windows 用户启动服务。');};}return cached;}
function saveKey(value){value=String(value||'').trim();if(!value||value.length>512)throw new Error('密钥格式无效。');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,transform(value,false),{mode:0o600});cached=value;}
module.exports={getKey,saveKey,configured};
