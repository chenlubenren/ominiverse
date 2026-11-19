/* Keep product labels independent of providers and imported model metadata. */
(function(root,factory){const neutral=factory();if(typeof module==='object'&&module.exports)module.exports=neutral;else(root.IndoorLab=root.IndoorLab||{}).brandNeutralText=neutral;})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const names=[
    [/(?:AI )?AGENT SOCIETY/gi,'SPATIAL SIMULATION'],
    [/镜之边缘|Mirror[’']?s\s*Edge/gi,'镜面光影'],
    [/\bBLENDER_PATH\b/gi,'模型工具路径'],
    [/(?:宇树\s*|Unitree\s*)G1\b/gi,'人形协作机器人'],
    [/(?:宇树\s*|Unitree\s*)Go2\b/gi,'轻型巡检机器狗'],
    [/(?:宇树\s*|Unitree\s*)B2\b/gi,'工业巡检机器狗'],
    [/Boston\s*Dynamics\s*Spot\b/gi,'四足巡检机器人'],
    [/(?:优傲\s*|Universal\s*Robots\s*)UR5e\b/gi,'六轴协作机械臂'],
    [/Franka\s*(?:Research\s*3|Robotics)/gi,'七轴协作机械臂'],
    [/(?:普渡\s*|Pudu\s*(?:Robotics\s*)?)BellaBot(?:\s*Pro)?/gi,'轮式配送机器人'],
    [/\biRobot\s*Roomba\s*j9\+?/gi,'地面清洁机器人'],
    [/\bG1\b/gi,'人形机器人'],
    [/\b(?:Go2|B2|Spot)\b/gi,'四足机器人'],
    [/\bUR5e\b/gi,'六轴机械臂'],
    [/\bFR3\b/gi,'七轴机械臂'],
    [/\bGodzilla\b|哥斯拉/gi,'双足巨兽'],
    [/\b(?:King\s*)?Ghidorah\b|王者基多拉|基多拉/gi,'三头飞龙'],
    [/Lux\s*3D/gi,'三维生成服务'],
    [/\bDeepSeek(?:[-\s]+(?:flash|chat|reasoner))?\b/gi,'智能服务'],
    [/\b(?:ChatGPT|OpenAI|Anthropic|Claude|Fable|Gemini)(?:[-\s]+\d[\w.-]*)?\b/gi,'智能服务'],
    [/\bGPT(?:[-\s]*\d[\w.-]*)?\b/gi,'智能模型'],
    [/\bBlender\b/gi,'模型处理工具'],
    [/\b(?:Unitree|Boston\s*Dynamics|Franka|Universal\s*Robots|Pudu\s*(?:Robotics)?|iRobot|Roomba|BellaBot|UBTECH|KUKA|Kinova|Robotiq)\b|宇树|优傲|普渡|优必选/gi,'机器人'],
    [/\b(?:NVIDIA|Google|Microsoft|Manycore|Aholo|Cursor)\b|酷家乐/gi,'技术服务']
  ];
  return value=>names.reduce((text,[pattern,replacement])=>text.replace(pattern,replacement),String(value??''));
});
