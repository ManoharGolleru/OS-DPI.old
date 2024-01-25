import { strip } from "./display";
import { TreeBase } from "./treebase";
import { html } from "uhtml";
import Globals from "app/globals";
import * as Props from "./props";

class Speech extends TreeBase {
  // Assuming these are initial default values
  stateName = new Props.String("$Speak");
  voiceURI = new Props.Voice("", { label: "Voice" });
  Speaker1 = new Props.Float(1);
  Speaker2 = new Props.Float(1);
  pitch = new Props.Float(1);
  rate = new Props.Float(1);
  volume = new Props.Float(1);

  async speak() {
    const { state } = Globals;
    let { stateName, Speaker1, Speaker2, pitch, rate, volume } = this.props;
    let message = strip(state.get(stateName));
    console.log(this.props.stateName); // Check if stateName has the expected value

    const messageComponents = message.split('|').map(component => component.trim());
    const textMessage = messageComponents[0]; // "Hello, how are you today?"
    let chunkParams = [];
    let gapDurations = [];

    // Extract global speaker and speech parameters if present
    const paramsRegex = /\[(.*?)\]/;
    const globalParamsMatches = paramsRegex.exec(messageComponents[1]);
    if (globalParamsMatches && globalParamsMatches[1]) {
        const params = globalParamsMatches[1].split(',').map(Number);
        [Speaker1, Speaker2, pitch, rate, volume] = params;
    }

    // Extract chunk parameters if present
    if (messageComponents.length > 2) {
        const chunkParamString = messageComponents[2].replace(/\[|\]/g, ''); // Remove square brackets
        const chunkParamGroups = chunkParamString.split(';'); // Split into groups
        chunkParams = chunkParamGroups.map(group => group.split(',').map(Number));
    }

    // Extract gap durations if present
    if (messageComponents.length > 3) {
        const gapDurationsMatches = paramsRegex.exec(messageComponents[3]);
        if (gapDurationsMatches && gapDurationsMatches[1]) {
            gapDurations = gapDurationsMatches[1].split(',').map(Number);
        }
    }

    // Ensure chunkParams array length matches the number of chunks in the text
    const textChunks = textMessage.split(', ');
    if (chunkParams.length < textChunks.length) {
        // Fill in missing chunkParams with default values
        const defaultChunkParam = [pitch, rate]; // Default values for pitch and rate
        while (chunkParams.length < textChunks.length) {
            chunkParams.push(defaultChunkParam);
        }
    }

    // Ensure gapDurations array length is one less than the number of text chunks
    if (gapDurations.length < textChunks.length - 1) {
        // Fill in missing gapDurations with a default gap duration
        const defaultGapDuration = 0.5; // Default value for gap duration
        while (gapDurations.length < textChunks.length - 1) {
            gapDurations.push(defaultGapDuration);
        }
    }

    // Payload to be sent
    const payload = {
        text: textMessage,
        Speaker1,
        Speaker2,
        pitch,
        rate,
        volume,
        chunkParams,
        gapDurations
    };

    console.log("Payload:", payload);




    // Send a request to the speech engine's /synthesize endpoint with the payload
    const response = await fetch('http://localhost:5000/synthesize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload), // Send the payload as JSON
    });

    

    
    if (response.ok) {
        // Create an AudioBuffer from the received audio data
        const audioData = await response.arrayBuffer();
        const audioContext = new AudioContext();
        audioContext.decodeAudioData(audioData, (buffer) => {
            // Create an AudioBufferSourceNode and play the audio
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start();
        });
    }
  }




  template() {
    const { stateName } = this.props;
    const { state } = Globals;
    if (state.hasBeenUpdated(stateName)) {
      this.speak();
    }
    return this.empty;
  }

  // settings() {
  //   console.log("speech settings");
  //   return html`<div class="Speech">
  //     ${this.stateName.input()} ${this.voiceURI.input()} ${this.pitch.input()}
  //     ${this.rate.input()} ${this.volume.input()}
  //   </div>`;
  // }
}
TreeBase.register(Speech, "Speech");

/** @type{SpeechSynthesisVoice[]} */
let voices = [];

/**
 * Promise to return voices
 *
 * @return {Promise<SpeechSynthesisVoice[]>} Available voices
 */
function getVoices() {
  return new Promise(function (resolve) {
    // iOS won't fire the voiceschanged event so we have to poll for them
    function f() {
      voices = (voices.length && voices) || speechSynthesis.getVoices();
      if (voices.length) resolve(voices);
      else setTimeout(f, 100);
    }
    f();
  });
}

class VoiceSelect extends HTMLSelectElement {
  constructor() {
    super();
  }
  connectedCallback() {
    this.addVoices();
  }

  async addVoices() {
    const voices = await getVoices();
    const current = this.getAttribute("value");
    for (const voice of voices) {
      const item = html.node`<option value=${voice.voiceURI} ?selected=${
        voice.voiceURI == current
      }>${voice.name}</option>`;
      this.add(/** @type {HTMLOptionElement} */ (item));
    }
  }
}
customElements.define("select-voice", VoiceSelect, { extends: "select" });
