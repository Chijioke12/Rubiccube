/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import * as THREE from 'three';

const COLORS = {
  white: 0xffffff,
  yellow: 0xffff00,
  red: 0xff0000,
  orange: 0xffa500,
  blue: 0x0000ff,
  green: 0x00ff00,
  black: 0x000000,
};

// Face order for Three.js BoxGeometry: [Right, Left, Top, Bottom, Front, Back]
const FACE_COLORS = [
  COLORS.red,    // Right
  COLORS.orange, // Left
  COLORS.white,  // Top
  COLORS.yellow, // Bottom
  COLORS.green,  // Front
  COLORS.blue,   // Back
];

export default function App() {
  const [isCW, setIsCW] = useState(true);
  const [webglStatus, setWebglStatus] = useState("Initializing...");
  const [frameCount, setFrameCount] = useState(0);

  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cubesRef = useRef<THREE.Mesh[]>([]);
  const pivotRef = useRef<THREE.Group | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rotationTarget = useRef({ x: 0, y: 0 });
  const currentRotation = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    const width = 240;
    const height = Math.min(320, window.innerHeight);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 0, 8);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ 
        antialias: false,
        precision: 'mediump',
        alpha: false,
        stencil: false,
        depth: true,
        preserveDrawingBuffer: true
      });
      if (!renderer.getContext()) {
        throw new Error("Could not create WebGL context");
      }
      setWebglStatus("WebGL OK");
    } catch (e) {
      console.error("WebGL failed", e);
      setWebglStatus("WebGL Failed: " + (e instanceof Error ? e.message : "Unknown"));
      return;
    }
    renderer.setClearColor(0x000000);
    renderer.setPixelRatio(1);
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    if (mountRef.current) {
      mountRef.current.style.backgroundColor = '#000';
      mountRef.current.appendChild(renderer.domElement);
    }

    // Create 3x3x3 cubes
    const cubes: THREE.Mesh[] = [];
    const geometry = new THREE.BoxGeometry(0.95, 0.95, 0.95);

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;

          const materials = FACE_COLORS.map(color => new THREE.MeshBasicMaterial({ color }));
          const cube = new THREE.Mesh(geometry, materials);
          cube.position.set(x, y, z);
          scene.add(cube);
          cubes.push(cube);
        }
      }
    }
    cubesRef.current = cubes;

    const pivot = new THREE.Group();
    scene.add(pivot);
    pivotRef.current = pivot;

    // Animation loop
    let animationId: number;
    let frames = 0;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      frames++;
      if (frames % 60 === 0) setFrameCount(f => f + 1);

      // Smooth camera rotation
      currentRotation.current.x += (rotationTarget.current.x - currentRotation.current.x) * 0.1;
      currentRotation.current.y += (rotationTarget.current.y - currentRotation.current.y) * 0.1;

      if (cameraRef.current) {
        const radius = 8;
        const x = radius * Math.sin(currentRotation.current.x) * Math.cos(currentRotation.current.y);
        const y = radius * Math.sin(currentRotation.current.y);
        const z = radius * Math.cos(currentRotation.current.x) * Math.cos(currentRotation.current.y);
        cameraRef.current.position.set(x, y, z);
        cameraRef.current.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  const rotateFace = (axis: 'x' | 'y' | 'z', layer: number, angle: number) => {
    if (isRotating || !pivotRef.current || !sceneRef.current) return;
    setIsRotating(true);

    const pivot = pivotRef.current;
    pivot.rotation.set(0, 0, 0);
    pivot.updateMatrixWorld();

    const cubesToRotate = cubesRef.current.filter(cube => {
      const pos = new THREE.Vector3();
      cube.getWorldPosition(pos);
      const val = axis === 'x' ? pos.x : axis === 'y' ? pos.y : pos.z;
      return Math.abs(val - layer) < 0.1;
    });

    cubesToRotate.forEach(cube => pivot.add(cube));

    const startTime = performance.now();
    const duration = 300;

    const animateRotation = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress * (2 - progress); // Ease out

      if (axis === 'x') pivot.rotation.x = angle * easeProgress;
      else if (axis === 'y') pivot.rotation.y = angle * easeProgress;
      else pivot.rotation.z = angle * easeProgress;

      if (progress < 1) {
        requestAnimationFrame(animateRotation);
      } else {
        pivot.updateMatrixWorld();
        cubesToRotate.forEach(cube => {
          cube.applyMatrix4(pivot.matrixWorld);
          sceneRef.current!.add(cube);
        });
        pivot.rotation.set(0, 0, 0);
        setIsRotating(false);
      }
    };

    requestAnimationFrame(animateRotation);
  };

  const handleAction = (action: string) => {
    switch (action) {
      case 'left': rotationTarget.current.x -= 0.5; break;
      case 'right': rotationTarget.current.x += 0.5; break;
      case 'up': rotationTarget.current.y = Math.min(rotationTarget.current.y + 0.5, Math.PI / 2 - 0.1); break;
      case 'down': rotationTarget.current.y = Math.max(rotationTarget.current.y - 0.5, -Math.PI / 2 + 0.1); break;
      
      // Face Rotations (Directional Mapping)
      case '2': rotateFace('y', 1, isCW ? -Math.PI / 2 : Math.PI / 2); break;  // Up
      case '8': rotateFace('y', -1, isCW ? Math.PI / 2 : -Math.PI / 2); break; // Down
      case '4': rotateFace('x', -1, isCW ? Math.PI / 2 : -Math.PI / 2); break; // Left
      case '6': rotateFace('x', 1, isCW ? -Math.PI / 2 : Math.PI / 2); break;  // Right
      case '5': rotateFace('z', 1, isCW ? Math.PI / 2 : -Math.PI / 2); break;  // Front
      case '0': rotateFace('z', -1, isCW ? -Math.PI / 2 : Math.PI / 2); break; // Back
      
      // Middle Layer Rotations
      case '1': rotateFace('x', 0, isCW ? Math.PI / 2 : -Math.PI / 2); break;  // Mid X
      case '3': rotateFace('y', 0, isCW ? -Math.PI / 2 : Math.PI / 2); break; // Mid Y
      case '7': rotateFace('z', 0, isCW ? Math.PI / 2 : -Math.PI / 2); break;  // Mid Z

      case '*': 
        rotationTarget.current = { x: 0.5, y: 0.5 };
        break;
      case '#': setIsCW(!isCW); break; // Toggle direction
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.startsWith('Arrow')) {
        handleAction(e.key.toLowerCase().replace('arrow', ''));
      } else if (e.key === '*') {
        handleAction('*');
      } else {
        handleAction(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRotating]);

  const ControlButton = ({ label, action, style = {} }: { label: string, action: string, style?: any }) => (
    <button
      onClick={() => handleAction(action)}
      style={{
        width: '36px',
        height: '36px',
        margin: '1px',
        backgroundColor: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.2)',
        color: 'white',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        userSelect: 'none',
        ...style
      }}
      onMouseDown={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)')}
      onMouseUp={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
    >
      {label}
    </button>
  );

  const isDev = import.meta.env.DEV;

  const content = (
    <div style={{ 
      width: '240px', 
      height: '320px', 
      position: 'relative',
      backgroundColor: '#000',
      borderBottom: isDev ? '2px solid #222' : 'none',
      overflow: 'hidden'
    }}>
      <div ref={mountRef} style={{ width: '240px', height: '320px', display: 'block', backgroundColor: '#000' }} />
      
      {/* Info Overlay (Minimal) */}
      <div style={{
        position: 'absolute',
        top: '5px',
        left: '5px',
        right: '5px',
        color: 'white',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '9px',
        display: 'flex',
        justifyContent: 'space-between',
        pointerEvents: 'none'
      }}>
        <span style={{ color: isCW ? '#4ade80' : '#f87171' }}>{isCW ? "CW" : "CCW"} (#)</span>
        <span>{webglStatus} | {frameCount}</span>
        <span>* Reset</span>
      </div>
    </div>
  );

  if (!isDev) {
    return (
      <div id="app-container" style={{ 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: '#000',
        color: '#fff',
        overflow: 'hidden',
        margin: 0,
        padding: 0
      }}>
        {content}
      </div>
    );
  }

  return (
    <div id="dev-container" style={{ 
      width: '100vw', 
      minHeight: '100vh', 
      overflowY: 'auto', 
      position: 'relative', 
      backgroundColor: '#000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      boxSizing: 'border-box',
      fontFamily: 'system-ui, sans-serif'
    }}>
      {/* KaiOS Device Wrapper - Only in DEV */}
      <div style={{ 
        width: '240px', 
        backgroundColor: '#111',
        borderRadius: '20px',
        border: '4px solid #333',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        flexShrink: 0
      }}>
        
        {/* Screen Area (240x320) */}
        {content}

        {/* Keypad Area */}
        <div style={{ 
          flex: 1, 
          backgroundColor: '#1a1a1a', 
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          
          {/* D-Pad */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '2px',
            width: '120px',
            margin: '0 auto'
          }}>
            <div />
            <ControlButton label="▲" action="up" style={{ borderRadius: '10px 10px 0 0' }} />
            <div />
            <ControlButton label="◀" action="left" style={{ borderRadius: '10px 0 0 10px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#333', color: '#666', fontSize: '8px' }}>OK</div>
            <ControlButton label="▶" action="right" style={{ borderRadius: '0 10px 10px 0' }} />
            <div />
            <ControlButton label="▼" action="down" style={{ borderRadius: '0 0 10px 10px' }} />
            <div />
          </div>

          {/* Numeric Keypad */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '4px'
          }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map(key => (
              <ControlButton 
                key={key} 
                label={key === '#' ? (isCW ? "CW" : "CCW") : key.toString()} 
                action={key.toString()} 
                style={{ 
                  height: '32px', 
                  fontSize: key === '#' ? '9px' : '14px',
                  backgroundColor: key === '#' ? (isCW ? 'rgba(0,255,0,0.1)' : 'rgba(255,0,0,0.1)') : 'rgba(255,255,255,0.05)'
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

