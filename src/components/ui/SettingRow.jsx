import React, { useId } from 'react';
import ToggleSwitch from './ToggleSwitch';

export default function SettingRow({ title, description, checked, onToggle, children }) {
  const id = useId();
  return (
    <div className="setting-row">
      <div className="min-w-0">
        <div id={id} className="text-[13px] font-medium text-zinc-100">
          {title}
        </div>
        {description && <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{description}</p>}
      </div>
      <div className="setting-control">
        {children || <ToggleSwitch checked={!!checked} onChange={onToggle} labelledBy={id} />}
      </div>
    </div>
  );
}
