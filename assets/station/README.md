# 天宫多舱空间站

入口：主界面「人机协同 → 空间站」，或 `index.html?scene=station`。

## 外观

`tiangong-exterior.glb` 来自用户提供的《中国空间站天宫建模.3dm》，通过 `scripts/prepare-station.py` 提取文件中已保存的曲面网格。

本页提到的 `prepare-station.py`、`prepare-station-props.py`、原始素材及测试脚本属于开发维护资料，不包含在本次线上代码快照中；相关步骤保留为资产来源与验证背景。

- 保留全部可提取缓存面，转换为 2,164,878 个三角面；未减面。
- 相同舱段、相同原始图层合为 61 个绘制批次，硬边保留。
- 八个舱段区域根据原始物体的空间位置划分。它们是本体验的功能分区，不是原文件提供的舱段工程语义。
- 坐标转为 Y 向上，并使用展示比例。模型尺寸、舱内尺寸与连接图不构成工程尺度校验。
- `model-manifest.json` 保存原文件 SHA-256、顶点/面数、批次及坐标变换。

## 八个独立空间

天和指令舱、天和生活舱、多向对接节点、问天生命实验舱、梦天物理实验舱、天舟货运舱、神舟轨道舱、气闸出舱准备舱。

每个空间独立保存三维物件、导航网格、宇航员、机器人与协作任务；相邻舱段可通过舱门切换。在整站中选中舱段，会将对应外壳和真实舱内一起抽出，其他舱段留在原位作为半透明背景；虚线轮廓和引线标明原位。选舱保留整站镜头，可点击「近看空间」主动靠近，或滚轮缩放。再次点击或点击进入按钮时，对整站和镜头同步换算坐标，连续靠近同一空间；返回先恢复抽出预览，收回时恢复整站视角。点击空白或按 Esc 也可以收回；剖面与第一人称可以互相切换。

舱内是按功能重建的可探索设计，并非 Max 原始模型的几何导入或真实天宫内装的测绘复原。宇航员采用精细贴图模型与轻量骨骼驱动；移动采用可避碰的水平导航，尚不是微重力动力学模拟。机器人任务在各自舱内执行，当前不自动跨舱运货。

## 素材来源

- `textures/equipment-panel.jpg`、`instrument-controls.jpg`：用户 RAR 包中 `3d66Model-17721496-files-001.png` 的区域裁切。部分设备标字沿用源贴图，不代表真实天宫设备标识。
- `textures/brushed-metal*.jpg`：用户包中的 050、051 图片。
- `textures/fabric-*.jpg`：项目已有 `assets/archviz/fabric-*`；底色改为暖白并添加缝线，法线和粗糙度保留。
- `textures/equipment-panel-normal.png`：从设备贴图灰度导出的浅浮雕法线，不是原资产的真实法线。
- `textures/sources.json` 记录裁切区域和原路径。
- `earth-day.jpg`：Three.js 示例地球纹理，下载自 https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg 。
- `props/*`：用户授权的本地 TRELLIS-text-xlarge 服务（127.0.0.1:7861）生成。正式资源仅保留货包、仪器与气闸航天服的 interior.glb 和来源记录；原模型、预览及未使用的旧航天服已清理。站内活动乘员使用 assets/characters 中的独立成品。
- `scripts/prepare-station-props.py` 去掉航天服的多余展示底座，保留 UV 与贴图，对 UV 接缝两侧法线平滑。生成物件是视觉资产，不是工程级设备。

## 验证

`tests/station-experience.test.cjs` 真实加载本地页面，检查八舱入口和导航、E 键过舱、非法相邻跳转、按舱保存机器人、巡检任务、移动边界、手机布局、恢复办公楼和再次进入。

以下为开发环境的历史验证命令，需要另行取得上述测试脚本。使用 Node 20+、Playwright 与 Chrome，先启动服务，再运行：

```sh
node tests/station-experience.test.cjs
```

浏览器验证截图和结构化报告保存在 `tests/station/`。首轮整站载入约 50 MB 外观模型及精细道具，需要支持 WebGL 的浏览器。整体采用复用网格、贴图、实例化机柜部件与静态环境遮蔽缓存，舱内仅显示当前空间。
