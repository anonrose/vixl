import loadPrompt from '@/services/prompts/load-prompt'

export default (): string => loadPrompt('system/tool-guidance.md')
