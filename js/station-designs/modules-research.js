/* Compact, directly docked module combinations inspired by current orbital stations. */
(() => {
  'use strict';
  const T=THREE,TAU=Math.PI*2;
  window.StationConcepts=window.StationConcepts||[];
  const collar=(K,parent,material,radius,y,tube=.065)=>K.mesh(parent,new T.TorusGeometry(radius,tube,6,64),material,[0,y,0],[Math.PI/2,0,0]);

  function docking(K,parent,{radius=1.05,position=[0,0,0],rotation=[0,0,0],open=false}={}){
    const g=K.group(parent,position,rotation);
    K.cylinder(g,'silver',radius,radius,.3,[0,0,0],[0,0,0],32);
    K.cylinder(g,'graphite',radius*.84,radius*.84,.32,[0,.05,0],[0,0,0],32);
    collar(K,g,'hull',radius*.9,.23,.095);collar(K,g,'silver',radius*.65,.25,.05);
    if(!open)K.cylinder(g,'silver',radius*.59,radius*.59,.055,[0,.24,0],[0,0,0],24);
    for(let i=0;i<8;i++){const a=i*TAU/8;K.box(g,'graphite',[.16,.1,.12],[Math.sin(a)*radius*.9,.33,Math.cos(a)*radius*.9],[0,a,0]);}
    return g;
  }

  function module(K,parent,{radius=1.8,length=7,position=[0,0,0],rotation=[0,0,0],windows=false,insulated=false}={}){
    const g=K.group(parent,position,rotation),h=length/2,r=radius;
    const points=[[0,-h],[r*.56,-h],[r*.56,-h+.15],[r*.78,-h+.32],[r,-h+r*.65],[r,h-r*.65],[r*.78,h-.32],[r*.56,h-.15],[r*.56,h],[0,h]].map(p=>new T.Vector2(...p));
    K.mesh(g,new T.LatheGeometry(points,48),'hull');
    for(const y of [-h+r*.7,0,h-r*.7])collar(K,g,'silver',r+.025,y,.045);
    for(const sign of [-1,1])docking(K,g,{radius:r*.62,position:[0,sign*(h+.05),0],rotation:sign>0?[0,0,0]:[Math.PI,0,0]});
    if(insulated){
      K.cylinder(g,'gold',r+.015,r+.015,length*.24,[0,-length*.2,0],[0,0,0],32);
      for(let i=0;i<16;i++){const a=i*TAU/16,slice=K.group(g,[0,0,0],[0,a,0]);K.box(slice,'silver',[.025,length*.24,.035],[0,-length*.2,r+.04]);}
    }
    for(let i=0;i<8;i++){
      const slice=K.group(g,[0,0,0],[0,i*TAU/8,0]);
      K.box(slice,'silver',[.035,length*.55,.04],[0,0,r+.02]);
      for(const yy of [-length*.16,length*.16]){
        K.box(slice,'hull',[r*.58,length*.17,.05],[0,yy,r+.04]);
        K.box(slice,'graphite',[r*.35,.075,.055],[0,yy+length*.055,r+.071]);
        if(i%2===0)for(const side of [-1,1])K.box(slice,'silver',[.04,.05,.06],[side*r*.22,yy-length*.045,r+.075]);
      }
      K.box(slice,i%2?'blue':'silver',[r*.68,.18,.055],[0,h-r*.91,r+.04]);
      if(windows&&i%2===0){K.box(slice,'graphite',[.62,.55,.07],[0,.2,r+.075]);K.box(slice,'glass',[.43,.35,.085],[0,.2,r+.12]);}
    }
    return g;
  }

  function dish(K,parent,position,rotation=[0,0,0],radius=.9){
    const g=K.group(parent,position,rotation);
    K.cylinder(g,'silver',.095,.15,.9,[0,.45,0],[0,0,0],16);
    const profile=[[0,0],[radius*.35,.035],[radius*.72,.17],[radius,.43]].map(p=>new T.Vector2(...p));
    K.mesh(g,new T.LatheGeometry(profile,32),'hull',[0,.85,0]);collar(K,g,'silver',radius,1.28,.035);
    for(let i=0;i<3;i++){const a=i*TAU/3;K.beam(g,'silver',[Math.sin(a)*radius*.9,1.23,Math.cos(a)*radius*.9],[0,1.9,0],.045);}
    K.sphere(g,'graphite',.11,[0,1.9,0]);
  }

  function radiator(K,parent,{width=3.2,length=4,position=[0,0,0],rotation=[0,0,0]}={}){
    const g=K.group(parent,position,rotation);
    K.box(g,'silver',[width,.12,length],[0,0,0]);
    for(let i=0;i<8;i++)K.box(g,'hull',[width/8-.035,.06,length-.16],[-width/2+(i+.5)*width/8,.1,0]);
    for(const z of [-length*.43,length*.43])K.box(g,'graphite',[width-.1,.035,.045],[0,.15,z]);
    return g;
  }

  window.StationConcepts.push({
    id:'tianji',index:'07',name:'天枢',subtitle:'T 形核心科研站',category:'舱体组合',
    description:'指令、生活与货运舱沿短中轴直接对接，两侧实验舱在前端形成紧凑的 T 形。太阳翼从实验舱端部成对展开，保留现役空间站清楚、可信的舱体比例。',
    features:['短舱直接对接','T 形实验舱群','舱端成对太阳翼'],view:[1,.82,1.1],
    build(K){
      const root=new T.Group();root.name='Tianji · T Plan Research Station';
      // The central stack terminates in a short transfer hub; all collars touch.
      module(K,root,{radius:2.15,length:4.2,position:[0,0,3.4],rotation:[Math.PI/2,0,0],windows:true});
      module(K,root,{radius:1.95,length:7,position:[0,0,-2.45],rotation:[Math.PI/2,0,0],windows:true});
      module(K,root,{radius:1.68,length:5.0,position:[0,0,-8.72],rotation:[Math.PI/2,0,0]});
      module(K,root,{radius:1.55,length:5.7,position:[0,0,-14.30],rotation:[Math.PI/2,0,0],insulated:true});
      for(const sign of [-1,1]){
        // The inboard docking cone is buried into the transfer node's pressure shell.
        module(K,root,{radius:1.7,length:9.4,position:[sign*6.55,0,3.4],rotation:[0,0,-sign*Math.PI/2],windows:sign>0,insulated:sign<0});
        K.cylinder(root,'silver',1.2,1.2,.55,[sign*1.95,0,3.4],[0,0,Math.PI/2],32);
        K.box(root,'gold',[1.0,.52,1.9],[sign*9.1,1.6,3.4]);
        // Solar hinges and short mounting forks sit on the outer laboratory end.
        const pivotX=sign*12.7;
        K.beam(root,'silver',[sign*10.7,0,3.4],[pivotX,0,3.4],.28);
        K.cylinder(root,'graphite',.34,.34,1.8,[pivotX,0,3.4],[Math.PI/2,0,0],24);
        for(const forward of [-1,1]){
          K.beam(root,'silver',[pivotX,0,3.4],[pivotX,.45,3.4+forward*9.1],.17);
          K.solar(root,{width:7.9,height:15.3,position:[pivotX,.45,3.4+forward*9.1],rotation:[-Math.PI/2,0,0],cols:4,rows:12});
          K.box(root,'gold',[.65,.32,.8],[pivotX,.17,3.4+forward*1.3]);
        }
        // Compact radiators on the science modules remain inside the solar envelope.
        K.beam(root,'silver',[sign*5.3,1.15,3.4],[sign*5.3,2.25,.2],.16);
        radiator(K,root,{width:3.6,length:3.9,position:[sign*5.3,2.25,.2]});
        K.beam(root,'silver',[sign*1.1,0,-14.1],[sign*3.8,.3,-14.1],.17);
        K.solar(root,{width:4.8,height:4.5,position:[sign*4.8,.3,-14.1],rotation:[-Math.PI/2,0,0],cols:3,rows:5});
      }
      // A small nadir airlock and cupola complete the recognizable station profile.
      module(K,root,{radius:1.03,length:2.5,position:[0,-2.25,3.4],windows:false});
      K.cylinder(root,'silver',.83,1.1,.8,[0,2.22,3.8],[0,0,0],8);
      K.cylinder(root,'glass',.72,.83,.52,[0,2.86,3.8],[0,0,0],8);
      collar(K,root,'hull',.75,3.16,.07).position.z=3.8;
      dish(K,root,[1.1,1.7,-3.4],[0,0,-.35],.72);
      K.box(root,'gold',[1.1,.42,1.6],[-1.2,1.85,-3.5]);
      root.scale.setScalar(1.2);
      return root;
    }
  },{
    id:'linkstar',index:'08',name:'联星',subtitle:'双列 H 形实验站',category:'舱体组合',
    description:'两列平行的圆筒舱把实验与生活组织成紧凑双轴，中央由宽厚横舱连接。两侧太阳翼和顶部散热器排列规整，强调扩展型科研基地的整体性。',
    features:['平行双舱列','宽体横向连接舱','外侧对称太阳翼'],view:[1,.92,1.35],
    build(K){
      const root=new T.Group();root.name='Linkstar · Parallel Laboratory Station';
      for(const sign of [-1,1]){
        const x=sign*5.3;
        module(K,root,{radius:2.0,length:9.4,position:[x,0,0],rotation:[Math.PI/2,0,0],windows:true});
        module(K,root,{radius:1.73,length:5.2,position:[x,0,7.55],rotation:[Math.PI/2,0,0],windows:sign<0});
        module(K,root,{radius:1.65,length:6.1,position:[x,0,-8.02],rotation:[Math.PI/2,0,0],insulated:true});
        // Two broad wings per hull row, mounted on the outer side only.
        for(const z of [-5.4,5.4]){
          K.beam(root,'silver',[x+sign*1.3,.15,z],[sign*17.0,.65,z],.22);
          for(const zz of [-.75,.75])K.beam(root,'silver',[x+sign*1.25,.1,z+zz],[sign*10,.65,z+zz],.12);
          K.cylinder(root,'graphite',.36,.36,1.1,[sign*8.2,.65,z],[0,0,Math.PI/2],24);
          K.solar(root,{width:15.4,height:6.2,position:[sign*17.0,.65,z],rotation:[-Math.PI/2,0,0],cols:10,rows:4});
        }
        // Radiator rafts are held close above the pressure hulls, keeping a clean silhouette.
        for(const z of [-3.1,3.1]){
          for(const dx of [-1,1])K.beam(root,'silver',[x+dx*.8,1.65,z],[x+dx*1.1,2.8,z],.13);
          radiator(K,root,{width:3.9,length:3.9,position:[x,2.85,z]});
        }
        dish(K,root,[x,1.72,7.2],[0,0,sign*.3],.68);
        K.box(root,'gold',[1.25,.42,1.7],[x,1.75,-8.4]);
        K.box(root,'graphite',[.8,.35,1.4],[x+sign*1.2,1.64,0]);
      }
      // A habitable cross-module fills the gap between the two columns.
      module(K,root,{radius:1.68,length:7.3,position:[0,0,0],rotation:[0,0,Math.PI/2],windows:true});
      for(const sign of [-1,1])K.cylinder(root,'silver',1.25,1.25,.45,[sign*3.65,0,0],[0,0,Math.PI/2],32);
      // The observation cupola sits directly over the transverse transfer cabin.
      K.cylinder(root,'silver',.92,1.22,1.0,[0,1.96,0],[0,0,0],8);
      K.cylinder(root,'glass',.83,.94,.68,[0,2.72,0],[0,0,0],8);
      collar(K,root,'hull',.85,3.1,.075);
      for(let i=0;i<8;i++){const a=i*TAU/8;K.beam(root,'hull',[Math.sin(a)*.93,2.4,Math.cos(a)*.93],[Math.sin(a)*.83,3.1,Math.cos(a)*.83],.055);}
      // Four low diagonal braces reinforce the cross-node without adding distant modules.
      for(const sign of [-1,1])for(const z of [-1,1])K.beam(root,'silver',[sign*.6,-1.1,z*.7],[sign*4.0,-1.3,z*2.6],.18);
      return root;
    }
  });
})();
