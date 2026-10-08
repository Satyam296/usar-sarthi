import { useState } from 'react';
import { Bot } from 'lucide-react';

/**
 * Renders the USAR crest from /logo.png when present, falling back to a
 * monogrammed icon badge. Drop a real logo file at frontend/public/logo.png
 * (square, transparent background recommended) and it swaps in automatically
 * with no code changes.
 */
export default function BrandMark({ size = 34, iconSize }) {
  const [loaded, setLoaded] = useState(false);
  const resolvedIconSize = iconSize || Math.round(size * 0.55);

  return (
    <span className="brand-mark" style={{ width: size, height: size }}>
      <img
        src="/logo.png"
        alt="USAR crest"
        className="brand-mark-img"
        style={{ display: loaded ? 'block' : 'none' }}
        onLoad={() => setLoaded(true)}
        onError={(event) => { event.currentTarget.style.display = 'none'; }}
      />
      {!loaded && <Bot size={resolvedIconSize} />}
    </span>
  );
}
