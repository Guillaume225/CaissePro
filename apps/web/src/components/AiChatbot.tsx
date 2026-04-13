import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Send,
  Bot,
  User,
  Loader2,
  ArrowRight,
  Sparkles,
  Cpu,
  MessageCircle,
  Trash2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useSendChatMessage, useSendConversationalMessage } from '@/hooks/useDashboard';
import { useModuleStore, type ModuleId } from '@/stores/module-store';
import { useAuthStore } from '@/stores/auth-store';
import { formatCFA } from '@/lib/format';
import type { ChatMessage, ChatChartData, ChatSuggestedAction } from '@/types/dashboard';

const PIE_COLORS = ['#D4A843', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const TOOLTIP_STYLE = { borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: 12 };

type TabId = 'agent' | 'chatbot';

const MODULE_LABELS: Record<ModuleId, string> = {
  expense: 'Caisse Dépenses',
  fne: 'FNE',
  admin: 'Administration',
  decision: 'Décisionnaire',
  'manager-caisse': 'Manager Caisse',
};

const MODULE_SUGGESTIONS: Record<ModuleId, Array<{ key: string; label: string }>> = {
  expense: [
    { key: 'kpis', label: 'Quels sont les KPIs de dépenses ?' },
    { key: 'pending', label: 'Demandes en attente ?' },
    { key: 'create', label: 'Comment créer une dépense ?' },
  ],
  fne: [
    { key: 'kpis', label: 'Résumé FNE du mois ?' },
    { key: 'stickers', label: 'Solde de vignettes ?' },
    { key: 'create', label: 'Comment créer une facture ?' },
  ],
  admin: [
    { key: 'users', label: 'Utilisateurs actifs ?' },
    { key: 'audit', label: 'Dernières actions ?' },
    { key: 'roles', label: 'Rôles définis ?' },
  ],
  decision: [
    { key: 'pending', label: 'Dépenses en attente ?' },
    { key: 'kpis', label: 'Indicateurs clés ?' },
    { key: 'trend', label: 'Tendance des dépenses ?' },
  ],
  'manager-caisse': [
    { key: 'state', label: 'État de la caisse ?' },
    { key: 'history', label: 'Clôtures récentes ?' },
    { key: 'entries', label: 'Écritures en attente ?' },
  ],
};

const CHATBOT_SUGGESTIONS = [
  { key: 'hello', label: 'Bonjour !' },
  { key: 'about', label: "C'est quoi CaisseFlow ?" },
  { key: 'help', label: 'Que peux-tu faire ?' },
];

const MAX_CHATBOT_QUESTIONS = 10;

export function AiChatbot({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabId>('agent');

  // Separate message state per tab
  const [agentMessages, setAgentMessages] = useState<ChatMessage[]>([]);
  const [chatbotMessages, setChatbotMessages] = useState<ChatMessage[]>([]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const agentMutation = useSendChatMessage();
  const chatbotMutation = useSendConversationalMessage();

  const activeModule = useModuleStore((s) => s.activeModule);
  const user = useAuthStore((s) => s.user);

  const messages = activeTab === 'agent' ? agentMessages : chatbotMessages;
  const setMessages = activeTab === 'agent' ? setAgentMessages : setChatbotMessages;

  // Count user questions in chatbot tab
  const chatbotQuestionCount = chatbotMessages.filter((m) => m.role === 'user').length;
  const chatbotLimitReached = chatbotQuestionCount >= MAX_CHATBOT_QUESTIONS;

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [agentMessages, chatbotMessages, isTyping, activeTab]);

  // Focus input when panel opens or tab changes
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open, activeTab]);

  // Clear agent chat when module changes
  useEffect(() => {
    setAgentMessages([]);
  }, [activeModule]);

  const handleSend = useCallback((text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isTyping) return;

    // Block chatbot tab if limit reached
    if (activeTab === 'chatbot' && chatbotLimitReached) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const conversationHistory = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const onError = () => {
      setMessages((prev) => [...prev, {
        id: `e-${Date.now()}`,
        role: 'assistant' as const,
        content: t('common.error'),
        timestamp: new Date().toISOString(),
      }]);
      setIsTyping(false);
    };

    if (activeTab === 'agent') {
      agentMutation.mutate(
        {
          message: content,
          module: activeModule,
          conversationHistory,
          userRole: user?.role ?? 'viewer',
          allowedModules: user?.allowedModules ?? [activeModule],
        },
        {
          onSuccess: (data: ChatMessage) => {
            setAgentMessages((prev) => [...prev, data]);
            setIsTyping(false);
          },
          onError,
        },
      );
    } else {
      chatbotMutation.mutate(
        {
          message: content,
          conversationHistory,
        },
        {
          onSuccess: (data: ChatMessage) => {
            setChatbotMessages((prev) => [...prev, data]);
            setIsTyping(false);
          },
          onError,
        },
      );
    }
  }, [input, isTyping, messages, activeTab, activeModule, user, agentMutation, chatbotMutation, setMessages, t, chatbotLimitReached]);

  const handleAction = (action: ChatSuggestedAction) => {
    if (action.action_type === 'navigate') {
      navigate(action.payload);
      onClose();
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  if (!open) return null;

  const quickSuggestions = activeTab === 'agent'
    ? (MODULE_SUGGESTIONS[activeModule] ?? MODULE_SUGGESTIONS.expense)
    : CHATBOT_SUGGESTIONS;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex h-[620px] w-[440px] flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl">
      {/* ── Header ─────────────────────── */}
      <div className="flex h-14 shrink-0 items-center justify-between rounded-t-2xl bg-sidebar px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gold/20">
            <Sparkles className="h-4 w-4 text-brand-gold" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">{t('ai.assistant')}</span>
            <span className="text-[10px] text-sidebar-foreground/60">
              {activeTab === 'agent' ? MODULE_LABELS[activeModule] : 'Chatbot'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleClear}
            title="Effacer la conversation"
            className="rounded-lg p-1.5 text-sidebar-foreground/40 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="rounded-lg p-1.5 text-sidebar-foreground/40 hover:bg-white/10 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Tab Switcher ───────────────── */}
      <div className="flex shrink-0 border-b border-gray-100">
        <button
          onClick={() => setActiveTab('agent')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
            activeTab === 'agent'
              ? 'border-b-2 border-brand-gold text-brand-gold'
              : 'text-gray-400 hover:text-gray-600',
          )}
        >
          <Cpu className="h-3.5 w-3.5" />
          Agent IA
        </button>
        <button
          onClick={() => setActiveTab('chatbot')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
            activeTab === 'chatbot'
              ? 'border-b-2 border-brand-gold text-brand-gold'
              : 'text-gray-400 hover:text-gray-600',
          )}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Chatbot
          {chatbotQuestionCount > 0 && (
            <span className={cn(
              'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
              chatbotLimitReached
                ? 'bg-red-100 text-red-600'
                : 'bg-blue-100 text-blue-600',
            )}>
              {chatbotQuestionCount}/{MAX_CHATBOT_QUESTIONS}
            </span>
          )}
        </button>
      </div>

      {/* ── Messages ───────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !isTyping && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            {activeTab === 'agent' ? (
              <>
                <Cpu className="h-10 w-10 text-gray-200 mb-3" />
                <p className="text-sm font-medium text-gray-400">Agent IA</p>
                <p className="mt-1 text-xs text-gray-300">
                  Module : {MODULE_LABELS[activeModule]}
                </p>
                <p className="mt-2 max-w-[260px] text-[11px] text-gray-300">
                  Posez des questions sur votre module, exécutez des actions et naviguez dans l'application.
                </p>
              </>
            ) : (
              <>
                <MessageCircle className="h-10 w-10 text-gray-200 mb-3" />
                <p className="text-sm font-medium text-gray-400">Chatbot Conversationnel</p>
                <p className="mt-2 max-w-[260px] text-[11px] text-gray-300">
                  Discutez librement comme avec ChatGPT. Posez n'importe quelle question !
                </p>
              </>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'relative max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
              msg.role === 'user'
                ? 'bg-brand-gold text-white rounded-br-md'
                : activeTab === 'agent'
                  ? 'bg-gray-100 text-gray-800 rounded-bl-md'
                  : 'bg-blue-50 text-gray-800 rounded-bl-md',
            )}>
              {/* Avatar */}
              <span className={cn(
                'absolute -top-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
                msg.role === 'user'
                  ? '-right-2 bg-brand-gold/20 text-brand-gold'
                  : activeTab === 'agent'
                    ? '-left-2 bg-gray-200 text-gray-500'
                    : '-left-2 bg-blue-100 text-blue-500',
              )}>
                {msg.role === 'user'
                  ? <User className="h-3 w-3" />
                  : activeTab === 'agent'
                    ? <Cpu className="h-3 w-3" />
                    : <Bot className="h-3 w-3" />
                }
              </span>

              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

              {/* Inline chart (agent only) */}
              {msg.chartData && (
                <div className="mt-2 rounded-lg bg-white p-2 border border-gray-100">
                  <MiniChart chartData={msg.chartData} />
                </div>
              )}

              {/* Suggested actions (agent only) */}
              {activeTab === 'agent' && msg.suggested_actions && msg.suggested_actions.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {msg.suggested_actions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => handleAction(action)}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:border-brand-gold hover:text-brand-gold text-left"
                    >
                      <ArrowRight className="h-3 w-3 shrink-0" />
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className={cn(
              'flex items-center gap-1.5 rounded-2xl rounded-bl-md px-4 py-3',
              activeTab === 'agent' ? 'bg-gray-100' : 'bg-blue-50',
            )}>
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Quick suggestions ──────────── */}
      {messages.length === 0 && (
        <div className="flex gap-2 px-4 pb-2 flex-wrap">
          {quickSuggestions.map((s) => (
            <button
              key={s.key}
              onClick={() => handleSend(s.label)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs transition-colors',
                activeTab === 'agent'
                  ? 'border-gray-200 bg-white text-gray-600 hover:border-brand-gold hover:text-brand-gold'
                  : 'border-blue-200 bg-blue-50 text-blue-600 hover:border-blue-400 hover:text-blue-700',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Input bar ──────────────────── */}      {activeTab === 'chatbot' && chatbotLimitReached ? (
        <div className="shrink-0 border-t border-gray-100 px-3 py-3">
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-center">
            <p className="text-xs font-medium text-amber-700">
              Limite de {MAX_CHATBOT_QUESTIONS} questions atteinte
            </p>
            <p className="mt-1 text-[11px] text-amber-600">
              Utilisez l'<strong>Agent IA</strong> pour vos questions métier ou effacez la conversation
            </p>
          </div>
        </div>
      ) : (      <div className="shrink-0 border-t border-gray-100 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={activeTab === 'agent' ? t('chatbot.placeholder') : 'Discutez librement...'}
            disabled={isTyping}
            className={cn(
              'flex-1 rounded-xl border bg-gray-50 px-3.5 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 disabled:opacity-50',
              activeTab === 'agent'
                ? 'border-gray-200 focus:border-brand-gold focus:ring-brand-gold'
                : 'border-blue-200 focus:border-blue-400 focus:ring-blue-400',
            )}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-colors disabled:opacity-40',
              activeTab === 'agent'
                ? 'bg-brand-gold hover:bg-brand-gold-dark'
                : 'bg-blue-500 hover:bg-blue-600',
            )}
          >
            {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

// ── Inline mini-chart renderer ──────────────────
function MiniChart({ chartData }: { chartData: ChatChartData }) {
  const { type, data, dataKey } = chartData;

  return (
      <ResponsiveContainer width="100%" height={128}>
        {type === 'bar' ? (
          <BarChart data={data}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis hide />
            <Tooltip formatter={(v) => formatCFA(Number(v))} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey={dataKey} fill="#D4A843" radius={[3, 3, 0, 0]} />
          </BarChart>
        ) : type === 'line' ? (
          <LineChart data={data}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis hide />
            <Tooltip formatter={(v) => formatCFA(Number(v))} contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey={dataKey} stroke="#3B82F6" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        ) : (
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={25} outerRadius={45} paddingAngle={2} dataKey={dataKey}>
              {data.map((_: unknown, i: number) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => formatCFA(Number(v))} contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        )}
      </ResponsiveContainer>
  );
}
