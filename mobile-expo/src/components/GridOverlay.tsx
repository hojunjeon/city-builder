import React from 'react';
import { StyleSheet, View } from 'react-native';

type Props = {
  width: number;
  height: number;
  spacing?: number;
};

export function GridOverlay({ width, height, spacing = 32 }: Props) {
  const vertical = [];
  const horizontal = [];

  for (let x = spacing; x < width; x += spacing) {
    vertical.push(<View key={`v-${x}`} style={[styles.vertical, { left: x }]} />);
  }
  for (let y = spacing; y < height; y += spacing) {
    horizontal.push(<View key={`h-${y}`} style={[styles.horizontal, { top: y }]} />);
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {vertical}
      {horizontal}
    </View>
  );
}

const styles = StyleSheet.create({
  vertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  horizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
});
