import React, { useState } from 'react';
import { mediaUrl } from '../derive/catalog';

/**
 * An exercise image, or a readable stand-in.
 *
 * The showcase used raw `<img src={img(ex.image)}>` because its mock data always
 * had a picture. Real sessions carry hand-typed exercises with no catalogue
 * entry, and the catalogue itself is a lazy chunk that may not have arrived yet
 * — both cases previously rendered a broken-image glyph. Solving it once here
 * covers both skins and every screen.
 *
 * Passing `gif` shows the animation instead of the still. It degrades in steps —
 * gif, then still, then initials — because the two live on the same CDN but not
 * every catalogue entry has both, and a failed gif should fall back to the photo
 * rather than all the way to two letters. Only the Train disc and the detail
 * sheet pass it; a 300 KB animation behind a 42px thumbnail is pure waste.
 */
export const ExerciseThumb: React.FC<{
  name: string;
  image?: string;
  gif?: string;
  className?: string;
  alt?: string;
}> = ({ name, image, gif, className, alt }) => {
  const [failed, setFailed] = useState<string[]>([]);

  const source = [gif, image].find(candidate => candidate && !failed.includes(candidate));

  if (!source) {
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word[0]?.toUpperCase() ?? '')
      .join('');
    return (
      <span className={className} data-placeholder="true" aria-hidden="true">
        {initials || '—'}
      </span>
    );
  }

  return (
    <img
      // Keyed on the source so swapping from a failed gif to the still actually
      // remounts the element rather than reusing the errored one.
      key={source}
      className={className}
      src={mediaUrl(source)}
      alt={alt ?? name}
      loading="lazy"
      // A drag that starts on an image begins a native image drag and fires
      // `pointercancel`, which silently kills the swipe on the Train disc.
      draggable={false}
      onError={() => setFailed(prev => [...prev, source])}
    />
  );
};
