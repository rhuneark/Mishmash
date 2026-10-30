// The wardrobe's preview: your survivor in the outfit picked, turning slowly in warm
// light. The game's own rig (render/actors.ts), so what you see is what others see.

import * as THREE from 'three';
import type { Look } from '../game/outfits';
import { Actor } from './render/actors';
import { setupRenderer } from './render/light';

export class WardrobeScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
  private actor: Actor | null = null;
  private raf = 0;
  private last = 0;
  private angle = 0.5;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly id: string,
    private readonly color: number,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    setupRenderer(this.renderer);
    this.renderer.shadowMap.enabled = false;
    const hemi = new THREE.HemisphereLight(0xfff2dc, 0x5a6a4a, 1.4);
    const sun = new THREE.DirectionalLight(0xffd8a8, 2.4);
    sun.position.set(2, 4, 3);
    this.scene.add(hemi, sun);
    this.camera.position.set(0, 1.3, 3.7);
    this.camera.lookAt(0, 1.02, 0);
  }

  wear(look: Look): void {
    if (this.actor) this.scene.remove(this.actor.root);
    this.actor = new Actor('player', this.id, this.color, look);
    this.actor.root.rotation.y = this.angle;
    this.scene.add(this.actor.root);
  }

  start(): void {
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
      this.last = now;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private frame(dt: number): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    if (this.canvas.width !== Math.round(w * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.angle += dt * 0.6;
    if (this.actor) {
      this.actor.root.rotation.y = this.angle;
      this.actor.update(dt, 0, 0);
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
