'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@encreasl/client-services';
import { ArrowLeft, CheckCircle, FileText } from '@/components/ui/IconWrapper';
import { PostEditor } from '@/components/cms/PostEditor';
import { ClientOnly } from '@/components/ClientOnly';

function EditPostSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
    </div>
  );
}

function EditPostContent() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const postId = params.id as string;
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/posts');
  };

  const handleSaveSuccess = async (post: unknown) => {
    const title = (post as { title?: string } | null)?.title;
    if (typeof title === 'string' && title) setSavedTitle(title);
    // Keep the list fresh for when the user navigates back to /posts.
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminPosts().slice(0, 2) });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {saveSuccess && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          Post updated successfully.
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center"><FileText className="w-5 h-5" /></div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Edit post</h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">ID #{postId}{savedTitle ? ` • ${savedTitle}` : ''}</p>
        </div>
      </div>
      <PostEditor
        postId={postId}
        onSave={handleSaveSuccess}
        onCancel={handleBack}
      />
    </div>
  );
}

export default function EditPostPage() {
  // Pure CSR: PostEditor is a Lexical (DOM-only) editor — render post-mount only.
  return (
    <ClientOnly fallback={<EditPostSkeleton />}>
      <EditPostContent />
    </ClientOnly>
  );
}
