/* Architectural white models keep each agent's native anatomical motion. */
(() => {
  const L=window.IndoorLab,T=THREE;
  const palette={torso:'#f28c36',cloth:'#f28c36',hip:'#df7428',pants:'#df7428',head:'#f8a45a',skin:'#f8a45a',finger:'#f8a45a',fingertip:'#f8a45a',hair:'#c96327',shoes:'#ad4f20',skirt:'#df7428',hat:'#c96327',joint:'#f2a25b',badge:'#285f84',glasses:'#53748a',bag:'#b9622d'};
  const saved=(()=>{try{return localStorage.getItem('access-avatar-color');}catch{return null;}})();
  const base=/^#[0-9a-f]{6}$/i.test(saved||'')?saved:'#f28c36',materials=new Set();
  L.WhiteAvatar={
    palette,base,revision:0,
    setColor(value){if(!/^#[0-9a-f]{6}$/i.test(value)||value===this.base)return;this.base=value;this.revision++;for(const material of materials)material.color.set(value).convertSRGBToLinear();try{localStorage.setItem('access-avatar-color',value);}catch{}},
    // White clay keeps the source anatomy, clothing folds and normal detail.
    // Register both asset materials and their crowd/crew clones for recoloring.
    applyMaterial(material){
      const alphaTest=material.userData.clayAlphaTest??material.alphaTest??0;
      // The bundled hair/eyelash cutout carries coverage in RGB as well as A;
      // Three r128 samples the green channel when it is used as alphaMap.
      if(alphaTest>0&&material.map&&!material.alphaMap){material.alphaMap=material.map;material.alphaMap.encoding=T.LinearEncoding;material.alphaMap.needsUpdate=true;}
      for(const key of ['map','emissiveMap','roughnessMap','metalnessMap','aoMap','lightMap','envMap'])material[key]=null;
      material.color.set(this.base).convertSRGBToLinear();material.emissive?.set(0);material.vertexColors=false;material.roughness=.79;material.metalness=0;material.envMapIntensity=.30;material.flatShading=false;material.transparent=false;material.opacity=1;material.alphaTest=alphaTest;material.depthWrite=true;
      if('transmission'in material)material.transmission=0;if('clearcoat'in material)material.clearcoat=0;
      material.userData.whiteAvatar=true;material.userData.clayCharacter=true;material.userData.clayAlphaTest=alphaTest;material.userData.styleLocked=true;material.needsUpdate=true;
      if(!materials.has(material)){materials.add(material);material.addEventListener('dispose',()=>materials.delete(material));}
      return material;
    },
    // Rounded tapered segments follow the original joint endpoints. No skin
    // weight transfer or new bone angles are involved.
    limb(){return new T.LatheGeometry([[-.5,0],[-.48,.62],[-.43,.91],[-.28,1],[.05,.92],[.32,.8],[.46,.67],[.5,0]].map(([y,r])=>new T.Vector2(r,y)),16);},
    shape(a){const id=a.id||0;return{headWidth:.97+(id%5)*.018,headHeight:.96+(Math.floor(id/3)%5)*.02,shoulderWidth:.94+(id%7)*.02};},
    color(key,id){if(!palette[key])return null;if(L.affectedAgentIds?.has(id))return '#ed252d';const color=new T.Color(this.base);if(['hip','pants','skirt','hair','hat','shoes','bag'].includes(key))color.multiplyScalar(key==='shoes'?.68:.83);else if(['head','skin','finger','fingertip','joint'].includes(key))color.lerp(new T.Color('#ffffff'),.16);else if(key==='torso'||key==='cloth')color.multiplyScalar([1,.95,1.05,.9][Math.abs(id||0)%4]);else if(key==='badge'||key==='glasses')return palette[key];return '#'+color.getHexString();},
    hidden:new Set(['eyes','iris','lips','brow'])
  };
})();
