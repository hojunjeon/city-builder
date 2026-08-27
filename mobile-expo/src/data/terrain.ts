import type { ImageSourcePropType } from 'react-native';

import type { CityAsset } from '../types';

export type TerrainKind = 'building' | 'road' | 'rail' | 'park' | 'nature';

const TERRAIN_IMAGES: Record<TerrainKind, ImageSourcePropType> = {
  building: require('../../assets/terrain/terrain_building.png'),
  road: require('../../assets/terrain/terrain_road.png'),
  rail: require('../../assets/terrain/terrain_rail.png'),
  park: require('../../assets/terrain/terrain_park.png'),
  nature: require('../../assets/terrain/terrain_nature.png'),
};

export function getTerrainKind(asset: CityAsset): TerrainKind {
  if (asset.id.startsWith('rail_')) return 'rail';
  if (asset.category === 'road') return 'road';
  if (asset.category === 'building') return 'building';
  if (asset.id === 'park_fountain' || asset.id === 'playground') return 'park';
  return 'nature';
}

export function getTerrainPresentation(asset: CityAsset): {
  source: ImageSourcePropType;
  width: number;
  height: number;
  left: number;
  top: number;
} {
  const kind = getTerrainKind(asset);
  const widthScale = kind === 'road' || kind === 'rail' ? 1.44 : 1.5;
  const width = Math.round(asset.defaultWidth * widthScale);
  const height = Math.round(width * (180 / 260));

  return {
    source: TERRAIN_IMAGES[kind],
    width,
    height,
    left: (asset.defaultWidth - width) / 2,
    top: asset.defaultHeight - height * 0.78,
  };
}
