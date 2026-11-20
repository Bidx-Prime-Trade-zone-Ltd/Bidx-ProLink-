import test from "node:test";
import assert from "node:assert/strict";
import { supportGreetingReply, supportGreetingPrefix, supportMessageIntent, supportAttachmentCategory } from "./index.js";

test("greeting replies match the user's exact greeting and include their first name", () => {
  assert.equal(supportGreetingReply("Good morning", "Ada"), "Good morning, Ada. How may I help you today?");
  assert.equal(supportGreetingReply("GOOD AFTERNOON!", "Ada"), "Good afternoon, Ada. How may I help you today?");
  assert.equal(supportGreetingReply("Good evening", "Ada"), "Good evening, Ada. How may I help you today?");
  assert.equal(supportGreetingReply("Hiiii", "Ada"), "Hi, Ada. How may I help you today?");
  assert.equal(supportGreetingReply("Hii", "Ada"), "Hi, Ada. How may I help you today?");
  assert.equal(supportGreetingReply("Hello there", "Ada"), "Hello, Ada. How may I help you today?");
});

test("ProLink does not greet when the message is not a greeting by itself", () => {
  assert.equal(supportGreetingReply("Can you tell me about this app?", "Ada"), "");
  assert.equal(supportGreetingReply("Hi, can you help me register?", "Ada"), "");
  assert.equal(supportGreetingReply("Thank you", "Ada"), "");
});

test("greetings followed by questions are preserved without replacing the question", () => {
  assert.equal(supportGreetingPrefix("Good morning, can you explain ProLink?", "Ada"), "Good morning, Ada.");
  assert.equal(supportGreetingPrefix("Hi, how do I register?", "Ada"), "Hi, Ada.");
  assert.equal(supportGreetingPrefix("Can you explain ProLink?", "Ada"), "");
});

test("contextual confirmation accepts an offered Admin handover", () => {
  const history = [{ sender_role: "ai", content: "I can send a handover request to a human Admin for you." }];
  assert.equal(supportMessageIntent("Okay", history), "confirm_human_admin");
  assert.equal(supportMessageIntent("Go ahead", history), "confirm_human_admin");
  assert.equal(supportMessageIntent("Okay, please do.", history), "confirm_human_admin");
  assert.equal(supportMessageIntent("Okay, go ahead.", history), "confirm_human_admin");
  assert.equal(supportMessageIntent("Sounds good, proceed.", history), "confirm_human_admin");
});

test("direct Admin requests and refusals are distinguished", () => {
  assert.equal(supportMessageIntent("I want to talk to Admin", []), "human_admin_request");
  assert.equal(supportMessageIntent("Can you connect me to a human Admin?", []), "human_admin_request");
  assert.equal(supportMessageIntent("No, don't connect me to Admin", []), "decline");
});

test("standalone acknowledgements are not treated as blanket permission", () => {
  assert.equal(supportMessageIntent("Okay", []), "acknowledgement");
  assert.equal(supportMessageIntent("Thank you", []), "thanks");
});

test("attachments are classified from filename and MIME type", () => {
  assert.equal(supportAttachmentCategory("trade-certificate.pdf", "application/pdf"), "professional_certificate");
  assert.equal(supportAttachmentCategory("payment-receipt.pdf", "application/pdf"), "payment_receipt_or_invoice");
  assert.equal(supportAttachmentCategory("my-screenshot.png", "image/png"), "screenshot");
  assert.equal(supportAttachmentCategory("portfolio.jpg", "image/jpeg"), "image_or_portfolio_photo");
  assert.equal(supportAttachmentCategory("application.pdf", "application/pdf"), "document");
});
