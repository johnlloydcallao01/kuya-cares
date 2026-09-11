'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ClientOnly } from '@/components/ClientOnly';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@encreasl/client-services';
import { useMediaLibrary, type MediaItem } from '@/hooks/useMediaLibrary';
import {
  Upload,
  Search,
  Grid,
  List,
  Filter,
  Download,
  Trash2,
  Edit,
  Image,
  Video,
  FileText,
  Music,
  Calendar,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Link,
  RefreshCw,
} from '@/components/ui/IconWrapper';
import { formatCMSDateTime } from '@/lib/cms';
import { useAuth } from '@/hooks/useAuth';
import { getStoredToken } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function MediaLibrarySkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-[#262626]" />
        <div className="space-y-2">
          <div className="h-6 w-44 bg-gray-100 dark:bg-[#262626] rounded" />
          <div className="h-4 w-72 bg-gray-100 dark:bg-[#262626] rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-52 bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />
        ))}
      </div>
    </div>
  );
}

function MediaLibraryPageContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 24;

  // Upload state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [editAlt, setEditAlt] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const authHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {};
    const storedToken = getStoredToken();
    if (storedToken) {
      headers['Authorization'] = `JWT ${storedToken}`;
    }
    return headers;
  }, []);

  useEffect(() => { const id = setTimeout(() => setDebouncedSearch(search.trim()), 400); return () => clearTimeout(id) }, [search]);

  const qs = useMemo(() => {
    const params = new URLSearchParams({ page: String(currentPage), limit: String(limit) });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (typeFilter !== 'all') params.set('type', typeFilter);
    return params.toString();
  }, [currentPage, debouncedSearch, typeFilter]);

  const queryClient = useQueryClient();
  const [hardRefreshing, setHardRefreshing] = useState(false);
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useMediaLibrary(qs, isAuthenticated && !authLoading);

  const mediaItems = data?.docs || [];
  const totalPages = data?.totalPages || 1;
  const totalDocs = data?.totalDocs || 0;

  const isInitialLoading = (isPending && !data) || hardRefreshing;
  const isLoading = isFetching || hardRefreshing;
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load media') : null;

  const handleHardRefresh = () => {
    if (hardRefreshing) return;
    setHardRefreshing(true);
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminMediaLibrary(qs) });
        await refetch({ cancelRefetch: true });
      } finally { setHardRefreshing(false) }
    })();
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleTypeFilter = (value: string) => {
    setTypeFilter(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // ========================================
  // UPLOAD
  // ========================================

  const handleUpload = async (file: File) => {
    if (!isAuthenticated) return;
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('alt', file.name.split('.')[0]);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    const uploadPromise = new Promise<void>((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          resolve();
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            reject(new Error(data?.error || `Upload failed (${xhr.status})`));
          } catch {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed - network error'));
      xhr.onabort = () => reject(new Error('Upload aborted'));

      const storedToken = getStoredToken();
      xhr.open('POST', `${API_BASE_URL}/media/library`);
      if (storedToken) {
        xhr.setRequestHeader('Authorization', `JWT ${storedToken}`);
      }
      xhr.send(formData);
    });

    try {
      await uploadPromise;
      setUploadSuccess(true);
      // Refresh the list to include the new item
      void refetch();
      setTimeout(() => {
        setIsUploadOpen(false);
        setUploadSuccess(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 1200);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
  };

  // ========================================
  // EDIT ALT
  // ========================================

  const openEdit = (item: MediaItem) => {
    setEditingItem(item);
    setEditAlt(item.alt || '');
    setEditError(null);
  };

  const handleSaveAlt = async () => {
    if (!editingItem) return;
    setIsSavingEdit(true);
    setEditError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/media/library/${editingItem.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ alt: editAlt }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to update media');
      }

      await response.json();
      setEditingItem(null);
      void refetch();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update media');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ========================================
  // DELETE
  // ========================================

  const handleDelete = async (item: MediaItem) => {
    if (!confirm(`Delete "${item.filename}"?\n\nThis will permanently remove the file. This action cannot be undone.`)) {
      return;
    }
    setDeletingId(item.id);
    setDeleteError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/media/library/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders(),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to delete media');
      }

      void refetch();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete media');
    } finally {
      setDeletingId(null);
    }
  };

  const getTypeBadge = (item: MediaItem) => {
    if (item.type === 'image') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <Image className="w-3 h-3 mr-1" />
          Image
        </span>
      );
    }
    if (item.type === 'video') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          <Video className="w-3 h-3 mr-1" />
          Video
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-[#262626] dark:text-[#a1a1aa]">
        <FileText className="w-3 h-3 mr-1" />
        File
      </span>
    );
  };

  const getDimensions = (item: MediaItem) => {
    if (item.width && item.height) {
      return `${item.width}×${item.height}`;
    }
    return null;
  };

  const renderPreview = (item: MediaItem) => {
    if (item.type === 'image' && item.url) {
      return (
        <img
          src={item.url}
          alt={item.alt || item.filename}
          className="w-full h-32 object-cover"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      );
    }
    return (
      <div className="w-full h-32 bg-gray-100 dark:bg-[#262626] flex items-center justify-center">
        {item.type === 'video' ? (
          <Video className="w-10 h-10 text-purple-500" />
        ) : item.type === 'image' ? (
          <Image className="w-10 h-10 text-green-500" />
        ) : (
          <Music className="w-10 h-10 text-gray-400" />
        )}
      </div>
    );
  };

  const renderCard = (item: MediaItem) => (
    <div key={item.id} className="group relative bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative">
        {renderPreview(item)}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex space-x-1">
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 bg-white dark:bg-[#171717] rounded shadow-md hover:bg-gray-100 dark:hover:bg-[#262626] border border-gray-200 dark:border-[#262626]"
                title="Download / Open"
              >
                <Download className="w-3 h-3 text-gray-700 dark:text-[#a1a1aa]" />
              </a>
            )}
            <button
              onClick={() => openEdit(item)}
              className="p-1.5 bg-white dark:bg-[#171717] rounded shadow-md hover:bg-gray-100 dark:hover:bg-[#262626] border border-gray-200 dark:border-[#262626]"
              title="Edit alt text"
            >
              <Edit className="w-3 h-3 text-[#eba236]" />
            </button>
            <button
              onClick={() => handleDelete(item)}
              disabled={deletingId === item.id}
              className="p-1.5 bg-white dark:bg-[#171717] rounded shadow-md hover:bg-red-50 dark:hover:bg-red-900/20 border border-gray-200 dark:border-[#262626] disabled:opacity-50"
              title="Delete"
            >
              {deletingId === item.id ? (
                <Loader2 className="w-3 h-3 text-red-600 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3 text-red-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate" title={item.filename}>
            {item.filename}
          </h4>
          {getTypeBadge(item)}
        </div>
        {item.alt && (
          <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1 truncate" title={item.alt}>
            {item.alt}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-400 dark:text-[#a1a1aa]">
          <span>{formatFileSize(item.filesize)}</span>
          {getDimensions(item) && <span>{getDimensions(item)}</span>}
          {item.usage.total > 0 && (
            <span className="inline-flex items-center text-gray-500 dark:text-[#a1a1aa]" title={`Used in ${item.usage.total} places`}>
              <Link className="w-3 h-3 mr-1" />
              {item.usage.total}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center text-xs text-gray-400 dark:text-[#a1a1aa]">
          <Calendar className="w-3 h-3 mr-1" />
          {formatCMSDateTime(item.createdAt || '')}
        </div>
      </div>
    </div>
  );

  const renderListRow = (item: MediaItem) => (
    <div key={item.id} className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50">
      <div className="w-16 h-12 flex-shrink-0 overflow-hidden rounded bg-gray-100 dark:bg-[#262626]">
        {item.type === 'image' && item.url ? (
          <img src={item.url} alt={item.alt || item.filename} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {item.type === 'video' ? (
              <Video className="w-5 h-5 text-purple-500" />
            ) : (
              <FileText className="w-5 h-5 text-gray-400" />
            )}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 ml-4">
        <div className="flex items-center space-x-3">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.filename}</h4>
          {getTypeBadge(item)}
        </div>
        {item.alt && (
          <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-0.5 truncate">{item.alt}</p>
        )}
      </div>
      <div className="hidden md:block text-xs text-gray-500 dark:text-[#a1a1aa] w-24 text-right">
        {formatFileSize(item.filesize)}
      </div>
      <div className="hidden lg:block text-xs text-gray-500 dark:text-[#a1a1aa] w-24 text-right">
        {getDimensions(item) || '—'}
      </div>
      <div className="hidden xl:block text-xs text-gray-500 dark:text-[#a1a1aa] w-32 text-right">
        {formatCMSDateTime(item.createdAt || '')}
      </div>
      <div className="flex items-center space-x-2 ml-6">
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-400 dark:text-[#a1a1aa] hover:text-gray-600 dark:hover:text-white"
            title="Download / Open"
          >
            <Download className="w-4 h-4" />
          </a>
        )}
        <button
          onClick={() => openEdit(item)}
          className="p-2 text-gray-400 dark:text-[#a1a1aa] hover:text-[#eba236]"
          title="Edit alt text"
        >
          <Edit className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleDelete(item)}
          disabled={deletingId === item.id}
          className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-50"
          title="Delete"
        >
          {deletingId === item.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );

  if (authLoading) {
    return (
      <div className="space-y-6 py-5 px-2.5 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-[#262626]" />
          <div className="space-y-2">
            <div className="h-6 w-44 bg-gray-100 dark:bg-[#262626] rounded" />
            <div className="h-4 w-72 bg-gray-100 dark:bg-[#262626] rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-52 bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center">
              <Image className="w-4 h-4" />
            </span>
            Media Library
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">
            {totalDocs > 0 ? `${totalDocs} media file${totalDocs === 1 ? '' : 's'} in the library` : 'Manage your images and videos'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleHardRefresh}
            disabled={isLoading}
            aria-label="Refresh media"
            title="Refresh — re-fetch from CMS and show skeleton"
            className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition"
          >
            <Upload className="w-4 h-4" />
            Upload Media
          </button>
        </div>
      </div>

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !isUploading && setIsUploadOpen(false)} />
          <div className="relative bg-white dark:bg-[#171717] rounded-lg shadow-xl w-full max-w-lg p-6 border border-gray-200 dark:border-[#262626]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upload Media</h2>
              <button
                onClick={() => setIsUploadOpen(false)}
                disabled={isUploading}
                className="p-1 text-gray-400 dark:text-[#a1a1aa] hover:text-gray-600 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadSuccess ? (
              <div className="flex flex-col items-center py-8">
                <CheckCircle className="w-12 h-12 text-emerald-500 mb-3" />
                <p className="text-gray-700 dark:text-white font-medium">Upload successful!</p>
              </div>
            ) : isUploading ? (
              <div className="py-8">
                <div className="flex items-center justify-center mb-4">
                  <Loader2 className="w-8 h-8 text-[#eba236] animate-spin" />
                </div>
                <p className="text-center text-sm text-gray-600 dark:text-[#a1a1aa] mb-4">Uploading... {uploadProgress}%</p>
                <div className="w-full bg-gray-200 dark:bg-[#262626] rounded-full h-2">
                  <div
                    className="bg-[#eba236] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div
                  className="border-2 border-dashed border-gray-300 dark:border-[#333] rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-[#a1a1aa] transition-colors dark:bg-[#0a0a0a]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const files = Array.from(e.dataTransfer.files) as File[];
                    if (files.length > 0) {
                      handleUpload(files[0]);
                    }
                  }}
                >
                  <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-700 dark:text-[#a1a1aa] mb-1">
                    Drag & drop a file here, or{' '}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[#eba236] hover:text-[#c88a20] font-medium"
                    >
                      browse
                    </button>
                  </p>
                  <p className="text-xs text-gray-400 dark:text-[#a1a1aa]">Images and videos up to 50 MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>
                {uploadError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
                    <AlertCircle className="w-4 h-4 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-800">{uploadError}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Alt Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !isSavingEdit && setEditingItem(null)} />
          <div className="relative bg-white dark:bg-[#171717] rounded-lg shadow-xl w-full max-w-md p-6 border border-gray-200 dark:border-[#262626]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Media</h2>
              <button
                onClick={() => setEditingItem(null)}
                disabled={isSavingEdit}
                className="p-1 text-gray-400 dark:text-[#a1a1aa] hover:text-gray-600 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <div className="w-24 h-24 mx-auto rounded overflow-hidden bg-gray-100 dark:bg-[#262626] mb-3">
                {editingItem.type === 'image' && editingItem.url ? (
                  <img src={editingItem.url} alt={editingItem.alt || editingItem.filename} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {editingItem.type === 'video' ? (
                      <Video className="w-8 h-8 text-purple-500" />
                    ) : (
                      <FileText className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white text-center mb-3">{editingItem.filename}</p>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alt text</label>
              <input
                type="text"
                value={editAlt}
                onChange={(e) => setEditAlt(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-400 dark:border-[#333] rounded-lg focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder-gray-600 dark:bg-[#0a0a0a]"
                placeholder="Describe this media..."
              />
            </div>

            {editError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
                <AlertCircle className="w-4 h-4 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-800">{editError}</p>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setEditingItem(null)}
                disabled={isSavingEdit}
                className="px-4 py-2 border-2 border-gray-400 dark:border-[#333] rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] transition-colors text-gray-900 dark:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAlt}
                disabled={isSavingEdit}
                className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg hover:bg-[#c88a20] transition-colors disabled:opacity-50"
              >
                {isSavingEdit && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search media files..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400"
            />
            {search && (
              <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400 dark:text-[#a1a1aa]" />
                <select
                  value={typeFilter}
                  onChange={(e) => handleTypeFilter(e.target.value)}
                  className="px-3 py-2.5 text-sm border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white bg-white dark:bg-[#0a0a0a]"
                >
                  <option value="all">All Types</option>
                  <option value="image">Images</option>
                  <option value="video">Videos</option>
                </select>
              </div>
              <div className="flex items-center p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full border border-gray-200 dark:border-[#262626]">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold ${viewMode === 'grid' ? 'bg-[#eba236] text-white' : 'text-gray-600 dark:text-[#a1a1aa] hover:bg-white dark:hover:bg-[#262626]'}`}
                title="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold ${viewMode === 'list' ? 'bg-[#eba236] text-white' : 'text-gray-600 dark:text-[#a1a1aa] hover:bg-white dark:hover:bg-[#262626]'}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content & Pagination card */}
      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {isInitialLoading ? (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-pulse">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 dark:border-[#262626] bg-gray-100 dark:bg-[#171717] overflow-hidden">
                <div className="h-32 bg-gray-100 dark:bg-[#262626]" />
                <div className="p-3 space-y-2">
                  <div className="h-4 w-3/4 bg-gray-100 dark:bg-[#262626] rounded" />
                  <div className="h-3 w-1/2 bg-gray-100 dark:bg-[#262626] rounded" />
                  <div className="h-3 w-2/3 bg-gray-100 dark:bg-[#262626] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-12 w-12 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-3">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-red-600 dark:text-red-400 mb-3">{error}</p>
            <button
              onClick={handleHardRefresh}
              className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4 mr-2" />Try again
            </button>
          </div>
        ) : mediaItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-2xl flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-[#eba236]" />
            </div>
            <p className="text-gray-900 dark:text-white font-medium mb-1">
              {search || typeFilter !== 'all' ? 'No media files match your filters.' : 'No media files yet.'}
            </p>
            {!search && typeFilter === 'all' && (
              <button
                onClick={() => setIsUploadOpen(true)}
                className="mt-2 inline-flex items-center text-[#eba236] hover:text-[#c88a20] font-medium"
              >
                <Upload className="w-4 h-4 mr-1" />
                Upload your first media file
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {mediaItems.map(renderCard)}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-[#262626]">
            {mediaItems.map(renderListRow)}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !error && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626]">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm text-gray-600 dark:text-[#a1a1aa]">
                Page {currentPage} of {totalPages} · {totalDocs} total
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-[#262626]"
                >
                  Prev
                </button>
                {(() => {
                  const start = Math.max(1, Math.min(totalPages - 4, currentPage - 2))
                  return Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    const n = start + i
                    if (n > totalPages) return null
                    return (
                      <button
                        key={n}
                        onClick={() => handlePageChange(n)}
                        className={`h-8 w-8 rounded-lg text-sm font-medium border ${n === currentPage ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white'}`}
                      >
                        {n}
                      </button>
                    )
                  })
                })()}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-[#262626]"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {deleteError && (
        <div className="fixed bottom-4 right-4 z-[110] p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl shadow-lg flex items-start max-w-sm backdrop-blur">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-800 dark:text-red-200 flex-1">{deleteError}</p>
          <button onClick={() => setDeleteError(null)} className="ml-2 text-red-600 dark:text-red-400 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function MediaLibraryPage() {
  // Pure CSR: auth-gated fetch via localStorage JWT + TZ-sensitive dates +
  // XHR upload all require the browser → identical skeleton until mounted.
  return (
    <ClientOnly fallback={<MediaLibrarySkeleton />}>
      <MediaLibraryPageContent />
    </ClientOnly>
  );
}
