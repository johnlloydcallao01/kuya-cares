"use client";

import React from "react";
import MerchantProductGrid from "@/components/merchant/MerchantProductGrid";
import { Skeleton } from "@/components/ui/Skeleton";

type ProductCardItem = {
  id: string | number;
  name: string;
  productType: string;
  basePrice: number | null;
  compareAtPrice: number | null;
  shortDescription: string | null;
  imageUrl: string | null;
  categoryIds?: number[];
};

type MerchantCategoryDisplay = {
  id: number;
  name: string;
  slug: string;
  media?: { icon?: any | null };
};

export default function MerchantProductsClient({ merchantId }: { merchantId: string }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [products, setProducts] = React.useState<ProductCardItem[]>([]);
  const [categories, setCategories] = React.useState<MerchantCategoryDisplay[]>([]);
  const [page, setPage] = React.useState<number>(1);
  const [hasMore, setHasMore] = React.useState<boolean>(false);
  const [loadingMore, setLoadingMore] = React.useState<boolean>(false);
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://cms.tap2goph.com/api";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
    if (apiKey) headers["Authorization"] = `users API-Key ${apiKey}`;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `${API_BASE}/merchant-products?where[merchant_id][equals]=${merchantId}&where[is_active][equals]=true&where[is_available][equals]=true&depth=2&limit=48&page=1&t=${Date.now()}`;
        const res = await fetch(url, { headers, cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        const docs: any[] = (data?.docs || []).filter((mp: any) => mp?.product_id?.catalogVisibility !== "hidden");
        const categoryMap = new Map<number, any>();
        const items: ProductCardItem[] = docs.map((mp) => {
          const product = mp?.product_id || null;
          const primaryImage = product?.media?.primaryImage || null;
          const imageUrl = primaryImage?.cloudinaryURL || primaryImage?.url || primaryImage?.thumbnailURL || null;
          const rawCats = Array.isArray(product?.categories) ? product.categories : [];
          const categoryIds: number[] = [];
          rawCats.forEach((c: any) => {
            const id = typeof c === "number" ? c : typeof c?.id === "number" ? c.id : null;
            if (typeof id === "number") {
              categoryIds.push(id);
              if (typeof c === "object" && c) {
                const icon = c?.media?.icon || null;
                categoryMap.set(id, { id, name: c?.name, slug: c?.slug, media: { icon } });
              }
            }
          });
          return {
            id: product?.id ?? mp?.id,
            name: product?.name ?? "",
            productType: product?.productType ?? "simple",
            basePrice: product?.basePrice ?? null,
            compareAtPrice: product?.compareAtPrice ?? null,
            shortDescription: product?.shortDescription ?? "",
            imageUrl,
            categoryIds,
          };
        });

        const collectedIds = new Set<number>();
        items.forEach((it) => (it.categoryIds || []).forEach((cid) => collectedIds.add(cid)));
        const ids = Array.from(collectedIds);
        let uniqueCategories = Array.from(categoryMap.values());

        if (ids.length > 0) {
          const catUrl = `${API_BASE}/product-categories?where[id][in]=${ids.join(",")}&limit=${ids.length}&depth=1&t=${Date.now()}`;
          const catRes = await fetch(catUrl, { headers, cache: "no-store", signal: controller.signal });
          if (catRes.ok) {
            const catData = await catRes.json();
            const cats = Array.isArray(catData?.docs) ? catData.docs : [];
            const byId = new Map<number, any>();
            cats.forEach((c: any) => {
              if (typeof c?.id === "number") {
                byId.set(c.id, { id: c.id, name: c?.name, slug: c?.slug, media: { icon: c?.media?.icon } });
              }
            });
            uniqueCategories = ids.map((cid) => byId.get(cid) || categoryMap.get(cid)).filter((c: any) => c && c.id);
          }
        }

        if (!active) return;
        const initialItems = items.filter((p) => p && p.name);
        setProducts(initialItems);
        setCategories([...uniqueCategories, { id: 0, name: "Uncategorized", slug: "uncategorized" }]);
        const currentPage = Number(data?.page ?? 1);
        const totalPages = Number(data?.totalPages ?? (data?.hasNextPage ? currentPage + 1 : currentPage));
        const nextPossible = Boolean(data?.hasNextPage ?? (currentPage < totalPages));
        setPage(currentPage);
        setHasMore(nextPossible);
        setLoading(false);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message || "Failed to load products");
        setLoading(false);
      }
    };

    run();
    return () => {
      active = false;
      controller.abort();
    };
  }, [merchantId]);

  const loadNextPage = React.useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const controller = new AbortController();
    try {
      setLoadingMore(true);
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://cms.tap2goph.com/api";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
      if (apiKey) headers["Authorization"] = `users API-Key ${apiKey}`;
      const nextPage = page + 1;
      const url = `${API_BASE}/merchant-products?where[merchant_id][equals]=${merchantId}&where[is_active][equals]=true&where[is_available][equals]=true&depth=2&limit=48&page=${nextPage}&t=${Date.now()}`;
      const res = await fetch(url, { headers, cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const docs: any[] = (data?.docs || []).filter((mp: any) => mp?.product_id?.catalogVisibility !== "hidden");
      const categoryMap = new Map<number, any>();
      const newItems: ProductCardItem[] = docs.map((mp) => {
        const product = mp?.product_id || null;
        const primaryImage = product?.media?.primaryImage || null;
        const imageUrl = primaryImage?.cloudinaryURL || primaryImage?.url || primaryImage?.thumbnailURL || null;
        const rawCats = Array.isArray(product?.categories) ? product.categories : [];
        const categoryIds: number[] = [];
        rawCats.forEach((c: any) => {
          const id = typeof c === "number" ? c : typeof c?.id === "number" ? c.id : null;
          if (typeof id === "number") {
            categoryIds.push(id);
            if (typeof c === "object" && c) {
              const icon = c?.media?.icon || null;
              categoryMap.set(id, { id, name: c?.name, slug: c?.slug, media: { icon } });
            }
          }
        });
        return {
          id: product?.id ?? mp?.id,
          name: product?.name ?? "",
          productType: product?.productType ?? "simple",
          basePrice: product?.basePrice ?? null,
          compareAtPrice: product?.compareAtPrice ?? null,
          shortDescription: product?.shortDescription ?? "",
          imageUrl,
          categoryIds,
        };
      });
      const collectedIds = new Set<number>();
      newItems.forEach((it) => (it.categoryIds || []).forEach((cid) => collectedIds.add(cid)));
      const ids = Array.from(collectedIds);
      let mergedCategories = [...categories];
      if (ids.length > 0) {
        const API_BASE2 = process.env.NEXT_PUBLIC_API_URL || "https://cms.tap2goph.com/api";
        const catUrl = `${API_BASE2}/product-categories?where[id][in]=${ids.join(",")}&limit=${ids.length}&depth=1&t=${Date.now()}`;
        const catRes = await fetch(catUrl, { headers, cache: "no-store", signal: controller.signal });
        if (catRes.ok) {
          const catData = await catRes.json();
          const cats = Array.isArray(catData?.docs) ? catData.docs : [];
          const byId = new Map<number, any>();
          mergedCategories.forEach((c) => byId.set(c.id, c));
          cats.forEach((c: any) => {
            if (typeof c?.id === "number") {
              byId.set(c.id, { id: c.id, name: c?.name, slug: c?.slug, media: { icon: c?.media?.icon } });
            }
          });
          mergedCategories = Array.from(byId.values()).sort((a, b) => (a.id === 0 ? 1 : b.id === 0 ? -1 : 0));
        }
      }
      const dedup = new Map<string | number, ProductCardItem>();
      products.forEach((p) => dedup.set(p.id, p));
      newItems.forEach((p) => dedup.set(p.id, p));
      setProducts(Array.from(dedup.values()));
      setCategories(mergedCategories);
      const currentPage = Number(data?.page ?? nextPage);
      const totalPages = Number(data?.totalPages ?? (data?.hasNextPage ? currentPage + 1 : currentPage));
      const nextPossible = Boolean(data?.hasNextPage ?? (currentPage < totalPages));
      setPage(currentPage);
      setHasMore(nextPossible);
    } catch (e: any) {
      setError(e?.message || "Failed to load products");
    } finally {
      setLoadingMore(false);
    }
  }, [merchantId, page, hasMore, loadingMore, products, categories]);

  React.useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          loadNextPage();
        }
      });
    }, { root: null, threshold: 0.1, rootMargin: "300px 0px 600px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadNextPage]);

  if (error) {
    return <div className="w-full py-6 bg-white rounded-t-[25px] shadow-[0_14px_36px_rgba(0,0,0,0.24)] text-center text-red-600">{error}</div>;
  }

  return (
    <div className="w-full py-6 bg-white rounded-t-[25px] shadow-[0_14px_36px_rgba(0,0,0,0.24)]">
      {loading ? (
        <>
          <div className="mb-4 px-2.5 sticky top-[45px] lg:top-[105px] z-40 bg-white">
            <div className="flex py-2 gap-2 overflow-x-auto">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-24 rounded-full" />
              ))}
            </div>
          </div>
          <div className="px-2.5">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-x-4 gap-y-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="relative aspect-square">
                    <Skeleton className="absolute inset-0 rounded-none" />
                  </div>
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : products && products.length > 0 ? (
        <>
          <MerchantProductGrid products={products} categories={categories} />
          <div ref={loadMoreRef} />
          {loadingMore && (
            <div className="px-2.5 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-x-4 gap-y-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <div className="relative aspect-square">
                      <Skeleton className="absolute inset-0 rounded-none" />
                    </div>
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-gray-500">No products available</div>
      )}
    </div>
  );
}
