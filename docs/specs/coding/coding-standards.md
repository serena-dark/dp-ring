# 代码规范

本文件是**代码与模块层**约定的入口，面向在本仓库中实现与评审代码的开发者；定义格式、命名、模块边界等，与文档树的目录约定无关。**注释与文档类说明句**的通用规则见 [documentation-standards.md](../../documentation-standards.md)。

**`session_id`（字面值生成）**：语义与适用环节见 [sessions.md](../../sessions/sessions.md)。若在脚本或服务中需要生成与文档规范一致的 **`session_id` 三段式字面值**（含归档目录名、文首引用等同源串），**必须**从仓库内 `cli-tool/lib/session-id.mjs` `import { buildSessionArchiveBasename }`（相对路径按调用文件调整），禁止复制随机码或日期拼接逻辑。

> 待完善：Formatter/Linter 策略（见根目录 ESLint 配置）、导入顺序、React 组件约定。
