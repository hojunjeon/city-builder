# 소비 도시 빌더 v3: 이웃 반응형 동적 지형

## 핵심

**에셋을 배경 위에 붙이는 편집기가 아닙니다.** 에셋을 추가·이동·반전·삭제할 때마다 배치 관계를 분석하고 풀밭, 도로, 철길, 건물 부지, 진입로를 다시 생성합니다.

| 반응 | 구현 결과 |
|---|---|
| 도로끼리 가까움 | 끝점 자동 스냅 및 연결 구간 생성 |
| 도로 끝이 다른 도로 중간에 가까움 | T자 연결 생성 |
| 철길끼리 가까움 | 연속된 노반·침목·레일 생성 |
| 건물을 도로 근처에 배치 | 부지와 도로 사이 곡선 진입로 생성 |
| 건물을 도로 없이 공원 근처에 배치 | 공원까지 보행로 생성 |
| 에셋 이동·좌우 반전 | 주변 연결과 지형을 즉시 다시 계산 |
| 에셋 삭제 | 남은 에셋으로 지형을 재생성해 풀밭 복구 |

자세한 비교와 알고리즘은 `RESEARCH_AND_ALGORITHM.md`에 정리했습니다.

## 폴더

| 경로 | 용도 |
|---|---|
| `windows-demo/` | 설치 없이 실행하는 Windows 브라우저 버전 |
| `windows-demo/terrain-engine.js` | Canvas 기반 동적 지형·연결망 엔진 |
| `mobile-expo/` | Android·iOS·웹 공통 Expo 프로젝트 |
| `mobile-expo/src/data/terrainEngine.ts` | 모바일 공용 지형 기하 계산 엔진 |
| `mobile-expo/src/components/DynamicTerrain.tsx` | SVG 기반 파생 지형 렌더러 |
| `shared-assets/` | 원본, 팔레트 아이콘, 지면이 완화된 오브젝트 PNG |
| `tests/test_terrain_engine.js` | 연결·진입로·삭제 복구 알고리즘 테스트 |
| `PREVIEW_V3.png` | 실제 Windows 렌더러의 예시 화면 |

## Windows에서 바로 테스트

1. ZIP 압축을 풉니다.
2. `run_windows_demo.bat`을 실행합니다.
3. 브라우저가 로컬 파일 저장을 제한하면 `run_windows_server.bat`을 실행합니다.
4. `예시 배치` 버튼을 누르면 동적 연결 예시를 볼 수 있습니다.

## 조작

| 조작 | 방법 |
|---|---|
| 배치 | 에셋 선택 → 캔버스 클릭·터치 |
| 이동 | 배치된 에셋 드래그 |
| 좌우 반전 | 버튼 또는 Windows에서 `F` |
| 삭제 | 버튼 또는 Windows에서 `Delete` |
| 저장 | 자동 저장 또는 `저장` |
| 샘플 | `예시 배치` |

회전과 자유 크기 변경은 요구 범위에 따라 제외했습니다.

## Expo 실행

Node.js와 npm이 설치된 Windows에서:

```powershell
cd mobile-expo
npm install
npm run web
```

Android Studio와 Android SDK가 준비된 경우:

```powershell
cd mobile-expo
npm install
npx expo run:android
```

## 알고리즘 테스트

```powershell
node tests\test_terrain_engine.js
```

## 주의

- 단일 사용자 로컬 프로토타입입니다.
- 서버 동기화, 계정, 협업 편집은 포함하지 않았습니다.
- 제공된 이미지와 파생 에셋의 공개·상업 이용 권한은 별도로 확인해야 합니다.
