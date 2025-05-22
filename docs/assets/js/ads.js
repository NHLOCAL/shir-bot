// assets/js/ads.js

// --- Global Variables & DOM Elements ---
var baseurl = baseurl || ''; // Ensure baseurl is available
const footerAdElement = document.querySelector(".fixed-bottom p"); // For footer ad
const contentSection = document.getElementById("ad-banner-container"); // For banner ad
const prevButton = document.getElementById("prevSection"); // Banner previous button
const nextButton = document.getElementById("nextSection"); // Banner next button
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

// --- Footer Ad ---
const footerContent = [
    "קבלו גישה ל-500 ג'יגה של תוכן מוזיקלי <b>לשנה מלאה</b> <a id='music-in-drive-footer' href='https://docs.google.com/forms/d/e/1FAIpQLScfzba0porXVkKOPQR2OhY2kevGLFoPvnAkjC-Cs6KLm5idLg/viewform?usp=pp_url&entry.1611797152=https://shir-bot.ze-kal.top' target='_blank' onclick='conversion_music_drive()'>הרשמו כאן!</a>",
    "<b>ביט פלוס-הבית של המוזיקאים!</b> מגוון כלי נגינה, מקצבים, ציוד הגברה ומדריכים <a id='beatplus' href='https://beatplus.co.il?utm_source=shir-bot.ze-kal.top&utm_medium=footer_ad' target='_blank' onclick='beatplus_ad()'>בקרו באתר</a>",
];
let currentFooterIndex = 0;
let footerAdInterval; // Variable to hold the footer interval timer

function updateFooterContent() {
    if (!footerAdElement) return; // Guard clause
    footerAdElement.innerHTML = footerContent[currentFooterIndex];
    currentFooterIndex = (currentFooterIndex + 1) % footerContent.length;
}

function startFooterAutoChange() {
    if (!footerAdElement) return; // Guard clause
    clearInterval(footerAdInterval); // Clear existing interval if any
    footerAdInterval = setInterval(updateFooterContent, 5000); // Rotate every 30 seconds
}

// --- NEW: Functions to pause and resume FOOTER ad rotation ---
function pauseFooterAdRotation() {
    // console.log("Pausing footer ad rotation"); // Optional: for debugging
    clearInterval(footerAdInterval); // Stop the timer
}

function resumeFooterAdRotation() {
    // console.log("Resuming footer ad rotation"); // Optional: for debugging
    startFooterAutoChange(); // Restart the timer
}


// --- Banner Ad ---
const newContent1 = `
  <h3>מאגר המוזיקה היהודית שלך, מקיף ונגיש מתמיד</h3>
  <p>מאות ג'יגה-בייטים של מוזיקה יהודית אותנטית מחכים לך במקום אחד! המאגר שלנו כולל מגוון עצום של שירים מכל הזמנים והסגנונות - קלאסיקות נצחיות, ניגונים מרגשים ולהיטים מוכרים מעולם המוזיקה החסידית, המזרחית והיהודית. המאגר מתעדכן ומשתפר באופן שוטף כדי להבטיח שתמיד תהיה לך גישה נוחה ומהירה לכל השירים האהובים עליך, והכל במחיר מיוחד למצטרפים דרך האתר</p>
    <button class="helpButton" onclick="window.open('https://docs.google.com/forms/d/e/1FAIpQLScfzba0porXVkKOPQR2OhY2kevGLFoPvnAkjC-Cs6KLm5idLg/viewform?usp=pp_url&entry.1611797152=https://shir-bot.ze-kal.top', '_blank'); conversion_music_drive();">אני רוצה גישה למאגר המלא!</button>
`;

const newContent2 = `
  <h3>שדרגו את חווית שיר-בוט עם עדכונים, טיפים ובונוסים ייחודיים!</h3>
  <p>הירשמו לרשימת התפוצה שלנו ותקבלו ישירות למייל עדכונים על שיפורים טכניים, תכונות חדשות וטיפים שימושיים לניווט קל ויעיל באתר. כחלק מההצטרפות, תיהנו גם מהטבות בלעדיות, בונוסים מיוחדים והזדמנות להכיר את מלוא האפשרויות בשיר-בוט, להישאר תמיד מחוברים ואף להשפיע על עתידו של שלו</p>
  <button class="helpButton" onclick="window.open('https://mail.google.com/mail/u/0/?view=cm&fs=1&tf=1&source=mailto&su=%D7%A6%D7%A8%D7%A3+%D7%90%D7%95%D7%AA%D7%99+%D7%9C%D7%A8%D7%A9%D7%99%D7%9E%D7%AA+%D7%94%D7%AA%D7%A4%D7%95%D7%A6%D7%94+%D7%A9%D7%9C+%D7%A9%D7%99%D7%A8-%D7%91%D7%95%D7%98&to=shir-bot%2Bsubscribe%40googlegroups.com', '_blank')">להרשמה וקבלת הטבות בלעדיות</button>
`;

const newContent3 = `
  <h3>סוף לבלגן במוזיקה שלך! תוכנה חינמית לארגון אוטומטי</h3>
  <p>נמאס לכם לחפש שירים בתיקיות מבולגנות ולאבד זמן יקר? מסדר הסינגלים הוא הפתרון המושלם עבורכם. התוכנה החינמית הזו משתמשת בטכנולוגיית AI חכמה כדי לזהות, למיין ולארגן את כל קבצי המוזיקה שלכם באופן אוטומטי. כך תוכלו לבזבז פחות זמן על חיפושים ויותר זמן על הנאה מהמוזיקה שאתם אוהבים</p>
  <button class="helpButton" onclick="window.open('https://singles-sorter.ze-kal.top?utm_source=shir_bot_banner&utm_medium=site', '_blank')">הורדה חינם של מסדר הסינגלים</button>
`;

const newContents = [newContent1, newContent2, newContent3];
let currentContentIndex = 0; // Index for the rotating banner ad
let bannerAdInterval; // Variable to hold the banner interval timer (renamed from adInterval for clarity)

// --- Banner Ad Rotation Logic ---
function updateBannerContent() { // Renamed from updateContent for clarity
    if (!contentSection) return;
    contentSection.innerHTML = newContents[currentContentIndex];
    if (prevButton) prevButton.style.display = 'flex';
    if (nextButton) nextButton.style.display = 'flex';
}

function startBannerAutoChange() { // Renamed from startAutoChange
    if (!contentSection || !prevButton || !nextButton) {
        console.warn("Cannot start banner ad rotation: Banner elements missing.");
        return;
    }
    clearInterval(bannerAdInterval);
    bannerAdInterval = setInterval(() => {
        currentContentIndex = (currentContentIndex + 1) % newContents.length;
        updateBannerContent();
    }, 3000);
}

// --- Functions to pause and resume BANNER ad rotation ---
function pauseBannerAdRotation() { // Renamed from pauseAdRotation
    // console.log("Pausing banner ad rotation");
    clearInterval(bannerAdInterval);
}

function resumeBannerAdRotation() { // Renamed from resumeAdRotation
    // console.log("Resuming banner ad rotation");
    startBannerAutoChange();
}

// --- Help Modal Logic ---
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

// --- Initialization ---
document.addEventListener("DOMContentLoaded", function() {
    // 1. Initialize Footer Ad Rotation
    if (footerAdElement) {
        try {
            updateFooterContent(); // Initial display
            startFooterAutoChange(); // Start automatic rotation

            // *** NEW: Add hover listeners to pause/resume FOOTER rotation ***
            footerAdElement.addEventListener('mouseenter', pauseFooterAdRotation);
            footerAdElement.addEventListener('mouseleave', resumeFooterAdRotation);

        } catch (error) {
            console.error("Error initializing footer ad:", error);
        }
    }

    // 2. Initialize Banner Ad Rotation
    if (contentSection && prevButton && nextButton) {
        try {
            // Manual navigation listeners
            prevButton.addEventListener("click", () => {
                currentContentIndex = (currentContentIndex - 1 + newContents.length) % newContents.length;
                updateBannerContent();
                clearInterval(bannerAdInterval); // Reset interval timer
                startBannerAutoChange();
            });
            nextButton.addEventListener("click", () => {
                currentContentIndex = (currentContentIndex + 1) % newContents.length;
                updateBannerContent();
                clearInterval(bannerAdInterval); // Reset interval timer
                startBannerAutoChange();
            });

            // Add hover listeners to pause/resume BANNER rotation
            contentSection.addEventListener('mouseenter', pauseBannerAdRotation);
            contentSection.addEventListener('mouseleave', resumeBannerAdRotation);
            prevButton.addEventListener('mouseenter', pauseBannerAdRotation);
            prevButton.addEventListener('mouseleave', resumeBannerAdRotation);
            nextButton.addEventListener('mouseenter', pauseBannerAdRotation);
            nextButton.addEventListener('mouseleave', resumeBannerAdRotation);

            updateBannerContent(); // Initial display
            startBannerAutoChange(); // Start automatic rotation
        } catch (error) {
            console.error("Error initializing banner ad rotation:", error);
             if (prevButton) prevButton.style.display = 'none';
             if (nextButton) nextButton.style.display = 'none';
        }
    } else {
        console.warn("Ad banner container or navigation buttons not found during init.");
        if (prevButton) prevButton.style.display = 'none';
        if (nextButton) nextButton.style.display = 'none';
    }

    // 3. Initialize Help Modal Interactions
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
});