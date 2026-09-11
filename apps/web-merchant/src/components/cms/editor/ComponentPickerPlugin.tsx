import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { $createParagraphNode, $getSelection, $isRangeSelection, TextNode } from 'lexical';
import { useCallback, useMemo, useState } from 'react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { Type,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  type LucideIcon, } from '@/components/ui/IconWrapper';

class ComponentPickerOption extends MenuOption {
  title: string;
  icon: LucideIcon;
  keywords: Array<string>;
  keyboardShortcut?: string;
  onSelect: (queryString: string) => void;

  constructor(
    title: string,
    options: {
      icon: LucideIcon;
      keywords?: Array<string>;
      keyboardShortcut?: string;
      onSelect: (queryString: string) => void;
    },
  ) {
    super(title);
    this.title = title;
    this.keywords = options.keywords || [];
    this.icon = options.icon;
    this.keyboardShortcut = options.keyboardShortcut;
    this.onSelect = options.onSelect.bind(this);
  }
}

function ComponentPickerMenuItem({
  index,
  isSelected,
  onClick,
  onMouseEnter,
  option,
}: {
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  option: ComponentPickerOption;
  key?: string;
}) {
  return (
    <li
      key={option.key}
      tabIndex={-1}
      className={`component-picker-item ${
        isSelected ? 'selected' : ''
      } flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100 ${
        isSelected ? 'bg-blue-100' : ''
      }`}
      ref={option.setRefElement}
      role="option"
      aria-selected={isSelected}
      id={'typeahead-item-' + index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      <option.icon className="w-4 h-4 mr-3 text-gray-600" />
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-900">{option.title}</span>
        {option.keyboardShortcut && (
          <span className="text-xs text-gray-500">{option.keyboardShortcut}</span>
        )}
      </div>
    </li>
  );
}

export default function ComponentPickerMenuPlugin(): React.JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch('/', {
    minLength: 0,
  });

  const options = useMemo(() => {
    const baseOptions = [
      new ComponentPickerOption('Paragraph', {
        icon: Type,
        keywords: ['normal', 'paragraph', 'p', 'text'],
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createParagraphNode());
            }
          }),
      }),
      new ComponentPickerOption('Heading 1', {
        icon: Heading1,
        keywords: ['heading', 'header', 'h1'],
        keyboardShortcut: 'Ctrl+Alt+1',
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode('h1'));
            }
          }),
      }),
      new ComponentPickerOption('Heading 2', {
        icon: Heading2,
        keywords: ['heading', 'header', 'h2'],
        keyboardShortcut: 'Ctrl+Alt+2',
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode('h2'));
            }
          }),
      }),
      new ComponentPickerOption('Heading 3', {
        icon: Heading3,
        keywords: ['heading', 'header', 'h3'],
        keyboardShortcut: 'Ctrl+Alt+3',
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              // Type assertions needed due to Lexical version conflicts
              $setBlocksType(selection, () => $createHeadingNode('h3'));
            }
          }),
      }),
      new ComponentPickerOption('Quote', {
        icon: Quote,
        keywords: ['quote', 'blockquote'],
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createQuoteNode());
            }
          }),
      }),
      new ComponentPickerOption('Code Block', {
        icon: Code,
        keywords: ['code', 'codeblock'],
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              // TODO: Implement code block creation
            }
          }),
      }),
    ];

    if (!queryString) {
      return baseOptions;
    }

    const regex = new RegExp(queryString, 'i');

    return [
      ...baseOptions.filter(
        (option) =>
          regex.test(option.title) ||
          option.keywords != null
            ? option.keywords.some((keyword) => regex.test(keyword))
            : false,
      ),
    ];
  }, [editor, queryString]);

  const onSelectOption = useCallback(
    (
      selectedOption: ComponentPickerOption,
      textNodeContainingQuery: TextNode | null,
      closeMenu: () => void,
      matchingString: string,
    ) => {
      editor.update(() => {
        if (textNodeContainingQuery) {
          textNodeContainingQuery.remove();
        }
        selectedOption.onSelect(matchingString);
        closeMenu();
      });
    },
    [editor],
  );

  return (
    <LexicalTypeaheadMenuPlugin<ComponentPickerOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={checkForTriggerMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) =>
        anchorElementRef.current && options.length
          ? createPortal(
              <div className="component-picker-menu bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[200px] max-h-[300px] overflow-y-auto z-50">
                <ul className="list-none m-0 p-0">
                  {options.map((option, i: number) => (
                    <ComponentPickerMenuItem
                      index={i}
                      isSelected={selectedIndex === i}
                      onClick={() => {
                        setHighlightedIndex(i);
                        selectOptionAndCleanUp(option);
                      }}
                      onMouseEnter={() => {
                        setHighlightedIndex(i);
                      }}
                      key={option.key}
                      option={option}
                    />
                  ))}
                </ul>
              </div>,
              anchorElementRef.current,
            )
          : null
      }
    />
  );
}
