type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASS: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "h-9 w-9 rounded-xl",
  md: "h-11 w-11 rounded-xl",
  lg: "h-14 w-14 rounded-2xl",
};

export default function BrandLogo({ size = "md" }: BrandLogoProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-inset ring-slate-200 ${SIZE_CLASS[size]}`}
      aria-hidden="true"
    >
      <img src="/logo.png" alt="" className="h-full w-full object-cover" />
    </span>
  );
}
