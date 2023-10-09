// מודעת שדרוגים ועדכונים
document.addEventListener("DOMContentLoaded", function() {
  // Check if the message has been shown before
  if (!localStorage.getItem("messageShown1")) {
    // Display the modal overlay
    var overlay = document.createElement("div");
    overlay.classList.add("overlay");

    var modal = document.createElement("div");
    modal.classList.add("modal");

    // Ad content
    modal.innerHTML = `
      <h2>הגרלה על פרסים במאות שקלים במתנה!</h2>
      <p>הכנסו עכשיו להגרלה על 4 מנויים למאגר מוזיקה בדרייב המכיל <b>500 גי'גה</b> של תוכן מוזיקלי ויותר!</p><br>
		<p><b>פרס ראשון:</b><br>
		מנוי חינם למאגר המוזיקלי בדרייב מזמן הזכייה ועד ינואר 2025 + מנוי לחבר לבחירתכם! - בשווי 300 ₪</p><br>

		<p><b>פרס שני ופרס שלישי:</b><br>
		לפרטים מלאים לחצו על הכפתור ועברו להרשמה...</p>
      <a href="https://nhlocal.github.io/shir-bot/register?sourcemail=campaign&utm_source=shir_bot_site&utm_medium=site&utm_campaign=Lottery_2023&utm_id=Lottery_2023" class="efectButton">אני רוצה לקבל כרטיס!</a>
	  <br><br><a href="#" id="searchButton" style="margin: 0; padding: 0; border: none; background: none; color: inherit; text-decoration: underline;">לדילוג ומעבר לאתר</a>
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

    // Mark the message as shown in local storage
    localStorage.setItem("messageShown", "true");
  } else {

  // Define the reset date as 'yyyy-mm-dd' format (e.g., '2023-09-26')
  const resetDate = '2023-10-09';
  const currentDate = new Date().toLocaleDateString('en-US');

  // Check if the current date has passed the reset date
  if (currentDate > resetDate) {
    // Reset the message display status
    localStorage.removeItem('messageShown1');
    }
  }

});


// פרסומת מתחלפת לכותרת התחתונה

// Step 1: Define an array of possible content for the footer.
const footerContent = [
  "רוצים להכנס בחינם להגרלה על 4 מנויים למאגר המכיל <b>500 גי'גה של מוזיקה</b>? <a href='https://nhlocal.github.io/shir-bot/register?sourcemail=campaign&utm_source=shir_bot_site&utm_medium=site&utm_campaign=Lottery_2023&utm_id=Lottery_2023'>הירשם כעת!</a>",
  "מעדיפים את האתר הישן? <a href='https://nhlocal.github.io/shir-bot/old'>למעבר מיידי</a>",
  "מעוניינים לקבל גישה למאגר המוזיקלי המלא <b>ב-50% הנחה?</b> <a id='music-in-drive' href='https://forms.gle/couZadvYGJ41hhYs7' target='_blank' onclick='conversion_music_drive()'>הרשמו כאן!</a>",
  "<b>טיפ:</b> נסו להעביר את העכבר על שם אמן או אלבום וללחוץ עליו!",
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

