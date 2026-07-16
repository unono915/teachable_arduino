/*
 * AI 로봇팔 컨트롤러 - 아두이노 예제 스케치
 * =========================================
 *
 * 웹앱이 시리얼로 보내는 한 줄 명령(HOME, GRAB, RELEASE, ARM_UP, ARM_DOWN,
 * BASE_LEFT, BASE_RIGHT, STOP)을 받아 로봇팔을 움직입니다.
 *
 * 하드웨어 기준:
 *   - SG90 9g 마이크로 서보모터 4개 (어깨, 팔꿈치, 손목, 집게)
 *   - 28BYJ-48 5V 스테퍼모터 1개 + ULN2003 드라이버 (받침대 회전)
 *   - Arduino Uno 또는 호환 보드
 *
 * ★★★ 전원 경고 ★★★
 *   모터(서보 4개 + 스테퍼)는 반드시 외부 5V 전원으로 구동하세요.
 *   아두이노 5V 핀만으로 구동하면 전압 강하로 보드가 리셋되거나 고장 납니다.
 *   외부 전원의 GND와 아두이노의 GND를 반드시 공통으로 연결하세요.
 *
 * ★★★ 각도 경고 ★★★
 *   아래의 핀 번호, HOME 각도, 최소/최대 각도는 모두 "예시값"입니다.
 *   실제 조립 방향과 관절 구조에 따라 안전한 값이 다르므로,
 *   조립 후 반드시 실제 로봇팔에 맞게 수정한 뒤 사용하세요.
 *   검증되지 않은 각도로 구동하면 로봇팔이 자기 자신이나 주변과 충돌할 수 있습니다.
 *
 * 응답 프로토콜 (아두이노 → 웹앱):
 *   READY               부팅 완료
 *   ACK:<명령>          명령 접수, 동작 시작
 *   DONE:<명령>         동작 완료
 *   ERR:UNKNOWN_COMMAND 알 수 없는 명령
 *   ERR:BUSY            이전 동작이 아직 끝나지 않음
 */

#include <Servo.h>

// ------------------------------------------------------------------ 핀 설정 (예시값)
const uint8_t PIN_SERVO_SHOULDER = 5;   // 어깨 서보
const uint8_t PIN_SERVO_ELBOW    = 6;   // 팔꿈치 서보
const uint8_t PIN_SERVO_WRIST    = 9;   // 손목 서보
const uint8_t PIN_SERVO_GRIPPER  = 10;  // 집게 서보

// ULN2003 IN1~IN4 (예시값)
const uint8_t PIN_STEPPER_IN1 = 2;
const uint8_t PIN_STEPPER_IN2 = 3;
const uint8_t PIN_STEPPER_IN3 = 4;
const uint8_t PIN_STEPPER_IN4 = 7;

// ------------------------------------------------------------------ 각도 설정 (예시값 - 반드시 실측 후 수정!)
// HOME(기본 자세) 각도
const uint8_t HOME_SHOULDER = 90;
const uint8_t HOME_ELBOW    = 90;
const uint8_t HOME_WRIST    = 90;
const uint8_t HOME_GRIPPER  = 60;  // 집게 벌림 상태

// 관절별 안전 범위. 이 범위를 벗어난 목표값은 잘라낸다.
const uint8_t MIN_SHOULDER = 30,  MAX_SHOULDER = 150;
const uint8_t MIN_ELBOW    = 30,  MAX_ELBOW    = 150;
const uint8_t MIN_WRIST    = 30,  MAX_WRIST    = 150;
const uint8_t MIN_GRIPPER  = 40,  MAX_GRIPPER  = 110;

// 집게 각도 (예시값)
const uint8_t GRIPPER_OPEN   = 60;   // RELEASE
const uint8_t GRIPPER_CLOSED = 100;  // GRAB

// ARM_UP / ARM_DOWN 한 번에 움직이는 각도 (예시값)
const uint8_t ARM_STEP_DEGREES = 20;

// 서보 이동 속도: 1도 움직일 때마다 기다리는 시간(ms). 클수록 천천히 움직인다.
const uint16_t SERVO_STEP_INTERVAL_MS = 15;

// ------------------------------------------------------------------ 스테퍼 설정 (예시값)
// BASE_LEFT / BASE_RIGHT 한 번에 회전하는 스텝 수.
// 28BYJ-48은 하프스텝 기준 약 4096스텝에 1회전(감속비 포함)이다.
const uint16_t BASE_TURN_STEPS = 512;  // 약 45도 (예시값)
// 스텝 간격(ms). 너무 작으면 탈조(스텝 놓침)가 생길 수 있다.
const uint16_t STEPPER_STEP_INTERVAL_MS = 2;

// ------------------------------------------------------------------ 내부 상태
Servo servoShoulder, servoElbow, servoWrist, servoGripper;

// 서보 현재/목표 각도
uint8_t currentShoulder = HOME_SHOULDER, targetShoulder = HOME_SHOULDER;
uint8_t currentElbow    = HOME_ELBOW,    targetElbow    = HOME_ELBOW;
uint8_t currentWrist    = HOME_WRIST,    targetWrist    = HOME_WRIST;
uint8_t currentGripper  = HOME_GRIPPER,  targetGripper  = HOME_GRIPPER;

// 스테퍼 상태: 남은 스텝 수(부호가 방향), 하프스텝 시퀀스 위치
long stepperRemaining = 0;
uint8_t stepperPhase = 0;

// 하프스텝 시퀀스 (IN1, IN2, IN3, IN4)
const uint8_t HALF_STEP_SEQUENCE[8][4] = {
  {1, 0, 0, 0}, {1, 1, 0, 0}, {0, 1, 0, 0}, {0, 1, 1, 0},
  {0, 0, 1, 0}, {0, 0, 1, 1}, {0, 0, 0, 1}, {1, 0, 0, 1},
};

// 현재 처리 중인 명령 (비어 있으면 대기 상태)
String activeCommand = "";
String inputBuffer = "";

unsigned long lastServoMoveAt = 0;
unsigned long lastStepperMoveAt = 0;

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
         currentGripper != targetGripper ||
         stepperRemaining != 0;
}

void stepperOff() {
  digitalWrite(PIN_STEPPER_IN1, LOW);
  digitalWrite(PIN_STEPPER_IN2, LOW);
  digitalWrite(PIN_STEPPER_IN3, LOW);
  digitalWrite(PIN_STEPPER_IN4, LOW);
}

// ------------------------------------------------------------------ 명령 처리
void startCommand(const String &command) {
  if (command == "HOME") {
    targetShoulder = HOME_SHOULDER;
    targetElbow    = HOME_ELBOW;
    targetWrist    = HOME_WRIST;
    targetGripper  = HOME_GRIPPER;
  } else if (command == "GRAB") {
    targetGripper = clampAngle(GRIPPER_CLOSED, MIN_GRIPPER, MAX_GRIPPER);
  } else if (command == "RELEASE") {
    targetGripper = clampAngle(GRIPPER_OPEN, MIN_GRIPPER, MAX_GRIPPER);
  } else if (command == "ARM_UP") {
    targetShoulder = clampAngle((int)targetShoulder - ARM_STEP_DEGREES, MIN_SHOULDER, MAX_SHOULDER);
    targetElbow    = clampAngle((int)targetElbow + ARM_STEP_DEGREES, MIN_ELBOW, MAX_ELBOW);
    // 위/아래 방향은 조립 방향에 따라 반대일 수 있다. 실제 동작을 보고 +/-를 수정하세요.
  } else if (command == "ARM_DOWN") {
    targetShoulder = clampAngle((int)targetShoulder + ARM_STEP_DEGREES, MIN_SHOULDER, MAX_SHOULDER);
    targetElbow    = clampAngle((int)targetElbow - ARM_STEP_DEGREES, MIN_ELBOW, MAX_ELBOW);
  } else if (command == "BASE_LEFT") {
    stepperRemaining = -(long)BASE_TURN_STEPS;
    // 왼쪽/오른쪽 방향도 조립 방향에 따라 반대일 수 있다.
  } else if (command == "BASE_RIGHT") {
    stepperRemaining = (long)BASE_TURN_STEPS;
  }
  activeCommand = command;
  Serial.print(F("ACK:"));
  Serial.println(command);
}

void handleStop() {
  // STOP은 언제나 즉시 처리한다: 모든 목표를 현재 위치로 맞추고 스테퍼를 멈춘다.
  targetShoulder = currentShoulder;
  targetElbow    = currentElbow;
  targetWrist    = currentWrist;
  targetGripper  = currentGripper;
  stepperRemaining = 0;
  stepperOff();
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
      line == "BASE_LEFT" || line == "BASE_RIGHT") {
    startCommand(line);
  } else {
    // 웹앱의 "사용자 지정 명령"을 쓰려면 여기에 else if 분기를 추가하세요.
    Serial.println(F("ERR:UNKNOWN_COMMAND"));
  }
}

// ------------------------------------------------------------------ 모터 구동 (비차단)
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

void moveStepperTowardTarget() {
  if (stepperRemaining == 0) {
    return;
  }
  unsigned long nowMs = millis();
  if (nowMs - lastStepperMoveAt < STEPPER_STEP_INTERVAL_MS) {
    return;
  }
  lastStepperMoveAt = nowMs;

  if (stepperRemaining > 0) {
    stepperPhase = (stepperPhase + 1) % 8;
    stepperRemaining--;
  } else {
    stepperPhase = (stepperPhase + 7) % 8;
    stepperRemaining++;
  }
  digitalWrite(PIN_STEPPER_IN1, HALF_STEP_SEQUENCE[stepperPhase][0]);
  digitalWrite(PIN_STEPPER_IN2, HALF_STEP_SEQUENCE[stepperPhase][1]);
  digitalWrite(PIN_STEPPER_IN3, HALF_STEP_SEQUENCE[stepperPhase][2]);
  digitalWrite(PIN_STEPPER_IN4, HALF_STEP_SEQUENCE[stepperPhase][3]);

  if (stepperRemaining == 0) {
    stepperOff();  // 정지 상태에서 코일 발열을 막는다.
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

  pinMode(PIN_STEPPER_IN1, OUTPUT);
  pinMode(PIN_STEPPER_IN2, OUTPUT);
  pinMode(PIN_STEPPER_IN3, OUTPUT);
  pinMode(PIN_STEPPER_IN4, OUTPUT);
  stepperOff();

  servoShoulder.attach(PIN_SERVO_SHOULDER);
  servoElbow.attach(PIN_SERVO_ELBOW);
  servoWrist.attach(PIN_SERVO_WRIST);
  servoGripper.attach(PIN_SERVO_GRIPPER);

  // 시작 시 안전한 HOME 위치로 이동한다.
  servoShoulder.write(HOME_SHOULDER);
  servoElbow.write(HOME_ELBOW);
  servoWrist.write(HOME_WRIST);
  servoGripper.write(HOME_GRIPPER);

  Serial.println(F("READY"));
}

void loop() {
  readSerial();               // 명령 수신 (STOP은 동작 중에도 즉시 처리)
  moveServosTowardTargets();  // 서보를 목표 각도로 천천히 이동
  moveStepperTowardTarget();  // 스테퍼를 남은 스텝만큼 회전
  finishCommandIfDone();      // 동작이 끝나면 DONE 응답
}
