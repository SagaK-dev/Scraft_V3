import * as THREE from 'three';

export class Renderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(75, 1, 0.05, 1000);
  readonly gl: THREE.WebGLRenderer;
  private readonly resizeObserver: ResizeObserver;
  private readonly disposableGeometries: THREE.BufferGeometry[] = [];
  private readonly disposableMaterials: THREE.Material[] = [];

  constructor(canvas: HTMLCanvasElement, onContextLost: () => void) {
    const probe = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' });
    if (!probe) throw new Error('WebGL2に対応したブラウザ/GPUが必要です。');

    this.gl = new THREE.WebGLRenderer({ canvas, context: probe, antialias: true, powerPreference: 'high-performance' });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.gl.setClearColor(0x86b9e8, 1);

    this.scene.fog = new THREE.Fog(0x86b9e8, 35, 150);
    this.scene.add(new THREE.HemisphereLight(0xddeeff, 0x4a4a42, 1.8));
    const sun = new THREE.DirectionalLight(0xfff1d0, 2.2);
    sun.position.set(20, 35, 12);
    this.scene.add(sun);

    this.createPhaseOneGround();
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      onContextLost();
    }, { once: true });

    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  draw(): void {
    this.gl.render(this.scene, this.camera);
  }

  setFov(fov: number): void {
    if (Math.abs(this.camera.fov - fov) < 0.01) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    for (const geometry of this.disposableGeometries) geometry.dispose();
    for (const material of this.disposableMaterials) material.dispose();
    this.gl.dispose();
  }

  private readonly resize = (): void => {
    const canvas = this.gl.domElement;
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.gl.setSize(width, height, false);
  };

  private createPhaseOneGround(): void {
    const geometry = new THREE.PlaneGeometry(96, 96);
    const material = new THREE.MeshLambertMaterial({ color: 0x5c8f4a });
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    this.scene.add(ground);
    this.disposableGeometries.push(geometry);
    this.disposableMaterials.push(material);

    const grid = new THREE.GridHelper(96, 96, 0x29402a, 0x486548);
    grid.position.y = 0.003;
    this.scene.add(grid);
  }
}
