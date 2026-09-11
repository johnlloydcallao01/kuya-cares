/**
 * CMS API client and utilities
 */

import type { PostFormData, PostListItem, PostFilters, CMSApiResponse, CMSError } from './index';

// ========================================
// API CLIENT CLASS
// ========================================

export class CMSApiClient {
  public baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl: string, authToken?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.headers = {
      'Content-Type': 'application/json',
      ...(authToken && { Authorization: `JWT ${authToken}` }),
    };
  }

  // ========================================
  // POSTS API
  // ========================================

  async getPosts(filters?: PostFilters): Promise<CMSApiResponse<PostListItem>> {
    const params = new URLSearchParams();
    
    if (filters?.status) params.append('where[status][equals]', filters.status);
    if (filters?.author) params.append('where[author][equals]', filters.author);
    if (filters?.search) params.append('where[title][contains]', filters.search);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.page) params.append('page', filters.page.toString());

    const response = await fetch(`${this.baseUrl}/api/posts?${params}`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new CMSApiError(`Failed to fetch posts: ${response.statusText}`, response.status);
    }

    return response.json();
  }

  async getPost(id: string): Promise<CMSApiResponse> {
    const response = await fetch(`${this.baseUrl}/api/posts/${id}`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new CMSApiError(`Failed to fetch post: ${response.statusText}`, response.status);
    }

    return response.json();
  }

  async createPost(data: PostFormData): Promise<CMSApiResponse> {
    const response = await fetch(`${this.baseUrl}/api/posts`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      throw new CMSApiError(
        errorData.message || `Failed to create post: ${response.status} ${response.statusText}`,
        response.status,
        errorData.errors
      );
    }

    return response.json();
  }

  async updatePost(id: string, data: Partial<PostFormData>): Promise<CMSApiResponse> {
    const response = await fetch(`${this.baseUrl}/api/posts/${id}`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new CMSApiError(
        errorData.message || `Failed to update post: ${response.statusText}`,
        response.status,
        errorData.errors
      );
    }

    return response.json();
  }

  async deletePost(id: string | number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/posts/${id}`, {
      method: 'DELETE',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new CMSApiError(`Failed to delete post: ${response.statusText}`, response.status);
    }
  }

  // ========================================
  // MEDIA API
  // ========================================

  async uploadMedia(file: File, alt: string): Promise<CMSApiResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('alt', alt);

    const response = await fetch(`${this.baseUrl}/api/media`, {
      method: 'POST',
      headers: {
        ...(this.headers.Authorization && { Authorization: this.headers.Authorization }),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new CMSApiError(
        errorData.message || `Failed to upload media: ${response.statusText}`,
        response.status,
        errorData.errors
      );
    }

    return response.json();
  }

  async getMedia(filters?: { limit?: number; page?: number }): Promise<CMSApiResponse> {
    const params = new URLSearchParams();
    
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.page) params.append('page', filters.page.toString());

    const response = await fetch(`${this.baseUrl}/api/media?${params}`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new CMSApiError(`Failed to fetch media: ${response.statusText}`, response.status);
    }

    return response.json();
  }
}

// ========================================
// ERROR CLASS
// ========================================

export class CMSApiError extends Error implements CMSError {
  public status?: number;
  public field?: string;
  public errors?: Array<{ message: string; field?: string }>;

  constructor(
    message: string, 
    status?: number, 
    errors?: Array<{ message: string; field?: string }>
  ) {
    super(message);
    this.name = 'CMSApiError';
    this.status = status;
    this.errors = errors;
  }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

export function createCMSClient(baseUrl: string, authToken?: string): CMSApiClient {
  return new CMSApiClient(baseUrl, authToken);
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}
