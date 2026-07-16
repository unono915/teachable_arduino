/** 웹캠 시작/중지를 담당하는 얇은 래퍼 */

export function isWebcamSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

/** 카메라 권한이 거부된 오류인지 판별한다. */
export function isPermissionDenied(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')
  );
}

/** 사용 가능한 카메라가 없는 오류인지 판별한다. */
export function isNoCamera(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

export async function startWebcam(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: 'user',
    },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

/** 스트림 트랙을 실제로 종료하고 비디오 요소를 정리한다. */
export function stopWebcam(video: HTMLVideoElement, stream: MediaStream | null): void {
  if (stream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }
  video.srcObject = null;
}
