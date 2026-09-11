"use client";

import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { Avatar } from './Avatar';

interface PodiumEntry {
  playerId: string;
  name: string;
  score: number;
  avatar?: { seed: string; accessories?: string[] };
}

interface PodiumProps {
  topThree: PodiumEntry[];
  onComplete?: () => void;
}

export function Podium({ topThree, onComplete }: PodiumProps) {
  const first = topThree[0];
  const second = topThree[1];
  const third = topThree[2];

  const [showThird, setShowThird] = useState(false);
  const [showThirdFireworks, setShowThirdFireworks] = useState(false);
  const [showSecond, setShowSecond] = useState(false);
  const [showSecondFireworks, setShowSecondFireworks] = useState(false);
  const [showFirst, setShowFirst] = useState(false);
  const [showFirstFireworks, setShowFirstFireworks] = useState(false);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!first && !second && !third) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = 400;

    if (third) {
      timers.push(setTimeout(() => setShowThird(true), t));
      timers.push(setTimeout(() => setShowThirdFireworks(true), t + 700));
      t += 1800;
    }
    if (second) {
      timers.push(setTimeout(() => setShowSecond(true), t));
      timers.push(setTimeout(() => setShowSecondFireworks(true), t + 700));
      t += 1800;
    }
    if (first) {
      timers.push(setTimeout(() => setShowFirst(true), t));
      timers.push(setTimeout(() => setShowFirstFireworks(true), t + 800));
      t += 800;
    }

    timers.push(setTimeout(() => onCompleteRef.current?.(), t + 2500));

    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [first, second, third]);

  if (!first && !second && !third) return null;

  return (
    <div className="relative min-h-[320px] sm:min-h-[450px] flex items-end justify-center gap-1.5 sm:gap-6 py-8 overflow-hidden">

      {showFirstFireworks && <GrandFireworks />}

      {showSecond && second && (
        <div className="relative">
          {showSecondFireworks && <SideFireworks side="left" />}
          <PodiumPlace
            entry={second}
            position={2}
            height="h-24 sm:h-32"
            color="from-gray-300 to-gray-400"
            borderColor="border-gray-300"
            widthClass="w-[72px] sm:w-28"
            avatarSize={72}
          />
        </div>
      )}

      {showFirst && first && (
        <div className="relative">
          <PodiumPlace
            entry={first}
            position={1}
            height="h-36 sm:h-48"
            color="from-yellow-400 to-yellow-500"
            borderColor="border-yellow-400"
            widthClass="w-[100px] sm:w-28"
            avatarSize={100}
            isWinner
          />
        </div>
      )}

      {showThird && third && (
        <div className="relative">
          {showThirdFireworks && <SideFireworks side="right" />}
          <PodiumPlace
            entry={third}
            position={3}
            height="h-20 sm:h-24"
            color="from-orange-300 to-orange-400"
            borderColor="border-orange-300"
            widthClass="w-[72px] sm:w-28"
            avatarSize={72}
          />
        </div>
      )}
    </div>
  );
}

function PodiumPlace({
  entry,
  position,
  height,
  color,
  borderColor,
  widthClass,
  avatarSize,
  isWinner = false,
}: {
  entry: PodiumEntry;
  position: number;
  height: string;
  color: string;
  borderColor: string;
  widthClass: string;
  avatarSize: number;
  isWinner?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center ${widthClass}`}>

      <div className="mb-2 animate-avatar-pop">
        <Avatar
          seed={entry.avatar?.seed || entry.name}
          size={avatarSize}
          expression="happy"
          accessories={entry.avatar?.accessories}
        />
      </div>

      <span
        className={`
          text-white font-bold mb-2 truncate max-w-full text-center px-0.5
          ${isWinner ? 'text-base sm:text-lg' : 'text-xs sm:text-sm'}
        `}
      >
        {entry.name}
      </span>

      <div
        className={`
          ${height} w-full rounded-t-xl
          bg-gradient-to-t ${color}
          border-t-4 ${borderColor}
          flex items-center justify-center
          shadow-lg animate-podium-grow
        `}
      >
        <span className="text-white text-2xl sm:text-3xl font-black drop-shadow-md">
          {position}°
        </span>
      </div>

      <span className="text-white/80 text-xs sm:text-sm mt-2 font-medium">
        {entry.score.toLocaleString()} pts
      </span>
    </div>
  );
}

interface Particle {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  color: string;
  size: number;
}

function SideFireworks({ side }: { side: 'left' | 'right' }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1'];

  useEffect(() => {
    const createExplosion = () => {
      const newParticles: Particle[] = [];
      const centerX = side === 'left' ? 30 : 70;
      const centerY = 35;

      for (let i = 0; i < 18; i++) {
        const angle = (Math.PI * 2 * i) / 18;
        const velocity = Math.random() * 70 + 40;
        newParticles.push({
          id: Date.now() + i + Math.random(),
          x: centerX,
          y: centerY,
          tx: Math.cos(angle) * velocity,
          ty: Math.sin(angle) * velocity * 0.7,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: Math.random() * 5 + 2,
        });
      }

      setParticles(newParticles);
      setTimeout(() => setParticles([]), 1300);
    };

    createExplosion();
    const interval = setInterval(createExplosion, 1400);
    return () => clearInterval(interval);
  }, [side]);

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={
            {
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              animation: 'firework-particle 1.2s ease-out forwards',
              '--tx': `${p.tx}px`,
              '--ty': `${p.ty}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function GrandFireworks() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1', '#DDA0DD', '#FF69B4'];

  useEffect(() => {
    const createExplosion = (centerX: number, centerY: number, count: number, boost = 1) => {
      const newParticles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const velocity = (Math.random() * 90 + 50) * boost;
        newParticles.push({
          id: Date.now() + i + Math.random(),
          x: centerX,
          y: centerY,
          tx: Math.cos(angle) * velocity,
          ty: Math.sin(angle) * velocity * 0.65,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: Math.random() * 6 + 3,
        });
      }
      setParticles((prev) => [...prev, ...newParticles]);
      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => !newParticles.includes(p)));
      }, 1600);
    };

    createExplosion(20, 35, 24);
    createExplosion(80, 35, 24);
    const t1 = setTimeout(() => createExplosion(50, 25, 40, 1.2), 300);
    const t2 = setTimeout(() => createExplosion(25, 20, 22), 800);
    const t3 = setTimeout(() => createExplosion(75, 20, 22), 1100);
    const t4 = setTimeout(() => createExplosion(50, 30, 34, 1.3), 1400);

    const interval = setInterval(() => {
      createExplosion(20 + Math.random() * 60, 15 + Math.random() * 30, 20);
    }, 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={
            {
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              animation: 'firework-particle 1.5s ease-out forwards',
              '--tx': `${p.tx}px`,
              '--ty': `${p.ty}px`,
            } as CSSProperties
          }
        />
      ))}

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2">
        <span className="text-5xl animate-bounce">⭐</span>
      </div>
    </div>
  );
}
