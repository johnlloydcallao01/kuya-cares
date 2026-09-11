'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PostEditor } from '@/components/cms/PostEditor';

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;

  const handleSave = (_post: unknown) => {
    // Redirect to posts list
    router.push('/posts');
  };

  const handleCancel = () => {
    router.push('/posts');
  };

  return (
    <PostEditor
      postId={postId}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}
