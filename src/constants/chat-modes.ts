import {
  BotIcon,
  CircleHelpIcon,
  ListTodoIcon,
  NetworkIcon,
} from '@lucide/vue'
import type { Component } from 'vue'
import type { VixlChatMode } from '@/types/vixl/vixl-settings'

export type ChatModeMeta = {
  value: VixlChatMode
  label: string
  icon: Component
}

export const CHAT_MODES: ChatModeMeta[] = [
  { value: 'agent', label: 'Agent', icon: BotIcon },
  { value: 'ask', label: 'Ask', icon: CircleHelpIcon },
  { value: 'orchestrator', label: 'Orchestrator', icon: NetworkIcon },
  { value: 'plan', label: 'Plan', icon: ListTodoIcon },
]

const DEFAULT_CHAT_MODE = CHAT_MODES.find((entry) => entry.value === 'agent')!

export const getChatModeMeta = (mode: VixlChatMode): ChatModeMeta =>
  CHAT_MODES.find((entry) => entry.value === mode) ?? DEFAULT_CHAT_MODE
