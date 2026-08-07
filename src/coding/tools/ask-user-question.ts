import z from "zod";

import { defineTool } from "@/foundation";

/**
 * A single selectable choice inside an {@link AskUserQuestionItem}.
 */
export interface AskUserQuestionOption {
  label: string;
  description: string;
  preview?: string;
}

/**
 * A single question presented to the user.
 */
export interface AskUserQuestionItem {
  question: string;
  header: string;
  /** 2–4 choices; mutually exclusive unless {@link multi_select} is true. */
  options: AskUserQuestionOption[];
  multi_select: boolean;
}

/**
 * Input parameters for the `ask_user_question` tool.
 */
export interface AskUserQuestionParameters {
  questions: AskUserQuestionItem[];
}

export interface AskUserQuestionAnswer {
  question_index: number;
  selected_labels: string[];
}

export interface AskUserQuestionResult {
  answers: AskUserQuestionAnswer[];
}

const askUserQuestionOptionSchema = z.object({
  label: z.string().describe("Short display label for this choice (1–5 words)."),
  description: z.string().describe("What this choice means or implies."),
  preview: z
    .string()
    .optional()
    .describe("Optional markdown preview when this option is focused (single-select only)."),
});

const askUserQuestionItemSchema = z.object({
  question: z.string().describe("Full question text; be specific and end with a question mark where appropriate."),
  header: z
    .string()
    .max(12)
    .describe("Very short tab/tag label (max 12 characters), e.g. Auth, Library."),
  options: z
    .array(askUserQuestionOptionSchema)
    .min(2)
    .max(4)
    .describe("2–4 distinct choices; mutually exclusive unless multi_select is true."),
  multi_select: z
    .boolean()
    .describe("If true, the user may pick multiple options; if false, exactly one."),
});

export const askUserQuestionParametersSchema = z.object({
  questions: z
    .array(askUserQuestionItemSchema)
    .min(1)
    .max(4)
    .describe("1–4 parallel, independent questions (no dependency between them)."),
});

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

async function waitForQuestionResult(
  callback: (
    // eslint-disable-next-line no-unused-vars
    params: AskUserQuestionParameters,
    // eslint-disable-next-line no-unused-vars
    signal?: AbortSignal,
  ) => Promise<AskUserQuestionResult>,
  params: AskUserQuestionParameters,
  signal?: AbortSignal,
): Promise<AskUserQuestionResult> {
  if (!signal) return callback(params);
  if (signal.aborted) throw abortError();

  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
  });

  try {
    return await Promise.race([callback(params, signal), aborted]);
  } finally {
    if (onAbort) {
      signal.removeEventListener("abort", onAbort);
    }
  }
}

function validateResultAgainstParams(params: AskUserQuestionParameters, result: AskUserQuestionResult): void {
  if (result.answers.length !== params.questions.length) {
    throw new Error(`ask_user_question: expected ${params.questions.length} answers, got ${result.answers.length}`);
  }
  const byIndex = new Map(result.answers.map((a) => [a.question_index, a]));
  for (let i = 0; i < params.questions.length; i++) {
    const q = params.questions[i]!;
    const a = byIndex.get(i);
    if (!a) {
      throw new Error(`ask_user_question: missing answer for question_index ${i}`);
    }
    const labels = new Set(q.options.map((o) => o.label));
    for (const l of a.selected_labels) {
      if (!labels.has(l)) {
        throw new Error(`ask_user_question: unknown label "${l}" for question ${i}`);
      }
    }
    if (q.multi_select) {
      if (a.selected_labels.length < 1) {
        throw new Error(`ask_user_question: multi-select question ${i} requires at least one selection`);
      }
    } else if (a.selected_labels.length !== 1) {
      throw new Error(`ask_user_question: single-select question ${i} requires exactly one selection`);
    }
  }
}

/**
 * Tool: ask the user one or more parallel multiple-choice questions (with optional multi-select).
 * The host must supply `callback` to block until the user submits (e.g. TUI).
 */
export function createAskUserQuestionTool(
  callback: (
    // eslint-disable-next-line no-unused-vars
    params: AskUserQuestionParameters,
    // eslint-disable-next-line no-unused-vars
    signal?: AbortSignal,
  ) => Promise<AskUserQuestionResult>,
) {
  return defineTool({
    name: "ask_user_question",
    description: `Ask the user one or more independent questions with fixed choices. Prefer this over free-form questions when options are clear. Questions are parallel (no dependency between them). You may send 1–4 questions in one call. For each question set multi_select true only when multiple answers make sense.`,
    parameters: askUserQuestionParametersSchema,
    invoke: async (input, signal) => {
      const params = askUserQuestionParametersSchema.parse(input);
      const result = await waitForQuestionResult(callback, params, signal);
      if (signal?.aborted) {
        throw abortError();
      }
      validateResultAgainstParams(params, result);
      return JSON.stringify(result);
    },
  });
}
