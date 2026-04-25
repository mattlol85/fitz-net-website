import React, { useState } from 'react';

function MinecraftViewer({ viewerUrl }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!viewerUrl) {
    return (
      <div className="mc-viewer mc-viewer-empty">
        <p>Waiting for viewer...</p>
      </div>
    );
  }

  return (
    <div className="mc-viewer" style={{ position: 'relative' }}>
      {!loaded && !failed && (
        <div className="mc-viewer mc-viewer-empty" style={{ position: 'absolute', inset: 0 }}>
          <p>⏳ Loading viewer...</p>
        </div>
      )}
      {failed && (
        <div className="mc-viewer mc-viewer-empty" style={{ position: 'absolute', inset: 0 }}>
          <p>⚠️ Viewer failed to load.</p>
          <p style={{ fontSize: '0.75rem', color: '#aaa' }}>
            Try opening <a href={viewerUrl} target="_blank" rel="noreferrer">{viewerUrl}</a> directly.
          </p>
        </div>
      )}
      <iframe
        src={viewerUrl}
        title="Minecraft Bot View"
        className="mc-viewer-iframe"
        allowFullScreen
        style={{ opacity: loaded ? 1 : 0 }}
        onLoad={() => { setLoaded(true); setFailed(false); }}
        onError={() => { setFailed(true); setLoaded(false); }}
      />
    </div>
  );
}

export default MinecraftViewer;
