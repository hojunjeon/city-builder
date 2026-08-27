# 소비 도시 빌더 프로토타입

제공된 두 이미지를 사용한 도시 제작 기능입니다.

- 첫 번째 이미지: 23개 투명 PNG 에셋으로 분리
- 두 번째 이미지: 캔버스의 선택형 참고 이미지로 사용
- 지원 편집: 선택, 배치, 드래그 이동, **좌우 반전**, 복제, 삭제, 앞·뒤 레이어
- 제외 편집: 회전, 자유 크기 변경
- 부가 기능: 격자 스냅, 샘플 도시, 로컬 저장·불러오기

## 폴더

| 경로 | 용도 |
|---|---|
| `windows-demo/` | 설치 없이 실행하는 Windows 브라우저 데모 |
| `mobile-expo/` | Android·iOS·웹 공통 Expo/React Native 프로젝트 |
| `shared-assets/` | 원본 이미지, 분리된 에셋, 에셋 메타데이터 |
| `tools/extract_assets.py` | 에셋 시트를 다시 분리하는 스크립트 |
| `TECH_STACK.md` | 기술 스택 표 |

## Windows에서 바로 테스트

### 가장 빠른 방법

1. 압축을 풉니다.
2. 루트의 `run_windows_demo.bat`을 실행합니다.
3. 에셋을 선택하고 캔버스 빈 곳을 클릭합니다.
4. 배치된 에셋은 드래그로 옮기고, 상단의 `좌우 반전` 버튼으로 뒤집습니다.

브라우저가 로컬 파일 저장을 제한하면 `run_windows_server.bat`을 사용합니다. 이 방식은 Windows의 Python Launcher(`py`)가 필요합니다.

## Expo 앱을 Windows에서 웹으로 테스트

요구 환경: Node.js 22.13 이상

```powershell
cd mobile-expo
npm install
npm run web
```

또는 루트의 `run_expo_web.bat`을 실행합니다.

## Android 네이티브 테스트

Android Studio와 Android SDK가 설치된 Windows PC에서 실행합니다.

```powershell
cd mobile-expo
npm install
npx expo run:android
```

`expo run:android`는 필요 시 `android/` 네이티브 프로젝트를 생성합니다.

## 주요 조작

| 조작 | 방법 |
|---|---|
| 에셋 배치 | 에셋 선택 → 캔버스 빈 곳 클릭/터치 |
| 에셋 선택 | 배치된 에셋 클릭/터치 |
| 이동 | 선택한 에셋 드래그 |
| 좌우 반전 | `좌우 반전` 버튼 또는 Windows 데모의 `F` 키 |
| 삭제 | `삭제` 버튼 또는 Windows 데모의 `Delete` 키 |
| 레이어 | `앞으로`, `뒤로` 버튼 |
| 저장 | 자동 저장 또는 `저장` 버튼 |
| 참고 이미지 | `참고 이미지` 토글 |

## 에셋 재추출

```bash
pip install pillow numpy opencv-python
python tools/extract_assets.py \
  shared-assets/source_asset_sheet.jpg \
  shared-assets/sprites \
  shared-assets/asset_manifest.json
```

## 범위와 주의사항

- 현재 버전은 단일 사용자 로컬 프로토타입입니다.
- 서버 동기화, 계정, 협업 편집은 포함하지 않았습니다.
- 제공 이미지의 상업적 배포 권한은 별도로 확인해야 합니다. 이 패키지는 사용자가 제공한 이미지를 기능 검증용으로 포함합니다.
