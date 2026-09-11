/**
 * Link Wrapper Component
 * 
 * Wraps Next.js Link to fix React 19 JSX compatibility issues
 */

import React from 'react';
import NextLink from 'next/link';

interface LinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  title?: string;
}

const Link = ({ href, children, className, target, rel, onClick, title, ...props }: LinkProps) => {
  return React.createElement(
    NextLink,
    {
      href,
      className,
      target,
      rel,
      onClick,
      title,
      ...props,
    },
    children
  );
};

Link.displayName = 'Link';

export default Link;
