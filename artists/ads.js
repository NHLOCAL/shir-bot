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
