/* Realistic hardware and effects for live station events: procedural foil,
   solar-cell and panel textures, soft particles, thruster plumes, the core
   module manipulator, a defunct satellite, a cargo spacecraft, debris and a
   free-flying service robot. Builders register geometry and materials on the
   owning event so its dispose() releases them; textures are shared. */
(() => {
  'use strict';
  const C=window.CoScene=window.CoScene||{},T=THREE,TAU=Math.PI*2,V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
  const clamp=T.MathUtils.clamp,smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
  // Deterministic noise so tick(seconds) jumps and replays look identical.
  const rand=seed=>{let s=(Math.floor(seed*9973)^0x9e3779b9)>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};};
  const textures=new Map();
  function canvas(size,draw){const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');draw(g,size);return c;}
  function texture(name){
    if(textures.has(name))return textures.get(name);
    const r=rand(name.length*31+7);let c;
    if(name==='mli-gold'||name==='mli-silver'){
      const gold=name==='mli-gold';
      c=canvas(512,(g,n)=>{g.fillStyle=gold?'#b98a33':'#b9c0c6';g.fillRect(0,0,n,n);
        // Crinkled multi-layer insulation: many soft creases at random angles.
        for(let i=0;i<900;i++){const x=r()*n,y=r()*n,a=r()*TAU,l=8+r()*46,w=1+r()*3,light=r()>.5;
          g.strokeStyle=gold?(light?`rgba(255,226,140,${.12+r()*.25})`:`rgba(70,40,0,${.12+r()*.25})`):(light?`rgba(255,255,255,${.12+r()*.3})`:`rgba(40,48,60,${.1+r()*.22})`);
          g.lineWidth=w;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+Math.cos(a+.6)*l*.5,y+Math.sin(a+.6)*l*.5,x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();}
        g.strokeStyle=gold?'rgba(60,38,6,.55)':'rgba(50,60,70,.5)';g.lineWidth=2;for(const p of [n*.33,n*.66]){g.beginPath();g.moveTo(p,0);g.lineTo(p+r()*6-3,n);g.stroke();}
        g.fillStyle=gold?'rgba(70,45,10,.6)':'rgba(60,70,80,.6)';for(let i=0;i<40;i++){g.beginPath();g.arc(r()*n,r()*n,1.6,0,TAU);g.fill();}});
    }else if(name==='solar'){
      c=canvas(512,(g,n)=>{g.fillStyle='#9aa4ad';g.fillRect(0,0,n,n);const cells=8,s=n/cells;
        for(let i=0;i<cells;i++)for(let j=0;j<cells;j++){const x=i*s+3,y=j*s+3,w=s-6;const grad=g.createLinearGradient(x,y,x+w,y+w);const tone=r()*.08;grad.addColorStop(0,`rgb(${18+tone*120|0},${34+tone*120|0},${78+tone*160|0})`);grad.addColorStop(1,`rgb(${10+tone*80|0},${20+tone*90|0},${52+tone*120|0})`);g.fillStyle=grad;g.fillRect(x,y,w,w);
          g.strokeStyle='rgba(200,210,225,.35)';g.lineWidth=1;for(let k=1;k<9;k++){g.beginPath();g.moveTo(x,y+k*w/9);g.lineTo(x+w,y+k*w/9);g.stroke();}
          g.strokeStyle='rgba(225,230,240,.75)';g.lineWidth=2;for(const k of [.33,.66]){g.beginPath();g.moveTo(x+k*w,y);g.lineTo(x+k*w,y+w);g.stroke();}}});
    }else if(name==='panel'){
      c=canvas(512,(g,n)=>{g.fillStyle='#e7e8e4';g.fillRect(0,0,n,n);for(let i=0;i<5000;i++){const v=200+r()*55|0;g.fillStyle=`rgba(${v},${v},${v-6},.25)`;g.fillRect(r()*n,r()*n,2,2);}
        g.strokeStyle='rgba(90,96,100,.55)';g.lineWidth=2;for(const p of [n*.25,n*.75]){g.beginPath();g.moveTo(p,0);g.lineTo(p,n);g.stroke();g.beginPath();g.moveTo(0,p);g.lineTo(n,p);g.stroke();}
        g.fillStyle='rgba(80,86,92,.7)';for(const p of [n*.25,n*.75])for(let k=0;k<16;k++){g.beginPath();g.arc(p+6,k*n/16+8,2,0,TAU);g.fill();g.beginPath();g.arc(k*n/16+8,p+6,2,0,TAU);g.fill();}
        g.fillStyle='rgba(30,40,50,.08)';for(let i=0;i<6;i++)g.fillRect(r()*n,r()*n,40+r()*80,6+r()*12);});
    }else if(name==='vent'){
      c=canvas(256,(g,n)=>{g.fillStyle='#8f9aa3';g.fillRect(0,0,n,n);for(let y=0;y<10;y++)for(let x=0;x<6;x++){g.fillStyle='#1d2730';g.beginPath();g.roundRect?g.roundRect(14+x*40,12+y*24,30,12,5):g.rect(14+x*40,12+y*24,30,12);g.fill();g.fillStyle='rgba(255,255,255,.18)';g.fillRect(14+x*40,24+y*24,30,2);}});
    }else if(name==='beta'){
      c=canvas(512,(g,n)=>{g.fillStyle='#ecebe6';g.fillRect(0,0,n,n);g.globalAlpha=.16;for(let y=0;y<n;y+=3){g.fillStyle=y%6?'#ffffff':'#c9c8c2';g.fillRect(0,y,n,1);}for(let x=0;x<n;x+=3){g.fillStyle=x%6?'#ffffff':'#cfcdc6';g.fillRect(x,0,1,n);}g.globalAlpha=1;
        g.strokeStyle='rgba(110,110,104,.6)';g.lineWidth=2;for(const p of [n*.5]){g.beginPath();g.moveTo(0,p);g.lineTo(n,p);g.stroke();}for(let k=0;k<4;k++){g.beginPath();g.moveTo(k*n/4,0);g.lineTo(k*n/4,n);g.stroke();}
        for(let i=0;i<14;i++){g.strokeStyle='rgba(120,116,104,.25)';g.lineWidth=1;g.beginPath();const x=r()*n,y=r()*n;g.moveTo(x,y);g.lineTo(x+r()*60-30,y+r()*60-30);g.stroke();}});
    }else if(name==='glow'||name==='flare-ring'||name==='spark'){
      c=canvas(256,(g,n)=>{const h=n/2,grad=g.createRadialGradient(h,h,0,h,h,h);
        if(name==='glow'){grad.addColorStop(0,'rgba(255,255,255,1)');grad.addColorStop(.18,'rgba(255,255,255,.75)');grad.addColorStop(.45,'rgba(255,255,255,.18)');grad.addColorStop(1,'rgba(255,255,255,0)');}
        else if(name==='spark'){grad.addColorStop(0,'rgba(255,255,255,1)');grad.addColorStop(.08,'rgba(255,255,255,.9)');grad.addColorStop(.22,'rgba(255,255,255,.12)');grad.addColorStop(1,'rgba(255,255,255,0)');}
        else{grad.addColorStop(0,'rgba(255,255,255,0)');grad.addColorStop(.62,'rgba(255,255,255,0)');grad.addColorStop(.8,'rgba(255,255,255,.35)');grad.addColorStop(.9,'rgba(255,255,255,.08)');grad.addColorStop(1,'rgba(255,255,255,0)');}
        g.fillStyle=grad;g.fillRect(0,0,n,n);
        if(name==='spark'){g.globalCompositeOperation='lighter';for(const a of [0,Math.PI/2]){const l=g.createLinearGradient(0,0,n,0);l.addColorStop(0,'rgba(255,255,255,0)');l.addColorStop(.5,'rgba(255,255,255,.55)');l.addColorStop(1,'rgba(255,255,255,0)');g.save();g.translate(h,h);g.rotate(a);g.fillStyle=l;g.fillRect(-h,-1.5,n,3);g.restore();}}});
    }else throw Error('unknown texture '+name);
    const t=new T.CanvasTexture(c);if(!/glow|ring|spark/.test(name))t.encoding=T.sRGBEncoding;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;t.needsUpdate=true;textures.set(name,t);return t;
  }

  // Box with true rounded edges; normals follow the fillet, faces stay flat.
  function roundedBox(w,h,d,r=.02,seg=3){
    const g=new T.BoxGeometry(w,h,d,seg*2,seg*2,seg*2),p=g.attributes.position,n=g.attributes.normal,hx=w/2-r,hy=h/2-r,hz=d/2-r,v=V(),inner=V(),dir=V();
    r=Math.min(r,w/2,h/2,d/2);
    for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);inner.set(clamp(v.x,-hx,hx),clamp(v.y,-hy,hy),clamp(v.z,-hz,hz));dir.subVectors(v,inner);if(dir.lengthSq()>1e-10){dir.normalize();v.copy(inner).addScaledVector(dir,r);p.setXYZ(i,v.x,v.y,v.z);n.setXYZ(i,dir.x,dir.y,dir.z);}}
    p.needsUpdate=n.needsUpdate=true;g.computeBoundingSphere();return g;
  }
  function crumpled(radius,seed,detail=1){
    const g=new T.IcosahedronGeometry(radius,detail),p=g.attributes.position,r=rand(seed),v=V();
    const k=[r()*2+.6,r()*2+.6,r()*2+.6],scale=[.5+r()*.9,.35+r()*.6,.6+r()*.8];
    for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const n=1+.28*Math.sin(v.x*k[0]*9+seed)*Math.cos(v.y*k[1]*7)+.18*Math.sin(v.z*k[2]*11);v.multiplyScalar(n);v.x*=scale[0];v.y*=scale[1];v.z*=scale[2];p.setXYZ(i,v.x,v.y,v.z);}
    g.computeVertexNormals();return g;
  }
  function bentSheet(w,h,seed){
    const g=new T.PlaneGeometry(w,h,8,6),p=g.attributes.position,r=rand(seed),a=r()*3,b=r()*3;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,Math.sin(x*a*4+seed)*w*.12+Math.cos(y*b*5)*h*.1+(x*y)*.4*(r()-.5));}
    g.computeVertexNormals();return g;
  }

  // Soft round particles with per-particle size, colour and alpha.
  const particleVertex=`attribute float aSize;attribute float aAlpha;attribute vec3 aColor;uniform float uScale;varying float vAlpha;varying vec3 vColor;
    void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uScale/max(.05,-mv.z),0.,256.);vAlpha=aAlpha;vColor=aColor;}`;
  const particleFragment=`uniform float uSoft;uniform float uCore;varying float vAlpha;varying vec3 vColor;
    void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float a=pow(1.-d,uSoft)*vAlpha;vec3 c=mix(vColor,vec3(1.),uCore*pow(max(0.,1.-d*1.8),3.));gl_FragColor=linearToOutputTexel(vec4(c,a));}`;
  class Particles{
    constructor(owner,count,{additive=true,soft=1.6,core=0,name='粒子'}={}){
      const g=new T.BufferGeometry();this.count=count;
      this.position=new Float32Array(count*3);this.color=new Float32Array(count*3).fill(1);this.size=new Float32Array(count);this.alpha=new Float32Array(count);
      g.setAttribute('position',new T.BufferAttribute(this.position,3));g.setAttribute('aColor',new T.BufferAttribute(this.color,3));g.setAttribute('aSize',new T.BufferAttribute(this.size,1));g.setAttribute('aAlpha',new T.BufferAttribute(this.alpha,1));
      const m=new T.ShaderMaterial({uniforms:{uScale:{value:500},uSoft:{value:soft},uCore:{value:core}},vertexShader:particleVertex,fragmentShader:particleFragment,transparent:true,depthWrite:false,blending:additive?T.AdditiveBlending:T.NormalBlending});
      owner.geometries.add(g);owner.materials.add(m);
      const points=this.points=new T.Points(g,m);points.name=name;points.frustumCulled=false;points.userData.noAO=true;points.renderOrder=3;
      const viewport=new T.Vector4();
      points.onBeforeRender=(renderer,scene,camera)=>{renderer.getCurrentViewport(viewport);m.uniforms.uScale.value=viewport.w/(2*Math.tan(T.MathUtils.degToRad(camera.fov||50)/2));};
    }
    set(i,x,y,z,size,alpha,color){const k=i*3;this.position[k]=x;this.position[k+1]=y;this.position[k+2]=z;this.size[i]=size;this.alpha[i]=alpha;if(color){this.color[k]=color.r;this.color[k+1]=color.g;this.color[k+2]=color.b;}}
    hide(i){this.alpha[i]=0;this.size[i]=0;}
    commit(){const a=this.points.geometry.attributes;a.position.needsUpdate=a.aSize.needsUpdate=a.aAlpha.needsUpdate=a.aColor.needsUpdate=true;}
  }
  // Streaks for fast debris or particle flux: head bright, tail transparent.
  class Streaks{
    constructor(owner,count,name='轨迹'){
      const g=new T.BufferGeometry();this.count=count;this.position=new Float32Array(count*6);this.color=new Float32Array(count*6);
      g.setAttribute('position',new T.BufferAttribute(this.position,3));g.setAttribute('color',new T.BufferAttribute(this.color,3));
      const m=new T.LineBasicMaterial({vertexColors:true,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});owner.geometries.add(g);owner.materials.add(m);
      this.lines=new T.LineSegments(g,m);this.lines.name=name;this.lines.frustumCulled=false;this.lines.userData.noAO=true;this.lines.renderOrder=3;
    }
    set(i,head,tail,color,alpha){const k=i*6;this.position.set([head.x,head.y,head.z,tail.x,tail.y,tail.z],k);this.color.set([color.r*alpha,color.g*alpha,color.b*alpha,0,0,0],k);}
    hide(i){this.color.fill(0,i*6,i*6+6);}
    commit(){const a=this.lines.geometry.attributes;a.position.needsUpdate=a.color.needsUpdate=true;}
  }
  // Vacuum plume: brightest at the nozzle exit, widening and fading quickly.
  function plumeMaterial(owner,color='#cfe6ff'){
    const m=new T.ShaderMaterial({uniforms:{uColor:{value:new T.Color(color).convertSRGBToLinear()},uPower:{value:0},uTime:{value:0}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
      vertexShader:'varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
      fragmentShader:'uniform vec3 uColor;uniform float uPower;uniform float uTime;varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){float along=1.-vUv.y;float rim=pow(abs(dot(vN,vV)),1.6);float flicker=.86+.14*sin(uTime*53.+vUv.x*40.);float a=uPower*pow(1.-along,2.2)*rim*flicker;vec3 c=mix(uColor,vec3(1.),pow(1.-along,6.));gl_FragColor=linearToOutputTexel(vec4(c,a));}'});
    owner.materials.add(m);return m;
  }
  function plume(owner,length,radius,color){
    const g=new T.CylinderGeometry(radius*.18,radius,length,24,1,true);g.translate(0,-length/2,0);owner.geometries.add(g);
    const mesh=new T.Mesh(g,plumeMaterial(owner,color));mesh.name='推进羽流';mesh.userData.noAO=true;mesh.renderOrder=4;mesh.frustumCulled=false;return mesh;
  }
  function sprite(owner,name,color,size,opacity=1){
    const m=new T.SpriteMaterial({map:texture(name),color:new T.Color(color).convertSRGBToLinear(),transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});owner.materials.add(m);
    const s=new T.Sprite(m);s.scale.setScalar(size);s.userData.noAO=true;s.renderOrder=5;s.frustumCulled=false;return s;
  }

  // Shared material shortcuts for a builder (all registered on the event).
  function palette(o){
    if(o._kitPalette)return o._kitPalette;
    return o._kitPalette={
      white:o.material('#e9eae6',{map:texture('panel'),roughness:.62,metalness:.05}),
      beta:o.material('#f1f0ea',{map:texture('beta'),roughness:.9,metalness:0}),
      gold:o.material('#d9a441',{map:texture('mli-gold'),roughness:.32,metalness:.62}),
      silver:o.material('#d5dbe0',{map:texture('mli-silver'),roughness:.28,metalness:.6}),
      solar:o.material('#ffffff',{map:texture('solar'),roughness:.24,metalness:.35}),
      dark:o.material('#26323b',{roughness:.55,metalness:.35}),
      steel:o.material('#9aa6ae',{roughness:.34,metalness:.75}),
      black:o.material('#0d1216',{roughness:.3,metalness:.2}),
      glass:o.material('#0b1a24',{roughness:.06,metalness:.8}),
      vent:o.material('#ffffff',{map:texture('vent'),roughness:.6,metalness:.2}),
      blue:o.material('#5f7c92',{roughness:.5,metalness:.3}),
      rubber:o.material('#3a4650',{roughness:.85,metalness:0}),
      copper:o.material('#b8774a',{roughness:.35,metalness:.8})
    };
  }
  const add=(o,parent,geometry,material,name,position,rotation)=>{const m=o.mesh(parent,geometry,material,name,position||V());if(rotation)m.rotation.set(...rotation);m.castShadow=true;m.receiveShadow=true;return m;};
  const cyl=(o,parent,r1,r2,h,mat,name,pos,rot,seg=28,open=false)=>add(o,parent,new T.CylinderGeometry(r1,r2,h,seg,1,open),mat,name,pos,rot);

  // Seven-joint core module manipulator. Joint layout follows the real arm:
  // shoulder roll/yaw/pitch, elbow pitch, wrist pitch/yaw/roll, end effector.
  function roboticArm(o,{boom=2.3,radius=.12}={}){
    const p=palette(o),root=new T.Group();root.name='核心舱机械臂';
    const plate=cyl(o,root,.36,.4,.07,p.steel,'机械臂基座安装板',V(0,.035,0));for(let i=0;i<8;i++){const a=i/8*TAU;cyl(o,root,.025,.025,.04,p.black,'基座紧固件',V(Math.cos(a)*.31,.08,Math.sin(a)*.31),null,8);}
    const yaw=new T.Group();yaw.name='肩部偏航关节';yaw.position.y=.07;root.add(yaw);
    cyl(o,yaw,.21,.23,.36,p.white,'肩部回转关节壳体',V(0,.18,0));cyl(o,yaw,.235,.235,.05,p.gold,'关节隔热带',V(0,.3,0));cyl(o,yaw,.24,.24,.03,p.steel,'关节端盖',V(0,.37,0));
    const shoulder=new T.Group();shoulder.name='肩部俯仰关节';shoulder.position.y=.52;yaw.add(shoulder);
    cyl(o,shoulder,.2,.2,.42,p.white,'肩部俯仰关节壳体',V(),[0,0,Math.PI/2]);for(const x of [-.23,.23])cyl(o,shoulder,.205,.205,.04,p.steel,'俯仰关节端盖',V(x,0,0),[0,0,Math.PI/2]);
    function boomSegment(parent,length,name){
      cyl(o,parent,radius,radius,length,p.white,name,V(0,length/2,0),null,32);
      for(const k of [.12,.5,.88])cyl(o,parent,radius*1.06,radius*1.06,.07,p.dark,name+'碳纤维接缝',V(0,length*k,0),null,32);
      cyl(o,parent,radius*1.12,radius*1.12,.28,p.gold,name+'多层隔热包覆',V(0,.22,0),null,32);
      for(const s of [-1,1])add(o,parent,new T.BoxGeometry(.04,length*.78,.05),p.steel,name+'外置电缆槽',V(s*radius*1.02,length/2,0));
      // Crew aid handrails; Chinese station arms carry them for EVA.
      for(let i=0;i<3;i++){const y=length*(.25+i*.22);add(o,parent,new T.TorusGeometry(.07,.012,8,16,Math.PI),p.gold,name+'扶手',V(0,y,radius+.01),[0,Math.PI/2,Math.PI/2]);}
    }
    const upper=new T.Group();upper.name='上臂杆';shoulder.add(upper);boomSegment(upper,boom,'上臂杆');
    const elbow=new T.Group();elbow.name='肘部关节';elbow.position.y=boom;upper.add(elbow);
    cyl(o,elbow,.19,.19,.4,p.white,'肘关节壳体',V(),[0,0,Math.PI/2]);for(const x of [-.21,.21])cyl(o,elbow,.195,.195,.035,p.steel,'肘关节端盖',V(x,0,0),[0,0,Math.PI/2]);
    const cam=new T.Group();cam.position.set(.24,.05,.0);elbow.add(cam);add(o,cam,roundedBox(.12,.1,.16,.02),p.white,'肘部相机');cyl(o,cam,.03,.035,.05,p.glass,'肘部相机镜头',V(0,0,.1),[Math.PI/2,0,0],16);
    const lower=new T.Group();lower.name='下臂杆';elbow.add(lower);boomSegment(lower,boom,'下臂杆');
    const wrist=new T.Group();wrist.name='腕部俯仰关节';wrist.position.y=boom;lower.add(wrist);
    cyl(o,wrist,.17,.17,.36,p.white,'腕部俯仰关节',V(),[0,0,Math.PI/2]);
    const wristYaw=new T.Group();wristYaw.name='腕部偏航关节';wristYaw.position.y=.18;wrist.add(wristYaw);cyl(o,wristYaw,.16,.16,.3,p.white,'腕部偏航关节',V(0,.12,0));cyl(o,wristYaw,.165,.165,.04,p.gold,'腕部隔热带',V(0,.2,0));
    const roll=new T.Group();roll.name='腕部滚转与末端执行器';roll.position.y=.28;wristYaw.add(roll);
    cyl(o,roll,.17,.17,.38,p.steel,'末端执行器筒体',V(0,.19,0),null,32);cyl(o,roll,.2,.17,.06,p.white,'末端执行器捕获口',V(0,.41,0),null,32);
    add(o,roll,new T.TorusGeometry(.15,.018,10,36),p.dark,'捕获口卡爪环',V(0,.44,0),[Math.PI/2,0,0]);
    for(let i=0;i<3;i++){const a=i/3*TAU;add(o,roll,new T.BoxGeometry(.035,.12,.05),p.black,'捕获卡爪',V(Math.cos(a)*.13,.45,Math.sin(a)*.13),[0,-a,0]);}
    const lamp=new T.Group();lamp.position.set(.2,.24,0);roll.add(lamp);add(o,lamp,roundedBox(.1,.09,.14,.02),p.white,'末端照明灯');const lampFace=add(o,lamp,new T.CircleGeometry(.032,18),o.glow('#fff3d6'),'末端照明灯面',V(0,0,.072));
    const tip=new T.Object3D();tip.name='末端捕获点';tip.position.y=.46;roll.add(tip);
    const joints={yaw,shoulder,elbow,wrist,wristYaw,roll};
    const L1=boom,L2=boom,shoulderHeight=.59,reach=.28+.46;
    const arm={root,joints,tip,lamp:lampFace,boom,reach:L1+L2+reach,
      // Joint-space interpolation between named poses; angles in radians.
      setAngles(a){yaw.rotation.y=a[0];shoulder.rotation.x=a[1];elbow.rotation.x=a[2];wrist.rotation.x=a[3];wristYaw.rotation.z=a[4]||0;roll.rotation.y=a[5]||0;root.updateMatrixWorld(true);},
      // Two-link inverse kinematics in the arm plane, wrist aimed along the approach.
      solve(target,approach){
        const t=target.clone(),dir=(approach||t.clone().sub(V(0,shoulderHeight,0))).clone().normalize();
        const yawAngle=Math.atan2(t.x,t.z);
        const toPlane=v=>({f:v.x*Math.sin(yawAngle)+v.z*Math.cos(yawAngle),u:v.y});
        const tp=toPlane(t),dp=toPlane(dir);tp.u-=shoulderHeight;
        const len=Math.hypot(dp.f,dp.u)||1,uf=dp.f/len,uu=dp.u/len;
        let wf=tp.f-uf*(reach+.18),wu=tp.u-uu*(reach+.18);const D=Math.min(Math.hypot(wf,wu),L1+L2-.02),phi=Math.atan2(wf,wu);
        const beta=Math.acos(clamp((D*D-L1*L1-L2*L2)/(2*L1*L2),-1,1)),th1=phi-Math.atan2(L2*Math.sin(beta),L1+L2*Math.cos(beta)),th2=beta,psi=Math.atan2(uf,uu),th3=psi-th1-th2;
        return[yawAngle,th1,th2,th3,0,0];
      }
    };
    arm.stowed=[0,1.52,-2.95,1.36,0,0];arm.setAngles(arm.stowed);return arm;
  }

  // A defunct observation satellite: foil-wrapped bus, one bent solar wing,
  // antenna dish and a launch adapter ring the arm can grapple.
  function satellite(o){
    const p=palette(o),root=new T.Group();root.name='失效卫星';
    add(o,root,roundedBox(1.15,1.0,1.15,.04,3),p.gold,'卫星本体多层隔热');
    add(o,root,roundedBox(1.02,.06,1.02,.02),p.silver,'顶板银色隔热',V(0,.52,0));
    add(o,root,new T.BoxGeometry(.9,.82,.02),o.material('#e8ecef',{roughness:.12,metalness:.15}),'散热面',V(.585,0,0),[0,Math.PI/2,0]);
    for(const z of [-.2,.2])add(o,root,roundedBox(.14,.14,.2,.02),p.white,'星敏感器',V(-.35,.6,z));
    cyl(o,root,.38,.38,.08,p.steel,'星箭对接环',V(0,-.56,0),null,40);add(o,root,new T.TorusGeometry(.38,.03,10,48),p.dark,'对接环法兰',V(0,-.6,0),[Math.PI/2,0,0]);
    const grapple=new T.Object3D();grapple.name='抓捕点';grapple.position.set(0,-.62,0);root.add(grapple);
    for(let i=0;i<4;i++){const a=i/4*TAU+Math.PI/4;cyl(o,root,.04,.07,.12,p.dark,'姿控喷管',V(Math.cos(a)*.45,-.46,Math.sin(a)*.45),null,12);}
    // Dish on a short boom.
    const dish=new T.Group();dish.position.set(0,.2,-.8);dish.rotation.x=-.5;root.add(dish);cyl(o,dish,.03,.03,.4,p.steel,'天线支杆',V(0,0,.2),[Math.PI/2,0,0],10);
    const profile=[];for(let i=0;i<=12;i++){const r=i/12*.46;profile.push(new T.Vector2(r,r*r*.6));}
    const bowl=add(o,dish,new T.LatheGeometry(profile,40),o.material('#f2f2ee',{roughness:.5,side:T.DoubleSide}),'抛物面天线',V(0,0,-.04),[Math.PI/2,0,0]);void bowl;
    cyl(o,dish,.035,.05,.22,p.gold,'馈源',V(0,0,-.2),[Math.PI/2,0,0],12);
    // Solar wings: yoke + two panels each; one wing is buckled and torn.
    const wings=[];for(const side of [-1,1]){const wing=new T.Group();wing.position.set(side*.6,.05,0);root.add(wing);wings.push(wing);
      cyl(o,wing,.025,.025,.5,p.steel,'太阳翼连接架',V(side*.25,0,0),[0,0,Math.PI/2],10);
      for(let i=0;i<2;i++){const panel=new T.Group();panel.position.set(side*(.55+i*1.04),0,0);wing.add(panel);add(o,panel,new T.BoxGeometry(1.0,.025,.82),p.solar,'太阳电池板',V(side*.5,0,0));add(o,panel,new T.BoxGeometry(1.02,.03,.03),p.steel,'电池板边框',V(side*.5,0,.41));add(o,panel,new T.BoxGeometry(1.02,.03,.03),p.steel,'电池板边框',V(side*.5,0,-.41));
        if(side>0&&i===1){panel.rotation.set(.35,0,-.42);}}}
    const flap=add(o,root,bentSheet(.5,.36,4),o.material('#d9a441',{map:texture('mli-gold'),roughness:.3,metalness:.62,side:T.DoubleSide}),'脱落的隔热层',V(-.3,-.2,.62),[.3,.2,0]);
    return{root,grapple,wings,flap};
  }

  // Tianzhou-class cargo spacecraft, built along +Z (docking ring forward).
  function cargoShip(o){
    const p=palette(o),root=new T.Group();root.name='天舟货运飞船';
    const cargoProfile=[[0,-1.25],[.82,-1.25],[.87,-1.1],[.87,1.15],[.82,1.3],[.62,1.62],[.52,1.72],[0,1.72]].map(([r,y])=>new T.Vector2(r,y));
    add(o,root,new T.LatheGeometry(cargoProfile,48),p.beta,'货物舱',V(0,0,.6),[Math.PI/2,0,0]);
    for(const z of [-.4,.4,1.2])cyl(o,root,.885,.885,.05,p.silver,'舱段环带',V(0,0,z),[Math.PI/2,0,0],48);
    const dock=new T.Group();dock.position.z=2.36;root.add(dock);
    cyl(o,dock,.5,.52,.18,p.steel,'对接机构基座',V(0,0,0),[Math.PI/2,0,0],40);add(o,dock,new T.TorusGeometry(.42,.035,10,48),p.dark,'捕获环',V(0,0,.12));
    for(let i=0;i<3;i++){const a=i/3*TAU,petal=new T.Shape([new T.Vector2(-.13,0),new T.Vector2(.13,0),new T.Vector2(.05,.22),new T.Vector2(-.05,.22)]);const m=add(o,dock,new T.ExtrudeGeometry(petal,{depth:.025,bevelEnabled:false}),p.steel,'导向瓣',V(Math.cos(a)*.38,Math.sin(a)*.38,.1));m.rotation.set(0,0,a-Math.PI/2);m.rotateX(-Math.PI/2+.25);}
    const ring=new T.Object3D();ring.name='对接面';ring.position.z=.2;dock.add(ring);
    add(o,root,roundedBox(.22,.16,.26,.02),p.white,'激光雷达',V(.55,.52,1.95));add(o,root,new T.CircleGeometry(.05,18),p.glass,'激光雷达窗口',V(.55,.52,2.085));
    // Propulsion module with solar wings and engine cluster.
    cyl(o,root,.74,.87,.3,p.silver,'舱段过渡锥',V(0,0,-.8),[Math.PI/2,0,0],48);
    cyl(o,root,.74,.74,1.75,p.silver,'推进舱',V(0,0,-1.8),[Math.PI/2,0,0],48);
    for(let i=0;i<4;i++){const a=i/4*TAU+Math.PI/4;const q=new T.Group();q.position.set(Math.cos(a)*.76,Math.sin(a)*.76,-2.5);q.rotation.z=a;root.add(q);add(o,q,roundedBox(.12,.18,.18,.02),p.white,'姿控发动机组');for(const z of [-.06,.06])cyl(o,q,.02,.035,.06,p.dark,'姿控喷管',V(.08,0,z),[0,0,-Math.PI/2],10);}
    const bell=[];for(let i=0;i<=10;i++){const t=i/10;bell.push(new T.Vector2(.07+.12*t*t,-t*.32));}
    const engines=[];for(let i=0;i<4;i++){const a=i/4*TAU;const pos=V(Math.cos(a)*.34,Math.sin(a)*.34,-2.68);const e=add(o,root,new T.LatheGeometry(bell,24),o.material('#5d564f',{roughness:.45,metalness:.7,side:T.DoubleSide}),'轨控发动机喷管',pos,[-Math.PI/2,0,0]);engines.push(pos.clone().add(V(0,0,-.32)));void e;}
    const wings=[];for(const side of [-1,1]){const wing=new T.Group();wing.position.set(side*.76,0,-1.8);root.add(wing);wings.push(wing);
      cyl(o,wing,.03,.03,.5,p.steel,'太阳翼连接架',V(side*.25,0,0),[0,0,Math.PI/2],10);
      for(let i=0;i<3;i++){add(o,wing,new T.BoxGeometry(1.08,.025,.78),p.solar,'太阳电池翼板',V(side*(1.05+i*1.12),0,0));add(o,wing,new T.BoxGeometry(1.1,.03,.03),p.steel,'翼板铰链',V(side*(1.05+i*1.12),0,.39));}}
    for(const s of [-1,1])cyl(o,root,.012,.012,.6,p.steel,'测控天线',V(s*.2,.88,-2.1),null,8);
    return{root,dock:ring,engines,wings};
  }

  // Debris: crumpled metal, torn foil and shattered cell fragments.
  function fragment(o,kind,seed,size=.3){
    const p=palette(o);
    if(kind==='foil'){const m=o.mesh(new T.Group(),bentSheet(size*1.6,size,seed),o.material(seed%2?'#d9a441':'#cfd6dc',{map:texture(seed%2?'mli-gold':'mli-silver'),roughness:.3,metalness:.62,side:T.DoubleSide}),'撕裂的隔热层');return m;}
    if(kind==='cell'){return o.mesh(new T.Group(),new T.BoxGeometry(size*1.4,size*.04,size),p.solar,'电池片碎块');}
    const tone=['#8c949b','#5f666c','#a4a9ad','#3d3a36'][seed%4];return o.mesh(new T.Group(),crumpled(size,seed),o.material(tone,{roughness:.45,metalness:.7}),'扭曲金属碎片');
  }

  // Free-flying cabin service robot (Astrobee-class proportions, ~32 cm cube).
  function freeFlyer(o,{scale=1,accent='#4f86c6'}={}){
    const p=palette(o),root=new T.Group();root.name='自由飞行服务机器人';
    const body=new T.Group();root.add(body);
    add(o,body,roundedBox(.3,.28,.3,.035,3),p.white,'机身');
    for(const s of [-1,1]){add(o,body,roundedBox(.024,.24,.27,.01),p.vent,'推进风道格栅',V(s*.155,0,0));
      for(const z of [-.08,0,.08])cyl(o,body,.016,.016,.02,p.black,'喷嘴',V(s*.168,-.08,z),[0,0,Math.PI/2],10);}
    for(const x of [-.15,.15])for(const z of [-.15,.15])add(o,body,roundedBox(.035,.29,.035,.012),o.material(accent,{roughness:.6}),'防撞护条',V(x,0,z));
    add(o,body,roundedBox(.2,.085,.02,.01),p.glass,'前视传感器窗',V(0,.04,.152));
    for(const x of [-.06,.06])cyl(o,body,.018,.022,.02,o.material('#18242c',{roughness:.05,metalness:.9}),'立体相机',V(x,.04,.164),[Math.PI/2,0,0],16);
    const led=add(o,body,new T.BoxGeometry(.16,.012,.006),o.glow('#7ce8d8'),'状态灯带',V(0,-.02,.156));
    const handle=add(o,body,new T.TorusGeometry(.07,.012,8,20,Math.PI),p.dark,'乘员把手',V(0,.14,0),[0,0,0]);void handle;
    // Perching arm with two-finger gripper.
    const shoulder=new T.Group();shoulder.position.set(0,-.14,.08);body.add(shoulder);cyl(o,shoulder,.028,.028,.08,p.dark,'机械臂肩关节',V(),[0,0,Math.PI/2],14);
    add(o,shoulder,roundedBox(.035,.16,.035,.01),p.steel,'机械臂上段',V(0,-.08,0));
    const elbow=new T.Group();elbow.position.y=-.16;shoulder.add(elbow);cyl(o,elbow,.024,.024,.06,p.dark,'机械臂肘关节',V(),[0,0,Math.PI/2],14);add(o,elbow,roundedBox(.03,.12,.03,.01),p.steel,'机械臂下段',V(0,-.06,0));
    const hand=new T.Group();hand.position.y=-.12;elbow.add(hand);add(o,hand,roundedBox(.06,.03,.04,.008),p.dark,'夹爪座');
    const fingers=[];for(const s of [-1,1]){const f=new T.Group();f.position.x=s*.022;hand.add(f);add(o,f,roundedBox(.012,.05,.026,.004),o.material('#c9d2d8',{roughness:.4,metalness:.6}),'夹爪指',V(0,-.03,0));fingers.push(f);}
    const tool=new T.Object3D();tool.position.y=-.06;hand.add(tool);
    root.scale.setScalar(scale);
    const ff={root,body,led,arm:{shoulder,elbow,hand,fingers},tool,
      pose(t,{reach=0,grip=.5,work=0}={}){shoulder.rotation.x=-1.2+reach*1.55+Math.sin(t*3)*.06*work;elbow.rotation.x=1.9-reach*1.5+Math.sin(t*4.2)*.08*work;hand.rotation.x=-.3*reach;fingers.forEach((f,i)=>f.position.x=(i?1:-1)*(.012+.014*(1-grip)));body.rotation.z=Math.sin(t*1.3)*.03;}
    };ff.pose(0);return ff;
  }

  // Aurora curtains on a ring around an axis of the Earth mesh (local frame).
  function aurora(o,radius,axis,colatitude=.24){
    const height=radius*.06,base=radius*1.006,top=base+height,r1=base*Math.sin(colatitude),r2=top*Math.sin(colatitude),h1=base*Math.cos(colatitude),h2=top*Math.cos(colatitude);
    const g=new T.CylinderGeometry(r2,r1,h2-h1,160,6,true);g.translate(0,(h1+h2)/2,0);o.geometries.add(g);
    const m=new T.ShaderMaterial({uniforms:{uTime:{value:0},uPower:{value:0}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform float uTime;uniform float uPower;varying vec2 vUv;float n(float x){return .5+.5*sin(x)*sin(x*.37+1.3)*sin(x*.13+2.1);}void main(){float x=vUv.x*6.2831853;float v=vUv.y;float rays=pow(n(x*38.+uTime*.6)*n(x*11.-uTime*.25),1.2);float fold=.6+.4*sin(x*7.+uTime*.35+sin(x*3.+uTime*.2)*2.);float vertical=smoothstep(0.,.18,v)*pow(1.-v,1.6);vec3 green=vec3(.12,1.,.45);vec3 red=vec3(.9,.18,.55);vec3 c=mix(green,red,smoothstep(.45,1.,v));float a=uPower*vertical*rays*fold*1.5;gl_FragColor=linearToOutputTexel(vec4(c*a,a));}'});
    o.materials.add(m);const mesh=new T.Mesh(g,m);mesh.name='极光帷幕';mesh.userData.noAO=true;mesh.renderOrder=2;mesh.frustumCulled=false;
    mesh.quaternion.setFromUnitVectors(V(0,1,0),axis.clone().normalize());return mesh;
  }

  // Cabin cargo pouch for drifting-object scenes.
  function pouch(o,seed){
    const p=palette(o),r=rand(seed),g=new T.Group();g.name='漂浮货包';const w=.22+r()*.16,h=.14+r()*.1,d=.16+r()*.1;
    add(o,g,roundedBox(w,h,d,.04,2),o.material(['#e7e1d1','#d9dcd6','#c9d3d8'][seed%3],{map:texture('beta'),roughness:.92}),'软包');
    add(o,g,new T.BoxGeometry(w+.006,.02,d*.3),o.material('#4b6a86',{roughness:.8}),'固定带',V(0,0,0));
    add(o,g,new T.BoxGeometry(w*.42,h*.38,.004),o.material('#f6f4ee',{roughness:.7}),'物资标签',V(0,.01,d/2+.003));return g;
  }

  C.StationEventKit={texture,roundedBox,crumpled,bentSheet,rand,smooth,Particles,Streaks,plume,plumeMaterial,sprite,palette,roboticArm,satellite,cargoShip,fragment,freeFlyer,aurora,pouch,add,cyl};
})();
