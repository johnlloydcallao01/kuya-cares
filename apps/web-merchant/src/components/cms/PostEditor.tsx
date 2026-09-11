'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { Save, Eye, X } from '@/components/ui/IconWrapper';
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
      console.log('🔍 Validating form data:', data);
      const validation = validatePostForm(data);
      if (!validation.success) {
        console.error('❌ Form validation failed:', validation.error);
        console.error('❌ Validation errors:', validation.error?.issues);
        setError(`Validation failed: ${validation.error?.issues?.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`);
        return;
      }
      console.log('✅ Form validation passed');

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

      console.log('📤 Sending data to PayloadCMS:', payloadData);

      // Use the JWT token persisted in localStorage (the payload-token cookie is HttpOnly
      // and is therefore NOT readable via document.cookie)
      const storedToken = getStoredToken();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add Authorization header if we have a token
      if (storedToken) {
        headers['Authorization'] = `JWT ${storedToken}`;
        console.log('🔐 Added Authorization header with JWT token');
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
        console.log('📤 Creating post with headers:', headers);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(payloadData),
        });
        if (!res.ok) {
          const errorText = await res.text();
          console.error('❌ Create failed:', res.status, errorText);
          console.error('❌ Response headers:', Object.fromEntries(res.headers.entries()));
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading post...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {postId ? 'Edit Post' : 'Create New Post'}
          </h1>
          <p className="text-gray-600 mt-1">
            {postId ? 'Update your blog post' : 'Write and publish a new blog post'}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Eye className="w-4 h-4 mr-2" />
            {showPreview ? 'Edit' : 'Preview'}
          </button>
          
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    placeholder="Enter post title..."
                    style={{ caretColor: '#1f2937' }}
                  />
                )}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            {/* Slug */}
            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-2">
                URL Slug *
              </label>
              <Controller
                name="slug"
                control={control}
                rules={{ required: 'Slug is required' }}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    placeholder="url-friendly-slug"
                    style={{ caretColor: '#1f2937' }}
                  />
                )}
              />
              {errors.slug && (
                <p className="mt-1 text-sm text-red-600">{errors.slug.message}</p>
              )}
            </div>

            {/* Content Editor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content *
              </label>
              <RichTextEditor
                value={contentRef.current}
                onChange={(value) => {
                  contentRef.current = value as string;
                  setValue('content', value, { shouldValidate: false });
                }}
                placeholder="Start writing your post..."
              />
              {errors.content && (
                <p className="mt-1 text-sm text-red-600">Content is required</p>
              )}
            </div>

            {/* Excerpt */}
            <div>
              <label htmlFor="excerpt" className="block text-sm font-medium text-gray-700 mb-2">
                Excerpt
              </label>
              <Controller
                name="excerpt"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    placeholder="Brief description for previews and SEO..."
                    style={{ caretColor: '#1f2937' }}
                  />
                )}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Publish Actions */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Publish</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                      </select>
                    )}
                  />
                </div>

                {/* Author Field */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Author
                  </label>
                  <div className="text-sm text-gray-600 px-2 py-1 bg-gray-50 border border-gray-200 rounded">
                    {_currentUser ? (
                      <span>
                        {(() => {
                          const user = _currentUser as unknown as PayloadUser;
                          const firstName = user.firstName || user.first_name || '';
                          const lastName = user.lastName || user.last_name || '';
                          const email = user.email || '';

                          // If we have first/last name, show them
                          if (firstName || lastName) {
                            return (
                              <>
                                {firstName} {lastName}
                                {email && <span className="text-gray-400 ml-1">({email})</span>}
                              </>
                            );
                          }

                          // If no name, just show email
                          if (email) {
                            return (
                              <span>
                                {email}
                              </span>
                            );
                          }

                          // Fallback to user ID
                          return <span>User #{user.id}</span>;
                        })()}
                      </span>
                    ) : (
                      <span className="text-gray-400">
                        {watchedAuthor && watchedAuthor > 0 ? `Author ID: ${watchedAuthor}` : 'Loading user...'}
                      </span>
                    )}
                  </div>
                  {/* Hidden field for form submission */}
                  <Controller
                    name="author"
                    control={control}
                    render={({ field }) => (
                      <input {...field} type="hidden" />
                    )}
                  />
                </div>

                {watchedStatus === 'published' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Publish Date
                    </label>
                    <Controller
                      name="publishedAt"
                      control={control}
                      render={({ field }) => {
                        // Convert ISO string to datetime-local format
                        const formatForDateTimeLocal = (value: string) => {
                          if (!value) return '';
                          try {
                            // If it's already in the correct format, return as is
                            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
                              return value;
                            }
                            // Convert ISO string to datetime-local format
                            const date = new Date(value);
                            const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                              .toISOString()
                              .slice(0, 16);
                            return localDateTime;
                          } catch {
                            return '';
                          }
                        };

                        return (
                          <input
                            {...field}
                            value={formatForDateTimeLocal(field.value || '')}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(e.target.value)}
                            type="datetime-local"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                          />
                        );
                      }}
                    />
                  </div>
                )}

                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={isSaving || !watchedAuthor || watchedAuthor <= 0}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    {isSaving ? 'Saving...' : (!watchedAuthor || watchedAuthor <= 0) ? 'Loading user...' : 'Save Draft'}
                  </button>

                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={isSaving || !watchedAuthor || watchedAuthor <= 0}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Publishing...' : (!watchedAuthor || watchedAuthor <= 0) ? 'Loading user...' : 'Publish'}
                  </button>
                </div>
              </div>
            </div>

            {/* Featured Image */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Featured Image</h3>
              <Controller
                name="featuredImage"
                control={control}
                render={({ field }) => (
                  <MediaUploader
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            {/* Tags */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Tags</h3>
              <Controller
                name="tags"
                control={control}
                render={({ field }) => (
                  <TagInput
                    value={field.value || []}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            {/* SEO */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">SEO</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    SEO Title
                  </label>
                  <Controller
                    name="seo.title"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                        placeholder="Leave empty to use post title"
                        style={{ caretColor: '#1f2937' }}
                      />
                    )}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    SEO Description
                  </label>
                  <Controller
                    name="seo.description"
                    control={control}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        rows={2}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                        placeholder="Leave empty to use excerpt"
                        style={{ caretColor: '#1f2937' }}
                      />
                    )}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Focus Keyword
                  </label>
                  <Controller
                    name="seo.focusKeyword"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                        placeholder="Primary keyword for ranking"
                        style={{ caretColor: '#1f2937' }}
                      />
                    )}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    The main keyword you want this post to rank for in search engines
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
