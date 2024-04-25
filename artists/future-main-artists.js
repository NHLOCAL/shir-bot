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
  var loadingMessageContainer = document.getElementById('loadingMessage'); // Get the loading message container

  // Create a new progress bar container element
  var progressBarContainer = document.createElement('div');
  progressBarContainer.classList.add('progress-bar-container');
  progressBarContainer.innerHTML = `
    <img src="https://nhlocal.github.io/shir-bot/site/loading.gif" alt="טעינה">
    <span id="progressText"></span>
    <div class="progress-bar">
      <div id="progress" class="progress"></div>
    </div>
  `;

  // Reset progress bar width and text content
  progressBarContainer.querySelector('#progress').style.width = '0';
  progressBarContainer.querySelector('#progressText').innerText = '';

  // Append the progress bar container as a child of the loading message container
  loadingMessageContainer.appendChild(progressBarContainer);

  // Reset progress bar and messages
  var progressText = progressBarContainer.querySelector('#progressText');
  var progressBar = progressBarContainer.querySelector('#progress');
  progressText.innerText = "עובד...";
  progressBar.style.width = '15%';
  var scriptUrl = 'https://script.google.com/macros/s/AKfycbyzJ9j93gbyOx1N42oJzDgFRDxPg4wsK6zCxEVNDkJb8zPzhgf5OyO6Prj4dWQWdhS-ow/exec'; // Replace with your Google Apps Script web app URL
  var downloadUrl = scriptUrl + '?songNumber=' + encodeURIComponent(songNumber);

  try {  
    const response = await fetch(downloadUrl);

    progressText.innerText = "עובד...";
    progressBar.style.width = '40%';

    const data = await response.json();

    if (data.success) {
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
        loadingMessageContainer.removeChild(progressBarContainer); // Remove the progress bar container on success
      }, 1000);
    } else {
      alert(data.message);
      loadingMessageContainer.removeChild(progressBarContainer); // Remove the progress bar container on error
    }
  } catch (error) {
    console.error("Error:", error);
    showMessage("אירעה שגיאה. בבקשה נסה שוב מאוחר יותר");
    loadingMessageContainer.removeChild(progressBarContainer); // Remove the progress bar container on error
  }
}

