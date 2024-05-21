
import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { strip } from "./display";
import { TreeBase } from "./treebase";
import { html } from "uhtml";
import Globals from "app/globals";
import * as Props from "./props";

class Speech extends TreeBase {
  stateName = new Props.String("$Speak");
  voiceURI = new Props.Voice("$VoiceURI", "en-US-GuyNeural"); // Default to Guy
  expressStyle = new Props.String("$ExpressStyle", "friendly"); // Default expression style

  constructor() {
    super();
    this.speechConfig = sdk.SpeechConfig.fromSubscription('25d626bb957d4ae0801f224ed52e04dd', 'eastus');
    this.speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3; // Using MP3 format with appropriate bitrate
    this.audioConfig = sdk.AudioConfig.fromDefaultSpeakerOutput();
    this.synthesizer = new sdk.SpeechSynthesizer(this.speechConfig, this.audioConfig);

    // Adding logging for debug purposes
    this.synthesizer.synthesisStarted = (s, e) => console.log("Synthesis started");
    this.synthesizer.synthesisCompleted = (s, e) => console.log("Synthesis completed");
    this.synthesizer.synthesisCanceled = (s, e) => console.error("Synthesis canceled", e);
  }

  async speak() {
    const { state } = Globals;
    const message = state.get("$Speak");
    const voice = state.get("$VoiceURI") || "en-US-GuyNeural"; // Default to "en-US-GuyNeural" if no voice is set
    const style = state.get("$ExpressStyle") || "friendly";

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
        } else if (result.reason === sdk.ResultReason.Canceled) {
          const cancellationDetails = sdk.SpeechSynthesisCancellationDetails.fromResult(result);
          console.error("Speech synthesis canceled:", cancellationDetails.reason, cancellationDetails.errorDetails);
        }
      },
      error => {
        console.error("An error occurred:", error);
      }
    );
  }

  template() {
    const { stateName } = this.props;
    const { state } = Globals;
    if (state.hasBeenUpdated(stateName)) {
      this.speak();
    }
    return this.empty;
  }
}

TreeBase.register(Speech, "Speech");

