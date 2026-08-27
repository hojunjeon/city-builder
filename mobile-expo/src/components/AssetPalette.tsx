import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { AssetCategory, CityAsset } from '../types';

type CategoryFilter = 'all' | AssetCategory;

type Props = {
  assets: readonly CityAsset[];
  activeAssetId: string | null;
  category: CategoryFilter;
  isWide: boolean;
  onCategoryChange: (category: CategoryFilter) => void;
  onSelect: (assetId: string) => void;
};

const CATEGORY_OPTIONS: ReadonlyArray<readonly [CategoryFilter, string]> = [
  ['all', '전체'],
  ['road', '도로'],
  ['nature', '자연'],
  ['building', '건물'],
];

export function AssetPalette({
  assets,
  activeAssetId,
  category,
  isWide,
  onCategoryChange,
  onSelect,
}: Props) {
  const filtered = assets.filter(
    (asset) => category === 'all' || asset.category === category,
  );

  return (
    <View style={[styles.panel, isWide ? styles.panelWide : styles.panelNarrow]}>
      <View style={[styles.heading, isWide ? null : styles.headingNarrow]}>
        <View>
          <Text style={styles.title}>에셋</Text>
          <Text style={styles.hint}>선택한 뒤 캔버스를 누르세요.</Text>
        </View>
        <View style={styles.tabs}>
          {CATEGORY_OPTIONS.map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              onPress={() => onCategoryChange(value)}
              style={({ pressed }: { pressed: boolean }) => [
                styles.tab,
                category === value && styles.tabActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.tabText, category === value && styles.tabTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        horizontal={!isWide}
        nestedScrollEnabled
        showsHorizontalScrollIndicator={!isWide}
        showsVerticalScrollIndicator={isWide}
        contentContainerStyle={[
          styles.assetList,
          isWide ? styles.assetListWide : styles.assetListNarrow,
        ]}
      >
        {filtered.map((asset) => {
          const selected = activeAssetId === asset.id;
          return (
            <Pressable
              key={asset.id}
              accessibilityRole="button"
              accessibilityLabel={`${asset.label} 배치`}
              onPress={() => onSelect(asset.id)}
              style={({ pressed }: { pressed: boolean }) => [
                styles.assetCard,
                isWide ? styles.assetCardWide : styles.assetCardNarrow,
                selected && styles.assetCardSelected,
                pressed && styles.pressed,
              ]}
            >
              <Image source={asset.source} resizeMode="contain" style={styles.thumbnail} />
              <Text numberOfLines={1} style={styles.assetLabel}>
                {asset.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d5ddd5',
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  panelWide: {
    width: 286,
  },
  panelNarrow: {
    height: 184,
    flexDirection: 'row',
  },
  heading: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d5ddd5',
    backgroundColor: '#f6f8f5',
    gap: 9,
  },
  headingNarrow: {
    width: 166,
    borderBottomWidth: 0,
    borderRightWidth: 1,
    borderRightColor: '#d5ddd5',
  },
  title: {
    color: '#18231c',
    fontSize: 15,
    fontWeight: '700',
  },
  hint: {
    marginTop: 2,
    color: '#657067',
    fontSize: 10,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  tab: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#d5ddd5',
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  tabActive: {
    borderColor: '#2f7d4a',
    backgroundColor: '#2f7d4a',
  },
  tabText: {
    color: '#344138',
    fontSize: 10,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  assetList: {
    padding: 9,
    gap: 8,
  },
  assetListWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
  },
  assetListNarrow: {
    alignItems: 'stretch',
  },
  assetCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 7,
    borderWidth: 1,
    borderColor: '#d5ddd5',
    borderRadius: 11,
    backgroundColor: '#fbfcfa',
  },
  assetCardWide: {
    width: 124,
    height: 112,
  },
  assetCardNarrow: {
    width: 120,
    height: 164,
  },
  assetCardSelected: {
    borderWidth: 2,
    borderColor: '#2f7d4a',
    backgroundColor: '#dff1e4',
    padding: 6,
  },
  thumbnail: {
    width: '100%',
    height: 80,
  },
  assetLabel: {
    width: '100%',
    color: '#18231c',
    fontSize: 10,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
