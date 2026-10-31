# ReachInbox --- Email Scheduling & Campaign Management

ReachInbox is a full-stack email scheduling application that lets users
compose campaigns, import recipients from CSV, schedule delivery, and
monitor email processing. Its backend uses a persistent BullMQ queue
with Redis, PostgreSQL for application data, Elasticsearch for email
search, Ethereal for test email delivery, and Slack notifications for
sending-limit alerts.

## Features

-   **Google authentication:** Sign in to the workspace using Google
    OAuth.
-   **Email campaigns:** Compose an email and schedule it for one
    recipient or a list of recipients.
-   **CSV recipient import:** Import recipients from a CSV file with an
    `email` column. Duplicate and invalid addresses are filtered by the
    frontend.
-   **Persistent scheduling:** BullMQ and Redis manage delayed email
    jobs.
-   **Worker controls:** Configure worker concurrency, per-sender hourly
    limits, and minimum delay between sends.
-   **Deferred jobs:** Jobs that reach a sending limit or minimum-delay
    restriction are deferred for later processing rather than
    intentionally discarded.
-   **Email status tracking:** View scheduled, processing, sent, and
    failed email records.
-   **Email search:** Elasticsearch provides full-text search across
    recipient, subject, and body, with a database fallback.
-   **Queue monitoring:** Bull Board exposes queue status and job
    details.
-   **Slack alerts:** Connect a Slack workspace and receive a
    notification when a sender reaches the configured hourly limit.
-   **Test delivery:** Ethereal Email provides a safe SMTP testing
    environment.

## Technology Stack

  Layer                  Technology
  ---------------------- ------------------------------------------
  Frontend               Next.js, React, TypeScript, Tailwind CSS
  Backend                Node.js, Express, TypeScript
  Database               PostgreSQL, Prisma ORM
  Queue and cache        Redis, BullMQ
  Email transport        Nodemailer, Ethereal Email
  Search                 Elasticsearch
  Queue dashboard        Bull Board
  Authentication         Google OAuth, JWT
  Notifications          Slack OAuth and Slack Web API
  Local infrastructure   Docker Compose

## Project Structure

``` text
reachinbox-scheduler/
├── backend/
│   ├── prisma/
│   └── src/
│       ├── config/
│       ├── middleware/
│       ├── queues/
│       ├── routes/
│       ├── services/
│       ├── workers/
│       └── server.ts
├── frontend/
│   └── src/
│       └── app/
├── docs/
│   └── reachinbox-demo.mp4
├── docker-compose.yml
└── README.md
```

The demo video is optional in the repository. If it is stored elsewhere,
replace the path above with a link to the hosted video.

## Prerequisites

Install the following before running the project:

-   Node.js (LTS) and npm
-   Docker Desktop with Docker Compose
-   Git
-   A Google OAuth application
-   A Slack app (for Slack notifications)
-   An Ethereal Email account (for test SMTP delivery)

## Local Setup

### 1. Clone the repository

``` bash
git clone https://github.com/RupeshKumar-15/ReachInbox-Scheduler.git
cd ReachInbox-Scheduler
```

### 2. Start infrastructure services

From the project root:

``` bash
docker compose up -d
```

This starts the PostgreSQL, Redis, and Elasticsearch services defined in
`docker-compose.yml`.

Check service status:

``` bash
docker compose ps
```

### 3. Configure backend environment variables

Create `backend/.env` using the following template. Replace placeholder
values with your own local credentials.

``` env
PORT=5000
FRONTEND_URL=http://localhost:3000

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reachinbox?schema=public
REDIS_HOST=localhost
REDIS_PORT=6379

WORKER_CONCURRENCY=5

# Ethereal SMTP credentials
ETHEREAL_USER=your_ethereal_username
ETHEREAL_PASS=your_ethereal_password

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# JWT: use a long, random secret; never commit it
JWT_SECRET=replace_with_a_long_random_secret

# Slack OAuth
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200
```

Check the actual variable names used by the backend before creating the
file. Do not commit `.env`, `.env.local`, OAuth secrets, SMTP passwords,
Slack tokens, or JWT secrets.

### 4. Install backend dependencies and prepare the database

``` bash
cd backend
npm install
npx prisma migrate deploy
```

For a local development database where you are creating new migrations,
use the Prisma development migration workflow instead.

Start the backend using the development script defined in
`backend/package.json` (commonly `npm run dev`):

``` bash
npm run dev
```

The API is expected at `http://localhost:5000`.

### 5. Configure and start the frontend

Create `frontend/.env.local`:

``` env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Then install dependencies and start the frontend:

``` bash
cd ../frontend
npm install
npm run dev
```

The frontend is expected at `http://localhost:3000`.

### 6. Configure OAuth redirect URLs

In Google Cloud Console, configure the local frontend origin and backend
callback URL:

-   Authorized JavaScript origin: `http://localhost:3000`
-   Authorized redirect URI:
    `http://localhost:5000/api/auth/google/callback`

For Slack, configure the redirect URL to match `SLACK_REDIRECT_URI`, and
enable the required Slack OAuth scope(s), including `chat:write`.

## Useful Local URLs

  Service                URL
  ---------------------- ------------------------------------
  ReachInbox frontend    http://localhost:3000
  Backend health check   http://localhost:5000/health
  Bull Board             http://localhost:5000/admin/queues
  Elasticsearch          http://localhost:9200

## How to Use

1.  Start Docker services, backend, and frontend.
2.  Sign in with Google.
3.  Add a sender account in the dashboard. Configure its display name,
    sender email, hourly limit, and minimum delay.
4.  Use the sender's configured SMTP identity. For local testing, the
    backend uses the Ethereal SMTP credentials configured in its
    environment.
5.  Compose a message, enter a recipient or import a CSV containing an
    `email` column, provide a subject and body, and choose a future
    delivery time.
6.  Schedule the campaign.
7.  Monitor email status in the dashboard and inspect queue jobs in Bull
    Board.
8.  Search for email content in the dashboard.
9.  Connect Slack to receive sending-limit notifications.

**Important:** An Ethereal account is a testing SMTP service. Messages
are captured for preview and are not delivered to recipients' real
inboxes. Use real SMTP credentials only after implementing and reviewing
the necessary production security and provider configuration.

## API Overview

The API is served from `http://localhost:5000`.

  -----------------------------------------------------------------------------
  Method                  Endpoint                      Purpose
  ----------------------- ----------------------------- -----------------------
  GET                     `/health`                     Backend health check

  GET                     `/api/auth/google`            Start Google OAuth

  GET                     `/api/auth/google/callback`   Handle Google OAuth
                                                        callback

  GET                     `/api/emails`                 List emails; supports
                                                        status, pagination, and
                                                        search parameters

  GET                     `/api/senders`                List the authenticated
                                                        user's sender accounts

  POST                    `/api/senders`                Create a sender account

  GET                     `/api/campaigns`              List campaigns

  POST                    `/api/campaigns/schedule`     Schedule an email
                                                        campaign

  GET                     `/api/slack/connect`          Start Slack OAuth
                                                        connection
  -----------------------------------------------------------------------------

Protected API routes require a valid bearer token. Exact request fields
and response shapes are defined in the backend route files.

## Configuration Notes

-   `WORKER_CONCURRENCY` controls the number of jobs a worker can
    process concurrently.
-   Sender-level `hourlyLimit` controls the hourly sending cap.
-   Sender-level `minDelayMs` controls the minimum spacing between
    sends.
-   Redis stores BullMQ job state and rate-limit coordination data.
-   PostgreSQL stores users, senders, campaigns, email records, and
    Slack connection metadata.
-   Elasticsearch is used for full-text email search. The application
    can fall back to database search if Elasticsearch is unavailable.

## Reliability and Security Considerations

-   Keep all secrets in environment variables and out of source control.
-   Use HTTPS and secure secret management for deployed environments.
-   Restrict CORS to the deployed frontend origin.
-   Encrypt Slack access tokens at rest before production use.
-   Add production-grade SMTP credential management and sender
    verification.
-   Review retry behavior and duplicate-send handling before production
    use. Queue retries and database state checks reduce duplicate
    processing, but SMTP delivery and database updates cannot form one
    atomic transaction; exactly-once external email delivery cannot be
    guaranteed.
-   Configure authentication and authorization on every private API
    route.
-   The local Docker Compose configuration is intended for development,
    not direct production deployment.

## Demo

A short application walkthrough can be placed at:

`docs/reachinbox-demo.mp4`

If the video is too large for GitHub's regular file limit, host it
separately (for example, using a private/unlisted video link where
appropriate) and add that URL here. Do not commit files larger than
GitHub's supported per-file limit.

## Troubleshooting

**Backend cannot connect to PostgreSQL or Redis** - Check that Docker
Desktop is running. - Run `docker compose ps` from the project root. -
Confirm the ports and connection strings in `backend/.env`.

**Google sign-in fails** - Verify the client ID and secret. - Confirm
the authorized origin and callback URL exactly match the configured
URLs. - Check that the backend callback URL matches
`GOOGLE_CALLBACK_URL`.

**No sender appears in the compose form** - Sign in to the correct
Google account. - Create a sender account from the Sender Accounts
section. - Ensure the sender is active and that the sender API request
succeeds.

**Emails remain delayed** - Confirm the backend worker is running. -
Check Redis and Bull Board. - Review sender hourly limits, minimum
delay, and the scheduled delivery time.

**Elasticsearch search is unavailable** - Confirm Elasticsearch is
healthy at `http://localhost:9200`. - Check `ELASTICSEARCH_NODE` and
backend logs. The API may use its database fallback.

## License

This repository is shared for project evaluation and demonstration. Add
a license file if you intend to distribute the project under a specific
open-source license.
