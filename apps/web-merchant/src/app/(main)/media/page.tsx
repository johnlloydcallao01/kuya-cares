'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from '@/components/ui/IconWrapper';
import { formatCMSDateTime } from '@/lib/cms';
import { useAuth } from '@/hooks/useAuth';
import { getStoredToken } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';

interface MediaUsageEntry {
  collection: string;
  label: string;
  count: number;
}

interface MediaItem {
  id: number | string;
  filename: string;
  alt: string;
  url: string | null;
  cloudinaryPublicId: string | null;
  mimeType: string;
  type: 'image' | 'video' | 'other';
  filesize: number;
  width: number | null;
  height: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  usage: {
    total: number;
    references: MediaUsageEntry[];
  };
}

interface LibraryResponse {
  docs: MediaItem[];
  totalDocs: number;
  totalPages: number;
  page: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function MediaLibraryPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);

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

  const fetchMedia = useCallback(async (page: number, searchTerm: string, type: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '24',
      });
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      if (type !== 'all') {
        params.append('type', type);
      }

      const response = await fetch(`${API_BASE_URL}/media/library?${params}`, {
        credentials: 'include',
        headers: authHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to load media (${response.status})`);
      }

      const data: LibraryResponse = await response.json();
      setMediaItems(data.docs || []);
      setTotalPages(data.totalPages || 1);
      setTotalDocs(data.totalDocs || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load media');
    } finally {
      setIsLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchMedia(currentPage, search, typeFilter);
    }
  }, [isAuthenticated, authLoading, currentPage, search, typeFilter, fetchMedia]);

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
      fetchMedia(currentPage, search, typeFilter);
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

      const { doc } = await response.json();
      setMediaItems((prev) => prev.map((m) => (m.id === editingItem.id ? { ...m, alt: doc.alt || '' } : m)));
      setEditingItem(null);
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

      setMediaItems((prev) => prev.filter((m) => m.id !== item.id));
      setTotalDocs((prev) => Math.max(0, prev - 1));
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
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
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
      <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
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
    <div key={item.id} className="group relative bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative">
        {renderPreview(item)}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex space-x-1">
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 bg-white rounded shadow-md hover:bg-gray-100 border border-gray-200"
                title="Download / Open"
              >
                <Download className="w-3 h-3 text-gray-700" />
              </a>
            )}
            <button
              onClick={() => openEdit(item)}
              className="p-1.5 bg-white rounded shadow-md hover:bg-gray-100 border border-gray-200"
              title="Edit alt text"
            >
              <Edit className="w-3 h-3 text-blue-600" />
            </button>
            <button
              onClick={() => handleDelete(item)}
              disabled={deletingId === item.id}
              className="p-1.5 bg-white rounded shadow-md hover:bg-red-50 border border-gray-200 disabled:opacity-50"
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
          <h4 className="text-sm font-medium text-gray-900 truncate" title={item.filename}>
            {item.filename}
          </h4>
          {getTypeBadge(item)}
        </div>
        {item.alt && (
          <p className="text-xs text-gray-500 mt-1 truncate" title={item.alt}>
            {item.alt}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
          <span>{formatFileSize(item.filesize)}</span>
          {getDimensions(item) && <span>{getDimensions(item)}</span>}
          {item.usage.total > 0 && (
            <span className="inline-flex items-center text-gray-500" title={`Used in ${item.usage.total} places`}>
              <Link className="w-3 h-3 mr-1" />
              {item.usage.total}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center text-xs text-gray-400">
          <Calendar className="w-3 h-3 mr-1" />
          {formatCMSDateTime(item.createdAt || '')}
        </div>
      </div>
    </div>
  );

  const renderListRow = (item: MediaItem) => (
    <div key={item.id} className="flex items-center p-4 hover:bg-gray-50">
      <div className="w-16 h-12 flex-shrink-0 overflow-hidden rounded bg-gray-100">
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
          <h4 className="text-sm font-medium text-gray-900 truncate">{item.filename}</h4>
          {getTypeBadge(item)}
        </div>
        {item.alt && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{item.alt}</p>
        )}
      </div>
      <div className="hidden md:block text-xs text-gray-500 w-24 text-right">
        {formatFileSize(item.filesize)}
      </div>
      <div className="hidden lg:block text-xs text-gray-500 w-24 text-right">
        {getDimensions(item) || '—'}
      </div>
      <div className="hidden xl:block text-xs text-gray-500 w-32 text-right">
        {formatCMSDateTime(item.createdAt || '')}
      </div>
      <div className="flex items-center space-x-2 ml-6">
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-400 hover:text-gray-600"
            title="Download / Open"
          >
            <Download className="w-4 h-4" />
          </a>
        )}
        <button
          onClick={() => openEdit(item)}
          className="p-2 text-gray-400 hover:text-blue-600"
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
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
            <p className="text-gray-600 mt-1">
              {totalDocs > 0 ? `${totalDocs} media file${totalDocs === 1 ? '' : 's'} in the library` : 'Manage your images and videos'}
            </p>
          </div>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Media
          </button>
        </div>
      </div>

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !isUploading && setIsUploadOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Upload Media</h2>
              <button
                onClick={() => setIsUploadOpen(false)}
                disabled={isUploading}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadSuccess ? (
              <div className="flex flex-col items-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
                <p className="text-gray-700 font-medium">Upload successful!</p>
              </div>
            ) : isUploading ? (
              <div className="py-8">
                <div className="flex items-center justify-center mb-4">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
                <p className="text-center text-sm text-gray-600 mb-4">Uploading... {uploadProgress}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
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
                  <p className="text-sm text-gray-700 mb-1">
                    Drag & drop a file here, or{' '}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      browse
                    </button>
                  </p>
                  <p className="text-xs text-gray-400">Images and videos up to 50 MB</p>
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
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Edit Media</h2>
              <button
                onClick={() => setEditingItem(null)}
                disabled={isSavingEdit}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <div className="w-24 h-24 mx-auto rounded overflow-hidden bg-gray-100 mb-3">
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
              <p className="text-sm font-medium text-gray-900 text-center mb-3">{editingItem.filename}</p>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alt text</label>
              <input
                type="text"
                value={editAlt}
                onChange={(e) => setEditAlt(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-600"
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
                className="px-4 py-2 border-2 border-gray-400 rounded-lg hover:bg-gray-100 transition-colors text-gray-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAlt}
                disabled={isSavingEdit}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSavingEdit && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="flex-1 relative max-w-md">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600" />
              <input
                type="text"
                placeholder="Search media files..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-600"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center">
                <Filter className="w-4 h-4 text-gray-600 mr-2" />
                <select
                  value={typeFilter}
                  onChange={(e) => handleTypeFilter(e.target.value)}
                  className="px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                >
                  <option value="all">All Types</option>
                  <option value="image">Images</option>
                  <option value="video">Videos</option>
                </select>
              </div>
              <div className="flex border-2 border-gray-400 rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 rounded-l-lg ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                  title="Grid view"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 rounded-r-lg ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading media library...</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-10 text-center">
              <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-3" />
              <p className="text-red-600 mb-2">{error}</p>
              <button
                onClick={() => fetchMedia(currentPage, search, typeFilter)}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Try again
              </button>
            </div>
          ) : mediaItems.length === 0 ? (
            <div className="p-10 text-center">
              <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 mb-1">
                {search || typeFilter !== 'all' ? 'No media files match your filters.' : 'No media files yet.'}
              </p>
              {!search && typeFilter === 'all' && (
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="mt-2 inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
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
            <div className="divide-y divide-gray-200">
              {mediaItems.map(renderListRow)}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!isLoading && !error && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Page {currentPage} of {totalPages} · {totalDocs} total
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {deleteError && (
        <div className="fixed bottom-4 right-4 z-50 p-3 bg-red-50 border border-red-200 rounded-md shadow-lg flex items-start max-w-sm">
          <AlertCircle className="w-4 h-4 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-800 flex-1">{deleteError}</p>
          <button onClick={() => setDeleteError(null)} className="ml-2 text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
