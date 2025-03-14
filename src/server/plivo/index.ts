import express, { Request, Response } from "express";
import { Server as HttpServer } from "http";
import WebSocket from "ws";
const app = express();
const server = new HttpServer(app);
const wss = new WebSocket.Server({ server });
import operator from "../../services/telephony/plivo/operator";
import Server from "../../types/server";
import ngrok from "ngrok";
import eventBus from "../../events";
import prisma from "../../db/client";
import recordingService from "../../services/recording";
import { setupDirectTransferEndpoint } from './direct-transfer';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add this line near the top of the file after initializing app
setupDirectTransferEndpoint(app);

app.post("/plivo/answer/:callId", (req, res) => {
  const { callId } = req.params;

  try {
    // Check if we have a transfer in progress for this call
    const phoneCall = operator.getPhoneCall(callId).then(phoneCall => {
      const transferNumber = phoneCall.getTransferNumber();
      
      if (transferNumber) {
        console.log(`This is a transfer request for call ${callId} to ${transferNumber}`);
        
        // Generate transfer XML
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Speak>Transferring your call to a human agent. Please hold.</Speak>
            <Dial callbackUrl="${req.protocol}://${req.get('host')}/plivo/transfer-status/${callId}"
                  callbackMethod="POST">${transferNumber}</Dial>
          </Response>`;
          
        console.log(`Generated transfer XML: ${xml}`);
        res.set("Content-Type", "application/xml");
        res.send(xml);
      } else {
        // Regular call, proceed normally
        const xml = operator.generateXml(callId);
        res.set("Content-Type", "application/xml");
        res.send(xml);
      }
    }).catch(error => {
      console.log("Error getting phone call:", error);
      const xml = operator.generateXml(callId);
      res.set("Content-Type", "application/xml");
      res.send(xml);
    });
  } catch (error) {
    console.log("Error generating Plivo XML:", error);
    res.status(404).json({ error: "Invalid call ID" });
  }
});

app.post("/plivo/stream-events/:callId", (req, res) => {
  const { callId } = req.params;
  const event = req.body;

  console.log(`Stream event for call ${callId}:`, event);

  // Handle various stream events (start, stop, etc.)
  if (event.event === "streamStopped") {
    eventBus.emit("call.ended", {
      ctx: { callId },
      data: {
        errorReason: "Stream stopped",
      },
    });
  }

  res.status(200).send();
});

app.post("/plivo/stream-callback/:callId", (req, res) => {
  const { callId } = req.params;

  console.log(`Stream callback for call ${callId}`);

  res.set("Content-Type", "application/xml");
  res.send("<Response></Response>");
});

app.post("/plivo/transfer/:callId", (req, res) => {
  const { callId } = req.params;
  const toNumber = req.query.number || process.env.TRANSFER_PHONE_NUMBER;

  console.log(`Handling transfer for call ${callId} to ${toNumber}`);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Speak>Transferring your call to a human agent. Please hold.</Speak>
      <Record callbackUrl="${req.protocol}://${req.get(
    "host"
  )}/plivo/recording-callback/${callId}" 
              callbackMethod="POST" />
      <Dial recordingCallbackUrl="${req.protocol}://${req.get(
    "host"
  )}/plivo/recording-callback/${callId}"
            recordingCallbackMethod="POST">${toNumber}</Dial>
    </Response>`;

  res.set("Content-Type", "application/xml");
  res.send(xml);
});

app.post("/plivo/recording-callback/:callId", async (req, res) => {
  const { callId } = req.params;
  const recordingUrl = req.body.recording_url || req.body.url;
  const recordingDuration = parseInt(
    req.body.recording_duration || req.body.duration || "0",
    10
  );

  console.log(`Recording complete for call ${callId}: ${recordingUrl}`);

  try {
    // Save the recording URL to your database
    await prisma.recording.upsert({
      where: { callId },
      update: {
        recordingUrl,
        recordingDuration,
      },
      create: {
        callId,
        recordingUrl,
        recordingDuration,
      },
    });

    // Start a new recording session that will capture the human conversation
    recordingService.startRecording(callId);

    res.status(200).send("OK");
  } catch (error) {
    console.error(`Error processing recording for call ${callId}:`, error);
    res.status(500).send("Error processing recording");
  }
});

app.post("/plivo/direct-transfer/:callId", (req, res) => {
  const { callId } = req.params;
  const toNumber = req.query.number || process.env.TRANSFER_PHONE_NUMBER;

  console.log(`Processing direct transfer for call ${callId} to ${toNumber}`);

  // Create a simpler XML with proper Plivo structure
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Speak>Transferring your call to a human agent. Please hold.</Speak>
      <Dial callbackUrl="${req.protocol}://${req.get(
    "host"
  )}/plivo/transfer-status/${callId}"
            callbackMethod="POST"
            action="${req.protocol}://${req.get(
    "host"
  )}/plivo/transfer-status/${callId}"
            method="POST"
            redirect="true">${toNumber}</Dial>
    </Response>`