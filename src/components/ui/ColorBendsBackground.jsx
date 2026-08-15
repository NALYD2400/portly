import React, { useEffect, useRef } from 'react';

function readAccentRgb() {
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--accent-color-rgb') ||
    '168, 85, 247'
  ).trim();
}

export default function ColorBendsBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let running = true;

    // Le respect de prefers-reduced-motion désactive l'animation continue
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // L'accent est relu uniquement quand il change (plus de getComputedStyle à chaque frame)
    let cachedRgb = readAccentRgb();
    let checkCounter = 0;

    let time = 0;

    const drawFrame = (timestamp) => {
      time = timestamp / 1000;

      if (++checkCounter % 120 === 0) {
        const current = readAccentRgb();
        if (current !== cachedRgb) {
          cachedRgb = current;
        }
      }

      // Dark space background
      ctx.fillStyle = '#06060c';
      ctx.fillRect(0, 0, width, height);

      // Vagues colorées réactives synchronisées sur l'accent du thème
      const waves = [
        { color: `rgba(${cachedRgb}, 0.22)`, y: height * 0.4, amp: 120, freq: 0.0015, speed: 0.8 },
        { color: `rgba(${cachedRgb}, 0.16)`, y: height * 0.6, amp: 160, freq: 0.001, speed: 1.2 },
        { color: `rgba(${cachedRgb}, 0.10)`, y: height * 0.5, amp: 100, freq: 0.002, speed: 0.5 },
        { color: 'rgba(56, 189, 248, 0.06)', y: height * 0.3, amp: 140, freq: 0.0012, speed: 0.9 },
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
      orbGrad.addColorStop(0, `rgba(${cachedRgb}, 0.22)`);
      orbGrad.addColorStop(0.5, `rgba(${cachedRgb}, 0.06)`);
      orbGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = orbGrad;
      ctx.fillRect(0, 0, width, height);
    };

    const render = (timestamp) => {
      if (!running) return;
      drawFrame(reducedMotion ? 0 : timestamp);
      animationFrameId = requestAnimationFrame(render);
    };

    // Pause du rendu quand la fenêtre est masquée (économie CPU/GPU)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!running) {
          running = true;
          animationFrameId = requestAnimationFrame(render);
        }
      } else {
        running = false;
        cancelAnimationFrame(animationFrameId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    render(0);

    return () => {
      running = false;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0"
      style={{ filter: 'blur(30px)' }}
    />
  );
}
