import test from "node:test";
import assert from "node:assert/strict";
import { supportGreetingReply, supportGreetingPrefix, supportMessageIntent, supportAttachmentCorrectionReply, supportAttachmentCategory, supportAccountLookupChoice, supportAiExtractText } from "./index.js";

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

test("private account lookups require contextual consent and respect refusal", () => {
  const permission = [{ sender_role: "ai", content: "Would you like me to check your subscription status securely? I need to access your account information." }];
  for (const message of ["Okay", "OK", "Yes", "Sure", "Go ahead", "Please do", "Proceed"]) {
    assert.equal(supportAccountLookupChoice(message, permission), "accept", message);
    assert.equal(supportMessageIntent(message, permission), "confirm_account_lookup", message);
  }
  for (const message of ["No", "No thanks", "Not now", "Cancel", "I decline"]) {
    assert.equal(supportAccountLookupChoice(message, permission), "decline", message);
    assert.equal(supportMessageIntent(message, permission), "decline_account_lookup", message);
  }
});

test("timeout or unrelated assistant messages do not create account consent", () => {
  const unrelated = [{ sender_role: "ai", content: "Your support session has expired. The AI Assistant is available again." }];
  assert.equal(supportAccountLookupChoice("No", unrelated), "none");
  assert.equal(supportAccountLookupChoice("Okay", unrelated), "none");
  assert.equal(supportMessageIntent("Okay", []), "acknowledgement");
  assert.equal(supportMessageIntent("No", []), "decline");
});

test("account lookup permission is not inferred from unrelated assistant questions", () => {
  const history = [{ sender_role: "ai", content: "Would you like me to explain how Professional Membership works?" }];
  assert.equal(supportAccountLookupChoice("Okay", history), "none");
  assert.equal(supportMessageIntent("Go ahead", history), "general");
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

test("accidental attachment corrections receive a short contextual response", () => {
  const history = [
    { sender_role: "ai", content: "I’ve received your text document and extracted its readable text. It is securely attached and pinned for Admin review." },
    { sender_role: "user", content: "Text document received: application.pdf. Extracted text: ..." }
  ];
  for (const message of ["It was a mistake", "That was a mistake.", "I uploaded it by mistake", "I sent it by mistake", "Wrong file", "Please ignore the document", "It was accidental"]) {
    assert.equal(
      supportAttachmentCorrectionReply(message, history),
      "No problem—I understand the upload was accidental. We can leave that file aside and continue with your original question. What would you like help with?",
      message
    );
  }
});

test("attachment correction does not trigger without an immediately preceding attachment acknowledgement", () => {
  assert.equal(supportAttachmentCorrectionReply("It was a mistake", []), "");
  assert.equal(supportAttachmentCorrectionReply("It was a mistake", [
    { sender_role: "ai", content: "Your membership is active." },
    { sender_role: "user", content: "I paid yesterday." }
  ]), "");
  assert.equal(supportAttachmentCorrectionReply("It was a mistake", [
    { sender_role: "ai", content: "I’ve received your file and pinned it for Admin review." },
    { sender_role: "user", content: "Can you help me with my profile?" }
  ]), "");
  assert.equal(supportAttachmentCorrectionReply("It was a mistake", [
    { sender_role: "ai", content: "I’ve received your text document and pinned it for Admin review." },
    { sender_role: "user", content: "My original question is about membership." }
  ]), "");
});

test("attachments are classified from filename and MIME type", () => {
  assert.equal(supportAttachmentCategory("trade-certificate.pdf", "application/pdf"), "professional_certificate");
  assert.equal(supportAttachmentCategory("payment-receipt.pdf", "application/pdf"), "payment_receipt_or_invoice");
  assert.equal(supportAttachmentCategory("my-screenshot.png", "image/png"), "screenshot");
  assert.equal(supportAttachmentCategory("portfolio.jpg", "image/jpeg"), "image_or_portfolio_photo");
  assert.equal(supportAttachmentCategory("application.pdf", "application/pdf"), "document");
});

test("AI response extraction handles Workers AI and OpenAI-compatible response shapes", () => {
  assert.equal(supportAiExtractText({ response: "Hello there" }), "Hello there");
  assert.equal(supportAiExtractText({ choices: [{ message: { content: "How can I help?" } }] }), "How can I help?");
  assert.equal(supportAiExtractText({ output: [{ content: [{ type: "text", text: "I can assist." }] }] }), "I can assist.");
  assert.equal(supportAiExtractText({ result: { response: "A nested response." } }), "A nested response.");
  assert.equal(supportAiExtractText({ success: false, errors: [{ message: "Inference unavailable" }] }), "");
  assert.equal(supportAiExtractText({ response: "" }), "");
});

test("clear conversation endings are identified and do not become generic thanks", () => {
  for (const message of ["bye", "goodbye", "that's all", "I'm done", "nothing else", "talk later", "see you", "thanks, bye", "I'm fine now", "all done"]) {
    assert.equal(supportMessageIntent(message, []), "chat_ending", message);
  }
  assert.equal(supportMessageIntent("thank you", []), "thanks");
  assert.equal(supportMessageIntent("thanks for explaining the membership", []), "general");
});

test("expanded informal and Nigerian-style greetings are handled deterministically", () => {
  for (const message of ["How far", "How far o!", "What's up", "Wassup", "Good day", "GOOD DAY!", "Hi 👋", "Hello there 😊", "Heyyy"]) {
    assert.notEqual(supportGreetingReply(message, "Ada"), "", message);
  }
  assert.equal(supportGreetingReply("How far", "Ada"), "Hello, Ada. How may I help you today?");
  assert.equal(supportGreetingReply("Good day", "Ada"), "Good day, Ada. How may I help you today?");
  assert.equal(supportGreetingReply("Hi 👋", "Ada"), "Hi, Ada. How may I help you today?");
});

test("expanded greeting prefixes acknowledge openers without replacing the request", () => {
  assert.equal(supportGreetingPrefix("How far, how do I register?", "Ada"), "Hello, Ada.");
  assert.equal(supportGreetingPrefix("What's up! How do I upload photos?", "Ada"), "Hello, Ada.");
  assert.equal(supportGreetingPrefix("Good day, where is Professional Membership?", "Ada"), "Good day, Ada.");
  assert.equal(supportGreetingPrefix("Hi 👋, can you help me?", "Ada"), "Hi, Ada.");
  assert.equal(supportGreetingPrefix("Can you help me register?", "Ada"), "");
});

test("goodbye intent does not override direct Admin requests or account consent", () => {
  const permission = [{ sender_role: "ai", content: "Would you like me to check your membership status securely?" }];
  assert.equal(supportMessageIntent("Yes, please", permission), "confirm_account_lookup");
  assert.equal(supportMessageIntent("I want to talk to a human Admin", []), "human_admin_request");
});
