# dsh-skill&mcp-butler · 部署与使用说明

> 一个给 DeepSeek Harness（DSH）用的全屏 Skills & MCP 管理器。
> 仓库：<https://github.com/<owner>/dsh-skill-mcp-butler>
> 发布：<https://github.com/<owner>/dsh-skill-mcp-butler/releases/tag/v0.1.0>

---

## 1. 插件信息

| 项 | 值 |
|---|---|
| 显示名 | **dsh-skill&mcp-butler** |
| npm 包名 | `dsh-skill-mcp-studio`（历史 slug；`&` 不能用于 npm 包名） |
| GitHub 仓库 | `dsh-skill-mcp-butler`（`&` 同样不允许） |
| 版本 | `0.1.0` |
| 类型 | DSH 双面 bundle 插件（Host + Client，单包） |
| License | MIT（Host 半部分逻辑改编自 `dsh-skills-mcp-group-manager`，见 `NOTICE.md`） |
| 状态 | Phase 1：与 `dsh-skills-mcp-group-manager` 共存；Phase 2 自建代码已内置 |
| 分类 | `skill` |

### 它解决什么问题

DSH 的 skill 分组/开关原本只有一个窄侧栏，缺少搜索、批量操作，也不能逐项开关。
这个插件把管理面做成一个可缩放的小窗口：

- **主界面直接列出全部 skill**，每行一个开关：开 = 模型可自动调用，关 = 仅手动；
- **搜索** skill 名称/描述与 MCP 服务器；
- **批量**：多选后加入分组、从分组移除、移出所有分组；
- **分组**：新建/重命名/删除/启用停用，拖拽 skill 归组；
- **MCP**：查看在线状态、工具数、逐个启停，用户添加的 MCP 可删除；
- **窗口**：最小化（收成右下角胶囊）、放大/还原、关闭；`Ctrl+Shift+M` 随时开合。

### 截图

![总览](overview.png)

![分组](group.png)

---

## 2. 环境要求

| 依赖 | 要求 |
|---|---|
| DSH | 当前打包版（Web GUI / Desktop 均可） |
| Node.js | ≥ 18（宿主自带运行时即可） |
| 包管理器 | 仅命令行安装时需要 `pnpm`（`dsh plugin` 依赖它） |
| 网络 | 从 GitHub 安装时需要能访问 github.com；用本地 tgz 则不需要 |

> **Phase 1 依赖**：默认模式下，本插件把读写转发给
> `dsh-skills-mcp-group-manager` 的 RPC。**请先确保它已安装并启用**，
> 否则界面会提示「找不到可用的管理后端」。

---

## 3. 安装

### 3.1 Web profile（推荐，命令行一条）

```powershell
# 直接从 GitHub 安装
dsh plugin --profile web add github:<owner>/dsh-skill-mcp-butler

# 或从 Release 的 tgz 安装
dsh plugin --profile web add "https://github.com/<owner>/dsh-skill-mcp-butler/releases/download/v0.1.0/dsh-skill-mcp-studio-0.1.0.tgz"
```

安装后重启该 profile 进程：

```powershell
# 停掉正在运行的 dsh web，再启动
dsh --profile web --port 3080 --no-open
```

> 为什么必须重启：bundle 的客户端代码在启动时计算 hash 并写入 boot manifest，
> 运行中替换文件不会被重新加载。

### 3.2 Desktop（Electron 托管 profile）

桌面版 profile 不允许 `dsh plugin` 直接写入（会报
`profile "desktop" is managed exclusively by the Electron application`），
需要手动完成等价操作：

```powershell
# 1) 把源码克隆到本地
git clone https://github.com/<owner>/dsh-skill-mcp-butler.git C:\Users\<你>\Desktop\dsh-plugins\dsh-skill-mcp-butler

# 2) 在 profile 的 node_modules 建 junction
cmd /c mklink /J "%USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-skill-mcp-butler" "C:\Users\<你>\Desktop\dsh-plugins\dsh-skill-mcp-butler"
```

3) 编辑 `%USERPROFILE%\.dsh\profiles\desktop\package.json`：

```jsonc
{
  "dependencies": {
    "dsh-skill-mcp-butler": "link:C:/Users/<你>/Desktop/dsh-plugins/dsh-skill-mcp-butler"
  },
  "dsh": {
    "profile": {
      "bundles": [
        // …原有条目…
        "dsh-skill-mcp-butler"
      ]
    }
  }
}
```

> 如果安装的是旧包名 `dsh-skill-mcp-studio` 的版本，把上面的名字换成它即可。

4) 重启桌面端（完全退出后重新打开）。

### 3.3 本地开发（不发布）

```powershell
dsh plugin --profile web add "link:C:\path\to\dsh-skill-mcp-butler"
```

改完 `lib/client.js` 后刷新页面；若宿主未热重载，重启 profile 进程。

### 3.4 验证安装

- 会话顶部出现 **dsh-skill&mcp-butler** 按钮；
- 或任意页面按 `Ctrl+Shift+M`；
- 打开后应看到全部 skill 列表与每行开关。

---

## 4. 使用

| 操作 | 说明 |
|---|---|
| `Ctrl+Shift+M` | 打开 / 关闭 |
| 右上 `—` | 最小化到右下角胶囊 |
| 右上 `□` | 放大 / 还原 |
| 右上 `×` | 关闭（Esc 同效） |
| 主列表开关 | 全局开启/关闭该 skill（开启 = 加入隐藏的「单独启用」组） |
| 搜索框 | 过滤 skill 与 MCP |
| 多选 + 加入分组 | 批量归组 |
| 拖 skill 到左侧分组 | 加入该组 |
| 拖到「未分组」 | 移出所有分组 |
| MCP 页 | 启停服务器；用户添加的可删除 |

### 启用逻辑（重要）

DSH 的模型 skill 目录由「已启用分组里的成员」决定：

- skill 在任意**已启用**组里 → 模型可自动调用；
- 不在任何组，或只在停用组里 → 仅手动调用；
- 主列表开关用隐藏组 `单独启用` 实现「单个 skill 直接开启」，不会污染你已有的分组。

---

## 5. 共存与 Phase 2

### Phase 1（默认）：共存

`cordis.patch.yml` 默认 `manageCatalog: false`：

- Host 半不注册第二套状态/过滤，避免和旧插件双重过滤；
- Client 半自动探测后端：优先自己的 RPC，不存在则退回
  `dsh-skills-mcp-group-manager` 的 RPC；
- 两边共用同一份 `~/.dsh/mcp-skill-manager/state.json`。

适合：已经装了旧插件、只想换更好用的界面。

### Phase 2：自建

Host 半接管状态、过滤、MCP 开关与自己的 RPC：

1. 在 profile 的用户 patch 里把本插件配置改为 `manageCatalog: true`；
2. 从 `dsh.profile.bundles` 移除 `dsh-skills-mcp-group-manager`（保留包与数据，便于回滚）；
3. 重启。

自建模式的数据在 `~/.dsh/skill-mcp-studio/state.json`，首次启动会从旧的
`mcp-skill-manager/state.json` 迁移一次。

适合：没装旧插件的新用户，或准备彻底替换旧插件。

> ⚠️ 不要让两套过滤同时生效。切 Phase 2 时务必停用旧插件。

---

## 6. 升级 / 卸载 / 回滚

### 升级

```powershell
dsh plugin --profile web update dsh-skill-mcp-butler
# 或重新 add 新 tag 的 tgz
```

### 卸载（web profile）

```powershell
dsh plugin --profile web remove dsh-skill-mcp-butler
```

> 卸载不会删除你的分组数据（Phase 1 用的是旧插件的数据目录）。

### 卸载（desktop）

1. 从 `package.json` 的 `dependencies` 和 `dsh.profile.bundles` 中删除该条目；
2. `cmd /c rmdir "%USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-skill-mcp-butler"`；
3. 重启桌面端。

### 回滚到旧界面

Phase 1 不修改旧插件；删掉本插件条目并重启即可回到原状。

---

## 7. 故障排查

| 现象 | 原因 / 处理 |
|---|---|
| 顶部没有按钮、`Ctrl+Shift+M` 无效 | bundle 未加载：确认 `dsh.profile.bundles` 有该条目、node_modules 链接存在，然后**重启** |
| 打开后提示「找不到可用的管理后端」 | Phase 1 但 `dsh-skills-mcp-group-manager` 未安装/未启用；安装它，或切 Phase 2 |
| 403/401、页面打不开 | 用桌面端/带 token 的 URL；不要直接访问 `127.0.0.1:<port>/` |
| 分组数据变空 | 旧插件启动时读到空状态，随后任意写操作会把空状态落盘；从 `_backup` 恢复 `state.json` 后**重启**，不要在不重启的情况下继续改 |
| 安装时报 `profile "desktop" is managed exclusively…` | 桌面 profile 只能手动安装，见 3.2 |
| `pnpm add` 拉不到元数据 | 镜像/网络问题；用已发布的 tgz 或 `--offline` |

---

## 8. 安全说明

- 插件只读写本机 DSH profile 与 `~/.dsh` 下的状态文件，不发起外部网络请求（除本地 RPC）。
- Phase 1 依赖旧管理器的 RPC，不额外暴露端口。
- 不建议把 `state.json`、token、cookie 提交到仓库。
- 市场安装属于第三方代码，请自行审阅来源。

---

## 9. 市场收录状态

- Release：`v0.1.0`（附 tgz）
- **PR 待开**：`awesome-dsh-plugin` 要求仓库创建满 **1 天**，最早 2026-10-27 22:10 之后；
  到时运行 `marketplace/open-pr.ps1`。
- 合并后 dshmarket 通常一天内出现。

---

## 10. 目录结构

```
dsh-skill-mcp-butler/
├─ package.json          # dsh.bundle + dsh.client 声明
├─ cordis.patch.yml      # 挂载入口（manageCatalog: false）
├─ lib/
│  ├─ index.js           # Host 半：状态 / 过滤 / MCP / RPC / studio_* 工具
│  ├─ state.js           # 纯状态逻辑
│  ├─ store.js           # 原子持久化 + 旧数据迁移
│  └─ client.js          # 浏览器半：全屏 UI
├─ docs/                 # 截图 + 本文档
├─ marketplace/          # 目录条目、提交说明、开 PR 脚本
├─ NOTICE.md / LICENSE
└─ README.md
```

---

## 11. 名字里的 `&`

| 位置 | 能不能用 `&` |
|---|---|
| 插件标题 / 市场描述 / README | ✅ `dsh-skill&mcp-butler` |
| npm 包名 | ❌ 只能小写字母、数字、`-`、`_`、`.`；当前为 `dsh-skill-mcp-studio` |
| GitHub 仓库名 | ❌ 同上；用 `dsh-skill-mcp-butler` |
| 本地源码目录 | 可以，但会带来 shell 转义麻烦，建议用 slug |

所以你在界面、文档、市场描述里看到的都是 **dsh-skill&mcp-butler**，
安装命令和仓库地址里是 **dsh-skill-mcp-butler**。


