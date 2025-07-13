var baseurl = baseurl || ''; // Ensure baseurl is available
const footerAdElement = document.querySelector(".fixed-bottom p"); // For footer ad
const helpOverlay = document.querySelector(".help-overlay"); // For help modal
// --- GA Event Functions (Specific to Ads) ---
function beatplus_ad() {
    if (typeof gtag === 'function') {
        gtag('event', 'ad_click', {
            'event_category': 'Ads',
            'event_label': 'BeatPlus Ad Click - Footer'
        });
    }
}
function conversion_music_drive() {
    if (typeof gtag === 'function') {
        gtag('event', 'conversion', {
            'event_category': 'Subscription',
            'event_label': 'Music Drive Signup Click'
        });
    }
}
const footerContent = [
    "קבלו גישה ל-500 ג'יגה של תוכן מוזיקלי <b>לשנה מלאה</b> <a id='music-in-drive-footer' href='https://docs.google.com/forms/d/e/1FAIpQLScfzba0porXVkKOPQR2OhY2kevGLFoPvnAkjC-Cs6KLm5idLg/viewform?usp=pp_url&entry.1611797152=https://shir-bot.ze-kal.top' target='_blank' onclick='conversion_music_drive()'>הרשמו כאן!</a>",
    "<b>ביט פלוס-הבית של המוזיקאים!</b> מגוון כלי נגינה, מקצבים, ציוד הגברה ומדריכים <a id='beatplus' href='https://beatplus.co.il?utm_source=shir-bot.ze-kal.top&utm_medium=footer_ad' target='_blank' onclick='beatplus_ad()'>בקרו באתר</a>",
];
let currentFooterIndex = 0;
let footerAdInterval;
function updateFooterContent() {
    if (!footerAdElement) return;
    footerAdElement.innerHTML = footerContent[currentFooterIndex];
    currentFooterIndex = (currentFooterIndex + 1) % footerContent.length;
}
function startFooterAutoChange() {
    if (!footerAdElement) return;
    clearInterval(footerAdInterval);
    footerAdInterval = setInterval(updateFooterContent, 5000);
}
function pauseFooterAdRotation() {
    clearInterval(footerAdInterval);
}
function resumeFooterAdRotation() {
    startFooterAutoChange();
}
let currentStep = 1;
function showStep(stepChange) {
    if (!helpOverlay) return;
	currentStep += stepChange;
	const modalSteps = helpOverlay.querySelectorAll('.help-modal');
    if (!modalSteps || modalSteps.length === 0) return;
	if (currentStep < 1) currentStep = 1;
	else if (currentStep > modalSteps.length) currentStep = modalSteps.length;
	modalSteps.forEach(step => step.style.display = 'none');
	if (modalSteps[currentStep - 1]) modalSteps[currentStep - 1].style.display = 'block';
}
function openHelp() {
    if (helpOverlay) {
        helpOverlay.style.display = "flex";
        currentStep = 1;
        showStep(0);
    } else {
        console.warn("Help overlay element not found.");
    }
}
function closeHelp() {
	if (helpOverlay) helpOverlay.style.display = 'none';
}
function initializeSidebarAds() {
    const sidebars = document.querySelectorAll('.ad-sidebar');
    if (sidebars.length === 0) return;
    const fadeTimers = new Map();
    const fadeOutAd = (sidebar) => {
        sidebar.classList.remove('is-visible');
        sidebar.classList.add('is-faded');
    };
    const startFadeTimer = (sidebar) => {
        if (fadeTimers.has(sidebar)) {
            clearTimeout(fadeTimers.get(sidebar));
        }
        const timerId = setTimeout(() => {
            fadeOutAd(sidebar);
            fadeTimers.delete(sidebar);
        }, 10000); // 10 seconds to show
        fadeTimers.set(sidebar, timerId);
    };
    // Attach hover listeners to all sidebars regardless of initial state
    sidebars.forEach(sidebar => {
        sidebar.addEventListener('mouseenter', () => {
            sidebar.classList.add('is-visible');
            sidebar.classList.remove('is-faded');
            if (fadeTimers.has(sidebar)) {
                clearTimeout(fadeTimers.get(sidebar));
                fadeTimers.delete(sidebar);
            }
        });
        sidebar.addEventListener('mouseleave', () => {
            startFadeTimer(sidebar);
        });
    });
    // Check if the initial animation has already played in this session
    const animationPlayed = sessionStorage.getItem('shirBotAdAnimationPlayed');
    if (animationPlayed) {
        // If it has played, start the ads in their faded state immediately
        console.log("Sidebar Ads: Animation already played this session. Starting in faded state.");
        sidebars.forEach(sidebar => {
            sidebar.classList.add('is-faded');
        });
    } else {
        // If it's the first time, run the full animation and set the flag
        console.log("Sidebar Ads: First view this session. Playing animation.");
        sessionStorage.setItem('shirBotAdAnimationPlayed', 'true');
        setTimeout(() => {
            sidebars.forEach(sidebar => {
                sidebar.classList.add('is-visible');
                startFadeTimer(sidebar); // Start the 10-second timer to fade out
            });
        }, 5000); // 5 seconds initial delay
    }
}
document.addEventListener("DOMContentLoaded", function() {
    if (footerAdElement) {
        try {
            updateFooterContent();
            startFooterAutoChange();
            footerAdElement.addEventListener('mouseenter', pauseFooterAdRotation);
            footerAdElement.addEventListener('mouseleave', resumeFooterAdRotation);
        } catch (error) {
            console.error("Error initializing footer ad:", error);
        }
    }
    document.body.addEventListener('click', function(event){
        if(event.target && event.target.id === 'helpButton' && typeof openHelp === 'function'){
             openHelp();
        }
        if (event.target && event.target.classList.contains('close-help-button') && typeof closeHelp === 'function') {
             closeHelp();
        }
    });
     if(helpOverlay) {
         helpOverlay.addEventListener('click', function(event){
             if(event.target === helpOverlay && typeof closeHelp === 'function'){
                 closeHelp();
             }
         });
         const modalSteps = helpOverlay.querySelectorAll('.help-modal');
         if (modalSteps && modalSteps.length > 0) {
             modalSteps.forEach((step, index) => {
                 step.style.display = index === 0 ? 'block' : 'none';
             });
         }
     }
    initializeSidebarAds();
});