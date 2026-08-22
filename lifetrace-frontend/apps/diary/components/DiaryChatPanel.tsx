"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp, Square, Sparkles,
  History, Plus,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useChatSessions, useChatHistory } from "@/lib/query/chat";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { motion, AnimatePresence } from "framer-motion";
import { sendChatMessageStream } from "@/lib/api";
import type { ToolCallEvent } from "@/lib/api";
import type { ChatMessage, ToolCallStep } from "@/apps/chat/types";
import { LinkedNotes } from "@/apps/chat/components/input/LinkedNotes";
import { useNoteChatStore } from "@/lib/store/note-chat-store";
import { useLocaleStore } from "@/lib/store/locale";
import { queryKeys } from "@/lib/query/keys";
import { MessageBubble } from "@/apps/chat/components/chat-ui/index";
import { VoiceInputButton } from "@/components/ui/voice-input-button";

// ─── Tab definitions ───

type TabDef = { key: string; label: string };

const TAB_LABELS: Record<string, string> = {
  insight: "默认洞察",
  value: "价值澄清",
  inversion: "逆向思考",
  secondOrder: "二阶思考",
  cbt: "CBT疗法",
  mbti: "MBTI分析",
};

const ANALYSIS_TABS: TabDef[] = Object.entries(TAB_LABELS).map(([key, label]) => ({ key, label }));

const TAB_PROMPTS: Record<string, string> = {
  insight: `你是一位深度思维分析师，专门帮助用户从笔记中发现隐藏的认知模式。

## 你的任务
仔细阅读用户提供的所有笔记内容，从以下维度进行深度分析：

1. **核心主题识别**：找出笔记中反复出现的关键词、概念和主题
2. **思维模式提炼**：识别用户看待问题的惯常视角和思考框架
3. **思维盲点揭示**：发现用户可能忽略或回避的领域
4. **认知图谱勾勒**：将碎片化记录连接成完整的思考轨迹

## 输出原则
- 不替用户得出结论，而是提出深刻的问题激发用户自我反思
- 以第三方观察者的客观视角呈现分析
- 语言简洁，洞见犀利，避免泛泛而谈
- 结尾提出 2-3 个能引发深度思考的问题

**重要：请使用简体中文回答。**

## 笔记内容
{{notes}}`,
  value: `你是一位价值观挖掘顾问，擅长从日常碎片化记录中提炼一个人真正在意的东西。

## 你的任务
阅读用户提供的笔记，完成以下分析：

1. **高频关注点**：找出用户反复记录、反复提及的人、事、物、概念
2. **情绪锚点**：识别哪些内容触发了用户强烈的情绪反应（无论正负）
3. **核心价值观提炼**：从以上线索中归纳出 3-5 条用户深层在意的原则
4. **行为导向建议**：基于这些价值观，指出用户在决策时可以遵循的长期方向

## 输出格式
- 用简短的标题命名每条价值观（如"深度胜于广度"、"关系重于效率"）
- 附上来自笔记的具体证据支撑每条提炼
- 最后提问：这些价值观是否真的是你想要坚守的？

## 注意
不要投用户所好，如果发现价值观之间存在冲突，要明确指出。

**重要：请使用简体中文回答。**

## 笔记内容
{{notes}}`,
  inversion: `你是查理·芒格的逆向思维实践者。你相信"如果我知道自己会死在哪里，我就永远不去那个地方"。

## 你的任务
阅读用户的笔记，运用逆向思维方法进行分析：

1. **识别核心假设**：找出用户笔记中隐含的、未被质疑的前提和假设
2. **假设反转**：将每个关键假设翻转，问"如果相反的情况是真的呢？"
3. **风险识别**：从反转视角发现用户可能忽视的风险、漏洞或盲区
4. **隐藏可能性**：找出被常规思维屏蔽掉的替代方案或机会

## 输出格式
对每个关键假设：
- 原始假设：用户默认相信的是...
- 反转假设：但如果...
- 潜在风险/可能性：这意味着...

## 语气
直接、犀利，不回避让用户不舒服的结论。好的逆向思考有时令人不悦，但极具价值。

**重要：请使用简体中文回答。**

## 笔记内容
{{notes}}`,
  secondOrder: `你是一位系统性思维教练，专注于帮助用户从表层现象穿透到底层规律。

## 核心理念
一阶思考问："这是什么？"
二阶思考问："这背后是什么？这会导致什么？这和什么相关？"

## 你的任务
阅读用户笔记，完成以下分析：

1. **表层问题识别**：找出用户笔记中显性记录的困惑、问题或现象
2. **深层规律提炼**：
   - 这些问题的共同根源是什么？
   - 哪些底层模式在反复制造这些表层问题？
3. **跨笔记关联**：将看似无关的笔记串联，发现隐藏的系统性联系
4. **认知突破点**：指出一旦理解某个底层规律，哪些问题会迎刃而解

## 输出格式
- 先列出表层现象
- 用"→"符号引导到深层规律
- 最终提炼出 1-2 个核心洞见，要有足够的概括力和冲击力

**重要：请使用简体中文回答。**

## 笔记内容
{{notes}}`,
  cbt: `你是一位受过认知行为疗法（CBT）训练的思维观察者。
注意：你不是心理治疗师，你的作用是帮助用户觉察思维模式，而非提供临床治疗。

## CBT核心框架
情境 → 自动化思维 → 情绪/行为
改变认知 = 改变情绪和行为的入口

## 你的任务
阅读用户笔记，完成以下分析：

1. **思维陷阱识别**：找出以下常见认知扭曲的证据：
   - 全或无思维（非黑即白）
   - 灾难化（过度放大负面）
   - 心理过滤（忽视正面信息）
   - 情绪化推理（凭感觉下结论）
   - 应该化陈述（过度苛责自己）
   - 个人化（过度揽责）

2. **情绪-思维链梳理**：识别是哪种思维触发了哪种情绪

3. **认知重构建议**：针对每个思维陷阱，提供具体的替代性思考方式

4. **行动建议**：提出 1-2 个小的、可执行的行为实验来验证新认知

## 语气
温暖而不失客观，支持而不回避问题，像一个不评判的智慧朋友。

**重要：请使用简体中文回答。**

## 笔记内容
{{notes}}`,
  mbti: `你是一位人格类型分析师，精通 MBTI（迈尔斯-布里格斯类型指标）理论。

## 重要前提
MBTI 是一种认知框架工具，而非科学测量。你的分析基于文字表达习惯推断倾向，
结果供参考和自我探索，而非最终定论。

## 四个维度分析框架
- **E/I**（能量来源）：外倾 vs 内倾
- **S/N**（信息获取）：感觉 vs 直觉
- **T/F**（决策方式）：思考 vs 情感
- **J/P**（生活方式）：判断 vs 知觉

## 你的任务
阅读用户笔记，从以下角度进行分析：

1. **语言风格观察**：
   - 倾向具体细节还是抽象概念？（S vs N）
   - 倾向逻辑分析还是价值判断？（T vs F）
   - 倾向计划总结还是开放探索？（J vs P）
   - 倾向内省独处还是外部互动？（E vs I）

2. **倾向评估**：对每个维度给出倾向判断及置信度（强/中/弱）

3. **类型推断**：综合给出最可能的 MBTI 类型，并解释推断依据

4. **实用洞见**：基于推断类型，指出：
   - 用户可能的能量来源和消耗点
   - 决策时的典型模式
   - 潜在的盲区和成长方向

## 输出格式
先呈现证据，再给出推断，最后给出实用建议。
明确标注哪些是强证据，哪些是弱信号。

**重要：请使用简体中文回答。**

## 笔记内容
{{notes}}`,
};

// ─── Helpers ───

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ─── Empty state ───

function EmptyState({ onTabSelect }: { onTabSelect: (tab: TabDef) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex h-full flex-col items-center justify-center px-6"
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center ring-1 ring-primary/10">
            <Sparkles className="w-7 h-7 text-primary/60" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
          </div>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            AI 洞察
          </h2>
          <p className="text-sm text-muted-foreground/70 leading-relaxed max-w-[240px]">
            选择一个分析维度开始探索，或直接输入你的问题
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-1.5 max-w-[260px]">
          {ANALYSIS_TABS.map((tab) => (
            <motion.button
              key={tab.key}
              type="button"
              onClick={() => onTabSelect(tab)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="px-3 py-1.5 text-xs rounded-full border border-border/40 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground hover:bg-primary/5 transition-colors font-medium"
            >
              {tab.label}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main component ───

// 笔记创建 system prompt - 用户自由输入时使用
const CREATE_NOTE_SYSTEM_PROMPT = `你是一个笔记创建助手。

## 核心规则
用户输入的内容就是**要创建的笔记正文**。不要提问、不要确认、不要建议修改。
直接调用 create_note 工具创建笔记，用户输入作为 user_notes 参数传入。
- 标题留空（后端自动用创建时间）
- 根据正文内容推断 1-3 个标签，通过 tags 参数传入
- 如果用户明确指定了标签（如"标签：工作、日报"），使用用户指定的标签

## 标签规则（重要）
- 在调用 create_note 之前，**必须先调用 list_note_tags() 查看已有标签库**
- 从已有标签中选择最贴合正文的 1-3 个标签，优先复用已有标签
- 只有当已有标签完全不合适时，才创建新标签
- 这样可以避免每次创建笔记都生成不同的标签导致标签爆炸

## 推荐流程
1. 先调用 list_note_tags() 获取已有标签列表
2. 从已有标签中挑选 1-3 个最贴合正文的标签
3. 调用 create_note(user_notes="...", tags="标签1,标签2")

## 例子
用户说"今天工作了，完成了日报"
→ 先 list_note_tags() 查看已有标签
→ 假设已有标签中有"工作"、"日报"
→ create_note(user_notes="今天工作了，完成了日报", tags="工作,日报")

用户说"关于婚姻的思考"
→ 先 list_note_tags() 查看已有标签
→ 假设已有标签中有"婚姻"、"思考"、"人生"
→ create_note(user_notes="关于婚姻的思考", tags="婚姻,思考")

不要做分析、不要给建议、不要提问，直接创建笔记。`;

// 笔记页思维教练 system prompt（用户不可见，仅注入后端）
const THINKING_COACH_SYSTEM_PROMPT = `你是一个思维教练，不是助手。
你的任务是帮用户发现他自己没有意识到的思维模式和逻辑盲点。
用户会给你一条当前笔记，以及系统提供的关联笔记。
---
【第一步：判断任务类型】
拿到笔记后，先问自己两个问题：
问题1：这条笔记内部，或者和关联笔记之间，有没有逻辑冲突？
- 用户引用了多个观点，但这些观点其实互相矛盾
- 用户的结论跳步了，中间缺少推导
- 用户把两件不同的事当成了同一件事
问题2：这些笔记是否共享一个底层假设，
但用户把它当成了自然规律，而不是一种选择？
- 多条笔记在讲不同的事，但底层逻辑是同一套
- 用户反复用同一个框架衡量不同的事情
- 这个框架有代价，但用户没有意识到
---
【第二步：执行任务】
如果问题1是yes：
做逻辑解剖
- 指出冲突或跳步在哪
- 不要帮用户和解，让冲突暴露出来
- 不要给结论，让用户自己面对这个张力
如果问题2是yes：
做模式映射
- 给底层假设命名
- 指出这个假设如何影响用户看待事情，或者看待自己
- 指出这个假设的代价，不要评判，只是暴露
如果两个都是yes：
先做逻辑解剖，再做模式映射
顺序不能反
---
【第三步：结尾提问】
最后提一个问题
- 必须是用户自己能回答的
- 需要认真想，不能用是或否回答
- 问题指向用户还没想清楚的那个地方
---
【语气规则】
- 不夸奖用户想得好
- 不给建议，不提供解决方案
- 不总结，不收束
- 直接说，不绕弯
- 可以温和，但不回避尖锐的地方
- 说用户的逻辑，不说用户这个人
  （先分析逻辑，再映射到人；顺序反了用户会感觉被评判）
---
【格式规则】
- 不要分点列清单
- 用自然段落
- 长度控制在300字以内
- 结尾问题单独成段

你会收到：
- 1条当前笔记
- 4条主题相关笔记
- 2条跨域笔记（主题不同但可能有底层关联）
处理顺序：
先读当前笔记，再读相关笔记，最后看跨域笔记
跨域笔记不一定有关联，如果连不上就忽略
如果连得上，优先用它做模式映射`;

// 构建关联笔记上下文（供 handleTabClick / handleSendInput 使用）
function buildNoteContext() {
  const notes = useNoteChatStore.getState().linkedNotes;
  return notes.length > 0
    ? `[关联笔记]\n${notes.map((n) =>
      `笔记标题: ${n.name || "未命名"}\n笔记内容: ${n.userNotes || "无内容"}\n日期: ${n.date}\n标签: ${n.tags.join(", ") || "无"}`
    ).join("\n---\n")}\n---`
    : "";
}

type DiaryChatPanelProps = {
  noteContent: string;
  currentJournalId?: number | null;
  showBackButton?: boolean;
  onClose?: () => void;
  /** 聊天工具改动了某条笔记（传入 noteId）；若正是当前打开的笔记，父组件可据此刷新编辑器 */
  onNoteMutated?: (noteId: number) => void;
};

export function DiaryChatPanel({ noteContent, currentJournalId, showBackButton = false, onClose, onNoteMutated }: DiaryChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const clearLinkedNotes = useNoteChatStore((s) => s.clearLinkedNotes);
  const pendingInsight = useNoteChatStore((s) => s.pendingInsight);
  const clearPendingInsight = useNoteChatStore((s) => s.clearPendingInsight);
  const { locale } = useLocaleStore();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // 历史记录下拉
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);
  const sessionsQuery = useChatSessions({ chatType: "notes", enabled: historyOpen });
  const historyQuery = useChatHistory(viewingSessionId, { enabled: !!viewingSessionId });

  // 加载某个历史会话：替换当前消息，切换 conversationId 以便继续对话
  useEffect(() => {
    if (!viewingSessionId || !historyQuery.data) return;
    const loaded: ChatMessage[] = historyQuery.data.map((item, i) => {
      const msg: ChatMessage = {
        id: `hist-${viewingSessionId}-${i}`,
        role: item.role,
        content: item.content,
      };

      // 对 assistant 消息解析 extraData，还原工具调用步骤和思考过程
      if (item.role === "assistant" && item.extraData) {
        try {
          const data = JSON.parse(item.extraData);

          // 1) 还原思考过程：在正文前插入 [THINK] 标签
          if (data.thinking_content) {
            msg.content = `[THINK]${data.thinking_content}[/THINK]` + msg.content;
          }

          // 2) 还原工具调用步骤
          if (Array.isArray(data.tool_events)) {
            const steps: ToolCallStep[] = [];
            const pending: Array<{ toolName: string; idx: number }> = [];
            let stepIdx = 0;
            for (const ev of data.tool_events) {
              if (ev.type === "tool_call_start" && ev.tool_name) {
                steps.push({
                  id: `hist-tc-${stepIdx}`,
                  toolName: ev.tool_name,
                  toolArgs: ev.tool_args,
                  status: "completed",
                  startTime: Date.now(),
                  endTime: Date.now(),
                });
                pending.push({ toolName: ev.tool_name, idx: stepIdx });
                stepIdx++;
              } else if (ev.type === "tool_call_end" && ev.tool_name) {
                for (let j = pending.length - 1; j >= 0; j--) {
                  if (pending[j].toolName === ev.tool_name) {
                    steps[pending[j].idx] = { ...steps[pending[j].idx], resultPreview: ev.result_preview };
                    pending.splice(j, 1);
                    break;
                  }
                }
              }
            }
            msg.toolCallSteps = steps;
          }

          // [FINAL] 模式：存储的正文 = 最终回复；content 只保留思考块（用于执行过程）
          msg.finalReply = { source: "stored", text: item.content };
          if (!data.thinking_content) {
            msg.content = "";
          } else {
            msg.content = `[THINK]${data.thinking_content}[/THINK]`;
          }
        } catch {
          // extraData 解析失败，回退到原始内容
        }
      }

      return msg;
    });
    setMessages(loaded);
    setConversationId(viewingSessionId);
    setViewingSessionId(null);
    setHistoryOpen(false);
  }, [viewingSessionId, historyQuery.data]);

  // 开始新对话：清空当前会话
  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setHistoryOpen(false);
  };

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  // Auto-resize textarea on input change
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, [inputValue]);

  const doStream = useCallback(async (prompt: string, assistantId: string, systemPrompt?: string, suppressText?: boolean) => {
    setIsStreaming(true);
    setError(null);
    const ac = new AbortController();
    abortRef.current = ac;
    // 本地累计 assistant content 长度，用于给工具调用记录内联渲染锚点
    let assistantContent = "";
    try {
      await sendChatMessageStream(
        {
          message: prompt,
          userInput: prompt,
          conversationId: conversationId ?? undefined,
          mode: "agno",
          chatType: "notes",
          systemPrompt: systemPrompt ?? THINKING_COACH_SYSTEM_PROMPT,
          selectedTools: ["create_note","update_note","delete_note","search_notes","get_note","list_note_tags","list_notes_by_tags","list_notes_by_date","get_insight","suggest_note_tags"],
        },
        (chunk) => {
          assistantContent += chunk;
          if (!suppressText) {
            setMessages((prev) =>
              prev.map((m) => m.id === assistantId ? { ...m, content: m.content + chunk } : m),
            );
          }
        },
        (id) => id && setConversationId(id),
        ac.signal,
        locale,
        (event: ToolCallEvent) => {
          if (event.type === "tool_call_start" && event.tool_name) {
            const insertAt = assistantContent.length;
            setMessages((prev) => prev.map((m) => m.id === assistantId ? {
              ...m,
              toolCallSteps: [...(m.toolCallSteps || []), {
                id: "tc-" + Date.now() + "-" + Math.random().toString(16).slice(2, 6),
                toolName: event.tool_name!,
                toolArgs: event.tool_args,
                status: "running" as const,
                startTime: Date.now(),
                insertAt,
              }],
            } : m));
          } else if (event.type === "tool_call_end" && event.tool_name) {
            setMessages((prev) => prev.map((m) => {
              if (m.id !== assistantId) return m;
              const steps = [...(m.toolCallSteps || [])];
              for (let i = steps.length - 1; i >= 0; i--) {
                if (steps[i].toolName === event.tool_name && steps[i].status === "running") {
                  steps[i] = { ...steps[i], status: "completed", resultPreview: event.result_preview, endTime: Date.now() };
                  break;
                }
              }
              return { ...m, toolCallSteps: steps };
            }));
            const noteMutationTools = ["create_note", "update_note", "delete_note"];
            if (noteMutationTools.includes(event.tool_name)) {
              void queryClient.invalidateQueries({ queryKey: queryKeys.journals.all });
            }
            // 笔记被工具改动：解析 noteId 通知父组件，以便刷新正在打开的编辑器
            if (event.tool_name === "update_note" || event.tool_name === "create_note") {
              const idMatch = /#(\d+)/.exec(event.result_preview ?? "");
              if (idMatch) onNoteMutated?.(Number(idMatch[1]));
            }
          }
        },
        // onFinal：后端注入的权威最终回复（写操作回执 / 终态正文）
        (payload) => {
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, finalReply: payload } : m));
        },
      );
    } catch (err) {
      if (ac.signal.aborted) return;
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId && m.content === ""
          ? { ...m, content: "抱歉，分析过程出现错误，请重试。" } : m),
      );
      setError("请求失败，请检查后端服务是否正常运行");
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      void queryClient.invalidateQueries({ queryKey: queryKeys.journals.all });
    }
  }, [conversationId, locale, queryClient, onNoteMutated]);

  const handleTabClick = useCallback((tab: TabDef) => {
    if (isStreaming) return;
    const uid = createId();
    const aid = createId();
    setMessages((prev) => [
      ...prev,
      { id: uid, role: "user", content: `🧠 ${tab.label}` },
      { id: aid, role: "assistant", content: "" },
    ]);
    const basePrompt = TAB_PROMPTS[tab.key]?.replace("{{notes}}", noteContent || "（暂无笔记内容）")
      ?? "请分析以上笔记内容。";
    const noteCtx = buildNoteContext();
    doStream(noteCtx ? `${noteCtx}\n\n${basePrompt}` : basePrompt, aid);
  }, [noteContent, isStreaming, doStream]);

  // 卡片「添加到对话」直接触发默认洞察：消费 pendingInsight，
  // 以该笔记正文为分析对象，其余关联笔记作为上下文
  const handledInsightRef = useRef<number | null>(null);
  useEffect(() => {
    if (!pendingInsight || isStreaming) return;
    if (handledInsightRef.current === pendingInsight.id) return;
    handledInsightRef.current = pendingInsight.id;
    const note = pendingInsight;
    clearPendingInsight();
    const uid = createId();
    const aid = createId();
    setMessages((prev) => [
      ...prev,
      { id: uid, role: "user", content: `🧠 默认洞察 · ${note.name || note.date}` },
      { id: aid, role: "assistant", content: "" },
    ]);
    const basePrompt = TAB_PROMPTS.insight.replace(
      "{{notes}}",
      `笔记标题: ${note.name || "未命名"}\n笔记内容: ${note.userNotes || "无内容"}\n日期: ${note.date}`,
    );
    const noteCtx = buildNoteContext();
    doStream(noteCtx ? `${noteCtx}\n\n${basePrompt}` : basePrompt, aid);
  }, [pendingInsight, isStreaming, clearPendingInsight, doStream]);

  const handleSendInput = useCallback(async () => {
    if (isStreaming) return;
    const linked = useNoteChatStore.getState().linkedNotes;
    if (!inputValue.trim() && linked.length === 0) return;
    setError(null);
    const text = inputValue.trim();
    setInputValue("");
    const uid = createId();
    const aid = createId();
    // 只带入用户手动添加的关联笔记，不自动附加当前笔记
    // （自由输入任务时不应强制带入当前笔记；Agent 可通过 get_insight/search_notes 工具按需取数）
    const noteCtx = buildNoteContext();
    let attachedNotes: { id: number; name: string; preview: string; date: string }[] | undefined;
    if (linked.length > 0) {
      attachedNotes = linked.map((n) => ({
        id: n.id,
        name: n.name || "未命名",
        preview: (n.userNotes || "").slice(0, 80),
        date: n.date || "",
      }));
    }
    setMessages((prev) => [
      ...prev,
      { id: uid, role: "user", content: text, attachedNotes },
      { id: aid, role: "assistant", content: "" },
    ]);
    const prompt = noteCtx ? `${noteCtx}\n\n${text}` : text;
    doStream(prompt, aid, CREATE_NOTE_SYSTEM_PROMPT);
    clearLinkedNotes();
  }, [inputValue, isStreaming, doStream, clearLinkedNotes]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendInput();
    }
  }, [handleSendInput]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const showWelcome = messages.length === 0 && !isStreaming;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header（移动端由 MobileTopBar 承接返回+标题，隐藏避免双标题） */}
      {!isMobile && (
      <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border/30">
        <div className="flex items-center gap-2">
          {showBackButton && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors mr-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5m7-7-7 7 7 7"/>
              </svg>
            </button>
          )}
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary/60" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground/80">
            AI 洞察
          </span>
          {/* 右侧：生成中指示 + 历史记录 */}
          <div className="ml-auto flex items-center gap-1.5">
            {isStreaming && (
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary/60" />
                </span>
                生成中
              </span>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                title="历史记录"
                className="p-1 text-muted-foreground/70 hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
              >
                <History className="w-4 h-4" />
              </button>
              {historyOpen && (
                <>
                  <button
                    type="button"
                    aria-label="关闭"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setHistoryOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border border-border/40 bg-background shadow-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={startNewConversation}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left text-foreground hover:bg-muted/50 border-b border-border/30"
                    >
                      <Plus className="w-3.5 h-3.5" /> 新对话
                    </button>
                    <div className="max-h-72 overflow-y-auto scrollbar-thin">
                      {sessionsQuery.isLoading ? (
                        <div className="px-3 py-3 text-xs text-muted-foreground/60">加载中…</div>
                      ) : (sessionsQuery.data?.length ?? 0) === 0 ? (
                        <div className="px-3 py-3 text-xs text-muted-foreground/60">暂无历史会话</div>
                      ) : (
                        (sessionsQuery.data ?? []).map((s) => (
                          <button
                            key={s.sessionId}
                            type="button"
                            onClick={() => setViewingSessionId(s.sessionId)}
                            className={`flex flex-col w-full px-3 py-2 text-left hover:bg-muted/50 border-b border-border/20 last:border-0 ${s.sessionId === conversationId ? "bg-muted/40" : ""}`}
                          >
                            <span className="text-xs text-foreground truncate">{s.title || "未命名会话"}</span>
                            <span className="text-[10px] text-muted-foreground/60">
                              {s.lastActive ? new Date(s.lastActive).toLocaleString() : ""}
                              {s.messageCount ? ` · ${s.messageCount} 条` : ""}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            {!showBackButton && onClose && (
              <button
                type="button"
                onClick={onClose}
                title="关闭"
                className="ml-1 p-1 text-muted-foreground/70 hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"/>
                  <path d="m6 6 12 12"/>
                </svg>
              </button>
            )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Messages area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {showWelcome ? (
          <EmptyState onTabSelect={handleTabClick} />
        ) : (
          <div ref={listRef} className="h-full overflow-y-auto space-y-3 px-3 py-3 scrollbar-thin">
            <AnimatePresence mode="popLayout">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} isStreaming={isStreaming} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 rounded-lg bg-destructive/5 border border-destructive/15 px-3 py-2">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive/50 flex-shrink-0" />
                <p className="text-[11px] text-destructive/70 leading-relaxed">{error}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom: input */}
      <div className="flex-shrink-0 border-t border-border/30 bg-muted/10">
        <div className="px-3 pb-3 pt-3">
          <LinkedNotes locale="zh" />
          <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-background px-3.5 py-2.5 transition-all duration-200 focus-within:border-primary/30 focus-within:shadow-[0_0_0_1px_rgba(var(--primary)/0.08)]">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入自定义问题..."
              disabled={isStreaming}
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus-visible:outline-none disabled:opacity-40 resize-none overflow-y-auto"
            />
            <VoiceInputButton
              ownerId="diary-chat"
              onTranscript={(text) => setInputValue((prev) => (prev ? prev + " " + text : text))}
            />
            {isStreaming ? (
              <button type="button" onClick={handleStop} title="停止"
                className="flex items-center justify-center rounded-lg bg-muted/50 p-1.5 text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors">
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button type="button" onClick={handleSendInput} disabled={isStreaming || (!inputValue.trim() && !currentJournalId && useNoteChatStore.getState().linkedNotes.length === 0)} title="发送"
                className="flex items-center justify-center w-7 h-7 rounded-full bg-foreground text-background hover:opacity-80 transition-opacity disabled:opacity-25 disabled:cursor-not-allowed">
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}