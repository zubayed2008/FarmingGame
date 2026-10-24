import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PLOT_COUNT } from "../game/data";
import { getCropProgress, getCropStage } from "../game/selectors";
import type { CropSpecies, GameState, LivestockSpecies, PetSpecies } from "../game/types";

export interface FarmScene {
  setGameState: (state: GameState) => void;
  resize: () => void;
  dispose: () => void;
}

const PLOT_COLUMNS = 3;
const PLOT_SIZE = 2.7;
const PLOT_GAP = 0.55;

function makeLabelSprite(text: string, color = "#ffffff"): THREE.Sprite {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, size, size);
    context.font = "84px system-ui, 'Segoe UI Emoji', serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = color;
    context.fillText(text, size / 2, size / 2 + 4);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.9, 0.9, 0.9);
  return sprite;
}

function makeGrassTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#79c257";
    context.fillRect(0, 0, size, size);
    for (let index = 0; index < 900; index += 1) {
      const shade = 70 + Math.floor(Math.random() * 60);
      context.fillStyle = `rgb(${shade + 40}, ${shade + 110}, ${shade + 30})`;
      context.fillRect(Math.random() * size, Math.random() * size, 3, 6);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 8);
  return texture;
}

function standard(color: number, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}

function buildGround(scene: THREE.Scene): void {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(54, 40),
    new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 40),
    new THREE.MeshStandardMaterial({ color: 0x4aa3df, roughness: 0.15, metalness: 0.3 })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(12, 0.02, 7);
  scene.add(pond);

  const pondRim = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.22, 8, 40), standard(0x9a8b6a));
  pondRim.rotation.x = -Math.PI / 2;
  pondRim.position.copy(pond.position);
  scene.add(pondRim);
}

function buildFence(scene: THREE.Scene): void {
  const railMaterial = standard(0xc9a06a);
  const postGeometry = new THREE.BoxGeometry(0.18, 1.1, 0.18);
  const railGeometry = new THREE.BoxGeometry(3, 0.14, 0.14);
  const paddockZ = -8.2;
  const posts: THREE.Vector3[] = [];

  for (let x = -7.5; x <= 7.5; x += 1.5) {
    posts.push(new THREE.Vector3(x, 0.55, paddockZ + 2.6));
  }
  for (const x of [-7.5, 7.5]) {
    for (let z = paddockZ - 2.6; z <= paddockZ + 2.6; z += 1.3) {
      posts.push(new THREE.Vector3(x, 0.55, z));
    }
  }

  for (const position of posts) {
    const post = new THREE.Mesh(postGeometry, railMaterial);
    post.position.copy(position);
    post.castShadow = true;
    scene.add(post);
  }

  for (let x = -7.5; x <= 6; x += 1.5) {
    const rail = new THREE.Mesh(railGeometry, railMaterial);
    rail.position.set(x + 0.75, 0.75, paddockZ + 2.6);
    rail.castShadow = true;
    scene.add(rail);
  }
}

function makeSkyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#5fb6ea");
    gradient.addColorStop(0.55, "#a8dcf5");
    gradient.addColorStop(1, "#e8f6d8");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 16, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildDecor(scene: THREE.Scene): void {
  const path = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 15), standard(0xcdb086));
  path.position.set(-6.5, 0.03, 1);
  path.rotation.y = -0.45;
  path.receiveShadow = true;
  scene.add(path);

  const hayMaterial = standard(0xe0b84f);
  for (const [x, z, rotation] of [
    [-9.2, -3.4, 0.3],
    [-8.2, -3.9, -0.2],
    [-8.8, -2.4, 0.6]
  ] as Array<[number, number, number]>) {
    const bale = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 12), hayMaterial);
    bale.rotation.z = Math.PI / 2;
    bale.rotation.y = rotation;
    bale.position.set(x, 0.6, z);
    bale.castShadow = true;
    scene.add(bale);
  }

  const petalColors = [0xffd166, 0xff8fab, 0xffffff, 0xb28dff];
  const stemMaterial = standard(0x4f9c43);
  for (let index = 0; index < 46; index += 1) {
    const x = -20 + Math.random() * 40;
    const z = -16 + Math.random() * 30;
    const insidePlots = x > -5.5 && x < 5.5 && z > -0.5 && z < 7.5;
    const insidePaddock = x > -8.5 && x < 8.5 && z > -11.5 && z < -5.5;
    const insidePond = Math.hypot(x - 12, z - 7) < 4.4;
    const insideBarn = x > -16.5 && x < -7.5 && z > -9.5 && z < -2.5;
    if (insidePlots || insidePaddock || insidePond || insideBarn) {
      continue;
    }
    const flower = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4), stemMaterial);
    stem.position.y = 0.17;
    const petal = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 6, 5),
      standard(petalColors[index % petalColors.length] ?? 0xffffff)
    );
    petal.position.y = 0.38;
    flower.add(stem, petal);
    flower.position.set(x, 0, z);
    scene.add(flower);
  }

  const rockMaterial = standard(0x9aa0a6, 0.95);
  for (let index = 0; index < 10; index += 1) {
    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.25 + Math.random() * 0.3, 0),
      rockMaterial
    );
    rock.position.set(-19 + Math.random() * 38, 0.12, -14 + Math.random() * 26);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    scene.add(rock);
  }
}

function buildBarn(scene: THREE.Scene): void {
  const barn = new THREE.Group();
  barn.position.set(-13.5, 0, -7);

  const walls = new THREE.Mesh(new THREE.BoxGeometry(7, 4.2, 5.4), standard(0xb4442f));
  walls.position.y = 2.1;
  walls.castShadow = true;
  walls.receiveShadow = true;
  barn.add(walls);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.4, 2.8, 4), standard(0x7c2d1f));
  roof.position.y = 5.6;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  barn.add(roof);

  const door = new THREE.Mesh(new THREE.BoxGeometry(2, 2.8, 0.25), standard(0x6b4423));
  door.position.set(0, 1.4, 2.75);
  barn.add(door);

  const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.25), standard(0xf7e2a3));
  windowFrame.position.set(-2.2, 2.8, 2.75);
  barn.add(windowFrame);

  scene.add(barn);
}

function buildTrees(scene: THREE.Scene): void {
  const trunkMaterial = standard(0x7a5230);
  const leafMaterial = standard(0x3f8f3a);
  const positions: Array<[number, number, number]> = [
    [-16, 0.9, 6],
    [-17, 0.75, 1],
    [16, 1.05, -4],
    [17, 0.8, 3],
    [4, 0.9, -15],
    [-6, 0.7, -16]
  ];

  for (const [x, scale, z] of positions) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 1.8, 8), trunkMaterial);
    trunk.position.y = 0.9;
    trunk.castShadow = true;
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), leafMaterial);
    leaves.position.y = 2.6;
    leaves.castShadow = true;
    tree.add(trunk, leaves);
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    scene.add(tree);
  }
}

function buildClouds(scene: THREE.Scene): THREE.Group[] {
  const clouds: THREE.Group[] = [];
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    transparent: true,
    opacity: 0.9
  });

  for (let index = 0; index < 4; index += 1) {
    const cloud = new THREE.Group();
    for (let puff = 0; puff < 4; puff += 1) {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.3 + Math.random() * 0.5, 12, 10), material);
      sphere.position.set(puff * 1.5 - 2, Math.random() * 0.4, Math.random() * 0.6);
      cloud.add(sphere);
    }
    cloud.position.set(-18 + index * 12, 13 + Math.random() * 2, -14 - index * 3);
    cloud.scale.setScalar(1.2 + Math.random() * 0.6);
    scene.add(cloud);
    clouds.push(cloud);
  }
  return clouds;
}

function buildCrop(species: CropSpecies, stage: "dry" | "growing" | "ripe", progress: number): THREE.Group {
  const group = new THREE.Group();
  const scale = stage === "ripe" ? 1 : 0.25 + progress * 0.75;
  const stems = species === "wheat" || species === "rice" ? 11 : 7;
  const stemColor = species === "wheat" ? 0xd9b44a : species === "rice" ? 0x9ec46a : 0x4c9a3f;
  const stemMaterial = standard(stemColor);
  const leafMaterial = standard(species === "tomato" ? 0x3f8f3a : 0x64b447);

  if (stage === "dry") {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), standard(0x6b4423));
    mound.scale.y = 0.4;
    mound.position.y = 0.12;
    mound.castShadow = true;
    group.add(mound);
    return group;
  }

  if (species === "carrot") {
    for (let index = 0; index < stems; index += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.7 * scale, 5), leafMaterial);
      const angle = (index / stems) * Math.PI * 2;
      leaf.position.set(Math.cos(angle) * 0.22, 0.35 * scale, Math.sin(angle) * 0.22);
      leaf.rotation.z = Math.cos(angle) * 0.5;
      leaf.rotation.x = -Math.sin(angle) * 0.5;
      leaf.castShadow = true;
      group.add(leaf);
    }
    if (stage === "ripe") {
      const root = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 10), standard(0xe8792f));
      root.rotation.x = Math.PI;
      root.position.y = 0.22;
      root.castShadow = true;
      group.add(root);
    }
    return group;
  }

  if (species === "tomato") {
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62 * scale, 0), leafMaterial);
    bush.position.y = 0.5 * scale;
    bush.castShadow = true;
    group.add(bush);
    if (stage === "ripe") {
      const tomatoMaterial = standard(0xd8342a);
      for (let index = 0; index < 5; index += 1) {
        const angle = (index / 5) * Math.PI * 2;
        const tomato = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), tomatoMaterial);
        tomato.position.set(Math.cos(angle) * 0.5, 0.5 + (index % 2) * 0.28, Math.sin(angle) * 0.5);
        tomato.castShadow = true;
        group.add(tomato);
      }
    }
    return group;
  }

  for (let index = 0; index < stems; index += 1) {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const height = (species === "wheat" ? 1.35 : 1.05) * scale;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, height, 5), stemMaterial);
    stem.position.set((column - 1.5) * 0.42, height / 2, (row - 1) * 0.5);
    stem.rotation.z = (Math.random() - 0.5) * 0.12;
    stem.castShadow = true;
    group.add(stem);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.12 * scale, 8, 6),
      standard(species === "wheat" ? 0xf0c95a : 0xc9d98a)
    );
    head.position.set(stem.position.x, height + 0.06, stem.position.z);
    head.scale.y = 1.6;
    head.castShadow = true;
    group.add(head);
  }
  return group;
}

function enableShadows(group: THREE.Object3D): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function addLegs(group: THREE.Group, material: THREE.Material, spacingX: number, spacingZ: number, height: number): void {
  const geometry = new THREE.CylinderGeometry(0.09, 0.09, height, 6);
  for (const x of [-spacingX, spacingX]) {
    for (const z of [-spacingZ, spacingZ]) {
      const leg = new THREE.Mesh(geometry, material);
      leg.position.set(x, height / 2, z);
      group.add(leg);
    }
  }
}

function buildCow(): THREE.Group {
  const group = new THREE.Group();
  const bodyMaterial = standard(0xf5f2ea);
  const patchMaterial = standard(0x2c2c2c);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.95, 1.05), bodyMaterial);
  body.position.y = 1.05;
  group.add(body);

  for (const [x, y, z, scale] of [
    [-0.45, 1.25, 0.54, 0.45],
    [0.35, 0.95, -0.54, 0.6],
    [0.55, 1.3, 0.54, 0.35]
  ] as Array<[number, number, number, number]>) {
    const patch = new THREE.Mesh(new THREE.BoxGeometry(scale, scale, 0.06), patchMaterial);
    patch.position.set(x, y, z);
    group.add(patch);
  }

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.58, 0.62), bodyMaterial);
  head.position.set(0, 1.25, 0.78);
  group.add(head);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.2), standard(0xe8a9a0));
  snout.position.set(0, 1.14, 1.12);
  group.add(snout);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.16), bodyMaterial);
    ear.position.set(side * 0.38, 1.5, 0.72);
    group.add(ear);

    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 6), standard(0xe6dcc4));
    horn.position.set(side * 0.22, 1.62, 0.8);
    horn.rotation.z = side * -0.4;
    group.add(horn);
  }

  addLegs(group, bodyMaterial, 0.55, 0.34, 0.6);

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), bodyMaterial);
  tail.position.set(0, 1.05, -0.62);
  tail.rotation.x = 0.5;
  group.add(tail);

  enableShadows(group);
  return group;
}

function buildGoat(): THREE.Group {
  const group = new THREE.Group();
  const bodyMaterial = standard(0xd8c39a);
  const darkMaterial = standard(0x9c8560);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.78, 0.8), bodyMaterial);
  body.position.y = 0.95;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.46, 0.5), bodyMaterial);
  head.position.set(0, 1.25, 0.6);
  group.add(head);

  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 6), darkMaterial);
  beard.position.set(0, 0.98, 0.78);
  beard.rotation.x = Math.PI;
  group.add(beard);

  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 6), darkMaterial);
    horn.position.set(side * 0.16, 1.62, 0.55);
    horn.rotation.x = -0.5;
    horn.rotation.z = side * -0.25;
    group.add(horn);

    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.1), bodyMaterial);
    ear.position.set(side * 0.3, 1.36, 0.55);
    group.add(ear);
  }

  addLegs(group, darkMaterial, 0.4, 0.26, 0.58);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 6), bodyMaterial);
  tail.position.set(0, 1.18, -0.46);
  tail.rotation.x = -0.9;
  group.add(tail);

  enableShadows(group);
  return group;
}

function buildDog(): THREE.Group {
  const group = new THREE.Group();
  const furMaterial = standard(0xb07a45);
  const darkMaterial = standard(0x6d4626);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.58, 0.55), furMaterial);
  body.position.y = 0.62;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 10), furMaterial);
  head.position.set(0, 0.95, 0.36);
  group.add(head);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.24), darkMaterial);
  snout.position.set(0, 0.86, 0.62);
  group.add(snout);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 6), darkMaterial);
    ear.position.set(side * 0.2, 1.2, 0.3);
    ear.rotation.z = side * 0.2;
    group.add(ear);
  }

  addLegs(group, furMaterial, 0.33, 0.18, 0.34);

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.45, 6), furMaterial);
  tail.position.set(0, 0.82, -0.42);
  tail.rotation.x = -0.8;
  group.add(tail);

  enableShadows(group);
  return group;
}

function buildCat(): THREE.Group {
  const group = new THREE.Group();
  const furMaterial = standard(0x8d8f96);
  const lightMaterial = standard(0xd7d9dd);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.46, 0.48), furMaterial);
  body.position.y = 0.5;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), furMaterial);
  head.position.set(0, 0.8, 0.32);
  group.add(head);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), lightMaterial);
  chest.position.set(0, 0.52, 0.26);
  group.add(chest);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 4), furMaterial);
    ear.position.set(side * 0.15, 1.02, 0.3);
    group.add(ear);
  }

  addLegs(group, furMaterial, 0.26, 0.15, 0.28);

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.5, 6), furMaterial);
  tail.position.set(0, 0.72, -0.38);
  tail.rotation.x = -0.9;
  group.add(tail);

  enableShadows(group);
  return group;
}

function buildAnimal(species: LivestockSpecies | PetSpecies): THREE.Group {
  switch (species) {
    case "cow":
      return buildCow();
    case "goat":
      return buildGoat();
    case "dog":
      return buildDog();
    case "cat":
      return buildCat();
  }
}

interface CropVisual {
  group: THREE.Group;
  signature: string;
}

interface AnimalVisual {
  group: THREE.Group;
  species: LivestockSpecies | PetSpecies;
  phase: number;
  badge: THREE.Sprite;
}

function plotPosition(id: number): THREE.Vector3 {
  const column = id % PLOT_COLUMNS;
  const row = Math.floor(id / PLOT_COLUMNS);
  return new THREE.Vector3(
    (column - 1) * (PLOT_SIZE + PLOT_GAP),
    0,
    1.6 + row * (PLOT_SIZE + PLOT_GAP)
  );
}

export function createFarmScene(
  container: HTMLElement,
  onPlotSelected: (plotId: number) => void
): FarmScene {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch {
    container.textContent = "3D rendering is unavailable in this browser.";
    return { setGameState: () => undefined, resize: () => undefined, dispose: () => undefined };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = makeSkyTexture();
  scene.fog = new THREE.Fog(0xc3e7f8, 46, 95);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 220);
  camera.position.set(2.5, 12.5, 16.5);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(-0.5, 0.6, 0.5);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 8;
  controls.maxDistance = 32;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = 1.32;
  controls.update();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x40623a, 1.0));

  const sun = new THREE.DirectionalLight(0xfff2cc, 2.4);
  sun.position.set(14, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  sun.shadow.camera.left = -26;
  sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -26;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  buildGround(scene);
  buildFence(scene);
  buildBarn(scene);
  buildTrees(scene);
  buildDecor(scene);
  const clouds = buildClouds(scene);

  const plotVisuals: Array<{
    id: number;
    hitMesh: THREE.Mesh;
    ripeRing: THREE.Mesh;
    dryBadge: THREE.Sprite;
    ripeBadge: THREE.Sprite;
    crop: CropVisual | null;
  }> = [];

  const soilMaterial = standard(0x6b4423);
  const soilTopMaterial = standard(0x8a5a35);
  const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

  for (let id = 0; id < PLOT_COUNT; id += 1) {
    const position = plotPosition(id);
    const plotGroup = new THREE.Group();
    plotGroup.position.copy(position);

    const base = new THREE.Mesh(new THREE.BoxGeometry(PLOT_SIZE, 0.4, PLOT_SIZE), soilMaterial);
    base.position.y = 0.2;
    base.castShadow = true;
    base.receiveShadow = true;

    const top = new THREE.Mesh(
      new THREE.BoxGeometry(PLOT_SIZE * 0.92, 0.14, PLOT_SIZE * 0.92),
      soilTopMaterial
    );
    top.position.y = 0.45;
    top.receiveShadow = true;

    const hitMesh = new THREE.Mesh(new THREE.BoxGeometry(PLOT_SIZE, 0.9, PLOT_SIZE), hitMaterial);
    hitMesh.position.y = 0.45;
    hitMesh.userData.plotId = id;

    const ripeRing = new THREE.Mesh(
      new THREE.TorusGeometry(PLOT_SIZE * 0.46, 0.07, 8, 40),
      new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0x8a5f00, emissiveIntensity: 0.6 })
    );
    ripeRing.rotation.x = -Math.PI / 2;
    ripeRing.position.y = 0.55;
    ripeRing.visible = false;

    const dryBadge = makeLabelSprite("💧");
    dryBadge.position.y = 1.5;
    dryBadge.visible = false;

    const ripeBadge = makeLabelSprite("✅");
    ripeBadge.position.y = 1.9;
    ripeBadge.visible = false;

    plotGroup.add(base, top, hitMesh, ripeRing, dryBadge, ripeBadge);
    scene.add(plotGroup);

    plotVisuals.push({ id, hitMesh, ripeRing, dryBadge, ripeBadge, crop: null });
  }

  const hoverRing = new THREE.Mesh(
    new THREE.TorusGeometry(PLOT_SIZE * 0.62, 0.05, 8, 44),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
  );
  hoverRing.rotation.x = -Math.PI / 2;
  hoverRing.visible = false;
  scene.add(hoverRing);

  const animalVisuals = new Map<number, AnimalVisual>();
  const animalSlots = [-4.8, -1.6, 1.6, 4.8].map((x) => new THREE.Vector3(x, 0, -8.2));

  function updateCrops(state: GameState): void {
    for (const visual of plotVisuals) {
      const plot = state.plots.find((candidate) => candidate.id === visual.id);
      if (!plot) {
        continue;
      }
      const stage = getCropStage(plot);
      visual.ripeRing.visible = stage === "ripe";
      visual.dryBadge.visible = stage === "dry";
      visual.ripeBadge.visible = stage === "ripe";

      if (!plot.crop) {
        if (visual.crop) {
          visual.crop.group.removeFromParent();
          visual.crop = null;
        }
        continue;
      }

      const progress = getCropProgress(plot);
      const signature = `${plot.crop.species}:${stage}:${Math.round(progress * 8)}`;
      if (visual.crop?.signature === signature) {
        continue;
      }
      visual.crop?.group.removeFromParent();
      const group = buildCrop(plot.crop.species, stage === "empty" ? "dry" : stage, progress);
      const position = plotPosition(visual.id);
      group.position.set(position.x, 0.5, position.z);
      scene.add(group);
      visual.crop = { group, signature };
    }
  }

  function updateAnimals(state: GameState): void {
    const activeIds = new Set(state.animals.map((animal) => animal.id));
    for (const [id, visual] of animalVisuals) {
      if (!activeIds.has(id)) {
        visual.group.removeFromParent();
        animalVisuals.delete(id);
      }
    }

    state.animals.forEach((animal, index) => {
      const slot = animalSlots[index] ?? animalSlots[animalSlots.length - 1];
      if (!slot) {
        return;
      }
      let visual = animalVisuals.get(animal.id);
      if (!visual || visual.species !== animal.species) {
        visual?.group.removeFromParent();
        const group = buildAnimal(animal.species);
        const badge = makeLabelSprite("❤️");
        badge.position.y = 2.4;
        badge.visible = false;
        group.add(badge);
        group.position.set(slot.x, 0, slot.z);
        group.rotation.y = Math.PI;
        scene.add(group);
        visual = { group, species: animal.species, phase: Math.random() * Math.PI * 2, badge };
        animalVisuals.set(animal.id, visual);
      }

      visual.group.position.x = slot.x;
      visual.group.position.z = slot.z;

      const badgeText =
        animal.kind === "livestock"
          ? animal.productReady
            ? "🥛"
            : animal.hunger <= 25
              ? "❗"
              : null
          : animal.happiness >= 60
            ? "❤️"
            : "💤";

      if (badgeText === null) {
        visual.badge.visible = false;
      } else if (visual.badge.userData.text !== badgeText) {
        const replacement = makeLabelSprite(badgeText);
        visual.badge.material.map?.dispose();
        visual.badge.material.map = replacement.material.map;
        visual.badge.material.needsUpdate = true;
        visual.badge.userData.text = badgeText;
        visual.badge.visible = true;
      }
    });
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hitMeshes = plotVisuals.map((visual) => visual.hitMesh);
  let pointerDownAt: { x: number; y: number } | null = null;

  function updatePointer(event: PointerEvent): void {
    const bounds = container.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  }

  function pickPlot(): number | null {
    raycaster.setFromCamera(pointer, camera);
    const intersection = raycaster.intersectObjects(hitMeshes, false)[0];
    const plotId = intersection?.object.userData.plotId;
    return typeof plotId === "number" ? plotId : null;
  }

  const handlePointerDown = (event: PointerEvent): void => {
    pointerDownAt = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: PointerEvent): void => {
    if (!pointerDownAt) {
      return;
    }
    const distance = Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y);
    pointerDownAt = null;
    if (distance > 6) {
      return;
    }
    updatePointer(event);
    const plotId = pickPlot();
    if (plotId !== null) {
      onPlotSelected(plotId);
    }
  };

  const handlePointerMove = (event: PointerEvent): void => {
    updatePointer(event);
    const plotId = pickPlot();
    if (plotId === null) {
      hoverRing.visible = false;
      renderer.domElement.style.cursor = "grab";
      return;
    }
    const position = plotPosition(plotId);
    hoverRing.position.set(position.x, 0.56, position.z);
    hoverRing.visible = true;
    renderer.domElement.style.cursor = "pointer";
  };

  const handlePointerLeave = (): void => {
    hoverRing.visible = false;
  };

  renderer.domElement.addEventListener("pointerdown", handlePointerDown);
  renderer.domElement.addEventListener("pointerup", handlePointerUp);
  renderer.domElement.addEventListener("pointermove", handlePointerMove);
  renderer.domElement.addEventListener("pointerleave", handlePointerLeave);

  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(container);

  function resize(): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  let animationFrame = 0;
  const timer = new THREE.Timer();
  timer.connect(document);

  function animate(timestamp?: number): void {
    animationFrame = window.requestAnimationFrame(animate);
    timer.update(timestamp);
    const elapsed = timer.getElapsed();

    for (const cloud of clouds) {
      cloud.position.x += 0.012;
      if (cloud.position.x > 26) {
        cloud.position.x = -26;
      }
    }

    for (const visual of animalVisuals.values()) {
      visual.group.position.y = Math.sin(elapsed * 2 + visual.phase) * 0.06;
      visual.badge.position.y = 2.4 + Math.sin(elapsed * 2.4 + visual.phase) * 0.08;
    }

    controls.update();
    renderer.render(scene, camera);
  }

  function dispose(): void {
    window.cancelAnimationFrame(animationFrame);
    resizeObserver.disconnect();
    renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
    renderer.domElement.removeEventListener("pointerup", handlePointerUp);
    renderer.domElement.removeEventListener("pointermove", handlePointerMove);
    renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
    controls.dispose();
    timer.dispose();
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
        object.geometry?.dispose();
        const material = object.material;
        if (Array.isArray(material)) {
          material.forEach((entry) => entry.dispose());
        } else {
          material.dispose();
        }
      }
    });
    renderer.dispose();
    renderer.domElement.remove();
  }

  resize();
  animate();

  return {
    setGameState: (state: GameState) => {
      updateCrops(state);
      updateAnimals(state);
    },
    resize,
    dispose
  };
}
