export function AtelierIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <title>缝纫间</title>
      <path d="m8 3-5 4 2 5 3-2v11h8V10l3 2 2-5-5-4-4 3z" strokeLinejoin="round" />
      <path d="M12 6v15M8 15h3m2 0h3" />
    </svg>
  );
}
