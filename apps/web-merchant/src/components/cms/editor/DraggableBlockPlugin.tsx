import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getNearestNodeFromDOMNode,
  $getRoot,
  LexicalEditor,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
} from 'lexical';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, GripVertical, Type, Heading1, Heading2, Heading3, Quote, Code, Image, List, ListOrdered, type LucideIcon } from '@/components/ui/IconWrapper';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { $createListNode, $createListItemNode } from '@lexical/list';

const _SPACE = 4;
const _TARGET_LINE_HALF_HEIGHT = 2;
const _DRAGGABLE_BLOCK_MENU_CLASSNAME = 'draggable-block-menu';
const DRAG_DATA_FORMAT = 'application/x-lexical-drag-block';
const _TEXT_BOX_HORIZONTAL_PADDING = 28;

const _Downward = 1;
const _Upward = -1;
const _Indeterminate = 0;

let prevIndex = Infinity;

function _getCurrentIndex(keysLength: number): number {
  if (keysLength === 0) {
    return Infinity;
  }
  if (prevIndex >= 0 && prevIndex < keysLength) {
    return prevIndex;
  }
  return Math.floor(keysLength / 2);
}

function getTopLevelNodeKeys(editor: LexicalEditor): string[] {
  return editor.getEditorState().read(() => $getRoot().getChildrenKeys());
}

function getBlockElement(
  anchorElem: HTMLElement,
  editor: LexicalEditor,
  event: MouseEvent,
  useEdgeAsDefault = false,
): HTMLElement | null {
  const anchorElementRect = anchorElem.getBoundingClientRect();
  const topLevelNodeKeys = getTopLevelNodeKeys(editor);

  let blockElem: HTMLElement | null = null;

  editor.getEditorState().read(() => {
    if (useEdgeAsDefault) {
      const [firstNode, lastNode] = [
        editor.getElementByKey(topLevelNodeKeys[0]),
        editor.getElementByKey(topLevelNodeKeys[topLevelNodeKeys.length - 1]),
      ];

      const [firstNodeRect, lastNodeRect] = [
        firstNode?.getBoundingClientRect(),
        lastNode?.getBoundingClientRect(),
      ];

      if (firstNodeRect && lastNodeRect) {
        if (event.y < firstNodeRect.top) {
          blockElem = firstNode;
        } else if (event.y > lastNodeRect.bottom) {
          blockElem = lastNode;
        }
      }
    }

    if (blockElem === null) {
      topLevelNodeKeys.forEach((key) => {
        const elem = editor.getElementByKey(key);
        if (elem === null) {
          return;
        }
        const point = elem.getBoundingClientRect();
        const offset = event.y - anchorElementRect.top;

        if (
          event.x >= point.left &&
          event.x <= point.right &&
          offset >= point.top &&
          offset <= point.bottom
        ) {
          blockElem = elem;
        }
      });
    }
  });

  return blockElem;
}

// Block type definitions
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

function BlockPickerMenu({
  editor,
  onClose,
  position,
}: {
  editor: LexicalEditor;
  onClose: () => void;
  position: { top: number; left: number };
}): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleBlockSelect = (blockType: BlockType) => {
    blockType.onSelect(editor);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[280px] max-h-[400px] overflow-y-auto"
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
          className="w-full flex items-center px-3 py-2 text-left hover:bg-gray-50 transition-colors"
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
    </div>
  );
}

function DraggableBlockMenu({
  anchorElem,
  editor,
  onAddBlock: _onAddBlock,
}: {
  anchorElem: HTMLElement;
  editor: LexicalEditor;
  onAddBlock: () => void;
}): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null);
  const _targetLineRef = useRef<HTMLDivElement>(null);
  const isDraggingBlockRef = useRef<boolean>(false);
  const [draggableBlockElem, setDraggableBlockElem] = useState<HTMLElement | null>(null);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [blockPickerPosition, setBlockPickerPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      const target = event.target;
      if (!target) {
        setDraggableBlockElem(null);
        return;
      }

      if (isDraggingBlockRef.current) {
        return;
      }

      const _draggableBlockElem = getBlockElement(anchorElem, editor, event);

      setDraggableBlockElem(_draggableBlockElem);
    }

    function onMouseLeave() {
      setDraggableBlockElem(null);
    }

    anchorElem.addEventListener('mousemove', onMouseMove);
    anchorElem.addEventListener('mouseleave', onMouseLeave);

    return () => {
      anchorElem.removeEventListener('mousemove', onMouseMove);
      anchorElem.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [anchorElem, editor]);

  useEffect(() => {
    if (menuRef.current) {
      const menuElem = menuRef.current;
      const rootElement = editor.getRootElement();

      if (draggableBlockElem && rootElement) {
        const draggableBlockRect = draggableBlockElem.getBoundingClientRect();
        const rootElementRect = rootElement.getBoundingClientRect();

        const top = draggableBlockRect.top - rootElementRect.top - 6;
        menuElem.style.opacity = '1';
        menuElem.style.transform = `translate(-25px, ${top}px)`;
      } else {
        menuElem.style.opacity = '0';
        menuElem.style.transform = 'translate(-10000px, -10000px)';
      }
    }
  }, [draggableBlockElem, editor]);

  return (
    <div ref={menuRef} className="draggable-block-menu opacity-0 absolute left-0 top-0 will-change-transform">
      <div className="flex items-center">
        <button
          className="draggable-block-menu-btn p-1 rounded hover:bg-gray-200 cursor-grab active:cursor-grabbing"
          draggable="true"
          onDragStart={(event) => {
            if (!draggableBlockElem) {
              return false;
            }
            setDragImage(event.dataTransfer, draggableBlockElem);
            let nodeKey = '';
            editor.update(() => {
              const node = $getNearestNodeFromDOMNode(draggableBlockElem);
              if (node) {
                nodeKey = node.getKey();
              }
            });
            isDraggingBlockRef.current = true;
            event.dataTransfer.setData(DRAG_DATA_FORMAT, nodeKey);
          }}
          onDragEnd={() => {
            isDraggingBlockRef.current = false;
          }}
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
        </button>
        <button
          className="draggable-block-menu-btn p-1 rounded hover:bg-gray-200 ml-1"
          onClick={(_event) => {
            if (menuRef.current) {
              const rect = menuRef.current.getBoundingClientRect();
              setBlockPickerPosition({
                top: rect.bottom + 4,
                left: rect.left,
              });
              setShowBlockPicker(true);
            }
          }}
        >
          <Plus className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      {showBlockPicker && (
        <BlockPickerMenu
          editor={editor}
          onClose={() => setShowBlockPicker(false)}
          position={blockPickerPosition}
        />
      )}
    </div>
  );
}

function setDragImage(dataTransfer: DataTransfer, draggableBlockElem: HTMLElement) {
  const { transform } = draggableBlockElem.style;

  // Remove dragImage borders
  draggableBlockElem.style.transform = 'rotate(5deg)';
  dataTransfer.setDragImage(draggableBlockElem, 0, 0);

  setTimeout(() => {
    draggableBlockElem.style.transform = transform;
  });
}

export default function DraggableBlockPlugin({
  anchorElem = document.body,
  onAddBlock,
}: {
  anchorElem?: HTMLElement;
  onAddBlock: () => void;
}): React.JSX.Element {
  const [editor] = useLexicalComposerContext();

  return createPortal(
    <DraggableBlockMenu
      anchorElem={anchorElem}
      editor={editor}
      onAddBlock={onAddBlock}
    />,
    anchorElem,
  );
}
