# 기술 스택

| 영역 | 기술 | 적용 이유 |
|---|---|---|
| 모바일·웹 공통 앱 | Expo SDK 57, React Native 0.86, React 19 | Android·iOS·웹을 한 코드베이스로 유지 |
| 언어 | TypeScript | 배치 데이터와 에셋 타입 오류 방지 |
| 편집 인터랙션 | React Native `PanResponder`, `Animated` | 터치와 마우스 드래그를 추가 라이브러리 없이 처리 |
| 로컬 저장 | `@react-native-async-storage/async-storage` | 모바일과 웹에서 도시 배치 상태 저장·복구 |
| Windows 즉시 테스트 | HTML5, CSS, JavaScript, Pointer Events | 설치 없이 `index.html`을 열어 기능 확인 |
| 에셋 처리 | Python, OpenCV, Pillow | 원본 시트에서 23개 에셋을 투명 PNG로 자동 분리 |
| 배포 확장 | Expo Web / EAS 또는 네이티브 빌드 | 프로토타입 검증 후 앱 패키징 가능 |
