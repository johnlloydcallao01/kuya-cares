'use client';

import React, { useCallback, useEffect } from 'react';
import {
  $createParagraphNode,
  $getRoot,
  EditorState
} from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isRangeSelection, $getSelection, FORMAT_TEXT_COMMAND, TextFormatType } from 'lexical';


import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';

// Lexical nodes
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { ListItemNode, ListNode } from '@lexical/list';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';

import { ToolbarPlugin } from './editor/ToolbarPlugin';
import { AutoLinkPlugin } from './editor/AutoLinkPlugin';
import SlashCommandPlugin from './editor/SlashCommandPlugin';
import BlockControlsPlugin from './editor/BlockControlsPlugin';

interface RichTextEditorProps {
  value?: unknown;
  onChange?: (value: unknown) => void;
  placeholder?: string;
  className?: string;
}

// Editor configuration - moved outside component to prevent recreation
const createEditorConfig = () => ({
  namespace: 'tap2goMerchantEditor',
  nodes: [
    HeadingNode,
    ListNode,
    ListItemNode,
    QuoteNode,
    CodeNode,
    CodeHighlightNode,
    TableNode,
    TableCellNode,
    TableRowNode,
    AutoLinkNode,
    LinkNode,
    HorizontalRuleNode,
  ],
  onError(error: Error) {
    console.error('Lexical Editor Error:', error);
  },
  theme: {
    root: 'editor-root',
    paragraph: 'editor-paragraph',
    heading: {
      h1: 'editor-heading-h1',
      h2: 'editor-heading-h2',
      h3: 'editor-heading-h3',
      h4: 'editor-heading-h4',
      h5: 'editor-heading-h5',
      h6: 'editor-heading-h6',
    },
    list: {
      nested: {
        listitem: 'editor-nested-listitem',
      },
      ol: 'editor-list-ol',
      ul: 'editor-list-ul',
      listitem: 'editor-listitem',
    },
    image: 'editor-image',
    link: 'editor-link',
    text: {
      bold: 'font-bold',
      italic: 'italic',
      underline: 'underline',
      strikethrough: 'line-through',
      code: 'editor-text-code',
    },
    code: 'editor-code',
    codeHighlight: {
      atrule: 'editor-tokenAttr',
      attr: 'editor-tokenAttr',
      boolean: 'editor-tokenProperty',
      builtin: 'editor-tokenSelector',
      cdata: 'editor-tokenComment',
      char: 'editor-tokenSelector',
      class: 'editor-tokenFunction',
      'class-name': 'editor-tokenFunction',
      comment: 'editor-tokenComment',
      constant: 'editor-tokenProperty',
      deleted: 'editor-tokenProperty',
      doctype: 'editor-tokenComment',
      entity: 'editor-tokenOperator',
      function: 'editor-tokenFunction',
      important: 'editor-tokenVariable',
      inserted: 'editor-tokenSelector',
      keyword: 'editor-tokenAttr',
      namespace: 'editor-tokenVariable',
      number: 'editor-tokenProperty',
      operator: 'editor-tokenOperator',
      prolog: 'editor-tokenComment',
      property: 'editor-tokenProperty',
      punctuation: 'editor-tokenPunctuation',
      regex: 'editor-tokenVariable',
      selector: 'editor-tokenSelector',
      string: 'editor-tokenSelector',
      symbol: 'editor-tokenProperty',
      tag: 'editor-tokenProperty',
      url: 'editor-tokenOperator',
      variable: 'editor-tokenVariable',
    },
  },
});

// Plugin to handle editor state changes
function OnChangeStatePlugin({
  onChange
}: {
  onChange: (editorState: EditorState) => void
}) {
  return (
    <OnChangePlugin
      onChange={onChange}
    />
  );
}

// Plugin to set initial value
function InitialValuePlugin({ value }: { value?: unknown }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (value && editor) {
      try {
        const editorState = editor.parseEditorState(value as string);
        editor.setEditorState(editorState);
      } catch (error) {
        console.warn('Failed to parse initial editor state:', error);
        // Set default content if parsing fails
        editor.update(() => {
          const root = $getRoot();
          if (root.isEmpty()) {
            const paragraph = $createParagraphNode();
            root.append(paragraph);
          }
        });
      }
    }
  }, [editor, value]);

  return null;
}

// Plugin to ensure text formatting commands work
function TextFormattingPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Register command handlers for text formatting
    const unregister = editor.registerCommand(
      FORMAT_TEXT_COMMAND,
      (format: TextFormatType) => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.formatText(format);
        }
        return true;
      },
      1 // Priority
    );

    return unregister;
  }, [editor]);

  return null;
}

// Create a stable config outside the component
const EDITOR_CONFIG = createEditorConfig();

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing...",
  className = ""
}: RichTextEditorProps) {


  const handleChange = useCallback((editorState: EditorState) => {
    if (onChange) {
      // Convert editor state to JSON for storage
      const serializedState = JSON.stringify(editorState.toJSON());
      onChange(serializedState);
    }
  }, [onChange]);

  return (
    <div className={`relative border border-gray-300 rounded-lg overflow-hidden ${className}`}>
      <LexicalComposer initialConfig={EDITOR_CONFIG}>
        <div className="editor-container relative bg-white">
        <div className="editor-inner bg-white relative leading-5 font-normal text-left rounded-t-lg">
          <ToolbarPlugin />
          <div className="editor-content bg-white relative min-h-[300px] text-base outline-none p-2.5">
            <style dangerouslySetInnerHTML={{
              __html: `
                .editor-content .editor-paragraph {
                  margin: 0;
                  padding: 12px 20px;
                  min-height: 1.5em;
                  position: relative;
                  border-radius: 4px;
                  transition: background-color 0.15s ease;
                }
                .editor-content .editor-paragraph:hover {
                  background-color: #f9fafb;
                }
                .editor-content .editor-heading-h1 {
                  font-size: 2.25em;
                  font-weight: 700;
                  margin: 0;
                  padding: 16px 20px;
                  min-height: 1.2em;
                  line-height: 1.2;
                  border-radius: 4px;
                  transition: background-color 0.15s ease;
                }
                .editor-content .editor-heading-h1:hover {
                  background-color: #f9fafb;
                }
                .editor-content .editor-heading-h2 {
                  font-size: 1.75em;
                  font-weight: 600;
                  margin: 0;
                  padding: 14px 20px;
                  min-height: 1.3em;
                  line-height: 1.3;
                  border-radius: 4px;
                  transition: background-color 0.15s ease;
                }
                .editor-content .editor-heading-h2:hover {
                  background-color: #f9fafb;
                }
                .editor-content .editor-heading-h3 {
                  font-size: 1.375em;
                  font-weight: 600;
                  margin: 0;
                  padding: 12px 20px;
                  min-height: 1.4em;
                  line-height: 1.4;
                  border-radius: 4px;
                  transition: background-color 0.15s ease;
                }
                .editor-content .editor-heading-h3:hover {
                  background-color: #f9fafb;
                }
                .editor-content .editor-quote {
                  border-left: 4px solid #3b82f6;
                  padding: 16px 20px 16px 24px;
                  margin: 8px 0;
                  font-style: italic;
                  background-color: #f8fafc;
                  border-radius: 0 4px 4px 0;
                  color: #475569;
                  font-size: 1.1em;
                  line-height: 1.6;
                }
                .editor-content .editor-list-ol,
                .editor-content .editor-list-ul {
                  margin: 8px 0;
                  padding: 8px 20px 8px 44px;
                }
                .editor-content .editor-listitem {
                  margin: 6px 0;
                  padding: 4px 0;
                  line-height: 1.6;
                }
                .editor-content .editor-nested-listitem {
                  list-style: none;
                }
                .editor-content .editor-code {
                  background-color: #f1f5f9;
                  border: 1px solid #e2e8f0;
                  border-radius: 6px;
                  padding: 16px 20px;
                  margin: 8px 0;
                  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                  font-size: 0.875em;
                  line-height: 1.5;
                  overflow-x: auto;
                }
                .editor-content [data-lexical-editor] > * {
                  position: relative;
                }
                .editor-content [data-lexical-editor] > *:hover {
                  outline: 1px solid #e5e7eb;
                  outline-offset: -1px;
                }
              `
            }} />
            <RichTextPlugin
              contentEditable={
                React.createElement(ContentEditable, {
                  className: "editor-input min-h-[300px] outline-none resize-none text-gray-900 leading-relaxed",
                  style: { caretColor: '#1f2937' }
                })
              }
              placeholder={
                <div className="editor-placeholder absolute text-gray-400 pointer-events-none" style={{ top: '22px', left: '30px', lineHeight: '1.5em' }}>
                  <span>{placeholder || "Start writing..."}</span>
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <OnChangeStatePlugin onChange={handleChange} />
            <InitialValuePlugin value={value} />
            <TextFormattingPlugin />
            <HistoryPlugin />
            <AutoFocusPlugin />
            <LinkPlugin />
            <AutoLinkPlugin />
            <ListPlugin />
            <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
            <TabIndentationPlugin />
            <SlashCommandPlugin />
            <BlockControlsPlugin />
          </div>
        </div>
        </div>
      </LexicalComposer>
    </div>
  );
}
