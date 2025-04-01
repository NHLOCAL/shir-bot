// assets/js/ads.js

// --- Global Variables & DOM Elements ---
var baseurl = baseurl || ''; // Ensure baseurl is available
const footerAdElement = document.querySelector(".fixed-bottom p"); // For footer ad
// *** UPDATED SELECTOR to target the new banner container ID ***
const contentSection = document.getElementById("ad-banner-container");
const prevButton = document.getElementById("prevSection"); // Banner previous button
const nextButton = document.getElementById("nextSection"); // Banner next button
const helpOverlay = document.querySelector(".help-overlay"); // For help modal

// --- GA Event Functions (Specific to Ads) ---
// These functions are called via onclick attributes in the ad HTML
function beatplus_ad() {
    if (typeof gtag === 'function') {
        gtag('event', 'ad_click', {
            'event_category': 'Ads',
            'event_label': 'BeatPlus Ad Click - Footer' // Specify footer
        });
    }
}

function conversion_music_drive() {
    if (typeof gtag === 'function') {
        gtag('event', 'conversion', {
            'event_category': 'Subscription',
            'event_label': 'Music Drive Signup Click' // Can specify Footer or Banner if needed
        });
    }
}

// --- Footer Ad ---
const footerContent = [
    "קבלו גישה ל-500 ג'יגה של תוכן מוזיקלי <b>לשנה מלאה</b> <a id='music-in-drive-footer' href='https://docs.google.com/forms/d/e/1FAIpQLScfzba0porXVkKOPQR2OhY2kevGLFoPvnAkjC-Cs6KLm5idLg/viewform?usp=pp_url&entry.1611797152=https://nhlocal.github.io/shir-bot' target='_blank' onclick='conversion_music_drive()'>הרשמו כאן!</a>",
    "<b>ביט פלוס-הבית של המוזיקאים!</b> מגוון כלי נגינה, מקצבים, ציוד הגברה ומדריכים <a id='beatplus' href='https://beatplus.co.il/?utm_source=nhlocal.github.io/shir-bot&utm_medium=footer_ad' target='_blank' onclick='beatplus_ad()'>בקרו באתר</a>",
];
let currentFooterIndex = 0;

function updateFooterContent() {
    if (!footerAdElement) return; // Guard clause
    footerAdElement.innerHTML = footerContent[currentFooterIndex];
    currentFooterIndex = (currentFooterIndex + 1) % footerContent.length;
}

// --- REWRITTEN AD CONTENT for Banner (Short, Focused, Text-Only) ---

const newContent1 = `
  <h3>מאגר המוזיקה היהודית הגדול בישראל!</h3>
  <p>גישה מיידית ל-500GB של שירים מכל הסגנונות והזמנים. אלבומים מלאים וסינגלים מתעדכנים - הכל במקום אחד לשנה שלמה.</p>
  <button class="helpButton" onclick="window.open('https://docs.google.com/forms/d/e/1FAIpQLScfzba0porXVkKOPQR2OhY2kevGLFoPvnAkjC-Cs6KLm5idLg/viewform?usp=pp_url&entry.1611797152=https://nhlocal.github.io/shir-bot', '_blank'); conversion_music_drive();">הצטרפו עכשיו במחיר מיוחד</button>
`;

const newContent2 = `
  <h3>אל תפספסו אף שיר חדש!</h3>
  <p>הרשמו לרשימת התפוצה שלנו וקבלו עדכונים על סינגלים חדשים, תכונות בלעדיות לאתר ובונוסים ישירות למייל שלכם.</p>
  <button class="helpButton" onclick="window.open('https://mail.google.com/mail/u/0/?view=cm&fs=1&tf=1&source=mailto&su=%D7%A6%D7%A8%D7%A3+%D7%90%D7%95%D7%AA%D7%99+%D7%9C%D7%A7%D7%91%D7%9C%D7%AA+%D7%A2%D7%93%D7%9B%D7%95%D7%A0%D7%99%D7%9D+%D7%A2%D7%9C+%D7%94%D7%90%D7%AA%D7%A8!&to=shir-bot%2Bsubscribe%40googlegroups.com', '_blank')">להרשמה מהירה</button>
`;

const newContent3 = `
  <h3>בלגן בתיקיית המוזיקה? יש פתרון!</h3>
  <p>'מסדר הסינגלים' - התוכנה החינמית שתארגן לכם את כל קבצי השירים במחשב באופן אוטומטי. מיינו לפי אמן, אלבום ועוד בקליק אחד.</p>
  <button class="helpButton" onclick="window.open('https://nhlocal.github.io/Singles-Sorter/?utm_source=shir_bot_banner&utm_medium=site', '_blank')">הורידו עכשיו בחינם</button>
`;

// Array of the rewritten ad contents
const newContents = [newContent1, newContent2, newContent3];
let currentContentIndex = 0; // Index for the rotating banner ad
let adInterval; // Variable to hold the interval timer

// --- Banner Ad Rotation Logic ---

function updateContent() {
    if (!contentSection) return; // Guard clause if banner container not found

    // Inject the HTML content into the banner container
    // Use a temporary div to parse the HTML string safely if needed,
    // but direct innerHTML is usually fine for trusted content like this.
    contentSection.innerHTML = newContents[currentContentIndex];

    // Re-enable or ensure visibility of prev/next buttons *after* content is set.
    // They are part of the static HTML structure now, just need display style.
    if (prevButton) prevButton.style.display = 'flex'; // Use 'flex' due to centering styles
    if (nextButton) nextButton.style.display = 'flex'; // Use 'flex' due to centering styles

    // Note: No need to re-attach listeners for buttons with onclick attributes.
    // If a button uses an ID like '#helpButton' for the general help modal,
    // the listener attachment logic (or delegation) in Initialization is needed.
}

function startAutoChange() {
    // Ensure required elements exist before starting interval
    if (!contentSection || !prevButton || !nextButton) {
        console.warn("Cannot start ad rotation: Banner elements missing.");
        return;
    }
    clearInterval(adInterval); // Clear existing interval if any
    adInterval = setInterval(() => {
        currentContentIndex = (currentContentIndex + 1) % newContents.length;
        updateContent();
    }, 15000); // Rotate every 15 seconds
}

// --- Help Modal Logic ---
// Assumes help modal HTML exists in the main layout or index.html
let currentStep = 1; // Tracks the current step in a multi-step help modal

function showStep(stepChange) {
    if (!helpOverlay) return;
	currentStep += stepChange;
	const modalSteps = helpOverlay.querySelectorAll('.help-modal'); // Find steps inside overlay

    if (!modalSteps || modalSteps.length === 0) return; // No steps found

	// Clamp step index within bounds
	if (currentStep < 1) {
		currentStep = 1;
	} else if (currentStep > modalSteps.length) {
		currentStep = modalSteps.length;
	}

	// Hide all steps
	modalSteps.forEach(step => {
		step.style.display = 'none';
	});

	// Show the current step
	if (modalSteps[currentStep - 1]) {
	    modalSteps[currentStep - 1].style.display = 'block';
    }
}

function openHelp() {
    if (helpOverlay) {
        helpOverlay.style.display = "flex"; // Show the overlay
        currentStep = 1; // Reset to first step when opening
        showStep(0); // Show the initial step
    } else {
        console.warn("Help overlay element not found.");
    }
}

function closeHelp() {
	if (helpOverlay) {
	    helpOverlay.style.display = 'none'; // Hide the overlay
    }
}

// --- Small Singer Suggestion Ads Logic (REMOVED) ---
// The functions getRandomSingerData, generateSmallAdHTML, updateSmallAds,
// and related DOM selectors (leftSmallAdContainer, rightSmallAdContainer)
// have been removed as they are no longer relevant to the current banner design.

// --- Initialization ---
document.addEventListener("DOMContentLoaded", function() {
    // 1. Initialize Footer Ad Rotation
    if (footerAdElement) {
        try {
            updateFooterContent(); // Initial display
            setInterval(updateFooterContent, 30000); // Rotate every 30 seconds
        } catch (error) {
            console.error("Error initializing footer ad:", error);
        }
    }

    // 2. Initialize Banner Ad Rotation
    if (contentSection && prevButton && nextButton) {
        try {
            // Add click listeners for manual navigation
            prevButton.addEventListener("click", () => {
                currentContentIndex = (currentContentIndex - 1 + newContents.length) % newContents.length;
                updateContent();
                // Optional: Reset interval timer on manual change to prevent immediate auto-change
                clearInterval(adInterval);
                startAutoChange();
            });

            nextButton.addEventListener("click", () => {
                currentContentIndex = (currentContentIndex + 1) % newContents.length;
                updateContent();
                // Optional: Reset interval timer
                clearInterval(adInterval);
                startAutoChange();
            });

            updateContent(); // Initial display of the first ad
            startAutoChange(); // Start automatic rotation
        } catch (error) {
            console.error("Error initializing banner ad rotation:", error);
            // Attempt to hide buttons if setup fails
             if (prevButton) prevButton.style.display = 'none';
             if (nextButton) nextButton.style.display = 'none';
        }
    } else {
        // Log if elements are missing, hide buttons if they exist but container doesn't
        console.warn("Ad banner container or navigation buttons not found during init.");
        if (prevButton) prevButton.style.display = 'none';
        if (nextButton) nextButton.style.display = 'none';
    }

    // 3. Initialize Help Modal Interactions
    // Using event delegation on the body for the help button is robust
    document.body.addEventListener('click', function(event){
        // Check if the clicked element *is* the help button OR is inside the help modal close button
        if(event.target && event.target.id === 'helpButton' && typeof openHelp === 'function'){
             openHelp();
        }
        // Example: Add a class 'close-help-button' to your close button inside the modal
        if (event.target && event.target.classList.contains('close-help-button') && typeof closeHelp === 'function') {
             closeHelp();
        }
    });

    // Add listener to close help modal if clicking outside the content area (on the overlay)
     if(helpOverlay) {
         helpOverlay.addEventListener('click', function(event){
             // Check if the click target is the overlay itself, not its content
             if(event.target === helpOverlay && typeof closeHelp === 'function'){
                 closeHelp();
             }
         });
         // Initialize help modal steps (hide all except first) on load
         const modalSteps = helpOverlay.querySelectorAll('.help-modal');
         if (modalSteps && modalSteps.length > 0) {
             modalSteps.forEach((step, index) => {
                 step.style.display = index === 0 ? 'block' : 'none';
             });
         }
     }

    // 4. Small Ads Initialization (REMOVED)
    // No longer initializing updateSmallAds()

});