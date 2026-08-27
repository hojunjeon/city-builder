# 유사 게임 관찰 및 동적 지형 알고리즘

## 결론

이 버전은 **풀밭 배경 위에 도로·부지 이미지를 따로 붙이지 않습니다.** 에셋은 배치 의도와 형태를 나타내는 입력값이고, 실제 배경 지형은 모든 에셋의 위치·종류·이웃 관계를 분석한 뒤 매번 다시 생성됩니다.

## 유사 사례에서 확인한 반응 방식

| 사례 | 에셋 추가 시 일어나는 일 | 본 프로젝트에 반영한 원칙 |
|---|---|---|
| Townscaper | 놓인 블록의 주변 구성에 따라 집, 아치, 계단, 다리, 뒤뜰 등의 결과가 자동 결정됨 | 에셋 하나의 원본 그림보다 **배치 관계와 주변 구성**을 우선함 |
| Dorfromantik | 타일 가장자리와 인접 지형의 적합성에 따라 숲·마을·물·철도 등이 그룹과 연결망을 형성함 | 도로·철길을 개별 타일이 아니라 **연결 그래프**로 계산함 |
| Godot Terrain Connect/Path | 새 지형 셀을 칠하면 같은 지형의 이웃 셀을 연결하고 올바른 전환을 위해 주변 타일까지 갱신할 수 있음 | 에셋 추가·이동·삭제 때 해당 오브젝트만 바꾸지 않고 **주변 지형을 함께 재계산**함 |

### 조사 출처

- Nintendo, *Townscaper*: https://www.nintendo.com/US/store/products/townscaper-switch/
- Steam, *Dorfromantik*: https://store.steampowered.com/app/1455840/Dorfromantik/
- Godot Engine Documentation, *TileMap / terrain connect*: https://docs.godotengine.org/en/4.3/classes/class_tilemap.html
- Godot Engine Documentation, *Using TileMaps*: https://github.com/godotengine/godot-docs/blob/master/tutorials/2d/using_tilemaps.rst

## 이전 방식과 이번 방식의 차이

| 항목 | 이전 v2 | 동적 지형 v3 |
|---|---|---|
| 배경 | 고정 풀밭 이미지 | 풀밭을 원본으로 매 상태마다 파생 지형 생성 |
| 도로 | 도로 PNG를 그대로 배치 | 에셋의 경로 템플릿만 읽고 아스팔트·연석·차선을 다시 그림 |
| 이웃 반응 | 각 에셋이 독립적 | 가까운 끝점 연결, T자 연결, 철길 연결 자동 생성 |
| 건물 | 건물과 작은 바닥 패치 | 건물 부지 생성 후 가장 가까운 도로까지 진입로 생성 |
| 자연·공원 | 개별 사각/마름모 패치 | 영향 영역을 마스크로 합성해 겹친 지역이 하나의 지형처럼 보임 |
| 이동·반전 | 스프라이트만 이동/반전 | 경로·입구 위치·이웃 연결·진입로를 다시 계산 |
| 삭제 | 붙인 레이어만 제거 | 전체 지형을 남은 에셋으로 재생성하므로 원래 풀밭으로 복구 |

## 처리 파이프라인

| 단계 | 처리 |
|---:|---|
| 1 | 배치된 에셋을 `도로`, `철길`, `건물`, `공원`, `자연` 의미 유형으로 분류 |
| 2 | 도로·철길 에셋에서 정규화된 중심 경로와 끝점을 생성 |
| 3 | 가까운 호환 끝점을 스냅하고 끝점-끝점 또는 끝점-경로 연결을 생성 |
| 4 | 건물은 부지 영역과 출입구를 계산하고 가장 가까운 도로에 진입로 연결 |
| 5 | 공원·숲·건물 영향 영역을 지형 마스크로 합성 |
| 6 | 풀밭부터 도로, 철길, 부지, 진입로를 순서대로 다시 렌더링 |
| 7 | 오브젝트 스프라이트를 파생 지형 위에 렌더링 |

## 핵심 의사코드

```text
onLayoutChanged(items):
    semanticItems = classify(items)

    roadGraph = buildPaths(semanticItems.roads)
    railGraph = buildPaths(semanticItems.rails)

    roadGraph += connectNearbyEndpoints(roadGraph)
    roadGraph += connectEndpointToPath(roadGraph)   // T자 연결
    railGraph += connectNearbyEndpoints(railGraph)

    lots = buildLotMasks(semanticItems.buildings)
    driveways = connectBuildingsToNearestRoad(lots, roadGraph)
    landscapeMasks = mergeInfluenceRegions(parks, forests, lots)

    terrain = renderFromGrass(
        landscapeMasks,
        roadGraph,
        railGraph,
        driveways
    )

    drawObjectsAbove(terrain)
```

## 현재 반응 규칙

| 에셋 유형 | 배치 반응 |
|---|---|
| 도로 | 중심선 기반 도로 재생성, 끝점 자동 스냅, 주변 도로와 연결, T자 연결 |
| 철길 | 노반·침목·레일 재생성, 가까운 철길과 연결 |
| 철도 건널목 | 도로와 철길을 동시에 생성하고 신호기 오브젝트만 위에 표시 |
| 건물 | 마름모형 부지 생성, 285px 안의 가장 가까운 도로에 곡선 진입로 생성 |
| 건물 주변에 도로 없음 | 가까운 공원이 있으면 보행로 생성 |
| 공원·놀이터 | 밝은 잔디 영역 생성, 겹치는 영역은 시각적으로 합쳐짐 |
| 숲 | 짙은 잔디 영향 영역 생성, 인접 숲과 자연스럽게 중첩 |
| 좌우 반전 | 오브젝트뿐 아니라 도로 경로와 건물 입구 방향까지 반전 후 재계산 |
| 삭제 | 남은 에셋만으로 전체 지형을 다시 만들어 삭제 영역을 풀밭으로 복구 |

## 구현 파일

| 환경 | 핵심 파일 |
|---|---|
| Windows 브라우저 | `windows-demo/terrain-engine.js`, `windows-demo/app.js` |
| Expo 모바일·웹 | `mobile-expo/src/data/terrainEngine.ts`, `mobile-expo/src/components/DynamicTerrain.tsx` |
| 알고리즘 테스트 | `tests/test_terrain_engine.js` |
