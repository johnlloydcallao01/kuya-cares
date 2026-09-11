'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  CAN_UNDO_COMMAND,
  CAN_REDO_COMMAND,
} from 'lexical';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';
import { Bold,
  Italic,
  Underline,
  Undo,
  Redo, } from '@/components/ui/IconWrapper';

const LowPriority = 1;

function Divider() {
  return <div className="w-px h-6 bg-gray-300 dark:bg-[#333] mx-1" />;
}

export function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const toolbarRef = useRef(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      // Update text format
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
    }
  }, []);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar();
          return false;
        },
        LowPriority,
      ),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          setCanUndo(payload);
          return false;
        },
        LowPriority,
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          setCanRedo(payload);
          return false;
        },
        LowPriority,
      ),
    );
  }, [editor, updateToolbar]);



  return (
    <div
      className="toolbar flex items-center space-x-1 p-2 border-b border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a]"
      ref={toolbarRef}
    >
      <button
        type="button"
        disabled={!canUndo}
        onClick={() => {
          editor.dispatchCommand(UNDO_COMMAND, undefined);
        }}
        className="toolbar-item p-2 rounded hover:bg-gray-200 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white"
        aria-label="Undo"
      >
        <Undo className="w-4 h-4" />
      </button>
      <button
        type="button"
        disabled={!canRedo}
        onClick={() => {
          editor.dispatchCommand(REDO_COMMAND, undefined);
        }}
        className="toolbar-item p-2 rounded hover:bg-gray-200 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white"
        aria-label="Redo"
      >
        <Redo className="w-4 h-4" />
      </button>
      <Divider />
      <button
        type="button"
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
        }}
        className={`toolbar-item p-2 rounded hover:bg-gray-200 dark:hover:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white ${
          isBold ? 'bg-gray-200 dark:bg-[#262626] text-gray-900 dark:text-white' : ''
        }`}
        aria-label="Format Bold"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
        }}
        className={`toolbar-item p-2 rounded hover:bg-gray-200 dark:hover:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white ${
          isItalic ? 'bg-gray-200 dark:bg-[#262626] text-gray-900 dark:text-white' : ''
        }`}
        aria-label="Format Italics"
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
        }}
        className={`toolbar-item p-2 rounded hover:bg-gray-200 dark:hover:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white ${
          isUnderline ? 'bg-gray-200 dark:bg-[#262626] text-gray-900 dark:text-white' : ''
        }`}
        aria-label="Format Underline"
      >
        <Underline className="w-4 h-4" />
      </button>
    </div>
  );
}

function _$getNearestNodeOfType<T>(
  node: unknown,
  klass: new (...args: unknown[]) => T,
): T | null {
  let parent = node as { getParent?: () => unknown } | null;
  while (parent != null) {
    if (parent instanceof klass) {
      return parent as T;
    }
    parent = parent.getParent?.() as { getParent?: () => unknown } | null;
  }
  return null;
}
