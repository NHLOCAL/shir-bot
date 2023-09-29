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


// Function to set a cookie with an expiration date
function setCookie(name, value, daysToExpire) {
  var expirationDate = new Date();
  expirationDate.setTime(expirationDate.getTime() + (daysToExpire * 24 * 60 * 60 * 1000));
  var expires = "expires=" + expirationDate.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

// Usage example: Set a cookie named "myCookie" with a value "cookieValue" that expires in 7 days
setCookie("myCookie", "cookieValue", 7);



// בועת המלצה לחפש בתוך 70 אלף שירים
  document.addEventListener("DOMContentLoaded", function() {
    const textBubble = document.getElementById("textBubble");
    const searchInput = document.getElementById("searchInput");

    searchInput.addEventListener("focus", function() {
      textBubble.classList.remove("active");
    });

    searchInput.addEventListener("input", function() {
      textBubble.classList.remove("active");
    });

    setTimeout(function() {
      textBubble.classList.add("active");
    }, 1000); // Adjust the delay (in milliseconds) to control when the bubble appears
  });





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

function closeHelp() {
	const overlay = document.querySelector('.help-overlay');
	overlay.style.display = 'none';
}

document.addEventListener("DOMContentLoaded", function () {
    // Get a reference to the Help button
    const helpButton = document.getElementById("helpButton");

    // Get a reference to the Help overlay
    const overlay = document.querySelector(".help-overlay");

    // Add a click event listener to the Help button
    helpButton.addEventListener("click", function () {
        // Show the Help overlay
        overlay.style.display = "flex"; // Display the overlay when the button is clicked
    });
});


// Get a reference to the element by its id
const nextObject = document.getElementById("nextObject");

// Add a click event listener
nextObject.addEventListener("click", function() {
// Re-enter the current page without refreshing
window.location.href = window.location.href;
});



// Function to show a message in the center modal overlay
function showMessage(message) {
var modalOverlay = document.getElementById('modalOverlay');
var modalMessage = document.getElementById('modalMessage');
var modalOkButton = document.getElementById('modalOkButton');

modalMessage.textContent = message;
modalOverlay.style.display = 'flex'; // Display the modal overlay

// Add event listener to OK button
modalOkButton.addEventListener('click', hideMessage);

// Add event listener to document to close on click anywhere
document.addEventListener('click', function(event) {
  if (event.target === modalOverlay) {
	hideMessage();
  }
});

// Add event listener to document to close on Enter key press
document.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
	hideMessage();
  }
});
}

// Function to hide the modal overlay
function hideMessage() {
var modalOverlay = document.getElementById('modalOverlay');
modalOverlay.style.display = 'none'; // Hide the modal overlay
}