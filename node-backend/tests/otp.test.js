// import { beforeEach, describe, it, expect, vi } from "vitest";
// import request from "supertest";
// import express from "express";
// import dotenv from "dotenv";
// import router from "../routing/auth";
// import { signup, login } from "../auth/authService";
// import { sendOtpEmail } from "../utils/mailer";
// import Otp from "../database/models/userotp";
// import User from "../database/models/user";
// dotenv.config();

import { beforeEach, describe, it, expect, vi } from "vitest";
import request from "supertest";
import express from "express";
import dotenv from "dotenv";
import router from "../routing/auth";
import { signup, login } from "../auth/authService";
import { sendOtpEmail } from "../utils/mailer";
import Otp from "../database/models/userotp";
import User from "../database/models/user";
dotenv.config();

// Mock dependencies before importing router
vi.mock("../auth/authService", () => ({
  signup: vi.fn(),
  login: vi.fn()
}));
vi.mock("../utils/mailer", () => ({ sendOtpEmail: vi.fn() }));
vi.mock("../database/models/userotp", () => ({
  create: vi.fn(),
  findOne: vi.fn(),
  deleteOne: vi.fn(),
  deleteMany: vi.fn(),
  countDocuments: vi.fn()
}));
vi.mock("../database/models/user", () => ({
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn()
}));



let app;
beforeEach(() => {
  vi.clearAllMocks();
  app = express();
  app.use(express.json());
  app.use("/", router);
});

describe("OTP flows", () => {
  it("signup: creates OTP with expiry and sends email", async () => {
    signup.mockResolvedValueOnce({ email: "user@example.com" });
    Otp.create.mockResolvedValueOnce({ _id: "otp1" });
    sendOtpEmail.mockResolvedValueOnce();

    const res = await request(app).post("/signup").send({ email: "user@example.com", password: "pass" });
    expect(res.status).toBe(201);
    expect(res.body.message).toContain("registered");

    expect(Otp.create).toHaveBeenCalledWith(expect.objectContaining({
      email: "user@example.com",
      otp: expect.any(String),
      createdAt: expect.any(Date),
      expiresAt: expect.any(Date)
    }));
    expect(sendOtpEmail).toHaveBeenCalledWith("user@example.com", expect.any(String));
  });

  it("verify-otp: succeeds with valid non-expired otp and removes all otps", async () => {
    const future = new Date(Date.now() + 10000);
    Otp.findOne.mockResolvedValueOnce({ _id: "otp1", email: "user@example.com", expiresAt: future });
    User.findOneAndUpdate.mockResolvedValueOnce({ nModified: 1 });
    Otp.deleteMany.mockResolvedValueOnce();

    const res = await request(app).post("/verify-otp").send({ email: "user@example.com", otp: "123456" });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("verified");

    expect(User.findOneAndUpdate).toHaveBeenCalledWith({ email: "user@example.com" }, { isVerified: true });
    expect(Otp.deleteMany).toHaveBeenCalledWith({ email: "user@example.com" });
  });

  it("verify-otp: fails when otp not found or expired", async () => {
    Otp.findOne.mockResolvedValueOnce(null);
    const res = await request(app).post("/verify-otp").send({ email: "user@example.com", otp: "000000" });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid or expired OTP");
  });

  it("resend-otp: respects cooldown and returns 429", async () => {
    User.findOne.mockResolvedValueOnce({ email: "user@example.com", isVerified: false });
    const recent = { createdAt: new Date() }; // right now => within cooldown
    Otp.findOne.mockResolvedValueOnce(recent);

    const res = await request(app).post("/resend-otp").send({ email: "user@example.com" });
    expect(res.status).toBe(429);
    expect(res.body.message).toContain("Please wait");
  });

  it("resend-otp: creates new OTP and sends email; cleans up on send failure", async () => {
    User.findOne.mockResolvedValueOnce({ email: "user@example.com", isVerified: false });
    Otp.findOne.mockResolvedValueOnce(null);
    Otp.countDocuments.mockResolvedValueOnce(0);

    // Successful send
    Otp.create.mockResolvedValueOnce({ _id: "new1" });
    sendOtpEmail.mockResolvedValueOnce();
    const resOk = await request(app).post("/resend-otp").send({ email: "user@example.com" });
    expect(resOk.status).toBe(200);
    expect(sendOtpEmail).toHaveBeenCalled();

    // Failed send cleans up created record
    Otp.create.mockResolvedValueOnce({ _id: "new2" });
    sendOtpEmail.mockRejectedValueOnce(new Error("SMTP down"));
    const resFail = await request(app).post("/resend-otp").send({ email: "user@example.com" });
    expect(resFail.status).toBe(500);
    expect(Otp.deleteOne).toHaveBeenCalledWith({ _id: "new2" });
  });
});
