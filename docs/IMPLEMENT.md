# docatlas 구현 계획

문서 기준: 2026-10-28.
[요구사항](./REQUIREMENTS.md) · [설계](./DESIGN.md) · [수동 검증](./MANUAL_TEST_CHECKLIST.md)

## 현재 상태와 작업 순서

- 완료: 독립 패키지 뼈대, 공개 저장소, 도움말·버전 CLI, 초기 패키징 검증.
- 완료: Phase 1 문서 수집 API, 기능 계층, 선택 설정과 자동 검증.
- 완료: Phase 2 CLI·로컬 서버·카드 지도·Markdown source 표시.
- 완료: Phase 3 Markdown 서식/원문·목차·상대 참조·이미지·탐색 복원.
- 완료: Phase 4 검색·변경 감지·명시적인 문서 이동 연결과 현재 탐색 보존.
- 기본 실행 정책: 터미널에서 서버 유지, Ctrl+C로 종료.
- 완료: Phase 5 Test Hardening. Node 93개·Chrome 34개와 F-08 성능 측정·회귀 기준 기록.
- 진행 중: Phase 6 Integration Test. 별도 설치 자동 검증은 Node 22.12.0·24.22.1에서 통과했다.
  전체 수동 인수·선언한 Node 22.0·최종 지원 OS 검증은 남아 있다.
- 완료: 0.2.0의 추가 수집 옵션·설정 파일명·검색 경로 탐색을 사용자가 npm 배포했다.
  Python·Java 기본 제외와 에이전트 스킬 설치를 포함한 0.3.0도 사용자가 게시했다. 맨 아래 현재 인계가 최신 상태다.
- 완료: 검색 결과의 경로에서 트리 위치 찾기. 최신 문법 51개·Chrome 40개·설치 통합 4개 통과.
- 완료: RQ-16·17·18 에이전트 스킬 관리와 설치의 구현·자동 검증·Windows/macOS CI·Claude Code 실제 세션 확인과 PR #1 병합.
  Codex 실제 세션 확인과 남은 수동 인수는 별도다. 0.3.0은 사용자가 npm에 게시했다(2026-10-28 registry latest 확인).
- 완료: RQ-19 저장소 소개와 DDD 본거지 문서와 이전 인계 정리. 제품 코드는 바꾸지 않았다. M-18 사람 확인은 남아 있다.

기술 선택은 각 단계에서 근거와 검증을 기록해 DC/IC를 해소한다.
상세 계약을 바꾸면 요구사항·설계·단계·수동 기준을 같은 작업에서 갱신한다.
미구현 명령이나 테스트 스크립트를 이미 사용할 수 있는 것으로 안내하지 않는다.

## Phase 0 — 공개 프로젝트 부트스트랩: 완료

- [x] 독립 package manifest와 CLI 실행 진입점.
- [x] README, AGENTS.md와 기준 4종 문서.
- [x] 문법·CLI·문서 링크·tarball 설치 검사.
- [x] 공개 GitHub 저장소와 main 초기 push.

기준 검증: npm run check, help/version/잘못된 인자, npm pack과 별도 설치.
종료 기준: 공개 main에서 문서와 실행 가능한 뼈대를 확인한다.
검증 결과는 아래 기존 이력을 따른다.

## 계획 문서 구체화 — 완료

- [x] 확인된 요구와 설계 제안, 현재 구현 상태를 구분한다.
- [x] 독립 CLI·카드·4종 문서·Markdown 읽기의 인수 기준을 연결한다.
- [x] 포그라운드 실행과 Ctrl+C 종료라는 사용자 선택을 반영한다.
- [x] 발견·계층·설명·설정·CLI·링크의 구체적인 초안을 작성한다.
- [x] 단계별 기준 테스트와 종료 기준을 작성한다.
- [x] Test Hardening과 Integration Test를 별도 단계로 둔다.
- [x] 상대 링크·식별자·4종 문서 정합성을 검사한다.

기준 검증: 문서 링크와 RQ/PR/DC/IC/M 참조, 사용자 선택과 현재 코드의 구분.
종료 기준: 기준 4종이 모순 없이 연결되고 남은 결정의 해소 단계가 분명하다.

## Phase 1 — 문서 수집기와 계층: 완료

대응: RQ-01·03·05, PR-03·07 / DC-04·05, IC-01.

- [x] F-01~03의 가상 문서 프로젝트와 예상 인덱스를 작성한다.
- [x] 테스트 실행 명령을 정하고 수집기 기준 테스트를 함께 추가한다.
- [x] 기본 발견, 제외·ignore 우선순위와 경로 경계를 확정한다.
- [x] docs 안의 Markdown과 docs 밖의 표준 문서를 발견한다.
- [x] 원본 경로로 문서 종류와 그룹 id를 정한다.
- [x] 상위 자체 문서·하위 기능·구조 그룹을 구성한다.
- [x] 제목·설명 추출과 선택 설정의 첫 계약을 구현한다.
- [x] 읽기 실패·빈 결과·잘못된 설정을 구분한다.
- [x] 수집기가 화면과 서버 없이 테스트되도록 모듈을 분리한다.

기준 테스트: F-01의 발견 문서 8개와 관계, 부분 4종, README, 한글·공백,
동명 그룹, docs 밖의 표준 문서, 제외 경로, 일관된 정렬, 설정 오류.
경로 경계는 가상 루트 밖의 더미 파일로 검증한다.

종료 기준: 같은 입력에서 같은 지도 모델을 만들고 M-01·02·09·13·14의 수집
조건을 자동 검증한다. DC-04·05의 구현 계약과 근거가 설계에 기록되어야 한다.

## Phase 2 — 포그라운드 서버와 문서 지도: 완료

대응: RQ-02·04·05·08, PR-01·06 / DC-06·08, IC-02·03.

- [x] 화면 도구·빌드 방식과 계획된 CLI 옵션을 확정한다.
- [x] cwd 기본 루트와 --root를 처리한다.
- [x] loopback 서버, 사용 가능한 포트, 준비 완료 안내를 구현한다.
- [x] 브라우저 열기와 --no-open을 구현한다.
- [x] 가로 카드·설명·하위 그룹·문서 선택 항목을 표시한다.
- [x] 화살표·카드 본문·문서 항목의 동작을 구분한다.
- [x] 서버는 터미널에서 유지하고 Ctrl+C로 자신의 자원을 정리한다.
- [x] 여러 실행의 루트와 종료 대상을 구분한다.
- [x] 문서 0개·설정 오류·브라우저 실행 실패 상태를 안내한다.

기준 테스트: 다른 cwd/명시 루트, 준비 전 브라우저 접근 방지, 두 서버의 루트
분리, 한 서버 종료가 다른 서버에 미치는 영향, 신호 정리, 긴 제목, 키보드 탐색.

종료 기준: CLI로 지도를 열어 디스크의 실제 문서 목록을 선택하고 정상 종료한다.
이 단계의 본문 표시가 미완성이라면 현재 상태를 명확히 안내한다.
M-03·08과 M-12·14의 실행 조건을 확인한다.

## Phase 3 — Markdown 읽기와 링크: 완료

대응: RQ-06, PR-01·04 / DC-06·07, IC-01.

- [x] Markdown·제목 앵커·HTML 처리·이미지 허용 범위를 확정한다.
- [x] 선택 문서를 렌더링하고 지도와 본문의 위치를 분리한다.
- [x] 표·코드·목차와 긴 콘텐츠를 처리한다.
- [x] 상대 Markdown 링크·앵커·이미지를 원본 위치 기준으로 해석한다.
- [x] 문서 간 이동과 뒤로 가기, 현재 선택 표시를 연결한다.
- [x] 수집 범위 밖·없음·제외됨·코드 링크를 구분한다.
- [x] 좁은 화면의 지도/본문 전환과 키보드 포커스를 검토한다.

기준 테스트: F-04의 한글·공백 링크, 앵커·표·코드, 삭제된 대상,
프로젝트 밖 참조와 지원하지 않는 프로토콜. 렌더링 정책을 실제 브라우저에서도 확인한다.

종료 기준: M-03·04·06·13·15로 탐색 → 문서 선택 → 읽기 → 관련 문서 이동을
재현한다. RQ-01~06·08을 충족하는 첫 사용 가능 단계이며 전체 배포 완료는 아니다.

## Phase 4 — 검색·변경 반영·이동 문서: 완료

대응: PR-02·05·08, PR-06의 탐색 상태 / DC-09, IC-03.

- [x] 검색 필드·정렬·일치 문맥과 갱신 계약을 확정한다.
- [x] 기능명·문서명·경로·본문의 한글/영문 검색을 구현한다.
- [x] 문서 수정·추가·삭제로 스냅샷을 갱신한다.
- [x] 문서 선택·읽기 위치와 삭제 안내를 유지한다.
- [x] 설정에 명시한 이전 경로를 현재 문서로 연결한다.
- [x] 이동 연결의 순환·없는 대상·오탐을 처리한다.
- [x] 열린 프로젝트·탭 사이의 탐색 상태를 분리한다.

기준 테스트: F-05의 이동 연결, F-06의 두 프로젝트, 저장 이벤트 연속 발생,
선택 문서 삭제, 갱신 전후 검색 결과와 오류 복구.

종료 기준: M-05·07·10을 만족하고 수집기·지도·뷰어 회귀를 통과한다.
기존 문서의 내용만으로 이동을 임의 판단하지 않는다.

## Phase 5 — Test Hardening: 완료

대응: 구현된 전체 요구사항과 결정.

이번 보강: 감지기 시작/교체 중 종료와 오류, 열린 SSE의 종료, 제외/심볼릭 링크 경계,
긴 한글 경로·동명 문서·큰 표·키보드 포커스를 재현한다. F-08의 생성기와 반복 측정 명령을
남기고 수집/검색/저장 반영/유휴 CPU/메모리를 측정한 다음 로컬 회귀 기준을 정한다.

- [x] 각 이전 단계의 회귀를 실행하고 새 실패 경로를 보강한다.
- [x] 빈 폴더·읽기 실패·잘못된 설정·중복 제목·긴 경로.
- [x] 경로 정규화·심볼릭 링크·허용 범위 밖 파일.
- [x] 반복 시작·종료·감지기/타이머 정리·브라우저 실행 실패.
- [x] 한글·공백·큰 표·좁은 화면·키보드와 포커스 표시.
- [x] F-08 300개 문서에서 수집·검색·갱신을 측정한다.
- [x] 측정 환경·시간·메모리와 채택할 성능 기준을 기록한다.

기준 테스트: 이전 단계의 전체 회귀와 F-02~06·08의 경계 예제.
통과한 검사를 이유 없이 반복하기보다 새 변경과 남은 문제에 필요한 검증을 선택한다.

종료 기준: 주요 실패 경로에 재현 가능한 검증이 있고 남은 결함의 처리 방침이 있다.
성능 기준은 측정 후 확정하며 문서 개수를 지원 상한으로 오해하게 하지 않는다.

## Phase 6 — Integration Test: 자동 검증 완료·인수 진행 중

대응: RQ-01·02·08과 전체 사용자 흐름.

2026-10-28 재개: npm run test:integration에 F-07의 설치·화면·다중 실행·원본 해시 비교를
재현 가능하게 묶는다. 설치는 production-only/offline이며 DOCMAP_NPM_CACHE로 캐시를 지정한다.
이 자동 검증의 성공과 지원 환경·사람의 수동 인수 완료를 구분한다.

- [x] 실제 tarball을 별도 임시 설치 위치에 설치한다.
- [x] F-07의 JavaScript/비 JavaScript 가상 프로젝트를 실행한다.
- [x] 설치 위치·cwd·--root가 달라도 올바른 문서를 읽는다.
- [x] 카드 → 4종 문서 → Markdown → 링크 → 원본 저장 → 갱신을 확인한다.
- [x] 두 실행 중 하나만 Ctrl+C에 해당하는 SIGINT로 종료하고 나머지의 갱신을 확인한다.
- [x] npm 패키지에 화면·런타임 자산이 실제 포함되는지 검사한다.
- [x] 대상 프로젝트 원본과 설정에 의도하지 않은 쓰기가 없는지 확인한다.
- [ ] 지원할 최소 Node와 OS의 검증 결과를 기록한다.
  현재 macOS 15.6.1 / Node 22.12.0·24.22.1 통과. 선언한 22.0·최종 지원 OS는 미검증/TBD다.
- [ ] M-01~15의 남은 수동 인수를 수행하고 최종 결과를 기록한다.

기준 테스트: F-07의 설치 tarball로 실행한 실제 CLI/브라우저 검증과 M-01~15.
소스 저장소 안에서만 동작하는 결과를 설치 성공으로 간주하지 않는다.

종료 기준: 합의된 제품 범위의 모든 필수 M 항목이 pass이고 설치 위치와 무관하게
핵심 흐름이 재현된다. 제안 기능을 제외하면 4종 문서도 같은 범위로 정리한다.

## Phase 7 — 배포 준비

대응: DC-10과 설치·배포 계약.

- [x] 사용자 선택: MIT·npm docatlas·GitHub superlucky84/docatlas. 레지스트리 등록 여부는 배포 직전 다시 확인한다.
- [ ] 실제 검증된 최소 Node·지원 OS를 문서화한다.
- [ ] 구현된 명령과 설정으로 README·도움말·예제를 정리한다.
- [ ] 확정한 환경에서 CI와 패키지 검사를 구성한다.
- [ ] 배포할 버전·파일 목록·검증 결과를 정리한다.
- [ ] 확정된 배포 대상에 릴리스한다.

기준 테스트: 공개 예정 tarball의 설치·실행과 필수 인수 항목.
종료 기준: 라이선스와 배포 대상이 확정되고 실제 설치 가능한 릴리스가 있다.
GitHub 초기 생성은 이 단계의 npm 배포를 대신하지 않는다.

## 프로젝트별 설치와 docmap 명령 — 완료

2026-10-28 사용자 요청. 대응: RQ-09 / DC-11 / M-08·11.

- [x] 기준 4종에 프로젝트별 개발 의존성 설치·명령 이름·로컬 PATH의 실행 계약을 기록한다.
- [x] docmap bin을 추가하고 ddd-docmap 호환 이름과 같은 CLI로 연결한다.
- [x] 도움말·오류 안내·README의 설치와 실행 예제를 갱신한다.
- [x] Test Hardening: 두 이름의 도움말·버전·잘못된 인자·로컬 명령 발견을 검증한다.
- [x] 회귀 중 확인한 테스트 정리 순서를 보강한다. 테스트 임시 루트를 삭제하기 전에
  서버·감지기를 먼저 닫아 부모 임시 디렉터리 polling이 남는 경합을 방지한다.
- [x] Integration Test: 실제 tarball을 JS 대상의 개발 의존성으로 설치하고 .bin/docmap으로
  cwd 수집·읽기·갱신·신호 종료와 설치 이후 원본 보존을 검증한다.
- [x] npm run check, npm test, npm run test:integration, npm pack --dry-run과 문서 정합성을 확인한다.

기준 테스트: Node 93개, 기존 설치 통합 4개, public bin ddd-docmap의 이전 동작.
종료 기준: 로컬 설치가 docmap과 호환 명령을 제공하고 해당 프로젝트의 문서를 읽는다.
사용자는 npx docmap / pnpm docmap을 선택했다. 전역 런처/PATH 자동 변경은 추가하지 않는다.
실제 대상 프로젝트 설치는 별도 실행 단계다.

검증 기록: npm run check의 JavaScript 47개, npm test의 Node 93개와 설치 통합 4개가 통과했다.
통합 테스트는 docmap/ddd-docmap의 npm exec 도움말·버전, npm run docmap,
알 수 없는 인자의 종료 2, JS 대상의 실제 개발 의존성 설치와 .bin/docmap의 cwd 실행을 확인한다.
브라우저의 읽기·검색·갱신·SIGINT 종료·다른 실행 유지와 설치 후 파일 해시 보존도 통과했다.

첫 전체 회귀는 live.test.js의 검사가 끝난 뒤 StatWatcher 하나가 부모 임시 디렉터리를 감시해 종료되지 않았다.
해당 프로세스만 진단·종료했고, 서버/감지기를 닫은 다음 임시 루트를 삭제하도록 테스트 정리 순서를 바꿨다.
이후 Node 93개 전체가 약 7.5초에 정상 종료했다. 제품 감지기 코드는 이번에 변경하지 않았다.

문서 6개의 로컬 링크/앵커 32개·요구/결정/인수 ID 46개·Phase 0~7 검증 관문과
manifest/lockfile의 두 bin 일치가 통과했다. npm pack --dry-run은 런타임 파일 35개를 확인했다.
추가 임시 설치에서 pnpm 10.13.1의 pnpm docmap --help / --version도 통과했다.
로컬 설치용 tarball: /private/tmp/superlucky84-ddd-docmap-0.0.0-dev.0.tgz.

## docatlas 이름 변경과 MIT 배포 준비 — 완료

2026-10-28 사용자 선택: npm name과 명령은 docatlas, GitHub 저장소도 superlucky84/docatlas,
라이선스는 MIT다. 대응: RQ-09·10 / DC-12 / M-08·11.

- [x] 기준 4종에 새 이름·라이선스·파일 목록과 이전 명령/설정의 호환 정책을 기록한다.
- [x] package.json·lockfile·공개 import·실행 파일·도움말·화면·README를 함께 갱신한다.
- [x] MIT LICENSE와 최초 공개 후보 버전 0.1.0, npm 공개 배포 설정을 준비한다.
- [x] Test Hardening: 세 명령 이름·버전·오류·패키지 파일 목록·공개 import를 검증한다.
- [x] Integration Test: docatlas tarball을 별도 설치해 cwd·읽기·검색·갱신·원본 보존·신호 종료를 검증한다.
- [x] npm run check, npm test, Chrome 전체 회귀, 설치 통합, npm pack --dry-run, npm publish --dry-run과 문서 정합성을 확인한다.
- [x] GitHub 저장소를 docatlas로 바꾸고 동일 저장소 ID·새 URL과 로컬 origin을 확인한다.
- [x] npm 등록 가능 여부와 로그인 상태, 실제 배포 여부·남은 작업을 기록한다.
- [x] README의 미설치/설치 실행 방법·cwd 루트·tarball·옵션을 docatlas 기준으로 정리한다.
- [x] 이번 변경을 커밋하고 새 GitHub 저장소에 반영한 뒤 원격 README를 확인한다.

기준 테스트: Node 93개·Chrome 34개·설치 통합 4개, 현재 origin의 공개 저장소와 기존 명령.
종료 기준: 이름·라이선스·파일 목록이 일치하는 tarball과 새 GitHub 저장소를 확인한다.
npm 로그인·수동 인수·최종 지원 환경·실제 npm 배포는 각각 실행 결과를 구분해 기록한다.
사용자는 이번에는 배포 준비까지만 진행하도록 선택했다. 실제 npm publish는 실행하지 않는다.

검증: macOS 15.6.1 / Node 22.12.0 / Chrome 156.0.8078.48.
문법 48개·Node 93개·Chrome 34개·최종 bin 경로의 설치 통합 4개가 통과했다.
기준 4종·README·AGENTS의 링크/앵커 33개(새 GitHub 문서 링크도 로컬 원본에 대응해 확인),
요구/결정/인수 ID 48개와 Phase 0~7 검증 관문이 통과했다. manifest/lockfile의 name/version/license/세 bin도 일치한다.

배포 후보는 /private/tmp/docatlas-0.1.0.tgz다. npm pack·publish dry-run에서 28개 파일을 확인했다.
초기 publish dry-run의 bin 경로 정규화 경고는 ./ 접두사를 제거한 뒤 해소했다.
최종 세 명령과 공개 import·브라우저 브랜드·읽기/검색/갱신·원본 보존·신호 종료를 설치 통합으로 다시 확인했다.

GitHub 저장소는 https://github.com/superlucky84/docatlas로 변경했다.
저장소 ID 1435263800(GraphQL R_kgDOVYxjOA)이 유지됐고 origin의 fetch/push URL도 새 주소다.
npm 레지스트리의 docatlas 조회는 404였으며 이름 확보는 아직 하지 않았다.
npm whoami는 샌드박스 DNS 실패 뒤 허용된 네트워크에서 재확인했지만 401 Unauthorized였다.
사용자가 배포 준비까지만 선택했으므로 실제 배포는 수행하지 않는다. 이후 배포 시 재로그인이 필요하다.

README 실행 예제를 추가 검증했다. 프로젝트 manifest/node_modules가 없는 임시 대상에서
tarball을 지정한 npm exec의 일회성 실행이 0.1.0을 출력했고 대상에는 문서 외 파일이 생기지 않았다.
같은 tarball을 로컬 개발 의존성으로 설치한 뒤 npm exec와 pnpm 10.13.1의 docatlas 실행도
0.1.0을 출력했다. 원본 문서 내용이 유지됨을 확인했다. registry 이름으로 실행하는 예제는 배포 후 사용하도록 표시했다.

구현 커밋 e9977a4(feat: rename package and CLI to docatlas)를 새 origin의 main에 push했다.
GitHub에서 README와 package.json을 다시 읽어 새 이름·MIT·실행 안내를 확인했다.
README blob은 95f8d2ddfaa425509fca908ac194109203c72301이며 설치 여부별 사용법과 cwd 기본 루트를 설명한다.

## 수집 범위와 설정 안내 — 0.2.0 구현 완료

대응: RQ-11·12 / DC-13 / M-01·07·09·11·13. 기준 커밋은 ceb5b3e다.
배포된 0.1.0은 보존하며 새 공개 후보는 0.2.0으로 준비한다. 실제 npm 배포는 이번 범위에 포함하지 않는다.

### 범위·설정 구현

- [x] 기준 4종에 두 CLI 옵션·새 파일 우선/fallback·원본 경계·설정 우선순위를 먼저 기록한다.
- [x] collectProject/scan/store/CLI에 독립적인 수집 옵션을 전달한다.
- [x] docatlas.config.json을 우선하고 이전 파일은 fallback하며 두 파일을 감지한다.
- [x] 실제 사용한 설정 파일을 오류/경고에 표시한다. CLI 옵션은 설정 갱신 후에도 유지한다.
- [x] --help와 README에 옵션·설정 필드 전체·예제·기본값 대체를 설명한다.

기준 테스트: 문법 48개·Node 93개·Chrome 34개·설치 통합 4개와 기존 수집·접근 정책.
종료 기준: 기본 동작은 유지하며 추가 폴더/전체 Markdown과 새/이전 설정 파일이 같은 세대로 동작한다.

### Test Hardening

- [x] CLI/설정 조합·반복 경로·한글/공백·리터럴 glob 문자·잘못된 경로·node_modules/.git·ignore·symlink를 검증한다.
- [x] 두 설정 파일의 우선순위·오류 위치·생성/삭제/fallback과 마지막 정상 인덱스·복구를 검증한다.
- [x] 추가 폴더의 생성/삭제와 옵션 유지, 문서/이미지 요청 시 새 제외 규칙 재검증을 확인한다.

기준 테스트: 기존 전체 회귀와 수집/설정/CLI/live/reading-server 경계 테스트.
종료 기준: 새로운 포함 옵션도 기존 파일 정책과 종료·세대 일관성을 지키며 재현한 실패가 해소된다.

### Integration Test와 문서 반영

- [x] 0.2.0 tarball 설치 CLI에서 --docs-dir와 --all-md, 새 설정과 이전 fallback을 검증한다.
- [x] 문법·Node·Chrome·설치 통합·pack/publish dry-run·문서/설정 예제 정합성을 확인한다.
- [x] 기존 Confluence 팀 가이드에 전체 설정과 이름 변경·옵션 사용법을 배포 버전과 구분해 반영한다.

기준 테스트: 실제 설치 패키지의 지도/검색/읽기/저장 갱신/원본 보존과 기존 다중 실행/신호 종료.
종료 기준: 실행 가능한 0.2.0 후보와 정확한 README/--help/팀 가이드를 제공하고 실제 npm 배포 여부를 명시한다.

### 0.2.0 완료 검증 — 2026-10-28

환경: macOS / Node 22.12.0 / arm64 / Chrome 156.0.8078.48. 이번 변경에서 Node 24·다른 OS를 재검증한 것으로 표시하지 않는다.

| 검증 | 결과 |
| --- | --- |
| npm run check | JavaScript 50개 통과 |
| npm test | 109개 통과. discovery/config/CLI/live/reading-server와 기존 경계·검색·종료 회귀 포함 |
| DOCMAP_BROWSER_CHANNEL=chrome npm run test:browser | 34개 통과 |
| DOCMAP_BROWSER_CHANNEL=chrome DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm run test:integration | 4개 통과. 실제 production-only/offline tarball의 JS 10문서·비 JS 11문서, 새 옵션·새/이전 설정·API·읽기·갱신·원본 해시·신호 종료 |
| npm pack --dry-run / npm publish --dry-run | docatlas@0.2.0, 실행 파일·options 모듈·README·LICENSE 포함 29개 파일. 실제 npm 게시 없음 |
| Markdown/JSON 예제 | README·기준 4종·팀 가이드의 JSON 7개와 로컬 링크 27개·이미지 5개 확인. 설정 예제는 실제 loader로 검증 |
| Confluence | 기존 페이지 1735491669를 버전 3으로 갱신. 이미지 5장·대상 페이지 1개 동기화, 기존 다른 변경 파일 7개 보존 |

팀 가이드: 사내 Confluence 페이지 ID 1735491669.
로컬 원본은 ~/project/confluence/page/share/1735491669.md다. 0.1.0 배포본과 0.2.0 후보의 차이를 명시했다.
Confluence의 다른 문서가 함께 게시되지 않도록 원본 publish/sync 명령을 대상 페이지만 담은 임시 작업 폴더에서 실행했다.

다음: 실제 프로젝트의 사용성 인수·npm 0.2.0 별도 배포·남은 지원 환경 검증.
기술적 차단 없음. 최신 확인 커밋은 ceb5b3e이며 이번 변경은 미커밋이다. 기존 인계는 이전 단계의 기록으로 보존한다.

## 검색 결과에서 트리 위치 찾기 — 구현 완료

대응: RQ-13 / DC-14 / M-03·05·07·12. 0.2.0 준비본에 추가하며 실제 npm 배포는 하지 않는다.

### 구현

- [x] 기준 4종에 경로 버튼·검색 해제·트리 펼침/스크롤/초점·현재 본문 보존 계약을 기록한다.
- [x] 검색 결과의 경로를 별도 동작으로 표시하고 현재 트리의 문서를 찾는다.
- [x] 진행 중인 검색/사용자 열기 요청과 초점·스크롤·모바일 지도 전환을 처리한다.
- [x] README의 검색 사용법을 갱신한다.

기준 검증: 현재 Node 109개·Chrome 34개·설치 통합 4개와 검색/지도/읽기 이력 계약.
종료 기준: 제목의 문서 열기와 경로의 트리 탐색이 독립적으로 동작한다.

### Test Hardening

- [x] 접힌 다단계·루트/한글/동명/긴 경로·키보드·모바일·본문/원문/위치 보존을 검증한다.
- [x] 검색 및 사용자 열기의 늦은 응답·자동 갱신·초점 보존·삭제·이전 경로의 현재 위치를 검증한다.

기준 검증: browser search/live/hardening 시나리오와 독립 지도/본문 스크롤.
종료 기준: 경로 찾기 뒤 검색이 되살아나거나 오래된 문서 이동이 화면을 덮어쓰지 않는다.

### Integration Test

- [x] 문법·전체 Chrome·실제 설치 tarball 검색→경로→트리→본문 흐름과 pack dry-run을 확인한다.
- [x] README·기준 4종과 최신 검증/인계를 정리한다.

기준 검증: 설치된 0.2.0 패키지·원본 보존·기존 읽기/갱신/종료.
종료 기준: npm 재배포 없이 검토 가능한 준비본과 검증 근거를 제공한다.

### 검색 경로 탐색 완료 검증 — 2026-10-28

- npm run check: JavaScript 51개 통과.
- DOCMAP_BROWSER_CHANNEL=chrome npm run test:browser: 전체 40개 통과. 새 search-path.spec.js의 6개와 기존 검색/이력/읽기 회귀 포함.
- DOCMAP_BROWSER_CHANNEL=chrome DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm run test:integration: 4개 통과.
  실제 설치된 추가 디렉터리 문서를 검색 → 경로 클릭 → 트리 초점/강조 → 본문 열기로 확인했고 기존 원본 해시·갱신·종료도 통과했다.
- npm pack --dry-run: 29개 파일. 수집기/서버 계약은 이번 UI 작업에서 바꾸지 않았다. 직전 Node 전체 109개 통과 기록은 위 수집 범위 단계에 있다.
- Chrome 156.0.8078.48 / Node 22.12.0 / macOS arm64. 모바일 390×844와 데스크톱 1440×1000을 검증했다.
- 가상 예제의 검색/트리 이동 캡처 2개를 /private/tmp/docatlas-search-path-preview/에 남기고 경로 표시·대상 테두리·본문 유지를 시각 확인했다.
  기존 Confluence 가이드는 이번 검색 기능으로 추가 게시하지 않았다.

## Python·Java 기본 제외와 Windows 점검 — 구현·로컬 검증 완료

대응: RQ-14·15 / DC-15 / M-01·07·08·09·11·12·13. 기준 커밋 1ec2bd6, 새 후보 0.2.1.

### 구현

- [x] 기본 제외와 Windows 경로/신호·검증 한계를 기준 4종에 먼저 기록한다.
- [x] 언어별 생성 폴더의 기본 제외와 README 전체 목록·설정 대체·OS 사용법을 반영한다.
- [x] Windows와 macOS에서 실행할 플랫폼 검증 명령과 CI를 준비하고 파일명/실행기 가정을 점검한다.
- [x] 배포된 0.2.0과 다음 후보를 구분하고 문서의 기본 실행 예제는 고정 버전 없이 유지한다.

기준 검증: 문법 51개·Node 109개·Chrome 40개·설치 통합 4개.
종료 기준: 기본 제외 확장이 기존 설정/원본 정책을 유지하고 Windows 실행·검증 범위를 정확하게 안내한다.

### Test Hardening

- [x] Python·Java 가상 프로젝트에서 루트/중첩 생성 폴더를 탐색하지 않고 일반/유사 이름 소스 문서를 보존한다.
- [x] include/CLI 조합·exclude 대체·ignore·기존 읽기/감지 경계·설정 변경 복구를 확인한다.
- [x] 네이티브 경로·한글/공백·CRLF·링크/이미지·라이브 갱신과 주입 신호의 정상 정리를 검증한다.
- [x] 플랫폼 공통 검증 대상에서 Windows 불가 파일명을 보정하고 .cmd/심볼릭 링크/강제 종료를 혼동하지 않는다.
  기존 전체 Node/설치 통합의 POSIX 전제는 남아 있으므로 Windows 전체 통과를 주장하지 않는다.

기준 검증: 기능 테스트·서버/CLI 수명주기·플랫폼 공통 테스트와 기존 전체 회귀.
종료 기준: 언어별 제외가 과도한 일반 경로 제외나 접근 정책 우회를 일으키지 않는다.

### Integration Test

- [x] 실제 tarball 플랫폼 검증으로 npm 실행 shim·별도 위치/manifest 없는 대상·API/CLI·원본 보존을 확인한다.
- [x] 문법·Node·플랫폼·Chrome·설치 통합·pack dry-run·문서/설정 예제를 확인한다.
- [x] Windows CI를 준비하되 로컬 macOS 결과와 미실행 원격/수동 항목을 분리해 인계한다.

기준 검증: production-only tarball과 기존 탐색·검색·갱신·종료 및 Node 22/24 CI 행렬.
종료 기준: 검토 가능한 후보와 실행 가능한 Windows 검증 경로를 제공한다. 실제 Windows 검증은 실행 전 미실행으로 남긴다.

### 0.2.1 로컬 검증 — 2026-10-28

환경: macOS / Node 22.12.0 / arm64 / Chrome 156.0.8078.48. 다른 OS·Node 24에서 이번 후보를 실행한 결과가 아니다.

| 명령/범위 | 결과 |
| --- | --- |
| npm run check | JavaScript 54개 통과 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm test | 115개 통과. 언어별 3개·플랫폼 3개 포함 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm run test:platform | 6개 통과. 코드/빌드 미실행·생성 폴더 가지치기·범위/정책·라이브 재설정·실제 설치된 세 npm 명령·대상 해시·신호 핸들러 정리 |
| DOCMAP_BROWSER_CHANNEL=chrome npm run test:browser | 40개 통과. 경로 탐색 fixture의 큰따옴표를 Windows 유효 문자로 보정 |
| DOCMAP_BROWSER_CHANNEL=chrome DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm run test:integration | 4개 통과. 0.2.1 production-only/offline 설치·읽기/검색/갱신/종료·원본 보존 |
| npm pack --dry-run | 29개 파일. 기준 문서·테스트·CI는 배포에서 제외 |
| README/기준 4종 | JSON 4개·로컬 링크/앵커 27개 통과. README의 18개 기본 exclude를 실제 loader 결과와 대조 |
| CI | platform.yml의 YAML 구문과 Windows/macOS Node 22/24 행렬 확인. 원격 CI 미실행, actionlint 미설치 |

Windows workflow는 test:platform과 test:browser를 실행한다. full npm test/test:integration은 POSIX 전제가 남아 별도 이식 대상이다.
Windows 네이티브 Ctrl+C·기본 브라우저·PowerShell/CMD·UNC/네트워크 드라이브는 실제 인수 전 미검증이다.

## 에이전트 스킬 관리와 설치 — Integration Test 자동 검증 완료

대응: RQ-16·17·18 / PR-09·10 / DC-16~19 / M-16·17. 기준 커밋 d71ee97, 계획 cc9e98d, 1단계 b85e00e, 2단계 59a561e,
3단계 49143c0, 4단계 ead614f, Test Hardening 5bb8c7a. 다음 후보 버전은 사용자 요청으로 0.3.0으로 확정했다.
상태: 설치 tarball로 전 과정을 자동 검증했고 DC-18을 해소했다. PR #1의 Windows/macOS CI가 통과했다. 사람의 M-16·17 인수가 남았다.

진입 조건: DC-19 공개 범위 확인. 2026-10-28 사용자 확인으로 충족했다.

### 1단계 — 원본 이관: 완료

- [x] 2026-10-28 ctxbin에 올린 세 쌍과 같은 내용으로 agent-kit/skills·agents를 만들었다. 사람용 agent-kit/README.md를 함께 둔다.
- [x] manifest.json에 kit 1.0.0, 항목별 버전·파일 해시와 이전 배포본 해시를 기록했다.
  이전 해시는 ctxbin 백업과 Confluence 팀 페이지 v5에서 얻었다. 팀 페이지의 designer 스킬은 이전 ctxbin 파일과 같고,
  룰은 frontmatter 없이 실려 있으며 이전 ctxbin 룰의 본문과 같다.
- [x] scripts/agent-kit.js와 npm run check에 원본 검사를 추가했다. frontmatter 구문, 룰은 name·description만, name·버전·경로 일치,
  manifest 해시, 이전 항목의 버전·중복, 목록 밖 파일·링크·UTF-8을 확인한다. 개발 전용이며 npm 패키지에 포함하지 않는다.
- [x] AGENTS.md에 agent-kit 원본 관리와 배포본 갱신 순서를 추가했다.

남은 일: Confluence 팀 페이지는 아직 이전 designer 1.0.0이다. RQ-16 인수에 필요하며 갱신 시점은 사용자가 정한다.

기준 검증: npm run check, npm test, npm pack --dry-run(패키지 파일 목록 변화 없음).
종료 기준: 원본과 manifest가 검사를 통과하고 npm 패키지 내용은 바뀌지 않는다. 충족했다.

#### 1단계 검증 — 2026-10-28

환경: macOS / Node 22.12.0.

| 명령/범위 | 결과 |
| --- | --- |
| npm run check | JavaScript 56개 문법, agent kit 1.0.0의 세 쌍 검사 통과 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm test | 124개 통과. agent-kit.test.js 9개 포함 |
| npm pack --dry-run | 29개 파일. 기존과 같고 agent-kit/·scripts/·test/는 포함하지 않는다 |
| ctxbin 대조 | agent-kit의 세 스킬이 ctxbin의 현재 값과 같다 |

### 2단계 — 설치 판정 모듈: 완료

- [x] src/agent-kit/에 원본 읽기(manifest 해시 확인)·대상 경로 계산·Codex TOML 변환·판정을 구현했다.
  node 기본 모듈만 쓰며 수집기·서버·화면과 서로 참조하지 않는다. 1단계 해시·frontmatter 규칙을 옮겨 검사 스크립트도 같은 모듈을 쓴다.
- [x] 임시 HOME과 가상 프로젝트로 create/unchanged/replace(recorded·previous-file·previous-body)/skip-modified/
  skip-downgrade/skip-managed/blocked, --force 백업 표시, 같은 이름 경고, 읽을 수 없는 기록, 쓰기 없음을 테스트했다.
- [x] 설계와 달라진 점: 전역 설치에서는 ~/.claude 같은 클라이언트 폴더 자체가 디렉터리 링크여도 허용한다.
  dotfiles 저장소로 설정 폴더를 관리하는 사용자를 막지 않기 위해서다. 그 아래 경로와 프로젝트 설치의 링크는 계속 거부한다.

기준 검증: npm run check, npm test.
종료 기준: 파일을 쓰지 않는 판정 결과가 테스트로 고정된다. 충족했다.

#### 2단계 검증 — 2026-10-28

환경: macOS / Node 22.12.0.

| 명령/범위 | 결과 |
| --- | --- |
| npm run check | JavaScript 63개 문법, agent kit 세 쌍 검사 통과 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm test | 134개 통과. agent-kit-plan.test.js 10개 포함 |
| npm pack --dry-run | 34개 파일. src/agent-kit/ 5개가 늘었고 agent-kit/는 3단계 전까지 포함하지 않는다 |
| 실제 HOME 판정(쓰기 없음) | 세 스킬은 Claude·Codex 모두 unchanged. 룰은 ctxbin이 관리해 skip-managed. ~/.docatlas를 만들지 않았다 |

### 3단계 — 설치 명령과 에이전트용 도움말: 완료

- [x] docatlas agents install·help(install --help 포함)와 docatlas --help의 안내 두 줄을 추가했다. agents 외의 위치 인자는 기존처럼 오류다.
- [x] 쓰기 전 재확인(판정 이후 변경·링크)·--force 백업·임시 파일 후 이름 변경·설치 기록·실패 시 복구를 src/agent-kit/install.js에 구현했다.
  대화형 질문 없이 탭 구분 결과 줄과 종료 코드 0/1/2/3으로 알린다.
- [x] package.json files에 agent-kit/를 추가하고 README에 Agent skills 사용법을 추가했다. 미배포 기능으로 표시했고 팀 안내 시점은 사용자가 정한다.

기준 검증: npm run check, npm test, npm pack --dry-run.
종료 기준: 임시 HOME에서 전역/프로젝트 설치·재실행·보호·--dry-run 무쓰기와 도움말-옵션 대조가 통과한다. 충족했다.

#### 3단계 검증 — 2026-10-28

환경: macOS / Node 22.12.0.

| 명령/범위 | 결과 |
| --- | --- |
| npm run check | JavaScript 66개 문법, agent kit 세 쌍 검사 통과 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm test | 143개 통과. agent-kit-install.test.js 9개 포함 |
| npm pack --dry-run | 44개 파일, 59.6kB. agent-kit/ 8개와 src/agent-kit/ 7개 포함 |
| 설치 명령 테스트 | dry-run 무쓰기, 설치·기록·재실행 무변경, 이전 배포본 교체, 수정본 skip(종료 3)과 --force 백업, 프로젝트 설치·같은 이름 경고, 인자 오류 8종, 쓰기 실패 복구, 판정 후 변경 중단, bin 경유 실행 |

### 4단계 — 업데이트 안내: 완료

- [x] 문서 지도 시작 시 manifest와 전역·문서 지도 루트의 설치 기록을 읽어 낡은 kit이면 미리보기 명령과 함께 한 줄로 안내한다.
  src/agent-kit/notice.js. 쓰기 없음, 읽기 실패 무시, 서버 준비와 종료에 영향 없음.
- [x] 4단계 결정: 설치 기록이 없는 손 복사본에는 안내하지 않는다. Confluence 우선 배포 방침과 맞추기 위해서다.
- [x] 테스트 도우미 startCli에 env 옵션을 추가해 임시 HOME으로 실제 CLI를 검증한다.

기준 검증: npm test의 CLI·수명주기 테스트.
종료 기준: 안내가 표시되고 기존 시작·종료·신호 정리 테스트가 그대로 통과한다. 충족했다.

#### 4단계 검증 — 2026-10-28

환경: macOS / Node 22.12.0.

| 명령/범위 | 결과 |
| --- | --- |
| npm run check | JavaScript 68개 문법, agent kit 세 쌍 검사 통과 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm test | 149개 통과. agent-kit-notice.test.js 6개 포함, 기존 CLI·수명주기·종료 테스트 그대로 통과 |
| npm pack --dry-run | 45개 파일. src/agent-kit/notice.js 추가 |

### Test Hardening: 완료

- [x] 실패 복구: --force로 고친 파일을 교체한 뒤 쓰기 권한 없는 폴더에서 실패해도, 고친 파일을 원래 내용·권한으로 되돌리고 백업을 남긴다.
- [x] 동시 실행: 찾은 문제 — 실패한 실행의 복구가 다른 실행이 쓴 파일을 지울 수 있었다. <base>/.docatlas/install.lock 잠금을 추가했다.
  잠금이 있으면 아무것도 바꾸지 않고 종료 1. 세 실행을 동시에 돌려도 결과는 한 벌이고 임시 파일·잠금이 남지 않는다.
- [x] 권한: 찾은 문제 — 교체한 파일의 권한 비트가 기본값으로 바뀌었다. 교체와 복구 때 기존 권한을 유지한다.
- [x] 한글/공백이 든 HOME·프로젝트와 CRLF 원본: LF로 설치되고 재실행은 unchanged, 프로젝트 설치는 같은 이름 경고 4개를 낸다.
- [x] 판정 뒤 생긴 심볼릭 링크: 쓰기 전에 멈추고 아무것도 바꾸지 않는다.
- [x] 이전 docatlas는 높은 버전 설치본을 낮추지 않고(skip-downgrade, 종료 3), ctxbin 관리 사본은 건드리지도 기록하지도 않는다.
- [x] test:platform: production tarball의 npm 실행기로 한글·공백 HOME(HOME·USERPROFILE 지정)에 미리보기·설치·재실행을 검증한다. macOS 통과.
- [x] 같은 플랫폼 검증의 Windows 실행: PR #1의 CI에서 Windows Node 22/24 모두 6개 통과(아래 Integration Test 기록).

기준 검증: npm test, npm run test:platform.
종료 기준: 어떤 실패에서도 사용자가 고친 파일이 사라지지 않고 백업으로 복원할 수 있다. macOS에서 충족했다.

#### Test Hardening 검증 — 2026-10-28

환경: macOS / Node 22.12.0.

| 명령/범위 | 결과 |
| --- | --- |
| npm run check | JavaScript 69개 문법, agent kit 세 쌍 검사 통과 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm test | 155개 통과. agent-kit-hardening.test.js 6개 포함 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm run test:platform | 6개 통과. tarball npm 실행기로 한글·공백 HOME에 agents 미리보기·설치·재실행 포함 |
| npm pack --dry-run | 45개 파일 |

### Integration Test: 자동 검증 완료

- [x] F-09(test/integration/agent-kit.test.js): production tarball을 팀 프로젝트의 개발 의존성으로 설치하고 임시 한글 HOME으로
  도움말→미리보기(무쓰기)→설치→재실행, 프로젝트 --all 설치와 경고, 문서·AGENTS.md·CLAUDE.md 무변경, 문서 지도에 설치 파일이
  나타나지 않음, 낡은 기록의 안내→갱신 후 사라짐, 수정본 종료 3과 --force 백업을 확인했다.
- [x] Windows/macOS CI 대상인 test:platform에 tarball npm 실행기 설치 검증을 추가했다(Test Hardening). 실제 CI 실행은 아래 남은 일이다.
- [x] DC-18: Codex CLI 0.165.0의 codex debug prompt-input(모델 호출 없음)으로 격리한 HOME·CODEX_HOME에서 관찰했다.
  프로젝트 스킬은 신뢰와 무관하게, 프로젝트 룰은 신뢰한 프로젝트에서만 읽고, 같은 이름 룰은 프로젝트가 우선이다.
  같은 이름 경고 문구를 확정하고 프로젝트 설치에 codex-trust 경고를 추가했다.
- [x] platform CI의 Windows·macOS 실행: PR #1, run 40665207058, fa90bfd. 네 작업 모두 통과.
- [x] M-17 Claude Code: 사용자가 Claude Code 2.1.308 새 세션에서 프로젝트 룰이 전역보다 우선하고 같은 이름 스킬은 전역이 쓰임을 확인했다.
- [ ] M-17 Codex 사람의 실제 세션 확인(자동 관찰은 DC-18). 나머지 M-16 수동 항목.

기준 검증: npm run test:integration, npm run test:platform, npm pack --dry-run.
종료 기준: 설치 tarball로 설치와 갱신이 재현되고 실제 클라이언트 로드 결과를 기록한다. 자동 부분과 Codex 관찰은 충족했다.

#### Integration Test 검증 — 2026-10-28

환경: macOS / Node 22.12.0 / Chrome. Codex CLI 0.165.0.

| 명령/범위 | 결과 |
| --- | --- |
| npm run check | JavaScript 70개 문법, agent kit 세 쌍 검사 통과 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm test | 155개 통과 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm run test:platform | 6개 통과 |
| DOCMAP_BROWSER_CHANNEL=chrome DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm run test:integration | 5개 통과. 새 F-09 포함 |
| npm pack --dry-run | 45개 파일 |
| codex debug prompt-input 관찰 | 위 DC-18 결과. 실제 HOME과 Codex 설정은 쓰지 않았다 |
| [platform CI 40665207058](https://github.com/superlucky84/docatlas/actions/runs/40665207058) | macOS·Windows × Node 22/24 네 작업 통과. 각 작업 문법·agent kit 검사, 플랫폼 6개(tarball npm 실행기로 한글·공백 HOME에 agents 설치 포함), pack 45파일. Windows는 USERPROFILE과 .cmd 실행기 경로 |

## 0.3.0 배포 준비 — 완료

대응: RQ-10·14·16~18 / DC-12·15~19 / M-11·16·17.
진입: 작업 트리가 깨끗하고 PR #1 병합 커밋 47ff79a로 main을 fast-forward했다.
기준 검증: 변경 전 npm run check 통과(JavaScript 70개·agent kit 세 쌍), npm registry latest 0.2.0·0.3.0 미게시 확인.

- [x] manifest·lockfile을 npm version 0.3.0 --no-git-tag-version --ignore-scripts로 갱신한다.
- [x] README의 후보 버전·tarball 예제와 기준 4종의 최신 결정을 맞춘다.
- [x] npm run check, npm test, 설치 통합, pack/publish dry-run과 CLI 버전을 확인한다.
- [x] 실제 npm 게시 전 커밋·푸시, 인증, dry-run, publish, registry/실행 확인 순서를 안내한다.

종료 기준: 0.3.0 후보에 agent-kit/와 런타임이 포함되고 검증 결과·미게시 상태가 명확하다.
기존 Test Hardening·Integration Test 단계와 미완료 수동 인수는 유지한다.
실제 npm publish·커밋·푸시·태그 생성은 이번 요청에서 실행하지 않는다.

검증 환경: macOS / Node 22.12.0 / npm 11.20.0 / Chrome 156.0.8078.48.

| 명령/범위 | 결과 |
| --- | --- |
| npm run check | JavaScript 70개·agent kit 1.0.0 세 쌍 통과 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm test | 155개 통과. 플랫폼 production tarball 검사와 세 npm 실행기의 0.3.0 출력 포함 |
| DOCMAP_BROWSER_CHANNEL=chrome DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm run test:integration | 5개 통과. agent 설치·갱신·수정본 보호와 문서 탐색·읽기·감지·종료·원본 보존 |
| npm pack --dry-run / npm publish --dry-run | docatlas@0.3.0, 45개 파일, 60,990 bytes. 스킬·룰 세 쌍과 manifest·런타임 포함, 개발 문서·테스트 제외. 실제 게시 없음 |
| CLI / manifest / lockfile | 0.3.0 일치. 의존성·agent kit 버전·원본 해시는 변경하지 않음 |

### 사용자가 실행할 0.3.0 배포 절차

main의 이번 변경을 커밋·푸시하고 플랫폼 CI 성공을 확인한 뒤 npm에 게시한다.
package.json은 이미 0.3.0이므로 npm version을 다시 실행하지 않는다.

```sh
git add package.json package-lock.json README.md docs/REQUIREMENTS.md docs/DESIGN.md docs/IMPLEMENT.md docs/MANUAL_TEST_CHECKLIST.md
git commit -m "chore: prepare 0.3.0 release"
git push origin main
```

CI: https://github.com/superlucky84/docatlas/actions/workflows/platform.yml.
인증 확인이 실패하면 npm login --registry=https://registry.npmjs.org/로 로그인한 뒤 계속한다.

```sh
npm whoami --registry=https://registry.npmjs.org/
npm publish --dry-run --access public --registry=https://registry.npmjs.org/
npm publish --access public --registry=https://registry.npmjs.org/
npm view docatlas version --registry=https://registry.npmjs.org/
npm view docatlas@0.3.0 version --registry=https://registry.npmjs.org/
npx --yes docatlas@0.3.0 --version
npx --yes docatlas@0.3.0 agents help
```

로그인·게시 시 표시되는 브라우저/2FA 절차를 따른다. registry와 실제 CLI에서 0.3.0을 확인한다.
선택적으로 게시 성공 후 git tag v0.3.0, git push origin v0.3.0으로 버전 태그를 남긴다.
공식 절차: https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/.

게시 확인(2026-10-28): npm view docatlas@0.3.0 version이 0.3.0, dist-tag latest가 0.3.0이다.
빈 임시 폴더에서 npx --yes docatlas@0.3.0 --version이 0.3.0을 출력했다.

## 저장소 소개와 DDD 본거지 — 완료

대응: RQ-19 / DC-20·21 / M-18.
진입: 사용자 결정(2026-10-28)을 기준 4종에 기록했다. 작업 브랜치 claude/tender-gates-sa5kn8, 기준 커밋 00064c2.
기준 검증(변경 전): npm run check 문법 70개·agent kit 1.0.0 세 쌍 통과.
npm test 155개 중 152개 통과·3개 건너뜀·실패 0. 건너뛴 3개는 root 권한 환경에서 실행하지 않는 POSIX 권한 테스트다.
npm pack --dry-run 45개 파일. 환경: Linux / Node 22.22.0 / npm 10.9.4.

### 구현

- [x] METHOD.md: 정의·원칙·4종 문서·흐름·작성 규칙·역할·문서 배치·spec-driven 도구와의 차이·블로그 링크.
- [x] README: RQ-19 계약의 순서로 재구성하고 기존 사용법을 Reference로 옮긴다. #configuration 앵커를 유지한다.
- [x] CONTRIBUTING.md: 개발·검사·브라우저/설치 통합·플랫폼·벤치마크·소스 tarball 안내를 README에서 옮긴다.
- [x] CHANGELOG.md: 게시한 0.1.0~0.3.0의 변경 요약. README의 버전별 신규 표시를 옮긴다. 날짜는 npm 게시 시각이다.
- [x] agent-kit/README.md: 설치 명령 안내를 현재 동작에 맞추고 사본 관계 문구를 뺀다. 스킬 변경 시 METHOD 확인 단계를 넣는다.
- [x] package.json의 description·keywords.
- [x] 합성 예제 프로젝트로 문서 지도 캡처를 만들어 .github/assets/document-map.png에 둔다.
  재현용 개발 스크립트 scripts/screenshot.js를 추가했다(npm 패키지 제외). 같은 예제로 두 번 만든 PNG가 바이트 단위로 같다.

### Test Hardening

- [x] 이전 README의 모든 제목·표·명령이 README나 CONTRIBUTING에 남았는지 대조한다.
  이전 README의 비어 있지 않은 줄을 새 README·CONTRIBUTING·CHANGELOG와 줄 단위로 비교했다. 그대로 없는 48줄은 제목 단계 변경,
  버전·checkout 표현 수정, 중복 redirects 안내의 링크 대체, 오래된 배포 문구 삭제였다. 빠진 문서 지도 소개 한 문장은 복원했다.
- [x] 오래된 문구를 검색한다: planned but not available, in this checkout, before it is published, 공개 안내의 Confluence·wiki.
  README·METHOD·CONTRIBUTING·CHANGELOG·agent-kit/README에서 0건. ctxbin은 설치 동작 설명 한 곳에만 남았다.
- [x] METHOD의 규칙 문장을 세 스킬·룰의 해당 문장과 대조한다. 새 규칙을 만들지 않았고 역할·순서·승인 조건이 스킬과 같다.

### Integration Test

- [x] npm run check, npm test가 기준과 같다. 문법 71개(scripts/screenshot.js 추가)·agent kit 세 쌍,
  Node 155개 중 152개 통과·3개 건너뜀·실패 0.
- [x] npm pack --dry-run: README·agent-kit/README 포함, METHOD·CONTRIBUTING·CHANGELOG·docs·.github·scripts 제외, 45개 파일·61,276 bytes.
- [x] 새 문서의 상대 링크·앵커와 GitHub 절대 링크의 대상 파일·제목을 확인한다.
  README·METHOD·CONTRIBUTING·CHANGELOG·agent-kit/README와 기준 4종의 링크 90개를 github-slugger 앵커로 확인했다. 문제 0.
  docatlas 서버에 --docs-dir .로 이 저장소를 열어 다섯 문서를 읽었다. 참조 오류 없음. README 캡처는 외부 이미지라 정책대로 표시하지 않는다.
- [x] 이전 인계를 docs/handoff/로 옮긴 뒤 기준 4종의 링크·앵커를 확인한다.
  33개 절·333줄을 옮겼고 제거한 모든 줄이 인계 이력에 있다. 옮긴 앵커 38개를 새 위치로 바꿨다.

브라우저 UI·설치 통합(test:browser·test:integration)은 제품 코드와 화면을 바꾸지 않아 다시 실행하지 않았다.
이 환경의 Playwright 1.64.1용 브라우저가 없어 캡처는 미리 설치된 Chromium(--executable-path)으로 만들었다.

종료 기준: README 첫 화면에 DDD 정의와 세 구성·시작 명령이 있고, 기존 사용법 정보가 빠짐없이 새 위치에 있으며,
검사·테스트·pack 결과가 기준과 같다. 제품 코드 변경은 없다. M-18의 사람 확인(GitHub·npm 화면)은 별도다.

## 검증 예제와 기록

F-01~08의 구체적인 구성은 [수동 검증의 가상 프로젝트](./MANUAL_TEST_CHECKLIST.md#가상-프로젝트)를 따른다.
가상 예제는 저장소에 포함할 수 있는 내용으로 만들며 기업의 실제 문서를 복사하지 않는다.

### 기존 부트스트랩 — 2026-10-27

macOS / Node.js 24.21.0 / npm 11.19.0에서 실행했다.

- npm run check: CLI 진입점과 모듈 문법 검사 통과.
- npm pack: 실행 파일·모듈·4종 문서·README·AGENTS 포함 확인.
- tarball을 별도 임시 프로젝트에 오프라인 설치: 통과.
- 설치 CLI --help / --version: 종료 0, 출력 확인.
- 잘못된 인자: 종료 2, 안내 확인.
- 원본과 설치 패키지의 상대 Markdown 링크 13개: 통과.
- 공개 저장소와 초기 main push: 완료.

이는 당시 뼈대의 기록이다. Node.js 22·다른 OS·문서 수집기·브라우저 화면의
검증으로 확대 해석하지 않는다.

### 이번 문서 갱신

2026-10-27, 동일한 macOS / Node.js 24.21.0 환경에서 적용할 문서 사본을 검사했다.

- 기준 4종·README·AGENTS의 상대 링크와 앵커 19개: 통과.
- RQ/PR/DC/IC/M/F 식별자 참조, 인수 항목 15개와 가상 예제 8개: 통과.
- Phase 0~7의 기준 테스트·검증과 종료 기준: 확인.
- 사용자 선택인 포그라운드 기본 실행과 Ctrl+C 종료의 문서 간 일치: 확인.
- npm pack --dry-run: 기준 4종·README·AGENTS와 기존 CLI 파일의 포함 확인.
- 제품 인수 M-01~15: 미실행. 제품 코드와 기능 구현 상태는 이번 기록으로 바꾸지 않는다.

### Phase 1 검증 — 2026-10-27

macOS / Node.js 24.21.0 / npm 11.19.0에서 실행했다.

- npm run check: JavaScript 11개 문법 검사 통과.
- npm test: 수집·설정·메타데이터 자동 테스트 42개 통과, 실패·생략 0개.
- npm pack: 공개 API와 수집기 4개 모듈을 포함한 배포 파일 13개 확인.
- tarball을 별도 임시 위치에 오프라인 설치하고 공개 import로 F-01 문서 8개 수집: 통과.
- 패키지 설치 위치와 다른 cwd에서 기본 루트와 명시 루트의 결과 일치: 통과.
- 설치 CLI의 도움말·버전·잘못된 인자: 종료 코드와 출력 확인.
- 현재 저장소 자체의 수집: 기준 문서 4개, 그룹 2개, 경고 0개.
- 상대 링크·앵커 20개와 식별자·단계별 검증 관문 정합성: 통과.

Node 22·다른 OS와 브라우저 인수 전체는 아직 검증하지 않았다.
수집기 자동 검증을 서버·화면 기능 완료로 표시하지 않는다.

### Phase 2 검증 — 2026-10-27

macOS / Node.js 24.21.0 / npm 11.19.0 / Chrome 156.0.8078.48에서 실행했다.

- npm run check: JavaScript 18개 문법 검사 통과.
- npm test: 기존 수집기와 새 HTTP·CLI 테스트 총 55개 통과.
- npm run test:browser: 실제 Chrome 7개 통과. 카드·4종 선택·독립적인 하위 펼침,
  키보드·모바일·긴 한글 제목·삭제 안내·선택 요청 경합을 확인했다.
- 데스크톱 1440×1000과 모바일 390×844 화면을 캡처해 시각적으로 확인했다.
- npm pack: 서버 모듈과 HTML/JS/CSS를 포함한 배포 파일 18개 확인.
- tarball을 개발 의존성 없이 별도 위치에 오프라인 설치했다. 외부 cwd에서 설치 CLI 실행,
  공개 수집 API, 문서 8개, HTTP와 정적 자산·Chrome 탐색·SIGINT 종료가 통과했다.
- 문서 상대 링크·앵커 20개와 식별자·단계별 검증 관문 정합성: 통과.

일반 샌드박스는 loopback listen을 EPERM으로 차단하므로 서버·CLI·Chrome 검증은
허용된 샌드박스 밖 실행으로 수행했다. 최소 Node 22와 다른 OS의 실검증,
시스템 기본 브라우저 수동 인수는 후속으로 남긴다.
이 단계의 본문은 Markdown source이며 Phase 3의 서식·링크 기능을 완료로 표시하지 않는다.

### Phase 3 검증 — 2026-10-27

macOS / Node.js 24.21.0 / npm 11.19.0 / Chrome 156.0.8078.48에서 실행했다.

- npm run check: JavaScript 28개 문법 검사 통과.
- npm test: 수집·설정·HTTP·CLI·렌더링·참조·이미지 API 총 65개 통과.
- npm run test:browser: 기존 지도와 새 읽기 시나리오 총 16개 통과.
  표·코드·읽기 전용 체크박스·목차·이미지, 한글/중복 앵커와 직접 URL,
  링크 이동·뒤로/앞으로·지도/본문 위치·읽기/원문 모드 복원을 확인했다.
- 코드 경로 복사·범위 밖/없는 참조·이미지 오류 안내·모바일 표와 목차를 확인했다.
- 가상 프로젝트 원본 Markdown이 브라우저 검증 뒤에도 같은 내용임을 확인했다.
- npm pack: 렌더러·접근 정책·reader.js를 포함한 배포 파일 24개 확인.
- tarball을 개발 의존성 없이 별도 위치에 오프라인 설치했다. 설치 CLI로 외부 cwd의 문서 9개,
  서식·이미지·상대 링크·탐색 복원·원문 전환·Chrome 화면·SIGINT 종료를 확인했다.
- 데스크톱 1440×1000과 모바일 390×844 화면 캡처를 시각적으로 검토했다.
- 상대 링크·앵커 20개와 요구/결정/검증 식별자·단계별 관문 정합성: 통과.

서버·Chrome 검증은 loopback 바인딩이 허용된 실행에서 수행했다.
최소 Node 22·다른 OS·전체 수동 인수와 Phase 4 기능은 아직 완료로 표시하지 않는다.

### Phase 4 검증 — 2026-10-27

macOS 15.6.1 / Node.js 22.12.0 / npm 11.20.0 / Chrome 156.0.8078.48에서 실행했다.
이 단계의 실행 환경을 직접 확인했으며 이전 단계에 기록된 Node 24.21.0 환경과 구분한다.

- npm run check: JavaScript 38개 문법 검사 통과.
- npm test: 수집·설정·검색·이동 연결·실제 감지·SSE·HTTP·CLI·서식/참조 총 81개 통과.
- npm run test:browser: 기존 16개와 새 검색·갱신 시나리오 14개, 총 30개 통과.
  한글/NFC·영문 대소문자·AND·본문 코드·일치 강조·IME·낡은 검색 요청 취소를 확인했다.
- 실제 수정·추가·삭제·atomic save·연속 저장, 이미지 단독 수정·삭제, 설정/ignore 범위 변경,
  잘못된 설정의 마지막 정상 인덱스·복구, 두 감지기의 분리와 종료를 검증했다.
- 자동 갱신 중 읽기/원문 모드·스크롤·검색 입력·탐색 의도, 삭제 안내·이동된 선택의 canonical URL,
  검색 이력의 뒤로/앞으로, 두 프로젝트·같은 프로젝트의 다른 탭, SSE 재연결 후 누락 반영을 확인했다.
- native fs.watch에서 초기 파일 이벤트 뒤 약 3ms 안의 첫 저장이 누락되는 경우를 반복 재현했다.
  chokidar polling(300ms, 래스터 500ms)으로 바꾼 뒤 다중 감지·연속 저장 검증이 통과했다.
  감지 비용과 F-08 성능 기준은 Phase 5에서 측정한다.
- npm pack: 새 수집/검색·이동 연결·감지·화면 모듈을 포함한 배포 파일 30개 확인.
- 개발 의존성 없는 별도 오프라인 설치에서 외부 cwd의 설치 CLI로 문서 9개·서식/이미지/상대 링크,
  이전 경로 API·검색·직접 URL, 수정·추가·삭제 갱신과 Chrome 화면·SIGINT 종료를 확인했다.
- 데스크톱 1440×1000 검색 결과와 읽기, 모바일 390×844 화면을 캡처해 시각적으로 검토했다.
- 문서 6개·상대 링크/앵커 20개, 요구/결정/검증 식별자와 Phase 0~7 관문 정합성: 통과.

서버·Chrome은 loopback이 허용된 실행에서 검사했다. 선언한 Node 하한 22.0·다른 OS·
전체 수동 인수와 300개 문서 성능 측정은 후속 단계로 남긴다. npm 릴리스는 아직 하지 않았다.

### Phase 5 완료 검증 — 2026-10-28

사용자 요청으로 작업을 재개했다. 기준 커밋 4b8b195에서 보존 패치 대상 16개의
해시/새 파일 부재와 git apply --check를 확인한 뒤 패치를 한 번 적용했다.
아래는 재개 후 결과이며 2026-10-27의 중단 기록과 구분한다.

- npm run check: JavaScript 47개 통과(Phase 6 통합 테스트 포함).
- npm test: Node 93개 통과, 실패·생략 0개. descriptor 읽기 실패 시 닫기까지 포함한다.
- DOCMAP_BROWSER_CHANNEL=chrome npm run test:browser: Chrome 34개 통과.
- 공통 descriptor 읽기의 파일/부모 교체·경계·예외 정리와 같은 size/mtime의 내용 변경을 검증했다.
- 감지기 교체 중 종료·시작 실패·운영 중 오류 복구, SSE를 연 상태의 신호 종료·포트 재사용을 검증했다.
- 긴 한글 경로·동명 문서·120행 표·키보드·검색 포커스와 일시적 갱신 실패 재시도가 통과했다.
- npm pack --dry-run과 production-only 별도 설치 통합 검증이 통과했다. 실제 런타임 자산을 확인했다.
- 기준 4종·README·AGENTS의 상대 링크/앵커 32개, 요구/결정/인수 식별자 44개,
  Phase 0~7의 기준 검증과 종료 기준이 통과했다. 저장소 자체 수집은 문서 4개·경고 0개다.
- 문서 갱신 후 npm pack --dry-run에서 파일 35개를 확인했고 git diff --check도 통과했다.
- 초기 샌드박스 실행은 loopback listen EPERM으로 실패했으며 권한을 허용한 실행에서 전체 통과했다.
  npm pack의 기본 캐시 쓰기 EPERM은 허용된 실행과 기존 임시 캐시로 재검증했다.

#### F-08 성능 결과와 로컬 회귀 기준

명령: npm run benchmark -- --browser. 환경: macOS 15.6.1 / Darwin 24.6.0 / arm64 /
Apple M4 Pro 12 logical CPUs / 24GiB / Node 22.12.0 / Chrome 156.0.8078.48.
문서 300개(75기능×4종), 본문 5,016,514 bytes, 비문서·제외 파일 1,003개다.

수집·실시간·브라우저는 순차 실행하는 별도 새 Node 프로세스다. 준비 시간은 제외하고
파일 시스템 캐시는 따뜻한 상태이며 강제 GC는 하지 않았다. 첫 수집 1회, 이후 수집 5회,
검색 7종×10회, 저장 5회, 유휴 5초를 측정했다. 브라우저 항목은 각각 1회다.
p95는 표본의 최근접 순위이며 5회에서는 최대값과 같다. RSS에는 Chrome 자식 프로세스를 포함하지 않는다.

| 지표 | 재사용 적용 | 재사용 없음 | 채택한 로컬 회귀 기준 |
| --- | --- | --- | --- |
| 첫 수집 | 572.18ms | 518.53ms | 1,500ms 이하 |
| 후속 독립 수집 p50 / p95 | 481.17 / 497.71ms | 494.20 / 503.97ms | p95 1,000ms 이하 |
| 검색 p50 / p95 | 0.81 / 3.89ms | 0.82 / 3.91ms | p95 10ms 이하 |
| 실시간 store 시작 | 673.19ms | 1,045.17ms | 1,500ms 이하 |
| 저장→게시 인덱스 p50 / p95 | 599.30 / 631.00ms | 907.88 / 927.04ms | p95 1,500ms 이하 |
| 유휴 CPU(한 코어 기준) | 1.80% | 1.53% | 5% 이하 |
| 유휴 RSS / heap | 140.95 / 48.37MiB | 161.52 / 58.56MiB | RSS 256MiB 이하 |
| 5회 저장 후 RSS / heap | 213.89 / 115.82MiB | 222.25 / 77.86MiB | RSS 384MiB 이하 |
| 브라우저 지도 / 검색 / 문서 열기 | 61.47 / 216.61 / 109.91ms | 65.21 / 211.63 / 102.08ms | 각각 1,000ms 이하 |
| 저장→브라우저 본문 | 587.67ms | 978.16ms | 2,000ms 이하 |
| 브라우저 측정 서버 최대 RSS | 353.64MiB | 483.25MiB | 512MiB 이하 |

모든 로컬 기준을 통과했다. 비교용 사본은 createProjectStore의 scanProject 호출 4곳에서
previous 인자만 제거했다. 독립 수집은 원래 이전 세대를 넘기지 않으므로 양쪽 값 차이를
재사용 효과로 해석하지 않는다. 저장→게시 중앙값은 이번 측정에서 34.0% 줄었다.

원시 결과: [분리 성능 측정 JSON](./handoff/phase5-benchmark.json).
이 기준은 같은 예제·환경에서 수동 비교하는 회귀 기준이며 자동 테스트의 timeout이나
제품 지원 상한이 아니다. 5초 유휴·5회 저장 결과로 장시간 메모리 누수 부재를 주장하지 않는다.
장시간 안정성·다른 프로젝트/OS는 후속 검증이며 현재 재현된 미처리 결함은 없다.

### Phase 6 자동 통합 검증 — 2026-10-28

명령: DOCMAP_BROWSER_CHANNEL=chrome npm run test:integration.
이 실행은 DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache를 사용했다.
개발 의존성 없는 production-only/offline 설치이며 브라우저 검증 도구는 개발 저장소에서만 사용했다.

- macOS 15.6.1 / Node 22.12.0 / Chrome 156: 테스트 4개(부모 1개·하위 흐름 3개) 통과.
- 같은 통합 테스트를 설치된 Node 24.22.1로도 실행해 4개 통과했다.
- tarball은 소스 저장소와 다른 임시 위치에 설치했다. 패키지 복사본과 런타임 파일 포함,
  공개 수집 API·CLI 버전·실제 HTTP·Chrome 화면을 확인했다. 검증 당시 파일 35개·76,919 bytes였다.
- JS 프로젝트의 cwd 기본 실행과 비 JS 프로젝트의 다른 cwd/--root/루트 별칭 실행에서 각각 문서 9개를 확인했다.
- 카드의 4종 선택·표·코드·체크박스·안전한 HTML 처리·등록 이미지·상대/한글 링크·뒤로 가기·이전 경로가 통과했다.
- 원본 저장 후 본문·검색 갱신·원문 모드·읽기 위치·다른 탭의 입력/문서 보존이 통과했다.
- SSE를 연 상태에서 A에 SIGINT를 보내 종료했고 B의 서버·저장 반영은 계속 동작했다. B의 SIGTERM도 종료 0이었다.
- 대상의 전체 파일 목록·내용 해시를 비교했다. 검증이 직접 저장한 두 문서 이외의 생성·수정·이동은 없었다.
- 최종 사람의 수동 인수·선언한 Node 22.0·다른 OS·시스템 기본 브라우저 열기는 미검증이다.
  Phase 6 전체 종료와 npm 릴리스는 아직 완료로 표시하지 않는다.

## 플랫폼 CI 캐시 전제 보정 — 검증 완료

진입: 사용자 보고와 run 40652167597 네 작업의 로그. 기준 커밋 a44c39e.
원인: 각 작업의 플랫폼 테스트 6개 중 5개 통과, 새 tarball production 설치만 ENOTCACHED로 실패했다.
npm ci가 받아 둔 잠금파일의 tarball만으로는 새 의존성 트리를 오프라인 해석할 메타데이터가 충분하지 않았다.

- [x] Test Hardening: 독립 빈 캐시에서 npm ci만 실행해 같은 실패를 재현한다.
- [x] 플랫폼 최초 설치를 --prefer-offline으로 보정하고 설치/실행 모드를 진단에 구분한다.
- [x] README의 설치 전제와 Windows 검증 상태를 실제 CI 결과에 맞게 안내한다.
- [x] docs/**만 바뀐 인계 커밋은 CI를 재실행하지 않도록 필터링한다.
- [x] Integration Test: 같은 캐시에서 플랫폼 6개 통과, 문법·문서·pack 검증 후 푸시하고 네 CI 작업을 확인한다.

기준 검증: 기존 플랫폼 6개·전체 Node 115개·Chrome 40개. 제품/수집기 계약은 바꾸지 않는다.
종료 기준: 새 CI의 네 조합에서 설치·브라우저·pack 단계가 실제 통과한다. 남은 실제 콘솔 인수는 별도 유지한다.

재현: /private/tmp/docatlas-clean-ci-eo4xl_09/seed에 manifest/lockfile만 복사하고 새 cache에 npm ci를 실행했다.
그 cache로 원래 test:platform을 실행해 5개 통과·production 설치 1개 ENOTCACHED 실패를 동일하게 재현했다.
수정 후 같은 cache에서 6개가 통과했고 설치 진단은 prefer-offline, 실행기 검사는 offline으로 구분했다.
문법 54개·workflow YAML/필터·pack dry-run 29개 파일·git diff --check가 통과했다. 문서 5개의 JSON 4개·로컬 링크/앵커 27개도 확인했다.

새 CI run 40657181408, 검증 커밋 967c175482c0b9fa7f71e5114f43d43a54cc20f9:

| 작업 | 실제 Node | 플랫폼 | 브라우저 | 패키징 | 결과 |
| --- | --- | --- | --- | --- | --- |
| macos-latest / Node 22 | 22.23.4 | 6개 | 40개 | 29파일 | 성공 |
| macos-latest / Node 24 | 24.22.1 | 6개 | 40개 | 29파일 | 성공 |
| windows-latest / Node 22 | 22.23.4 | 6개 | 40개 | 29파일 | 성공 |
| windows-latest / Node 24 | 24.22.1 | 6개 | 40개 | 29파일 | 성공 |

모든 작업에서 문법 54개가 통과했다. Windows의 .cmd 실행기·네이티브 한글/공백 경로와 실제 브라우저 검증이 포함된다.
기본 브라우저 자동 열기와 실제 터미널 Ctrl+C는 주입 신호·headless 브라우저로 대체 검증했다고 표시하지 않는다.

## 현재 인계

이 프로젝트의 현재 인계는 이 블록 하나다. 작업을 멈출 때 이 블록을 바꾸며 이전 내용은 git 이력에 남는다.
2026-10-28 이전의 인계와 검증 기록은 [인계 이력](./handoff/HISTORY.md#구현-계획에서-옮긴-기록)에 있다.

- 완료(RQ-19·DC-20): README를 DDD 본거지 소개로 재구성하고 METHOD.md·CONTRIBUTING.md·CHANGELOG.md를 추가했다.
  agent-kit/README.md의 설치 안내와 package.json의 description·keywords를 고쳤고, 합성 예제 캡처와 scripts/screenshot.js를 추가했다.
  기준 4종의 이전 인계 33개 절을 docs/handoff/HISTORY.md로 옮겼고, 적용이 끝난 phase5-wip.patch를 삭제했다.
- 검증: 문법 71개·agent kit 세 쌍, Node 155개 중 152개 통과·3개 건너뜀(root 권한)·실패 0, pack 45개 파일.
  공개 안내·기준 4종·인계 이력의 링크와 앵커를 확인했다. 옮긴 333줄은 제목 단계와 링크 외에는 그대로다.
- 이전 상태 유지: 0.3.0은 npm에 게시됐다(2026-10-28 registry latest 확인). PR #1 병합 이후 제품 코드는 바뀌지 않았다.
- 다음: 사용자 검토 후 main 반영. GitHub 저장소 About·topics 설정은 사용자가 한다.
  M-18 사람 확인(GitHub 첫 화면, 다음 게시 후 npm 페이지의 캡처·링크), DC-21(METHOD 한국어판·examples/) 결정.
  기존 남은 일: Codex 실제 세션과 M-16 수동 항목, Windows 콘솔·기본 브라우저·Node 22.0 인수.
- 차단: 없음. README 캡처는 GitHub main의 절대 URL이라 main에 반영되기 전에는 브랜치 화면에서 보이지 않는다.
- 최신 커밋: 작업 브랜치 claude/tender-gates-sa5kn8. 이 인계 직전 커밋은 e1e6495이며 실제 최신 SHA는 git log -1로 확인한다.
