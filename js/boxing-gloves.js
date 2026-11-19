/* Closed, padded boxing gloves. Canonical right thumb is -X; mirror once for left. */
(() => {
 'use strict';const L=window.IndoorLab,T=THREE;
 let leather;
 function texture(){if(leather)return leather;const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),pixels=g.createImageData(256,256);let seed=47;for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const v=120+(seed%29);pixels.data.set([v,v,v,255],i);}g.putImageData(pixels,0,0);leather=new T.CanvasTexture(c);leather.wrapS=leather.wrapT=T.RepeatWrapping;leather.repeat.set(3,3);return leather;}
 class BoxingGlove {
  constructor(side=1){this.grip=1;this.side=side;this.group=new T.Group();this.group.name=side<0?'左拳拳套':'右拳拳套';this.group.scale.x=side;this.glove=new T.Group();this.group.add(this.glove);this.skinMaterial=new T.MeshPhysicalMaterial({color:'#233e57',roughness:.44,metalness:0,bumpMap:texture(),bumpScale:.00035,clearcoat:.16,clearcoatRoughness:.58});this.skinMaterial.color.convertSRGBToLinear();const trim=new T.MeshStandardMaterial({color:'#a5abb0',roughness:.64,bumpMap:texture(),bumpScale:.00015}),seam=new T.MeshStandardMaterial({color:'#9da7ac',roughness:.8}),lining=new T.MeshStandardMaterial({color:'#182735',roughness:.87});
   const ellipsoid=(at,scale,mat=this.skinMaterial)=>{const mesh=new T.Mesh(new T.SphereGeometry(1,48,32),mat);mesh.position.set(...at);mesh.scale.set(...scale);this.glove.add(mesh);return mesh;};
   ellipsoid([0,.027,-.006],[.061,.078,.052]);ellipsoid([.003,.063,.023],[.053,.042,.034]);const thumb=ellipsoid([-.049,.008,.014],[.024,.044,.026]);thumb.rotation.z=-.32;
   const lathe=(profile,mat,parent=this.group)=>{const mesh=new T.Mesh(new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),48),mat);mesh.scale.z=.77;parent.add(mesh);return mesh;};lathe([[.032,-.145],[.042,-.125],[.044,-.08],[.04,-.044],[.034,-.035]],lining,this.glove);lathe([[.044,-.125],[.046,-.12],[.046,-.088],[.044,-.082]],trim,this.glove);
   const seamPoints=[[-.047,.017,-.039],[-.046,.065,-.041],[0,.097,-.036],[.045,.064,-.039],[.05,.015,-.039]].map(p=>new T.Vector3(...p)),curve=new T.CatmullRomCurve3(seamPoints);this.glove.add(new T.Mesh(new T.TubeGeometry(curve,48,.00065,6,false),seam));const patch=new T.Mesh(new T.BoxGeometry(.031,.017,.003),lining);patch.position.set(0,-.103,-.035);this.glove.add(patch);this.stats={glove:true,opaque:true,thumbSide:side<0?'right':'left'};
  }
  setPose(){this.grip=1;}
 }
 L.BoxingGlove=BoxingGlove;
})();
