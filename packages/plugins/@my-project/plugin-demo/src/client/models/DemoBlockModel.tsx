/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { BlockModel } from '@nocobase/client';
import React, { useEffect, useState } from 'react';

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

// 任务名称缓存
const fetchTaskName = async (taskId: number | string, token: string): Promise<string> => {
  if (!taskId) return '无任务';
  try {
    const url = `http://localhost:13000/api/t_9mgrdqjcrvg:get?filterByTk=${taskId}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: '*/*',
      },
    });
    if (!res.ok) return '任务获取失败';
    const data = await res.json();
    // 假设返回结构为 { data: { f_sn0fggvygmr: "任务名称" } }
    return data?.data?.f_sn0fggvygmr || '未命名任务';
  } catch (err) {
    console.error('Fetch task error:', err);
    return '加载失败';
  }
};

export class DemoBlockModel extends BlockModel {
  renderComponent() {
    const DocumentListBlock = () => {
      useEffect(() => {
        injectNeonStyle();
      }, []);

      const [documents, setDocuments] = useState<any[]>([]);
      const [taskNameMap, setTaskNameMap] = useState<Record<string, string>>({});
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);

      const TOKEN =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGVOYW1lIjoiZG9jX0FQSSIsImlhdCI6MTc3MjA3NzM1OSwiZXhwIjozMzMyOTY3NzM1OX0.ceNC6lvl9mTnz79pu2r52R946aWHMoSnr9t37l4p1yc';

      useEffect(() => {
        const fetchData = async () => {
          try {
            // 1. 获取文档列表
            const docRes = await fetch('http://localhost:13000/api/document:list', {
              headers: { Authorization: `Bearer ${TOKEN}` },
            });
            if (!docRes.ok) throw new Error(`文档加载失败: ${docRes.status}`);
            const docResult = await docRes.json();
            const docs = Array.isArray(docResult) ? docResult : docResult.data || [];
            setDocuments(docs);

            // 2. 提取所有唯一 task_id
            const taskIds = Array.from(new Set(docs.map((d) => d.task_id).filter((id) => id)));

            // 3. 并发获取任务名称
            const taskPromises = taskIds.map((id) => fetchTaskName(id, TOKEN).then((name) => ({ id, name })));

            const results = await Promise.all(taskPromises);
            const map: Record<string, string> = {};
            results.forEach(({ id, name }) => {
              map[String(id)] = name;
            });
            setTaskNameMap(map);
          } catch (err: any) {
            console.error('Failed to load data:', err);
            setError(err.message || '未知错误');
          } finally {
            setLoading(false);
          }
        };

        fetchData();
      }, []);

      return (
        <div>
          {/* 原有内容 */}
          <h1 style={{ textAlign: 'center' }}>Hello, CreateDemoBlock!</h1>
          <p className="neon-p">这是一个自定义的区块模型.</p>

          {/* 加载/错误/表格 */}
          {loading ? (
            <p style={{ textAlign: 'center' }}>正在加载文档与任务数据...</p>
          ) : error ? (
            <p style={{ color: 'red', textAlign: 'center' }}>加载失败：{error}</p>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: '24px' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '12px' }}>API调用演示</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>标题</th>
                    <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>内容</th>
                    <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>任务</th>
                    <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((item) => (
                    <tr key={item.id}>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>{item.title || '无标题'}</td>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                        {item.content ? (
                          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                            {item.content}
                          </pre>
                        ) : (
                          '无内容'
                        )}
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                        {taskNameMap[String(item.task_id)] || (item.task_id ? '加载中...' : '无任务')}
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                        {statusMap[item.doc_status] || item.doc_status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    };

    return <DocumentListBlock />;
  }
}
