import React, { useEffect, useRef } from 'react';

export const AdvancedBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      time += 0.005;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw grid points (dense points)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      const gap = 30;
      for (let x = 0; x < canvas.width; x += gap) {
        for (let y = 0; y < canvas.height; y += gap) {
          ctx.fillRect(x, y, 1, 1);
        }
      }

      // Draw contour lines (等高线)
      ctx.strokeStyle = 'rgba(230, 194, 0, 0.08)';
      ctx.lineWidth = 0.8;

      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        const yBase = (i * (canvas.height / 10) + time * 30) % (canvas.height + 200) - 100;
        
        ctx.moveTo(-100, yBase);
        for (let x = -100; x < canvas.width + 100; x += 40) {
          // Perlin-like noise simulation
          const noise = Math.sin(x * 0.001 + time + i * 0.5) * 40 + 
                        Math.sin(x * 0.002 - time * 0.3) * 20;
          ctx.lineTo(x, yBase + noise);
        }
        ctx.stroke();
      }

      // Add "Data Streams" (Dense vertical lines)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      for (let i = 0; i < 8; i++) {
        const x = (i * 400 + time * 120) % (canvas.width + 100) - 50;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
        background: '#050505'
      }}
    />
  );
};
