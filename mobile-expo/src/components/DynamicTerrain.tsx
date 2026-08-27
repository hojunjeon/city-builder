import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Polygon, Polyline } from 'react-native-svg';

import type {
  TerrainGeometry,
  TerrainPoint,
  TerrainPolyline,
} from '../data/terrainEngine';

type Props = {
  geometry: TerrainGeometry;
  width: number;
  height: number;
};

function pointsValue(points: TerrainPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function diamondPoints(cx: number, cy: number, rx: number, ry: number): string {
  return `${cx},${cy - ry} ${cx + rx},${cy} ${cx},${cy + ry} ${cx - rx},${cy}`;
}

function offsetPolyline(points: TerrainPoint[], offset: number): TerrainPoint[] {
  return points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)] ?? point;
    const next = points[Math.min(points.length - 1, index + 1)] ?? point;
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    return {
      x: point.x - (dy / length) * offset,
      y: point.y + (dx / length) * offset,
    };
  });
}

function samples(points: TerrainPoint[], spacing: number): Array<{
  point: TerrainPoint;
  tangent: TerrainPoint;
}> {
  const result: Array<{ point: TerrainPoint; tangent: TerrainPoint }> = [];
  let carry = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.001) continue;
    let position = spacing - carry;
    while (position <= length) {
      const t = position / length;
      result.push({
        point: { x: a.x + dx * t, y: a.y + dy * t },
        tangent: { x: dx / length, y: dy / length },
      });
      position += spacing;
    }
    carry = Math.max(0, length - (position - spacing));
  }
  return result;
}

function NetworkStroke({
  paths,
  width,
  color,
  dash,
}: {
  paths: TerrainPolyline[];
  width: number;
  color: string;
  dash?: string;
}) {
  return (
    <>
      {paths.map((path) => (
        <Polyline
          key={`${path.id}:${width}:${color}`}
          points={pointsValue(path.points)}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dash}
        />
      ))}
    </>
  );
}

export function DynamicTerrain({ geometry, width, height }: Props) {
  const footpaths = geometry.driveways.filter((path) => path.kind === 'footpath');
  const driveways = geometry.driveways.filter((path) => path.kind === 'driveway');

  return (
    <Svg
      pointerEvents="none"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={styles.root}
    >
      {/* Same-kind regions use the same fill. Overlap visually merges into one
          modified terrain area rather than leaving one rectangular image per asset. */}
      {geometry.nature.map((region) => (
        <Ellipse
          key={`nature:${region.id}`}
          cx={region.cx}
          cy={region.cy}
          rx={region.rx}
          ry={region.ry}
          fill="rgba(45,111,52,0.24)"
          stroke="rgba(34,85,43,0.11)"
          strokeWidth={18}
        />
      ))}

      {geometry.parks.map((region) => (
        <Polygon
          key={`park:${region.id}`}
          points={diamondPoints(region.cx, region.cy, region.rx, region.ry)}
          fill="rgba(117,181,58,0.30)"
          stroke="rgba(76,132,48,0.16)"
          strokeWidth={16}
          strokeLinejoin="round"
        />
      ))}

      {geometry.lots.map((region) => (
        <React.Fragment key={`lot:${region.id}`}>
          <Polygon
            points={diamondPoints(region.cx, region.cy, region.rx, region.ry)}
            fill="rgba(142,164,92,0.28)"
            stroke="rgba(116,137,80,0.16)"
            strokeWidth={15}
            strokeLinejoin="round"
          />
          <Polygon
            points={diamondPoints(
              region.cx,
              region.cy,
              region.rx * 0.76,
              region.ry * 0.76,
            )}
            fill="rgba(218,204,160,0.25)"
            stroke="rgba(96,112,73,0.28)"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        </React.Fragment>
      ))}

      <NetworkStroke paths={footpaths} width={14} color="rgba(92,124,61,0.20)" />
      <NetworkStroke paths={footpaths} width={7} color="rgba(216,201,158,0.80)" />
      <NetworkStroke paths={driveways} width={21} color="rgba(94,108,69,0.20)" />
      <NetworkStroke paths={driveways} width={14} color="#cfbf96" />
      <NetworkStroke paths={driveways} width={9} color="rgba(169,159,130,0.64)" />

      {/* The road sprite is only a palette icon and a geometry template. The
          actual asphalt, curb and lane line are regenerated from the network. */}
      <NetworkStroke paths={geometry.roads} width={78} color="rgba(67,102,48,0.20)" />
      {geometry.bulbs.map((bulb) => (
        <Circle
          key={`road-glow:${bulb.id}`}
          cx={bulb.x}
          cy={bulb.y}
          r={bulb.radius + 18}
          fill="rgba(67,102,48,0.20)"
        />
      ))}
      <NetworkStroke paths={geometry.roads} width={64} color="#d6c89f" />
      <NetworkStroke paths={geometry.roads} width={53} color="#8c8576" />
      <NetworkStroke paths={geometry.roads} width={47} color="#3d4549" />
      <NetworkStroke paths={geometry.roads} width={39} color="#454d51" />
      {geometry.bulbs.map((bulb) => (
        <React.Fragment key={`road-bulb:${bulb.id}`}>
          <Circle cx={bulb.x} cy={bulb.y} r={bulb.radius + 12} fill="#d6c89f" />
          <Circle cx={bulb.x} cy={bulb.y} r={bulb.radius + 7} fill="#8c8576" />
          <Circle cx={bulb.x} cy={bulb.y} r={bulb.radius + 4} fill="#3d4549" />
          <Circle cx={bulb.x} cy={bulb.y} r={bulb.radius} fill="#454d51" />
        </React.Fragment>
      ))}
      <NetworkStroke
        paths={geometry.roads}
        width={2.4}
        color="rgba(248,247,236,0.92)"
        dash="12 10"
      />

      {/* Rail beds and sleepers are also generated, so adjacent rail pieces
          share one continuous track and disappear cleanly when removed. */}
      <NetworkStroke paths={geometry.rails} width={50} color="rgba(102,90,55,0.20)" />
      <NetworkStroke paths={geometry.rails} width={34} color="#8e806b" />
      <NetworkStroke paths={geometry.rails} width={26} color="#806d58" />
      {geometry.rails.flatMap((rail) =>
        samples(rail.points, 13).map((sample, index) => {
          const nx = -sample.tangent.y;
          const ny = sample.tangent.x;
          return (
            <Polyline
              key={`sleeper:${rail.id}:${index}`}
              points={`${sample.point.x - nx * 12},${sample.point.y - ny * 12} ${sample.point.x + nx * 12},${sample.point.y + ny * 12}`}
              fill="none"
              stroke="#6f4930"
              strokeWidth={3.4}
              strokeLinecap="round"
            />
          );
        }),
      )}
      {geometry.rails.flatMap((rail) => [
        <Polyline
          key={`rail-a:${rail.id}`}
          points={pointsValue(offsetPolyline(rail.points, -6.3))}
          fill="none"
          stroke="#34383a"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />,
        <Polyline
          key={`rail-b:${rail.id}`}
          points={pointsValue(offsetPolyline(rail.points, 6.3))}
          fill="none"
          stroke="#34383a"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />,
      ])}
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
});
