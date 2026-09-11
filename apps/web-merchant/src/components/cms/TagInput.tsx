'use client';

import React, { useState, useRef, KeyboardEvent } from 'react';
import { X, Plus } from '@/components/ui/IconWrapper';

interface Tag {
  tag: string;
}

interface TagInputProps {
  value: Tag[];
  onChange: (tags: Tag[]) => void;
  placeholder?: string;
  maxTags?: number;
  className?: string;
}

export function TagInput({
  value = [],
  onChange,
  placeholder = "Add a tag...",
  maxTags = 10,
  className = ""
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (tagText: string) => {
    const trimmedTag = tagText.trim();
    
    // Validate tag
    if (!trimmedTag) return;
    if (trimmedTag.length > 50) return;
    if (value.length >= maxTags) return;
    
    // Check for duplicates
    const exists = value.some(tag => 
      tag.tag.toLowerCase() === trimmedTag.toLowerCase()
    );
    if (exists) return;

    // Add new tag
    const newTag: Tag = { tag: trimmedTag };
    onChange([...value, newTag]);
    setInputValue('');
  };

  const removeTag = (indexToRemove: number) => {
    const newTags = value.filter((_, index) => index !== indexToRemove);
    onChange(newTags);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
      case ',':
      case ';':
        e.preventDefault();
        addTag(inputValue);
        break;
      case 'Backspace':
        if (!inputValue && value.length > 0) {
          removeTag(value.length - 1);
        }
        break;
      case 'Escape':
        setInputValue('');
        inputRef.current?.blur();
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // Auto-add tag on comma or semicolon
    if (newValue.includes(',') || newValue.includes(';')) {
      const tagText = newValue.replace(/[,;]/g, '').trim();
      if (tagText) {
        addTag(tagText);
      }
      return;
    }
    
    setInputValue(newValue);
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
    // Add tag on blur if there's content
    if (inputValue.trim()) {
      addTag(inputValue);
    }
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Tags Container */}
      <div
        onClick={handleContainerClick}
        className={`
          min-h-[38px] p-2 border rounded-md cursor-text transition-colors
          ${isInputFocused 
            ? 'border-blue-500 ring-1 ring-blue-500' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${value.length >= maxTags ? 'bg-gray-50' : 'bg-white'}
        `}
      >
        <div className="flex flex-wrap gap-1 items-center">
          {/* Existing Tags */}
          {value.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
            >
              {tag.tag}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(index);
                }}
                className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200 focus:outline-none"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          
          {/* Input Field */}
          {value.length < maxTags && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsInputFocused(true)}
              onBlur={handleInputBlur}
              placeholder={value.length === 0 ? placeholder : ''}
              className="flex-1 min-w-[120px] outline-none bg-transparent text-sm text-gray-900 placeholder-gray-500"
              style={{ minWidth: inputValue ? `${inputValue.length + 2}ch` : '120px', caretColor: '#1f2937' }}
            />
          )}
        </div>
      </div>

      {/* Helper Text */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          <span>Press Enter, comma, or semicolon to add tags</span>
          {value.length >= maxTags && (
            <span className="text-amber-600">Maximum {maxTags} tags reached</span>
          )}
        </div>
        <span>{value.length}/{maxTags}</span>
      </div>

      {/* Suggested Tags (Optional) */}
      {isInputFocused && inputValue && (
        <div className="border border-gray-200 rounded-md bg-white shadow-sm">
          <div className="p-2">
            <button
              type="button"
              onClick={() => addTag(inputValue)}
              className="w-full flex items-center px-2 py-1 text-sm text-left hover:bg-gray-50 rounded"
            >
              <Plus className="w-4 h-4 mr-2 text-gray-400" />
              Add &quot;{inputValue}&quot;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
