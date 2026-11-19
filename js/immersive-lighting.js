/* Low-angle window light, stronger contact occlusion and distinct PBR surfaces. */
(() => {
  'use strict';const L=window.IndoorLab,T=THREE;
  class ImmersiveLighting {
    constructor(view){this.v=view;this.aoCache=new Map();}
    material(model){if(model.userDataImmersiveStyle===this.v.pipeline.style)return;model.userDataImmersiveStyle=this.v.pipeline.style;
      model.group.traverse(o=>{if(!o.isMesh||!o.material||o.userData.ceiling)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m.userData.styleLocked||!m.isMeshStandardMaterial&&!m.isMeshPhysicalMaterial)continue;const role=o.name;m.envMapIntensity=['metal','glass'].includes(role)?.65:.26;m.roughness=({floor:.32,wall:.88,desk:.44,wood:.65,metal:.28,chair:.72,fabric:.9,screen:.2,glass:.08})[role]??.72;if(role==='metal')m.metalness=.7;if(role==='floor'){m.bumpMap=this.floorTexture();m.bumpScale=.009;}if(role==='wall'){m.bumpMap=this.plasterTexture();m.bumpScale=.0025;}}});
    }
    floorTexture(){if(this.floorMap)return this.floorMap;const c=document.createElement('canvas');c.width=c.height=1024;const g=c.getContext('2d');g.fillStyle='#a4a4a4';g.fillRect(0,0,1024,1024);g.strokeStyle='#777';g.lineWidth=2;for(let n=0;n<=1024;n+=256){g.beginPath();g.moveTo(n,0);g.lineTo(n,1024);g.moveTo(0,n);g.lineTo(1024,n);g.stroke();}const tex=this.floorMap=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(7,5);tex.anisotropy=this.v.renderer.capabilities.getMaxAnisotropy();return tex;}
    plasterTexture(){if(this.plaster)return this.plaster;const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.fillStyle='#808080';g.fillRect(0,0,512,512);let seed=93;for(let i=0;i<35000;i++){seed=(seed*1664525+1013904223)>>>0;const x=seed%512;seed=(seed*1664525+1013904223)>>>0;g.fillStyle=i%2?'#858585':'#7b7b7b';g.fillRect(x,seed%512,1,1);}const t=this.plaster=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(10,4);return t;}
    contact(model,mirror){const floor=model.towerFloor,version=(model.physicsVersion||0)+':'+mirror;let entry=this.aoCache.get(floor);if(entry&&entry.version===version){entry.mesh.visible=true;return;}if(entry&&entry.mirror===mirror&&performance.now()<(entry.nextBake||0)){entry.mesh.visible=true;return;}
      if(entry){this.v.scene.remove(entry.mesh);entry.mesh.geometry.dispose();entry.mesh.material.map.dispose();entry.mesh.material.dispose();this.aoCache.delete(floor);}
      const c=document.createElement('canvas');c.width=2048;c.height=1479;const g=c.getContext('2d'),sx=c.width/36,sz=c.height/26;
      g.beginPath();for(const [w,d,x,z] of L.towerSlabTiles)g.rect((x+18-w/2)*sx,(z+13-d/2)*sz,w*sx,d*sz);g.clip();
      g.fillStyle=mirror?'#262132':'#102137';
      for(const b of [...model.layoutItems,...model.doorSolids,...(model.dynamicSolids||[])]){
        if(b.destroyed||b.ignore||b.navigationOnly||b.y-b.h/2>.20||b.h<.06||['floor','blue','glass','roomGlass'].includes(b.key))continue;
        const w=b.w*sx,d=b.d*sz;
        g.save();g.translate((b.x+18)*sx,(b.z+13)*sz);g.rotate(-(b.rotation||0));
        g.shadowColor=mirror?'#302533':'#182c48';
        g.globalAlpha=b.wall?.30:.23;g.shadowBlur=mirror?(b.wall?3:2):(b.wall?7:5);g.fillRect(-w/2,-d/2,w,d);g.restore();
      }
      const texture=new T.CanvasTexture(c);texture.anisotropy=this.v.renderer.capabilities.getMaxAnisotropy();const mesh=new T.Mesh(new T.PlaneGeometry(36,26),new T.MeshBasicMaterial({map:texture,transparent:true,opacity:mirror?.58:.65,depthWrite:false,toneMapped:false}));mesh.material.polygonOffset=true;mesh.material.polygonOffsetFactor=-1;mesh.material.polygonOffsetUnits=-2;mesh.rotation.x=-Math.PI/2;mesh.position.y=.009;mesh.userData.noAO=true;mesh.name='第一人称接触阴影';this.v.scene.add(mesh);this.v.pipeline._aoExcluded=null;entry={mesh,version,mirror,nextBake:performance.now()+1800};this.aoCache.set(floor,entry);while(this.aoCache.size>3){const [key,old]=this.aoCache.entries().next().value;this.v.scene.remove(old.mesh);old.mesh.geometry.dispose();old.mesh.material.map.dispose();old.mesh.material.dispose();this.aoCache.delete(key);}
    }
    update(){const v=this.v,active=!!L.continuousTower?.active;for(const e of this.aoCache.values())e.mesh.visible=false;
      if(!active){if(this.active){this.active=false;v.sun.position.copy(this.saved.sun);v.sun.target.position.copy(this.saved.target);Object.assign(v.sun.shadow.camera,this.saved.shadow);v.sun.shadow.camera.updateProjectionMatrix();for(const [light,intensity]of this.saved.lights)light.intensity=intensity;v.pipeline.ssao.copyMaterial.uniforms.officeAOContrast.value=1;v.pipeline.setStyle(v.pipeline.style);v.pipeline.ssao.kernelRadius=.56;v.pipeline._aoExcluded=null;}return;}
      const t=L.continuousTower,style=v.pipeline.style,key=t.origin+':'+style+':'+t.worldWalk.outside;if(!this.active){const c=v.sun.shadow.camera;this.saved={sun:v.sun.position.clone(),target:v.sun.target.position.clone(),shadow:{left:c.left,right:c.right,top:c.top,bottom:c.bottom,near:c.near,far:c.far},lights:v.scene.children.filter(l=>l.isLight).map(l=>[l,l.intensity])};}this.active=true;// The presentation pipeline supplies the same PBR finish quality to every palette.
      const mirror=style==='mirror-edge';
      const profiles={access:[3.1,.26,.30,.88],editorial:[2.1,.18,.22,.83],moodboard:[3.1,.28,.28,.94],'soft-home':[2.7,.38,.38,.96],surreal:[2.5,.45,.36,.94],daylight:[3.6,.18,.23,.90],archviz:[2.9,.18,.25,.96],'mirror-edge':[3.75,.13,.20,.91]},p=profiles[style]||profiles.access;
      v.renderer.toneMappingExposure=p[3];v.sun.intensity=p[0];v.fill.intensity=p[1];for(const light of v.scene.children){if(light.isHemisphereLight)light.intensity=p[2];if(light.isAmbientLight)light.intensity=.025;}
      if(this.key!==key){
        this.key=key;
        if(style==='mirror-edge')v.sun.position.set(-18,10,29);
        else if(style==='archviz')v.sun.position.set(-21,11,26);
        else v.sun.position.set(style==='daylight'?-22:-26,style==='daylight'?13:9,style==='daylight'?12:7);
        v.sun.target.position.set(0,1.25,0);
        Object.assign(v.sun.shadow.camera,{left:-23,right:23,top:17,bottom:-17,near:.3,far:70});
        // Change shadow coverage, keeping the physical sunlight direction fixed.
        if(t.worldWalk.outside){
          const direction=v.sun.position.clone().sub(v.sun.target.position).multiplyScalar(8);
          // Exterior shadows belong to the building's absolute coordinates,
          // including the frame where a falling player rebases onto the ground.
          v.sun.target.position.y=20-(t.origin-1)*3.6;
          v.sun.position.copy(v.sun.target.position).add(direction);
          Object.assign(v.sun.shadow.camera,{left:-85,right:85,top:100,bottom:-80,near:1,far:640});
        }
        v.sun.shadow.camera.updateProjectionMatrix();v.sun.shadow.bias=-.000055;v.sun.shadow.normalBias=.009;v.shadowDirty=true;v.renderer.shadowMap.needsUpdate=true;v.pipeline._aoExcluded=null;
      }
      // Bake before reaching the entrance, rather than allocating/uploading a
      // large canvas texture in the first indoor frame.
      // A moving cabin and an exterior fall do not use the floor's contact
      // decal. Avoid rebaking/uploading floor textures during vertical travel.
      if(t.player.location!=='lift'&&(!t.worldWalk.outside||t.origin===1&&Math.hypot(v.camera.position.x,v.camera.position.z)<45))this.contact(v.model,style==='mirror-edge');
      v.pipeline.ssao.kernelRadius=mirror?.25:.39;
      v.pipeline.ssao.copyMaterial.uniforms.officeAOContrast.value=mirror?1.55:1.29;
    }
  }
  L.ImmersiveLighting=ImmersiveLighting;
})();
