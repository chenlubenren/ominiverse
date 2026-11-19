/* Separate dust and fine debris layers, inspired by the supplied RBD/Dust/Debris reference. */
(() => {
 'use strict';const L=window.IndoorLab,T=THREE;
 class CollapseVFX {
  constructor(parent,random=Math.random){
   this.random=random;this.time=0;this.capacity=5200;this.cursor=0;this.particles=new Array(this.capacity);this.group=new T.Group();this.group.name='坍塌 · 下泄尘幕与地面尘浪';this.group.userData.noAO=true;parent.add(this.group);
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(this.capacity*3),3));geometry.setAttribute('life',new T.BufferAttribute(new Float32Array(this.capacity*3),3));
   this.material=new T.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,uniforms:{pixel:{value:Math.min(devicePixelRatio,1.5)}},vertexShader:`attribute vec3 life;uniform float pixel;varying float opacity;varying float seed;varying float kind;void main(){opacity=life.x;seed=life.z;kind=step(40.,life.y);vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(life.y*pixel*450./max(1.,-mv.z),1.,190.);}`,fragmentShader:`varying float opacity;varying float seed;varying float kind;float noise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+seed*12.)*43758.5);}void main(){vec2 p=gl_PointCoord-.5;float r=length(p)*2.;if(r>1.)discard;float puff=exp(-r*r*3.5)*(1.-smoothstep(.65,1.,r));vec3 color=mix(vec3(.35,.325,.29),vec3(.57,.54,.49),seed);gl_FragColor=vec4(color,opacity*puff*(.85+noise(gl_PointCoord*4.)*.15));}`});
   this.points=new T.Points(geometry,this.material);this.points.frustumCulled=false;this.group.add(this.points);this.count=0;
   this.chips=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshStandardMaterial({color:'#8c877d',roughness:1}),1800);this.chips.frustumCulled=false;this.chips.count=0;this.group.add(this.chips);this.fragments=[];this.pose=new T.Object3D();
  }
  burst(at,power=1,ground=false){
   const random=this.random,count=ground?34:24;
   for(let i=0;i<count;i++){
    const angle=random()*Math.PI*2,speed=(ground?2.4:1.2)+random()*power*2.2;
    this.particles[this.cursor]={x:at.x+(random()-.5)*3,y:Math.max(-.7,at.y)+(random()-.5),z:at.z+(random()-.5)*3,vx:Math.cos(angle)*speed,vy:ground?.8+random()*1.2:-1.5-random()*3,vz:Math.sin(angle)*speed,age:0,ttl:ground?8+random()*5:5+random()*5,size:ground?1.3+random():.6+random(),seed:random(),ground};this.cursor=(this.cursor+1)%this.capacity;
   }
   for(let i=0;i<(ground?12:42);i++){if(this.fragments.length>=1800)break;const angle=random()*Math.PI*2,speed=(1+random()*4)*power;this.fragments.push({x:at.x,y:at.y,z:at.z,vx:Math.cos(angle)*speed,vy:ground?1+random()*2:random()*2,vz:Math.sin(angle)*speed,size:.04+random()*.16,spin:random()*6,phase:random()*6,age:0});}
  }
  update(dt){
   this.time+=dt;const positions=this.points.geometry.attributes.position.array,life=this.points.geometry.attributes.life.array;let count=0;
   for(let i=0;i<this.capacity;i++){const p=this.particles[i];if(!p)continue;p.age+=dt;if(p.age>p.ttl){this.particles[i]=null;continue;}p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;if(!p.ground){p.vy-=5*dt;if(p.y<.1){p.y=.1;p.ground=true;p.vy=.35;}}else{p.vy*=Math.exp(-dt*.5);p.vx*=Math.exp(-dt*.16);p.vz*=Math.exp(-dt*.16);}const u=p.age/p.ttl,fade=Math.min(1,p.age*4)*Math.pow(1-u,1.3),j=count*3;positions[j]=p.x;positions[j+1]=p.y;positions[j+2]=p.z;life[j]=fade*.26;life[j+1]=(p.size+p.age*(p.ground?.6:.37))*4.2;life[j+2]=p.seed;count++;}
   this.count=count;this.points.geometry.setDrawRange(0,count);this.points.geometry.attributes.position.needsUpdate=true;this.points.geometry.attributes.life.needsUpdate=true;
   let n=0;for(let i=this.fragments.length-1;i>=0;i--){const p=this.fragments[i];p.age+=dt;if(p.age>12){this.fragments.splice(i,1);continue;}p.vy-=9.81*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<-.76+p.size){p.y=-.76+p.size;p.vy=Math.abs(p.vy)*.12;p.vx*=.86;p.vz*=.86;}this.pose.position.set(p.x,p.y,p.z);this.pose.rotation.set(p.phase+p.age*p.spin,p.phase+p.age,p.phase);this.pose.scale.set(p.size,p.size*.7,p.size*.9);this.pose.updateMatrix();this.chips.setMatrixAt(n++,this.pose.matrix);}this.chips.count=n;this.chips.instanceMatrix.needsUpdate=true;
  }
  dispose(){this.group.parent?.remove(this.group);this.points.geometry.dispose();this.material.dispose();this.chips.geometry.dispose();this.chips.material.dispose();}
 }
 L.CollapseVFX=CollapseVFX;
})();
