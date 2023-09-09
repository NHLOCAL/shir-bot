// מודעת שדרוגים ועדכונים
document.addEventListener("DOMContentLoaded", function() {
  // Check if the message has been shown before
  if (!localStorage.getItem("messageShown2")) {
    // Display the modal overlay
    var overlay = document.createElement("div");
    overlay.classList.add("overlay");

    var modal = document.createElement("div");
    modal.classList.add("modal");

    // Ad content
    modal.innerHTML = `
      <h2>חדש! עזרה מפורטת בליווי תמונות</h2>
      <p>מסתבכים עם השימוש במערכת? שלחתם קישור לחבריכם והם הסתבכו? קבלו את העזרה החדשה והמורחבת שתנחה אתכם צעד אחד צעד</p>
      <a href="#" id="searchButton">אישור</a>
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
    localStorage.setItem("messageShown2", "true");
  }
});




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