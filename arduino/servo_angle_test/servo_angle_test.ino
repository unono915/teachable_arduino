/*
 * 서보모터 각도 확인(테스트) 스케치 - 관절 묶음 버전
 * ====================================================
 *
 * 관절(어깨+팔꿈치+손목, D3 공통 신호)과 집게(D5)를 각각 원하는 각도로
 * 움직여 보면서 방향과 자세를 확인하는 용도입니다.
 *
 * 사용 방법: 시리얼 모니터(9600, "새 줄" 설정)에 명령을 입력하세요.
 *
 *   A 60   → 관절 3개를 함께 60도로 (Arm)
 *   A 90   → 곧게 선 자세로 복귀
 *   G 120  → 집게(Gripper)를 120도로 (벌리기)
 *   G 90   → 집게 오므리기
 *   ?      → 현재 각도 출력
 *
 *   (공백 없이 A60 처럼 입력해도 됩니다)
 *
 * 조립 기준(확정값):
 *   - 관절 90도 = 팔이 밑판에서 수직 1직선으로 선 자세
 *   - 관절은 90에서 값을 줄이는 방향으로만 구부림 (한계 10도)
 *   - 집게 90도 = 오므림, 120도 = 최대 벌림
 *   안전을 위해 이 범위를 벗어난 입력은 자동으로 잘라냅니다.
 *   (범위를 바꾸려면 아래 MIN_/MAX_ 상수를 수정하세요)
 *
 * ★★★ 전원 경고 ★★★
 *   관절 3개가 동시에 움직여 순간 전류가 큽니다. 가능하면 서보는 외부
 *   5V 전원(AA 4개 홀더 등)으로 구동하고, 외부 전원의 GND와 아두이노의
 *   GND를 반드시 공통 연결하세요. USB 전원만 쓰면 아두이노가 리셋되어
 *   시리얼 연결이 끊길 수 있습니다.
 *
 * ★ 안전 ★
 *   서보가 천천히(1도씩) 움직이지만, 관절과 집게 사이에 손을 넣지 마세요.
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
const uint16_t STEP_INTERVAL_MS = 20;

Servo servoArm, servoGripper;

uint8_t angleArm     = START_ARM_ANGLE;
uint8_t angleGripper = START_GRIPPER_ANGLE;

String inputBuffer = "";

// ------------------------------------------------ 유틸리티
uint8_t clampAngle(long value, uint8_t minValue, uint8_t maxValue, bool &clamped) {
  if (value < minValue) { clamped = true; return minValue; }
  if (value > maxValue) { clamped = true; return maxValue; }
  clamped = false;
  return (uint8_t)value;
}

// ------------------------------------------------ 이동 (1도씩 천천히)
void moveSlowly(Servo &servo, uint8_t &current, uint8_t target, const __FlashStringHelper *name) {
  Serial.print(name);
  Serial.print(F(": "));
  Serial.print(current);
  Serial.print(F("도 → "));
  Serial.print(target);
  Serial.println(F("도"));
  while (current != target) {
    current += (current < target) ? 1 : -1;
    servo.write(current);
    delay(STEP_INTERVAL_MS);
  }
}

void printAngles() {
  Serial.println(F("---- 현재 각도 ----"));
  Serial.print(F("A 관절(3개 공통) : ")); Serial.println(angleArm);
  Serial.print(F("G 집게           : ")); Serial.println(angleGripper);
  Serial.println(F("-------------------"));
}

void printHelp() {
  Serial.println(F("명령: A/G + 각도, ? = 현재 각도"));
  Serial.println(F("예)  A 60 → 관절 구부리기,  A 90 → 곧게 서기"));
  Serial.println(F("     G 120 → 집게 벌리기,   G 90 → 집게 오므리기"));
  Serial.print(F("허용 범위: A ")); Serial.print(MIN_ARM); Serial.print(F("~")); Serial.print(MAX_ARM);
  Serial.print(F(", G ")); Serial.print(MIN_GRIPPER); Serial.print(F("~")); Serial.println(MAX_GRIPPER);
}

// ------------------------------------------------ 명령 처리
void processLine(String line) {
  line.trim();
  line.toUpperCase();
  if (line.length() == 0) {
    return;
  }
  if (line == "?") {
    printAngles();
    return;
  }

  char target = line.charAt(0);
  String rest = line.substring(1);
  rest.trim();
  long angle = rest.toInt();

  bool isNumber = rest.length() > 0;
  for (unsigned int i = 0; i < rest.length() && isNumber; i += 1) {
    if (!isDigit(rest.charAt(i))) {
      isNumber = false;
    }
  }

  if (!isNumber) {
    Serial.print(F("잘못된 명령: "));
    Serial.println(line);
    printHelp();
    return;
  }

  bool clamped = false;
  switch (target) {
    case 'A': {
      uint8_t safe = clampAngle(angle, MIN_ARM, MAX_ARM, clamped);
      if (clamped) {
        Serial.print(F("범위를 벗어나 ")); Serial.print(safe); Serial.println(F("도로 조정했습니다."));
      }
      moveSlowly(servoArm, angleArm, safe, F("관절"));
      break;
    }
    case 'G': {
      uint8_t safe = clampAngle(angle, MIN_GRIPPER, MAX_GRIPPER, clamped);
      if (clamped) {
        Serial.print(F("범위를 벗어나 ")); Serial.print(safe); Serial.println(F("도로 조정했습니다."));
      }
      moveSlowly(servoGripper, angleGripper, safe, F("집게"));
      break;
    }
    default:
      Serial.print(F("알 수 없는 대상: "));
      Serial.println(target);
      printHelp();
      return;
  }
  printAngles();
}

// ------------------------------------------------ 설정과 메인 루프
void setup() {
  Serial.begin(9600);

  servoArm.attach(PIN_SERVO_ARM);
  servoGripper.attach(PIN_SERVO_GRIPPER);

  servoArm.write(START_ARM_ANGLE);
  servoGripper.write(START_GRIPPER_ANGLE);

  Serial.println(F("서보 각도 테스트 준비 완료. (관절 90도 직립, 집게 90도 오므림)"));
  printHelp();
}

void loop() {
  while (Serial.available() > 0) {
    char received = (char)Serial.read();
    if (received == '\n' || received == '\r') {
      processLine(inputBuffer);
      inputBuffer = "";
    } else if (inputBuffer.length() < 16) {
      inputBuffer += received;
    }
  }
}
