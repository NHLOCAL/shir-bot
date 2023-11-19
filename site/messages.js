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
/*
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
    }, 700); // Adjust the delay (in milliseconds) to control when the bubble appears
  });
*/

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