/* Shared architectural parts for the original orbital shell studies. */
(() => {
  'use strict';
  const T=THREE;
  window.StationConcepts=[];
  const color=value=>new T.Color(value).convertSRGBToLinear();
  const material=(hex,metalness=.3,roughness=.48,extra={})=>new T.MeshStandardMaterial({color:color(hex),metalness,roughness,...extra});
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const c=canvas.getContext('2d');
  c.fillStyle='#122b55';c.fillRect(0,0,512,512);
  for(let y=0;y<512;y+=32)for(let x=0;x<512;x+=64){c.fillStyle=(x+y)%96?'#224674':'#2e527e';c.fillRect(x+2,y+2,60,28);c.strokeStyle='#718aaa';c.lineWidth=.7;c.beginPath();c.moveTo(x+4,y+16);c.lineTo(x+60,y+16);c.stroke();}
  const solarMap=new T.CanvasTexture(canvas);solarMap.encoding=T.sRGBEncoding;solarMap.anisotropy=4;
  const materials={
    hull:material('#e1e5e5',.28,.42),silver:material('#91a4b1',.68,.36),graphite:material('#293845',.55,.4),blue:material('#335777',.48,.4),
    solar:material('#c0d6ed',.48,.38,{map:solarMap,side:T.DoubleSide}),gold:material('#baa074',.72,.36),glass:material('#163b4e',.55,.18,{emissive:color('#183546'),emissiveIntensity:.28}),
    light:material('#b7eeed',.1,.3,{emissive:color('#71d9db'),emissiveIntensity:1.15}),warmLight:material('#eed6a0',.1,.35,{emissive:color('#e9bd72'),emissiveIntensity:.9}),orange:material('#bf7150',.3,.48)
  };
  function mesh(parent,geometry,mat,position=[0,0,0],rotation=[0,0,0]){const m=new T.Mesh(geometry,typeof mat==='string'?materials[mat]:mat);if(!m.material)throw Error('Unknown shell material: '+mat);m.position.set(...position);m.rotation.set(...rotation);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function group(parent,position=[0,0,0],rotation=[0,0,0]){const g=new T.Group();g.position.set(...position);g.rotation.set(...rotation);parent.add(g);return g;}
  const box=(p,m,s,v,r)=>mesh(p,new T.BoxGeometry(...s),m,v,r);
  const cylinder=(p,m,rt,rb,l,v,r,segments=48)=>mesh(p,new T.CylinderGeometry(rt,rb,l,segments),m,v,r);
  const sphere=(p,m,r,v,scale=[1,1,1])=>{const o=mesh(p,new T.SphereGeometry(r,32,16),m,v);o.scale.set(...scale);return o;};
  const torus=(p,m,r,t,v=[0,0,0],rot=[Math.PI/2,0,0],arc=Math.PI*2)=>mesh(p,new T.TorusGeometry(r,t,10,Math.max(24,Math.ceil(128*arc/(Math.PI*2))),arc),m,v,rot);
  function beam(p,m,a,b,width=.2,depth=width){const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av),o=box(p,m,[width,delta.length(),depth],av.add(bv).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;}
  function hull(parent,{radius=1.6,length=7,position=[0,0,0],rotation=[0,0,0],material:mat='hull'}){
    const g=group(parent,position,rotation),cap=radius*.65,barrel=Math.max(.5,length-2*cap);
    cylinder(g,mat,radius,radius,barrel);for(const sign of [-1,1]){sphere(g,mat,radius,[0,sign*barrel/2,0],[1,.65,1]);cylinder(g,'graphite',radius*.56,radius*.56,.25,[0,sign*(length/2+.06),0]);torus(g,'silver',radius*.62,.085,[0,sign*(length/2+.2),0]);}
    for(const y of [-barrel*.4,0,barrel*.4])torus(g,'silver',radius+.012,.035,[0,y,0]);
    for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.sin(a)*(radius+.02),z=Math.cos(a)*(radius+.02);box(g,'silver',[.018,barrel*.86,.018],[x,0,z]);}
    return g;
  }
  function solar(parent,{width=8,height=16,position=[0,0,0],rotation=[0,0,0],cols=4,rows=8}){
    const g=group(parent,position,rotation);box(g,'graphite',[width+.18,height+.18,.15],[0,0,0]);box(g,'solar',[width,height,.035],[0,0,.094]);box(g,'solar',[width,height,.035],[0,0,-.094]);
    for(const x of [-width/2,width/2])box(g,'silver',[.10,height+.18,.22],[x,0,0]);for(const y of [-height/2,height/2])box(g,'silver',[width,.10,.22],[0,y,0]);
    for(let i=1;i<cols;i++)box(g,'silver',[.055,height,.24],[-width/2+width*i/cols,0,0]);for(let i=1;i<rows;i++)box(g,'silver',[width,.045,.24],[0,-height/2+height*i/rows,0]);return g;
  }
  function batch(source){
    source.updateMatrixWorld(true);const groups=new Map(),originals=new Set();let sourceParts=0;
    source.traverse(o=>{if(!o.isMesh)return;if(Array.isArray(o.material))throw Error('Shell parts require one material');sourceParts++;originals.add(o.geometry);let geo=o.geometry.clone();geo.applyMatrix4(o.matrixWorld);if(geo.index){const indexed=geo;geo=geo.toNonIndexed();indexed.dispose();}for(const key of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(key))geo.deleteAttribute(key);if(!geo.attributes.normal)geo.computeVertexNormals();if(!geo.attributes.uv)geo.setAttribute('uv',new T.BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(geo);});
    const root=new T.Group();for(const [mat,parts]of groups){const geo=T.BufferGeometryUtils.mergeBufferGeometries(parts,false);if(!geo)throw Error('Unable to combine shell details');geo.computeBoundingBox();geo.computeBoundingSphere();mesh(root,geo,mat);for(const p of parts)p.dispose();}for(const geo of originals)geo.dispose();
    const bounds=new T.Box3().setFromObject(root),center=bounds.getCenter(new T.Vector3());for(const o of root.children){o.geometry.translate(-center.x,-center.y,-center.z);o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();}
    root.userData={sourceParts,triangles:root.children.reduce((n,o)=>n+o.geometry.attributes.position.count/3,0)};return root;
  }
  window.StationShellKit={materials,mesh,group,box,cylinder,sphere,torus,beam,hull,solar,batch};
})();
