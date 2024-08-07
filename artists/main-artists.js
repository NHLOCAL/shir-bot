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


// הגדרת progressBar  באופן גלובלי
var progressBar = document.getElementById('progress'); 

// מערך promises למעקב אחר כל הורדה
let downloadPromises = [];

// משתנה גלובלי למעקב אחר מספר השירים שהורדו
let downloadedSongsCount = 0;

// משתנה גלובלי למעקב אחר מספר השירים הכולל להורדה
let totalSongsToDownload = 0;

// פונקציה להורדת שיר
async function downloadSong(songNumber) {
  // איפוס משתנים גלובליים לפני תחילת ההורדה
  if (downloadPromises.length === 0) {
    downloadedSongsCount = 0;
    totalSongsToDownload = 0;
  }

  totalSongsToDownload++; // הגדלת מספר השירים הכולל להורדה

  // יצירת promise עבור ההורדה הנוכחית
  const downloadPromise = new Promise(async (resolve, reject) => {
    try {
      var loadingMessage = document.getElementById('loadingMessage');
      var progressText = document.getElementById('progressText');
      var progressBar = document.getElementById('progress');

      // Reset progress bar and messages
      progressText.innerText = `${downloadedSongsCount + 1}/${totalSongsToDownload} מעבד...`;
      progressBar.style.width = '15%';

      loadingMessage.classList.add('show'); // Display the loading message

      var scriptUrl = 'https://script.google.com/macros/s/AKfycbyzJ9j93gbyOx1N42oJzDgFRDxPg4wsK6zCxEVNDkJb8zPzhgf5OyO6Prj4dWQWdhS-ow/exec'; // Replace with your Google Apps Script web app URL
      var downloadUrl = scriptUrl + '?songNumber=' + encodeURIComponent(songNumber);

      const response = await fetch(downloadUrl);

      progressText.innerText = `${downloadedSongsCount + 1}/${totalSongsToDownload} מעבד...`;
      progressBar.style.width = '40%';

      const data = await response.json();

      if (data.success) {
        // Display the stages
        progressText.innerText = `${downloadedSongsCount + 1}/${totalSongsToDownload} מוריד...`;
        progressBar.style.width = '60%';

        setTimeout(async () => {
          progressText.innerText = `${downloadedSongsCount + 1}/${totalSongsToDownload} מוריד...`;
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
          progressText.innerText = `${downloadedSongsCount + 1}/${totalSongsToDownload} הושלם!`;
          progressBar.style.width = '100%';

          downloadedSongsCount++; // הגדלת מספר השירים שהורדו

          resolve(); // Resolve the promise after successful download
        }, 1000);
      } else {
        alert(data.message);
        // progressBar.style.width = `0%`;
        reject(new Error(data.message)); // Reject the promise on error
      }
    } catch (error) {
      console.error("Error:", error);
      showMessage("אירעה שגיאה. בבקשה נסה שוב מאוחר יותר");
      // progressBar.style.width = `0%`;
      reject(error); // Reject the promise on error
    }
  });

  // הוספת promise למערך
  downloadPromises.push(downloadPromise);

  // עדכון הודעת ההורדה וסרגל ההתקדמות
  updateProgress();

  // טיפול ב-promise לאחר סיום ההורדה (הצלחה או כישלון)
  downloadPromise
    .finally(() => {
      // הסרת promise מהמערך
      downloadPromises = downloadPromises.filter(p => p !== downloadPromise);

      // עדכון הודעת ההורדה וסרגל ההתקדמות
      updateProgress();

      // בדיקה האם כל ההורדות הסתיימו
      if (downloadPromises.length === 0) {
        progressText.innerText = `הורדת ${downloadedSongsCount}/${totalSongsToDownload} הושלמה!`;
        progressBar.style.width = `100%`;

        // איפוס המשתנים הגלובליים לאחר סיום כל ההורדות
        setTimeout(() => {
          downloadedSongsCount = 0;
          totalSongsToDownload = 0;
          loadingMessage.classList.remove('show'); // Hide the loading message on success
        }, 2000);
      }
    });
}

// פונקציה לעדכון הודעת ההורדה וסרגל ההתקדמות
function updateProgress() {
  const downloadingCount = downloadPromises.length;

  if (downloadingCount > 0) {
    progressText.innerText = `מוריד ${downloadingCount} שירים...`;
  }

  // חישוב אחוז ההתקדמות
  const progressPercentage = Math.round((downloadedSongsCount / totalSongsToDownload) * 100);
  progressBar.style.width = `${progressPercentage}%`;
}