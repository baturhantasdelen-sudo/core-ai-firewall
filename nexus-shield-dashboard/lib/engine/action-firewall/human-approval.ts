export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ActionApprovalDetails {
  toolName: string;
  userIntent: string;
  riskScore: number;
  violations?: string[];
  mcpServerId?: string;
  trajectoryReason?: string;
  args?: Record<string, unknown>;
}

export interface ApprovalRequest {
  id: string;
  agentId: string;
  actionDetails: ActionApprovalDetails;
  status: ApprovalStatus;
  createdAt: string;
  expiresAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface DashboardNotification {
  id: string;
  type: 'HUMAN_APPROVAL_REQUIRED';
  approvalRequestId: string;
  agentId: string;
  message: string;
  createdAt: string;
  read: boolean;
}

const approvalStore = new Map<string, ApprovalRequest>();
const notificationQueue: DashboardNotification[] = [];

const DEFAULT_APPROVAL_TTL_MS = 15 * 60 * 1000;

function generateApprovalId(): string {
  return `apr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function generateNotificationId(): string {
  return `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createApprovalRequest(
  agentId: string,
  actionDetails: ActionApprovalDetails,
  ttlMs = DEFAULT_APPROVAL_TTL_MS,
): ApprovalRequest {
  const now = Date.now();
  const request: ApprovalRequest = {
    id: generateApprovalId(),
    agentId,
    actionDetails,
    status: 'pending',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
  };

  approvalStore.set(request.id, request);

  notificationQueue.unshift({
    id: generateNotificationId(),
    type: 'HUMAN_APPROVAL_REQUIRED',
    approvalRequestId: request.id,
    agentId,
    message: `Critical action pending approval: ${actionDetails.toolName} (risk ${actionDetails.riskScore})`,
    createdAt: request.createdAt,
    read: false,
  });

  return request;
}

export function getApprovalRequest(requestId: string): ApprovalRequest | undefined {
  const request = approvalStore.get(requestId);
  if (!request) return undefined;

  if (request.status === 'pending' && Date.now() > new Date(request.expiresAt).getTime()) {
    request.status = 'expired';
  }

  return request;
}

export function listPendingApprovals(agentId?: string): ApprovalRequest[] {
  const pending: ApprovalRequest[] = [];
  for (const request of approvalStore.values()) {
    if (request.status !== 'pending') continue;
    if (Date.now() > new Date(request.expiresAt).getTime()) {
      request.status = 'expired';
      continue;
    }
    if (agentId && request.agentId !== agentId) continue;
    pending.push(request);
  }
  return pending.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function approveRequest(
  requestId: string,
  resolvedBy = 'dashboard-operator',
  note?: string,
): ApprovalRequest | null {
  const request = getApprovalRequest(requestId);
  if (!request || request.status !== 'pending') return null;

  request.status = 'approved';
  request.resolvedAt = new Date().toISOString();
  request.resolvedBy = resolvedBy;
  request.resolutionNote = note ?? 'Approved via dashboard';
  return request;
}

export function rejectRequest(
  requestId: string,
  resolvedBy = 'dashboard-operator',
  note?: string,
): ApprovalRequest | null {
  const request = getApprovalRequest(requestId);
  if (!request || request.status !== 'pending') return null;

  request.status = 'rejected';
  request.resolvedAt = new Date().toISOString();
  request.resolvedBy = resolvedBy;
  request.resolutionNote = note ?? 'Rejected via dashboard';
  return request;
}

export function getDashboardNotifications(unreadOnly = false): DashboardNotification[] {
  if (unreadOnly) return notificationQueue.filter((notification) => !notification.read);
  return [...notificationQueue];
}

export function markNotificationRead(notificationId: string): boolean {
  const notification = notificationQueue.find((entry) => entry.id === notificationId);
  if (!notification) return false;
  notification.read = true;
  return true;
}

export function resetHumanApprovalStore(): void {
  approvalStore.clear();
  notificationQueue.length = 0;
}

/** Test helper — force approval expiry */
export function __testExpireApproval(requestId: string): void {
  const request = approvalStore.get(requestId);
  if (!request) return;
  request.expiresAt = new Date(Date.now() - 1000).toISOString();
}
