# dsh-skill&mcp-butler

DSH（DeepSeek Harness）的全屏 **Skills & MCP 管理器**，单个 bundle 插件（Host + Client）。

## 功能

- 全部 skill 一屏列出，逐项开关：开 = 模型可自动调用，关 = 仅手动
- 搜索 skill / MCP；多选批量加入或移出分组
- 分组管理、拖拽归组（可选功能）
- MCP 服务器启停
- 小窗显示，带最小化 / 放大 / 关闭；`Ctrl+Shift+M` 随时开合

## 安装

```powershell
# 从 GitHub 安装（把 <owner> 换成本仓库所属账号）
dsh plugin --profile web add github:<owner>/dsh-skill-mcp-butler
```

或下载 Release 里的 `.tgz` 后：

```powershell
dsh plugin --profile web add "C:\path\to\dsh-skill-mcp-studio-0.1.0.tgz"
```

> 默认与 `dsh-skills-mcp-group-manager` 共存（Phase 1），没有它界面会提示缺少后端；
> 独立运行方式（Phase 2）见部署文档。

## 使用

按 `Ctrl+Shift+M` 打开。主列表每行右侧开关控制该 skill 是否可被模型自动调用；
分组是可选功能，不分组也能单独开关。

## 文档

- [部署与使用](docs/DEPLOY.zh.md)：Web / Desktop 安装、共存与 Phase 2、升级卸载、排错

## License

MIT，见 [LICENSE](LICENSE)。
