/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useCallback } from 'react';
import { AIEmployee, ClearOptions, Message, SendOptions, TriggerTaskOptions } from '../../types';
import { useChatBoxStore } from '../stores/chat-box';
import { useChatConversationsStore } from '../stores/chat-conversations';
import { useChat } from '../hooks/useChat';
import { useChatConversationActions } from './useChatConversationActions';
import { useChatMessageActions } from './useChatMessageActions';
import { useT } from '../../../locale';
import { parseTask } from '../utils';
import { uid } from '@formily/shared';
import { aiEmployeeRole } from '../roles';
import { useChatToolsStore } from '../stores/chat-tools';
import { useWorkflowTasksStore } from '../stores/workflow-tasks';
import { useAPIClient } from '@nocobase/client';
import { useAIConfigRepository } from '../../../repositories/hooks/useAIConfigRepository';
import { getAIEmployeeModels, getAllModels, isSameModel, isValidModel, resolveModel } from '../model';
import { isBuiltIn } from '../../built-in/utils';

const TASK_TOPIC_CONSTRAINT = `
[任务约束]
你必须严格围绕以上任务背景内容回答问题。如果用户提问与任务背景无关，请礼貌拒绝并引导用户回到任务相关话题。不要回答与任务无关的任何问题。`;

export const useChatBoxActions = () => {
  const api = useAPIClient();
  const aiConfigRepository = useAIConfigRepository();
  const t = useT();

  const open = useChatBoxStore.use.open();
  const setOpen = useChatBoxStore.use.setOpen();
  const setReadonly = useChatBoxStore.use.setReadonly();
  const setSenderValue = useChatBoxStore.use.setSenderValue();
  const setTaskVariables = useChatBoxStore.use.setTaskVariables();
  const roles = useChatBoxStore.use.roles();
  const setRoles = useChatBoxStore.use.setRoles();
  const currentEmployee = useChatBoxStore.use.currentEmployee();
  const setCurrentEmployee = useChatBoxStore.use.setCurrentEmployee();
  const senderRef = useChatBoxStore.use.senderRef();
  const setModel = useChatBoxStore.use.setModel();
  const setRequireTaskSelection = useChatBoxStore.use.setRequireTaskSelection();
  const setLastTriggeredTasks = useChatBoxStore.use.setLastTriggeredTasks();

  const setCurrentConversation = useChatConversationsStore.use.setCurrentConversation();
  const currentConversation = useChatConversationsStore.use.currentConversation();
  const setWebSearch = useChatConversationsStore.use.setWebSearch();
  const chat = useChat(currentConversation);
  const draftChat = useChat();

  const setOpenToolModal = useChatToolsStore.use.setOpenToolModal();
  const setActiveTool = useChatToolsStore.use.setActiveTool();
  const setActiveMessageId = useChatToolsStore.use.setActiveMessageId();
  const setCurrentWorkflowTask = useWorkflowTasksStore.use.setCurrentWorkflowTask();

  const { refresh: refreshConversations } = useChatConversationActions();
  const { sendMessages, syncContextAttachments } = useChatMessageActions();

  const clear = (options?: ClearOptions, sessionId: string | undefined = currentConversation) => {
    const sessionChat = chat.for(sessionId);
    const {
      sender,
      systemMessage,
      attachments,
      contextItems,
      taskVariables,
      toolModal,
      activeTool,
      activeMessageId,
      skillSettings,
    } = options ?? {};
    if (sender !== false) {
      setSenderValue('');
    }
    if (systemMessage !== false) {
      sessionChat.setSystemMessage('');
    }
    if (attachments !== false) {
      sessionChat.setAttachments([]);
    }
    if (contextItems !== false) {
      sessionChat.setContextItems([]);
    }
    if (taskVariables !== false) {
      setTaskVariables({});
    }
    if (toolModal !== false) {
      setOpenToolModal(false);
    }
    if (activeTool !== false) {
      setActiveTool(null);
    }
    if (activeMessageId !== false) {
      setActiveMessageId('');
    }
    if (skillSettings !== false) {
      sessionChat.setSkillSettings(undefined);
    }
  };

  const send = (options: SendOptions) => {
    const sendOptions = {
      ...options,
      onConversationCreate: (sessionId: string) => {
        setCurrentConversation(sessionId);
        refreshConversations();
      },
    };
    clear();
    sendMessages(sendOptions);
  };

  const updateRole = (aiEmployee: AIEmployee) => {
    if (!roles[aiEmployee.username]) {
      setRoles((prev) => ({
        ...prev,
        [aiEmployee.username]: aiEmployeeRole(aiEmployee),
      }));
    }
  };

  const ensureModel = useCallback(
    async (aiEmployee: AIEmployee) => {
      const allModels = getAllModels(await aiConfigRepository.getLLMServices());
      const currentModel = useChatBoxStore.getState().model;
      const resolvedModel = resolveModel(api, aiEmployee, allModels, currentModel);
      if (!isSameModel(currentModel, resolvedModel)) {
        setModel(resolvedModel);
      }
      return resolvedModel;
    },
    [api, aiConfigRepository, setModel],
  );

  const resolveTaskModel = useCallback(
    async (aiEmployee: AIEmployee, taskModel?: { llmService: string; model: string } | null) => {
      const allModels = getAllModels(await aiConfigRepository.getLLMServices());
      const scopedModels = getAIEmployeeModels(aiEmployee, allModels);
      if (!scopedModels.length) {
        const currentModel = useChatBoxStore.getState().model;
        if (currentModel) {
          setModel(null);
        }
        return null;
      }
      if (!aiEmployee?.modelSettings?.enabled && isValidModel(taskModel, scopedModels)) {
        const currentModel = useChatBoxStore.getState().model;
        if (!isSameModel(currentModel, taskModel)) {
          setModel(taskModel);
        }
        return taskModel;
      }
      const currentModel = useChatBoxStore.getState().model;
      const resolvedModel = resolveModel(api, aiEmployee, allModels, currentModel);
      if (!isSameModel(currentModel, resolvedModel)) {
        setModel(resolvedModel);
      }
      return resolvedModel;
    },
    [api, aiConfigRepository, setModel],
  );

  const startNewConversation = useCallback(() => {
    const greetingMsg = {
      key: uid(),
      role: currentEmployee.username,
      content: {
        type: 'greeting' as const,
        content: currentEmployee.greeting || t('Default greeting message', { nickname: currentEmployee.nickname }),
      },
    };
    setCurrentConversation(undefined);
    setCurrentWorkflowTask(undefined);
    clear(undefined, undefined);
    draftChat.setMessages([greetingMsg]);
    senderRef.current?.focus();
  }, [currentEmployee, setCurrentWorkflowTask]);

  const triggerTask = useCallback(
    async (options: TriggerTaskOptions) => {
      clear(undefined, undefined);
      const { aiEmployee, tasks } = options;
      const isCustomEmployee = aiEmployee && !isBuiltIn(aiEmployee);

      // Save tasks so switchAIEmployee can re-trigger when switching back
      setLastTriggeredTasks(tasks?.length ? tasks : null);

      updateRole(aiEmployee);
      setReadonly(false);
      draftChat.setResponseLoading(false);
      if (!open) {
        setOpen(true);
      }
      if (currentConversation) {
        setCurrentConversation(undefined);
        setCurrentWorkflowTask(undefined);
        draftChat.setMessages([]);
      }
      setCurrentEmployee(aiEmployee);
      await ensureModel(aiEmployee);
      senderRef.current?.focus();
      const msgs: Message[] = [
        {
          key: uid(),
          role: aiEmployee.username,
          content: {
            type: 'greeting',
            content: aiEmployee.greeting || t('Default greeting message', { nickname: aiEmployee.nickname }),
          },
        },
      ];
      if (!tasks?.length) {
        setRequireTaskSelection(false);
        draftChat.setMessages(msgs);
        return;
      }
      if (tasks.length === 1 && options.auto !== false) {
        setRequireTaskSelection(false);
        draftChat.setMessages(msgs);
        const task = tasks[0];
        const {
          userMessage,
          systemMessage,
          attachments,
          workContext,
          skillSettings,
          webSearch,
          model: taskModel,
        } = await parseTask(task);
        // Append topic constraint for custom (non-built-in) AI employees
        const finalSystemMessage =
          isCustomEmployee && systemMessage ? systemMessage + TASK_TOPIC_CONSTRAINT : systemMessage;
        const resolvedModel = await resolveTaskModel(aiEmployee, taskModel);
        const service = (await aiConfigRepository.getLLMServices()).find(
          (s) => s.llmService === resolvedModel?.llmService,
        );
        const resolvedWebSearch =
          service?.supportWebSearch === false ? false : typeof webSearch === 'boolean' ? webSearch : false;
        setWebSearch(resolvedWebSearch);
        if (userMessage && userMessage.type === 'text') {
          setSenderValue(userMessage.content);
        } else {
          setSenderValue('');
        }
        if (attachments) {
          draftChat.setAttachments(attachments);
        }
        if (workContext) {
          draftChat.setContextItems(workContext);
          syncContextAttachments(workContext);
        }
        if (finalSystemMessage) {
          draftChat.setSystemMessage(finalSystemMessage);
        }
        if (skillSettings) {
          draftChat.setSkillSettings(skillSettings);
        }
        if (task.autoSend) {
          send({
            aiEmployee,
            systemMessage: finalSystemMessage,
            messages: [userMessage ?? { type: 'text', content: '' }],
            attachments,
            workContext,
            skillSettings,
            webSearch: resolvedWebSearch,
            model: resolvedModel,
          });
        }
        return;
      }
      // Multiple tasks: require task selection for custom (non-built-in) AI employees
      if (isCustomEmployee) {
        setRequireTaskSelection(true);
      } else {
        setRequireTaskSelection(false);
      }
      msgs.push({
        key: uid(),
        role: 'task',
        content: {
          content: tasks,
        },
      });
      draftChat.setMessages(msgs);
    },
    [
      open,
      currentConversation,
      ensureModel,
      aiConfigRepository,
      resolveTaskModel,
      setCurrentWorkflowTask,
      setWebSearch,
      setRequireTaskSelection,
      setLastTriggeredTasks,
    ],
  );

  const switchAIEmployee = useCallback(
    (aiEmployee: AIEmployee, options?: { clear?: ClearOptions }) => {
      setCurrentEmployee(aiEmployee);
      setCurrentConversation(undefined);
      setCurrentWorkflowTask(undefined);
      setRequireTaskSelection(false);
      clear(options?.clear, undefined);
      setModel(null);

      // Re-trigger task selection when switching back to a custom employee
      // that had tasks from the last shortcut trigger
      const lastTasks = useChatBoxStore.getState().lastTriggeredTasks;
      if (aiEmployee && !isBuiltIn(aiEmployee) && lastTasks?.length) {
        triggerTask({ aiEmployee, tasks: lastTasks });
        return;
      }

      if (aiEmployee) {
        const greetingMsg = {
          key: uid(),
          role: aiEmployee.username,
          content: {
            type: 'greeting' as const,
            content: aiEmployee.greeting || t('Default greeting message', { nickname: aiEmployee.nickname }),
          },
        };
        senderRef.current?.focus();
        draftChat.setMessages([greetingMsg]);
      } else {
        draftChat.setMessages([]);
      }
    },
    [currentConversation, setCurrentWorkflowTask, triggerTask],
  );

  return {
    clear,
    send,
    startNewConversation,
    switchAIEmployee,
    triggerTask,
  };
};
