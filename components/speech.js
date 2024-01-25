import { strip } from "./display";
import { TreeBase } from "./treebase";
import { html } from "uhtml";
import Globals from "app/globals";
import * as Props from "./props";

class Speech extends TreeBase {
  stateName = new Props.String("$Speak");
  voiceURI = new Props.Voice("", { label: "Voice" });
  Speaker1 = new Props.Float(1);
  Speaker2 = new Props.Float(1);
  pitch = new Props.Float(1);
  rate = new Props.Float(1);
  volume = new Props.Float(1);

  async speak() {
    const { state } = Globals;
    const { stateName, Speaker1, Speaker2, pitch, rate, volume } = this.props;
    const message = strip(state.get(stateName));
    console.log(this.props.stateName); // Check if stateName has the expected value
    console.log(this.props.Speaker1);  // Check if Speaker1 has the expected value
    // Repeat for other properties


    const payload = {
      text: message,
      Speaker1: Speaker1, // Access the value of Speaker1 property
      Speaker2: Speaker2, // Access the value of Speaker2 property
      pitch: pitch, // Access the value of pitch property
      rate: rate, // Access the value of rate property
      volume: volume, 
    };
  
    console.log("Sending payload:", payload);

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
