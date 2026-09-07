# Nebula Mail

An AI-powered Gmail web application that combines a real Gmail inbox with an AI assistant for composing, searching, filtering, navigating, and replying to emails.

## Features

- Google OAuth authentication
- Real Gmail Inbox integration
- Real Sent Mail integration
- View complete email details
- Compose and send emails
- AI-assisted email composition
- AI-powered email search
- Search emails by sender
- Filter emails by:
  - Date range
  - Read / unread status
  - Sender
  - Keyword
- Context-aware replies such as "Reply to this saying thank you"
- Confirmation before sending emails
- Automatic inbox synchronization
- Responsive mail interface
- AI assistant integrated directly into the mail UI

## Tech Stack

### Frontend
- React
- Vite
- JavaScript
- CSS
- Lucide React icons

### Backend
- Node.js
- Express.js
- Google APIs
- Gmail API
- Google OAuth 2.0
- Gemini API

## Architecture

The application is divided into three main parts:

### 1. Frontend

The React frontend is responsible for:

- Rendering the inbox and sent mail
- Opening email details
- Compose and send UI
- Search and filter controls
- AI assistant interface
- Updating the main mail UI based on AI actions

### 2. Backend

The Express backend handles:

- Google OAuth authentication
- Gmail API communication
- Reading inbox messages
- Reading sent messages
- Sending emails
- Searching and filtering Gmail messages
- AI assistant requests

### 3. AI Assistant

The AI assistant interprets natural-language commands and converts them into actions that update the mail application.

Examples:

```text
Find emails about internship
Show unread emails
Show emails from Google
Show emails from September 1 to September 4
Reply to this saying thank you for the information
The assistant is designed to control the mail interface rather than functioning only as a separate chatbot.

Gmail Integration

Nebula Mail uses the Gmail API with Google OAuth 2.0.

The application requests permissions required to:

Read Gmail messages
Send emails
Modify message state

Authentication credentials and OAuth tokens are stored locally and are excluded from Git using .gitignore.

Automatic Synchronization

The application periodically checks Gmail for new messages so that newly received emails can appear in the inbox without manually refreshing the page.

For a production version, Gmail push notifications / Google Cloud Pub/Sub would be used to provide event-driven synchronization.

Setup
Prerequisites

Make sure you have:

Node.js installed
npm installed
A Google Cloud project
Gmail API enabled
OAuth 2.0 credentials
A Gemini API key

1. Clone the repository
git clone https://github.com/Thanija/NebulaMail.git
cd NebulaMail

2. Install frontend dependencies
npm install

3. Install backend dependencies
cd server
npm install

4. Configure environment variables

Create a .env file inside the server folder.

Add your Google OAuth credentials and Gemini API key according to the environment variables used in server/server.js.

Do not commit .env or OAuth token files to GitHub.

5. Start the backend

From the server folder:

node server.js

The backend runs on:

http://localhost:5000

6. Start the frontend

Open another terminal in the project root:

npm run dev

The frontend will be available through the Vite development server.

7. Authenticate with Google

Open the application in your browser and complete the Google OAuth flow.

AI Assistant Examples

The assistant can perform actions such as:

User command	Action
Find emails about internship	Searches Gmail
Show unread emails	Shows unread messages
Show read emails	Shows read messages
Show emails from Google	Filters by sender
Show emails from September 1 to September 4	Filters by date
Reply to this saying thank you	Opens a contextual reply
Security

Sensitive credentials are intentionally excluded from the repository.

The following files should never be committed:

.env
token.json
node_modules/

API keys and OAuth credentials should be stored only in environment variables or local configuration.

Design Decisions and Tradeoffs
Gmail API

Using the Gmail API provides access to real user emails instead of mock data, making the application closer to a production mail client.

AI Actions

The assistant returns structured actions such as search, filter, navigate, and compose. This allows the frontend to update the actual mail interface instead of displaying only text responses.

Automatic Synchronization

The current implementation uses periodic synchronization to keep the inbox updated without requiring manual refresh.

A production implementation would use Gmail push notifications with Google Cloud Pub/Sub for more efficient event-driven updates.

Confirmation Before Sending

A confirmation step is included before an email is sent to reduce accidental sends.

Future Improvements
Gmail push notifications using Google Cloud Pub/Sub
Email threading
Reply and forward improvements
Rich email previews
Attachments
Better AI intent detection
AI-generated email summaries
Improved mobile responsiveness
Dark mode
Automated tests
Production deployment

Project Structure
NebulaMail/
│
├── public/
├── src/
│   ├── assets/
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── main.jsx
│
├── server/
│   ├── server.js
│   ├── package.json
│   ├── package-lock.json
│   └── .gitignore
│
├── .gitignore
├── README.md
├── package.json
├── package-lock.json
└── vite.config.js

Author

Thanija J P

Nebula Mail was developed as an engineering project demonstrating Gmail API integration, AI-assisted UI interactions, React frontend development, and Node.js backend development.


