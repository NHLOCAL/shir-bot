// מודעת שדרוגים ועדכונים
/*
 document.addEventListener("DOMContentLoaded", function() {
  // Check if the message has been shown before
  if (!localStorage.getItem("messageShown")) {
    // Display the modal overlay
    var overlay = document.createElement("div");
    overlay.classList.add("overlay");

    var modal = document.createElement("div");
    modal.classList.add("modal");

	const mailValue = 'Last-Chance';
	
	var iframeSrc = 'https://docs.google.com/forms/d/e/1FAIpQLSf92occd-B1zfRIJ9UPaFvVeVNTfvu8gxK5M5HEbTGVgPWSUA/viewform?entry.181289636=' + mailValue + '&viewform?embedded=true';
	
    // Ad content
    modal.innerHTML = `
	<h2>תקלה באתר</h2>
	<p>לצערינו, עקב תקלה חמורה, ההורדה מהאתר לא פעילה כרגע. עדיין ניתן לסייר באתר ולבצע חיפוש</p>
	<p>כרגע ניתן להשתמש באתר הישן ולקבל את השירים למייל</p>
	<a style="" <a href="https://nhlocal.github.io/shir-bot/old">לאתר הישן</a>
		  <br><br><a href="#" id="searchButton" style="margin: 0; padding: 0; border: none; background: none; color: inherit; text-decoration: underline;">לכניסה לאתר הרגיל</a>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close the modal overlay and move to the search input when clicking "חפש שירים עכשיו"
    var searchButton = document.getElementById("searchButton");
    searchButton.addEventListener("click", function(event) {
      event.preventDefault();
      overlay.remove();
      var searchInput = document.querySelector("#searchInput");
      if (searchInput) {
        searchInput.focus();
      }
    });

    // Close the modal overlay when clicking outside the modal content
    overlay.addEventListener("click", function(event) {
      if (event.target === overlay) {
        overlay.remove();
      }
    });

  } else {

  // Define the reset date as 'yyyy-mm-dd' format (e.g., '2023-09-26')
  const resetDate = '2023-10-25';
  const currentDate = new Date().toLocaleDateString('en-US');

  // Check if the current date has passed the reset date
  if (currentDate > resetDate) {
    // Reset the message display status
    localStorage.removeItem('messageShown');
    }
  }

});
*/

// פרסומת מתחלפת לכותרת התחתונה

// Step 1: Define an array of possible content for the footer.
const footerContent = [
  "מעדיפים את האתר הישן? <a href='https://nhlocal.github.io/shir-bot/old'>למעבר מיידי</a>",
  "<b>ביט פלוס-הבית של המוזיקאים!</b> אנחנו מציעים מגוון רחב של כלי נגינה | מקצבים | הגברה | מדריכים למוזיקה <a id='beatplus' href='https://beatplus.co.il/?utm_source=nhlocal.github.io/shir-bot/' target='_blank' onclick='beatplus_ad()'>עברו לאתר</a>",
  "מעוניין לקבל גישה לכל 70,000 השירים שבאתר ללא הגבלה ואפילו יותר <b>ב-50% הנחה?</b> <a id='music-in-drive' href='https://docs.google.com/forms/d/e/1FAIpQLSfdc9aE8pVlKKgyhhLTCuS4k_ZjFK2oGpIfMvBvagmFt1Re9Q/viewform?usp=pp_url&entry.1611797152=https://nhlocal.github.io/shir-bot' target='_blank' onclick='conversion_music_drive()'>הרשם כאן!</a>",
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
setInterval(updateFooterContent, 10000);

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
<h3>תהילים להצלחת המערכה</h3>
	  <p style="text-align: justify"><b><small>א</small></b> לַמְנַצֵּחַ מִזְמוֹר לְדָוִד:  <b><small>ב</small></b> שְׁמַע אֱלֹהִים קוֹלִי בְשִׂיחִי מִפַּחַד אוֹיֵב תִּצֹּר חַיָּי:  <b><small>ג</small></b> תַּסְתִּירֵנִי מִסּוֹד מְרֵעִים מֵרִגְשַׁת פֹּעֲלֵי אָוֶן: <b><small>ד</small></b> אֲשֶׁר שָׁנְנוּ כַחֶרֶב לְשׁוֹנָם דָּרְכוּ חִצָּם דָּבָר מָר: <b><small>ה</small></b> לִירוֹת בַּמִּסְתָּרִים תָּם פִּתְאֹם יֹרֻהוּ וְלֹא יִירָאוּ: <b><small>ו</small></b> יְחַזְּקוּ לָמוֹ דָּבָר רָע יְסַפְּרוּ לִטְמוֹן מוֹקְשִׁים אָמְרוּ מִי יִרְאֶה לָּמוֹ: <b><small>ז</small></b> יַחְפְּשׂוּ עוֹלֹת תַּמְנוּ חֵפֶשׂ מְחֻפָּשׂ וְקֶרֶב אִישׁ וְלֵב עָמֹק: <b><small>ח</small></b> וַיֹּרֵם אֱלֹהִים חֵץ פִּתְאוֹם הָיוּ מַכּוֹתָם:<b><small>ט</small></b> וַיַּכְשִׁילוּהוּ עָלֵימוֹ לְשׁוֹנָם יִתְנֹדֲדוּ כָּל רֹאֵה בָם: <b><small>י</small></b> וַיִּירְאוּ כָּל אָדָם וַיַּגִּידוּ פֹּעַל אֱלֹהִים וּמַעֲשֵׂהוּ הִשְׂכִּילוּ: <b><small>יא</small></b> יִשְׂמַח צַדִּיק בַּיהוָה וְחָסָה בוֹ וְיִתְהַלְלוּ כָּל יִשְׁרֵי לֵב:</p>
	  <button class="helpButton" id="helpButton" onclick='openHelp()'>לחץ כאן לקבלת עזרה מפורטת</button>
`;
const newContent2 = `
<h3>נסו את האתר הישן</h3><p>נתקלים בבעיות בשימוש או בהורדה? נסו את האתר הישן וקבלו את השירים באמצעות שליחת מייל<br><br>שימו לב כי האתר הישן אינו מתעדכן כרגע בשירים חדשים או בשיפורי ממשק</p>
<button class="helpButton" onclick="location.href='https://nhlocal.github.io/shir-bot/old'">למעבר לאתר הישן</button>
`;
const newContent3 = `
<h3>בלאגן במחשב? זה הפתרון</h3><p>מיואשים מכמויות הבלאגן במאגרי המוזיקה שלכם?<br><br>קבלו את התוכנה שתבצע לכם סדר בקבצי המוזיקה שלכם בתוך דקות!<br><br>התוכנה פועלת באמצעות מערכות אוטומציה מתוחכמות בשילוב מגוון של כלים</p>
<img style="border-radius: 1%; max-width: 70%; height: auto;" src="https://github.com/NHLOCAL/Singles-Sorter/blob/main/versions.data/program-screen.png?raw=true" alt="צילום מסך - מסדר הסינגלים">
<button class="helpButton" onclick="location.href='https://nhlocal.github.io/Singles-Sorter/?utm_source=shir_bot&utm_medium=site'">להורדת התוכנה</button>
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
    }, 25000); // Reduced the interval to 10 seconds for the example
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

function openHelp() {
    // Get a reference to the Help button
    // Get a reference to the Help button
    const helpButton = document.getElementById("helpButton");

    // Get a reference to the Help overlay
    const overlay = document.querySelector(".help-overlay");

    // Show the Help overlay
    overlay.style.display = "flex"; // Display the overlay when the button is clicked
}

function closeHelp() {
	const overlay = document.querySelector('.help-overlay');
	overlay.style.display = 'none';
}