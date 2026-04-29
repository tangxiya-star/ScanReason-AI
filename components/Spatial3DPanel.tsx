"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Html } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { X } from "lucide-react";
import { sampleCase } from "@/lib/mock";

const BRAIN_MODEL_URL = "/models/brain.glb";

/**
 * X-ray volumetric shader — fresnel-based rim glow with additive blending.
 * Produces the bright-edge / translucent-interior look from medical volumetric renders.
 */
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

function BrainModel() {
  const { scene } = useGLTF(BRAIN_MODEL_URL);

  const { fillScene, wireScene, rimScene, boundingRadius } = useMemo(() => {
    // Compute bounds on the source scene (not yet transformed)
    const probe = scene.clone(true);
    const box = new THREE.Box3().setFromObject(probe);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2.4 / maxDim;

    // Wrap each pass: outer (scale) > inner (translate -center) > model
    const wrap = (model: THREE.Object3D) => {
      const inner = new THREE.Group();
      inner.add(model);
      inner.position.copy(center).negate();
      const outer = new THREE.Group();
      outer.add(inner);
      outer.scale.setScalar(scale);
      return outer;
    };

    const baseTransformed = wrap(scene.clone(true));

    let meshCount = 0;
    baseTransformed.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshCount++;
    });
    // eslint-disable-next-line no-console
    console.log("[Spatial3D] brain.glb meshes:", meshCount, "size:", size, "scale:", scale);

    // Pass 1 — dim translucent body (so anatomy shape reads, not blown out)
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

    // Pass 2 — subtle cyan wireframe to suggest sulci/tracery
    const wire = wrap(scene.clone(true));
    wire.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        (o as THREE.Mesh).material = new THREE.MeshBasicMaterial({
          color: new THREE.Color("#67e8f9"),
          wireframe: true,
          transparent: true,
          opacity: 0.08,
          blending: THREE.NormalBlending,
          depthWrite: false,
        });
      }
    });

    // Pass 3 — fresnel rim glow (only at silhouette, not body)
    const rim = wrap(scene.clone(true));
    rim.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const mat = makeXrayMaterial(
          new THREE.Color("#1e3a8a"),
          new THREE.Color("#7dd3fc"),
        );
        (mat.uniforms.uPower as { value: number }).value = 3.0;
        (mat.uniforms.uIntensity as { value: number }).value = 0.9;
        (mat.uniforms.uBase as { value: number }).value = 0.0;
        (o as THREE.Mesh).material = mat;
      }
    });

    return {
      fillScene: fill,
      wireScene: wire,
      rimScene: rim,
      boundingRadius: (maxDim * scale) / 2,
    };
  }, [scene]);

  return (
    <group>
      <primitive object={fillScene} />
      <primitive object={wireScene} />
      <primitive object={rimScene} />
      <ROIMarker
        position={[-boundingRadius * 0.85, -boundingRadius * 0.15, boundingRadius * 0.1]}
      />
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
        <sphereGeometry args={[0.06, 24, 24]} />
        <meshBasicMaterial color="#fef9c3" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshBasicMaterial color="#fde047" transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.21, 64]} />
        <meshBasicMaterial color="#fde047" transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function SpinningGroup({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.18;
  });
  return <group ref={g}>{children}</group>;
}

function MissingModelHint() {
  return (
    <Html center>
      <div className="font-mono text-[11px] text-cyan-300/80 tracking-wider text-center px-4 py-3 rounded-lg border border-cyan-400/30 bg-slate-950/70 backdrop-blur">
        <div className="text-amber-300 mb-1">⚠ brain.glb not found</div>
        <div>Place a brain mesh at:</div>
        <div className="text-cyan-200 mt-1">/public/models/brain.glb</div>
      </div>
    </Html>
  );
}

class GLTFErrorBoundary extends (require("react").Component as typeof import("react").Component)<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if ((this.state as { hasError: boolean }).hasError) return this.props.fallback;
    return this.props.children;
  }
}

export default function Spatial3DPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="glass glow-border w-full max-w-4xl rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-gradient-to-b from-slate-900/60 to-transparent">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] font-mono text-cyan-300">3D Spatial View</div>
            <h3 className="text-lg font-semibold text-slate-100 mt-0.5">Reconstructed Region</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 border border-transparent hover:border-white/10 transition" aria-label="Close">
            <X className="h-4 w-4 text-slate-300" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-0">
          <div
            className="md:col-span-3 h-[420px] relative"
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
                  <SpinningGroup>
                    <BrainModel />
                  </SpinningGroup>
                </GLTFErrorBoundary>
              </Suspense>
              <OrbitControls enablePan={false} minDistance={2.2} maxDistance={8} />
            </Canvas>
            <div className="absolute top-3 left-3 text-[10px] font-mono text-cyan-400/70 tracking-widest">SPATIAL · VOLUMETRIC</div>
            <div className="absolute top-3 right-3 text-[10px] font-mono text-cyan-400/70 tracking-widest">L</div>
          </div>
          <div className="md:col-span-2 p-6 space-y-4 bg-slate-950/30">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-cyan-300/80 mb-1.5">Location</div>
              <p className="text-[14px] text-slate-100 font-medium">{sampleCase.region}</p>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-cyan-300/80 mb-1.5">Nearby structures</div>
              <ul className="space-y-1">
                {sampleCase.nearby.map((n) => (
                  <li key={n} className="text-[13px] text-slate-300 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" /> {n}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-cyan-300/80 mb-1.5">Clinical context</div>
              <p className="text-[13px] leading-relaxed text-slate-300">
                The highlighted ROI involves limbic-predominant cortex adjacent to the hippocampus
                and amygdala. This anatomic distribution is characteristic of limbic encephalitis
                and can also be seen in HSV encephalitis.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-white/5 bg-slate-950/40 text-[10px] text-slate-500 font-mono tracking-wider">
          Spatial Mapping Agent · Routed via TokenRouter
        </div>
      </div>
    </div>
  );
}

useGLTF.preload(BRAIN_MODEL_URL);
