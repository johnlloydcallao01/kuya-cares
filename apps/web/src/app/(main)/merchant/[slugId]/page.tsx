import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from '@/components/ui/ImageWrapper';
import { BackButton } from '@/components/ui/BackButton';
import { getMerchantById, getActiveAddressNameByMerchantId } from '@/server/services/merchant-service';
import type { Merchant, Media } from '@encreasl/client-services';
import MobileStickyHeader from '@/components/merchant/MobileStickyHeader';
import MerchantProductsClient from '@/components/merchant/MerchantProductsClient';

type RouteParams = { slugId?: string | string[] };
type PageProps = { params?: Promise<RouteParams> };

function getImageUrl(media: Media | null | undefined): string | null {
  if (!media) return null;
  return media.cloudinaryURL || media.url || media.thumbnailURL || null;
}


export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = (await params) ?? {};
  const rawSlugId = resolved.slugId;
  const slugId = Array.isArray(rawSlugId) ? rawSlugId?.[0] : rawSlugId;
  const id = slugId ? slugId.toString().split('-').pop() || '' : '';
  if (!id) {
    return {
      title: 'Restaurant Not Found | Tap2Go',
      description: 'The requested restaurant could not be found.'
    };
  }
  const merchant = await getMerchantById(id);
  if (!merchant) {
    return {
      title: 'Restaurant Not Found | Tap2Go',
      description: 'The requested restaurant could not be found.'
    };
  }

  const titleBase = merchant.outletName || 'Restaurant';
  const vendorName = merchant.vendor?.businessName ? ` | ${merchant.vendor.businessName}` : '';
  const title = `${titleBase}${vendorName} | Tap2Go`;

  const thumbnail = getImageUrl(merchant.media?.thumbnail);
  const storeFront = getImageUrl(merchant.media?.storeFrontImage);
  const ogImage = storeFront || thumbnail || merchant.vendor?.logo?.cloudinaryURL || merchant.vendor?.logo?.url || undefined;

  return {
    title,
    description: merchant.description || `View details for ${titleBase} on Tap2Go, including operating hours, contact information, and delivery options.`,
    openGraph: {
      title,
      description: merchant.description || undefined,
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: 'website'
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: merchant.description || undefined,
      images: ogImage ? [ogImage] : undefined
    }
  };
}


export default async function MerchantPage({ params }: PageProps) {
  const resolved = (await params) ?? {};
  const rawSlugId = resolved.slugId;
  const slugId = Array.isArray(rawSlugId) ? rawSlugId?.[0] : rawSlugId;
  const id = slugId ? slugId.toString().split('-').pop() || '' : '';
  const merchant: Merchant | null = id ? await getMerchantById(id) : null;
  if (!merchant) {
    notFound();
  }

  const heroImage = getImageUrl(merchant.media?.storeFrontImage) || getImageUrl(merchant.media?.thumbnail);
  const vendorLogo = getImageUrl(merchant.vendor?.logo);
  const isOpenNow = merchant.isOpenNow ?? (merchant.operationalStatus === 'open' && merchant.isAcceptingOrders);
  const operationalStatus = isOpenNow ? 'open' : 'closed';

  const statusColor = operationalStatus === 'open'
    ? 'bg-green-600'
    : operationalStatus === 'busy'
      ? 'bg-yellow-500'
      : 'bg-red-600';

  // Build display name using active address from production CMS
  const addressName = id ? await getActiveAddressNameByMerchantId(id) : null;
  const displayName = addressName ? `${merchant.outletName} - ${addressName}` : merchant.outletName;

  const formatPrice = (value: number | null) => {
    if (value == null) return null;
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page-exclusive sticky transparent header (mobile/tablet) with scroll opacity */}
      <MobileStickyHeader />

      {/* Hero Section */}
      <div className="relative w-full aspect-[3/1] md:h-[280px] md:aspect-auto -mt-12 lg:-mt-12">
        {heroImage ? (
          <Image src={heroImage} alt={`${merchant.outletName} storefront`} fill className="object-cover" priority />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300" />
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute bottom-0 left-1/2 z-10 transform -translate-x-1/2 translate-y-[35%]">
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg overflow-hidden bg-white/20 backdrop-blur-sm border border-white/30">
            {vendorLogo ? (
              <Image src={vendorLogo} alt={`${merchant.vendor?.businessName || 'Vendor'} logo`} width={64} height={64} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/80">{merchant.vendor?.businessName?.charAt(0) || 'R'}</div>
            )}
          </div>
        </div>
      </div>

      {/* Details Section */}
      <div className="w-full px-2.5 py-6">
        <div className="grid grid-cols-1 gap-6">
          {/* Main column: description, hours, media */}
          <div className="space-y-6">
            {/* Merchant name + active address below the logo */}
            <div>
              <h1 className="text-xl font-semibold text-gray-900 line-clamp-2">{displayName}</h1>
            </div>
            {/* Description */}
            {merchant.description && (
              <section className="bg-white rounded-lg shadow-sm p-5">
                <h2 className="text-lg font-semibold text-gray-900">About</h2>
                <p className="text-gray-700 mt-2 whitespace-pre-line">{merchant.description}</p>
              </section>
            )}

            {/* Operating Hours */}
            {merchant.operatingHours && (
              <section className="bg-white rounded-lg shadow-sm p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">Operating Hours</h2>
                  <span className={isOpenNow ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>{isOpenNow ? 'Open Now' : 'Closed'}</span>
                </div>
                {!isOpenNow && merchant.nextOpeningAt && <p className="mt-1 text-sm text-gray-500">Next opening: {new Date(merchant.nextOpeningAt).toLocaleString()}</p>}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-gray-700">
                  {Object.entries(merchant.operatingHours).map(([day, value]) => (
                    <div key={day} className="flex justify-between">
                      <span className="capitalize text-gray-600">{day}</span>
                      <span className="font-medium">{value || '—'}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Media Gallery */}
            {merchant.menuImages && merchant.menuImages.length > 0 && (
              <section className="bg-white rounded-lg shadow-sm p-5">
                <h2 className="text-lg font-semibold text-gray-900">Menu & Photos</h2>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {merchant.menuImages.map((m, idx) => {
                    const url = getImageUrl(m);
                    return (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                        {url ? (
                          <Image src={url} alt={m.alt || `Photo ${idx + 1}`} fill className="object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-400">No image</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Right column removed per request */}
        </div>
      </div>
    
      <MerchantProductsClient merchantId={id} />
    </div>
  );
}
