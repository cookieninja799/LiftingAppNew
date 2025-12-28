require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const { OPENAI_API_KEY, ASSISTANT_ID, PORT } = process.env;

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

// Create an Express app
const app = express();

/**
 * DEV-ONLY RELAY GUARDRAILS
 * In production, these calls should go through a secure backend with 
 * proper Supabase JWT validation.
 */
console.warn("WARNING: Running in DEV-ONLY relay mode. This is not secure for production.");

// Rate limiting stub
const requestCounts = new Map();
const RATE_LIMIT = 50; // Max requests per window

app.use((req, res, next) => {
    const clientIp = req.ip;
    const currentCount = (requestCounts.get(clientIp) || 0) + 1;
    requestCounts.set(clientIp, currentCount);

    if (currentCount > RATE_LIMIT) {
        return res.status(429).json({ error: "Too many requests. Dev relay rate limit exceeded." });
    }

    // Reset count every hour
    setTimeout(() => requestCounts.set(clientIp, (requestCounts.get(clientIp) || 1) - 1), 3600000);

    console.log(`[DEV-RELAY] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Enable CORS for all routes - allow all origins for development
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
}));

app.use(express.json()); // Middleware to parse JSON bodies

const assistantId = ASSISTANT_ID;
const activeIntervals = new Map(); // Track intervals by request ID to avoid conflicts

// Create a thread
async function createThread() {
    console.log("Creating a new thread...");
    const thread = await openai.beta.threads.create();
    return thread;
}

// Add a message to a thread
async function addMessage(threadId, message) {
    console.log("Adding a message to thread: " + threadId);
    const response = await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: message,
    });
    return response;
}

async function runAssistant(threadId) {
    try {
        console.log("Running assistant for thread:", threadId);
        const response = await openai.beta.threads.runs.create(threadId, {
            assistant_id: assistantId,
            temperature: 0.5, // Adjusted for stability
        });
        return response;
    } catch (error) {
        if (error.response) {
            // Log the full error response for better visibility
            console.error("Assistant run failed. Full error response:", error.response.data);
        } else if (error.request) {
            // Log issues with the request (e.g., network problems)
            console.error("Assistant run failed. Request issue:", error.request);
        } else {
            // General errors
            console.error("Assistant run failed. Error message:", error.message);
        }
        throw error; // Re-throw the error for higher-level handling
    }
}

// Check status of a run and respond to client
async function checkingStatus(res, threadId, runId, responseSent) {
    if (responseSent.value) return; // Skip if a response has already been sent

    try {
        // Fix: The retrieve method signature is retrieve(runID, { thread_id: threadId })
        const runObject = await openai.beta.threads.runs.retrieve(runId, { thread_id: threadId });
        const status = runObject.status;
        console.log("Current status:", status);

        if (status === "completed") {
            // Find and clear the interval for this request
            for (const [reqId, intervalId] of activeIntervals.entries()) {
                if (reqId.includes(threadId) && reqId.includes(runId)) {
                    clearInterval(intervalId);
                    activeIntervals.delete(reqId);
                    break;
                }
            }
            try {
                const messagesList = await openai.beta.threads.messages.list(threadId);
                const messages = messagesList.body.data.map((message) => message.content);

                if (!responseSent.value) {
                    responseSent.value = true;
                    res.json({ messages });
                }
            } catch (error) {
                console.error("Error retrieving messages:", error.response?.data || error.message);
                if (!responseSent.value) {
                    responseSent.value = true;
                    res.status(500).json({ error: "Failed to retrieve messages." });
                }
            }
        } else if (status === "failed" || status === "cancelled") {
            // Find and clear the interval for this request
            for (const [reqId, intervalId] of activeIntervals.entries()) {
                if (reqId.includes(threadId) && reqId.includes(runId)) {
                    clearInterval(intervalId);
                    activeIntervals.delete(reqId);
                    break;
                }
            }
            console.error(`Run ${status}.`);
            if (!responseSent.value) {
                responseSent.value = true;
                res.status(500).json({ error: `Run ${status}. Please try again.` });
            }
        }
        // Continue polling for other statuses (e.g., in_progress, queued)
    } catch (error) {
        // Find and clear the interval for this request on error
        for (const [reqId, intervalId] of activeIntervals.entries()) {
            if (reqId.includes(threadId) && reqId.includes(runId)) {
                clearInterval(intervalId);
                activeIntervals.delete(reqId);
                break;
            }
        }
        
        console.error("Error checking run status:", error.response?.data || error.message);
        if (!responseSent.value) {
            responseSent.value = true;
            res.status(500).json({ error: "Failed to check run status." });
        }
    }
}

//=========================================================
//==================== ROUTES =============================
//=========================================================

// Route to create a new thread
app.get("/thread", async (req, res) => {
    try {
        const thread = await createThread();
        res.json({ threadId: thread.id });
    } catch (error) {
        console.error("Failed to create thread:", error);
        res.status(500).json({ error: "Failed to create thread" });
    }
});

// Route to add a message and run assistant
app.post("/message", async (req, res) => {
    const { message, threadId } = req.body;
    const responseSent = { value: false }; // Track whether a response has been sent

    try {
        if (!threadId) {
            throw new Error('threadId is required');
        }
        const messageResponse = await addMessage(threadId, message);
        const run = await runAssistant(threadId);
        
        if (!run || !run.id) {
            throw new Error(`Invalid run object: ${JSON.stringify(run)}`);
        }
        
        const runId = run.id;

        // Create a unique request ID to track this polling interval
        const requestId = `${threadId}_${runId}_${Date.now()}`;
        
        // Capture values in local constants to ensure proper closure
        const capturedThreadId = String(threadId);
        const capturedRunId = String(runId);
        
        // Use a closure-safe approach - capture values directly in the interval function
        const intervalId = setInterval(async () => {
            // Use the captured values
            await checkingStatus(res, capturedThreadId, capturedRunId, responseSent);
        }, 2000);
        
        // Store the interval so we can clear it later if needed
        activeIntervals.set(requestId, intervalId);
    } catch (error) {
        console.error("Failed to process message:", error.response?.data || error.message);
        if (!responseSent.value) {
            responseSent.value = true;
            res.status(500).json({ error: "Failed to process message." });
        }
    }
});


// Start the server
const port = PORT || 3000;
// Bind to 0.0.0.0 to allow connections from network (required for device testing)
// On device, localhost refers to the phone itself, so we need to be reachable via IP
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Accessible at http://localhost:${port} (local) or http://<your-ip>:${port} (network)`);
});
