/*
 * AI 로봇팔 컨트롤러 - 아두이노 예제 스케치 (관절 묶음 버전)
 * ===========================================================
 *
 * 웹앱이 시리얼로 보내는 한 줄 명령(HOME, GRAB, RELEASE, ARM_UP, ARM_DOWN,
 * STOP)을 받아 로봇팔을 움직입니다.
 *
 * 하드웨어 기준:
 *   - SG90 9g 마이크로 서보모터 4개
 *   - 관절 3개(어깨, 팔꿈치, 손목)는 신호선을 하나로 묶어
 *     같은 각도로 함께 움직인다. → D3 핀 하나로 제어
 *   - 집게 서보는 따로 제어한다. → D5 핀
 *   - Arduino Uno 또는 호환 보드
 *
 * ★ 조립 기준 (중요!) ★
 *   모든 관절 서보를 90도로 세팅한 상태에서,
 *   팔이 밑판 기준 수직 1직선으로 선 자세가 되도록 조립했다.
 *   → 90도 = 곧게 선 자세
 *   → 각도를 90에서 줄이면 팔이 한쪽으로 서서히 구부러지고,
 *     90보다 키우면 반대쪽으로 구부러진다.
 *
 * ★★★ 전원 경고 ★★★
 *   관절 3개가 동시에 움직이므로 순간 전류가 큽니다.
 *   서보는 반드시 외부 5V 전원으로 구동하고,
 *   외부 전원의 GND와 아두이노의 GND를 반드시 공통으로 연결하세요.
 *
 * ★★★ 각도 조정 ★★★
 *   아래 "각도 설정" 블록의 값은 모두 대략적인 예시값입니다.
 *   실제 로봇팔을 움직여 보면서 직접 수정해서 쓰세요.
 *
 * 응답 프로토콜 (아두이노 → 웹앱):
 *   READY               부팅 완료
 *   ACK:<명령>          명령 접수, 동작 시작
 *   DONE:<명령>         동작 완료
 *   ERR:UNKNOWN_COMMAND 알 수 없는 명령
 *   ERR:BUSY            이전 동작이 아직 끝나지 않음
 */

#include <Servo.h>

// ------------------------------------------------------------------ 핀 설정
const uint8_t PIN_SERVO_ARM     = 3;  // 관절 3개(어깨+팔꿈치+손목) 공통 신호
const uint8_t PIN_SERVO_GRIPPER = 5;  // 집게 서보

// ------------------------------------------------------------------ 각도 설정 (예시값 - 직접 조정하세요!)
// 기준: 90도 = 팔이 밑판에서 수직 1직선으로 곧게 선 자세

// HOME(기본 자세): 곧게 선 자세
const uint8_t HOME_ARM = 90;

// 관절 안전 범위: 이 범위를 벗어난 목표값은 잘라낸다.
// 처음에는 좁게 잡고, 실제로 움직여 보며 천천히 넓히는 것이 안전하다.
const uint8_t MIN_ARM = 30,  MAX_ARM = 150;
const uint8_t MIN_GRIPPER = 0,  MAX_GRIPPER = 90;

// 집게 각도 (예시값): 실제 집게가 벌어지고 오므라지는 각도로 수정하세요.
const uint8_t GRIPPER_OPEN   = 10;  // RELEASE (서서히 벌리기)
const uint8_t GRIPPER_CLOSED = 60;  // GRAB (서서히 오므리기)

// ARM_UP / ARM_DOWN 한 번에 관절이 움직이는 각도 (예시값)
const uint8_t ARM_STEP_DEGREES = 15;

// 서보 이동 속도: 1도 움직일 때마다 기다리는 시간(ms). 클수록 천천히("서서히") 움직인다.
const uint16_t SERVO_STEP_INTERVAL_MS = 20;

// ------------------------------------------------------------------ 내부 상태
Servo servoArm;      // 관절 3개가 이 하나의 신호를 함께 받는다.
Servo servoGripper;

uint8_t currentArm     = HOME_ARM,     targetArm     = HOME_ARM;
uint8_t currentGripper = GRIPPER_OPEN, targetGripper = GRIPPER_OPEN;

// 현재 처리 중인 명령 (비어 있으면 대기 상태)
String activeCommand = "";
String inputBuffer = "";

unsigned long lastServoMoveAt = 0;

// ------------------------------------------------------------------ 유틸리티
uint8_t clampAngle(int value, uint8_t minValue, uint8_t maxValue) {
  if (value < minValue) return minValue;
  if (value > maxValue) return maxValue;
  return (uint8_t)value;
}

bool isMoving() {
  return currentArm != targetArm || currentGripper != targetGripper;
}

// ------------------------------------------------------------------ 명령 처리
void startCommand(const String &command) {
  if (command == "HOME") {
    targetArm = clampAngle(HOME_ARM, MIN_ARM, MAX_ARM);
    // HOME에서는 집게를 움직이지 않는다. 필요하면 아래 줄의 주석을 해제하세요.
    // targetGripper = clampAngle(GRIPPER_OPEN, MIN_GRIPPER, MAX_GRIPPER);
  } else if (command == "GRAB") {
    targetGripper = clampAngle(GRIPPER_CLOSED, MIN_GRIPPER, MAX_GRIPPER);
  } else if (command == "RELEASE") {
    targetGripper = clampAngle(GRIPPER_OPEN, MIN_GRIPPER, MAX_GRIPPER);
  } else if (command == "ARM_UP") {
    // 관절 각도를 키운다(90 쪽으로 펴거나 반대쪽으로 넘어감).
    // 방향이 생각과 반대라면 +를 -로 바꾸세요.
    targetArm = clampAngle((int)targetArm + ARM_STEP_DEGREES, MIN_ARM, MAX_ARM);
  } else if (command == "ARM_DOWN") {
    // 관절 각도를 줄여 팔을 서서히 구부린다.
    targetArm = clampAngle((int)targetArm - ARM_STEP_DEGREES, MIN_ARM, MAX_ARM);
  }
  activeCommand = command;
  Serial.print(F("ACK:"));
  Serial.println(command);
}

void handleStop() {
  // STOP은 언제나 즉시 처리한다: 모든 목표를 현재 위치로 맞춰 그 자리에 멈춘다.
  targetArm = currentArm;
  targetGripper = currentGripper;
  // 중단된 명령의 DONE은 보내지 않는다. (웹앱은 STOP 시 대기 명령을 스스로 정리한다)
  activeCommand = "";
  Serial.println(F("ACK:STOP"));
  Serial.println(F("DONE:STOP"));
}

void processLine(String line) {
  line.trim();
  if (line.length() == 0) {
    return;
  }
  if (line == "STOP") {
    handleStop();
    return;
  }
  if (isMoving() || activeCommand.length() > 0) {
    Serial.println(F("ERR:BUSY"));
    return;
  }
  if (line == "HOME" || line == "GRAB" || line == "RELEASE" ||
      line == "ARM_UP" || line == "ARM_DOWN") {
    startCommand(line);
  } else {
    // 웹앱의 "사용자 지정 명령"을 쓰려면 여기에 else if 분기를 추가하세요.
    // 예) else if (line == "BOW") { targetArm = 40; activeCommand = line; Serial.println("ACK:BOW"); }
    Serial.println(F("ERR:UNKNOWN_COMMAND"));
  }
}

// ------------------------------------------------------------------ 서보 구동 (비차단)
// 목표 각도까지 1도씩 서서히 움직인다. 동작 중에도 STOP을 즉시 받을 수 있다.
void moveServosTowardTargets() {
  unsigned long nowMs = millis();
  if (nowMs - lastServoMoveAt < SERVO_STEP_INTERVAL_MS) {
    return;
  }
  lastServoMoveAt = nowMs;

  if (currentArm != targetArm) {
    currentArm += (currentArm < targetArm) ? 1 : -1;
    servoArm.write(currentArm);  // 관절 3개가 함께 움직인다.
  }
  if (currentGripper != targetGripper) {
    currentGripper += (currentGripper < targetGripper) ? 1 : -1;
    servoGripper.write(currentGripper);
  }
}

void finishCommandIfDone() {
  if (activeCommand.length() > 0 && !isMoving()) {
    Serial.print(F("DONE:"));
    Serial.println(activeCommand);
    activeCommand = "";
  }
}

// ------------------------------------------------------------------ 시리얼 수신 (비차단)
void readSerial() {
  while (Serial.available() > 0) {
    char received = (char)Serial.read();
    if (received == '\n') {
      processLine(inputBuffer);
      inputBuffer = "";
    } else if (inputBuffer.length() < 48) {
      inputBuffer += received;
    }
  }
}

// ------------------------------------------------------------------ 설정과 메인 루프
void setup() {
  Serial.begin(9600);

  servoArm.attach(PIN_SERVO_ARM);
  servoGripper.attach(PIN_SERVO_GRIPPER);

  // 시작 시 HOME 자세(곧게 선 자세)로 이동한다.
  // 주의: 전원을 켠 직후에는 팔이 어떤 자세든 HOME까지 한 번에 움직이므로
  //       주변에 손이나 물건이 없는지 확인한 뒤 전원을 연결하세요.
  servoArm.write(HOME_ARM);
  servoGripper.write(GRIPPER_OPEN);

  Serial.println(F("READY"));
}

void loop() {
  readSerial();               // 명령 수신 (STOP은 동작 중에도 즉시 처리)
  moveServosTowardTargets();  // 서보를 목표 각도로 서서히 이동
  finishCommandIfDone();      // 동작이 끝나면 DONE 응답
}
