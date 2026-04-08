<img width="2048" height="868" alt="image" src="https://github.com/user-attachments/assets/9b4b7b72-45f4-4ae5-8fd5-5fb48d615481" />

# Helixent

[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=ffffff)](https://bun.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=ffffff)](https://www.typescriptlang.org)
[![Ink](https://img.shields.io/badge/Ink-000000?logo=npm&logoColor=ffffff)](https://github.com/vadimdemedes/ink)
[![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=000000)](https://react.dev)

Helixent is a blue rabbit that writes code. It includes an Agent Loop, a Coding Agent, and a nice CLI.

## Demo

https://github.com/user-attachments/assets/4ad89f14-e338-43e4-82ce-91cb83d58be2

## Index

- [Quick Start (CLI mode)](#quick-start-cli-mode)
  - [1. Install dependencies](#1-install-dependencies)
  - [2. Build the binary](#2-build-the-binary)
  - [3. Symlink into your PATH (macOS)](#3-symlink-into-your-path-macos)
  - [4. Run the CLI](#4-run-the-cli)
- [Architecture](#architecture)
  - [Layer 1: Foundation](#layer-1-foundation)
  - [Layer 2: Agent Loop](#layer-2-agent-loop)
  - [Layer 3: Coding Agent](#layer-3-coding-agent)
  - [Community](#community)
  - [How to build a coding agent from scratch](#how-to-build-a-coding-agent-from-scratch)
- [Middleware](#middleware)
  - [Available hooks](#available-hooks)
- [Why Bun?](#why-bun)
- [Roadmap](#roadmap)

## Quick Start (CLI mode)

This section shows how to build Helixent from source and link the `helixent` CLI into your global PATH on **macOS**.

### 1. Install dependencies

```bash
bun install
```

### 2. Build the binary

```bash
bun run build:bin
```

After the build completes, you should have:

- `dist/bin/helixent`

### 3. Symlink into your PATH (macOS)

Pick the Homebrew prefix that matches your machine:

- Apple Silicon (common): `/opt/homebrew/bin`
- Intel (common): `/usr/local/bin`

```bash
# Apple Silicon (/opt/homebrew/bin)
sudo ln -sf "$(pwd)/dist/bin/helixent" /opt/homebrew/bin/helixent

# Intel (/usr/local/bin)
sudo ln -sf "$(pwd)/dist/bin/helixent" /usr/local/bin/helixent
```

### 4. Run the CLI

```bash
helixent
```

Follow the prompts to complete the initial setup. Your config file will be automatically created at:

- `~/.helixent/config.yaml`

## Architecture

Helixent is organized into three layers, plus a `community` area for third-party integrations.

```
src/
├── foundation/    # Layer 1 – Core primitives
├── agent/         # Layer 2 – Agent loop
├── coding/        # Layer 3 – Coding agent (domain-specific)
└── community/     # Third-party integrations (e.g. OpenAI)
```

### Layer 1: Foundation

Core primitives that everything else builds on:

- **Model** — A unified abstraction over LLM providers. Define a model once, swap providers without changing agent code.
- **Message** — A single transcript type that flows end-to-end through the system — the single source of truth for the conversation.
- **Tool** — Tool definitions and execution plumbing (the "actions" an agent can invoke).

### Layer 2: Agent Loop

A reusable **ReAct-style agent loop**:

- Maintains state over a conversation transcript.
- Orchestrates "think → act → observe" steps in a loop.
- Invokes tool calls in parallel and feeds observations back into the next reasoning step.
- Supports **middleware** for extending behavior (see below).

This layer depends only on Foundation and remains generic — not tied to any specific domain.

### Layer 3: Coding Agent

A domain-specific agent built on top of the generic agent loop, pre-configured with coding-oriented tools (`read_file`, `write_file`, `str_replace`, `bash`, etc.) and the skills middleware.

### Community

Optional, decoupled adapters that implement Foundation interfaces for specific providers:

- `community/openai` — `OpenAIModelProvider` backed by the `openai` SDK, compatible with any OpenAI-compatible endpoint.

### How to build a coding agent from scratch

Here's a complete example that creates a coding agent using an OpenAI-compatible provider:

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

## Middleware

Helixent provides a **middleware** system that lets you observe and mutate the agent's behavior at every stage of the loop. Middleware hooks are invoked sequentially in array order.

### Available hooks

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

## Why Bun?

Agent loops are inherently asynchronous — the model thinks, tools execute, results stream back, often in parallel. JavaScript/TypeScript has **native async/await** baked into the language and runtime, making concurrent orchestration straightforward without the callback gymnastics or `asyncio` boilerplate you'd face in Python.

Among JS runtimes, we chose **Bun** specifically because:

- **Performance** — Bun's HTTP client, file I/O, and startup time are significantly faster than Node.js, which matters when an agent loop is making dozens of tool calls per run.
- **Standalone executables** — `bun build --compile` produces a single binary with no external dependencies. This makes it trivial to distribute a CLI agent that end-users can run without installing a runtime.
- **Batteries included** — Built-in test runner, bundler, and TypeScript support out of the box — no extra toolchain to configure.

## Roadmap

- **TODO List** — Built-in task tracking so the agent can plan, break down, and track progress on multi-step work.
- **Sub-agent** — Spawn child agents from within a run to handle subtasks independently, each with their own context and tool set.
- **Agent Team** — Multi-agent collaboration where agents can coordinate, delegate, and share results to tackle complex problems together.
- **CLI** — A command-line interface layer for running Helixent agents directly from the terminal with interactive I/O.
- **Print Mode** — A Claude Code-style rendering mode that streams the agent's thinking, tool calls, and outputs in a rich, human-friendly terminal UI.
- **Sessioning** - A local file based session store for storing the agent's context and history.
