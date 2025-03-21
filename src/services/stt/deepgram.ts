import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { EventEmitter } from "events";
import { STTEvents, STTService } from "../../types/providers/stt";
import eventBus from "../../engine";

export class DeepgramSTTService implements STTService {
  private deepgramClient: any;
  private connection: any;
  private isInitialized = false;
  private listenerCallback: ((text: string) => void) | null = null;
  private id: string;
  private language: string;
  private model: string;

  constructor(
    id: string,
    language: string = "en-US",
    model: string = "nova-2"
  ) {
    this.id = id;
    this.language = language;
    this.model = model;

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPGRAM_API_KEY is required in environment variables");
    }
    this.deepgramClient = createClient(apiKey);
  }

  onTranscription(listenerCallback: (text: string) => void): void {
    this.listenerCallback = listenerCallback;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.connection = this.deepgramClient.listen.live({
        model: this.model,
        language: this.language === "hi" ? "hi" : "en-US",
        encoding: "mulaw",
        sample_rate: 8000,
        channels: 1,
      });

      this.connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        const transcript = data.channel?.alternatives[0]?.transcript;

        if (transcript && transcript.trim()) {
          if (this.listenerCallback) {
            this.listenerCallback(transcript);
          }

          eventBus.emit("call.speech.detected", {
            ctx: {
              callId: this.id,
            },
            data: { transcription: transcript },
          });

          eventBus.emit("call.transcription.chunk.created", {
            ctx: {
              callId: this.id,
              provider: "deepgram",
              timestamp: Date.now(),
            },
            data: { transcription: transcript },
          });
        }
      });

      this.connection.on(LiveTranscriptionEvents.Error, (error: any) => {
        console.error("Error in Deepgram STT:", error);
      });

      this.connection.on(LiveTranscriptionEvents.Open, () => {
        this.isInitialized = true;
      });

      this.connection.on(LiveTranscriptionEvents.Close, () => {
        this.isInitialized = false;
      });
    } catch (error) {
      throw error;
    }
  }

  async pipe(chunk: string): Promise<void> {
    if (!this.isInitialized || !this.connection) {
      await this.initialize();
    }

    try {
      const audioBuffer = Buffer.from(chunk, "base64");
      this.connection.send(audioBuffer, { binary: true });
    } catch (error) {
      console.error("Error sending audio to Deepgram:", error);
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      try {
        this.connection.finish();
      } catch (error) {
        console.error("Error closing Deepgram connection:", error);
      } finally {
        this.connection = null;
        this.isInitialized = false;
      }
    }
  }
}
