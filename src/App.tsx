/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { RubiksEngine } from './rubiksEngine';

export default function App() {
  const [isCW, setIsCW] = useState(true);
  const [webglStatus, setWebglStatus] = useState("Initializing...");
  const [frameCount, setFrameCount] = useState(0);
  const [isRotating, setIsRotating] = useState(false);

  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RubiksEngine | null>(null);
  const rotationTarget = useRef({ x: 0.5, y: 0.5 });
  const currentRotation = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    if (!mountRef.current) return;

    const engine = new RubiksEngine();
    engineRef.current = engine;

    const hasWebGL = engine.initRenderer(mountRef.current);
    setWebglStatus(hasWebGL ? "WebGL OK" : "2D Mode");

    let fallbackCtx: CanvasRenderingContext2D | null = null;
    if (!hasWebGL) {
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.width = engine.width;
      fallbackCanvas.height = engine.height;
      fallbackCanvas.style.display = 'block';
      mountRef.current.appendChild(fallbackCanvas);
      fallbackCtx = fallbackCanvas.getContext('2d');
    }

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      setFrameCount(prev => prev + 1);

      // Smooth rotation
      currentRotation.current.x += (rotationTarget.current.x - currentRotation.current.x) * 0.1;
      currentRotation.current.y += (rotationTarget.current.y - currentRotation.current.y) * 0.1;

      if (hasWebGL) {
        engine.updateCamera(currentRotation.current);
        engine.render();
      } else if (fallbackCtx) {
        engine.draw2D(fallbackCtx, currentRotation.current);
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      engine.dispose();
    };
  }, []);

  const checkWebGL = () => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        alert("WebGL is NOT supported on this device.");
        return;
      }
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : "Unknown Vendor";
      const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "Unknown Renderer";
      const version = gl.getParameter(gl.VERSION);
      const shadingLanguageVersion = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
      
      alert(
        `WebGL Support Details:\n` +
        `- Supported: Yes\n` +
        `- Vendor: ${vendor}\n` +
        `- Renderer: ${renderer}\n` +
        `- Version: ${version}\n` +
        `- GLSL Version: ${shadingLanguageVersion}`
      );
    } catch (e) {
      alert("Error checking WebGL: " + (e as Error).message);
    }
  };

  const handleAction = (action: string) => {
    const engine = engineRef.current;
    if (!engine) return;

    switch (action) {
      case 'softleft':
        checkWebGL();
        break;
      case 'left': rotationTarget.current.x -= 0.5; break;
      case 'right': rotationTarget.current.x += 0.5; break;
      case 'up': rotationTarget.current.y = Math.min(rotationTarget.current.y + 0.5, Math.PI / 2 - 0.1); break;
      case 'down': rotationTarget.current.y = Math.max(rotationTarget.current.y - 0.5, -Math.PI / 2 + 0.1); break;
      
      case '2': engine.rotateFace('y', 1, isCW ? -Math.PI / 2 : Math.PI / 2, () => setIsRotating(false)); setIsRotating(true); break;
      case '8': engine.rotateFace('y', -1, isCW ? Math.PI / 2 : -Math.PI / 2, () => setIsRotating(false)); setIsRotating(true); break;
      case '4': engine.rotateFace('x', -1, isCW ? Math.PI / 2 : -Math.PI / 2, () => setIsRotating(false)); setIsRotating(true); break;
      case '6': engine.rotateFace('x', 1, isCW ? -Math.PI / 2 : Math.PI / 2, () => setIsRotating(false)); setIsRotating(true); break;
      case '5': engine.rotateFace('z', 1, isCW ? Math.PI / 2 : -Math.PI / 2, () => setIsRotating(false)); setIsRotating(true); break;
      case '0': engine.rotateFace('z', -1, isCW ? -Math.PI / 2 : Math.PI / 2, () => setIsRotating(false)); setIsRotating(true); break;
      
      case '1': engine.rotateFace('x', 0, isCW ? Math.PI / 2 : -Math.PI / 2, () => setIsRotating(false)); setIsRotating(true); break;
      case '3': engine.rotateFace('y', 0, isCW ? -Math.PI / 2 : Math.PI / 2, () => setIsRotating(false)); setIsRotating(true); break;
      case '7': engine.rotateFace('z', 0, isCW ? Math.PI / 2 : -Math.PI / 2, () => setIsRotating(false)); setIsRotating(true); break;

      case '*': rotationTarget.current = { x: 0.5, y: 0.5 }; break;
      case '#': setIsCW(!isCW); break;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key === 'SoftLeft' || key === 'F1') {
        e.preventDefault();
        handleAction('softleft');
      } else if (key === 'SoftRight' || key === 'F2') {
        e.preventDefault();
        handleAction('softright');
      } else if (key.startsWith('Arrow')) {
        handleAction(key.toLowerCase().replace('arrow', ''));
      } else if (key === '*') {
        handleAction('*');
      } else if (key === '#') {
        handleAction('#');
      } else {
        handleAction(key);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRotating, isCW]);

  const ControlButton = ({ label, action, style = {} }: { label: string, action: string, style?: any }) => (
    <button
      onClick={() => handleAction(action)}
      style={{
        width: '36px', height: '36px', margin: '1px',
        backgroundColor: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.2)',
        color: 'white', borderRadius: '4px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '12px', userSelect: 'none', ...style
      }}
    >
      {label}
    </button>
  );

  const isDev = import.meta.env.DEV;

  const content = (
    <div style={{ width: '240px', height: '320px', position: 'relative', backgroundColor: '#000', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ width: '240px', height: '320px', display: 'block', backgroundColor: '#000' }} />
      <div style={{
        position: 'absolute', top: '5px', left: '5px', right: '5px', color: 'white',
        backgroundColor: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px',
        fontSize: '9px', display: 'flex', justifyContent: 'space-between', pointerEvents: 'none'
      }}>
        <span style={{ color: isCW ? '#4ade80' : '#f87171' }}>{isCW ? "CW" : "CCW"} (#)</span>
        <span>{webglStatus} | {frameCount}</span>
        <span>* Reset</span>
      </div>
    </div>
  );

  if (!isDev) {
    return (
      <div id="app-container" style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', color: '#fff', overflow: 'hidden', margin: 0, padding: 0 }}>
        {content}
      </div>
    );
  }

  return (
    <div id="dev-container" style={{ width: '100vw', minHeight: '100vh', overflowY: 'auto', position: 'relative', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '240px', backgroundColor: '#111', borderRadius: '20px', border: '4px solid #333', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', flexShrink: 0 }}>
        {content}
        <div style={{ flex: 1, backgroundColor: '#1a1a1a', padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', width: '120px', margin: '0 auto' }}>
            <div /> <ControlButton label="▲" action="up" style={{ borderRadius: '10px 10px 0 0' }} /> <div />
            <ControlButton label="◀" action="left" style={{ borderRadius: '10px 0 0 10px' }} /> <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#333', color: '#666', fontSize: '8px' }}>OK</div> <ControlButton label="▶" action="right" style={{ borderRadius: '0 10px 10px 0' }} />
            <div /> <ControlButton label="▼" action="down" style={{ borderRadius: '0 0 10px 10px' }} /> <div />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map(key => (
              <ControlButton 
                key={key} 
                label={key === '#' ? (isCW ? "CW" : "CCW") : key.toString()} 
                action={key.toString()} 
                style={{ height: '32px', fontSize: key === '#' ? '9px' : '14px', backgroundColor: key === '#' ? (isCW ? 'rgba(0,255,0,0.1)' : 'rgba(255,0,0,0.1)') : 'rgba(255,255,255,0.05)' }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', backgroundColor: '#333', borderRadius: '5px', fontSize: '10px', color: '#aaa' }}>
            <span>WebGL Info</span>
            <span>Reset</span>
          </div>
        </div>
      </div>
    </div>
  );
}
