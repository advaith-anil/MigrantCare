this.onmessage = async function (e) {
    const { audioArrayBuffer, sampleRate } = e.data;
    const audioBuffer = await arrayBufferToAudioBuffer(audioArrayBuffer, sampleRate);
    const wavBuffer = audioBufferToWav(audioBuffer);
    this.postMessage(wavBuffer);
};

async function arrayBufferToAudioBuffer(arrayBuffer, sampleRate) {
    const audioContext = new (self.OfflineAudioContext || self.webkitOfflineAudioContext)(1, arrayBuffer.byteLength / 4, sampleRate);
    return await new Promise((resolve, reject) => {
        audioContext.decodeAudioData(arrayBuffer, (decodedData) => resolve(decodedData), (error) => reject(error));
    });
}

function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels,
        length = buffer.length * numOfChan * 2 + 44,
        bufferArray = new ArrayBuffer(length),
        view = new DataView(bufferArray),
        channels = [],
        sampleRate = buffer.sampleRate;

    let offset = 0,
        pos = 0;

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(sampleRate);
    setUint32(sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this demo)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (let i = 0; i < buffer.numberOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
        for (let i = 0; i < numOfChan; i++) {
            const sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
            view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true); // convert to PCM
            pos += 2;
        }
        offset++;
    }

    return new Blob([bufferArray], { type: 'audio/wav' });
}

class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.port.onmessage = this.onMessage.bind(this);
    }

    onMessage(event) {
        if (event.data.command === 'stop') {
            this.port.close();
        }
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length > 0) {
            const channelData = input[0];
            const audioArrayBuffer = channelData.buffer.slice(0);
            this.port.postMessage({ audioArrayBuffer, sampleRate: sampleRate });
        }
        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);

if (!window.OfflineAudioContext && !window.webkitOfflineAudioContext) {
    console.error("OfflineAudioContext is not supported in this browser.");
}

