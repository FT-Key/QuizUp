import { Avatar, Style } from '@dicebear/core';
import avataaarsDefinition from '@dicebear/styles/avataaars.json';

export type AvatarExpression = 'happy' | 'sad' | 'neutral';

export interface AvatarConfig {
  seed: string;
  size?: number;
  expression?: AvatarExpression;
  accessories?: string[];
}

const EXPRESSION_MAP: Record<AvatarExpression, Record<string, string>> = {
  happy: {
    eyesVariant: 'happy',
    mouthVariant: 'smile',
    eyebrowsVariant: 'raisedExcited',
  },
  sad: {
    eyesVariant: 'cry',
    mouthVariant: 'sad',
    eyebrowsVariant: 'sadConcerned',
  },
  neutral: {
    eyesVariant: 'default',
    mouthVariant: 'default',
    eyebrowsVariant: 'default',
  },
};

export const ACCESSORY_OPTIONS = [
  { value: 'none', label: 'Ninguno' },
  { value: 'kurt', label: 'Kurt' },
  { value: 'prescription01', label: 'Lentes' },
  { value: 'prescription02', label: 'Lentes 2' },
  { value: 'round', label: 'Redondos' },
  { value: 'sunglasses', label: 'Gafas de sol' },
  { value: 'wayfarers', label: 'Wayfarers' },
];

export function generateAvatarSvg(config: AvatarConfig): string {
  const { seed, size = 128, expression = 'neutral', accessories } = config;

  const style = new Style(avataaarsDefinition);
  const expressionOptions = EXPRESSION_MAP[expression] || EXPRESSION_MAP.neutral;

  const avatarOptions: Record<string, any> = {
    seed,
    size,
    ...expressionOptions,
  };

  if (accessories && accessories.length > 0) {
    const validAccessories = accessories.filter(a => a !== 'none');
    if (validAccessories.length > 0) {
      avatarOptions.accessoriesVariant = validAccessories[0];

      avatarOptions.accessoriesProbability = 100;
    }
  }

  const avatar = new Avatar(style, avatarOptions);

  return avatar.toString();
}

export function getAvatarDataUri(config: AvatarConfig): string {
  const svg = generateAvatarSvg(config);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const DEFAULT_AVATAR_SEED = 'QuizUpDefault';
