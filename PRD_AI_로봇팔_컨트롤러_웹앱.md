# PRD — AI 로봇팔 컨트롤러 웹앱

> **프로젝트명:** AI Robot Arm Controller  
> **사용 수업:** AI 분류 모델로 로봇 팔 조작하기  
> **수업 일정:** 2026년 7월 17일 13:30~16:30, 총 3차시  
> **대상:** 서울특별시 중부교육지원청 융합정보영재교육원 중학생 11명  
> **개발 도구:** Claude Code  
> **배포:** GitHub Pages  
> **문서 상태:** 개발 실행용 PRD

---

## 0. Claude Code 최우선 실행 지시

이 문서를 읽은 Claude Code는 다음 원칙에 따라 작업한다.

1. 먼저 현재 저장소 구조, `git status`, 현재 브랜치, 원격 저장소를 확인한다.
2. 바로 코드를 수정하지 말고, 현재 상태와 구현 계획을 간단히 정리한 뒤 작업한다.
3. 아래 PRD의 **MVP 필수 기능을 모두 구현**한다.
4. p5.js, 백엔드 서버, 데이터베이스, API 키는 사용하지 않는다.
5. 브라우저에서 Teachable Machine 모델 추론과 Web Serial 통신을 모두 수행한다.
6. 하드웨어가 없어도 UI와 명령 처리 흐름을 시험할 수 있도록 **모의 장치 모드**를 구현한다.
7. 구현 후 반드시 다음 검증을 수행한다.
   - 의존성 설치
   - 타입 검사
   - 린트
   - 단위 테스트
   - 프로덕션 빌드
8. 검증에 실패하면 원인을 수정하고 다시 검증한다.
9. 검증이 모두 통과한 경우에만 변경 파일을 커밋한다.
10. 원격 저장소와 인증이 정상인 경우 현재 브랜치를 GitHub에 푸시한다.
11. `force push`, 기존 커밋 재작성, 임의의 브랜치 삭제, Git 설정 변경은 하지 않는다.
12. 푸시에 실패하면 성공했다고 말하지 말고, 실제 오류와 해결에 필요한 명령만 보고한다.

### 완료 시 실행해야 할 Git 절차

```bash
git status
git diff --check
npm install
npm run typecheck
npm run lint
npm test
npm run build
git status
git add -A
git commit -m "feat: build AI robot arm controller web app"
git push -u origin HEAD
```

저장소에 이미 다른 패키지 매니저가 사용되고 있다면 기존 방식을 유지한다.  
`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock` 중 기존 저장소에 있는 잠금 파일을 기준으로 하나만 사용한다.

---

# 1. 제품 개요

## 1.1 배경

학생들은 Teachable Machine에서 직접 이미지 분류 모델을 학습한 뒤, 해당 모델의 판단 결과에 따라 아두이노 로봇팔을 움직인다.

기존 계획에는 p5.js를 사용한 시리얼 통신이 포함되어 있었으나, 수업에서는 학생이 p5.js 코드를 수정하기보다 다음 작업에 집중할 수 있는 전용 웹앱이 필요하다.

```text
이미지 데이터 수집
→ AI 분류 모델 학습
→ 모델 판단 결과 확인
→ 라벨과 로봇 동작 연결
→ 실제 로봇팔 제어
→ 오작동 원인 분석 및 개선
```

웹앱은 학생이 만든 Teachable Machine 모델을 불러오고, 웹캠으로 실시간 추론한 뒤, Web Serial API를 통해 아두이노에 명령어를 전송한다.

## 1.2 핵심 가치

- AI의 판단 결과가 실제 물리적 행동으로 이어지는 과정을 직관적으로 경험한다.
- 웹 프로그래밍 문법보다 AI 모델 설계와 문제 해결에 집중한다.
- 교사가 수업 중 연결 상태와 오류 원인을 빠르게 확인할 수 있다.
- 학생 영상과 모델 입력은 브라우저 내부에서 처리하고 서버에 저장하지 않는다.

---

# 2. 목표와 비목표

## 2.1 제품 목표

1. Teachable Machine 이미지 모델 URL을 입력하여 모델을 불러온다.
2. 웹캠 영상을 사용해 실시간 이미지 분류를 수행한다.
3. 모델의 라벨별로 아두이노 명령어를 설정한다.
4. Web Serial API로 아두이노와 연결한다.
5. AI 분류 결과에 따라 로봇팔 명령어를 자동 전송한다.
6. 수동 제어로 각 명령어를 개별 시험한다.
7. 반복 명령, 오분류, 빠른 라벨 변화로 인한 위험 동작을 줄인다.
8. 상태 표시와 로그를 통해 오류 원인을 확인한다.
9. GitHub Pages에서 HTTPS로 배포한다.
10. 개발 완료 후 GitHub 커밋과 푸시를 수행한다.

## 2.2 수업 목표

학생은 다음 내용을 설명하고 수행할 수 있어야 한다.

- AI 모델이 웹캠 입력을 라벨과 확률로 변환하는 과정
- 확률 임계값이 필요한 이유
- AI 라벨을 하드웨어 명령어로 변환하는 방법
- 동일 명령 반복과 라벨 흔들림을 제어하는 방법
- 학습 데이터와 촬영 환경이 로봇팔 동작에 미치는 영향
- AI가 항상 정확하지 않으며 안전장치가 필요하다는 점

## 2.3 비목표

이번 버전에서는 다음을 구현하지 않는다.

- 회원가입 및 로그인
- 학생 계정과 학급 관리
- 서버 및 데이터베이스
- 웹캠 영상 또는 이미지의 서버 업로드
- 웹앱 내부에서 모델을 직접 학습하는 기능
- 아두이노 스케치 자동 업로드
- Bluetooth, Wi-Fi 통신
- 모바일 및 iOS 지원 보장
- 여러 로봇팔 동시 연결
- 클라우드 AI API 호출
- p5.js 사용

---

# 3. 대상 환경

## 3.1 권장 환경

- Windows 노트북
- 데스크톱 Chrome 또는 Edge 계열 브라우저
- USB 데이터 통신이 가능한 케이블
- Arduino Uno 또는 호환 보드
- Teachable Machine 이미지 분류 모델
- HTTPS로 배포된 GitHub Pages 사이트 또는 로컬 개발 서버

## 3.2 하드웨어 구성

로봇팔은 다음 부품을 기준으로 한다.

- SG90 9g 마이크로 서보모터 4개
- 28BYJ-48 5V 스테퍼모터 1개
- ULN2003 스테퍼모터 드라이버 보드 1개
- 아두이노 보드
- 외부 5V 모터 전원
- 아두이노와 외부 전원의 공통 GND

웹앱은 개별 모터 각도를 직접 제어하지 않는다.  
웹앱은 의미 단위의 명령 문자열만 보내며, 실제 각도와 스텝 수는 아두이노 코드가 관리한다.

---

# 4. 사용자와 주요 흐름

## 4.1 학생 사용자 흐름

1. Teachable Machine에서 이미지 분류 모델을 학습한다.
2. 모델을 업로드하고 공유 URL을 복사한다.
3. 웹앱에 모델 URL을 입력한다.
4. 모델의 라벨이 자동으로 나타나는지 확인한다.
5. 웹캠을 시작하고 분류 결과를 확인한다.
6. 라벨별 로봇팔 명령어를 지정한다.
7. 아두이노 연결 버튼을 눌러 포트를 선택한다.
8. 수동 버튼으로 로봇팔 동작을 시험한다.
9. 자동 제어를 켜고 AI 결과로 로봇팔을 움직인다.
10. 임계값, 안정화 시간, 재전송 조건을 조정하며 오작동을 개선한다.

## 4.2 교사 사용자 흐름

1. 브라우저, 웹캠, USB, 아두이노 연결 환경을 점검한다.
2. 모의 장치 모드로 웹앱 자체가 정상인지 확인한다.
3. 실제 장치 연결 후 수동 제어를 먼저 시험한다.
4. 학생별 모델 URL과 라벨 매핑을 확인한다.
5. 자동 제어를 시작하기 전에 로봇팔 주변 안전을 확인한다.
6. 연결 오류 발생 시 상태 카드와 로그를 확인한다.
7. 필요 시 STOP 버튼으로 자동 제어와 명령 전송을 즉시 중지한다.

---

# 5. 3차시 수업 적용 흐름

| 차시 | 시간 | 수업 활동 | 웹앱 사용 |
|---|---|---|---|
| 1차시 | 13:30~14:20 | Teachable Machine 분류 모델 학습 | 모델 URL 준비 |
| 휴식 | 14:20~14:30 |  |  |
| 2차시 | 14:30~15:20 | 모델 불러오기, 웹캠 추론, 라벨-명령 매핑 | 모델 및 AI 기능 사용 |
| 휴식 | 15:20~15:30 |  |  |
| 3차시 | 15:30~16:30 | 시리얼 연결, 수동 시험, 자동 제어, 미니 미션 | 전체 기능 사용 |

---

# 6. 기능 우선순위

## 6.1 MVP — 반드시 구현

- Teachable Machine 모델 URL 입력 및 로드
- 웹캠 시작·중지
- 실시간 분류 결과 표시
- 라벨별 명령어 매핑
- Web Serial 연결·해제
- 수동 명령 전송
- AI 자동 제어
- 확률 임계값
- 안정화 시간
- 명령 중복 방지
- STOP 버튼
- 연결 및 오류 상태 표시
- 송수신 로그
- localStorage 설정 저장
- 모의 장치 모드
- 반응형 데스크톱 UI
- GitHub Pages 배포 workflow
- README 및 아두이노 예제 코드
- 테스트, 빌드, 커밋, 푸시

## 6.2 P1 — 시간 여유가 있을 때 구현

- 이전에 승인한 시리얼 포트 재연결
- 모델 URL 예시와 도움말
- 설정 내보내기·불러오기 JSON
- 명령 전송음 또는 화면 피드백
- 전체 화면 수업 모드
- 키보드 단축키
- 웹캠 좌우 반전 선택

## 6.3 이번 버전 제외

- 다중 포트 연결
- 모터 각도 직접 편집
- 학생별 클라우드 저장
- 관리자 대시보드
- 원격 제어
- 모바일 앱 설치

---

# 7. 상세 기능 요구사항

## 7.1 앱 시작 및 호환성 검사

앱이 시작되면 다음 항목을 검사한다.

- `navigator.mediaDevices` 사용 가능 여부
- `navigator.serial` 사용 가능 여부
- HTTPS 또는 localhost 여부
- localStorage 사용 가능 여부

상단에 상태 배지를 표시한다.

```text
브라우저: 지원됨 / 제한됨
웹캠: 대기 / 사용 중 / 오류
아두이노: 연결 안 됨 / 연결됨 / 오류
AI 모델: 없음 / 불러오는 중 / 준비됨 / 오류
자동 제어: 꺼짐 / 켜짐 / 일시정지
```

Web Serial을 지원하지 않는 환경에서도 앱이 중단되면 안 된다.  
모델 추론과 모의 장치 모드는 계속 사용할 수 있어야 한다.

### 수용 기준

- 지원하지 않는 API가 있어도 흰 화면이 나타나지 않는다.
- 사용자가 문제 원인과 해결 방법을 이해할 수 있는 한국어 메시지가 표시된다.
- 실제 시리얼 기능만 비활성화되고 나머지 기능은 유지된다.

---

## 7.2 Teachable Machine 모델 불러오기

### 입력

Teachable Machine 호스팅 모델의 기본 URL을 입력한다.

예시:

```text
https://teachablemachine.withgoogle.com/models/모델ID/
```

### 동작

- 앞뒤 공백을 제거한다.
- 마지막 `/`가 없으면 자동으로 추가한다.
- 기본 URL을 기준으로 `model.json`과 `metadata.json`을 불러온다.
- 모델 로딩 중에는 중복 요청을 막는다.
- 로드 성공 시 클래스 수와 라벨 목록을 표시한다.
- 새 모델을 불러오면 이전 예측 루프를 안전하게 중지한다.
- 모델 로드 실패 시 기존 정상 모델을 즉시 폐기하지 않는다.

### 오류 처리

- 빈 URL
- URL 형식 오류
- Teachable Machine 모델이 아닌 주소
- 네트워크 오류
- `model.json` 또는 `metadata.json` 접근 실패
- 모델 형식 불일치

### 수용 기준

- 마지막 슬래시가 없는 정상 URL도 불러온다.
- 성공 시 모든 라벨이 정확히 표시된다.
- 실패 시 앱이 멈추지 않고 재시도할 수 있다.
- 오류 메시지에 개발자용 스택 전체를 학생에게 노출하지 않는다.

---

## 7.3 웹캠과 실시간 추론

### 기능

- 웹캠 시작
- 웹캠 중지
- 카메라 권한 오류 안내
- 영상 좌우 반전
- 최고 확률 라벨 강조
- 전체 라벨별 확률 표시
- 추론 시작·정지

### 성능 기준

- 추론 빈도는 최대 약 10회/초로 제한한다.
- 한 프레임의 추론이 끝나기 전에 다음 추론을 중첩 실행하지 않는다.
- 탭이 비활성화되거나 웹캠이 중지되면 불필요한 추론을 멈춘다.
- 모델과 웹캠이 모두 준비된 경우에만 예측한다.

### 표시

각 라벨에 대해 다음을 표시한다.

```text
라벨명
확률 백분율
확률 막대
매핑된 명령어
```

### 수용 기준

- 권한을 허용하면 영상과 예측 결과가 표시된다.
- 권한을 거부해도 재시도 방법을 안내한다.
- 최고 확률 라벨이 실시간으로 강조된다.
- 웹캠 중지 후 카메라 스트림 트랙이 실제로 종료된다.

---

## 7.4 라벨별 명령어 매핑

모델에서 읽어온 라벨마다 명령어를 지정한다.

### 기본 명령어 목록

| 화면 표시 | 시리얼 명령 |
|---|---|
| 동작 없음 | `NONE` |
| 기본 자세 | `HOME` |
| 물체 잡기 | `GRAB` |
| 물체 놓기 | `RELEASE` |
| 팔 올리기 | `ARM_UP` |
| 팔 내리기 | `ARM_DOWN` |
| 받침대 왼쪽 회전 | `BASE_LEFT` |
| 받침대 오른쪽 회전 | `BASE_RIGHT` |
| 동작 중지 | `STOP` |
| 사용자 지정 | 직접 입력 |

### 요구사항

- 기본값은 모든 라벨이 `NONE`이다.
- 학생이 드롭다운에서 명령어를 선택할 수 있다.
- 사용자 지정 명령은 영문 대문자, 숫자, `_`, `-`만 허용한다.
- 사용자 지정 명령 길이는 32자 이하로 제한한다.
- 줄바꿈, 제어문자, 세미콜론 등은 제거한다.
- 매핑은 모델별로 localStorage에 저장한다.
- 모델 URL을 바꾸면 해당 모델의 기존 매핑을 복원한다.
- 초기화 버튼을 제공한다.

### 수용 기준

- 새로고침 후에도 매핑이 유지된다.
- `NONE` 라벨은 자동 제어에서 전송되지 않는다.
- 잘못된 사용자 지정 문자열은 저장되지 않는다.
- 같은 이름의 라벨이 있어도 내부 인덱스와 함께 안전하게 관리한다.

---

## 7.5 Web Serial 연결

### 요구사항

- 연결은 반드시 사용자의 버튼 클릭으로 시작한다.
- `navigator.serial.requestPort()`로 포트 선택창을 연다.
- 기본 baud rate는 `9600`이다.
- 선택 가능한 baud rate:
  - 9600
  - 57600
  - 115200
- 연결, 연결 해제, 연결 끊김 이벤트를 처리한다.
- 포트의 readable/writable 스트림 잠금을 안전하게 관리한다.
- 연결 해제 시 reader와 writer의 lock을 해제한다.
- Arduino IDE 시리얼 모니터와 충돌할 수 있음을 안내한다.
- 연결 중 버튼 중복 클릭을 방지한다.

### 수용 기준

- 포트 선택 취소를 오류가 아닌 사용자 취소로 처리한다.
- 연결 성공 후 상태가 즉시 바뀐다.
- USB가 빠지면 자동 제어를 끄고 오류를 표시한다.
- 연결 해제 후 다른 포트에 다시 연결할 수 있다.
- 시리얼 미지원 브라우저에서는 연결 버튼이 비활성화된다.

---

## 7.6 모의 장치 모드

실제 아두이노 없이도 수업 전과 개발 중에 기능을 시험할 수 있어야 한다.

### 요구사항

- 실제 장치 / 모의 장치 전환 토글을 제공한다.
- 모의 장치에서는 포트 선택 없이 연결 상태를 흉내 낸다.
- 명령 전송 시 다음 응답을 자동 생성한다.

```text
ACK:<COMMAND>
DONE:<COMMAND>
```

- 응답 지연은 약 300~800ms 범위로 설정한다.
- 실제 장치 모드와 동일한 로그 UI를 사용한다.
- 모의 모드임을 화면에서 명확히 표시한다.

### 수용 기준

- 아두이노 없이 수동 제어와 자동 제어 전체 흐름을 시험할 수 있다.
- 모의 장치 모드가 실제 연결로 오인되지 않는다.

---

## 7.7 수동 제어 패널

자동 제어 전에 하드웨어를 검증하는 기능이다.

### 버튼

- HOME
- GRAB
- RELEASE
- ARM_UP
- ARM_DOWN
- BASE_LEFT
- BASE_RIGHT
- STOP

### 요구사항

- 각 버튼은 대응하는 문자열과 `\n`을 전송한다.
- STOP 버튼은 다른 버튼보다 눈에 잘 띄고 항상 화면에서 접근 가능해야 한다.
- 연결되지 않은 상태에서는 명령을 보내지 않는다.
- 전송 성공·실패를 로그에 기록한다.
- STOP은 자동 제어를 즉시 끄고 명령 대기열을 비운다.

### 수용 기준

- 연결 후 버튼 클릭 시 정확한 명령 문자열이 한 번만 전송된다.
- STOP 클릭 후 자동 명령 전송이 중단된다.

---

## 7.8 AI 자동 제어

### 활성화 조건

다음 조건이 모두 충족되어야 자동 제어를 켤 수 있다.

- 모델 로드 완료
- 웹캠 실행 중
- 실제 또는 모의 장치 연결됨
- 하나 이상의 라벨이 `NONE`이 아닌 명령어에 매핑됨

### 안전 필터

#### 확률 임계값

- 기본값: 0.80
- 범위: 0.50~0.99
- 간격: 0.01

#### 라벨 안정화 시간

최고 확률 라벨이 일정 시간 유지되어야 명령 후보로 인정한다.

- 기본값: 700ms
- 범위: 200~3000ms

#### 명령 쿨다운

명령 전송 후 다음 명령을 보낼 때까지 기다리는 시간이다.

- 기본값: 1500ms
- 범위: 500~10000ms

#### 동일 명령 재전송 방지

같은 라벨이 계속 보이더라도 명령을 반복 전송하지 않는다.  
다음 중 하나가 발생한 후에만 같은 명령을 다시 전송할 수 있다.

- 최고 라벨이 다른 라벨로 변경됨
- 확률이 임계값 아래로 내려간 상태가 500ms 이상 유지됨
- 사용자가 재무장 버튼을 누름

#### 장치 BUSY 처리

아두이노가 `ACK` 후 아직 `DONE`을 보내지 않은 동안에는 새로운 자동 명령을 보내지 않는다.  
응답을 사용하지 않는 펌웨어를 위한 호환 모드는 쿨다운 시간만 사용한다.

### 수용 기준

- 임계값 미만에서는 명령을 보내지 않는다.
- 짧게 스쳐 지나간 라벨에는 반응하지 않는다.
- 같은 자세를 계속 보여도 동일 명령이 계속 전송되지 않는다.
- STOP은 모든 제한보다 우선한다.
- 장치 연결이 끊기면 자동 제어가 즉시 꺼진다.

---

## 7.9 시리얼 프로토콜

### 웹앱 → 아두이노

각 명령은 ASCII 문자열과 줄바꿈으로 전송한다.

```text
HOME\n
GRAB\n
RELEASE\n
ARM_UP\n
ARM_DOWN\n
BASE_LEFT\n
BASE_RIGHT\n
STOP\n
```

### 아두이노 → 웹앱

권장 응답 형식:

```text
READY
ACK:GRAB
DONE:GRAB
ERR:UNKNOWN_COMMAND
ERR:BUSY
```

### 처리 규칙

- 한 줄 단위로 파싱한다.
- 수신 문자열의 앞뒤 공백을 제거한다.
- 빈 줄은 무시한다.
- `ACK:` 수신 시 장치 상태를 BUSY로 바꾼다.
- `DONE:` 수신 시 장치 상태를 READY로 바꾼다.
- `ERR:` 수신 시 오류 로그를 남기고 장치 상태를 복구한다.
- 응답이 일정 시간 없으면 타임아웃 처리한다.
- 기본 명령 타임아웃은 10초로 한다.

---

## 7.10 로그와 진단

### 로그 종류

- 시스템
- 모델
- 웹캠
- 시리얼 연결
- 명령 송신
- 장치 수신
- 경고
- 오류

### 로그 항목

```text
시간
종류
메시지
관련 명령어
```

### 요구사항

- 최근 100개 로그를 유지한다.
- 로그 초기화 버튼을 제공한다.
- 자동 스크롤을 제공한다.
- 오류와 경고는 시각적으로 구분한다.
- 민감한 정보나 전체 브라우저 내부 오류 객체를 화면에 노출하지 않는다.
- 개발자 콘솔에는 상세 오류를 남길 수 있다.

### 수용 기준

- 연결 실패와 모델 실패 원인을 로그에서 구분할 수 있다.
- 마지막 송신 명령과 마지막 장치 응답을 별도 상태 카드에서도 확인할 수 있다.

---

## 7.11 설정 저장

localStorage에 다음을 저장한다.

- 마지막 모델 URL
- 모델별 라벨-명령 매핑
- 확률 임계값
- 안정화 시간
- 쿨다운
- baud rate
- 웹캠 좌우 반전 여부
- ACK 사용 여부

저장하지 않는 항목:

- 웹캠 영상
- 웹캠 캡처 이미지
- 학생 이름
- 시리얼 포트 원시 객체
- 개인 식별정보

localStorage 데이터가 손상된 경우 기본값으로 복구한다.

---

# 8. 화면 및 UX 요구사항

## 8.1 기본 레이아웃

데스크톱 기준 2열 구조를 사용한다.

### 상단

- 서비스명
- 모델 상태
- 웹캠 상태
- 장치 상태
- 자동 제어 상태
- 항상 접근 가능한 STOP 버튼

### 왼쪽 영역

- 모델 URL 입력
- 모델 불러오기
- 웹캠 화면
- 최고 확률 라벨
- 전체 확률 목록

### 오른쪽 영역

- 라벨-명령 매핑
- 자동 제어 설정
- 시리얼 연결
- 수동 제어 버튼
- 로그

화면 폭이 좁아지면 1열로 자연스럽게 변경한다.

## 8.2 학생 친화적 표현

기술 용어를 단독으로 사용하지 않는다.

예시:

```text
Baud rate → 통신 속도(Baud rate)
Threshold → 동작 확률 기준
Cooldown → 다음 명령까지 기다리는 시간
Serial port → 아두이노 연결 포트
```

## 8.3 접근성

- 모든 입력 요소에 label을 연결한다.
- 키보드만으로 주요 기능을 조작할 수 있게 한다.
- 상태를 색상만으로 전달하지 않는다.
- 버튼 비활성화 이유를 안내한다.
- 포커스 표시를 제거하지 않는다.
- 최소 글자 크기는 본문 14px 이상을 권장한다.

## 8.4 오류 메시지 예시

| 상황 | 사용자 메시지 |
|---|---|
| Web Serial 미지원 | 이 브라우저에서는 아두이노 연결을 사용할 수 없습니다. 데스크톱 Chrome 또는 Edge를 사용하세요. |
| HTTPS 아님 | 아두이노 연결은 HTTPS 또는 localhost 환경에서만 사용할 수 있습니다. |
| 모델 URL 오류 | 모델을 불러오지 못했습니다. Teachable Machine에서 공유한 모델 URL인지 확인하세요. |
| 웹캠 권한 거부 | 웹캠 권한이 필요합니다. 주소창의 카메라 권한을 허용한 뒤 다시 시도하세요. |
| 포트 사용 중 | 포트를 열 수 없습니다. Arduino IDE의 시리얼 모니터를 닫고 다시 시도하세요. |
| 장치 연결 끊김 | 아두이노 연결이 끊어졌습니다. 자동 제어를 중지했습니다. |
| 자동 제어 조건 미충족 | 모델, 웹캠, 장치 연결과 라벨 매핑을 먼저 확인하세요. |

---

# 9. 기술 설계

## 9.1 권장 기술 스택

- Vite
- TypeScript
- Vanilla DOM
- TensorFlow.js
- `@teachablemachine/image`
- Web Serial API
- Vitest
- ESLint
- GitHub Actions
- GitHub Pages

React는 사용하지 않는다.  
이 앱은 단일 화면의 소규모 수업 도구이므로 프레임워크 복잡도를 늘리지 않는다.

## 9.2 아키텍처 원칙

- 클라이언트 전용 정적 웹앱
- 모듈별 책임 분리
- 전역 상태 최소화
- 모델 추론과 시리얼 송신 로직 분리
- DOM 조작과 하드웨어 통신 로직 분리
- 외부 입력값 검증
- 오류를 삼키지 말고 사용자 메시지와 개발자 로그를 구분
- 브라우저 API가 없을 때 기능 감지로 대응
- 무한 루프와 중복 이벤트 리스너 방지
- 페이지 종료 시 카메라와 시리얼 자원 정리

## 9.3 권장 폴더 구조

```text
ai-robot-arm-controller/
├─ .github/
│  └─ workflows/
│     ├─ ci.yml
│     └─ deploy-pages.yml
├─ arduino/
│  └─ robot_arm_serial_example/
│     └─ robot_arm_serial_example.ino
├─ src/
│  ├─ app/
│  │  ├─ controller.ts
│  │  └─ state.ts
│  ├─ model/
│  │  ├─ teachableMachine.ts
│  │  └─ predictionStabilizer.ts
│  ├─ serial/
│  │  ├─ serialTransport.ts
│  │  ├─ mockTransport.ts
│  │  ├─ protocol.ts
│  │  └─ types.ts
│  ├─ settings/
│  │  ├─ storage.ts
│  │  └─ defaults.ts
│  ├─ ui/
│  │  ├─ render.ts
│  │  ├─ elements.ts
│  │  └─ messages.ts
│  ├─ utils/
│  │  ├─ logger.ts
│  │  ├─ validation.ts
│  │  └─ time.ts
│  ├─ styles.css
│  └─ main.ts
├─ tests/
│  ├─ predictionStabilizer.test.ts
│  ├─ protocol.test.ts
│  ├─ storage.test.ts
│  └─ validation.test.ts
├─ index.html
├─ package.json
├─ package-lock.json
├─ tsconfig.json
├─ eslint.config.js
├─ vite.config.ts
├─ README.md
├─ CLAUDE.md
├─ LICENSE
└─ .gitignore
```

## 9.4 핵심 인터페이스 예시

```ts
export interface Prediction {
  className: string;
  probability: number;
}

export type RobotCommand =
  | 'NONE'
  | 'HOME'
  | 'GRAB'
  | 'RELEASE'
  | 'ARM_UP'
  | 'ARM_DOWN'
  | 'BASE_LEFT'
  | 'BASE_RIGHT'
  | 'STOP'
  | string;

export interface Transport {
  connect(options: { baudRate: number }): Promise<void>;
  disconnect(): Promise<void>;
  send(command: string): Promise<void>;
  isConnected(): boolean;
  subscribe(listener: (line: string) => void): () => void;
}

export interface AutoControlSettings {
  threshold: number;
  stableDurationMs: number;
  cooldownMs: number;
  commandTimeoutMs: number;
  requireAck: boolean;
}
```

---

# 10. 아두이노 예제 코드 요구사항

프로젝트에는 `arduino/robot_arm_serial_example/robot_arm_serial_example.ino`를 포함한다.

## 10.1 하드웨어 기준

- SG90 서보 4개
- 28BYJ-48 스테퍼 1개
- ULN2003 드라이버
- Servo 라이브러리
- Stepper 라이브러리 또는 비차단형 구현

## 10.2 필수 요구사항

- 핀 번호와 각도는 파일 상단 상수로 분리한다.
- 각 서보별 최소·최대 각도를 상수로 제한한다.
- 시작 시 안전한 HOME 위치로 이동한다.
- `Serial.begin(9600)`을 기본으로 한다.
- 줄바꿈 기준으로 명령을 읽는다.
- 명령 처리 전 `trim()` 한다.
- 알 수 없는 명령에는 `ERR:UNKNOWN_COMMAND`를 응답한다.
- 명령 시작 시 `ACK:<COMMAND>`를 보낸다.
- 명령 완료 시 `DONE:<COMMAND>`를 보낸다.
- STOP 명령을 처리한다.
- 실제 조립 방향에 따라 각도값을 수정해야 한다는 주석을 넣는다.
- 모터 전원은 외부 전원을 사용하고 GND를 공통 연결해야 한다는 경고를 주석에 넣는다.

## 10.3 주의

정확한 서보 핀 번호, 초기 각도, 관절별 안전 범위는 실제 조립 상태에 따라 달라진다.  
Claude Code는 임의 값을 “검증 완료값”으로 표현하지 말고, 예시값임을 명확히 표시한다.

---

# 11. 테스트 요구사항

## 11.1 자동 테스트

다음 로직은 단위 테스트를 작성한다.

### URL 처리

- 마지막 `/`가 없는 모델 URL 보정
- 공백 제거
- 잘못된 프로토콜 거부
- 빈 문자열 거부

### 명령어 검증

- 허용 문자 통과
- 줄바꿈 제거
- 32자 초과 거부
- 빈 사용자 지정 명령 거부

### 예측 안정화

- 임계값 미만 무시
- 안정화 시간 미충족 무시
- 안정화 시간 충족 시 한 번 전송
- 같은 명령 반복 방지
- 다른 라벨로 변경 후 재전송 허용
- 임계값 아래 상태 후 재무장
- STOP 우선 처리

### 프로토콜

- `ACK:` 파싱
- `DONE:` 파싱
- `ERR:` 파싱
- 빈 줄 무시
- 알 수 없는 응답 안전 처리

### 저장

- 기본 설정 로드
- 정상 설정 저장과 복원
- 손상된 JSON 기본값 복구
- 모델별 매핑 분리

## 11.2 수동 테스트

| 번호 | 시나리오 | 기대 결과 |
|---|---|---|
| 1 | 정상 모델 URL 입력 | 모델과 라벨 표시 |
| 2 | 잘못된 URL 입력 | 오류 안내, 앱 유지 |
| 3 | 웹캠 권한 허용 | 영상과 예측 표시 |
| 4 | 웹캠 권한 거부 | 재시도 안내 |
| 5 | 모의 장치 연결 | 수동·자동 명령 시험 가능 |
| 6 | 실제 아두이노 연결 | 연결 상태 표시 |
| 7 | 시리얼 모니터가 포트 사용 중 | 충돌 안내 |
| 8 | USB 분리 | 자동 제어 중지 |
| 9 | 임계값 미만 | 명령 미전송 |
| 10 | 라벨 빠른 변화 | 안정화 전 명령 미전송 |
| 11 | 같은 라벨 지속 | 동일 명령 1회만 전송 |
| 12 | STOP 클릭 | 자동 제어 중지, 대기열 초기화 |
| 13 | 새로고침 | 설정 복원 |
| 14 | GitHub Pages 접속 | 정적 자원 404 없이 로드 |
| 15 | 지원하지 않는 브라우저 | 모의 장치와 AI 기능 유지 |

---

# 12. 보안·개인정보·안전 요구사항

## 12.1 개인정보

- 사용자 계정을 만들지 않는다.
- 학생 이름을 입력받지 않는다.
- 웹캠 영상을 저장하거나 업로드하지 않는다.
- 모든 AI 추론은 브라우저에서 수행한다.
- 분석 도구와 광고 스크립트를 넣지 않는다.
- 불필요한 외부 네트워크 요청을 만들지 않는다.

## 12.2 코드 보안

- `innerHTML`에 사용자 입력값을 직접 삽입하지 않는다.
- 사용자 지정 명령은 허용 문자 방식으로 검증한다.
- URL을 검증한 뒤 모델을 불러온다.
- 비밀키, 토큰, GitHub 인증정보를 코드에 기록하지 않는다.
- `.env` 파일을 만들 필요가 없다.
- Git 인증 정보를 저장소에 추가하지 않는다.
- 종속성 설치 후 취약점 보고를 확인하되, 무리한 강제 업그레이드로 빌드를 깨뜨리지 않는다.

## 12.3 물리적 안전

- 자동 제어는 기본 OFF다.
- STOP 버튼은 항상 접근 가능하다.
- 앱 시작 시 자동으로 모터 명령을 보내지 않는다.
- 모델 로드나 웹캠 시작만으로 명령을 보내지 않는다.
- 연결 직후 HOME을 자동 전송하지 않는다.
- 서보 안전 범위는 아두이노에서 제한한다.
- 로봇팔 동작 중 손을 관절과 집게 사이에 넣지 않도록 안내한다.
- 외부 모터 전원 사용과 공통 GND 연결을 README에 명시한다.

---

# 13. 성능 및 품질 요구사항

- 초기 화면은 모델 없이 정상적으로 표시되어야 한다.
- 앱 기능은 모델, 웹캠, 시리얼 중 일부가 실패해도 전체가 중단되지 않아야 한다.
- 예측 루프가 중복 생성되지 않아야 한다.
- 연결과 해제를 반복해도 reader/writer lock 오류가 누적되지 않아야 한다.
- 주요 버튼은 작업 중 중복 실행되지 않도록 비활성화한다.
- 콘솔에 반복 오류가 쌓이지 않아야 한다.
- 프로덕션 빌드에 TypeScript 오류가 없어야 한다.
- GitHub Pages 하위 경로에서도 정적 자원이 정상 로드되어야 한다.

---

# 14. GitHub Pages 배포 요구사항

## 14.1 Vite base 경로

프로젝트 저장소 페이지 주소가 다음 구조이면:

```text
https://<USERNAME>.github.io/<REPOSITORY>/
```

Vite의 `base`가 저장소 이름을 반영하도록 설정한다.  
저장소 이름을 하드코딩하기보다 GitHub Actions 환경에서 안전하게 유도하거나 명확한 설정 위치를 제공한다.

## 14.2 배포 workflow

`.github/workflows/deploy-pages.yml`을 생성한다.

요구사항:

- `main` 브랜치 push 시 실행
- 수동 실행 지원
- Node 설치
- 의존성 재현 설치
- 타입 검사
- 테스트
- 빌드
- `dist` 업로드
- GitHub Pages 배포
- 공식 GitHub Pages Actions 사용
- 최소 권한 설정
  - `contents: read`
  - `pages: write`
  - `id-token: write`
- 동시 배포 충돌 방지 설정

## 14.3 CI workflow

`.github/workflows/ci.yml`을 생성한다.

- pull request와 main push에서 실행
- 타입 검사
- 린트
- 테스트
- 빌드

## 14.4 배포 안내

README에 다음 내용을 기록한다.

1. GitHub 저장소의 Settings → Pages 이동
2. Build and deployment Source를 GitHub Actions로 선택
3. main 브랜치에 push
4. Actions 성공 확인
5. 배포 URL 접속
6. 브라우저에서 카메라와 시리얼 권한 허용

---

# 15. README 요구사항

README는 교사가 수업 전 바로 사용할 수 있도록 한국어로 작성한다.

필수 항목:

- 프로젝트 소개
- 주요 기능
- 권장 브라우저
- 로컬 실행 방법
- GitHub Pages 배포 방법
- Teachable Machine 모델 URL 얻는 방법
- 아두이노 연결 방법
- 명령어 목록
- 예제 아두이노 코드 위치
- 외부 전원 및 공통 GND 주의
- 시리얼 모니터 충돌 해결
- 모의 장치 모드 사용법
- 자주 발생하는 오류
- 개인정보 처리 원칙
- 수업 운영 순서
- 라이선스

---

# 16. 바이브 코딩 작업 원칙

## 16.1 반드시 지킬 사항

1. **작게 나누어 구현한다.**  
   모델, 웹캠, 시리얼, 자동 제어, 저장, UI를 한 파일에 몰아넣지 않는다.

2. **기능마다 검증한다.**  
   한 번에 전체를 만든 뒤 마지막에 확인하지 않는다.

3. **실제 오류를 숨기지 않는다.**  
   임시로 타입 검사를 끄거나 예외를 무시해 빌드를 통과시키지 않는다.

4. **하드웨어 없이도 검증 가능하게 한다.**  
   모의 장치 모드와 단위 테스트를 사용한다.

5. **모델 판단과 하드웨어 제어를 분리한다.**  
   AI 확률을 모터 각도로 직접 변환하지 않는다.

6. **안전 기본값을 사용한다.**  
   자동 제어 OFF, 모든 라벨 NONE, 임계값 0.80, 안정화 700ms, 쿨다운 1500ms로 시작한다.

7. **기존 파일을 존중한다.**  
   기존 저장소의 코드, 설정, README를 먼저 읽고 필요한 부분만 변경한다.

8. **패키지를 과도하게 설치하지 않는다.**  
   기능을 직접 구현할 수 있는데 대형 라이브러리를 추가하지 않는다.

9. **모르는 하드웨어 값을 추정하지 않는다.**  
   핀 번호와 안전 각도는 예시값으로 표시하고 실제 조립 후 수정하도록 한다.

10. **Git 작업을 투명하게 한다.**  
    커밋 전 변경 파일과 테스트 결과를 확인하고, push 결과를 실제 출력으로 검증한다.

## 16.2 금지 사항

- `--force` 또는 `--force-with-lease` push
- `git reset --hard`
- 기존 사용자 작업을 임의 삭제
- `.git` 내부 직접 수정
- GitHub 토큰을 파일에 기록
- 테스트를 삭제해 실패를 숨기기
- `// @ts-ignore` 남용
- 모든 타입을 `any`로 처리
- CORS 문제를 무시하기 위한 임의 프록시 서버 추가
- 사용자의 명시적 동의 없이 외부 분석 스크립트 추가
- 브라우저 시작 시 자동 포트 연결 또는 자동 모터 동작
- 펌웨어의 안전 각도를 검증된 값처럼 단정

## 16.3 Claude Code 작업 순서

```text
1. 저장소 조사
2. 구현 계획 작성
3. 프로젝트 기반 설정
4. 순수 로직부터 구현 및 단위 테스트
5. Teachable Machine 모델 로더 구현
6. 웹캠 추론 구현
7. 모의 장치 구현
8. Web Serial 구현
9. 라벨 매핑과 자동 제어 구현
10. UI 연결
11. 아두이노 예제 코드 작성
12. README와 CLAUDE.md 작성
13. CI와 Pages 배포 workflow 작성
14. 전체 검증
15. diff 검토
16. 커밋
17. push
18. 최종 결과 보고
```

---

# 17. 저장소용 `CLAUDE.md` 작성 요구사항

Claude Code는 저장소 루트에 `CLAUDE.md`를 만들고 아래 규칙을 포함한다.

```markdown
# Project Instructions

## Product
This is a Korean classroom web app that connects a Teachable Machine image model to an Arduino robot arm through the Web Serial API.

## Required architecture
- Vite + TypeScript + Vanilla DOM
- No p5.js
- No backend
- No database
- No API keys
- Separate model inference, command stabilization, serial transport, storage, and UI modules
- Provide both real serial and mock transport implementations

## Safety
- Auto control must be OFF by default
- Never send a motor command on page load, model load, webcam start, or serial connection
- STOP must immediately disable auto control and clear pending commands
- Do not map probabilities directly to servo angles
- Validate all custom serial commands
- Keep servo limits in Arduino firmware

## Quality
- Do not suppress TypeScript errors
- Add unit tests for pure logic
- Run typecheck, lint, tests, and production build before committing
- Keep Korean user-facing messages clear
- Handle unsupported browser APIs without crashing

## Git
- Inspect git status before editing
- Do not overwrite unrelated user changes
- Never force push
- Never modify git credentials or config
- Commit only after all checks pass
- Push the current branch to origin after committing
- If push fails, report the actual error and do not claim success
```

---

# 18. Definition of Done

다음 조건을 모두 만족해야 완료로 판단한다.

## 기능

- [ ] Teachable Machine 모델을 불러올 수 있다.
- [ ] 모델 라벨이 자동으로 표시된다.
- [ ] 웹캠 분류 결과가 표시된다.
- [ ] 라벨별 명령어를 설정할 수 있다.
- [ ] 설정이 새로고침 후 복원된다.
- [ ] 모의 장치에 연결할 수 있다.
- [ ] 실제 Web Serial 포트를 선택할 수 있다.
- [ ] 수동 명령을 전송할 수 있다.
- [ ] AI 자동 제어를 켜고 끌 수 있다.
- [ ] 임계값, 안정화 시간, 쿨다운이 동작한다.
- [ ] 동일 명령이 과도하게 반복되지 않는다.
- [ ] STOP이 자동 제어와 대기 명령을 중지한다.
- [ ] 송수신 로그를 확인할 수 있다.
- [ ] 연결 끊김을 안전하게 처리한다.

## 품질

- [ ] TypeScript 검사가 통과한다.
- [ ] ESLint가 통과한다.
- [ ] 단위 테스트가 통과한다.
- [ ] 프로덕션 빌드가 통과한다.
- [ ] GitHub Pages 하위 경로에서 자원이 정상 로드된다.
- [ ] 지원하지 않는 브라우저에서도 앱이 중단되지 않는다.
- [ ] 카메라와 시리얼 자원이 정상적으로 해제된다.

## 문서 및 배포

- [ ] 한국어 README가 있다.
- [ ] `CLAUDE.md`가 있다.
- [ ] 아두이노 예제 스케치가 있다.
- [ ] CI workflow가 있다.
- [ ] GitHub Pages workflow가 있다.
- [ ] 변경 내용이 Git 커밋으로 기록되었다.
- [ ] 현재 브랜치가 원격 GitHub 저장소에 push되었다.
- [ ] push 실패 시 실제 오류가 보고되었다.

---

# 19. Claude Code에 입력할 최종 시작 프롬프트

아래 내용을 Claude Code에 그대로 입력한다.

```text
저장소 루트의 PRD 문서를 먼저 끝까지 읽고, 저장소의 현재 구조와 git 상태를 조사해 주세요.

이 프로젝트는 중학생 수업에서 사용하는 “AI 로봇팔 컨트롤러” 웹앱입니다. Teachable Machine 이미지 분류 모델을 브라우저에서 불러오고, 웹캠 추론 결과를 라벨별 명령어로 변환한 뒤 Web Serial API로 아두이노에 전송해야 합니다.

PRD의 MVP, 안전 요구사항, 테스트 요구사항, GitHub Pages 배포 요구사항을 모두 구현해 주세요.

특히 다음을 반드시 지켜 주세요.

- Vite + TypeScript + Vanilla DOM을 사용합니다.
- p5.js, 백엔드, 데이터베이스, API 키를 사용하지 않습니다.
- 실제 Web Serial 장치와 모의 장치 모드를 모두 구현합니다.
- 자동 제어는 기본 OFF입니다.
- 모델 로드, 웹캠 시작, 시리얼 연결만으로 모터 명령을 자동 전송하지 않습니다.
- STOP은 자동 제어를 끄고 대기 명령을 제거합니다.
- 확률 임계값, 라벨 안정화 시간, 쿨다운, 동일 명령 재전송 방지를 구현합니다.
- 사용자 지정 명령어를 검증합니다.
- 로봇팔 모터의 실제 각도와 스텝 수는 아두이노 예제 코드에서 관리합니다.
- 순수 로직에는 단위 테스트를 작성합니다.
- 한국어 README, CLAUDE.md, Arduino 예제 스케치, CI workflow, GitHub Pages 배포 workflow를 작성합니다.
- 기존 사용자 변경을 덮어쓰거나 삭제하지 않습니다.

작업은 계획 → 구현 → 테스트 → 빌드 → diff 검토 순서로 진행하세요.

모든 구현 후 다음 검증을 실제로 실행하세요.

npm install
npm run typecheck
npm run lint
npm test
npm run build
git diff --check

모든 검증이 성공한 경우에만 변경 파일을 커밋하고 현재 브랜치를 origin에 push하세요.

커밋 메시지는 다음을 사용하세요.

feat: build AI robot arm controller web app

force push, git reset --hard, Git 설정 변경, 인증정보 저장은 금지합니다. 원격 저장소 또는 인증 문제로 push가 실패하면 성공했다고 표현하지 말고 실제 오류와 해결 방법을 보고하세요.

마지막에는 다음을 요약해 주세요.

1. 구현한 기능
2. 생성·수정한 주요 파일
3. 테스트와 빌드 결과
4. 커밋 해시
5. push한 브랜치
6. GitHub Pages 설정 또는 확인이 필요한 사항
7. 남아 있는 실제 하드웨어 보정 항목
```

---

# 20. 구현 완료 후 최종 보고 형식

Claude Code는 작업 완료 후 다음 형식으로 보고한다.

```text
## 구현 결과
- 주요 기능:
- 모의 장치:
- 실제 Web Serial:
- Arduino 예제:

## 검증 결과
- typecheck:
- lint:
- test:
- build:
- git diff --check:

## Git
- branch:
- commit:
- push:
- remote:

## 배포
- workflow:
- GitHub Pages 설정 필요 여부:
- 예상 배포 경로:

## 실제 하드웨어에서 확인할 항목
- 서보 핀:
- 스테퍼 핀:
- HOME 각도:
- 관절별 최소·최대 각도:
- 모터 전원:
- 공통 GND:
```

---

# 21. 참고 문서

- Web Serial API는 웹페이지가 시리얼 장치와 데이터를 읽고 쓸 수 있게 하며, 지원 브라우저와 보안 컨텍스트 제약이 있다.
- 포트 선택은 사용자의 명시적 동작을 통해 이루어져야 한다.
- Teachable Machine 모델은 TensorFlow.js 모델로 내보내 웹사이트에서 사용할 수 있다.
- Vite를 GitHub Pages에 배포할 때 저장소 하위 경로에 맞는 `base` 설정과 빌드 workflow가 필요하다.
- Claude Code는 Git 저장소에서 파일 수정, 검증, 커밋과 push 작업을 수행할 수 있지만, 실제 push에는 로컬 Git 원격 저장소와 인증이 준비되어 있어야 한다.

공식 문서:

- MDN Web Serial API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API
- MDN Serial.requestPort(): https://developer.mozilla.org/en-US/docs/Web/API/Serial/requestPort
- Google Teachable Machine FAQ: https://teachablemachine.withgoogle.com/faq
- Vite 정적 사이트 배포: https://vite.dev/guide/static-deploy
- GitHub Pages 사용자 지정 workflow: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- Claude Code 개요: https://docs.anthropic.com/en/docs/claude-code/overview
- Claude Code 프로젝트 지침: https://docs.anthropic.com/en/docs/claude-code/memory
