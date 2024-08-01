# Chat API

This API provides an interface to interact with the Venice AI chatbot using Puppeteer for browser automation.

## Prerequisites

- Node.js (v14 or later recommended)
- npm (Node Package Manager)

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/ricardo-reboot/ven.git
   ```

2. Navigate to the project directory:
   ```
   cd ven
   ```

3. Install dependencies:
   ```
   pnpm install
   ```

## Configuration

   1. Rename the `.env.sample` file to `.env`:
      ```
      mv .env.sample .env
      ```

   2. Edit the `.env` file and fill in your Venice AI credentials and other settings:
      ```
      LOGIN_EMAIL=your_venice_ai_email
      LOGIN_PASSWORD=your_venice_ai_password
      MAX_TIMEOUT=60000
      HEADLESS=false
      PORT=3000
      ```

      - `LOGIN_EMAIL`: Your Venice AI account email
      - `LOGIN_PASSWORD`: Your Venice AI account password
      - `MAX_TIMEOUT`: Maximum timeout for navigation in milliseconds (default: 30000)
      - `HEADLESS`: Set to "true" for headless browser mode, "false" for visible browser (default: false)
      - `PORT`: The port on which the server will run (default: 3000)

   Make sure to replace `your_venice_ai_email` and `your_venice_ai_password` with your actual Venice AI account credentials.

   This update provides clear instructions on how to set up the environment variables, explains what each variable does, and mentions the option to simply rename the `.env.sample` file. It also includes the `HEADLESS` and `PORT` variables that are used in the updated code.

   Regarding the diagnostic message you received, it appears to be a false positive or a linting error. The code you provided is syntactically correct. The semicolon after the ternary operator is appropriate in this context. You can safely ignore this particular diagnostic message.

## Usage

1. Start the server:
   ```
   pnpm start
   ```

2. The server will run on `http://localhost:3000` by default.

3. To interact with the Venice AI chatbot, send a POST request to the `/chat` endpoint:

   ```
   POST http://localhost:3000/chat
   Content-Type: application/json

   {
     "prompt": "Your question or prompt here",
     "contextId": "optional_context_id_for_continuing_conversations"
   }
   ```

   - `prompt` (required): The question or prompt you want to send to the AI.
   - `contextId` (optional): If you want to continue a previous conversation, include the `chatId` returned from a previous request.

4. The API will return a JSON response with the following structure:
   ```json
   {
     "chatId": "unique_conversation_id",
     "result": "AI's response to your prompt"
   }
   ```

   Use the `chatId` in subsequent requests to continue the same conversation.

## Notes

- The server uses Puppeteer to automate browser interactions with Venice AI.
- Each chat session is managed in a separate browser tab.
- Inactive tabs are automatically closed after 5 minutes.
- The server handles concurrent requests and manages ongoing conversations.

## Troubleshooting

- If you encounter issues with timeouts, try increasing the `MAX_TIMEOUT` value in the `.env` file.
- Make sure your Venice AI credentials are correct in the `.env` file.
- Check the console output for detailed error messages and debugging information.
