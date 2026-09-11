'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import {
  Save,
  Eye,
  X,
  AlertCircle,
  RefreshCw,
  FileText,
  Tag as TagIcon,
  Image as ImageIcon,
  Globe,
  CheckCircle,
  Clock,
} from '@/components/ui/IconWrapper';
import { PostFormData, validatePostForm, generateSlug } from '@encreasl/cms-types'
import { useAuth } from '@/hooks/useAuth';
import { getStoredToken } from '@/lib/auth';

// Type for PayloadCMS user object
interface PayloadUser {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  role: string;
};
// CMS config available if needed: import { cmsConfig } from '@/lib/cms';
// Authentication is now handled by middleware
import { RichTextEditor } from './RichTextEditor';
import { MediaUploader } from './MediaUploader';
import { TagInput } from './TagInput';

interface PostEditorProps {
  postId?: string;
  onSave?: (post: unknown) => void;
  onCancel?: () => void;
}

// ── Vendors page design tokens ──────────────────────────────────────────────
// Outer page:       space-y-6 py-5 px-2.5  (owned by the route page)
// Card:             bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm
// Card body:        p-6 space-y-6  (sidebar cards: p-5)
// Section title:    text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2
// Label:            text-xs font-medium text-gray-700 dark:text-[#a1a1aa]
// Input:            mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626]
//                   bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white
//                   placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236]
// Error banner:     bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl
// Primary btn:      bg-[#eba236] hover:bg-[#c88a20] text-white rounded-lg text-sm font-semibold
// Secondary btn:    bg-white dark:bg-[#171717] border-gray-300 dark:border-[#262626] text-gray-700 dark:text-[#a1a1aa]
const inputCls =
  'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236]';
const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]';
const cardCls =
  'bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden';
const sectionTitleCls =
  'text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2';
const secondaryBtnCls =
  'inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed transition';
const primaryBtnCls =
  'inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition';

function statusBadge(status: string) {
  const s = status?.toLowerCase() || 'draft';
  if (s === 'published')
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800';
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-[#262626] dark:text-[#a1a1aa] dark:border-[#333]';
}

export function PostEditor({ postId, onSave, onCancel }: PostEditorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_currentUser, _setCurrentUser] = useState<Record<string, unknown> | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const contentRef = useRef<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<PostFormData>({
    defaultValues: {
      title: '',
      slug: '',
      content: {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              version: 1,
              children: [],
              direction: 'ltr',
              format: '',
              indent: 0
            }
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1
        }
      },
      excerpt: '',
      featuredImage: undefined,
      status: 'draft',
      publishedAt: '',
      author: 1, // Temporary default, will be updated when user is fetched
      tags: [],
      seo: {
        title: '',
        description: '',
        focusKeyword: '',
      },
    },
  });

  const watchedTitle = watch('title');
  const watchedSlug = watch('slug');
  const watchedExcerpt = watch('excerpt');
  const watchedStatus = watch('status');
  const watchedAuthor = watch('author');

  // Auto-generate slug from title
  useEffect(() => {
    if (!postId) {
      const slug = watchedTitle ? generateSlug(watchedTitle) : '';
      setValue('slug', slug, { shouldDirty: true });
    }
  }, [watchedTitle, setValue, postId]);

  const loadPost = useCallback(async (id: string) => {
    // Authentication is now handled by middleware

    setIsLoading(true);
    setError(null);

    try {
      const storedToken = getStoredToken();
      const headers: Record<string, string> = {};
      if (storedToken) {
        headers['Authorization'] = `JWT ${storedToken}`;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/${id}`, {
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch post');
      }

      const data = await response.json();

      if (data.doc || data) {
        const post = data.doc || data;
        const postContent = post.content || {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                version: 1,
                children: [],
                direction: 'ltr',
                format: '',
                indent: 0
              }
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1
          }
        };
        contentRef.current = postContent;
        reset({
          title: post.title || '',
          slug: post.slug || '',
          content: postContent,
          excerpt: post.excerpt || '',
          featuredImage: typeof post.featuredImage === 'object' ? post.featuredImage?.id : post.featuredImage,
          status: post.status || 'draft',
          publishedAt: post.publishedAt || '',
          author: typeof post.author === 'object' ? post.author?.id : post.author,
          tags: post.tags || [],
          seo: {
            title: post.seo?.title || '',
            description: post.seo?.description || '',
            focusKeyword: post.seo?.focusKeyword || '',
          },
        });
      }
    } catch (err) {
      console.error('Failed to load post:', err);
      setError('Failed to load post. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [reset]);

  // Get current user for author field
  const { user: authUser } = useAuth();

  useEffect(() => {
    // Use the authenticated admin user from AuthContext
    if (authUser && authUser.id) {
      const user = authUser as unknown as Record<string, unknown>;
      _setCurrentUser(user);

      // Ensure user.id is a number
      const userId = typeof authUser.id === 'string' ? parseInt(authUser.id, 10) : authUser.id;
      setValue('author', userId);
    }
  }, [authUser, setValue]);

  // Load existing post if editing
  useEffect(() => {
    if (postId) {
      loadPost(postId);
    }
  }, [postId, loadPost]);

  const onSubmit: SubmitHandler<PostFormData> = async (data: PostFormData) => {
    // Authentication is now handled by middleware

    setIsSaving(true);
    setError(null);

    try {
      // Check if author is set
      if (!data.author || data.author <= 0) {
        setError('Author information is required. Please wait for user data to load.');
        return;
      }

      // Validate form data
      const validation = validatePostForm(data);
      if (!validation.success) {
        setError(`Validation failed: ${validation.error?.issues?.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`);
        return;
      }

      // Transform data for PayloadCMS API
      const payloadData = {
        ...data,
        // Convert datetime-local format to ISO string for PayloadCMS
        publishedAt: data.publishedAt ? new Date(data.publishedAt).toISOString() : undefined,
        // Ensure featuredImage is properly formatted
        featuredImage: data.featuredImage || undefined,
        // Ensure tags are properly formatted
        tags: data.tags?.length ? data.tags : undefined,
        // Ensure seo is properly formatted
        seo: data.seo && (data.seo.title || data.seo.description || data.seo.focusKeyword) ? data.seo : undefined,
      };

      // Use the JWT token persisted in localStorage (the payload-token cookie is HttpOnly
      // and is therefore NOT readable via document.cookie)
      const storedToken = getStoredToken();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add Authorization header if we have a token
      if (storedToken) {
        headers['Authorization'] = `JWT ${storedToken}`;
      }

      let response: { id: string; [key: string]: unknown };
      if (postId) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/${postId}`, {
          method: 'PATCH',
          headers,
          credentials: 'include',
          body: JSON.stringify(payloadData),
        });
        if (!res.ok) {
          const errorText = await res.text();
          console.error('❌ Update failed:', res.status, errorText);
          throw new Error(`Failed to update post: ${res.status}`);
        }
        response = await res.json();
      } else {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(payloadData),
        });
        if (!res.ok) {
          const errorText = await res.text();
          console.error('❌ Create failed:', res.status, errorText);
          throw new Error(`Failed to create post: ${res.status}`);
        }
        response = await res.json();
      }

      if (response.doc) {
        onSave?.(response.doc);
      }
    } catch (err: unknown) {
      console.error('Failed to save post:', err);

      // Enhanced error handling
      if (err instanceof Error) {
        if (err.message.includes('401') || err.message.includes('Unauthorized')) {
          setError('Authentication failed. Please login again.');
        } else if (err.message.includes('403') || err.message.includes('Forbidden')) {
          setError('You do not have permission to create/edit posts.');
        } else if (err.message.includes('400') || err.message.includes('Bad Request')) {
          setError('Invalid data submitted. Please check your form and try again.');
        } else if (err.message.includes('500') || err.message.includes('Internal Server Error')) {
          setError('Server error. Please try again later.');
        } else {
          setError(`Error: ${err.message}`);
        }
      } else {
        setError('Failed to save post. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = () => {
    setValue('status', 'draft');
    handleSubmit(onSubmit)();
  };

  const handlePublish = () => {
    setValue('status', 'published');
    // Format date for datetime-local input: YYYY-MM-DDTHH:mm
    const now = new Date();
    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16); // Remove seconds and timezone info
    setValue('publishedAt', localDateTime);
    handleSubmit(onSubmit)();
  };

  const authorLabel = (() => {
    if (!_currentUser) return null;
    const user = _currentUser as unknown as PayloadUser;
    const firstName = user.firstName || user.first_name || '';
    const lastName = user.lastName || user.last_name || '';
    const email = user.email || '';
    if (firstName || lastName) return { name: `${firstName} ${lastName}`.trim(), email };
    if (email) return { name: email, email: '' };
    return { name: `User #${user.id}`, email: '' };
  })();

  if (isLoading) {
    return (
      <div className={cardCls}>
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#eba236] mx-auto mb-4" />
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">Loading post…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error banner — vendors pattern */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Meta + secondary actions row — mirrors vendors view action row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${statusBadge(watchedStatus)}`}
          >
            {watchedStatus === 'published' ? (
              <CheckCircle className="w-3 h-3" />
            ) : (
              <Clock className="w-3 h-3" />
            )}
            {watchedStatus || 'draft'}
          </span>
          {authorLabel && (
            <span className="text-xs text-gray-500 dark:text-[#a1a1aa]">
              by <span className="font-medium text-gray-700 dark:text-white">{authorLabel.name}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowPreview((v) => !v)} className={secondaryBtnCls}>
            <Eye className="w-4 h-4" />
            {showPreview ? 'Back to edit' : 'Preview'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className={secondaryBtnCls}>
              <X className="w-4 h-4" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {showPreview ? (
        <div className={cardCls}>
          <div className="p-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-[#a1a1aa]">
              Preview
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {watchedTitle || 'Untitled post'}
            </h2>
            {watchedSlug && (
              <p className="text-xs font-mono text-gray-500 dark:text-[#a1a1aa]">/{watchedSlug}</p>
            )}
            {watchedExcerpt && (
              <p className="text-sm text-gray-600 dark:text-[#a1a1aa] border-l-2 border-[#eba236] pl-3">
                {watchedExcerpt}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">
              Body preview renders after publish — the rich-text canvas stays in the editor to avoid
              Lexical hydration drift.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Main column */}
            <div className="lg:col-span-2 space-y-6">
              <div className={cardCls}>
                <div className="p-6 space-y-6">
                  {/* Post details */}
                  <div>
                    <h4 className={sectionTitleCls}>
                      <FileText className="w-4 h-4 text-[#eba236]" /> Post Details
                    </h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label htmlFor="title" className={labelCls}>
                          Title *
                        </label>
                        <Controller
                          name="title"
                          control={control}
                          rules={{ required: 'Title is required' }}
                          render={({ field }) => (
                            <input
                              {...field}
                              type="text"
                              className={`${inputCls} caret-[#eba236]`}
                              placeholder="Enter post title…"
                            />
                          )}
                        />
                        {errors.title && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {errors.title.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="slug" className={labelCls}>
                          URL Slug *{' '}
                          <span className="text-gray-400 font-normal">(auto-generated, editable)</span>
                        </label>
                        <Controller
                          name="slug"
                          control={control}
                          rules={{ required: 'Slug is required' }}
                          render={({ field }) => (
                            <input
                              {...field}
                              type="text"
                              className={`${inputCls} font-mono caret-[#eba236]`}
                              placeholder="url-friendly-slug"
                            />
                          )}
                        />
                        {errors.slug && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {errors.slug.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div>
                    <h4 className={sectionTitleCls}>
                      <FileText className="w-4 h-4 text-[#eba236]" /> Content *
                    </h4>
                    <RichTextEditor
                      value={contentRef.current}
                      onChange={(value) => {
                        contentRef.current = value as string;
                        setValue('content', value, { shouldValidate: false });
                      }}
                      placeholder="Start writing your post…"
                    />
                    {errors.content && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        Content is required
                      </p>
                    )}
                  </div>

                  {/* Excerpt */}
                  <div>
                    <h4 className={sectionTitleCls}>Excerpt</h4>
                    <Controller
                      name="excerpt"
                      control={control}
                      render={({ field }) => (
                        <textarea
                          {...field}
                          rows={3}
                          className={`${inputCls} caret-[#eba236]`}
                          placeholder="Brief description for previews and SEO…"
                        />
                      )}
                    />
                    <p className="text-xs text-gray-400 mt-1.5">
                      Shown on cards and used as the SEO fallback.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              {/* Publish */}
              <div className={cardCls}>
                <div className="p-5 space-y-3">
                  <h4 className={sectionTitleCls}>
                    <CheckCircle className="w-4 h-4 text-[#eba236]" /> Publish
                  </h4>
                  <div>
                    <label className={labelCls}>Status</label>
                    <Controller
                      name="status"
                      control={control}
                      render={({ field }) => (
                        <select {...field} className={inputCls}>
                          <option value="draft">Draft</option>
                          <option value="published">Published</option>
                        </select>
                      )}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Author</label>
                    <div className="mt-1 text-sm px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] text-gray-900 dark:text-white">
                      {authorLabel ? (
                        <span>
                          {authorLabel.name}
                          {authorLabel.email && authorLabel.name !== authorLabel.email && (
                            <span className="text-gray-400 ml-1 text-xs">
                              ({authorLabel.email})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">
                          {watchedAuthor && watchedAuthor > 0
                            ? `Author ID: ${watchedAuthor}`
                            : 'Loading user…'}
                        </span>
                      )}
                    </div>
                    <Controller
                      name="author"
                      control={control}
                      render={({ field }) => <input {...field} type="hidden" />}
                    />
                  </div>

                  {watchedStatus === 'published' && (
                    <div>
                      <label className={labelCls}>Publish date</label>
                      <Controller
                        name="publishedAt"
                        control={control}
                        render={({ field }) => {
                          const formatForDateTimeLocal = (value: string) => {
                            if (!value) return '';
                            try {
                              if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
                              const date = new Date(value);
                              return new Date(
                                date.getTime() - date.getTimezoneOffset() * 60000
                              )
                                .toISOString()
                                .slice(0, 16);
                            } catch {
                              return '';
                            }
                          };
                          return (
                            <input
                              {...field}
                              value={formatForDateTimeLocal(field.value || '')}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                field.onChange(e.target.value)
                              }
                              type="datetime-local"
                              className={`${inputCls} [color-scheme:light] dark:[color-scheme:dark]`}
                            />
                          );
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Featured image */}
              <div className={cardCls}>
                <div className="p-5">
                  <h4 className={sectionTitleCls}>
                    <ImageIcon className="w-4 h-4 text-[#eba236]" /> Featured Image
                  </h4>
                  <Controller
                    name="featuredImage"
                    control={control}
                    render={({ field }) => (
                      <MediaUploader value={field.value} onChange={field.onChange} />
                    )}
                  />
                </div>
              </div>

              {/* Tags */}
              <div className={cardCls}>
                <div className="p-5">
                  <h4 className={sectionTitleCls}>
                    <TagIcon className="w-4 h-4 text-[#eba236]" /> Tags
                  </h4>
                  <Controller
                    name="tags"
                    control={control}
                    render={({ field }) => (
                      <TagInput value={field.value || []} onChange={field.onChange} />
                    )}
                  />
                </div>
              </div>

              {/* SEO */}
              <div className={cardCls}>
                <div className="p-5 space-y-3">
                  <h4 className={sectionTitleCls}>
                    <Globe className="w-4 h-4 text-[#eba236]" /> SEO
                  </h4>
                  <div>
                    <label className={labelCls}>SEO title</label>
                    <Controller
                      name="seo.title"
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="text"
                          className={`${inputCls} caret-[#eba236]`}
                          placeholder="Leave empty to use post title"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>SEO description</label>
                    <Controller
                      name="seo.description"
                      control={control}
                      render={({ field }) => (
                        <textarea
                          {...field}
                          rows={2}
                          className={`${inputCls} caret-[#eba236]`}
                          placeholder="Leave empty to use excerpt"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Focus keyword</label>
                    <Controller
                      name="seo.focusKeyword"
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="text"
                          className={`${inputCls} caret-[#eba236]`}
                          placeholder="Primary keyword for ranking"
                        />
                      )}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-[#a1a1aa]">
                      The main keyword you want this post to rank for in search engines.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer actions — vendors form pattern */}
          <div className={`${cardCls} mt-6`}>
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 border-t border-gray-200 dark:border-[#262626]">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSaving}
                  className={`${secondaryBtnCls} justify-center`}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSaving || !watchedAuthor || watchedAuthor <= 0}
                className={`${secondaryBtnCls} justify-center`}
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving
                  ? 'Saving…'
                  : !watchedAuthor || watchedAuthor <= 0
                    ? 'Loading user…'
                    : 'Save draft'}
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={isSaving || !watchedAuthor || watchedAuthor <= 0}
                className={`${primaryBtnCls} justify-center`}
              >
                {isSaving && <RefreshCw className="h-4 w-4 animate-spin" />}
                {isSaving
                  ? 'Publishing…'
                  : !watchedAuthor || watchedAuthor <= 0
                    ? 'Loading user…'
                    : postId
                      ? 'Update post'
                      : 'Publish post'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
