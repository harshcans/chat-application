# Real-Time Chat Application

A real-time chat application built with **Node.js, Express, MongoDB, JWT, and Socket.IO**. It supports user registration, email OTP verification, authentication, conversations, stored message history, and real-time message delivery.

## Features

- Register with name, email, and password
- Hash passwords before storing them
- Verify email using an OTP and request a replacement OTP
- Log in using JWT access and refresh tokens
- List registered users
- Create and list conversations
- Save and retrieve messages
- Send messages in real time with Socket.IO
- Check conversation membership before joining rooms or sending messages

## Tech stack

- Node.js and Express
- MongoDB and Mongoose
- JSON Web Tokens (`jsonwebtoken`)
- `bcryptjs`
- Nodemailer for OTP email
- Socket.IO
- Postman for API testing

## Project structure

```text
chat-application/
├── config/
│   └── db.js
├── controllers/
│   ├── authController.js
│   ├── conversationController.js
│   ├── messageController.js
│   └── userController.js
├── middleware/
│   └── authMiddleware.js
├── models/
│   ├── userSchema.js
│   ├── conversionSchema.js
│   └── messageSchema.js
├── routes/
│   ├── authRoutes.js
│   ├── conversationRoutes.js
│   ├── messageRoutes.js
│   └── userRoutes.js
├── public/
│   ├── index.html
│   ├── style.css
│   ├── api.js
│   ├── auth.js
│   └── chat.js
├── socket.js
├── server.js
├── .env
├── .gitignore
├── package.json
└── README.md
```

## Requirements

- Node.js and npm
- MongoDB Atlas or a local MongoDB server
- SMTP email credentials for OTP delivery

## Installation and setup

1. Clone the repository and enter the folder:

   ```bash
   git clone https://github.com/harshcans/chat-application.git
   cd chat-application
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root. Use the exact variable names expected by your source code:

   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_ACCESS_SECRET=replace_with_a_long_random_access_secret
   JWT_REFRESH_SECRET=replace_with_a_different_long_random_refresh_secret
   ACCESS_TOKEN_EXPIRES=15m
   REFRESH_TOKEN_DAYS=7
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_email_app_password
   OTP_EXPIRES_MINUTES=5
   ```

   Keep `.env` out of Git. If using Gmail, use an App Password when required, not your regular account password. Never share your real secrets.

4. Start the server:

   ```bash
   npm run dev
   ```

   Or run `npm start` for the start script. If the server serves the `public` folder, open `http://localhost:5000` in your browser.

## Authentication flow

1. Register using `POST /api/auth/register`.
2. Retrieve the OTP from email.
3. Verify it using `POST /api/auth/verify-otp`.
4. Log in using `POST /api/auth/login`.
5. Send the access token on protected REST requests using `Authorization: Bearer YOUR_ACCESS_TOKEN`.
6. When the access token expires, call `POST /api/auth/refresh-token` with the current refresh token. If refresh-token rotation is enabled, store and use the newly returned refresh token.
7. Log out using `POST /api/auth/logout`.

## REST API reference

Local base URL: `http://localhost:5000`

### Authentication

| Method | Endpoint | Purpose | Example body |
|---|---|---|---|
| POST | `/api/auth/register` | Register and send OTP | `{"name":"Aarav","email":"aarav@example.com","password":"StrongPassword123!"}` |
| POST | `/api/auth/verify-otp` | Verify OTP | `{"email":"aarav@example.com","otp":"123456"}` |
| POST | `/api/auth/resend-otp` | Send a replacement OTP | `{"email":"aarav@example.com"}` |
| POST | `/api/auth/login` | Log in and receive tokens | `{"email":"aarav@example.com","password":"StrongPassword123!"}` |
| POST | `/api/auth/refresh-token` | Refresh/rotate tokens | `{"refreshToken":"YOUR_REFRESH_TOKEN"}` |
| POST | `/api/auth/logout` | End the refresh session | Check your controller for whether a body is required |
| GET | `/api/auth/me` | Get the authenticated user's details | None |

### Users

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/users` | List users available to start a conversation with |

Requires a valid access token.

### Conversations

| Method | Endpoint | Purpose | Example body |
|---|---|---|---|
| POST | `/api/conversations` | Create or open a conversation | `{"participantId":"OTHER_USER_MONGODB_ID"}` |
| GET | `/api/conversations` | List the current user's conversations | None |

Use the other user's MongoDB `_id` as `participantId`.

### Messages

| Method | Endpoint | Purpose | Example body |
|---|---|---|---|
| POST | `/api/messages/:conversationId` | Save a message | `{"text":"Hello! How are you?"}` |
| GET | `/api/messages/:conversationId` | Retrieve message history | None |

Replace `:conversationId` with the MongoDB ID of the conversation. The logged-in user must belong to that conversation.

## Socket.IO

The client should connect using the access token in the handshake in the format expected by `socket.js`. For example, if your server reads `socket.handshake.auth.token`:

```javascript
const socket = io("http://localhost:5000", {
  auth: { token: accessToken }
});
```

The application uses the `joinConversation`, `sendMessage`, and `newMessage` events. A typical flow is to connect, join a conversation, send a message, and listen for `newMessage`. Check `socket.js` for the exact payload shapes used by your implementation. REST endpoints can be used to load saved message history.

## Test with Postman

Import `Chat-Application.postman_collection.json` into Postman. It defines collection variables for the base URL, tokens, email, password, OTP, user ID, and conversation ID.

Suggested test order:

1. Register a user with a unique email.
2. Check the inbox and enter the OTP in the `otp` variable.
3. Verify the OTP.
4. Register and verify a second user, or use another existing verified account.
5. Log in and confirm that the collection has saved the returned tokens.
6. List users and set `userId` to the other user's MongoDB `_id`.
7. Create a conversation and set `conversationId` to its ID.
8. Send a message and retrieve message history.
9. Test the refresh and logout endpoints.

Postman cannot read your inbox automatically, so enter the OTP manually. If your API returns IDs or tokens in a different response shape, set the relevant collection variables from the response manually.

## Security notes

- Never commit `.env`, passwords, OTPs, JWT secrets, or tokens.
- Use long, unique JWT secrets.
- Hash passwords before storing them.
- Validate request bodies and OTP expiry.
- Protect private endpoints with authentication middleware.
- Verify conversation membership in both REST and Socket.IO handlers.
- Use HTTPS in production and avoid logging sensitive credentials.

## Troubleshooting

- **MongoDB connection fails:** verify `MONGO_URI` and your Atlas network/IP allowlist.
- **OTP email is missing:** check SMTP credentials, configuration, and spam folder.
- **401 response:** log in again and check the Bearer token header.
- **Refresh fails:** use the latest refresh token if rotation is enabled.
- **Socket messages do not arrive:** verify the socket token, event names, conversation ID, and membership.
- **Conversation creation fails:** ensure `participantId` is a valid user ID.

## Possible future improvements

- Automated tests for authentication, conversations, and messages
- Pagination for users and message history
- Read receipts, typing indicators, and online status
- Rate limiting, structured logging, and deployment documentation
