// מודעת שדרוגים ועדכונים
/* document.addEventListener("DOMContentLoaded", function() {
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
	<h1 style="color: red">הזדמנות אחרונה!</h1>
	<p>הכנסו כעת להגרלה - נותרו ימים אחרונים!</p>
	<iframe src="${iframeSrc}" style="max-width: 100%" width="400" height="350" frameborder="0" marginheight="0" marginwidth="0">טוען...</iframe>
	<br><br>
	<p><b>מעוניינים לקבל כרטיסי הגרלה נוספים?<a style="" <a href="https://nhlocal.github.io/shir-bot/register?utm_source=shir_bot_site&utm_medium=site&utm_campaign=Lottery_2023&utm_id=Lottery_2023" class="efectButton">תנו רק דקה!</a>
	  <br><br><a href="#" id="searchButton" style="margin: 0; padding: 0; border: none; background: none; color: inherit; text-decoration: underline;">לסיום ומעבר לאתר</a>
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

}); */

// פרסומת מתחלפת לכותרת התחתונה

// Step 1: Define an array of possible content for the footer.
const footerContent = [
  "<b style='color: red'>הזדמנות אחרונה!</b> לכניסה להגרלה על 4 מנויים למאגר המכיל <b>500 גי'גה של מוזיקה</b> <a href='https://nhlocal.github.io/shir-bot/register?utm_source=shir_bot_site&utm_medium=site&utm_campaign=Lottery_2023&utm_id=Lottery_2023'> הכנס עכשיו </a>",
  "<b>ביט פלוס-הבית של המוזיקאים!</b> אנחנו מציעים מגוון רחב של כלי נגינה | מקצבים | הגברה | מדריכים למוזיקה <a id='beatplus' href='https://beatplus.co.il/?utm_source=nhlocal.github.io/shir-bot/' target='_blank' onclick='beatplus_ad()'>עברו לאתר</a>",
  "מעוניין לקבל גישה לכל 70,000 השירים שבאתר ללא הגבלה ואפילו יותר <b>ב-50% הנחה?</b> <a id='music-in-drive' href='https://docs.google.com/forms/d/e/1FAIpQLSfdc9aE8pVlKKgyhhLTCuS4k_ZjFK2oGpIfMvBvagmFt1Re9Q/viewform?usp=pp_url&entry.1611797152=https://nhlocal.github.io/shir-bot' target='_blank' onclick='conversion_music_drive()'>הרשם כאן!</a>",
  "מעדיפים את האתר הישן? <a href='https://nhlocal.github.io/shir-bot/old'>למעבר מיידי</a>",
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