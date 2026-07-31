// Frontend/src/components/Home/Hero3D.jsx
import React, { Suspense, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sparkles, Float, Line } from '@react-three/drei';

// R3F-in avtomatik ResizeObserver-ə əsaslanan ölçüləndirməsi bəzi mühitlərdə
// (məs. arxa planda render olunan/kompozisiya edilməyən pəncərələrdə) işləmədiyi üçün
// canvas ölçüsünü konteynerin həqiqi ölçüsünə görə əl ilə də təyin edirik
function ForceResize({ containerRef }) {
    const { gl, camera } = useThree();

    useEffect(() => {
        const applySize = () => {
            const el = containerRef.current;
            if (!el) return;
            const { width, height } = el.getBoundingClientRect();
            if (width === 0 || height === 0) return;
            gl.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        };

        applySize();
        const observer = new ResizeObserver(applySize);
        if (containerRef.current) observer.observe(containerRef.current);
        window.addEventListener('resize', applySize);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', applySize);
        };
    }, [gl, camera, containerRef]);

    return null;
}

function GlowingCore() {
    const meshRef = useRef();
    useFrame((state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.15;
            meshRef.current.rotation.x += delta * 0.04;
        }
    });

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[1.35, 64, 64]} />
            <meshStandardMaterial
                color="#7c3aed"
                emissive="#6d28d9"
                emissiveIntensity={0.55}
                roughness={0.35}
                metalness={0.2}
            />
        </mesh>
    );
}

// Qlobusun enlik (paralel) və uzunluq (meridian) xətlərini generasiya edir
function useGlobeLines(radius, latCount, lonCount, segments) {
    return useMemo(() => {
        const lat = [];
        for (let i = 1; i < latCount; i++) {
            const theta = (Math.PI * i) / latCount; // qütblərdən başlamayaraq
            const ring = [];
            for (let j = 0; j <= segments; j++) {
                const phi = (2 * Math.PI * j) / segments;
                ring.push([
                    radius * Math.sin(theta) * Math.cos(phi),
                    radius * Math.cos(theta),
                    radius * Math.sin(theta) * Math.sin(phi)
                ]);
            }
            lat.push(ring);
        }

        const lon = [];
        for (let i = 0; i < lonCount; i++) {
            const phi = (2 * Math.PI * i) / lonCount;
            const meridian = [];
            for (let j = 0; j <= segments; j++) {
                const theta = (Math.PI * j) / segments;
                meridian.push([
                    radius * Math.sin(theta) * Math.cos(phi),
                    radius * Math.cos(theta),
                    radius * Math.sin(theta) * Math.sin(phi)
                ]);
            }
            lon.push(meridian);
        }

        return { lat, lon };
    }, [radius, latCount, lonCount, segments]);
}

function GlobeGrid() {
    const groupRef = useRef();
    useFrame((state, delta) => {
        if (groupRef.current) {
            groupRef.current.rotation.y -= delta * 0.08;
        }
    });

    const { lat, lon } = useGlobeLines(1.4, 7, 14, 48);

    return (
        <group ref={groupRef}>
            {lat.map((ring, i) => (
                <Line key={`lat-${i}`} points={ring} color="#c4b5fd" transparent opacity={0.35} lineWidth={1} />
            ))}
            {lon.map((meridian, i) => (
                <Line key={`lon-${i}`} points={meridian} color="#c4b5fd" transparent opacity={0.3} lineWidth={1} />
            ))}
        </group>
    );
}

function Scene({ containerRef }) {
    return (
        <>
            <ForceResize containerRef={containerRef} />
            <ambientLight intensity={0.5} />
            <pointLight position={[4, 3, 4]} intensity={1.4} color="#a855f7" />
            <pointLight position={[-4, -2, -3]} intensity={0.8} color="#6d28d9" />

            <group position={[1.6, 0, 0]}>
                <Float speed={1.4} rotationIntensity={0.3} floatIntensity={0.6}>
                    <GlowingCore />
                    <GlobeGrid />
                </Float>

                <Sparkles count={60} scale={5} size={2} speed={0.3} color="#c4b5fd" opacity={0.5} />
            </group>
        </>
    );
}

const Hero3D = () => {
    const containerRef = useRef(null);
    return (
        <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 0, width: '100%', height: '100%' }}>
            <Canvas camera={{ position: [0, 0, 5.5], fov: 45 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }}>
                <Suspense fallback={null}>
                    <Scene containerRef={containerRef} />
                </Suspense>
            </Canvas>
        </div>
    );
};

export default Hero3D;
