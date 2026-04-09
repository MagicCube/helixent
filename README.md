![](https://github.com/user-attachments/assets/9b4b7b72-45f4-4ae5-8fd5-5fb48d615481)

# Helixent

[![npm](https://img.shields.io/npm/v/helixent?label=npm&logo=npm&color=CB3837)](https://www.npmjs.com/package/helixent)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=ffffff)](https://bun.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=ffffff)](https://www.typescriptlang.org)
[![Ink](https://img.shields.io/badge/Ink-000000?logo=npm&logoColor=ffffff)](https://github.com/vadimdemedes/ink)
[![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=000000)](https://react.dev)

Helixent is a blue rabbit that writes code. It includes an Agent Loop, a Coding Agent, and a nice CLI.

## Demo

https://github.com/user-attachments/assets/4ad89f14-e338-43e4-82ce-91cb83d58be2

## Index

- [Get Started](#get-started)
  - [Key Features](#key-features)
  - [Install and Run](#install-and-run)
    - [Option 1: Install and Run](#option-1-install-and-run)
    - [Option 2: Run without Installing](#option-2-run-without-installing)
- [Model Configuration](#model-configuration)
  - [List Configured Models](#list-configured-models)
  - [Add a New Model](#add-a-new-model)
  - [Remove a Model](#remove-a-model)
  - [Set the Default Model](#set-the-default-model)
- [How to Contribute to Helixent](#how-to-contribute-to-helixent)
  - [Develop & Build from Source](#develop-build-from-source)
    - [1. Install Dependencies](#1-install-dependencies)
    - [2. Run in Development Mode](#2-run-in-development-mode)
    - [3. Build the Binary](#3-build-the-binary)
  - [Architecture](#architecture)
    - [Layer 1: Foundation](#layer-1-foundation)
    - [Layer 2: Agent Loop](#layer-2-agent-loop)
    - [Layer 3: Coding Agent](#layer-3-coding-agent)
  - [Community](#community)
    - [How to Build a Coding Agent from Scratch](#how-to-build-a-coding-agent-from-scratch)
  - [Middleware](#middleware)
    - [Available Hooks](#available-hooks)
  - [Why Bun?](#why-bun)
- [Roadmap](#roadmap)

---

## Get Started

### Key Features

- **Model Foundation**
  - A stable core `Model` abstraction plus provider-facing contracts, designed to keep model integrations clean and reusable.
  - Multiple models are supported.
- **Agent Loop (Middleware-Ready)**
  - A reusable ReAct-style agent loop.
  - First-class middleware support for extending behavior (state, tool orchestration, skills, etc.).
  - See [Middleware](#middleware)
- **Skills Support**
  - The [standard agent skill](https://agentskills.io/) format is supported.
  - Skills are discovered and loaded from:
    - `~/.agents/skills`
    - `~/.helixent/skills`
    - `${current_project}/.agents/skills`
    - `${current_project}/.helixent/skills`
  - Duplicate skill names in different folders are allowed.

- **Long-term memory**
  - **Project root `AGENTS.md` support**: if an `AGENTS.md` exists at the repository root, it is automatically picked up as project guidance.
- **Coding Agent**
  - A coding-focused agent layer with practical tools (e.g. `bash`, `read_file`, `write_file`, `str_replace`, etc.) for developer workflows.
  - Todo-list-based **plan mode** is supported.
- **CLI**
  - A CLI (with TUI support) for running agents interactively and iterating quickly.

Helixent is now available on [`npm`](https://www.npmjs.com/package/helixent), so you can install globally and run, or choose to run via npx without installing:

### Install and Run

#### Option 1: Install and Run

```bash
npm install -g helixent@latest
cd path/to/your/project
helixent
helixent --help
```

#### Option 2: Run without Installing

```bash
cd path/to/your/project
npx helixent@latest
npx helixent --help
```

## Model Configuration

Helixent stores your CLI configuration in:

- `~/.helixent/config.yaml`

### List Configured Models

```bash
helixent config model list
```

### Add a New Model

```bash
helixent config model add
```

### Remove a Model

```bash
helixent config model remove <model_name>
```

Or select from the list of configured models:

```bash
helixent config model remove
```

### Set the Default Model

```bash
helixent config model set-default <model_name>
```

Or select from the list of configured models:

```bash
helixent config model set-default
```

---

## How to Contribute to Helixent

### Develop & Build from Source

This section shows how to build Helixent from source and link the `helixent` CLI into your global PATH on **macOS**.

#### 1. Install Dependencies

```bash
bun install
```

#### 2. Run in Development Mode

```bash
bun run dev
```

#### 3. Build the Binary

```bash
bun run build:bin
```

After the build completes, you should have:

- `dist/bin/helixent`

### Architecture

Helixent is organized into three layers, plus a `community` area for third-party integrations.

```
src/
├── foundation/    # Layer 1 – Core primitives
├── agent/         # Layer 2 – Agent loop
├── coding/        # Layer 3 – Coding agent (domain-specific)
└── community/     # Third-party integrations (e.g. OpenAI)
```

#### Layer 1: Foundation

Core primitives that everything else builds on:

- **Model** — A unified abstraction over LLM providers. Define a model once, swap providers without changing agent code.
- **Message** — A single transcript type that flows end-to-end through the system — the single source of truth for the conversation.
- **Tool** — Tool definitions and execution plumbing (the "actions" an agent can invoke).

#### Layer 2: Agent Loop

A reusable **ReAct-style agent loop**:

- Maintains state over a conversation transcript.
- Orchestrates "think → act → observe" steps in a loop.
- Invokes tool calls in parallel and feeds observations back into the next reasoning step.
- Supports **middleware** for extending behavior (see below).

This layer depends only on Foundation and remains generic — not tied to any specific domain.

#### Layer 3: Coding Agent

A domain-specific agent built on top of the generic agent loop, pre-configured with coding-oriented tools (`read_file`, `write_file`, `str_replace`, `bash`, etc.) and the skills middleware.

### Community

Optional, decoupled adapters that implement Foundation interfaces for specific providers:

- `community/openai` — `OpenAIModelProvider` backed by the `openai` SDK, compatible with any OpenAI-compatible endpoint.

#### How to Build a Coding Agent from Scratch

Here is a complete example that creates a coding agent using an OpenAI-compatible provider:

```ts
import { createCodingAgent } from "helixent/coding";
import { OpenAIModelProvider } from "helixent/community/openai";
import { Model } from "helixent/foundation";

// 1. Set up a model provider (any OpenAI-compatible endpoint works)
const provider = new OpenAIModelProvider({
  baseURL: "https://api.openai.com/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

// 2. Create a model instance with your preferred options
const model = new Model("gpt-4o", provider, {
  max_tokens: 16 * 1024,
  thinking: { type: "enabled" },
});

// 3. Create the agent — tools and skills are wired up automatically
const agent = await createCodingAgent({ model });

// 4. Stream the agent's response
const stream = await agent.stream({
  role: "user",
  content: [{ type: "text", text: "Create a hello world web server in the current directory." }],
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

### Middleware

Helixent provides a **middleware** system that lets you observe and mutate the agent's behavior at every stage of the loop. Middleware hooks are invoked sequentially in array order.

#### Available Hooks

| Hook | When it runs |
|---|---|
| `beforeAgentRun` | Once after the user message is appended, before the first step |
| `afterAgentRun` | Once when the agent is about to stop (no tool calls) |
| `beforeAgentStep` | At the start of each step, before the model is invoked |
| `afterAgentStep` | At the end of each step, after all tool calls complete |
| `beforeModel` | Before the model context is sent to the provider |
| `afterModel` | After the model response is received |
| `beforeToolUse` | Immediately before a tool is invoked |
| `afterToolUse` | Immediately after a tool invocation resolves |

Each hook receives the current context and can return a partial update to merge back in, or `void` to leave it unchanged.

### Why Bun?

Agent loops are inherently asynchronous — the model thinks, tools execute, results stream back, often in parallel. JavaScript/TypeScript has **native async/await** baked into the language and runtime, making concurrent orchestration straightforward without the callback gymnastics or `asyncio` boilerplate you'd face in Python.

Among JS runtimes, we chose [**Bun**](https://bun.com/) specifically because:

- **Same runtime as Claude Code** — Bun powers Claude Code and a growing number of TypeScript-first tools. It's built for speed, and a compiled build is a single native executable.
- **Performance** — HTTP, filesystem I/O, and cold starts are all noticeably faster than Node's, which adds up when an agent loop issues dozens of tool calls per run.
- **Standalone executables** — `bun build --compile` outputs one self-contained binary. Shipping a CLI is as simple as handing users a single file—no separate runtime install.
- **Batteries included** — Test runner, bundler, and TypeScript support ship with Bun, so there's no separate toolchain to wire up.

---

## Roadmap

- **Sub-agent** — Spawn child agents from within a run to handle subtasks independently, each with their own context and tool set.
- **Agent Team** — Multi-agent collaboration where agents can coordinate, delegate, and share results to tackle complex problems together.
- **Print Mode** — A Claude Code-style rendering mode that streams the agent's thinking, tool calls, and outputs in a rich, human-friendly terminal UI.
- **Sessioning** — A local, file-based session store for the agent's context and history.
