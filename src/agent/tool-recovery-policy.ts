import type { ToolErrorKind } from "./tool-result-runtime";

export type ToolRecoveryHint = {
  message: string;
  suggestedTools?: string[];
  shouldSuppressImmediateRetry?: boolean;
  retryable: boolean;
};

const DEFAULT_ERROR_HINT: ToolRecoveryHint = {
  message: "Tool call failed. Inspect the previous result before retrying the same action.",
  shouldSuppressImmediateRetry: false,
  retryable: false,
};

const DEFAULT_ENVIRONMENT_HINT: ToolRecoveryHint = {
  message: "Required environment dependency is missing. Do not blindly retry the same tool call.",
  shouldSuppressImmediateRetry: true,
  retryable: false,
};

function isFileOrSearchTool(toolName: string) {
  return [
    "read_file",
    "write_file",
    "str_replace",
    "apply_patch",
    "list_files",
    "glob_search",
    "grep_search",
    "file_info",
    "move_path",
    "mkdir",
  ].includes(toolName);
}

export function getToolRecoveryHint(params: {
  toolName: string;
  errorKind?: ToolErrorKind;
  code?: string;
}): ToolRecoveryHint | null {
  const { toolName, errorKind = "unknown", code } = params;

  if (code === "RG_NOT_FOUND") {
    return DEFAULT_ENVIRONMENT_HINT;
  }

  if (code === "PATCH_APPLY_FAILED") {
    return {
      message: "Patch application failed. Re-read the file and verify the target lines before trying another edit.",
      suggestedTools: ["read_file"],
      shouldSuppressImmediateRetry: true,
      retryable: false,
    };
  }

  if ((code === "INVALID_PATH" || code === "FILE_NOT_FOUND") && isFileOrSearchTool(toolName)) {
    return {
      message: "The target path could not be used. Discover the correct path before retrying.",
      suggestedTools: ["list_files", "glob_search"],
      shouldSuppressImmediateRetry: true,
      retryable: false,
    };
  }

  if (errorKind === "environment_missing") {
    return DEFAULT_ENVIRONMENT_HINT;
  }

  if (errorKind === "invalid_input") {
    return {
      message: "The tool input is invalid. Adjust the arguments before retrying.",
      shouldSuppressImmediateRetry: true,
      retryable: false,
    };
  }

  if (errorKind === "not_found") {
    return {
      message: "The requested target was not found. Use a discovery tool to inspect the workspace before retrying.",
      suggestedTools: ["list_files", "glob_search"],
      shouldSuppressImmediateRetry: true,
      retryable: false,
    };
  }

  if (errorKind === "execution_failed") {
    return {
      message: "The tool execution failed. Inspect the previous result and only retry if you have new information.",
      shouldSuppressImmediateRetry: false,
      retryable: true,
    };
  }

  if (errorKind === "unsupported") {
    return {
      message: "The requested operation is not supported by this tool. Choose a different tool or strategy.",
      shouldSuppressImmediateRetry: true,
      retryable: false,
    };
  }

  if (errorKind === "unknown") {
    return DEFAULT_ERROR_HINT;
  }

  return null;
}
