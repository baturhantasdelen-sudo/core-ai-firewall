import Image from 'next/image';
import Link from 'next/link';

interface BrandLogoProps {
  href?: string;
  showText?: boolean;
  size?: number;
  textClassName?: string;
  className?: string;
}

export function BrandLogo({
  href = '/',
  showText = true,
  size = 40,
  textClassName = 'text-sm font-semibold tracking-tight text-zinc-100',
  className = '',
}: BrandLogoProps) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-2 select-none cursor-pointer ${className}`}
      aria-label="Nexus Shield home"
    >
      <Image
        src="/logo.png"
        alt="Nexus Shield Logo"
        width={size}
        height={size}
        className="pointer-events-none object-contain select-none"
        priority
      />
      {showText ? <span className={`select-none ${textClassName}`}>Nexus Shield</span> : null}
    </Link>
  );
}
