import type { Metadata } from 'next'
import { ProductService } from '@/server/services/product-service'
import ProductDetailClient from '@/components/merchant/ProductDetailClient'

type RouteParams = { slugId?: string | string[]; productSlugId?: string | string[] }
type PageProps = { params?: Promise<RouteParams> }

function slugToId(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw?.[0] : raw
  const s = v ? v.toString() : ''
  const id = s.split('-').pop() || ''
  return id
}

function getImageUrl(media: any): string | null {
  if (!media) return null
  return media.cloudinaryURL || media.url || media.thumbnailURL || null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = (await params) ?? {}
  const productId = slugToId(resolved.productSlugId)
  if (!productId) return { title: 'Product | Tap2Go' }

  // Keep metadata generation server-side for SEO
  const product = await ProductService.getProductWithModifiers(productId)
  if (!product) return { title: 'Product | Tap2Go' }

  const titleBase: string = product?.name || 'Product'
  const ogImage = getImageUrl(product?.media?.primaryImage)
  return {
    title: `${titleBase} | Tap2Go`,
    description: product?.shortDescription || undefined,
    openGraph: { title: `${titleBase} | Tap2Go`, description: product?.shortDescription || undefined, images: ogImage ? [{ url: ogImage }] : undefined },
    twitter: { card: 'summary_large_image', title: `${titleBase} | Tap2Go`, description: product?.shortDescription || undefined, images: ogImage ? [ogImage] : undefined },
  }
}

export default async function ProductPage({ params }: PageProps) {
  const resolved = (await params) ?? {}
  const merchantSlugId = Array.isArray(resolved.slugId) ? resolved.slugId?.[0] : resolved.slugId
  const productId = slugToId(resolved.productSlugId)

  // Render the client component which handles fetching and display
  return (
    <ProductDetailClient 
      merchantSlugId={merchantSlugId || ''} 
      productId={productId} 
    />
  )
}
