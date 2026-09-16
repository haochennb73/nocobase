/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { Display } from './components/Display';
import { MarkdownVditor } from './components';

export class MarkdownVditorRuntime {
  constructor(
    private app: any,
    private getPublicPath: () => string,
  ) {}

  get dependencies() {
    return {
      cdn: this.getCDN(),
    };
  }

  getCDN() {
    // 统一使用插件内置的 vditor 静态资源，不依赖公共 CDN（离线/内网环境同样可用）。
    return this.app.getCdnUrl() + 'static/plugins/@nocobase/plugin-field-markdown-vditor/dist/client/vditor';
  }

  initVditorDependency() {
    try {
      // getCDN 依赖 app.getCdnUrl，放入 try 以保证资源地址解析失败时也只记录日志而不抛出。
      const cdn = this.getCDN();
      const vditorDepdencePrefix = 'plugin-field-markdown-vditor-dep';
      const vditorDepdence = {
        [`${vditorDepdencePrefix}.katex`]: `${cdn}/dist/js/katex/katex.min.js?v=0.16.9`,
        [`${vditorDepdencePrefix}.ABCJS`]: `${cdn}/dist/js/abcjs/abcjs_basic.min`,
        [`${vditorDepdencePrefix}.plantumlEncoder`]: `${cdn}/dist/js/plantuml/plantuml-encoder.min`,
        [`${vditorDepdencePrefix}.echarts`]: `${cdn}/dist/js/echarts/echarts.min`,
        [`${vditorDepdencePrefix}.flowchart`]: `${cdn}/dist/js/flowchart.js/flowchart.min`,
        [`${vditorDepdencePrefix}.Viz`]: `${cdn}/dist/js/graphviz/viz`,
        [`${vditorDepdencePrefix}.mermaid`]: `${cdn}/dist/js/mermaid/mermaid.min`,
      };
      this.app.requirejs.require.config({
        waitSeconds: 120,
        paths: vditorDepdence,
      });
      Object.keys(vditorDepdence).forEach((key) => {
        this.app.requirejs.require([key], (m) => {
          window[key.split('.')[1]] = m;
        });
      });
    } catch (e) {
      console.log('initVditorDependency failed', e);
    }
  }

  render(text, props = {}) {
    if (!text) return null;
    return <Display value={text} {...props} />;
  }

  edit(props = {}) {
    return <MarkdownVditor {...props} />;
  }
}
