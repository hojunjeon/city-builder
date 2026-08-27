import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Image,
  PanResponder,
  PanResponderGestureState,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PROCEDURAL_ASSET_IDS } from '../data/terrainEngine';
import type { CityAsset, PlacedAsset } from '../types';

type Props = {
  item: PlacedAsset;
  asset: CityAsset;
  selected: boolean;
  boardWidth: number;
  boardHeight: number;
  gridSize: number;
  onSelect: (itemId: string) => void;
  onMoveEnd: (itemId: string, x: number, y: number) => void;
  onDragStateChange: (dragging: boolean) => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function PlacedAssetView({
  item,
  asset,
  selected,
  boardWidth,
  boardHeight,
  gridSize,
  onSelect,
  onMoveEnd,
  onDragStateChange,
}: Props) {
  const position = useRef(new Animated.ValueXY({ x: item.x, y: item.y })).current;
  const dragStart = useRef({ x: item.x, y: item.y });
  const procedural = PROCEDURAL_ASSET_IDS.has(asset.id);
  const showObjectSprite = !procedural || asset.id === 'rail_crossing';

  useEffect(() => {
    position.setValue({ x: item.x, y: item.y });
  }, [item.x, item.y, position]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (
          _event: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 2,
        onPanResponderGrant: (event: GestureResponderEvent) => {
          event.stopPropagation?.();
          dragStart.current = { x: item.x, y: item.y };
          onSelect(item.id);
          onDragStateChange(true);
        },
        onPanResponderMove: (
          _event: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => {
          const x = clamp(
            dragStart.current.x + gesture.dx,
            0,
            boardWidth - asset.defaultWidth,
          );
          const y = clamp(
            dragStart.current.y + gesture.dy,
            0,
            boardHeight - asset.defaultHeight,
          );
          position.setValue({ x, y });
        },
        onPanResponderRelease: (
          _event: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => {
          const rawX = clamp(
            dragStart.current.x + gesture.dx,
            0,
            boardWidth - asset.defaultWidth,
          );
          const rawY = clamp(
            dragStart.current.y + gesture.dy,
            0,
            boardHeight - asset.defaultHeight,
          );
          const x = clamp(
            Math.round(rawX / gridSize) * gridSize,
            0,
            boardWidth - asset.defaultWidth,
          );
          const y = clamp(
            Math.round(rawY / gridSize) * gridSize,
            0,
            boardHeight - asset.defaultHeight,
          );
          position.setValue({ x, y });
          onMoveEnd(item.id, x, y);
          onDragStateChange(false);
        },
        onPanResponderTerminate: () => {
          position.setValue({ x: item.x, y: item.y });
          onDragStateChange(false);
        },
      }),
    [
      asset.defaultHeight,
      asset.defaultWidth,
      boardHeight,
      boardWidth,
      gridSize,
      item.id,
      item.x,
      item.y,
      onDragStateChange,
      onMoveEnd,
      onSelect,
      position,
    ],
  );

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        styles.root,
        {
          width: asset.defaultWidth,
          height: asset.defaultHeight,
          zIndex: item.z + 100,
          transform: position.getTranslateTransform(),
        },
      ]}
    >
      <View
        style={[
          styles.frame,
          procedural && styles.proceduralFrame,
          selected && styles.frameSelected,
        ]}
      >
        {showObjectSprite ? (
          <Image
            source={asset.objectSource}
            resizeMode="contain"
            style={[
              styles.image,
              { transform: [{ scaleX: item.flipped ? -1 : 1 }] },
            ]}
          />
        ) : null}
        {procedural && selected ? (
          <View pointerEvents="none" style={styles.proceduralLabel}>
            <Text style={styles.proceduralLabelText}>{asset.label}</Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  frame: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: 9,
  },
  proceduralFrame: {
    borderRadius: 18,
    backgroundColor: 'transparent',
  },
  frameSelected: {
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#176c3b',
    shadowOpacity: 0.55,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  proceduralLabel: {
    position: 'absolute',
    left: '20%',
    right: '20%',
    top: '38%',
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 999,
    backgroundColor: 'rgba(25,67,39,0.46)',
  },
  proceduralLabelText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '800',
    textAlign: 'center',
  },
});
