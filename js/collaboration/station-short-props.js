/* Film prop details. Root transforms and story anchors remain unchanged.
 * Call before the engine's wall-facing rotation and size normalization.
 */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE,clamp=T.MathUtils.clamp;
  C.enhanceStationShortProp=(film,p)=>{
    if(!p?.root||p.shortEnhanced)return p;p.shortEnhanced=true;
    const root=p.root,parts=p.parts,updates=[];
    const material=(color,opts={})=>film.material(color,opts);
    const ivory=material('#e8e9df',{roughness:.38}),dark=material('#172833',{roughness:.48}),metal=material('#8c9fa5',{metalness:.75,roughness:.25}),amber=material('#eda14a',{roughness:.34});
    const cyan=material('#7de4ee',{emissive:'#44baca',emissiveIntensity:.45,roughness:.25});
    const mesh=(parent,geometry,mat,name,position=[0,0,0])=>film.mesh(parent,geometry,mat,name,position);
    const box=(parent,size,mat,name,position=[0,0,0],radius=.008)=>mesh(parent,C.roundedRobotBox(...size,Math.min(radius,...size.map(v=>v*.4))),mat,name,position);
    const ring=(parent,r,t,mat,name,position=[0,0,0])=>mesh(parent,new T.TorusGeometry(r,t,8,40),mat,name,position);
    const sphere=(parent,r,mat,name,position=[0,0,0])=>mesh(parent,new T.SphereGeometry(r,16,12),mat,name,position);
    const tube=(parent,points,r,mat,name)=>mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),Math.max(12,points.length*3),r,5,false),mat,name);
    const group=(parent,name,position=[0,0,0])=>{const g=new T.Group();g.name=name;g.position.fromArray(position);parent.add(g);return g;};
    const keepOnly=(...keep)=>{for(const child of [...root.children])if(!keep.includes(child))root.remove(child);};
    if(p.kind==='crate'){
      keepOnly(parts.lid);
      const interior=material('#53656c',{roughness:.8}),warm=material('#f4d28a',{emissive:'#da9d4b',emissiveIntensity:.55,roughness:.5});
      box(root,[.70,.045,.52],interior,'货箱真实底板',[0,-.203,0]);
      for(const sign of [-1,1]){
        box(root,[.035,.45,.52],ivory,'货箱侧壁',[sign*.3325,0,0]);
        box(root,[.635,.45,.035],interior,'货箱前后壁',[0,0,sign*.2425]);
        box(root,[.045,.035,.53],metal,'箱口侧护边',[sign*.3275,.215,0]);
        box(root,[.65,.035,.035],metal,'箱口前后护边',[0,.215,sign*.2425]);
        box(root,[.017,.012,.39],warm,'箱内底部照明',[sign*.278,-.172,0]);
        box(root,[.045,.07,.014],amber,'箱体前锁扣',[sign*.16,.135,.267]);
      }
      box(root,[.57,.018,.39],dark,'箱内缓冲垫',[0,-.172,0]);
      for(let i=-2;i<=2;i++)box(root,[.012,.006,.35],interior,'缓冲垫排水槽',[i*.10,-.160,0]);
      if(parts.lid){
        box(parts.lid,[.59,.014,.40],interior,'箱盖内侧凹衬',[0,-.032,.26]);
        for(const sign of [-1,1])box(parts.lid,[.045,.04,.045],metal,'真实箱盖铰链',[sign*.22,0,.015]);
      }
    }else if(p.kind==='cup'){
      keepOnly(parts.lid,parts.fill);
      const glass=material('#b4e7eb',{transparent:true,opacity:.24,roughness:.12,metalness:.05,depthWrite:false,side:T.DoubleSide});
      mesh(root,new T.CylinderGeometry(.105,.10,.25,32,1,true),glass,'开口透明杯壁');
      mesh(root,new T.CylinderGeometry(.10,.10,.012,32),glass,'水杯真实底部',[0,-.119,0]);
      for(const y of [-.123,.125]){const r=ring(root,y>0?.106:.101,.006,y>0?metal:cyan,'杯口与杯底窄环',[0,y,0]);r.rotation.x=Math.PI/2;}
      const handle=mesh(root,new T.TorusGeometry(.052,.010,8,24,Math.PI*1.55),amber,'杯侧防脱握环',[.107,0,0]);handle.rotation.y=Math.PI/2;handle.rotation.z=-Math.PI*.275;
      for(let i=0;i<4;i++)box(root,[.026,.004,.004],ivory,'杯壁水位刻度',[-.021,-.065+i*.041,.102]);
      if(parts.lid){
        const gasket=ring(parts.lid,.094,.004,dark,'杯盖密封圈',[0,-.014,.105]);gasket.rotation.x=Math.PI/2;
        box(parts.lid,[.028,.014,.030],cyan,'杯盖锁合扣',[0,0,.208]);
      }
      if(parts.fill){parts.fill.material.transparent=true;parts.fill.material.opacity=.66;parts.fill.material.depthWrite=false;}
    }else if(p.kind==='net'&&p.variant==='containmentBubble'){
      keepOnly();delete parts.ring2;
      const glass=material('#99d9ed',{transparent:true,opacity:.19,roughness:.15,metalness:.08,depthWrite:false,side:T.DoubleSide});
      const shellFrame=material('#f1f4e7',{roughness:.30,metalness:.42}),sealMaterial=material('#e9ae4c',{emissive:'#b97123',emissiveIntensity:.22,roughness:.27});
      const top=group(root,'可开合上半球',[0,0,-.31]),bottom=group(root,'可开合下半球',[0,0,-.31]);
      mesh(top,new T.SphereGeometry(.31,32,16,0,Math.PI*2,0,Math.PI/2),glass,'透明上半球',[0,0,.31]);
      mesh(bottom,new T.SphereGeometry(.31,32,16,0,Math.PI*2,Math.PI/2,Math.PI/2),glass,'透明下半球',[0,0,.31]);
      for(const shell of [top,bottom]){
        const seam=ring(shell,.31,.014,shellFrame,'可见半球密封框',[0,0,.31]);seam.rotation.x=Math.PI/2;
        // Four physical ribs keep the enclosure legible in the twelve small
        // windows. Each belongs to its own half and opens with that half.
        const sign=shell===top?1:-1;
        for(let i=0;i<4;i++){
          const azimuth=i*Math.PI/2,points=[];
          for(let j=0;j<=12;j++){const angle=j*Math.PI/24;points.push([.31*Math.sin(angle)*Math.cos(azimuth),sign*.31*Math.cos(angle),.31+.31*Math.sin(angle)*Math.sin(azimuth)]);}
          tube(shell,points,.0085,shellFrame,'收容球实体支撑肋');
        }
      }
      sphere(root,.024,metal,'收容球铰接',[0,0,-.31]);
      const lock=group(root,'收容球闭合锁扣',[0,0,.31]);
      box(lock,[.10,.08,.039],dark,'闭合锁扣深色座');
      const lockTongue=box(lock,[.064,.034,.045],sealMaterial,'闭合锁舌',[0,.026,.012]);
      const lockLights=[];
      for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5])lockLights.push(sphere(root,.024,sealMaterial,'收容状态灯',[Math.cos(angle)*.345,.012,Math.sin(angle)*.345]));
      // The status ring sits outside the opaque seam (outer radius .324), so
      // its locked state remains visible from the closeup and every matrix view.
      const lockedRing=ring(root,.343,.012,sealMaterial,'捕获后亮起的锁定环',[0,.012,0]);lockedRing.rotation.x=Math.PI/2;
      const grip=ring(root,.055,.012,ivory,'收容球下方实物握把',[0,-.35,0]);
      parts.bubble=top;parts.bubbleTop=top;parts.bubbleBottom=bottom;parts.ring=grip;
      parts.captureLock=lock;parts.captureLockTongue=lockTongue;parts.captureLockedRing=lockedRing;
      p.shortOpen=0;
      updates.push((t,dt,state)=>{
        const alien=film.props.get('alien'),captured=!!film.facts?.resultFlags?.['visitor-contained']&&alien?.owner==='bubble'&&alien.attached;
        // Scripted time alone cannot award a green lock to a missed capture.
        const target=captured?0:state.contained?1:clamp(state.open||0,0,1);p.shortOpen+=(target-p.shortOpen)*(dt?1-Math.exp(-dt*7):1);top.rotation.x=-p.shortOpen*1.45;bottom.rotation.x=p.shortOpen*.13;
        const locked=captured&&p.shortOpen<.05;lockTongue.position.y=.026+p.shortOpen*.075;lockedRing.visible=locked;
        sealMaterial.color.set(locked?'#54f2a8':'#e9ae4c');sealMaterial.emissive.set(locked?'#21b873':'#b97123');sealMaterial.emissiveIntensity=locked?.45+.13*Math.sin(t*3.4):.18;
        glass.opacity=locked?.20:.17;p.captureVisual={captured,locked,open:p.shortOpen};
      });
    }else if(p.kind==='electric'){
      const alarm=group(root,'可见短路电弧');parts.arcs=[];
      const arcMat=material('#c6f7ff',{emissive:'#3b8fff',emissiveIntensity:2.2,roughness:.2}),haloMat=material('#267bff',{emissive:'#276aff',emissiveIntensity:1.2,transparent:true,opacity:.32,depthWrite:false});
      for(let i=0;i<4;i++){
        const a=-.19+i*.12,pts=[[a,-.24,.135],[a+.06,-.13,.16],[a-.025,-.06,.17],[a+.06,.035,.165],[a+.01,.12,.14],[a+.055,.22,.13]],arc=group(alarm,'闪电支路-'+i);
        tube(arc,pts,.006,arcMat,'蓝白电弧芯');tube(arc,pts,.015,haloMat,'蓝色电弧辉光');parts.arcs.push(arc);
      }
      const hazard=material('#ffc06a',{emissive:'#e98a33',emissiveIntensity:.2});
      const triangle=new T.Shape();triangle.moveTo(-.055,-.035);triangle.lineTo(.055,-.035);triangle.lineTo(0,.055);triangle.closePath();mesh(root,new T.ShapeGeometry(triangle),hazard,'电柜三角危险标',[0,-.20,.099]);
      if(parts.light){parts.light.material=material('#7ddfe6',{emissive:'#4ca5b3',emissiveIntensity:.3});}
      alarm.visible=false;parts.electricAlarm=alarm;
      updates.push((t,dt,state)=>{const active=Number(state.warning||0);alarm.visible=active>.01;parts.arcs.forEach((arc,i)=>{arc.visible=Math.sin(t*33+i*2.1)>.0;arc.scale.x=.85+.15*Math.sin(t*29+i);});if(parts.light){parts.light.material.color.set(active?'#ff8a39':'#7ddfe6');parts.light.material.emissive.set(active?'#ff4d1c':'#4ca5b3');parts.light.material.emissiveIntensity=active?.8+.5*Math.sin(t*14):.3;}});
    }else if(p.kind==='rift'){
      const red=material('#ff775d',{emissive:'#e93419',emissiveIntensity:.8,roughness:.3}),edge=material('#d5e5ea',{metalness:.8,roughness:.28});
      // Jagged metallic edges give the dark opening a visible physical depth.
      const left=[[-.035,-.27,.029],[.04,-.15,.031],[-.01,-.03,.029],[.07,.09,.032],[-.015,.27,.029]];
      const right=[[.035,-.29,.029],[.10,-.17,.032],[.05,-.03,.029],[.10,.12,.032],[-.015,.27,.029]];
      tube(root,left,.008,edge,'裂口翻卷金属左缘');tube(root,right,.008,edge,'裂口翻卷金属右缘');
      for(const sign of [-1,1]){
        const mark=box(root,[.052,.17,.012],red,'裂口红色警戒条',[sign*.20,0,.032]);mark.rotation.z=sign*.20;
        const arrow=new T.Shape();arrow.moveTo(-.034,-.025);arrow.lineTo(.034,0);arrow.lineTo(-.034,.025);arrow.closePath();const a=mesh(root,new T.ShapeGeometry(arrow),red,'指向泄漏的红箭头',[sign*.13,sign*.21,.032]);a.rotation.z=sign>0?Math.PI:0;
      }
      if(parts.warning)parts.warning.material=red;
      updates.push((t,dt,state)=>{const sealed=!!film.facts?.resultFlags?.['seal-leak']||state.sealed;red.emissiveIntensity=sealed?.06:.65+.30*Math.sin(t*8);red.color.set(sealed?'#79c7af':'#ff775d');if(parts.warning)parts.warning.visible=!sealed;});
    }else if(p.kind==='alien'&&p.variant!=='lightDot'){
      const pupils=[],whites=[],skins=[];root.traverse(o=>{if(o.name==='追踪瞳孔')pupils.push(o);if(o.name==='大眼白')whites.push(o);if(o.name==='外星团子'||o.name==='柔软的外星触须')skins.push(o);});
      const green=material('#35b866',{emissive:'#327d42',emissiveIntensity:.22,roughness:.29}),eye=material('#d5ffb6',{emissive:'#8bd658',emissiveIntensity:.38,roughness:.24}),pupilMat=material('#092b28',{roughness:.12,metalness:.2});
      skins.forEach(o=>o.material=green);whites.forEach(o=>{o.material=eye;o.scale.set(1.08,1.08,1.02);});
      pupils.forEach((o,i)=>{o.material=pupilMat;o.scale.set(1.15,1.23,.65);o.userData.shortRest=o.position.clone();sphere(o,.008,ivory,'外星眼睛高光',[-.009,.010,.024]);});
      parts.shortPupils=pupils;
      updates.push((t,dt,state)=>{
        const lead=film.anchor?.('lead','chest');if(lead){root.updateWorldMatrix(true,false);const direction=root.worldToLocal(lead.clone()).normalize();for(const o of pupils){o.position.copy(o.userData.shortRest);o.position.x+=clamp(direction.x,-1,1)*.022;o.position.y+=clamp(direction.y,-1,1)*.018;}}
        const blink=state.expression==='sleep'?.12:Math.max(.14,1-Math.pow(Math.max(0,Math.cos(t*1.9)),34)*.85);for(const o of pupils)o.scale.y=1.23*blink;
      });
    }
    const previous=p.shortUpdate;p.shortUpdate=(t,dt,state={})=>{previous?.(t,dt,state);for(const update of updates)update(t,dt,state);};
    return p;
  };
})();
