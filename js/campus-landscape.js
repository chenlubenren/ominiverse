/* The near-building landscape uses natural materials independently of facade themes. */
(() => {
  'use strict';
  const L=window.IndoorLab,T=THREE;

  L.createCampusLandscapeAppearance=materials=>{
    // Shared uniforms also reach the material copies used by floor fading and
    // moving scene overlaps. Only RGB changes; their opacity stays independent.
    const mix={value:0},white={siteEdge:'#d3dce3',lawn:'#e5e9ee',paving:'#eef1f4',stone:'#d6dfe5',joint:'#b6c4cf',soil:'#cbd5de',mulch:'#c5d0da',leaf:'#e2e8ed',leafLight:'#edf1f4',leafDeep:'#d2dce3',hedge:'#d9e2e8',grass:'#e3e9ed',flower:'#f0f3f5',flowerCream:'#e9eef2',bark:'#c6d0d8',wood:'#dce3e8',woodLight:'#e8edf1',metal:'#bdcbd6',lamp:'#f3f5f7',treeShadow:'#485969'};
    const register=(key,material)=>{
      const originalCompile=material.onBeforeCompile,originalCache=material.customProgramCacheKey.bind(material),cacheKey=originalCache(),modelColor={value:new T.Color(white[key]||'#e5e9ee').convertSRGBToLinear()};
      material.userData.campusAppearance=key;
      material.onBeforeCompile=function(shader,renderer){
        originalCompile.call(this,shader,renderer);shader.uniforms.campusNaturalMix=mix;shader.uniforms.campusModelColor=modelColor;
        shader.fragmentShader='uniform float campusNaturalMix;\nuniform vec3 campusModelColor;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n diffuseColor.rgb = mix(campusModelColor, diffuseColor.rgb, campusNaturalMix);');
        shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n totalEmissiveRadiance *= campusNaturalMix;');
      };
      material.customProgramCacheKey=()=>cacheKey+'|campus-appearance-v1';
      return material;
    };
    for(const [key,material]of Object.entries(materials))register(key,material);
    return{mix,register,setMix(value){if(Number.isFinite(value))mix.value=T.MathUtils.clamp(value,0,1);}};
  };

  function rounded(w,d,r){
    r=Math.min(r,w/2,d/2);const s=new T.Shape();
    s.moveTo(-w/2+r,-d/2);s.lineTo(w/2-r,-d/2);s.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);
    s.lineTo(w/2,d/2-r);s.quadraticCurveTo(w/2,d/2,w/2-r,d/2);s.lineTo(-w/2+r,d/2);
    s.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);s.lineTo(-w/2,-d/2+r);s.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);return s;
  }

  L.campusLandscapeMaterials=standard=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#728651';ctx.fillRect(0,0,128,128);let seed=7401;
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<5200;i++){ctx.fillStyle=i%3?'rgba(45,68,29,.10)':'rgba(193,201,129,.13)';ctx.fillRect(random()*128,random()*128,.5+random(),1+random()*2);}
    const lawnMap=new T.CanvasTexture(canvas);lawnMap.encoding=T.sRGBEncoding;lawnMap.wrapS=lawnMap.wrapT=T.RepeatWrapping;lawnMap.repeat.set(18,14);lawnMap.anisotropy=4;
    return{
      siteEdge:standard('#c5c4b9'),lawn:standard('#ffffff',{map:lawnMap,roughness:1,metalness:0}),
      paving:standard('#d2cec2',{roughness:.94}),stone:standard('#b5b1a5'),joint:standard('#aaa89c'),
      soil:standard('#625740'),mulch:standard('#85785b'),leaf:standard('#54733e',{roughness:1}),
      leafLight:standard('#739054',{roughness:1}),leafDeep:standard('#3f6035',{roughness:1}),
      hedge:standard('#67834a',{roughness:1}),grass:standard('#a1a568',{roughness:1,side:T.DoubleSide}),
      flower:standard('#c4b2c8',{roughness:1}),flowerCream:standard('#d8d0a2',{roughness:1}),
      bark:standard('#72614b',{roughness:1}),wood:standard('#a67e54',{roughness:.88}),
      woodLight:standard('#b99366',{roughness:.88}),metal:standard('#4d5852',{roughness:.72,metalness:.25}),
      lamp:standard('#eee5ca',{emissive:'#e4d6b0',emissiveIntensity:.25,roughness:.6})
    };
  };

  L.stabilizeCampusSurfaceDepth=(mesh,layer=1)=>{
    // Thin paving, stone borders and joints deliberately overlap by millimetres.
    // Keep their real walking heights, but separate their rasterized depth in
    // both the colour and SSAO normal passes. The shadow pass is unaffected.
    const material=mesh.material;material.polygonOffset=true;material.polygonOffsetFactor=-layer;material.polygonOffsetUnits=-layer;
    mesh.userData.campusSurfaceDepth=layer;
    const before=mesh.onBeforeRender,after=mesh.onAfterRender;let overridden=null;
    mesh.onBeforeRender=function(renderer,scene,camera,geometry,drawMaterial,group){
      before.call(this,renderer,scene,camera,geometry,drawMaterial,group);
      if(drawMaterial===this.material)return;
      overridden={material:drawMaterial,enabled:drawMaterial.polygonOffset,factor:drawMaterial.polygonOffsetFactor,units:drawMaterial.polygonOffsetUnits};
      drawMaterial.polygonOffset=true;drawMaterial.polygonOffsetFactor=-layer;drawMaterial.polygonOffsetUnits=-layer;
    };
    mesh.onAfterRender=function(renderer,scene,camera,geometry,drawMaterial,group){
      if(overridden){const saved=overridden;saved.material.polygonOffset=saved.enabled;saved.material.polygonOffsetFactor=saved.factor;saved.material.polygonOffsetUnits=saved.units;overridden=null;}
      after.call(this,renderer,scene,camera,geometry,drawMaterial,group);
    };
    return mesh;
  };

  L.createCampusGroundRoads=building=>{
    // The former four road boxes overlapped at their junctions and sat only
    // 14 cm above a continuous ground slab. A distant indoor camera can map
    // both surfaces to the same depth value, including in the AO normal pass.
    // Tile the same footprint once, without ground underneath the road tops.
    const groundY=-.9,roadY=-.76,roadBottom=-.82,extent=3000;
    const xs=[-extent,-250,-78,-68,68,78,250,extent],zs=[-extent,-250,-67,-57,57,67,250,extent];
    const ground=[],roads=[];
    const isRoad=(x,z)=>Math.abs(z)<250&&Math.abs(x)>68&&Math.abs(x)<78||Math.abs(x)<250&&Math.abs(z)>57&&Math.abs(z)<67;
    const quad=(vertices,a,b,c,d)=>vertices.push(...a,...b,...d,...b,...c,...d);
    const cells=Array.from({length:xs.length-1},(_,i)=>Array.from({length:zs.length-1},(_,j)=>isRoad((xs[i]+xs[i+1])/2,(zs[j]+zs[j+1])/2)));
    for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
      const x0=xs[i],x1=xs[i+1],z0=zs[j],z1=zs[j+1],road=cells[i][j],y=road?roadY:groundY;
      quad(road?roads:ground,[x0,y,z0],[x0,y,z1],[x1,y,z1],[x1,y,z0]);
      if(!road)continue;
      // Close just the road network's perimeter; internal junctions have no
      // duplicate top faces or hidden walls that could leak into shadow maps.
      quad(roads,[x0,roadBottom,z0],[x1,roadBottom,z0],[x1,roadBottom,z1],[x0,roadBottom,z1]);
      if(!cells[i-1]?.[j])quad(roads,[x0,roadBottom,z0],[x0,roadBottom,z1],[x0,roadY,z1],[x0,roadY,z0]);
      if(!cells[i+1]?.[j])quad(roads,[x1,roadBottom,z1],[x1,roadBottom,z0],[x1,roadY,z0],[x1,roadY,z1]);
      if(!cells[i]?.[j-1])quad(roads,[x1,roadBottom,z0],[x0,roadBottom,z0],[x0,roadY,z0],[x1,roadY,z0]);
      if(!cells[i]?.[j+1])quad(roads,[x0,roadBottom,z1],[x1,roadBottom,z1],[x1,roadY,z1],[x0,roadY,z1]);
    }
    const meshes=[];
    for(const [name,vertices,material,key]of [['城市地面',ground,building.materials.pale,'ground'],['园区周边道路',roads,building.materials.road,'road']]){
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
      const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.userData.campusSurface=key;mesh.castShadow=mesh.receiveShadow=true;building.world.add(mesh);meshes.push(mesh);
    }
    // Navigation records stay in createWorld's original order: its first four
    // boxes are walkable site surfaces, followed by landscape/city obstacles.
    return meshes;
  };

  L.createCampusLandscape=building=>{
    const root=new T.Group();root.name='园区 · 草坪、树荫与休憩花园';root.userData.campusLandscape=true;building.world.add(root);building.landscape=root;
    const mats=building.landscapeMaterials,batches=new Map(),pose=new T.Object3D(),unitBox=new T.BoxGeometry(1,1,1),surfaceMaterials=new Map();
    const surfaceMaterial=key=>{if(!surfaceMaterials.has(key)){const source=mats[key],material=source.clone();material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=source.customProgramCacheKey;surfaceMaterials.set(key,material);}return surfaceMaterials.get(key);};
    const cylinder=new T.CylinderGeometry(.5,.62,1,9),sphere=new T.IcosahedronGeometry(.5,2);
    // Irregular crown surfaces keep trees from reading as perfectly round model spheres.
    const vertices=sphere.attributes.position;for(let i=0;i<vertices.count;i++){const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i),f=1+.08*Math.sin(x*28+y*19+z*37);vertices.setXYZ(i,x*f,y*f,z*f);}sphere.computeVertexNormals();
    const geometries={box:unitBox,cylinder,crown:sphere};
    const add=(key,shape,w,h,d,x,y,z,rotation=0,tilt=0)=>{
      const id=key+':'+shape;if(!batches.has(id))batches.set(id,{key,shape,items:[]});batches.get(id).items.push({w,h,d,x,y,z,rotation,tilt});
    };
    const obstacle=(x,z,w,d,h,y=h/2)=>building.outdoorBoxes.push({x,z,w,d,h,y,landscape:true});
    const box=(key,w,h,d,x,y,z,solid=false)=>{add(key,'box',w,h,d,x,y,z);if(solid)obstacle(x,z,w,d,h,y);};
    const surface=(name,x,z,w,d,r=.8,y=.09,key='paving')=>{
      const mesh=new T.Mesh(new T.ShapeGeometry(rounded(w,d,r),24),surfaceMaterial(key));mesh.name=name;mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);mesh.receiveShadow=true;L.stabilizeCampusSurfaceDepth(mesh);root.add(mesh);
      if(key==='paving'||key==='wood')building.outdoorWalkways.push({x,z,w,d,r,y});return mesh;
    };
    const ring=(name,w,d,width,r,y,key,walk=false)=>{
      const shape=rounded(w,d,r),hole=rounded(w-width*2,d-width*2,r-width);shape.holes.push(new T.Path(hole.getPoints().reverse()));
      const mesh=new T.Mesh(new T.ShapeGeometry(shape,40),surfaceMaterial(key));mesh.name=name;mesh.rotation.x=-Math.PI/2;mesh.position.y=y;mesh.receiveShadow=true;L.stabilizeCampusSurfaceDepth(mesh,key==='stone'?2:1);root.add(mesh);
      if(walk)building.outdoorWalkways.push({x:0,z:0,w,d,width,r,y});
    };
    // Retain both continuous pedestrian loops and their exact navigation heights.
    ring('外环浅石步道',126,100,6,15,.05,'paving',true);ring('内环浅石步道',88,66,4.7,11,.08,'paving',true);
    ring('外环石材收边',114.4,88.4,.28,9.2,.055,'stone');ring('内环石材收边',79.1,57.1,.24,6.55,.085,'stone');
    surface('主入口前广场',0,37,28,15,1.8,.11);
    surface('无障碍入口连接',0,38.5,6,23,.08,.115);
    const ramp=new T.Mesh(new T.BoxGeometry(6,.12,6.03),surfaceMaterial('paving'));ramp.name='主入口无障碍缓坡';ramp.position.set(0,.32,24);ramp.rotation.x=Math.atan(.54/6);ramp.receiveShadow=true;L.stabilizeCampusSurfaceDepth(ramp);root.add(ramp);
    // A few widely spaced joints give the plaza a real paving scale.
    for(let x=-12;x<=12;x+=3)box('joint',.025,.008,14,x,.117,37);
    for(let z=31;z<=43;z+=3)box('joint',27,.008,.025,0,.118,z);
    for(const x of [-49,49])for(const z of [-15,15])surface('环道之间的花园支路',x,z,18,3.4,.6,.09);
    for(const x of [-44,44])surface('园区巡检停留区',x,29.5,12,7,1.4,.095);
    surface('北侧林下平台',0,-36.5,27,6,1.2,.09);

    let seed=9107;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    function bed(x,z,w,d,{flowers=true}={}){
      surface('低矮混合花境',x,z,w,d,Math.min(1,d/2),-.10,'soil');
      obstacle(x,z,w,d,.65,.20);
      const count=Math.ceil(w*d/1.9);
      for(let i=0;i<count;i++){
        const px=x+(random()-.5)*(w-.7),pz=z+(random()-.5)*(d-.5),size=.8+random()*.7;
        add(i%3?'hedge':'leafLight','crown',size,.5+random()*.45,size*.8,px,.22,pz,random()*6);
        if(flowers&&i%2===0){const h=.55+random()*.35;for(let k=0;k<3;k++){const dx=(random()-.5)*.45,dz=(random()-.5)*.4;add('grass','cylinder',.045,h,.045,px+dx,h/2,pz+dz);add(i%4?'flower':'flowerCream','crown',.23,.16,.23,px+dx,h,pz+dz);}}
      }
    }
    // Planting remains inside lawn compartments, with gaps beside every route.
    for(const sign of [-1,1]){
      bed(sign*25,38,17,4.5);bed(sign*32,-23,9,3.2,{flowers:false});
      bed(sign*32,22,9,3.2);bed(sign*52,-34,6,4.5,{flowers:false});
      bed(sign*52,35,6,3.4);bed(sign*32,0,3.8,13,{flowers:false});
    }
    bed(0,-42,22,3.4);

    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;const ctx=shadowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,3,32,32,31);
    gradient.addColorStop(0,'rgba(25,42,20,.24)');gradient.addColorStop(.6,'rgba(25,42,20,.12)');gradient.addColorStop(1,'rgba(25,42,20,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    const treeShadow=new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,toneMapped:false});building.landscapeAppearance.register('treeShadow',treeShadow);
    const treePositions=[];
    function tree(x,z,scale=1){
      const h=(6.6+random()*1.1)*scale,trunk=.38*scale;
      add('bark','cylinder',trunk,h*.72,trunk,x,h*.36-.12,z);obstacle(x,z,trunk+.15,trunk+.15,h*.72,h*.36-.12);
      for(let i=0;i<3;i++){const angle=i*2.1+random()*.6;add('bark','cylinder',trunk*.38,h*.30,trunk*.38,x+Math.sin(angle)*.52*scale,h*.60,z+Math.cos(angle)*.52*scale,angle,.45);}
      for(let i=0;i<6;i++){const angle=i*2.4,r=i===0?0:(1.15+random()*.5)*scale,diam=(3.9+random())*scale;
        add(['leaf','leafLight','leafDeep'][i%3],'crown',diam,diam*(.75+random()*.2),diam,x+Math.sin(angle)*r,h*.72+(i%3)*.38*scale,z+Math.cos(angle)*r,angle);
      }
      const shade=new T.Mesh(new T.PlaneGeometry(9*scale,7*scale),treeShadow);shade.name='树冠柔和投影';shade.rotation.x=-Math.PI/2;shade.position.set(x+.9,.125,z+.6);shade.userData.noAO=true;root.add(shade);treePositions.push({x,z,height:h});
      surface('树穴覆盖物',x,z,1.4*scale,1.4*scale,.7*scale,-.135,'mulch');
    }
    for(const sign of [-1,1]){
      for(const z of [-36,-4,30])tree(sign*52,z,.9+random()*.16);
      for(const z of [-19,-7,8,20])tree(sign*31,z,.94+random()*.15);
      for(const x of [18,34])tree(sign*x,39,1+random()*.10);
      for(const x of [17,36])tree(sign*x,-40,1+random()*.10);
    }

    function bench(x,z,alongX=true){
      const w=alongX?3.4:.68,d=alongX?.68:3.4;obstacle(x,z,w,d,.9,.50);
      for(let i=0;i<4;i++)box(i%2?'woodLight':'wood',alongX?3.4:.14,.11,alongX?.14:3.4,x+(alongX?0:(i-1.5)*.17),.55,z+(alongX?(i-1.5)*.17:0));
      for(const offset of [-1.2,1.2])box('metal',alongX?.12:.52,.45,alongX?.52:.12,x+(alongX?offset:0),.28,z+(alongX?0:offset));
      for(const h of [.84,1.02])box('wood',alongX?3.4:.11,.13,alongX?.11:3.4,x+(alongX?0:.36),h,z+(alongX?.36:0));
    }
    for(const sign of [-1,1]){bench(sign*18,35);bench(sign*34,35);bench(sign*29,-16,false);bench(sign*29,16,false);}
    bench(-7,-36.5);bench(7,-36.5);

    function pavilion(x,z){
      surface('木质休憩亭平台',x,z,9,7,.3,.13,'wood');
      for(let i=-4;i<=4;i++)box('joint',.025,.008,6.8,x+i,.136,z);
      for(const dx of [-4,4])for(const dz of [-3,3])box('metal',.18,3.25,.18,x+dx,1.75,z+dz,true);
      for(const dz of [-3.2,3.2])box('wood',9.2,.22,.16,x,3.35,z+dz);
      for(let i=-5;i<=5;i++)box(i%2?'woodLight':'wood',.28,.20,6.6,x+i*.83,3.47,z);
      // Open sides and a clear central aisle make the pergola accessible from both loops.
      bench(x,z-2.2);bench(x,z+2.2);
    }
    pavilion(-49,-15);pavilion(49,15);

    function lamp(x,z){
      add('metal','cylinder',.11,3.5,.11,x,1.86,z);obstacle(x,z,.22,.22,3.5,1.86);
      box('metal',.85,.10,.40,x+.32,3.62,z);box('lamp',.65,.025,.30,x+.32,3.555,z);
    }
    for(const x of [-10,10])for(const z of [29,43])lamp(x,z);
    for(const sign of [-1,1])for(const z of [-28,2,26])lamp(sign*45.8,z);

    // Slim inverted-U bicycle stands on a dedicated side pad, away from arrivals.
    surface('自行车停放区',-45,8,8,4,1,.10);
    for(let i=0;i<5;i++){
      const x=-48+i*1.4,z=8;obstacle(x,z,.16,1.1,1.0,.61);
      for(const dz of [-.48,.48])add('metal','cylinder',.07,.9,.07,x,.55,z+dz);
      add('metal','cylinder',.07,.96,.07,x,1,z,0,Math.PI/2);
    }

    for(const {key,shape,items}of batches.values()){
      const mesh=new T.InstancedMesh(geometries[shape],mats[key],items.length);mesh.name='园区 '+key+' '+shape;mesh.userData.campusLandscape=true;
      for(let i=0;i<items.length;i++){const a=items[i];pose.position.set(a.x,a.y,a.z);pose.scale.set(a.w,a.h,a.d);pose.rotation.set(a.tilt,a.rotation,0);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);}
      mesh.castShadow=key!=='joint';mesh.receiveShadow=true;root.add(mesh);
      if(key==='joint')L.stabilizeCampusSurfaceDepth(mesh,3);
    }
    root.userData.treeCount=treePositions.length;root.userData.treePositions=treePositions;root.userData.pavilions=2;root.userData.benches=14;
    root.updateMatrixWorld(true);return root;
  };
})();
