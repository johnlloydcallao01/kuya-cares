'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter, notFound } from 'next/navigation';
import { ArrowLeft, Store, AlertCircle, CheckCircle } from '@/components/ui/IconWrapper';
import { OutletForm } from '../../_components/OutletForm';
import type { DebugLogInfo } from '../../_components/OutletForm';
import { ClientOnly } from '@/components/ClientOnly';

function EditOutletSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
    </div>
  );
}

function EditOutletContent() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [doc, setDoc] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/outlets/${id}`, { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || j.details || 'Failed to load outlet');
      setDoc(j.outlet || j.doc);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshLatest = useCallback(async () => {
    try {
      const res = await fetch(`/api/outlets/${id}?_t=${Date.now()}`, { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || j.details || 'Failed to reload outlet');
      const latest = j.outlet || j.doc || null;
      if (latest) setDoc(latest);
      return latest;
    } catch (e: any) {
      console.error('Failed to refresh outlet after save:', e);
      return null;
    }
  }, [id]);

  const handleSaveSuccess = async (updatedDoc?: any, debug?: DebugLogInfo) => {
    setSaveSuccess(false);
    setSaveError(null);

    // Enterprise verification — mirror web-admin vendors/[id]/edit pattern:
    // Never show "success" optimistically. Re-read from DB and compare to payload.
    // If the re-read still shows stale outletName, the CMS verification failed or
    // DB did not persist — surface an error instead of fake success.
    const expectedName = debug?.payloadSent?.outletName as string | undefined
    const expectedCode = debug?.payloadSent?.outletCode as string | undefined

    // Trust the server's sanitized doc first, but verify via fresh GET (no-store, cache-bust)
    const serverDoc = updatedDoc || null
    if (serverDoc) setDoc(serverDoc)

    // Always reload from source of truth — even if we have updatedDoc, hit the API again
    // to catch replication lag / hook rollback (this is what exposed the original bug).
    let refreshed: any = null
    try {
      refreshed = await refreshLatest()
      if (refreshed) setDoc(refreshed)
    } catch (e: any) {
      console.error('Failed to refresh after save:', e)
    }

    const truth = refreshed || serverDoc
    if (truth && expectedName) {
      const persistedName = String(truth.outletName || '').trim()
      const wantName = String(expectedName).trim()
      if (persistedName !== wantName) {
        const msg = `Save verification failed: server still has "${persistedName}" but you saved "${wantName}". The database did not persist your change — please retry.`
        setSaveError(msg)
        setSaveSuccess(false)
        return
      }
    }
    if (truth && expectedCode) {
      const persistedCode = String(truth.outletCode || '').trim().toUpperCase()
      const wantCode = String(expectedCode).trim().toUpperCase()
      if (persistedCode !== wantCode) {
        const msg = `Save verification failed: outlet code still "${persistedCode}" but you saved "${wantCode}".`
        setSaveError(msg)
        setSaveSuccess(false)
        return
      }
    }

    setSaveSuccess(true)
    router.refresh()
    setTimeout(() => setSaveSuccess(false), 4000)
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/outlets');
  };

  if (loading) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
        <div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
      </div>
    );
  }
  if (error || !doc) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <Link href="/outlets" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back to outlets</Link>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load outlet</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/outlets" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium">Back</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {saveSuccess && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          Outlet updated successfully.
        </div>
      )}
      {saveError && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm font-medium text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center overflow-hidden">
          {doc.media?.thumbnail?.url ? <img src={doc.media.thumbnail.url} alt={doc.outletName} className="h-full w-full object-cover" /> : <Store className="w-5 h-5" />}
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Edit outlet</h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">ID #{doc.id} • {doc.outletName}</p>
        </div>
      </div>
      <OutletForm initial={doc} onSuccess={handleSaveSuccess} onCancel={handleBack} />
    </div>
  );
}

export default function EditOutletPage() {
  // SSR-level guard: see [id]/page.tsx — reserved slugs 404 with proper status.
  const params = useParams();
  const id = params.id as string;
  if (['new', 'hours', 'delivery', 'media', 'service-area'].includes(id)) {
    notFound();
  }
  return (
    <ClientOnly fallback={<EditOutletSkeleton />}>
      <EditOutletContent />
    </ClientOnly>
  );
}
