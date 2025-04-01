// assets/js/ads.js

// --- Global Variables & DOM Elements ---
var baseurl = baseurl || ''; // Ensure baseurl is available
const footerAdElement = document.querySelector(".fixed-bottom p"); // Moved selector here
const contentSection = document.getElementById("instructions-container");
const prevButton = document.getElementById("prevSection");
const nextButton = document.getElementById("nextSection");
const leftSmallAdContainer = document.querySelector(".small-ad-left");
const rightSmallAdContainer = document.querySelector(".small-ad-right");
const helpOverlay = document.querySelector(".help-overlay");

// --- GA Event Functions (Specific to Ads) ---
function beatplus_ad() {
    gtag('event', 'ad_click', {
        'event_category': 'Ads',
        'event_label': 'BeatPlus Ad Click'
    });
}

function conversion_music_drive() {
     gtag('event', 'conversion', {
        'event_category': 'Subscription',
        'event_label': 'Music Drive Signup Click'
     });
}

// --- Footer Ad ---
const footerContent = [
    "קבל כעת גישה ל-500 ג'יגה של תוכן מוזיקלי <b>לשנה מלאה</b> <a id='music-in-drive' href='https://docs.google.com/forms/d/e/1FAIpQLScfzba0porXVkKOPQR2OhY2kevGLFoPvnAkjC-Cs6KLm5idLg/viewform?usp=pp_url&entry.1611797152=https://nhlocal.github.io/shir-bot' target='_blank' onclick='conversion_music_drive()'>הרשם כאן!</a>",
    "<b>ביט פלוס-הבית של המוזיקאים!</b> אנחנו מציעים מגוון רחב של כלי נגינה | מקצבים | הגברה | מדריכים למוזיקה <a id='beatplus' href='https://beatplus.co.il/?utm_source=nhlocal.github.io/shir-bot/' target='_blank' onclick='beatplus_ad()'>עברו לאתר</a>",
];
let currentFooterIndex = 0; // Renamed to avoid potential conflicts

function updateFooterContent() {
    if (!footerAdElement) return; // Guard clause
    footerAdElement.innerHTML = footerContent[currentFooterIndex];
    currentFooterIndex = (currentFooterIndex + 1) % footerContent.length;
}

// קוד להצגת מודעות בחזית האתר באופן אוטומטי
const newContent1 = `
<h3>תהילים נגד טילים</h3>
	  <p style="text-align: justify">לַמְנַצֵּ֗חַ מִזְמ֥וֹר לְדָוִֽד׃ יַֽעַנְךָ֣ יְ֭הוָה בְּי֣וֹם צָרָ֑ה יְ֝שַׂגֶּבְךָ֗ שֵׁ֤ם ׀ אֱלֹהֵ֬י יַֽעֲקֹֽב׃ יִשְׁלַֽח־עֶזְרְךָ֥ מִקֹּ֑דֶשׁ וּ֝מִצִּיּ֗וֹן יִסְעָדֶֽךָּ׃ יִזְכֹּ֥ר כָּל־מִנְחֹתֶ֑ךָ וְעוֹלָֽתְךָ֖ יְדַשְּׁנֶ֣ה סֶֽלָה׃ יִֽתֶּן־לְךָ֥ כִלְבָבֶ֑ךָ וְֽכָל־עֲצָתְךָ֥ יְמַלֵּֽא׃ נְרַנְּנָ֤ה ׀ בִּ֘ישׁ֤וּעָתֶ֗ךָ וּבְשֵֽׁם־אֱלֹהֵ֥ינוּ נִדְגֹּ֑ל יְמַלֵּ֥א יְ֝הוָ֗ה כָּל־מִשְׁאֲלוֹתֶֽיךָ׃ עַתָּ֤ה יָדַ֗עְתִּי כִּ֤י הוֹשִׁ֥יעַ ׀ יְהוָ֗ה מְשִׁ֫יח֥וֹ יַֽ֭עֲנֵהוּ מִשְּׁמֵ֣י קָדְשׁ֑וֹ בִּ֝גְבֻר֗וֹת יֵ֣שַׁע יְמִינֽוֹ׃ אֵ֣לֶּה בָ֭רֶכֶב וְאֵ֣לֶּה בַסּוּסִ֑ים וַֽאֲנַ֓חְנוּ בְּשֵׁם־יְהוָ֖ה אֱלֹהֵ֣ינוּ נַזְכִּֽיר׃ הֵ֭מָּה כָּֽרְע֣וּ וְנָפָ֑לוּ וַֽאֲנַ֥חְנוּ קַּ֝֗מְנוּ וַנִּתְעוֹדָֽד׃ יְהוָ֥ה הוֹשִׁ֑יעָה הַ֝מֶּ֗לֶךְ יַֽעֲנֵ֥נוּ בְיוֹם־קָרְאֵֽנוּ׃</p>
	  <button class="helpButton" id="helpButton" onclick='openHelp()'>לחץ כאן לקבלת עזרה מפורטת</button>
`;

const newContent2 = `
<h3 style="
  font-size: 2em;
  animation: pulseFade 3s infinite ease-in-out;
  text-align: center;
">
גישה מלאה ל-500 ג'יגה של תוכן מוזיקלי לשנה מלאה!
</h3>

<style>
  @keyframes pulseFade {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.05);
      opacity: 0.8;
    }
  }
</style>

  <p>קבלו גישה מלאה לכל התכנים באתר ועוד הרבה יותר לשנה מלאה</p>

  <p>500 ג'יגה של שירים יהודיים מכל הזמנים ומכל הסגנונות. חסידי, מזרחי, קלאסי ואלטרנטיבי. וגם תכני שמע נוספים. תוכן עדכני וגם תכנים נדירים שלא תמצאו בשום מקום אחר! </p>
  <p><b>זה ההזדמנות שלכם לקבל מקסימום תוכן במינימום מחיר!</b></p>

  <button class="helpButton" onclick="window.open('https://docs.google.com/forms/d/e/1FAIpQLScfzba0porXVkKOPQR2OhY2kevGLFoPvnAkjC-Cs6KLm5idLg/viewform?usp=pp_url&entry.1611797152=https://nhlocal.github.io/shir-bot', '_blank'); conversion_music_drive();">קבלו גישה עכשיו</button>
`;


const newContent3 = `
  <h3>הרשמו לקבלת עדכונים</h3>
  <p>הרשמו כעת לרשימת התפוצה של שיר בוט, כדי לקבל את העדכונים והחידושים האחרונים באתר<br><br>
  בהמשך צפויים בונוסים ותכונות מיוחדות לרשומים בלבד</p>
  <p>בין הבונוסים: אפשרות הורדה של מספר שירים בו זמנית, אפשרות להשפיע על התכונות והשיפורים העתידיים באתר, עדכון על פיצ'רים ושדרוגים ועוד</p>
  <button class="helpButton" onclick="window.open('https://mail.google.com/mail/u/0/?view=cm&fs=1&tf=1&source=mailto&su=%D7%A6%D7%A8%D7%A3+%D7%90%D7%95%D7%AA%D7%99+%D7%9C%D7%A7%D7%91%D7%9C%D7%AA+%D7%A2%D7%93%D7%9B%D7%95%D7%A0%D7%99%D7%9D+%D7%A2%D7%9C+%D7%94%D7%90%D7%AA%D7%A8!&to=shir-bot%2Bsubscribe%40googlegroups.com', '_blank')">לרישום מיידי</button>
`;

const newContent4 = `
<h3>בלאגן במחשב? זה הפתרון</h3><p>מיואשים מחוסר הסדר בתיקיות המוזיקה שלכם?<br><br>קבלו את התוכנה שתבצע לכם סדר בקבצי המוזיקה שלכם בתוך דקות!<br><br>התוכנה פועלת באמצעות מערכות אוטומציה מתוחכמות בשילוב מגוון של כלים</p>
<img style="border-radius: 1%; max-width: 70%; height: auto;" src="https://github.com/NHLOCAL/Singles-Sorter/blob/main/versions.data/program-screen.png?raw=true" alt="צילום מסך - מסדר הסינגלים">
<br>
<button class="helpButton" onclick="window.open('https://nhlocal.github.io/Singles-Sorter/?utm_source=shir_bot&utm_medium=site', '_blank')">להורדת התוכנה</button>
`;

const newContents = [newContent2, newContent3, newContent4]; // Assuming newContent1 was temporary/unused
let currentContentIndex = 0;
let adInterval; // Declare the interval variable

function updateContent() {
    if (!contentSection) return; // Guard clause
    contentSection.innerHTML = newContents[currentContentIndex];
     // Re-attach help button listener if needed after innerHTML change
     const helpButton = contentSection.querySelector("#helpButton");
     if(helpButton) {
        helpButton.onclick = openHelp; // Re-assign if using direct onclick
        // Or use addEventListener if preferred
     }
}

function startAutoChange() {
    if (!contentSection || !prevButton || !nextButton) return; // Guard if elements missing
    clearInterval(adInterval); // Clear existing interval if any
    adInterval = setInterval(() => {
        currentContentIndex = (currentContentIndex + 1) % newContents.length;
        updateContent();
    }, 15000);
}

// --- Help Modal ---
let currentStep = 1;

function showStep(stepChange) {
	currentStep += stepChange;
	const modalSteps = document.querySelectorAll('.help-modal'); // Assuming these are inside the overlay

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
        helpOverlay.style.display = "flex";
        currentStep = 1; // Reset to first step
        showStep(0); // Show the initial step
    }
}

function closeHelp() {
	if (helpOverlay) {
	    helpOverlay.style.display = 'none';
    }
}

// --- Small Singer Suggestion Ads ---
async function getRandomSingerData() {
    // Check if data files exist - return null if configured paths are invalid
    if (!baseurl || typeof baseurl !== 'string') {
        console.error("Base URL not configured for fetching data.");
        return null;
    }
    const singersListPath = baseurl + '/assets/data/singers_list.txt';
    const songsCsvPath = baseurl + '/assets/data/songs.csv'; // Assuming this path is now valid

    try {
        // Fetch singer list
        const singersResponse = await fetch(singersListPath);
        if (!singersResponse.ok) throw new Error(`Failed to fetch singers list: ${singersResponse.statusText}`);
        const singersData = await singersResponse.text();
        const singersList = singersData.split('\n').map(singer => singer.trim()).filter(Boolean);
        if (singersList.length === 0) throw new Error("Singers list is empty or invalid.");


        // Fetch songs from CSV file
        const songsResponse = await fetch(songsCsvPath);
        if (!songsResponse.ok) throw new Error(`Failed to fetch songs CSV: ${songsResponse.statusText}`);
        const songsData = await songsResponse.text();
        const lines = songsData.split('\n');

        // Select a random singer
        const singerName = singersList[Math.floor(Math.random() * singersList.length)];

        // Filter songs for the selected singer
        const singerSongs = lines
            .map(line => line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)) // CSV parsing robust to commas in quotes
            .filter(lineData => lineData.length >= 4 && lineData[3]?.trim() === singerName)
            .map(lineData => lineData[1]?.trim()) // Get song name (column B, index 1)
            .filter(Boolean); // Remove empty song names

        // Select 4 random sample songs
        const sampleSongs = [];
        let attempts = 0; // Prevent infinite loop if not enough songs
        while (sampleSongs.length < 4 && singerSongs.length > 0 && attempts < 20) {
            const randomIndex = Math.floor(Math.random() * singerSongs.length);
            sampleSongs.push(singerSongs.splice(randomIndex, 1)[0]);
            attempts++;
        }

        // Fill remaining slots if fewer than 4 unique songs were found
        while (sampleSongs.length < 4) {
            sampleSongs.push("..."); // Placeholder
        }


        return { singerName, sampleSongs };
    } catch (error) {
        console.error('Error fetching singer data:', error);
        // Don't display ads if data fetching fails
        return null;
    }
}

// Function to trigger search from ad buttons (assuming search.js is loaded on the page)
function searchFromAd(query, type) {
    if (typeof searchSongs === 'function') {
         // Find the search input and set its value
         const searchInputElem = document.getElementById('searchInput');
         if (searchInputElem) {
            searchInputElem.value = query;
         }
         // Set the active filter visually (assuming filter buttons exist)
         document.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('active'));
         const filterButton = document.querySelector(`.filter-button[data-filter="${type}"]`);
         if (filterButton) {
            filterButton.classList.add('active');
         }
         // Call the main search function from search.js
         searchSongs(query, type);
    } else {
        // Fallback: Redirect to index page with search parameters if searchSongs isn't available
        window.location.href = `${baseurl}/?search=${encodeURIComponent(query)}&searchBy=${type}`;
    }
}


async function generateSmallAdHTML(singerData) {
    if (!singerData) return ''; // Return empty if data is null

    // Use the searchFromAd function for the button click
    return `
        <div class="small-ad-box"> <!-- Changed class for potential styling -->
            <br>
            <p class="ad-text">נסה לחפש את...</p>
            <button class="helpButton" onclick="searchFromAd('${singerData.singerName}', 'singer')">${singerData.singerName}</button>
            <p class="title-song-list">מבחר משירי ${singerData.singerName}</p>
            <ul class="song-list">
                <li>${singerData.sampleSongs[0] || '...'}</li>
                <li>${singerData.sampleSongs[1] || '...'}</li>
                <li>${singerData.sampleSongs[2] || '...'}</li>
                <li>${singerData.sampleSongs[3] || '...'}</li>
            </ul>
        </div>
    `;
}


async function updateSmallAds() {
    if (!leftSmallAdContainer || !rightSmallAdContainer) return; // Guard clauses

    const singerData1 = await getRandomSingerData();
    const singerData2 = await getRandomSingerData();

    // Generate HTML only if data was fetched successfully
    leftSmallAdContainer.innerHTML = await generateSmallAdHTML(singerData1);
    rightSmallAdContainer.innerHTML = await generateSmallAdHTML(singerData2);
}


// --- Initialization ---
document.addEventListener("DOMContentLoaded", function() {
    // Initialize Footer Ad
    if (footerAdElement) {
        setInterval(updateFooterContent, 30000);
        updateFooterContent(); // Initial display
    }

    // Initialize Instructions Ad Rotator
    if (contentSection && prevButton && nextButton) {
        prevButton.addEventListener("click", () => {
            currentContentIndex = (currentContentIndex - 1 + newContents.length) % newContents.length;
            updateContent();
            startAutoChange(); // Reset interval on manual change
        });

        nextButton.addEventListener("click", () => {
            currentContentIndex = (currentContentIndex + 1) % newContents.length;
            updateContent();
            startAutoChange(); // Reset interval on manual change
        });

        updateContent(); // Initial display
        startAutoChange(); // Start automatic rotation
    }

    // Initialize Help Modal Button (assuming the button exists in the initial HTML or is added by updateContent)
    // Using event delegation on a parent container might be more robust if the button is dynamically added/removed
    document.body.addEventListener('click', function(event){
        if(event.target && event.target.id === 'helpButton'){
             openHelp();
        }
        // Add listener for close button if it exists within the help modal overlay
        const closeBtn = helpOverlay?.querySelector('.close-help-button'); // Add a class/id to your close button
        if (closeBtn && event.target === closeBtn) {
            closeHelp();
        }
    });
     // Also close help modal on overlay click
     if(helpOverlay) {
         helpOverlay.addEventListener('click', function(event){
             if(event.target === helpOverlay){
                 closeHelp();
             }
         });
     }


    // Initialize Small Ads (if placeholders exist)
    if (leftSmallAdContainer && rightSmallAdContainer) {
       updateSmallAds();
    }

    // Initial setup for help modal steps (hide all except first)
     if (helpOverlay) {
        const modalSteps = helpOverlay.querySelectorAll('.help-modal');
        modalSteps.forEach((step, index) => {
            step.style.display = index === 0 ? 'block' : 'none';
        });
     }
});