/* Functional allocations on the five existing future shells, without replacing their geometry. */
(() => {
  'use strict';
  const T=THREE,TAU=Math.PI*2;
  const roleInfo={command:['指令','指令区'],habitat:['生活','生活区'],biology:['生命实验','生命实验区'],physics:['物理实验','物理实验区'],cargo:['货运','货运区'],airlock:['气闸','气闸与外勤区']};
  const ids=['halo','gemini','spindle','crown','ark'];
  const summaries={
    halo:'居住环分为生活与两类实验环段，指令区位于中心毂，货运与气闸分置中轴两端。',
    gemini:'两层港环承载四个主要功能区，轴心承担指令与转运，上端对接口布置气闸。',
    spindle:'六类功能沿塔轴分层组织，对应既有五层驻留平台与下部对接区。',
    crown:'六片既有曲面建筑分别承载六类功能，中央穹顶与根部接口提供共享交通。',
    ark:'生活与科研沿真实圆柱长轴分区，指令、货运和气闸使用两端既有结构。'
  };
  const defaults={
    halo:{name:'光环',subtitle:'旋转居住站',category:'硬科幻',view:[1,.78,1.25]},
    gemini:{name:'双子',subtitle:'双环轨道港',category:'科幻',view:[1,.65,1.35]},
    spindle:{name:'穹脊',subtitle:'轴向星际中继站',category:'科幻',view:[1.05,.48,1.35]},
    crown:{name:'星冕',subtitle:'六瓣轨道枢纽',category:'科幻',view:[1.05,1.2,1.3]},
    ark:{name:'方舟',subtitle:'旋转殖民地',category:'远未来',view:[1.15,.72,1.3]}
  };
  function source(id){const definition=(window.StationConcepts||[]).find(item=>item.id===id);if(!definition||typeof definition.build!=='function')throw Error('未来外壳尚未加载：'+id+'；请先载入 orbital.js 与 speculative.js。');return definition;}
  const families=ids.map(id=>({id,...defaults[id],kind:'future',description:summaries[id],features:['原设计完整外壳','六功能区规划','不置入舱内模型']}));
  const zone=(id,layoutLabel,description,position,layout)=>({id,role:roleInfo[id][0],name:roleInfo[id][1],layoutLabel,description,position,layout});
  function ringZone(id,y,radius,radialWidth,height,startAngle,endAngle,label,description){
    const middle=(startAngle+endAngle)/2;
    return zone(id,label,description,[Math.sin(middle)*radius,y,Math.cos(middle)*radius],{type:'annular-sector',axis:[0,1,0],center:[0,y,0],innerRadius:radius-radialWidth/2,outerRadius:radius+radialWidth/2,height,startAngle,endAngle,geometryBasis:'既有环形外壳的角向功能分区，边界沿真实环体；未计算可用舱内容积。'});
  }
  function axialZone(id,axis,min,max,radius,label,description){
    const position=axis.map(v=>v*(min+max)/2);
    return zone(id,label,description,position,{type:'axial-zone',axis:axis.slice(),range:[min,max],outerRadius:radius,geometryBasis:'既有轴向壳体的功能区段，外半径仅描述外壳包络，不代表可用舱内容积。'});
  }
  function deckZone(id,y,radius,height,label,description){
    return zone(id,label,description,[0,y,0],{type:'tower-deck',axis:[0,1,0],center:[0,y,0],outerRadius:radius,height,geometryBasis:'对应原模型这一高度的真实分层平台，外半径取平台基座；非独立圆筒舱。'});
  }
  function slotsFor(id){
    switch(id){
      case 'halo':return[
        axialZone('command',[0,1,0],-1.65,1.65,3.75,'中央指令毂','指令与全站管理布置于六辐条汇合的实体中央毂。'),
        ringZone('habitat',0,18,3.2,3.35,0,Math.PI,'居住环 · 半环生活区','生活区占完整宽断面居住环的一半，保留连续窗带与旋转半径。'),
        ringZone('biology',0,18,3.2,3.35,Math.PI,Math.PI*1.5,'居住环 · 生命实验段','生命支持与生物实验设置在居住环的独立四分之一环段。'),
        ringZone('physics',0,18,3.2,3.35,Math.PI*1.5,TAU,'居住环 · 物理实验段','材料与物理实验使用另一四分之一环段，经既有辐条接入中央毂。'),
        axialZone('cargo',[0,1,0],-9.45,-4.8,1.72,'下轴货运段','货运接收和物资缓冲位于下部已有轴向舱段，对接端保留原造型。'),
        axialZone('airlock',[0,1,0],4.8,9.45,1.72,'上轴气闸与出入区','气闸与出入准备区位于上部轴向舱段，连接原有顶端对接环。')
      ];
      case 'gemini':return[
        axialZone('command',[0,1,0],-2,2,3.05,'中央转运塔 · 指令层','指令与港口调度使用上下港环之间的既有中央塔芯。'),
        ringZone('habitat',6.5,16,3,2.5,0,Math.PI,'上港环 · 生活半环','生活区沿上层港环半周展开，共用原有轴心与辐条。'),
        ringZone('biology',6.5,16,3,2.5,Math.PI,TAU,'上港环 · 生命实验半环','上层另一半环布置生命实验与长期研究功能。'),
        ringZone('physics',-6.5,16,3,2.5,0,Math.PI,'下港环 · 物理实验半环','物理实验沿下层港环半周组织，与上层生活区分层。'),
        ringZone('cargo',-6.5,16,3,2.5,Math.PI,TAU,'下港环 · 货运半环','货运与装卸组织在下层另一半环，利用环缘既有泊位。'),
        axialZone('airlock',[0,1,0],12.7,15.5,1.65,'顶端气闸与对接口','出入准备集中在中央塔芯上端已有的细轴向对接段。')
      ];
      case 'spindle':return[
        deckZone('command',21,6.0,2,'上部指令层 · +21','指令区对应尖顶天线下方已有的最上层环形驻留平台。'),
        deckZone('habitat',1,12.8,4.4,'中央生活层 · +1','生活区使用真实模型中最宽、最厚的中央驻留平台。'),
        deckZone('biology',12,8.7,3,'上部生命实验层 · +12','生命实验使用上半部独立驻留平台，避开外侧盾形散热翼。'),
        deckZone('physics',-9,9.8,3.4,'下部物理实验层 · −9','物理实验对应中央生活层下方的宽平台。'),
        deckZone('cargo',-18,6.9,2,'下部货运层 · −18','货运在较低位置的平台组织，靠近下部轴向对接区。'),
        zone('airlock','底端气闸与对接区','气闸与出入准备位于下部渐缩轴段，接续原有底端对接造型。',[0,-30.5,0],{type:'tapered-axial-zone',axis:[0,1,0],range:[-33,-28],radiusAtMin:1.2,radiusAtMax:2.4,geometryBasis:'对应原模型 y=−30.5、高5的锥台壳体区段；未计算可用舱内容积。'})
      ];
      case 'crown':return Object.keys(roleInfo).map((role,index)=>{
        const angle=index*TAU/6,labels={command:'指令瓣',habitat:'生活瓣',biology:'生命实验瓣',physics:'物理实验瓣',cargo:'货运瓣',airlock:'外勤与气闸瓣'},texts={command:'指令功能位于第一片曲面建筑，与中央穹顶共享调度和交通。',habitat:'第二片完整曲面建筑承载生活与长期驻留功能。',biology:'第三片曲面建筑用于生命实验，利用原有观景穹顶与设备屋面。',physics:'第四片曲面建筑用于物理实验，与相邻功能瓣区分。',cargo:'第五片曲面建筑组织货运与物资存储，经根部接口接入。',airlock:'第六片曲面建筑组织外勤准备，气闸设在其根部邻近的既有对接口一侧。'};
        return zone(role,'第 '+(index+1)+' 瓣 · '+labels[role],texts[role],[17*Math.cos(angle),0,-17*Math.sin(angle)],{type:'petal-zone',petalIndex:index,rotationY:angle,localRadialRange:[5,29.5],geometryBasis:'对应原模型第 '+(index+1)+' 个真实贝塞尔曲面花瓣，边界随原壳体，不以长方体或圆筒估算容积。'});
      });
      case 'ark':return[
        zone('command','左端指令与姿态控制区','指令功能使用圆柱左端已有的锥形端部结构，与主居住圆柱区分。',[-23.4,0,0],{type:'tapered-axial-zone',axis:[1,0,0],range:[-25.25,-21.55],radiusAtMin:3.5,radiusAtMax:8.4,geometryBasis:'对应原模型旋转到 X 轴后的左端锥台。'}),
        axialZone('habitat',[1,0,0],-18.5,-3,8,'圆柱内 · 生活纵区','生活功能沿已有圆柱的左侧纵向区段组织，保留原有装甲带与玻璃带。'),
        axialZone('biology',[1,0,0],-3,7,8,'圆柱内 · 生命实验纵区','中部纵向区段用于生命支持与生物实验，利用外置反射镜和玻璃带的采光。'),
        axialZone('physics',[1,0,0],7,18.5,8,'圆柱内 · 物理实验纵区','右侧纵向区段承担物理实验，与生活和生命实验区按长轴分隔。'),
        zone('cargo','右端货运与转运区','货运组织在右端已有锥形结构内，靠近轴向运输与对接端。',[23.4,0,0],{type:'tapered-axial-zone',axis:[1,0,0],range:[21.55,25.25],radiusAtMin:8.4,radiusAtMax:3.5,geometryBasis:'对应原模型旋转到 X 轴后的右端锥台。'}),
        axialZone('airlock',[1,0,0],25.3,28.5,2.8,'右端气闸与轴向对接口','气闸与出入准备使用圆柱右端已有细轴段，连接原有终端对接环。')
      ];
      default:throw Error('未知未来外壳：'+id);
    }
  }
  function plan(id,seed=0){
    const family=families.find(f=>f.id===id);if(!family)throw Error('未知未来外壳：'+id);
    return{version:1,kind:'future',family:id,name:family.name,seed:Number(seed)>>>0,sourceShell:id,allocation:'functional-zones',units:'concept-model',slots:slotsFor(id),connections:[],description:summaries[id],circulation:'功能分区通过原设计既有的中央核心、辐条、轴向通道或根部接口联系；没有新增舱内几何或舱门。',volumeStatus:'not-estimated',geometryStatus:'existing-shell-preserved'};
  }
  function build(K,id,seed=0){
    const allocation=plan(id,seed),definition=source(id),root=definition.build(K);if(!root?.isObject3D)throw Error('未来外壳没有返回三维模型：'+id);
    root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root);allocation.bounds={min:bounds.min.toArray(),max:bounds.max.toArray()};
    root.userData={...root.userData,sixBayPlan:allocation,sourceShell:id,shellKind:'future'};return root;
  }
  window.StationFutureBayDesign={families,plan,build};
})();
