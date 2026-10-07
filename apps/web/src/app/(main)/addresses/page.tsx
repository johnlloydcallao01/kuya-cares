'use client';

/**
 * Thin /addresses page (BFF pattern).
 * All domain data comes from address server actions (CMS aggregation
 * endpoint owns user resolution, joins, stats). This component only
 * manages UI state and renders — same principle as mobile's
 * AddressesScreen, ported to web conventions.
 */

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { AddressesPageSkeleton } from '@/components/skeletons/AddressesSkeleton';
import AddressCard from '@/components/addresses/AddressCard';
import AddressFormModal from '@/components/addresses/AddressFormModal';
import { emitAddressChange } from '@/hooks/useAddressChange';
import { shortAddress, type AddressUI } from '@/types/address';
import {
  editAddress,
  fetchAddressBook,
  activateAddress,
  removeAddress,
  saveAddress,
  type AddressInput,
} from '@/lib/client-services/address-book-service';

const BRAND = '#239459';

type TypeFilter = 'all' | 'home' | 'work' | 'partner';

const TYPE_TABS: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'home', label: 'Home' },
  { id: 'work', label: 'Work' },
  { id: 'partner', label: 'Partner' },
];

export default function AddressesPage() {
  return (
    <Suspense fallback={<AddressesPageSkeleton />}>
      <AddressesContent />
    </Suspense>
  );
}

function AddressesContent() {
  const [addresses, setAddresses] = useState<AddressUI[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, home: 0, work: 0, verified: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AddressUI | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AddressUI | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Member-safe: signed-in members have no customer doc (ADDRESSES_NO_CUSTOMER).
  // They see the empty hero, never a red error wall. NO_SESSION keeps the wall.
  const [noCustomer, setNoCustomer] = useState(false);

  const applyNoCustomerEmpty = useCallback(() => {
    setAddresses([]);
    setActiveId(null);
    setStats({ total: 0, home: 0, work: 0, verified: 0 });
    setError(null);
    setNoCustomer(true);
  }, []);

  const requestIdRef = useRef(0);

  const loadBook = useCallback(
    async (opts: { silent?: boolean; reset?: boolean; type?: TypeFilter; q?: string } = {}) => {
      // Race guard (§4 singleflight, client side): server actions can't take
      // an AbortSignal, so rapid tab/search churn stamps each flight and only
      // the latest may commit — no last-resolve-wins list swaps.
      const requestId = ++requestIdRef.current;
      const isStale = () => requestId !== requestIdRef.current;
      try {
        if (!opts.silent) {
          if (opts.reset) setRefreshing(true);
          else setLoading(true);
        }
        setError(null);
        const book = await fetchAddressBook({
          type: opts.type ?? typeFilter,
          q: opts.q ?? searchQuery,
          limit: 100,
        });
        if (isStale()) return;
        setAddresses(book.addresses);
        setActiveId(book.activeAddressId);
        setStats(book.stats);
        if (!isStale()) setNoCustomer(false);
      } catch (e: any) {
        if (isStale()) return;
        const msg = String(e?.message || '');
        if (msg.includes('ADDRESSES_NO_CUSTOMER')) {
          if (!opts.silent) applyNoCustomerEmpty();
          else {
            applyNoCustomerEmpty();
            toast.error('Address book not available for this account yet');
          }
          return;
        }
        if (!opts.silent) setError(e?.message || 'Failed to load addresses');
        else toast.error(e?.message || 'Refresh failed — showing saved list');
      } finally {
        if (!isStale()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [typeFilter, searchQuery, applyNoCustomerEmpty],
  );

  const loadBookRef = useRef(loadBook);
  loadBookRef.current = loadBook;
  const filterFirstRun = useRef(true);

  useEffect(() => {
    loadBookRef.current({});
  }, []);

  // Debounced server-side search input.
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim().toLowerCase()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Refetch from server when filter/search changes (server owns filtering).
  useEffect(() => {
    if (filterFirstRun.current) {
      filterFirstRun.current = false;
      return;
    }
    loadBookRef.current({ reset: true, type: typeFilter, q: searchQuery });
  }, [typeFilter, searchQuery]);

  const openAdd = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((a: AddressUI) => {
    setEditing(a);
    setFormOpen(true);
  }, []);

  const handleFormSubmit = useCallback(
    async (input: AddressInput) => {
      setFormBusy(true);
      try {
        if (editing) {
          const { setActive, ...patch } = input;
          await editAddress(editing.id, patch);
          if (setActive) {
            await activateAddress(editing.id);
            emitAddressChange(editing.id);
          }
          toast.success('Address updated');
        } else {
          const res = await saveAddress(input);
          if (input.setActive && res.activeAddressId) emitAddressChange(res.activeAddressId);
          toast.success('Address saved');
        }
        setFormOpen(false);
        setEditing(null);
        await loadBookRef.current({ reset: true });
      } catch (e: any) {
        const msg = String(e?.message || '');
        if (msg.includes('ADDRESSES_NO_CUSTOMER')) {
          applyNoCustomerEmpty();
          toast.error('Address book not available for this account yet');
        } else toast.error(e?.message || 'Save failed');
      } finally {
        setFormBusy(false);
      }
    },
    [applyNoCustomerEmpty],
  );

  const handleSetActive = useCallback(async (a: AddressUI) => {
    if (a.id === activeId) return;
    const prevActiveId = activeId;
    const prevAddresses = addresses;
    // Optimistic: flip the ACTIVE badge instantly, roll back on failure
    // instead of leaving the list unchanged through 2 serial round-trips.
    setActiveId(a.id);
    setAddresses((prev) => prev.map((x) => ({ ...x, isActive: x.id === a.id })));
    setActivatingId(a.id);
    try {
      await activateAddress(a.id);
      emitAddressChange(a.id);
      toast.success('Active delivery address updated');
      await loadBookRef.current({ silent: true });
    } catch (e: any) {
      setActiveId(prevActiveId);
      setAddresses(prevAddresses);
      const msg = String(e?.message || '');
      if (msg.includes('ADDRESSES_NO_CUSTOMER')) {
        applyNoCustomerEmpty();
        toast.error('Address book not available for this account yet');
      } else toast.error(e?.message || 'Set active failed');
    } finally {
      setActivatingId(null);
    }
  }, [activeId, addresses, applyNoCustomerEmpty]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await removeAddress(deleteTarget.id);
      if (res.clearedActive) emitAddressChange('');
      toast.success('Address deleted');
      setDeleteTarget(null);
      await loadBookRef.current({ reset: true });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('ADDRESSES_NO_CUSTOMER')) {
        applyNoCustomerEmpty();
        toast.error('Address book not available for this account yet');
      } else toast.error(e?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, applyNoCustomerEmpty]);

  // All hooks must stay above every early return (Rules of Hooks):
  // `loading`/`error` flip between renders, so any useMemo/useCallback
  // declared after those returns would change the hook count → crash.
  const isFiltered = searchQuery !== '' || typeFilter !== 'all';
  // Memoized derivations (§4b: page rebuilt these per render — 100 rows
  // re-rendered on every search keystroke).
  const activeAddress = useMemo(
    () => addresses.find((a) => a.id === activeId) ?? null,
    [addresses, activeId],
  );
  const statCards = useMemo(
    () => [
      { label: 'Saved', value: String(stats.total), icon: 'fa-map-marker-alt', bg: 'bg-gray-50', fg: 'text-gray-700' },
      { label: 'Home', value: String(stats.home), icon: 'fa-home', bg: 'bg-green-50', fg: 'text-green-700' },
      { label: 'Work', value: String(stats.work), icon: 'fa-briefcase', bg: 'bg-blue-50', fg: 'text-blue-700' },
      { label: 'Verified', value: String(stats.verified), icon: 'fa-badge-check', bg: 'bg-amber-50', fg: 'text-amber-700' },
    ],
    [stats],
  );
  const handleDeleteTarget = useCallback((addr: AddressUI) => setDeleteTarget(addr), []);

  if (loading) return <AddressesPageSkeleton />;

  // Member-safe: ADDRESSES_NO_CUSTOMER renders the empty hero below, never the wall.
  // noCustomer state tracks the graceful empty; the includes() guard covers races.
  if (error && addresses.length === 0 && !noCustomer && !error.includes('ADDRESSES_NO_CUSTOMER')) {
    const noSession = error.includes('ADDRESSES_NO_SESSION');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
            <i className={`fas ${noSession ? 'fa-user-lock' : 'fa-exclamation-triangle'} text-red-500 text-xl`} />
          </div>
          <h2 className="text-lg font-extrabold text-gray-900 mb-2">Couldn&apos;t load addresses</h2>
          <p className="text-sm text-gray-500 mb-5">
            {noSession ? 'Please sign in to manage your addresses.' : error}
          </p>
          {noSession ? (
            <Link
              href="/signin"
              className="block w-full py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90 text-center"
              style={{ backgroundColor: BRAND }}
            >
              Sign in
            </Link>
          ) : (
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                loadBook({});
              }}
              className="w-full py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90"
              style={{ backgroundColor: BRAND }}
            >
              <i className="fas fa-redo mr-2" />
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-20">
        <div className="w-full px-3 sm:px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">My Addresses</h1>
              <p className="text-gray-500 mt-0.5 text-sm">
                {activeAddress ? (
                  <>Delivering to <span className="font-bold text-gray-800">{shortAddress(activeAddress)}</span></>
                ) : (
                  'Save places you order to most'
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => loadBook({ reset: true })}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-60"
                title="Refresh"
              >
                <i className={`fas fa-sync-alt ${refreshing ? 'fa-spin' : ''}`} style={{ color: BRAND }} />
              </button>
              <button
                onClick={openAdd}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
                style={{ backgroundColor: BRAND }}
              >
                <i className="fas fa-plus" />
                <span className="hidden sm:inline">Add Address</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          {addresses.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
              {statCards.map((s) => (
                <div key={s.label} className={`${s.bg} rounded-xl px-3 py-2.5 flex items-center gap-2.5`}>
                  <i className={`fas ${s.icon} ${s.fg}`} />
                  <div className="min-w-0">
                    <p className={`text-sm font-extrabold truncate ${s.fg}`}>{s.value}</p>
                    <p className="text-[11px] text-gray-500 font-medium">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Type tabs */}
        <div className="border-t border-gray-100">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide px-3 py-2.5">
            {TYPE_TABS.map((t) => {
              const active = typeFilter === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTypeFilter(t.id)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl font-bold text-[13px] transition-all border ${
                    active
                      ? 'text-white shadow-md border-transparent'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  style={active ? { backgroundColor: BRAND } : {}}
                >
                  {t.label}
                  {t.id === 'all' && (
                    <span className={`ml-1.5 text-[11px] font-extrabold ${active ? 'text-white/80' : 'text-gray-400'}`}>
                      {stats.total}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-full px-3 sm:px-4 py-4">
        {/* Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3.5 mb-4">
          <div className="relative">
            <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Search street, barangay, label…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:bg-white focus:border-transparent transition-all text-sm outline-none"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <i className="fas fa-times-circle" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        {addresses.length > 0 ? (
          <div
            className={`grid grid-cols-1 lg:grid-cols-2 gap-3.5 transition-opacity ${refreshing ? 'opacity-60' : ''}`}
            aria-busy={refreshing}
          >
            {addresses.map((a) => (
              <AddressCard
                key={a.id}
                address={a}
                activatingId={activatingId}
                onSetActive={handleSetActive}
                onEdit={openEdit}
                onDelete={handleDeleteTarget}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <div className="w-20 h-20 mx-auto mb-5 bg-gray-50 rounded-full flex items-center justify-center">
                <i className={`fas ${isFiltered ? 'fa-search' : 'fa-map-marker-alt'} text-2xl text-gray-300`} />
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 mb-2">
                {isFiltered ? 'No matching addresses' : 'No saved addresses'}
              </h3>
              <p className="text-gray-500 mb-6 text-sm">
                {isFiltered
                  ? 'Try a different keyword or type.'
                  : 'Save your home, work, and favorites for one-tap checkout.'}
              </p>
              {isFiltered ? (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setTypeFilter('all');
                  }}
                  className="px-6 py-2.5 text-white rounded-xl font-bold text-sm shadow-md hover:opacity-90"
                  style={{ backgroundColor: BRAND }}
                >
                  Clear filters
                </button>
              ) : (
                <button
                  onClick={openAdd}
                  className="px-6 py-2.5 text-white rounded-xl font-bold text-sm shadow-md hover:opacity-90"
                  style={{ backgroundColor: BRAND }}
                >
                  <i className="fas fa-plus mr-2" />
                  Add your first address
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <AddressFormModal
        isOpen={formOpen}
        initial={editing}
        submitting={formBusy}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleFormSubmit}
      />

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold text-gray-900 mb-1">Delete this address?</h3>
            <p className="text-sm text-gray-500 mb-5 line-clamp-2">{deleteTarget.formattedAddress}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-200"
              >
                Keep
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? <i className="fas fa-spinner fa-spin mr-2" /> : null}
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
