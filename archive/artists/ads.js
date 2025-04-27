// פרסומת מתחלפת לכותרת התחתונה

// Step 1: Define an array of possible content for the footer.
const footerContent = [
  "מעוניינים להוריד שירים נוספים? עברו כעת אל&nbsp<a href='https://nhlocal.github.io/shir-bot/?utm_source=artist&utm_medium=site'>דף הבית</a>",

  "מעוניין לקבל גישה לכל 70,000 השירים שבאתר ואפילו יותר <b>ללא הגבלה?</b> <a id='music-in-drive' href='https://docs.google.com/forms/d/e/1FAIpQLSffA3oncsWKu06mF7B5k39rz2gjMYrzYHGJAkfJIbBmuE79uQ/viewform?usp=pp_url&entry.1611797152=https://nhlocal.github.io/shir-bot' target='_blank' onclick='conversion_music_drive()'>הרשם כאן!</a>",
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
setInterval(updateFooterContent, 4000);

// Step 6: Call the updateFooterContent function initially to display the first content.
updateFooterContent();