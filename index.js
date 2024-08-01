const express = require("express");
const puppeteer = require("puppeteer");
const path = require("node:path");
require("dotenv").config();

const app = express();
const port = 3000;

let browser;
let context;
let page;

app.use(express.json());

const NAVIGATION_TIMEOUT = process.env.MAX_TIMEOUT
  ? Number.parseInt(process.env.MAX_TIMEOUT, 10)
  : 30000;

const userDataDir = path.join(__dirname, "chrome-data");

async function initializeBrowser() {
  browser = await puppeteer.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--start-maximized",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-popup-blocking",
      "--disable-notifications",
      "--disable-infobars",
      "--disable-session-crashed-bubble",
      "--window-size=800,600",
    ],
    userDataDir: userDataDir,
    defaultViewport: {
      width: 800,
      height: 600,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    },
    ignoreDefaultArgs: ["--enable-automation"], // This can help bypass some popups
  });

  context = browser.defaultBrowserContext();
  page = await context.newPage();
  page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);

  await ensureLoggedIn();
}

async function ensureLoggedIn() {
  await page.goto("https://venice.ai/chat", { waitUntil: "networkidle2" });
  const userInfoSelector =
    "body > div.css-wi1irr > div.css-6o8pp7 > div.css-e8h8zp > div > div.css-oc1j8r > button.chakra-button.css-1rz9yxu > div > div > div > p";

  try {
    await page.waitForSelector(userInfoSelector, { timeout: 5000 });
    const userInfo = await page.$eval(userInfoSelector, (el) => el.textContent);
    if (!userInfo.includes("Venice Guest")) {
      console.log("Already logged in");
      return;
    }
  } catch (error) {
    console.log("Not logged in or error checking login status");
  }

  console.log("Logging in...");
  await login();
}

async function login() {
  await page.goto("https://venice.ai/sign-in", { waitUntil: "networkidle2" });

  await page.waitForSelector("#identifier");
  await page.type("#identifier", process.env.LOGIN_EMAIL);
  await page.click(
    "body > div.chakra-stack.css-165casq > div > div > div > div > div.chakra-card__body.css-2f8ovt > form > div > div.css-8atqhb > button",
  );

  await page.waitForSelector("#password");
  await page.type("#password", process.env.LOGIN_PASSWORD);
  await page.click(
    "body > div.chakra-stack.css-165casq > div > div > div > div > div.chakra-card__body.css-2f8ovt > form > button",
  );

  await page.waitForNavigation({ waitUntil: "networkidle2" });
  console.log("Login successful");
}

async function createNewChatSession() {
  const newPage = await context.newPage();

  // Increase the navigation timeout
  const EXTENDED_TIMEOUT = 120000; // 2 minutes
  await newPage.setDefaultNavigationTimeout(EXTENDED_TIMEOUT);
  try {
    await newPage.goto("https://venice.ai/chat", {
      waitUntil: "networkidle2",
      timeout: EXTENDED_TIMEOUT,
    });
  } catch (error) {
    console.error("[ERROR]", error);
    throw error;
  }

  try {
    await newPage.waitForSelector(
      "body > div.css-wi1irr > div.css-6o8pp7 > div.css-135z2h5 > div > div > button:nth-child(1)",
      {
        timeout: EXTENDED_TIMEOUT,
      },
    );
  } catch (error) {
    console.error("[DEBUG] Error waiting for new chat button:", error);
    throw error;
  }

  try {
    await newPage.click(
      "body > div.css-wi1irr > div.css-6o8pp7 > div.css-135z2h5 > div > div > button:nth-child(1)",
    );
  } catch (error) {
    console.error("[DEBUG] Error clicking new chat button:", error);
    throw error;
  }

  try {
    await newPage.waitForNavigation({
      waitUntil: "networkidle2",
      timeout: EXTENDED_TIMEOUT,
    });
    console.log("[DEBUG] Navigation after clicking new chat button complete");
  } catch (error) {
    console.error(
      "[DEBUG] Error during navigation after clicking new chat button:",
      error,
    );
    throw error;
  }

  const chatId = new URL(newPage.url()).pathname.split("/").pop();
  return { chatId, page: newPage };
}

async function openExistingChatSession(chatId) {
  const newPage = await context.newPage();
  await newPage.setViewport({
    width: 1280,
    height: 800,
  });
  await newPage.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);

  await newPage.goto(`https://venice.ai/chat/${chatId}`, {
    waitUntil: "networkidle2",
  });

  return { chatId, page: newPage };
}

async function sendPrompt(page, prompt) {
  console.log("[DEBUG] Starting sendPrompt function");
  console.log("[DEBUG] Prompt:", prompt);

  const textareaSelector = 'textarea[placeholder="Ask a question..."]';
  const sendButtonSelector = 'button[data-testid="chatInputSubmitButton"]';

  try {
    console.log("[DEBUG] Waiting for textarea");
    await page.waitForSelector(textareaSelector, {
      timeout: NAVIGATION_TIMEOUT,
      visible: true,
    });
    console.log("[DEBUG] Textarea found");

    console.log("[DEBUG] Clearing textarea");
    await page.evaluate((selector) => {
      document.querySelector(selector).value = "";
    }, textareaSelector);

    console.log("[DEBUG] Typing prompt into textarea");
    await page.type(textareaSelector, prompt, { delay: 10 });
    console.log("[DEBUG] Prompt typed into textarea");

    console.log("[DEBUG] Verifying entered text");
    const enteredText = await page.$eval(textareaSelector, (el) => el.value);
    console.log("[DEBUG] Text in textarea:", enteredText);

    if (enteredText !== prompt) {
      throw new Error("Prompt was not correctly entered into the textarea");
    }

    console.log("[DEBUG] Setting up XHR listener");
    const responsePromise = new Promise((resolve) => {
      page.on("response", async (response) => {
        if (
          response.url().includes("/api/inference/chat") &&
          response.request().method() === "POST"
        ) {
          const responseBody = await response.text();
          resolve(responseBody);
        }
      });
    });

    console.log("[DEBUG] Waiting for send button to be enabled");
    await page.waitForSelector(`${sendButtonSelector}:not(:disabled)`, {
      timeout: NAVIGATION_TIMEOUT,
      visible: true,
    });
    console.log("[DEBUG] Send button found and enabled");

    console.log("[DEBUG] Clicking send button");
    await page.click(sendButtonSelector);
    console.log("[DEBUG] Send button clicked");

    console.log("[DEBUG] Waiting for XHR response");
    const responseBody = await responsePromise;
    console.log("[DEBUG] XHR response received");

    console.log("[DEBUG] Raw response body:", responseBody);

    // Process the streaming response
    const responseChunks = responseBody
      .split("\n")
      .filter((chunk) => chunk.trim() !== "");
    const lastChunk = responseChunks[responseChunks.length - 1];

    let responseData;
    try {
      responseData = JSON.parse(lastChunk);
      console.log(
        "[DEBUG] Parsed response data:",
        JSON.stringify(responseData, null, 2),
      );
    } catch (error) {
      console.error("[DEBUG] Error parsing JSON from last chunk:", error);
      console.log("[DEBUG] Last chunk:", lastChunk);
    }

    console.log("[DEBUG] Waiting for assistant response in UI");
    await page.waitForSelector(".assistant", { timeout: NAVIGATION_TIMEOUT });
    console.log("[DEBUG] Assistant response appeared in UI");

    console.log("[DEBUG] Extracting response content");
    const responseContent = await page.evaluate(() => {
      const assistantDiv = document.querySelector(".assistant");
      if (!assistantDiv) {
        console.log("[DEBUG] Assistant div not found");
        return null;
      }

      const paragraphs = assistantDiv.querySelectorAll("p");
      let markdown = "";

      for (const p of paragraphs) {
        markdown += `${p.textContent}\n\n`;
      }

      const links = assistantDiv.querySelectorAll("a");
      if (links.length > 0) {
        markdown += "\nReferences:\n";
        links.forEach((link, index) => {
          markdown += `[${index + 1}]: ${link.href} "${link.textContent}"\n`;
        });
      }

      return markdown.trim();
    });

    return { responseContent, rawResponse: responseData };
  } catch (error) {
    console.error("[DEBUG] Error in sendPrompt:", error);
    console.error("[DEBUG] Error stack:", error.stack);
    throw error;
  }
}

app.post("/chat", async (req, res) => {
  console.log("[DEBUG] Received POST request to /chat");
  const { prompt, contextId } = req.body;
  console.log("[DEBUG] Prompt:", prompt);
  console.log("[DEBUG] ContextId:", contextId);

  if (!prompt) {
    console.log("[DEBUG] No prompt provided");
    return res.status(400).send("No prompt provided");
  }

  try {
    let chatId;
    let page;

    console.log("[DEBUG] chatSessions size:", chatSessions.size);
    logMapContents();

    if (contextId && chatSessions.has(contextId)) {
      console.log("[DEBUG] Resuming existing chat session");
      logMapGet(contextId);
      ({ chatId, page } = chatSessions.get(contextId));
      console.log("[DEBUG] Existing chat session opened");
    } else {
      console.log("[DEBUG] Creating new chat session");
      try {
        ({ chatId, page } = await createNewChatSession());
        console.log("[DEBUG] New chat session created successfully");
      } catch (error) {
        console.error("[DEBUG] Error creating new chat session:", error);
        console.error("[DEBUG] Error stack:", error.stack);
        return res.status(500).json({
          error: "Failed to create new chat session",
          details: error.message,
          stack: error.stack,
        });
      }
    }

    console.log("[DEBUG] Attempting to set chat session in Map");
    console.log("[DEBUG] chatId:", chatId);
    console.log(
      "[DEBUG] page:",
      page ? "Page object exists" : "Page object is undefined",
    );
    logMapSet(chatId, page);
    chatSessions.set(chatId, { chatId, page });
    console.log("[DEBUG] Chat session set in Map");
    logMapContents();

    console.log("[DEBUG] Calling sendPrompt");
    const { responseContent, rawResponse } = await sendPrompt(page, prompt);
    console.log("[DEBUG] sendPrompt completed");

    console.log("[DEBUG] Sending response");
    res.json({
      chatId,
      message: "Chat session created/resumed and prompt sent",
      formattedResponse: responseContent,
      rawResponse: rawResponse,
    });
  } catch (error) {
    console.error("[DEBUG] Error in /chat endpoint:", error);
    console.error("[DEBUG] Error stack:", error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

async function startServer() {
  await initializeBrowser().then(() => {
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  });
}

startServer();

process.on("SIGINT", async () => {
  console.log("Shutting down server...");

  if (browser) {
    console.log("[DEBUG] Closing browser");
    await browser.close();
  }

  await server.close();
  console.log("Shutdown complete");
  process.exit();
});
