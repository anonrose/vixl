import type { PermissionScope } from '@/types/harness/permission'
import type { PermissionGateContext } from '@/services/harness/permission/gate'
import { requestApproval } from '@/services/harness/permission/approval-gate'

const WORKSPACE_MOVE_SCOPES: PermissionScope[] = ['once']

const gateWorkspaceMovePermission = async (args: {
  ctx: PermissionGateContext
  toolCallId: string
  name: string
  title: string
  detail?: string
}): Promise<boolean> => {
  const allowedScopes: PermissionScope[] = [...WORKSPACE_MOVE_SCOPES]

  args.ctx.onPendingApproval({
    toolCallId: args.toolCallId,
    name: args.name,
    kind: 'workspace',
    title: args.title,
    detail: args.detail,
    allowedScopes,
    subagentId: args.ctx.subagentId,
    subagentLabel: args.ctx.subagentLabel,
  })

  const result = await requestApproval({
    chatId: args.ctx.chatId,
    toolCallId: args.toolCallId,
    name: args.name,
    kind: 'workspace',
    action: 'workspace.move',
    capability: 'workspace.move',
    title: args.title,
    detail: args.detail,
    allowedScopes,
    subagentId: args.ctx.subagentId,
    subagentLabel: args.ctx.subagentLabel,
  })

  return result.approved
}

export default gateWorkspaceMovePermission
