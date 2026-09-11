"use client";

import { useState } from 'react';
import { Avatar } from './Avatar';
import { ACCESSORY_OPTIONS } from '@/lib/avatar';

interface AvatarSelectorProps {
  playerName: string;
  onSelect: (seed: string, accessories?: string[]) => void;
  initialSeed?: string;
}

const ALL_AVATAR_SEEDS = [
  'Felix', 'Aneka', 'Milo', 'Luna', 'Sophie',
  'Oscar', 'Nala', 'Ziggy', 'Pepper', 'Bolt',
  'Coco', 'Mochi', 'Max', 'Bella', 'Charlie',
  'Daisy', 'Rocky', 'Lola', 'Toby', 'Sadie',
  'Jack', 'Mia', 'Duke', 'Zoe',
  'Rex', 'Cleo', 'Bruno', 'Gigi', 'Sammy',
  'Willow', 'Jasper', 'Rosie',
];

const AVATARS_PER_PAGE = 16;

export function AvatarSelector({ playerName, onSelect, initialSeed }: AvatarSelectorProps) {
  const [selectedSeed, setSelectedSeed] = useState<string>(initialSeed || playerName);
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>(['none']);
  const [showAccessories, setShowAccessories] = useState(false);
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(ALL_AVATAR_SEEDS.length / AVATARS_PER_PAGE);
  const visibleSeeds = ALL_AVATAR_SEEDS.slice(page * AVATARS_PER_PAGE, (page + 1) * AVATARS_PER_PAGE);

  const handleSelect = (seed: string) => {
    setSelectedSeed(seed);
    onSelect(seed, selectedAccessories);
  };

  const handleAccessoryChange = (accessory: string) => {
    const newAccessories = [accessory];
    setSelectedAccessories(newAccessories);
    onSelect(selectedSeed, newAccessories);
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-800 mb-1">
          Elige tu personaje
        </h3>
        <p className="text-gray-500 text-sm">
          Selecciona un avatar que te represente
        </p>
      </div>

      <div className="flex justify-center">
        <div className="bg-purple-50 backdrop-blur-md rounded-2xl p-4 border border-purple-200">
          <Avatar
            seed={selectedSeed}
            size={120}
            expression="neutral"
            accessories={selectedAccessories}
          />
          <p className="text-gray-800 text-center mt-2 font-bold">
            {playerName}
          </p>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => setShowAccessories(!showAccessories)}
          className="px-4 py-2 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all flex items-center gap-2 border border-gray-300"
        >
          <span>🎨</span>
          {showAccessories ? 'Ocultar accesorios' : 'Personalizar accesorios'}
        </button>
      </div>

      {showAccessories && (
        <div className="bg-gray-50 backdrop-blur-md rounded-2xl p-3 border border-gray-200">
          <p className="text-gray-600 text-xs mb-2 text-center font-bold">Accesorios faciales</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ACCESSORY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleAccessoryChange(option.value)}
                className={`
                  h-11 px-2 text-xs font-bold rounded-lg leading-tight
                  flex items-center justify-center text-center
                  transition-colors duration-150
                  ${selectedAccessories[0] === option.value
                    ? 'bg-purple-500 text-white border border-purple-600 shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-purple-50 hover:border-purple-300'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2">
          {visibleSeeds.map((seed) => (
            <button
              key={seed}
              onClick={() => handleSelect(seed)}
              className={`
                flex items-center justify-center p-1 rounded-xl transition-colors duration-150
                ${selectedSeed === seed
                  ? 'bg-purple-100 border border-transparent ring-2 ring-purple-500 shadow-md'
                  : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <Avatar seed={seed} size={48} expression="neutral" accessories={selectedAccessories} />
            </button>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-3 gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-gray-300 shrink-0"
            >
              <span>←</span>
              <span className="hidden min-[380px]:inline">Anteriores</span>
            </button>
            <span className="text-xs text-gray-400 font-medium">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-gray-300 shrink-0"
            >
              <span className="hidden min-[380px]:inline">Siguientes</span>
              <span>→</span>
            </button>
          </div>
        )}
      </div>

      <p className="text-gray-400 text-xs text-center">
        Tu avatar se mantendrá durante toda la partida
      </p>
    </div>
  );
}
