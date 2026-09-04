/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export interface AggregationWindow {
  botDbId: number;
  conversationId: number;
  chatType: string;
  chatKey: string;
  firstAt: number;
  lastAt: number;
  messageIds: number[];
  contents: string[];
  lastFromUserId: string;
  debounceTimer?: NodeJS.Timeout;
  capTimer?: NodeJS.Timeout;
}

export type WindowFlushHandler = (window: AggregationWindow) => Promise<void>;

/**
 * Per-conversation sliding aggregation window (design doc 03 §6.1).
 *
 * When a user sends several messages in a short burst, each message restarts the
 * debounce timer; the window is flushed once no new message arrives within `debounceMs`,
 * or when the hard cap `maxWindowMs` (measured from the first message) is reached.
 * Flushed windows are handed to the given handler, which creates one process task
 * for the whole batch — so one AI call answers the entire burst.
 */
export class AggregationManager {
  private windows = new Map<string, AggregationWindow>();
  private flushing = false;

  constructor(private onFlush: WindowFlushHandler) {}

  private keyOf(botDbId: number, conversationId: number): string {
    return `${botDbId}:${conversationId}`;
  }

  add(params: {
    botDbId: number;
    conversationId: number;
    chatType: string;
    chatKey: string;
    messageId: number;
    content: string;
    fromUserId: string;
    debounceMs: number;
    maxWindowMs: number;
  }): void {
    const key = this.keyOf(params.botDbId, params.conversationId);
    let window = this.windows.get(key);
    const now = Date.now();

    if (!window) {
      window = {
        botDbId: params.botDbId,
        conversationId: params.conversationId,
        chatType: params.chatType,
        chatKey: params.chatKey,
        firstAt: now,
        lastAt: now,
        messageIds: [],
        contents: [],
        lastFromUserId: params.fromUserId,
      };
      this.windows.set(key, window);

      if (params.maxWindowMs > 0) {
        window.capTimer = setTimeout(() => {
          this.flush(key).catch((err) => {
            // Keep the process alive; the failed batch is recoverable by the fallback workflow.
            console.error('[wecom-aibot] flush window on cap failed:', err);
          });
        }, params.maxWindowMs);
      }
    }

    window.lastAt = now;
    window.lastFromUserId = params.fromUserId;
    window.messageIds.push(params.messageId);
    if (params.content) {
      window.contents.push(params.content);
    }

    if (window.debounceTimer) {
      clearTimeout(window.debounceTimer);
    }
    if (params.debounceMs > 0) {
      window.debounceTimer = setTimeout(() => {
        this.flush(key).catch((err) => {
          console.error('[wecom-aibot] flush window on debounce failed:', err);
        });
      }, params.debounceMs);
    } else {
      // No aggregation configured: flush immediately.
      this.flush(key).catch((err) => {
        console.error('[wecom-aibot] flush window immediately failed:', err);
      });
    }
  }

  async flush(key: string): Promise<void> {
    const window = this.windows.get(key);
    if (!window) {
      return;
    }
    this.windows.delete(key);
    if (window.debounceTimer) {
      clearTimeout(window.debounceTimer);
    }
    if (window.capTimer) {
      clearTimeout(window.capTimer);
    }
    if (!window.messageIds.length) {
      return;
    }
    await this.onFlush(window);
  }

  /** Flush every open window (used on app shutdown). */
  async flushAll(): Promise<void> {
    this.flushing = true;
    const keys = Array.from(this.windows.keys());
    for (const key of keys) {
      await this.flush(key);
    }
    this.flushing = false;
  }

  /** Window keys currently holding messages (diagnostics). */
  keys(): string[] {
    return Array.from(this.windows.keys());
  }
}

export default AggregationManager;
