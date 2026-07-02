// @ts-nocheck
declare const THREE: any;
import Cube from 'cubejs';
Cube.initSolver();

export const COLORS = {
  white: 0xffffff,
  yellow: 0xffff00,
  red: 0xff0000,
  orange: 0xffa500,
  blue: 0x0000ff,
  green: 0x00ff00,
  black: 0x000000,
};

export class RubiksEngine {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer | null = null;
  cubes: THREE.Mesh[] = [];
  pivot: THREE.Group;
  width = 240;
  height = 320;
  fallbackMode = false;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
    this.camera.position.set(0, 0, 8);

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    // Initial setup
    this.createCubes();
    this.setupLighting();

    // Asynchronously load the GLB model and swap the procedural meshes
    this.loadGLBModel();
  }

  private createCubes() {
    const geometry = new THREE.BoxGeometry(0.95, 0.95, 0.95);

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;

          const materials = [
            new THREE.MeshPhongMaterial({ color: x === 1 ? COLORS.red : COLORS.black, shininess: 30 }),
            new THREE.MeshPhongMaterial({ color: x === -1 ? COLORS.orange : COLORS.black, shininess: 30 }),
            new THREE.MeshPhongMaterial({ color: y === 1 ? COLORS.white : COLORS.black, shininess: 30 }),
            new THREE.MeshPhongMaterial({ color: y === -1 ? COLORS.yellow : COLORS.black, shininess: 30 }),
            new THREE.MeshPhongMaterial({ color: z === 1 ? COLORS.green : COLORS.black, shininess: 30 }),
            new THREE.MeshPhongMaterial({ color: z === -1 ? COLORS.blue : COLORS.black, shininess: 30 }),
          ];
          
          const cube = new THREE.Mesh(geometry, materials);
          cube.position.set(x, y, z);
          (cube as any).userData = {
            stickers: [x === 1, x === -1, y === 1, y === -1, z === 1, z === -1],
            originalPos: new THREE.Vector3(x, y, z)
          };
          this.scene.add(cube);
          this.cubes.push(cube);
        }
      }
    }
  }

  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(5, 10, 10);
    this.scene.add(dirLight);
  }

  initRenderer(container: HTMLDivElement) {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(this.width, this.height);
      container.appendChild(this.renderer.domElement);
      return true;
    } catch (e) {
      this.fallbackMode = true;
      return false;
    }
  }

  updateCamera(rotation: { x: number, y: number }) {
    if (!this.camera) return;
    const radius = 8;
    const x = radius * Math.sin(rotation.x) * Math.cos(rotation.y);
    const y = radius * Math.sin(rotation.y);
    const z = radius * Math.cos(rotation.x) * Math.cos(rotation.y);
    this.camera.position.set(x, y, z);
    
    if (Math.cos(rotation.y) < 0) {
      this.camera.up.set(0, -1, 0);
    } else {
      this.camera.up.set(0, 1, 0);
    }
    
    this.camera.lookAt(0, 0, 0);
  }

  draw2D(ctx: CanvasRenderingContext2D, rotation: { x: number, y: number }) {
    const width = this.width;
    const height = this.height;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);

    const rotatePoint = (v: THREE.Vector3) => {
      // Horizontal rotation (around Y)
      let x = v.x * Math.cos(rotation.x) - v.z * Math.sin(rotation.x);
      let z = v.x * Math.sin(rotation.x) + v.z * Math.cos(rotation.x);
      let y = v.y;
      
      // Vertical rotation (around X)
      let ty = y * Math.cos(rotation.y) - z * Math.sin(rotation.y);
      let tz = y * Math.sin(rotation.y) + z * Math.cos(rotation.y);
      
      return new THREE.Vector3(x, ty, tz);
    };

    const project = (v: THREE.Vector3) => {
      const cameraZ = 10;
      const distance = cameraZ - v.z;
      const factor = 200 / distance;
      return { 
        x: v.x * factor + width / 2, 
        y: -v.y * factor + height / 2,
        z: v.z
      };
    };

    const lightDirection = new THREE.Vector3(1, 2, 3).normalize();
    const facesToDraw: any[] = [];
    const stickerS = 0.44;
    const bodyS = 0.48;

    this.cubes.forEach(mesh => {
      mesh.updateMatrixWorld();
      const worldQuat = new THREE.Quaternion();
      const worldPosVec = new THREE.Vector3();
      mesh.getWorldQuaternion(worldQuat);
      mesh.getWorldPosition(worldPosVec);

      const baseFaces = [
        { n: new THREE.Vector3(1, 0, 0), colorIdx: 0 },
        { n: new THREE.Vector3(-1, 0, 0), colorIdx: 1 },
        { n: new THREE.Vector3(0, 1, 0), colorIdx: 2 },
        { n: new THREE.Vector3(0, -1, 0), colorIdx: 3 },
        { n: new THREE.Vector3(0, 0, 1), colorIdx: 4 },
        { n: new THREE.Vector3(0, 0, -1), colorIdx: 5 }
      ];

      baseFaces.forEach(face => {
        const worldNormal = face.n.clone().applyQuaternion(worldQuat);
        const facePos = worldPosVec.clone().add(worldNormal.clone().multiplyScalar(0.48));
        
        const viewNormal = rotatePoint(worldNormal);
        const viewPos = rotatePoint(facePos);

        if (viewNormal.z > 0) {
          const hasSticker = (mesh.userData as any).stickers[face.colorIdx];
          const dot = Math.max(0, viewNormal.dot(lightDirection));
          const brightness = 0.4 + dot * 0.6;

          const getVertices = (s: number) => {
            let v1, v2, v3, v4;
            if (face.n.x !== 0) {
              v1 = new THREE.Vector3(0, -s, -s); v2 = new THREE.Vector3(0, s, -s);
              v3 = new THREE.Vector3(0, s, s); v4 = new THREE.Vector3(0, -s, s);
            } else if (face.n.y !== 0) {
              v1 = new THREE.Vector3(-s, 0, -s); v2 = new THREE.Vector3(s, 0, -s);
              v3 = new THREE.Vector3(s, 0, s); v4 = new THREE.Vector3(-s, 0, s);
            } else {
              v1 = new THREE.Vector3(-s, -s, 0); v2 = new THREE.Vector3(s, -s, 0);
              v3 = new THREE.Vector3(s, s, 0); v4 = new THREE.Vector3(-s, s, 0);
            }
            return [v1, v2, v3, v4].map(p => {
              const worldV = p.clone().applyQuaternion(worldQuat).add(worldPosVec);
              return project(rotatePoint(worldV));
            });
          };

          facesToDraw.push({
            z: viewPos.z - 0.001,
            color: '#000000',
            points: getVertices(bodyS)
          });

          if (hasSticker) {
            let baseColor = null;
            if (mesh.material) {
              if (Array.isArray(mesh.material)) {
                baseColor = mesh.material[face.colorIdx].color;
              } else {
                baseColor = mesh.material.color;
              }
            } else {
              // It's a GLB group clone, find the sticker sub-mesh
              const STICKER_NAMES = ['Sticker_R', 'Sticker_L', 'Sticker_U', 'Sticker_D', 'Sticker_F', 'Sticker_B'];
              const stickerName = STICKER_NAMES[face.colorIdx];
              const stickerSubMesh = mesh.getObjectByName(stickerName);
              if (stickerSubMesh && stickerSubMesh.material) {
                baseColor = stickerSubMesh.material.color;
              }
            }

            if (baseColor) {
              const r = Math.floor(baseColor.r * 255 * brightness);
              const g = Math.floor(baseColor.g * 255 * brightness);
              const b = Math.floor(baseColor.b * 255 * brightness);
              
              facesToDraw.push({
                z: viewPos.z,
                color: `rgb(${r},${g},${b})`,
                points: getVertices(stickerS)
              });
            }
          }
        }
      });
    });

    facesToDraw.sort((a, b) => a.z - b.z);

    facesToDraw.forEach(f => {
      ctx.beginPath();
      ctx.moveTo(f.points[0].x, f.points[0].y);
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(f.points[i].x, f.points[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = f.color;
      ctx.fill();
    });
  }

  rotateFace(axis: 'x' | 'y' | 'z', layer: number, angle: number, onComplete: () => void) {
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.updateMatrixWorld();

    const cubesToRotate = this.cubes.filter(cube => {
      const pos = new THREE.Vector3();
      cube.getWorldPosition(pos);
      const val = axis === 'x' ? pos.x : axis === 'y' ? pos.y : pos.z;
      return Math.abs(val - layer) < 0.1;
    });

    cubesToRotate.forEach(cube => this.pivot.add(cube));

    const startTime = performance.now();
    const duration = 300;

    const animateRotation = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress * (2 - progress);

      if (axis === 'x') this.pivot.rotation.x = angle * easeProgress;
      else if (axis === 'y') this.pivot.rotation.y = angle * easeProgress;
      else this.pivot.rotation.z = angle * easeProgress;

      if (progress < 1) {
        requestAnimationFrame(animateRotation);
      } else {
        this.pivot.updateMatrixWorld();
        cubesToRotate.forEach(cube => {
          cube.applyMatrix4(this.pivot.matrixWorld);
          this.scene.add(cube);
        });
        this.pivot.rotation.set(0, 0, 0);
        onComplete();
      }
    };

    requestAnimationFrame(animateRotation);
  }

  raycast(x: number, y: number) {
    if (this.fallbackMode || !this.renderer) return null;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    mouse.x = (x / this.width) * 2 - 1;
    mouse.y = -(y / this.height) * 2 + 1;
    raycaster.setFromCamera(mouse, this.camera);
    
    const intersects = raycaster.intersectObjects(this.cubes, true);
    if (intersects.length > 0) {
      const intersect = intersects[0];
      const subMesh = intersect.object;
      
      // Find which cubie Group/Mesh in this.cubes contains this subMesh
      let cube = subMesh;
      while (cube && !this.cubes.includes(cube as any)) {
        cube = cube.parent;
      }
      if (!cube) cube = subMesh;
      
      const pos = new THREE.Vector3();
      cube.getWorldPosition(pos);
      return {
         cubePos: pos.round(),
         normal: intersect.face.normal.clone().transformDirection(subMesh.matrixWorld).round(),
         point: intersect.point.clone()
      };
    }
    return null;
  }

  getDragRotation(hit: any, startX: number, startY: number, endX: number, endY: number) {
    if (this.fallbackMode || !this.camera) return null;
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(hit.normal, hit.point);
    
    const getIntersect = (x: number, y: number) => {
      const mouse = new THREE.Vector2();
      mouse.x = (x / this.width) * 2 - 1;
      mouse.y = -(y / this.height) * 2 + 1;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, this.camera);
      const target = new THREE.Vector3();
      const result = raycaster.ray.intersectPlane(plane, target);
      return result ? target : null;
    };

    const startPoint = getIntersect(startX, startY);
    const endPoint = getIntersect(endX, endY);
    
    if (!startPoint || !endPoint) return null;

    const delta = endPoint.clone().sub(startPoint);
    if (delta.length() < 0.3) return null; // Increased threshold slightly for cursor
    
    const rotVector = new THREE.Vector3().crossVectors(hit.normal, delta);
    
    const ax = Math.abs(rotVector.x);
    const ay = Math.abs(rotVector.y);
    const az = Math.abs(rotVector.z);
    
    let rotAxis: 'x' | 'y' | 'z' = 'x';
    let sign = Math.sign(rotVector.x);
    let layer = hit.cubePos.x;
    
    if (ay > ax && ay > az) {
        rotAxis = 'y';
        sign = Math.sign(rotVector.y);
        layer = hit.cubePos.y;
    } else if (az > ax && az > ay) {
        rotAxis = 'z';
        sign = Math.sign(rotVector.z);
        layer = hit.cubePos.z;
    }

    return { axis: rotAxis, layer: Math.round(layer), angle: sign * Math.PI / 2 };
  }

  getCubeState(): string {
    const colorToFace: Record<number, string> = {
      [COLORS.white]: 'U',
      [COLORS.red]: 'R',
      [COLORS.green]: 'F',
      [COLORS.yellow]: 'D',
      [COLORS.orange]: 'L',
      [COLORS.blue]: 'B'
    };
    
    const raycaster = new THREE.Raycaster();
    const getFacelet = (start: any, dir: any) => {
      raycaster.set(start, dir);
      const intersects = raycaster.intersectObjects(this.cubes, true);
      if (intersects.length > 0) {
        const mesh = intersects[0].object;
        let color: number;
        if (Array.isArray(mesh.material)) {
          const matIndex = intersects[0].face.materialIndex;
          color = mesh.material[matIndex].color.getHex();
        } else {
          color = mesh.material.color.getHex();
        }
        return colorToFace[color] || '?';
      }
      return '?';
    };

    let state = '';

    // U face: z from -1 to 1, x from -1 to 1
    for (let z = -1; z <= 1; z++) {
      for (let x = -1; x <= 1; x++) {
        state += getFacelet(new THREE.Vector3(x, 2, z), new THREE.Vector3(0, -1, 0));
      }
    }
    // R face: y from 1 to -1, z from 1 to -1
    for (let y = 1; y >= -1; y--) {
      for (let z = 1; z >= -1; z--) {
        state += getFacelet(new THREE.Vector3(2, y, z), new THREE.Vector3(-1, 0, 0));
      }
    }
    // F face: y from 1 to -1, x from -1 to 1
    for (let y = 1; y >= -1; y--) {
      for (let x = -1; x <= 1; x++) {
        state += getFacelet(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1));
      }
    }
    // D face: z from 1 to -1, x from -1 to 1
    for (let z = 1; z >= -1; z--) {
      for (let x = -1; x <= 1; x++) {
        state += getFacelet(new THREE.Vector3(x, -2, z), new THREE.Vector3(0, 1, 0));
      }
    }
    // L face: y from 1 to -1, z from -1 to 1
    for (let y = 1; y >= -1; y--) {
      for (let z = -1; z <= 1; z++) {
        state += getFacelet(new THREE.Vector3(-2, y, z), new THREE.Vector3(1, 0, 0));
      }
    }
    // B face: y from 1 to -1, x from 1 to -1
    for (let y = 1; y >= -1; y--) {
      for (let x = 1; x >= -1; x--) {
        state += getFacelet(new THREE.Vector3(x, y, -2), new THREE.Vector3(0, 0, 1));
      }
    }

    return state;
  }

  isSolving = false;

  async autoSolve() {
    if (this.isSolving) return;
    this.isSolving = true;

    try {
      const stateStr = this.getCubeState();
      const cube = Cube.fromString(stateStr);
      const movesStr = cube.solve();
      
      if (!movesStr) {
        this.isSolving = false;
        return;
      }

      const moves = movesStr.split(' ').filter((m: string) => m.length > 0);
      
      for (const move of moves) {
        const face = move[0];
        const mod = move[1];

        let axis: 'x'|'y'|'z' = 'x';
        let layer = 1;
        let angle = Math.PI / 2;

        if (face === 'R') { axis = 'x'; layer = 1; angle = -Math.PI / 2; }
        if (face === 'L') { axis = 'x'; layer = -1; angle = Math.PI / 2; }
        if (face === 'U') { axis = 'y'; layer = 1; angle = -Math.PI / 2; }
        if (face === 'D') { axis = 'y'; layer = -1; angle = Math.PI / 2; }
        if (face === 'F') { axis = 'z'; layer = 1; angle = -Math.PI / 2; }
        if (face === 'B') { axis = 'z'; layer = -1; angle = Math.PI / 2; }

        if (mod === "'") angle = -angle;
        if (mod === "2") angle = angle * 2;

        await new Promise<void>(resolve => {
          this.rotateFace(axis, layer, angle, resolve);
        });
      }
    } catch (e) {
      console.error("Failed to solve:", e);
    }
    this.isSolving = false;
  }

  private loadGLBModel() {
    if (typeof (THREE as any).GLTFLoader === 'undefined') {
      console.warn('GLTFLoader not available globally yet.');
      return;
    }
    const loader = new (THREE as any).GLTFLoader();
    loader.load('/cubie.glb', (gltf: any) => {
      console.log('Successfully loaded cubie.glb model');
      const template = gltf.scene.getObjectByName('Cubie') || gltf.scene;
      
      this.cubes.forEach((oldCube, index) => {
        const clone = template.clone();
        
        // Position and rotation should match the old cube exactly!
        clone.position.copy(oldCube.position);
        clone.quaternion.copy(oldCube.quaternion);
        
        // Copy the original position from userData or position
        const originalPos = (oldCube as any).userData.originalPos || oldCube.position.clone();
        const x = Math.round(originalPos.x);
        const y = Math.round(originalPos.y);
        const z = Math.round(originalPos.z);
        
        // Match the stickers to original cube colors
        const stickersMap: Record<string, number> = {
          'Sticker_R': x === 1 ? COLORS.red : COLORS.black,
          'Sticker_L': x === -1 ? COLORS.orange : COLORS.black,
          'Sticker_U': y === 1 ? COLORS.white : COLORS.black,
          'Sticker_D': y === -1 ? COLORS.yellow : COLORS.black,
          'Sticker_F': z === 1 ? COLORS.green : COLORS.black,
          'Sticker_B': z === -1 ? COLORS.blue : COLORS.black,
        };
        
        clone.traverse((child: any) => {
          if (child.isMesh) {
            if (child.name.startsWith('Sticker_')) {
              const color = stickersMap[child.name];
              if (color !== undefined) {
                child.material = child.material.clone();
                child.material.color.setHex(color);
                
                // Hide inactive stickers, style active stickers beautifully
                if (color === COLORS.black) {
                  child.visible = false;
                } else {
                  child.material.roughness = 0.1;
                  child.material.metalness = 0.1;
                }
              }
            } else if (child.name === 'Body') {
              child.material = child.material.clone();
              child.material.color.setHex(0x1a1a1a); // Sleek dark gray
              child.material.roughness = 0.3;
              child.material.metalness = 0.2;
            }
          }
        });
        
        clone.userData = { 
          ...oldCube.userData,
          originalPos: originalPos
        };
        
        // Replace in the scene graph
        if (oldCube.parent) {
          oldCube.parent.add(clone);
          oldCube.parent.remove(oldCube);
        } else {
          this.scene.add(clone);
          this.scene.remove(oldCube);
        }
        
        // Replace in this.cubes array
        this.cubes[index] = clone;
      });
      
      console.log('Successfully swapped procedural cubes with generated GLB model!');
    }, undefined, (error: any) => {
      console.error('Failed to load cubie.glb:', error);
    });
  }

  render() {
    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    if (this.renderer && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
