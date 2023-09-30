// מודעת שדרוגים ועדכונים
document.addEventListener("DOMContentLoaded", function() {
  // Check if the message has been shown before
  if (!localStorage.getItem("messageShown")) {
    // Display the modal overlay
    var overlay = document.createElement("div");
    overlay.classList.add("overlay");

    var modal = document.createElement("div");
    modal.classList.add("modal");

    // Ad content
    modal.innerHTML = `
      <h2>מערכת חדשה עם הורדה ישירה!</h2>
      <p>לאחר טרחה מרובה, אנו שמחים להציג לכם את המערכת המשודרגת שלנו!</p>
      <p>כעת תוכלו להוריד שירים ישירות למחשב ללא כניסה למייל.	בנוסף, קיצרנו את זמני החיפוש וייעלנו את טעינת התוצאות.	ופיצ'ר מועיל נוסף - חיפוש זמר/אלבום בלחיצה על השם הרצוי ברשימת השירים</p>
      <a href="#" class="efectButton" id="searchButton">לנסות עכשיו!</a>
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
    
    searchButton.focus();

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
  const resetDate = '2023-09-26';
  const currentDate = new Date().toLocaleDateString('en-US');

  // Check if the current date has passed the reset date
  if (currentDate > resetDate) {
    // Reset the message display status
    localStorage.removeItem('messageShown');
    }
  }
});



// פרסומת מתחלפת לכותרת התחתונה

// Step 1: Define an array of possible content for the footer.
const footerContent = [
  "מעדיפים את האתר הישן? <a>למעבר מיידי</a>",
  "מעוניינים לקבל גישה למאגר המוזיקלי המלא <b>ב-50% הנחה?</b> <a id='music-in-drive' href='https://forms.gle/couZadvYGJ41hhYs7' target='_blank'>הרשמו כאן!</a>",
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
