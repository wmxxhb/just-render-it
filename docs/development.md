# 开发与验证

安装和日常使用只需要 Windows 自带的 PowerShell。以下 Node.js、Python 命令用于开发与验证，不是终端用户的安装依赖。

本页面向源码仓库。发行 ZIP 不包含 `tests` 和 `scripts`；进行开发请先克隆仓库或下载仓库源码。

## 目录

```text
patch.ps1                   安装、检查、备份与恢复
payload/compat.js           辅助识别、表格保护与序列化
payload/patches.json        版本、目标校验值及精确替换规则
tests/helper.test.cjs       无需 Typora 的独立单元测试
tests/install-roundtrip.py  使用本地原版副本测试安装与恢复
tests/native-parser.cjs     使用本地补丁后文件测试原生解析器
scripts/package.py          构建带校验清单的离线 ZIP
.github/workflows/check.yml 自动化检查与打包校验
```

`compat.js` 沿用已验证的 v2.0.0 实现。`patch.ps1` 保留 UTF-8 BOM，以供 Windows PowerShell 5.1 正确读取中文消息。修改载荷时需要同步更新清单中的辅助文件校验值；修改替换规则后，还要在本地原版副本上验证生成结果并更新预期校验值。

## 独立测试

需要 Node.js 20 或更新版本，使用内置测试模块，不安装第三方依赖：

```powershell
node --test tests/helper.test.cjs
```

覆盖单行、跨行分隔符，原始格式序列化，含 `aligned` 和 `tag` 的公式，明确标记的公式围栏，独立环境，转义、未闭合标记、表格竖线和载荷完整性。

## 安装与卸载集成测试

需要 Windows、Windows PowerShell 5.1、Python 3.9+，以及自己合法安装的匹配构建原文件。传入的目录应包含原版 `window.html` 和 `appsrc/window/frame.js`；安装器生成的原始备份目录也可使用。

```powershell
python tests/install-roundtrip.py --original-resources "C:\Program Files\Typora\resources\modu-math-compat-backup"
```

测试先校验输入，随后将原文件复制到系统临时目录。所有安装与卸载均在这些副本上执行，不修改输入目录和真实安装。临时目录会输出并保留，方便检查，可在测试完成后自行删除。

检查内容：只读状态查询；生成与已验证 v2 完全一致的文件；重复安装；卸载恢复；重复卸载和重装；旧版 v2 备份导入；错误版本；程序文件改动；已有备份损坏；卸载缺少原版备份；辅助文件被改动；第二个文件被锁定时，撤回已经完成的第一个文件修改。

## 原生解析器集成测试

使用经过核验、已安装本补丁的本地 `frame.js`：

```powershell
node tests/native-parser.cjs "C:\Program Files\Typora\resources\appsrc\window\frame.js"
```

测试在隔离的 Node.js 上下文中加载目标模块，以桩对象替代编辑器外围依赖，验证内联解析、12 个块解析与保存用例、公式（8）和（9）、代码、表格、转义及未闭合标记。这是解析器集成测试，不替代 Typora 窗口内的实际渲染、编辑和撤销检查。

Typora 的完整程序文件和本地备份不进入仓库，也不作为 CI 工件上传。

## 构建发布包

```powershell
python scripts/package.py
```

生成 `dist/typora-math-compat-v2.0.0.zip`，包含用户入口、载荷、README、详细说明、示例、许可和 `SHA256SUMS.txt`。使用显式文件清单，排除测试夹具、Git 历史、构建缓存、开发脚本和本机备份。打包脚本会核验辅助脚本哈希、PowerShell BOM 和 Windows 启动入口行尾。

## CI 的范围

GitHub Actions 在 Linux 和 Windows 上运行独立测试，并在 Windows 上使用 PowerShell 5.1 检查安装脚本语法，运行打包与 ZIP 校验。CI 不下载、打补丁或重新分发 Typora 程序文件，也不会自动执行依赖本地私有夹具的安装器和原生解析器测试。

增加支持版本前，请提交该版本的目标哈希、可复现的精确替换规则，以及本地安装与卸载、编辑与保存验证。不要直接放宽版本或文件校验。
