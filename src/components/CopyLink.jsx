import { useState } from 'react';

export default function CopyLink({ roomId }) {
  const [copied, setCopied] = useState(false);

  const link = `${window.location.origin}/game/${roomId.toUpperCase()}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="copy-link">
      <input
        className="copy-link__input"
        type="text"
        value={link}
        readOnly
        id="invite-link"
      />
      <button
        className={`copy-link__btn ${copied ? 'copy-link__btn--copied' : ''}`}
        onClick={handleCopy}
        title="Copier le lien"
        id="copy-link-btn"
      >
        {copied ? '✅' : '📋'}
      </button>
    </div>
  );
}
