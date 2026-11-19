/* Smooth fist trajectories, wrist rotation and coordinated recovery. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.IndoorLab.BoxingMotion=factory();})(typeof window==='undefined'?globalThis:window,()=>{
 const clamp=x=>Math.max(0,Math.min(1,x)),times=[0,.16,.37,.55,1];
 function curve(values,t){t=clamp(t);let i=0;while(i<times.length-2&&t>times[i+1])i++;const span=times[i+1]-times[i],u=(t-times[i])/span,u2=u*u,u3=u2*u,a=values[i],b=values[i+1],m0=i?(values[i+1]-values[i-1])/(times[i+1]-times[i-1]):0,m1=i+2<values.length?(values[i+2]-values[i])/(times[i+2]-times[i]):0;return(2*u3-3*u2+1)*a+(u3-2*u2+u)*span*m0+(-2*u3+3*u2)*b+(u3-u2)*span*m1;}
 function sample(style,side,t){const s=side?1:-1,pulse=Math.sin(Math.PI*clamp(t)),guard=[s*.235,-.245,-.34,-1.45,0,-s*.12],back=[s*.27,-.225,-.30,-1.38,s*.09,-s*.07];let contact=[s*.065,-.115,-.59,-1.61,-s*.08,-s*.28],follow=[s*.07,-.12,-.56,-1.58,-s*.05,-s*.23];
  if(style==='cross'){back[2]=-.29;contact=[s*.015,-.11,-.61,-1.63,-s*.16,-s*.34];follow=[-s*.01,-.13,-.57,-1.56,-s*.1,-s*.28];}
  if(style==='hook'){back[0]=s*.37;back[2]=-.39;contact=[-s*.09,-.13,-.50,-1.48,-s*.83,-s*.68];follow=[-s*.15,-.16,-.43,-1.40,-s*.72,-s*.54];}
  if(style==='body'){back[1]=-.30;contact=[s*.07,-.32,-.53,-1.37,-s*.12,-s*.35];follow=[s*.045,-.30,-.50,-1.40,-s*.06,-s*.28];}
  const keys=[guard,back,contact,follow,guard],active=guard.map((_,j)=>curve(keys.map(k=>k[j]),t)),other=[-s*(.235+.018*pulse),-.245+.075*pulse,-.34+.035*pulse,-1.45+.12*pulse,-s*.06*pulse,s*.12];return{active,other,yaw:-s*pulse*(style==='hook'?.085:.035),roll:-s*pulse*.025};
 }
 return{sample};
});
