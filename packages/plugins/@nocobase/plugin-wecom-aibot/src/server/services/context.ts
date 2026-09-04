/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { Database } from '@nocobase/database';
import type { AggregationManager } from './aggregation';
import type { ConnectionManager } from './connection-manager';
import type { HistoryService } from './history';
import type { InboundService } from './inbound';
import type { OutboundService } from './outbound';

export interface PluginLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Shared wiring between the collaborating services. The services reference each
 * other (connection → inbound → aggregation/history, outbound → connection), so the
 * plugin constructs one context and fills the references during `load()`. Services
 * read the references lazily at call time; everything is set before the app starts
 * receiving socket events.
 */
export interface ServiceContext {
  db: Database;
  logger: PluginLogger;
  inbound?: InboundService;
  connectionManager?: ConnectionManager;
  outbound?: OutboundService;
  history?: HistoryService;
  aggregation?: AggregationManager;
}
