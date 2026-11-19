/* Three designed station exteriors. Each factory returns a complete, fixed shell. */
(() => {
  'use strict';
  const T=THREE,TAU=Math.PI*2;
  window.StationConcepts=window.StationConcepts||[];

  function port(K,parent,radius=1.1){
    K.cylinder(parent,'graphite',radius*.86,radius*.86,.44,[0,0,0]);
    K.mesh(parent,new T.TorusGeometry(radius,.13,8,48),'silver',[0,.2,0],[Math.PI/2,0,0]);
    K.mesh(parent,new T.TorusGeometry(radius*.75,.09,8,48),'hull',[0,.24,0],[Math.PI/2,0,0]);
    K.cylinder(parent,'graphite',radius*.69,radius*.69,.12,[0,.24,0]);
    for(let i=0;i<8;i++){const a=i*TAU/8;K.box(parent,'silver',[.14,.15,.19],[Math.sin(a)*radius,.27,Math.cos(a)*radius],[0,a,0]);}
  }

  function capsule(K,parent,{radius=1.6,length=6,position=[0,0,0],rotation=[0,0,0],windows=false,gold=false}={}){
    const g=K.group(parent,position,rotation);
    K.hull(g,{radius,length,position:[0,0,0],rotation:[0,0,0],material:'hull'});
    for(const y of [-.34*length,0,.34*length])K.cylinder(g,'silver',radius+.055,radius+.055,.12,[0,y,0]);
    for(const y of [-.42*length,.42*length])K.torus(g,'graphite',radius*.82,.07,[0,y,0]);
    for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
      const rib=K.group(g,[0,0,0],[0,angle,0]);
      K.box(rib,'silver',[.065,length*.57,.06],[0,0,radius+.035]);
      K.box(rib,'blue',[radius*.75,.25,.055],[0,length*.17,radius+.06]);
      if(windows)for(const y of [-.17*length,0,.17*length]){K.box(rib,'graphite',[.58,.46,.06],[0,y,radius+.065]);K.box(rib,'glass',[.4,.3,.075],[0,y,radius+.09]);}
    }
    if(gold)K.cylinder(g,'gold',radius*.86,radius*.86,.5,[0,-length*.34,0]);
    return g;
  }

  function ringHull(K,parent,radius,y,{thickness=2.3,height=2.8,segments=64,windows=true}={}){
    const g=K.group(parent,[0,y,0]),h=height/2,t=thickness/2;
    const profile=[[radius-t+.3,-h],[radius+t-.3,-h],[radius+t,-h+.3],[radius+t,h-.3],[radius+t-.3,h],[radius-t+.3,h],[radius-t,h-.3],[radius-t,-h+.3],[radius-t+.3,-h]].map(p=>new T.Vector2(...p));
    K.mesh(g,new T.LatheGeometry(profile,128),'hull');
    for(const yy of [-h+.28,h-.28]){K.torus(g,'graphite',radius+t-.01,.09,[0,yy,0]);K.torus(g,'silver',radius-t+.01,.08,[0,yy,0]);}
    K.torus(g,'blue',radius,.1,[0,h+.025,0]);
    for(let i=0;i<segments;i++){
      const angle=i*TAU/segments,slice=K.group(g,[0,0,0],[0,angle,0]),arcWidth=TAU*(radius+t)/segments;
      K.box(slice,'silver',[.055,.045,thickness-.35],[0,h+.025,radius]);
      if(windows){
        K.box(slice,'graphite',[arcWidth*.78,.53,.06],[0,.04,radius+t+.025]);
        K.box(slice,i%6===0?'warmLight':'light',[arcWidth*.57,.11,.07],[0,.17,radius+t+.07]);
        K.box(slice,'glass',[arcWidth*.62,.2,.07],[0,-.05,radius+t+.065]);
      }
      if(i%4===0){K.box(slice,'hull',[arcWidth*1.35,.36,thickness*.62],[0,h+.18,radius]);K.box(slice,'graphite',[arcWidth*.95,.04,thickness*.34],[0,h+.38,radius]);}
      if(i%8===0)K.box(slice,'orange',[arcWidth*.58,.08,.43],[0,h+.05,radius+t-.37]);
    }
    return g;
  }

  function antenna(K,parent,position,rotation=[0,0,0],scale=1){
    const g=K.group(parent,position,rotation);
    K.cylinder(g,'silver',.08*scale,.13*scale,1.5*scale,[0,.75*scale,0]);
    const points=[[.0,.0],[.3,.04],[.65,.18],[1,.4],[1.2,.64]].map(([r,y])=>new T.Vector2(r*scale,y*scale));
    K.mesh(g,new T.LatheGeometry(points,40),'hull',[0,1.35*scale,0]);
    K.torus(g,'silver',1.2*scale,.035*scale,[0,1.99*scale,0]);
    for(let i=0;i<3;i++){const a=i*TAU/3;K.beam(g,'silver',[Math.sin(a)*1.1*scale,1.9*scale,Math.cos(a)*1.1*scale],[0,2.7*scale,0],.055*scale);}
    K.sphere(g,'graphite',.13*scale,[0,2.7*scale,0]);
  }

  window.StationConcepts.push({
    id:'kepler',index:'01',name:'开普勒',subtitle:'模块化科研站',category:'近未来',
    description:'以紧凑的白色科研舱群为核心，横向桁架托起成组太阳翼。可辨认的对接环、散热板和设备表皮，保留近未来工程站的秩序感。',
    features:['紧凑模块舱群','成组太阳翼','开放式桁架'],view:[1,.8,1.15],
    build(K){
      const root=new T.Group();root.name='Kepler · Modular Research Station';
      // A single continuous spine, with every subsidiary volume seated into it.
      capsule(K,root,{radius:2.05,length:10,position:[0,0,-1],rotation:[Math.PI/2,0,0],windows:true});
      capsule(K,root,{radius:1.7,length:6.2,position:[0,0,-8.8],rotation:[Math.PI/2,0,0],gold:true});
      capsule(K,root,{radius:2.25,length:3.9,position:[0,0,5.5],rotation:[Math.PI/2,0,0]});
      capsule(K,root,{radius:1.42,length:5.7,position:[0,0,9.7],rotation:[Math.PI/2,0,0],windows:true});
      for(const side of [-1,1]){
        capsule(K,root,{radius:1.5,length:7.3,position:[side*4.7,0,5.2],rotation:[0,0,Math.PI/2],gold:side<0});
        const end=K.group(root,[side*8.3,0,5.2],[0,0,-side*Math.PI/2]);port(K,end,1.03);
        // Narrow radiators are separate in color, but physically anchored to the station.
        for(let j=0;j<2;j++){
          K.beam(root,'silver',[side*2,1.2,-7+j*3],[side*5.3,2.5,-7+j*3],.16);
          K.box(root,'silver',[4.4,.09,2.2],[side*5.2,2.5,-7+j*3]);
          for(let k=0;k<8;k++)K.box(root,'hull',[.34,.035,2.04],[side*5.2+(k-3.5)*.49,2.56,-7+j*3]);
        }
      }
      const nose=K.group(root,[0,0,12.5],[Math.PI/2,0,0]);port(K,nose,1.05);
      const aft=K.group(root,[0,0,-11.95],[-Math.PI/2,0,0]);port(K,aft,1.2);
      // The truss uses four chord members and alternating diagonal webs.
      const ty=3.15,tz=-1.4;
      for(const z of [tz-.65,tz+.65])for(const side of [-1,1])K.beam(root,'silver',[side*1.05,1.7,z],[side*1.65,ty-.6,z],.28);
      K.box(root,'graphite',[3.6,.4,1.6],[0,ty-.65,tz]);
      for(const dy of [-.6,.6])for(const dz of [-.55,.55])K.beam(root,'silver',[-25,ty+dy,tz+dz],[25,ty+dy,tz+dz],.13);
      for(let x=-25;x<25;x+=2.5){
        for(const z of [tz-.55,tz+.55])K.beam(root,'hull',[x,ty-.6,z],[x+2.5,ty+.6,z],.10);
        for(const y of [ty-.6,ty+.6])K.beam(root,'silver',[x,y,tz-.55],[x+2.5,y,tz+.55],.09);
        K.beam(root,'silver',[x,ty-.6,tz-.55],[x,ty+.6,tz-.55],.11);
      }
      for(const x of [-21.6,-12.6,12.6,21.6]){
        K.cylinder(root,'graphite',.38,.38,1.9,[x,ty,tz],[Math.PI/2,0,0]);
        for(const sign of [-1,1]){
          const z=tz+sign*9.15;
          K.beam(root,'silver',[x,ty,tz],[x,ty,z],.17);
          K.solar(root,{width:7.7,height:13.8,position:[x,ty,z],rotation:[-Math.PI/2,0,0],cols:4,rows:12});
          K.box(root,'gold',[.43,.28,1.1],[x,ty-.1,tz+sign*2.1]);
        }
      }
      // Faceted cupola on the core, with a visible gasket and individual glazing.
      K.cylinder(root,'silver',.9,1.18,1.1,[0,2.35,4.5],[0,0,0],8);
      K.cylinder(root,'glass',.84,.92,.65,[0,3.1,4.5],[0,0,0],8);
      K.torus(root,'hull',.88,.10,[0,3.39,4.5]);
      for(let i=0;i<8;i++){const a=i*TAU/8;K.beam(root,'hull',[Math.sin(a)*.92,2.8,4.5+Math.cos(a)*.92],[Math.sin(a)*.84,3.42,4.5+Math.cos(a)*.84],.07);}
      antenna(K,root,[1.6,2.2,-6.7],[0,0,-.35],.7);
      K.box(root,'gold',[1.2,.55,1.6],[-1.7,1.9,-4]);
      return root;
    }
  },{
    id:'halo',index:'02',name:'光环',subtitle:'旋转居住站',category:'硬科幻',
    description:'一条连续的宽断面居住环围绕中轴展开，六道实体辐条收束到对接核心。明暗窗带与分段表皮强调环的建筑尺度。',
    features:['单环人工重力','六辐条结构','连续居住窗带'],view:[1,.78,1.25],
    build(K){
      const root=new T.Group();root.name='Halo · Rotating Habitat';
      const radius=18;
      ringHull(K,root,radius,0,{thickness:3.2,height:3.35,segments:72});
      // Strong tapered spokes, an underside tie and a service strip form one assembly.
      for(let i=0;i<6;i++){
        const angle=i*TAU/6,g=K.group(root,[0,0,0],[0,angle,0]);
        K.beam(g,'graphite',[0,-.1,3],[0,-.1,16.7],1.35,1.2);
        K.box(g,'hull',[1.65,.72,11.8],[0,.42,10.3]);
        K.box(g,'blue',[.78,.035,10.4],[0,.8,10.3]);
        for(let j=0;j<8;j++)K.box(g,'silver',[1.66,.05,.065],[0,.81,5.45+j*1.4]);
        K.beam(g,'silver',[-.43,-3.2,3.2],[-.43,-.85,14.5],.22);
        K.beam(g,'silver',[.43,-3.2,3.2],[.43,-.85,14.5],.22);
        K.box(g,'hull',[2.3,1.2,1.4],[0,.06,16.25]);
        K.box(g,'graphite',[1.7,.22,.09],[0,.35,17.01]);
      }
      K.cylinder(root,'graphite',3.95,3.95,4.8,[0,0,0],[0,0,0],48);
      K.cylinder(root,'hull',3.75,3.75,3.6,[0,.15,0],[0,0,0],48);
      for(const y of [-2.2,2.2])K.torus(root,'silver',3.8,.16,[0,y,0]);
      for(const sign of [-1,1]){
        K.cylinder(root,'silver',sign>0?1.85:3.45,sign>0?3.45:1.85,2.5,[0,sign*3.5,0]);
        capsule(K,root,{radius:1.72,length:6.5,position:[0,sign*6.3,0],windows:sign>0,gold:sign<0});
        const docking=K.group(root,[0,sign*9.65,0],sign>0?[0,0,0]:[Math.PI,0,0]);port(K,docking,1.45);
      }
      for(let i=0;i<12;i++){
        const a=i*TAU/12,g=K.group(root,[0,0,0],[0,a,0]);
        K.box(g,'graphite',[1.25,.65,.075],[0,.35,3.79]);
        K.box(g,'light',[.88,.15,.09],[0,.38,3.83]);
        if(i%3===0){K.box(g,'silver',[1.4,3.6,.28],[0,6,2.25]);K.box(g,'hull',[1.17,3.35,.32],[0,6,2.31]);}
      }
      antenna(K,root,[2.35,2.35,-.8],[0,0,-.25],.55);
      return root;
    }
  },{
    id:'gemini',index:'03',name:'双子',subtitle:'双环轨道港',category:'科幻',
    description:'两层完整港环通过连续轴心组织，错开的辐条形成清晰的空间层次。环缘泊位、设备屋面与琥珀色引导灯呈现繁忙轨道港的秩序。',
    features:['双层港环','错位辐条','环缘对接泊位'],view:[1,.65,1.35],
    build(K){
      const root=new T.Group();root.name='双环轨道港';
      for(const sign of [-1,1]){
        const y=sign*6.5,ring=ringHull(K,root,16,y,{thickness:3.0,height:2.5,segments:64});
        const offset=sign>0?Math.PI/4:0;
        for(let i=0;i<4;i++){
          const angle=i*TAU/4+offset,g=K.group(root,[0,y,0],[0,angle,0]);
          K.box(g,'graphite',[1.4,1.0,11.3],[0,0,9.3]);
          K.box(g,'hull',[1.65,.4,11.2],[0,.55,9.3]);
          K.box(g,'silver',[1.62,.16,11.2],[0,-.61,9.3]);
          K.box(g,'blue',[.65,.03,9.4],[0,.77,9.2]);
          for(let j=0;j<7;j++)K.box(g,'silver',[1.66,.05,.07],[0,.79,4.9+j*1.5]);
          // Sloping load paths support each ring directly from the central tower.
          K.beam(root,'silver',[Math.sin(angle)*3.5,y-sign*3.5,Math.cos(angle)*3.5],[Math.sin(angle)*12.7,y-.45,Math.cos(angle)*12.7],.3);
          K.box(g,'hull',[2.5,1.2,2.2],[0,.2,15.0]);
        }
        for(let i=0;i<8;i++){
          const angle=i*TAU/8+offset,g=K.group(ring,[0,0,0],[0,angle,0]);
          // Radial docking mouths terminate in thick collars, never loose blocks.
          const berth=K.group(g,[0,-.05,18.7],[Math.PI/2,0,0]);
          K.cylinder(berth,'hull',.74,.74,2.9,[0,0,0],[0,0,0],24);
          for(const y of [-1.3,1.3])K.cylinder(berth,'silver',.78,.78,.13,[0,y,0],[0,0,0],24);
          K.cylinder(berth,'hull',.59,.74,.35,[0,1.6,0],[0,0,0],24);
          const dock=K.group(g,[0,-.05,20.4],[Math.PI/2,0,0]);port(K,dock,.63);
          K.box(g,'graphite',[1.4,.8,1.45],[0,1.45,16]);
          K.box(g,'hull',[1.55,.16,1.55],[0,1.93,16]);
          K.box(g,'warmLight',[.9,.1,.08],[0,1.7,16.79]);
        }
      }
      // The central transfer tower is a single stepped, armored body.
      K.cylinder(root,'graphite',3.2,3.2,24,[0,0,0],[0,0,0],16);
      K.cylinder(root,'hull',3.05,3.05,12,[0,0,0],[0,0,0],16);
      for(const y of [-8.2,-6.5,-2,2,6.5,8.2])K.cylinder(root,'silver',3.5,3.5,.32,[0,y,0],[0,0,0],32);
      for(let i=0;i<8;i++){
        const g=K.group(root,[0,0,0],[0,i*TAU/8,0]);
        K.box(g,'graphite',[.8,9.5,.1],[0,0,3.06]);
        for(let j=0;j<8;j++)K.box(g,j%3?'glass':'warmLight',[.48,.32,.12],[0,-3.9+j*1.1,3.11]);
        K.box(g,'silver',[.17,21,.12],[1.08,0,3.09]);
      }
      for(const sign of [-1,1]){
        K.cylinder(root,'silver',sign>0?1.65:3.15,sign>0?3.15:1.65,2.8,[0,sign*12,0],[0,0,0],32);
        K.cylinder(root,'hull',1.65,1.65,3,[0,sign*14.1,0]);
        const g=K.group(root,[0,sign*15.65,0],sign>0?[0,0,0]:[Math.PI,0,0]);port(K,g,1.4);
      }
      // Paired thermal fins are rooted in the transfer core, between the rings.
      for(const side of [-1,1])for(const z of [-1.2,1.2]){
        K.box(root,'silver',[6.6,.16,1.7],[side*5.9,0,z]);
        for(let k=0;k<10;k++)K.box(root,'hull',[.48,.07,1.52],[side*5.9+(k-4.5)*.61,.12,z]);
      }
      antenna(K,root,[2.4,10.5,0],[0,0,-.4],.75);
      return root;
    }
  });
})();
