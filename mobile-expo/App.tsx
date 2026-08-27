import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  GestureResponderEvent,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AssetPalette } from './src/components/AssetPalette';
import { DynamicTerrain } from './src/components/DynamicTerrain';
import { GridOverlay } from './src/components/GridOverlay';
import { PlacedAssetView } from './src/components/PlacedAssetView';
import { Toolbar } from './src/components/Toolbar';
import { CITY_ASSET_BY_ID, CITY_ASSETS } from './src/data/assets';
import { createSampleLayout, createStarterLayout } from './src/data/sampleLayout';
import { buildTerrainGeometry, snapNetworkItem } from './src/data/terrainEngine';
import { loadCityLayout, saveCityLayout } from './src/storage';
import type {
  AssetCategory,
  CityLayoutSnapshot,
  PlacedAsset,
} from './src/types';

const BOARD_WIDTH = 960;
const BOARD_HEIGHT = 540;
const GRID_SIZE = 16;

type CategoryFilter = 'all' | AssetCategory;

function makeId(): string {
  return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function snap(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function sanitizeItems(items: unknown): PlacedAsset[] {
  if (!Array.isArray(items)) return [];

  return items.flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const item = candidate as Partial<PlacedAsset>;
    if (typeof item.assetId !== 'string') return [];
    const asset = CITY_ASSET_BY_ID.get(item.assetId);
    if (!asset) return [];

    return [
      {
        id: typeof item.id === 'string' ? item.id : makeId(),
        assetId: item.assetId,
        x: clamp(snap(Number(item.x) || 0), 0, BOARD_WIDTH - asset.defaultWidth),
        y: clamp(snap(Number(item.y) || 0), 0, BOARD_HEIGHT - asset.defaultHeight),
        flipped: Boolean(item.flipped),
        z: Number.isFinite(Number(item.z)) ? Number(item.z) : index + 1,
      },
    ];
  });
}

export default function App() {
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 900;

  const [items, setItems] = useState<PlacedAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [showGrid, setShowGrid] = useState(true);
  const [showReference, setShowReference] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState('불러오는 중');

  const zCounter = useRef(1);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = useCallback((message: string) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatus(message);
    statusTimer.current = setTimeout(() => setStatus('자동 저장'), 1700);
  }, []);

  useEffect(
    () => () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    },
    [],
  );

  const applyLayout = useCallback((snapshot: CityLayoutSnapshot | null) => {
    const nextItems = snapshot ? sanitizeItems(snapshot.items) : createStarterLayout();
    setItems(nextItems);
    setShowGrid(snapshot?.showGrid !== false);
    setShowReference(Boolean(snapshot?.showReference));
    zCounter.current = Math.max(1, ...nextItems.map((item) => item.z + 1));
    setSelectedAssetId(null);
    setSelectedItemId(null);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const saved = await loadCityLayout();
        if (!active) return;
        applyLayout(saved);
        setStatus(saved ? '저장 도시 불러옴' : '분수공원 기본 풀밭 준비됨');
      } catch (error) {
        console.warn('Could not load city layout', error);
        if (!active) return;
        applyLayout(null);
        setStatus('분수공원 기본 풀밭 준비됨');
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [applyLayout]);

  const snapshot = useMemo<CityLayoutSnapshot>(
    () => ({
      version: 3,
      items,
      showGrid,
      showReference,
      savedAt: new Date().toISOString(),
    }),
    [items, showGrid, showReference],
  );

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      void saveCityLayout(snapshot).catch((error) => {
        console.warn('Auto save failed', error);
        setStatus('저장 실패');
      });
    }, 220);
    return () => clearTimeout(timer);
  }, [hydrated, snapshot]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );
  const selectedItemAsset = selectedItem
    ? CITY_ASSET_BY_ID.get(selectedItem.assetId) ?? null
    : null;
  const activeAsset = selectedAssetId
    ? CITY_ASSET_BY_ID.get(selectedAssetId) ?? null
    : null;
  const terrainGeometry = useMemo(
    () => buildTerrainGeometry(items, CITY_ASSET_BY_ID),
    [items],
  );

  const selectAsset = useCallback((assetId: string) => {
    setSelectedAssetId(assetId);
    setSelectedItemId(null);
  }, []);

  const selectItem = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
    setSelectedAssetId(null);
  }, []);

  const handleBoardPress = useCallback(
    (event: GestureResponderEvent) => {
      if (!selectedAssetId) {
        setSelectedItemId(null);
        return;
      }

      const asset = CITY_ASSET_BY_ID.get(selectedAssetId);
      if (!asset) return;
      const x = clamp(
        snap(event.nativeEvent.locationX - asset.defaultWidth / 2),
        0,
        BOARD_WIDTH - asset.defaultWidth,
      );
      const y = clamp(
        snap(event.nativeEvent.locationY - asset.defaultHeight / 2),
        0,
        BOARD_HEIGHT - asset.defaultHeight,
      );
      const candidate: PlacedAsset = {
        id: makeId(),
        assetId: asset.id,
        x,
        y,
        flipped: false,
        z: zCounter.current++,
      };
      const networkSnap = snapNetworkItem(candidate, asset, items, CITY_ASSET_BY_ID);
      const next = {
        ...candidate,
        x: networkSnap.x,
        y: networkSnap.y,
      };
      setItems((current) => [...current, next]);
      setSelectedItemId(next.id);
      setSelectedAssetId(null);
      showStatus(
        networkSnap.snapped
          ? '에셋 배치됨 · 인접 네트워크에 연결'
          : '에셋 배치됨 · 지형 재계산',
      );
    },
    [items, selectedAssetId, showStatus],
  );

  const updateItem = useCallback(
    (itemId: string, updater: (item: PlacedAsset) => PlacedAsset) => {
      setItems((current) =>
        current.map((item) => (item.id === itemId ? updater(item) : item)),
      );
    },
    [],
  );

  const moveItem = useCallback(
    (itemId: string, x: number, y: number) => {
      const item = items.find((candidate) => candidate.id === itemId);
      if (!item) return;
      const asset = CITY_ASSET_BY_ID.get(item.assetId);
      if (!asset) return;
      const candidate = { ...item, x, y };
      const networkSnap = snapNetworkItem(candidate, asset, items, CITY_ASSET_BY_ID);
      updateItem(itemId, (current) => ({
        ...current,
        x: networkSnap.x,
        y: networkSnap.y,
      }));
      showStatus(
        networkSnap.snapped
          ? '이동됨 · 인접 네트워크에 연결'
          : '이동됨 · 주변 지형 재계산',
      );
    },
    [items, showStatus, updateItem],
  );

  const flipSelected = useCallback(() => {
    if (!selectedItemId) return;
    updateItem(selectedItemId, (item) => ({ ...item, flipped: !item.flipped }));
    showStatus('좌우 반전됨 · 연결 지형 재계산');
  }, [selectedItemId, showStatus, updateItem]);

  const duplicateSelected = useCallback(() => {
    if (!selectedItem) return;
    const asset = CITY_ASSET_BY_ID.get(selectedItem.assetId);
    if (!asset) return;
    const candidate: PlacedAsset = {
      ...selectedItem,
      id: makeId(),
      x: clamp(
        snap(selectedItem.x + GRID_SIZE * 2),
        0,
        BOARD_WIDTH - asset.defaultWidth,
      ),
      y: clamp(
        snap(selectedItem.y + GRID_SIZE * 2),
        0,
        BOARD_HEIGHT - asset.defaultHeight,
      ),
      z: zCounter.current++,
    };
    const networkSnap = snapNetworkItem(candidate, asset, items, CITY_ASSET_BY_ID);
    const duplicate = { ...candidate, x: networkSnap.x, y: networkSnap.y };
    setItems((current) => [...current, duplicate]);
    setSelectedItemId(duplicate.id);
    showStatus('복제됨 · 지형 재계산');
  }, [items, selectedItem, showStatus]);

  const bringFront = useCallback(() => {
    if (!selectedItemId) return;
    updateItem(selectedItemId, (item) => ({ ...item, z: zCounter.current++ }));
  }, [selectedItemId, updateItem]);

  const sendBack = useCallback(() => {
    if (!selectedItemId) return;
    const minZ = Math.min(0, ...items.map((item) => item.z));
    updateItem(selectedItemId, (item) => ({ ...item, z: minZ - 1 }));
  }, [items, selectedItemId, updateItem]);

  const deleteSelected = useCallback(() => {
    if (!selectedItemId) return;
    setItems((current) => current.filter((item) => item.id !== selectedItemId));
    setSelectedItemId(null);
    showStatus('삭제됨 · 해당 지형은 풀밭으로 복구');
  }, [selectedItemId, showStatus]);

  const loadSaved = useCallback(() => {
    void (async () => {
      try {
        const saved = await loadCityLayout();
        if (!saved) {
          showStatus('저장 데이터 없음');
          return;
        }
        applyLayout(saved);
        showStatus('불러옴');
      } catch (error) {
        console.warn(error);
        showStatus('불러오기 실패');
      }
    })();
  }, [applyLayout, showStatus]);

  const saveNow = useCallback(() => {
    void saveCityLayout(snapshot)
      .then(() => showStatus('저장됨'))
      .catch((error) => {
        console.warn(error);
        showStatus('저장 실패');
      });
  }, [showStatus, snapshot]);

  const loadSample = useCallback(() => {
    const sample = createSampleLayout();
    setItems(sample);
    zCounter.current = Math.max(...sample.map((item) => item.z + 1));
    setSelectedItemId(null);
    setSelectedAssetId(null);
    showStatus('샘플 배치됨');
  }, [showStatus]);

  const resetCity = useCallback(() => {
    Alert.alert('도시 초기화', '분수공원만 남긴 기본 풀밭으로 되돌릴까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '초기화',
        style: 'destructive',
        onPress: () => {
          const starter = createStarterLayout();
          setItems(starter);
          setSelectedAssetId(null);
          setSelectedItemId(null);
          zCounter.current = 20;
          showStatus('기본 풀밭으로 초기화됨');
        },
      },
    ]);
  }, [showStatus]);

  const toolbarActions = useMemo(
    () => [
      {
        id: 'select',
        label: '↖ 선택 모드',
        onPress: () => {
          setSelectedAssetId(null);
          setSelectedItemId(null);
        },
      },
      {
        id: 'flip',
        label: '⇆ 좌우 반전',
        disabled: !selectedItem,
        onPress: flipSelected,
      },
      {
        id: 'duplicate',
        label: '⧉ 복제',
        disabled: !selectedItem,
        onPress: duplicateSelected,
      },
      {
        id: 'front',
        label: '⬆ 앞으로',
        disabled: !selectedItem,
        onPress: bringFront,
      },
      {
        id: 'back',
        label: '⬇ 뒤로',
        disabled: !selectedItem,
        onPress: sendBack,
      },
      {
        id: 'delete',
        label: '⌫ 삭제',
        disabled: !selectedItem,
        danger: true,
        onPress: deleteSelected,
      },
      {
        id: 'grid',
        label: '# 격자',
        active: showGrid,
        onPress: () => setShowGrid((value) => !value),
      },
      {
        id: 'reference',
        label: '▧ 참고 이미지',
        active: showReference,
        onPress: () => setShowReference((value) => !value),
      },
      { id: 'sample', label: '🏙 예시 배치', onPress: loadSample },
      { id: 'save', label: '💾 저장', onPress: saveNow },
      { id: 'load', label: '↻ 불러오기', onPress: loadSaved },
      { id: 'reset', label: '초기화', danger: true, onPress: resetCity },
    ],
    [
      bringFront,
      deleteSelected,
      duplicateSelected,
      flipSelected,
      loadSample,
      loadSaved,
      resetCity,
      saveNow,
      selectedItem,
      sendBack,
      showGrid,
      showReference,
    ],
  );

  const modeLabel = selectedItemAsset
    ? `편집: ${selectedItemAsset.label}`
    : activeAsset
      ? `배치: ${activeAsset.label}`
      : '선택 모드';
  const detailLabel = selectedItem
    ? `x ${Math.round(selectedItem.x)} · y ${Math.round(selectedItem.y)}${selectedItem.flipped ? ' · 좌우 반전' : ''}`
    : `자동 연결 ${terrainGeometry.stats.autoConnections} · 진입로 ${terrainGeometry.stats.driveways} · 변형 지형 ${terrainGeometry.stats.terrainRegions}`;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>소비 도시 빌더</Text>
          <Text style={styles.headerSubtitle}>
            풀밭에서 시작 · 배치 관계를 읽어 도로·진입로·부지를 재생성 · 좌우 반전
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      <Toolbar actions={toolbarActions} />

      <View style={[styles.main, isWide ? styles.mainWide : styles.mainNarrow]}>
        <AssetPalette
          assets={CITY_ASSETS}
          activeAssetId={selectedAssetId}
          category={category}
          isWide={isWide}
          onCategoryChange={setCategory}
          onSelect={selectAsset}
        />

        <View style={styles.workspace}>
          <View style={styles.workspaceTopline}>
            <Text numberOfLines={1} style={styles.modeText}>
              {modeLabel}
            </Text>
            <Text numberOfLines={1} style={styles.detailText}>
              {detailLabel}
            </Text>
          </View>

          <View style={styles.viewportShell}>
            <ScrollView
              horizontal
              nestedScrollEnabled
              scrollEnabled={!dragging}
              contentContainerStyle={styles.horizontalContent}
            >
              <ScrollView
                nestedScrollEnabled
                scrollEnabled={!dragging}
                contentContainerStyle={styles.verticalContent}
              >
                <Pressable
                  accessibilityLabel="도시 제작 캔버스"
                  onPress={handleBoardPress}
                  style={styles.board}
                >
                  <Image
                    pointerEvents="none"
                    source={require('./assets/grass_field.jpg')}
                    resizeMode="stretch"
                    style={styles.grassBackground}
                  />
                  {showReference ? (
                    <Image
                      pointerEvents="none"
                      source={require('./assets/city_reference.jpg')}
                      resizeMode="cover"
                      style={styles.referenceImage}
                    />
                  ) : null}
                  <DynamicTerrain
                    geometry={terrainGeometry}
                    height={BOARD_HEIGHT}
                    width={BOARD_WIDTH}
                  />
                  {showGrid ? (
                    <GridOverlay width={BOARD_WIDTH} height={BOARD_HEIGHT} />
                  ) : null}

                  {[...items]
                    .sort((a, b) => a.z - b.z)
                    .map((item) => {
                      const asset = CITY_ASSET_BY_ID.get(item.assetId);
                      if (!asset) return null;
                      return (
                        <PlacedAssetView
                          key={item.id}
                          asset={asset}
                          boardHeight={BOARD_HEIGHT}
                          boardWidth={BOARD_WIDTH}
                          gridSize={GRID_SIZE}
                          item={item}
                          onDragStateChange={setDragging}
                          onMoveEnd={moveItem}
                          onSelect={selectItem}
                          selected={selectedItemId === item.id}
                        />
                      );
                    })}

                  <View pointerEvents="none" style={styles.canvasTip}>
                    <Text style={styles.canvasTipText}>
                      빈 곳을 눌러 배치 · 추가/이동/삭제마다 전체 지형과 연결망 재계산
                    </Text>
                  </View>
                </Pressable>
              </ScrollView>
            </ScrollView>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          캔버스 {BOARD_WIDTH} × {BOARD_HEIGHT} · {GRID_SIZE}px 스냅 · 이웃 반응형 동적 지형
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#eef2ed',
  },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#183122',
  },
  headerText: {
    flexShrink: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    marginTop: 2,
    color: '#c9d9cd',
    fontSize: 10,
  },
  statusBadge: {
    minWidth: 82,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 10,
    textAlign: 'center',
  },
  main: {
    flex: 1,
    minHeight: 0,
    padding: 9,
    gap: 9,
  },
  mainWide: {
    flexDirection: 'row',
  },
  mainNarrow: {
    flexDirection: 'column',
  },
  workspace: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d5ddd5',
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  workspaceTopline: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d5ddd5',
    backgroundColor: '#f6f8f5',
  },
  modeText: {
    flexShrink: 1,
    color: '#18231c',
    fontSize: 11,
    fontWeight: '700',
  },
  detailText: {
    flexShrink: 1,
    color: '#657067',
    fontSize: 10,
    textAlign: 'right',
  },
  viewportShell: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#d8e0d6',
  },
  horizontalContent: {
    minHeight: '100%',
    paddingHorizontal: 16,
  },
  verticalContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  board: {
    position: 'relative',
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#365d3f',
    borderRadius: 12,
    backgroundColor: '#8acb2e',
  },
  grassBackground: {
    ...StyleSheet.absoluteFillObject,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
  },
  referenceImage: {
    ...StyleSheet.absoluteFillObject,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    opacity: 0.28,
  },
  canvasTip: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: 'rgba(18,47,27,0.72)',
    zIndex: 9999,
  },
  canvasTipText: {
    color: '#ffffff',
    fontSize: 10,
  },
  footer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#d5ddd5',
    backgroundColor: '#ffffff',
  },
  footerText: {
    color: '#657067',
    fontSize: 10,
    textAlign: 'center',
  },
});
