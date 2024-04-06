// Function to submit the form
function submitForm() {
var searchTerm = document.getElementById('searchInput').value;
var url = 'https://nhlocal.github.io/shir-bot/?search=' + encodeURIComponent(searchTerm) + '&utm_source=artist&utm_medium=site';
// Optionally, you can include the searchBy parameter as well
// var url = 'https://nhlocal.github.io/shir-bot/?search=' + encodeURIComponent(searchTerm) + '&utm_source=artist&utm_medium=site';
window.location.href = url;
}

// Event listener to submit the form when Enter key is pressed
document.getElementById("searchInput").addEventListener("keypress", function(event) {
if (event.keyCode === 13) {
  event.preventDefault();
  submitForm();
}
});



async function downloadSong(songNumber) {
  var loadingMessage = document.getElementById('loadingMessage');
  var progressText = document.getElementById('progressText');
  var progressBar = document.getElementById('progress');

  // Reset progress bar and messages
  progressText.innerText = "עובד...";
  progressBar.style.width = '15%';

  loadingMessage.classList.add('show'); // Display the loading message

  var scriptUrl = 'https://script.google.com/macros/s/AKfycbyzJ9j93gbyOx1N42oJzDgFRDxPg4wsK6zCxEVNDkJb8zPzhgf5OyO6Prj4dWQWdhS-ow/exec'; // Replace with your Google Apps Script web app URL
  var downloadUrl = scriptUrl + '?songNumber=' + encodeURIComponent(songNumber);

  try {	
	const response = await fetch(downloadUrl);
	
	progressText.innerText = "עובד...";
	progressBar.style.width = '40%';
	
	const data = await response.json();
	
	if (data.success) {
	  // Display the stages
	  progressText.innerText = "מעבד...";
	  progressBar.style.width = '60%';

	  setTimeout(async () => {
		progressText.innerText = "מוריד...";
		progressBar.style.width = '80%';

		// Background download continues here
		var link = document.createElement('a');
		link.href = data.downloadLink;
		link.download = data.originalFileName;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		// Simulate final stage
		await new Promise(resolve => setTimeout(resolve, 2000)); // Delay for 2 seconds
		progressText.innerText = "הושלם!";
		progressBar.style.width = '100%';

		await new Promise(resolve => setTimeout(resolve, 2000));
		loadingMessage.classList.remove('show'); // Hide the loading message on success
	  }, 1000);
	} else {
	  alert(data.message);
	  loadingMessage.classList.remove('show'); // Hide the loading message on error
	}
  } catch (error) {
	console.error("Error:", error);
	showMessage("אירעה שגיאה. בבקשה נסה שוב מאוחר יותר");
	loadingMessage.classList.remove('show'); // Hide the loading message on error
  }
}
