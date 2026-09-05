import * as THREE from 'three';
import type { InputManager } from '../core/InputManager';
import type { GameSettings } from '../core/Settings';
import { moveTowards } from './movement';

const EYE_HEIGHT = 1.62;
const WALK_SPEED = 4.3;
const SPRINT_SPEED = 6.8;
const JUMP_SPEED = 7.0;
const GRAVITY = -20;
const GROUND_ACCELERATION = 34;
const AIR_ACCELERATION = 8;
const GROUND_DRAG = 14;

export class PlayerController {
  readonly position = new THREE.Vector3(0, EYE_HEIGHT, 6);
  readonly velocity = new THREE.Vector3();
  private readonly previousPosition = this.position.clone();
  private yaw = Math.PI;
  private pitch = 0;
  private grounded = true;
  private walkTime = 0;

  look(deltaX: number, deltaY: number, sensitivity: number): void {
    const scale = sensitivity * 0.0025;
    this.yaw -= deltaX * scale;
    this.pitch -= deltaY * scale;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
  }

  update(dt: number, input: Pick<InputManager, 'isDown'>): void {
    this.previousPosition.copy(this.position);

    const forwardInput = Number(input.isDown('KeyW')) - Number(input.isDown('KeyS'));
    const strafeInput = Number(input.isDown('KeyD')) - Number(input.isDown('KeyA'));
    const sprinting = input.isDown('ControlLeft') || input.isDown('ControlRight');
    const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = forward.multiplyScalar(forwardInput).add(right.multiplyScalar(strafeInput));
    if (wish.lengthSq() > 1) wish.normalize();
    wish.multiplyScalar(speed);

    const accel = this.grounded ? GROUND_ACCELERATION : AIR_ACCELERATION;
    this.velocity.x = moveTowards(this.velocity.x, wish.x, accel * dt);
    this.velocity.z = moveTowards(this.velocity.z, wish.z, accel * dt);

    if (wish.lengthSq() === 0 && this.grounded) {
      const drag = Math.max(0, 1 - GROUND_DRAG * dt);
      this.velocity.x *= drag;
      this.velocity.z *= drag;
    }

    if (this.grounded && input.isDown('Space')) {
      this.velocity.y = JUMP_SPEED;
      this.grounded = false;
    }

    this.velocity.y += GRAVITY * dt;
    this.position.addScaledVector(this.velocity, dt);

    if (this.position.y <= EYE_HEIGHT) {
      this.position.y = EYE_HEIGHT;
      if (this.velocity.y < 0) this.velocity.y = 0;
      this.grounded = true;
    }

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.grounded && horizontalSpeed > 0.25) this.walkTime += dt * Math.min(horizontalSpeed, SPRINT_SPEED);
  }

  render(camera: THREE.PerspectiveCamera, alpha: number, frameDelta: number, settings: GameSettings, playing: boolean): void {
    camera.position.lerpVectors(this.previousPosition, this.position, THREE.MathUtils.clamp(alpha, 0, 1));
    camera.rotation.order = 'YXZ';
    camera.rotation.y = this.yaw;
    camera.rotation.x = this.pitch;

    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (settings.viewBob && playing && this.grounded && speed > 0.25) {
      camera.position.y += Math.sin(this.walkTime * 1.7) * 0.025 * Math.min(1, speed / WALK_SPEED);
      camera.position.x += Math.cos(this.walkTime * 0.85) * 0.012 * Math.min(1, speed / WALK_SPEED);
    }

    const sprintFactor = playing ? THREE.MathUtils.smoothstep(speed, WALK_SPEED, SPRINT_SPEED) : 0;
    const targetFov = settings.fov + sprintFactor * 7;
    camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 10, frameDelta);
    camera.updateProjectionMatrix();
  }

  sync(): void {
    this.previousPosition.copy(this.position);
  }

  get isGrounded(): boolean {
    return this.grounded;
  }
}
