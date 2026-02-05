'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
    const { setTheme, theme } = useTheme();

    return (
        <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 border border-slate-700/50 hover:border-slate-600 transition-all duration-200 group dark:bg-slate-800/50 dark:border-slate-700/50 bg-white border-slate-200 hover:bg-slate-50"
            aria-label="Toggle theme"
        >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-slate-900" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-slate-100 top-2" />
            <span className="sr-only">Toggle theme</span>
        </button>
    );
}
