/* The provider's body rig has no facial bones. Small head-bound mouth meshes
 * supply an opening mouth and teeth during biting without changing identity. */
(() => {
 'use strict';const L=window.IndoorLab,T=THREE;
 class CharacterMouth {
  constructor(asset,parent,capacity){this.asset=asset;this.capacity=Math.min(64,capacity);this.source=asset.meshes[0];this.headIndex=this.source.skeleton.bones.indexOf(asset.rig.head);this.group=new T.Group();this.group.userData.noAO=true;parent.add(this.group);this.index=0;this.pose=new T.Object3D();this.matrix=new T.Matrix4();this.bone=new T.Matrix4();this.rest=new T.Matrix4();this.transform=new T.Matrix4();const g=this.source.geometry,p=g.attributes.position,skin=g.attributes.skinIndex,w=g.attributes.skinWeight,box=new T.Box3(),point=new T.Vector3();
   for(let i=0;i<p.count;i++){let weight=0;for(let k=0;k<4;k++)if(skin.array[i*4+k]===this.headIndex)weight+=w.array[i*4+k];if(weight>.55)box.expandByPoint(point.fromBufferAttribute(p,i));}const size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());this.factor=asset.height/1.789;const mouthY=box.max.y-size.y*.77;let front=-Infinity;for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i);if(Math.abs(point.x-center.x)<size.x*.10&&Math.abs(point.y-mouthY)<size.y*.065)front=Math.max(front,point.z);}this.center=new T.Vector3(center.x,mouthY,Number.isFinite(front)?front+.002*this.factor:box.max.z);this.valid=this.headIndex>=0&&Number.isFinite(this.center.y);
   this.cavity=new T.InstancedMesh(new T.SphereGeometry(1,18,12),new T.MeshBasicMaterial({color:'#240d12'}),this.capacity);this.teeth=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:'#d9d4ba',roughness:.48}),this.capacity*12);for(const mesh of [this.cavity,this.teeth]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.count=0;this.group.add(mesh);}
  }
  begin(){this.index=0;}
  put(agent,actor,frame0,frame1,mix,time){if((agent.injuryMask&16)||!this.valid||this.index>=this.capacity||!['bite','turn','struggle'].includes(agent.zombieAnim))return;const atlas=this.asset.atlases[0],offset0=frame0*atlas.width*4+this.headIndex*16,offset1=frame1*atlas.width*4+this.headIndex*16;for(let j=0;j<16;j++)this.bone.elements[j]=atlas.data[offset0+j]*(1-mix)+atlas.data[offset1+j]*mix;this.transform.copy(actor).multiply(this.asset.meshMatrices[0]).multiply(this.source.bindMatrixInverse).multiply(this.bone).multiply(this.source.bindMatrix);const open=(agent.zombieAnim==='bite'?.008:.004)+Math.abs(Math.sin(time*14+agent.id))*.009,f=this.factor;
   this.pose.position.copy(this.center);this.pose.rotation.set(0,0,0);this.pose.scale.set(.023*f,open*f,.003*f);this.pose.updateMatrix();this.matrix.multiplyMatrices(this.transform,this.pose.matrix);this.cavity.setMatrixAt(this.index,this.matrix);
   for(let row=0;row<2;row++)for(let tooth=0;tooth<6;tooth++){this.pose.position.copy(this.center).add(new T.Vector3((tooth-2.5)*.0062*f,(row?1:-1)*open*.65*f,.0025*f));this.pose.scale.set(.0053*f,.0048*f,.0025*f);this.pose.updateMatrix();this.matrix.multiplyMatrices(this.transform,this.pose.matrix);this.teeth.setMatrixAt(this.index*12+row*6+tooth,this.matrix);}this.index++;
  }
  end(){this.cavity.count=this.index;this.teeth.count=this.index*12;this.cavity.instanceMatrix.needsUpdate=true;this.teeth.instanceMatrix.needsUpdate=true;}
  dispose(){this.group.parent?.remove(this.group);for(const mesh of [this.cavity,this.teeth]){mesh.geometry.dispose();mesh.material.dispose();}}
 }
 L.CharacterMouth=CharacterMouth;
})();
