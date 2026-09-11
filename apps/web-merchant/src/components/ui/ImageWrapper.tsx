import NextImage from 'next/image';
import { ComponentProps } from 'react';

type ImageProps = ComponentProps<typeof NextImage>;

export default function Image(props: ImageProps): any {
  // @ts-ignore
  return <NextImage {...props} />;
}
