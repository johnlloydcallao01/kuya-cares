'use client';

import React, { useState } from 'react';
import { RichTextEditor } from './RichTextEditor';

export function EditorDemo() {
  const [content, setContent] = useState('');

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          WordPress Gutenberg-Style Block Editor
        </h1>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">WordPress Gutenberg-Style Block Editor</h2>
          <ul className="text-blue-800 space-y-1">
            <li>• <strong>Slash Commands:</strong> Type &quot;/&quot; anywhere to access all block types</li>
            <li>• <strong>Plus Button:</strong> ONE button appears on the right of the currently focused block</li>
            <li>• <strong>Unified Commands:</strong> Both &quot;/&quot; and + button show the same &quot;COMMANDS&quot; dropdown</li>
            <li>• <strong>Accessibility:</strong> Two ways to trigger - keyboard (&quot;/&quot;) or mouse (+ button)</li>
            <li>• <strong>Professional Layout:</strong> WordPress-style right-side block controls</li>
          </ul>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700">Rich Text Editor</h3>
        </div>
        <div className="bg-white">
          <RichTextEditor
            value={content}
            onChange={(value) => setContent(value as string)}
            placeholder="Start writing..."
            className="border-0"
          />
        </div>
      </div>

      <div className="mt-6">
        <details className="bg-gray-50 border border-gray-200 rounded-lg">
          <summary className="px-4 py-3 cursor-pointer font-medium text-gray-700 hover:bg-gray-100">
            View Raw Content (JSON)
          </summary>
          <div className="px-4 py-3 border-t border-gray-200">
            <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
              {content || 'No content yet...'}
            </pre>
          </div>
        </details>
      </div>

      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Features Implemented</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">✅ WordPress-Style Block Controls</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Right-side plus buttons on each block</li>
              <li>• Slash-command driven interface</li>
              <li>• Visual block hover states</li>
              <li>• Accessible for all users</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">✅ Unified Command System</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Type &quot;/&quot; or click + button</li>
              <li>• Same &quot;COMMANDS&quot; dropdown for both</li>
              <li>• Keyboard navigation support</li>
              <li>• Consistent user experience</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">✅ Rich Block Types</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Paragraph (default)</li>
              <li>• Headings (H1, H2, H3)</li>
              <li>• Quote blocks</li>
              <li>• Bulleted & Numbered Lists</li>
              <li>• Code blocks (coming soon)</li>
              <li>• Image blocks (coming soon)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">✅ Professional UX</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Dual input methods (keyboard + mouse)</li>
              <li>• Smooth animations & transitions</li>
              <li>• Consistent spacing & typography</li>
              <li>• Accessible for all users</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-medium text-yellow-900 mb-2">🚧 Coming Soon</h4>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• Code block syntax highlighting</li>
          <li>• Image upload and embedding</li>
          <li>• Table blocks</li>
          <li>• Custom block types</li>
          <li>• Block reordering via drag & drop</li>
          <li>• Block duplication and deletion</li>
        </ul>
      </div>
    </div>
  );
}
