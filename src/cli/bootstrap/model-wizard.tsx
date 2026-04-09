import { Box, render, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState } from "react";

import type { ModelEntry } from "@/cli/config";

import { MODEL_PROVIDERS } from "../model-providers";
import { currentTheme } from "../tui/themes";

const KIMI_MODEL_PRESETS: { prefix: string; options: Record<string, unknown> }[] = [
  { prefix: "kimi-k2-thinking", options: { temperature: 1, top_p: 1 } },
  { prefix: "kimi-k2.5", options: { temperature: 1, top_p: 0.95 } },
  { prefix: "kimi-k2", options: { temperature: 0.6, top_p: 1 } },
  { prefix: "moonshot-v1", options: { temperature: 0, top_p: 1 } },
];

type Step = "provider" | "apiKey" | "modelName" | "baseURL" | "confirm";

function buildModelEntry(baseURL: string, apiKey: string, modelName: string, providerId: string): ModelEntry {
  const cleanModelName = modelName.trim();
  
  let options: Record<string, unknown> | undefined = undefined;
  if (providerId === "kimi" || cleanModelName.startsWith("kimi-") || cleanModelName.startsWith("moonshot-")) {
    const preset = KIMI_MODEL_PRESETS.find((p) => 
      cleanModelName === p.prefix || 
      cleanModelName.startsWith(`${p.prefix}-`) || 
      cleanModelName.startsWith(`${p.prefix}_`)
    );
    if (preset) {
      options = preset.options;
    }
  }

  return {
    name: cleanModelName,
    baseURL: baseURL.trim(),
    APIKey: apiKey.trim(),
    ...(options ? { options } : {}),
  };
}

type ModelWizardProps = {
  // eslint-disable-next-line no-unused-vars -- callback arg name in function type
  onComplete: (entry: ModelEntry) => void;
  onAbort: () => void;
};

function ModelWizard({ onComplete, onAbort }: ModelWizardProps) {
  const [step, setStep] = useState<Step>("provider");
  const [providerIndex, setProviderIndex] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");
  const [customBaseURL, setCustomBaseURL] = useState("");
  const [pendingEntry, setPendingEntry] = useState<ModelEntry | null>(null);

  const resetWizard = () => {
    setStep("provider");
    setProviderIndex(0);
    setApiKey("");
    setModelName("");
    setCustomBaseURL("");
    setPendingEntry(null);
  };

  const textSteps = step === "apiKey" || step === "modelName" || step === "baseURL";

  useInput(
    (_input, key) => {
      if (key.escape && textSteps) {
        onAbort();
      }
    },
    { isActive: textSteps },
  );

  useInput(
    (_input, key) => {
      if (step === "provider") {
        if (key.upArrow) {
          setProviderIndex((i) => (i > 0 ? i - 1 : MODEL_PROVIDERS.length - 1));
        }
        if (key.downArrow) {
          setProviderIndex((i) => (i < MODEL_PROVIDERS.length - 1 ? i + 1 : 0));
        }
        if (key.return) {
          setStep("apiKey");
        }
        if (key.escape) {
          onAbort();
        }
      }
    },
    { isActive: step === "provider" },
  );

  const selectedProvider = MODEL_PROVIDERS[providerIndex]!;

  const finishWithBaseURL = (url: string) => {
    setCustomBaseURL(url);
    const entry = buildModelEntry(url, apiKey, modelName, selectedProvider.id);
    setPendingEntry(entry);
    setStep("confirm");
  };

  const goFromModelName = () => {
    if (!selectedProvider.baseURL) {
      setStep("baseURL");
    } else {
      const entry = buildModelEntry(selectedProvider.baseURL, apiKey, modelName, selectedProvider.id);
      setPendingEntry(entry);
      setStep("confirm");
    }
  };

  useInput(
    (input, key) => {
      if (step !== "confirm") {
        return;
      }
      if (key.return) {
        if (pendingEntry) {
          onComplete(pendingEntry);
        }
        return;
      }
      if (key.escape || input === "n" || input === "N") {
        resetWizard();
      }
    },
    { isActive: step === "confirm" },
  );

  if (step === "provider") {
    return (
      <Box flexDirection="column">
        <Text bold>Select a model provider (↑/↓ to move, Enter to confirm)</Text>
        {MODEL_PROVIDERS.map((p, i) => (
          <Text key={p.id} color={i === providerIndex ? "cyan" : undefined}>
            {i === providerIndex ? "❯ " : "  "}
            {p.label}
          </Text>
        ))}
      </Box>
    );
  }

  if (step === "apiKey") {
    return (
      <Box flexDirection="column" rowGap={1}>
        <Text>
          Provider: {selectedProvider.label} ({selectedProvider.baseURL || "custom baseURL"})
        </Text>
        <Text bold>Enter your API key</Text>
        <Box>
          <Text>API Key: </Text>
          <TextInput mask="*" value={apiKey} onChange={setApiKey} onSubmit={() => setStep("modelName")} />
        </Box>
        <Text color={currentTheme.colors.dimText}>Press Enter to continue (Esc to cancel)</Text>
      </Box>
    );
  }

  if (step === "modelName") {
    const placeholders: Record<string, string> = {
      openai: "e.g. gpt-4o",
      volcengine: "e.g. ep-xxx-xxx",
      volcengine_coding_plan: "e.g. doubao-seed-2.0-code",
      deepseek: "e.g. deepseek-coder",
      kimi: "e.g. kimi-k2.5",
      other: "e.g. my-custom-model",
    };
    const placeholder = placeholders[selectedProvider.id] || "e.g. doubao-seed-2.0-code";

    return (
      <Box flexDirection="column" rowGap={1}>
        <Text bold>Enter a model name</Text>
        <Box>
          <Text>Model: </Text>
          <TextInput
            value={modelName}
            placeholder={placeholder}
            onChange={setModelName}
            onSubmit={goFromModelName}
          />
        </Box>
        <Text color={currentTheme.colors.dimText}>Press Enter to continue (Esc to cancel)</Text>
      </Box>
    );
  }

  if (step === "confirm") {
    const entry = pendingEntry;
    if (!entry) {
      return (
        <Box flexDirection="column">
          <Text color="red">No pending config. Restarting…</Text>
        </Box>
      );
    }

    return (
      <Box flexDirection="column" rowGap={1}>
        <Text bold color="cyan">
          Last confirmation
        </Text>
        <Text>Provider: {selectedProvider.label}</Text>
        <Text>Model: {entry.name}</Text>
        <Text>baseURL: {entry.baseURL}</Text>
        <Text>API Key: {maskSecurityString(entry.APIKey)}</Text>
        <Text color={currentTheme.colors.dimText}>Enter to confirm (n or Esc to restart)</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" rowGap={1}>
      <Text bold>Enter an API base URL (OpenAI compatible)</Text>
      <Box>
        <Text>baseURL: </Text>
        <TextInput
          value={customBaseURL}
          onChange={setCustomBaseURL}
          onSubmit={() => finishWithBaseURL(customBaseURL)}
        />
      </Box>
      <Text color={currentTheme.colors.dimText}>Press Enter to finish (Esc to cancel)</Text>
    </Box>
  );
}

export function runModelWizard(): Promise<ModelEntry> {
  return new Promise((resolve) => {
    const instance = render(
      <ModelWizard
        onComplete={(entry) => {
          instance.unmount();
          resolve(entry);
        }}
        onAbort={() => {
          instance.unmount();
          process.exit(1);
        }}
      />,
    );
  });
}

function maskSecurityString(str: string): string {
  try {
    return str.slice(-8).padStart(str.length, "*");
  } catch {
    return str.replace(/./g, "*");
  }
}
