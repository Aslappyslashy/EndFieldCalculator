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
      time += 0.002; // Slower speed
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw grid points (dense points) - Keep or remove? User asked for contour lines.
      // I'll make them very subtle or remove them if they clash. Let's keep them subtle.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      const gap = 40;
      for (let x = 0; x < canvas.width; x += gap) {
        for (let y = 0; y < canvas.height; y += gap) {
          if (Math.random() > 0.5) ctx.fillRect(x, y, 1, 1);
        }
      }

      // Draw contour lines (等高线) - Dark Gray, Top to Down
      ctx.strokeStyle = 'rgba(80, 80, 80, 0.4)'; // Dark gray
      ctx.lineWidth = 1.2;

      // Create a "terrain" feel by stacking lines
      const lineCount = 15;
      const spacing = canvas.height / 10;
      
      for (let i = 0; i < lineCount; i++) {
        ctx.beginPath();
        
        // Moving down (top to down)
        // (i * spacing + time * speed)
        const yBase = (i * spacing + time * 15) % (canvas.height + 200) - 100;
        
        // Start line
        ctx.moveTo(-50, yBase);
        
        for (let x = -50; x < canvas.width + 50; x += 15) {
          // Complex noise for "isoline" look
          // We want the shape to evolve slowly but maintain coherence
          const noiseX = x * 0.003;
          const noiseY = i * 0.1;
          const noiseT = time * 0.2;
          
          const yOffset = 
            Math.sin(noiseX + noiseT + noiseY) * 40 + 
            Math.sin(noiseX * 2.5 - noiseT * 0.5) * 20 +
            Math.cos(noiseX * 0.5 + noiseY) * 30;

          ctx.lineTo(x, yBase + yOffset);
        }
        ctx.stroke();
      }

      // Optional: Add some "vertical data streams" or subtle vertical lines to enhance the "tech" feel
      // keeping it minimal as per "dark gray contour line" focus
    
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
