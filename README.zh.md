> [English Version](./README.md) — [中文版本](./README.zh.md)

![](https://github.com/user-attachments/assets/9b4b7b72-45f4-4ae5-8fd5-5fb48d615481)

# Helixent

[![npm](https://img.shields.io/npm/v/helixent?label=npm&logo=npm&color=CB3837)](https://www.npmjs.com/package/helixent)
[![Check](https://github.com/magiccube/helixent/actions/workflows/check.yml/badge.svg?branch=main)](https://github.com/magiccube/helixent/actions/workflows/check.yml)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=ffffff)](https://bun.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=ffffff)](https://www.typescriptlang.org)
[![Ink](https://img.shields.io/badge/Ink-000000?logo=npm&logoColor=ffffff)](https://github.com/vadimdemedes/ink)
[![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=000000)](https://react.dev)

Helixent 是一只写代码的蓝色兔子。它包含一个 Agent Loop（智能体循环）、一个 Coding Agent（编码智能体），以及一个简洁的 CLI。

## Demo

https://github.com/user-attachments/assets/4ad89f14-e338-43e4-82ce-91cb83d58be2

## 目录

- [快速开始](#快速开始)
  - [主要特性](#主要特性)
  - [安装与运行](#安装与运行)
    - [方案一：安装后运行](#方案一安装后运行)
    - [方案二：无需安装直接运行](#方案二无需安装直接运行)
- [模型配置](#模型配置)
  - [列出已配置的模型](#列出已配置的模型)
  - [添加新模型](#添加新模型)
  - [删除模型](#删除模型)
  - [设置默认模型](#设置默认模型)
- [如何贡献](#如何贡献)
  - [从源码开发与构建](#从源码开发与构建)
    - [1. 安装依赖](#1-安装依赖)
    - [2. 以开发模式运行](#2-以开发模式运行)
    - [3. 构建二进制文件](#3-构建二进制文件)
  - [架构](#架构)
    - [第一层：Foundation（基础层）](#第一层foundation基础层)
    - [第二层：Agent Loop（智能体循环层）](#第二层agent-loop智能体循环层)
    - [第三层：Coding Agent（编码智能体层）](#第三层coding-agent编码智能体层)
  - [社区集成](#社区集成)
    - [如何从零构建一个编码智能体](#如何从零构建一个编码智能体)
  - [中间件](#中间件)
    - [可用钩子](#可用钩子)
  - [为什么选择 Bun？](#为什么选择-bun)
- [路线图](#路线图)

---

## 快速开始

### 主要特性

- **模型基础层**
  - 稳定的核心 `Model` 抽象以及面向提供商的接口，旨在让模型集成保持整洁和可复用。
  - 支持多种模型。
- **智能体循环（中间件就绪）**
  - 可复用的 ReAct 风格智能体循环。
  - 中间件支持，用于扩展行为（状态、工具编排、技能等）。
  - 支持 Human-in-the-loop 逐一或批量对工具调用进行赋权。
  - 详见[中间件](#中间件)
- **Skills 支持**
  - 支持[Agent Skills](https://agentskills.io/)格式。
  - 技能从以下路径发现和加载：
    - `~/.agents/skills`
    - `~/.helixent/skills`
    - `${current_project}/.agents/skills`
    - `${current_project}/.helixent/skills`
  - 不同文件夹中允许存在同名的 Skill。

- **长期记忆**
  - **项目根目录 `AGENTS.md` 支持**：如果仓库根目录存在 `AGENTS.md`，会自动加载作为项目指导。
- **编码智能体**
  - 专注于编码的智能体层，配备实用的工具（例如 `bash`、`read_file`、`write_file`、`str_replace`、`list_files`、`glob_search`、`grep_search`、`apply_patch`、`file_info`、`mkdir`、`move_path` 等），用于开发者工作流。
  - 支持基于任务列表的**计划模式**。
- **CLI**
  - 提供 CLI（支持 TUI），用于交互式运行智能体并快速迭代。

Helixent 现已发布在 [`npm`](https://www.npmjs.com/package/helixent) 上，因此你可以全局安装后运行，也可以选择通过 npx 无需安装直接运行：

### 安装与运行

#### 方案一：安装后运行

```bash
npm install -g helixent@latest
cd path/to/your/project
helixent
helixent --help
```

#### 方案二：无需安装直接运行

```bash
cd path/to/your/project
npx helixent@latest
npx helixent --help
```

## 模型配置

Helixent 将你的 CLI 配置存储在：

- `~/.helixent/config.yaml`

### 列出已配置的模型

```bash
helixent config model list
```

### 添加新模型

```bash
helixent config model add
```

### 删除模型

```bash
helixent config model remove <model_name>
```

或者从已配置的模型列表中选择：

```bash
helixent config model remove
```

### 设置默认模型

```bash
helixent config model set-default <model_name>
```

或者从已配置的模型列表中选择：

```bash
helixent config model set-default
```

---

## 如何贡献

### 从源码开发与构建

本节介绍如何在 **macOS** 上从源码构建 Helixent，并将 `helixent` CLI 链接到全局 PATH。

#### 1. 安装依赖

```bash
bun install
```

所有的推送和拉取请求都会在 GitHub Actions 中运行 `bun run check`。本地提交也会被 pre-commit 钩子拦截，直到相同检查通过为止。

#### 2. 以开发模式运行

```bash
bun run dev
```

#### 3. 构建二进制文件

```bash
bun run build:bin
```

构建完成后，你应该会得到：

- `dist/bin/helixent`

#### 4. 提交前检查

确保你的修改通过了所有的 lint 检查、类型检查和测试：

```bash
bun run check
```

或者仅运行测试：

```bash
bun test
```

> 这也会由 pre-commit 钩子自动执行。这会让提交过程稍微慢一点，但我们认为这是值得的。毕竟，在一个 AI 主导的 GitHub 宇宙中，我们至少应该能处理好代码质量的"最后一公里"。

### 架构

Helixent 分为三个层次，外加一个用于第三方集成的 `community` 区域。

```
src/
├── foundation/    # 第一层 – 核心基础组件
├── agent/         # 第二层 – 智能体循环
├── coding/        # 第三层 – 编码智能体（领域特定）
└── community/     # 第三方集成（例如 OpenAI）
```

#### 第一层：Foundation（基础层）

一切构建于其上的核心基础组件：

- **Model** — 对 LLM 提供商的统一抽象。一次定义模型，无需修改智能体代码即可切换提供商。
- **Message** — 单一的对话记录类型，端到端地在系统中流转——是对话的唯一真实来源。
- **Tool** — 工具定义和执行机制（智能体可以调用的"动作"）。

#### 第二层：Agent Loop（智能体循环层）

可复用的 **ReAct 风格智能体循环**：

- 维护整个对话记录的状态。
- 在循环中编排"思考 → 行动 → 观察"步骤。
- 并行调用工具，并将观察结果反馈到下一步推理中。
- 支持**中间件**以扩展行为（详见下文）。

这一层仅依赖于 Foundation，保持通用性——不绑定到任何特定领域。

#### 第三层：Coding Agent（编码智能体层）

构建在通用智能体循环之上的领域特定智能体，预配置了面向编码的工具（`read_file`、`write_file`、`str_replace`、`bash`、`list_files`、`glob_search`、`grep_search`、`apply_patch`、`file_info`、`mkdir`、`move_path` 等）和技能中间件。

### 社区集成

可选的、解耦的适配器，为特定提供商实现 Foundation 接口：

- `community/openai` — 基于 `openai` SDK 的 `OpenAIModelProvider`，兼容任何 OpenAI 兼容的端点。

#### 如何从零构建一个编码智能体

以下是一个完整示例，展示如何使用 OpenAI 兼容的提供商创建一个编码智能体：

```ts
import { createCodingAgent } from "helixent/coding";
import { OpenAIModelProvider } from "helixent/community/openai";
import { Model } from "helixent/foundation";

// 1. 设置一个模型提供商（任何 OpenAI 兼容端点均可）
const provider = new OpenAIModelProvider({
  baseURL: "https://api.openai.com/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

// 2. 使用你偏好的选项创建一个模型实例
const model = new Model("gpt-4o", provider, {
  max_tokens: 16 * 1024,
  thinking: { type: "enabled" },
});

// 3. 创建智能体——工具和技能会自动连接
const agent = await createCodingAgent({ model });

// 4. 流式获取智能体的响应
const stream = await agent.stream({
  role: "user",
  content: [{ type: "text", text: "在当前目录创建一个 hello world Web 服务器。" }],
});

for await (const message of stream) {
  for (const content of message.content) {
    if (content.type === "thinking" && content.thinking) {
      console.info("💡", content.thinking);
    } else if (content.type === "text" && content.text) {
      console.info(content.text);
    } else if (content.type === "tool_use") {
      console.info("🔧", content.name, content.input.description ?? "");
    }
  }
}
```

### 中间件

Helixent 提供了**中间件**系统，让你可以在循环的每个阶段观察和改变智能体的行为。中间件钩子按数组顺序依次执行。

#### 可用钩子

| 钩子 | 触发时机 |
|---|---|
| `beforeAgentRun` | 用户消息追加后、第一步执行前，执行一次 |
| `afterAgentRun` | 智能体即将停止时（无工具调用），执行一次 |
| `beforeAgentStep` | 每一步开始时、调用模型之前执行 |
| `afterAgentStep` | 每一步结束时、所有工具调用完成后执行 |
| `beforeModel` | 模型上下文发送给提供商之前执行 |
| `afterModel` | 收到模型响应后执行 |
| `beforeToolUse` | 工具即将被调用时执行 |
| `afterToolUse` | 工具调用完成后立即执行 |

每个钩子都会接收当前上下文，可以返回部分更新以合并回去，或返回 `void` 保持原样。

### 为什么选择 Bun？

智能体循环本质上是异步的——模型思考、工具执行、结果流式返回，往往并行发生。JavaScript/TypeScript 将**原生 async/await** 内置于语言和运行时中，使得并发编排变得直接，无需 Python 中回调的繁琐或 `asyncio` 的样板代码。

在各种 JS 运行时中，我们选择 [**Bun**](https://bun.com/) 的具体原因如下：

- **与 Claude Code 相同的运行时** — Bun 驱动着 Claude Code 和越来越多 TypeScript 优先的工具。它天生为速度而生，编译后的产物是一个单一的原生可执行文件。
- **性能** — HTTP、文件系统 I/O 和冷启动都比 Node 明显更快，这对于智能体循环每次运行可能发出数十次工具调用的场景来说，差异显著。
- **独立可执行文件** — `bun build --compile` 输出一个自包含的二进制文件。分发 CLI 就像给用户一个单一文件一样简单——无需单独安装运行时。
- **开箱即用** — 测试运行器、打包器和 TypeScript 支持都随 Bun 一起提供，无需额外配置工具链。

---

## 路线图

- **子智能体（Sub-agent）** — 在一次运行中派生子智能体来独立处理子任务，每个子智能体拥有自己的上下文和工具集。
- **智能体团队（Agent Team）** — 多智能体协作，智能体之间可以协调、委派和共享结果，以协作解决复杂问题。
- **打印模式（Print Mode）** — 类似 Claude Code 的渲染模式，以丰富、友好的终端 UI 流式展示智能体的思考过程、工具调用和输出。
- **会话管理（Sessioning）** — 基于本地文件的会话存储，保存智能体的上下文和历史记录。
