import { describe, expect, it } from "bun:test";

import type { AskUserQuestionParameters, AskUserQuestionResult } from "../ask-user-question";
import { AskUserQuestionManager } from "../ask-user-question-manager";

const sampleParams = (n = 1): AskUserQuestionParameters => ({
  questions: Array.from({ length: n }, (_, i) => ({
    question: `Q${i}?`,
    header: `H${i}`,
    multi_select: false,
    options: [
      { label: "A", description: "a" },
      { label: "B", description: "b" },
    ],
  })),
});

describe("AskUserQuestionManager", () => {
  it("resolves requests in FIFO order", async () => {
    const m = new AskUserQuestionManager();
    const out: string[] = [];
    const p1 = m.askUserQuestion(sampleParams(1)).then((r) => {
      out.push("1");
      return r;
    });
    const p2 = m.askUserQuestion(sampleParams(1)).then((r) => {
      out.push("2");
      return r;
    });

    const r1: AskUserQuestionResult = { answers: [{ question_index: 0, selected_labels: ["A"] }] };
    m.respondWithAnswers(r1);
    await p1;
    expect(out).toEqual(["1"]);

    m.respondWithAnswers(r1);
    await p2;
    expect(out).toEqual(["1", "2"]);
  });

  it("notifies subscriber with current request", () => {
    const m = new AskUserQuestionManager();
    let seen: unknown = "unset";
    m.subscribe((req) => {
      seen = req?.params.questions.length ?? null;
    });
    void m.askUserQuestion(sampleParams(2));
    expect(seen).toBe(2);
  });

  it("aborting the current request rejects it and clears the subscriber state", async () => {
    const m = new AskUserQuestionManager();
    const seen: Array<number | null> = [];
    m.subscribe((req) => {
      seen.push(req?.params.questions.length ?? null);
    });

    const controller = new AbortController();
    const pending = m.askUserQuestion(sampleParams(1), controller.signal);
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(seen.at(-1)).toBeNull();
  });

  it("aborting a queued request removes it before it can become current", async () => {
    const m = new AskUserQuestionManager();
    const seen: Array<number | null> = [];
    m.subscribe((req) => {
      seen.push(req?.params.questions.length ?? null);
    });

    const first = m.askUserQuestion(sampleParams(1));
    const controller = new AbortController();
    const second = m.askUserQuestion(sampleParams(2), controller.signal);
    controller.abort();

    await expect(second).rejects.toMatchObject({ name: "AbortError" });

    const result: AskUserQuestionResult = { answers: [{ question_index: 0, selected_labels: ["A"] }] };
    m.respondWithAnswers(result);
    await first;

    expect(seen).not.toContain(2);
    expect(seen.at(-1)).toBeNull();
  });

  it("aborting one run signal never publishes another queued question from that run", async () => {
    const m = new AskUserQuestionManager();
    const seen: Array<number | null> = [];
    m.subscribe((req) => {
      seen.push(req?.params.questions.length ?? null);
    });

    const controller = new AbortController();
    const first = m.askUserQuestion(sampleParams(1), controller.signal);
    const second = m.askUserQuestion(sampleParams(2), controller.signal);
    const third = m.askUserQuestion(sampleParams(3), controller.signal);

    expect(seen.at(-1)).toBe(1);
    controller.abort();

    await Promise.all([
      expect(first).rejects.toMatchObject({ name: "AbortError" }),
      expect(second).rejects.toMatchObject({ name: "AbortError" }),
      expect(third).rejects.toMatchObject({ name: "AbortError" }),
    ]);

    expect(seen).not.toContain(2);
    expect(seen).not.toContain(3);
    expect(seen.at(-1)).toBeNull();
  });
});
