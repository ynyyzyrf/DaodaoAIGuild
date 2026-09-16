import type { CSSProperties } from "react";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASS: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "h-9 w-9 rounded-xl",
  md: "h-11 w-11 rounded-xl",
  lg: "h-14 w-14 rounded-2xl",
};

const SIZE_STYLE: Record<NonNullable<BrandLogoProps["size"]>, CSSProperties> = {
  sm: { width: 36, height: 36, borderRadius: 12 },
  md: { width: 44, height: 44, borderRadius: 12 },
  lg: { width: 56, height: 56, borderRadius: 16 },
};

export default function BrandLogo({ size = "md" }: BrandLogoProps) {
  return (
    <span
      className={`brand-logo inline-flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-inset ring-slate-200 ${SIZE_CLASS[size]}`}
      style={SIZE_STYLE[size]}
      aria-hidden="true"
    >
      <img
        src="/logo.png"
        alt=""
        width={SIZE_STYLE[size].width as number}
        height={SIZE_STYLE[size].height as number}
        className="brand-logo-img h-full w-full object-cover"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </span>
  );
}
