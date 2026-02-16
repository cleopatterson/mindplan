export function LogoIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className={className}>
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
      <path d="M16 7a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" fill="#fff" />
      <path d="M16 11v4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="20" r="2" fill="#fff" opacity=".9" />
      <circle cx="16" cy="18" r="2" fill="#fff" opacity=".9" />
      <circle cx="23" cy="20" r="2" fill="#fff" opacity=".9" />
      <path d="M16 15l-7 5M16 15v3M16 15l7 5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".6" />
      <circle cx="6" cy="26" r="1.5" fill="#fff" opacity=".7" />
      <circle cx="12" cy="25" r="1.5" fill="#fff" opacity=".7" />
      <circle cx="20" cy="25" r="1.5" fill="#fff" opacity=".7" />
      <circle cx="26" cy="26" r="1.5" fill="#fff" opacity=".7" />
      <path d="M9 22l-3 4M9 22l3 3M23 22l-3 3M23 22l3 4" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity=".4" />
    </svg>
  );
}

export function LogoFull({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizes = {
    sm: { icon: 'w-6 h-6', text: 'text-lg', gap: 'gap-2' },
    md: { icon: 'w-8 h-8', text: 'text-xl', gap: 'gap-2.5' },
    lg: { icon: 'w-10 h-10', text: 'text-3xl', gap: 'gap-3' },
    xl: { icon: 'w-14 h-14', text: 'text-5xl sm:text-6xl', gap: 'gap-4' },
  };
  const s = sizes[size];

  return (
    <div className={`inline-flex items-center ${s.gap}`}>
      <LogoIcon className={s.icon} />
      <span className={`${s.text} font-bold tracking-tight`}>
        <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
          Mind
        </span>
        <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Plan
        </span>
      </span>
    </div>
  );
}
