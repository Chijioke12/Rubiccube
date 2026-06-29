/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { RubiksEngine } from './rubiksEngine';

export default function App() {
  const [webglStatus, setWebglStatus] = useState("Initializing...");
  const [facingMessage, setFacingMessage] = useState("Front (Green)");
  const [isRotating, setIsRotating] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 120, y: 160 });
  const [grabState, setGrabState] = useState<{ active: boolean, hit: any, startX?: number, startY?: number } | null>(null);

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

      // Calculate facing face
      const cx = Math.sin(currentRotation.current.x) * Math.cos(currentRotation.current.y);
      const cy = Math.sin(currentRotation.current.y);
      const cz = Math.cos(currentRotation.current.x) * Math.cos(currentRotation.current.y);

      const absX = Math.abs(cx);
      const absY = Math.abs(cy);
      const absZ = Math.abs(cz);

      let facing = "";
      if (absX > absY && absX > absZ) {
        facing = cx > 0 ? "Right (Red)" : "Left (Orange)";
      } else if (absY > absX && absY > absZ) {
        facing = cy > 0 ? "Top (White)" : "Bottom (Yellow)";
      } else {
        facing = cz > 0 ? "Front (Green)" : "Back (Blue)";
      }
      setFacingMessage(prev => prev !== facing ? facing : prev);

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
      const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext;
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
    if (!engine || isRotating) return;

    if (action === 'softleft') {
      checkWebGL();
      return;
    }
    if (action === '*') {
      rotationTarget.current = { x: 0.5, y: 0.5 };
      return;
    }

    if (action === '2') rotationTarget.current.y = Math.min(Math.PI/2 - 0.1, rotationTarget.current.y + 0.5);
    if (action === '8') rotationTarget.current.y = Math.max(-Math.PI/2 + 0.1, rotationTarget.current.y - 0.5);
    if (action === '4') rotationTarget.current.x -= 0.5;
    if (action === '6') rotationTarget.current.x += 0.5;

    if (action === 'enter') {
      if (grabState?.active) {
        setGrabState(null);
      } else {
        const hit = engine.raycast(cursorPos.x, cursorPos.y);
        setGrabState({ active: true, hit, startX: cursorPos.x, startY: cursorPos.y });
      }
      return;
    }

    if (['left', 'right', 'up', 'down'].includes(action)) {
      if (grabState?.active) {
        if (!grabState.hit) {
          // Swipe background = rotate camera
          const dx = action === 'right' ? 1 : action === 'left' ? -1 : 0;
          const dy = action === 'down' ? 1 : action === 'up' ? -1 : 0;
          rotationTarget.current.x += dx * 0.5;
          rotationTarget.current.y = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, rotationTarget.current.y - dy * 0.5));
        } else {
          // Swipe cube face instantly for D-Pad
          const dx = action === 'right' ? 100 : action === 'left' ? -100 : 0;
          const dy = action === 'down' ? 100 : action === 'up' ? -100 : 0;
          
          const simulatedEndX = grabState.startX! + dx;
          const simulatedEndY = grabState.startY! + dy;

          const rot = engine.getDragRotation(grabState.hit, grabState.startX!, grabState.startY!, simulatedEndX, simulatedEndY);
          if (rot) {
            engine.rotateFace(rot.axis, rot.layer, rot.angle, () => setIsRotating(false));
            setIsRotating(true);
            setGrabState(null);
          }
        }
      } else {
        setCursorPos(prev => {
          let { x, y } = prev;
          if (action === 'left') x -= 20;
          if (action === 'right') x += 20;
          if (action === 'up') y -= 20;
          if (action === 'down') y += 20;
          return { x: Math.max(0, Math.min(240, x)), y: Math.max(0, Math.min(320, y)) };
        });
      }
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
      } else if (key === 'Enter') {
        e.preventDefault();
        handleAction('enter');
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
  }, [isRotating, grabState, cursorPos]);

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
      
      {/* Hand Cursor */}
      <div style={{
        position: 'absolute',
        top: cursorPos.y,
        left: cursorPos.x,
        transform: 'translate(-50%, -50%)',
        fontSize: '24px',
        pointerEvents: 'none',
        zIndex: 10,
        textShadow: '0 0 4px rgba(0,0,0,0.5)',
        transition: 'top 0.1s linear, left 0.1s linear'
      }}>
        {grabState?.active ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5">
            <circle cx="12" cy="12" r="6" fill="rgba(74, 222, 128, 0.4)" />
            <path d="M12 2 L12 6 M12 18 L12 22 M2 12 L6 12 M18 12 L22 12" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="2" fill="white" />
          </svg>
        )}
      </div>

      <div style={{
        position: 'absolute', top: '5px', left: '5px', right: '5px', color: 'white',
        backgroundColor: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px',
        fontSize: '9px', display: 'flex', justifyContent: 'space-between', pointerEvents: 'none'
      }}>
        <span style={{ color: grabState?.active ? '#4ade80' : '#f87171' }}>{grabState?.active ? "Grabbing" : "Free"} (Enter)</span>
        <span>{webglStatus}</span>
        <span>* Reset</span>
      </div>
      <div style={{
        position: 'absolute', bottom: '5px', left: '50%', transform: 'translateX(-50%)', color: 'white',
        backgroundColor: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px',
        fontSize: '9px', pointerEvents: 'none', whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', alignItems: 'center'
      }}>
        <span>Facing: {facingMessage}</span>
        <span style={{ color: '#9ca3af' }}>D-Pad: {grabState?.active ? "Swipe/Rotate" : "Move Hand"}</span>
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
            {['1', '2', '3', '4', 'enter', '6', '7', '8', '9', '*', '0', '#'].map(key => {
              let label = key === 'enter' ? 'Grab/Rel' : key;
              if (key === '2') label = 'Cam ↑';
              if (key === '8') label = 'Cam ↓';
              if (key === '4') label = 'Cam ←';
              if (key === '6') label = 'Cam →';
              return (
                <ControlButton 
                  key={key} 
                  label={label} 
                  action={key} 
                  style={{ height: '32px', fontSize: '10px', backgroundColor: 'rgba(255,255,255,0.05)' }}
                />
              );
            })}
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
