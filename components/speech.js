import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { TreeBase } from "./treebase";
import { html } from "uhtml";
import Globals from "app/globals";
import * as Props from "./props"; // Correct import

class Speech extends TreeBase {
  stateName = new Props.String("$Speak");
  voiceURI = new Props.String("$VoiceURI", "en-US-DavisNeural"); // Default to Davis
  expressStyle = new Props.String("$ExpressStyle", "friendly"); // Default expression style
  isSpeaking = false; // Track if currently speaking

  constructor() {
    super();
    this.initSynthesizer();
  }

  initSynthesizer() {
    this.speechConfig = sdk.SpeechConfig.fromSubscription('c7d8e36fdf414cbaae05819919fd416d', 'eastus');
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
    return new Promise((resolve) => {
      this.synthesizer.close();
      this.isSpeaking = false;
      this.initSynthesizer(); // Reinitialize the synthesizer
      console.log("Previous synthesis stopped");
      resolve();
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
      this.synthesizer.close();
      this.isSpeaking = false;
      console.log("Synthesizer stopped on component disconnect");
    }
  }

  template() {
    const { stateName } = this.props; // Only check for stateName
    const { state } = Globals;
    if (state.hasBeenUpdated(stateName)) {
      this.speak();
    }
    return this.empty;
  }
}

TreeBase.register(Speech, "Speech");


