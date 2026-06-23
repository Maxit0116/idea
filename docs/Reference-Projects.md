# Project OS — 开源借鉴开发指南

**文档版本**：v1.1  
**更新日期**：2026-06-22  
**产品形态**：**Cursor 式 AI IDE fork**（基于 VS Code 架构），在 IDE 原生壳层内融入项目架构可视化、节点级 Prompt 注入、Agent Flow、Debug Harness 等差异化能力。  
**用途**：研发直接参考——每个能力域对应哪些开源项目、借什么、不借什么、落到谁的任务上。  
**关联**：[MVP-PRD](./MVP-PRD.md) · [Team-Division](./Team-Division.md) · [Terran 开发计划](./tasks/Terran-Dev-Plan.md) · [Ray 开发计划](./tasks/Ray-Dev-Plan.md)

---

## 1. 总览：两条借鉴主线

Project OS = **IDE 基座（VS Code fork）** + **差异化 AI 工作区（可视化 + 节点 Agent）**。不是单一项目 fork，而是按能力域组合借鉴。

### 1.1 能力域总表

| # | 能力域 | PRD 对应 | 主要参考项目 | Demo | MVP | Owner |
|---|--------|----------|--------------|------|-----|-------|
| **A** | **IDE 基座 / Cursor 式壳层** | F7 IDE 能力 | [Void](https://github.com/voideditor/void)、[CortexIDE](https://github.com/OpenCortexIDE/cortexide)、[VSCodium](https://github.com/VSCodium/vscodium) | ★★★ | ★★★ | Terran |
| **B** | **IDE 内 AI 架构** | F3 · F7.3 | [Continue](https://github.com/continuedev/continue) | ★★ | ★★★ | Ray + Terran |
| **C** | **Agent 在 IDE 内执行** | F3.3 · F4 | [Cline](https://github.com/cline/cline)、[Roo Code](https://github.com/RooVetGit/Roo-Code)、[OpenHands](https://github.com/All-Hands-AI/OpenHands) | ★ | ★★★ | Ray |
| **D** | **软件结构可视化 / 架构图** | F2 · F1 | [CodeBoarding](https://github.com/CodeBoarding/CodeBoarding)、[GitVizz](https://github.com/adithya-s-k/GitVizz) | ★★★ | ★★★ | Ray / Terran |
| **E** | **功能节点知识图谱** | F2.1 · F2.2 | [Understand Anything](https://github.com/Lum1104/Understand-Anything) | ★★ | ★★★ | Ray |
| **F** | **可视化工作区（塞进 IDE 主区）** | F2 · F4 · F5 | [React Flow](https://reactflow.dev)、[Stello Board](https://github.com/stello-agent/stello-board) | ★★★ | ★★★ | Terran |
| **G** | **Node Context Pack / 节点注入** | F3.1 · F10 | [repowise](https://github.com/repowise-dev/repowise)、[Aider](https://github.com/Aider-AI/aider) | ★ | ★★★ | Ray |
| **H** | **多文件改动 / checkpoint / 回滚** | F3.3 · F7 | [Aider](https://github.com/Aider-AI/aider)、[CortexIDE](https://github.com/OpenCortexIDE/cortexide)、[Void](https://github.com/voideditor/void) | ★★ | ★★★ | Ray |
| **I** | **Agent Flow 外显 / 事件模型** | F4 | [OpenHands](https://github.com/All-Hands-AI/OpenHands)、[Stello](https://github.com/stello-agent/stello)、[Cline](https://github.com/cline/cline) | ★ | ★★★ | Ray / Terran |
| **J** | **Debug Harness / 修 Bug 闭环** | F6 · F8.2 | [OpenHands](https://github.com/All-Hands-AI/OpenHands)、[SWE-agent](https://github.com/SWE-agent/SWE-agent) | — | ★★ | Ray |
| **K** | **对话分叉 / 上下文隔离** | F3.1.5 · F8.2.3 · F10 | [Stello](https://github.com/stello-agent/stello) | — | ★★ | Ray |

**图例**：★★★ 必看 · ★★ 重点参考 · ★ 了解思路 · — 本阶段不做

### 1.2 压缩版对应关系（快速查阅）

```
IDE 基座 / Cursor 式壳层怎么搭
  → Void（AI 内建到 IDE 的工程组织）
  → CortexIDE（repo-aware、agent mode、rollback）
  → VSCodium / VS Code（workbench、panel、扩展体系）

IDE 内的 AI 架构怎么搭
  → Continue（context provider、model provider、前后端拆分）

Agent 在 IDE 里怎么执行任务
  → Cline（多步任务、工具调用、审批边界）
  → Roo Code（多模式 agent、复杂任务拆解）
  → OpenHands（planning → edit → test → debug 全链路）

Node Context Pack / 节点级 prompt 注入
  → repowise（repo intelligence、依赖分析、Context Pack）
  → Aider（repo context、多文件 diff、git 协作）

可视化工作区怎么塞进 IDE 主界面
  → React Flow（功能地图、Agent Flow、节点联动）
  → CodeBoarding + Understand Anything（repo → 图的数据层）
  → Stello Board（图谱 UI / 时间线模式参考）
```

---

## 2. IDE 基座 / Cursor 式壳层

> **我们要解决的问题**：在 VS Code 架构之上 fork 出独立 AI IDE，把 Chat、Agent、可视化工作区做成**原生能力**，而不是外挂插件。

### 2.1 Void（主参考 — 开源 Cursor 工程组织）

| 项 | 内容 |
|----|------|
| 链接 | https://github.com/voideditor/void |
| 语言 / 协议 | TypeScript · Apache-2.0 |
| 定位 | 基于 VS Code 的开源 AI IDE（Cursor 替代） |

**值得借鉴**

| 借鉴点 | 说明 | 落到我们 |
|--------|------|----------|
| **VS Code fork 工程结构** | fork 后如何拆模块、如何跟进上游 | Terran T-D01 fork 基座选型 |
| **AI 能力一等公民** | Chat / Quick Edit / Agent Mode 内建于 workbench | F7.3 AI Chat 侧栏；非 extension 外挂 |
| **面板挂载方式** | 编辑器主区、侧边栏、底栏、AI 面板如何接入壳层 | T-D02 三栏布局 → 改为 **ViewContainer / WebviewView** |
| **模型接入层** | 多 provider、本地模型、API key 配置 | Ray R-M208 AI 模型选型 ADR |
| **AI checkpoint / 变更可视化** | 改动前后对比、可回滚检查点 | R-M107 git checkpoint；T-M106 checkpoint UI |
| **Monaco 已内置** | 无需单独集成 Monaco | 删除自研 Monaco 任务，直接用 VS Code editor |

**不借鉴**

- Void 自身的品牌与产品定位——我们差异化在**功能地图 + 节点 Agent**
- 完整复制 Void AI 聊天逻辑——我们有自己的 Prompt 精进 + 节点 context

**任务映射**

```
Terran: T-D01 fork Void/CortexIDE → T-D02 workbench 布局 → T-D04 复用 VS Code 文件树
Ray:    R-D02 Engine 以 extension host / sidecar 接入 fork 后的 IDE
```

---

### 2.2 CortexIDE（主参考 — Agent IDE 工作流）

| 项 | 内容 |
|----|------|
| 链接 | https://github.com/OpenCortexIDE/cortexide |
| 语言 / 协议 | TypeScript · MIT |
| 定位 | 开源 AI IDE：repo-aware retrieval、multi-file edit、rollback、agent mode |

**值得借鉴**

| 借鉴点 | 说明 | 落到我们 |
|--------|------|----------|
| **repo-aware retrieval** | 任务发起时感知整个仓库，非仅当前文件 | `buildContext(nodeId)` + 项目级 context（R-M103、R-M104） |
| **multi-file agent edit** | Agent 安全地一次改多个文件 | R-M202 `execute_change`；R-M205 范围控制 |
| **rollback / auto-stash** | AI 改崩后快速回滚 | R-M107 git checkpoint；F3.3.3 执行前检查点 |
| **agent mode / gather mode** | 读模式与写模式分离 | 对标 PRD：Prompt 精进（读/确认）→ 执行（写） |
| **工具 / 终端 / 文件操作接管** | Agent 在 IDE 内调用原生能力 | Cline 式 tool loop + VS Code terminal API |
| **节点级 agent 工作流** | 未来每个功能节点挂独立 agent scope | MVP 后 Phase 2；Roo Code 模式可参考 |

**不借鉴**

- CortexIDE 体量较小、社区较新——作**工作流参考**，fork 基座优先 Void
- 其可视化能力——我们用自研功能地图

**任务映射**

```
Ray:   R-M107 checkpoint · R-M202 多文件执行 · R-M205 改动范围
Terran: T-M106「创建检查点」UI · Agent 模式切换 UX
```

---

### 2.3 VSCodium / VS Code（基础设施必读）

| 项 | 内容 |
|----|------|
| 链接 | https://github.com/VSCodium/vscodium |
| 上游 | https://github.com/microsoft/vscode |
| 语言 / 协议 | TypeScript · MIT |
| 定位 | VS Code 开源构建；理解 IDE 基础设施的入口 |

**值得借鉴**

| 借鉴点 | 说明 | 落到我们 |
|--------|------|----------|
| **Workbench 布局体系** | activity bar、sidebar、panel、editor area | 功能地图 Tab 作为 **EditorPane / CustomEditor** |
| **View Container** | 侧边栏面板注册与生命周期 | AI Chat、Inspector、常用操作侧边栏 |
| **Workspace State** | 打开项目、多 root、配置持久化 | `openProject` + `.projectos/` 目录 |
| **Command Palette / 快捷键** | IDE 原生交互 | F7.4 对标 Cursor 快捷键 |
| **扩展 / LSP / Terminal / Git** | 原生能力与我们 AI 工作区共存 | F7.1~F7.5 直接继承，不重复造轮子 |
| **架构分层** | electron + renderer + extension host + webview | Ray Engine 部署位置决策（R-D02） |

**不借鉴**

- MS 品牌、遥测、专有扩展市场策略
- 把差异化能力做成普通 extension——核心体验应**深度集成进 fork**

**关键集成点：可视化工作区塞进 IDE**

```
VS Code 概念              Project OS 映射
─────────────────────────────────────────────────────
CustomEditor / Webview    功能地图 Tab（React Flow）
ViewContainer（Sidebar）    AI Chat + Node Inspector
Panel（底部）              Terminal（内置）
Activity Bar 新图标         「功能地图」「Agent 流程」入口
```

**任务映射**

```
Terran: 理解 workbench API → 注册自定义 Editor Tab（T-D03 升级版）
Ray:    extension host 或 node sidecar 跑 Local Engine（R-D02）
```

---

## 3. IDE 内 AI 架构

> **我们要解决的问题**：AI 不是插件补丁，而是 IDE 内的模块化子系统——上下文收集、模型调用、diff 展示、chat/edit/agent 共存。

### 3.1 Continue（主参考 — AI 体系结构）

| 项 | 内容 |
|----|------|
| 链接 | https://github.com/continuedev/continue |
| 语言 / 协议 | TypeScript · Apache-2.0 |
| 定位 | 开源 coding agent；长期沉淀 VS Code / JetBrains AI 集成经验 |

**值得借鉴**

| 借鉴点 | 说明 | 落到我们 |
|--------|------|----------|
| **前后端拆分** | extension backend + webview 前端 | Chat 侧栏 UI（Terran）↔ Engine API（Ray） |
| **Context Provider 机制** | 多来源上下文统一组装给模型 | **Node Context Pack** 作为最高优先级 provider |
| **Model Provider 抽象** | 多模型、多 API、可切换 | Ray R-M208；云端 v1 代理层 |
| **Chat / Edit / Autocomplete 共存** | 不同 AI 能力模块化 | Chat（MVP）→ Edit（后期）→ 节点驱动执行 |
| **Rules / Prompt 管理** | 项目级与全局 prompt 规则 | Prompt 精进 + 节点 `systemPrompt`（Stello 槽位对齐） |
| **Diff 展示** | 改动预览与接受/拒绝 | T-M203 Diff 预览入口 |

**Context Provider 设计（我们的扩展）**

```
Provider 优先级（高 → 低）
──────────────────────────────────────────
1. NodeContextProvider     点选功能节点的 Context Pack
2. AgentFlowProvider         当前执行步骤上下文
3. DebugContextProvider      修 Bug 分栏（堆栈/日志）
4. ProjectContextProvider    项目 summary + graph 摘要
5. FileContextProvider       当前打开文件（VS Code 原生）
6. GitContextProvider        最近变更、分支状态
```

**不借鉴**

- Continue 作为 extension 的部署形态——我们 fork 后**内建**同等模块
- 其无功能地图——这是我们的核心差异

**任务映射**

```
Ray:   R-M103 buildContext · R-M201 understand_prompt · R-M208 模型 ADR
Terran: T-M102 Chat shell · T-M201 理解反馈卡 · T-M203 diff 预览
```

---

## 4. Agent 在 IDE 内执行任务

> **我们要解决的问题**：用户点节点发 prompt 后，Agent 在 IDE 内完成多步软件工程任务，且有审批边界与执行反馈。

### 4.1 Cline（主参考 — IDE 内多步 Agent）

| 项 | 内容 |
|----|------|
| 链接 | https://github.com/cline/cline |
| 语言 / 协议 | TypeScript · Apache-2.0 |
| 定位 | VS Code 内自主编码 Agent：读文件、改文件、跑命令、调工具 |

**值得借鉴**

| 借鉴点 | 说明 | 落到我们 |
|--------|------|----------|
| **多步任务工作流** | 理解 → 规划 → 执行 → 验证 | `execute_change` 内部 step（R-M202） |
| **工具调用框架** | 文件读写、shell、搜索、diff 串联 | Agent tool registry（Ray M2） |
| **审批与权限** | 哪些操作需用户确认 | Prompt 精进 = 执行前确认；危险命令需批准 |
| **长任务反馈** | 执行过程实时 UI 更新 | T-M204 Agent 流程 v0.5 + T-M205 自动切 Tab |
| **任务状态持久化** | 多轮任务可恢复 | Current Work（F10）+ jobId 状态机 |

**不借鉴**

- Cline 以「聊天驱动一切」——我们是**节点驱动 + 聊天辅助**
- 完整复制 Cline UI——Agent Flow 用我们自己的时间线/流程图

---

### 4.2 Roo Code（主参考 — 多模式 Agent）

| 项 | 内容 |
|----|------|
| 链接 | https://github.com/RooVetGit/Roo-Code |
| 语言 / 协议 | TypeScript · Apache-2.0 |
| 定位 | 编辑器内多 Agent 团队；高自主性复杂任务 |

**值得借鉴**

| 借鉴点 | 说明 | 落到我们 |
|--------|------|----------|
| **多模式 Agent 组织** | 不同 mode 不同行为边界 | PRD 8.3 Skills：`understand_prompt` / `execute_change` / `fix_bug` |
| **复杂任务拆解** | 大需求拆子任务 | 内部 Change Plan（对用户不可见） |
| **节点级 Agent 工作流** | 每个 scope 独立 agent 上下文 | 功能节点 = Agent scope（长期愿景） |
| **模式切换 UX** | 用户明确当前 Agent 在做什么 | Agent 流程 Tab + Chat 标题「Context: 登录」 |

**不借鉴**

- 「多 Agent 团队」产品叙事——MVP 单 Agent + 流程外显
- Roo Code 完整 autonomy 级别——MVP 保守执行策略（R-M205）

---

### 4.3 OpenHands（主参考 — 软件工程全链路）

| 项 | 内容 |
|----|------|
| 链接 | https://github.com/All-Hands-AI/OpenHands |
| 语言 | Python |
| 定位 | AI-Driven Development；planning → execution → testing → debugging |

**值得借鉴**

| 借鉴点 | 说明 | 落到我们 |
|--------|------|----------|
| **Agent Step 模型** | 理解 → 计划 → 定位 → 修改 → 测试 → 修复 | `AgentFlowTracker`（R-M203） |
| **Action / Observation 循环** | 每步输入、工具、输出可追溯 | `AgentFlowLog` schema（R-ADR03） |
| **中间产物组织** | diff、shell 输出、测试结果 | T-M202 执行摘要 + T-M203 diff |
| **执行轨迹暴露** | 非聊天摘要，而是真实执行链路 | F4 Agent 流程（不是聊天记录可视化） |
| **Debug 闭环** | test → fail → diagnose → fix loop | F6 Harness 简版（M3） |

**建议 AgentFlowLog Step 枚举**

```
understand_requirement   # 理解需求（含 Prompt 精进后）
retrieve_context         # 检索 Node Context Pack
analyze_files            # 分析关联文件
generate_plan            # 内部 Change Plan
apply_changes            # 写文件 / patch
verify                   # 编译 / 运行检查
fix                      # 修 Bug 路径
```

**不借鉴**

- OpenHands 独立沙箱产品形态——我们嵌在 VS Code fork 内
- Docker 隔离方案——用户本地 dev server

---

### 4.4 Aider（主参考 — 多文件改动与 Git 协作）

| 项 | 内容 |
|----|------|
| 链接 | https://github.com/Aider-AI/aider |
| 语言 / 协议 | Python · Apache-2.0 |
| 定位 | Terminal AI pair programming；多文件编辑、diff 审查、repo context |

**值得借鉴**

| 借鉴点 | 说明 | 落到我们 |
|--------|------|----------|
| **多文件 diff 工作流** | 一次改动多文件且可审查 | T-M203 diff 预览；R-M202 unified diff |
| **改动审查机制** | 人审后再 apply | Prompt 精进确认 → 执行 |
| **Git 结合** | commit、回滚、检查点 | R-M107；F3.3.3 |
| **Repo context 组织** | 给模型的仓库级上下文结构 | 与 repowise Context Pack 互补 |
| **人-Agent 协作节奏** | 增量改动、可追踪 | 执行结果摘要（R-M206） |

**不借鉴**

- Terminal-first 产品形态——我们是 IDE 内可视化
- 直接嵌入 aider CLI——学思路，自研 IDE 内 apply patch

**任务映射**

```
Ray:   R-M202 执行 · R-M107 checkpoint · R-M206 结果摘要
Terran: T-M203 diff · T-M106 checkpoint UI
```

---

## 5. 软件结构可视化 / 架构图生成

> **我们要解决的问题**：导入 repo 后，自动生成用户语言的功能关系图，嵌入 IDE 主编辑区。

### 5.1 CodeBoarding（主参考）

| 项 | 内容 |
|----|------|
| 链接 | https://github.com/CodeBoarding/CodeBoarding |
| 语言 / 协议 | Python · MIT |
| 定位 | Interactive architecture diagrams for codebases |

**值得借鉴**：Repo → Architecture Graph 流水线、模块关系抽取、渐进式分析、图谱数据模型。  
**不借鉴**：其 UI 形态；技术架构图直出给用户。  
**任务映射**：Ray R-D03~R-D07；Terran T-D06~T-D08。

---

### 5.2 GitVizz（辅助参考）

| 项 | 内容 |
|----|------|
| 链接 | https://github.com/adithya-s-k/GitVizz |
| 语言 | TypeScript |
| 定位 | Repo Summary + Dependency Graph + Interactive Documentation |

**值得借鉴**：Repo Summary、交互式节点详情、依赖图与文件结构并列。  
**不借鉴**：文档站产品形态。  
**任务映射**：Ray R-M102；Terran T-D10 Inspector。

---

## 6. 功能节点知识图谱

### 6.1 Understand Anything（主参考）

| 项 | 内容 |
|----|------|
| 链接 | https://github.com/Lum1104/Understand-Anything |
| 语言 / 协议 | TypeScript · MIT |
| 定位 | Codebase → Knowledge Graph → Interactive Exploration |

**值得借鉴**：多层图谱建模、探索交互、Code→Graph 转译、图谱作 Agent context。  
**不借鉴**：类/函数级图谱直出；完整 Q&A 产品流。

**关键转译**

```
Code Entity Graph  →  内部技术索引（不对用户展示）
Knowledge Graph    →  功能节点图（产品语言）
点选探索           →  点 node → Node Context Pack → Chat
```

**任务映射**：Ray R-D05~R-D06、R-M101；Terran T-D08~T-D09。

---

## 7. 可视化工作区（塞进 IDE 主界面）

### 7.1 React Flow（直接采用）

| 项 | 内容 |
|----|------|
| 链接 | https://reactflow.dev |
| 包名 | `@xyflow/react` · MIT |

**在 VS Code fork 中的承载方式**

| 方式 | 适用 | 说明 |
|------|------|------|
| **Custom Editor Tab** | 功能地图、Agent Flow 主视图 | 注册为 editor pane，与代码 Tab 并列 |
| **Webview Panel** | Inspector 内嵌小图 | 侧边栏内轻量预览 |
| **Webview in Sidebar** | 节点详情缩略图 | Preview 框（F2.2.4） |

**直接采用**：自定义 Node/Edge、缩放平移、选中联动、`onNodeClick` → context 切换、布局插件。  
**任务映射**：Terran T-D08、T-M101、T-M204。

```bash
npm install @xyflow/react
```

---

### 7.2 Stello Board（UI 模式参考）

| 项 | 内容 |
|----|------|
| 链接 | https://github.com/stello-agent/stello-board |

**值得借鉴**：React Flow 节点样式、Lifecycle Timeline、Zustand 分 store、ToolCallCard、ActivityFeed、WebSocket 事件流。  
**不借鉴**：Session 树语义（≠ 功能地图）；整仓 fork。

---

## 8. Node Context Pack / 节点级 Prompt 注入

> **核心差异化**：不是「IDE 里放一张图」，而是**点节点 → 自动打包精准上下文 → 注入 Agent**。

### 8.1 repowise（主参考 — 检索与打包）

| 项 | 内容 |
|----|------|
| 链接 | https://github.com/repowise-dev/repowise |
| 语言 | Python |
| 定位 | Codebase intelligence、依赖分析、MCP 暴露 |

**值得借鉴**：依赖召回、关键文件识别、Context Pack 结构、MCP 式 API、Git 变更感知。  
**不借鉴**：健康分、死代码检测；直接依赖运行时。

---

### 8.2 Aider（互补参考 — Repo Context 与改动范围）

与 §4.4 重叠，在 Context Pack 层额外强调：

| 借鉴点 | 落到 Context Pack |
|--------|-------------------|
| 仓库地图式 context | `buildContext` 的项目级 fallback |
| 相关文件选择策略 | `linkedFiles` + 1-hop 扩展 |
| 改动边界 | 执行时仅 node ± 关联文件（R-M205） |

---

### 8.3 Node Context Pack Schema（v0）

```json
{
  "nodeId": "feat_auth",
  "name": "用户认证",
  "summary": "…",
  "definition": "…",
  "linkedFiles": [
    { "path": "lib/auth.ts", "role": "core", "snippet": "…" }
  ],
  "upstream": ["feat_home"],
  "downstream": ["feat_profile"],
  "recentChanges": [{ "path": "…", "commit": "…", "at": "…" }],
  "openErrors": [],
  "relatedTests": [],
  "promptDecisions": []
}
```

**任务映射**：Ray R-M103、R-D09；Terran T-D10、T-M103。

---

## 9. Agent Flow 外显与事件模型

### 9.1 Stello（事件模型 + 记忆）

| 项 | 内容 |
|----|------|
| 链接 | https://github.com/stello-agent/stello |
| 协议 | Apache-2.0 |

| Stello 概念 | Project OS 映射 |
|-------------|-----------------|
| Lifecycle 事件 | `AgentFlowTracker` 发射 |
| `insight` 一次性注入 | Prompt 精进确认 → 执行 |
| `memory` 外部摘要 | 节点 summary、变更 consolidate |
| Fork + contextMode | debug/business Chat 分栏 |
| stello-board Timeline | T-M204 只读 Agent 流程 |

**集成策略**：MVP 推荐 **轻借鉴**（事件模型 + UI，零 `@stello-ai/*` 依赖）；深集成 MVP 后评估。

---

## 10. Debug Harness / Bug 修复闭环

### 10.1 OpenHands + SWE-agent

| 项目 | 链接 | 协议 |
|------|------|------|
| OpenHands | https://github.com/All-Hands-AI/OpenHands | — |
| SWE-agent | https://github.com/SWE-agent/SWE-agent | MIT |

**MVP 方案二裁剪**

```
完整 PRD Harness          MVP 方案二交付
─────────────────        ─────────────────
根因分析                  ✅ 简版
补丁检测拦截              ❌ 不做
debug/business 分离       ✅ Chat 分栏
双定位（节点+文件）        ✅ reportError
修复历史                  ⚠️ 基础日志
```

**任务映射**：Ray M-R301；Terran T-M301~T-M303。

---

## 11. 架构总图：fork 后模块怎么拼

```
┌─────────────────────────────────────────────────────────────────────────┐
│  VS Code Fork 基座（Void / CortexIDE 参考 + VSCodium 基础设施）            │
│  ┌────────────┐ ┌──────────────────────────────┐ ┌───────────────────┐  │
│  │ Activity   │ │  Editor Area                  │ │  Sidebar          │  │
│  │ Bar        │ │  ┌────────┐ ┌──────────────┐  │ │  · AI Chat        │  │
│  │ · 文件     │ │  │功能地图│ │ 代码编辑器    │  │ │    (Continue 式)  │  │
│  │ · 功能地图 │ │  │React   │ │ (Monaco 内置) │  │ │  · Node Inspector │  │
│  │ · Agent流  │ │  │Flow    │ │              │  │ │  · Debug 分栏     │  │
│  └────────────┘ │  └────────┘ └──────────────┘  │ └───────────────────┘  │
│                   │  ┌────────┐ ┌──────────────┐  │                        │
│                   │  │Agent   │ │ File Tree    │  │                        │
│                   │  │Flow    │ │ (VS Code 原生)│  │                        │
│                   │  └────────┘ └──────────────┘  │                        │
├───────────────────┴──────────────────────────────┴────────────────────────┤
│  Panel: Terminal / 问题 / 输出（VS Code 原生）                              │
├───────────────────────────────────────────────────────────────────────────┤
│  Extension Host / Sidecar: Local Core Engine（Ray）                        │
│  · analyze → graph.json    · buildContext → Node Context Pack              │
│  · understand_prompt       · execute_change（Cline/Aider 式多文件）         │
│  · AgentFlowTracker        · git checkpoint（Void/CortexIDE 式）           │
│  · Context Providers（Continue 式）                                        │
└───────────────────────────────────────────────────────────────────────────┘
                                    ▼
                          Cloud AI API（多 Provider）
```

---

## 12. 按研发阶段的行动清单

### 12.1 Demo（→ 2026-07-15）

| 优先级 | 动作 | 参考项目 | 负责人 |
|--------|------|----------|--------|
| P0 | **Fork Void 或 CortexIDE**，dev 可跑 | Void、CortexIDE、VSCodium | Terran T-D01 |
| P0 | 注册**功能地图 Custom Editor**（React Flow） | VS Code CustomEditor API + React Flow | Terran T-D03、T-D08 |
| P0 | 复用 VS Code **文件树 + 编辑器 + Terminal** | VSCodium 原生能力 | Terran T-D04、T-D05、T-D13 |
| P0 | `graph.json` + 静态分析 pipeline | CodeBoarding | Ray R-D01~R-D07 |
| P0 | Engine 接入 extension host / sidecar | Continue 前后端拆分 | Ray R-D02 |
| P1 | Node Inspector 侧边栏 | GitVizz + Continue webview | Terran T-D10 |
| P1 | 分析进度 UI | CodeBoarding 渐进分析 | Terran T-D07 |

> **Demo 变更说明**：T-D01 从「Electron 空壳」升级为「VS Code fork 可跑」；T-D05 Monaco 改为复用 fork 内置编辑器。

---

### 12.2 MVP M1（→ 2026-08-15）

| 优先级 | 动作 | 参考项目 | 负责人 |
|--------|------|----------|--------|
| P0 | Context Provider 体系 + `buildContext` | Continue + repowise + Aider | Ray R-M103 |
| P0 | AI Chat 侧栏（webview + Engine API） | Continue、Void | Terran T-M102~103 |
| P0 | git checkpoint 机制 | Void、CortexIDE、Aider | Ray R-M107 |
| P1 | 增量 re-index | Understand Anything | Ray R-M101 |

---

### 12.3 MVP M2（→ 2026-09-15）

| 优先级 | 动作 | 参考项目 | 负责人 |
|--------|------|----------|--------|
| P0 | `execute_change` 多文件 + tool loop | Cline、CortexIDE、Aider | Ray R-M202 |
| P0 | AgentFlowTracker + 步骤枚举 | OpenHands、Stello、Cline | Ray R-M203 |
| P0 | Agent 流程只读 UI | stello-board、Cline 长任务反馈 | Terran T-M204 |
| P0 | Prompt 精进 + diff 预览 | Continue、Aider | Terran T-M201、T-M203 |
| P1 | gather/write 模式分离 | CortexIDE agent/gather mode | Ray R-M201 |

---

### 12.4 MVP M3（→ 2026-10-31）

| 优先级 | 动作 | 参考项目 | 负责人 |
|--------|------|----------|--------|
| P0 | debug/business Chat 分栏 | Stello fork | Terran T-M302 |
| P0 | fix_bug 多步循环 | OpenHands、SWE-agent | Ray M-R301 |
| P1 | 审批边界（危险命令确认） | Cline | Ray + Terran |
| P2 | 节点级 Agent scope 原型 | Roo Code | 后期 |

---

## 13. 仓库速查表

| 项目 | URL | 我们借什么 | 我们不借什么 |
|------|-----|-----------|-------------|
| **Void** | https://github.com/voideditor/void | VS Code fork 结构、AI 内建、模型层、checkpoint | 完整产品逻辑 |
| **CortexIDE** | https://github.com/OpenCortexIDE/cortexide | repo-aware、multi-file edit、rollback、agent mode | 作次要 fork 备选 |
| **VSCodium** | https://github.com/VSCodium/vscodium | workbench、panel、LSP、git、terminal | 扩展插件形态部署核心功能 |
| **Continue** | https://github.com/continuedev/continue | context provider、model provider、AI 前后端拆分 | extension 部署方式 |
| **Cline** | https://github.com/cline/cline | 多步 agent、tool loop、审批、长任务反馈 | 聊天驱动一切的产品形态 |
| **Roo Code** | https://github.com/RooVetGit/Roo-Code | 多模式 agent、复杂任务拆解 | 多 agent 团队叙事 |
| **OpenHands** | https://github.com/All-Hands-AI/OpenHands | 全链路 step、debug loop、执行轨迹 | 沙箱独立产品 |
| **Aider** | https://github.com/Aider-AI/aider | 多文件 diff、git、repo context | terminal-first 形态 |
| **CodeBoarding** | https://github.com/CodeBoarding/CodeBoarding | repo→架构图流水线 | UI、技术图直出 |
| **GitVizz** | https://github.com/adithya-s-k/GitVizz | Repo Summary、交互导航 | 文档站形态 |
| **Understand Anything** | https://github.com/Lum1104/Understand-Anything | Knowledge Graph 思路 | 类/函数级直出 |
| **React Flow** | https://reactflow.dev | 可视化工作区（**直接采用**） | — |
| **repowise** | https://github.com/repowise-dev/repowise | Context Pack、依赖召回 | 健康分等周边功能 |
| **SWE-agent** | https://github.com/SWE-agent/SWE-agent | Issue→Patch、定位策略 | benchmark 框架 |
| **Stello** | https://github.com/stello-agent/stello | lifecycle、fork/insight、Board UI | Session 树当功能图 |
| **stello-board** | https://github.com/stello-agent/stello-board | Timeline、React Flow 节点模式 | 整仓 fork |

---

## 14. 许可证注意事项

| 项目 | License | 备注 |
|------|---------|------|
| Void | Apache-2.0 | fork 基座需保留 NOTICE；可商用 |
| CortexIDE | MIT | fork 友好 |
| VSCodium / VS Code | MIT | fork 友好 |
| Continue | Apache-2.0 | 借鉴模块需 attribution |
| Cline | Apache-2.0 | 同上 |
| Roo Code | Apache-2.0 | 同上 |
| Aider | Apache-2.0 | 同上 |
| CodeBoarding | MIT | 算法思路可移植 |
| Understand Anything | MIT | 同上 |
| React Flow | MIT | 直接依赖 |
| SWE-agent | MIT | 同上 |
| Stello | Apache-2.0 | 思路无限制；复制代码需 NOTICE |
| repowise / OpenHands / GitVizz | 需确认 | 借用前阅读 LICENSE |

> **原则**：IDE fork 基座优先选 **MIT / Apache-2.0** 项目；复制代码进仓库前 Ray review + 记录 attribution。

---

## 15. 与 PRD 能力矩阵对照

```
PRD 能力                    参考项目组合
──────────────────────────────────────────────────────────────────
F1 项目接入                 VS Code workspace + CodeBoarding 扫描
F2 功能地图                 CodeBoarding + Understand Anything + React Flow（Custom Editor）
F3 节点 Context + 精进      repowise + Aider + Continue（Context Provider）+ Stello（insight）
F3.3 AI 执行                Cline + CortexIDE + Aider（多文件 + checkpoint）
F4 Agent 流程可视化         OpenHands + Stello Board + Cline（执行反馈）
F5 File Tree                VS Code 原生（MVP 方案二传统目录）+ GitVizz 联动思路
F6 Debug Harness            OpenHands + SWE-agent（MVP 简版）
F7 IDE 壳                   Void + CortexIDE + VSCodium（**非自研 Electron**）
F7.3 AI Chat                Void + Continue
F8 修 Bug 分离              Stello fork + OpenHands debug loop
F10 Current Work            Stello memory + repowise 变更感知
```

---

## 16. Fork 基座选型建议（T-D01 决策）

| 选项 | 优势 | 风险 | 建议 |
|------|------|------|------|
| **Void** | 社区大（28k+ stars）、AI 已内建、Apache-2.0 | 上游迭代快，merge 成本 | **Demo 首选** |
| **CortexIDE** | agent mode / rollback 更贴近我们 | 社区小（~100 stars） | **工作流参考**；可作备选 fork |
| **VSCodium 裸 fork** | 最干净、无 AI 包袱 | 一切 AI 能力需自建 | 不推荐 Demo 阶段 |

**推荐路径**：`fork Void` → 接入 Ray Local Engine → 注册 React Flow Custom Editor → 按 Continue 模式内建 Context Provider。

---

**维护说明**：各上游项目迭代较快；每里程碑联调前由 Ray 核对 Void/CortexIDE 上游变更，Terran 核对 VS Code API 兼容性，并更新 §13 速查表。
