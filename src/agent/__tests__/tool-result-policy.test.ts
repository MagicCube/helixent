import { describe, expect, test } from "bun:test";

import { getToolResultPolicy } from "../tool-result-policy";

describe("getToolResultPolicy", () => {
  test("returns summary-first policy for search and filesystem inspection tools", () => {
    expect(getToolResultPolicy("list_files")).toEqual({
      preferSummaryOnly: true,
      includeData: false,
      maxStringLength: 1000,
      uiSummaryOnly: true,
      maxDataItems: 10,
      maxDataTextLength: 400,
    });
  });

  test("returns data-carrying policy for read_file", () => {
    expect(getToolResultPolicy("read_file")).toMatchObject({
      preferSummaryOnly: false,
      includeData: true,
      maxStringLength: 12000,
      maxDataItems: 50,
      maxDataTextLength: 12000,
    });
  });

  test("returns default policy for unknown tools", () => {
    expect(getToolResultPolicy("unknown_tool")).toMatchObject({
      preferSummaryOnly: false,
      includeData: true,
      maxStringLength: 4000,
      maxDataItems: 20,
      maxDataTextLength: 1000,
    });
  });
});
