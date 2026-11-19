/* Shared interior, facade and sunlight palettes. */
(() => {
 const L=window.IndoorLab;
 L.RENDER_STYLES={
  access:{label:'白蓝空间',accent:'#2589df',wall:'#f4f7fa',floor:'#e3eaf0',desk:'#eff5fa',wood:'#b9cbd9',chair:'#277dcb',fabric:'#adc7df',metal:'#8598ab',key:'#fff9ef',fill:'#bfdcff',exposure:1.08,keyIntensity:2.15,fillIntensity:.32,env:.55},
  editorial:{label:'深色电影',accent:'#647f9d',wall:'#94adc4',floor:'#f7f8fa',desk:'#b3c3cf',wood:'#7c91a5',chair:'#536e8c',fabric:'#899eaf',metal:'#7a8b9d',key:'#edf4ff',fill:'#8eabc9',exposure:.94,keyIntensity:2.05,fillIntensity:.28,env:.3},
  moodboard:{label:'暖木电影光',accent:'#d5a23d',wall:'#c9c3b4',floor:'#eadbb9',plaza:'#eadbb9',desk:'#e2cc9c',wood:'#a9793d',chair:'#d7ba7d',fabric:'#e0d2b4',metal:'#8a8b87',key:'#ffd28a',fill:'#a6bed2',exposure:1.03,keyIntensity:2.8,fillIntensity:.32,env:.55},
  'soft-home':{label:'灰白薄荷',accent:'#cec28a',wall:'#f1f2e9',floor:'#ded9bf',desk:'#e9e5ce',wood:'#d2c7a2',chair:'#c1cebc',fabric:'#e8e4cb',metal:'#a9b6bc',key:'#fff5cf',fill:'#b9dfd2',exposure:1.06,keyIntensity:2.05,fillIntensity:.55,env:.6},
  surreal:{label:'柔光彩色',accent:'#a18acb',wall:'#d8cff4',floor:'#c8cde4',desk:'#e6d5ed',wood:'#d2bdd6',chair:'#b7a2d0',fabric:'#e8bfd0',metal:'#b4c6d9',key:'#fff1dc',fill:'#b8a3ed',exposure:1.03,keyIntensity:1.9,fillIntensity:.48,env:.5},
  daylight:{label:'日光街景',accent:'#52798d',wall:'#d0d7d5',floor:'#9faeaf',desk:'#c2cecd',wood:'#b9a184',chair:'#557e8d',fabric:'#9db7b7',metal:'#6c828d',key:'#ffe0ab',fill:'#799ab8',exposure:.94,keyIntensity:3.2,fillIntensity:.22,env:.35,background:'#bed4df',city:'#8d9fa5',road:'#556973'},
  archviz:{label:'写实材质',accent:'#a6523e',wall:'#f7f7f3',floor:'#eee0cb',desk:'#ead6bd',wood:'#d8b38d',chair:'#514945',fabric:'#9e7662',metal:'#6f6763',glass:'#e0dfd8',screen:'#1f262d',keyboard:'#343236',key:'#fff0d9',fill:'#bccde0',exposure:1.02,keyIntensity:2.75,fillIntensity:.22,env:.45},
  'mirror-edge':{label:'镜面光影',accent:'#e75418',wall:'#f5f1ee',floor:'#f1eeec',ceiling:'#e7dedb',desk:'#fcfaf7',wood:'#e8ded8',chair:'#42474f',fabric:'#b5bec8',metal:'#313940',glass:'#c8def2',screen:'#27313f',keyboard:'#53545b',key:'#fff2df',fill:'#b0cfff',exposure:1.04,keyIntensity:3.15,fillIntensity:.24,env:.56}
 };
})();
