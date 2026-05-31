'use client';

import React, { useEffect, useState } from 'react';
import { FiMoon, FiSun } from 'react-icons/fi';
import { useTheme } from './providers/ThemeProvider';
import styles from './ThemeToggle.module.css';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ width: '44px', height: '44px' }} />;
  }

  return (
    <button
      onClick={toggleTheme}
      className={styles.toggle}
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <FiMoon size={20} />
      ) : (
        <FiSun size={20} />
      )}
    </button>
  );
}
