// פרסומת מתחלפת לכותרת התחתונה

// Step 1: Define an array of possible content for the footer.
const footerContent = [
  "מעוניין לקבל גישה לכל 70,000 השירים שבאתר ללא הגבלה ואפילו יותר <b>ב-50% הנחה?</b> <a id='music-in-drive' href='https://docs.google.com/forms/d/e/1FAIpQLSffA3oncsWKu06mF7B5k39rz2gjMYrzYHGJAkfJIbBmuE79uQ/viewform?usp=pp_url&entry.1611797152=https://nhlocal.github.io/shir-bot' target='_blank' onclick='conversion_music_drive()'>הרשם כאן!</a>",

  "מעדיפים את האתר הישן? <a href='https://nhlocal.github.io/shir-bot/old'>למעבר מיידי</a>",
  "<b>ביט פלוס-הבית של המוזיקאים!</b> אנחנו מציעים מגוון רחב של כלי נגינה | מקצבים | הגברה | מדריכים למוזיקה <a id='beatplus' href='https://beatplus.co.il/?utm_source=nhlocal.github.io/shir-bot/' target='_blank' onclick='beatplus_ad()'>עברו לאתר</a>",
];

// Step 2: Get a reference to the footer element.
const footer = document.querySelector(".fixed-bottom p");

// Step 3: Initialize an index to keep track of the current content.
let currentIndex = 0;

// Step 4: Define a function to update the footer content.
function updateFooterContent() {
  // Set the innerHTML of the footer to the content at the current index.
  footer.innerHTML = footerContent[currentIndex];

  // Increment the index or reset it to 0 if it reaches the end.
  currentIndex = (currentIndex + 1) % footerContent.length;
}

// Step 5: Use setInterval to call the updateFooterContent function every 30 seconds.
setInterval(updateFooterContent, 3000);

// Step 6: Call the updateFooterContent function initially to display the first content.
updateFooterContent();


// מאזין אירועים ללחיצה על פרסומת
function beatplus_ad() {
    gtag('event', 'ad_click', {
      'event_category': 'Ads',
      'event_label': 'BeatPlus Ad Click' // You can customize the label
    });
}



// קוד להצגת מודעות בחזית האתר באופן אוטומטי
const newContent1 = `
  <h3>אברהם פריד</h3>
  <img src="https://upload.wikimedia.org/wikipedia/commons/3/3d/Avraham_Fried_3.jpg" width="100">
    <p style="text-align: justify"><b>אַבְרָהָם פְרִיד</b> הוא זמר ויוצר חסידי-אמריקאי בולט. מכונה "גדול הזמר החסידי".</p>
	<p style="text-align: justify">
	פריד החל את דרכו המוזיקלית בראשית שנות ה-80 של המאה ה-20 והוציא עשרות אלבומים ובהם שירים שהפכו ללהיטים. כמה מאלבומי האולפן שלו זכו למעמד אלבום פלטינה וזהב. מראשית המאה ה-21 הוא משתף פעולה גם עם יוצרים ישראלים בולטים.</p>
	<button class="helpButton" onclick='searchNow("אברהם פריד")'>חפשו "אברהם פריד"</button>
	<p><small style="text-align: right">המידע והתמונות באדיבות ויקיפדיה</small></p>
`;
const newContent2 = `
  <h3>בערי וועבר</h3>
    <p style="text-align: justify"><b>בערי וועבר</b> הוא זמר חסידי מוכר, תושב ארצות הברית, חסיד ברסלב.</p>
	<p style="text-align: justify">
	וובר נולד בניו יורק למשפחה המשתייכת לחסידות פאפא. החל לשיר בגיל 9, אם כי הקריירה שלו החלה רק עם יציאת אלבומו הראשון בשנת 2007. וובר נחשב לכוכב עולה במוזיקה החסידית ובראיון עמו באתר בחדרי חרדים הוא כונה בתואר "היורש של מב"ד".</p>
	<p style="text-align: justify">בהמשך פרש מחסידות פאפא, וכעת הוא מזוהה עם חסידות ברסלב. והחל לנסוע לאומן מדי ראש השנה ומופיע שם מול אלפי אנשים.</p>
	<button class="helpButton" onclick='searchNow("בערי וועבר")'>חפשו "בערי וועבר"</button>
	<p><small style="text-align: right">המידע והתמונות באדיבות ויקיפדיה</small></p>
`;

const newContent3 = `
  <h3>פיני איינהורן</h3>
    <p style="text-align: justify"><b>פיני איינהורן</b> הוא זמר יוצר חסידי-ישראלי, השר בסוגת המוזיקה החסידית.</p>
	<p style="text-align: justify">
	את הקריירה המוזיקלית שלו החל במקהלה של חסידות בעלזא בניצוחו של דודי קאליש. בהמשך חבר למקהלת ידידים ובהמשך פרש לטובת קריירה עצמאית.</p>
	<p style="text-align: justify">ביוני 2017 הוציא את סינגל הבכורה שלו - "ומשתוקק" בדואט יחד עם ילד הפלא ארי רייך ובליווי מקהלת ידידים בה היה חבר.</p>
	<button class="helpButton" onclick='searchNow("פיני איינהורן")'>חפשו "פיני איינהורן"</button>
	<p><small style="text-align: right">המידע והתמונות באדיבות ויקיפדיה</small></p>
`;

const contentSection = document.getElementById("instructions-container");
const prevButton = document.getElementById("prevSection");
const nextButton = document.getElementById("nextSection");

// Define an array of new content
const newContents = [newContent1, newContent2, newContent3];
let currentContentIndex = 0;
let interval; // Declare the interval variable outside the setInterval function

// Function to update the content section
function updateContent() {
    contentSection.innerHTML = newContents[currentContentIndex];
}

// Function to handle the automatic content change
function startAutoChange() {
    interval = setInterval(() => {
        currentContentIndex = (currentContentIndex + 1) % newContents.length;
        updateContent();
    },8000); // Reduced the interval to 10 seconds for the example
}

// Event listeners for previous and next buttons
prevButton.addEventListener("click", () => {
    currentContentIndex = (currentContentIndex - 1 + newContents.length) % newContents.length;
    updateContent();
    clearInterval(interval); // Reset the interval on arrow click
    startAutoChange(); // Restart the automatic change
});

nextButton.addEventListener("click", () => {
    currentContentIndex = (currentContentIndex + 1) % newContents.length;
    updateContent();
    clearInterval(interval); // Reset the interval on arrow click
    startAutoChange(); // Restart the automatic change
});

// Initial content update
updateContent();
startAutoChange(); // Start the automatic content change


// הודעת עזרה מפורטת

let currentStep = 1;

function showStep(stepChange) {
	currentStep += stepChange;
	const modalSteps = document.querySelectorAll('.help-modal');
	
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
	modalSteps[currentStep - 1].style.display = 'block';
}


function searchNow(query) {
	
	searchSongs(query, 'singer')	
}