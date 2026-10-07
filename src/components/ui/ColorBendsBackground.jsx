import React, { useEffect, useRef } from 'react';

function readAccentRgb() {
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--accent-color-rgb') ||
    '168, 85, 247'
  ).trim();
}

export default function ColorBendsBackground({ blur = 30, speed = 100 }) {
  const canvasRef = useRef(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    let animationFrameId;
    let running = false;
    let reducedMotion = false;
    let lastFrame = 0;
    let light = false;

    let width = (canvas.width = canvas.clientWidth);
    let height = (canvas.height = canvas.clientHeight);

    const handleResize = () => {
      width = canvas.width = canvas.clientWidth;
      height = canvas.height = canvas.clientHeight;
      syncRendering();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);

    // L'accent est relu uniquement quand il change (plus de getComputedStyle à chaque frame)
    let cachedRgb = readAccentRgb();

    const drawFrame = () => {
      const time = reducedMotion ? 0 : timeRef.current;
      const strength = light ? 1.2 : 1;
      const color = (alpha) => `rgba(${cachedRgb}, ${alpha * strength})`;
      ctx.clearRect(0, 0, width, height);

      // Vagues colorées réactives synchronisées sur l'accent du thème
      const waves = [
        { color: color(0.22), y: height * 0.4, amp: 120, freq: 0.0015, speed: 0.8 },
        { color: color(0.16), y: height * 0.6, amp: 160, freq: 0.001, speed: 1.2 },
        { color: color(0.10), y: height * 0.5, amp: 100, freq: 0.002, speed: 0.5 },
        { color: color(0.06), y: height * 0.3, amp: 140, freq: 0.0012, speed: 0.9 },
      ];

      waves.forEach((wave) => {
        ctx.beginPath();
        ctx.moveTo(0, height);

        for (let x = 0; x <= width; x += 15) {
          const y =
            wave.y +
            Math.sin(x * wave.freq + time * wave.speed) * wave.amp +
            Math.cos(x * 0.0008 + time * 0.5) * 40;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, wave.y - wave.amp, width, wave.y + wave.amp);
        grad.addColorStop(0, wave.color);
        grad.addColorStop(1, 'rgba(7, 7, 12, 0)');
        ctx.fillStyle = grad;
        ctx.fill();
      });

      // Orbe radial ambiant assorti à l'accent
      const orbX = width * 0.75 + Math.sin(time * 0.3) * 100;
      const orbY = height * 0.3 + Math.cos(time * 0.4) * 80;
      const orbGrad = ctx.createRadialGradient(orbX, orbY, 10, orbX, orbY, 450);
      orbGrad.addColorStop(0, color(0.22));
      orbGrad.addColorStop(0.5, color(0.06));
      orbGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = orbGrad;
      ctx.fillRect(0, 0, width, height);
    };

    const render = (timestamp) => {
      if (!running) return;
      if (timestamp - lastFrame >= 1000 / 30) {
        timeRef.current += Math.min(timestamp - lastFrame, 100) / 1000 * speed / 100;
        drawFrame();
        lastFrame = timestamp;
      }
      animationFrameId = requestAnimationFrame(render);
    };

    // Pause du rendu quand la fenêtre est masquée (économie CPU/GPU)
    const syncRendering = () => {
      cancelAnimationFrame(animationFrameId);
      running = false;
      const root = document.documentElement;
      reducedMotion = root.dataset.motion === 'reduce';
      light = root.dataset.theme === 'light';
      cachedRgb = readAccentRgb();
      if (document.hidden) return;
      drawFrame();
      if (!reducedMotion && speed > 0) {
        running = true;
        lastFrame = performance.now();
        animationFrameId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', syncRendering);
    const observer = new MutationObserver(syncRendering);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-motion', 'style'] });
    syncRendering();

    return () => {
      running = false;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', syncRendering);
      observer.disconnect();
    };
  }, [speed]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="app-background-canvas"
      style={{ filter: `blur(${blur}px)` }}
    />
  );
}
