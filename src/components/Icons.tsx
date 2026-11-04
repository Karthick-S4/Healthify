export function IconToday() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8.5v4.2l2.6 1.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconPeriod() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 16.5v-6M12 16.5V6.5M19 16.5v-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconIdeas() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 19.5v-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 13c-2.8-.6-4.6-3.2-4.8-6.2 3.4.2 5.4 1.8 6.2 3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 12.2c2.4-.8 4.2-2.6 5.2-5.2-2.6.8-4.2 2.4-5.2 4.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function IconSummary() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4.2l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 9.5l5-.7z" {...stroke} />
    </svg>
  );
}

export function IconFood() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h16a8 8 0 0 1-16 0z" {...stroke} />
      <path d="M9 8.5c0-1.2 1-1.6 1-2.8M13 8.5c0-1.2 1-1.6 1-2.8" {...stroke} />
    </svg>
  );
}

export function IconMove() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="14.5" cy="4.8" r="1.7" {...stroke} />
      <path d="M9.5 20l2.2-5 2.6 2.3V21M7 11.5l3-3.2 3.6.4 2 3.3 2.9.8M11.7 15l1.2-5" {...stroke} />
    </svg>
  );
}

export function IconBody() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.5" y="4.5" width="15" height="15" rx="4" {...stroke} />
      <path d="M9 9.5a4.2 4.2 0 0 1 6 0M12 12l1.6-2.4" {...stroke} />
    </svg>
  );
}

export function IconBack() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.5 6l-6 6 6 6" {...stroke} />
    </svg>
  );
}

export function IconMore() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="12" r="1.35" fill="currentColor" />
      <circle cx="12" cy="12" r="1.35" fill="currentColor" />
      <circle cx="18" cy="12" r="1.35" fill="currentColor" />
    </svg>
  );
}
