# Typora Math Compat

让 Windows Typora 1.2.4 识别 `\(...\)`、`\[...\]`、`math` 代码围栏及常见独立 LaTeX 公式环境。复制含公式的 Markdown 后，可以直接在 Typora 中编辑、预览和保存，保留原来的公式分隔符。

**兼容范围：Windows · Typora 1.2.4 · 本项目记录的程序文件构建。** 安装器同时核对版本与 SHA-256；其他版本或已被其他补丁修改的文件会停止安装。

[下载 v2.0.0](https://github.com/wmxxhb/typora-math-compat/releases/tag/v2.0.0) · [详细使用说明](使用说明.md) · [公式示例](示例.md) · [测试与开发](docs/development.md)

## 它解决什么问题

有些 Markdown 内容使用 LaTeX 分隔符，例如下面这段带对齐和编号的公式：

```text
\[ \begin{aligned}
f(x)&=x^2+1\\
f'(x)&=2x
\end{aligned} \tag{9} \]
```

本补丁让这类内容进入 Typora 的原生公式编辑与 MathJax 渲染流程，支持在开始、结束分隔符旁边写公式。切换源码模式、修改公式和保存文档后，仍然保留原来的分隔符形式。

安装与使用均可离线完成，无需额外安装 Python、Node.js 或插件框架。安装器提供原版备份、文件核验和卸载恢复。

## 快速开始

1. 从 [Releases](https://github.com/wmxxhb/typora-math-compat/releases) 下载 **`typora-math-compat-v2.0.0.zip`**，完整解压。
2. 保存文档，完全退出所有 Typora 窗口。
3. 双击 **`安装.cmd`**。若未自动找到 Typora，按提示粘贴 `Typora.exe` 的完整路径。
4. 看到“安装成功”后重新打开 Typora，打开包内 **`示例.md`** 检查效果。
5. 如需内联公式，在 Typora“偏好设置 → Markdown”中启用“内联公式”，按设置提示重新打开应用。

源码下载包也可以直接使用，上述入口和 `payload` 文件夹必须保留在一起。若安装目录需要管理员写入权限，确认路径后右键以管理员身份运行入口。

## 支持的语法

| 类型 | 示例 | 说明 |
| --- | --- | --- |
| 原生内联 | `$x^2$` | 沿用 Typora 的内联公式设置 |
| LaTeX 内联 | `\(x^2\)` | 可直接编辑；支持表格内含竖线的公式 |
| 美元符号块 | `$$ E=mc^2 $$` | 单行、跨行、分隔符独占一行均可 |
| LaTeX 块 | `\[ E=mc^2 \]` | 单行、跨行、公式紧邻分隔符均可 |
| 公式代码围栏 | 语言标记为 `math` | 支持反引号和波浪线围栏 |
| 独立 LaTeX 环境 | `\begin{align} … \end{align}` | 环境列表见下文 |

独立环境支持 `equation`、`align`、`aligned`、`gather`、`gathered`、`multline`、`displaymath`、`eqnarray`；其中 `equation`、`align`、`gather`、`multline`、`eqnarray` 还支持 `*` 形式。环境或块公式应构成独立段落。

````markdown
内联：\(a_1+b_2\)。

\[ x^2+y^2=z^2 \]

$$a+b+
c=d$$

```math
\int_0^1 x\,dx=\frac12
```

\begin{align*}
a&=b+c\\
d&=e+f
\end{align*}
````

分隔符需要完整配对。普通 `[方括号]`、Markdown 链接、行内代码和普通代码块仍按原来的规则处理；`latex` 代码块继续显示源码。实际 LaTeX 命令由 Typora 自带的 MathJax 解释，本项目不额外提供宏包，也不声称支持所有 LaTeX 语法。

## 检查与卸载

- 双击 **`检查.cmd`**：只读检查版本、补丁文件与原版备份。
- 保存文档并退出 Typora，再双击 **`卸载.cmd`**：恢复两个原版程序文件，移除补丁辅助脚本。
- 再次安装同一版本时不会叠加修改；卸载后可以重新安装。

原版备份位于安装目录的 **`resources\modu-math-compat-backup`**，卸载后仍然保留。需要恢复时请勿提前删除。文档、偏好设置和许可证文件不在补丁修改范围内。

## 手动指定安装位置

在解压目录打开 PowerShell：

```powershell
.\安装.cmd -TyporaPath "C:\Program Files\Typora\Typora.exe"
.\检查.cmd -TyporaPath "C:\Program Files\Typora\Typora.exe"
.\卸载.cmd -TyporaPath "C:\Program Files\Typora\Typora.exe"
```

`-TyporaPath` 可传入可执行文件、安装目录或 `resources` 目录。支持含空格和中文的路径。此前 v2 测试版的原始备份迁移方法见[详细说明](使用说明.md#从此前的-v2-测试版迁移备份)。

## 安装器做了什么

1. 检查版本及两个目标文件的完整校验值。
2. 在内存中应用精确替换规则，确认生成结果与记录的 v2 校验值一致。
3. 保存并核验原版备份，再写入目标文件；写入出错时尝试撤回本次修改。

修改范围：

```text
resources/
├── window.html                        # 加载辅助脚本
├── appsrc/window/frame.js              # 扩展解析、编辑和序列化入口
├── modu-math-compat/compat.js          # 新增：公式识别辅助代码
└── modu-math-compat-backup/            # 新增：安装时在本地保存的原版文件
```

更新或重装 Typora 可能覆盖补丁。遇到版本不匹配、目标文件被其他扩展修改、已有备份损坏时，安装器停止操作，不提供强制安装选项。Windows 启动入口只为当次 PowerShell 进程设置脚本执行策略，不改全局策略。

## 验证与贡献

v2 已完成实际 Typora 的公式渲染与编辑测试。安装器通过 Windows PowerShell 5.1 的 12 项检查，覆盖安装、重复操作、卸载、备份导入、版本与文件不匹配、损坏备份、缺失备份和写入失败撤回。原生解析器测试覆盖内联、12 个块解析与保存用例、公式编号、代码、表格、转义与未闭合分隔符。

仓库提供可独立运行的辅助代码测试，以及需要自备合法本地 Typora 文件的集成测试；具体命令和 CI 范围见[开发说明](docs/development.md)。提交问题时请附上版本、操作系统和最小 Markdown 示例，勿上传许可证、私人文档或完整程序文件。

## 许可与致谢

自编补丁、安装工具和文档采用 [MIT License](LICENSE.txt)。仓库及发布包不包含完整 Typora 程序、原版备份或安装包；Typora 及其内置组件遵循各自许可。本项目为独立社区补丁，与 Typora 官方无隶属关系。

脚本注入方式参考 [obgnail/typora_plugin](https://github.com/obgnail/typora_plugin) 的公开思路。本项目不依赖或安装该框架。

## English overview

An offline math delimiter compatibility patch for **Windows Typora 1.2.4**, restricted to the exact application hashes in `payload/patches.json`. It adds LaTeX inline/display delimiters, `math` fences and common standalone equation environments to Typora's native math workflow, preserving source delimiters on save.

Download the release ZIP, extract it, close Typora, run `安装.cmd` (install), and restart Typora. `检查.cmd` checks the installation; `卸载.cmd` restores the original files. No additional runtime is required for installation. Backups remain in `resources/modu-math-compat-backup`. This is an independent MIT-licensed patch; Typora binaries are not distributed.
