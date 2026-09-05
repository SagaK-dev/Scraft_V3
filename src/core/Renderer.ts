import * as THREE from 'three';
import { WeatherRenderer } from '../world/WeatherRenderer';
import type { WeatherPhase } from '../world/WeatherSystem';

export class Renderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(75, 1, 0.05, 1000);
  readonly gl: THREE.WebGLRenderer;
  private readonly resizeObserver: ResizeObserver;
  private readonly hemisphere: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly skyDay = new THREE.Color(0x86b9e8);
  private readonly skyNight = new THREE.Color(0x08121f);
  private readonly skyScratch = new THREE.Color();
  private readonly stormSky = new THREE.Color(0x374452);
  private readonly weatherRenderer: WeatherRenderer;

  constructor(canvas: HTMLCanvasElement, onContextLost: () => void) {
    const probe = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' });
    if (!probe) throw new Error('WebGL2に対応したブラウザ/GPUが必要です。');
    this.gl = new THREE.WebGLRenderer({ canvas, context: probe, antialias: true, powerPreference: 'high-performance' });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.gl.setClearColor(this.skyDay, 1);
    this.scene.fog = new THREE.Fog(this.skyDay.getHex(), 35, 150);
    this.hemisphere = new THREE.HemisphereLight(0xddeeff, 0x4a4a42, 1.8);
    this.scene.add(this.hemisphere);
    this.sun = new THREE.DirectionalLight(0xfff1d0, 2.2);
    this.sun.position.set(20, 35, 12);
    this.scene.add(this.sun);
    this.weatherRenderer = new WeatherRenderer(this.scene);
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); onContextLost(); }, { once: true });
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  draw(): void { this.gl.render(this.scene, this.camera); }

  applyDayNight(normalizedTime: number, daylight: number): void {
    const light = THREE.MathUtils.clamp(daylight, 0, 1);
    const angle = (normalizedTime - 0.25) * Math.PI * 2;
    this.sun.position.set(Math.cos(angle) * 40, Math.sin(angle) * 55, 18);
    this.sun.intensity = 0.12 + light * 2.08;
    this.hemisphere.intensity = 0.18 + light * 1.62;
    this.skyScratch.copy(this.skyNight).lerp(this.skyDay, 0.12 + light * 0.88);
    this.gl.setClearColor(this.skyScratch, 1);
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.copy(this.skyScratch);
  }

  applyWeather(phase: WeatherPhase, intensity: number, elapsedSeconds: number, playerPosition?: { readonly x: number; readonly y: number; readonly z: number }): void {
    const amount = THREE.MathUtils.clamp(intensity, 0, 1);
    if (amount > 0) {
      const darkness = phase === 'storm' ? 0.62 : 0.32;
      this.sun.intensity *= 1 - amount * darkness;
      this.hemisphere.intensity *= 1 - amount * darkness * 0.55;
      this.skyScratch.lerp(this.stormSky, amount * (phase === 'storm' ? 0.68 : 0.32));
      this.gl.setClearColor(this.skyScratch, 1);
      if (this.scene.fog instanceof THREE.Fog) {
        this.scene.fog.color.copy(this.skyScratch);
        this.scene.fog.near = 35 - amount * 10;
        this.scene.fog.far = 150 - amount * 55;
      }
    } else if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = 35;
      this.scene.fog.far = 150;
    }
    if (playerPosition) this.weatherRenderer.update(phase, amount, elapsedSeconds, new THREE.Vector3(playerPosition.x, playerPosition.y, playerPosition.z));
    else this.weatherRenderer.update(phase, amount, elapsedSeconds, this.camera.position);
  }

  setFov(fov: number): void {
    if (Math.abs(this.camera.fov - fov) < 0.01) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void { this.resizeObserver.disconnect(); this.weatherRenderer.dispose(this.scene); this.gl.dispose(); }

  private readonly resize = (): void => {
    const canvas = this.gl.domElement;
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.gl.setSize(width, height, false);
  };
}
