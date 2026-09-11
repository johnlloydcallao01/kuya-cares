'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PostEditor } from '@/components/cms/PostEditor';

export default function NewPostPage() {
  const router = useRouter();

  const handleSave = (_post: unknown) => {
    // Redirect to posts list or edit page
    router.push('/posts');
  };

  const handleCancel = () => {
    router.push('/posts');
  };

  return (
    <PostEditor
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}
