declare const THREE: any;

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
            stickers: [x === 1, x === -1, y === 1, y === -1, z === 1, z === -1]
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
    const radius = 8;
    const x = radius * Math.sin(rotation.x) * Math.cos(rotation.y);
    const y = radius * Math.sin(rotation.y);
    const z = radius * Math.cos(rotation.x) * Math.cos(rotation.y);
    this.camera.position.set(x, y, z);
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
            const materials = mesh.material as any[];
            const baseColor = materials[face.colorIdx].color;
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
