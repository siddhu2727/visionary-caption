
export async function extractFramesFromVideo(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    video.muted = true;

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const timestamps = [duration * 0.2, duration * 0.5, duration * 0.8];
      const frames: string[] = [];

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      for (const ts of timestamps) {
        video.currentTime = ts;
        await new Promise((res) => {
          video.onseeked = res;
        });

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
      }

      URL.revokeObjectURL(video.src);
      resolve(frames);
    };

    video.onerror = (e) => reject(e);
  });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
}
