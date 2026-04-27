export type ToolResultPolicy = {
  preferSummaryOnly: boolean;
  includeData: boolean;
  maxStringLength?: number;
  uiSummaryOnly?: boolean;
  maxDataItems?: number;
  maxDataTextLength?: number;
};

const DEFAULT_POLICY: ToolResultPolicy = {
  preferSummaryOnly: false,
  includeData: true,
  maxStringLength: 4000,
  maxDataItems: 20,
  maxDataTextLength: 1000,
};

export function getToolResultPolicy(toolName: string): ToolResultPolicy {
  switch (toolName) {
    case "list_files":
    case "glob_search":
    case "grep_search":
      return {
        preferSummaryOnly: true,
        includeData: false,
        maxStringLength: 1000,
        uiSummaryOnly: true,
        maxDataItems: 10,
        maxDataTextLength: 400,
      };
    case "file_info":
    case "mkdir":
    case "move_path":
      return {
        preferSummaryOnly: true,
        includeData: false,
        maxStringLength: 1000,
        uiSummaryOnly: true,
        maxDataItems: 10,
        maxDataTextLength: 400,
      };
    case "read_file":
      return {
        preferSummaryOnly: false,
        includeData: true,
        maxStringLength: 12000,
        maxDataItems: 50,
        maxDataTextLength: 12000,
      };
    case "apply_patch":
      return {
        preferSummaryOnly: false,
        includeData: true,
        maxStringLength: 1000,
        maxDataItems: 20,
        maxDataTextLength: 1000,
      };
    case "write_file":
    case "str_replace":
      return {
        preferSummaryOnly: false,
        includeData: true,
        maxStringLength: 4000,
        maxDataItems: 20,
        maxDataTextLength: 800,
      };
    default:
      return DEFAULT_POLICY;
  }
}
