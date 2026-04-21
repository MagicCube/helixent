import { describe, expect, test } from "bun:test";

import { createAskUserQuestionTool, askUserQuestionParametersSchema } from "../ask-user-question";
import type { AskUserQuestionParameters, AskUserQuestionResult } from "../ask-user-question";

describe("askUserQuestionParametersSchema", () => {
  test("accepts valid single-select question", () => {
    const result = askUserQuestionParametersSchema.safeParse({
      questions: [
        {
          question: "Which language?",
          header: "Language",
          options: [
            { label: "TypeScript", description: "A typed superset of JS" },
            { label: "Python", description: "A dynamic language" },
          ],
          multi_select: false,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  test("accepts valid multi-select question", () => {
    const result = askUserQuestionParametersSchema.safeParse({
      questions: [
        {
          question: "Which features?",
          header: "Features",
          options: [
            { label: "A", description: "Feature A" },
            { label: "B", description: "Feature B" },
            { label: "C", description: "Feature C" },
          ],
          multi_select: true,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  test("accepts optional preview on options", () => {
    const result = askUserQuestionParametersSchema.safeParse({
      questions: [
        {
          question: "Pick one?",
          header: "Choice",
          options: [{ label: "A", description: "Option A", preview: "Preview text" }],
          multi_select: false,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty questions array", () => {
    const result = askUserQuestionParametersSchema.safeParse({ questions: [] });
    expect(result.success).toBe(false);
  });

  test("rejects more than 4 questions", () => {
    const q = {
      question: "Q?",
      header: "H",
      options: [
        { label: "A", description: "A" },
        { label: "B", description: "B" },
      ],
      multi_select: false,
    };
    const result = askUserQuestionParametersSchema.safeParse({ questions: [q, q, q, q, q] });
    expect(result.success).toBe(false);
  });

  test("rejects question with fewer than 2 options", () => {
    const result = askUserQuestionParametersSchema.safeParse({
      questions: [
        {
          question: "Only one?",
          header: "H",
          options: [{ label: "A", description: "Only option" }],
          multi_select: false,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  test("rejects question with more than 4 options", () => {
    const result = askUserQuestionParametersSchema.safeParse({
      questions: [
        {
          question: "Too many?",
          header: "H",
          options: [
            { label: "A", description: "A" },
            { label: "B", description: "B" },
            { label: "C", description: "C" },
            { label: "D", description: "D" },
            { label: "E", description: "E" },
          ],
          multi_select: false,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  test("rejects header longer than 12 characters", () => {
    const result = askUserQuestionParametersSchema.safeParse({
      questions: [
        {
          question: "Q?",
          header: "WayTooLongHeader",
          options: [
            { label: "A", description: "A" },
            { label: "B", description: "B" },
          ],
          multi_select: false,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("createAskUserQuestionTool", () => {
  test("returns result from callback as JSON string", async () => {
    const params: AskUserQuestionParameters = {
      questions: [
        {
          question: "Pick?",
          header: "Pick",
          options: [
            { label: "A", description: "Option A" },
            { label: "B", description: "Option B" },
          ],
          multi_select: false,
        },
      ],
    };
    const expectedResult: AskUserQuestionResult = {
      answers: [{ question_index: 0, selected_labels: ["A"] }],
    };

    const tool = createAskUserQuestionTool(async () => expectedResult);
    const result = await tool.invoke(params);
    expect(JSON.parse(result as string)).toEqual(expectedResult);
  });

  test("throws on abort signal before callback", async () => {
    const tool = createAskUserQuestionTool(async () => ({
      answers: [{ question_index: 0, selected_labels: ["A"] }],
    }));

    const ac = new AbortController();
    ac.abort();

    await expect(tool.invoke(
      {
        questions: [
          {
            question: "Q?",
            header: "Q",
            options: [
              { label: "A", description: "A" },
              { label: "B", description: "B" },
            ],
            multi_select: false,
          },
        ],
      },
      ac.signal,
    )).rejects.toThrow("Aborted");
  });

  test("throws when answer count does not match question count", async () => {
    const tool = createAskUserQuestionTool(async () => ({
      answers: [], // Missing answer
    }));

    await expect(
      tool.invoke({
        questions: [
          {
            question: "Q?",
            header: "Q",
            options: [
              { label: "A", description: "A" },
              { label: "B", description: "B" },
            ],
            multi_select: false,
          },
        ],
      }),
    ).rejects.toThrow("expected 1 answers, got 0");
  });

  test("throws when single-select question has multiple selections", async () => {
    const tool = createAskUserQuestionTool(async () => ({
      answers: [{ question_index: 0, selected_labels: ["A", "B"] }],
    }));

    await expect(
      tool.invoke({
        questions: [
          {
            question: "Q?",
            header: "Q",
            options: [
              { label: "A", description: "A" },
              { label: "B", description: "B" },
            ],
            multi_select: false,
          },
        ],
      }),
    ).rejects.toThrow("requires exactly one selection");
  });

  test("throws when answer contains unknown label", async () => {
    const tool = createAskUserQuestionTool(async () => ({
      answers: [{ question_index: 0, selected_labels: ["UNKNOWN"] }],
    }));

    await expect(
      tool.invoke({
        questions: [
          {
            question: "Q?",
            header: "Q",
            options: [
              { label: "A", description: "A" },
              { label: "B", description: "B" },
            ],
            multi_select: false,
          },
        ],
      }),
    ).rejects.toThrow('unknown label "UNKNOWN"');
  });

  test("throws when multi-select question has no selections", async () => {
    const tool = createAskUserQuestionTool(async () => ({
      answers: [{ question_index: 0, selected_labels: [] }],
    }));

    await expect(
      tool.invoke({
        questions: [
          {
            question: "Q?",
            header: "Q",
            options: [
              { label: "A", description: "A" },
              { label: "B", description: "B" },
            ],
            multi_select: true,
          },
        ],
      }),
    ).rejects.toThrow("requires at least one selection");
  });

  test("throws when missing answer for a question index", async () => {
    const tool = createAskUserQuestionTool(async () => ({
      answers: [{ question_index: 1, selected_labels: ["A"] }], // Missing index 0
    }));

    await expect(
      tool.invoke({
        questions: [
          {
            question: "Q1?",
            header: "Q1",
            options: [
              { label: "A", description: "A" },
              { label: "B", description: "B" },
            ],
            multi_select: false,
          },
          {
            question: "Q2?",
            header: "Q2",
            options: [
              { label: "A", description: "A" },
              { label: "B", description: "B" },
            ],
            multi_select: false,
          },
        ],
      }),
    ).rejects.toThrow("missing answer for question_index 0");
  });
});
