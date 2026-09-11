'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  LexicalEditor,
  TextNode,
} from 'lexical';
import { createPortal } from 'react-dom';
import { Type, Heading1, Heading2, Heading3, Quote, Code, Image, List, ListOrdered, type LucideIcon } from '@/components/ui/IconWrapper';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { $createListNode, $createListItemNode } from '@lexical/list';

interface SlashCommand {
  key: string;
  name: string;
  icon: LucideIcon;
  description: string;
  keywords: string[];
  onSelect: (editor: LexicalEditor, textNode: TextNode) => void;
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    key: 'paragraph',
    name: 'Paragraph',
    icon: Type,
    description: 'Start writing with plain text',
    keywords: ['paragraph', 'text', 'p'],
    onSelect: (editor, textNode) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          textNode.remove();
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
    keywords: ['heading', 'h1', 'title'],
    onSelect: (editor, textNode) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          textNode.remove();
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
    keywords: ['heading', 'h2', 'subtitle'],
    onSelect: (editor, textNode) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          textNode.remove();
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
    keywords: ['heading', 'h3'],
    onSelect: (editor, textNode) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          textNode.remove();
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
    keywords: ['quote', 'blockquote', 'citation'],
    onSelect: (editor, textNode) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          textNode.remove();
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
    keywords: ['list', 'bullet', 'ul'],
    onSelect: (editor, textNode) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          textNode.remove();
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
    keywords: ['list', 'number', 'ol', 'ordered'],
    onSelect: (editor, textNode) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          textNode.remove();
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
    keywords: ['code', 'snippet', 'pre'],
    onSelect: (editor, textNode) => {
      // TODO: Implement code block creation
      // TODO: Implement code block creation
      editor.update(() => {
        textNode.remove();
      });
    },
  },
  {
    key: 'image',
    name: 'Image',
    icon: Image,
    description: 'Upload or embed with a link',
    keywords: ['image', 'img', 'picture', 'photo'],
    onSelect: (editor, textNode) => {
      // TODO: Implement image insertion
      // TODO: Implement image insertion
      editor.update(() => {
        textNode.remove();
      });
    },
  },
];

interface SlashCommandMenuProps {
  editor: LexicalEditor;
  textNode: TextNode;
  onClose: () => void;
  position: { top: number; left: number };
  query: string;
}

function SlashCommandMenu({ editor, textNode, onClose, position, query }: SlashCommandMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter commands based on query
  const filteredCommands = SLASH_COMMANDS.filter(command =>
    command.name.toLowerCase().includes(query.toLowerCase()) ||
    command.keywords.some(keyword => keyword.toLowerCase().includes(query.toLowerCase()))
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
        return;
      }
      
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      
      if (event.key === 'Enter') {
        event.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].onSelect(editor, textNode);
          onClose();
        }
        return;
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editor, textNode, onClose, filteredCommands, selectedIndex]);

  const handleCommandSelect = useCallback((command: SlashCommand) => {
    command.onSelect(editor, textNode);
    onClose();
  }, [editor, textNode, onClose]);

  if (filteredCommands.length === 0) {
    return createPortal(
      <div
        ref={menuRef}
        className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[280px]"
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        <div className="px-3 py-2 text-sm text-gray-500">
          No matching commands found
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[280px] max-h-[300px] overflow-y-auto"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
        Commands
      </div>
      {filteredCommands.map((command, index) => (
        <button
          key={command.key}
          className={`w-full flex items-center px-3 py-2 text-left transition-colors focus:outline-none ${
            index === selectedIndex ? 'bg-blue-50 border-r-2 border-blue-500' : 'hover:bg-gray-50'
          }`}
          onClick={() => handleCommandSelect(command)}
        >
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-100 rounded mr-3">
            <command.icon className="w-4 h-4 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">{command.name}</div>
            <div className="text-xs text-gray-500 truncate">{command.description}</div>
          </div>
        </button>
      ))}
    </div>,
    document.body
  );
}

export default function SlashCommandPlugin(): React.JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [textNode, setTextNode] = useState<TextNode | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const unregisterListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) && selection.isCollapsed()) {
          const anchorNode = selection.anchor.getNode();
          
          if (anchorNode instanceof TextNode) {
            const text = anchorNode.getTextContent();
            const offset = selection.anchor.offset;
            
            // Look for slash command pattern
            const beforeCursor = text.slice(0, offset);
            const slashMatch = beforeCursor.match(/\/([a-zA-Z]*)$/);
            
            if (slashMatch) {
              const query = slashMatch[1];
              setQuery(query);
              setTextNode(anchorNode);
              
              // Position the menu using viewport coordinates
              const domSelection = window.getSelection();
              if (domSelection && domSelection.rangeCount > 0) {
                const range = domSelection.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                // Calculate position relative to viewport
                let top = rect.bottom + 4;
                let left = rect.left;

                // Ensure menu doesn't go off-screen
                const menuWidth = 280;
                const menuHeight = 300;

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

                setMenuPosition({ top, left });
                setShowMenu(true);
                return;
              }
            }
          }
        }
        
        setShowMenu(false);
      });
    });

    return unregisterListener;
  }, [editor]);

  return (
    <>
      {showMenu && textNode && (
        <SlashCommandMenu
          editor={editor}
          textNode={textNode}
          onClose={() => setShowMenu(false)}
          position={menuPosition}
          query={query}
        />
      )}
    </>
  );
}
