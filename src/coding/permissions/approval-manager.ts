import type { ToolUseContent } from "@/foundation";

import type { ApprovalDecision } from "./approval-types";

export type ApprovalRequest = {
  toolUse: ToolUseContent;
  // eslint-disable-next-line no-unused-vars
  resolve: (decision: ApprovalDecision) => void;
};

type PendingApprovalRequest = ApprovalRequest & {
  // eslint-disable-next-line no-unused-vars
  reject: (error: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
};

const MAX_QUEUE_SIZE = 20;

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

export class ApprovalManager {
  private _queue: PendingApprovalRequest[] = [];
  private _currentRequest?: PendingApprovalRequest;
  // eslint-disable-next-line no-unused-vars
  private _subscriber?: (req: ApprovalRequest | null) => void;

  askUser = (toolUse: ToolUseContent, signal?: AbortSignal): Promise<ApprovalDecision> => {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(abortError());
        return;
      }
      if (this._queue.length >= MAX_QUEUE_SIZE) {
        console.warn(`[ApprovalManager] Queue overflow. Denying tool ${toolUse.name}.`);
        resolve("deny");
        return;
      }

      const request: PendingApprovalRequest = { toolUse, resolve, reject, signal };
      if (signal) {
        request.onAbort = () => this._cancelRequest(request);
        signal.addEventListener("abort", request.onAbort, { once: true });
      }

      this._queue.push(request);
      this._processQueue();
    });
  };

  private _processQueue() {
    if (this._currentRequest || this._queue.length === 0) {
      if (this._queue.length === 0 && !this._currentRequest) {
        this._subscriber?.(null);
      }
      return;
    }

    this._currentRequest = this._queue.shift()!;
    this._subscriber?.(this._currentRequest);
  }

  private _cleanupRequest(request: PendingApprovalRequest) {
    if (request.signal && request.onAbort) {
      request.signal.removeEventListener("abort", request.onAbort);
    }
  }

  private _cancelRequest(request: PendingApprovalRequest) {
    if (this._currentRequest === request) {
      this._currentRequest = undefined;
      this._cleanupRequest(request);
      request.reject(abortError());
      this._processQueue();
      return;
    }

    const queuedIndex = this._queue.indexOf(request);
    if (queuedIndex < 0) return;

    this._queue.splice(queuedIndex, 1);
    this._cleanupRequest(request);
    request.reject(abortError());
    this._processQueue();
  }

  respond = (decision: ApprovalDecision) => {
    if (!this._currentRequest) return;
    const request = this._currentRequest;
    this._currentRequest = undefined;
    this._cleanupRequest(request);
    request.resolve(decision);
    this._processQueue();
  };

  // eslint-disable-next-line no-unused-vars
  subscribe(callback: (req: ApprovalRequest | null) => void) {
    this._subscriber = callback;
    this._processQueue();
    return () => {
      this._subscriber = undefined;
    };
  }
}

export const globalApprovalManager = new ApprovalManager();
