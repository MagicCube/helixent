import type { AskUserQuestionParameters, AskUserQuestionResult } from "./ask-user-question";

export type AskUserQuestionRequest = {
  params: AskUserQuestionParameters;
  // eslint-disable-next-line no-unused-vars
  resolve: (result: AskUserQuestionResult) => void;
};

type PendingAskUserQuestionRequest = AskUserQuestionRequest & {
  // eslint-disable-next-line no-unused-vars
  reject: (error: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
};

const MAX_QUEUE_SIZE = 20;

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

export class AskUserQuestionManager {
  private _queue: PendingAskUserQuestionRequest[] = [];
  private _currentRequest?: PendingAskUserQuestionRequest;
  // eslint-disable-next-line no-unused-vars
  private _subscriber?: (req: AskUserQuestionRequest | null) => void;

  askUserQuestion = (
    params: AskUserQuestionParameters,
    signal?: AbortSignal,
  ): Promise<AskUserQuestionResult> => {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(abortError());
        return;
      }
      if (this._queue.length >= MAX_QUEUE_SIZE) {
        console.warn("[AskUserQuestionManager] Queue overflow; rejecting request.");
        reject(new Error("Ask user question queue overflow"));
        return;
      }

      const request: PendingAskUserQuestionRequest = { params, resolve, reject, signal };
      if (signal) {
        request.onAbort = () => this._cancelRequest(request);
        signal.addEventListener("abort", request.onAbort, { once: true });
      }

      this._queue.push(request);
      this._processQueue();
    });
  };

  private _processQueue() {
    if (this._currentRequest) return;

    while (this._queue.length > 0) {
      const next = this._queue.shift()!;
      if (next.signal?.aborted) {
        this._cleanupRequest(next);
        next.reject(abortError());
        continue;
      }

      this._currentRequest = next;
      this._subscriber?.(next);
      return;
    }

    this._subscriber?.(null);
  }

  private _cleanupRequest(request: PendingAskUserQuestionRequest) {
    if (request.signal && request.onAbort) {
      request.signal.removeEventListener("abort", request.onAbort);
    }
  }

  private _cancelRequest(request: PendingAskUserQuestionRequest) {
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

  respondWithAnswers = (result: AskUserQuestionResult) => {
    if (!this._currentRequest) return;
    const request = this._currentRequest;
    this._currentRequest = undefined;
    this._cleanupRequest(request);
    request.resolve(result);
    this._processQueue();
  };

  // eslint-disable-next-line no-unused-vars
  subscribe(callback: (req: AskUserQuestionRequest | null) => void) {
    this._subscriber = callback;
    this._processQueue();
    return () => {
      this._subscriber = undefined;
    };
  }
}

export const globalAskUserQuestionManager = new AskUserQuestionManager();
