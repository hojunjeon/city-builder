import type { ImageSourcePropType } from 'react-native';

export type AssetCategory = 'road' | 'nature' | 'building';

export type CityAsset = {
  id: string;
  label: string;
  category: AssetCategory;
  source: ImageSourcePropType;
  objectSource: ImageSourcePropType;
  defaultWidth: number;
  defaultHeight: number;
};

export type PlacedAsset = {
  id: string;
  assetId: string;
  x: number;
  y: number;
  flipped: boolean;
  z: number;
};

export type CityLayoutSnapshot = {
  version: 3;
  items: PlacedAsset[];
  showGrid: boolean;
  showReference: boolean;
  savedAt: string;
};
