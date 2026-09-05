import * as THREE from 'three';
import type { InputManager } from '../core/InputManager';
import type { GameSettings } from '../core/Settings';
import type { AABB } from './aabb';
import { moveTowards } from './movement';
import { createAABB, intersectsSolid, moveAABB, type VoxelCollisionSource } from './VoxelPhysics';

const STANDING_EYE_HEIGHT = 1.62;
const STANDING_HEIGHT = 1.8;
const CROUCH_EYE_HEIGHT = 1.27;
const CROUCH_HEIGHT = 1.5;
const PLAYER_HALF_WIDTH = 0.3;
const WALK_SPEED = 4.3;
const SPRINT_SPEED = 6.8;
const CROUCH_SPEED = 1.45;
const JUMP_SPEED = 7.0;
const GRAVITY = -20;
const TERMINAL_VELOCITY = -78.4;
const GROUND_ACCELERATION = 34;
const AIR_ACCELERATION = 8;
const GROUND_DRAG = 14;
const AUTO_STEP_HEIGHT = 1.001;

export class PlayerController {
  readonly position = new THREE.Vector3(0, STANDING_EYE_HEIGHT, 6);
  readonly velocity = new THREE.Vector3();
  private readonly previousPosition = this.position.clone();
  private yaw = Math.PI;
  private pitch = 0;
  private grounded = false;
  private crouched = false;
  private eyeHeight = STANDING_EYE_HEIGHT;
  private bodyHeight = STANDING_HEIGHT;
  private walkTime = 0;
  private accumulatedFallDistance = 0;
  private lastLandedFallDistance = 0;

  look(deltaX: number, deltaY: number, sensitivity: number): void {
    const scale = sensitivity * 0.0025;
    this.yaw -= deltaX * scale;
    this.pitch -= deltaY * scale;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
  }

  update(dt: number, input: Pick<InputManager, 'isDown'>, collision: VoxelCollisionSource): void {
    this.previousPosition.copy(this.position);
    this.updateCrouch(input, collision);

    const forwardInput = Number(input.isDown('KeyW')) - Number(input.isDown('KeyS'));
    const strafeInput = Number(input.isDown('KeyD')) - Number(input.isDown('KeyA'));
    const sprinting = !this.crouched && (input.isDown('ControlLeft') || input.isDown('ControlRight'));
    const speed = this.crouched ? CROUCH_SPEED : sprinting ? SPRINT_SPEED : WALK_SPEED;

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

    this.velocity.y = Math.max(TERMINAL_VELOCITY, this.velocity.y + GRAVITY * dt);
    const bounds = this.getBounds();
    const motion = moveAABB(
      bounds,
      { x: this.velocity.x * dt, y: this.velocity.y * dt, z: this.velocity.z * dt },
      collision,
      {
        stepHeight: AUTO_STEP_HEIGHT,
        allowStep: this.grounded && !this.crouched && this.velocity.y <= 0,
        keepSupported: this.crouched && this.grounded,
      },
    );

    this.applyBounds(motion.bounds);
    if (motion.hitX) this.velocity.x = 0;
    if (motion.hitZ) this.velocity.z = 0;
    if (motion.hitCeiling && this.velocity.y > 0) this.velocity.y = 0;
    if (motion.grounded && this.velocity.y <= 0) this.velocity.y = 0;

    const wasGrounded = this.grounded;
    this.grounded = motion.grounded;
    if (!this.grounded && motion.moved.y < 0) this.accumulatedFallDistance += -motion.moved.y;
    if (this.grounded) {
      if (!wasGrounded && this.accumulatedFallDistance > 0) this.lastLandedFallDistance = this.accumulatedFallDistance;
      this.accumulatedFallDistance = 0;
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

    const sprintFactor = playing && !this.crouched ? THREE.MathUtils.smoothstep(speed, WALK_SPEED, SPRINT_SPEED) : 0;
    const targetFov = settings.fov + sprintFactor * 7;
    camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 10, frameDelta);
    camera.updateProjectionMatrix();
  }

  getBounds(): AABB {
    const feetY = this.position.y - this.eyeHeight;
    return createAABB(this.position.x, feetY, this.position.z, PLAYER_HALF_WIDTH, this.bodyHeight);
  }

  teleportToFeet(x: number, feetY: number, z: number): void {
    if (![x, feetY, z].every(Number.isFinite)) throw new RangeError('Teleport coordinates must be finite.');
    this.position.set(x, feetY + this.eyeHeight, z);
    this.previousPosition.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.accumulatedFallDistance = 0;
    this.lastLandedFallDistance = 0;
  }

  sync(): void {
    this.previousPosition.copy(this.position);
  }

  get isGrounded(): boolean { return this.grounded; }
  get isCrouched(): boolean { return this.crouched; }
  get fallDistance(): number { return this.accumulatedFallDistance; }
  get lastFallDistance(): number { return this.lastLandedFallDistance; }

  private updateCrouch(input: Pick<InputManager, 'isDown'>, collision: VoxelCollisionSource): void {
    const wantsCrouch = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    if (wantsCrouch) {
      if (!this.crouched) this.setStance(true);
      return;
    }
    if (!this.crouched) return;

    const feetY = this.position.y - this.eyeHeight;
    const standing = createAABB(this.position.x, feetY, this.position.z, PLAYER_HALF_WIDTH, STANDING_HEIGHT);
    if (!intersectsSolid(standing, collision)) this.setStance(false);
  }

  private setStance(crouched: boolean): void {
    const feetY = this.position.y - this.eyeHeight;
    this.crouched = crouched;
    this.eyeHeight = crouched ? CROUCH_EYE_HEIGHT : STANDING_EYE_HEIGHT;
    this.bodyHeight = crouched ? CROUCH_HEIGHT : STANDING_HEIGHT;
    this.position.y = feetY + this.eyeHeight;
  }

  private applyBounds(bounds: AABB): void {
    this.position.x = (bounds.minX + bounds.maxX) / 2;
    this.position.y = bounds.minY + this.eyeHeight;
    this.position.z = (bounds.minZ + bounds.maxZ) / 2;
  }
}
