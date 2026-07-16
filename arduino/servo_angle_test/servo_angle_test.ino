/*
 * 서보모터 각도 확인(캘리브레이션) 스케치 - 관절 묶음 버전
 * =========================================================
 *
 * 관절(어깨+팔꿈치+손목, D3 공통 신호)과 집게(D5)를 각각 원하는 각도로
 * 움직여 보면서 방향과 자세를 확인하는 용도입니다.
 *
 * 사용 방법: 시리얼 모니터(9600, "새 줄" 설정)에 명령을 입력하세요.
 *
 *   A 60   → 관절 3개를 함께 60도로 (Arm)
 *   G 30   → 집게(Gripper)를 30도로
 *   ?      → 현재 각도 출력
 *
 *   (공백 없이 A60 처럼 입력해도 됩니다. 각도 범위: 0~180)
 *
 * 조립 기준: 관절 90도 = 팔이 밑판에서 수직 1직선으로 선 자세.
 *   A 60, A 120처럼 90 양쪽으로 움직여 보며 구부러지는 방향을 확인하고,
 *   알아낸 각도를 robot_arm_serial_example.ino 상단의
 *   HOME_ARM, MIN_ARM/MAX_ARM, GRIPPER_OPEN/GRIPPER_CLOSED에 옮겨 적으세요.
 *
 * ★★★ 전원 경고 ★★★
 *   관절 3개가 동시에 움직여 순간 전류가 큽니다. 서보는 외부 5V 전원으로
 *   구동하고, 외부 전원의 GND와 아두이노의 GND를 반드시 공통 연결하세요.
 *
 * ★ 안전 ★
 *   서보가 천천히(1도씩) 움직이도록 되어 있지만, 큰 각도를 입력하면
 *   팔이 크게 움직입니다. 관절과 집게 사이에 손을 넣지 마세요.
 */

#include <Servo.h>

// ------------------------------------------------ 핀 설정 (본 스케치와 동일)
const uint8_t PIN_SERVO_ARM     = 3;  // 관절 3개(어깨+팔꿈치+손목) 공통 신호
const uint8_t PIN_SERVO_GRIPPER = 5;  // 집게

// 시작 각도: 조립 기준 자세(관절 90도 = 곧게 선 자세)
const uint8_t START_ARM_ANGLE     = 90;
const uint8_t START_GRIPPER_ANGLE = 90;

// 1도 움직일 때마다 기다리는 시간(ms). 클수록 천천히 움직인다.
const uint16_t STEP_INTERVAL_MS = 20;

Servo servoArm, servoGripper;

uint8_t angleArm     = START_ARM_ANGLE;
uint8_t angleGripper = START_GRIPPER_ANGLE;

String inputBuffer = "";

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
  Serial.println(F("명령: A/G + 각도(0~180), ? = 현재 각도"));
  Serial.println(F("예)  A 60 → 관절 60도(구부리기),  A 90 → 곧게 서기,  G 30 → 집게 30도"));
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
  long angle = line.substring(1).toInt();
  String rest = line.substring(1);
  rest.trim();

  bool isNumber = rest.length() > 0;
  for (unsigned int i = 0; i < rest.length() && isNumber; i += 1) {
    if (!isDigit(rest.charAt(i))) {
      isNumber = false;
    }
  }

  if (!isNumber || angle < 0 || angle > 180) {
    Serial.print(F("잘못된 명령: "));
    Serial.println(line);
    printHelp();
    return;
  }

  switch (target) {
    case 'A':
      moveSlowly(servoArm, angleArm, (uint8_t)angle, F("관절"));
      break;
    case 'G':
      moveSlowly(servoGripper, angleGripper, (uint8_t)angle, F("집게"));
      break;
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

  Serial.println(F("서보 각도 확인 스케치 준비 완료. (관절/집게 90도)"));
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
