import { useEffect, useState, useRef } from "react";

import {
  Mail,
  Inbox,
  Send,
  Star,
  Trash2,
  Search,
  Plus,
  Bot,
  RefreshCw,
  X
} from "lucide-react";

import "./App.css";


function App() {

  // =========================
  // EMAIL STATES
  // =========================

  const [emails, setEmails] = useState([]);
  const [sentEmails, setSentEmails] = useState([]);
  const [folder, setFolder] = useState("inbox");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  // =========================
  // COMPOSE STATES
  // =========================

  const [showCompose, setShowCompose] = useState(false);

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState("");


  // =========================
  // AI ASSISTANT STATES
  // =========================

  const [assistantInput, setAssistantInput] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [dateRange, setDateRange] = useState({
    start: "",
    end: ""
  });


  // =========================
  // SELECTED EMAIL
  // =========================

  const [selectedEmail, setSelectedEmail] = useState(null);


  // =========================
  // REFS FOR AUTOMATIC SYNC
  // =========================

  const searchQueryRef = useRef("");
  const filterTypeRef = useRef("");

  const dateRangeRef = useRef({
    start: "",
    end: ""
  });


  // =========================
  // KEEP REFS UPDATED
  // =========================

  useEffect(() => {

    searchQueryRef.current = searchQuery;

    filterTypeRef.current = filterType;

    dateRangeRef.current = dateRange;

  }, [
    searchQuery,
    filterType,
    dateRange
  ]);


  // =========================
  // LOAD INBOX EMAILS
  // =========================

  const loadEmails = async () => {

    try {

      setLoading(true);
      setError("");

      const response = await fetch(
        "http://localhost:5000/api/emails"
      );

      if (!response.ok) {
        throw new Error("Failed to load emails");
      }

      const data = await response.json();

      setEmails(data);

    } catch (err) {

      console.error(err);

      setError(
        "Could not load Gmail emails."
      );

    } finally {

      setLoading(false);

    }

  };


  // =========================
  // LOAD SENT EMAILS
  // =========================

  const loadSentEmails = async () => {

    try {

      setLoading(true);
      setError("");

      const response = await fetch(
        "http://localhost:5000/api/sent"
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load sent emails"
        );
      }

      const data = await response.json();

      setSentEmails(data);

    } catch (err) {

      console.error(err);

      setError(
        "Could not load sent emails."
      );

    } finally {

      setLoading(false);

    }

  };


  // =========================
  // LOAD WHEN FOLDER CHANGES
  // =========================

  useEffect(() => {

    // Clear search/filter when folder changes
    setSearchQuery("");
    setFilterType("");

    setStartDate("");
    setEndDate("");

    setDateRange({
      start: "",
      end: ""
    });


    if (folder === "inbox") {

      loadEmails();

    } else if (folder === "sent") {

      loadSentEmails();

    }

  }, [folder]);


  // =========================
  // AUTOMATIC EMAIL SYNC
  // =========================

  useEffect(() => {

    const interval = setInterval(() => {

      // Read the latest search/filter state
      const hasSearch =
        searchQueryRef.current.trim() !== "";

      const hasFilter =
        filterTypeRef.current !== "";

      const hasDateFilter =
        dateRangeRef.current.start !== "" ||
        dateRangeRef.current.end !== "";


      // IMPORTANT:
      // Don't overwrite search/filter results
      if (
        hasSearch ||
        hasFilter ||
        hasDateFilter
      ) {

        console.log(
          "Auto sync skipped because search/filter is active."
        );

        return;

      }


      // Normal automatic sync

      console.log(
        "Automatic email sync..."
      );


      if (folder === "inbox") {

        loadEmails();

      } else if (folder === "sent") {

        loadSentEmails();

      }

    }, 15000);


    return () => {

      clearInterval(interval);

    };

  }, [folder]);


  // =========================
  // REFRESH CURRENT FOLDER
  // =========================

  const refreshCurrentFolder = () => {

    if (folder === "inbox") {

      loadEmails();

    } else if (folder === "sent") {

      loadSentEmails();

    }

  };


  // =========================
  // AI ASSISTANT
  // =========================

  const handleAssistant = async () => {

    const message =
      assistantInput.trim();

    if (!message) return;


    try {

      const response = await fetch(
        "http://localhost:5000/api/assistant",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({

            message: message,

            context: selectedEmail
              ? {
                  from: selectedEmail.from,
                  to: selectedEmail.to,
                  subject: selectedEmail.subject,
                  body: selectedEmail.body
                }
              : null

          })

        }
      );


      const data =
        await response.json();


      console.log(
        "AI RESPONSE:",
        data
      );


      if (!response.ok) {

        alert(
          data.error ||
          "AI assistant failed."
        );

        return;

      }


      // =========================
      // COMPOSE
      // =========================

      if (data.action === "compose") {

        setShowCompose(true);

        setTo(data.to || "");

        setSubject(
          data.subject || ""
        );

        setBody(
          data.body || ""
        );

        setAssistantInput("");

        return;

      }


      // =========================
      // SEARCH
      // =========================

      if (data.action === "search") {

        try {

          const params =
            new URLSearchParams({

              folder: folder,

              filterType: "search",

              searchQuery:
                data.searchQuery || ""

            });


          const searchResponse =
            await fetch(
              `http://localhost:5000/api/filter-emails?${params.toString()}`
            );


          const searchResults =
            await searchResponse.json();


          if (!searchResponse.ok) {

            alert(
              searchResults.error ||
              "Could not search emails."
            );

            return;

          }


          // Update the correct folder

          if (folder === "inbox") {

            setEmails(searchResults);

          } else {

            setSentEmails(searchResults);

          }


          // Keep search active

          setSearchQuery(
            data.searchQuery || ""
          );

          setFilterType("");

          setDateRange({
            start: "",
            end: ""
          });

          setStartDate("");
          setEndDate("");

          setAssistantInput("");

        } catch (error) {

          console.error(
            "AI search error:",
            error
          );

          alert(
            "Could not connect to Gmail search."
          );

        }

        return;

      }


      // =========================
      // NAVIGATION
      // =========================

      if (data.action === "navigate") {

        if (data.folder === "inbox") {

          setFolder("inbox");

        }

        if (data.folder === "sent") {

          setFolder("sent");

        }


        setSearchQuery("");

        setFilterType("");

        setStartDate("");
        setEndDate("");

        setDateRange({
          start: "",
          end: ""
        });

        setAssistantInput("");

        return;

      }


      // =========================
      // FILTER
      // =========================

      if (data.action === "filter") {

        try {

          const params =
            new URLSearchParams({

              folder: folder,

              filterType:
                data.filterType || "",

              startDate:
                data.startDate || "",

              endDate:
                data.endDate || "",

              searchQuery:
                data.searchQuery || ""

            });


          const response =
            await fetch(
              `http://localhost:5000/api/filter-emails?${params.toString()}`
            );


          const filteredEmails =
            await response.json();


          if (!response.ok) {

            alert(
              filteredEmails.error ||
              "Could not filter emails."
            );

            return;

          }


          // Update main email list

          if (folder === "inbox") {

            setEmails(filteredEmails);

          } else {

            setSentEmails(
              filteredEmails
            );

          }


          // Keep filter active

          setFilterType(
            data.filterType || ""
          );


          // DATE FILTER

          if (
            data.filterType === "date"
          ) {

            setSearchQuery("");

            setDateRange({

              start:
                data.startDate || "",

              end:
                data.endDate || ""

            });

            setStartDate(
              data.startDate || ""
            );

            setEndDate(
              data.endDate || ""
            );

          }


          // UNREAD FILTER

          if (
            data.filterType === "unread"
          ) {

            setSearchQuery("");

            setDateRange({
              start: "",
              end: ""
            });

            setStartDate("");
            setEndDate("");

          }


          // READ FILTER

          if (
            data.filterType === "read"
          ) {

            setSearchQuery("");

            setDateRange({
              start: "",
              end: ""
            });

            setStartDate("");
            setEndDate("");

          }


          // SENDER FILTER

          if (
            data.filterType === "sender"
          ) {

            setSearchQuery(
              data.searchQuery || ""
            );

            setDateRange({
              start: "",
              end: ""
            });

            setStartDate("");
            setEndDate("");

          }


          setAssistantInput("");

        } catch (error) {

          console.error(
            "Filter error:",
            error
          );

          alert(
            "Could not connect to Gmail filtering."
          );

        }

        return;

      }


      alert(
        "The AI understood your request, but we haven't added that action yet."
      );

    } catch (error) {

      console.error(error);

      alert(
        "Could not connect to the AI assistant."
      );

    }

  };


  // =========================
  // SEND EMAIL
  // =========================

  const sendEmail = async () => {

    // Check fields

    if (
      !to ||
      !subject ||
      !body
    ) {

      setSendMessage(
        "Please fill all fields."
      );

      return;

    }


    // Confirmation before sending

    const confirmed =
      window.confirm(
        `Are you sure you want to send this email?\n\nTo: ${to}\nSubject: ${subject}`
      );


    if (!confirmed) {

      return;

    }


    try {

      setSending(true);

      setSendMessage("");


      const response =
        await fetch(
          "http://localhost:5000/api/send",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({

              to,
              subject,
              body

            })

          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.error ||
          "Failed to send"
        );

      }


      // Success message

      setSendMessage(
        "Email sent successfully! 🎉"
      );


      // Clear fields

      setTo("");
      setSubject("");
      setBody("");


      // Refresh sent emails

      loadSentEmails();


      // Close compose window

      setTimeout(() => {

        setShowCompose(false);

        setSendMessage("");

      }, 1500);


    } catch (err) {

      console.error(err);

      setSendMessage(
        "Could not send email."
      );

    } finally {

      setSending(false);

    }

  };


  // =========================
  // DISPLAYED EMAILS
  // =========================

  const baseEmails =
    folder === "inbox"
      ? emails
      : sentEmails;


  const displayedEmails =
    baseEmails.filter((email) => {


      // =========================
      // DATE FILTER
      // =========================

      if (
        filterType === "date"
      ) {

        if (
          !dateRange.start ||
          !dateRange.end
        ) {

          return true;

        }


        const emailTime =
          new Date(
            email.date
          ).getTime();


        const startTime =
          new Date(
            dateRange.start +
            "T00:00:00"
          ).getTime();


        const endTime =
          new Date(
            dateRange.end +
            "T23:59:59"
          ).getTime();


        return (
          emailTime >= startTime &&
          emailTime <= endTime
        );

      }


      // =========================
      // UNREAD FILTER
      // =========================

      if (
        filterType === "unread"
      ) {

        return email.isUnread;

      }


      // =========================
      // READ FILTER
      // =========================

      if (
        filterType === "read"
      ) {

        return !email.isUnread;

      }


      // =========================
      // SENDER FILTER
      // =========================

      if (
        filterType === "sender"
      ) {

        const sender =
          (
            email.from || ""
          ).toLowerCase();


        return sender.includes(
          searchQuery.toLowerCase()
        );

      }


      // =========================
      // NORMAL SEARCH
      // =========================

      // Gmail already performed
      // the search on the server.

      if (
        searchQuery &&
        filterType === ""
      ) {

        return true;

      }


      // =========================
      // NO FILTER
      // =========================

      return true;

    });


  // =========================
  // UI
  // =========================

  return (

    <div className="app">


      {/* ================================= */}
      {/* SIDEBAR */}
      {/* ================================= */}

      <aside className="sidebar">


        {/* LOGO */}

        <div className="logo">

          <Mail size={28} />

          <span>
            Nebula Mail
          </span>

        </div>


        {/* COMPOSE BUTTON */}

        <button
          className="compose-btn"
          onClick={() =>
            setShowCompose(true)
          }
        >

          <Plus size={20} />

          Compose

        </button>


        {/* NAVIGATION */}

        <nav className="nav-menu">


          {/* INBOX */}

          <div
            className={`nav-item ${
              folder === "inbox"
                ? "active"
                : ""
            }`}

            onClick={() => {

              setFolder("inbox");

            }}
          >

            <Inbox size={20} />

            <span>
              Inbox
            </span>

            <span className="count">

              {emails.length}

            </span>

          </div>


          {/* SENT */}

          <div
            className={`nav-item ${
              folder === "sent"
                ? "active"
                : ""
            }`}

            onClick={() => {

              setFolder("sent");

            }}
          >

            <Send size={20} />

            <span>
              Sent
            </span>

          </div>


          {/* STARRED */}

          <div className="nav-item">

            <Star size={20} />

            <span>
              Starred
            </span>

          </div>


          {/* TRASH */}

          <div className="nav-item">

            <Trash2 size={20} />

            <span>
              Trash
            </span>

          </div>


        </nav>

      </aside>


      {/* ================================= */}
      {/* MAIN */}
      {/* ================================= */}

      <main className="main">


        {/* TOP BAR */}

        <header className="topbar">


          {/* SEARCH */}

          <div className="search">

            <Search size={20} />

            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}

              onChange={(e) => {

                setSearchQuery(
                  e.target.value
                );

                setFilterType("");

                setDateRange({
                  start: "",
                  end: ""
                });

                setStartDate("");
                setEndDate("");

              }}

            />

          </div>


          {/* PROFILE */}

          <div className="profile">

            <div className="avatar">
              T
            </div>

          </div>


        </header>


        {/* CONTENT */}

        <section className="content">


          {/* ================================= */}
          {/* MAIL SECTION */}
          {/* ================================= */}

          <div className="mail-section">


            {/* HEADING */}

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                marginBottom: "20px"
              }}
            >

              <h1>

                {folder === "inbox"
                  ? "Inbox"
                  : "Sent"}

              </h1>


              <button
                onClick={
                  refreshCurrentFolder
                }

                style={{
                  border: "none",
                  background: "white",
                  padding: "10px",
                  borderRadius: "8px",
                  cursor: "pointer"
                }}

                title="Refresh"
              >

                <RefreshCw
                  size={18}
                />

              </button>

            </div>


            {/* LOADING */}

            {loading && (

              <p>
                Loading your Gmail emails...
              </p>

            )}


            {/* ERROR */}

            {error && (

              <p
                style={{
                  color: "red"
                }}
              >

                {error}

              </p>

            )}


            {/* NO EMAILS */}

            {!loading &&
              !error &&
              displayedEmails.length === 0 && (

                <p>
                  No emails found.
                </p>

              )}


            {/* EMAIL LIST */}

            <div className="mail-list">


              {displayedEmails.map(
                (email) => (

                  <div
                    className="mail-item"
                    key={email.id}

                    onClick={async () => {

                      try {

                        const response =
                          await fetch(
                            `http://localhost:5000/api/emails/${email.id}`
                          );


                        const data =
                          await response.json();


                        if (!response.ok) {

                          alert(
                            data.error ||
                            "Could not open email."
                          );

                          return;

                        }


                        setSelectedEmail(
                          data
                        );


                      } catch (error) {

                        console.error(
                          error
                        );

                        alert(
                          "Could not load the email."
                        );

                      }

                    }}

                  >


                    {/* AVATAR */}

                    <div className="mail-avatar">

                      {folder === "inbox"

                        ? email.from
                          ? email.from
                              .charAt(0)
                              .toUpperCase()
                          : "?"

                        : email.to
                          ? email.to
                              .charAt(0)
                              .toUpperCase()
                          : "?"

                      }

                    </div>


                    {/* EMAIL INFORMATION */}

                    <div className="mail-info">


                      {/* SENDER */}

                      <strong>

                        {folder === "inbox"

                          ? email.from ||
                            "Unknown sender"

                          : `To: ${
                              email.to ||
                              "Unknown recipient"
                            }`

                        }

                      </strong>


                      {/* SUBJECT */}

                      <span>

                        {email.subject ||
                          "(No subject)"}

                      </span>


                      {/* SNIPPET */}

                      <p>

                        {email.snippet ||
                          ""}

                      </p>


                    </div>


                    {/* DATE */}

                    <span className="mail-date">

                      {email.date

                        ? new Date(
                            email.date
                          ).toLocaleDateString()

                        : ""

                      }

                    </span>


                  </div>

                )

              )}

            </div>

          </div>


          {/* ================================= */}
          {/* AI ASSISTANT */}
          {/* ================================= */}

          <aside className="assistant">


            {/* ASSISTANT HEADER */}

            <div className="assistant-header">

              <Bot size={22} />

              <h2>
                AI Assistant
              </h2>

            </div>


            {/* ASSISTANT BODY */}

            <div className="assistant-body">

              <div className="welcome">

                <Bot size={35} />

                <h3>
                  How can I help?
                </h3>

                <p>
                  Ask me to search emails,
                  compose messages,
                  or navigate your mailbox.
                </p>

              </div>

            </div>


            {/* ASSISTANT INPUT */}

            <div className="assistant-input">

              <input
                type="text"
                placeholder="Ask your assistant..."
                value={assistantInput}

                onChange={(e) =>
                  setAssistantInput(
                    e.target.value
                  )
                }

                onKeyDown={(e) => {

                  if (
                    e.key === "Enter"
                  ) {

                    handleAssistant();

                  }

                }}

              />


              <button
                onClick={
                  handleAssistant
                }
              >

                Send

              </button>

            </div>


          </aside>


        </section>


      </main>


      {/* ================================= */}
      {/* COMPOSE WINDOW */}
      {/* ================================= */}

      {showCompose && (

        <div className="compose-overlay">


          <div className="compose-window">


            {/* HEADER */}

            <div className="compose-header">

              <h2>
                New Message
              </h2>


              <button
                onClick={() => {

                  setShowCompose(false);

                  setSendMessage("");

                }}
              >

                <X size={20} />

              </button>

            </div>


            {/* TO */}

            <input
              type="email"
              placeholder="To"
              value={to}

              onChange={(e) =>
                setTo(e.target.value)
              }

            />


            {/* SUBJECT */}

            <input
              type="text"
              placeholder="Subject"
              value={subject}

              onChange={(e) =>
                setSubject(
                  e.target.value
                )
              }

            />


            {/* BODY */}

            <textarea
              placeholder="Write your message..."
              value={body}

              onChange={(e) =>
                setBody(
                  e.target.value
                )
              }

            />


            {/* SEND MESSAGE */}

            {sendMessage && (

              <p className="send-message">

                {sendMessage}

              </p>

            )}


            {/* SEND BUTTON */}

            <button
              className="send-email-btn"
              onClick={sendEmail}
              disabled={sending}
            >

              {sending
                ? "Sending..."
                : "Send Email"}

            </button>


          </div>


        </div>

      )}


      {/* ================================= */}
      {/* EMAIL DETAIL */}
      {/* ================================= */}

      {selectedEmail && (

        <div className="email-detail-overlay">


          <div className="email-detail-window">


            {/* HEADER */}

            <div className="email-detail-header">

              <button
                onClick={() =>
                  setSelectedEmail(null)
                }
              >

                ← Back

              </button>

            </div>


            {/* CONTENT */}

            <div className="email-detail-content">


              <h2>

                {selectedEmail.subject ||
                  "(No subject)"}

              </h2>


              <p>

                <strong>
                  From:
                </strong>{" "}

                {selectedEmail.from ||
                  "Unknown sender"}

              </p>


              {selectedEmail.to && (

                <p>

                  <strong>
                    To:
                  </strong>{" "}

                  {selectedEmail.to}

                </p>

              )}


              <hr />


              <p>

                {selectedEmail.body ||
                  selectedEmail.snippet ||
                  ""}

              </p>


            </div>


          </div>


        </div>

      )}


    </div>

  );

}


export default App;