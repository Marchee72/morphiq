import React from 'react';

function renderInline(text: string): React.ReactNode[] {
  // Regex for **bold**, *italic*, and `code`
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={index}
          style={{
            background: 'rgba(255,255,255,0.15)',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: '0.9em',
            fontFamily: 'monospace',
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export const FormattedMarkdown: React.FC<{ content: string; style?: React.CSSProperties }> = ({ content, style }) => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ margin: '4px 0 6px 0', paddingLeft: 18 }}>
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    if (trimmed.startsWith('### ') || trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      flushList();
      const headerText = trimmed.replace(/^#+\s*/, '');
      elements.push(
        <div key={index} style={{ fontWeight: 700, fontSize: '1.05em', margin: '8px 0 4px 0' }}>
          {renderInline(headerText)}
        </div>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const itemText = trimmed.slice(2);
      currentList.push(<li key={index} style={{ margin: '2px 0' }}>{renderInline(itemText)}</li>);
    } else if (/^\d+\.\s/.test(trimmed)) {
      flushList();
      const itemText = trimmed.replace(/^\d+\.\s*/, '');
      const numPrefix = trimmed.match(/^\d+\./)?.[0] || '';
      elements.push(
        <div key={index} style={{ margin: '2px 0 2px 4px' }}>
          <strong>{numPrefix}</strong> {renderInline(itemText)}
        </div>
      );
    } else {
      flushList();
      elements.push(
        <p key={index} style={{ margin: '4px 0' }}>
          {renderInline(trimmed)}
        </p>
      );
    }
  });

  flushList();

  return <div style={{ lineHeight: '1.45', ...style }}>{elements}</div>;
};
