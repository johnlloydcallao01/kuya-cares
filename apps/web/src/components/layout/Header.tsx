'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from "@/components/ui/ImageWrapper";
import { useRouter, usePathname } from 'next/navigation';
import { HeaderProps } from '@/types';
import { useUser, useLogout } from '@/hooks/useAuth';
import { UserAvatar, UserInfo } from '@/components/auth';
import { LocationSelector } from '@/components/location';
import SearchModal from '@/components/search/SearchModal';
import LocationMerchantCard from '@/components/cards/LocationMerchantCard';
import SearchField from '@/components/ui/SearchField';
import { AddressService, getCurrentCustomerId as getCustomerIdForMerchants, getLocationBasedMerchants, getLocationBasedMerchantCategories, type LocationBasedMerchant, type MerchantCategoryDisplay } from '@encreasl/client-services';
import { getWishlistMerchantIdsForCurrentUser, addMerchantToWishlist, removeMerchantFromWishlist } from '@/lib/client-services/wishlist-service';
import { NotificationPopup, mockNotifications } from '@/components/notifications/NotificationPopup';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'react-hot-toast';
import { useAddressChange } from '@/hooks/useAddressChange';

/**
 * Header component with navigation, search, and user controls
 * 
 * @param sidebarOpen - Whether the sidebar is currently open
 * @param onToggleSidebar - Function to toggle sidebar state
 * @param onSearch - Optional search handler function
 */
export function Header({
  sidebarOpen,
  onToggleSidebar,
  onSearch
}: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRootRef = useRef<HTMLDivElement>(null);
  const searchFormRef = useRef<HTMLFormElement>(null);
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

  // Notification popup state
  const [isNotificationPopupOpen, setIsNotificationPopupOpen] = useState(false);
  const [notifications, setNotifications] = useState(mockNotifications);
  const notificationPopupRef = useRef<HTMLDivElement>(null);
  const { totalQuantity } = useCart();

  const normalizeQuery = useCallback((input: string): string => {
    let q = (input || '').toLowerCase().trim();
    if (!q) return '';
    if (q.includes(' near me')) q = q.replace(' near me', '').trim();
    const idx = q.indexOf(' in ');
    if (idx > -1) q = q.slice(0, idx).trim();
    q = q.replace(/\s+/g, ' ').trim();
    return q;
  }, []);

  // Authentication hooks
  const { user, displayName, initials, isAuthenticated } = useUser();
  const { logout, isLoggingOut } = useLogout();
  const dropdownRef = useRef<HTMLDivElement>(null);



  const toggleProfileDropdown = () => {
    setIsProfileDropdownOpen(!isProfileDropdownOpen);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsProfileDropdownOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
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
  }, []);

  // Close notification popup when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationPopupRef.current && !notificationPopupRef.current.contains(event.target as Node)) {
        setIsNotificationPopupOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotificationPopupOpen(false);
      }
    };

    if (isNotificationPopupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isNotificationPopupOpen]);

  // Notification handlers
  const handleMarkAsRead = (id: number) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true }))
    );
  };

  const toggleNotificationPopup = () => {
    setIsNotificationPopupOpen(!isNotificationPopupOpen);
  };


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

  // Authentication removed - no logout functionality

  // Scroll detection for header visibility (mobile/tablet only)
  useEffect(() => {
    const handleScroll = () => {
      // Only apply scroll behavior on mobile/tablet (below lg breakpoint)
      const isDesktop = window.innerWidth >= 1024; // lg breakpoint

      if (isDesktop) {
        setIsHeaderVisible(true); // Always show header on desktop
        return;
      }

      const currentScrollY = window.scrollY;

      // Show header when scrolling up or at the top
      if (currentScrollY < lastScrollY || currentScrollY < 10) {
        setIsHeaderVisible(true);
      }
      // Hide header when scrolling down (but not immediately)
      else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsHeaderVisible(false);
      }

      setLastScrollY(currentScrollY);
    };

    const handleResize = () => {
      // Reset header visibility on resize
      const isDesktop = window.innerWidth >= 1024;
      if (isDesktop) {
        setIsHeaderVisible(true);
      }
    };

    // Throttle scroll events for better performance
    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledHandleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    // Initial check
    handleResize();

    return () => {
      window.removeEventListener('scroll', throttledHandleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [lastScrollY]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const root = dropdownRootRef.current;
      const formEl = searchFormRef.current;
      const target = e.target as Node;
      if (root && root.contains(target)) return;
      if (formEl && formEl.contains(target)) return;
      setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      const cid = await getCustomerIdForMerchants();
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
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const q = normalizeQuery(searchQuery);
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
  }, [searchQuery, normalizeQuery]);

  useEffect(() => {
    const q = normalizeQuery(searchQuery);
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
  }, [searchQuery, categories, normalizeQuery]);

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

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsProductLoading(true);
      if (!hasCommittedSearch) { setProductMatchedMerchants([]); setIsProductLoading(false); return; }
      const q = normalizeQuery(searchQuery);
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
  }, [hasCommittedSearch, searchQuery, merchants, normalizeQuery]);

  const fetchActiveAddress = useCallback(async () => {
    try {
      const userStr = typeof window !== 'undefined' ? localStorage.getItem('grandline_auth_user') : null;
      const userId = userStr ? (() => { try { return JSON.parse(userStr)?.id; } catch { return null; } })() : null;
      if (!userId) return;
      const [activeAddressResponse] = await Promise.all([
        AddressService.getActiveAddress(userId, undefined, false), // Force fresh fetch
        AddressService.getUserAddresses(userId, undefined, false),
      ]);
      if (activeAddressResponse?.success && activeAddressResponse.address?.formatted_address) {
        setActiveAddressName(activeAddressResponse.address.formatted_address);
      }
    } catch { }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchActiveAddress();
  }, [fetchActiveAddress]);

  // Listen for address changes
  useAddressChange(() => {
    fetchActiveAddress();
  });

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length === 0) setHasCommittedSearch(false);
  }, [searchQuery]);


  const commitSearch = useCallback((val?: string) => {
    const v = (val ?? searchQuery).trim();
    if (!v) return;
    setServerRecentQueries((prev) => {
      const list = [v, ...prev];
      const seen = new Set<string>();
      const dedup: string[] = [];
      for (const t of list) {
        const k = String(t).trim().toLowerCase();
        if (!k || seen.has(k)) continue;
        seen.add(k);
        dedup.push(String(t).trim());
      }
      return dedup.slice(0, 10);
    });
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
    setIsDropdownOpen(false);
    if (onSearch) onSearch(v);
  }, [searchQuery, onSearch, activeAddressName, normalizeQuery, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    commitSearch();
  };

  return (
    <>
      <header className={`lg:sticky lg:top-0 fixed top-0 left-0 right-0 lg:bg-white z-50 lg:transition-none transition-transform duration-300 ease-in-out ${isHeaderVisible ? 'translate-y-0' : 'lg:translate-y-0 -translate-y-full'
        }`} style={{ backgroundColor: '#fff' }}>
        {!pathname?.startsWith('/results') && (
          <div className="lg:hidden flex items-center justify-between px-2.5 py-2 h-14" style={{ backgroundColor: '#fff' }}>
            <div className="flex-1 min-w-0">
              <LocationSelector
                onLocationSelect={(location) => {
                  console.log('Selected location:', location);
                }}
                className="text-left pl-0"
              />
            </div>
            <div className="flex items-center space-x-3">
              <button className="p-2 rounded-full hover:bg-gray-100 transition-colors" onClick={() => setIsSearchOpen(true)} aria-label="Open search">
                <i className="fa fa-search text-gray-600 text-lg"></i>
              </button>
              <button
                onClick={() => router.push('/notifications' as any)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <i className="fas fa-bell text-gray-600 text-lg"></i>
              </button>
            </div>
          </div>
        )}

        {/* Desktop Header - existing design */}
        <div className="hidden lg:flex items-center justify-between px-4 lg:min-h-[65px] lg:max-h-[65px]">
          {/* Left section */}
          <div className="flex items-center space-x-4">
            {/* Sidebar toggle button - only visible on desktop */}
            <button
              onClick={onToggleSidebar}
              className={`p-2 hover:bg-gray-100 rounded-full text-gray-800 transition-colors ${sidebarOpen ? 'bg-gray-50' : ''
                }`}
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              aria-expanded={sidebarOpen}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Image
              src="/logo.png"
              alt="Calsiter Inc Logo"
              width={270}
              height={72}
              className="h-16 w-auto"
              priority
            />
            {/* Location Selector - Added after logo */}
            <LocationSelector
              onLocationSelect={(location) => {
                console.log('Selected location:', location);
                // Handle location selection here
              }}
              className="ml-4 max-w-[200px] xl:max-w-[300px]"
            />
          </div>

          {/* Center search - Desktop */}
          <div className="flex flex-1 max-w-2xl mx-8">
            <form onSubmit={handleSearch} className="flex w-full" ref={searchFormRef}>
              <div className="flex-1 relative" ref={dropdownRootRef}>
                <SearchField
                  placeholder="Search restaurants and foods"
                  value={searchQuery}
                  onChange={(v) => { setSearchQuery(v); setIsDropdownOpen(true); }}
                  onClick={() => setIsDropdownOpen(true)}
                  className=""
                  inputClassName="pl-10 pr-4 py-2 border border-gray-300 rounded-l-full rounded-r-none focus:outline-none focus:ring-0 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setIsDropdownOpen(true); commitSearch(); } }}
                />
                {isDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                    <div className="p-3 max-h-[70vh] overflow-y-auto">
                      {searchQuery.trim().length === 0 ? (
                        recentList.length > 0 ? (
                          <div>
                            <div className="text-sm text-gray-500 mb-2">Recent searches</div>
                            <ul className="bg-white text-left">
                              {recentList.map((text) => (
                                <li key={text}>
                                  <button
                                    onClick={() => { setSearchQuery(text); commitSearch(text); }}
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
                        !hasCommittedSearch ? (
                          <div>
                            <div className="text-sm text-gray-500 mb-2">Suggested searches</div>
                            <ul className="bg-white text-left">
                              {(() => {
                                const q = searchQuery.trim();
                                if (!q) return null;
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
                                }).slice(0, 12);
                                return list.map((s) => (
                                  <li key={s.text}>
                                    <button
                                      onClick={() => { setSearchQuery(s.text); commitSearch(s.text); }}
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
                                ));
                              })()}
                            </ul>
                          </div>
                        ) : (
                          (() => {
                            const q = normalizeQuery(searchQuery);
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
                            const isFetching = isLoading || isCategoryLoading || isProductLoading;
                            if (combined.length === 0 && isFetching) {
                              return (
                                <div className="grid grid-cols-1 gap-6">
                                  {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="animate-pulse flex items-center gap-4">
                                      <div className="w-20 h-20 rounded-xl bg-gray-200" />
                                      <div className="flex-1">
                                        <div className="h-4 bg-gray-200 rounded w-2/3" />
                                        <div className="mt-2 h-3 bg-gray-200 rounded w-1/2" />
                                        <div className="mt-3 flex gap-2">
                                          <div className="h-4 bg-gray-200 rounded w-16" />
                                          <div className="h-4 bg-gray-200 rounded w-12" />
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            if (combined.length === 0) {
                              return <div className="text-left text-gray-500">No matching merchants</div>;
                            }
                            return (
                              <div className="grid grid-cols-1 gap-6">
                                {combined.map((merchant) => (
                                  <LocationMerchantCard
                                    key={merchant.id}
                                    merchant={merchant}
                                    variant="list"
                                    isWishlisted={wishlistIds.has(String(merchant.id))}
                                    onToggleWishlist={toggleWishlist}
                                  />
                                ))}
                              </div>
                            );
                          })()
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="h-10 px-6 bg-gray-100 border border-l-0 border-gray-300 rounded-r-full hover:bg-gray-200 text-gray-700 flex items-center justify-center shadow-sm"
                aria-label="Search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>

            </form>
          </div>

          {/* Right section - Desktop */}
          <div className="flex items-center space-x-4">
            {/* Cart Icon */}
            <button
              onClick={() => router.push('/carts' as any)}
              className="relative p-2 hover:bg-gray-100 rounded-full text-gray-600 hover:text-gray-800 transition-colors"
              aria-label="Shopping Cart"
            >
              <i className="fas fa-shopping-cart text-lg"></i>
              {totalQuantity > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[11px] font-semibold flex items-center justify-center leading-none"
                  style={{ backgroundColor: '#eba236' }}
                >
                  {totalQuantity}
                </span>
              )}
            </button>

            {/* Notification Bell Icon - Desktop with Popup */}
            <div className="relative" ref={notificationPopupRef}>
              <button
                onClick={toggleNotificationPopup}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-600 hover:text-gray-800 transition-colors relative"
                aria-label="Notifications"
              >
                <i className="fas fa-bell text-lg"></i>
                {/* Unread Badge */}
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>

              {/* Notification Popup */}
              <NotificationPopup
                isOpen={isNotificationPopupOpen}
                onClose={() => setIsNotificationPopupOpen(false)}
                notifications={notifications}
                onMarkAsRead={handleMarkAsRead}
                onMarkAllAsRead={handleMarkAllAsRead}
              />
            </div>

            {/* User Profile */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={toggleProfileDropdown}
                className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Profile menu"
                aria-expanded={isProfileDropdownOpen}
              >
                <UserAvatar size="md" showOnlineStatus />
                <svg className={`w-4 h-4 text-gray-500 transition-transform ${isProfileDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* User Dropdown Menu */}
              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                      <UserAvatar size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {displayName}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {user?.email}
                        </p>
                        {user?.role && (
                          <div className="flex items-center mt-1">
                            <span className="text-xs text-blue-600 font-medium capitalize">
                              {user.role}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <button className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Profile Settings
                    </button>
                    <button className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Account Settings
                    </button>
                    <button className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h6v-2H4v2zM4 15h8v-2H4v2zM4 11h10V9H4v2zM4 7h12V5H4v2z" />
                      </svg>
                      Notifications
                    </button>
                    <button className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Help & Support
                    </button>
                  </div>

                  {/* Logout Section */}
                  <div className="border-t border-gray-100 py-1">
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {isLoggingOut ? (
                        <svg className="w-4 h-4 mr-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      )}
                      {isLoggingOut ? 'Signing out...' : 'Sign out'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
