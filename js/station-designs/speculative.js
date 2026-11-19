/* Three complete speculative station shells. All dimensions are concept-model units. */
(() => {
  'use strict';
  const T=THREE,TAU=Math.PI*2;
  window.StationConcepts??=[];

  function arcPanel(K,parent,material,inner,outer,start,end,y,thickness=.6){
    const shape=new T.Shape();shape.absarc(0,0,outer,start,end,false);shape.absarc(0,0,inner,end,start,true);shape.closePath();
    const geometry=new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,bevelSize:.07,bevelThickness:.05,bevelSegments:1,curveSegments:12,steps:1});
    return K.mesh(parent,geometry,material,[0,y,0],[Math.PI/2,0,0]);
  }
  function radialWindows(K,parent,radius,y,count=48,width=.42,height=.24){
    for(let i=0;i<count;i++){
      const a=i/count*TAU,g=K.group(parent,[Math.sin(a)*radius,y,Math.cos(a)*radius],[0,a,0]);
      K.box(g,'graphite',[width+.16,height+.15,.1],[0,0,0]);K.box(g,i%7===0?'warmLight':'light',[width,height,.035],[0,0,.062]);
    }
  }
  function taperedWing(K,parent){
    const silhouette=new T.Shape();silhouette.moveTo(4.4,17.8);silhouette.bezierCurveTo(8,15.8,14,11.5,20.8,3.5);silhouette.lineTo(22,-2.8);silhouette.bezierCurveTo(15.8,-7.2,9.8,-13.7,4.4,-19);silhouette.closePath();
    const body=new T.ExtrudeGeometry(silhouette,{depth:1.25,bevelEnabled:true,bevelSize:.22,bevelThickness:.18,bevelSegments:2,curveSegments:16});
    K.mesh(parent,body,'hull',[0,0,-.625]);
    const inset=new T.Shape();inset.moveTo(6.1,13.8);inset.bezierCurveTo(10,11.7,15.2,7.8,19.5,2.3);inset.lineTo(20,-1.8);inset.bezierCurveTo(15.2,-5.4,10.3,-10.2,6.1,-14.5);inset.closePath();
    const panel=new T.ExtrudeGeometry(inset,{depth:.08,bevelEnabled:false,curveSegments:16});
    K.mesh(parent,panel,'graphite',[0,0,.84]);K.mesh(parent,panel,'graphite',[0,0,-.92]);
    // Radiator ribs follow the widening shield, and always terminate on its body.
    for(let x=7;x<19.3;x+=.9){const top=13.6-(x-6)*.8,bottom=-14.2+(x-6)*.92;K.box(parent,'silver',[.12,top-bottom,.10],[x,(top+bottom)/2,.96]);K.box(parent,'silver',[.12,top-bottom,.10],[x,(top+bottom)/2,-.96]);}
    K.beam(parent,'gold',[5.7,14.2,1.02],[19.4,1.8,1.02],.19,.12);K.beam(parent,'gold',[5.7,-14.3,1.02],[19.7,-2.1,1.02],.19,.12);
    K.box(parent,'orange',[1.2,.35,1.55],[5.3,11.5,0]);K.box(parent,'orange',[1.2,.35,1.55],[5.3,-11.5,0]);
  }
  function petalShape(inset=0){
    const shape=new T.Shape(),s=1-inset;
    shape.moveTo(5.0,0);shape.bezierCurveTo(8,-4.8*s,17,-5.8*s,25.5,-3.0*s);shape.bezierCurveTo(28,-2.2*s,29.2,-.7*s,29.5,0);shape.bezierCurveTo(27.5,3.4*s,23,5.7*s,17,5.3*s);shape.bezierCurveTo(10,4.9*s,6.3,2.6*s,5,0);shape.closePath();return shape;
  }
  function petal(K,parent,index){
    const base=new T.ExtrudeGeometry(petalShape(),{depth:1.8,bevelEnabled:true,bevelSize:.28,bevelThickness:.28,bevelSegments:3,curveSegments:24});
    K.mesh(parent,base,'hull',[0,1,0],[Math.PI/2,0,0]);
    const underside=new T.ExtrudeGeometry(petalShape(.05),{depth:.32,bevelEnabled:true,bevelSize:.12,bevelThickness:.12,bevelSegments:1,curveSegments:24});
    K.mesh(parent,underside,'graphite',[0,-.9,0],[Math.PI/2,0,0]);
    // A continuous inset spine and ordered equipment bays sit within the thick petal.
    const spine=new T.Shape();spine.moveTo(7.6,-.8);spine.bezierCurveTo(14,-1.2,22.5,-1.0,27.6,0);spine.bezierCurveTo(21.5,1.4,14.2,1.7,7.6,.8);spine.closePath();
    K.mesh(parent,new T.ExtrudeGeometry(spine,{depth:.18,bevelEnabled:true,bevelSize:.08,bevelThickness:.06,bevelSegments:1,curveSegments:20}),'blue',[0,1.34,0],[Math.PI/2,0,0]);
    for(let j=0;j<6;j++){
      const x=9+j*2.8,width=2.35*(1-j*.04),z=2.6+Math.sin(j*.6)*.3;
      for(const side of [-1,1]){K.box(parent,'silver',[width,.11,1.08],[x,1.33,side*z],[0,side*-.04,0]);K.box(parent,'glass',[width-.18,.07,.85],[x,1.42,side*z]);for(let k=0;k<3;k++)K.box(parent,'graphite',[.045,.04,.83],[x-width*.27+k*width*.27,1.48,side*z]);}
    }
    for(let j=0;j<11;j++){const x=9+j*1.5,z=4.6-Math.pow((x-17)/10,2)*1.9;K.box(parent,j%4?'light':'warmLight',[.58,.12,.12],[x,1.08,z]);}
    K.cylinder(parent,'graphite',1.3,1.65,.6,[11,1.6,0]);K.cylinder(parent,'hull',1.15,1.3,.35,[11,2.05,0]);
    K.sphere(parent,'glass',1.08,[11,2.24,0],[1,.32,1]);
    K.box(parent,'gold',[1,.18,.8],[24.5,1.55,0]);
    if(index%2===0)K.cylinder(parent,'silver',.16,.28,1.5,[24.5,2.3,0]);
  }

  window.StationConcepts.push({
    id:'spindle',index:'04',name:'穹脊',subtitle:'轴向星际中继站',category:'科幻',
    description:'沿一根竖向核心层层收束。盾形散热翼、环状驻留层与尖顶天线共同形成清晰的塔式剪影。',
    features:['轴向阶梯核心','四片盾形散热翼','分层环形驻留区'],view:[1.05,.48,1.35],
    build(K){
      const root=new T.Group();root.name='穹脊 · 轴向星际中继站';
      K.cylinder(root,'graphite',3.4,4.2,42,[0,0,0]);
      K.cylinder(root,'hull',2.2,3.4,9,[0,24,0]);K.cylinder(root,'silver',.35,2.2,8,[0,32.5,0]);K.cylinder(root,'gold',.08,.35,4,[0,38.4,0]);
      K.cylinder(root,'hull',4.2,2.4,7,[0,-24.5,0]);K.cylinder(root,'graphite',2.4,1.2,5,[0,-30.5,0]);K.cylinder(root,'silver',1.25,.4,3,[0,-34.5,0]);
      for(let i=0;i<12;i++){
        const a=i/12*TAU,g=K.group(root,[Math.sin(a)*3.8,0,Math.cos(a)*3.8],[0,a,0]);
        K.box(g,'hull',[1.25,38,.32],[0,0,0]);K.box(g,'gold',[.15,34,.12],[.5,0,.24]);
        for(const y of [-15,-8,8,15])K.box(g,'graphite',[.75,1.4,.1],[0,y,.23]);
      }
      for(const [y,r,h] of [[-18,6.3,2.0],[-9,9.2,3.4],[1,12.2,4.4],[12,8.1,3],[21,5.4,2]]){
        K.cylinder(root,'graphite',r-.4,r-.4,h,[0,y,0],undefined,64);
        K.cylinder(root,'hull',r,r+.6,.75,[0,y-h/2,0],undefined,64);K.cylinder(root,'hull',r-.25,r,.65,[0,y+h/2,0],undefined,64);
        K.torus(root,'silver',r-.1,.16,[0,y+h*.28,0]);K.torus(root,'gold',r-.06,.08,[0,y-h*.24,0]);radialWindows(K,root,r-.34,y,Math.round(r*5),.55,.42);
        for(let i=0;i<12;i++){const a=i/12*TAU;arcPanel(K,root,'hull',4.15,r-.25,a+.018,a+TAU/12-.018,y+h/2+.28,.24);}
      }
      // Four shields join the center body along their entire inner edge.
      for(let i=0;i<4;i++)taperedWing(K,K.group(root,[0,0,0],[0,i*Math.PI/2+Math.PI/4,0]));
      for(let i=0;i<4;i++){
        const a=i*Math.PI/2,g=K.group(root,[Math.sin(a)*5.4,22,Math.cos(a)*5.4],[0,a,0]);
        K.cylinder(g,'silver',.5,.5,2,[0,0,0]);K.sphere(g,'hull',1.2,[0,1.3,0],[1,.36,1]);K.torus(g,'graphite',.95,.07,[0,1.4,0]);
      }
      return root;
    }
  },{
    id:'crown',index:'05',name:'星冕',subtitle:'六瓣轨道枢纽',category:'科幻',
    description:'六片连续的曲面建筑围绕中央穹顶展开。宽阔、低伏的花冠轮廓，适合表现轨道城市与公共枢纽。',
    features:['六瓣曲线厚壳','中央观景穹顶','嵌入式设备与灯窗'],view:[1.05,1.2,1.3],
    build(K){
      const root=new T.Group();root.name='星冕 · 六瓣轨道枢纽';
      K.cylinder(root,'graphite',7.9,7.0,4.4,[0,-.5,0],undefined,64);K.cylinder(root,'hull',7.9,8.7,.8,[0,1.8,0],undefined,64);
      K.torus(root,'gold',7.8,.16,[0,2.35,0]);K.cylinder(root,'silver',5.7,7.7,1.2,[0,2.8,0],undefined,64);
      K.sphere(root,'glass',5.9,[0,3.1,0],[1,.48,1]);
      // Dome ribs hold a readable segmented surface above the central hall.
      for(let i=0;i<12;i++){
        const a=i/12*TAU,points=[];for(let j=0;j<=16;j++){const t=j/16*Math.PI/2,r=5.95*Math.sin(t);points.push(new T.Vector3(Math.cos(a)*r,3.1+2.86*Math.cos(t),Math.sin(a)*r));}
        K.mesh(root,new T.TubeGeometry(new T.CatmullRomCurve3(points),20,.075,6,false),'silver');
      }
      radialWindows(K,root,7.86,.2,48,.65,.65);
      for(let i=0;i<6;i++)petal(K,K.group(root,[0,0,0],[0,i*TAU/6,0]),i);
      for(let i=0;i<6;i++){
        const a=(i+.5)*TAU/6,g=K.group(root,[0,0,0],[0,a,0]);
        K.box(g,'graphite',[4.6,1.4,2.5],[9.2,-1.2,0]);K.box(g,'hull',[4.9,.4,2.8],[9.2,-.3,0]);
        K.cylinder(g,'silver',.8,.8,2.2,[11.5,-1.2,0],[0,0,-Math.PI/2]);K.torus(g,'gold',.72,.12,[12.7,-1.2,0],[0,Math.PI/2,0]);
      }
      K.cylinder(root,'silver',5.4,3.4,3.2,[0,-4.1,0],undefined,48);K.cylinder(root,'graphite',2.6,2.6,3.4,[0,-7.2,0]);K.torus(root,'hull',2.6,.38,[0,-8.6,0]);
      return root;
    }
  },{
    id:'ark',index:'06',name:'方舟',subtitle:'旋转殖民地',category:'远未来',
    description:'以奥尼尔圆柱为原型的长期居住巨构。纵向玻璃带与装甲带交替，三组外置反射镜围合成完整的殖民地外壳。',
    features:['连续圆柱居住体','三组纵向玻璃带','外置采光反射镜'],view:[1.15,.72,1.3],
    build(K){
      const root=new T.Group();root.name='方舟 · 旋转殖民地';const body=K.group(root,[0,0,0],[0,0,Math.PI/2]);
      K.cylinder(body,'graphite',8,8,40,[0,0,0],undefined,72);
      for(let i=0;i<6;i++){
        const a=i*TAU/6,glass=i%2===1;
        K.mesh(body,new T.CylinderGeometry(8.12,8.12,37,24,1,true,a+.018,TAU/6-.036),glass?'glass':'hull');
        for(let j=0;j<2;j++){
          const edge=a+(j?TAU/6-.02:.02),x=Math.sin(edge)*8.2,z=Math.cos(edge)*8.2;
          K.box(K.group(body,[x,0,z],[0,edge,0]),'silver',[.22,38,.20],[0,0,0]);
        }
        if(glass){
          for(let j=0;j<4;j++){const theta=a+.16+j*.24;K.box(K.group(body,[Math.sin(theta)*8.18,0,Math.cos(theta)*8.18],[0,theta,0]),'silver',[.07,36,.08],[0,0,0]);}
          for(let y=-16;y<=16;y+=4)K.mesh(body,new T.CylinderGeometry(8.23,8.23,.13,18,1,true,a+.025,TAU/6-.05),'silver',[0,y,0]);
        }else{
          for(let y=-15;y<=15;y+=6){K.mesh(body,new T.CylinderGeometry(8.19,8.19,.08,18,1,true,a+.03,TAU/6-.06),'graphite',[0,y,0]);const theta=a+TAU/12,g=K.group(body,[Math.sin(theta)*8.24,y,Math.cos(theta)*8.24],[0,theta,0]);K.box(g,'blue',[1.0,2.2,.12],[0,0,0]);K.box(g,'gold',[.1,1.9,.08],[.65,0,0]);}
        }
      }
      for(const end of [-1,1]){
        const y=end*20.5;
        K.cylinder(body,'hull',8.65,8.65,2.2,[0,y,0],undefined,72);K.torus(body,'graphite',8.55,.28,[0,y+end*.85,0]);K.torus(body,'silver',8.68,.14,[0,y-end*.7,0]);
        K.cylinder(body,'silver',end>0?3.5:8.4,end>0?8.4:3.5,3.7,[0,y+end*2.9,0],undefined,72);
        K.cylinder(body,'hull',2.8,2.8,4.0,[0,y+end*6.0,0]);K.torus(body,'gold',2.8,.18,[0,y+end*7.6,0]);K.cylinder(body,'graphite',2.15,2.15,.45,[0,y+end*8.2,0]);
        for(let i=0;i<18;i++){const a=i/18*TAU;K.beam(body,'hull',[Math.sin(a)*3.55,y+end*4.8,Math.cos(a)*3.55],[Math.sin(a)*8.45,y+end*.7,Math.cos(a)*8.45],.21,.18);}
        radialWindows(K,body,8.7,y,60,.45,.36);
      }
      for(let i=0;i<3;i++){
        const a=(i*2+1)*TAU/6+TAU/12,g=K.group(body,[0,0,0],[0,a,0]),mirror=K.group(g,[0,0,16.4],[0,.12,0]);
        K.box(mirror,'graphite',[9.4,35.4,.42],[0,0,0]);K.box(mirror,'silver',[9.1,35.1,.15],[0,0,.31]);
        for(let x=-3.5;x<=3.5;x+=1.75)for(let y=-15;y<=15;y+=3.75){K.box(mirror,'glass',[1.65,3.60,.04],[x,y,.42]);K.box(mirror,'silver',[.045,3.60,.03],[x,y,.455]);}
        for(const x of [-4.65,4.65])K.box(mirror,'hull',[.22,35.6,.55],[x,0,0]);
        for(const y of [-17.7,17.7])K.box(mirror,'hull',[9.4,.24,.55],[0,y,0]);
        for(const y of [-15,15]){
          K.beam(g,'hull',[-3.8,y,7.0],[-3.8,y,16.2],.6,.5);K.beam(g,'hull',[3.8,y,7.0],[3.8,y,16.2],.6,.5);
          K.beam(g,'silver',[-3.8,y-Math.sign(y)*3,7.5],[-3.8,y,16.2],.22,.22);K.beam(g,'silver',[3.8,y-Math.sign(y)*3,7.5],[3.8,y,16.2],.22,.22);
          K.box(g,'gold',[1.1,.9,.9],[-3.8,y,15.8]);K.box(g,'gold',[1.1,.9,.9],[3.8,y,15.8]);
        }
      }
      return root;
    }
  });
})();
