/* Six functional pressure hulls, designed as compact conventional station families. */
(() => {
  'use strict';
  const T=THREE,TAU=Math.PI*2,X=[1,0,0],Y=[0,1,0],Z=[0,0,1],NX=[-1,0,0],NY=[0,-1,0],NZ=[0,0,-1];
  const roles=[['command','指令','指令舱',7.3,1.9],['habitat','生活','生活舱',6.2,1.75],['biology','生命实验','生命实验舱',10.8,1.7],['physics','物理实验','物理实验舱',10.0,1.62],['cargo','货运','货运舱',6.8,2.4],['airlock','气闸','出舱气闸',3.0,1.13]];
  const families=[
    {id:'kepler',name:'开普勒',subtitle:'紧凑双实验站',view:[1,.8,1.15],category:'六舱组合'},
    {id:'tianji',name:'天枢',subtitle:'T 形核心科研站',view:[1,.82,1.1],category:'六舱组合'},
    {id:'linkstar',name:'联星',subtitle:'双列实验站',view:[1,.92,1.35],category:'六舱组合'},
    {id:'relay',name:'远航',subtitle:'串联补给站',view:[1,.75,1.2],category:'六舱组合'},
    {id:'meridian',name:'子午',subtitle:'长短臂十字站',view:[1,.72,1.18],category:'六舱组合'},
    {id:'offset',name:'错星',subtitle:'错位双支舱站',view:[1,.84,1.28],category:'六舱组合'},
    {id:'zenith',name:'天顶',subtitle:'立体上下对接站',view:[1,.6,1.25],category:'六舱组合'},
    {id:'frontier',name:'前哨',subtitle:'偏置扩展科研站',view:[1,.85,1.2],category:'六舱组合'}
  ];
  const descriptions={kepler:'短主轴接入成对实验舱，六种用途围绕紧凑核心组织。',tianji:'中轴指令、生活与货运舱串联，两座长实验舱形成 T 形轮廓。',linkstar:'六个舱体组成两条相邻纵列，以短横向接口直接对接。',relay:'不同直径的舱体沿长轴递次连接，短气闸贴近中部指令舱。',meridian:'长实验舱、宽货运舱与短气闸围绕指令舱形成不等臂十字。',offset:'实验舱分别连接前后两处节点，形成明显错位的两条支臂。',zenith:'六舱沿上下与横向展开，货运和生活舱构成立体短轴。',frontier:'两座实验舱向同一侧连续扩展，形成偏置的完整科研组合。'};
  for(const family of families)family.description=descriptions[family.id];
  const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),length=a=>Math.hypot(...a);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const seeded=seed=>{let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};};
  function box(position,size){return{min:position.map((v,i)=>v-size[i]/2),max:position.map((v,i)=>v+size[i]/2)};}
  function intersect(a,b,margin=0){return a.min.every((v,i)=>Math.min(a.max[i],b.max[i])-Math.max(v,b.min[i])>margin);}
  function union(boxes){return{min:[0,1,2].map(i=>Math.min(...boxes.map(b=>b.min[i]))),max:[0,1,2].map(i=>Math.max(...boxes.map(b=>b.max[i])))};}
  function segmentHits(a,b,bounds,margin=.0){let lo=0,hi=1;for(let i=0;i<3;i++){const min=bounds.min[i]-margin,max=bounds.max[i]+margin,d=b[i]-a[i];if(Math.abs(d)<1e-8){if(a[i]<=min||a[i]>=max)return false;}else{let t0=(min-a[i])/d,t1=(max-a[i])/d;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>=hi)return false;}}return hi>1e-5&&lo<1-1e-5;}
  const support=(slot,normal)=>Math.abs(dot(slot.axis,normal))>.5?slot.length/2:slot.radius;
  function template(id){
    // Every edge describes a real short docking interface. Side connections
    // may use parallel axes; axial connections share the same longitudinal line.
    const e=(child,parent,normal,axis=normal,offset=0,gap=.48)=>({child,parent,normal,axis,offset,gap});
    switch(id){
      case 'kepler':return{axis:Z,edges:[e('habitat','command',Z),e('cargo','command',NZ),e('biology','habitat',NX),e('physics','habitat',X),e('airlock','command',Y,Y,-.18)],arrays:['biology','physics'],vertical:[false,false]};
      case 'tianji':return{axis:Z,edges:[e('habitat','command',NZ),e('cargo','habitat',NZ),e('biology','command',NX),e('physics','command',X),e('airlock','command',Y)],arrays:['biology','physics'],vertical:[false,true]};
      case 'linkstar':return{axis:Z,edges:[e('habitat','command',Z),e('cargo','command',NZ),e('biology','command',X,Z,0,1.25),e('physics','biology',Z),e('airlock','biology',NZ)],arrays:['habitat','physics'],vertical:[false,false]};
      case 'relay':return{axis:Z,edges:[e('habitat','command',Z),e('biology','habitat',Z),e('physics','command',NZ),e('cargo','physics',NZ),e('airlock','command',Y)],arrays:['biology','cargo'],vertical:[false,false]};
      case 'meridian':return{axis:Z,edges:[e('biology','command',Z),e('cargo','command',NZ),e('physics','command',NX),e('habitat','command',X),e('airlock','command',NY)],arrays:['physics','habitat'],vertical:[true,false]};
      case 'offset':return{axis:Z,edges:[e('habitat','command',Z),e('cargo','command',NZ),e('biology','habitat',NX),e('physics','cargo',X),e('airlock','command',Y)],arrays:['biology','physics'],vertical:[false,true]};
      case 'zenith':return{axis:Y,edges:[e('habitat','command',NY),e('cargo','habitat',NY),e('biology','command',NX),e('physics','command',X),e('airlock','command',Y)],arrays:['biology','physics'],vertical:[true,false]};
      case 'frontier':return{axis:Z,edges:[e('habitat','command',Z),e('cargo','command',NZ),e('biology','habitat',X),e('physics','biology',X),e('airlock','cargo',NX)],arrays:['physics','cargo'],vertical:[true,false]};
      default:throw Error('未知六舱形态：'+id);
    }
  }
  function panelSet(slot,normal,width,height,vertical,r,occupied){
    const endpoint=add(slot.position,mul(normal,support(slot,normal))),u=normal;
    const choices=Math.abs(normal[1])>.5?[X,Z]:vertical?[Y,Math.abs(normal[0])>.5?Z:X]:[Math.abs(normal[0])>.5?Z:X,Y];
    for(const v of choices){
      const pivot=add(endpoint,mul(u,width/2+.62)),w=cross(u,v),basis=new T.Matrix4().makeBasis(new T.Vector3(...u),new T.Vector3(...v),new T.Vector3(...w)),quaternion=new T.Quaternion().setFromRotationMatrix(basis).toArray(),panels=[];
      for(const sign of [-1,1]){
        const position=add(pivot,mul(v,sign*(height/2+1.25))),size=[0,1,2].map(i=>Math.abs(u[i])*(width+.2)+Math.abs(v[i])*(height+.2)+Math.abs(w[i])*.25);
        panels.push({slotId:slot.id,position,width,height,quaternion,bounds:box(position,size),hinge:pivot.slice(),mount:endpoint.slice(),span:v.map(n=>n*sign)});
      }
      if(panels.some(p=>occupied.some(b=>intersect(p.bounds,b,.015))))continue;
      // The stem leaves the pressure hull at a free port and must remain clear
      // of every other bay as well as already installed photovoltaic blankets.
      if(occupied.some(b=>b!==slot.bounds&&segmentHits(endpoint,pivot,b,.08)))continue;
      return panels;
    }
    return null;
  }
  function plan(familyId,seed=0){
    const family=families.find(f=>f.id===familyId);if(!family)throw Error('未知六舱形态：'+familyId);
    seed=Number(seed)>>>0;const r=seeded(seed),spec=template(familyId),byId=new Map(),slots=roles.map(([id,role,name,l,rad])=>{
      const length=l*(.86+r()*.28),radius=rad*(.905+r()*.19),cap=radius*.6,neck=radius*.56,volume=Math.PI*radius*radius*(length-cap*2)+2*Math.PI*neck*neck*.12+2*Math.PI*(cap-.12)*(radius*radius+radius*neck+neck*neck)/3;
      const slot={id,role,name,length,radius,volume,envelopeVolume:Math.PI*radius*radius*length,position:[0,0,0],axis:Z.slice()};byId.set(id,slot);return slot;
    });
    byId.get('command').axis=spec.axis.slice();const connections=[];
    for(const edge of spec.edges){
      const parent=byId.get(edge.parent),child=byId.get(edge.child);child.axis=edge.axis.slice();const a=add(add(parent.position,mul(parent.axis,parent.length*edge.offset)),mul(edge.normal,support(parent,edge.normal))),gap=edge.gap;
      child.position=add(a,mul(edge.normal,gap+support(child,edge.normal)));const b=sub(child.position,mul(edge.normal,support(child,edge.normal))),radius=Math.min(.76,parent.radius*.45,child.radius*.51);
      connections.push({from:parent.id,to:child.id,parent:parent.id,child:child.id,ports:[{slotId:parent.id,position:a,normal:edge.normal.slice()},{slotId:child.id,position:b,normal:mul(edge.normal,-1)}],length:gap,radius});
    }
    for(const slot of slots)slot.bounds=box(slot.position,slot.axis.map(v=>Math.abs(v)>.5?slot.length:slot.radius*2));
    for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++)if(intersect(slots[i].bounds,slots[j].bounds,.002))throw Error('六舱体量发生重叠：'+slots[i].id+'/'+slots[j].id);
    for(const c of connections)for(const slot of slots)if(slot.id!==c.from&&slot.id!==c.to&&segmentHits(c.ports[0].position,c.ports[1].position,slot.bounds,c.radius))throw Error('对接接口穿入第三舱：'+slot.id);
    const panels=[],occupied=slots.map(s=>s.bounds),arraySize=familyId==='relay'?{w:4.5,h:7.8}:{w:5.5+r()*.55,h:8.3+r()*1.0};
    for(let i=0;i<spec.arrays.length;i++){
      const slot=byId.get(spec.arrays[i]),normal=slot.axis.slice(),generated=panelSet(slot,normal,arraySize.w,arraySize.h,spec.vertical[i],r,occupied);
      if(!generated)throw Error('太阳翼与舱体间距不足：'+familyId+'/'+slot.id);panels.push(...generated);occupied.push(...generated.map(p=>p.bounds));
    }
    const bounds=union([...slots.map(s=>s.bounds),...panels.map(p=>p.bounds)]);
    return{version:1,family:familyId,name:family.name,seed,slots,connections,panels,bounds,validation:{slotCount:6,connected:true,clearPressureHulls:true,clearDockingInterfaces:true,clearSolarArrays:true}};
  }
  function ring(K,g,mat,r,y,t=.045){return K.mesh(g,new T.TorusGeometry(r,t,5,32),mat,[0,y,0],[Math.PI/2,0,0]);}
  function pressureHull(K,parent,slot){
    const g=K.group(parent,slot.position);g.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(...slot.axis));g.name=slot.name;g.userData={sixBaySlot:slot.id,slotId:slot.id,role:slot.role};
    const r=slot.radius,h=slot.length/2,cap=r*.6,neck=r*.56;
    const profile=[[0,-h],[neck,-h],[neck,-h+.12],[r,-h+cap],[r,h-cap],[neck,h-.12],[neck,h],[0,h]].map(v=>new T.Vector2(...v));K.mesh(g,new T.LatheGeometry(profile,32),'hull');
    for(const y of [-h+cap+.12,0,h-cap-.12])ring(K,g,'silver',r+.025,y,.035);
    for(const sign of [-1,1]){K.cylinder(g,'graphite',neck,neck,.14,[0,sign*h,0],[0,0,0],24);ring(K,g,'silver',neck+.035,sign*h,.065);}
    if(slot.id==='cargo'){
      K.cylinder(g,'gold',r+.018,r+.018,slot.length*.22,[0,-slot.length*.18,0],[0,0,0],24);
      for(let i=0;i<8;i++){const a=i*TAU/8;K.box(g,'silver',[.025,slot.length*.22,.03],[Math.sin(a)*(r+.04),-slot.length*.18,Math.cos(a)*(r+.04)],[0,a,0]);}
    }
    for(let i=0;i<8;i++){
      const side=K.group(g,[0,0,0],[0,i*TAU/8,0]);K.box(side,'silver',[.025,slot.length*.52,.035],[0,0,r+.02]);
      for(const yy of [-slot.length*.18,slot.length*.18]){
        K.box(side,'hull',[r*.57,slot.length*.15,.04],[0,yy,r+.035]);
        K.box(side,'graphite',[r*.33,.045,.045],[0,yy+slot.length*.04,r+.06]);
      }
      if((slot.id==='command'||slot.id==='habitat')&&i%2===0){K.box(side,'graphite',[.53,.45,.055],[0,.08,r+.08]);K.box(side,'glass',[.37,.29,.055],[0,.08,r+.12]);}
      if(i%2===0)K.box(side,'blue',[r*.64,.13,.045],[0,h-cap-.36,r+.04]);
    }
    if(slot.id==='airlock'){for(const y of [-.42,.42])ring(K,g,'graphite',r+.03,y,.03);K.box(g,'gold',[.55,.33,.17],[0,.12,r+.13]);}
    if(slot.id==='biology'||slot.id==='physics'){
      // Four short equipment rails hug each laboratory's pressure shell.
      for(let i=0;i<4;i++){const a=i*Math.PI/2;K.box(g,'silver',[.05,slot.length*.68,.05],[Math.sin(a)*(r+.08),0,Math.cos(a)*(r+.08)],[0,a,0]);}
    }
    return g;
  }
  function connectionMesh(K,root,c){
    const a=new T.Vector3(...c.ports[0].position),b=new T.Vector3(...c.ports[1].position),g=K.group(root,a.clone().add(b).multiplyScalar(.5).toArray());g.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.sub(a).normalize());g.name='对接接口 '+c.from+' / '+c.to;
    K.cylinder(g,'graphite',c.radius,c.radius,c.length+.12,[0,0,0],[0,0,0],24);
    for(const sign of [-1,1]){K.cylinder(g,'silver',c.radius+.1,c.radius+.1,.12,[0,sign*(c.length/2-.025),0],[0,0,0],24);ring(K,g,'hull',c.radius+.08,sign*(c.length/2-.025),.06);}
  }
  function build(K,familyId,seed=0,{includeSolar=true}={}){
    const design=plan(familyId,seed),root=new T.Group();root.name='六舱外壳 · '+design.name;root.userData.sixBayPlan=design;
    for(const slot of design.slots)pressureHull(K,root,slot);
    for(const c of design.connections)connectionMesh(K,root,c);
    const builtHinges=new Set();
    for(const p of includeSolar?design.panels:[]){
      const g=K.solar(root,{width:p.width,height:p.height,position:p.position,rotation:[0,0,0],cols:4,rows:7});g.quaternion.fromArray(p.quaternion);g.name='太阳翼 · '+p.slotId;g.userData.solarAttachment=g.userData.panelFor=p.slotId;
      const inner=sub(p.position,mul(p.span,p.height/2)),u=new T.Vector3(1,0,0).applyQuaternion(new T.Quaternion(...p.quaternion)).toArray();
      const key=p.slotId;if(!builtHinges.has(key)){builtHinges.add(key);K.beam(root,'silver',p.mount,p.hinge,.2);K.sphere(root,'graphite',.27,p.hinge);K.beam(root,'silver',add(p.hinge,mul(u,-.4)),add(p.hinge,mul(u,.4)),.14);}
      K.beam(root,'silver',p.hinge,inner,.13);
      for(const sign of [-1,1])K.beam(root,'silver',add(p.hinge,mul(u,sign*.35)),add(inner,mul(u,sign*p.width*.3)),.07);
    }
    // Thermal equipment stays directly against each bay. Its supports do not
    // introduce additional habitable volumes or detached decorative objects.
    for(const slot of design.slots.filter(s=>s.id==='biology'||s.id==='physics')){
      const g=root.children.find(o=>o.userData.sixBaySlot===slot.id),r=slot.radius,l=slot.length;
      K.box(g,'graphite',[r*1.1,l*.28,.16],[0,-l*.12,r+.13]);
      for(let i=0;i<6;i++)K.box(g,'silver',[r*1.04,.17,.08],[0,-l*.12-l*.12+i*l*.048,r+.25]);
    }
    return root;
  }
  window.StationSixBayDesign={families,plan,build};
})();
