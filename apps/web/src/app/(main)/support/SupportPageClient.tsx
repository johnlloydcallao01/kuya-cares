'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SupportTicketSummary } from './actions';
import { createSupportTicket } from './actions';

export const SUPPORT_CATEGORIES = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'order_issue', label: 'Order Issue' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'payment_refund', label: 'Payment & Refund' },
  { value: 'product', label: 'Product' },
  { value: 'account', label: 'Account' },
  { value: 'technical', label: 'Technical Issue' },
];

function formatDate(dateString: string) {
  if (!dateString) return 'N/A';
  try {
    return listDateFormatter.format(new Date(dateString));
  } catch {
    return 'N/A';
  }
}

// Hoisted (§4b item 1): one shared formatter instead of a locale parse per
// ticket row per render.
const listDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

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

function formatCategory(category: string) {
  return SUPPORT_CATEGORIES.find((c) => c.value === category)?.label || category.replace(/_/g, ' ');
}

export default function SupportPageClient({ initialTickets }: { initialTickets: SupportTicketSummary[] }) {
  const router = useRouter();
  const [view, setView] = useState<'list' | 'create'>('list');
  const [tickets, setTickets] = useState<SupportTicketSummary[]>(initialTickets);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [createForm, setCreateForm] = useState({
    subject: '',
    category: 'general',
    priority: 'medium' as SupportTicketSummary['priority'],
    message: '',
  });

  const openTicketCount = useMemo(
    () =>
      tickets.filter((ticket) =>
        ticket.status === 'open' || ticket.status === 'in_progress' || ticket.status === 'waiting_for_user',
      ).length,
    [tickets],
  );

  // Synchronous submit guard: same double-submit window as thread replies.
  const submittingRef = useRef(false);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const createdTicket = await createSupportTicket(createForm);
      setTickets((current) => [createdTicket, ...current]);
      setCreateForm({ subject: '', category: 'general', priority: 'medium', message: '' });
      setView('list');
      router.refresh();
    } catch (error: unknown) {
      console.error('Error creating support ticket', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create ticket. Please try again.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-white border-b border-gray-200">
        <div className="w-full px-[10px]">
          <div className="py-6 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Support Center</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your support tickets and inquiries
              </p>
            </div>
            {view === 'list' ? (
              <button
                onClick={() => setView('create')}
                className="text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                style={{ backgroundColor: '#239459' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Ticket
              </button>
            ) : (
              <button
                onClick={() => setView('list')}
                className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Back to Tickets
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="w-full px-[10px] py-8">
        {view === 'list' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">My Tickets</h3>
                <p className="text-3xl font-bold" style={{ color: '#239459' }}>{tickets.length}</p>
                <p className="text-sm text-gray-500 mt-1">Total tickets submitted</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Open Issues</h3>
                <p className="text-3xl font-bold text-yellow-600">{openTicketCount}</p>
                <p className="text-sm text-gray-500 mt-1">Tickets currently active</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Recent Tickets</h2>
              </div>

              {tickets.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">No tickets found</h3>
                  <p className="mt-2 text-gray-500 mb-6">You haven&apos;t submitted any support tickets yet.</p>
                  <button
                    onClick={() => setView('create')}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white"
                    style={{ backgroundColor: '#239459' }}
                  >
                    Create your first ticket
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {tickets.map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                              {formatStatus(ticket.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{ticket.subject}</div>
                            <div className={`text-xs mt-1 ${getPriorityColor(ticket.priority)}`}>
                              {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)} Priority
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatCategory(ticket.category)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(ticket.lastMessageAt || ticket.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link
                              href={`/support/${ticket.id}`}
                              style={{ color: '#239459' }}
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'create' && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">Create New Ticket</h2>
              </div>
              <form onSubmit={handleCreateSubmit} className="p-6 space-y-6">
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="subject"
                    required
                    className="w-full rounded-lg bg-white text-gray-900 border border-gray-300 p-2 placeholder-gray-500"
                    style={{ outlineColor: '#239459' }}
                    placeholder="Briefly describe your issue"
                    value={createForm.subject}
                    onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="category"
                      required
                      className="w-full rounded-lg bg-white text-gray-900 border border-gray-300 p-2"
                      value={createForm.category}
                      onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    >
                      {SUPPORT_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                      Priority <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="priority"
                      required
                      className="w-full rounded-lg bg-white text-gray-900 border border-gray-300 p-2"
                      value={createForm.priority}
                      onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value as SupportTicketSummary['priority'] })}
                    >
                      <option value="low">Low - General question</option>
                      <option value="medium">Medium - Standard issue</option>
                      <option value="high">High - Urgent issue</option>
                      <option value="critical">Critical - Blocking</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={6}
                    className="w-full rounded-lg bg-white text-gray-900 border border-gray-300 p-2 placeholder-gray-500"
                    placeholder="Please provide detailed information about your issue..."
                    value={createForm.message}
                    onChange={(e) => setCreateForm({ ...createForm, message: e.target.value })}
                  />
                </div>

                {errorMessage ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </div>
                ) : null}

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: '#239459' }}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
