export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_SIDE = 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPT_ATTR = ACCEPTED.join(',');

export class ImageError extends Error {}

/**
 * 사진 파일을 검사하고 긴 변 1024px 이내 JPEG 로 줄인다.
 * EXIF 회전은 createImageBitmap(imageOrientation: 'from-image')으로 반영한다.
 * 실제로 디코딩되지 않는 파일은 확장자와 상관없이 거부한다.
 */
export async function prepareImage(file: File, opts: { keepAlpha?: boolean } = {}): Promise<Blob> {
  if (!ACCEPTED.includes(file.type)) {
    throw new ImageError(`지원하지 않는 파일 형식입니다 (${file.type || '알 수 없음'}). JPG, PNG, WebP 사진만 올릴 수 있습니다.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageError(`사진이 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB). 10MB 이하 사진을 사용하세요.`);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageError('사진을 읽을 수 없습니다. 손상되었거나 사진이 아닌 파일입니다.');
  }

  try {
    if (bitmap.width < 8 || bitmap.height < 8) throw new ImageError('사진 크기가 너무 작습니다.');
    const ratio = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * ratio);
    const h = Math.round(bitmap.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageError('이 브라우저에서 사진을 처리할 수 없습니다.');
    ctx.drawImage(bitmap, 0, 0, w, h);
    // 로고처럼 투명 배경이 필요한 이미지는 PNG 로 둔다
    const type = opts.keepAlpha ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.88));
    if (!blob) throw new ImageError('사진 변환에 실패했습니다.');
    return blob;
  } finally {
    bitmap.close();
  }
}
