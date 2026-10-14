import * as THREE from 'three';
import type { FrameActor, FrameModel, RenderViewOptions, Vec3 } from '../contracts';
import { cameraBasis } from '../core/geometry';

type SegmentName = 'upperArmL' | 'lowerArmL' | 'upperArmR' | 'lowerArmR' | 'thighL' | 'shinL' | 'thighR' | 'shinR';
interface ActorRig {
  root: THREE.Group;
  torso: THREE.Mesh;
  pelvis: THREE.Mesh;
  head: THREE.Mesh;
  nose: THREE.Mesh;
  neck: THREE.Mesh;
  shoulders: [THREE.Mesh, THREE.Mesh];
  joints: THREE.Mesh[];
  faceDetails: THREE.Mesh[];
  segments: Record<SegmentName, THREE.Mesh>;
  hands: [THREE.Mesh, THREE.Mesh];
  feet: [THREE.Mesh, THREE.Mesh];
}

export interface ThreeViewport {
  renderView(frame: FrameModel, options: RenderViewOptions, dpr?: number): void;
  pickActor(xCssPx: number, yCssPx: number): FrameActor['id'] | null;
  captureFrame(frame: FrameModel, widthPx: number, heightPx: number): Promise<Blob>;
  dispose(): void;
}

const VERTICAL_AXIS = new THREE.Vector3(0, 1, 0);
const sceneNames = ['studio', 'interior', 'street'] as const;

export function createThreeViewport(canvas: HTMLCanvasElement): ThreeViewport {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x71777e);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#747982');
  const camera = new THREE.PerspectiveCamera(34, 2.39, 0.04, 150);
  const editorCamera = new THREE.PerspectiveCamera(38, 1.6, .08, 150); editorCamera.position.set(6.8, 5.5, 8.5); editorCamera.lookAt(0, .9, -1.2);
  const hemisphere = new THREE.HemisphereLight(0xdce9ff, 0x4d4a45, 2.1); scene.add(hemisphere);
  const key = new THREE.DirectionalLight(0xffedda, 3.5); key.position.set(-3.8, 6.2, -3.2); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -9; key.shadow.camera.right = 9; key.shadow.camera.top = 9; key.shadow.camera.bottom = -9; key.shadow.bias = -0.0002; scene.add(key);
  const fill = new THREE.DirectionalLight(0xc8dcff, 1.1); fill.position.set(4, 3.5, -1); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffd29f, 2.1); rim.position.set(0.5, 4.3, 5.5); scene.add(rim);
  const locationGroups = new Map<string, THREE.Group>();
  // Presets are authored with the backdrop on +Z. Turn each complete set toward
  // the default camera, which sits at +Z and looks toward the actor at the origin.
  for (const id of sceneNames) { const group = buildLocation(id); group.rotation.y = Math.PI; group.visible = id === 'studio'; locationGroups.set(id, group); scene.add(group); }
  const actorRigs = new Map<string, ActorRig>();
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const cameraMarker = buildCameraMarker(); scene.add(cameraMarker);
  const selectionRing = new THREE.Mesh(new THREE.RingGeometry(.28, .32, 40), new THREE.MeshBasicMaterial({ color: '#e9b65c', side: THREE.DoubleSide, depthWrite: false })); selectionRing.rotation.x = -Math.PI / 2; selectionRing.position.y = .012; selectionRing.visible = false; scene.add(selectionRing);
  const cameraLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#cce2ff', transparent: true, opacity: 0.7 })); scene.add(cameraLine);
  updateCameraMarkerGeometry(cameraLine);
  const orbitTarget = new THREE.Vector3(0, .9, -1.2);
  const orbitOffset = editorCamera.position.clone().sub(orbitTarget);
  let orbitRadius = orbitOffset.length(); let orbitTheta = Math.atan2(orbitOffset.x, orbitOffset.z); let orbitPhi = Math.acos(orbitOffset.y / orbitRadius);
  let orbitDrag: { pointerId: number; x: number; y: number } | null = null;
  let lastPixelRatio = 0;
  let lastRenderedFrame: FrameModel | null = null;
  const pickActorAt = (xCssPx: number, yCssPx: number): FrameActor['id'] | null => {
    if (!lastRenderedFrame || (lastRenderedFrame.activeView !== 'camera' && lastRenderedFrame.activeView !== 'stage3d')) return null;
    const rect = canvas.getBoundingClientRect(); if (rect.width <= 0 || rect.height <= 0) return null;
    const useEditorCamera = lastRenderedFrame.activeView === 'stage3d'; const viewCamera = useEditorCamera ? editorCamera : camera;
    const outputAspect = lastRenderedFrame.gate.widthMm * lastRenderedFrame.squeeze / lastRenderedFrame.gate.heightMm;
    if (!useEditorCamera) {
      const width = Math.min(rect.width, rect.height * outputAspect); const height = Math.min(rect.height, rect.width / outputAspect);
      const x = (xCssPx - (rect.width - width) / 2) / width; const y = (yCssPx - (rect.height - height) / 2) / height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return null;
      pointerNdc.set(x * 2 - 1, 1 - y * 2);
    } else pointerNdc.set(xCssPx / rect.width * 2 - 1, 1 - yCssPx / rect.height * 2);
    raycaster.setFromCamera(pointerNdc, viewCamera);
    const intersections = raycaster.intersectObjects([...actorRigs.values()].filter(rig => rig.root.visible).map(rig => rig.root), true);
    return intersections[0]?.object ? findActorRootId(intersections[0].object) : null;
  };

  const onOrbitDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !event.isPrimary) return;
    const rect = canvas.getBoundingClientRect();
    if (lastRenderedFrame?.activeView === 'stage3d' && pickActorAt(event.clientX - rect.left, event.clientY - rect.top)) return;
    orbitDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    try { canvas.setPointerCapture(event.pointerId); } catch { orbitDrag = null; }
  };
  const onOrbitMove = (event: PointerEvent): void => {
    if (!orbitDrag || orbitDrag.pointerId !== event.pointerId) return;
    const dx = event.clientX - orbitDrag.x; const dy = event.clientY - orbitDrag.y; orbitDrag.x = event.clientX; orbitDrag.y = event.clientY;
    orbitTheta -= dx * .008; orbitPhi = THREE.MathUtils.clamp(orbitPhi + dy * .008, .12, Math.PI - .12);
    editorCamera.position.set(orbitTarget.x + orbitRadius * Math.sin(orbitPhi) * Math.sin(orbitTheta), orbitTarget.y + orbitRadius * Math.cos(orbitPhi), orbitTarget.z + orbitRadius * Math.sin(orbitPhi) * Math.cos(orbitTheta)); editorCamera.lookAt(orbitTarget);
    canvas.dispatchEvent(new CustomEvent('cineoptics:invalidate'));
  };
  const onOrbitEnd = (event: PointerEvent): void => { if (orbitDrag?.pointerId === event.pointerId) { orbitDrag = null; try { canvas.releasePointerCapture(event.pointerId); } catch { /* Capture can already be released. */ } } };
  const onEditorZoom = (event: WheelEvent): void => {
    if (lastRenderedFrame?.activeView !== 'stage3d') return;
    event.preventDefault(); orbitRadius = THREE.MathUtils.clamp(orbitRadius * (event.deltaY > 0 ? 1.08 : .92), 2.5, 35);
    editorCamera.position.set(orbitTarget.x + orbitRadius * Math.sin(orbitPhi) * Math.sin(orbitTheta), orbitTarget.y + orbitRadius * Math.cos(orbitPhi), orbitTarget.z + orbitRadius * Math.sin(orbitPhi) * Math.cos(orbitTheta)); editorCamera.lookAt(orbitTarget); canvas.dispatchEvent(new CustomEvent('cineoptics:invalidate'));
  };
  canvas.addEventListener('pointerdown', onOrbitDown); canvas.addEventListener('pointermove', onOrbitMove); canvas.addEventListener('pointerup', onOrbitEnd); canvas.addEventListener('pointercancel', onOrbitEnd); canvas.addEventListener('lostpointercapture', onOrbitEnd); canvas.addEventListener('wheel', onEditorZoom, { passive: false });

  const resize = (dpr = window.devicePixelRatio || 1): void => {
    const pixelRatio = Math.max(1, Math.min(1.5, dpr));
    if (pixelRatio !== lastPixelRatio) { renderer.setPixelRatio(pixelRatio); lastPixelRatio = pixelRatio; }
    const width = Math.max(1, canvas.clientWidth); const height = Math.max(1, canvas.clientHeight);
    if (canvas.width !== Math.round(width * pixelRatio) || canvas.height !== Math.round(height * pixelRatio)) renderer.setSize(width, height, false);
  };

  const renderView = (frame: FrameModel, options: RenderViewOptions, dpr?: number): void => {
    if (frame.activeView !== 'camera' && frame.activeView !== 'stage3d') return;
    lastRenderedFrame = frame;
    resize(dpr);
    configureFrameCamera(frame, camera);
    for (const [id, group] of locationGroups) group.visible = id === frame.locationId;
    syncActors(frame.actors, actorRigs, scene);
    cameraMarker.visible = frame.activeView === 'stage3d';
    cameraLine.visible = frame.activeView === 'stage3d';
    if (frame.activeView === 'stage3d') updateCameraMarker(frame, cameraMarker, cameraLine);
    const selected = options.selectedActorId ? frame.actors.find(actor => actor.id === options.selectedActorId) : undefined;
    selectionRing.visible = frame.activeView === 'stage3d' && !!selected;
    if (selected) selectionRing.position.set(selected.positionM.x, .012, selected.positionM.z);
    renderer.toneMappingExposure = 1.15 * 2 ** -Math.max(0, Math.min(16, frame.look.ndStops));
    scene.background = new THREE.Color(frame.activeView === 'camera' ? '#777e86' : '#26292e');
    // WebGLRenderer.setViewport/setScissor accept logical pixels and apply DPR internally.
    const fullWidth = Math.max(1, canvas.clientWidth); const fullHeight = Math.max(1, canvas.clientHeight);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, fullWidth, fullHeight); renderer.setClearColor(scene.background, 1); renderer.clear(true, true, true);
    const activeCamera = frame.activeView === 'camera' ? camera : editorCamera;
    let frameWidth = fullWidth; let frameHeight = fullHeight; let left = 0; let bottom = 0;
    if (frame.activeView === 'camera') {
      const outputAspect = frame.gate.widthMm * frame.squeeze / frame.gate.heightMm;
      frameWidth = Math.min(fullWidth, fullHeight * outputAspect); frameHeight = Math.min(fullHeight, fullWidth / outputAspect);
      left = (fullWidth - frameWidth) / 2; bottom = (fullHeight - frameHeight) / 2;
    } else { editorCamera.aspect = fullWidth / fullHeight; editorCamera.updateProjectionMatrix(); }
    renderer.setViewport(left, bottom, frameWidth, frameHeight); renderer.setScissor(left, bottom, frameWidth, frameHeight); renderer.setScissorTest(true);
    renderer.render(scene, activeCamera);
    renderer.setScissorTest(false);
    void options;
  };

  return {
    renderView,
    pickActor: pickActorAt,
    async captureFrame(frame, widthPx, heightPx) {
      if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx) || widthPx < 1 || heightPx < 1) throw new RangeError('Resolución de captura inválida.');
      const previousWidth = canvas.width; const previousHeight = canvas.height;
      const previousExposure = renderer.toneMappingExposure;
      try {
        canvas.width = Math.round(widthPx); canvas.height = Math.round(heightPx);
        renderer.setPixelRatio(1); renderer.setSize(widthPx, heightPx, false);
        configureFrameCamera({ ...frame, activeView: 'camera' }, camera);
        for (const [id, group] of locationGroups) group.visible = id === frame.locationId;
        syncActors(frame.actors, actorRigs, scene);
        renderer.toneMappingExposure = 1.15 * 2 ** -Math.max(0, Math.min(16, frame.look.ndStops)); scene.background = new THREE.Color('#777e86'); renderer.setClearColor(scene.background, 1); renderer.setViewport(0, 0, widthPx, heightPx); renderer.setScissorTest(false); renderer.render(scene, camera);
        return await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('No se pudo exportar el frame WebGL.')), 'image/png'));
      } finally {
        canvas.width = previousWidth; canvas.height = previousHeight; renderer.toneMappingExposure = previousExposure; lastPixelRatio = 0; resize();
      }
    },
    dispose() {
      canvas.removeEventListener('pointerdown', onOrbitDown); canvas.removeEventListener('pointermove', onOrbitMove); canvas.removeEventListener('pointerup', onOrbitEnd); canvas.removeEventListener('pointercancel', onOrbitEnd); canvas.removeEventListener('lostpointercapture', onOrbitEnd); canvas.removeEventListener('wheel', onEditorZoom);
      for (const rig of actorRigs.values()) disposeRig(rig);
      actorRigs.clear(); renderer.dispose();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.dispose();
        }
      });
    },
  };
}

export function configureFrameCamera(frame: FrameModel, camera: THREE.PerspectiveCamera): void {
  const fov = frame.metrics.fieldOfView.verticalDeg;
  camera.fov = fov; camera.aspect = frame.gate.widthMm * frame.squeeze / frame.gate.heightMm; camera.updateProjectionMatrix();
  // Match projectPoint's existing image-plane squeeze convention exactly. Three's symmetric
  // perspective uses one aspect multiplier; the project core applies squeeze in image X.
  camera.projectionMatrix.elements[0]! *= frame.squeeze * frame.squeeze;
  camera.projectionMatrix.elements[5]! *= -1;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  const p = frame.camera.positionM; camera.position.set(p.x, p.y, p.z);
  const basis = cameraBasis(frame.camera.yawDeg, frame.camera.pitchDeg, frame.camera.rollDeg);
  camera.up.set(-basis.up.x, -basis.up.y, -basis.up.z);
  camera.lookAt(p.x + basis.forward.x, p.y + basis.forward.y, p.z + basis.forward.z);
  camera.updateMatrixWorld(true);
}

function buildLocation(id: typeof sceneNames[number]): THREE.Group {
  const group = new THREE.Group(); group.name = `location:${id}`;
  const mat = (color: string, roughness = 0.82, metalness = 0): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const concrete = mat('#74777c'); const floor = mat(id === 'street' ? '#45484d' : '#656970'); const trim = mat('#aaa8a2', 0.68); const dark = mat('#333840'); const wood = mat('#856e53'); const glass = new THREE.MeshStandardMaterial({ color: '#9ab9cc', roughness: 0.28, metalness: 0.18, emissive: '#263c4b', emissiveIntensity: 0.24 });
  const addBox = (name: string, size: [number, number, number], position: [number, number, number], material: THREE.Material, shadows = true): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material); mesh.name = name; mesh.position.set(...position); mesh.castShadow = shadows; mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  const addPlane = (name: string, size: [number, number], position: [number, number, number], rotationX: number, material: THREE.Material): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), material); mesh.name = name; mesh.position.set(...position); mesh.rotation.x = rotationX; mesh.receiveShadow = true; group.add(mesh); return mesh;
  };

  if (id === 'studio') {
    const studioFloor = mat('#777a7f'); addPlane('studio-floor-12m', [12, 12], [0, 0, 2], -Math.PI / 2, studioFloor);
    // Continuous cyclorama curve: floor rises gently into the rear wall rather than meeting at a hard corner.
    const vertices: number[] = []; const indices: number[] = [];
    const width = 12; const segments = 24; const curveDepth = 3.2; const curveHeight = 3.4;
    for (let i = 0; i <= segments; i++) { const t = i / segments; const theta = t * Math.PI / 2; const z = 4.2 + curveDepth * Math.sin(theta); const y = curveHeight * (1 - Math.cos(theta));
      vertices.push(-width / 2, y, z, width / 2, y, z);
      if (i < segments) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const cycloramaGeometry = new THREE.BufferGeometry(); cycloramaGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); cycloramaGeometry.setIndex(indices); cycloramaGeometry.computeVertexNormals();
    const cyc = new THREE.Mesh(cycloramaGeometry, new THREE.MeshBasicMaterial({ color: '#737980', side: THREE.DoubleSide })); cyc.name = 'seamless-cyclorama'; cyc.receiveShadow = true; group.add(cyc);
    for (let x = -5; x <= 5; x += 1) { const line = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 10), mat('#909397')); line.position.set(x, 0.004, 0); group.add(line); }
    addBox('scale-cube-1m', [0.22, 1, 0.22], [-4.8, .5, -1], trim);
    addBox('softbox-key', [1.3, .06, .65], [-2.4, 4.4, -1.4], mat('#fff0d3', .45, .05));
    addBox('softbox-fill', [1.1, .06, .55], [2.5, 3.6, -0.3], mat('#d8e7ff', .45, .05));
  } else if (id === 'interior') {
    addPlane('interior-floor-8x6', [8, 6], [0, 0, 1], -Math.PI / 2, mat('#756f67'));
    addBox('back-wall', [8, 3, .16], [0, 1.5, 4], concrete);
    addBox('left-wall', [.16, 3, 6], [-4, 1.5, 1], mat('#77766e'));
    addBox('right-wall-return', [.16, 3, 2.2], [4, 1.5, 2.9], mat('#77766e'));
    addBox('window-glass', [2.1, 1.4, .04], [-2, 1.95, 3.88], glass, false);
    addBox('window-top', [2.3, .09, .12], [-2, 2.72, 3.9], trim); addBox('window-sill', [2.3, .1, .2], [-2, 1.17, 3.86], trim);
    addBox('window-mullion', [.07, 1.5, .1], [-2, 1.96, 3.87], trim);
    addBox('door', [.95, 2.15, .08], [3.45, 1.08, 3.87], wood); addBox('door-handle', [.05, .05, .07], [3.15, 1.04, 3.79], trim);
    addBox('dialog-tabletop-0.75m', [1.5, .08, .85], [0, .75, .2], wood);
    for (const x of [-.65, .65]) for (const z of [-.12, .5]) addBox('table-leg', [.07, .71, .07], [x, .355, z], dark);
    for (const x of [-1.45, 1.45]) { addBox('chair-seat', [.52, .1, .52], [x, .47, .15], mat('#7e8587')); addBox('chair-back', [.52, .74, .08], [x, .84, .41], mat('#686f73')); for (const z of [-.05, .36]) addBox('chair-leg', [.055, .45, .055], [x, .22, z], dark); }
    const practical = new THREE.PointLight('#ffc988', 55, 5); practical.position.set(1.2, 2.45, .2); group.add(practical);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(.24, .28, 24, 1, true), mat('#82765f', .6)); shade.position.set(1.2, 2.42, .2); shade.rotation.x = Math.PI; group.add(shade);
  } else {
    addPlane('street-road', [10, 16], [0, -.04, -1], -Math.PI / 2, floor);
    addPlane('sidewalk', [3.1, 16], [-5.8, 0, -1], -Math.PI / 2, mat('#a2a19b'));
    addPlane('curb', [.24, 16], [-4.25, .07, -1], -Math.PI / 2, trim);
    const lanePaint = mat('#c8c4b6', .72);
    for (const z of [1, 3, 5, 7]) addBox('painted-road-dash', [.12, .009, .85], [0, .006, z], lanePaint, false);
    for (const [x, z, shade] of [[-7.2, 2.8, '#8c8580'], [0.4, 4.3, '#787d81'], [7, 5.8, '#9b978e']] as const) {
      addBox('street-facade', [4.2, 5.2, 1.5], [x, 2.6, z], mat(shade));
      for (const y of [1.2, 2.7, 4.2]) for (const offset of [-1.25, .15, 1.45]) addBox('facade-window', [.76, .88, .035], [x + offset, y, z - .78], glass, false);
      const storefrontX = Math.abs(x - .4) < .01 ? x + 1.8 : x;
      addBox('storefront', [1.8, 1.8, .1], [storefrontX, .9, z - .8], wood);
    }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.045, .075, 4.2, 12), dark); pole.position.set(-2.1, 2.1, -.6); pole.castShadow = true; group.add(pole);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .95, 10), dark); arm.rotation.z = Math.PI / 2; arm.position.set(-1.65, 4.05, -.6); group.add(arm);
    const lamp = new THREE.PointLight('#f3e2c3', 18, 6); lamp.position.set(-1.25, 3.95, -.6); group.add(lamp);
    addBox('foreground-wall', [1.2, 2, .45], [-2.2, 1, -3.2], mat('#575b60'));
  }
  return group;
}

function syncActors(actors: FrameActor[], rigs: Map<string, ActorRig>, scene: THREE.Scene): void {
  const active = new Set<string>(actors.map(actor => actor.id));
  for (const [id, rig] of rigs) if (!active.has(id)) rig.root.visible = false;
  actors.forEach((actor, index) => {
    let rig = rigs.get(actor.id);
    if (!rig) { rig = createRig(actor, index); rigs.set(actor.id, rig); scene.add(rig.root); }
    rig.root.visible = true; poseRig(rig, actor);
  });
}

function createRig(actor: FrameActor, index: number): ActorRig {
  const root = new THREE.Group(); root.name = `actor:${actor.id}`; root.userData.actorId = actor.id;
  const clothing = new THREE.MeshStandardMaterial({ color: actor.color, roughness: .88 });
  const darkClothing = new THREE.MeshStandardMaterial({ color: new THREE.Color(actor.color).multiplyScalar(.66), roughness: .92 });
  const skinTone = ['#c99472', '#a96f52', '#dbad88'][index % 3]!;
  const skin = new THREE.MeshStandardMaterial({ color: skinTone, roughness: .92 });
  const hair = new THREE.MeshStandardMaterial({ color: ['#292522', '#4d3729', '#383a3e'][index % 3]!, roughness: .95 });
  const sphere = (name: string, material: THREE.Material, scale: Vec3): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 16), material); mesh.name = name; mesh.scale.set(scale.x, scale.y, scale.z); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  const torsoProfile = [new THREE.Vector2(0, -.215), new THREE.Vector2(.12, -.21), new THREE.Vector2(.145, -.16), new THREE.Vector2(.135, -.06), new THREE.Vector2(.16, .07), new THREE.Vector2(.215, .16), new THREE.Vector2(.20, .195), new THREE.Vector2(.13, .215), new THREE.Vector2(0, .215)];
  const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoProfile, 24), clothing); torso.name = 'soft-tailored-torso'; torso.castShadow = true; torso.receiveShadow = true; root.add(torso);
  const pelvis = sphere('pelvis', darkClothing, { x: .14, y: .115, z: .125 });
  const head = sphere('head', skin, { x: .105, y: .135, z: .102 });
  const nose = sphere('nose', skin, { x: .025, y: .029, z: .04 });
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.052, .064, .095, 16), skin); neck.name = 'neck'; neck.castShadow = true; root.add(neck);
  const shoulders: [THREE.Mesh, THREE.Mesh] = [sphere('shoulder-left', clothing, { x: .078, y: .082, z: .086 }), sphere('shoulder-right', clothing, { x: .078, y: .082, z: .086 })];
  const hairCap = sphere('hair-volume', hair, { x: .108, y: .061, z: .105 }); hairCap.name = 'hair-volume';
  const eyeWhite = new THREE.MeshStandardMaterial({ color: '#f1e8dc', roughness: .78 }); const iris = new THREE.MeshStandardMaterial({ color: '#493b2e', roughness: .7 });
  const faceDetails: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = sphere(`eye-${side}`, eyeWhite, { x: .019, y: .012, z: .009 }); eye.position.set(side * .037, 0, .093); faceDetails.push(eye);
    const pupil = sphere(`iris-${side}`, iris, { x: .006, y: .008, z: .004 }); pupil.position.set(side * .037, 0, .102); faceDetails.push(pupil);
    const eyebrow = sphere(`brow-${side}`, hair, { x: .021, y: .006, z: .006 }); eyebrow.position.set(side * .038, 0, .09); faceDetails.push(eyebrow);
    const ear = sphere(`ear-${side}`, skin, { x: .022, y: .035, z: .027 }); ear.position.set(side * .102, 0, 0); faceDetails.push(ear);
  }
  const mouth = sphere('mouth', hair, { x: .025, y: .006, z: .004 }); faceDetails.push(mouth);
  const joints: THREE.Mesh[] = [];
  const addJoint = (material: THREE.Material, size: number): THREE.Mesh => { const joint = sphere(`joint-${joints.length}`, material, { x: size, y: size, z: size }); joints.push(joint); return joint; };
  for (let i = 0; i < 6; i++) addJoint(skin, i < 2 ? .066 : .052);
  const segment = (name: string, material: THREE.Material, radius: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * .84, radius, 1, 14, 1, false), material); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  const segments: Record<SegmentName, THREE.Mesh> = {
    upperArmL: segment('upper-arm-left', clothing, .062), lowerArmL: segment('forearm-left', clothing, .049),
    upperArmR: segment('upper-arm-right', clothing, .062), lowerArmR: segment('forearm-right', clothing, .049),
    thighL: segment('thigh-left', darkClothing, .085), shinL: segment('shin-left', darkClothing, .058),
    thighR: segment('thigh-right', darkClothing, .085), shinR: segment('shin-right', darkClothing, .058),
  };
  const hands: [THREE.Mesh, THREE.Mesh] = [sphere('hand-left', skin, { x: .045, y: .055, z: .033 }), sphere('hand-right', skin, { x: .045, y: .055, z: .033 })];
  const shoes = new THREE.MeshStandardMaterial({ color: '#383b40', roughness: .82 });
  const feet: [THREE.Mesh, THREE.Mesh] = [sphere('foot-left', shoes, { x: .075, y: .045, z: .13 }), sphere('foot-right', shoes, { x: .075, y: .045, z: .13 })];
  return { root, torso, pelvis, head, nose, neck, shoulders, joints, faceDetails, segments, hands, feet };
}

function poseRig(rig: ActorRig, actor: FrameActor): void {
  const h = actor.heightM / 1.76; const root = rig.root; root.position.set(actor.positionM.x, actor.positionM.y, actor.positionM.z); root.rotation.y = actor.yawDeg * Math.PI / 180;
  // Rig proportions are authored in normalized stance units (about 1.04 units tall).
  // Scale vertically to the actor's real metre height while preserving adult width/depth.
  const verticalScale = actor.heightM / 1.04; root.scale.set(h, verticalScale, h);
  rig.torso.scale.y = 1 / verticalScale; rig.pelvis.scale.y = .115 / verticalScale; rig.head.scale.y = .135 / verticalScale; rig.nose.scale.y = .029 / verticalScale; rig.neck.scale.y = .095 / verticalScale;
  rig.joints.forEach((joint, index) => { joint.scale.y = (index < 2 ? .066 : .052) / verticalScale; });
  rig.hands.forEach(hand => { hand.scale.y = .055 / verticalScale; }); rig.feet.forEach(foot => { foot.scale.y = .045 / verticalScale; });
  const hair = rig.root.children.find(child => child.name === 'hair-volume') as THREE.Mesh | undefined; if (hair) hair.scale.y = .061 / verticalScale;
  rig.faceDetails.forEach(mesh => {
    const baseY = mesh.name.startsWith('eye-') ? .012 : mesh.name.startsWith('iris-') ? .008 : mesh.name.startsWith('brow-') ? .006 : mesh.name.startsWith('ear-') ? .035 : .006;
    mesh.scale.y = baseY / verticalScale;
  });
  const sitting = actor.pose === 'sitting'; const walking = actor.pose === 'walking';
  const pelvisY = sitting ? .28 : .49; const torsoY = sitting ? .50 : .70; const headY = sitting ? .71 : .91;
  rig.pelvis.position.set(0, pelvisY, 0); rig.torso.position.set(0, torsoY, 0);
  rig.head.position.set(0, headY, 0); rig.nose.position.set(0, headY - .005, .1); rig.neck.position.set(0, headY - .15, 0);
  if (hair) hair.position.set(0, headY + .083, -.012);
  rig.faceDetails.forEach(mesh => {
    const side = mesh.name.endsWith('--1') ? -1 : mesh.name.endsWith('-1') ? 1 : 0;
    const x = mesh.name.startsWith('eye-') || mesh.name.startsWith('iris-') || mesh.name.startsWith('brow-') ? side * .037 : mesh.name.startsWith('ear-') ? side * .102 : 0;
    const y = mesh.name.startsWith('eye-') || mesh.name.startsWith('iris-') ? headY + .02 : mesh.name.startsWith('brow-') ? headY + .047 : mesh.name.startsWith('ear-') ? headY - .005 : headY - .025;
    const z = mesh.name.startsWith('iris-') ? .105 : mesh.name.startsWith('eye-') ? .096 : mesh.name.startsWith('brow-') ? .092 : mesh.name.startsWith('ear-') ? 0 : .091;
    mesh.position.set(x, y, z);
  });
  const shoulderY = torsoY + .12; const hipY = pelvisY - .015;
  rig.shoulders[0].position.set(-.19, shoulderY, 0); rig.shoulders[1].position.set(.19, shoulderY, 0);
  const armDrop = sitting ? -.18 : walking ? -.12 : -.31;
  const elbowSwing = walking ? .14 : sitting ? .16 : .025;
  const points = {
    shoulderL: new THREE.Vector3(-.19, shoulderY, 0), shoulderR: new THREE.Vector3(.19, shoulderY, 0),
    elbowL: new THREE.Vector3(-.29, shoulderY + armDrop, (walking ? -.12 : .015)), elbowR: new THREE.Vector3(.29, shoulderY + armDrop, (walking ? .12 : .015)),
    wristL: new THREE.Vector3(-.27, shoulderY + armDrop - elbowSwing, walking ? .13 : .06), wristR: new THREE.Vector3(.27, shoulderY + armDrop + elbowSwing, walking ? -.13 : .06),
    hipL: new THREE.Vector3(-.105, hipY, 0), hipR: new THREE.Vector3(.105, hipY, 0),
  };
  const leg = (side: -1 | 1): { knee: THREE.Vector3; ankle: THREE.Vector3; toe: THREE.Vector3 } => {
    if (sitting) return { knee: new THREE.Vector3(side * .11, .39, -.34), ankle: new THREE.Vector3(side * .11, .095, -.34), toe: new THREE.Vector3(side * .11, .045, -.43) };
    if (walking && side === 1) return { knee: new THREE.Vector3(.12, .31, -.13), ankle: new THREE.Vector3(.13, .055, -.31), toe: new THREE.Vector3(.13, .045, -.41) };
    if (walking && side === -1) return { knee: new THREE.Vector3(-.12, .31, .12), ankle: new THREE.Vector3(-.13, .06, .17), toe: new THREE.Vector3(-.13, .045, .07) };
    return { knee: new THREE.Vector3(side * .11, .27, .015), ankle: new THREE.Vector3(side * .11, .055, 0), toe: new THREE.Vector3(side * .11, .045, -.105) };
  };
  const l = leg(-1), r = leg(1);
  positionSegment(rig.segments.upperArmL, points.shoulderL, points.elbowL); positionSegment(rig.segments.lowerArmL, points.elbowL, points.wristL);
  positionSegment(rig.segments.upperArmR, points.shoulderR, points.elbowR); positionSegment(rig.segments.lowerArmR, points.elbowR, points.wristR);
  positionSegment(rig.segments.thighL, points.hipL, l.knee); positionSegment(rig.segments.shinL, l.knee, l.ankle);
  positionSegment(rig.segments.thighR, points.hipR, r.knee); positionSegment(rig.segments.shinR, r.knee, r.ankle);
  const jointPositions = [points.elbowL, points.elbowR, l.knee, r.knee, l.ankle, r.ankle];
  rig.joints.forEach((joint, index) => joint.position.copy(jointPositions[index]!));
  rig.hands[0].position.copy(points.wristL); rig.hands[1].position.copy(points.wristR);
  rig.feet[0].position.copy(l.toe); rig.feet[1].position.copy(r.toe);
  rig.torso.rotation.x = sitting ? -.04 : walking ? .035 : 0;
}

function positionSegment(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3): void {
  const delta = b.clone().sub(a); const length = delta.length();
  mesh.position.copy(a).addScaledVector(delta, .5); mesh.quaternion.setFromUnitVectors(VERTICAL_AXIS, delta.normalize()); mesh.scale.set(1, length, 1);
}

function buildCameraMarker(): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: '#d9e8fb', roughness: .56, metalness: .18 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(.34, .22, .34), material); body.castShadow = true; group.add(body);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(.09, .13, .26, 18), material); lens.rotation.x = Math.PI / 2; lens.position.z = .27; group.add(lens);
  return group;
}

function updateCameraMarker(frame: FrameModel, marker: THREE.Group, line: THREE.Line): void {
  const p = frame.camera.positionM; marker.position.set(p.x, p.y, p.z); marker.rotation.set(-frame.camera.pitchDeg * Math.PI / 180, frame.camera.yawDeg * Math.PI / 180, frame.camera.rollDeg * Math.PI / 180);
  const basis = cameraBasis(frame.camera.yawDeg, frame.camera.pitchDeg, frame.camera.rollDeg); const dist = 3.5;
  const hw = dist * Math.tan(frame.metrics.fieldOfView.horizontalDeg * Math.PI / 360); const hh = dist * Math.tan(frame.metrics.fieldOfView.verticalDeg * Math.PI / 360);
  const origin = new THREE.Vector3(p.x, p.y, p.z); const forward = new THREE.Vector3(basis.forward.x, basis.forward.y, basis.forward.z); const right = new THREE.Vector3(basis.right.x, basis.right.y, basis.right.z); const up = new THREE.Vector3(basis.up.x, basis.up.y, basis.up.z);
  const c = origin.clone().addScaledVector(forward, dist); const pts = [origin, c.clone().addScaledVector(right, -hw).addScaledVector(up, -hh), c.clone().addScaledVector(right, hw).addScaledVector(up, -hh), c.clone().addScaledVector(right, hw).addScaledVector(up, hh), c.clone().addScaledVector(right, -hw).addScaledVector(up, hh), c.clone().addScaledVector(right, -hw).addScaledVector(up, -hh)];
  const attribute = line.geometry.getAttribute('position') as THREE.BufferAttribute; const values = attribute.array as Float32Array;
  const segments = [[pts[0]!, pts[1]!], [pts[0]!, pts[2]!], [pts[0]!, pts[3]!], [pts[0]!, pts[4]!], [pts[1]!, pts[2]!], [pts[2]!, pts[3]!], [pts[3]!, pts[4]!], [pts[4]!, pts[1]!]];
  segments.forEach(([a, b], index) => { const offset = index * 6; values[offset] = a!.x; values[offset + 1] = a!.y; values[offset + 2] = a!.z; values[offset + 3] = b!.x; values[offset + 4] = b!.y; values[offset + 5] = b!.z; });
  attribute.needsUpdate = true; line.geometry.computeBoundingSphere();
}

function updateCameraMarkerGeometry(line: THREE.Line): void {
  const vertices = new Float32Array(8 * 6); const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3)); line.geometry = geometry;
}

function findActorRootId(object: THREE.Object3D): FrameActor['id'] | null {
  let current: THREE.Object3D | null = object;
  while (current) { if (typeof current.userData.actorId === 'string') return current.userData.actorId as FrameActor['id']; current = current.parent; }
  return null;
}

function disposeRig(rig: ActorRig): void { rig.root.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; for (const material of materials) material.dispose(); } }); }
