/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { BlockModel } from '@nocobase/client';
import React from 'react';
// import { tExpr } from '../utils';

export class DemoBlockModel extends BlockModel {
  renderComponent() {
    return (
      <div>
        <h1>Hello, CreateNewBlock!</h1>
        <p>这是一个自定义的区块模型.</p>
      </div>
    );
  }
}

DemoBlockModel.define({
  //   label: tExpr('Demo block'),
  label: 'Demo block',
});
