'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { createPortal } from 'react-dom';
import {
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  LexicalEditor,
} from 'lexical';
import { Plus, Type, Heading1, Heading2, Heading3, Quote, Code, Image, List, ListOrdered, type LucideIcon } from '@/components/ui/IconWrapper';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { $createListNode, $createListItemNode } from '@lexical/list';

interface BlockType {
  key: string;
  name: string;
  icon: LucideIcon;
  description: string;
  onSelect: (editor: LexicalEditor) => void;
}

const BLOCK_TYPES: BlockType[] = [
  {
    key: 'paragraph',
    name: 'Paragraph',
    icon: Type,
    description: 'Start writing with plain text',
    onSelect: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode());
        }
      });
    },
  },
  {
    key: 'heading1',
    name: 'Heading 1',
    icon: Heading1,
    description: 'Big section heading',
    onSelect: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode('h1'));
        }
      });
    },
  },
  {
    key: 'heading2',
    name: 'Heading 2',
    icon: Heading2,
    description: 'Medium section heading',
    onSelect: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode('h2'));
        }
      });
    },
  },
  {
    key: 'heading3',
    name: 'Heading 3',
    icon: Heading3,
    description: 'Small section heading',
    onSelect: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode('h3'));
        }
      });
    },
  },
  {
    key: 'quote',
    name: 'Quote',
    icon: Quote,
    description: 'Capture a quote',
    onSelect: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createQuoteNode());
        }
      });
    },
  },
  {
    key: 'bulleted-list',
    name: 'Bulleted List',
    icon: List,
    description: 'Create a simple bulleted list',
    onSelect: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => {
            const listNode = $createListNode('bullet');
            const listItemNode = $createListItemNode();
            listNode.append(listItemNode);
            return listNode;
          });
        }
      });
    },
  },
  {
    key: 'numbered-list',
    name: 'Numbered List',
    icon: ListOrdered,
    description: 'Create a list with numbering',
    onSelect: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => {
            const listNode = $createListNode('number');
            const listItemNode = $createListItemNode();
            listNode.append(listItemNode);
            return listNode;
          });
        }
      });
    },
  },
  {
    key: 'code',
    name: 'Code',
    icon: Code,
    description: 'Capture a code snippet',
    onSelect: (_editor) => {
      // TODO: Implement code block creation
      // TODO: Implement code block creation
    },
  },
  {
    key: 'image',
    name: 'Image',
    icon: Image,
    description: 'Upload or embed with a link',
    onSelect: (_editor) => {
      // TODO: Implement image insertion
      // TODO: Implement image insertion
    },
  },
];

interface BlockPickerMenuProps {
  editor: LexicalEditor;
  onClose: () => void;
  position: { top: number; left: number };
}

function BlockPickerMenu({ editor, onClose, position }: BlockPickerMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleBlockSelect = useCallback((blockType: BlockType) => {
    blockType.onSelect(editor);
    onClose();
  }, [editor, onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[280px] max-h-[400px] overflow-y-auto"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
        Add a block
      </div>
      {BLOCK_TYPES.map((blockType) => (
        <button
          key={blockType.key}
          className="w-full flex items-center px-3 py-2 text-left hover:bg-gray-50 transition-colors focus:bg-gray-50 focus:outline-none"
          onClick={() => handleBlockSelect(blockType)}
        >
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-100 rounded mr-3">
            <blockType.icon className="w-4 h-4 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">{blockType.name}</div>
            <div className="text-xs text-gray-500 truncate">{blockType.description}</div>
          </div>
        </button>
      ))}
    </div>,
    document.body
  );
}

interface FloatingAddBlockButtonProps {
  editor: LexicalEditor;
  anchorElem: HTMLElement;
}

function FloatingAddBlockButton({ editor, anchorElem: _anchorElem }: FloatingAddBlockButtonProps): React.JSX.Element {
  const [showButton, setShowButton] = useState(false);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ top: 0, left: 0 });
  const [blockPickerPosition, setBlockPickerPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const updateButtonPosition = () => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) && selection.isCollapsed()) {
        const rootElement = editor.getRootElement();
        if (rootElement) {
          const domSelection = window.getSelection();
          if (domSelection && domSelection.rangeCount > 0) {
            const range = domSelection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const rootRect = rootElement.getBoundingClientRect();
            
            setButtonPosition({
              top: rect.top - rootRect.top,
              left: -25, // Adjusted for 10px padding
            });
            setShowButton(true);
            return;
          }
        }
      }
      setShowButton(false);
    };

    const unregisterListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateButtonPosition();
      });
    });

    return unregisterListener;
  }, [editor]);

  const handleButtonClick = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();

      // Calculate position relative to viewport
      let top = rect.bottom + 4;
      let left = rect.left;

      // Ensure menu doesn't go off-screen
      const menuWidth = 280;
      const menuHeight = 400;

      // Adjust horizontal position if menu would go off right edge
      if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 10;
      }

      // Adjust vertical position if menu would go off bottom edge
      if (top + menuHeight > window.innerHeight) {
        top = rect.top - menuHeight - 4;
      }

      // Ensure menu doesn't go off top edge
      if (top < 10) {
        top = rect.bottom + 4;
      }

      setBlockPickerPosition({ top, left });
      setShowBlockPicker(true);
    }
  }, []);

  return (
    <>
      {showButton && (
        <button
          ref={buttonRef}
          className="absolute z-40 w-6 h-6 flex items-center justify-center bg-white border border-gray-300 rounded-full shadow-sm hover:bg-gray-50 hover:border-gray-400 transition-colors"
          style={{
            top: buttonPosition.top,
            left: buttonPosition.left,
          }}
          onClick={handleButtonClick}
          title="Add block"
        >
          <Plus className="w-3 h-3 text-gray-600" />
        </button>
      )}
      {showBlockPicker && (
        <BlockPickerMenu
          editor={editor}
          onClose={() => setShowBlockPicker(false)}
          position={blockPickerPosition}
        />
      )}
    </>
  );
}

export default function FloatingAddBlockPlugin({
  anchorElem = document.body,
}: {
  anchorElem?: HTMLElement;
}): React.JSX.Element {
  const [editor] = useLexicalComposerContext();

  return createPortal(
    <FloatingAddBlockButton editor={editor} anchorElem={anchorElem} />,
    anchorElem,
  );
}
