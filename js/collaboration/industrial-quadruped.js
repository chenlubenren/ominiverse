/* Unbranded industrial quadruped, in metres. +Z is forward, +Y is up. */
(() => {
  'use strict';
  const C=window.CoScene,T=THREE;
  const K=C.quadrupedKinematics={upper:.32,lower:.34,hipHeight:.615,footRadius:.029,stance:.6,stride:.30,phasePerMetre:Math.PI*4};

  C.makeQuadruped=spec=>{
    const root=new T.Group(),body=new T.Group(),joints={},legs={};root.add(body);root.name=spec.name;root.scale.setScalar(spec.scale||1);
    const shell=C.material(spec.color,{roughness:.43,metalness:.22});
    const panel=C.material(C.robotPalette.shell,{roughness:.52,metalness:.30});
    const graphite=C.material(C.robotPalette.dark,{roughness:.58,metalness:.32});
    const rubber=C.material('#223346',{roughness:.85,metalness:.02});
    const aluminium=C.material('#838b91',{roughness:.34,metalness:.78});
    const lens=C.material('#172832',{roughness:.13,metalness:.62});
    const lensCoating=C.material('#355968',{roughness:.18,metalness:.65});
    const part=(p,g,m,s,pos,rot)=>C.part(p,g,m,s,pos,rot);
    const box=(p,m,size,pos,r=.015)=>part(p,C.roundedRobotBox(...size,r),m,[1,1,1],pos);
    const joint=(name,parent,pos)=>{const g=new T.Group();g.name=name;g.position.set(...pos);parent.add(g);joints[name]=g;return g;};
    const motor=(parent,side,radius=.073)=>{
      part(parent,'cylinder',graphite,[radius,.105,radius],[0,0,0],[0,0,Math.PI/2]);
      part(parent,'cylinder',panel,[radius*.91,.027,radius*.91],[side*.058,0,0],[0,0,Math.PI/2]);
      part(parent,'cylinder',graphite,[radius*.50,.030,radius*.50],[side*.074,0,0],[0,0,Math.PI/2]);
      part(parent,'cylinder',aluminium,[radius*.20,.031,radius*.20],[side*.076,0,0],[0,0,Math.PI/2]);
      for(let i=0;i<3;i++){const a=i*Math.PI*2/3;part(parent,'cylinder',aluminium,[.004,.005,.004],[side*.073,Math.cos(a)*radius*.72,Math.sin(a)*radius*.72],[0,0,Math.PI/2]);}
    };

    // Shorter faceted hull, segmented side shells and twin equipment rails.
    part(body,C.robotHousing([[.543,.248,.690],[.569,.340,.818],[.661,.360,.864],[.721,.310,.796]]),panel,[1,1,1]);
    box(body,panel,[.338,.052,.704],[0,.654,-.008],.018);
    box(body,graphite,[.220,.034,.610],[0,.733,-.025],.010);
    box(body,graphite,[.242,.042,.640],[0,.535,-.012],.014);
    for(const side of [-1,1]){
      for(const [z,length]of [[-.218,.285],[.151,.355]])box(body,shell,[.068,.089,length],[side*.143,.711,z],.022);
      box(body,aluminium,[.018,.020,.480],[side*.089,.759,-.045],.006);
      box(body,graphite,[.013,.039,.45],[side*.176,.616,-.006],.004);
      // Structural ribs and ventilation slots; no letters, decals, or logos.
      for(let i=0;i<5;i++)box(body,rubber,[.009,.023,.007],[side*.183,.622,-.11+i*.030],.002);
      box(body,graphite,[.020,.058,.040],[side*.176,.687,-.048],.007);
      part(body,'cylinder',lens,[.014,.006,.014],[side*.189,.691,-.048],[0,0,Math.PI/2]);
    }
    for(const front of [-1,1]){
      box(body,panel,[.249,.094,.030],[0,.661,front*.422],.016);
      box(body,graphite,[.140,.040,.013],[0,.668,front*.442],.008);
      part(body,'cylinder',lens,[.015,.015,.015],[.024,.668,front*.450],[Math.PI/2,0,0]);
      box(body,lensCoating,[.039,.012,.015],[-.034,.668,front*.451],.004);
      box(body,rubber,[.180,.020,.034],[0,.592,front*.408],.006);
    }
    if(spec.accessories?.includes('sensor')){
      part(body,C.robotHousing([[.752,.154,.132],[.800,.136,.114,-.010],[.822,.094,.092,-.018]]),panel,[1,1,1],[0,0,.175]);
      box(body,lens,[.073,.024,.009],[0,.788,.235],.005);
    }
    if(spec.accessories?.includes('antenna')){
      part(body,'cylinder',rubber,[.008,.14,.008],[-.09,.858,-.29]);
      part(body,'sphere',rubber,[.009,.009,.009],[-.09,.928,-.29]);
    }

    for(const [end,z]of [['front',.325],['rear',-.325]])for(const [sideName,side]of [['left',-1],['right',1]]){
      const name=end+'_'+sideName,abduction=joint(name+'_abduction',body,[side*.168,K.hipHeight,z]);
      box(abduction,graphite,[.092,.094,.118],[side*.036,0,0],.023);
      const hip=joint(name+'_hip',abduction,[side*.087,0,0]);motor(hip,side);
      // Upper link is a tapered, load-bearing casing, with a recessed drive cover.
      const upperGeometry=new T.CylinderGeometry(.052,.033,K.upper-.032,6);
      part(hip,upperGeometry,panel,[.77,1,1],[0,-K.upper/2,0],[0,Math.PI/6,0]);
      box(hip,panel,[.035,.174,.064],[side*.030,-.115,0],.012);
      box(hip,shell,[.009,.094,.044],[side*.051,-.088,0],.004);
      box(hip,rubber,[.009,.138,.026],[side*.050,-.121,0],.004);
      const knee=joint(name+'_knee',hip,[0,-K.upper,0]);
      part(knee,'cylinder',graphite,[.048,.084,.048],[0,0,0],[0,0,Math.PI/2]);
      part(knee,'cylinder',aluminium,[.025,.006,.025],[side*.044,0,0],[0,0,Math.PI/2]);
      part(knee,'cylinder',rubber,[.015,.008,.015],[side*.047,0,0],[0,0,Math.PI/2]);
      // Slender shin and elastomer foot. Foot has no powered ankle joint.
      part(knee,new T.CylinderGeometry(.024,.012,K.lower-.030,8),graphite,[.88,1,1],[0,-K.lower/2,0]);
      box(knee,shell,[.021,.112,.028],[side*.015,-.106,0],.007);
      part(knee,'cylinder',rubber,[.018,.066,.018],[0,-K.lower+.031,0]);
      const foot=part(knee,'sphere',rubber,[K.footRadius,K.footRadius,K.footRadius],[0,-K.lower,0]);foot.name=name+'_foot';
      legs[name]={abduction,hip,knee,foot,side,offset:(name==='front_left'||name==='rear_right')?0:Math.PI};
    }
    const descriptors=C.jointSchema('quadruped');
    root.userData={spec,joints,jointDescriptors:descriptors,legs,body,industrialQuadruped:true,height:(spec.accessories?.includes('antenna')?.94:spec.accessories?.includes('sensor')?.83:.77)*(spec.scale||1)};
    root.traverse(o=>{if(o.isMesh)o.userData.robotRoot=root;});
    C.animateQuadruped(root,0,false,false,0);return C.applyRobotRig(root,spec.rig);
  };

  C.animateQuadruped=(root,phase,moving=false,interacting=false,time=0)=>{
    const {body,legs}=root.userData;
    body.position.y=moving?Math.cos(phase*2)*.004:interacting?Math.sin(time*1.4)*.009:Math.sin(time*.9)*.002;
    for(const leg of Object.values(legs)){
      const cycle=((phase+leg.offset)/(Math.PI*2)%1+1)%1;
      let z=0,lift=0;
      if(moving){
        if(cycle<K.stance)z=K.stride*(.5-cycle/K.stance);
        else {const t=(cycle-K.stance)/(1-K.stance),smooth=t*t*(3-2*t);z=K.stride*(smooth-.5);lift=.072*Math.sin(Math.PI*t)**2;}
      }
      const spread=leg.side*.075,hipOffsetY=leg.side*.087*Math.sin(spread);
      const down=(K.hipHeight+body.position.y+hipOffsetY-K.footRadius-lift)/Math.cos(spread);
      const cosine=T.MathUtils.clamp((down*down+z*z-K.upper*K.upper-K.lower*K.lower)/(2*K.upper*K.lower),-1,1);
      const knee=-Math.acos(cosine),hip=Math.atan2(-z,down)-Math.atan2(K.lower*Math.sin(knee),K.upper+K.lower*Math.cos(knee));
      leg.abduction.rotation.z=spread;leg.hip.rotation.x=hip;leg.knee.rotation.x=knee;
      leg.foot.userData.stance=!moving||cycle<K.stance;
    }
  };
})();
