"use client";

import React from "react";
import Image from "@/components/ui/ImageWrapper";
import Link from "next/link";
import type { Media, LocationBasedMerchant } from "@encreasl/client-services";

interface LocationMerchantCardProps {
  merchant: LocationBasedMerchant;
  isWishlisted?: boolean;
  onToggleWishlist?: (id: string) => void;
  addressName?: string | null;
  variant?: 'card' | 'list';
  hideDistance?: boolean;
}

function getImageUrl(media: Media | null | undefined): string | null {
  if (!media) return null;
  return media.cloudinaryURL || media.url || media.thumbnailURL || null;
}

function getOwnerName(merchant: { vendor?: unknown }): string | null {
  const user = (merchant.vendor as { user?: unknown } | null | undefined)?.user;
  if (!user || typeof user !== 'object') return null;
  const record = user as Record<string, unknown>;
  // PostGIS maps to camelCase; Payload depth=2 is camelCase; tolerate snake_case.
  const first =
    (record.firstName as string | undefined) ??
    (record.first_name as string | undefined) ??
    '';
  const last =
    (record.lastName as string | undefined) ??
    (record.last_name as string | undefined) ??
    '';
  const full = `${String(first ?? '')} ${String(last ?? '')}`.trim();
  return full || null;
}

function getVendorName(merchant: { outletName?: unknown; vendor?: unknown }): string | null {
  const business = ((merchant.vendor as { businessName?: unknown } | null | undefined)?.businessName as string | undefined) || '';
  if (!business.trim()) return null;
  // Skip when identical to the outlet name (already shown above it).
  const outlet = typeof merchant.outletName === 'string' ? merchant.outletName : '';
  if (business.trim().toLowerCase() === outlet.trim().toLowerCase()) return null;
  return business;
}

function formatDistanceKm(distanceKm?: number): string | null {
  if (typeof distanceKm !== "number") return null;
  // Explicit 0km: same-spot merchants show their distance, never a blank badge.
  if (distanceKm <= 0) return '0km';
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)}m`;
  return `${distanceKm.toFixed(1)}km`;
}

export default function LocationMerchantCard({ merchant, isWishlisted = false, onToggleWishlist, addressName = null, variant = 'card', hideDistance = false }: LocationMerchantCardProps) {
  const thumbnailImageUrl = getImageUrl(merchant.media?.thumbnail);
  const altText = merchant.media?.thumbnail?.alt || `${merchant.outletName} thumbnail`;
  const vendorLogoUrl = getImageUrl(merchant.vendor?.logo);
  const listImageUrl = vendorLogoUrl || thumbnailImageUrl || "/placeholder-merchant.jpg";
  const listImageAlt = vendorLogoUrl ? `${merchant.vendor?.businessName || merchant.outletName || "Vendor"} logo` : altText;
  const distanceKm = (merchant as any)?.distanceKm as number | undefined;
  const distanceInMeters = (merchant as any)?.distanceInMeters as number | undefined;
  const rawDistanceText = typeof distanceKm === "number" ? formatDistanceKm(distanceKm) : (typeof distanceInMeters === "number" ? formatDistanceKm(distanceInMeters / 1000) : null);
  // Show All scope is location-agnostic: browsing rows carry placeholder 0km.
  // Never show the badge in that mode, even if callers forget to pass the prop.
  const isShowAllScope = (() => {
    try {
      if (typeof window === 'undefined') return false;
      return window.localStorage.getItem('kuyacares_show_all') === '1';
    } catch {
      return false;
    }
  })();
  const distanceText = (hideDistance || isShowAllScope) ? null : rawDistanceText;
  const rating = typeof merchant.metrics?.averageRating === "number" ? merchant.metrics.averageRating : null;

  const trackRecentView = (merchantId: string | number) => {
    try {
      if (typeof window === "undefined") return;
      const userStr = window.localStorage.getItem("grandline_auth_user");
      const userId = userStr
        ? (() => {
            try {
              return JSON.parse(userStr)?.id;
            } catch {
              return null;
            }
          })()
        : null;
      if (!userId) return;
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://cms.kuyacares.com/api";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
      if (apiKey) headers["Authorization"] = `users API-Key ${apiKey}`;
      const body = JSON.stringify({
        user: userId,
        itemType: "merchant",
        merchant: merchantId,
        source: "web",
      });
      const compositeKey = `${userId}:merchant:${merchantId}`;
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/recent-views`, {
            method: "POST",
            headers,
            body,
          });
          if (res.ok) return;
          const existsUrl = `${API_BASE}/recent-views?where[compositeKey][equals]=${encodeURIComponent(
            compositeKey,
          )}&limit=1`;
          const getRes = await fetch(existsUrl, { headers });
          if (!getRes.ok) return;
          const data = await getRes.json();
          const id = data?.docs?.[0]?.id;
          if (!id) return;
          await fetch(`${API_BASE}/recent-views/${id}`, {
            method: "PATCH",
            headers,
            body: "{}",
          });
        } catch {}
      })();
    } catch {}
  };

  return (
    <>
      {(() => {
        const LinkComponent = Link as any;
        const slug = (merchant.outletName || `${merchant.vendor?.businessName || ''}` || `${merchant.id}`)
          .toString()
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
        const slugId = `${slug}-${merchant.id}`;
        if (variant === 'list') {
          return (
            <LinkComponent
              href={`/merchant/${slugId}`}
              className="group block"
              onClick={() => trackRecentView(merchant.id)}
            >
              <div className="flex items-center gap-4 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100">
                  <Image
                    src={listImageUrl}
                    alt={listImageAlt}
                    fill
                    sizes="80px"
                    className={vendorLogoUrl ? "object-contain bg-white" : "object-cover"}
                  />
                  {distanceText && (
                    <div className="absolute top-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full">{distanceText}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                        {addressName ? `${merchant.outletName} - ${addressName}` : merchant.outletName}
                      </h3>
                      {getVendorName(merchant) && (
                        <p className="text-sm text-gray-600 truncate">{getVendorName(merchant)}</p>
                      )}
                      {getOwnerName(merchant) && (
                        <p className="text-[11px] text-gray-400 truncate">
                          <i className="fas fa-user mr-1" />
                          by {getOwnerName(merchant)}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                      aria-pressed={isWishlisted}
                      onClick={(e) => {
                        e.preventDefault();
                        onToggleWishlist && onToggleWishlist(merchant.id);
                      }}
                      className="w-[28px] h-[28px] rounded-full bg-white flex items-center justify-center shadow-sm hover:shadow-md"
                    >
                      <i className={`fas fa-heart text-[16px]`} style={{ color: isWishlisted ? "#239459" : "#ffffff", WebkitTextStroke: "2px #333" }}></i>
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                    {typeof rating === 'number' && (
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400">★</span>
                        <span>{rating.toFixed(1)}</span>
                      </div>
                    )}
                    {merchant.metrics?.totalOrders && <span>({merchant.metrics.totalOrders} orders)</span>}
                    {!!merchant.estimatedDeliveryTime && String(merchant.estimatedDeliveryTime).trim() !== '' && (
                      <span className="ml-2 text-gray-600">{merchant.estimatedDeliveryTime} min delivery</span>
                    )}
                  </div>
                </div>
              </div>
            </LinkComponent>
          );
        }
        return (
          <LinkComponent
            href={`/merchant/${slugId}`}
            className="group cursor-pointer block"
            onClick={() => trackRecentView(merchant.id)}
          >
            <div className="relative aspect-[2/1] bg-gray-100 rounded-lg overflow-visible mb-6 group-hover:shadow-lg transition-shadow duration-200">
              {thumbnailImageUrl ? (
                <div className="relative w-full h-full">
                  <Image
                    src={thumbnailImageUrl}
                    alt={altText}
                    fill
                    sizes="(max-width: 650px) 75vw, (max-width: 1024px) 30vw, (max-width: 1280px) 25vw, 320px"
                    className="object-cover rounded-lg"
                  />
                </div>
              ) : (
                <div className="relative w-full h-full">
                  <Image
                    src="/placeholder-merchant.jpg"
                    alt="Merchant placeholder"
                    fill
                    sizes="(max-width: 650px) 75vw, (max-width: 1024px) 30vw, (max-width: 1280px) 25vw, 320px"
                    className="object-cover rounded-lg"
                  />
                </div>
              )}
              {distanceText && (
                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">{distanceText}</div>
              )}
              <button
                type="button"
                aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                aria-pressed={isWishlisted}
                onClick={(e) => {
                  e.preventDefault();
                  onToggleWishlist && onToggleWishlist(merchant.id);
                }}
                className="absolute top-2 right-2 w-[28px] h-[28px] rounded-full bg-white flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
                style={{ zIndex: 2 }}
              >
                <i className={`fas fa-heart text-[16px]`} style={{ color: isWishlisted ? "#239459" : "#ffffff", WebkitTextStroke: "2px #333" }}></i>
              </button>
              {vendorLogoUrl && (
                <div className="absolute -bottom-4 left-0 w-12 h-12 bg-white rounded-full shadow-lg border-2 border-white">
                  <Image
                    src={vendorLogoUrl}
                    alt={`${merchant.vendor?.businessName || "Vendor"} logo`}
                    fill
                    className="object-contain rounded-full"
                    sizes="48px"
                  />
                </div>
              )}
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                {addressName ? `${merchant.outletName} - ${addressName}` : merchant.outletName}
              </h3>
              {getVendorName(merchant) && (
                <p className="text-sm text-gray-600 line-clamp-1">{getVendorName(merchant)}</p>
              )}
              {getOwnerName(merchant) && (
                <p className="text-[11px] text-gray-400 line-clamp-1">
                  <i className="fas fa-user mr-1" />
                  by {getOwnerName(merchant)}
                </p>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                {typeof rating === "number" && (
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400">★</span>
                    <span>{rating.toFixed(1)}</span>
                  </div>
                )}
                {merchant.metrics?.totalOrders && <span>({merchant.metrics.totalOrders} orders)</span>}
              </div>
              {!!merchant.estimatedDeliveryTime && String(merchant.estimatedDeliveryTime).trim() !== '' && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{merchant.estimatedDeliveryTime} min delivery</span>
                </div>
              )}
            </div>
          </LinkComponent>
        );
      })()}
    </>
  );
}
