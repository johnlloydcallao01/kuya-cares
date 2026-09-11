// Complete React 19 compatibility override
 
declare module 'react' {
  namespace React {
    type ReactNode = any;
    type ReactElement<_P = any, _T = any> = any;
    type ComponentType<_P = any> = any;
    type FC<_P = any> = any;
    type FunctionComponent<_P = any> = any;
    type Component<_P = any, _S = any> = any;
    type ComponentClass<_P = any, _S = any> = any;
    type Context<_T> = any;
    type Provider<_T> = any;
    type Consumer<_T> = any;
    type JSXElementConstructor<_P> = any;
    type ReactPortal = any;
    type ReactFragment = any;
    type Key = any;
    type Ref<_T> = any;
    type RefObject<_T> = any;
    type MutableRefObject<_T> = any;
    type ForwardRefExoticComponent<_P> = any;
    type MemoExoticComponent<_T> = any;
    type LazyExoticComponent<_T> = any;
    type ExoticComponent<_P = any> = any;
    type ProviderExoticComponent<_P> = any;
  }
}

declare module 'react-dom' {
  function createPortal(children: any, container: any, key?: any): any;
}

declare global {
  namespace JSX {
    interface Element {
      type: any;
      props: any;
      key: any;
    }
    interface IntrinsicElements {
      [elemName: string]: any;
    }
    interface ElementClass {
      render(): any;
    }
    interface ElementAttributesProperty {
      props: any;
    }
    interface ElementChildrenAttribute {
      children: any;
    }
    interface IntrinsicAttributes {
      key?: any;
    }
    interface IntrinsicClassAttributes<_T> {
      ref?: any;
    }
  }
}

// Fix Lucide React icons - use proper types
declare module 'lucide-react' {
  import { ComponentType } from 'react';

  interface IconProps {
    className?: string;
    size?: number;
    color?: string;
    strokeWidth?: number;
  }

  export const Shield: ComponentType<IconProps>;
  export const Eye: ComponentType<IconProps>;
  export const EyeOff: ComponentType<IconProps>;
  export const AlertCircle: ComponentType<IconProps>;
  export const Loader2: ComponentType<IconProps>;
  export const Users: ComponentType<IconProps>;
  export const FileText: ComponentType<IconProps>;
  export const TrendingUp: ComponentType<IconProps>;
  export const MessageSquare: ComponentType<IconProps>;
  export const BarChart3: ComponentType<IconProps>;
  export const Heart: ComponentType<IconProps>;
  export const Share2: ComponentType<IconProps>;
  export const Plus: ComponentType<IconProps>;
  export const Search: ComponentType<IconProps>;
  export const Filter: ComponentType<IconProps>;
  export const Grid: ComponentType<IconProps>;
  export const List: ComponentType<IconProps>;
  export const Calendar: ComponentType<IconProps>;
  export const User: ComponentType<IconProps>;
  export const Edit: ComponentType<IconProps>;
  export const Trash2: ComponentType<IconProps>;
  export const MoreHorizontal: ComponentType<IconProps>;
  export const Check: ComponentType<IconProps>;
  export const X: ComponentType<IconProps>;
  export const ChevronDown: ComponentType<IconProps>;
  export const Settings: ComponentType<IconProps>;
  export const LogOut: ComponentType<IconProps>;
  export const Upload: ComponentType<IconProps>;
  export const Download: ComponentType<IconProps>;
  export const Image: ComponentType<IconProps>;
  export const Video: ComponentType<IconProps>;
  export const Music: ComponentType<IconProps>;
  export const File: ComponentType<IconProps>;
  export const Globe: ComponentType<IconProps>;
  export const Lock: ComponentType<IconProps>;
  export const ExternalLink: ComponentType<IconProps>;
  export const Hash: ComponentType<IconProps>;
  export const Folder: ComponentType<IconProps>;
  export const MessageCircle: ComponentType<IconProps>;
  export const Flag: ComponentType<IconProps>;
  export const Reply: ComponentType<IconProps>;
  export const AlertTriangle: ComponentType<IconProps>;
  export const CheckCircle: ComponentType<IconProps>;
  export const Mail: ComponentType<IconProps>;
  export const ArrowUpRight: ComponentType<IconProps>;
  export const ArrowDownRight: ComponentType<IconProps>;
  export const Monitor: ComponentType<IconProps>;
  export const Smartphone: ComponentType<IconProps>;
  export const Link: ComponentType<IconProps>;
  export const Save: ComponentType<IconProps>;
  export const Undo: ComponentType<IconProps>;
  export const Redo: ComponentType<IconProps>;
  export const Bold: ComponentType<IconProps>;
  export const Italic: ComponentType<IconProps>;
  export const Underline: ComponentType<IconProps>;
  export const GripVertical: ComponentType<IconProps>;
  export const Type: ComponentType<IconProps>;
  export const Heading1: ComponentType<IconProps>;
  export const Heading2: ComponentType<IconProps>;
  export const Heading3: ComponentType<IconProps>;
  export const Quote: ComponentType<IconProps>;
  export const Code: ComponentType<IconProps>;
  export const ListOrdered: ComponentType<IconProps>;
  export const DollarSign: ComponentType<IconProps>;
  export const Bell: ComponentType<IconProps>;
  export const Palette: ComponentType<IconProps>;
  export const Tag: ComponentType<IconProps>;
  export const Clock: ComponentType<IconProps>;
}

// Fix Next.js Link component
declare module 'next/link' {
  import { ComponentType, ReactNode } from 'react';

  interface LinkProps {
    href: string;
    children: ReactNode;
    className?: string;
    target?: string;
    rel?: string;
    title?: string;
  }

  const Link: ComponentType<LinkProps>;
  export default Link;
}

// Fix Lexical components
declare module '@lexical/react/LexicalContentEditable' {
  import { ComponentType } from 'react';

  interface ContentEditableProps {
    className?: string;
    placeholder?: string;
    style?: React.CSSProperties;
  }

  const ContentEditable: ComponentType<ContentEditableProps>;
  export default ContentEditable;
}

export {};
