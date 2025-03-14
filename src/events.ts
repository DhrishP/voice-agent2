import { EventBus, EventMap } from "./lib/EventBus";
import { VoiceCallJobData } from "./types";

interface AppEvents extends EventMap {
  "call.initiated": {
    ctx: { provider: string; callId: string; timestamp: number };
    payload: VoiceCallJobData;
  };

  "call.audio.chunk.received": {
    ctx: { provider: string; callId: string; timestamp: number };
    data: {
      chunk: string;
      direction: "inbound" | "outbound";
    };
  };

  "call.transcription.chunk.created": {
    ctx: { provider: string; callId: string; timestamp: number };
    data: {
      transcription: string;
    };
  };

  "call.response.chunk.generated": {
    ctx: { provider: string; callId: string; timestamp: number };
    data: {
      text: string;
    };
  };

  "call.audio.chunk.synthesized": {
    ctx: { provider: string; callId: string; timestamp: number };
    data: {
      chunk: Buffer | string;
    };
  };

  "call.hangup.requested": {
    ctx: { callId: string };
    data: {
      reason: string;
    };
    provider: string;
  };

  "call.ended": {
    ctx: { callId: string };
    data: any;
  };

  "call.error": {
    ctx: { callId: string };
    error: Error;
  };

  "call.recording.saved": {
    ctx: { callId: string };
    data: {
      url: string;
      durationSec: number;
      localFilePath: string;
    };
  };

  "call.transfer.requested": {
    ctx: { callId: string };
    data: {
      reason: string;
      transferNumber: string;
    };
    provider: string;
  };

  "call.speech.detected": {
    ctx: { callId: string };
    data: {
      transcription: string;
    };
  };
}

const eventBus = EventBus.getInstance<AppEvents>();

export default eventBus;
