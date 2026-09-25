import Image from 'next/image';
import Link from 'next/link';

export const BRAND_LOGO_SRC = '/images/nexusshield-logo.png';

/** Intrinsic size of the transparent lockup PNG. */
export const BRAND_LOGO_WIDTH = 698;
export const BRAND_LOGO_HEIGHT = 606;

interface BrandLogoProps {
  href?: string;
  showText?: boolean;
  size?: number;
  textClassName?: string;
  className?: string;
  imageClassName?: string;
}

export function BrandLogo({
  href = '/',
  showText = false,
  size: _size = 40,
  textClassName = 'text-sm font-semibold tracking-tight text-zinc-100',
  className = '',
  imageClassName = 'h-11 w-auto max-h-14 sm:h-12 lg:h-14',
}: BrandLogoProps) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-2 bg-transparent shadow-none select-none cursor-pointer ${className}`}
      aria-label="Nexus Shield home"
    >
      <Image
        src={BRAND_LOGO_SRC}
        alt="Nexus Shield — AI • API • SEC"
        width={BRAND_LOGO_WIDTH}
        height={BRAND_LOGO_HEIGHT}
        sizes="(max-width: 640px) 56px, (max-width: 1024px) 64px, 72px"
        quality={95}
        className={`pointer-events-none shrink-0 bg-transparent object-contain select-none border-0 shadow-none ring-0 drop-shadow-none ${imageClassName}`}
        style={{ backgroundColor: 'transparent', filter: 'none', boxShadow: 'none' }}
        priority
      />
      {showText ? <span className={`select-none ${textClassName}`}>Nexus Shield</span> : null}
    </Link>
  );
}
