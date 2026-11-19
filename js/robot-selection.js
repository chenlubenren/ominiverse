/* Select a size family before matching a model name, shape or job. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RobotSelection=api;})(typeof window==='undefined'?globalThis:window,()=>{
 const core=text=>String(text).replace(/(?:名字(?:叫|是)|名叫|叫做|取名为|命名为|叫)[“「"]([^”」"]+)[”」"]/g,'').replace(/(?:名字(?:叫|是)|名叫|叫做|取名为|命名为|叫)[^，。；;]{1,24}(?=[，。；;]|$)/g,'');
 function size(text){const s=core(text).replace(/(?:不是|不要|不用|不需要)\s*(?:大型|巨型|巨构|中型|小型|微型|迷你)/g,'');const hits=[...s.matchAll(/小型|微型|迷你|小号|小尺寸|中型|中等|大型|巨型|巨构|巨头|巨大|超大型|\b(?:small|mini|medium|large|giant|huge)\b/gi)];return hits.length?/小型|微型|迷你|小号|小尺寸|small|mini/i.test(hits.at(-1)[0])?'small':/中型|中等|medium/i.test(hits.at(-1)[0])?'medium':'giant':null;}
 const small={humanoid:[[/人形|双足|两条腿|双手|像人|保安|协作/,12]],quadruped:[[/四足|四条腿|狗|犬/,18],[/巡检|巡逻|侦察|探测|警戒/,8]],delivery:[[/送餐|配送|送水|茶水|端茶|送文件|托盘|餐盘|服务|轮式|轮子/,12]],carrier:[[/物流|搬运|货运|货箱|搬箱|运货|运输|仓储|承重|履带/,14]]};
 const giant={dragon:[[/飞行|会飞|能飞|翅膀|翅翼|空中|盘旋|翼龙/,18]],octopus:[[/触手|吸盘|八爪|八条腕|软体/,22]],spider:[[/多足|四足|四条腿|八条腿|机械狗|机器狗|像狗|爬墙|爬楼|攀爬|蜘蛛/,16]],serpent:[[/蛇|无足|没有腿|没腿|长条|蜿蜒|爬蛇/,20]],titan:[[/人形|双足|两条腿|巨人|拳头|拳击|手臂|搬运|物流|地面行走|走路/,16]]};
 function pick(text,catalog,family){const s=core(text),rules=family==='giant'?giant:small;return catalog.map(c=>{let score=c.aliases?.test(s)?100:c.aliases?.test(text)?3:0;for(const [re,w]of rules[c.type]||[])if(re.test(s))score+=w;return{...c,score};}).sort((a,b)=>b.score-a.score)[0];}
 function choose(text,catalog,family){const best=pick(text,catalog,family);return best?.score?best:catalog.find(c=>c.type===(family==='giant'?'titan':'humanoid'));}
 return{size,choose,core};
});
