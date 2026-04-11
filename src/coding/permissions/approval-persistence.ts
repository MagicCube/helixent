export type ApprovalPersistence = {
  // eslint-disable-next-line no-unused-vars
  loadAllowList: (cwd: string) => Promise<Set<string>>;
  // eslint-disable-next-line no-unused-vars
  persistAllowedTool: (cwd: string, toolName: string) => Promise<void>;
};
