# Mobile Expo App v3

Expo 기반 Android·iOS·웹 공통 도시 편집기입니다.

## 핵심 구조

| 파일 | 역할 |
|---|---|
| `src/data/terrainEngine.ts` | 에셋 의미 분류, 도로·철길 연결, 건물 진입로 계산 |
| `src/components/DynamicTerrain.tsx` | 계산된 배경 지형을 SVG로 렌더링 |
| `src/components/PlacedAssetView.tsx` | 오브젝트 선택·드래그·좌우 반전 표시 |
| `App.tsx` | 배치 변경 때 전체 지형 기하 재계산 |

도로와 철길 PNG는 팔레트에서 형태를 고르는 아이콘으로만 사용됩니다. 캔버스의 실제 도로·철길은 지형 엔진이 다시 그립니다.

## 실행

```powershell
npm install
npm run web
```

Android 네이티브:

```powershell
npx expo run:android
```

## 포함 기능

- 23개 에셋 선택·배치
- 터치·마우스 드래그
- 좌우 반전만 허용
- 도로·철길 끝점 스냅 및 자동 연결
- T자 연결
- 건물 부지와 자동 진입로
- 공원·숲 영향 영역
- 삭제 시 풀밭 복구
- 복제, 삭제, 앞·뒤 레이어
- AsyncStorage 저장·불러오기
