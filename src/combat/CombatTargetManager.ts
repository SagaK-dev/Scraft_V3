import * as THREE from 'three';

export interface CombatTargetHit {
  readonly distance: number;
  readonly health: number;
  readonly maxHealth: number;
}

export interface CombatDamageResult {
  readonly damaged: boolean;
  readonly killed: boolean;
  readonly health: number;
}

export class CombatTargetManager {
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshLambertMaterial;
  private readonly raycaster = new THREE.Raycaster();
  private healthValue = 10;
  private respawnTimer = 0;
  private flashTimer = 0;

  constructor(private readonly scene: THREE.Scene, x: number, feetY: number, z: number) {
    const geometry = new THREE.BoxGeometry(0.8, 1.6, 0.8);
    this.material = new THREE.MeshLambertMaterial({ color: 0xb94942 });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.name = 'phase6-training-target';
    this.mesh.position.set(x, feetY + 0.8, z);
    this.scene.add(this.mesh);
  }

  update(dt: number): void {
    if (this.respawnTimer > 0) {
      this.respawnTimer = Math.max(0, this.respawnTimer - dt);
      if (this.respawnTimer === 0) {
        this.healthValue = 10;
        this.mesh.visible = true;
      }
    }
    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - dt);
      this.material.emissive.setHex(this.flashTimer > 0 ? 0x5a1010 : 0x000000);
    }
  }

  raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): CombatTargetHit | null {
    if (!this.mesh.visible) return null;
    this.raycaster.set(origin, direction);
    this.raycaster.far = maxDistance;
    const hit = this.raycaster.intersectObject(this.mesh, false)[0];
    return hit ? { distance: hit.distance, health: this.healthValue, maxHealth: 10 } : null;
  }

  damage(amount: number): CombatDamageResult {
    if (!this.mesh.visible || !Number.isFinite(amount) || amount <= 0) return { damaged: false, killed: false, health: this.healthValue };
    this.healthValue = Math.max(0, this.healthValue - amount);
    this.flashTimer = 0.12;
    this.material.emissive.setHex(0x5a1010);
    const killed = this.healthValue <= 0;
    if (killed) {
      this.mesh.visible = false;
      this.respawnTimer = 8;
    }
    return { damaged: true, killed, health: this.healthValue };
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
