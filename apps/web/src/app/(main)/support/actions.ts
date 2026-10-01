'use server';

import { revalidatePath } from 'next/cache';
import { getServerToken, getServerUser } from '@/app/actions/auth';

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

export async function fetchSupportTickets(): Promise<SupportTicketSummary[]> {
  const user = await getServerUser();

  if (!user) {
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
  const user = await getServerUser();

  if (!user) {
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
  const userId = (user as unknown as Record<string, unknown>).id as string | number | null;

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

  revalidatePath('/support');
  revalidatePath(`/support/${ticketId}`);

  return {
    id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    plainText: message,
    senderName: 'You',
    senderRole: 'customer',
    senderId: undefined,
    isMine: true,
    createdAt: new Date().toISOString(),
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
