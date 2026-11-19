/* Clipped planar reflections for architectural finishes. */
(() => {
  'use strict';
  const L=window.IndoorLab,T=THREE;
  class ArchvizReflection {
    constructor(view,{offset=0,side=1,axis='y',width=512,height=288}={}){
      this.view=view;L.archvizMirrors??=new Set();L.archvizMirrors.add(this);
      this.resolution=[width,height];
      this.normal=new T.Vector3();
      this.normal[axis]=side;
      this.offset=-offset*side;
      this.camera=new T.PerspectiveCamera();
      this.direction=new T.Vector3();
      this.lookAt=new T.Vector3();
      this.plane=new T.Plane();
      this.clip=new T.Vector4();
      this.corner=new T.Vector4();
      this.lastCamera=new T.Matrix4();
      this.lastProjection=new T.Matrix4();
      this.uniforms={
        officeMirror:{value:null},
        officeMirrorMatrix:{value:new T.Matrix4()},
        officeMirrorSurface:{value:new T.Vector4(this.normal.x,this.normal.y,this.normal.z,this.offset)},
        officeMirrorStrength:{value:0}
      };
    }
    install(shader){
      Object.assign(shader.uniforms,this.uniforms);
      shader.vertexShader=`uniform mat4 officeMirrorMatrix;
        uniform vec4 officeMirrorSurface;
        varying vec4 officeMirrorPosition;
        varying float officeMirrorFace;
      `+shader.vertexShader.replace('#include <project_vertex>',`
        #include <project_vertex>
        vec4 mirrorPoint=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          mirrorPoint=instanceMatrix*mirrorPoint;
        #endif
        vec4 mirrorWorld=modelMatrix*mirrorPoint;
        officeMirrorPosition=officeMirrorMatrix*mirrorWorld;
        officeMirrorFace=step(.5,dot(normal,officeMirrorSurface.xyz))
          *(1.0-step(.025,abs(dot(mirrorWorld,officeMirrorSurface))));
      `);
      shader.fragmentShader=`uniform sampler2D officeMirror;
        uniform float officeMirrorStrength;
        varying vec4 officeMirrorPosition;
        varying float officeMirrorFace;
      `+shader.fragmentShader.replace('#include <tonemapping_fragment>',`
        if(officeMirrorStrength>0.0&&officeMirrorFace>.5&&officeMirrorPosition.w>0.0){
          vec2 mirrorUv=officeMirrorPosition.xy/officeMirrorPosition.w*.5+.5;
          vec2 edge=min(mirrorUv,1.0-mirrorUv);
          float mask=smoothstep(0.0,.09,min(edge.x,edge.y));mask*=smoothstep(.025,.13,abs(dot(normal,normalize(vViewPosition))));
          vec2 blur=vec2(.0025,.004);
          vec3 reflection=texture2D(officeMirror,mirrorUv).rgb*.5
            +texture2D(officeMirror,mirrorUv+blur).rgb*.25
            +texture2D(officeMirror,mirrorUv-blur).rgb*.25;
          float grazing=pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),2.0);
          float weight=officeMirrorStrength*mask*(.25+.75*grazing)*(1.0-.55*roughnessFactor);
          gl_FragColor.rgb=mix(gl_FragColor.rgb,reflection,weight);
        }
        #include <tonemapping_fragment>
      `);
    }
    update(enabled,strength){
      const {view:v,uniforms:u}=this;
      const current=v.camera;
      const distance=this.normal.dot(current.position)+this.offset;
      if(!enabled||distance<.08){
        u.officeMirrorStrength.value=0;
        this.model=null;
        return;
      }
      const now=performance.now(),model=v.model,styleKey=v.pipeline.style+':'+(L.RENDER_STYLES[v.pipeline.style]?.accent||''),sameFloor=this.model===model&&this.styleKey===styleKey;
      current.updateMatrixWorld();
      const sameView=this.lastCamera.equals(current.matrixWorld)&&this.lastProjection.equals(current.projectionMatrix);
      const version=model.physicsVersion||0;
      // Follow camera motion every frame. Only moving objects in a static
      // view can reuse the previous sample for a short interval.
      if(sameFloor&&sameView&&version===this.version&&(now<this.nextFrame||!L.app.running)){u.officeMirrorStrength.value=strength;return;}this.styleKey=styleKey;
      this.model=model;
      this.version=version;
      this.nextFrame=now+65;
      this.lastCamera.copy(current.matrixWorld);
      this.lastProjection.copy(current.projectionMatrix);
      this.target??=new T.WebGLRenderTarget(...this.resolution,{depthBuffer:true});
      const mirror=this.camera;
      mirror.position.copy(current.position).addScaledVector(this.normal,-2*distance);
      current.getWorldDirection(this.direction).reflect(this.normal);
      mirror.up.setFromMatrixColumn(current.matrixWorld,1).reflect(this.normal);
      mirror.lookAt(this.lookAt.copy(mirror.position).add(this.direction));
      mirror.updateMatrixWorld();
      mirror.projectionMatrix.copy(current.projectionMatrix);
      u.officeMirrorMatrix.value.multiplyMatrices(mirror.projectionMatrix,mirror.matrixWorldInverse);

      // Reject geometry behind the reflecting surface.
      this.plane.set(this.normal,this.offset).applyMatrix4(mirror.matrixWorldInverse);
      const p=mirror.projectionMatrix.elements, n=this.plane.normal;
      this.clip.set(n.x,n.y,n.z,this.plane.constant);
      this.corner.set((Math.sign(n.x)+p[8])/p[0],(Math.sign(n.y)+p[9])/p[5],-1,(1+p[10])/p[14]);
      this.clip.multiplyScalar(2/this.clip.dot(this.corner));
      p[2]=this.clip.x;
      p[6]=this.clip.y;
      p[10]=this.clip.z+1-.003;
      p[14]=this.clip.w;
      mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
      const renderer=v.renderer, previous=renderer.getRenderTarget(), shadows=renderer.shadowMap.needsUpdate;
      const strengths=[...L.archvizMirrors].map(m=>[m,m.uniforms.officeMirrorStrength.value]);for(const [m]of strengths)m.uniforms.officeMirrorStrength.value=0;
      const toneMapping=renderer.toneMapping;renderer.toneMapping=T.NoToneMapping;
      // Unbind this texture while drawing into it to avoid a feedback loop.
      u.officeMirror.value=null;
      u.officeMirrorStrength.value=0;
      renderer.shadowMap.needsUpdate=false;
      try{
        renderer.setRenderTarget(this.target);
        renderer.clear();
        renderer.render(v.scene,mirror);
      }finally{
        renderer.setRenderTarget(previous);
        renderer.shadowMap.needsUpdate=shadows;renderer.toneMapping=toneMapping;for(const [m,value]of strengths)m.uniforms.officeMirrorStrength.value=value;
      }
      u.officeMirror.value=this.target.texture;
      u.officeMirrorStrength.value=strength;
    }
  }
  L.ArchvizReflection=ArchvizReflection;
})();
