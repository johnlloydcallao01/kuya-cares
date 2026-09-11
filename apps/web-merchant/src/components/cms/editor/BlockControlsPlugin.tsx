'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  LexicalEditor,
} from 'lexical';
import { Plus } from '@/components/ui/IconWrapper';





interface BlockControlsProps {
  editor: LexicalEditor;
}

function BlockControls({ editor }: BlockControlsProps): React.JSX.Element {
  const [showButton, setShowButton] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ top: 0, left: 0 });
  const [currentBlockElement, setCurrentBlockElement] = useState<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const updateButtonPosition = () => {
      const selection = $getSelection();
      const rootElement = editor.getRootElement();

      // Hide button if no selection, not a range selection, or no root element
      if (!$isRangeSelection(selection) || !selection.isCollapsed() || !rootElement) {
        setShowButton(false);
        setCurrentBlockElement(null);
        return;
      }

      const domSelection = window.getSelection();
      if (!domSelection || domSelection.rangeCount === 0) {
        setShowButton(false);
        setCurrentBlockElement(null);
        return;
      }

      const range = domSelection.getRangeAt(0);

      // Check if the selection is actually inside the editor
      if (!rootElement.contains(range.startContainer)) {
        setShowButton(false);
        setCurrentBlockElement(null);
        return;
      }

      // Find the actual block element (paragraph, heading, etc.)
      let blockElement = range.startContainer as Node;
      while (blockElement && blockElement.nodeType !== Node.ELEMENT_NODE) {
        blockElement = blockElement.parentNode!;
      }

      // Find the closest block-level element within the editor
      while (blockElement && blockElement !== rootElement) {
        const element = blockElement as HTMLElement;
        if (element.tagName && ['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'LI', 'DIV'].includes(element.tagName)) {
          // Ensure this element is actually inside the editor
          if (rootElement.contains(element)) {
            const rect = element.getBoundingClientRect();
            const rootRect = rootElement.getBoundingClientRect();

            setButtonPosition({
              top: rect.top - rootRect.top + 2,
              left: rect.right - rootRect.left - 30, // 30px from right edge of block
            });
            setCurrentBlockElement(element);
            setShowButton(true);
            return;
          }
        }
        blockElement = blockElement.parentNode!;
      }

      // If we get here, no valid block was found inside the editor
      setShowButton(false);
      setCurrentBlockElement(null);
    };

    const unregisterListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateButtonPosition();
      });
    });

    // Listen for selection changes
    const handleSelectionChange = () => {
      setTimeout(() => {
        editor.getEditorState().read(() => {
          updateButtonPosition();
        });
      }, 0);
    };

    // Listen for clicks outside the editor to hide button
    const handleDocumentClick = (event: MouseEvent) => {
      const rootElement = editor.getRootElement();
      if (rootElement && !rootElement.contains(event.target as Node)) {
        setShowButton(false);
        setCurrentBlockElement(null);
      }
    };

    // Listen for focus events to ensure proper hiding
    const handleFocusOut = (event: FocusEvent) => {
      const rootElement = editor.getRootElement();
      if (rootElement && !rootElement.contains(event.relatedTarget as Node)) {
        setShowButton(false);
        setCurrentBlockElement(null);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      unregisterListener();
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [editor]);

  const handleButtonClick = useCallback((event: React.MouseEvent) => {
    // Prevent form submission and event bubbling
    event.preventDefault();
    event.stopPropagation();

    // Instead of showing our own menu, trigger the slash command
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // Insert a "/" character to trigger the slash command menu
        selection.insertText('/');
      }
    });
  }, [editor]);

  return (
    <>
      {showButton && currentBlockElement && (
        <button
          ref={buttonRef}
          type="button"
          className="absolute z-40 w-6 h-6 flex items-center justify-center bg-gray-800 text-white rounded-sm hover:bg-gray-900 transition-colors opacity-80 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          style={{
            top: buttonPosition.top,
            left: buttonPosition.left,
          }}
          onClick={handleButtonClick}
          onMouseDown={(e) => e.preventDefault()}
          title="Add block"
          aria-label="Add block"
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
    </>
  );
}

export default function BlockControlsPlugin(): React.JSX.Element {
  const [editor] = useLexicalComposerContext();

  return <BlockControls editor={editor} />;
}
