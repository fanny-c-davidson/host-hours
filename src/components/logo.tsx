export function LogoMark({ className = "w-9 h-9" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200">
      <rect width="200" height="200" rx="37" fill="#4A148C" />
      <path d="M 50 40 L 150 40 L 100 95 Z" fill="#FBF8F1" />
      <path d="M 50 160 L 150 160 L 100 105 Z" fill="#FBF8F1" />
      <circle cx="100" cy="100" r="6" fill="#FF6B35" />
    </svg>
  );
}
