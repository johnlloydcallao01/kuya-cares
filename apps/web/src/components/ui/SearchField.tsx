"use client";

import React, { useRef } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  onClick?: () => void;
  readOnly?: boolean;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  showClear?: boolean;
};

export default function SearchField({ value, onChange, placeholder = "Search", className = "", inputClassName = "", disabled = false, onClick, readOnly = false, autoFocus = false, onKeyDown, showClear = true }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className={("relative flex items-center " + className).trim()}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        onClick={onClick}
        readOnly={readOnly}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        ref={inputRef}
        className={("w-full h-10 pl-10 pr-4 rounded-full border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 shadow-sm focus:ring-2 focus:ring-[#239459] focus:border-transparent dark:border-[#3f3f46] dark:bg-[#111111] dark:text-white dark:placeholder:text-[#71717a] " + inputClassName).trim()}
      />
      <i className="fas fa-search absolute left-3 text-gray-400" />
      {showClear && !readOnly && !disabled && value && (
        <button
          type="button"
          aria-label="Clear"
          onClick={(e) => { e.preventDefault(); onChange(""); inputRef.current?.focus(); }}
          className="absolute right-3 text-gray-400 hover:text-gray-600"
        >
          <i className="fas fa-times"></i>
        </button>
      )}
    </div>
  );
}
