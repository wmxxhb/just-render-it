# Typora Math Compat

让复制到 Typora 的 LaTeX 公式直接显示、编辑和保存。

安装时会自动检查版本和文件兼容性。

## 功能

- **兼容多种公式语法**：内联 `$...$`、`\(...\)`，块公式 `$$...$$`、`\[...\]`，以及 `math` 代码围栏和常见 LaTeX 公式环境。
- **支持复杂公式**：单行、跨行、多行对齐和公式编号。
- **保留原始格式**：编辑、切换源码模式和保存后，保留公式分隔符。
- **安装与恢复方便**：离线使用，无需额外运行环境；自动备份原文件，可随时卸载恢复。

## 使用指南

1. 从 [Releases](https://github.com/wmxxhb/typora-math-compat/releases/latest) 下载 **`typora-math-compat-v2.0.0.zip`**，完整解压。
2. 保存文档，退出所有 Typora 窗口。
3. 双击 **`安装.cmd`**；若未自动找到 Typora，按提示粘贴 `Typora.exe` 的完整路径。
4. 安装成功后重新打开 Typora，打开包内的 **`示例.md`** 查看效果。

如需内联公式，请在 Typora **偏好设置 → Markdown** 中启用“内联公式”，按设置提示重新打开应用。

- **检查状态**：双击 `检查.cmd`。
- **卸载恢复**：退出 Typora 后，双击 `卸载.cmd`。

更多：[详细使用说明](使用说明.md) · [公式示例](示例.md) · [开发文档](docs/development.md) · [MIT 许可证](LICENSE.txt)
