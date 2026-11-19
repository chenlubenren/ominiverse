/* Leg lengths are calibrated to the native avatar's actual hip/ankle span. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./anatomy-ik.js'),require('./locomotion.js'));else root.IndoorLab.NativeLegRig=factory(root.IndoorLab.AnatomyIK,root.IndoorLab.Locomotion);})(typeof window==='undefined'?globalThis:window,(IK,loc)=>{
 const total=Math.hypot(.86-.07-.13,.1-.085)*1.0004,upper=total*.52,lower=total*.48;
 function pose({hip=.86,phase=0,moving=false,fast=false,adjustRoot=true}={}){
  const feet=[-1,1].map(side=>{const foot=loc.foot(phase,side,fast);return{side,foot,ankle:{x:side*.1,y:.13+(moving?foot.lift:0),z:moving?foot.z:0}};});
  // Lower the pelvis only as much as reaching a planted/raised foot requires.
  // The idle skeleton remains almost straight, without extending either leg.
  let originY=hip-.07;
  if(adjustRoot)for(const {ankle}of feet){const reach=total*.9997,horizontal=(ankle.x-Math.sign(ankle.x)*.085)**2+ankle.z**2;originY=Math.min(originY,ankle.y+Math.sqrt(Math.max(0,reach*reach-horizontal)));}
  const drop=hip-.07-originY;
  return{drop,upper,lower,legs:feet.map(({side,foot,ankle})=>{const origin={x:side*.085,y:originY,z:0},solved=IK.solve(origin,ankle,{x:0,y:0,z:1},upper,lower,.9999);return{side,foot,hip:origin,ankle,knee:solved.elbow};})};
 }
 return{pose};
});
