const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");
const dotenv = require("dotenv");
const fs = require("fs");
const { GoogleGenAI } = require("@google/genai");

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 5000;

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify"
];

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:5000/auth/google/callback"
);

// Load saved Gmail token if it exists
if (fs.existsSync("token.json")) {
  const token = JSON.parse(fs.readFileSync("token.json"));
  oauth2Client.setCredentials(token);
}

// --------------------------------------------------
// HOME
// --------------------------------------------------

app.get("/", (req, res) => {
  res.send("Nebula Mail Backend is running!");
});

// --------------------------------------------------
// GOOGLE LOGIN
// --------------------------------------------------

app.get("/auth/google", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES
  });

  res.redirect(authUrl);
});

// --------------------------------------------------
// GOOGLE OAUTH CALLBACK
// --------------------------------------------------

app.get("/auth/google/callback", async (req, res) => {
  try {
    const { code } = req.query;

    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    fs.writeFileSync(
      "token.json",
      JSON.stringify(tokens, null, 2)
    );

    res.send(`
      <h1>Gmail connected successfully! 🎉</h1>
      <p>You can close this tab and return to Nebula Mail.</p>
    `);
  } catch (error) {
    console.error("Google authentication error:", error);

    res.status(500).send(
      "Google authentication failed."
    );
  }
});

// --------------------------------------------------
// GET INBOX EMAILS
// --------------------------------------------------

app.get("/api/emails", async (req, res) => {
  try {
    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client
    });

    const response = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX"],
      maxResults: 20
    });

    const messages = response.data.messages || [];

    const emails = [];

    for (const message of messages) {
      const email = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
        format: "metadata",
        metadataHeaders: [
          "From",
          "To",
          "Subject",
          "Date"
        ]
      });

      const headers = email.data.payload.headers || [];

      const getHeader = (name) => {
        const header = headers.find(
          (h) =>
            h.name.toLowerCase() === name.toLowerCase()
        );

        return header ? header.value : "";
      };

      emails.push({
        id: message.id,
        from: getHeader("From"),
        to: getHeader("To"),
        subject: getHeader("Subject"),
        date: getHeader("Date"),
        snippet: email.data.snippet,
        isUnread:
          email.data.labelIds?.includes("UNREAD") || false
      });
    }

    res.json(emails);

  } catch (error) {
    console.error("Inbox error:", error);

    res.status(500).json({
      error: "Could not load Gmail messages."
    });
  }
});

// --------------------------------------------------
// FILTER / SEARCH EMAILS
// --------------------------------------------------

app.get("/api/filter-emails", async (req, res) => {
  try {
    const {
      folder = "inbox",
      filterType,
      startDate,
      endDate,
      searchQuery
    } = req.query;

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client
    });

    let q = "";

    // -----------------------------
    // DATE FILTER
    // -----------------------------

    if (filterType === "date") {
      if (!startDate || !endDate) {
        return res.status(400).json({
          error:
            "Start date and end date are required."
        });
      }

      const start = new Date(
        `${startDate}T00:00:00`
      );

      const end = new Date(
        `${endDate}T00:00:00`
      );

      // Include the complete end date
      end.setDate(end.getDate() + 1);

      const formatDate = (date) => {
        return `${date.getFullYear()}/${String(
          date.getMonth() + 1
        ).padStart(2, "0")}/${String(
          date.getDate()
        ).padStart(2, "0")}`;
      };

      q = `after:${formatDate(start)} before:${formatDate(end)}`;
    }

    // -----------------------------
    // UNREAD
    // -----------------------------

    if (filterType === "unread") {
      q = "is:unread";
    }

    // -----------------------------
    // READ
    // -----------------------------

    if (filterType === "read") {
      q = "is:read";
    }

    // -----------------------------
    // SEARCH / SENDER
    // -----------------------------

    if (
      filterType === "sender" ||
      filterType === "keyword" ||
      filterType === "search"
    ) {
      if (!searchQuery) {
        return res.status(400).json({
          error: "Search query is required."
        });
      }

      if (filterType === "sender") {
        q = `from:${searchQuery}`;
      } else {
        q = searchQuery;
      }
    }

    const label =
      folder === "sent"
        ? "SENT"
        : "INBOX";

    const response =
      await gmail.users.messages.list({
        userId: "me",
        labelIds: [label],
        q: q,
        maxResults: 50
      });

    const messages =
      response.data.messages || [];

    const emails = [];

    for (const message of messages) {
      const email =
        await gmail.users.messages.get({
          userId: "me",
          id: message.id,
          format: "metadata",
          metadataHeaders: [
            "From",
            "To",
            "Subject",
            "Date"
          ]
        });

      const headers =
        email.data.payload.headers || [];

      const getHeader = (name) => {
        const header = headers.find(
          (h) =>
            h.name.toLowerCase() ===
            name.toLowerCase()
        );

        return header ? header.value : "";
      };

      emails.push({
        id: message.id,
        from: getHeader("From"),
        to: getHeader("To"),
        subject: getHeader("Subject"),
        date: getHeader("Date"),
        snippet: email.data.snippet,
        isUnread:
          email.data.labelIds?.includes(
            "UNREAD"
          ) || false
      });
    }

    res.json(emails);

  } catch (error) {
    console.error(
      "Filter emails error:",
      error
    );

    res.status(500).json({
      error:
        "Could not filter Gmail messages."
    });
  }
});

// --------------------------------------------------
// GET FULL EMAIL
// --------------------------------------------------

app.get("/api/emails/:id", async (req, res) => {
  try {
    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client
    });

    const result =
      await gmail.users.messages.get({
        userId: "me",
        id: req.params.id,
        format: "full"
      });

    const message = result.data;

    const headers =
      message.payload.headers || [];

    const getHeader = (name) => {
      const header = headers.find(
        (h) =>
          h.name.toLowerCase() ===
          name.toLowerCase()
      );

      return header ? header.value : "";
    };

    // -----------------------------
    // DECODE GMAIL BODY
    // -----------------------------

    const decodeBody = (data) => {
      if (!data) return "";

      return Buffer.from(
        data
          .replace(/-/g, "+")
          .replace(/_/g, "/"),
        "base64"
      ).toString("utf-8");
    };

    // -----------------------------
    // CLEAN HTML
    // -----------------------------

    const cleanHtml = (html) => {
      return html
        .replace(
          /<style[\s\S]*?<\/style>/gi,
          ""
        )
        .replace(
          /<script[\s\S]*?<\/script>/gi,
          ""
        )
        .replace(
          /<br\s*\/?>/gi,
          "\n"
        )
        .replace(
          /<\/p>/gi,
          "\n"
        )
        .replace(
          /<div[^>]*>/gi,
          "\n"
        )
        .replace(
          /<\/div>/gi,
          ""
        )
        .replace(
          /<[^>]*>/g,
          ""
        )
        .replace(
          /&nbsp;/gi,
          " "
        )
        .replace(
          /&amp;/gi,
          "&"
        )
        .replace(
          /&lt;/gi,
          "<"
        )
        .replace(
          /&gt;/gi,
          ">"
        )
        .trim();
    };

    // -----------------------------
    // FIND EMAIL BODY
    // -----------------------------

    const findBody = (part) => {
      if (!part) return "";

      // Prefer HTML
      if (
        part.mimeType === "text/html" &&
        part.body &&
        part.body.data
      ) {
        return cleanHtml(
          decodeBody(part.body.data)
        );
      }

      // Check child parts
      if (
        part.parts &&
        part.parts.length > 0
      ) {
        // First search for HTML
        for (const child of part.parts) {
          if (
            child.mimeType ===
              "text/html" &&
            child.body &&
            child.body.data
          ) {
            return cleanHtml(
              decodeBody(
                child.body.data
              )
            );
          }
        }

        // Then recursively search
        for (const child of part.parts) {
          const body = findBody(child);

          if (body) {
            return body;
          }
        }
      }

      // Plain text
      if (
        part.mimeType === "text/plain" &&
        part.body &&
        part.body.data
      ) {
        return decodeBody(
          part.body.data
        );
      }

      return "";
    };

    const body =
      findBody(message.payload);

    res.json({
      id: message.id,
      from: getHeader("From"),
      to: getHeader("To"),
      subject: getHeader("Subject"),
      date: getHeader("Date"),
      body:
        body ||
        message.snippet ||
        ""
    });

  } catch (error) {
    console.error(
      "Get email error:",
      error
    );

    res.status(500).json({
      error:
        "Could not load the full email."
    });
  }
});

// --------------------------------------------------
// SEND EMAIL
// --------------------------------------------------

app.post("/api/send", async (req, res) => {
  try {
    const {
      to,
      subject,
      body
    } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({
        error:
          "To, subject and body are required."
      });
    }

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client
    });

    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      body
    ].join("\r\n");

    const encodedMessage =
      Buffer.from(message)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    const response =
      await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedMessage
        }
      });

    res.json({
      success: true,
      messageId: response.data.id
    });

  } catch (error) {
    console.error(
      "Send email error:",
      error
    );

    res.status(500).json({
      error: "Could not send email."
    });
  }
});

// --------------------------------------------------
// GET SENT EMAILS
// --------------------------------------------------

app.get("/api/sent", async (req, res) => {
  try {
    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client
    });

    const response =
      await gmail.users.messages.list({
        userId: "me",
        labelIds: ["SENT"],
        maxResults: 20
      });

    const messages =
      response.data.messages || [];

    const emails = [];

    for (const message of messages) {
      const email =
        await gmail.users.messages.get({
          userId: "me",
          id: message.id,
          format: "metadata",
          metadataHeaders: [
            "To",
            "Subject",
            "Date"
          ]
        });

      const headers =
        email.data.payload.headers || [];

      const getHeader = (name) => {
        const header = headers.find(
          (h) =>
            h.name.toLowerCase() ===
            name.toLowerCase()
        );

        return header ? header.value : "";
      };

      emails.push({
        id: message.id,
        to: getHeader("To"),
        subject: getHeader("Subject"),
        date: getHeader("Date"),
        snippet: email.data.snippet,
        isUnread:
          email.data.labelIds?.includes(
            "UNREAD"
          ) || false
      });
    }

    res.json(emails);

  } catch (error) {
    console.error(
      "Sent emails error:",
      error
    );

    res.status(500).json({
      error:
        "Could not load sent emails."
    });
  }
});

// --------------------------------------------------
// SIMPLE LOCAL AI ASSISTANT
// --------------------------------------------------

function simpleAssistant(message) {
  const text =
    message.toLowerCase().trim();

  // ==========================================
  // COMPOSE EMAIL
  // ==========================================

  const composeMatch =
    message.match(
      /compose\s+(?:an\s+)?email\s+to\s+([^\s]+@[^\s]+)\s+with\s+subject\s+(.+?)\s+and\s+(?:body|message)\s+(.+)/i
    );

  if (composeMatch) {
    let subject =
      composeMatch[2].trim();

    let body =
      composeMatch[3].trim();

    // Remove surrounding quotes from subject
    if (
      (subject.startsWith('"') &&
        subject.endsWith('"')) ||
      (subject.startsWith("'") &&
        subject.endsWith("'"))
    ) {
      subject =
        subject.slice(1, -1);
    }

    // Remove surrounding quotes from body
   // Remove quotes around body
if (body.startsWith('"')) {
  body = body.slice(1);
}

if (body.endsWith('"')) {
  body = body.slice(0, -1);
}

if (body.startsWith("'")) {
  body = body.slice(1);
}

if (body.endsWith("'")) {
  body = body.slice(0, -1);
}

body = body.trim();

    return {
      action: "compose",
      to: composeMatch[1].trim(),
      subject,
      body,
      searchQuery: "",
      folder: "",
      filterType: "",
      startDate: "",
      endDate: ""
    };
  }

  // ==========================================
  // NAVIGATE TO INBOX
  // ==========================================

  if (
    text === "show inbox" ||
    text === "open inbox" ||
    text === "go to inbox" ||
    text === "inbox" ||
    text.includes("show my inbox") ||
    text.includes("open my inbox")
  ) {
    return {
      action: "navigate",
      to: "",
      subject: "",
      body: "",
      searchQuery: "",
      folder: "inbox",
      filterType: "",
      startDate: "",
      endDate: ""
    };
  }

  // ==========================================
  // NAVIGATE TO SENT
  // ==========================================

  if (
    text === "show sent" ||
    text === "open sent" ||
    text === "go to sent" ||
    text === "sent" ||
    text.includes("show my sent emails") ||
    text.includes("open my sent emails")
  ) {
    return {
      action: "navigate",
      to: "",
      subject: "",
      body: "",
      searchQuery: "",
      folder: "sent",
      filterType: "",
      startDate: "",
      endDate: ""
    };
  }

  // ==========================================
  // SEARCH EMAILS
  // ==========================================

  if (
    text.startsWith("find emails") ||
    text.startsWith("search emails") ||
    text.startsWith("show emails about") ||
    text.startsWith("find email")
  ) {
    let searchQuery = "";

    if (text.includes("about ")) {
      searchQuery =
        message.substring(
          text.indexOf("about ") + 6
        ).trim();
    } else if (text.includes("for ")) {
      searchQuery =
        message.substring(
          text.indexOf("for ") + 4
        ).trim();
    }

    if (searchQuery) {
      return {
        action: "search",
        to: "",
        subject: "",
        body: "",
        searchQuery,
        folder: "",
        filterType: "",
        startDate: "",
        endDate: ""
      };
    }
  }

  // ==========================================
  // UNREAD EMAILS
  // ==========================================

  if (
    text.includes("unread emails") ||
    text.includes("unread messages") ||
    text === "show unread" ||
    text === "show unread emails"
  ) {
    return {
      action: "filter",
      to: "",
      subject: "",
      body: "",
      searchQuery: "",
      folder: "",
      filterType: "unread",
      startDate: "",
      endDate: ""
    };
  }

  // ==========================================
  // READ EMAILS
  // ==========================================

  if (
    text.includes("read emails") ||
    text.includes("read messages") ||
    text === "show read" ||
    text === "show read emails"
  ) {
    return {
      action: "filter",
      to: "",
      subject: "",
      body: "",
      searchQuery: "",
      folder: "",
      filterType: "read",
      startDate: "",
      endDate: ""
    };
  }

  // ==========================================
  // DATE FILTER
  // ==========================================

  const dateMatch =
    message.match(
      /(?:from\s+)?([A-Za-z]+\s+\d{1,2})\s+(?:to|-)\s+([A-Za-z]+\s+\d{1,2})/i
    );

  if (dateMatch) {
    const currentYear =
      new Date().getFullYear();

    const startDate = new Date(
      `${dateMatch[1]} ${currentYear}`
    );

    const endDate = new Date(
      `${dateMatch[2]} ${currentYear}`
    );

    if (
      !isNaN(startDate) &&
      !isNaN(endDate)
    ) {
      return {
        action: "filter",
        to: "",
        subject: "",
        body: "",
        searchQuery: "",
        folder: "",
        filterType: "date",
        startDate:
          `${currentYear}-${String(
            startDate.getMonth() + 1
          ).padStart(2, "0")}-${String(
            startDate.getDate()
          ).padStart(2, "0")}`,
        endDate:
          `${currentYear}-${String(
            endDate.getMonth() + 1
          ).padStart(2, "0")}-${String(
            endDate.getDate()
          ).padStart(2, "0")}`
      };
    }
  }

  // ==========================================
  // FILTER EMAILS FROM SENDER
  // ==========================================

  if (
    text.includes("emails from") ||
    text.includes("messages from")
  ) {
    const marker =
      text.includes("emails from")
        ? "emails from"
        : "messages from";

    const searchQuery =
      message.substring(
        text.indexOf(marker) +
          marker.length
      ).trim();

    if (searchQuery) {
      return {
        action: "filter",
        to: "",
        subject: "",
        body: "",
        searchQuery,
        folder: "",
        filterType: "sender",
        startDate: "",
        endDate: ""
      };
    }
  }

  return null;
}

// --------------------------------------------------
// AI ASSISTANT
// --------------------------------------------------

app.post("/api/assistant", async (req, res) => {
  try {
    const {
      message,
      context
    } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    // ==========================================
    // REPLY TO CURRENT EMAIL
    // ==========================================

    if (
      context &&
      context.from &&
      context.subject &&
      message
        .toLowerCase()
        .includes("reply")
    ) {
      const lowerMessage =
        message.toLowerCase();

      let replyBody = message;

      if (
        lowerMessage.includes("saying")
      ) {
        replyBody =
          message.substring(
            lowerMessage.indexOf(
              "saying"
            ) + 6
          ).trim();
      } else if (
        lowerMessage.includes("that")
      ) {
        replyBody =
          message.substring(
            lowerMessage.indexOf(
              "that"
            ) + 4
          ).trim();
      }

      return res.json({
        action: "compose",
        to: context.from,
        subject:
          context.subject.startsWith(
            "Re:"
          )
            ? context.subject
            : `Re: ${context.subject}`,
        body: replyBody,
        searchQuery: "",
        folder: "",
        filterType: "",
        startDate: "",
        endDate: ""
      });
    }

    // ==========================================
    // LOCAL ASSISTANT FIRST
    // ==========================================

    const simpleResult =
      simpleAssistant(message);

    if (simpleResult) {
      console.log(
        "Simple Assistant:",
        simpleResult
      );

      return res.json(
        simpleResult
      );
    }

    // ==========================================
    // GEMINI
    // ==========================================

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    const response =
      await ai.models.generateContent({
        model: "gemini-3.6-flash",

        contents: `
You are the AI assistant for Nebula Mail.

The user will give you a request about email.

Decide what action the user wants.

Possible actions:

- compose
- search
- navigate
- filter
- unknown

Return ONLY valid JSON in this exact format:

{
  "action": "compose",
  "to": "",
  "subject": "",
  "body": "",
  "searchQuery": "",
  "folder": "",
  "filterType": "",
  "startDate": "",
  "endDate": ""
}

Rules:

- If the user wants to compose an email, action must be "compose".
- Extract the recipient email if provided.
- Extract the subject if provided.
- If the user asks you to write the email, generate a polite and appropriate email body.
- If the user gives the purpose of the email, use that purpose to create the body.
- Keep the email body clear and professional.

- If the user wants to search or find emails, action must be "search".
- For a search request, put the important search keyword in "searchQuery".
- "Find emails about internship" should produce searchQuery "internship".
- Search should work against the sender, subject, and email preview/snippet.

- If the user wants to see unread emails, action must be "filter" and filterType must be "unread".
- If the user wants to see read emails, action must be "filter" and filterType must be "read".

- If the user asks to show emails from a specific sender, action must be "filter" and filterType must be "sender".
- For sender filters, put the sender name or email address in searchQuery.

- If the user asks to filter emails by a date or date range, action must be "filter" and filterType must be "date".
- For date filters, put the starting date in startDate and the ending date in endDate.
- Use date format YYYY-MM-DD.
- The current year is 2026.

- When the user gives a date without a year, assume the current year 2026.
- For example, "September 1 to September 4" means 2026-09-01 to 2026-09-04.

- For "today", use today's date.
- For "yesterday", use yesterday's date.
- For "last week", use the previous calendar week's Monday as startDate and Sunday as endDate.

- If the user refers to "this email", "this message", "the email I'm viewing", or similar wording, use the Current email context.

- If the user wants to reply to the currently open email, action must be "compose".
- For a reply, use the original sender's email address as "to".
- For a reply, use "Re: " followed by the original subject as the subject.
- Generate the reply body based on what the user requested.

- If no email is currently open, leave the compose fields empty.

- If the user wants to open or show their inbox, action must be "navigate" and folder must be "inbox".

- If the user wants to open or show their sent emails, action must be "navigate" and folder must be "sent".

- For navigation requests, leave to, subject, body, and searchQuery empty.

- If information is missing, leave that field as an empty string.
- Do not add markdown.
- Do not explain anything outside the JSON.

Current date:

${today}

Current email context:

${
  context
    ? JSON.stringify(context)
    : "No email is currently open."
}

User request:

${message}
        `,

        config: {
          responseMimeType:
            "application/json",

          responseSchema: {
            type: "object",

            properties: {
              action: {
                type: "string"
              },
              to: {
                type: "string"
              },
              subject: {
                type: "string"
              },
              body: {
                type: "string"
              },
              searchQuery: {
                type: "string"
              },
              folder: {
                type: "string"
              },
              filterType: {
                type: "string"
              },
              startDate: {
                type: "string"
              },
              endDate: {
                type: "string"
              }
            },

            required: [
              "action",
              "to",
              "subject",
              "body",
              "searchQuery",
              "folder",
              "filterType",
              "startDate",
              "endDate"
            ]
          }
        }
      });

    const result =
      JSON.parse(response.text);

    console.log(
      "Gemini response:",
      result
    );

    res.json(result);

  } catch (error) {
    console.error(
      "Gemini Assistant Error:",
      error
    );

    res.status(500).json({
      error:
        "AI assistant could not process the request."
    });
  }
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(
    `Server running on http://localhost:${PORT}`
  );
});