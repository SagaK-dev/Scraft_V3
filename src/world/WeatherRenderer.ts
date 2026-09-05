import * as THREE from 'three';
import type { WeatherPhase } from './WeatherSystem.ts';

const DROP_COUNT = 320;

export class WeatherRenderer {
  private readonly positions = new Float32Array(DROP_COUNT * 2 * 3);
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material = new THREE.LineBasicMaterial({ color: 0xaec9e8, transparent: true, opacity: 0, depthWrite: false });
  private readonly rain: THREE.LineSegments;

  constructor(scene: THREE.Scene) {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.rain = new THREE.LineSegments(this.geometry, this.material);
    this.rain.name = 'weather-rain';
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);
  }

  update(phase: WeatherPhase, intensity: number, elapsedSeconds: number, cameraPosition: THREE.Vector3): void {
    const amount = THREE.MathUtils.clamp(intensity, 0, 1);
    this.rain.visible = phase !== 'clear' && amount > 0.01;
    if (!this.rain.visible) return;
    this.material.opacity = amount * (phase === 'storm' ? 0.72 : 0.48);
    const speed = phase === 'storm' ? 19 : 14;
    const length = phase === 'storm' ? 1.5 : 0.9;
    for (let i = 0; i < DROP_COUNT; i += 1) {
      const u = unitHash(i, 0x51d7348d);
      const v = unitHash(i, 0x9e3779b1);
      const phaseOffset = unitHash(i, 0x85ebca6b) * 28;
      const x = cameraPosition.x + (u - 0.5) * 34;
      const z = cameraPosition.z + (v - 0.5) * 34;
      const fall = (elapsedSeconds * speed + phaseOffset) % 28;
      const y = cameraPosition.y + 14 - fall;
      const base = i * 6;
      this.positions[base] = x;
      this.positions[base + 1] = y;
      this.positions[base + 2] = z;
      this.positions[base + 3] = x + (phase === 'storm' ? 0.18 : 0.05);
      this.positions[base + 4] = y - length;
      this.positions[base + 5] = z + (phase === 'storm' ? 0.08 : 0.02);
    }
    const attribute = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    attribute.needsUpdate = true;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.rain);
    this.geometry.dispose();
    this.material.dispose();
  }
}

function unitHash(index: number, salt: number): number {
  let x = (Math.imul(index + 1, 0x7feb352d) ^ salt) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 15;
  return (x >>> 0) / 0xffffffff;
}
