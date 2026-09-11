'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import SearchField from '@/components/ui/SearchField';
import LocationMerchantCard from '@/components/cards/LocationMerchantCard';
import { AddressService, getCurrentCustomerId, getLocationBasedMerchants, getLocationBasedMerchantCategories, type LocationBasedMerchant, type MerchantCategoryDisplay } from '@encreasl/client-services';
import { getWishlistMerchantIdsForCurrentUser, addMerchantToWishlist, removeMerchantFromWishlist } from '@/lib/client-services/wishlist-service';
import { toast } from 'react-hot-toast';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
};

export default function SearchModal({ isOpen, onClose, initialQuery }: Props) {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [query, setQuery] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [merchants, setMerchants] = useState<LocationBasedMerchant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<MerchantCategoryDisplay[]>([]);
  const [matchedCategory, setMatchedCategory] = useState<MerchantCategoryDisplay | null>(null);
  const [categoryMerchants, setCategoryMerchants] = useState<LocationBasedMerchant[]>([]);
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const [hasCommittedSearch, setHasCommittedSearch] = useState(false);

  const [serverRecentQueries, setServerRecentQueries] = useState<string[]>([]);
  const [activeAddressName, setActiveAddressName] = useState<string | null>(null);
  const [productSuggestions, setProductSuggestions] = useState<string[]>([]);
  const [productMatchedMerchants, setProductMatchedMerchants] = useState<LocationBasedMerchant[]>([]);
  type Suggestion = { text: string; source: 'merchant' | 'category' | 'product' | 'tag' };
  const [isProductLoading, setIsProductLoading] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const toggleWishlist = useCallback((id: string | number) => {
    const idStr = String(id);
    setWishlistIds(prev => {
      const next = new Set(prev);
      const willAdd = !next.has(idStr);
      if (willAdd) {
        next.add(idStr);
      } else {
        next.delete(idStr);
      }
      (async () => {
        try {
          if (willAdd) {
            await addMerchantToWishlist(id);
            toast.success('Added to wishlist', { id: `wishlist-${idStr}` });
          } else {
            await removeMerchantFromWishlist(id);
            toast.success('Removed from wishlist', { id: `wishlist-${idStr}` });
          }
        } catch (err) {
          setWishlistIds(current => {
            const rollback = new Set(current);
            if (willAdd) {
              rollback.delete(idStr);
            } else {
              rollback.add(idStr);
            }
            return rollback;
          });
          const message = err instanceof Error && err.message ? err.message : 'Wishlist update failed';
          toast.error(message, { id: `wishlist-${idStr}-error` });
        }
      })();
      return next;
    });
  }, []);

  const normalizeQuery = useCallback((input: string): string => {
    let q = (input || '').toLowerCase().trim();
    if (!q) return '';
    if (q.includes(' near me')) {
      q = q.replace(' near me', '').trim();
    }
    const idx = q.indexOf(' in ');
    if (idx > -1) {
      q = q.slice(0, idx).trim();
    }
    q = q.replace(/\s+/g, ' ').trim();
    return q;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (typeof initialQuery === 'string') {
      setQuery(initialQuery);
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth < 1024);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isOpen) return;
      try {
        const ids = await getWishlistMerchantIdsForCurrentUser();
        if (cancelled) return;
        const setIds = new Set<string>(ids.map((v) => String(v)));
        setWishlistIds(setIds);
      } catch {
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen, isMobile]);



  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isOpen) return;
      try {
        const userStr = typeof window !== 'undefined' ? localStorage.getItem('grandline_auth_user') : null;
        const userId = userStr ? (() => { try { return JSON.parse(userStr)?.id; } catch { return null; } })() : null;
        if (!userId) { setServerRecentQueries([]); return; }
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
        if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;
        const url = `${API_BASE}/recent-searches?where[user][equals]=${encodeURIComponent(String(userId))}&where[scope][equals]=restaurants&sort=-updatedAt&limit=10`;
        const res = await fetch(url, { headers });
        if (!res.ok) { setServerRecentQueries([]); return; }
        const data = await res.json();
        const docs = Array.isArray(data?.docs) ? data.docs : [];
        const queries: string[] = docs.map((d: any) => (d?.query || '')).filter((v) => typeof v === 'string' && v.trim().length > 0);
        if (!cancelled) setServerRecentQueries(queries);
      } catch {
        if (!cancelled) setServerRecentQueries([]);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  useEffect(() => {
    if (query.trim().length === 0) {
      setHasCommittedSearch(false);
    }
  }, [query]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isOpen || !isMobile) return;
      setIsLoading(true);
      const cid = await getCurrentCustomerId();
      if (!active) return;
      setCustomerId(cid);
      if (cid) {
        const list = await getLocationBasedMerchants({ customerId: cid, limit: 9999 });
        if (!active) return;
        setMerchants(list || []);
        const cats = await getLocationBasedMerchantCategories({ customerId: cid, limit: 100 });
        if (!active) return;
        setCategories(cats || []);
      } else {
        setMerchants([]);
        setCategories([]);
      }
      setIsLoading(false);
    })();
    return () => { active = false; };
  }, [isOpen, isMobile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isOpen) return;
      try {
        const userStr = typeof window !== 'undefined' ? localStorage.getItem('grandline_auth_user') : null;
        const userId = userStr ? (() => { try { return JSON.parse(userStr)?.id; } catch { return null; } })() : null;
        if (!userId) return;
        const res = await AddressService.getActiveAddress(userId, undefined, false);
        if (!cancelled && res?.success && res.address?.formatted_address) {
          setActiveAddressName(res.address.formatted_address);
        }
      } catch { }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isMobile) return;
    const q = normalizeQuery(query);
    if (!q) {
      setMatchedCategory(null);
      setCategoryMerchants([]);
      return;
    }
    const score = (c: MerchantCategoryDisplay): number => {
      const name = (c.name || '').toLowerCase();
      const slug = (c.slug || '').toLowerCase();
      if (name === q || slug === q) return 3;
      if (name.startsWith(q) || slug.startsWith(q)) return 2;
      if (name.includes(q) || slug.includes(q)) return 1;
      return 0;
    };
    const best = (categories || [])
      .map((c) => ({ c, s: score(c) }))
      .filter(({ s }) => s > 0)
      .sort((a, b) => b.s - a.s)[0]?.c || null;
    setMatchedCategory(best);
  }, [query, categories, isOpen, isMobile, normalizeQuery]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isOpen || !isMobile) return;
      const q = normalizeQuery(query);
      if (!q) { setProductSuggestions([]); return; }
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
      if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;
      try {
        const url = `${API_BASE}/products?where[name][contains]=${encodeURIComponent(q)}&limit=12&depth=0`;
        const res = await fetch(url, { headers });
        if (!res.ok) { setProductSuggestions([]); return; }
        const data = await res.json();
        const docs = Array.isArray(data?.docs) ? data.docs : Array.isArray(data) ? data : [];
        const names: string[] = docs.map((p: any) => p?.name).filter((n: any) => typeof n === 'string' && n.trim().length > 0);
        const uniq: string[] = Array.from(new Set(names.map((n) => n.trim())));
        if (!cancelled) setProductSuggestions(uniq.slice(0, 12));
      } catch {
        if (!cancelled) setProductSuggestions([]);
      }
    };
    const t = setTimeout(run, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, isOpen, isMobile, normalizeQuery]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsProductLoading(true);
      if (!isOpen || !isMobile || !hasCommittedSearch) { setProductMatchedMerchants([]); setIsProductLoading(false); return; }
      const q = normalizeQuery(query);
      if (!q) { setProductMatchedMerchants([]); setIsProductLoading(false); return; }
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
      if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;
      try {
        const pUrl = `${API_BASE}/products?where[name][contains]=${encodeURIComponent(q)}&limit=50&depth=0`;
        const pRes = await fetch(pUrl, { headers });
        if (!pRes.ok) { setProductMatchedMerchants([]); setIsProductLoading(false); return; }
        const pData = await pRes.json();
        const pDocs = Array.isArray(pData?.docs) ? pData.docs : Array.isArray(pData) ? pData : [];
        const pIds: (string | number)[] = pDocs.map((p: any) => p?.id).filter((id: any) => typeof id === 'number' || typeof id === 'string');
        if (pIds.length === 0) { setProductMatchedMerchants([]); setIsProductLoading(false); return; }

        const mpUrl = `${API_BASE}/merchant-products?where[product_id][in]=${pIds.join(',')}&where[is_active][equals]=true&where[is_available][equals]=true&limit=${Math.max(200, pIds.length * 10)}&depth=0`;
        const mpRes = await fetch(mpUrl, { headers });
        if (!mpRes.ok) { setProductMatchedMerchants([]); setIsProductLoading(false); return; }
        const mpData = await mpRes.json();
        const mpDocs = Array.isArray(mpData?.docs) ? mpData.docs : Array.isArray(mpData) ? mpData : [];
        const mIds = mpDocs.map((d: any) => {
          const val = d?.merchant_id;
          if (val && typeof val === 'object' && val.id != null) return val.id;
          return val;
        }).filter((id: any) => typeof id === 'number' || typeof id === 'string');
        const idSet = new Set<string>(mIds.map((x: any) => String(x)));
        const matched = (merchants || []).filter((m) => idSet.has(String((m as any).id)));
        if (!cancelled) { setProductMatchedMerchants(matched); setIsProductLoading(false); }
      } catch {
        if (!cancelled) { setProductMatchedMerchants([]); setIsProductLoading(false); }
      }
    };
    const t = setTimeout(run, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [hasCommittedSearch, query, isOpen, isMobile, merchants, normalizeQuery]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!matchedCategory || !customerId) {
        setCategoryMerchants([]);
        return;
      }
      setIsCategoryLoading(true);
      const list = await getLocationBasedMerchants({ customerId, limit: 24, categoryId: String(matchedCategory.id) });
      if (cancel) return;
      setCategoryMerchants(list || []);
      setIsCategoryLoading(false);
    })();
    return () => { cancel = true; };
  }, [matchedCategory, customerId]);

  const filtered = useMemo(() => {
    const q = normalizeQuery(query);
    if (!q) return [];
    const textMatches = (merchants || []).filter((m) => {
      const name = (m.outletName || '').toLowerCase();
      const vendor = (m.vendor?.businessName || '').toLowerCase();
      const desc = (m.description || '').toLowerCase();
      const tags = Array.isArray(m.tags) ? m.tags.join(' ').toLowerCase() : '';
      return name.includes(q) || vendor.includes(q) || desc.includes(q) || tags.includes(q);
    });
    const byId = new Map<string, LocationBasedMerchant>();
    for (const m of (categoryMerchants || [])) byId.set(m.id, m);
    for (const m of (productMatchedMerchants || [])) if (!byId.has(m.id)) byId.set(m.id, m);
    const combined: LocationBasedMerchant[] = [...(categoryMerchants || []), ...(productMatchedMerchants || [])];
    for (const m of textMatches) if (!byId.has(m.id)) combined.push(m);
    return combined;
  }, [merchants, categoryMerchants, productMatchedMerchants, query, normalizeQuery]);

  const suggestions = useMemo((): Suggestion[] => {
    const q = query.trim();
    if (!q) return [] as Suggestion[];
    const lower = q.toLowerCase();
    const loc = activeAddressName ? ` in ${activeAddressName}` : '';
    const withLoc = (base: string) => [base, loc ? `${base}${loc}` : null].filter(Boolean) as string[];
    const withLocNearMe = (base: string) => [base, `${base} near me`, loc ? `${base}${loc}` : null].filter(Boolean) as string[];

    const merchantMatches = (merchants || [])
      .filter((m) => {
        const name = (m.outletName || '').toLowerCase();
        const vendor = (m.vendor?.businessName || '').toLowerCase();
        return name.includes(lower) || vendor.includes(lower);
      })
      .map((m) => (m.outletName || m.vendor?.businessName || '').trim())
      .filter((v) => v.length > 0);

    const categoryMatches = (categories || [])
      .filter((c) => (c.name || '').toLowerCase().includes(lower) || (c.slug || '').toLowerCase().includes(lower))
      .map((c) => c.name)
      .filter((v) => v && v.length > 0);

    const tagMatches = (() => {
      const set = new Set<string>();
      (merchants || []).forEach((m) => (m.tags || []).forEach((t) => {
        const k = (t || '').trim();
        if (!k) return;
        if (k.toLowerCase().includes(lower)) set.add(k);
      }));
      return Array.from(set);
    })();

    const coll: Suggestion[] = [];
    merchantMatches.slice(0, 6).forEach((name) => withLocNearMe(name).forEach((text) => coll.push({ text, source: 'merchant' })));
    categoryMatches.slice(0, 6).forEach((name) => withLoc(name).forEach((text) => coll.push({ text, source: 'category' })));
    productSuggestions.slice(0, 6).forEach((name) => coll.push({ text: name, source: 'product' }));
    tagMatches.slice(0, 4).forEach((name) => withLoc(name).forEach((text) => coll.push({ text, source: 'tag' })));

    const seen = new Set<string>();
    const list = coll.filter((s) => {
      const k = s.text.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return list.slice(0, 12);
  }, [query, merchants, categories, productSuggestions, activeAddressName]);

  const recentList = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    serverRecentQueries.forEach((t) => {
      const k = t.trim().toLowerCase();
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push(t.trim());
    });
    return out.slice(0, 10);
  }, [serverRecentQueries]);



  const commitSearch = useCallback((val?: string) => {
    const v = (val ?? query).trim();
    if (!v) return;
    (async () => {
      try {
        const userStr = typeof window !== 'undefined' ? localStorage.getItem('grandline_auth_user') : null;
        const userId = userStr ? (() => { try { return JSON.parse(userStr)?.id; } catch { return null; } })() : null;
        if (!userId) return;
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
        if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;
        const scope = 'restaurants';
        const normalized = normalizeQuery(v);
        const compositeKey = `${userId}:${scope}:${normalized}`;
        const body = JSON.stringify({ user: userId, query: v, scope, source: 'web', addressText: activeAddressName || undefined });
        const res = await fetch(`${API_BASE}/recent-searches`, { method: 'POST', headers, body });
        if (res.ok) return;
        const existsUrl = `${API_BASE}/recent-searches?where[compositeKey][equals]=${encodeURIComponent(compositeKey)}&limit=1`;
        const getRes = await fetch(existsUrl, { headers });
        if (!getRes.ok) return;
        const data = await getRes.json();
        const id = data?.docs?.[0]?.id;
        if (!id) return;
        await fetch(`${API_BASE}/recent-searches/${id}`, { method: 'PATCH', headers, body: '{}' });
      } catch { }
    })();
    router.push(`/results?search_query=${encodeURIComponent(v)}`);
    onClose();
  }, [query, activeAddressName, normalizeQuery, router, onClose]);

  if (!isOpen || !isMobile) return null;

  const overlay = (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', backgroundColor: 'white', zIndex: 99999 }}
    >
      <div className="w-full h-full flex flex-col bg-white" data-modal-content>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors mr-3"
            aria-label="Close"
          >
            <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <SearchField
              placeholder="Search for restaurants and foods"
              value={query}
              onChange={setQuery}
              inputClassName="pl-10 pr-10 py-3 bg-gray-50 border-0 rounded-xl text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#777] focus:bg-white"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') commitSearch(); }}
            />
          </div>
        </div>
        <div className="flex-1 px-4 py-4 overflow-y-auto">
          {query.trim().length === 0 ? (
            recentList.length > 0 ? (
              <div>
                <div className="text-sm text-gray-500 mb-2">Recent searches</div>
                <ul className="bg-white text-left">
                  {recentList.map((text) => (
                    <li key={text}>
                      <button
                        onClick={() => { setQuery(text); commitSearch(text); }}
                        className="w-full flex items-center gap-3 px-0 py-3 hover:bg-gray-50 text-gray-900 text-left"
                      >
                        <i className="fas fa-history text-gray-400"></i>
                        <span className="flex-1">{text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null
          ) : (
            <div>
              <div className="text-sm text-gray-500 mb-2">Suggested searches</div>
              <ul className="bg-white text-left">
                {suggestions.map((s) => (
                  <li key={s.text}>
                    <button
                      onClick={() => { setQuery(s.text); commitSearch(s.text); }}
                      className="w-full flex items-center gap-3 px-0 py-3 hover:bg-gray-50 text-gray-900 text-left"
                    >
                      <i className="fas fa-search text-gray-400"></i>
                      <div className="flex-1">
                        <div>{s.text}</div>
                        {s.source === 'product' && (
                          <div className="mt-1">
                            <span className="px-2 py-0.5 text-xs text-gray-600 bg-gray-100 rounded">in Restaurants</span>
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay as any, document.body as any) as any;
}
