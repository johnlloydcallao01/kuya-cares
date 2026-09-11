/**
 * Zod validation schemas for CMS data
 */

import { z } from 'zod';

// ========================================
// POST SCHEMAS
// ========================================

export const PostFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  slug: z.string()
    .min(1, 'Slug is required')
    .max(100, 'Slug too long')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  content: z.any().refine(val => val !== null && val !== undefined, 'Content is required'), // Lexical editor state
  excerpt: z.string().max(500, 'Excerpt too long').optional(),
  featuredImage: z.number().optional(),
  status: z.enum(['draft', 'published']),
  publishedAt: z.string().optional(),
  author: z.number().refine(val => val > 0, 'Author is required'),
  tags: z.array(z.object({
    tag: z.string().min(1).max(50),
    id: z.string().optional()
  })).optional(),
  seo: z.object({
    title: z.string().max(60, 'SEO title too long').optional(),
    description: z.string().max(160, 'SEO description too long').optional(),
    focusKeyword: z.string().max(100, 'Focus keyword too long').optional(),
  }).optional(),
});

export const PostFiltersSchema = z.object({
  status: z.enum(['draft', 'published']).optional(),
  author: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(10),
  page: z.number().min(1).default(1),
});

// ========================================
// MEDIA SCHEMAS
// ========================================

export const MediaUploadSchema = z.object({
  file: z.instanceof(File),
  alt: z.string().min(1, 'Alt text is required').max(200, 'Alt text too long'),
});

// ========================================
// VALIDATION HELPERS
// ========================================

export function validatePostForm(data: unknown) {
  return PostFormSchema.safeParse(data);
}

export function validatePostFilters(data: unknown) {
  return PostFiltersSchema.safeParse(data);
}

export function validateMediaUpload(data: unknown) {
  return MediaUploadSchema.safeParse(data);
}

// ========================================
// TYPE EXPORTS
// ========================================

export type PostFormData = z.infer<typeof PostFormSchema>;
export type PostFiltersData = z.infer<typeof PostFiltersSchema>;
export type MediaUploadData = z.infer<typeof MediaUploadSchema>;
