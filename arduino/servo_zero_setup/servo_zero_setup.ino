/*
 * 서보모터 조립 기준(90도) 세팅 스케치
 * =====================================
 *
 * 로봇팔을 "조립하기 전"에 이 스케치를 업로드하세요.
 * 전원이 들어오면 서보를 모두 조립 기준값(90도)으로 돌려놓습니다.
 *
 * 사용 순서:
 *   1. 서보를 아래 핀에 연결한다. (아직 팔은 조립하지 않는다)
 *      - 관절 3개(어깨+팔꿈치+손목): 신호선을 묶어 D3에 연결
 *      - 집게: D5에 연결
 *   2. 이 스케치를 업로드한다. → 모든 서보가 90도로 이동한다.
 *   3. 서보가 90도인 상태에서 로봇팔을 조립한다.
 *      - 관절 3개: 팔이 밑판 기준 수직 1직선으로 선 자세가 되도록
 *      - 집게 서보: 수직이 되도록
 *   4. 조립 후 servo_angle_test.ino로 방향·각도를 확인하고,
 *      robot_arm_serial_example.ino를 업로드해서 사용한다.
 *
 * 각도 확인 기능:
 *   시리얼 모니터(9600, 줄바꿈 설정)에서 0~180 사이의 숫자를 입력하면
 *   모든 서보가 그 각도로 움직입니다. (90 입력 → 다시 조립 기준으로)
 *
 * ★★★ 전원 경고 ★★★
 *   서보는 외부 5V 전원으로 구동하고,
 *   외부 전원의 GND와 아두이노의 GND를 반드시 공통으로 연결하세요.
 *
 * ★ 주의 ★
 *   이미 조립된 팔에서 이 스케치를 실행하면 팔이 한 번에 90도(선 자세)로
 *   움직입니다. 주변에 손이나 물건이 없는지 확인한 뒤 전원을 연결하세요.
 */

#include <Servo.h>

// ------------------------------------------------ 핀 설정 (본 스케치와 동일)
const uint8_t PIN_SERVO_ARM     = 3;  // 관절 3개(어깨+팔꿈치+손목) 공통 신호
const uint8_t PIN_SERVO_GRIPPER = 5;  // 집게

// 조립 기준 각도. 관절 90도 = 팔이 수직 1직선으로 선 자세.
const uint8_t DEFAULT_ANGLE = 90;

Servo servoArm, servoGripper;

String inputBuffer = "";

void writeAll(uint8_t angle) {
  servoArm.write(angle);
  servoGripper.write(angle);
  Serial.print(F("모든 서보를 "));
  Serial.print(angle);
  Serial.println(F("도로 이동했습니다."));
}

void setup() {
  Serial.begin(9600);

  servoArm.attach(PIN_SERVO_ARM);
  servoGripper.attach(PIN_SERVO_GRIPPER);

  writeAll(DEFAULT_ANGLE);

  Serial.println(F("서보 조립 기준(90도) 세팅 완료. 이 상태에서 로봇팔을 조립하세요."));
  Serial.println(F("각도 확인: 시리얼 모니터에 0~180 숫자를 입력하면 모든 서보가 이동합니다."));
}

void loop() {
  while (Serial.available() > 0) {
    char received = (char)Serial.read();
    if (received == '\n' || received == '\r') {
      inputBuffer.trim();
      if (inputBuffer.length() > 0) {
        long angle = inputBuffer.toInt();
        if (angle >= 0 && angle <= 180 && (angle != 0 || inputBuffer == "0")) {
          writeAll((uint8_t)angle);
        } else {
          Serial.println(F("0~180 사이의 숫자를 입력하세요."));
        }
      }
      inputBuffer = "";
    } else if (inputBuffer.length() < 8) {
      inputBuffer += received;
    }
  }
}
