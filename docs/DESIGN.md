# docatlas 설계

문서 기준: 2026-10-28.
[요구사항](./REQUIREMENTS.md) · [구현 계획](./IMPLEMENT.md) · [수동 검증](./MANUAL_TEST_CHECKLIST.md)

수집 API·포그라운드 CLI·카드 지도와 Markdown 서식 읽기가 동작한다.
상대 문서·앵커·목차·이미지와 읽기/원문 전환, 뒤로/앞으로 가기를 지원한다.
검색·변경 감지·명시적인 문서 이동 연결은 Phase 4에서 구현했다.
Phase 5에서 descriptor 읽기·세대별 메타데이터 재사용·종료 경합·화면 복구를 보강했다.
Phase 6의 설치 통합 검증이 Node 22.12.0·24.22.1 / macOS / Chrome에서 통과했다.

## 구조와 책임

단일 설치 패키지 내부에서 책임을 나눈다. 처음부터 여러 배포 패키지를 만들지 않는다.

```text
CLI ── 프로젝트 루트·실행 상태
 │
 ├── 수집기 ── 파일 발견·문서 분류·계층·제목/설명
 │       └── 인덱스 ── 지도 모델·검색용 본문
 │
 └── 로컬 서버 ── 패키지의 웹 화면·문서 API
          └── 브라우저 ── 지도·문서 선택·Markdown
                 ↑
           변경 감지 후 갱신
```

수집기는 브라우저와 CLI 실행 방식에 의존하지 않게 한다.
화면은 파일 시스템에 직접 접근하지 않고 서버가 제공하는 읽기 모델을 사용한다.
파생 인덱스를 잃어도 원본과 선택 설정으로 재생성할 수 있어야 한다.
RQ-16·17: src/agent-kit/은 스킬 원본 읽기와 설치 판정을 맡는다(2단계 구현). 수집기·서버·화면과 독립이며 서버는 사용하지 않는다.
CLI의 docatlas agents 하위 명령이 이 모듈을 사용한다(3단계 구현).

## 프로젝트 루트와 식별

수집기와 CLI는 다음 프로젝트 루트 규칙을 사용한다.

- 기본 루트는 명령을 실행한 cwd다. --root로 다른 루트를 지정할 수 있다.
- 루트는 실제 절대 경로로 정규화하고 디렉터리인지 확인한다.
- 같은 실제 경로의 심볼릭 링크 별칭은 같은 프로젝트로 취급한다.
- 서로 다른 경로의 프로젝트·worktree는 각각 구분한다.
- 화면에는 프로젝트 이름과 루트 경로를 확인할 수 있는 위치를 둔다.
- 설치 패키지 디렉터리에서 대상 프로젝트를 추론하지 않는다.

프로젝트 id는 실제 루트의 SHA-256 해시다. 문서·그룹 id는 프로젝트 루트에 대한
상대 경로를 사용하며 구분자는 /로 통일한다. 파일 이동 후 id 유지까지 보장하지 않는다.

## 발견 규칙 — Phase 1

기본 후보:

1. 어떤 깊이에 있든 docs 디렉터리 아래의 .md 파일.
2. docs 밖에서도 REQUIREMENTS.md, DESIGN.md, IMPLEMENT.md, MANUAL_TEST_CHECKLIST.md.
3. 선택 설정의 include에 지정한 Markdown. include는 기본 목록을 대체한다.

표준 파일명과 .md 확장자 인식은 대소문자를 무시한다.
같은 kind의 파일이 여러 개여도 실제 경로별 문서로 유지한다.

.git과 node_modules는 항상 제외한다. 기본 산출물 제외는 dist, build,
coverage, .docatlas, .ddd-docmap이다. 다음 후보에서는 아래 Python·Java 제외를 추가한다.
선택 설정의 exclude는 산출물 제외 목록을 대체하며
항상 제외할 디렉터리에는 영향을 주지 않는다.

Git 유무와 관계없이 .gitignore를 디렉터리별로 읽으며 Git 실행 파일은 필요 없다.
정확한 우선순위와 중첩 규칙은 아래 Phase 1 구현 계약을 따른다.

파일·디렉터리 심볼릭 링크는 수집하지 않고 상대 경로로 경고한다.
어떤 파일을 읽더라도 실제 경로가 프로젝트 경계를 벗어나면 제외한다.

## 기능 묶음과 상하위

- 문서를 가진 디렉터리 하나를 문서 그룹으로 만든다.
- 그룹은 원본 상대 디렉터리 경로를 유지한다.
- 그룹 사이의 경로를 잇는 상위 디렉터리는 구조 그룹으로 표현할 수 있다.
- 문서가 있는 상위 그룹도 자식을 가질 수 있다.
- docs 같은 구조용 경로를 화면에서 생략하더라도 원본 경로와 id는 보존한다.
- 첫 버전의 설정은 그룹의 이름·설명을 보정한다. 임의의 부모 재배치는 후속 검토다.
- 동명 그룹은 소속 경로로 구분한다.

요구사항·설계·구현·수동 검증을 이 순서로 표시하고, 이어 README·RESEARCH·그 외 문서를
표시한다. 일부 문서만 있어도 정상 그룹이다. 구조 그룹에는 없는 문서 버튼을 만들지 않는다.

## 제목과 설명 — Phase 1

대표 문서는 README → REQUIREMENTS → DESIGN → IMPLEMENT →
MANUAL_TEST_CHECKLIST → RESEARCH → 그 외 경로순으로 고른다.

- 제목: 설정 보정 → 대표 문서의 첫 H1 → 폴더명.
- 문서 제목: 첫 H1 → 파일명.
- 설명: 설정 보정 → 대표 문서의 첫 설명 문단.
- 설명 문단에서는 코드 블록·표·제목·참조 링크만 있는 문단을 제외한다.
- 문서 기준·작성일·상태 같은 메타데이터 문단도 설명 후보에서 제외한다.
- 텍스트를 얻지 못하면 설명을 비워 두고 임의의 요약을 생성하지 않는다.
- 카드에서는 한 줄로 생략 표시하고 전체 설명은 상세 영역에서 확인한다.
- 그룹 제목에서 구분자·공백 뒤의 알려진 문서 종류 접미사를 정리한다.
  H1이 없거나 정리 결과가 비면 폴더명을 쓴다. 원래 문서 제목은 보존한다.
- 선두 YAML front matter 블록을 건너뛰며 그 안의 메타데이터는 해석하지 않는다.

자동 추출 결과를 사람이 보정할 수 있게 하되, 모든 문서에 설명을 새로 쓰는 절차를 요구하지 않는다.

## 선택 설정 — Phase 1

0.2.0부터 프로젝트 루트의 docatlas.config.json을 먼저 읽는다.
없을 때만 ddd-docmap.config.json으로 fallback한다. 둘 다 있어도 병합하지 않고 새 파일만 사용한다.
새 파일의 파싱·타입·심볼릭 링크 오류가 있으면 이전 파일로 우회하지 않는다.
JSON 데이터만 읽으며 프로젝트의 JavaScript/TypeScript 설정을 실행하지 않는다.

```json
{
  "version": 1,
  "include": [
    "**/docs/**/*.md",
    "**/REQUIREMENTS.md",
    "**/DESIGN.md",
    "**/IMPLEMENT.md",
    "**/MANUAL_TEST_CHECKLIST.md"
  ],
  "groups": {
    "docs/catalog": {
      "title": "콘텐트 목록",
      "summary": "목록의 구성과 표시 규칙"
    }
  }
}
```

설정이 없으면 기본값을 사용한다. include가 있으면 기본 포함 패턴을 대체한다.
groups의 키는 원본 상대 디렉터리다. 루트 그룹 키는 .이다.
redirects는 이전 Markdown 상대 경로를 현재 Markdown 상대 경로에 연결하는 선택 객체다.
예: {"docs/old/DESIGN.md": "docs/new/DESIGN.md"}. 체인은 최종 문서로 정규화한다.
잘못된 타입·알 수 없는 설정 버전은 경로와 항목을 안내하고 시작을 중단한다.
존재하지 않는 그룹 보정은 UNMATCHED_GROUP 경고로 남긴다.
잘못된 설정과 루트는 각각 ConfigurationError와 ProjectError로 구분한다.
설정 파일은 심볼릭 링크가 아닌 일반 파일만 허용한다.

## 수집 범위 옵션 — 0.2.0 계약

- --docs-dir <directory>는 반복 가능하며 프로젝트 루트 기준의 리터럴 상대 경로다.
  기존 JSON include 또는 기본 포함 범위에 해당 디렉터리 아래 .md를 추가한다. 부모/절대 경로와 역슬래시는 거부한다.
  공백·한글·glob처럼 보이는 문자를 실제 디렉터리 이름으로 취급한다. .은 루트 안의 전체 디렉터리를 뜻한다.
- 없는 폴더·제외된 폴더·심볼릭 링크는 범위를 우회하지 않는다. 탐색되지 않은 추가 경로는 DOCS_DIR_SKIPPED 경고로 표시한다.
  이후 폴더가 생성·삭제되면 다음 세대에서 반영하며 없는 폴더 때문에 마지막 정상 지도를 붙잡지 않는다.
- --all-md는 JSON include보다 우선해 모든 .md를 포함 후보로 삼는다. --docs-dir와 함께 주면 추가 경로는 범위를 더 넓히지 않는다.
- 최종 우선순위는 고정 제외 → .gitignore → JSON exclude → 포함 후보다.
  --all-md/--docs-dir/include 어느 것도 node_modules·.git이나 제외 정책·루트 경계를 우회하지 않는다.
  JSON exclude가 있으면 기본 exclude 목록을 대체한다. 기본값에 .docatlas와 이전 .ddd-docmap을 모두 제외한다.
- 새 설정과 이전 설정 파일의 생성·수정·삭제를 모두 감지한다. 재수집과 감지기 교체에도 실행 옵션을 유지한다.
- 공개 API는 collectProject(root, { docsDirs: ['documentation'], allMarkdown: false })다.
  수집 옵션은 서버/CLI와 독립적인 데이터이며 실행 중 외부 변경으로 바뀌지 않게 복사한다.
  잘못된 옵션은 CollectionOptionsError이며 CLI는 인자 오류와 같은 종료 2로 안내한다.
- README·--help는 설정 파일 선택과 version/include/exclude/groups/redirects의 의미·기본값 대체·예제를 설명한다.
  사용자 선택으로 팀 가이드의 기본 명령은 npx docatlas다. 릴리스 번호를 고정하지 않고 필요 시 @latest 실행과 로컬 설치본 갱신을 설명한다.

## Python·Java 기본 제외와 Windows 점검 — 다음 후보 계약

- 기본 exclude에 **/.venv/**, **/venv/**, **/__pycache__/**, **/.pytest_cache/**,
  **/.mypy_cache/**, **/.ruff_cache/**, **/.tox/**, **/.nox/**, **/.eggs/**, **/*.egg-info/**,
  **/target/**, **/.gradle/**, **/.m2/**를 추가한다. 모든 깊이에 적용하고 기존 기본값을 유지한다.
- 고정 제외로 승격하지 않는다. include/--docs-dir/--all-md는 기본 제외를 우회하지 않으며,
  명시적 exclude 배열은 기존 계약대로 기본 목록을 대체한다. exclude: [] 재포함도 검증한다.
- 소스 언어·패키지 manifest의 유무로 문서를 분류하지 않는다. Python/Java/Gradle 코드·설정을 실행하지 않는다.
  env/bin/out/vendor, target-design/venv-guide 같은 유사 이름과 업무 문서는 과도하게 제외하지 않는다.
- Windows --root에는 네이티브 드라이브/역슬래시/공백 경로를 허용한다. JSON·--docs-dir·문서 id·Markdown 링크는 / 규칙을 유지한다.
  내부 파일 경로는 node:path, 공개 id/링크는 POSIX 경로를 사용한다. 드라이브 밖 경로·링크 읽기를 허용하지 않는다.
- npm의 Windows 실행 shim은 npm CLI를 Node로 실행해 검증한다. .cmd를 Unix 실행 파일/심볼릭 링크로 가정하지 않는다.
- 터미널 Ctrl+C와 테스트의 subprocess.kill('SIGINT')를 구분한다. Windows 프로그램 종료는 후자가 강제 종료이므로 정상 정리 증거로 쓰지 않는다.
  자동 검증은 run의 주입 신호로 정리 경로를 확인하며 실제 콘솔 Ctrl+C는 별도 수동 관문으로 둔다.
- macOS/Windows의 Node 22·24 플랫폼 검증과 브라우저 CI를 준비한다. 원격 실행 전에는 Windows 통과나 공식 지원을 주장하지 않는다.
  네이티브 Windows 실행·PowerShell/CMD·기본 브라우저·Ctrl+C·UNC/네트워크 드라이브 인수는 TBD다.
  Windows CI 대상은 test:platform과 test:browser다. 기존 npm test/test:integration에는 POSIX 심볼릭 링크·강제 신호 전제가 남아 있어 전체 Windows 통과를 주장하지 않는다.

근거: [Python venv](https://docs.python.org/3.14/library/venv.html),
[Maven target](https://maven.apache.org/guides/introduction/introduction-to-the-standard-directory-layout.html),
[Gradle 디렉터리](https://docs.gradle.org/current/userguide/directory_layout.html),
[Node 신호](https://nodejs.org/api/process.html#signal-events).

## 읽기 모델 — Phase 1

| 모델 | 필드 초안 | 의미 |
| --- | --- | --- |
| Project | id, displayName, rootLabel | 실행 대상과 화면 식별 |
| FeatureGroup | id, parentId, sourceDirectory, title, summary, documentIds, childIds, isStructural | 문서 묶음 또는 구조 그룹 |
| SourceDocument | id, relativePath, groupId, kind, title, summary, canonicalId, contentHash | 파일별 메타데이터 |
| IndexSnapshot | revision, project, groups, documents, redirects, warnings | 화면에 일관되게 전달할 스냅샷 |

본문은 선택 시 읽거나 별도 인덱스에서 제공한다. 지도 목록에 전체 본문을 항상 싣지 않는다.
원본 Markdown, 렌더링 결과, 검색용 일반 텍스트를 구분한다.
그룹·문서는 같은 입력에 같은 순서로 정렬한다. revision은 프로젝트·메타데이터·내용 해시·
그룹·경고의 SHA-256이며 시각 정보를 넣지 않는다. canonicalId는 명시적인 이전 문서의 최종 대상 id이며 일반 문서는 null이다.
IndexSnapshot은 redirects 배열(source/targetId)을 포함하며 본문은 별도 내부 인덱스에 둔다.

## 지도와 읽기 화면

```text
[ 프로젝트 이름 ]                       [ 문서 검색 ]

문서 지도                         │ 선택한 문서
▾ 콘텐트 목록                     │ 제목 · 소속 경로
  목록의 구성과 표시 규칙          │ 목차
  [요구사항] [설계] [구현] [검증]   │
  ▸ 필터                          │ Markdown 본문
▸ 공통 계약                       │
```

- 화살표는 자식 그룹을 펼치고 접는다.
- 카드 본문은 해당 그룹의 문서 선택 항목을 펼친다.
- 문서 선택 항목은 본문을 연다. 현재 선택을 시각적으로 표시한다.
- 제목·설명이 있는 얇은 가로 카드를 기본 형태로 사용한다.
- 지도와 본문의 스크롤은 독립적으로 유지한다.
- 넓은 화면은 분할 배치, 좁은 화면은 지도/본문 전환을 제안한다.
- 트리 펼침, 문서 선택, 뒤로 가기를 키보드로 조작할 수 있게 한다.
- 이동 후 선택 문서가 삭제되면 빈 본문과 삭제 안내를 표시한다.
- 문서 0개이면 발견 규칙과 설정 위치를 안내한다.

Phase 2에서는 지도 폭 410px(넓은 화면 440px), 기본 카드 높이 57px를 사용한다.
900px 이하에서는 지도/본문을 전환한다. 기본 HTML 버튼으로 Tab·Enter·Space를 지원한다.
지도 스크롤·펼침·선택을 현재 페이지에서 유지한다. 본문·원문 모드의 위치와 브라우저 뒤로/앞으로 가기는 Phase 3에서 구현했다.

## Markdown과 링크 — Phase 3

표·코드 블록·제목 앵커·일반 목록을 지원한다.
markdown-it 15.0.3의 html:false로 raw HTML을 텍스트로 처리한다.
표·코드·읽기 전용 작업 체크박스를 렌더링한다. 코드 블록에는 언어와 구분된 배경을 표시한다.
github-slugger 2.0.0으로 한글·중복 제목을 구분한다. 내부 DOM id는 heading- 접두사를 써서
화면 요소와 충돌하지 않으며 URL의 앵커는 원래 slug다.

링크는 브라우저의 화면 URL이 아니라 원본 문서 디렉터리를 기준으로 해석한다.

| 대상 | 현재 동작 |
| --- | --- |
| 수집된 Markdown | 같은 뷰어에서 이동하고 브라우저 뒤로 가기 지원 |
| 같은 문서의 앵커 | 해당 제목으로 스크롤 |
| 루트 안의 허용된 래스터 이미지 | 원본 기준 경로로 검사·등록하고 이미지 API로 표시 |
| 수집 범위 밖의 Markdown | 상대 경로와 수집 범위 안내 |
| 코드·지원하지 않는 첨부 | 경로 표시·복사 |
| 외부 http/https | 외부 링크로 열기 |
| 존재하지 않거나 제외된 대상 | 이유를 안내하고 현재 문서를 유지 |

로컬 PNG/JPEG/GIF/WebP/AVIF를 제공한다. SVG·외부·data 이미지는 안내로 대체한다.
등록한 이미지 id만 /api/asset에서 읽고 각 요청에 고정 제외·ignore·설정 제외·실제 경로를 재검증한다.
파일 경로와 앵커는 한 번 디코딩하며 로컬 query는 경로 매칭에 사용하지 않는다.
프로젝트 밖 경로와 임의 프로토콜을 읽거나 실행하지 않는다.

## CLI와 서버 수명주기 — Phase 2

아래 인터페이스와 --help/-h, --version/-v를 지원한다.
2026-10-28 사용자 선택으로 기본 명령을 docatlas로 변경한다. docmap·ddd-docmap은 호환 이름으로 유지한다.

```sh
docatlas
docatlas --root ./some-project
docatlas --no-open
```

package.json의 세 bin 이름을 같은 bin/docatlas.js에 연결한다. 이전 bin/ddd-docmap.js는 호환 진입점으로 둔다.
개발 의존성으로 설치하면 실행 파일은 node_modules/.bin에 생긴다. npm은 npx --no-install docatlas 또는
scripts의 "docatlas": "docatlas"와 npm run docatlas로, pnpm은 pnpm docatlas로 실행한다.
사용자는 프로젝트별 설치 후 npx / pnpm으로 실행하는 방식을 선택했다.
일반 셸의 PATH를 자동 변경하거나 전역 런처를 추가하지 않는다.
도움말·브라우저 브랜드·제목·서버 안내는 docatlas를 기본 이름으로 쓰고 도움말에 기존 이름을 표시한다.

사용자 선택에 따라 기본 실행은 포그라운드다. 브라우저를 연 뒤에도 터미널에서
서버를 유지하며 Ctrl+C로 종료한다. --no-open은 브라우저를 열지 않고 주소를 출력한다.

- 서버는 loopback에 바인딩하고 OS가 선택한 사용 가능한 포트를 이용한다.
- 실행한 프로세스 하나가 자신의 서버와 변경 감지를 소유한다.
- 여러 번 실행하면 각각 별도 서버를 열며, 실행 중인 다른 서버를 재사용하지 않는다.
- Ctrl+C와 종료 신호를 받으면 자신의 서버·감지기·타이머를 정리한다.
- 종료는 다른 터미널에서 실행한 서버나 무관한 프로세스에 영향을 주지 않는다.
- 브라우저 열기 실패 시 서버 주소와 안내를 출력해 직접 접속할 수 있게 한다.
- 시작 성공은 서버 준비 확인 후 알린다. 시작 대기 시간은 측정 후 정한다.
- 종료 코드 초안: 성공 0, 실행 실패 1, 인자·설정 오류 2.

정상 종료와 도움말·버전은 종료 0, 실행 실패는 1, 잘못된 인자·설정·루트는 2다.
브라우저는 open 10.2.0에 위임한다. 준비 전에는 열지 않으며 열기 실패 시 서버를 유지한다.
SIGINT·SIGTERM의 정상 정리를 자동 검증했다. 지원 OS의 최종 실검증 범위는 IC-03·DC-10에서 관리한다.
백그라운드 실행·서버 재사용·stop/status 명령은 첫 버전의 범위 밖이다.
3단계 구현: 위치 인자를 받지 않는 계약의 예외로 agents 하위 명령 하나만 받는다. 세부는 아래 에이전트 스킬 설치 계약을 따른다.

## 검색·갱신·탐색 상태 — Phase 4 계약

PR-02·05·06·08 / DC-09, IC-03에 대응한다. 아래 계약으로 구현했고 Node와 Chrome에서 검증했다.

- 제목·기능명·경로(이전 경로 포함)·설명·본문의 일반 텍스트를 NFC와 영문 소문자로 정규화한다.
  공백으로 구분한 모든 검색어가 일치해야 한다. 메타데이터 일치를 본문보다 우선하고 동점은 상대 경로순이다.
  검색어는 200자 이하, 결과는 최대 50개와 전체 일치 수를 제공한다. 빈 검색은 계층 지도를 보여준다.
- /api/search?q=는 소속·일치 필드·약 160자 문맥을 반환한다. 본문 전체를 지도 API에 싣지 않는다.
  화면은 텍스트와 mark 요소로 일치를 표시하고 입력 중인 IME·취소된 요청을 구분한다.
- chokidar 5의 polling(일반 경로 300ms, 래스터 500ms)과 저장 안정화 100ms, debounce 150ms로 직렬 재수집한다.
  macOS native fs.watch에서 초기 파일 이벤트 직후 3ms 내 저장이 누락되는 것을 재현해 polling을 채택했다.
  제외 경로와 비관련 파일은 감지하지 않는다. 큰 프로젝트의 감지 비용은 Phase 5에서 측정한다. 지도·검색·본문을 같은 세대에서 교체한다.
  /api/map, /api/search, /api/document에는 실행 내 증가하는 sequence를 제공한다.
  본문 해시 기반 revision과 이미지·참조 변경도 포함하는 sequence를 구분한다.
- /api/events의 SSE ready/change/update-error로 갱신한다. 재연결 ready에도 현재 세대를 실어 유실을 복구한다.
  수집 실패·잘못된 설정은 마지막 정상 인덱스를 유지하고 화면에 오류를 표시한다. 설정을 고치면 복구한다.
- 고정 제외·ignore·exclude 정책을 감지에도 적용한다. 설정과 .gitignore 변경은 감지 범위를 다시 만든다.
  서버 종료 시 SSE·감지기·타이머를 정리한다. 다른 서버와 탭의 상태는 메모리로 분리한다.
- 갱신 시 지도 펼침·검색어·선택·읽기/원문 모드·스크롤을 남아 있는 항목에서 보존한다.
  선택 문서가 삭제되면 낡은 본문을 지우고 경로와 안내를 남기며 다른 문서를 선택할 수 있다.
  진행 중인 사용자 문서 이동을 자동 갱신이 덮어쓰지 않는다. 영구 저장소에는 본문을 복제하지 않는다.
- redirects의 경로·타입 오류는 설정 오류다. 순환·자기 참조·없는 대상·제외된 이전 경로는 경고 후 연결하지 않는다.
  유효한 연결은 카드/검색에서 최종 문서를 한 번 표시하며 이전 경로 검색·URL·상대 링크도 최종 문서로 연다.
  이전 파일이 없어도 명시적인 연결은 유지한다. 실제 파일이나 문장의 이동 안내만 보고 추론하지 않는다.
- 기술 근거: [chokidar](https://github.com/paulmillr/chokidar),
  [Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html).

## 검색 결과의 경로 탐색 — 0.2.0 추가 계약

- 검색 결과마다 루트 기준 원본 경로 전체를 별도 버튼으로 표시한다. 문서 열기 버튼 안에 버튼을 중첩하지 않는다.
  제목·소속·일치 문맥은 본문 열기, 경로의 Show in tree는 지도 위치 탐색으로 구분한다.
- 경로를 누르면 입력·검색 결과를 즉시 비우고 진행 중인 검색을 취소한다. 늦은 검색 응답으로 목록이 다시 나타나지 않는다.
- 현재 지도에서 최종 문서 id를 확인하고 상위 그룹을 모두 펼친 뒤 소속 그룹의 문서 목록을 연다.
  대상 문서 버튼을 지도 스크롤 영역 안으로 이동하고 초점과 테두리 강조를 준다. 실제 읽는 문서의 선택 표시와 구분하고 갱신에도 유지한다.
  읽고 있던 본문·모드·읽기 스크롤·URL/이력은 유지한다.
  좁은 화면은 지도를 표시한다. 경로 찾기는 새로운 문서 열기를 시작하지 않는다.
- 진행 중인 사용자 본문 열기가 경로 찾기 이후 트리를 다시 바꾸지 않도록 취소한다. 자동 갱신은 현재 지도/본문 상태를 보존한다.
- 검색 결과의 문서가 갱신에서 사라지면 임의의 다른 문서를 찾지 않고 현재 지도와 안내를 표시한다.
  이전 경로 검색도 현재 문서의 실제 경로로 이동한다. docs 구조 경로 생략·루트 문서·동명/한글/긴 경로를 처리한다.
- 두 검색 버튼은 Tab과 Enter/Space로 사용할 수 있다. 갱신 뒤 초점은 같은 문서의 같은 동작으로 돌아가며 삭제되면 검색창으로 복구한다.
  긴 경로는 줄바꿈하며 모바일에서도 가로 넘침이나 본문으로의 강제 전환을 일으키지 않는다.

## 에이전트 스킬 설치 — 다음 후보 계약

대응: RQ-16·17·18 / PR-09·10 / DC-16~19 / M-16·17. 구현 전이다. 확인된 결정과 설계 제안을 구분한다.

### 확인된 결정 — 2026-10-28

- 원본은 agent-kit/의 designer·implementer·reviewer 스킬과 에이전트 룰이다. Confluence·ctxbin은 배포본이다.
- docatlas 하위 명령으로 설치한다. Claude 플러그인 마켓플레이스와 ctxbin 전용 방식은 채택하지 않았다.
  마켓플레이스는 Claude 전용이고 스킬 이름에 플러그인 접두사가 붙는다. ctxbin은 팀원에게 원격 저장소 접근이 필요하다.
- 기본 위치는 사용자 전역이고 프로젝트 설치는 옵션이다. 갱신은 같은 명령을 다시 실행하는 것이다.
- 기본 대상은 designer 한 쌍이다. implementer·reviewer는 명시적으로 선택한다.
- 팀 배포는 당분간 Confluence 사본을 유지한다. docatlas 설치 안내 시점은 사용자가 정한다.
- 공개 저장소와 npm 패키지에 스킬·룰 원본을 포함한다(DC-19).
- 에이전트가 설치를 대신 실행하도록 에이전트용 도움말과 대화형 질문 없는 출력을 제공한다(RQ-18).

### 클라이언트 위치와 같은 이름 규칙

2026-10-28 Claude Code·Codex 공식 문서에서 확인했다. 클라이언트 규칙이 바뀌면 다시 확인한다.

| 항목 | 전역 (기본) | 프로젝트 (옵션) | 같은 이름일 때 |
| --- | --- | --- | --- |
| Claude 스킬 | ~/.claude/skills/<name>/SKILL.md | <root>/.claude/skills/<name>/SKILL.md | 전역 우선 |
| Claude 룰 | ~/.claude/agents/<name>.md | <root>/.claude/agents/<name>.md | 프로젝트 우선 |
| Codex 스킬 | ~/.agents/skills/<name>/SKILL.md | <root>/.agents/skills/<name>/SKILL.md | 합치지 않고 둘 다 표시 |
| Codex 룰 | ~/.codex/agents/<name>.toml | <root>/.codex/agents/<name>.toml | 문서 미기재 (DC-18) |

전역 사본이 있는 사용자에게는 프로젝트 설치만으로 Claude 스킬 갱신이 전달되지 않는다. 이것이 전역 기본의 근거다.
Codex 룰은 name·description·developer_instructions를 가진 TOML이다. 원본 Markdown 본문을 developer_instructions로 변환한다.
본문은 TOML 여러 줄 literal('''…''')로 쓰고, '''나 TOML이 허용하지 않는 제어 문자가 있으면 escape한 기본 문자열로 쓴다(2단계 구현).

### 원본 형식 — 1단계 구현됨

- agent-kit/skills/<name>/SKILL.md와 agent-kit/agents/<name>.md에 둔다. 룰의 frontmatter에는 name·description만 쓴다.
- 원본 파일에 docatlas 전용 표시를 넣지 않는다. Confluence에서 복사한 사본과 설치본이 같아야 한다.
- frontmatter는 최상위 key: value와 두 칸 들여쓴 한 단계 map만 쓴다. 값은 따옴표 없는 문자열이나 큰따옴표 문자열이다.
  ": "·" #"·true·숫자처럼 YAML이 문자열로 읽지 않을 값은 큰따옴표로 감싼다.
- agent-kit/manifest.json(schema 1)은 kitVersion과 items를 가진다. 항목은 name·version·default·skill/agent의 path·sha256·previous다.
  previous 항목은 version·kind(skill/agent/codex-agent)·part(file/body)·sha256·source이며 현재보다 낮은 버전이어야 한다.
- 해시는 BOM을 지우고 CRLF/CR을 LF로 바꾸고 끝 공백을 지운 뒤 개행 하나를 붙인 UTF-8의 SHA-256이다.
  본문 해시는 frontmatter 뒤 본문(앞 빈 줄 제외)에 같은 규칙을 쓴다. Confluence 팀 페이지는 룰을 frontmatter 없이 싣기 때문에
  룰은 본문 해시로도 이전 배포본을 알아본다.
- 스킬 frontmatter의 metadata.version은 manifest 항목 version과 같다. 내용을 바꾸면 항목 version과 kitVersion을 함께 올린다.
- 검사는 개발 전용 scripts/agent-kit.js와 npm run check가 한다. 2단계에서 설치에 필요한 읽기·해시 규칙을 src/agent-kit/로 옮기고
  검사 스크립트가 그 모듈을 사용하게 한다.

### 명령 — 3단계 구현 (DC-17)

```sh
docatlas agents install [--project] [--root <dir>] [--target claude|codex|all] [--all | --only <name>] [--dry-run] [--force]
docatlas agents help
```

- 기본은 전역·designer 한 쌍이다. --project는 --root(기본 cwd) 프로젝트에 설치한다. --only는 반복할 수 있고 --all과 함께 쓸 수 없다.
- --target의 기본값은 설치된 클라이언트 감지다. ~/.claude가 있으면 Claude, ~/.codex나 ~/.agents가 있으면 Codex다.
  아무것도 없으면 --target을 요구한다.
- 결과는 탭으로 구분한 줄이다. 파일마다 동작·reason·클라이언트·종류·이름·경로를 쓰고, 이어서 backup·warning·record 줄과
  마지막 summary 줄(create·replace·unchanged·skipped·blocked 개수)을 쓴다. --dry-run은 동작 줄과 summary 줄 앞에 dry-run을 붙이고 쓰지 않는다.
- 대화형 질문을 하지 않는다(RQ-18). skip-*나 blocked가 있으면 나머지를 마치고 사용자 결정이 필요하다고 stderr에 알린다.
- 종료 코드: 0 완료(할 일 없음 포함), 3 완료했지만 사용자 결정이 필요한 항목 있음, 1 실패(이번 실행이 쓴 파일 복구), 2 잘못된 인자.
  기존 문서 지도의 0·1·2 의미는 유지하고, 3은 agents 명령에만 쓴다.
- 쓰기 순서: 설치 잠금 → 모든 대상이 판정 이후 바뀌지 않았고 링크가 생기지 않았는지 다시 확인 → --force 대상 백업 →
  임시 파일 후 이름 변경 → 설치 기록 갱신 → 잠금 해제. 백업은 ~/.docatlas/backups/<UTC 시각>/<global|project>/<대상 상대 경로>다.
  실패하면 이번 실행이 쓴 파일과 만든 폴더를 되돌린다.
- 설치 잠금은 <base>/.docatlas/install.lock이다(Test Hardening 추가). 이미 있으면 다른 설치가 진행 중으로 보고 아무것도 바꾸지 않고 종료 1로
  잠금 파일 경로를 알린다. 한 실행의 복구가 다른 실행이 쓴 파일을 지우지 않게 하기 위해서다.
- 교체와 복구 때 기존 파일의 권한 비트를 유지한다(Test Hardening 추가).
- 설치 기록에는 쓴 파일과 이미 같은 내용(unchanged)인 파일을 남긴다. 내용이 같으면 기록 파일을 다시 쓰지 않고,
  기록할 항목이 없으면 새 기록을 만들지 않는다.
- 문서 지도 옵션과 섞지 않는다. agents 외의 위치 인자는 지금처럼 오류다. 제거 명령은 이번 범위에 넣지 않았다.

### 에이전트용 도움말 — 3단계 구현 (RQ-18)

사람보다 에이전트가 설치를 대신 실행하는 경우가 많다. 2026-10-28 사용자가 아래 내용을 확인했다.
docatlas agents help(또는 agents install --help)는 네트워크 없이 다음을 출력한다.

- 하는 일, 설치 위치, 기본 대상과 선택 방법.
- 권장 순서: --dry-run → 결과를 사용자에게 보고 → 사용자 승인 후 적용.
- skip-modified·skip-downgrade·같은 이름 경고의 의미. --force는 사용자가 명시적으로 승인할 때만 쓴다.
- 결과 줄의 형식과 종료 코드.

- kit 버전과 항목별 버전·기본 설치 여부.

docatlas --help에는 agents install과 agents help를 가리키는 두 줄이 있다.
자동 테스트가 도움말 Options의 옵션 목록과 실제 옵션을 양방향으로 대조한다.

### 판정과 보호 — 2단계 판정 구현 (PR-09)

src/agent-kit/plan.js가 파일을 쓰지 않고 대상마다 아래 순서로 판정한다. 쓰기·백업·기록 저장은 install.js(3단계)가 한다.

| 순서 | 상황 | 동작 (reason) |
| --- | --- | --- |
| 1 | 경로가 심볼릭 링크를 지나거나 대상이 일반 파일이 아님 | blocked (symlink·not-directory·not-file). --force로도 쓰지 않는다 |
| 2 | 대상 파일 없음 | create (new) |
| 3 | 정규화 해시가 설치할 내용과 같음 | unchanged (same) |
| 4 | 대상 폴더의 .ctxbin-sync.json items에 이름이 있음 | skip-managed (ctxbin). 한 위치를 두 도구가 관리하지 않게 한다 |
| 5 | 설치 기록의 경로·해시와 같고 기록의 kitVersion이 패키지보다 높음 | skip-downgrade (downgrade) |
| 6 | 설치 기록의 경로·해시와 같음 | replace (recorded) |
| 7 | 이전 배포본의 파일 해시와 같음 | replace (previous-file) |
| 8 | 이전 배포본의 본문 해시와 같음(Codex 룰 제외) | replace (previous-body) |
| 9 | 그 외: 사용자가 고친 사본 | skip-modified (modified) |

- skip-* 항목은 --force일 때 백업 표시와 함께 replace가 된다. 그 밖의 replace는 백업하지 않는다.
- 심볼릭 링크를 지나는 경로에는 쓰지 않는다. 2단계 결정: 전역 설치에서는 클라이언트 폴더 자체(~/.claude 등)가
  디렉터리를 가리키는 링크여도 된다. dotfiles 저장소로 설정 폴더를 관리하는 사용자를 막지 않기 위해서다. 프로젝트 설치에는 이 예외가 없다.
- 설치 기록(schema 1)은 files의 "client/kind/name" 키마다 path·kitVersion·version·sha256을 둔다. 읽기 실패나 형식 오류는 경고 후 무시한다.
  위치는 전역 ~/.docatlas/agents.json, 프로젝트 <root>/.docatlas/agents.json(함께 커밋)이다. 백업은 ~/.docatlas/backups/다.
  수집기는 이미 .docatlas/를 기본 제외한다.
- 반대쪽 범위(전역↔cwd 프로젝트)에 같은 경로가 있으면 같은 이름 경고와 함께 클라이언트 규칙 표의 동작을 알린다.
- 쓰기 순서와 복구는 위 명령 계약을 따른다.

### 업데이트 안내 — 4단계 구현 (PR-10)

- 문서 지도 시작 시 패키지 manifest의 kitVersion과 전역·문서 지도 루트(기본 cwd, --root)의 설치 기록만 읽는다.
  기록 항목 중 패키지보다 낮은 kitVersion이 있으면 문서 수 안내 뒤에 한 줄을 출력한다.
  예: Agent skills: kit 1.1.0 is available (installed 1.0.0). Preview the update with: docatlas agents install --dry-run
- 미리보기 명령은 범위마다 만든다. 프로젝트 기록이면 --project를 붙이고, 낡은 항목에 기본 대상이 아닌 것이 있으면
  --only로 낡은 항목을 모두 지정해 같은 항목이 갱신되게 한다. kit에 없는 이름은 무시한다.
- 설치 기록이 없으면 안내하지 않는다. Confluence에서 손으로 복사한 사본에는 안내가 뜨지 않으므로, 팀이 준비될 때 설치 명령을 쓰기 시작하면 된다(4단계 결정).
- 파일을 쓰지 않는다. 서버 준비를 기다리게 하지 않고 비동기로 확인하며 읽기 실패는 무시한다. 종료를 시작한 뒤에는 출력하지 않는다.

## Phase 5 검증 계약

- 기존 Node 81개·Chrome 30개를 회귀 기준으로 유지한다.
- 감지기의 초기 준비·교체·오류·종료가 겹치는 상황과 SSE 연결이 열린 상태의 신호 종료를 검증한다.
  종료한 실행에서 새로운 갱신을 발행하지 않고 감지기·타이머·연결을 남기지 않는다.
- 제외 규칙 변경·읽기 실패·심볼릭 링크·인코딩 경로와 동명/긴 한글 문서·큰 표를 검증한다.
  수집/설정/ignore/이미지는 검사한 파일 descriptor로 읽는다. open 전후의 파일 동일성과 루트 경계를
  확인하고 파일/부모가 링크로 바뀌면 해당 읽기를 거부한다.
- 매 수집에서 원본 파일과 정책을 다시 읽는다. 이전 세대와 내용 해시가 같은 문서만 AST 메타데이터를
  재사용한다. mtime/size만으로 판단하지 않으며 제외/삭제 문서의 캐시는 새 세대에 남기지 않는다.
- F-08은 75개 기능의 4종 문서 300개, 본문 최소 16KiB, 여러 깊이, 비문서 파일 1,000개로 구성한다.
  준비 시간은 수집 시간과 분리한다. 반복 표본·환경·본문 바이트 수·수집/검색/저장 반영과
  유휴 CPU·RSS/heap을 기록한다. 자동 테스트의 제한 시간과 성능 회귀 기준을 구분한다.
- 측정 후 정하는 수치는 이 가상 예제와 기록한 환경의 회귀 기준이다. 모든 프로젝트의 성능 보장이 아니다.
- Phase 5 검증을 마쳤다. F-08의 측정 결과·표본과 채택한 로컬 회귀 기준은
  [구현 계획의 검증 기록](./IMPLEMENT.md#phase-5-완료-검증--2026-10-28)을 기준으로 삼는다.
  같은 본문의 재사용은 저장 반영 중앙값을 907.88ms에서 599.30ms로 줄였다. 장시간 메모리 상한을 보장하지 않는다.

## Phase 6 통합 검증 계약

- npm run test:integration은 실제 npm pack 결과를 별도 임시 디렉터리에 production 의존성만 설치한다.
  설치된 CLI·공개 수집 API·HTTP·Chrome으로 검증하며 소스의 서버 모듈을 직접 실행하지 않는다.
- 프로젝트별 설치 검증은 F-07 JS 대상에도 tarball을 개발 의존성으로 설치한다. 설치된 .bin/docatlas와
  호환 .bin/docmap·.bin/ddd-docmap, npm exec와 npm run docatlas의 명령 발견을 확인한다.
- F-07의 JS/비 JS 프로젝트에서 cwd·--root·루트 별칭, 4종 선택·서식·참조·검색·갱신·신호 종료를 확인한다.
  두 실행 중 하나를 종료해도 다른 실행의 내용과 상태가 유지되어야 한다.
- 실행 전후 파일 목록과 내용 해시를 비교한다. 검증 중 명시적으로 저장한 내용 외의 변경은 실패다.
  설치 단계의 명시적 manifest/lockfile/node_modules 변경 이후를 기준으로 원본을 비교한다.
  프로젝트의 빌드나 설치 스크립트는 실행하지 않는다.
- DOCMAP_NPM_CACHE로 설치 캐시를 지정할 수 있으며 오프라인 설치를 기본으로 한다.
  Chrome은 기존 DOCMAP_BROWSER_CHANNEL 설정을 따른다. 최종 지원 OS·최소 Node·사람의 수동 인수는 별도 기록한다.

## 배포와 구현 선택

2026-10-28 사용자 선택: npm 패키지는 unscoped docatlas, 공개 GitHub 저장소는
superlucky84/docatlas, 라이선스는 MIT다. 0.2.0은 사용자가 배포했고 다음 공개 후보는 0.2.1이다.
name/version/license/bin과 lockfile 루트를 함께 바꾸며 self import는 docatlas로 갱신한다.
0.1.0의 ddd-docmap.config.json은 0.2.0에서 fallback으로 유지하며 기본 파일명은 docatlas.config.json이다.
기존 내부 상태 키는 호환성을 위해 유지한다.

npm files는 bin/·src/로 제한하고 README·package.json·LICENSE의 자동 포함을 확인한다.
RQ-17 3단계에서 agent-kit/를 files에 추가했다. 스킬·룰 원본 6개와 manifest·README가 패키지에 들어간다.
기준 문서·AGENTS·보존 패치는 GitHub에서 제공한다. README의 문서 링크는 GitHub의 새 저장소를 가리킨다.
검증한 tarball을 별도 설치해 실제 docatlas 실행·공개 import·화면·신호 종료를 확인한다.
README의 기본 사용 명령은 docatlas다. 프로젝트 루트에서의 npx 일회성 실행과 npm/pnpm 로컬 설치,
다음 버전의 tarball을 설치하는 방법을 별도 항목으로 설명한다.
0.2.0은 사용자가 배포를 완료했다. 이번 0.2.1 작업은 준비까지만 수행하며 실제 npm publish는 실행하지 않는다.

배포 패키지에 CLI·수집기·서버·빌드된 화면을 함께 포함한다.
설치 대상 프로젝트에서 화면 빌드를 실행하지 않게 한다.

기술 후보를 평가할 때 유지보수성, Node 최소 버전, 패키지 크기, Markdown 기능,
실제 파일 갱신과 테스트 용이성을 기록한다. 수집기 의존성은 IC-01을 따르며
화면은 기본 DOM·ES modules·CSS이며 별도 번들링 없이 완성된 자산을 패키지에 포함한다.
렌더링은 markdown-it, 변경 감지는 chokidar 5.0.0을 사용한다.

## 결정 체크리스트

### Phase 1 구현 계약

아래 계약으로 수집기를 구현하고 자동 검증 결과를 기록한다.

- 공개 API는 collectProject(root)이며 화면·서버 없이 IndexSnapshot을 반환한다.
- 기본 include는 위 예제를 따르고 패턴은 대소문자 무시·숨김 경로 포함으로 평가한다.
- 우선순위는 고정 제외 → .gitignore → exclude → include다. include로 제외를 우회하지 않는다.
- .gitignore는 Git 유무와 관계없이 중첩 디렉터리별로 읽고, 경로에 대한 대소문자는 구분한다.
  하위 규칙이 상위 파일 제외를 해제할 수 있지만 제외된 부모 디렉터리는 탐색하지 않는다.
- 디렉터리·파일 심볼릭 링크는 수집하지 않는다. 실행 루트의 별칭만 실제 경로로 정규화한다.
- 원본 경로의 구조 그룹과 루트 그룹(.)을 유지한다. docs 생략은 후속 화면의 표현 문제다.
- 문서에는 contentHash를 포함하고 snapshot revision에 반영해 본문만 바뀌어도 구분한다.
- JSON version 1의 필드는 version/include/exclude/groups/redirects다.
  알 수 없는 필드·타입·비정상 상대 경로·glob 오류는 설정 오류로 처리한다.
- 그룹 보정이 수집된 그룹과 일치하지 않으면 경고한다. 코드 설정이나 front matter 메타데이터는 실행·해석하지 않는다.
- 제목과 설명은 CommonMark 구문 트리에서 추출한다. YAML front matter 블록은 건너뛴다.
  그룹 제목의 알려진 문서 종류 접미사는 제거하며 결과가 비면 폴더명을 사용한다.
- 일반 문서 읽기 실패는 해당 문서를 제외하고 경고한다. ignore 파일 읽기 실패는 그 하위 탐색을 중단하고 경고한다.
- 정렬은 locale에 의존하지 않는 원본 상대 경로 순서다. 그룹 안의 문서는 종류 순서를 먼저 적용한다.
- 자동 테스트는 Node 기본 test runner를 사용한다. 라이브러리 API 근거:
  [picomatch](https://github.com/micromatch/picomatch),
  [ignore](https://github.com/kaelzhang/node-ignore),
  [mdast-util-from-markdown](https://github.com/syntax-tree/mdast-util-from-markdown),
  [Node 22 test runner](https://nodejs.org/docs/latest-v22.x/api/test.html).

### Phase 2 구현 계약

- Node HTTP 서버와 브라우저 기본 ES modules·CSS를 사용한다. src/web/의 완성된 정적 자산을
  패키지에 포함하고 설치 대상 프로젝트의 빌드 없이 제공한다.
- CLI는 기본 cwd, --root, --no-open, --help/-h, --version/-v를 지원한다.
  준비된 서버 주소를 출력한 다음 브라우저를 열며, 포그라운드를 유지한다.
- 서버 API는 /api/map과 /api/document?id=원본상대경로다. 수집한 문서 id만 본문을 읽을 수 있다.
  루트 경계·심볼릭 링크·일반 파일 여부를 요청 시 다시 확인한다.
- 정적 자산은 고정 목록만 제공한다. loopback에 바인딩하고 다른 Host·Origin을 거부한다.
- Ctrl+C와 SIGTERM은 이 프로세스의 서버를 닫으며 다른 실행에는 영향을 주지 않는다.
  브라우저 열기 실패는 주소와 안내를 남기고 서버를 유지한다.
- 지도는 구조 그룹과 문서 그룹을 구분한다. 문서 없는 docs 그룹은 화면에서만 투명하게 펼친다.
  화살표는 하위 구조, 카드 본문은 문서 버튼을 펼친다. 문서 선택과 지도 스크롤을 보존한다.
- 이 단계의 본문은 Markdown source로 명시하고 안전한 텍스트로 표시한다.
  제목·표·코드 렌더링과 문서 링크 탐색은 Phase 3에서 완성한다.
- 넓은 화면은 지도/본문 분할, 좁은 화면은 지도와 본문을 전환한다. 기본 버튼으로 키보드 탐색한다.
- HTTP·CLI는 Node test runner, 실제 화면은 개발 전용 Playwright로 검증한다.
  기본 브라우저 열기는 open 패키지에 위임하며 지원 OS별 실검증 범위는 별도로 기록한다.
- 기술 근거: [Node HTTP](https://nodejs.org/docs/latest-v22.x/api/http.html),
  [open](https://github.com/sindresorhus/open),
  [Playwright](https://playwright.dev/docs/test-use-options).

### Phase 3 구현 계약

- 서버에서 markdown-it을 html:false로 렌더링하고 github-slugger로 한글·중복 제목의 앵커를 만든다.
  표·펜스 코드·읽기 전용 작업 체크박스를 지원한다. 원문은 별도 모드로 보존한다.
- 링크의 파일 경로는 원본 문서 디렉터리 기준이며 /로 시작하면 프로젝트 루트 기준이다.
  URL 경로·앵커를 한 번 디코딩하고 실제 파일 경계와 제외 규칙을 확인한다.
- 수집된 Markdown은 같은 뷰어로 이동한다. 디렉터리는 수집된 README로 연결할 수 있다.
  수집 밖 Markdown·없는 파일·차단된 경로는 현재 본문을 유지하며 이유를 안내한다.
  코드·첨부는 내용을 실행하거나 제공하지 않고 상대 경로 표시·복사만 지원한다.
- 외부 http/https 링크는 별도 탭에서 연다. raw HTML은 텍스트로 표시한다.
  이미지는 프로젝트 안의 PNG/JPEG/GIF/WebP/AVIF만 제공하며 SVG·외부 이미지는 안내로 대체한다.
- 이미지 제공은 본문에 등장해 확인한 참조를 등록한 뒤, 요청 시 경계·제외 규칙을 다시 확인한다.
  수집기와 이미지 접근은 같은 고정 제외·ignore 판단 함수를 사용한다.
- /api/document는 markdown/html/headings/references를 제공하며 /api/asset은 등록한 이미지 id만 허용한다.
- 지도와 본문 스크롤을 분리하고 history entry별 지도·펼침·모드·읽기 위치를 현재 탭 메모리에 보존한다.
  직접 문서·앵커 URL, 같은 문서 앵커·목차, 뒤로/앞으로 가기를 지원한다.
- 기본은 읽기 모드이며 원문 전환을 제공한다. 실패·늦은 응답이 현재 선택 본문을 덮어쓰지 않게 한다.
- 기술 근거: [markdown-it](https://markdown-it.github.io/markdown-it/),
  [github-slugger](https://github.com/Flet/github-slugger).

[x]는 채택한 결정, [ ]는 TBD이며 본문은 그 결정을 위한 구체적인 초안이다.
설계 결정을 해소할 때 근거와 대응 검증 결과를 함께 기록한다.
기술 선택은 해당 단계에서 검증하며 일상적인 선택마다 별도 사용자 승인을 요구하지 않는다.

- [x] DC-01: 독립 저장소와 단일 설치 패키지. 검증: M-11.
- [x] DC-02: JavaScript ES modules, 현재 최소 Node.js 22. 지원 검증: M-12.
- [x] DC-03: 원본 Markdown을 읽고 설치 경로와 대상 루트를 구분. 검증: M-07, M-11, M-15.
- [x] DC-04: Phase 1 구현 계약의 발견·제외·중첩 ignore·계층·경로 id를 채택했다.
  수집기 자동 검증 통과. M-01, M-02, M-09, M-13의 수집 조건.
- [x] DC-05: AST 기반 제목·설명과 JSON version 1의 설정을 채택했다.
  metadata/config 자동 검증 통과. M-02, M-09의 수집 조건.
- [x] DC-06: 900px 기준 분할/전환, 기본 버튼의 키보드 탐색, 지도 상태 보존을 채택했다.
  Chrome 검증 통과. Phase 3에서 본문·모드 위치와 뒤로/앞으로 가기를 구현했다. M-03, M-04, M-12.
- [x] DC-07: Phase 3의 렌더링·앵커·문서/파일/이미지 참조·HTML 정책을 채택했다.
  Node와 Chrome 검증 통과. M-04, M-06, M-13의 해당 흐름.
- [x] DC-08: 사용자 선택으로 포그라운드 실행과 Ctrl+C 종료를 채택한다. 서버별 소유·정리는 Phase 2에서 검증한다. M-08, M-14.
- [x] DC-09: Phase 4 계약의 검색·직렬 갱신·SSE·탭 메모리 상태 보존을 채택한다. Node·Chrome 검증 통과: M-05, M-07, M-10의 해당 흐름.
- [ ] DC-10: 라이선스 MIT·패키지/저장소 docatlas는 확정했고 0.1.0을 배포했다. 최종 지원 OS는 남아 있다. Phase 7 / M-11, M-12.
- [x] DC-12: 사용자 선택은 docatlas 패키지/명령·superlucky84/docatlas 저장소와 MIT다.
  구현·검증 결과는 이름 변경 단계에서 기록한다. 0.1.0은 사용자 배포 완료, 0.2.0과 최종 지원 OS 검증은 별도다. M-08, M-11.
- [x] DC-13: 수집 범위 옵션과 새 설정 파일은 위 0.2.0 계약을 채택한다. 구현/검증은 아래 추가 단계에서 추적한다. M-01, M-07, M-09, M-11, M-13.
- [x] DC-14: 검색 경로는 별도의 트리 위치 탐색 동작으로 제공하며 현재 본문을 보존한다. 구현/검증은 추가 단계에서 추적한다. M-03, M-05, M-07, M-12.
- [x] DC-15: Python·Java 기본 제외와 Windows 점검은 위 계약을 따른다. 실제 Windows 지원 확정은 CI/수동 결과 후 결정한다. M-01, M-07, M-08, M-09, M-11, M-12, M-13.
- [x] DC-16: 2026-10-28 사용자 선택. 스킬·룰 원본은 agent-kit/, 설치는 docatlas 하위 명령, 기본 전역·프로젝트 옵션,
  재실행 갱신, 기본 designer 한 쌍, 당분간 Confluence 배포 유지. 구현 전. M-16, M-17.
- [x] DC-17: 위 명령 계약대로 명령 이름·옵션·결과 줄·종료 코드(3 추가)·백업 위치를 3단계에서 구현했고, 클라이언트 감지·
  설치 기록 형식·ctxbin 관리 사본 처리·링크 예외는 2단계에서 구현했다. 제거 명령은 범위에 넣지 않았다. M-16.
- [ ] DC-18: Codex 프로젝트 .codex/agents의 로드 조건(프로젝트 신뢰 여부)과 전역/프로젝트 같은 이름 우선순위.
  공식 문서에 없어 실제 Codex에서 확인한다. M-17.
- [x] DC-19: 2026-10-28 사용자 확인. 공개 저장소와 npm 패키지(MIT)에 스킬·룰 원본을 포함한다. M-16.
- [x] DC-11: 프로젝트별 설치와 docmap/ddd-docmap 공통 진입점을 구현하고 설치 검증을 통과했다.
  사용자 선택은 npx docmap / pnpm docmap이며 전역 런처를 추가하지 않는다. M-08, M-11.
- [x] IC-01: picomatch 4.0.7, ignore 7.0.14, mdast-util-from-markdown 2.1.0과
  Node 기본 test runner를 채택했다. 공식 API 확인과 Node 24 자동 검증 통과.
  Phase 4는 Node 22.12.0에서 검증했다. 선언한 하한 22.0과 최종 OS 범위는 배포 전 확정한다. Phase 3 렌더러는 markdown-it 15.0.3, 앵커는 github-slugger 2.0.0이다.
- [x] IC-02: Node HTTP + 기본 DOM/ES modules/CSS로 구현하고 src/web 정적 자산을 패키징한다.
  프레임워크·프로젝트별 빌드가 필요 없다. M-03, M-11.
- [ ] IC-03: open 10.2.0과 SIGINT·SIGTERM 정리는 Phase 2에서 채택·검증했다.
  파일 감지는 chokidar 5.0.0을 채택한다. OS별 최종 지원 범위는 Phase 7의 TBD다. M-07, M-08, M-12.

## 인계 상태 — 2026-10-28

아래 이전 인계는 각 시점의 작업 기록이다. 현재 상태는 맨 아래 최신 인계를 따른다.

- 사용자 요청으로 재개해 보존 패치를 적용하고 Phase 5 검증 계약을 구현·검증했다.
- Phase 6의 설치된 CLI/API/브라우저 통합 검증은 통과했다. 전체 수동 인수·지원 환경은 별도다.
- 다음: 남은 M 항목과 Node 하한·지원 OS를 검증하고 Phase 7의 DC-10·IC-03을 해소한다.
- 기술적 차단 없음. 라이선스·배포 경로·최종 지원 OS는 TBD다.
- 최신 확인 커밋(이번 작업 전): 4b8b195. 이번 구현·테스트·검증 기록은 사용자 요청으로 함께 커밋한다.
- 상세 검증과 명령: [구현 계획의 최신 인계](./IMPLEMENT.md#인계-상태--2026-10-28).

## 프로젝트별 설치 인계 — 2026-10-28

- 사용자 선택: 프로젝트별 개발 의존성 설치 후 npx docmap / pnpm docmap으로 실행한다.
- docmap과 ddd-docmap을 같은 bin에 연결했고, 도움말·오류 안내·로컬 명령 발견과 설치된 CLI 흐름을 검증했다.
- 로컬 설치 없이 npx docmap을 실행하면 다른 registry 패키지를 찾을 수 있다. 이 패키지 배포 후 일회성 실행은
  npx --package=@superlucky84/ddd-docmap docmap으로 패키지를 명시한다. 현재는 미배포다.
- 다음: 사용자의 실제 프로젝트에 tarball 설치 후 사용성 인수. 전역 런처·셸 변경은 추가하지 않는다.
- 차단 요인: 기술적 차단 없음. npm 배포와 최종 지원 환경은 기존 TBD다.
- 최신 확인 커밋: 2cb552b. 이번 명령·테스트·문서 변경은 작업 트리에 있다.

## docatlas 인계 — 2026-10-28

- DC-12의 docatlas 이름·MIT와 세 bin 공통 진입점·공개 import·브라우저 브랜드를 구현·검증했다.
- GitHub 저장소는 https://github.com/superlucky84/docatlas이며 ID 1435263800과 공개 상태를 유지한다.
- npm 후보는 docatlas@0.1.0이다. README·LICENSE·bin/·src/의 28개 파일과 배포 dry-run을 확인했다.
- 사용자 선택은 배포 준비까지다. 원본 설정 파일과 이전 두 명령의 호환 정책을 유지한다.
- 다음: 실제 사용성 인수와 지원 환경 검증, 이후 npm 인증 갱신과 배포. 준비 범위의 기술적 차단 없음.

## 0.2.0 수집 범위·설정 인계 — 2026-10-28

- DC-13 계약을 구현했다. 공개 수집 옵션은 CLI/서버 없이도 사용하며 각 실행에 복사·고정한다.
- 새 설정 우선·이전 이름 fallback·실제 오류 파일명·두 파일 감지·옵션 유지·없는 추가 폴더 갱신을 검증했다.
- 범위를 넓혀도 기존 제외·읽기 경계·래스터 자산 등록·세대·종료 정책을 유지한다.
- 문법 50개·Node 109개·Chrome 34개·설치 통합 4개와 패키징/문서 예제 검증이 통과했다.
- README·--help·Confluence 가이드 버전 3에 설정 전체와 버전별 차이를 반영했다. npm 0.2.0은 미배포다.
- 다음: 실제 프로젝트 사용성 인수, 별도 npm 배포와 남은 지원 환경 검증. 기술적 차단 없음.
- 최신 확인 커밋: ceb5b3e. 이번 변경은 미커밋이며 상세 근거는 구현 계획의 0.2.0 완료 기록을 따른다.

## 0.2.0 검색 경로 탐색 인계 — 2026-10-28

- DC-14 구현 완료. 검색 결과는 본문 열기와 경로 위치 찾기를 별도 버튼으로 제공한다.
- 경로 위치 찾기는 현재 지도에서 최종 문서를 확인해 상위를 펼치고 해당 문서 버튼을 스크롤·초점·강조한다.
  locatedId는 읽는 문서의 selectedId와 분리하며 자동 갱신과 지도 이력 복원에서 보존한다.
- 검색 취소와 진행 중인 사용자 본문 열기 취소를 구분한다. 자동 본문 갱신은 위치 찾기 상태를 유지한다.
- 문법 51개·Chrome 40개·설치 통합 4개와 실제 화면 검토가 통과했다. README와 기준 4종에 반영했다.
- 다음: 실제 프로젝트 인수와 별도 npm/팀 가이드 반영. npm 0.2.0은 미배포다. 기술적 차단 없음.
- 최신 확인 커밋: ceb5b3e. 이전 작업과 이번 검색 변경은 미커밋 상태로 유지한다.

## 커밋·배포 준비 인계 — 2026-10-28

- DC-13·14의 구현과 검증을 c16a862에 포함했고 사용자 요청으로 origin/main에 푸시했다.
- 현재 버전 0.2.0과 기존 0.1.0 설정 호환 계약을 유지한다. npm 최신은 조회 당시 0.1.0이고 실제 0.2.0 배포는 미실행이다.
- 다음: 사용자가 안내한 npm 배포를 수행하고 registry/실제 프로젝트 실행을 확인한 뒤 배포 상태 문서를 갱신한다.
- 기술적 차단 없음. 최종 수동 인수·지원 환경 검증은 기존 범위로 남긴다. 최신 구현 커밋: c16a862.

## 0.2.1 Python·Java 기본 제외와 Windows 인계 — 2026-10-28

- DC-15 구현·로컬 검증 완료. 기존 5개 기본 제외에 언어별 13개를 추가해 18개 패턴을 사용한다.
- 설정의 기본 목록 대체·범위 옵션·고정 제외·ignore·읽기/감지 경계를 유지했다. 일반 경로·소스/manifest를 실행하거나 수정하지 않는다.
- 플랫폼 검증은 실제 네이티브 경로·한글/공백·CRLF·링크/래스터·감지/재설정·주입 신호 정리·설치된 npm 실행기를 확인한다.
- macOS Node 22.12.0에서 문법 54개·Node 115개·Chrome 40개·설치 통합 4개, 플랫폼 6개와 패키징/문서 검증이 통과했다.
- Windows/macOS Node 22/24 CI는 작성했으나 원격 실행 전이다. Windows OS·PowerShell/CMD·기본 브라우저·실제 Ctrl+C·UNC의 공식 지원 여부는 TBD다.
  기존 전체 Node/설치 통합의 Windows 이식성도 이번 플랫폼 부분 검증과 구분한다.
- 다음: 별도 커밋·푸시 후 Windows CI와 실제 콘솔 인수, 이후 별도 0.2.1 배포/팀 가이드 반영. 기술적 차단 없음.
- 최신 확인 커밋: 1ec2bd6. 이번 후보는 미커밋·미배포이며 로컬 결과를 Windows 결과로 해석하지 않는다.
- 최신 구현 커밋: e9977a4. 새 GitHub main의 README·manifest에서 이름과 실행 계약을 재확인했다.

## 0.2.1 커밋·푸시 인계 — 2026-10-28

- DC-15 구현·플랫폼 테스트와 CI를 3eeda0c에 커밋했고 사용자 요청으로 main에 푸시한다.
- checkout/setup-node의 v7 action.yml을 실제 GitHub 태그에서 확인했다.
- 플랫폼 CI 상태: https://github.com/superlucky84/docatlas/actions/workflows/platform.yml. Windows 결과와 실제 콘솔/브라우저 인수는 구분한다.
- 최신 구현 커밋: 3eeda0c. 기술적 차단 없음. npm 0.2.1은 미배포이며 이후 사용자 배포 범위로 남긴다.

## DC-15 후속: 플랫폼 CI의 의존성 설치

- npm ci의 lockfile/tarball 캐시와 새 임시 프로젝트 설치에 필요한 packument 캐시를 동일하게 취급하지 않는다.
- test:platform의 최초 production tarball 설치는 --prefer-offline으로 캐시를 우선하고 누락 정보를 registry에서 받는다.
  설치 이후 세 bin의 도움말/버전 검사는 --offline으로 유지한다. 진단에도 설치 모드와 실행 모드를 구분한다.
- test:integration은 사전에 준비한 캐시에서의 엄격한 오프라인 설치를 계속 검증한다.
- CI push/PR의 docs/**만 바뀐 인계 커밋은 플랫폼 재실행을 생략하고 README·코드·테스트·workflow 변경은 실행한다.
  설치·브라우저 검사를 생략해 통과시키지 않는다. Windows 콘솔/브라우저 수동 인수와 자동 CI 결과는 별도다.

검증 근거: 967c175의 [run 40657181408](https://github.com/superlucky84/docatlas/actions/runs/40657181408)에서 macOS/Windows Node 22/24 네 작업이 모두 성공했다.
각 작업의 플랫폼 6개·실제 브라우저 40개·pack 29파일·문법 54개를 로그로 확인했다. Windows의 네이티브 경로와 npm .cmd 실행기도 통과했다.
로컬의 새 캐시 재현은 수정 전 5/6 통과와 ENOTCACHED, 수정 후 6/6 통과다. 다음은 실제 콘솔/기본 브라우저 인수와 별도 배포다.
최신 구현 커밋은 967c175이며 기술적 차단은 없다. Windows 전체 POSIX 기반 테스트나 수동 인수가 완료된 것으로 확대하지 않는다.
