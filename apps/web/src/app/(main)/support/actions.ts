'use server';

import { revalidatePath } from 'next/cache';
import { getServerToken, getServerUser, getServerUserId } from '@/app/actions/auth';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '');

export type SupportTicketStatus = 'open' | 'in_progress' | 'waiting_for_user' | 'resolved' | 'closed';
export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface SupportTicketSummary {
  id: string;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  category: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
}

export interface SupportTicketMessageView {
  id: string;
  plainText: string;
  senderName: string;
  senderRole?: string;
  senderId?: string;
  isMine: boolean;
  createdAt: string;
}

export interface SupportThreadData {
  ticket: SupportTicketSummary;
  messages: SupportTicketMessageView[];
}

interface CreateSupportTicketInput {
  subject: string;
  category: string;
  priority: SupportTicketPriority;
  message: string;
  orderId?: string | number | null;
  merchantId?: string | number | null;
  productId?: string | number | null;
}

async function getSupportAuthHeaders() {
  const token = await getServerToken();

  if (!token) {
    throw new Error('Unauthorized');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `JWT ${token}`,
  };
}

function normalizeTicket(ticket: unknown): SupportTicketSummary {
  const t = ticket as Record<string, unknown>;
  return {
    id: String(t.id),
    subject: String(t.subject ?? ''),
    status: t.status as SupportTicketStatus,
    priority: t.priority as SupportTicketPriority,
    category: String(t.category ?? ''),
    createdAt: String(t.createdAt ?? ''),
    updatedAt: String(t.updatedAt ?? ''),
    lastMessageAt: (t.lastMessageAt as string | null) ?? null,
  };
}

function normalizeMessage(message: unknown, currentUserId: string | number | null): SupportTicketMessageView {
  const m = message as Record<string, unknown>;
  const senderId = m.senderId != null ? String(m.senderId) : undefined;
  return {
    id: String(m.id ?? ''),
    plainText: String(m.plainText ?? ''),
    senderName: String(m.senderName ?? 'Support'),
    senderRole: m.senderRole != null ? String(m.senderRole) : undefined,
    senderId,
    isMine: senderId != null && currentUserId != null && senderId === String(currentUserId),
    createdAt: String(m.createdAt ?? ''),
  };
}

async function resolveSenderRole(): Promise<'member' | 'customer'> {
  try {
    const sessionUser = await getServerUser();
    const role = (sessionUser as { role?: unknown } | null)?.role;
    if (role === 'member') return 'member';
    if (role === 'customer') return 'customer';
  } catch {
    /* fall through to JWT lookup below */
  }
  // getServerUser() narrows to customer-only; members resolve to null there,
  // so fall back to a direct depth-0 /users/me read (same as getServerUserId)
  // to recover the true role without touching auth-core helpers.
  try {
    const token = await getServerToken();
    if (!token) return 'customer';
    const res = await fetch(
      `${API_BASE_URL}/users/me?depth=0`,
      { headers: { Authorization: `JWT ${token}` }, cache: 'no-store' },
    );
    if (!res.ok) return 'customer';
    const data = await res.json().catch(() => ({}));
    const role = (data as any)?.user?.role;
    if (role === 'member') return 'member';
  } catch {
    /* default below */
  }
  return 'customer';
}

function extractLexicalText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractLexicalText).join('');
  if (typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (typeof record.text === 'string') return record.text;
    if (record.root) return extractLexicalText(record.root);
    if (record.children) return extractLexicalText(record.children);
  }
  return '';
}

export async function fetchSupportTickets(): Promise<SupportTicketSummary[]> {
  // Depth-0 id check (§4b: the old getServerUser hydrated depth:2 for a
  // null-check that only needs an id).
  const userId = await getServerUserId();

  if (!userId) {
    return [];
  }

  const headers = await getSupportAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/support/tickets?limit=50`, {
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to fetch support tickets: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  const docs = data?.data?.docs;
  return Array.isArray(docs) ? docs.map(normalizeTicket) : [];
}

export async function createSupportTicket(input: CreateSupportTicketInput): Promise<SupportTicketSummary> {
  const headers = await getSupportAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/support/tickets`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to create support ticket: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  const createdTicket = data?.data?.ticket ?? data?.doc ?? data;

  revalidatePath('/support');

  return normalizeTicket(createdTicket);
}

export async function fetchSupportThread(ticketId: string): Promise<SupportThreadData | null> {
  const userId = await getServerUserId();

  if (!userId) {
    return null;
  }

  const headers = await getSupportAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/support/tickets/thread?ticketId=${encodeURIComponent(ticketId)}`, {
    headers,
    cache: 'no-store',
  });

  if (res.status === 404 || res.status === 403) {
    return null;
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to fetch support thread: ${res.status} ${errorText}`);
  }

  const data = await res.json();

  return {
    ticket: normalizeTicket(data?.data?.ticket),
    messages: Array.isArray(data?.data?.messages)
      ? (data.data.messages as unknown[]).map((m) => normalizeMessage(m, userId))
      : [],
  };
}

export async function replyToSupportTicket(ticketId: string, message: string): Promise<SupportTicketMessageView> {
  const headers = await getSupportAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/support/tickets/reply`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ticketId, message }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to send support reply: ${res.status} ${errorText}`);
  }

  const data = await res.json().catch(() => ({}));
  const raw = (data?.data?.message ?? {}) as Record<string, unknown>;
  // Real server doc (no temp-* fabrication): the sender is always the JWT
  // requester, so isMine is true by construction. plainText is extracted
  // from the Lexical payload with the same walk the CMS thread uses.
  // Falls back to the submitted text if the shape ever changes.
  const senderRaw = raw.sender as Record<string, unknown> | string | number | undefined;
  const senderId =
    senderRaw != null && typeof senderRaw === 'object' && 'id' in senderRaw
      ? String((senderRaw as Record<string, unknown>).id)
      : senderRaw != null && (typeof senderRaw === 'string' || typeof senderRaw === 'number')
        ? String(senderRaw)
        : undefined;

  revalidatePath('/support');
  revalidatePath(`/support/${ticketId}`);

  const senderRole = await resolveSenderRole();

  return {
    id: String(raw.id ?? `temp-${Date.now()}`),
    plainText: extractLexicalText(raw.message) || message,
    senderName: 'You',
    senderRole,
    senderId,
    isMine: true,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

export async function updateSupportTicketStatus(ticketId: string, status: SupportTicketStatus): Promise<SupportTicketSummary> {
  const headers = await getSupportAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/support/tickets/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ ticketId, status }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to update support ticket: ${res.status} ${errorText}`);
  }

  const data = await res.json();

  revalidatePath('/support');
  revalidatePath(`/support/${ticketId}`);

  return normalizeTicket(data?.data?.ticket);
}
