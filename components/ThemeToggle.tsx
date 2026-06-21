'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { currentTheme, toggleTheme, type Theme } from '@/lib/theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(currentTheme());
    setMounted(true);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setTheme(toggleTheme())}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-text-secondary transition-colors hover:border-brand hover:text-text-primary"
    >
      {/* Render a stable icon until mounted to avoid hydration mismatch. */}
      {mounted && theme === 'light' ? (
        <Sun size={18} aria-hidden />
      ) : (
        <Moon size={18} aria-hidden />
      )}
    </button>
  );
}
