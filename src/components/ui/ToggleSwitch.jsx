import React from 'react';

export default function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  labelledBy,
  label,
}) {
  const sm = size === 'sm';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        // Empêche le double-déclenchement quand le switch est imbriqué
        // dans une rangée cliquable (parent + enfant)
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      className={`relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
        sm ? 'h-[18px] w-8' : 'h-5 w-9'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      style={{
        backgroundColor: checked ? 'var(--accent-color)' : 'var(--switch-off)',
      }}
    >
      <span
        className={`pointer-events-none absolute left-0.5 rounded-full bg-[#fff] transition-transform duration-200 ease-out ${
          sm ? 'h-3.5 w-3.5' : 'h-4 w-4'
        } ${checked ? (sm ? 'translate-x-3.5' : 'translate-x-4') : 'translate-x-0'}`}
      />
    </button>
  );
}
