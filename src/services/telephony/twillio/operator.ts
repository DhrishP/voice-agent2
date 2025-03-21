import twilio from "twilio";
import { v4 as uuidv4 } from "uuid";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
import TwilioProvider from "./provider";

export class Operator {
  private activeCallIds: Set<string> = new Set();
  private twilioClient: twilio.Twilio;
  private callIdToPhoneCall: Map<string, TwilioProvider> = new Map();
  private baseUrl: string;

  constructor() {
    this.baseUrl = "";
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error(
        "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables are required"
      );
    }

    this.twilioClient = twilio(accountSid, authToken);
  }

  public async call(
    id: string,
    fromNumber: string,
    toNumber: string
  ): Promise<string> {
    const callId = id;

    try {
      const call = await this.twilioClient.calls.create({
        from: fromNumber,
        to: toNumber,
        url: `${this.baseUrl}/twiml/${callId}`,
      });

      this.activeCallIds.add(callId);
      const phoneCall = new TwilioProvider(callId);

      phoneCall.setCallSid(call.sid);

      this.callIdToPhoneCall.set(callId, phoneCall);

      console.log(`Call initiated with ID: ${callId}, Twilio SID: ${call.sid}`);
      return callId;
    } catch (error: any) {
      throw new Error(`Failed to initiate Twilio call: ${error.message}`);
    }
  }

  public generateTwiml(baseWsUrl: string, callId: string): string {
    if (!this.activeCallIds.has(callId)) {
      throw new Error("Invalid call ID");
    }

    const twiml = new VoiceResponse();
    twiml.connect().stream({
      url: `${baseWsUrl}/${callId}`,
    });

    return twiml.toString();
  }

  public async hangup(callId: string): Promise<void> {
    if (!this.activeCallIds.has(callId)) {
      throw new Error("Invalid call ID");
    }
    this.activeCallIds.delete(callId);
  }

  public async setWsObject(callId: string, wsObject: any): Promise<void> {
    if (!this.callIdToPhoneCall.has(callId)) {
      throw new Error("Invalid call ID");
    }
    this.callIdToPhoneCall.get(callId)?.setWsObject(wsObject);
  }

  public async getPhoneCall(callId: string): Promise<TwilioProvider> {
    const phoneCall = this.callIdToPhoneCall.get(callId);
    if (!phoneCall) {
      throw new Error("Invalid call ID");
    }
    return phoneCall;
  }

  public async getBaseUrl(): Promise<string> {
    return this.baseUrl;
  }

  public async setBaseUrl(baseUrl: string): Promise<void> {
    this.baseUrl = baseUrl;
  }

  public async transfer(callId: string, toNumber: string): Promise<void> {
    try {
      if (!this.activeCallIds.has(callId)) {
        throw new Error(`No active call found for ID ${callId}`);
      }

      const phoneCall = await this.getPhoneCall(callId);
      const callSid = phoneCall.getCallSid();

      if (!callSid) {
        throw new Error(`No call SID found for ID ${callId}`);
      }

      // Create TwiML for transfer
      const twiml = new VoiceResponse();
      twiml.say("Transferring your call to a human agent. Please hold.");
      twiml.dial({}, toNumber);

      // Update the call with new TwiML
      await this.twilioClient.calls(callSid).update({
        twiml: twiml.toString(),
      });

      console.log(`✅ Call ${callId} transferred to ${toNumber}`);
    } catch (error) {
      console.error(`❌ Error transferring call ${callId}:`, error);
      throw error;
    }
  }
}

const operator = new Operator();

export default operator;
