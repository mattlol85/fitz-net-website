import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Text, OrbitControls, PerspectiveCamera } from '@react-three/drei';

const LED_COUNT = 8;
const LED_RING_RADIUS = 0.48;

function LedRing({ position, active }) {
  return (
    <group position={position}>
      {Array.from({ length: LED_COUNT }, (_, i) => {
        const angle = (i / LED_COUNT) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[
              LED_RING_RADIUS * Math.cos(angle),
              0,
              LED_RING_RADIUS * Math.sin(angle),
            ]}
          >
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial
              color={active ? '#00ff44' : '#1a1a1a'}
              emissive={active ? '#00ee33' : '#000000'}
              emissiveIntensity={active ? 2.5 : 0}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function GamerBellModel({ active, isPressed, onPress, onRelease }) {
  const BASE_W = 4.5, BASE_H = 2.5, BASE_D = 3.5;
  const LID_W = 4.8, LID_H = 0.35, LID_D = 3.8;
  const COLLAR_W = 1.85, COLLAR_H = 0.85, COLLAR_D = 1.85;
  const BTN_W = 1.55, BTN_H = 1.1, BTN_D = 1.55;

  const lidTop = BASE_H + LID_H;
  const collarX = -0.75;
  const collarZ = 0.1;

  const btnRestY = BASE_H + LID_H + BTN_H / 2 + 0.08;
  const btnY = isPressed ? btnRestY - 0.22 : btnRestY;

  return (
    <group>
      {/* Blue base body */}
      <mesh position={[0, BASE_H / 2, 0]}>
        <boxGeometry args={[BASE_W, BASE_H, BASE_D]} />
        <meshStandardMaterial color="#1565C0" roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Embossed label - two lines matching Tinkercad hardware */}
      <Text
        position={[0, 1.15, BASE_D / 2 + 0.015]}
        fontSize={0.22}
        color="#e3f2fd"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.04}
      >
        FitzNet
      </Text>
      <Text
        position={[0, 0.72, BASE_D / 2 + 0.015]}
        fontSize={0.34}
        color="#e3f2fd"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.02}
      >
        Bell v1.0
      </Text>

      {/* Red lid */}
      <mesh position={[0, BASE_H + LID_H / 2, 0]}>
        <boxGeometry args={[LID_W, LID_H, LID_D]} />
        <meshStandardMaterial color="#c0392b" roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Ring of 8 LEDs on top of lid */}
      <LedRing position={[1.2, lidTop + 0.05, 0.15]} active={active} />

      {/* Screw holes at 4 corners of lid */}
      {[[-1.9, -1.5], [-1.9, 1.5], [1.9, -1.5], [1.9, 1.5]].map(([x, z], i) => (
        <mesh key={i} position={[x, lidTop + 0.02, z]}>
          <cylinderGeometry args={[0.1, 0.1, 0.06, 12]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
        </mesh>
      ))}

      {/* Green collar housing */}
      <mesh position={[collarX, BASE_H + LID_H + COLLAR_H / 2, collarZ]}>
        <boxGeometry args={[COLLAR_W, COLLAR_H, COLLAR_D]} />
        <meshStandardMaterial color="#2ecc71" roughness={0.55} metalness={0.05} />
      </mesh>

      {/* Orange interactive button — depresses on press */}
      <mesh
        position={[collarX, btnY, collarZ]}
        onPointerDown={(e) => { e.stopPropagation(); onPress?.(); }}
        onPointerUp={(e) => { e.stopPropagation(); onRelease?.(); }}
        onPointerLeave={() => onRelease?.()}
      >
        <boxGeometry args={[BTN_W, BTN_H, BTN_D]} />
        <meshStandardMaterial
          color={isPressed ? '#d35400' : '#e67e22'}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>
    </group>
  );
}

export default function GamerBell3DScene({ active, isPressed, onPress, onRelease }) {
  return (
    <Canvas style={{ width: '100%', height: '100%' }}>
      <PerspectiveCamera makeDefault position={[9, 7.5, 9]} fov={33} />
      <OrbitControls
        makeDefault
        enableRotate={false}
        enablePan={false}
        enableZoom={false}
        target={[0, 0, 0]}
      />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 14, 8]} intensity={1.2} />
      <directionalLight position={[-5, 4, -4]} intensity={0.25} />
      <group position={[0, -2.2, 0]}>
        <GamerBellModel
          active={active}
          isPressed={isPressed}
          onPress={onPress}
          onRelease={onRelease}
        />
      </group>
    </Canvas>
  );
}
