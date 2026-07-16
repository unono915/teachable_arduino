/*
 * 서보모터 각도 확인(캘리브레이션) 스케치
 * ========================================
 *
 * 조립된 로봇팔에서 서보 하나하나를 원하는 각도로 움직여 보면서
 * 각 관절의 방향과 자세를 확인하는 용도입니다.
 *
 * 사용 방법: 시리얼 모니터(9600, "새 줄" 설정)에 명령을 입력하세요.
 *
 *   S 90   → 어깨(Shoulder)를 90도로
 *   E 45   → 팔꿈치(Elbow)를 45도로
 *   W 120  → 손목(Wrist)을 120도로
 *   G 30   → 집게(Gripper)를 30도로
 *   A 0    → 모든 서보를 0도로
 *   ?      → 현재 각도 출력
 *
 *   (공백 없이 S90 처럼 입력해도 됩니다. 각도 범위: 0~180)
 *
 * 이렇게 알아낸 각도를 robot_arm_serial_example.ino 상단의
 * HOME_SHOULDER / HOME_ELBOW / HOME_WRIST, GRIPPER_OPEN / GRIPPER_CLOSED,
 * MIN_… / MAX_… 상수에 옮겨 적으세요.
 *
 * 팁: 팔이 "바깥쪽으로 서야 하는데 안쪽으로 말리는" 경우
 *   서보는 몸통 기준 반대 방향으로 도는 것이므로, 그 관절은
 *   각도를 "180 - 원하는각도"로 생각하면 됩니다.
 *   예) 어깨를 45도만큼 세우고 싶은데 안쪽으로 말리면 S 135를 시험해 보세요.
 *   방향이 반대인 관절은 본 스케치(robot_arm_serial_example.ino)에서
 *   ARM_UP/WRIST_UP의 +를 -로 바꾸고, HOME 각도도 그 방향 기준으로 정하세요.
 *
 * ★★★ 전원 경고 ★★★
 *   서보는 외부 5V 전원으로 구동하고, 외부 전원의 GND와
 *   아두이노의 GND를 반드시 공통으로 연결하세요.
 *
 * ★ 안전 ★
 *   서보가 천천히(1도씩) 움직이도록 되어 있지만, 큰 각도를 입력하면
 *   팔이 크게 움직입니다. 관절과 집게 사이에 손을 넣지 마세요.
 */

#include <Servo.h>

// ------------------------------------------------ 핀 설정 (본 스케치와 동일)
const uint8_t PIN_SERVO_SHOULDER = 5;   // 어깨
const uint8_t PIN_SERVO_ELBOW    = 6;   // 팔꿈치
const uint8_t PIN_SERVO_WRIST    = 9;   // 손목
const uint8_t PIN_SERVO_GRIPPER  = 10;  // 집게

// 시작 각도: 조립 기준 자세(0도)
const uint8_t START_ANGLE = 0;

// 1도 움직일 때마다 기다리는 시간(ms). 클수록 천천히 움직인다.
const uint16_t STEP_INTERVAL_MS = 15;

Servo servoShoulder, servoElbow, servoWrist, servoGripper;

uint8_t angleShoulder = START_ANGLE;
uint8_t angleElbow    = START_ANGLE;
uint8_t angleWrist    = START_ANGLE;
uint8_t angleGripper  = START_ANGLE;

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
  Serial.print(F("S 어깨    : ")); Serial.println(angleShoulder);
  Serial.print(F("E 팔꿈치  : ")); Serial.println(angleElbow);
  Serial.print(F("W 손목    : ")); Serial.println(angleWrist);
  Serial.print(F("G 집게    : ")); Serial.println(angleGripper);
  Serial.println(F("-------------------"));
}

void printHelp() {
  Serial.println(F("명령: S/E/W/G/A + 각도(0~180), ? = 현재 각도"));
  Serial.println(F("예)  S 90  → 어깨 90도,  A 0 → 전부 0도"));
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
    case 'S':
      moveSlowly(servoShoulder, angleShoulder, (uint8_t)angle, F("어깨"));
      break;
    case 'E':
      moveSlowly(servoElbow, angleElbow, (uint8_t)angle, F("팔꿈치"));
      break;
    case 'W':
      moveSlowly(servoWrist, angleWrist, (uint8_t)angle, F("손목"));
      break;
    case 'G':
      moveSlowly(servoGripper, angleGripper, (uint8_t)angle, F("집게"));
      break;
    case 'A':
      moveSlowly(servoShoulder, angleShoulder, (uint8_t)angle, F("어깨"));
      moveSlowly(servoElbow, angleElbow, (uint8_t)angle, F("팔꿈치"));
      moveSlowly(servoWrist, angleWrist, (uint8_t)angle, F("손목"));
      moveSlowly(servoGripper, angleGripper, (uint8_t)angle, F("집게"));
      break;
    default:
      Serial.print(F("알 수 없는 서보: "));
      Serial.println(target);
      printHelp();
      return;
  }
  printAngles();
}

// ------------------------------------------------ 설정과 메인 루프
void setup() {
  Serial.begin(9600);

  servoShoulder.attach(PIN_SERVO_SHOULDER);
  servoElbow.attach(PIN_SERVO_ELBOW);
  servoWrist.attach(PIN_SERVO_WRIST);
  servoGripper.attach(PIN_SERVO_GRIPPER);

  servoShoulder.write(START_ANGLE);
  servoElbow.write(START_ANGLE);
  servoWrist.write(START_ANGLE);
  servoGripper.write(START_ANGLE);

  Serial.println(F("서보 각도 확인 스케치 준비 완료. (시작 각도 0도)"));
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
