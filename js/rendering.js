/* Full-resolution SSAO and PBR presentation; fixed high quality at every distance. */
(() => {
  'use strict';const L=window.IndoorLab;
  // Bound default render-target cost on Retina/mobile and large displays. The
  // explicit supersampling preference still multiplies this base resolution.
  L.renderPixelRatio=(w,h,scale=1,dpr=window.devicePixelRatio||1)=>Math.min(Math.max(1,dpr),1.5,Math.sqrt(4000000/(Math.max(1,w)*Math.max(1,h))))*scale;
  // Architecture AO is stable between camera / furniture edits. People keep
  // rendering every frame while the static normal and occlusion buffers are reused.
  L.cacheStaticAO=(pass,key)=>{
    const render=pass.render.bind(pass),resize=pass.setSize.bind(pass);let previous=null;
    pass.setSize=(w,h)=>{resize(w,h);const aw=Math.max(1,Math.ceil(w)),ah=Math.max(1,Math.ceil(h));pass.ssaoRenderTarget.setSize(aw,ah);pass.blurRenderTarget.setSize(aw,ah);pass.blurMaterial.uniforms.resolution.value.set(aw,ah);previous=null;};
    pass.render=(renderer,writeBuffer,...rest)=>{
      const next=key();if(next!==previous||pass.output!==THREE.SSAOPass.OUTPUT.Default){previous=next;render(renderer,writeBuffer,...rest);return;}
      renderer.setRenderTarget(pass.beautyRenderTarget);renderer.clear();renderer.render(pass.scene,pass.camera);
      pass.copyMaterial.uniforms.tDiffuse.value=pass.beautyRenderTarget.texture;pass.copyMaterial.blending=THREE.NoBlending;pass.renderPass(renderer,pass.copyMaterial,pass.renderToScreen?null:writeBuffer);
      pass.copyMaterial.uniforms.tDiffuse.value=pass.blurRenderTarget.texture;pass.copyMaterial.blending=THREE.CustomBlending;pass.renderPass(renderer,pass.copyMaterial,pass.renderToScreen?null:writeBuffer);
    };
  };
  L.aoSceneKey=view=>{view.camera.updateMatrixWorld();return view.camera.matrixWorld.elements.map(v=>v.toFixed(7)).join(',')+'|'+view.camera.projectionMatrix.elements.map(v=>v.toFixed(7)).join(',')+'|'+view.model?.name+'|'+(view.model?.aoVersion||0)+'|'+(view.model?.physicsVersion||0)+'|'+(L.activeTheme?.id||'')+'|'+(L.building?.journey?.contextFloor||'');};
  function preserveAOEdges(pass){
    const blur=pass.blurMaterial;
    Object.assign(blur.uniforms,{
      architectureDepth:{value:pass.normalRenderTarget.depthTexture},
      architectureNormal:{value:pass.normalRenderTarget.texture},
      cameraNear:{value:.05},cameraFar:{value:180},contactFilter:{value:1}
    });
    blur.fragmentShader=`
      #include <packing>
      uniform sampler2D tDiffuse, architectureDepth, architectureNormal;
      uniform vec2 resolution;
      uniform float cameraNear, cameraFar, contactFilter;
      varying vec2 vUv;
      float distanceAt(vec2 uv){return -perspectiveDepthToViewZ(texture2D(architectureDepth,uv).r,cameraNear,cameraFar);}
      void main(){
        float center=texture2D(tDiffuse,vUv).r;
        float depth=distanceAt(vUv);
        vec3 normal=unpackRGBToNormal(texture2D(architectureNormal,vUv).rgb);
        float ao=center*2.0, weights=2.0;
        for(int x=-1;x<=1;x++){
          for(int y=-1;y<=1;y++){
            if(x==0&&y==0)continue;
            vec2 uv=vUv+vec2(float(x),float(y))*1.45*contactFilter/resolution;
            vec3 n=unpackRGBToNormal(texture2D(architectureNormal,uv).rgb);
            float weight=smoothstep(.76,.98,dot(normal,n));
            weight*=1.0-smoothstep(.012*contactFilter,(.044+depth*.002)*contactFilter,abs(distanceAt(uv)-depth));
            ao+=texture2D(tDiffuse,uv).r*weight;
            weights+=weight;
          }
        }
        gl_FragColor=vec4(vec3(ao/weights),1.0);
      }
    `;
    pass.ssaoMaterial.fragmentShader=pass.ssaoMaterial.fragmentShader
      .replace('float depth = getDepth( vUv );','float depth = getDepth( vUv ); if(depth >= .999999){gl_FragColor=vec4(1.0);return;}')
      .replace('occlusion += 1.0;','occlusion += 1.0 - smoothstep(maxDistance*.38,maxDistance,delta);');
  }
  class PresentationPipeline{
    constructor(view){this.view=view;this.immersive=new L.ImmersiveLighting(view);this.archviz=new L.ArchvizSurfaces(view);this.quality='high';this.pixelScale=Number(localStorage.getItem('indoor-output-scale')||1)===1.5?1.5:1;
      const renderer=view.renderer;renderer.toneMappingExposure=.92;this.style='access';
      const studio=new THREE.Scene();studio.background=new THREE.Color('#a9bdd5');const shell=new THREE.Mesh(new THREE.BoxGeometry(60,35,60),new THREE.MeshBasicMaterial({color:'#73859e',side:THREE.BackSide}));studio.add(shell);
      for(const[x,y,z,w,h]of [[-20,8,0,16,18],[17,10,-20,24,12],[0,17,0,28,12]]){const card=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,2.35,2.6),side:THREE.DoubleSide}));card.position.set(x,y,z);card.lookAt(0,0,0);studio.add(card);}
      const generator=new THREE.PMREMGenerator(renderer);this.environment=generator.fromScene(studio,.035);view.scene.environment=this.environment.texture;generator.dispose();studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
      this.composer=new THREE.EffectComposer(renderer);this.ssao=new THREE.SSAOPass(view.scene,view.camera,256,256);this.ssao.kernelRadius=.56;this.ssao.beautyRenderTarget.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);this.ssao.normalRenderTarget.depthTexture.type=THREE.UnsignedIntType;this.ssao.enabled=true;this.hazardMode=false;
      preserveAOEdges(this.ssao);
      const originalOverride=this.ssao.overrideVisibility.bind(this.ssao);this.ssao.overrideVisibility=()=>{originalOverride();
        if(!this._aoExcluded){this._aoExcluded=[];view.scene.traverse(o=>{let excluded=o.isSprite||o.material?.transparent;for(let p=o;p&&!excluded;p=p.parent)excluded=p.userData.noAO;if(excluded)this._aoExcluded.push(o);});}
        for(const o of this._aoExcluded)o.visible=false;
      };
      const copy=this.ssao.copyMaterial;Object.assign(copy.uniforms,{officeBeautyColor:{value:this.ssao.beautyRenderTarget.texture},officeMask:{value:false},officeAOContrast:{value:1},officeBeautyDepth:{value:this.ssao.beautyRenderTarget.depthTexture},officeArchitectureDepth:{value:this.ssao.normalRenderTarget.depthTexture}});copy.fragmentShader=copy.fragmentShader.replace('uniform float opacity;','uniform sampler2D officeBeautyColor; uniform float officeAOContrast; uniform bool officeMask; uniform sampler2D officeBeautyDepth; uniform sampler2D officeArchitectureDepth; uniform float opacity;').replace('gl_FragColor = opacity * texel;','gl_FragColor = opacity * texel; if(officeMask){vec3 ao=pow(texel.rgb,vec3(officeAOContrast));if(texture2D(officeBeautyDepth,vUv).r < texture2D(officeArchitectureDepth,vUv).r - 0.00000002) ao=vec3(1.0);gl_FragColor=LinearTosRGB(vec4(texture2D(officeBeautyColor,vUv).rgb*ao,1.0));}');const renderPass=this.ssao.renderPass.bind(this.ssao);this.ssao.renderPass=(renderer,material,...rest)=>{if(material===copy){if(copy.uniforms.tDiffuse.value===this.ssao.beautyRenderTarget.texture)return;copy.uniforms.officeMask.value=copy.uniforms.tDiffuse.value===this.ssao.blurRenderTarget.texture;copy.blending=THREE.NoBlending;}return renderPass(renderer,material,...rest);};
      // Canvas MSAA does not cover SSAO's offscreen beauty target. Filter the
      // final sRGB image so subpixel window frames and furniture do not shimmer.
      this.gamma=new THREE.ShaderPass(THREE.GammaCorrectionShader);this.fxaa=new THREE.ShaderPass(THREE.FXAAShader);this.composer.addPass(this.ssao);this.gamma.enabled=false;this.composer.addPass(this.gamma);this.fxaa.enabled=true;this.composer.addPass(this.fxaa);
      L.cacheStaticAO(this.ssao,()=>L.aoSceneKey(view)+'|'+this.style+'|'+this.ssao.kernelRadius+'|'+(L.building?.society?.lifts.cars.map(c=>c.door.toFixed(1)).join(',')||''));this.setQuality(this.quality);
    }
    setStyle(style){
      this.style=L.RENDER_STYLES[style]?style:'access';const v=this.view,p=L.RENDER_STYLES[this.style],white=p.background||'#edf0f3';v.scene.background=new THREE.Color(white).convertSRGBToLinear();v.scene.fog.color.set(white).convertSRGBToLinear();v.renderer.toneMappingExposure=p.exposure;v.sun.color.set(p.key);v.sun.intensity=p.keyIntensity;v.fill.color.set(p.fill);if(this.style==='mirror-edge')v.fill.color.lerp(new THREE.Color(p.accent),.23);v.fill.intensity=p.fillIntensity;v.ground.material.color.set(p.road||'#edf0f3').convertSRGBToLinear();v.contextGrid.material.color.set('#cbd4dc');
      const roles={...p,blue:p.accent,doorPanel:this.style==='mirror-edge'?p.accent:p.metal,doorTrim:this.style==='mirror-edge'?p.accent:p.metal,glass:p.glass||'#adcbd8',screen:p.screen||'#334e64',key:p.keyboard||'#657b86',plant:'#93aa91'};
      const archviz=!!v.model?.towerFloor;
      v.model?.group.traverse(o=>{
        if(!o.isMesh||!o.material)return;
        for(let parent=o;parent;parent=parent.parent)if(parent.userData.noAO)return;
        for(const m of Array.isArray(o.material)?o.material:[o.material]){
          if(!m.color||m.isMeshBasicMaterial||m.userData.styleLocked)continue;
          const role=o.userData.ceiling?'ceiling':m.userData.officeRole||o.name;
          if(v.model.group===L.building?.world){
            if(['white','pale','soffit'].includes(role))m.color.set(p.city||'#f4f6f8').convertSRGBToLinear();
            continue;
          }
          if(!archviz)this.archviz.restore(m);
          if(role==='ceiling'&&!p.ceiling){
            if(m.userData.ceilingColor)m.color.copy(m.userData.ceilingColor);
          }else if(role==='ceiling')m.userData.ceilingColor??=m.color.clone();
          const color=roles[role];
          if(color){m.color.set(color).convertSRGBToLinear();m.envMapIntensity=p.env;}
          if(archviz)this.archviz.apply(m,role,this.style);
        }
      });
      for(const door of L.building?.journey?.cabinDoors||[]){const m=door.material;this.archviz.restore(m);m.color.set(roles.doorPanel).convertSRGBToLinear();m.envMapIntensity=p.env;if(this.style==='mirror-edge')this.archviz.apply(m,'doorPanel',this.style);}
      v.shadowDirty=true;v.nextShadow=0;this.immersive.key=null;if(v.model)v.model.userDataImmersiveStyle=null;
    }
    setHazardMode(active){this.hazardMode=!!active;this.ssao.enabled=true;this.view.shadowDirty=true;this.view.nextShadow=0;}
    setQuality(quality){this.quality='high';this.view.shadowDirty=true;this.view.nextShadow=0;this.resize(this.view.container.clientWidth||800,this.view.container.clientHeight||600);}
    setPixelScale(scale){this.pixelScale=scale===1.5?1.5:1;localStorage.setItem('indoor-output-scale',this.pixelScale);this.resize(this.view.container.clientWidth,this.view.container.clientHeight);}
    resize(w,h){const ratio=L.renderPixelRatio(w,h,this.pixelScale);this.view.renderer.setPixelRatio(ratio);this.view.renderer.setSize(w,h,false);this.composer.setPixelRatio(ratio);this.composer.setSize(w,h);this.fxaa.uniforms.resolution.value.set(1/(w*ratio),1/(h*ratio));}
    updateShadows(){const v=this.view,r=v.renderer;if(!r.shadowMap.needsUpdate&&(!v.shadowDirty||performance.now()<v.nextShadow))return;this.shadowWarmup??=new THREE.WebGLRenderTarget(1,1);const previous=r.getRenderTarget();try{r.shadowMap.needsUpdate=true;r.setRenderTarget(this.shadowWarmup);r.render(v.scene,v.camera);v.shadowDirty=false;v.nextShadow=performance.now()+180;}finally{r.setRenderTarget(previous);}}
    render(){this.immersive.update();this.archviz.updateLighting(this.style);const v=this.view,immersive=['walk','human'].includes(v.view),key=this.style+':'+String(immersive)+':'+v.model?.group.uuid;if(this.glassKey!==key){this.glassKey=key;v.model?.group.traverse(o=>{if(o.name!=='glass'||!o.material?.transparent)return;const m=o.material;m.userData.originalOfficeOpacity??=m.opacity;m.opacity=this.style==='mirror-edge'?(immersive?.095:.19):this.style==='archviz'?(immersive?.11:.24):(immersive?.14:m.userData.originalOfficeOpacity);m.side=v.model.towerFloor?THREE.FrontSide:THREE.DoubleSide;m.depthWrite=false;});}if(this.quality==='balanced'){v.renderer.render(v.scene,v.camera);return;}
      
      const range=v.camera.far-v.camera.near,insideWalk=L.continuousTower?.active&&!L.continuousTower.worldWalk.outside;
      const mirrorContact=insideWalk&&this.style==='mirror-edge';
      this.ssao.minDistance=(mirrorContact?.006:insideWalk?.009:.018)/range;this.ssao.maxDistance=(mirrorContact?.21:insideWalk?.48:1.5)/range;
      this.ssao.blurMaterial.uniforms.contactFilter.value=mirrorContact?.67:1;
      for(const material of [this.ssao.ssaoMaterial,this.ssao.depthRenderMaterial,this.ssao.blurMaterial]){material.uniforms.cameraNear.value=v.camera.near;material.uniforms.cameraFar.value=v.camera.far;}
      this.ssao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(v.camera.projectionMatrix);this.ssao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(v.camera.projectionMatrixInverse);this.composer.render();
    }
  }
  L.PresentationPipeline=PresentationPipeline;
})();
