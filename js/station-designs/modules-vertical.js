/* Conventional unequal-length station assemblies, with solid docking interfaces. */
(() => {
  'use strict';
  const T=THREE,TAU=Math.PI*2;
  window.StationConcepts??=[];
  const X=[0,0,-Math.PI/2],Z=[Math.PI/2,0,0];
  function ring(K,parent,material,radius,tube,y=0){return K.mesh(parent,new T.TorusGeometry(radius,tube,6,48),material,[0,y,0],[Math.PI/2,0,0]);}
  function port(K,parent,y,radius){
    K.cylinder(parent,'graphite',radius,radius,.32,[0,y,0]);ring(K,parent,'silver',radius+.08,.10,y+.18);ring(K,parent,'hull',radius*.72,.07,y+.20);
    for(let i=0;i<8;i++){const a=i*TAU/8;K.box(parent,'silver',[.13,.17,.18],[Math.sin(a)*(radius+.05),y+.19,Math.cos(a)*(radius+.05)],[0,a,0]);}
  }
  function cabin(K,parent,{radius=1.6,length=6,position=[0,0,0],rotation=[0,0,0],gold=false,windows=false,ribs=false}){
    const g=K.group(parent,position,rotation),barrel=Math.max(.6,length-radius*1.30);
    K.cylinder(g,'hull',radius,radius,barrel,undefined,undefined,48);
    for(const side of [-1,1]){K.mesh(g,new T.SphereGeometry(radius,32,12),'hull',[0,side*barrel/2,0]).scale.set(1,.65,1);port(K,g,side*(length/2+.07),radius*.54);}
    for(const y of [-barrel*.46,0,barrel*.46]){K.cylinder(g,'silver',radius+.045,radius+.045,.10,[0,y,0]);ring(K,g,'graphite',radius+.02,.027,y+.08);}
    if(ribs)for(let y=-barrel*.40;y<=barrel*.40;y+=.42)ring(K,g,'silver',radius+.025,.028,y);
    if(gold)for(const y of [-barrel*.36,barrel*.36]){K.cylinder(g,'gold',radius+.018,radius+.018,.50,[0,y,0]);for(let i=0;i<16;i++){const a=i*TAU/16;K.box(g,'silver',[.025,.49,.025],[Math.sin(a)*(radius+.04),y,Math.cos(a)*(radius+.04)],[0,a,0]);}}
    for(let i=0;i<8;i++){
      const a=i*TAU/8,surface=K.group(g,[Math.sin(a)*(radius+.035),0,Math.cos(a)*(radius+.035)],[0,a,0]);
      K.box(surface,'silver',[.045,barrel*.86,.04],[0,0,0]);
      if(i%2===0){K.box(surface,'blue',[.48,.20,.045],[.3,barrel*.20,.03]);K.box(surface,'orange',[.13,.17,.05],[-.32,barrel*.20,.035]);}
      if(windows&&i%2===0)for(const y of [-barrel*.16,barrel*.16]){K.box(surface,'graphite',[.42,.44,.06],[0,y,.04]);K.box(surface,'glass',[.27,.29,.04],[0,y,.09]);}
    }
    return g;
  }
  function node(K,parent,position=[0,0,0]){
    const g=K.group(parent,position);K.sphere(g,'hull',2.3,[0,0,0],[1,.94,1]);
    for(const rotation of [[0,0,0],X,Z]){
      const axis=K.group(g,[0,0,0],rotation);for(const side of [-1,1]){K.cylinder(axis,'silver',1.22,1.22,.5,[0,side*1.94,0]);ring(K,axis,'graphite',1.25,.09,side*2.13);}
    }
    for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2;K.box(g,'blue',[.65,.65,.12],[Math.sin(a)*1.65,.6,Math.cos(a)*1.65],[0,a,0]);}
    return g;
  }
  function radiator(K,parent,position,rotation=[0,0,0],width=3.6,height=2){
    const g=K.group(parent,position,rotation);K.box(g,'graphite',[width,.12,height],[0,0,0]);
    for(let i=0;i<10;i++)K.box(g,'hull',[width/10-.055,.065,height-.13],[(i-4.5)*width/10,.10,0]);
    for(const z of [-height/2,height/2])K.box(g,'silver',[width+.1,.12,.07],[0,.02,z]);
  }
  function wing(K,parent,{position,rotation=[0,0,0],width=6,height=10}){
    const g=K.group(parent,position,rotation);
    K.solar(g,{width,height,position:[0,0,0],cols:4,rows:10});
    for(const x of [-width*.34,width*.34])K.beam(g,'silver',[x,-height/2,.03],[x,-height/2-1.0,.03],.10);
    K.beam(g,'silver',[-width*.34,-height/2-1,.03],[width*.34,-height/2-1,.03],.12);
    return g;
  }
  function dish(K,parent,position,scale=.7){
    const g=K.group(parent,position,[.13,0,-.12]);K.cylinder(g,'silver',.08,.14,1.1*scale,[0,.55*scale,0]);
    const profile=[[0,0],[.3,.04],[.7,.19],[1.05,.42]].map(([r,y])=>new T.Vector2(r*scale,y*scale));K.mesh(g,new T.LatheGeometry(profile,32),'hull',[0,1.0*scale,0]);ring(K,g,'silver',1.05*scale,.035,1.42*scale);
    for(let i=0;i<3;i++){const a=i*TAU/3;K.beam(g,'silver',[Math.sin(a)*.94*scale,1.4*scale,Math.cos(a)*.94*scale],[0,2*scale,0],.035);}
  }

  window.StationConcepts.push({
    id:'zenith',index:'12',name:'天顶',subtitle:'多轴上下对接站',category:'常规变体',
    description:'中央多向节点汇合粗长生活舱、细短对接舱与纵向实验臂，下方挂接独立货运飞船。不同方向的太阳翼与上下层次共同构成紧凑的立体舱簇。',
    features:['粗长与细短横向舱','上下货运与对接节点','水平和竖直太阳翼'],view:[1.05,.65,1.35],
    build(K){
      const root=new T.Group();root.name='Zenith · Multiaxis Docking Station';node(K,root);
      // Left and right branches differ by nearly 3× in length and 2× in diameter.
      const living=cabin(K,root,{radius:2.35,length:15,position:[-9.25,0,0],rotation:X,ribs:true,windows:true});
      cabin(K,root,{radius:1.18,length:5.6,position:[4.65,0,0],rotation:X,gold:true,windows:true});
      cabin(K,root,{radius:.86,length:3.2,position:[9.05,0,0],rotation:X,gold:true});
      cabin(K,root,{radius:1.85,length:10.8,position:[0,0,7.25],rotation:Z,gold:true,windows:true});
      cabin(K,root,{radius:1.35,length:6.2,position:[0,0,-4.95],rotation:Z,windows:true});
      cabin(K,root,{radius:1.22,length:3.5,position:[0,3.6,0],gold:true});
      // A genuinely separate service craft docks vertically under the node.
      cabin(K,root,{radius:1.15,length:2.5,position:[0,-3.1,0],gold:true});
      K.cylinder(root,'hull',1.14,1.83,2.2,[0,-5.45,0]);
      const cargo=cabin(K,root,{radius:1.85,length:6.4,position:[0,-9.55,0],gold:true,ribs:true});
      for(let i=0;i<4;i++){const a=i*TAU/4;K.cylinder(cargo,'graphite',.17,.28,.5,[Math.sin(a)*.75,-3.4,Math.cos(a)*.75]);}
      // Vertical sheets on the long habitation branch; these fold on a shared root collar.
      for(const side of [-1,1]){
        K.beam(root,'silver',[-14.3,side*2.0,0],[-14.3,side*3.15,0],.28);
        wing(K,root,{position:[-14.3,side*8.45,0],rotation:side>0?[0,0,0]:[0,0,Math.PI],width:5.0,height:10.0});
        // Flat sheets at the distant experimental hull make the orientation contrast explicit.
        K.beam(root,'silver',[side*1.7,.35,10.4],[side*4.1,.35,10.4],.28);
        wing(K,root,{position:[side*8.7,.35,10.4],rotation:[Math.PI/2,0,-side*Math.PI/2],width:5.0,height:8.8});
        // Small independent cargo arrays stay attached to its own body.
        K.beam(root,'silver',[side*1.7,-9.7,0],[side*3.1,-9.7,0],.17);
        K.solar(root,{width:3.8,height:2.1,position:[side*4.7,-9.7,0],cols:4,rows:4});
      }
      K.box(root,'graphite',[2.0,.35,3.0],[-7,2.25,0]);radiator(K,root,[-7,2.52,0],undefined,3.2,2.2);
      dish(K,root,[-3.8,2.25,.2],.72);dish(K,root,[0,1.75,7.5],.62);
      root.scale.setScalar(1.5);return root;
    }
  },{
    id:'frontier',index:'13',name:'前哨',subtitle:'偏置扩展科研站',category:'常规变体',
    description:'短粗核心沿长轴接续生活与飞行舱，一侧扩展为长短两段实验支臂，另一侧保留紧凑对接口。分散挂接的太阳翼表现分期扩建的工程秩序。',
    features:['单侧两段实验支臂','主轴末端细飞船','分段异向光伏'],view:[1.1,.85,1.3],
    build(K){
      const root=new T.Group();root.name='Frontier · Offset Research Extension';
      // Every cylinder touches a mating ring, including the deliberately short opposite stub.
      cabin(K,root,{radius:2.55,length:6.5,position:[0,0,0],rotation:Z,ribs:true,windows:true});
      cabin(K,root,{radius:1.82,length:11.5,position:[0,0,-9.0],rotation:Z,gold:true,windows:true});
      cabin(K,root,{radius:1.03,length:5.6,position:[0,0,-17.55],rotation:Z,gold:true});
      cabin(K,root,{radius:1.50,length:6.6,position:[0,0,6.55],rotation:Z,windows:true});
      cabin(K,root,{radius:.83,length:2.8,position:[0,0,11.2],rotation:Z,gold:true});
      // The unilateral laboratory chain is more than twice the length of the front cabin.
      cabin(K,root,{radius:1.87,length:10.4,position:[7.55,0,-.8],rotation:X,gold:true,windows:true});
      cabin(K,root,{radius:1.22,length:6.8,position:[16.15,0,-.8],rotation:X,ribs:true,windows:true});
      cabin(K,root,{radius:1.00,length:3.3,position:[-3.8,0,-.8],rotation:X,gold:true});
      // One short, capped zenith port is structurally mounted into the service cylinder.
      cabin(K,root,{radius:.9,length:2.4,position:[0,3.15,.7],gold:true});
      for(const side of [-1,1]){
        // Horizontal array pair on the habitation spine, near the tail.
        K.beam(root,'silver',[side*1.7,.30,-11.7],[side*3.5,.30,-11.7],.27);
        wing(K,root,{position:[side*8.0,.30,-11.7],rotation:[Math.PI/2,0,-side*Math.PI/2],width:6.1,height:8.5});
        // Upright photovoltaic pair at the end of the long side laboratory.
        K.beam(root,'silver',[17.9,side*1.2,-.8],[17.9,side*2.8,-.8],.21);
        wing(K,root,{position:[17.9,side*7.0,-.8],rotation:side>0?[0,0,0]:[0,0,Math.PI],width:4.2,height:7.8});
        // Forward module has its own modest wing pair, at a different longitudinal station.
        K.beam(root,'silver',[side*1.2,.35,8.0],[side*2.5,.35,8.0],.20);
        K.solar(root,{width:4.5,height:3.1,position:[side*4.55,.35,8.0],rotation:[Math.PI/2,0,0],cols:5,rows:4});
      }
      for(const x of [6.1,10.1]){
        K.beam(root,'silver',[x,1.6,-.8],[x,2.5,-.8],.16);radiator(K,root,[x,2.6,-.8],undefined,2.8,2.9);
      }
      K.box(root,'graphite',[1.55,.45,3.0],[-.75,2.5,-1.0]);for(const z of [-1.9,-.2])K.box(root,'hull',[1.45,.43,1.3],[-.75,2.9,z]);
      dish(K,root,[2.0,2.1,-.8],.72);dish(K,root,[0,1.75,-7.4],.66);
      // Service nozzles are short and attached to the aft small craft.
      for(const side of [-1,1]){K.box(root,'gold',[.42,.52,.7],[side*.85,-.4,-18.3]);K.cylinder(root,'graphite',.12,.20,.34,[side*1.12,-.4,-18.3],[0,0,side*Math.PI/2]);}
      root.scale.setScalar(1.5);return root;
    }
  });
})();
