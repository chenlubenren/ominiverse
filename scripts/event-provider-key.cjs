'use strict';
// CurrentUser DPAPI. This directory and .runtime are denied by the static server.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const file=path.join(__dirname,'..','.runtime','deepseek-key.dpapi');let cached='';
function transform(input,decrypt){const script=`Add-Type -AssemblyName System.Security; $v=[Console]::In.ReadToEnd(); ${decrypt?'$b=[Convert]::FromBase64String($v); [Console]::Out.Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))':'$b=[Text.Encoding]::UTF8.GetBytes($v); [Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))'}`;return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{input,encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe']}).trim();}
function configured(){return!!(process.env.DEEPSEEK_API_KEY?.trim()||fs.existsSync(file));}
function getKey(){if(process.env.DEEPSEEK_API_KEY?.trim())return process.env.DEEPSEEK_API_KEY.trim();if(cached)return cached;try{return cached=transform(fs.readFileSync(file,'utf8'),true);}catch{throw Error('本机 DeepSeek 密钥不可读取，请使用原 Windows 用户或设置 DEEPSEEK_API_KEY。');}}
function saveKey(key){key=String(key||'').trim();if(!/^sk-[a-zA-Z0-9_-]{16,200}$/.test(key))throw Error('DeepSeek 密钥格式无效');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,transform(key,false),{mode:0o600});cached=key;}
module.exports={configured,getKey,saveKey};
