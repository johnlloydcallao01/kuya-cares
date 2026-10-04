'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useUser } from '@/hooks/useAuth';
import type { SupportThreadData } from '../actions';
import { fetchSupportThread, replyToSupportTicket, updateSupportTicketStatus } from '../actions';

// Hoisted (§4b item 1): one shared formatter instead of a locale parse per
// message row per render.
const threadDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(dateString: string) {
  if (!dateString) return 'N/A';
  try {
    return threadDateFormatter.format(new Date(dateString));
  } catch {
    return 'N/A';
  }
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').toUpperCase();
}

function getStatusColor(status: string) {
  switch (status) {
    case 'open': return 'bg-blue-100 text-blue-800';
    case 'in_progress': return 'bg-yellow-100 text-yellow-800';
    case 'waiting_for_user': return 'bg-purple-100 text-purple-800';
    case 'resolved': return 'bg-green-100 text-green-800';
    case 'closed': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'critical': return 'text-red-600 font-bold';
    case 'high': return 'text-orange-600 font-medium';
    case 'medium': return 'text-blue-600';
    case 'low': return 'text-gray-500';
    default: return 'text-gray-500';
  }
}

const isTerminal = (status: string) => status === 'resolved' || status === 'closed';

export default function TicketDetailPageClient({ initialThread }: { initialThread: SupportThreadData }) {
  const router = useRouter();
  const [thread, setThread] = useState(initialThread);
  const [replyMessage, setReplyMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { ticket, messages } = thread;

  // ── Realtime thread sync ─────────────────────────────────────────────
  // Ticket replies already fan out over the bell channel
  // (`notifications:user:{id}`, event `new_notification` with
  // `typeKey: support.ticket_*` + `metadata.ticketId`). Listening here makes
  // messages created in the CMS admin (or elsewhere) appear live.
  const { user } = useUser();
  const userId = user?.id ?? null;
  const [isLive, setIsLive] = useState(false);
  // Coalesced refetch: broadcast + focus + visibility can fire together on
  // rapid admin replies — one shared promise + 5s throttle instead of N
  // parallel thread fetches.
  const inflightRef = useRef<Promise<unknown> | null>(null);
  const lastRefetchRef = useRef(0);

  const refetchThread = React.useCallback(() => {
    const now = Date.now();
    if (now - lastRefetchRef.current < 5000) return;
    lastRefetchRef.current = now;
    if (inflightRef.current) return;
    const p = fetchSupportThread(String(ticket.id))
      .then((fresh) => {
        if (fresh) setThread(fresh);
      })
      .catch(() => {})
      .finally(() => {
        if (inflightRef.current === p) inflightRef.current = null;
      });
    inflightRef.current = p;
  }, [ticket.id]);

  useEffect(() => {
    if (!userId || !ticket.id) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!url || !anonKey) return;

    let cancelled = false;
    const supabase = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const channel = supabase
      .channel(`notifications:user:${userId}`, { config: { broadcast: { self: true } } })
      .on('broadcast', { event: 'new_notification' }, ({ payload }: { payload?: unknown }) => {
        const notification = (payload as Record<string, unknown> | undefined)?.notification as
          | Record<string, unknown>
          | undefined;
        const typeKey = typeof notification?.typeKey === 'string' ? notification.typeKey : '';
        const metadata = (notification?.metadata ?? {}) as Record<string, unknown>;
        if (!typeKey.startsWith('support.ticket')) return;
        if (String(metadata.ticketId ?? '') !== String(ticket.id)) return;
        refetchThread();
      })
      .subscribe((status: string) => {
        if (!cancelled) setIsLive(status === 'SUBSCRIBED');
      });

    // One listener (visibility covers focus in practice): the old
    // visibilitychange + focus pair fired twice per tab switch.
    const refetchOnVisible = () => {
      if (document.visibilityState === 'visible') {
        refetchThread();
      }
    };
    document.addEventListener('visibilitychange', refetchOnVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', refetchOnVisible);
      try {
        supabase.removeChannel(channel);
      } catch {}
      setIsLive(false);
    };
  }, [userId, ticket.id, refetchThread]);

  // Synchronous send guard: isSending state lags a render, so double-Enter
  // before the first await double-posted (CMS creates unconditionally).
  const sendingRef = useRef(false);
  const statusRef = useRef(false);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();

    const text = replyMessage.trim();
    if (!text || sendingRef.current) {
      return;
    }
    sendingRef.current = true;

    setIsSending(true);
    setErrorMessage('');

    try {
      // Real server message (no temp-*): appended with its authoritative id
      // and timestamp, so later live refetches can never duplicate it.
      const confirmed = await replyToSupportTicket(ticket.id, text);
      setThread((current) => ({
        ...current,
        messages: [...current.messages, confirmed],
      }));
      // Clear the draft only on success — failures keep the text for retry.
      setReplyMessage('');
      router.refresh();
    } catch (error: unknown) {
      console.error('Error sending message', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send message.');
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  const handleStatusChange = async (status: 'open' | 'closed') => {
    if (statusRef.current) return;
    statusRef.current = true;
    setIsUpdatingStatus(true);
    setErrorMessage('');

    try {
      const updated = await updateSupportTicketStatus(ticket.id, status);
      setThread((current) => ({ ...current, ticket: updated }));
      router.refresh();
    } catch (error: unknown) {
      console.error('Error updating ticket status', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update ticket.');
    } finally {
      statusRef.current = false;
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="w-full px-[10px]">
          <div className="py-6 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Support Center</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your support tickets and inquiries
              </p>
            </div>
            <Link
              href="/support"
              className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Back to Tickets
            </Link>
          </div>
        </div>
      </div>

      <div className="w-full px-[10px] py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  Conversation
                  {isLive && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Live
                    </span>
                  )}
                </h2>
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                  {formatStatus(ticket.status)}
                </span>
              </div>

              <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500">No messages yet.</div>
                ) : messages.map((message) => (
                  <div key={message.id} className={`flex flex-col ${message.isMine ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center space-x-2 mb-1 ${message.isMine ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <span className="text-sm font-medium text-gray-900">{message.senderName}</span>
                      <span className="text-xs text-gray-500">{formatDate(message.createdAt)}</span>
                    </div>
                    <div className={`rounded-lg p-4 max-w-[85%] ${message.isMine
                      ? 'text-white rounded-tr-none'
                      : 'bg-gray-100 text-gray-800 rounded-tl-none'
                      }`}
                      style={message.isMine ? { backgroundColor: '#239459' } : undefined}
                    >
                      <div className="whitespace-pre-wrap text-sm">
                        {message.plainText}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {!isTerminal(ticket.status) ? (
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <form onSubmit={handleSendReply}>
                    <div className="flex gap-4">
                      <textarea
                        required
                        rows={2}
                        className="flex-1 rounded-lg bg-white text-gray-900 border border-gray-300 p-3 placeholder-gray-500 resize-none"
                        placeholder="Type your reply here..."
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                      />
                      <button
                        type="submit"
                        disabled={isSending || !replyMessage.trim()}
                        className="px-4 py-2 text-white rounded-lg disabled:opacity-50 self-end h-full"
                        style={{ backgroundColor: '#239459' }}
                      >
                        {isSending ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                    {errorMessage ? (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {errorMessage}
                      </div>
                    ) : null}
                  </form>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 border-t border-gray-200 text-center text-gray-500">
                  This ticket is {ticket.status}. Please create a new ticket if you need further assistance.
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ticket Details</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Subject</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{ticket.subject}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Ticket ID</label>
                  <p className="text-sm font-mono text-gray-600 mt-1">#{String(ticket.id).slice(0, 8)}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Category</label>
                  <p className="text-sm text-gray-900 mt-1 capitalize">{ticket.category.replace(/_/g, ' ')}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Priority</label>
                  <p className={`text-sm font-medium mt-1 ${getPriorityColor(ticket.priority)} capitalize`}>
                    {ticket.priority}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Created</label>
                  <p className="text-sm text-gray-900 mt-1">{formatDate(ticket.createdAt)}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Last Activity</label>
                  <p className="text-sm text-gray-900 mt-1">
                    {ticket.lastMessageAt ? formatDate(ticket.lastMessageAt) : 'N/A'}
                  </p>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  {isTerminal(ticket.status) ? (
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => handleStatusChange('open')}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {isUpdatingStatus ? 'Reopening...' : 'Reopen ticket'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => handleStatusChange('closed')}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {isUpdatingStatus ? 'Closing...' : 'Close ticket'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
