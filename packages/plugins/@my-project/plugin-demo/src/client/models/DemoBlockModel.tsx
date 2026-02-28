/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 */

import { BlockModel } from '@nocobase/client';
import React, { useEffect, useState, useRef } from 'react';

// 动态注入霓虹灯 CSS
const injectNeonStyle = () => {
  if (document.getElementById('demo-block-neon-p-style')) return;

  const style = document.createElement('style');
  style.id = 'demo-block-neon-p-style';
  style.textContent = `
    @keyframes neonSlide {
      0% { background-position: 0% center; }
      100% { background-position: 200% center; }
    }
    .neon-p {
      font-size: 2rem;
      font-weight: bold;
      text-align: center;
      margin: 20px 0;
      background: linear-gradient(90deg,
        #ff0000, #ff8000, #ffff00,
        #80ff00, #00ff80, #00ffff,
        #0080ff, #0000ff, #8000ff,
        #ff00ff, #ff0080, #ff0000);
      background-size: 600% 600%;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      animation: neonSlide 3s linear infinite;
    }
  `;
  document.head.appendChild(style);
};

const statusMap: Record<string, string> = {
  '0': '草稿',
  '1': '已发布',
  '2': '已归档',
  '3': '已删除',
  '4': '审核中',
};

const TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGVOYW1lIjoiZG9jX0FQSSIsImlhdCI6MTc3MjA3NzM1OSwiZXhwIjozMzMyOTY3NzM1OX0.ceNC6lvl9mTnz79pu2r52R946aWHMoSnr9t37l4p1yc';

const BASE_URL = 'http://localhost:13000/api';

const fetchJSON = async (url: string) => {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
};

export class DemoBlockModel extends BlockModel {
  renderComponent() {
    const DocumentListBlock = () => {
      const [documents, setDocuments] = useState<any[]>([]);
      const [taskNameMap, setTaskNameMap] = useState<Record<string, string>>({});
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);

      // === EVA Terminal 状态 ===
      const [currentContent, setCurrentContent] = useState(''); // 仅动态内容（不含标题）
      const [isAlert, setIsAlert] = useState(false);
      const typingRef = useRef(false);

      // === 数据加载 + 霓虹样式注入 ===
      useEffect(() => {
        injectNeonStyle(); // ✅ 注入霓虹样式

        const fetchData = async () => {
          try {
            const docRes = await fetchJSON(`${BASE_URL}/document:list`);
            const docs = Array.isArray(docRes) ? docRes : docRes.data || [];
            setDocuments(docs);

            const taskIds = Array.from(new Set(docs.map((d) => d.task_id).filter(Boolean)));
            const results = await Promise.all(
              taskIds.map(async (id) => {
                try {
                  const data = await fetchJSON(`${BASE_URL}/t_9mgrdqjcrvg:get?filterByTk=${id}`);
                  return { id, name: data?.data?.f_sn0fggvygmr || '未命名任务' };
                } catch {
                  return { id, name: '任务加载失败' };
                }
              }),
            );
            const map: Record<string, string> = {};
            results.forEach(({ id, name }) => (map[String(id)] = name));
            setTaskNameMap(map);
          } catch (err: any) {
            setError(err.message || '未知错误');
          } finally {
            setLoading(false);
          }
        };
        fetchData();
      }, []);

      // === 注入 EVA 终端 CSS ===
      useEffect(() => {
        if (document.getElementById('eva-terminal-style')) return;
        const style = document.createElement('style');
        style.id = 'eva-terminal-style';
        style.textContent = `
          .eva-terminal-container {
            margin-top: 30px;
            width: 100%;
            display: flex;
            justify-content: center;
            background-color: #000;
            padding: 10px 0;
          }
          #eva-terminal {
            font-size: 20px;
            line-height: 1.4;
            white-space: pre-wrap;
            width: 90%;
            max-width: 800px;
            color: #ff0000;
            font-family: 'Courier New', monospace;
            text-shadow: 0 0 10px #ff0000;
            animation: flicker 4s infinite alternate;
            min-height: 160px;
            height: 200px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
          }
          #eva-terminal-header {
            text-align: center;
            font-weight: bold;
            margin-bottom: 8px;
          }
          #eva-terminal-content {
            flex: 1;
            overflow: hidden;
          }
          @keyframes flicker {
            0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; }
            20%, 24%, 55% { opacity: 0.4; }
          }
          .alert {
            animation: alertPulse 2s infinite alternate !important;
          }
          @keyframes alertPulse {
            from { text-shadow: 0 0 5px #ff0000; }
            to { text-shadow: 0 0 20px #ff0000, 0 0 30px #ff0000; }
          }
        `;
        document.head.appendChild(style);
      }, []);

      // === 打字循环逻辑 ===
      useEffect(() => {
        if (documents.length === 0 || typingRef.current) return;
        typingRef.current = true;

        let docIndex = 0;

        const buildContentText = (doc: any): string => {
          const title = doc.title || '无标题';
          const content = (doc.content || '无内容').replace(/\n/g, ' ');
          const taskDisplay = doc.task_id ? taskNameMap[String(doc.task_id)] || '加载中...' : '无任务';
          const status = statusMap[doc.doc_status] || '未知';
          return [`标题：${title}`, `内容：${content}`, `任务：${taskDisplay}`, `状态：${status}`].join('\n');
        };

        const typeContent = (fullText: string): Promise<void> => {
          return new Promise((resolve) => {
            let i = 0;
            let current = '';

            const type = () => {
              if (i < fullText.length) {
                current += fullText[i];
                setCurrentContent(current);
                i++;
                setTimeout(type, Math.random() * 100 + 50);
              } else {
                resolve();
              }
            };
            type();
          });
        };

        const cycle = async () => {
          while (typingRef.current && documents.length > 0) {
            const doc = documents[docIndex];
            const contentText = buildContentText(doc);

            setIsAlert(docIndex === 0);

            // 打字
            await typeContent(contentText);

            // 展示 2.5 秒
            await new Promise((resolve) => setTimeout(resolve, 3000));

            // 清空内容（但保留头部）
            setCurrentContent('');

            // 间隔
            await new Promise((resolve) => setTimeout(resolve, 1000));

            docIndex = (docIndex + 1) % documents.length;
          }
        };

        cycle();

        return () => {
          typingRef.current = false;
        };
      }, [documents, taskNameMap]);

      return (
        <div>
          <h1 style={{ textAlign: 'center' }}>Hello, CreateDemoBlock!</h1>
          {/* ✅ 恢复 neon-p 元素 */}
          <p className="neon-p">这是一个自定义的区块模型.</p>

          {loading ? (
            <p style={{ textAlign: 'center' }}>正在加载文档与任务数据...</p>
          ) : error ? (
            <p style={{ color: 'red', textAlign: 'center' }}>加载失败：{error}</p>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: '24px' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '12px' }}>API调用演示（显示文档库）</h2>

              {/* EVA 终端区域 */}
              <div className="eva-terminal-container">
                <div id="eva-terminal" className={isAlert ? 'alert' : ''}>
                  <div id="eva-terminal-header">■■■ DOCUMENT DISPLAY ■■■</div>
                  <div id="eva-terminal-content">{currentContent}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    };

    return <DocumentListBlock />;
  }
}
