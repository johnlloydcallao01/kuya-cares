"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SearchField from "@/components/ui/SearchField";
import { toast } from "react-hot-toast";
import { addMerchantToWishlist, getWishlistMerchantIdsForCurrentUser, removeMerchantFromWishlist } from "@/lib/client-services/wishlist-service";

export default function MobileStickyHeader() {
  const [bgAlpha, setBgAlpha] = useState(0);
  const [hideActions, setHideActions] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const merchantId = useMemo(() => {
    const p = String(pathname || "");
    const parts = p.split("/").filter(Boolean);
    const idx = parts.indexOf("merchant");
    const slugId = idx >= 0 ? parts[idx + 1] : "";
    const idPart = slugId ? slugId.split("-").pop() || "" : "";
    const idNum = Number(idPart);
    return Number.isFinite(idNum) ? idNum : null;
  }, [pathname]);

  const handleBack = () => {
    // Prefer going back in history; fall back to home when no history
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  useEffect(() => {
    const onScroll = () => {
      const y = typeof window !== "undefined" ? window.scrollY : 0;
      const alpha = Math.max(0, Math.min(1, y / 350));
      setBgAlpha(alpha);
      setHideActions(y >= 350);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!merchantId) {
          setIsWishlisted(false);
          return;
        }
        const ids = await getWishlistMerchantIdsForCurrentUser();
        if (cancelled) return;
        const setIds = new Set(ids.map((v) => String(v)));
        setIsWishlisted(setIds.has(String(merchantId)));
      } catch {}
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  const toggleWishlist = useCallback(() => {
    if (!merchantId) {
      toast.error("Unable to update wishlist");
      return;
    }
    setIsWishlisted((prev) => {
      const willAdd = !prev;
      (async () => {
        try {
          if (willAdd) {
            await addMerchantToWishlist(merchantId);
            toast.success("Added to wishlist", { id: `wishlist-${merchantId}` });
          } else {
            await removeMerchantFromWishlist(merchantId);
            toast.success("Removed from wishlist", { id: `wishlist-${merchantId}` });
          }
        } catch (err) {
          setIsWishlisted(!willAdd);
          const message = err instanceof Error && err.message ? err.message : "Wishlist update failed";
          toast.error(message, { id: `wishlist-${merchantId}-error` });
        }
      })();
      return willAdd;
    });
  }, [merchantId]);

  const handleShare = useCallback(async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const title = document.title || "Merchant";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
        return;
      }
      toast.error("Sharing not supported");
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Failed to share";
      toast.error(message);
    }
  }, []);


  return (
    <div className="sticky top-0 left-0 right-0 z-50 lg:block lg:top-16">
      <div
        className={
          "w-full px-[10px] h-[45px] min-h-[45px] max-h-[45px] flex items-center justify-between transition-colors duration-200"
        }
        style={{ backgroundColor: `rgba(255,255,255,${bgAlpha})` }}
      >
        <button
          aria-label="Back"
          className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center"
          onClick={handleBack}
        >
          <i className="fas fa-arrow-left text-[14px] text-[#333]"></i>
        </button>
        {hideActions && (
          <div className="flex-1 px-2">
            <SearchField
              placeholder="Search menu"
              value={""}
              onChange={() => {}}
              readOnly
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("merchant:open-search"));
                }
              }}
            />
          </div>
        )}
        {hideActions ? (
          <div className="flex items-center gap-2">
            <button
              aria-label="More"
              className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center"
            >
              <i className="fas fa-ellipsis-v text-[14px] text-[#333]"></i>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              aria-label="Information"
              className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center"
            >
              <i className="fas fa-info text-[14px] text-[#333]"></i>
            </button>
            <button
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              aria-pressed={isWishlisted}
              onClick={toggleWishlist}
              className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center"
            >
              <i className={`${isWishlisted ? "fas" : "fa-regular"} fa-heart text-[14px]`} style={{ color: isWishlisted ? "#f3a823" : "#333" }}></i>
            </button>
            <button
              aria-label="Share"
              onClick={handleShare}
              className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center"
            >
              <i className="fa-regular fa-share-from-square text-[14px] text-[#333]"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
