/* Conventional station studies with deliberately unequal lengths and docking positions. */
(() => {
  'use strict';
  const T=THREE,TAU=Math.PI*2;
  window.StationConcepts=window.StationConcepts||[];
  function ring(K,g,mat,r,y,t=.06){return K.mesh(g,new T.TorusGeometry(r,t,6,48),mat,[0,y,0],[Math.PI/2,0,0]);}
  function dock(K,g,r,y){
    K.cylinder(g,'silver',r,r,.24,[0,y,0],[0,0,0],32);
    K.cylinder(g,'graphite',r*.83,r*.83,.27,[0,y,0],[0,0,0],24);
    for(const sign of [-1,1])ring(K,g,'hull',r*.91,y+sign*.17,.07);
    for(let i=0;i<8;i++){const a=i*TAU/8;K.box(g,'silver',[.12,.31,.09],[Math.sin(a)*r*.95,y,Math.cos(a)*r*.95],[0,a,0]);}
  }
  function body(K,parent,{r=1.7,l=7,pos=[0,0,0],rot=[Math.PI/2,0,0],windows=false,gold=false,ribbed=false}={}){
    const g=K.group(parent,pos,rot),h=l/2,shoulder=Math.min(r*.6,l*.22),points=[[0,-h],[r*.57,-h],[r*.57,-h+.18],[r*.8,-h+.38],[r,-h+shoulder],[r,h-shoulder],[r*.8,h-.38],[r*.57,h-.18],[r*.57,h],[0,h]].map(v=>new T.Vector2(...v));
    K.mesh(g,new T.LatheGeometry(points,48),'hull');
    for(const sign of [-1,1])dock(K,g,r*.64,sign*(h+.05));
    for(const y of [-h+shoulder+.12,0,h-shoulder-.12])ring(K,g,'silver',r+.025,y,.045);
    if(gold){K.cylinder(g,'gold',r+.025,r+.025,l*.21,[0,-l*.19,0],[0,0,0],48);for(let i=0;i<16;i++){const a=i*TAU/16;K.box(g,'silver',[.025,l*.21,.025],[Math.sin(a)*(r+.05),-l*.19,Math.cos(a)*(r+.05)],[0,a,0]);}}
    if(ribbed)for(let y=-h+shoulder+.25;y<h-shoulder-.1;y+=.34)ring(K,g,'silver',r+.018,y,.025);
    for(let i=0;i<8;i++){
      const side=K.group(g,[0,0,0],[0,i*TAU/8,0]);
      K.box(side,'silver',[.035,l*.54,.04],[0,0,r+.025]);
      for(const y of [-l*.16,l*.16]){
        K.box(side,'hull',[r*.54,l*.15,.07],[0,y,r+.035]);
        K.box(side,'graphite',[r*.36,.055,.08],[0,y+l*.047,r+.07]);
        for(const x of [-1,1])K.box(side,'silver',[.035,.05,.035],[x*r*.22,y-l*.043,r+.085]);
      }
      if(windows&&i%2===0){K.box(side,'graphite',[.51,.55,.065],[0,.06,r+.09]);K.box(side,'glass',[.36,.37,.085],[0,.06,r+.13]);}
      if(i%2===0)K.box(side,'blue',[r*.65,.2,.055],[0,h-shoulder-.45,r+.035]);
    }
    return g;
  }
  function panelPair(K,parent,{pivot,width=5.6,height=10,vertical=false}={}){
    const [x,y,z]=pivot;
    // The photovoltaic blankets use two opposed short hinge forks, not distant booms.
    K.cylinder(parent,'graphite',.26,.26,1.15,pivot,vertical?[0,0,0]:[Math.PI/2,0,0],24);
    for(const sign of [-1,1]){
      const pos=vertical?[x,y+sign*(height/2+1.15),z]:[x,y,z+sign*(height/2+1.15)];
      const neck=vertical?[x,y+sign*1.25,z]:[x,y,z+sign*1.25];
      K.beam(parent,'silver',pivot,neck,.17);
      K.solar(parent,{width,height,position:pos,rotation:vertical?[0,0,0]:[-Math.PI/2,0,0],cols:3,rows:8});
      for(const side of [-1,1])K.beam(parent,'silver',[x+side*.65,y,z],vertical?[x+side*width*.28,y+sign*1.25,z]:[x+side*width*.28,y,z+sign*1.25],.09);
    }
  }
  function radiator(K,parent,x,y,z,w=3.0,d=4.0){
    K.box(parent,'silver',[w,.13,d],[x,y,z]);
    for(let i=0;i<8;i++)K.box(parent,'hull',[w/8-.025,.04,d-.14],[x-w/2+w*(i+.5)/8,y+.095,z]);
    for(const side of [-1,1])K.beam(parent,'silver',[x+side*.6,y-1.15,z],[x+side*w*.4,y-.1,z],.1);
  }
  function dish(K,parent,pos,rot=[0,0,0]){
    const g=K.group(parent,pos,rot);K.cylinder(g,'silver',.07,.13,.8,[0,.4,0],[0,0,0],16);
    K.mesh(g,new T.LatheGeometry([[0,0],[.3,.04],[.65,.18],[.85,.42]].map(p=>new T.Vector2(...p)),32),'hull',[0,.8,0]);
    ring(K,g,'silver',.85,1.22,.025);
    for(let i=0;i<3;i++){const a=i*TAU/3;K.beam(g,'silver',[Math.sin(a)*.76,1.17,Math.cos(a)*.76],[0,1.72,0],.035);}K.sphere(g,'graphite',.1,[0,1.72,0]);
  }

  window.StationConcepts.push({
    id:'meridian',index:'10',name:'子午',subtitle:'长短臂十字站',category:'常规变体',
    description:'多向节点汇集长实验舱、短粗服务舱与下挂飞船。主轴前长后短，支臂粗细不一；水平与竖直太阳翼共同勾勒紧凑、常规的十字站轮廓。',
    features:['长短臂比例 3∶1','多向直接对接','横竖双向太阳翼'],view:[1,.72,1.18],
    build(K){
      const root=new T.Group();root.name='Meridian · Unequal Arm Orbital Station';
      body(K,root,{r:2.25,l:4.5,pos:[0,0,0],windows:true});
      // An extended front spine steps down twice, while the aft section stays short.
      body(K,root,{r:2.05,l:10.2,pos:[0,0,7.60],windows:true});
      body(K,root,{r:1.32,l:5.0,pos:[0,0,15.47],gold:true});
      body(K,root,{r:1.65,l:5.3,pos:[0,0,-5.18],ribbed:true});
      // The side ports meet the hub surface, with radically different arm lengths.
      body(K,root,{r:1.78,l:11.8,pos:[-8.0,0,0],rot:[0,0,Math.PI/2],ribbed:true});
      body(K,root,{r:2.12,l:4.2,pos:[4.18,0,0],rot:[0,0,Math.PI/2],gold:true,windows:true});
      for(const sign of [-1,1])K.cylinder(root,'silver',1.18,1.18,.48,[sign*2.05,0,0],[0,0,Math.PI/2],32);
      // Vertical satellites are still attached by short conventional collars.
      body(K,root,{r:1.12,l:2.35,pos:[0,3.35,0],rot:[0,0,0],windows:true});
      body(K,root,{r:1.24,l:3.5,pos:[0,-3.91,0],rot:[0,0,0]});
      body(K,root,{r:1.75,l:4.6,pos:[0,-8.24,0],rot:[0,0,0],gold:true,ribbed:true});
      K.cylinder(root,'graphite',1.1,1.1,.4,[0,-10.64,0],[0,0,0],32);
      for(let i=0;i<4;i++){const a=i*TAU/4;K.cylinder(root,'graphite',.23,.32,.42,[Math.sin(a)*.72,-10.98,Math.cos(a)*.72],[0,0,0],16);}
      // One upright array at the long laboratory tip; one horizontal pair aft.
      K.beam(root,'silver',[-13.8,0,0],[-17.7,0,0],.24);
      panelPair(K,root,{pivot:[-17.7,0,0],width:5.8,height:11.4,vertical:true});
      K.beam(root,'silver',[6.2,0,0],[9.4,0,0],.24);
      panelPair(K,root,{pivot:[9.4,0,0],width:4.5,height:7.7,vertical:false});
      for(const sign of [-1,1]){
        K.beam(root,'silver',[sign*1.3,0,14.7],[sign*4.0,.15,14.7],.17);
        K.solar(root,{width:4.8,height:4.2,position:[sign*4.25,.15,14.7],rotation:[-Math.PI/2,0,0],cols:3,rows:5});
        K.beam(root,'silver',[sign*1.3,-8.2,0],[sign*3.7,-8.2,0],.16);
        K.solar(root,{width:3.5,height:2.1,position:[sign*3.8,-8.2,0],rotation:[-Math.PI/2,0,0],cols:3,rows:3});
      }
      radiator(K,root,0,3.15,7.6,3.4,3.5);dish(K,root,[1.35,1.7,5.1],[0,0,-.3]);
      K.box(root,'gold',[1.25,.45,1.5],[-1.35,1.85,4.2]);
      root.scale.setScalar(1.18);return root;
    }
  },{
    id:'offset',index:'11',name:'错星',subtitle:'错位双支舱站',category:'常规变体',
    description:'三段主舱沿长轴串联，左侧长实验舱与右侧短服务舱在不同位置对接。前后错开的支臂、局部上置节点与两种太阳翼朝向，形成清晰的非对称组合。',
    features:['前后错位支臂','长短粗细变化','连续三段主舱'],view:[1,.84,1.28],
    build(K){
      const root=new T.Group();root.name='Offset · Staggered Laboratory Station';
      body(K,root,{r:2.08,l:9.4,pos:[0,0,0],windows:true});
      body(K,root,{r:1.78,l:7.2,pos:[0,0,8.57],windows:true});
      body(K,root,{r:1.46,l:6.3,pos:[0,0,-8.12],gold:true,ribbed:true});
      // The large left branch meets the forward module; the short right branch
      // uses a separate rear port, making the stagger apparent in plan view.
      body(K,root,{r:1.9,l:12.0,pos:[-7.95,0,5.55],rot:[0,0,Math.PI/2],windows:true});
      body(K,root,{r:1.42,l:5.05,pos:[4.49,0,-4.0],rot:[0,0,Math.PI/2],ribbed:true});
      K.cylinder(root,'silver',1.25,1.25,.6,[-1.75,0,5.55],[0,0,Math.PI/2],32);
      K.cylinder(root,'silver',.98,.98,.56,[1.95,0,-4],[0,0,Math.PI/2],32);
      body(K,root,{r:1.0,l:3.15,pos:[0,3.58,-1.9],rot:[0,0,0],windows:true});
      K.cylinder(root,'silver',.73,1.0,.65,[0,5.56,-1.9],[0,0,0],24);
      dock(K,K.group(root,[0,5.97,-1.9]),.72,0);
      // Two large horizontal blankets on the long laboratory and smaller,
      // upright blankets on the short branch deliberately use different scales.
      K.beam(root,'silver',[-13.8,0,5.55],[-17.85,.35,5.55],.24);
      panelPair(K,root,{pivot:[-17.85,.35,5.55],width:6.6,height:12.1,vertical:false});
      K.beam(root,'silver',[6.9,0,-4.0],[10.0,0,-4.0],.2);
      panelPair(K,root,{pivot:[10.0,0,-4.0],width:4.1,height:6.75,vertical:true});
      // Small cargo panels remain attached to the narrow aft section.
      for(const side of [-1,1]){
        K.beam(root,'silver',[side*1.0,0,-8.5],[side*4.5,.1,-8.5],.15);
        K.solar(root,{width:5.1,height:3.9,position:[side*4.35,.1,-8.5],rotation:[-Math.PI/2,0,0],cols:4,rows:4});
      }
      radiator(K,root,-5.3,3.05,5.55,4.2,3.0);
      radiator(K,root,0,2.96,7.2,3.0,3.3);
      dish(K,root,[1.4,1.7,1.7],[0,0,-.3]);
      K.box(root,'gold',[1.1,.4,1.7],[1.0,1.85,-.3]);
      K.box(root,'graphite',[.8,.25,1.05],[-1.28,1.72,-3.2]);
      root.scale.setScalar(1.18);return root;
    }
  });
})();
