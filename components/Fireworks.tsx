"use client";

import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  angle: number;
  velocity: number;
  opacity: number;
}

const COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1', '#DDA0DD'];

export function Fireworks() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const createExplosion = (centerX: number, centerY: number, count: number) => {
      const newParticles: Particle[] = [];

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        newParticles.push({
          id: Date.now() + i,
          x: centerX,
          y: centerY,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: Math.random() * 4 + 2,
          angle,
          velocity: Math.random() * 100 + 50,
          opacity: 1,
        });
      }

      setParticles(prev => [...prev, ...newParticles]);

      setTimeout(() => {
        setParticles(prev => prev.filter(p => !newParticles.includes(p)));
      }, 1500);
    };

    const timer1 = setTimeout(() => createExplosion(25, 40, 30), 0);
    const timer2 = setTimeout(() => createExplosion(75, 40, 30), 200);
    const timer3 = setTimeout(() => createExplosion(50, 30, 60), 500);
    const timer4 = setTimeout(() => createExplosion(50, 25, 40), 800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full animate-ping"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: particle.color,
            opacity: particle.opacity,
            transform: `rotate(${particle.angle}rad) translateY(-${particle.velocity}px)`,
            animation: 'firework-burst 1.5s ease-out forwards',
          }}
        />
      ))}

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2">
        <span className="text-6xl animate-bounce">⭐</span>
      </div>
    </div>
  );
}
