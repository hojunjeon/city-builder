# 기술 스택

| 영역 | 기술 | 역할 |
|---|---|---|
| Windows 테스트 앱 | HTML5, CSS, JavaScript, Pointer Events | 설치 없이 배치·드래그·좌우 반전 검증 |
| Windows 지형 렌더링 | HTML Canvas 2D | 풀밭부터 도로·철길·부지·진입로까지 한 장의 파생 배경으로 재생성 |
| 모바일·웹 앱 | Expo SDK 57, React Native, React | Android·iOS·웹 공통 코드베이스 |
| 모바일 지형 렌더링 | `react-native-svg` | 계산된 도로망·철길·지형 영역을 벡터로 렌더링 |
| 언어 | TypeScript | 배치 데이터와 지형 기하 타입 검증 |
| 터치·드래그 | `PanResponder`, `Animated` | 모바일·웹 공통 에셋 이동 |
| 저장 | AsyncStorage / LocalStorage | 배치 상태 저장, 지형은 저장하지 않고 다시 계산 |
| 에셋 처리 | Python, OpenCV, Pillow | 원본 시트 분리 및 오브젝트 지면 가장자리 완화 |
| 알고리즘 | 의미 분류, 끝점 그래프, 근접 탐색, 경로 샘플링, 마스크 합성 | 주변 배치에 반응하는 동적 지형 생성 |

## 저장 구조 원칙

저장 파일에는 에셋의 `assetId`, 위치, 좌우 반전, 레이어만 보관합니다. 도로 픽셀이나 지형 패치는 저장하지 않습니다. 불러올 때 현재 배치로부터 지형을 다시 계산하므로 이동·삭제 후 잔상이 남지 않습니다.
