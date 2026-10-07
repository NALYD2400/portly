import React from 'react';

export default function EmptyState({ icon: Icon, title, description, command, children, className = '' }) {
  return (
    <div className={'empty-state-panel ' + className}>
      {Icon && <Icon size={24} aria-hidden="true" />}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {command && <code title={command}>{command}</code>}
      {children}
    </div>
  );
}
