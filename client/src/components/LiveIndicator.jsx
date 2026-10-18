import React from 'react';

/**
 * Small animated dot indicating live SSE connection status.
 * Props:
 *   live: boolean
 */
export default function LiveIndicator({ live }) {
  return (
    <span className={`live-label${live ? '' : ' offline'}`}>
      <span className={`live-dot${live ? '' : ' offline'}`} />
      {live ? 'Live' : 'Offline'}
    </span>
  );
}
