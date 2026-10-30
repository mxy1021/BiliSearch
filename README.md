# BiliSearch — B站快捷搜索

选中网页文字，右键点击 **在 Bilibili 搜索“选中文字”**，即可在新的活动标签页中搜索。无需复制粘贴，不覆盖当前网页。这是可以直接加载的 Manifest V3 扩展，无需构建或安装 npm 依赖。

## 技术方案

- Background Service Worker 在 `runtime.onInstalled` 时创建菜单，先清理本扩展的旧菜单，用稳定 ID 避免重复。浏览器持久保存菜单；Worker 唤醒时无需再次创建，点击监听器在顶层同步注册。
- `chrome.contextMenus.create()` 配置 `contexts: ["selection"]`，仅在文字选区上下文显示。标题 `在 Bilibili 搜索“%s”` 由浏览器替换，无需 Content Script。长选区可能在菜单上被截短，搜索仍使用事件中的完整 `selectionText`。
- `chrome.contextMenus.onClicked` 获取选区，经 `encodeURIComponent()` 编码后拼接搜索 URL，再调用 `chrome.tabs.create({ url, active: true })`。有来源窗口信息时在同一窗口打开新标签页。
- 只申请 `contextMenus` 权限。创建标签页无需 `tabs` 权限；无需 `activeTab`、`scripting`、剪贴板、存储或站点权限。

本项目采用**单个独立菜单项，不设置父菜单、不添加其他菜单项**，尽量减少操作层级。

官方参考：

- [Chrome contextMenus API：selection、%s 和事件](https://developer.chrome.com/docs/extensions/reference/api/contextMenus)
- [Chrome Tabs API：创建标签页无需额外权限](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [Edge 的 Chrome 扩展兼容说明](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension)
- [Edge 本地加载、更新和错误排查](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading)

## 项目结构

工作区本身就是扩展根目录，不再嵌套另一层 BiliSearch：

```text
D:\Projects\BiliSearch\
├── manifest.json             # MV3 元数据、权限、Worker、图标声明
├── background.js             # 菜单注册、点击处理、关键词编码、创建标签页
├── icons/
│   ├── icon16.png            # 16×16，小尺寸显示
│   ├── icon48.png            # 48×48，扩展管理界面
│   └── icon128.png           # 128×128，扩展展示
├── tests/
│   ├── background.test.cjs   # Node 内置测试，无第三方依赖
│   └── selection.html        # 手动验收网页，不参与扩展运行
└── README.md                 # 安装、使用、调试与验收说明
```

图标为本项目绘制的电视与放大镜图形，非 Bilibili 官方标志。本项目与 Bilibili 官方无关联。

## Microsoft Edge 安装

1. 打开 `edge://extensions/`。
2. 开启“开发人员模式”。
3. 点击“加载解压缩的扩展”（部分版本叫“加载已解压的扩展程序”）。
4. 选择 **`D:\Projects\BiliSearch`**，即直接包含 `manifest.json` 的目录，不是 icons 或 tests。
5. 确认出现 **BiliSearch 1.0.0**，开关启用，没有加载错误。
6. 到普通网页选择文字并右键，点击 BiliSearch 搜索项。无需固定工具栏图标，本扩展没有弹出窗口或工具栏按钮功能。

修改代码后，在扩展卡片点击“重新加载”，再回网页重新选择文字。不要移动或删除已加载的源目录。卸载时在扩展卡片点击“删除”。组织策略若禁止本地扩展，需要设备管理员处理，本项目不绕过策略。

## Google Chrome 安装

1. 打开 `chrome://extensions/`。
2. 开启右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择 `D:\Projects\BiliSearch`。
4. 确认已启用，随后到普通网页选中文字并右键测试。
5. 修改代码后，点击扩展卡片的重新加载按钮。

本地开发无需商店账号、打包 CRX 或签名。面向当前支持 MV3 的桌面版 Edge / Chrome，其他 Chromium 浏览器需要另行实测。

## 手动功能验收

首先在普通 HTTP/HTTPS 网页测试。也可以在项目根目录运行下面的可选命令（需 Python），再访问 [本地验收页](http://127.0.0.1:8765/tests/selection.html)：

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

结束后按 Ctrl+C 停止服务。扩展运行不依赖此服务器。本地 file 页面可能需要在扩展详情开启文件网址访问，使用 HTTP 验收页即可避免这一额外设置。浏览器特殊页面不作为首个验收场景。

依次选中下表文字、右键并点击搜索。每次核对菜单标题、新页被激活、域名为 `search.bilibili.com`、关键词一致；返回原标签页确认 URL、内容和浏览状态没有被覆盖。

| 选中文字 | 检查点 |
| --- | --- |
| `中文教程` | 中文无乱码 |
| `JavaScript` | 英文一致 |
| `hello world` | 内部空格保留，编码为 `%20` |
| `C# ASP.NET Core 教程` | `#` 编码为 `%23`，中文和空格正确 |
| `a&b=c?x#y+z/%` | `&` 不拆分参数，`#` 不变为 fragment，`+` 不变为空格 |
| `表情🙂 🚀` | Unicode 表情保留 |
| 多行文字、带首尾空格文字 | URL 解码后的关键词等于浏览器提供的选区，搜索站点可能另行规范化显示 |

混合示例的初始目标 URL 应为：

```text
https://search.bilibili.com/all?keyword=C%23%20ASP.NET%20Core%20%E6%95%99%E7%A8%8B
```

还要检查：

1. 取消选择后右键，不显示 BiliSearch。纯空白选区即使浏览器显示菜单，点击也不会打开标签页。
2. 改变选区，菜单标题随之变化，无需刷新网页。
3. 重新加载扩展后只有一个菜单项。
4. 关闭 Worker DevTools，等待 Worker 休眠后再点击菜单；重启浏览器后再次测试。
5. 多次搜索每次新建活动标签页，原网页一直保留。

扩展保证将浏览器提供的选区编码到 URL；DOM 空白归一化由浏览器决定。Bilibili 的重定向、搜索结果、登录要求及网络访问由站点决定。如果出现验证码，请自行处理。

## 调试 Background Service Worker

1. 在 `edge://extensions/` 或 `chrome://extensions/` 开启开发者模式。
2. 找到 BiliSearch，点击卡片或详情中的 **Service Worker / 检查视图** 链接。
3. 在 Worker DevTools 的 **Console** 查看错误，在 **Sources → background.js** 的点击回调处设断点，再回网页选中文字并点击搜索。
4. 核对 `info.selectionText` 和 `options.url`，需要时在控制台输入 `chrome.runtime.getManifest()` 查看配置。
5. Worker “非活动/已停止”通常是正常休眠；点击菜单应自动唤醒。打开 DevTools 会影响生命周期，验收休眠时应关闭它。

正常搜索无日志。出错时会打印：清理菜单失败、创建菜单失败、打开搜索标签页失败或无法执行搜索。生产代码不主动记录选中文字。

## 常见问题

| 现象 | 排查 |
| --- | --- |
| 无法加载 | 选择包含 manifest.json 的根目录；检查 JSON、Worker、PNG 是否齐全；读取加载窗口具体报错 |
| 没有菜单 | 确认扩展启用且选中文字；在普通网页或验收页测试；重新加载后重新选择；检查 Worker 错误 |
| 标题截短 | 浏览器显示长度限制；在点击回调断点核对完整 selectionText 和 URL |
| 没打开新页 | 检查 Worker Console；确认不是空白选区；若正在拖动标签页，结束拖动后重试 |
| 新页打不开/无结果 | 先核对地址和关键词，再排查网络及站点状态；创建正确 URL 与站点返回结果是两项不同验证 |
| 扩展卡片显示“错误” | 打开错误详情，修复并重新加载；清除旧错误再复测 |

## 自动化检查

安装 Node.js 后在项目根目录运行（安装、运行扩展无需 Node）：

```powershell
node --check background.js
node --test tests/background.test.cjs
```

使用 Node 内置 `node:test`、`assert`、`vm` 模拟 Chrome API，覆盖 Manifest 和资源、安装更新去重、编码、空白、错误处理。自动化检查不等同于真实右键菜单验收。

### 本次实际验证（2026-10-31）

- `node --check background.js` 通过；19 项 Node 自动化测试全部通过。
- 使用本机 **Microsoft Edge 156.0.4314.50**、独立临时配置和无界面模式加载工程，扩展管理 API 返回 `ENABLED`，初始 Manifest / 运行错误列表均为空。
- 通过 DevTools 协议启动真实扩展 Service Worker；在 Worker 内对已有菜单 ID 执行空更新，确认菜单确实已注册。
- 在真实 Worker 中直接调用 `tabs.create` 验证最小权限可创建活动标签页。DevTools 观察到目标 URL 与上面的混合编码示例一致，Bilibili 页标题为 `C# ASP.NET Core 教程-哔哩哔哩_bilibili`，原测试标签页仍保留。
- 该浏览器检查直接调用了标签页 API，没有模拟用户的原生菜单点击；点击处理逻辑由 Node 测试覆盖。**原生右键菜单显示、标题替换、菜单点击端到端流程、重启后的交互以及 Chrome 安装仍待人工验收**，不能据此声称这些已通过。
- 测试配置与用户日常 Edge 配置隔离，不将测试扩展安装到日常配置中。

## 隐私与权限

不读取剪贴板、不注入网页、不存储搜索记录，也不向额外服务器发请求。只有点击菜单后，选中文字才通过搜索 URL 发给 Bilibili；搜索站点和浏览器自身可能保留相关记录。
