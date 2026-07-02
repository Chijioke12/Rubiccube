// Polyfill FileReader with EventTarget and onloadend support for Node.js
class NodeFileReader {
  static EMPTY = 0;
  static LOADING = 1;
  static DONE = 2;

  EMPTY = 0;
  LOADING = 1;
  DONE = 2;

  readyState = 0;
  onload: any = null;
  onloadend: any = null;
  result: any = null;
  listeners: Record<string, any[]> = {};

  addEventListener(type: string, callback: any) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(callback);
  }

  removeEventListener(type: string, callback: any) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
  }

  dispatchEvent(type: string) {
    const event = { target: this, type };
    console.log(`Polyfill FileReader: dispatching "${type}" event`);
    
    if (type === 'load') {
      if (this.onload) {
        try {
          this.onload(event);
        } catch (err) {
          console.error('Error in onload handler:', err);
        }
      }
      if (this.onloadend) {
        try {
          this.onloadend(event);
        } catch (err) {
          console.error('Error in onloadend handler:', err);
        }
      }
    }
    
    if (this.listeners[type]) {
      this.listeners[type].forEach(cb => {
        try {
          cb(event);
        } catch (err) {
          console.error(`Error in "${type}" event listener:`, err);
        }
      });
    }
  }

  async readAsArrayBuffer(blob: Blob) {
    console.log('Polyfill FileReader: readAsArrayBuffer called');
    this.readyState = this.LOADING;
    try {
      const arrayBuffer = await blob.arrayBuffer();
      this.result = arrayBuffer;
      this.readyState = this.DONE;
      console.log('Polyfill FileReader: readAsArrayBuffer data loaded, dispatching load');
      this.dispatchEvent('load');
    } catch (err) {
      console.error('Error in polyfilled FileReader.readAsArrayBuffer:', err);
    }
  }

  async readAsDataURL(blob: Blob) {
    console.log('Polyfill FileReader: readAsDataURL called');
    this.readyState = this.LOADING;
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      this.result = `data:${blob.type};base64,${buffer.toString('base64')}`;
      this.readyState = this.DONE;
      console.log('Polyfill FileReader: readAsDataURL data loaded, dispatching load');
      this.dispatchEvent('load');
    } catch (err) {
      console.error('Error in polyfilled FileReader.readAsDataURL:', err);
    }
  }
}

// Bind the polyfills to the global scope
(globalThis as any).FileReader = NodeFileReader;

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as fs from 'fs';
import * as path from 'path';

async function generateCubie() {
  console.log('Generating Rubik\'s Cubie GLB (binary)...');

  const group = new THREE.Group();
  group.name = 'Cubie';

  // 1. Create the main plastic body
  const bodyGeom = new THREE.BoxGeometry(0.96, 0.96, 0.96);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.2,
    metalness: 0.1,
    name: 'BodyMaterial'
  });
  const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
  bodyMesh.name = 'Body';
  group.add(bodyMesh);

  // 2. Create physical 3D sticker meshes on each of the 6 faces
  const stickerSize = 0.78;
  const stickerThickness = 0.02;
  const offset = 0.48 + stickerThickness / 2;

  const stickerMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    roughness: 0.1,
    metalness: 0.05,
    name: 'StickerMaterial'
  });

  const sides = [
    { name: 'Sticker_R', pos: [offset, 0, 0], size: [stickerThickness, stickerSize, stickerSize] },
    { name: 'Sticker_L', pos: [-offset, 0, 0], size: [stickerThickness, stickerSize, stickerSize] },
    { name: 'Sticker_U', pos: [0, offset, 0], size: [stickerSize, stickerThickness, stickerSize] },
    { name: 'Sticker_D', pos: [0, -offset, 0], size: [stickerSize, stickerThickness, stickerSize] },
    { name: 'Sticker_F', pos: [0, 0, offset], size: [stickerSize, stickerSize, stickerThickness] },
    { name: 'Sticker_B', pos: [0, 0, -offset], size: [stickerSize, stickerSize, stickerThickness] }
  ];

  sides.forEach(s => {
    const geom = new THREE.BoxGeometry(s.size[0], s.size[1], s.size[2]);
    const mesh = new THREE.Mesh(geom, stickerMat.clone());
    mesh.position.set(s.pos[0], s.pos[1], s.pos[2]);
    mesh.name = s.name;
    group.add(mesh);
  });

  console.log('Constructing GLTFExporter...');
  const exporter = new GLTFExporter();

  console.log('Starting exporter.parse with binary: true...');
  return new Promise<void>((resolve, reject) => {
    exporter.parse(
      group,
      (gltf) => {
        console.log('exporter.parse success callback triggered!');
        try {
          const buffer = Buffer.from(gltf as ArrayBuffer);
          const outDir = path.resolve('public');
          if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
          }
          const outFile = path.join(outDir, 'cubie.glb');
          fs.writeFileSync(outFile, buffer);
          console.log(`Successfully generated and saved GLB: ${outFile}`);
          resolve();
        } catch (err) {
          console.error('Error writing file in success callback:', err);
          reject(err);
        }
      },
      (error) => {
        console.error('exporter.parse error callback triggered:', error);
        reject(error);
      },
      { binary: true }
    );
  });
}

// Set up interval to keep event loop alive
const keepAlive = setInterval(() => {
  // Heartbeat
}, 50);

generateCubie().then(() => {
  console.log('generateCubie completed successfully');
  clearInterval(keepAlive);
}).catch((err) => {
  console.error('Error generating GLB:', err);
  clearInterval(keepAlive);
  process.exit(1);
});
