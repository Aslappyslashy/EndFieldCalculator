import React, { useEffect, useRef } from 'react';

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_wipe;

// Simplex 2D noise
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Fractal Brownian Motion
float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 0.0;
    
    // Fewer octaves for smoother, less "noisy" terrain
    for (int i = 0; i < 4; i++) {
        value += amplitude * snoise(st);
        st *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    
    // Wipe effect (left to right)
    if (uv.x > u_wipe) discard;

    // Aspect ratio correction
    vec2 pos = uv;
    pos.x *= u_resolution.x / u_resolution.y;

    // Scroll down slowly
    pos.y -= u_time * 0.02;

    // Scale coordinates: Smaller number = "Larger" features (Zoomed in)
    vec2 st = pos * 1.5; 

    // Calculate height map
    // Map -1..1 to 0..1
    float h = fbm(st) * 0.5 + 0.5;
    
    // Shaping: This is key for "Mountain Range" vs "Wiggly Water"
    // Squaring or Cubing the height creates large flat valleys (low gradient) 
    // and steep peaks (high gradient).
    // This creates natural variation in line density.
    float finalH = pow(h, 2.0); 

    // Contour lines
    // Reduce density to avoid the "messy" look
    float density = 25.0; 
    
    float val = finalH * density;
    
    // Anti-aliased line drawing
    float fw = fwidth(val);
    float dist = abs(fract(val - 0.5) - 0.5);
    
    // Thin, sharp lines
    float line = smoothstep(fw * 1.5, fw * 0.0, dist);

    // Color - Significantly darker gray as requested
    vec3 baseColor = vec3(0.12, 0.12, 0.12); 
    
    // "Layer up" / "Become more and more dark":
    // 1. Distance Fog/Vignette: Edges and bottom become darker
    vec2 center = vec2(0.5, 0.5);
    float distFromCenter = length(uv - center);
    float vignette = smoothstep(1.2, 0.2, distFromCenter);
    
    // 2. Vertical Gradient: Fade out at the bottom to "become dark"
    float verticalFade = smoothstep(0.0, 0.3, uv.y); // Darken bottom 30%

    // Combine
    vec3 finalColor = baseColor * line * vignette * verticalFade;
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

export const AdvancedBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTimeRef = useRef<number>(performance.now());
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    // Enable extension for fwidth
    gl.getExtension('OES_standard_derivatives');

    // Compile Shaders
    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = createShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    // Buffer Setup (Quad covering screen)
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0,
      ]),
      gl.STATIC_DRAW
    );

    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const wipeLocation = gl.getUniformLocation(program, "u_wipe");

    // Intro Config
    const INTRO_DURATION = 800; // 0.8s wipe (cut in half)
    const START_DELAY = 100;

    let animationId: number;

    const render = (time: number) => {
      const elapsed = time - startTimeRef.current;
      
      // Handle Resize
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, elapsed * 0.001);

      // Intro Wipe Logic
      let wipeProgress = 0;
      if (elapsed > START_DELAY) {
         wipeProgress = Math.min((elapsed - START_DELAY) / INTRO_DURATION, 1.0);
         // Cubic Ease Out
         wipeProgress = 1 - Math.pow(1 - wipeProgress, 3);
      }
      gl.uniform1f(wipeLocation, wipeProgress);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(buffer);
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
