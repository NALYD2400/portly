import React, { useEffect, useRef, useState } from 'react';

/** Keep the actual iframe viewport at the selected dimensions, scale only its presentation. */
export default function PreviewFrame({ url, frameKey, width, height, fit = true, children, name }) {
  const host = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const viewportWidth = width || Math.max(1, Math.floor(size.width));
  const viewportHeight = height || Math.max(1, Math.floor(size.height));
  const scale = fit ? Math.min(1, size.width / viewportWidth, size.height / viewportHeight) : 1;
  return (
    <div className="preview-frame-host" ref={host} aria-label={name}>
      {size.width > 0 && (
        <div
          className="preview-frame"
          style={{
            width: viewportWidth * scale,
            height: viewportHeight * scale,
          }}
        >
          {children || (
            <iframe
              key={frameKey}
              title={`${name} · ${viewportWidth} × ${viewportHeight}`}
              src={url}
              style={{
                width: viewportWidth,
                height: viewportHeight,
                transform: `scale(${scale})`,
              }}
              allow="clipboard-write; fullscreen"
            />
          )}
        </div>
      )}
    </div>
  );
}
