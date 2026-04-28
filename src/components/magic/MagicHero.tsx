import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { motion } from "framer-motion";
import { Sparkles as SparklesIcon } from "lucide-react";
import * as THREE from "three";

interface MagicHeroProps {
  onMagicMode: () => void;
  isLoading: boolean;
}

const EARTH_TEXTURE_URL =
  "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg";

function seeded(i: number): number {
  const x = Math.sin(i * 9301.13 + 49297.7) * 233280.0;
  return x - Math.floor(x);
}

interface CityPoint {
  position: [number, number, number];
  phase: number;
  speed: number;
}

function buildCityPoints(count: number, radius: number): CityPoint[] {
  const pts: CityPoint[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    pts.push({
      position: [x * radius, y * radius, z * radius],
      phase: seeded(i + 1) * Math.PI * 2,
      speed: 1.2 + seeded(i + 7) * 2.4,
    });
  }
  return pts;
}

function CityPoints({ radius }: { radius: number }) {
  const points = useMemo(() => buildCityPoints(140, radius * 1.005), [radius]);
  const meshes = useRef<Array<THREE.Mesh | null>>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    for (let i = 0; i < points.length; i++) {
      const m = meshes.current[i];
      if (!m) continue;
      const p = points[i];
      const flicker = 0.35 + (Math.sin(t * p.speed + p.phase) * 0.5 + 0.5) * 0.65;
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = flicker;
      m.scale.setScalar(1 + flicker * 0.6);
    }
  });

  return (
    <group>
      {points.map((p, i) => (
        <mesh
          key={i}
          position={p.position}
          ref={(el) => {
            meshes.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshBasicMaterial color="#fde68a" transparent opacity={0.9} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function EarthGlobe() {
  const earthRef = useRef<THREE.Mesh>(null);
  const cityGroupRef = useRef<THREE.Group>(null);
  const atmoRef = useRef<THREE.Mesh>(null);
  const earthMap = useLoader(THREE.TextureLoader, EARTH_TEXTURE_URL);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const ySpeed = 0.18;
    if (earthRef.current) earthRef.current.rotation.y = t * ySpeed;
    if (cityGroupRef.current) cityGroupRef.current.rotation.y = t * ySpeed;
    if (atmoRef.current) atmoRef.current.scale.setScalar(1 + Math.sin(t * 1.2) * 0.012);
  });

  const radius = 1.1;

  return (
    <group rotation={[0.35, 0, 0]}>
      <mesh ref={earthRef}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial map={earthMap} roughness={0.85} metalness={0.05} emissive="#0b1d44" emissiveIntensity={0.18} />
      </mesh>
      <group ref={cityGroupRef}>
        <CityPoints radius={radius} />
      </group>
      <mesh ref={atmoRef}>
        <sphereGeometry args={[radius * 1.06, 48, 48]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.08} side={THREE.BackSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 3, 5]} intensity={1.6} color="#ffffff" />
      <pointLight position={[-4, -2, -2]} intensity={0.6} color="#6366f1" />
      <Suspense fallback={null}>
        <EarthGlobe />
      </Suspense>
      <Stars radius={20} depth={30} count={400} factor={2} saturation={0} fade speed={0.4} />
    </>
  );
}

export const MagicHero = ({ onMagicMode, isLoading }: MagicHeroProps) => {
  return (
    <div className="relative overflow-hidden rounded-3xl glass-strong holo-scan h-[280px] flex flex-col">
      <div className="absolute inset-0 grid-floor opacity-30 pointer-events-none" />
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 0, 3.4], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
          <Scene />
        </Canvas>
      </div>
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-background/55 via-transparent to-background/80" />
      <motion.div
        className="absolute inset-x-0 h-[1.5px] bg-gradient-prism pointer-events-none z-10"
        animate={{ top: ["-2%", "102%"] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
        style={{ boxShadow: "0 0 20px hsl(var(--primary) / 0.7)" }}
      />
      <div className="relative z-20 flex flex-col items-center text-center gap-1 pt-5 px-4">
        <h1 className="text-2xl font-display font-black uppercase tracking-[0.18em] holo-text leading-none">
          Magic Combiné
        </h1>
        <div className="flex items-center justify-center gap-2 mt-2">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-primary/60" />
          <p className="text-[8.5px] font-bold uppercase tracking-[0.32em] text-primary/85">
            IA · Football · Stratège
          </p>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-primary/60" />
        </div>
      </div>
      <div className="relative z-20 mt-auto p-4 pointer-events-auto">
        <button
          onClick={onMagicMode}
          disabled={isLoading}
          className="tap relative w-full px-4 py-3 rounded-2xl bg-gradient-holo text-primary-foreground font-display font-black uppercase tracking-[0.18em] text-[11px] flex items-center justify-center gap-2 shadow-holo disabled:opacity-50 animate-pulse-holo"
        >
          <SparklesIcon size={14} className={isLoading ? "animate-spin" : ""} />
          <span className="truncate">{isLoading ? "Génération..." : "Mode Magique"}</span>
          <span className="w-2 h-2 rounded-full bg-success animate-pulse shrink-0" />
        </button>
      </div>
    </div>
  );
};