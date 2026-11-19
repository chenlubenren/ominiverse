/* First-person humanoid-robot forearms and hands: white shells, fog-blue actuators, dark-blue structure.
   Canonical right hand: fingers +Y, back of the hand +Z, thumb -X, wrist pivot at the origin, forearm along -Y
   to the elbow axle at y=-0.29 (the IK forearm length). The left hand mirrors once with scale.x=-1.
   Every rigid part is merged per material into one SkinnedMesh with single-bone weights, so a hand + forearm
   costs five draw calls while keeping the wrist, 12 finger joints and a 3-joint opposed thumb articulated. */
(() => {
  'use strict';const L=window.IndoorLab,T=THREE,FOREARM=.29,UPPER=.32,PALETTE={shell:'#e4eef6',accent:'#6b9bc4',dark:'#31475c',rubber:'#28333f',glow:'#86d6ff'};
  let grain,materials;
  function texture(){if(grain)return grain;const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),d=g.createImageData(128,128);let seed=91;for(let i=0;i<d.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const v=124+(seed%11);d.data.set([v,v,v,255],i);}g.putImageData(d,0,0);grain=new T.CanvasTexture(c);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(5,5);return grain;}
  function palette(){
    if(materials)return materials;const lin=m=>{m.color.convertSRGBToLinear();return m;};
    materials={
      shell:lin(new T.MeshPhysicalMaterial({color:PALETTE.shell,roughness:.34,metalness:.02,clearcoat:.55,clearcoatRoughness:.3,bumpMap:texture(),bumpScale:.00012})),
      accent:lin(new T.MeshStandardMaterial({color:PALETTE.accent,roughness:.38,metalness:.45})),
      dark:lin(new T.MeshStandardMaterial({color:PALETTE.dark,roughness:.46,metalness:.55})),
      rubber:lin(new T.MeshStandardMaterial({color:PALETTE.rubber,roughness:.84,metalness:0})),
      glow:new T.MeshBasicMaterial({color:PALETTE.glow,toneMapped:false})
    };
    return materials;
  }
  // Rounded box with analytic normals; corner arcs get m segments each, flat spans one. taper scales x/z toward +y.
  function rbox(w,h,d,r,m=2,taper=1){
    r=Math.min(r,w/2-1e-4,h/2-1e-4,d/2-1e-4);const N=2*m+1,g=new T.BoxGeometry(1,1,1,N,N,N),p=g.attributes.position,n=g.attributes.normal,half=[w/2,h/2,d/2],inner=half.map(x=>x-r);
    const table=half.map((hv,k)=>{const t=[];for(let j=0;j<=N;j++){if(j<=m)t.push(-inner[k]-r*Math.cos(j/m*Math.PI/2));else t.push(inner[k]+r*Math.cos((N-j)/m*Math.PI/2));}return t;}),v=[0,0,0],c=[0,0,0];
    for(let i=0;i<p.count;i++){
      v[0]=table[0][Math.round((p.getX(i)+.5)*N)];v[1]=table[1][Math.round((p.getY(i)+.5)*N)];v[2]=table[2][Math.round((p.getZ(i)+.5)*N)];
      for(let k=0;k<3;k++)c[k]=Math.max(-inner[k],Math.min(inner[k],v[k]));
      let nx=v[0]-c[0],ny=v[1]-c[1],nz=v[2]-c[2];const len=Math.hypot(nx,ny,nz)||1;nx/=len;ny/=len;nz/=len;
      let x=c[0]+nx*r,y=c[1]+ny*r,z=c[2]+nz*r;if(taper!==1){const k=1+(taper-1)*(y+h/2)/h;x*=k;z*=k;}
      p.setXYZ(i,x,y,z);n.setXYZ(i,nx,ny,nz);
    }
    return g;
  }
  const lathe=(profile,sz=1,seg=48,start=0,length=Math.PI*2)=>{if(profile[0][1]>profile.at(-1)[1])profile=[...profile].reverse();const g=new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),seg,start,length);g.scale(1,1,sz);return g;};
  const cylX=(r,len,seg=28)=>new T.CylinderGeometry(r,r,len,seg).rotateZ(Math.PI/2);
  const cylY=(r,len,seg=28,r2=r)=>new T.CylinderGeometry(r,r2,len,seg);
  const ringY=(r,tube,seg=40)=>new T.TorusGeometry(r,tube,8,seg).rotateX(Math.PI/2);
  // Collects parts (geometry in a bone's frame) and bakes them into per-material skinned meshes.
  class Baker{
    constructor(){this.parts=[];}
    add(bone,key,geometry,pos=[0,0,0],rot=[0,0,0],scale=[1,1,1]){const m=new T.Matrix4().compose(new T.Vector3(...pos),new T.Quaternion().setFromEuler(new T.Euler(...rot)),new T.Vector3(...scale));this.parts.push({bone,key,geometry,matrix:m});return this;}
    merge(parts,boneIndex,toRoot){
      let vertices=0,indices=0;const prepared=parts.map(part=>{const g=part.geometry.index?part.geometry:part.geometry.toNonIndexed();vertices+=g.attributes.position.count;indices+=g.index?g.index.count:g.attributes.position.count;return g;});
      const pos=new Float32Array(vertices*3),nor=new Float32Array(vertices*3),idx=new(vertices>65535?Uint32Array:Uint16Array)(indices),si=boneIndex?new Uint16Array(vertices*4):null,sw=boneIndex?new Float32Array(vertices*4):null,v=new T.Vector3(),nm=new T.Matrix3();
      let vo=0,io=0;
      parts.forEach((part,k)=>{
        const g=prepared[k],m=toRoot(part).multiply(part.matrix),p=g.attributes.position,n=g.attributes.normal;nm.getNormalMatrix(m);const b=boneIndex?boneIndex(part):0;
        for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);pos.set([v.x,v.y,v.z],(vo+i)*3);v.fromBufferAttribute(n,i).applyMatrix3(nm).normalize();nor.set([v.x,v.y,v.z],(vo+i)*3);if(si){si[(vo+i)*4]=b;sw[(vo+i)*4]=1;}}
        if(g.index)for(let i=0;i<g.index.count;i++)idx[io+i]=g.index.getX(i)+vo;else for(let i=0;i<p.count;i++)idx[io+i]=vo+i;
        vo+=p.count;io+=g.index?g.index.count:p.count;
      });
      const out=new T.BufferGeometry();out.setAttribute('position',new T.BufferAttribute(pos,3));out.setAttribute('normal',new T.BufferAttribute(nor,3));if(si){out.setAttribute('skinIndex',new T.BufferAttribute(si,4));out.setAttribute('skinWeight',new T.BufferAttribute(sw,4));}out.setIndex(new T.BufferAttribute(idx,1));out.computeBoundingSphere();
      for(const g of new Set(parts.map(p=>p.geometry)))g.dispose();
      return out;
    }
  }
  const SKIN_MATERIALS=new Map();
  function skinMaterial(key){if(!SKIN_MATERIALS.has(key)){const m=palette()[key].clone();m.skinning=true;SKIN_MATERIALS.set(key,m);}return SKIN_MATERIALS.get(key);}
  // Static shells for the upper arm, authored in metres, stored at unit length (combat scales y by the segment length).
  function upperArm(){
    const group=new T.Group();group.name='机器人上臂外壳';const b=new Baker(),S=1/UPPER,sz=.9,M=palette();
    const shellA=[[.041,-.16],[.047,-.145],[.051,-.11],[.052,-.07],[.0515,-.032],[.05,-.012]],shellB=[[.049,-.002],[.0495,.03],[.048,.07],[.045,.11],[.041,.135],[.036,.15]];
    for(const prof of [shellA,shellB])for(const [s,l] of [[-1.15,2.3],[1.19,1.92],[3.15,1.92]])b.add(null,'shell',lathe(prof,sz,32,s,l));
    b.add(null,'dark',lathe([[.035,-.165],[.046,-.15],[.047,.14],[.03,.165]],sz,32));
    b.add(null,'accent',lathe([[.047,-.012],[.0492,-.009],[.0492,-.003],[.047,0]],sz,40));
    b.add(null,'accent',lathe([[.04,-.168],[.045,-.165],[.045,-.152],[.04,-.149]],sz,40));
    b.add(null,'dark',rbox(.012,.06,.006,.0025,2),[0,-.06,.0465*sz+.001]);
    for(const key of ['shell','dark','accent']){const parts=b.parts.filter(p=>p.key===key);if(!parts.length)continue;const g=b.merge(parts,null,()=>new T.Matrix4().makeScale(1,S,1));const mesh=new T.Mesh(g,M[key]);mesh.frustumCulled=false;group.add(mesh);}
    group.userData.robotShell=true;return group;
  }
  class RobotHand {
    constructor(side=1){
      const M=palette();this.side=side;this.grip=1;this.spread=0;this.wristPitch=0;this.wristYaw=0;
      this.group=new T.Group();this.group.name=side<0?'左侧人形机器人手':'右侧人形机器人手';
      this.skinMaterial=skinMaterial('shell');this.materials={shell:this.skinMaterial,accent:skinMaterial('accent'),dark:skinMaterial('dark'),rubber:skinMaterial('rubber'),glow:skinMaterial('glow')};
      const bone=(parent,pos,name)=>{const b=new T.Bone();b.name=name;b.position.set(...pos);(parent||this.group).add(b);this.bones.push(b);return b;};
      this.bones=[];const root=this.root=bone(null,[0,0,0],'forearm'),wrist=this.wrist=bone(root,[0,0,0],'wrist'),B=new Baker();
      this.buildForearm(B,root);this.buildPalm(B,wrist);
      const fingers=[['index',-.0285,.097,.0036,.0176,.017,[.040,.025,.020]],['middle',-.0095,.1,.0038,.018,.0175,[.044,.028,.021]],['ring',.0095,.098,.0036,.0171,.0168,[.041,.026,.020]],['little',.0278,.091,.0026,.015,.0152,[.032,.020,.017]]];
      this.fingers=fingers.map(([name,x,y,z,w,t,lengths],f)=>{const chain=[];let parent=wrist,at=[x,y,z];for(let j=0;j<3;j++){const b=bone(parent,at,name+(j+1));this.phalanx(B,b,w*(1-j*.035),t*(1-j*.05),lengths[j],j,j===2);chain.push(b);parent=b;at=[0,lengths[j],0];}const tip=new T.Object3D();tip.position.set(0,lengths[2]*.92,0);chain[2].add(tip);return{name,chain,tip,f};});
      // Thumb: carpometacarpal base on the palm side, metacarpal + proximal + distal segments.
      const tl=[.036,.029,.024],cmc=bone(wrist,[-.034,.02,-.009],'thumb1');this.thumbChain=[cmc];this.phalanx(B,cmc,.019,.0185,tl[0],0,false,true);
      const t2=bone(cmc,[0,tl[0],0],'thumb2');this.phalanx(B,t2,.0178,.017,tl[1],1,false);const t3=bone(t2,[0,tl[1],0],'thumb3');this.phalanx(B,t3,.0168,.0162,tl[2],2,true);this.thumbChain.push(t2,t3);
      this.thumbTip=new T.Object3D();this.thumbTip.position.set(0,tl[2]*.9,0);t3.add(this.thumbTip);
      this.palmCenter=new T.Object3D();this.palmCenter.position.set(0,.056,0);wrist.add(this.palmCenter);
      const basis=(dir,curl)=>{const y=new T.Vector3(...dir).normalize(),z=new T.Vector3(...curl).multiplyScalar(-1);z.addScaledVector(y,-z.dot(y)).normalize();const x=new T.Vector3().crossVectors(y,z);return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));};
      this.thumbOpen=basis([-.66,.62,-.36],[.62,.2,-.76]);this.thumbFist=basis([.08,.78,-.62],[.96,-.12,-.18]);
      this.group.updateMatrixWorld(true);const inv=new T.Matrix4().copy(this.group.matrixWorld).invert(),index=new Map(this.bones.map((b,i)=>[b,i]));
      const skeleton=new T.Skeleton(this.bones);this.meshes=[];this.triangles=0;
      for(const key of ['shell','accent','dark','rubber','glow']){
        const parts=B.parts.filter(p=>p.key===key);if(!parts.length)continue;
        const g=B.merge(parts,p=>index.get(p.bone),p=>inv.clone().multiply(p.bone.matrixWorld)),mesh=new T.SkinnedMesh(g,this.materials[key]);
        mesh.name='机器人手 · '+key;mesh.frustumCulled=false;mesh.userData.noAO=true;this.group.add(mesh);mesh.bind(skeleton,new T.Matrix4());this.meshes.push(mesh);this.triangles+=g.index.count/3;
      }
      this.group.scale.x=side;this.markers={thumb:this.thumbChain[1],thumbTip:this.thumbTip,palm:this.palmCenter};
      this.stats={robot:true,glove:false,opaque:true,joints:this.bones.length-1,fingers:5,phalanges:15,thumbSide:side<0?'right':'left',drawCalls:this.meshes.length,triangles:this.triangles};
      this.setPose(1,1);
    }
    buildForearm(B,root){
      const sz=.84,A=[[.0302,-.040],[.0322,-.048],[.0346,-.066],[.0378,-.092],[.0408,-.118],[.0428,-.138],[.0434,-.147]],C=[[.0438,-.157],[.0455,-.172],[.0471,-.196],[.0477,-.222],[.0472,-.246],[.0458,-.262],[.0432,-.274],[.039,-.281]];
      // Three panels per segment; the angular gaps expose the dark-blue spine as panel seams.
      for(const prof of [A,C])for(const [s,l] of [[-1.17,2.34],[1.215,1.88],[3.14,1.925]])B.add(root,'shell',lathe(prof,sz,40,s,l));
      B.add(root,'dark',lathe([[.026,-.036],[.029,-.05],[.0315,-.07],[.0345,-.095],[.038,-.12],[.0405,-.145],[.0425,-.17],[.0445,-.2],[.0448,-.235],[.0435,-.26],[.034,-.284]],sz,40));
      B.add(root,'accent',lathe([[.0405,-.146],[.0436,-.1485],[.0436,-.1555],[.0405,-.158]],sz,48));
      B.add(root,'accent',lathe([[.027,-.034],[.0312,-.0375],[.0312,-.0425],[.0295,-.045]],sz,48));
      const rAt=y=>{const all=[...A,...C];for(let i=1;i<all.length;i++)if(y>=all[i][1]){const [r0,y0]=all[i-1],[r1,y1]=all[i];return r0+(r1-r0)*(y-y0)/(y1-y0||1);}return all.at(-1)[0];},surface=(phi,y,lift=0)=>{const r=rAt(y)+lift;return [Math.sin(phi)*r,y,Math.cos(phi)*r*sz];};
      B.add(root,'glow',rbox(.017,.0042,.002,.0009,2),surface(0,-.078,.0006),[-.12,0,0]);
      B.add(root,'dark',rbox(.024,.008,.0016,.0007,2),surface(0,-.1,.0004),[-.14,0,0]);
      for(const y of [-.19,-.203,-.216,-.229])B.add(root,'dark',rbox(.0026,.0085,.0018,.0008,1),surface(2.1,y,.0002),[0,2.1,0]);
      for(const [phi,y] of [[-.85,-.06],[.85,-.06],[-.9,-.135],[.9,-.135],[-.9,-.17],[.9,-.17],[-.82,-.262],[.82,-.262]])B.add(root,'dark',cylY(.0017,.0016,10).rotateX(Math.PI/2),surface(phi,y,.0003),[0,phi,0]);
      // Elbow actuator drum and bearings at the IK elbow.
      B.add(root,'accent',cylX(.027,.074,36),[0,-FOREARM,0]);
      for(const s of [-1,1]){B.add(root,'dark',cylX(.03,.008,36),[s*.041,-FOREARM,0]);B.add(root,'dark',cylX(.011,.006,20),[s*.047,-FOREARM,0]);}
      // Exposed wrist: pitch drum between yoke plates, ribbed roll actuator, palmar cable runs.
      B.add(root,'accent',cylX(.0142,.054,32),[0,0,0]);
      for(const s of [-1,1]){B.add(root,'dark',cylX(.0172,.0065,32),[s*.0302,0,0]);B.add(root,'dark',rbox(.0052,.034,.027,.0022,2),[s*.0358,-.013,0]);B.add(root,'accent',cylX(.006,.004,16),[s*.0391,0,0]);}
      B.add(root,'dark',cylY(.0205,.03,32,.022),[0,-.025,0]);
      for(const y of [-.015,-.022,-.029,-.036])B.add(root,'accent',ringY(.0212,.0012,40),[0,y,0]);
      for(const s of [-1,1]){const curve=new T.CatmullRomCurve3([[s*.017,-.046,-.022],[s*.019,-.034,-.0235],[s*.019,-.016,-.0205],[s*.017,.004,-.016]].map(p=>new T.Vector3(...p)));B.add(root,'rubber',new T.TubeGeometry(curve,24,.0021,8,false));}
    }
    buildPalm(B,w){
      B.add(w,'dark',rbox(.079,.088,.021,.006,3),[0,.057,-.001]);
      B.add(w,'shell',rbox(.0865,.074,.012,.0052,3,1.05),[0,.06,.0098]);
      B.add(w,'shell',rbox(.07,.017,.026,.0075,3),[0,.0135,0]);
      for(const x of [-.0148,.0148])B.add(w,'dark',rbox(.0013,.058,.0013,.0005,1),[x,.062,.0158]);
      B.add(w,'dark',rbox(.07,.0013,.0013,.0005,1),[0,.088,.0154]);
      B.add(w,'accent',rbox(.025,.0095,.0022,.0009,2),[.012,.03,.0161]);
      B.add(w,'glow',new T.SphereGeometry(.0023,12,8),[-.022,.03,.0163]);
      for(const s of [-1,1])B.add(w,'accent',rbox(.0062,.07,.018,.0026,2),[s*.0425,.058,0]);
      B.add(w,'dark',cylX(.0074,.081,28),[0,.097,0]);
      B.add(w,'rubber',rbox(.072,.06,.008,.0034,2),[0,.064,-.0118]);
      B.add(w,'rubber',rbox(.026,.04,.01,.0042,2),[-.025,.034,-.011],[0,0,.3]);
      B.add(w,'rubber',rbox(.022,.03,.008,.0034,2),[.026,.04,-.0115],[0,0,-.12]);
      for(const x of [-.012,.012])B.add(w,'dark',rbox(.0012,.05,.0012,.0004,1),[x,.062,-.016]);
    }
    phalanx(B,b,w,t,len,j,distal,metacarpal=false){
      B.add(b,'dark',cylX(t*.4,w*.9,24));
      for(const s of [-1,1])B.add(b,'accent',cylX(t*.31,.0026,24),[s*(w*.45+.0012),0,0]);
      B.add(b,'dark',rbox(w*.6,len*.9,t*.5,.0016,1),[0,len*.5,-t*.02]);
      if(distal){B.add(b,'shell',rbox(w*.94,len*.94,t*.6,w*.34,2,.82),[0,len*.5,t*.13]);B.add(b,'rubber',rbox(w*.8,len*.72,t*.4,t*.17,2,.85),[0,len*.5,-t*.18]);}
      else{B.add(b,'shell',rbox(w*.98,len*.86,t*.58,Math.min(w,t)*.22,2,.95),[0,len*.53,t*.16]);B.add(b,'rubber',rbox(w*.8,len*.64,t*.36,t*.14,2),[0,len*.52,-t*.21]);}
      if(j===0&&!metacarpal)B.add(b,'accent',rbox(w*.24,len*.42,.0014,.0006,1),[0,len*.52,t*.16+t*.29+.0003]);
      if(metacarpal)B.add(b,'accent',rbox(w*.6,len*.3,.0016,.0007,1),[0,len*.4,t*.16+t*.29+.0003]);
    }
    // grip 0 = flat open hand, ~0.4 relaxed, 1 = closed fist. Same signature as the former glove rig.
    setPose(grip=this.grip,blend=.25,spread=this.spread){
      grip=Math.max(0,Math.min(1,grip));this.grip=blend>=1?grip:this.grip+(grip-this.grip)*blend;this.spread=spread;const g=this.grip,open=1-g;
      const splay=[.1,.03,-.045,-.115];
      for(const finger of this.fingers){const f=finger.f,c=finger.chain,k=1+f*.045;c[0].rotation.set(-(.08+1.42*g)*k,0,splay[f]*(open*.8+spread));c[1].rotation.set(-(.12+1.62*Math.pow(g,.85))*Math.min(1.06,k),0,0);c[2].rotation.set(-(.07+.98*g),0,0);}
      this.thumbChain[0].quaternion.copy(this.thumbOpen).slerp(this.thumbFist,g);this.thumbChain[1].rotation.set(-(.12+.5*g),0,0);this.thumbChain[2].rotation.set(-(.1+.78*g),0,0);
      this.wrist.rotation.set(this.wristPitch,0,this.wristYaw);
    }
    setWrist(pitch=0,yaw=0){this.wristPitch=pitch;this.wristYaw=yaw;this.wrist.rotation.set(pitch,0,yaw);}
  }
  RobotHand.upperArm=upperArm;RobotHand.FOREARM=FOREARM;RobotHand.UPPER=UPPER;
  L.RobotHand=RobotHand;
})();
