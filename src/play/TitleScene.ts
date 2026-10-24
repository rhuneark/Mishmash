// The title screen's backdrop: your island at the crash site, the camera slowly
// circling the wreck in late-afternoon light. Built from the game's own render
// parts, so it looks like the game (and like the island you'd load into).

import * as THREE from 'three';
import { heightAt, type Island } from '../game/world';
import { isTouch, prefs } from './prefs';
import { Ambient } from './render/ambient';
import { climateLook } from './render/climate';
import { SunShadow, setupRenderer, shadeAll, toneMapped } from './render/light';
import { NodeView } from './render/nodes';
import { buildPois } from './render/structures';
import { Terrain } from './render/terrain';
import { WIND } from './render/wind';
import { graphicsFor } from './settings';

/** Seconds per frame we aim for (the backdrop doesn't need more than 30 fps). */
const FRAME = 1 / 30;

export class TitleScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.5, 400);
  private readonly terrain: Terrain;
  private readonly nodes: NodeView;
  private readonly ambient: Ambient;
  private readonly focus: THREE.Vector3;
  private readonly sun: SunShadow;
  private shadowAcc = 0;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private t = 0;
  private angle: number;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    island: Island,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    const gfx = graphicsFor(prefs.get().quality, isTouch());
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, gfx.pixelRatio, 1.5));
    setupRenderer(this.renderer);
    // The sun stands still here: its shadows are drawn now and then, not every frame.
    this.renderer.shadowMap.autoUpdate = false;
    const look = climateLook(island.spec.climate);
    // Late afternoon: the day colours, warmed toward dusk.
    const sky = new THREE.Color(look.skyDay ?? 0x9fd3ea).lerp(
      new THREE.Color(look.skyDusk ?? 0xe39a6a),
      0.45,
    );
    this.scene.background = toneMapped(sky, new THREE.Color());
    this.scene.fog = new THREE.Fog(sky, 30, 80 + 40 * (look.fog ?? 1));
    const hemi = new THREE.HemisphereLight(
      look.hemiDay ?? 0xd8eeff,
      look.groundDay ?? 0x6a7a4a,
      1.0,
    );
    const sun = new THREE.DirectionalLight(0xffc890, 2.6);
    this.scene.add(hemi, sun, sun.target);
    this.sun = new SunShadow(sun, 48);
    this.sun.setSize(Math.min(gfx.shadows, 1024));

    const crash = island.poiById['crash'];
    const fx = crash?.x ?? island.spawn.x;
    const fz = crash?.z ?? island.spawn.z;
    this.focus = new THREE.Vector3(fx, heightAt(island, fx, fz) + 1.5, fz);
    // Low western sun: long shadows across the crash site.
    this.sun.follow(fx, this.focus.y, fz, new THREE.Vector3(-0.8, 0.75, 0.45));
    // Start on the side facing the island's middle (the sea behind the wreck).
    this.angle = Math.atan2(-fx, -fz) + Math.PI * 0.85;

    this.terrain = new Terrain(island, this.scene);
    this.terrain.prime(fx, fz, 2);
    this.terrain.setWaterTint(1, false);
    this.nodes = new NodeView(island, this.scene, (id) => island.hidden[id] === 1);
    this.nodes.update(fx, fz, 2, 0);
    this.ambient = new Ambient(island, this.scene);
    this.ambient.configure(Math.min(gfx.grass, 160), prefs.get().life);
    for (const p of buildPois(island.pois, island.spec, (x, z) => heightAt(island, x, z))) {
      if (Math.hypot(p.poi.x - fx, p.poi.z - fz) < 150) this.scene.add(p.group);
    }
    shadeAll(this.scene);
  }

  start(): void {
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
      this.last = now;
      this.acc += dt;
      if (this.acc < FRAME) return;
      this.frame(this.acc);
      this.acc = 0;
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
      // Tall screens: widen the view so the wreck still fits.
      this.camera.fov = w < h ? 62 : 48;
      this.camera.updateProjectionMatrix();
    }
    this.t += dt;
    this.angle += dt * 0.035;
    WIND.value = this.t;
    const r = 30;
    const f = this.focus;
    this.camera.position.set(
      f.x + Math.sin(this.angle) * r,
      f.y + 13 + Math.sin(this.t * 0.2) * 1.5,
      f.z + Math.cos(this.angle) * r,
    );
    this.camera.lookAt(f.x, f.y + 3, f.z);
    this.terrain.update(f.x, f.z, 2);
    // Trees between the camera and the wreck turn see-through, as in the game.
    this.nodes.update(f.x, f.z, 2, dt, { x: Math.sin(this.angle), z: Math.cos(this.angle) });
    this.ambient.update(dt, this.t, f.x, f.z, 1, false, []);
    this.shadowAcc -= dt;
    if (this.shadowAcc <= 0) {
      this.shadowAcc = 2;
      this.renderer.shadowMap.needsUpdate = true;
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.ambient.dispose();
    this.renderer.dispose();
    // Hand the WebGL context back: the game makes its own when it starts.
    this.renderer.forceContextLoss();
  }
}
