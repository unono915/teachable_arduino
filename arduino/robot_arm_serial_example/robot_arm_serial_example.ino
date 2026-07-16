/*
 * AI 로봇팔 컨트롤러 - 아두이노 예제 스케치 (서보 4개 버전)
 * ==========================================================
 *
 * 웹앱이 시리얼로 보내는 한 줄 명령(HOME, GRAB, RELEASE, ARM_UP, ARM_DOWN,
 * WRIST_UP, WRIST_DOWN, STOP)을 받아 로봇팔을 움직입니다.
 *
 * 하드웨어 기준:
 *   - SG90 9g 마이크로 서보모터 4개 (어깨, 팔꿈치, 손목, 집게)
 *   - 받침대 회전(스테퍼모터)은 사용하지 않음
 *   - Arduino Uno 또는 호환 보드
 *
 * ★ 조립 기준 (중요!) ★
 *   1. 조립 전에 모든 서보를 0도로 세팅한다.
 *   2. 어깨/팔꿈치/손목의 3개 축이 모두 평행이 되도록,
 *      즉 0도에서 팔이 곧게 펴진 상태가 되도록 조립한다.
 *   3. 집게(손잡이) 서보만 수직으로 장착한다.
 *   → 따라서 이 코드의 모든 각도는 "0도 = 팔이 곧게 펴진 상태"를 기준으로 한다.
 *
 * ★★★ 전원 경고 ★★★
 *   서보 4개는 반드시 외부 5V 전원으로 구동하세요.
 *   아두이노 5V 핀만으로 구동하면 전압 강하로 보드가 리셋될 수 있습니다.
 *   외부 전원의 GND와 아두이노의 GND를 반드시 공통으로 연결하세요.
 *
 * ★★★ 각도 조정 ★★★
 *   아래 "각도 설정" 블록의 값은 모두 대략적인 예시값입니다.
 *   실제 로봇팔을 움직여 보면서 명령별 각도를 직접 수정해서 쓰세요.
 *   (수정할 곳은 전부 파일 상단 상수에 모여 있습니다)
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
const uint8_t PIN_SERVO_SHOULDER = 5;   // 어깨 서보 (받침대 쪽)
const uint8_t PIN_SERVO_ELBOW    = 6;   // 팔꿈치 서보 (가운데)
const uint8_t PIN_SERVO_WRIST    = 9;   // 손목 서보 (집게 앞)
const uint8_t PIN_SERVO_GRIPPER  = 10;  // 집게 서보 (수직 장착)

// ------------------------------------------------------------------ 각도 설정 (예시값 - 직접 조정하세요!)
// 기준: 0도 = 어깨/팔꿈치/손목이 모두 펴져 팔이 일직선인 상태 (조립 기준 자세)

// HOME(기본 자세): 팔이 적당히 접혀 서 있는 자세 (예시값)
const uint8_t HOME_SHOULDER = 45;
const uint8_t HOME_ELBOW    = 60;
const uint8_t HOME_WRIST    = 30;

// 관절별 안전 범위: 이 범위를 벗어난 목표값은 잘라낸다.
// 처음에는 좁게 잡고, 실제로 움직여 보며 천천히 넓히는 것이 안전하다.
const uint8_t MIN_SHOULDER = 0,  MAX_SHOULDER = 170;
const uint8_t MIN_ELBOW    = 0,  MAX_ELBOW    = 170;
const uint8_t MIN_WRIST    = 0,  MAX_WRIST    = 170;
const uint8_t MIN_GRIPPER  = 0,  MAX_GRIPPER  = 90;

// 집게 각도 (예시값): 실제 집게가 열리고 닫히는 각도로 수정하세요.
const uint8_t GRIPPER_OPEN   = 10;  // RELEASE (물체 놓기)
const uint8_t GRIPPER_CLOSED = 60;  // GRAB (물체 잡기)

// ARM_UP / ARM_DOWN 한 번에 어깨가 움직이는 각도 (예시값)
const uint8_t ARM_STEP_DEGREES = 15;
// WRIST_UP / WRIST_DOWN 한 번에 손목이 움직이는 각도 (예시값)
const uint8_t WRIST_STEP_DEGREES = 15;

// 서보 이동 속도: 1도 움직일 때마다 기다리는 시간(ms). 클수록 천천히 움직인다.
const uint16_t SERVO_STEP_INTERVAL_MS = 15;

// ------------------------------------------------------------------ 내부 상태
Servo servoShoulder, servoElbow, servoWrist, servoGripper;

// 서보 현재/목표 각도. 시작 시 HOME 자세로 초기화한다.
uint8_t currentShoulder = HOME_SHOULDER, targetShoulder = HOME_SHOULDER;
uint8_t currentElbow    = HOME_ELBOW,    targetElbow    = HOME_ELBOW;
uint8_t currentWrist    = HOME_WRIST,    targetWrist    = HOME_WRIST;
uint8_t currentGripper  = GRIPPER_OPEN,  targetGripper  = GRIPPER_OPEN;

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
  return currentShoulder != targetShoulder ||
         currentElbow != targetElbow ||
         currentWrist != targetWrist ||
         currentGripper != targetGripper;
}

// ------------------------------------------------------------------ 명령 처리
void startCommand(const String &command) {
  if (command == "HOME") {
    targetShoulder = clampAngle(HOME_SHOULDER, MIN_SHOULDER, MAX_SHOULDER);
    targetElbow    = clampAngle(HOME_ELBOW, MIN_ELBOW, MAX_ELBOW);
    targetWrist    = clampAngle(HOME_WRIST, MIN_WRIST, MAX_WRIST);
    // HOME에서는 집게를 움직이지 않는다. 필요하면 아래 줄의 주석을 해제하세요.
    // targetGripper = clampAngle(GRIPPER_OPEN, MIN_GRIPPER, MAX_GRIPPER);
  } else if (command == "GRAB") {
    targetGripper = clampAngle(GRIPPER_CLOSED, MIN_GRIPPER, MAX_GRIPPER);
  } else if (command == "RELEASE") {
    targetGripper = clampAngle(GRIPPER_OPEN, MIN_GRIPPER, MAX_GRIPPER);
  } else if (command == "ARM_UP") {
    // 어깨를 세우면 팔이 올라간다. 방향이 반대라면 +를 -로 바꾸세요.
    targetShoulder = clampAngle((int)targetShoulder + ARM_STEP_DEGREES, MIN_SHOULDER, MAX_SHOULDER);
  } else if (command == "ARM_DOWN") {
    targetShoulder = clampAngle((int)targetShoulder - ARM_STEP_DEGREES, MIN_SHOULDER, MAX_SHOULDER);
  } else if (command == "WRIST_UP") {
    // 방향이 반대라면 +를 -로 바꾸세요.
    targetWrist = clampAngle((int)targetWrist + WRIST_STEP_DEGREES, MIN_WRIST, MAX_WRIST);
  } else if (command == "WRIST_DOWN") {
    targetWrist = clampAngle((int)targetWrist - WRIST_STEP_DEGREES, MIN_WRIST, MAX_WRIST);
  }
  activeCommand = command;
  Serial.print(F("ACK:"));
  Serial.println(command);
}

void handleStop() {
  // STOP은 언제나 즉시 처리한다: 모든 목표를 현재 위치로 맞춰 그 자리에 멈춘다.
  targetShoulder = currentShoulder;
  targetElbow    = currentElbow;
  targetWrist    = currentWrist;
  targetGripper  = currentGripper;
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
      line == "ARM_UP" || line == "ARM_DOWN" ||
      line == "WRIST_UP" || line == "WRIST_DOWN") {
    startCommand(line);
  } else {
    // 웹앱의 "사용자 지정 명령"을 쓰려면 여기에 else if 분기를 추가하세요.
    // 예) else if (line == "WAVE") { ...목표 각도 설정...; activeCommand = line; Serial.println("ACK:WAVE"); }
    Serial.println(F("ERR:UNKNOWN_COMMAND"));
  }
}

// ------------------------------------------------------------------ 서보 구동 (비차단)
// 목표 각도까지 1도씩 천천히 움직인다. 동작 중에도 STOP을 즉시 받을 수 있다.
void moveServosTowardTargets() {
  unsigned long nowMs = millis();
  if (nowMs - lastServoMoveAt < SERVO_STEP_INTERVAL_MS) {
    return;
  }
  lastServoMoveAt = nowMs;

  if (currentShoulder != targetShoulder) {
    currentShoulder += (currentShoulder < targetShoulder) ? 1 : -1;
    servoShoulder.write(currentShoulder);
  }
  if (currentElbow != targetElbow) {
    currentElbow += (currentElbow < targetElbow) ? 1 : -1;
    servoElbow.write(currentElbow);
  }
  if (currentWrist != targetWrist) {
    currentWrist += (currentWrist < targetWrist) ? 1 : -1;
    servoWrist.write(currentWrist);
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

  servoShoulder.attach(PIN_SERVO_SHOULDER);
  servoElbow.attach(PIN_SERVO_ELBOW);
  servoWrist.attach(PIN_SERVO_WRIST);
  servoGripper.attach(PIN_SERVO_GRIPPER);

  // 시작 시 HOME 자세로 이동한다.
  // 주의: 전원을 켠 직후에는 팔이 어떤 자세든 HOME까지 한 번에 움직이므로
  //       주변에 손이나 물건이 없는지 확인한 뒤 전원을 연결하세요.
  servoShoulder.write(HOME_SHOULDER);
  servoElbow.write(HOME_ELBOW);
  servoWrist.write(HOME_WRIST);
  servoGripper.write(GRIPPER_OPEN);

  Serial.println(F("READY"));
}

void loop() {
  readSerial();               // 명령 수신 (STOP은 동작 중에도 즉시 처리)
  moveServosTowardTargets();  // 서보를 목표 각도로 천천히 이동
  finishCommandIfDone();      // 동작이 끝나면 DONE 응답
}
