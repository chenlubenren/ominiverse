/* Each page opens with the original architecture. Adoption lasts for this run. */
(() => {
 const L=window.IndoorLab;
 L.matrixDesign={floors:{},envelope:null};
 L.matrixFloorGene=n=>L.matrixDesign.floors[n];
 L.matrixSave=()=>{L.matrixBaseline=JSON.parse(JSON.stringify(L.matrixDesign));};
})();
