// מודעת שדרוגים ועדכונים
/*
document.addEventListener("DOMContentLoaded", function() {
  // Check if the message has been shown during the current visit
  if (!localStorage.getItem("messageShown4")) {
    // Display the modal overlay
    var overlay = document.createElement("div");
    overlay.classList.add("overlay");

    var modal = document.createElement("div");
    modal.classList.add("modal");

    // Ad content
    modal.innerHTML = `
      <h2>ההגרלה הגדולה - רשימת הזוכים</h2>
      <p><b>פרס ראשון:</b></p><p>הזוכה הוא - si*******4@gmail.com</p>
      <p><b>פרס שני:</b></p><p>הזוכה הוא - e******9@gmail.com</p>
      <p><b>פרס שלישי:</b></p><p>הזוכה הוא - m**********2@gmail.com</p>
      <br><p>הודעה נמסרה לזוכים במייל</p>
      <a style="" <a href="#" id="searchButton">אישור</a>
      <br><br><a href="https://nhlocal.github.io/shir-bot/old" id="searchButton" style="margin: 0; padding: 0; border: none; background: none; color: inherit; text-decoration: underline;">לכניסה לאתר הישן</a>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close the modal overlay and move to the search input when clicking "אישור"
    var searchButton = document.getElementById("searchButton");
    searchButton.addEventListener("click", function(event) {
      event.preventDefault();
      overlay.remove();
      var searchInput = document.querySelector("#searchInput");
      if (searchInput) {
        searchInput.focus();
      }

      // Set local storage to indicate that the message has been shown during the current visit
      localStorage.setItem("messageShown4", "true");

      // Set a cookie with an expiration date of 30 days
      var expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);
      document.cookie = "messageShown4=true; expires=" + expirationDate.toUTCString() + "; path=/";
    });

    // Close the modal overlay when clicking outside the modal content
    overlay.addEventListener("click", function(event) {
      if (event.target === overlay) {
        overlay.remove();
      }
    });
  }
});
*/




// פרסומת מתחלפת לכותרת התחתונה

// Step 1: Define an array of possible content for the footer.
const footerContent = [
  "מעוניין לקבל גישה לכל 70,000 השירים שבאתר ללא הגבלה ואפילו יותר <b>לשנה מלאה?</b> <a id='music-in-drive' href='https://docs.google.com/forms/d/e/1FAIpQLSffA3oncsWKu06mF7B5k39rz2gjMYrzYHGJAkfJIbBmuE79uQ/viewform?usp=pp_url&entry.1611797152=https://nhlocal.github.io/shir-bot' target='_blank' onclick='conversion_music_drive()'>הרשם כאן!</a>",

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
setInterval(updateFooterContent, 8000);

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
const newContent2 = `
<h3>תפילה להצלחת המערכה</h3>
	  <p style="text-align: justify"><b><small>א</small></b> לַמְנַצֵּחַ מִזְמוֹר לְדָוִד:  <b><small>ב</small></b> שְׁמַע אֱלֹהִים קוֹלִי בְשִׂיחִי מִפַּחַד אוֹיֵב תִּצֹּר חַיָּי:  <b><small>ג</small></b> תַּסְתִּירֵנִי מִסּוֹד מְרֵעִים מֵרִגְשַׁת פֹּעֲלֵי אָוֶן: <b><small>ד</small></b> אֲשֶׁר שָׁנְנוּ כַחֶרֶב לְשׁוֹנָם דָּרְכוּ חִצָּם דָּבָר מָר: <b><small>ה</small></b> לִירוֹת בַּמִּסְתָּרִים תָּם פִּתְאֹם יֹרֻהוּ וְלֹא יִירָאוּ: <b><small>ו</small></b> יְחַזְּקוּ לָמוֹ דָּבָר רָע יְסַפְּרוּ לִטְמוֹן מוֹקְשִׁים אָמְרוּ מִי יִרְאֶה לָּמוֹ: <b><small>ז</small></b> יַחְפְּשׂוּ עוֹלֹת תַּמְנוּ חֵפֶשׂ מְחֻפָּשׂ וְקֶרֶב אִישׁ וְלֵב עָמֹק: <b><small>ח</small></b> וַיֹּרֵם אֱלֹהִים חֵץ פִּתְאוֹם הָיוּ מַכּוֹתָם:<b><small>ט</small></b> וַיַּכְשִׁילוּהוּ עָלֵימוֹ לְשׁוֹנָם יִתְנֹדֲדוּ כָּל רֹאֵה בָם: <b><small>י</small></b> וַיִּירְאוּ כָּל אָדָם וַיַּגִּידוּ פֹּעַל אֱלֹהִים וּמַעֲשֵׂהוּ הִשְׂכִּילוּ: <b><small>יא</small></b> יִשְׂמַח צַדִּיק בַּיהוָה וְחָסָה בוֹ וְיִתְהַלְלוּ כָּל יִשְׁרֵי לֵב:</p>
	  <button class="helpButton" id="helpButton" onclick='openHelp()'>לחץ כאן לקבלת עזרה מפורטת</button>
`;

const newContent1 = `
      <h3 style="animation: colorTransition 2s infinite;">
      קבלו גישה מלאה ל-70,000 שירים בדרייב
    </h3>
  <p>מעוניינים לקבל גישה לכלל השירים שבאתר? הרשמו כעת, וקבלו גישה למאגר המלא בדרייב</p>

  <p>המאגר כולל מגוון רחב של ז'אנרים, כולל מוזיקה חסידית, מזרחית, ישראלית, אלטרנטיבית, מוזיקה קלאסית ועוד ועוד</p>
  <p>באמצעות המאגר תוכלו להוריד קבצים ולצפות במאגר ללא הגבלה. נצלו את האפשרות להירשם לשנה מלאה בסכום מינימלי!</p>

  <button class="helpButton" onclick="window.open('https://docs.google.com/forms/d/e/1FAIpQLSffA3oncsWKu06mF7B5k39rz2gjMYrzYHGJAkfJIbBmuE79uQ/viewform?usp=pp_url&entry.1611797152=https://nhlocal.github.io/shir-bot', '_blank'); conversion_music_drive();">קבלו גישה עכשיו</button>
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
<button class="helpButton" onclick="window.open('https://nhlocal.github.io/Singles-Sorter/?utm_source=shir_bot&utm_medium=site', '_blank')">להורדת התוכנה</button>
`;

const contentSection = document.getElementById("instructions-container");
const prevButton = document.getElementById("prevSection");
const nextButton = document.getElementById("nextSection");

// Define an array of new content
const newContents = [newContent1, newContent2, newContent3, newContent4];
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
    },12000); // Reduced the interval to 10 seconds for the example
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


// Function to fetch random singer's name and sample songs from the CSV file and singer list from a text file
async function getRandomSingerData() {
  try {
      // Fetch singer list from text file
      const singersResponse = await fetch('https://nhlocal.github.io/shir-bot/artists/singers_list.txt');
      const singersData = await singersResponse.text();
      const singersList = singersData.split('\n').map(singer => singer.trim());

      // Fetch songs from CSV file
      const songsResponse = await fetch('https://nhlocal.github.io/shir-bot/site/new-songs.csv');
      const songsData = await songsResponse.text();
      const lines = songsData.split('\n');

      // Select a random singer
      const singerName = singersList[Math.floor(Math.random() * singersList.length)];

      // Filter songs that belong to the selected singer
      const singerSongs = lines.filter(line => {
          const lineData = line.split(',');
          return lineData.length === 4 && lineData[3].trim() === singerName;
      }).map(song => song.split(',')[1].trim()); // Get song name from column B

      // Select 4 random sample songs
      const sampleSongs = [];
      while (sampleSongs.length < 4 && singerSongs.length > 0) {
          const randomIndex = Math.floor(Math.random() * singerSongs.length);
          sampleSongs.push(singerSongs.splice(randomIndex, 1)[0]);
      }

      return { singerName, sampleSongs };
  } catch (error) {
      console.error('Error fetching singer data:', error);
      return null;
  }
}

// Function to generate HTML content for small ads
async function generateSmallAdHTML() {
  const singerData1 = await getRandomSingerData();
  const singerData2 = await getRandomSingerData();
  if (singerData1 && singerData2) {
      // Construct HTML for small ads
      const smallAdHTML1 = `
      <div class="small-ad-top">
          <br>
          <p class="ad-text">נסה לחפש את...</p>
          <button class="helpButton" onclick="searchSongs('${singerData1.singerName}', 'singer')">${singerData1.singerName}</button>
          <p class="title-song-list">מבחר משירי ${singerData1.singerName}</p> <!-- Added class for styling -->
          <ul class="song-list">
              <li>${singerData1.sampleSongs[0]}</li>
              <li>${singerData1.sampleSongs[1]}</li>
              <li>${singerData1.sampleSongs[2]}</li>
              <li>${singerData1.sampleSongs[3]}</li>
          </ul>
      </div>
  `;
  
  const smallAdHTML2 = `
      <div class="small-ad-bottom">
          <br>
          <p class="ad-text">נסה לחפש את...</p>
          <button class="helpButton" onclick="searchSongs('${singerData2.singerName}', 'singer')">${singerData2.singerName}</button>
          <p class="title-song-list">מבחר משירי ${singerData2.singerName}</p> <!-- Added class for styling -->
          <ul class="song-list">
              <li>${singerData2.sampleSongs[0]}</li>
              <li>${singerData2.sampleSongs[1]}</li>
              <li>${singerData2.sampleSongs[2]}</li>
              <li>${singerData2.sampleSongs[3]}</li>
          </ul>
      </div>
  `;
  
      return smallAdHTML1 + smallAdHTML2;
  } else {
      // Handle error or no data retrieved
      return '';
  }
}


// Update the content of the left and right small ad containers
async function updateSmallAds() {
  const leftSmallAdContainer = document.querySelector(".small-ad-left");
  const rightSmallAdContainer = document.querySelector(".small-ad-right");

  // Replace inner HTML of left and right small ad containers with small ad content
  leftSmallAdContainer.innerHTML = await generateSmallAdHTML();
  rightSmallAdContainer.innerHTML = await generateSmallAdHTML();
}

// Initial update of small ads
updateSmallAds();
