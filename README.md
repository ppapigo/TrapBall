# TrapBall

웹에서 플레이: [https://ppapigo.github.io/TrapBall/](https://ppapigo.github.io/TrapBall/)

Phaser 3 + JavaScript + Vite로 만든 2D 탑다운 1대1 축구 게임 MVP입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

Production build와 로컬 확인:

```bash
npm run build
npm run preview
```

## 조작

- Build: 마우스 왼쪽 클릭으로 Wall 설치, 오른쪽 클릭 또는 Enter로 경기 시작
- Play: WASD 이동, 마우스 조준, 왼쪽 클릭 Kick
- 먼저 3점을 얻으면 승리합니다.

## GitHub Pages

`main` 브랜치에 push하면 GitHub Actions가 자동으로 `dist/`를 배포합니다. 저장소의 **Settings > Pages > Source**를 **GitHub Actions**로 설정하세요.

배포 URL 형식: `https://<USERNAME>.github.io/<REPOSITORY>/`

저장소 이름은 workflow가 자동으로 base 경로에 사용합니다. 직접 빌드할 때는 `VITE_BASE_PATH=/REPOSITORY/ npm run build` 형태로 지정할 수 있습니다.
