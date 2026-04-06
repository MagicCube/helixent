# Helixent

Helixent is a small library for building **ReAct-style** agent loops based on the **Bun** stack.

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

## Quick Start: Build a Coding Agent from Scratch

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

That's it — four steps to a working coding agent.

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
| `beforeToolUse` | Immediately before a tool is invoked |
| `afterToolUse` | Immediately after a tool invocation resolves |

Each hook receives the current context and can return a partial update to merge back in, or `void` to leave it unchanged.

### Example: Skills Middleware

The built-in **Skills Middleware** is a good example of how middleware works in practice. It does two things:

1. **`beforeAgentRun`** — Scans skill directories for `SKILL.md` files, parses their frontmatter, and attaches the discovered skills to the agent context.
2. **`beforeModel`** — Injects a `<skill_system>` block into the model prompt so the LLM knows which skills are available and can load them on demand.

```ts
import { createCodingAgent } from "helixent/coding";

// Skills are loaded by default from ./skills/
const agent = await createCodingAgent({ model });

// Or specify custom directories
const agent = await createCodingAgent({
  model,
  skillsDirs: ["./skills", "./shared-skills"],
});
```

Skills are Markdown playbooks that live in folders under a skills directory. Each skill has a `SKILL.md` with YAML frontmatter (`name`, `description`) and the model loads the full content on demand via `read_file` when it matches a user's task.

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

## Getting Started

```bash
# Install dependencies
bun install

# Run the example
bun run index.ts

# Type-check & lint
bun run check
```
