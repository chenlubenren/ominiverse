/* Build only the entry page's public assets once, preserving classic-script order and URL bases. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const digest=body=>crypto.createHash('sha256').update(body).digest('hex');
const cache=new Map(),fingerprint=file=>{const stat=fs.statSync(file);return fs.realpathSync(file)+'|'+stat.size+'|'+stat.mtimeMs+'|'+stat.ctimeMs;};
const representation=(body,type)=>({body,type,etag:digest(body),br:zlib.brotliCompressSync(body,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:5}}),gzip:zlib.gzipSync(body,{level:6})});
const betweenTags=source=>/^\s*(?:<!--[\s\S]*?-->\s*)*$/.test(source);
function attributes(tag){
 const result=new Map(),opening=tag.match(/^<\w+\b([\s\S]*?)>/)?.[1]||'';
 const pattern=/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;let match;
 while((match=pattern.exec(opening))){const key=match[1].toLowerCase();if(result.has(key))throw Error('Duplicate HTML asset attribute: '+key);result.set(key,match[2]??match[3]??match[4]??'');}
 return result;
}
function createWebAssets(directory){
 const root=fs.realpathSync(directory),inside=file=>file.startsWith(root+path.sep),bundles=new Map(),sources=new Map(),replacements=[];
 const previous=cache.get(root);if(previous){try{if(previous.files.every(([file,version])=>fingerprint(file)===version))return previous.result;}catch{}}
 const files=new Map();
 const entry=path.join(root,'index.html');if(!inside(fs.realpathSync(entry)))throw Error('Entry page escapes application root');
 files.set(entry,fingerprint(entry));
 const html=fs.readFileSync(entry,'utf8'),visible=html.replace(/<!--[\s\S]*?-->/g,value=>' '.repeat(value.length));
 function source(url,kind){
  // A public bundle must never become a way to expose arbitrary local files,
  // even if a later HTML edit accidentally references one of them.
  if(!url||/^[\\/]|[\\:#?&\x00-\x20]/.test(url))throw Error('Unsafe public asset URL: '+url);
  let relative;try{relative=decodeURIComponent(url);}catch{throw Error('Invalid public asset URL: '+url);}
  if(relative.startsWith('./'))relative=relative.slice(2);
  const parts=relative.split('/');
  if(/[\\:#?&\x00-\x20]/.test(relative)||parts.some(part=>!part||part.startsWith('.')||part.toLowerCase()==='node_modules')||
    (kind==='script'?!/^js\/.+\.m?js$/i.test(relative):!((parts.length===1||parts[0]==='js')&&/\.css$/i.test(relative))))throw Error('Non-public asset source: '+url);
  const file=path.resolve(root,...parts),real=fs.realpathSync(file);if(!inside(file)||!inside(real))throw Error('Asset escapes application root: '+url);
  if(!fs.statSync(real).isFile())throw Error('Asset source is not a file: '+url);
  if(!sources.has(relative)){sources.set(relative,fs.readFileSync(real));files.set(file,fingerprint(file));}
  return{relative,parent:path.posix.dirname(relative),body:sources.get(relative)};
 }
 function bundle(items,kind){
  const body=Buffer.from(items.map(item=>kind==='script'?`\n;\n/* ${item.asset.relative} */\n${item.asset.body.toString('utf8')}\n;\n`:`/* ${item.asset.relative} */\n${item.asset.body.toString('utf8')}\n`).join('\n'));
  const hash=digest(body),pathname=kind==='script'?'/'+items[0].asset.parent+'/_boot.'+hash.slice(0,12)+'.js':'/boot-style.'+hash.slice(0,12)+'.css';
  const type=kind==='script'?'application/javascript; charset=utf-8':'text/css; charset=utf-8';
  bundles.set(pathname,{...representation(body,type),cacheControl:'public, max-age=31536000, immutable',sources:items.map(item=>item.asset.relative)});
  replacements.push({start:items[0].start,end:items[items.length-1].end,text:kind==='script'?`<script src="${pathname}"></script>`:`<link rel="stylesheet" href="${pathname}">`});
 }
 const scriptPattern=/<script\b(?:"[^"]*"|'[^']*'|[^'">])*?>[\s\S]*?<\/script\s*>/gi,scripts=[];let match;
 while((match=scriptPattern.exec(visible))){
  const raw=html.slice(match.index,scriptPattern.lastIndex),attrs=attributes(raw),url=attrs.get('src'),item={start:match.index,end:scriptPattern.lastIndex,eligible:false};
  if(url!==undefined){item.asset=source(url,'script');const type=(attrs.get('type')||'').toLowerCase();item.eligible=['','text/javascript','application/javascript'].includes(type)&&[...attrs.keys()].every(key=>['src','type'].includes(key))&&path.posix.basename(item.asset.relative)!=='boot-progress.js'&&/\.js$/i.test(item.asset.relative);}
  scripts.push(item);
 }
 let group=[];function flushScripts(){if(group.length)bundle(group,'script');group=[];}
 for(const item of scripts){
  if(!item.eligible){flushScripts();continue;}
  const previous=group[group.length-1];if(previous&&(previous.asset.parent!==item.asset.parent||!betweenTags(html.slice(previous.end,item.start))))flushScripts();
  group.push(item);
 }flushScripts();
 const linkPattern=/<link\b(?:"[^"]*"|'[^']*'|[^'">])*?>/gi,styles=[];
 while((match=linkPattern.exec(visible))){
  const attrs=attributes(html.slice(match.index,linkPattern.lastIndex));if(!(attrs.get('rel')||'').toLowerCase().split(/\s+/).includes('stylesheet'))continue;
  const asset=source(attrs.get('href'),'style'),text=asset.body.toString('utf8');
  // A root CSS bundle changes relative URL bases. Refuse URL/import-bearing
  // styles until a real CSS-aware URL rewrite is introduced.
  const css=text.replace(/^\uFEFF?@charset\s+["']UTF-8["'];\s*/i,'');
  if(/url\s*\(|@import\b|@charset\b/i.test(css))throw Error('Stylesheet needs URL/import rewriting before bundling: '+asset.relative);
  asset.body=Buffer.from(css);
  styles.push({start:match.index,end:linkPattern.lastIndex,asset,eligible:[...attrs.keys()].every(key=>['rel','href'].includes(key))&&attrs.get('rel').toLowerCase()==='stylesheet'});
 }
 group=[];function flushStyles(){if(group.length)bundle(group,'style');group=[];}
 for(const item of styles){if(!item.eligible){flushStyles();continue;}const previous=group[group.length-1];if(previous&&!betweenTags(html.slice(previous.end,item.start)))flushStyles();group.push(item);}flushStyles();
 let output=html;for(const change of replacements.sort((a,b)=>b.start-a.start))output=output.slice(0,change.start)+change.text+output.slice(change.end);
 const body=Buffer.from(output),result={html:body,entry:representation(body,'text/html; charset=utf-8'),bundles,sources:[...sources.keys()],stats:{scriptSources:scripts.filter(item=>item.asset).length,styleSources:styles.length,scriptBundles:[...bundles.values()].filter(item=>item.type.startsWith('application/javascript')).length,styleBundles:[...bundles.values()].filter(item=>item.type.startsWith('text/css')).length}};
 cache.set(root,{result,files:[...files]});return result;
}
module.exports={createWebAssets};
