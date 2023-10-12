function downloadSong(songNumber) {
  var loadingMessage = document.getElementById('loadingMessage');
  loadingMessage.classList.add('show'); // Display the loading message

  var scriptUrl = 'https://script.google.com/macros/s/AKfycbyzJ9j93gbyOx1N42oJzDgFRDxPg4wsK6zCxEVNDkJb8zPzhgf5OyO6Prj4dWQWdhS-ow/exec'; // Replace with your Google Apps Script web app URL
  var downloadUrl = scriptUrl + '?songNumber=' + encodeURIComponent(songNumber);

  fetch(downloadUrl)
    .then(response => response.text())
    .then(downloadLink => {
      if (downloadLink.startsWith("https://")) {
        var link = document.createElement('a');
        link.href = downloadLink;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        loadingMessage.classList.remove('show'); // Hide the loading message on success
      } else {
        alert(data.message);
        loadingMessage.classList.remove('show'); // Hide the loading message on error
      }
    })
    .catch(error => {
      console.error("Error:", error);
      showMessage("אירעה שגיאה. בבקשה נסה שוב מאוחר יותר");
      loadingMessage.classList.remove('show'); // Hide the loading message on error
    });
}
