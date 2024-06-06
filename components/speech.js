import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { TreeBase } from "./treebase";
import { html } from "uhtml";
import Globals from "app/globals";
import * as Props from "./props"; // Correct import

class Speech extends TreeBase {
  stateName = new Props.String("$Speak");
  voiceURI = new Props.Voice("$VoiceURI", "en-US-DavisNeural"); // Default to Davis
  expressStyle = new Props.String("$ExpressStyle", "friendly"); // Default expression style
  isSpeaking = false; // Track if currently speaking

  constructor() {
    super();
    this.initSynthesizer();
  }

  initSynthesizer() {
    this.speechConfig = sdk.SpeechConfig.fromSubscription('e06a1f5edcf44606b837605cdc1cc79a', 'eastus');
    this.speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3; // Using MP3 format with appropriate bitrate
    this.audioConfig = sdk.AudioConfig.fromDefaultSpeakerOutput();
    this.synthesizer = new sdk.SpeechSynthesizer(this.speechConfig, this.audioConfig);

    // Adding logging for debug purposes
    this.synthesizer.synthesisStarted = (s, e) => console.log("Synthesis started");
    this.synthesizer.synthesisCompleted = (s, e) => {
      console.log("Synthesis completed");
      this.isSpeaking = false; // Reset speaking flag
    };
    this.synthesizer.synthesisCanceled = (s, e) => {
      console.error("Synthesis canceled", e);
      this.isSpeaking = false; // Reset speaking flag
    };
  }

  async speak() {
    if (this.isSpeaking) {
      console.log("Stopping previous synthesis");
      await this.stopSynthesis();
      this.startSynthesis();
    } else {
      this.startSynthesis();
    }
  }

  async stopSynthesis() {
    return new Promise((resolve, reject) => {
      this.synthesizer.stopSpeakingAsync(() => {
        console.log("Previous synthesis stopped");
        this.isSpeaking = false;
        resolve();
      }, error => {
        console.error("Error stopping synthesis", error);
        this.isSpeaking = false;
        resolve(); // Resolve even if there's an error to allow new synthesis to start
      });
    });
  }

  startSynthesis() {
    if (this.isSpeaking) return; // Ensure no overlapping synthesis

    this.isSpeaking = true;

    const { state } = Globals;
    const message = state.get("$Speak");
    const voice = state.get("$VoiceURI") || "en-US-DavisNeural"; // Default to "en-US-DavisNeural"
    const style = state.get("$ExpressStyle") || "friendly";

    console.log("Using voice:", voice); // Debugging log

    const ssml = `
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
      <voice name="${voice}">
        <mstts:express-as style="${style}">
          ${message}
        </mstts:express-as>
      </voice>
    </speak>`;

    this.synthesizer.speakSsmlAsync(
      ssml,
      result => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          console.log("Speech synthesized successfully");
          this.isSpeaking = false; // Reset speaking flag
        } else if (result.reason === sdk.ResultReason.Canceled) {
          const cancellationDetails = sdk.SpeechSynthesisCancellationDetails.fromResult(result);
          console.error("Speech synthesis canceled:", cancellationDetails.reason, cancellationDetails.errorDetails);
          this.isSpeaking = false; // Reset speaking flag
        }
      },
      error => {
        console.error("An error occurred:", error);
        this.isSpeaking = false; // Reset speaking flag
      }
    );
  }

  disconnectedCallback() {
    if (this.isSpeaking) {
      this.synthesizer.stopSpeakingAsync(() => {
        console.log("Synthesizer stopped on component disconnect");
        this.isSpeaking = false;
      }, error => {
        console.error("Error stopping synthesizer on component disconnect", error);
        this.isSpeaking = false;
      });
    }
    this.synthesizer.close();
  }

  template() {
    const { stateName, voiceURI } = this.props; // Removed expressStyle from here
    const { state } = Globals;
    if (state.hasBeenUpdated(stateName) || state.hasBeenUpdated(voiceURI)) {
      this.speak();
    }
    return this.empty;
  }
}

TreeBase.register(Speech, "Speech");


