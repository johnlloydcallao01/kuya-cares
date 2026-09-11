'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Eye, Calendar } from '@/components/ui/IconWrapper';
import Link from '@/components/ui/LinkWrapper';
import { formatCMSDateTime } from '@/lib/cms';
import type { Post } from '@encreasl/cms-types';

function PostsPageContent() {
  const [filters, setFilters] = useState({
    status: undefined as 'draft' | 'published' | undefined,
    search: '',
    limit: 10,
    page: 1,
  });

  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch posts using PayloadCMS REST API
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          limit: filters.limit.toString(),
          page: filters.page.toString(),
        });

        if (filters.status) {
          params.append('where[status][equals]', filters.status);
        }

        if (filters.search) {
          params.append('where[title][contains]', filters.search);
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts?${params}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch posts');
        }

        const data = await response.json();
        setPosts(data.docs || []);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch posts');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, [filters]);



  const handleSearch = (searchTerm: string) => {
    setFilters(prev => ({
      ...prev,
      search: searchTerm,
      page: 1,
    }));
  };

  const handleStatusFilter = (status: 'draft' | 'published' | undefined) => {
    setFilters(prev => ({
      ...prev,
      status,
      page: 1,
    }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({
      ...prev,
      page,
    }));
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts/${postId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      // Remove post from local state
      setPosts(prev => prev.filter(post => post.id !== postId));
    } catch (err: unknown) {
      console.error('Failed to delete post:', err);
      alert('Failed to delete post. Please try again.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Published
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Draft
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Blog Posts</h1>
              <p className="text-gray-600 mt-1">Manage your blog content</p>
            </div>
            
            <Link
              href="/admin/posts/new"
              className="inline-flex items-center px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Post
            </Link>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="p-4 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
                {/* Search */}
                <div className="flex-1 max-w-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input
                      type="text"
                      placeholder="Search posts..."
                      value={filters.search || ''}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border-2 border-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-600"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-600" />
                  <select
                    value={filters.status || ''}
                    onChange={(e) => handleStatusFilter((e.target.value as 'draft' | 'published') || undefined)}
                    className="border-2 border-gray-400 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  >
                    <option value="">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Posts List */}
            <div className="overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading posts...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="p-6 text-center">
                  <p className="text-red-600">
                    {error && typeof error === 'object' && 'message' in error
                      ? (error as { message: string }).message
                      : 'Failed to load posts'}
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Try again
                  </button>
                </div>
              ) : posts.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-gray-600">No posts found.</p>
                  <Link
                    href="/admin/posts/new"
                    className="mt-2 inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Create your first post
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {posts.map((post: Post) => (
                    <div key={post.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {post.title}
                            </h3>
                            {getStatusBadge(post.status)}
                          </div>
                          
                          <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                            <span>
                              By {typeof post.author === 'object' && post.author ? `${post.author.firstName || ''} ${post.author.lastName || ''}`.trim() || 'Unknown Author' : 'Unknown Author'}
                            </span>
                            {post.publishedAt && (
                              <span className="flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                {formatCMSDateTime(post.publishedAt)}
                              </span>
                            )}
                            <span>
                              Updated {formatCMSDateTime(post.updatedAt)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Link
                            href={`/posts/${post.id}/preview`}
                            className="p-2 text-gray-400 hover:text-gray-600"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          
                          <Link
                            href={`/posts/${post.id}/edit`}
                            className="p-2 text-gray-400 hover:text-blue-600"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="p-2 text-gray-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Page {filters.page} of {totalPages}
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handlePageChange(filters.page! - 1)}
                      disabled={filters.page === 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    
                    <button
                      onClick={() => handlePageChange(filters.page! + 1)}
                      disabled={filters.page === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
    </div>
  );
}

export default function PostsPage() {
  return <PostsPageContent />;
}
