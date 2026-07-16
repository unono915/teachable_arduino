/*
 * 서보모터 키 조작 테스트 스케치 (관절 묶음 버전)
 * ================================================
 *
 * 시리얼 모니터에서 키 하나로 로봇팔을 조금씩 움직여 보는 용도입니다.
 *
 *   A → 관절을 1도씩 계속 "구부리기" (각도 감소, 한계 10도)
 *   D → 관절을 1도씩 계속 "펴기"     (각도 증가, 한계 90도)
 *   S → 즉시 멈춤 (관절·집게 모두)
 *   Q → 집게를 1도씩 계속 "좁히기"   (각도 감소, 한계 90도)
 *   W → 집게를 1도씩 계속 "벌리기"   (각도 증가, 한계 120도)
 *   ? → 현재 각도 출력
 *
 * 키를 한 번 입력하면 계속 움직이고, S를 입력하거나 한계 각도에
 * 닿으면 멈춥니다. 소문자도 됩니다. (시리얼 모니터에서 키 입력 후 Enter)
 *
 * 조립 기준(확정값):
 *   - 관절(어깨+팔꿈치+손목, D3 공통 신호) 90도 = 수직 직립, 10도 = 최대 구부림
 *   - 집게(D5) 90도 = 오므림, 120도 = 최대 벌림
 *
 * ★★★ 전원 경고 ★★★
 *   관절 3개가 동시에 움직여 순간 전류가 큽니다. 가능하면 서보는 외부
 *   5V 전원(AA 4개 홀더 등)으로 구동하고, 외부 전원의 GND와 아두이노의
 *   GND를 반드시 공통 연결하세요. USB 전원만 쓰면 아두이노가 리셋되어
 *   시리얼 연결이 끊길 수 있습니다.
 *
 * ★ 안전 ★ 관절과 집게 사이에 손을 넣지 마세요.
 */

#include <Servo.h>

// ------------------------------------------------ 핀 설정 (본 스케치와 동일)
const uint8_t PIN_SERVO_ARM     = 3;  // 관절 3개(어깨+팔꿈치+손목) 공통 신호
const uint8_t PIN_SERVO_GRIPPER = 5;  // 집게

// ------------------------------------------------ 각도 설정 (확정값)
const uint8_t START_ARM_ANGLE     = 90;  // 시작: 곧게 선 자세
const uint8_t START_GRIPPER_ANGLE = 90;  // 시작: 오므린 상태

const uint8_t MIN_ARM = 10,     MAX_ARM = 90;       // 관절 안전 범위
const uint8_t MIN_GRIPPER = 90, MAX_GRIPPER = 120;  // 집게 안전 범위

// 1도 움직일 때마다 기다리는 시간(ms). 클수록 천천히 움직인다.
const uint16_t STEP_INTERVAL_MS = 30;

Servo servoArm, servoGripper;

uint8_t angleArm     = START_ARM_ANGLE;
uint8_t angleGripper = START_GRIPPER_ANGLE;

// 진행 방향: -1 = 각도 감소, 0 = 정지, +1 = 각도 증가
int8_t armDirection     = 0;
int8_t gripperDirection = 0;

unsigned long lastStepAt = 0;

void printAngles() {
  Serial.print(F("관절: "));
  Serial.print(angleArm);
  Serial.print(F("도, 집게: "));
  Serial.print(angleGripper);
  Serial.println(F("도"));
}

void printHelp() {
  Serial.println(F("A=구부리기  D=펴기  S=멈춤  Q=집게 좁히기  W=집게 벌리기  ?=현재 각도"));
}

// ------------------------------------------------ 키 처리
void handleKey(char key) {
  switch (key) {
    case 'A':  // 관절 구부리기 (각도 감소)
      armDirection = -1;
      Serial.println(F("관절 구부리는 중... (S = 멈춤)"));
      break;
    case 'D':  // 관절 펴기 (각도 증가)
      armDirection = 1;
      Serial.println(F("관절 펴는 중... (S = 멈춤)"));
      break;
    case 'S':  // 전체 멈춤
      armDirection = 0;
      gripperDirection = 0;
      Serial.print(F("멈춤. "));
      printAngles();
      break;
    case 'Q':  // 집게 좁히기 (각도 감소)
      gripperDirection = -1;
      Serial.println(F("집게 좁히는 중... (S = 멈춤)"));
      break;
    case 'W':  // 집게 벌리기 (각도 증가)
      gripperDirection = 1;
      Serial.println(F("집게 벌리는 중... (S = 멈춤)"));
      break;
    case '?':
      printAngles();
      break;
    default:
      // 줄바꿈 등 나머지 문자는 무시한다.
      break;
  }
}

// ------------------------------------------------ 이동 (비차단, 1도씩)
void stepMotors() {
  unsigned long nowMs = millis();
  if (nowMs - lastStepAt < STEP_INTERVAL_MS) {
    return;
  }
  lastStepAt = nowMs;

  if (armDirection != 0) {
    int next = (int)angleArm + armDirection;
    if (next < MIN_ARM || next > MAX_ARM) {
      armDirection = 0;
      Serial.print(F("관절 한계 도달. "));
      printAngles();
    } else {
      angleArm = (uint8_t)next;
      servoArm.write(angleArm);
    }
  }

  if (gripperDirection != 0) {
    int next = (int)angleGripper + gripperDirection;
    if (next < MIN_GRIPPER || next > MAX_GRIPPER) {
      gripperDirection = 0;
      Serial.print(F("집게 한계 도달. "));
      printAngles();
    } else {
      angleGripper = (uint8_t)next;
      servoGripper.write(angleGripper);
    }
  }
}

// ------------------------------------------------ 설정과 메인 루프
void setup() {
  Serial.begin(9600);

  servoArm.attach(PIN_SERVO_ARM);
  servoGripper.attach(PIN_SERVO_GRIPPER);

  servoArm.write(START_ARM_ANGLE);
  servoGripper.write(START_GRIPPER_ANGLE);

  Serial.println(F("키 조작 테스트 준비 완료. (관절 90도 직립, 집게 90도 오므림)"));
  printHelp();
}

void loop() {
  while (Serial.available() > 0) {
    char key = (char)Serial.read();
    if (key >= 'a' && key <= 'z') {
      key = key - 'a' + 'A';  // 소문자 → 대문자
    }
    handleKey(key);
  }
  stepMotors();
}
