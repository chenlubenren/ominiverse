/* Gameplay durability per material and component. HP is never a visible bar. */
(() => {
 'use strict';const L=window.IndoorLab;
 const materials={
  glass:{label:'玻璃',hp:18,referenceThickness:.06,damageMultiplier:1.25,impulseScale:1.1,jointStrength:14,fragments:26},
  screen:{label:'屏幕 / 小电子件',kind:'plastic',hp:30,referenceThickness:.04,damageMultiplier:1.1,impulseScale:.8,jointStrength:24,fragments:12},
  plastic:{label:'塑料外壳',hp:60,referenceThickness:.07,damageMultiplier:1,impulseScale:.85,jointStrength:35,fragments:12},
  fabric:{label:'织物 / 软包',hp:55,referenceThickness:.10,damageMultiplier:.65,impulseScale:.65,jointStrength:28,fragments:10},
  wood:{label:'木质桌板 / 柜体',hp:95,referenceThickness:.08,damageMultiplier:1,impulseScale:1,jointStrength:48,fragments:18},
  metal:{label:'金属框架',hp:205,referenceThickness:.06,damageMultiplier:.75,impulseScale:.55,jointStrength:125,fragments:8},
  concrete:{label:'墙体 / 砌体',hp:380,referenceThickness:.16,damageMultiplier:.72,impulseScale:.35,jointStrength:260,fragments:22},
  ceramic:{label:'陶瓷 / 花盆',hp:24,referenceThickness:.08,damageMultiplier:1.15,impulseScale:.8,jointStrength:20,fragments:16}
 };
 L.destructionMaterials=materials;
 L.materialResponse=({key='',name='',wall=false,size})=>{let type=['glass','roomGlass'].includes(key)?'glass':wall?'concrete':/玻璃|glaz|glass/i.test(name)?'glass':/屏幕|显示|电子|screen|monitor/i.test(name)||key==='screen'?'screen':/陶瓷|花盆|盆器|瓷|ceramic/i.test(name)?'ceramic':/打印机|printer/i.test(name)?'plastic':key==='metal'||/金属|钢|铝|metal|steel/i.test(name)?'metal':key==='fabric'||/软包|织物|沙发|sofa|fabric/i.test(name)?'fabric':['desk','wood'].includes(key)||/木|桌板|柜|wood|table/i.test(name)?'wood':'plastic';const source=materials[type],thickness=size?Math.min(size.x,size.y,size.z):source.referenceThickness,factor=L.clamp(Math.sqrt(Math.max(.012,thickness)/source.referenceThickness),.75,1.5),base=type==='concrete'&&/隔墙|partition/i.test(name)?300:source.hp,maxHP=Math.round(base*factor);return{...source,type,kind:source.kind||type,maxHP,thickness};};
})();
