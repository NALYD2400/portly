import React from 'react';

export default function ToggleSwitch({ checked, onChange, disabled = false, size = 'md' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex shrink-0 cursor-pointer items-center rounded-full border transition-all duration-300 ease-out focus:outline-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:scale-[1.04] active:scale-95'
      } ${
        size === 'sm' ? 'h-5 w-9 border-transparent' : 'h-6.5 w-12 border-white/10 p-0.5'
      }`}
      style={{
        backgroundColor: checked
          ? 'var(--accent-color, #a855f7)'
          : 'rgba(255, 255, 255, 0.08)',
        boxShadow: checked
          ? '0 0 16px rgba(var(--accent-color-rgb, 168, 85, 247), 0.5), inset 0 1px 1px rgba(255,255,255,0.3)'
          : 'inset 0 1px 3px rgba(0, 0, 0, 0.5)',
      }}
    >
      <span
        className={`pointer-events-none flex items-center justify-center rounded-full bg-white transition-all duration-300 ease-out ${
          size === 'sm' ? 'h-4 w-4' : 'h-5.5 w-5.5'
        } ${
          checked
            ? size === 'sm' ? 'translate-x-4 shadow-sm' : 'translate-x-5.5 shadow-md shadow-black/40'
            : 'translate-x-0 bg-gray-300 shadow-inner'
        }`}
      >
        {checked && (
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: 'var(--accent-color, #a855f7)' }}
          />
        )}
      </span>
    </button>
  );
}
