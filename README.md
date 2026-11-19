# ominiverse

Ominispace 是办公楼、园区与空间站中的人机协同三维体验，包含人物活动、机器人部署、场景事件和空间站影片。前端直接加载本地模型与媒体，Node.js 提供页面和可选智能服务，无需前端编译。

本仓库整理自当前线上运行版本的脱敏快照。部署地址与配置已改为示例；账号凭据、访客任务、缓存、日志和历史提交不包含在公开版本中。开发测试与录制工具未随线上版本发布。

## 获取与启动

需要 Node.js 20 或更新版本，以及 [Git LFS](https://git-lfs.com/)。模型、纹理、视频等二进制资源使用 Git LFS，完整下载约 1.46 GiB。

```bash
git lfs install
git clone https://github.com/chenlubenren/ominiverse.git
cd ominiverse
git lfs pull
npm ci
npm start
```

打开 <http://127.0.0.1:8910/>。需要支持 WebGL 的现代浏览器；首次加载模型和影片可能较慢。请使用包含 LFS 实际文件的克隆副本，避免把资源指针文件当作模型运行。

基础场景、已有模型和本地规则无需 API Key。云端智能解析与新模型生成需要另行配置服务；新模型生成还需要 Blender，且可能产生上游费用。

## 配置与部署

- [部署说明](docs/部署.md)：环境变量、可选依赖和文件范围。
- [公网运维](docs/公网运维.md)：Linux 服务、HTTPS、运行数据和版本切换。
- [.env.example](.env.example)：可复制为 `.env.local` 的可选服务配置模板。

`HOST`、`PORT` 等启动参数通过进程环境设置。`.env.local` 仅支持模板所列字段，不会自动读取任意环境变量。

## 目录

| 路径 | 内容 |
| --- | --- |
| `index.html`、根目录 CSS、`js/` | 主界面、样式和浏览器代码 |
| `assets/` | 正式模型、纹理、影片、音频与来源记录 |
| `server.cjs`、`scripts/` | Node.js 服务和运行所需处理程序 |
| `deploy/` | systemd、nginx 和证书续期示例 |
| `asset-studio.html`、`station-designs.html` | 角色预览与空间站方案页面 |

`.runtime/`、`.cache/` 会在运行时按需创建；它们包含任务或缓存，不应提交。第三方代码与素材的许可证、署名和来源保留在 `js/vendor/`、`js/station-designs/` 和对应 `assets/` 目录中，使用时请遵循各自许可。
