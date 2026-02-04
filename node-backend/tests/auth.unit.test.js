// services/__tests__/auth.service.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  signupUser,
  verifyOtp,
  resendOtp,
  loginUser
} from "../auth/authService";

/* ------------------ mocks ------------------ */

const mockDb = {
  checkUserExistsByEmail: vi.fn(),
  createUser: vi.fn(),
  createOtp: vi.fn(),
  deleteOtpById: vi.fn(),
  deleteOtpsByEmail: vi.fn(),
  findValidOtp: vi.fn(),
  markUserVerifiedByEmail: vi.fn(),
  findUserByEmail: vi.fn(),
  findLatestOtpByEmail: vi.fn(),
  countOtpsSince: vi.fn()
};

const mockMailer = {
  sendWithRetries: vi.fn()
};

const deps = {
  db: mockDb,
  mailer: mockMailer
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("signupUser", () => {
  it("creates user, generates OTP and sends email", async () => {
    mockDb.checkUserExistsByEmail.mockResolvedValue(false);
    mockDb.createUser.mockResolvedValue({ email: "test@test.com" });
    mockDb.createOtp.mockResolvedValue({ _id: "otp1" });
    mockMailer.sendWithRetries.mockResolvedValue();

    const result = await signupUser(
      { name: "Test", email: "test@test.com", password: "123456" },
      deps
    );

    expect(result).toEqual({ ok: true, email: "test@test.com" });
    expect(mockDb.createOtp).toHaveBeenCalled();
    expect(mockMailer.sendWithRetries).toHaveBeenCalledWith(
      "test@test.com",
      expect.any(String)
    );
  });

    it("returns USER_EXISTS if email already registered", async () => {
    mockDb.checkUserExistsByEmail.mockResolvedValue(true);

    const result = await signupUser(
      { name: "Test", email: "test@test.com", password: "123456" },
      deps
    );

    expect(result).toEqual({ ok: false, reason: "USER_EXISTS" });
    expect(mockDb.createUser).not.toHaveBeenCalled();
  });

    it("rolls back OTP if email sending fails", async () => {
    mockDb.checkUserExistsByEmail.mockResolvedValue(false);
    mockDb.createUser.mockResolvedValue({ email: "test@test.com" });
    mockDb.createOtp.mockResolvedValue({ _id: "otp123" });
    mockMailer.sendWithRetries.mockRejectedValue(new Error("SMTP down"));

    const result = await signupUser(
      { name: "Test", email: "test@test.com", password: "123456" },
      deps
    );

    expect(result).toEqual({ ok: false, reason: "EMAIL_FAILED" });
    expect(mockDb.deleteOtpById).toHaveBeenCalledWith("otp123");
  });
});

describe("verifyOtp", () => {
  it("verifies OTP and marks user verified", async () => {
    mockDb.findValidOtp.mockResolvedValue({ email: "test@test.com" });

    const result = await verifyOtp(
      { email: "test@test.com", otp: "123456" },
      deps
    );

    expect(result).toEqual({ ok: true });
    expect(mockDb.markUserVerifiedByEmail).toHaveBeenCalledWith("test@test.com");
    expect(mockDb.deleteOtpsByEmail).toHaveBeenCalledWith("test@test.com");
  });

  it("rejects invalid or expired OTP", async () => {
    mockDb.findValidOtp.mockResolvedValue(null);

    const result = await verifyOtp(
      { email: "test@test.com", otp: "000000" },
      deps
    );

    expect(result).toEqual({ ok: false, reason: "INVALID_OTP" });
  });
});
describe("resendOtp", () => {
  it("blocks resend during cooldown", async () => {
    mockDb.findUserByEmail.mockResolvedValue({ email: "test@test.com" });
    mockDb.findLatestOtpByEmail.mockResolvedValue({
      createdAt: new Date()
    });

    const result = await resendOtp(
      { email: "test@test.com" },
      deps
    );

    expect(result).toEqual({ ok: false, reason: "COOLDOWN" });
  });
  it("blocks resend after daily limit", async () => {
    mockDb.findUserByEmail.mockResolvedValue({ email: "test@test.com" });
    mockDb.findLatestOtpByEmail.mockResolvedValue(null);
    mockDb.countOtpsSince.mockResolvedValue(5);

    const result = await resendOtp(
      { email: "test@test.com" },
      deps
    );

    expect(result).toEqual({ ok: false, reason: "DAILY_LIMIT" });
  });
  it("resends OTP successfully", async () => {
    mockDb.findUserByEmail.mockResolvedValue({ email: "test@test.com" });
    mockDb.findLatestOtpByEmail.mockResolvedValue(null);
    mockDb.countOtpsSince.mockResolvedValue(0);
    mockDb.createOtp.mockResolvedValue({ _id: "otp2" });
    mockMailer.sendWithRetries.mockResolvedValue();

    const result = await resendOtp(
      { email: "test@test.com" },
      deps
    );

    expect(result).toEqual({ ok: true });
    expect(mockMailer.sendWithRetries).toHaveBeenCalled();
  });
});
