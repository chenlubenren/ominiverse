/* A compact, engineered chain of directly docked cylindrical modules. */
(() => {
  'use strict';
  const T=THREE,TAU=Math.PI*2;
  window.StationConcepts??=[];

  function torus(K,parent,material,radius,tube,position=[0,0,0],rotation=[Math.PI/2,0,0]){
    return K.mesh(parent,new T.TorusGeometry(radius,tube,6,48),material,position,rotation);
  }
  function hull(K,parent,{radius,length,position=[0,0,0],rotation=[0,0,0]}){
    const g=K.group(parent,position,rotation),barrel=length-radius*1.3;
    K.cylinder(g,'hull',radius,radius,barrel);
    for(const side of [-1,1]){K.sphere(g,'hull',radius,[0,side*barrel/2,0],[1,.65,1]);K.cylinder(g,'graphite',radius*.56,radius*.56,.25,[0,side*(length/2+.06),0]);torus(K,g,'silver',radius*.62,.07,[0,side*(length/2+.2),0]);}
    return g;
  }

  function cylinder(K,parent,material,radius,length,z){
    return K.cylinder(parent,material,radius,radius,length,[0,0,z],[Math.PI/2,0,0]);
  }
  function collar(K,parent,radius,z){
    cylinder(K,parent,'graphite',radius,.5,z);cylinder(K,parent,'silver',radius+.14,.14,z-.22);cylinder(K,parent,'silver',radius+.14,.14,z+.22);
    for(let i=0;i<12;i++){
      const a=i/12*TAU;K.box(parent,'hull',[.20,.25,.38],[Math.sin(a)*(radius+.10),Math.cos(a)*(radius+.10),z],[0,0,-a]);
    }
  }
  function stationModule(K,parent,{radius,length,z,windows=false,gold=false}){
    const shell=hull(K,parent,{radius,length,position:[0,0,z],rotation:[Math.PI/2,0,0]});
    for(const y of [-length*.30,0,length*.30])K.cylinder(shell,'silver',radius+.045,radius+.045,.11,[0,y,0]);
    // Narrow continuous harness strips and clamped insulation shoulders.
    if(gold)for(const y of [-length*.34,length*.34]){
      K.cylinder(shell,'gold',radius*.98,radius*.98,.85,[0,y,0]);
      for(let i=0;i<16;i++){const a=i/16*TAU;K.box(shell,'silver',[.035,.82,.025],[Math.sin(a)*(radius+.015),y,Math.cos(a)*(radius+.015)],[0,a,0]);}
    }
    for(let i=0;i<8;i++){
      const a=i/8*TAU,g=K.group(shell,[Math.sin(a)*(radius+.035),0,Math.cos(a)*(radius+.035)],[0,a,0]);
      K.box(g,'hull',[.065,length*.62,.045],[0,0,0]);
      for(const y of [-length*.19,length*.19]){
        K.box(g,'blue',[.42,.19,.035],[.30,y,.025]);
        K.box(g,'gold',[.08,.22,.04],[-.25,y,.035]);
      }
      if(windows&&i%2===0)for(const y of [-length*.13,length*.13]){
        K.box(g,'graphite',[.48,.42,.08],[0,y,.08]);K.box(g,'glass',[.34,.28,.035],[0,y,.135]);
      }
    }
    return shell;
  }
  function dish(K,parent,position,rotation=[0,0,0],scale=1){
    const g=K.group(parent,position,rotation);K.cylinder(g,'graphite',.22*scale,.28*scale,.55*scale,[0,.25*scale,0]);K.cylinder(g,'silver',.10*scale,.12*scale,.9*scale,[0,.9*scale,0]);
    const profile=[[0,0],[.28,.025],[.60,.13],[.95,.34],[1.18,.57]].map(([r,y])=>new T.Vector2(r*scale,y*scale));
    K.mesh(g,new T.LatheGeometry(profile,40),'hull',[0,1.25*scale,0]);torus(K,g,'silver',1.18*scale,.045*scale,[0,1.82*scale,0]);
    for(let i=0;i<3;i++){const a=i/3*TAU;K.beam(g,'silver',[Math.sin(a)*1.07*scale,1.78*scale,Math.cos(a)*1.07*scale],[0,2.45*scale,0],.045*scale);}
    K.sphere(g,'graphite',.12*scale,[0,2.45*scale,0]);
  }
  function solarPair(K,parent,z,height){
    for(const side of [-1,1]){
      // Each wing has a short, thick root mast and three attached folding panels.
      K.cylinder(parent,'graphite',.36,.36,2.8,[side*3.4,.5,z],[0,0,Math.PI/2]);
      K.cylinder(parent,'gold',.47,.47,.32,[side*4.2,.5,z],[0,0,Math.PI/2]);
      K.beam(parent,'silver',[side*2.4,.5,z-.68],[side*5.0,.5,z-.68],.16,.16);
      K.beam(parent,'silver',[side*2.4,.5,z+.68],[side*5.0,.5,z+.68],.16,.16);
      for(let panel=0;panel<3;panel++){
        const x=side*(6.6+panel*3.25);
        K.solar(parent,{width:3.06,height,position:[x,.5,z],rotation:[-Math.PI/2,0,0],cols:3,rows:8});
        if(panel<2)for(const dz of [-height*.37,height*.37])K.cylinder(parent,'silver',.12,.12,.36,[side*(8.225+panel*3.25),.5,z+dz],[0,0,Math.PI/2]);
      }
      K.beam(parent,'silver',[side*4.8,.35,z],[side*14.8,.35,z],.11,.17);
    }
  }

  window.StationConcepts.push({
    id:'relay',index:'09',name:'远航',subtitle:'串联补给站',category:'舱体组合',
    description:'服务舱、货运舱与飞行舱沿同一长轴紧密串联，短实验舱分列两侧。三对分段太阳翼形成有序节奏，延续现实空间站的白色压力壳与金色隔热结构。',
    features:['连续串联主轴','紧凑侧向实验舱','三对分段太阳翼'],view:[1.05,.95,1.2],
    build(K){
      const root=new T.Group();root.name='Relay · Longitudinal Logistics Station';
      // Physical mating collars sit across each pair of directly adjacent hulls.
      stationModule(K,root,{radius:2.35,length:12,z:0,windows:true});
      stationModule(K,root,{radius:2.7,length:10,z:-11.05,gold:true});collar(K,root,1.68,-6.05);
      stationModule(K,root,{radius:1.85,length:5.2,z:-18.55,gold:true});collar(K,root,1.48,-16.0);
      stationModule(K,root,{radius:1.6,length:7.1,z:9.35,windows:true,gold:true});collar(K,root,1.35,5.95);
      K.cylinder(root,'hull',.98,1.35,2.1,[0,0,13.65],[Math.PI/2,0,0]);collar(K,root,1.06,14.8);
      cylinder(K,root,'graphite',.83,.14,15.1);torus(K,root,'silver',.72,.10,[0,0,15.2],[0,0,0]);
      collar(K,root,1.3,-21.15);cylinder(K,root,'graphite',.9,.2,-21.5);
      for(const side of [-1,1]){
        const g=K.group(root,[side*4.9,0,1.3],[0,0,-side*Math.PI/2]);
        hull(K,g,{radius:1.35,length:6.5});
        for(const y of [-1.8,1.8])K.cylinder(g,'gold',1.32,1.32,.55,[0,y,0]);
        for(const y of [-2.7,0,2.7])torus(K,g,'silver',y===0?1.39:.95,.065,[0,y,0]);
        for(let j=0;j<3;j++){K.box(g,'graphite',[.46,.4,.08],[0,-1.1+j*1.1,1.37]);K.box(g,'glass',[.31,.25,.05],[0,-1.1+j*1.1,1.43]);}
        K.cylinder(g,'graphite',.75,.75,.4,[0,3.35,0]);torus(K,g,'silver',.83,.12,[0,3.55,0]);
        // Two compact ribbed radiators remain mounted directly above the laboratory.
        K.beam(root,'silver',[side*4.2,1.1,1.3],[side*4.8,2.0,1.3],.16);
        K.box(root,'silver',[3.8,.10,2.1],[side*5.4,2.05,1.3]);
        for(let i=0;i<10;i++)K.box(root,'hull',[.30,.045,1.94],[side*5.4+(i-4.5)*.36,2.12,1.3]);
      }
      solarPair(K,root,-13.0,6.6);solarPair(K,root,-4.0,6.6);solarPair(K,root,8.8,6.0);
      // A dorsal equipment deck and antenna station add scale without changing the clear axis.
      K.box(root,'graphite',[1.8,.45,4.3],[0,2.36,-1.1]);
      for(const z of [-2.5,-.3]){K.box(root,'hull',[1.65,.62,1.55],[0,2.78,z]);K.box(root,'silver',[1.40,.10,1.31],[0,3.13,z]);for(let i=0;i<6;i++)K.box(root,'graphite',[.10,.025,1.20],[(i-2.5)*.20,3.2,z]);}
      dish(K,root,[0,2.28,3.6],[.13,0,.16],.75);dish(K,root,[0,2.65,-11.0],[-.15,0,-.2],.58);
      for(const sign of [-1,1]){
        K.box(root,'gold',[.62,.62,.85],[sign*1.18,-1.0,-19.0]);
        for(const z of [-19.4,-18.6])K.cylinder(root,'graphite',.13,.23,.36,[sign*1.49,-1.0,z],[0,0,sign*Math.PI/2]);
      }
      return root;
    }
  });
})();
