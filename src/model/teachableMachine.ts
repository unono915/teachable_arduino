import * as tf from '@tensorflow/tfjs';

export interface Prediction {
  className: string;
  probability: number;
}

export interface LoadedModel {
  labels: readonly string[];
  predict(video: HTMLVideoElement, mirror: boolean): Promise<Prediction[]>;
  dispose(): void;
}

/** Teachable Machine 이미지 모델의 입력 크기 */
const INPUT_SIZE = 224;

interface TmMetadata {
  labels?: unknown;
}

/** 학생에게 보여줄 수 있는 한국어 메시지를 가진 모델 로딩 오류 */
export class ModelLoadError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ModelLoadError';
  }
}

async function fetchMetadata(baseUrl: string): Promise<string[]> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}metadata.json`);
  } catch (error) {
    throw new ModelLoadError('모델 정보를 내려받지 못했습니다. 인터넷 연결을 확인하세요.', error);
  }
  if (!response.ok) {
    throw new ModelLoadError(
      'Teachable Machine에서 공유한 모델 URL인지 확인하세요. (metadata.json을 찾을 수 없습니다)',
    );
  }
  let metadata: TmMetadata;
  try {
    metadata = (await response.json()) as TmMetadata;
  } catch (error) {
    throw new ModelLoadError('모델 정보 형식이 올바르지 않습니다.', error);
  }
  const labels = Array.isArray(metadata.labels)
    ? metadata.labels.filter((label): label is string => typeof label === 'string')
    : [];
  if (labels.length === 0) {
    throw new ModelLoadError('모델에서 라벨을 찾을 수 없습니다. 이미지 분류 모델인지 확인하세요.');
  }
  return labels;
}

/**
 * Teachable Machine 이미지 분류 모델을 불러온다.
 * baseUrl은 마지막 슬래시를 포함한 정규화된 URL이어야 한다.
 *
 * Teachable Machine 웹캠 학습과 동일하게 프레임을 정사각형으로
 * 가운데 잘라 224x224로 축소하고 [-1, 1] 범위로 정규화하여 추론한다.
 */
export async function loadTeachableMachineModel(baseUrl: string): Promise<LoadedModel> {
  const labels = await fetchMetadata(baseUrl);

  let model: tf.LayersModel;
  try {
    model = await tf.loadLayersModel(`${baseUrl}model.json`);
  } catch (error) {
    throw new ModelLoadError(
      '모델 파일을 불러오지 못했습니다. Teachable Machine에서 공유한 모델 URL인지 확인하세요.',
      error,
    );
  }

  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    model.dispose();
    throw new ModelLoadError('캔버스를 사용할 수 없어 추론을 준비하지 못했습니다.');
  }

  let disposed = false;

  return {
    labels,
    async predict(video: HTMLVideoElement, mirror: boolean): Promise<Prediction[]> {
      if (disposed) {
        throw new Error('이미 해제된 모델입니다.');
      }
      drawCenterCrop(context, video, mirror);
      const output = tf.tidy(() => {
        const image = tf.browser
          .fromPixels(canvas)
          .toFloat()
          .div(127.5)
          .sub(1)
          .expandDims(0);
        const result = model.predict(image);
        return Array.isArray(result) ? result[0] : result;
      });
      if (!output) {
        throw new Error('모델이 출력을 만들지 못했습니다.');
      }
      try {
        const scores = await output.data();
        const count = Math.min(labels.length, scores.length);
        const predictions: Prediction[] = [];
        for (let i = 0; i < count; i += 1) {
          predictions.push({
            className: labels[i] ?? `클래스 ${i + 1}`,
            probability: scores[i] ?? 0,
          });
        }
        return predictions;
      } finally {
        output.dispose();
      }
    },
    dispose(): void {
      if (!disposed) {
        disposed = true;
        model.dispose();
      }
    },
  };
}

function drawCenterCrop(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  mirror: boolean,
): void {
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  if (!videoWidth || !videoHeight) {
    throw new Error('웹캠 영상이 아직 준비되지 않았습니다.');
  }
  const side = Math.min(videoWidth, videoHeight);
  const sourceX = (videoWidth - side) / 2;
  const sourceY = (videoHeight - side) / 2;
  context.save();
  if (mirror) {
    context.translate(INPUT_SIZE, 0);
    context.scale(-1, 1);
  }
  context.drawImage(video, sourceX, sourceY, side, side, 0, 0, INPUT_SIZE, INPUT_SIZE);
  context.restore();
}
