/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database } from '@nocobase/database';
import { COLLECTIONS, SEND_STATUS, TASK_STATUS } from '../../constants';

/**
 * Renders the most recent N completed Q&A rounds of a conversation into plain text.
 * Injected into the process task's `contextHistory` so the AI employee instruction
 * (which always starts a fresh AI session) can still continue a multi-turn dialogue.
 */
export class HistoryService {
  constructor(private db: Database) {}

  async render(conversationId: number | string, rounds: number): Promise<string> {
    if (!rounds || rounds <= 0) {
      return '';
    }

    const taskRepo = this.db.getRepository(COLLECTIONS.processTasks);
    const tasks = await taskRepo.find({
      filter: {
        conversationId,
        taskStatus: TASK_STATUS.done,
        // `$notEmpty` is NocoBase's registered "is not null" operator
        // (compiles to `Op.not: null` for non-string fields). `$notNull`
        // does not exist in the operator registry.
        replyMessageId: { $notEmpty: true },
      },
      sort: ['-createdAt'],
      limit: rounds,
    });

    if (!tasks.length) {
      return '';
    }

    const taskIds = tasks.map((task) => task.get('id'));
    const sendRepo = this.db.getRepository(COLLECTIONS.sendMessages);
    const replies = await sendRepo.find({
      filter: {
        taskId: { $in: taskIds },
        sendStatus: SEND_STATUS.sent,
      },
    });
    const replyByTaskId = new Map<string, string>();
    for (const reply of replies) {
      replyByTaskId.set(String(reply.get('taskId')), reply.get('content'));
    }

    // Oldest first for natural reading order.
    const lines: string[] = [];
    for (const task of tasks.reverse()) {
      const question = String(task.get('aggregatedContent') || '').trim();
      const answer = String(replyByTaskId.get(String(task.get('id'))) || '').trim();
      if (!question) {
        continue;
      }
      lines.push(`用户: ${question}`);
      if (answer) {
        lines.push(`助手: ${answer}`);
      }
    }

    if (!lines.length) {
      return '';
    }
    return `【历史对话（最近 ${tasks.length} 轮）】\n${lines.join('\n')}`;
  }
}

export default HistoryService;
