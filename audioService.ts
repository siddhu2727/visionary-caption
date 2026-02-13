
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

let activeAudioSource: AudioBufferSourceNode | null = null;

export async function playPCM(base64Audio: string) {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    if (activeAudioSource) {
      activeAudioSource.stop();
    }

    const decoded = decode(base64Audio);
    const audioBuffer = await decodeAudioData(decoded, audioContext, 24000, 1);
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();
    activeAudioSource = source;

    return new Promise((resolve) => {
      source.onended = () => {
        activeAudioSource = null;
        resolve(true);
      };
    });
  } catch (error) {
    console.error('Error playing PCM audio:', error);
    throw error;
  }
}
