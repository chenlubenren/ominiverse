/* Shared PBR finishes and practical lighting for the architectural theme. */
(() => {
  'use strict';
  const L=window.IndoorLab, T=THREE;
  const FINISHES={
    floor:{texture:'parquet',meters:[3.4,3.4],normal:.35,roughness:.82,env:.42},
    wall:{texture:'plaster',meters:[2.4,2.4],normal:.14,roughness:.88,env:.28,neutralPaint:true},
    desk:{texture:'timber',meters:[1.15,1.15],normal:.26,roughness:.9,env:.46},
    wood:{texture:'timber',meters:[1.15,1.15],normal:.26,roughness:.92,env:.4},
    chair:{texture:'fabric',meters:[.42,.42],normal:.28,roughness:1,env:.22},
    fabric:{texture:'fabric',meters:[.42,.42],normal:.28,roughness:1,env:.22},
    metal:{roughness:.32,metalness:.62,env:.9},doorPanel:{roughness:.29,metalness:.65,env:.95},
    glass:{roughness:.11,metalness:.1,env:1},
    screen:{roughness:.24,env:.72}
  };
  const MIRROR={
    floor:{roughness:.23,env:.49},ceiling:{roughness:.18,env:.53},
    wall:{roughness:.37,env:.33},desk:{roughness:.26,env:.47},
    wood:{roughness:.44,env:.4},chair:{roughness:.5,env:.3},
    doorPanel:{roughness:.23,metalness:.66,env:1.05},
    metal:{roughness:.28,metalness:.54,env:.82},doorTrim:{roughness:.25,metalness:.18,env:.74},
    glass:{roughness:.08,env:.76},screen:{roughness:.18,env:.65}
  };
  const PAINTED={floor:{roughness:.25,env:.55},ceiling:{roughness:.32,env:.4},wall:{texture:'plaster',meters:[2.4,2.4],normal:.10,roughness:.70,env:.35,neutralPaint:true},desk:{roughness:.30,env:.57},wood:{roughness:.40,env:.5},chair:{texture:'fabric',meters:[.42,.42],normal:.18,roughness:.68,env:.38,neutralPaint:true},fabric:{roughness:.78,env:.32},metal:{roughness:.25,metalness:.65,env:1},doorPanel:{roughness:.24,metalness:.66,env:1},doorTrim:{roughness:.25,metalness:.6,env:.9},glass:{roughness:.08,metalness:.1,env:.95},screen:{roughness:.19,env:.65}};
  const BAYS=[[-17.7,-12.7],[-12.7,-7.7],[-7.7,-3.2],[3.2,7.7],[7.7,12.7],[12.7,17.7]];

  // Tower surfaces share unit boxes. Derive tile dimensions from the instance
  // transform, with one continuous projection across the top of each slab tile.
  const meterUV=`
    #if defined(USE_UV) && defined(USE_INSTANCING)
      vec3 extent = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
      vec3 face = abs(normal);
      vec2 size = face.x > .5 ? extent.zy : (face.y > .5 ? extent.xz : extent.xy);
      vec2 meters = uv * size;
      #if OFFICE_PARQUET
        if (face.y > .5) {
          vec3 point = (instanceMatrix * vec4(position, 1.0)).xyz;
          meters = vec2(point.x, -point.z);
        }
      #endif
      vUv = (uvTransform * vec3(meters, 1.0)).xy;
    #endif
  `;

  class ArchvizSurfaces {
    constructor(view){
      this.view=view;
      this.maps=new Map();
      this.original=new WeakMap();
      this.reflection=new L.ArchvizReflection(view);
      this.ceilingReflection=new L.ArchvizReflection(view,{offset:3.24,side:-1});
      this.direction=new T.Vector3();
      this.localFile=location.protocol==='file:';
    }
    textures(finish){
      const loader=new T.TextureLoader();
      const load=(map,color=false)=>{
        const texture=loader.load(new URL(`assets/archviz/${finish.texture}-${map}.jpg`,document.baseURI).href);
        texture.officeShared=true;
        texture.wrapS=texture.wrapT=T.RepeatWrapping;
        texture.repeat.set(1/finish.meters[0],1/finish.meters[1]);
        texture.anisotropy=Math.min(8,this.view.renderer.capabilities.getMaxAnisotropy());
        if(color)texture.encoding=T.sRGBEncoding;
        return texture;
      };
      if(!this.maps.has(finish.texture))this.maps.set(finish.texture,{normalMap:load('normal'),roughnessMap:load('rough')});
      const maps=this.maps.get(finish.texture);if(!finish.neutralPaint&&!maps.map)maps.map=load('color',true);
      return {...maps,map:finish.neutralPaint?null:maps.map};
    }
    apply(material,role,style){
      const current=this.original.get(material);
      if(current&&current.style!==style)this.restore(material);
      const mirror=style==='mirror-edge',finish=(mirror?MIRROR:style==='archviz'?FINISHES:PAINTED)[role];
      if(!finish)return;
      if(!this.original.has(material)){
        this.original.set(material,{
          style,properties:{
          map:material.map,normalMap:material.normalMap,roughnessMap:material.roughnessMap,
          bumpMap:material.bumpMap,roughness:material.roughness,metalness:material.metalness,
          normalScale:material.normalScale,onBeforeCompile:material.onBeforeCompile,
          customProgramCacheKey:material.customProgramCacheKey
          }
        });
        const textured=finish.texture&&!this.localFile;
        const reflection=role==='floor'?this.reflection:role==='ceiling'?this.ceilingReflection:null;
        if(mirror)material.bumpMap=null;
        if(textured){
          Object.assign(material,this.textures(finish));
          material.normalScale=new T.Vector2(finish.normal,finish.normal);
          material.bumpMap=null;
        }
        if(textured||reflection){
          const projection=textured?meterUV.replace('OFFICE_PARQUET',role==='floor'?'1':'0'):'';
          material.onBeforeCompile=shader=>{
            shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n'+projection);
            reflection?.install(shader);
          };
          material.customProgramCacheKey=()=>`${style}-${role}-${textured?'meters':'flat'}`;
          material.needsUpdate=true;
        }
      }
      material.roughness=finish.roughness;
      material.metalness=finish.metalness??0;
      material.envMapIntensity=finish.env;
    }
    restore(material){
      const original=this.original.get(material);
      if(!original)return;
      Object.assign(material,original.properties);
      this.original.delete(material);
      material.needsUpdate=true;
    }
    createLights(){
      const group=this.lightRig=new T.Group();
      group.name='写实材质 · 室内灯光';
      group.userData.ignoreCollision=true;
      group.userData.noAO=true;
      const housing=new T.MeshStandardMaterial({color:'#363032',roughness:.66,metalness:.25});
      const diffuser=new T.MeshBasicMaterial({color:'#fff1ce',toneMapped:false});
      const housingGeometry=new T.BoxGeometry(1.36,.10,.28);
      const diffuserGeometry=new T.PlaneGeometry(1.27,.22);
      this.lamps=Array.from({length:4},()=>{
        const fixture=new T.Group();
        const body=new T.Mesh(housingGeometry,housing);
        const lens=new T.Mesh(diffuserGeometry,diffuser);
        lens.rotation.x=Math.PI/2;
        lens.position.y=-.052;
        fixture.add(body,lens);
        const light=new T.SpotLight('#ffdfb5',1.45,5.2,Math.PI/3.5,.72,1.45);
        group.add(fixture,light,light.target);
        return {fixture,light};
      });
      const trim=new T.MeshStandardMaterial({color:'#a94e31',roughness:.61});
      this.shades=new T.InstancedMesh(new T.BoxGeometry(1,1,1),trim,BAYS.length);
      this.shades.name='斜向窗格';
      this.shades.castShadow=this.shades.receiveShadow=true;
      const bar=new T.Object3D();
      BAYS.forEach(([left,right],index)=>{
        bar.position.set((left+right)*.5,1.63,12.77);
        bar.scale.set(Math.hypot(right-left,2.9),.19,.16);
        bar.rotation.z=Math.atan2(index%2===0?2.9:-2.9,right-left);
        bar.updateMatrix();
        this.shades.setMatrixAt(index,bar.matrix);
      });
      group.add(this.shades);
      this.view.scene.add(group);
      this.view.pipeline._aoExcluded=null;
    }
    createMirrorDetails(){
      const root=this.mirrorDetails=new T.Group();
      root.name='镜面光影 · 斜格幕墙与三角灯';
      // The room-facing faces of the trim share a near-coplanar window line.
      this.trimReflection=new L.ArchvizReflection(this.view,{offset:12.655,axis:'z',side:-1,width:288,height:162});
      this.trimBounds=new T.Box3(new T.Vector3(-17.9,.01,12.62),new T.Vector3(17.9,3.23,12.86));
      this.trimFrustum=new T.Frustum();
      this.trimProjection=new T.Matrix4();
      const accent=this.accentTrim=new T.MeshPhysicalMaterial({
        roughness:.22,metalness:.12,envMapIntensity:.72,clearcoat:.85,clearcoatRoughness:.12
      });
      accent.onBeforeCompile=shader=>this.trimReflection.install(shader);
      accent.customProgramCacheKey=()=>'mirror-edge-coated-trim';
      const geometry=new T.BoxGeometry(1,1,1);
      const rod=(parent,material,a,b,width,depth)=>{
        const delta=new T.Vector3().subVectors(b,a),mesh=new T.Mesh(geometry,material);
        mesh.position.copy(a).addScaledVector(delta,.5);
        mesh.quaternion.setFromUnitVectors(new T.Vector3(1,0,0),delta.clone().normalize());
        mesh.scale.set(delta.length(),width,depth);
        parent.add(mesh);
        return mesh;
      };
      const point=(x,y)=>new T.Vector3(x,y,12.74);
      BAYS.forEach(([left,right],i)=>{
        const a=point(left,.32),b=point(right,3.01),c=point(left,3.01),d=point(right,.32);
        rod(root,accent,a,b,.38,.17).castShadow=true;
        if(i%3!==1)rod(root,accent,c,d,.26,.15).castShadow=true;
      });
      for(const [left,right]of [[-17.7,-3.2],[3.2,17.7]]){
        rod(root,accent,point(left,.28),point(right,.28),.52,.20).castShadow=true;
        rod(root,accent,point(left,3.02),point(right,3.02),.36,.20).castShadow=true;
      }
      const white=new T.MeshBasicMaterial({color:'#fff4eb',toneMapped:false});
      const housing=new T.MeshStandardMaterial({color:'#333039',roughness:.42});
      this.triangles=Array.from({length:4},()=>{
        const group=new T.Group(),corners=[
          new T.Vector3(-.7,0,-.38),new T.Vector3(.7,0,-.38),new T.Vector3(.28,0,.55)
        ];
        for(let i=0;i<3;i++){
          const next=(i+1)%3;
          rod(group,housing,corners[i],corners[next],.076,.126).position.y+=.031;
          rod(group,white,corners[i],corners[next],.060,.078);
        }
        root.add(group);return group;
      });
      this.lightRig.add(root);
      this.accentBounce=[-11.5,11.5].map(x=>{
        const light=new T.PointLight('#ff8b56',.76,11,1.65);
        light.position.set(x,1.24,11.5);root.add(light);return light;
      });
      this.view.pipeline._aoExcluded=null;
    }
    updateLighting(style){
      const v=this.view,model=v.model,tower=L.continuousTower;
      // The same localized lamps remain visible through the entrance. Toggling
      // the entire rig at the threshold changes NUM_SPOT_LIGHTS and recompiles
      // every lit material just as the player walks through the door.
      const mirror=style==='mirror-edge',indoor=!!model?.towerFloor
        &&L.building?.phase==='interior'&&L.collaboration?.environment!=='station'&&!L.collaboration?.switching;
      if(!indoor){
        if(this.lightRig)this.lightRig.visible=false;
        this.reflection.update(false);
        this.ceilingReflection.update(false);
        this.trimReflection?.update(false);
        this.lightStyle=null;
        return;
      }
      if(!this.lightRig)this.createLights();
      if(mirror&&!this.mirrorDetails)this.createMirrorDetails();
      this.lightRig.visible=true;
      const showFixtures=!!tower?.active;
      if(this.lightModel!==model||this.showFixtures!==showFixtures||this.lightStyle!==style){
        this.lightModel=model;
        this.lightStyle=style;
        this.showFixtures=showFixtures;
        this.shades.visible=showFixtures&&style==='archviz';
        if(this.mirrorDetails)this.mirrorDetails.visible=showFixtures&&mirror;
        const spots=mirror?[[-12,10.1],[-4,10.1],[4,10.1],[12,10.1]]:
          model.towerFloor===1?[[-8,5],[8,5],[-9,-8],[9,-8]]:[[-8,7],[8,7],[-9,-8],[9,-8]];
        const meeting=model.layoutItems.find(item=>item.name==='会议桌'&&Math.abs(item.z)>5);
        if(!mirror&&meeting&&model.towerFloor!==1)spots[(meeting.z>0?0:2)+(meeting.x>0?1:0)]=[meeting.x,meeting.z];
        this.lamps.forEach(({fixture,light},i)=>{
          const [x,z]=spots[i];
          fixture.visible=showFixtures&&!mirror;
          if(mirror)this.triangles[i].position.set(x,3.12,z);
          fixture.position.set(x,3.13,z);
          light.color.set(L.RENDER_STYLES[style]?.key||'#fff0d9');light.intensity=mirror?1.22:1.45;
          light.position.set(x,3.06,z);
          light.target.position.set(x,0,z);
        });
        v.shadowDirty=true;
      }
      if(mirror){
        const accent=L.RENDER_STYLES[style].accent;
        if(this.accent!==accent){
          this.accent=accent;
          this.accentTrim.color.set(accent).convertSRGBToLinear();
          for(const light of this.accentBounce)light.color.set(accent).lerp(new T.Color('#fff1da'),.47);
        }
        v.camera.getWorldDirection(this.direction);
      }
      const fire=L.building?.society.emergency?.type==='fire';
      // Cabin surfaces travel independently of this floor's reflecting planes.
      // The anchored exterior view also has no nearby indoor reflection plane.
      const floorReflections=showFixtures&&!(tower?.active&&(tower.player.location==='lift'||tower.worldWalk.outside&&!tower.fp.grounded));
      // Reflection and beauty must sample the same shadow map on this frame.
      if(floorReflections&&!fire)v.pipeline.updateShadows?.();
      this.reflection.update(floorReflections&&!fire&&(!mirror||this.direction.y<.59),mirror?.38:.27);
      this.ceilingReflection.update(floorReflections&&!fire&&mirror&&this.direction.y>-.59,.37);
      if(this.trimReflection){
        const visible=floorReflections&&!fire&&mirror&&this.trimFrustum.setFromProjectionMatrix(
          this.trimProjection.multiplyMatrices(v.camera.projectionMatrix,v.camera.matrixWorldInverse)
        ).intersectsBox(this.trimBounds);
        this.trimReflection.update(visible,.72);
      }
    }
  }
  L.ArchvizSurfaces=ArchvizSurfaces;
})();
