import express from "express";
import expressWs from "express-ws";

import cors from "cors";
import morgan from "morgan";
import Server from "../../types/server";
import { Job } from "bullmq";
import { QUEUE_NAMES } from "../../config/worker";
import { queue } from "../worker";

const app = expressWs(express()).app;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(
  morgan(":method :url :status :response-time ms - :res[content-length]")
);

// Basic error handling
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.get("/test", (req, res) => {
  queue.add(QUEUE_NAMES.VOICE_CALL, {
    fromNumber: "+16692312259",
    toNumber: "+13025222900",
    prompt:
      "Hello! This is a test call from our voice agent. Please say something, and I will respond.",
    telephonyProvider: "twilio",
  });
  res.send("Call initiated");
});

class Api extends Server {
  public async start(): Promise<void> {
    app.listen(this.port, () => {
      console.log(`API is running on port ${this.port}`);
    });
    this.instance = app;
    this.url = `${process.env.HOST_URL}:${this.port}`;
  }

  public async stop(): Promise<void> {
    this.instance.close();
  }
}

export default Api;
