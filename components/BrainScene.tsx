"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Html } from "@react-three/drei";
import { Suspense, useMemo, useRef, Component } from "react";
import * as THREE from "three";

const BRAIN_MODEL_URL = "/models/brain.glb";

export type Cursor3D = { x: number; y: number; z: number }; // [0,1]^3 — x=L/R, y=A/P, z=S/I
export type LesionPoint = { x: number; y: number; z: number; size?: number }; // [0,1]^3 + relative size 0..1

function makeXrayMaterial(color = new THREE.Color("#3b82f6"), rimColor = new THREE.Color("#a5f3fc")) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor:    { value: color },
      uRimColor: { value: rimColor },
      uPower:    { value: 2.4 },
      uIntensity:{ value: 1.4 },
      uBase:     { value: 0.08 },
    },
    vertexShader: /* glsl */`
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal  = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3  uColor;
      uniform vec3  uRimColor;
      uniform float uPower;
      uniform float uIntensity;
      uniform float uBase;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float fres = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), uPower);
        vec3 col = mix(uColor * uBase, uRimColor, fres) * uIntensity;
        float a = clamp(fres + uBase, 0.0, 1.0);
        gl_FragColor = vec4(col, a);
      }
    `,
  });
}

function VesselsLayer({ radius }: { radius: number }) {
  const tubes = useMemo(() => {
    // Tighten well inside the brain silhouette (brain isn't a sphere — narrower in L/R, shorter in S/I).
    const s = radius * 0.62;
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).multiplyScalar(s);

    type Tube = { pts: THREE.Vector3[]; thickness: number; closed?: boolean };
    const tubeDefs: Tube[] = [];

    // Main basal ring (Circle of Willis) — slightly thicker
    tubeDefs.push({
      pts: [
        v(-0.26, -0.46, 0.18), v(-0.12, -0.50, 0.30), v(0.12, -0.50, 0.30),
        v(0.26, -0.46, 0.18), v(0.22, -0.50, -0.04), v(0, -0.54, -0.16),
        v(-0.22, -0.50, -0.04),
      ],
      thickness: 0.0085,
      closed: true,
    });

    // Middle cerebral arteries — each with 4 branching offshoots
    const mca = (sign: number): Tube[] => {
      const trunk: Tube = {
        pts: [
          v(sign * 0.26, -0.46, 0.18),
          v(sign * 0.42, -0.30, 0.22),
          v(sign * 0.58, -0.15, 0.18),
          v(sign * 0.72, 0.02, 0.10),
          v(sign * 0.78, 0.18, -0.02),
        ],
        thickness: 0.0075,
      };
      // Sub-branches stemming off trunk
      const subs: Tube[] = [
        { pts: [ v(sign * 0.42, -0.30, 0.22), v(sign * 0.50, -0.18, 0.34), v(sign * 0.55, -0.05, 0.42) ], thickness: 0.0045 },
        { pts: [ v(sign * 0.58, -0.15, 0.18), v(sign * 0.68, -0.05, 0.22), v(sign * 0.74, 0.10, 0.20) ], thickness: 0.0040 },
        { pts: [ v(sign * 0.72, 0.02, 0.10), v(sign * 0.80, 0.10, 0.04), v(sign * 0.85, 0.22, -0.05) ], thickness: 0.0040 },
        { pts: [ v(sign * 0.58, -0.15, 0.18), v(sign * 0.62, -0.20, 0.04), v(sign * 0.65, -0.18, -0.10) ], thickness: 0.0038 },
        { pts: [ v(sign * 0.78, 0.18, -0.02), v(sign * 0.72, 0.32, -0.05), v(sign * 0.62, 0.40, 0.0) ], thickness: 0.0040 },
      ];
      return [trunk, ...subs];
    };
    tubeDefs.push(...mca(-1), ...mca(1));

    // Anterior cerebral artery + branches
    tubeDefs.push({
      pts: [ v(0, -0.50, 0.30), v(-0.04, -0.20, 0.48), v(-0.02, 0.16, 0.52), v(0.02, 0.38, 0.30) ],
      thickness: 0.0070,
    });
    tubeDefs.push({
      pts: [ v(0, -0.50, 0.30), v(0.04, -0.20, 0.48), v(0.02, 0.16, 0.52), v(-0.02, 0.38, 0.30) ],
      thickness: 0.0070,
    });
    tubeDefs.push({ pts: [ v(0, 0.10, 0.50), v(0.10, 0.18, 0.40), v(0.16, 0.22, 0.28) ], thickness: 0.0040 });
    tubeDefs.push({ pts: [ v(0, 0.10, 0.50), v(-0.10, 0.18, 0.40), v(-0.16, 0.22, 0.28) ], thickness: 0.0040 });

    // Posterior cerebral arteries
    tubeDefs.push({
      pts: [ v(-0.10, -0.52, -0.16), v(-0.20, -0.30, -0.38), v(-0.18, 0.02, -0.50), v(-0.10, 0.18, -0.48) ],
      thickness: 0.0065,
    });
    tubeDefs.push({
      pts: [ v(0.10, -0.52, -0.16), v(0.20, -0.30, -0.38), v(0.18, 0.02, -0.50), v(0.10, 0.18, -0.48) ],
      thickness: 0.0065,
    });

    // Basilar + vertebrals (kept above the foramen magnum — inside the mesh)
    tubeDefs.push({ pts: [ v(0, -0.85, -0.20), v(0, -0.70, -0.20), v(0, -0.55, -0.16) ], thickness: 0.0080 });
    tubeDefs.push({ pts: [ v(-0.04, -0.92, -0.12), v(-0.03, -0.88, -0.18), v(0, -0.82, -0.20) ], thickness: 0.0050 });
    tubeDefs.push({ pts: [ v(0.04, -0.92, -0.12), v(0.03, -0.88, -0.18), v(0, -0.82, -0.20) ], thickness: 0.0050 });

    // Capillary-like fine branches scattered over surface (procedural)
    const seed = (n: number) => Math.sin(n * 12.9898) * 43758.5453 % 1;
    for (let i = 0; i < 14; i++) {
      const a = seed(i + 1);
      const b = seed(i + 31);
      const c = seed(i + 71);
      const baseX = (a - 0.5) * 1.6;
      const baseY = -0.20 + (b - 0.5) * 0.6;
      const baseZ = (c - 0.5) * 1.4;
      tubeDefs.push({
        pts: [
          v(baseX * 0.9, baseY, baseZ * 0.9),
          v(baseX * 0.95, baseY + 0.05, baseZ * 0.95),
          v(baseX, baseY + 0.10 + b * 0.06, baseZ),
        ],
        thickness: 0.0028 + Math.abs(seed(i + 9)) * 0.0015,
      });
    }

    return tubeDefs.map((t) => ({
      geom: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(t.pts, t.closed), 80, s * t.thickness, 8, !!t.closed),
      thin: t.thickness < 0.005,
    }));
  }, [radius]);

  return (
    <group>
      {tubes.map((t, i) => (
        <mesh key={i} geometry={t.geom}>
          <meshStandardMaterial
            color={t.thin ? "#f87171" : "#dc2626"}
            emissive={t.thin ? "#7f1d1d" : "#b91c1c"}
            emissiveIntensity={t.thin ? 0.8 : 0.55}
            roughness={0.5}
            metalness={0.1}
          />
        </mesh>
      ))}
    </group>
  );
}

function NervesLayer({ radius }: { radius: number }) {
  const tubes = useMemo(() => {
    const s = radius * 0.62;
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).multiplyScalar(s);

    type Tube = { pts: THREE.Vector3[]; thickness: number };
    const defs: Tube[] = [];

    // CN I — Olfactory tracts (medial frontal base)
    defs.push({ pts: [v(-0.05, -0.32, 0.55), v(-0.05, -0.34, 0.42), v(-0.04, -0.36, 0.30)], thickness: 0.0028 });
    defs.push({ pts: [v(0.05, -0.32, 0.55), v(0.05, -0.34, 0.42), v(0.04, -0.36, 0.30)], thickness: 0.0028 });

    // CN II — Optic nerves crossing at chiasm
    defs.push({ pts: [v(-0.10, -0.34, 0.50), v(-0.06, -0.36, 0.35), v(-0.02, -0.38, 0.22), v(0, -0.40, 0.12)], thickness: 0.0040 });
    defs.push({ pts: [v(0.10, -0.34, 0.50), v(0.06, -0.36, 0.35), v(0.02, -0.38, 0.22), v(0, -0.40, 0.12)], thickness: 0.0040 });
    // Optic tracts continuing from chiasm to LGN
    defs.push({ pts: [v(0, -0.40, 0.12), v(-0.10, -0.42, 0.0), v(-0.18, -0.40, -0.12)], thickness: 0.0035 });
    defs.push({ pts: [v(0, -0.40, 0.12), v(0.10, -0.42, 0.0), v(0.18, -0.40, -0.12)], thickness: 0.0035 });

    // CN III, IV — Oculomotor & trochlear (small, near brainstem top)
    defs.push({ pts: [v(-0.04, -0.50, -0.05), v(-0.10, -0.46, 0.10), v(-0.16, -0.40, 0.18)], thickness: 0.0024 });
    defs.push({ pts: [v(0.04, -0.50, -0.05), v(0.10, -0.46, 0.10), v(0.16, -0.40, 0.18)], thickness: 0.0024 });

    // CN V — Trigeminal (lateral pons fanning out to face)
    defs.push({ pts: [v(-0.05, -0.55, -0.08), v(-0.20, -0.50, 0.0), v(-0.34, -0.42, 0.10), v(-0.42, -0.30, 0.18)], thickness: 0.0042 });
    defs.push({ pts: [v(0.05, -0.55, -0.08), v(0.20, -0.50, 0.0), v(0.34, -0.42, 0.10), v(0.42, -0.30, 0.18)], thickness: 0.0042 });
    // V branches (V1, V2, V3 splay)
    defs.push({ pts: [v(-0.34, -0.42, 0.10), v(-0.45, -0.34, 0.20), v(-0.50, -0.28, 0.28)], thickness: 0.0026 });
    defs.push({ pts: [v(-0.34, -0.42, 0.10), v(-0.46, -0.42, 0.18), v(-0.52, -0.40, 0.24)], thickness: 0.0024 });
    defs.push({ pts: [v(0.34, -0.42, 0.10), v(0.45, -0.34, 0.20), v(0.50, -0.28, 0.28)], thickness: 0.0026 });
    defs.push({ pts: [v(0.34, -0.42, 0.10), v(0.46, -0.42, 0.18), v(0.52, -0.40, 0.24)], thickness: 0.0024 });

    // CN VI — Abducens (very fine)
    defs.push({ pts: [v(-0.04, -0.62, -0.05), v(-0.10, -0.55, 0.05), v(-0.18, -0.46, 0.15)], thickness: 0.0020 });
    defs.push({ pts: [v(0.04, -0.62, -0.05), v(0.10, -0.55, 0.05), v(0.18, -0.46, 0.15)], thickness: 0.0020 });

    // CN VII / VIII — Facial & vestibulocochlear (toward inner ear)
    defs.push({ pts: [v(-0.06, -0.65, -0.10), v(-0.20, -0.62, -0.05), v(-0.36, -0.55, -0.02)], thickness: 0.0034 });
    defs.push({ pts: [v(0.06, -0.65, -0.10), v(0.20, -0.62, -0.05), v(0.36, -0.55, -0.02)], thickness: 0.0034 });

    // CN IX, X, XI — Glossopharyngeal/vagus/accessory cluster (medulla → neck)
    defs.push({ pts: [v(-0.05, -0.78, -0.12), v(-0.15, -0.85, -0.08), v(-0.22, -0.92, -0.05)], thickness: 0.0028 });
    defs.push({ pts: [v(0.05, -0.78, -0.12), v(0.15, -0.85, -0.08), v(0.22, -0.92, -0.05)], thickness: 0.0028 });

    // CN XII — Hypoglossal
    defs.push({ pts: [v(-0.03, -0.82, -0.08), v(-0.08, -0.88, 0.04), v(-0.12, -0.92, 0.12)], thickness: 0.0022 });
    defs.push({ pts: [v(0.03, -0.82, -0.08), v(0.08, -0.88, 0.04), v(0.12, -0.92, 0.12)], thickness: 0.0022 });

    // Brainstem descending stub (kept inside the mesh)
    defs.push({ pts: [v(0, -0.70, -0.20), v(0, -0.85, -0.15), v(0, -0.95, -0.10)], thickness: 0.0070 });

    // Corticospinal tracts (paired, descending through internal capsule)
    defs.push({ pts: [v(-0.12, 0.05, 0.05), v(-0.10, -0.20, -0.02), v(-0.06, -0.45, -0.08), v(-0.04, -0.65, -0.15)], thickness: 0.0035 });
    defs.push({ pts: [v(0.12, 0.05, 0.05), v(0.10, -0.20, -0.02), v(0.06, -0.45, -0.08), v(0.04, -0.65, -0.15)], thickness: 0.0035 });

    return defs.map((d) => ({
      geom: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(d.pts), 64, s * d.thickness, 8, false),
      thick: d.thickness >= 0.0035,
    }));
  }, [radius]);

  return (
    <group>
      {tubes.map((t, i) => (
        <mesh key={i} geometry={t.geom}>
          <meshStandardMaterial
            color={t.thick ? "#facc15" : "#fde68a"}
            emissive={t.thick ? "#ca8a04" : "#a16207"}
            emissiveIntensity={0.8}
            roughness={0.6}
          />
        </mesh>
      ))}
    </group>
  );
}

function BrainModel({ cursor, lesions, showVessels, showNerves, onRadius }: { cursor?: Cursor3D; lesions?: LesionPoint[]; showVessels?: boolean; showNerves?: boolean; onRadius?: (r: number) => void }) {
  const { scene } = useGLTF(BRAIN_MODEL_URL);

  const { fillScene, wireScene, rimScene, boundingRadius } = useMemo(() => {
    const probe = scene.clone(true);
    const box = new THREE.Box3().setFromObject(probe);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2.4 / maxDim;

    const wrap = (model: THREE.Object3D) => {
      const inner = new THREE.Group();
      inner.add(model);
      inner.position.copy(center).negate();
      const outer = new THREE.Group();
      outer.add(inner);
      outer.scale.setScalar(scale);
      return outer;
    };

    const fill = wrap(scene.clone(true));
    fill.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        (o as THREE.Mesh).material = new THREE.MeshPhongMaterial({
          color: new THREE.Color("#0b1e3d"),
          emissive: new THREE.Color("#1e3a8a"),
          emissiveIntensity: 0.3,
          specular: new THREE.Color("#67e8f9"),
          shininess: 60,
          transparent: true,
          opacity: 0.55,
          depthWrite: true,
          side: THREE.FrontSide,
        });
      }
    });

    const wire = wrap(scene.clone(true));
    wire.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        (o as THREE.Mesh).material = new THREE.MeshBasicMaterial({
          color: new THREE.Color("#67e8f9"),
          wireframe: true,
          transparent: true,
          opacity: 0.08,
          depthWrite: false,
        });
      }
    });

    const rim = wrap(scene.clone(true));
    rim.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const mat = makeXrayMaterial(new THREE.Color("#1e3a8a"), new THREE.Color("#7dd3fc"));
        (mat.uniforms.uPower as { value: number }).value = 3.0;
        (mat.uniforms.uIntensity as { value: number }).value = 0.9;
        (mat.uniforms.uBase as { value: number }).value = 0.0;
        (o as THREE.Mesh).material = mat;
      }
    });

    return { fillScene: fill, wireScene: wire, rimScene: rim, boundingRadius: (maxDim * scale) / 2 };
  }, [scene]);

  // Notify parent of bounding radius once
  useMemo(() => {
    onRadius?.(boundingRadius);
  }, [boundingRadius, onRadius]);

  // Map normalized cursor [0,1]^3 → brain-local 3D space
  // Convention: cursor.x = L→R, cursor.y = A→P, cursor.z = S→I
  // THREE: +X = right, +Y = up, +Z = toward viewer (anterior)
  const roiPos: [number, number, number] = cursor
    ? [
        (cursor.x - 0.5) * 2 * boundingRadius * 0.85, // L/R
        (0.5 - cursor.z) * 2 * boundingRadius * 0.85, // S/I (flip: low z = top)
        (0.5 - cursor.y) * 2 * boundingRadius * 0.85, // A/P (flip: low y = anterior = +Z)
      ]
    : [-boundingRadius * 0.85, -boundingRadius * 0.15, boundingRadius * 0.1];

  // Map MS lesion centroids onto 3D brain space (additive yellow glow blobs)
  const lesionMeshes = useMemo(() => {
    if (!lesions || lesions.length === 0) return null;
    const r = boundingRadius * 0.85;
    return lesions.map((l, i) => {
      const x = (l.x - 0.5) * 2 * r;
      const y = (0.5 - l.z) * 2 * r;
      const z = (0.5 - l.y) * 2 * r;
      const size = 0.022 + 0.06 * (l.size ?? 0.5);
      return (
        <group key={i} position={[x, y, z]}>
          <mesh>
            <sphereGeometry args={[size, 12, 12]} />
            <meshBasicMaterial color="#c084fc" transparent opacity={0.7} depthWrite={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[size * 1.4, 12, 12]} />
            <meshBasicMaterial color="#a855f7" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      );
    });
  }, [lesions, boundingRadius]);

  return (
    <group>
      <primitive object={fillScene} />
      <primitive object={wireScene} />
      <primitive object={rimScene} />
      {lesionMeshes}
      {showVessels && <VesselsLayer radius={boundingRadius} />}
      {showNerves && <NervesLayer radius={boundingRadius} />}
      <ROIMarker position={roiPos} />
    </group>
  );
}

function ROIMarker({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 2.4) * 0.08;
      ref.current.scale.setScalar(s);
    }
  });
  return (
    <group ref={ref} position={position}>
      <mesh>
        <sphereGeometry args={[0.05, 24, 24]} />
        <meshBasicMaterial color="#fef9c3" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshBasicMaterial color="#fde047" transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.24, 24, 24]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function MissingModelHint() {
  return (
    <Html center>
      <div className="font-mono text-[10px] text-cyan-300/80 tracking-wider text-center px-3 py-2 rounded-lg border border-cyan-400/30 bg-slate-950/70 backdrop-blur">
        <div className="text-amber-300 mb-1">⚠ brain.glb not found</div>
        <div>/public/models/brain.glb</div>
      </div>
    </Html>
  );
}

class GLTFErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export default function BrainScene({
  cursor,
  lesions,
  showVessels,
  showNerves,
  spinning = false,
  className = "",
}: {
  cursor?: Cursor3D;
  lesions?: LesionPoint[];
  showVessels?: boolean;
  showNerves?: boolean;
  spinning?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative w-full h-full ${className}`}
      style={{ background: "radial-gradient(ellipse at center, #050b18 0%, #000000 75%)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(56,189,248,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      <Canvas camera={{ position: [3.0, 0.6, 3.4], fov: 38 }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.25} />
        <pointLight position={[3, 2, 4]} intensity={1.0} color="#22d3ee" />
        <pointLight position={[-3, -1, -2]} intensity={0.7} color="#3b82f6" />
        <Suspense fallback={null}>
          <GLTFErrorBoundary fallback={<MissingModelHint />}>
            {spinning ? (
              <SpinningGroup>
                <BrainModel cursor={cursor} lesions={lesions} showVessels={showVessels} showNerves={showNerves} />
              </SpinningGroup>
            ) : (
              <BrainModel cursor={cursor} lesions={lesions} showVessels={showVessels} showNerves={showNerves} />
            )}
          </GLTFErrorBoundary>
        </Suspense>
        <OrbitControls enablePan={false} minDistance={2.2} maxDistance={8} />
      </Canvas>
      <div className="absolute top-2 left-2 text-[10px] font-mono text-cyan-400/70 tracking-widest pointer-events-none">3D · VOLUMETRIC</div>
      <div className="absolute top-2 right-2 text-[10px] font-mono text-cyan-400/70 tracking-widest pointer-events-none">L</div>
    </div>
  );
}

function SpinningGroup({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.18;
  });
  return <group ref={g}>{children}</group>;
}

useGLTF.preload(BRAIN_MODEL_URL);
