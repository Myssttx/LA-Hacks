export function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-flex h-1.5 w-1.5 ${className}`}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6b00] opacity-60" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ff6b00]" />
    </span>
  );
}
