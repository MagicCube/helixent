import { expect, test } from "bun:test";

import { createAskUserQuestionTool, type AskUserQuestionParameters } from "../ask-user-question";
import { AskUserQuestionManager } from "../ask-user-question-manager";

const params: AskUserQuestionParameters = {
  questions: [
    {
      question: "Continue?",
      header: "Continue",
      options: [
        { label: "Yes", description: "Continue" },
        { label: "No", description: "Stop" },
      ],
      multi_select: false,
    },
  ],
};

test("aborting ask_user_question rejects the tool and clears the manager request", async () => {
  const manager = new AskUserQuestionManager();
  const seen: Array<"request" | "empty"> = [];
  manager.subscribe((request) => {
    seen.push(request ? "request" : "empty");
  });

  const tool = createAskUserQuestionTool(manager.askUserQuestion);
  const controller = new AbortController();
  const pending = tool.invoke(params, controller.signal);

  expect(seen.at(-1)).toBe("request");
  controller.abort();

  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(seen.at(-1)).toBe("empty");
});
