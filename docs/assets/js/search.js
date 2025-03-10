// assets/js/search.js

// משתנה גלובלי לאחסון נתוני CSV לאחר עיבוד
let allSongs = [];

// משתנה גלובלי לאחסון תוצאות החיפוש
let results = [];

// משתנה למעקב אחר מספר התוצאות המוצגות
let displayedResults = 0;

// כפתור סינון סינגלים
let showSinglesOnly = true;

// מערך promises למעקב אחר כל הורדה
let downloadPromises = [];

// משתנה גלובלי למעקב אחר מספר השירים שהורדו
let downloadedSongsCount = 0;

// משתנה גלובלי למעקב אחר מספר השירים הכולל להורדה
let totalSongsToDownload = 0;

// DOM Elements
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const searchBySelect = document.getElementById('searchBy');
const newsFilterButton = document.getElementById('newsFilter');
const singleFilterButton = document.getElementById('singleFilter');
const loadMoreButton = document.getElementById('loadMoreButton');
const resultsTableBody = document.querySelector('#resultsTable tbody');
const loadingMessage = document.getElementById('loadingMessage');
const progressText = document.getElementById('progressText');
const progressBar = document.getElementById('progress');

// מאזינים לאירועים
searchForm.addEventListener('submit', function(event) {
  event.preventDefault();
  const query = searchInput.value.trim().toLowerCase();
  const searchBy = searchBySelect.value;
  searchSongs(query, searchBy);
});

newsFilterButton.addEventListener('click', function(event) {
  event.preventDefault();
  searchSongs('סינגלים חדשים - תשפד', 'singer');
});

singleFilterButton.addEventListener('click', function(event) {
  event.preventDefault();
  showSinglesOnly = !showSinglesOnly;
  singleFilterButton.textContent = showSinglesOnly ? 'הצג את כל השירים' : 'הצג סינגלים בלבד';
  searchSongs(searchInput.value.trim().toLowerCase(), searchBySelect.value);
});

// פונקציות חיפוש
async function searchSongs(query, searchBy) {
  // בדיקת תקינות קלט
  if (query === '' || (query.length < 2 && !/^\d+$/.test(query))) {
    return;
  }

  // הצגת הודעת טעינה
  displayLoadingMessage();

  // טעינת נתוני CSV במידה ועדיין לא נטענו
  if (allSongs.length === 0) {
    await preloadCSVData();
  }

  // ביצוע חיפוש
  performSearch(query, searchBy);

  // עדכון ה-URL ללא רענון הדף
  updateURLWithoutReload();
}

// פונקציה להצגת הודעת טעינה
function displayLoadingMessage() {
  resultsTableBody.innerHTML = '';

  const loadingRow = document.createElement('tr');
  const loadingCell = document.createElement('td');
  loadingCell.setAttribute('colspan', '4');

  const loadingContainer = document.createElement('div');
  loadingContainer.classList.add('loading-container');

  const loadingImage = document.createElement('img');
  loadingImage.src = baseurl + '/assets/images/loading.gif';
  loadingImage.classList.add('loading-image');

  const loadingTextElem = document.createElement('p');
  loadingTextElem.textContent = 'מחפש...';
  loadingTextElem.classList.add('loading-text');

  loadingContainer.appendChild(loadingImage);
  loadingContainer.appendChild(loadingTextElem);
  loadingCell.appendChild(loadingContainer);
  loadingRow.appendChild(loadingCell);
  resultsTableBody.appendChild(loadingRow);
}

// פונקציה לטעינה מוקדמת של נתוני CSV
async function preloadCSVData() {
  const currentCSVUrl = baseurl + '/assets/data/songs.csv';
  const additionalCSVUrl = baseurl + '/assets/data/new-singles.csv';


  try {
    const [currentCSVText, additionalCSVText] = await Promise.all([
      fetchCSV(currentCSVUrl),
      fetchCSV(additionalCSVUrl)
    ]);

    const currentSongs = parseCSV(currentCSVText);
    const additionalSongs = parseCSV(additionalCSVText);
    allSongs = currentSongs.concat(additionalSongs);
    console.log('CSV data preloaded');
  } catch (error) {
    console.error('Error preloading CSV data:', error);
  }
}

// פונקציה לטעינת נתוני CSV
async function fetchCSV(url) {
  const response = await fetch(url);
  return await response.text();
}

// פונקציה לפרסור CSV לטבלה
function parseCSV(csvText) {
  const lines = csvText.split('\n');
  const songs = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      if (columns.length >= 4) {
        const song = {
          serial: columns[0].trim(),
          name: columns[1].trim(),
          album: columns[2].trim(),
          singer: columns[3].trim()
        };
        songs.push(song);
      } else {
        console.warn('Skipped a line with insufficient columns:', line);
      }
    }
  }
  return songs;
}

// פונקציית חיפוש מטושטש
function filterSongs(songs, query, searchBy) {
  if (query === '' || (query.length < 2 && !/^\d+$/.test(query))) {
    return [];
  }

  const calculateDiceCoefficient = (tokens1, tokens2) => {
    const intersection = new Set(tokens1.filter(token => tokens2.includes(token)));
    return (2 * intersection.size) / (tokens1.length + tokens2.length);
  };

  const calculateNormalizedLevenshteinDistance = (str1, str2) => {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    const matrix = Array.from({ length: len1 + 1 }, (_, i) => [i]);
    matrix[0] = Array.from({ length: len2 + 1 }, (_, i) => i);

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[len1][len2] / Math.max(len1, len2);
  };

  const queryTokens = query.split(/\s+/);
  const threshold = 0.6;

  const exactMatches = songs.filter(song => {
    const songValues = Object.values(song).map(value => value.toLowerCase());

    if (searchBy === 'all') {
      return songValues.some(value => value.includes(query));
    } else {
      const value = song[searchBy];
      if (value) {
        return value.toLowerCase().includes(query);
      }
    }
    return false;
  });

  const fuzzyMatches = songs.filter(song => {
    const songValues = Object.values(song).map(value => value.toLowerCase());

    if (searchBy === 'all') {
      return songValues.some(value => {
        const valueTokens = value.split(/\s+/);
        const similarity = calculateDiceCoefficient(queryTokens, valueTokens);
        const levenshteinDistance = calculateNormalizedLevenshteinDistance(query, value);
        return similarity >= threshold || (1 - levenshteinDistance) >= threshold;
      });
    } else {
      const value = song[searchBy];
      if (value) {
        const valueTokens = value.split(/\s+/);
        const similarity = calculateDiceCoefficient(queryTokens, valueTokens);
        const levenshteinDistance = calculateNormalizedLevenshteinDistance(query, value);
        return similarity >= threshold || (1 - levenshteinDistance) >= threshold;
      }
    }
    return false;
  });

  const combinedResults = [...new Set([...exactMatches, ...fuzzyMatches])].sort((a, b) => {
    return a.serial - b.serial;
  });

  return combinedResults;
}

// פונקציה לביצוע החיפוש והצגת התוצאות
function performSearch(query, searchBy) {
  let filteredSongs;

  if (showSinglesOnly) {
    filteredSongs = allSongs.filter(song => {
      const albumContainsSingles = song.album.toLowerCase().includes('סינגלים');
      const singerContainsSingles = song.singer.toLowerCase().includes('סינגלים');
      return albumContainsSingles || singerContainsSingles;
    });
  } else {
    filteredSongs = allSongs;
  }

  results = filterSongs(filteredSongs, query, searchBy);
  displayedResults = 250;
  displayResults(results.slice(0, displayedResults));

  loadMoreButton.style.display = results.length > displayedResults ? 'block' : 'none';
}

// פונקציה להצגת התוצאות בטבלה
function displayResults(resultsToDisplay) {
  resultsTableBody.innerHTML = '';

  if (resultsToDisplay.length === 0) {
    const instructionRow = document.createElement('tr');
    const instructionCell = document.createElement('td');
    instructionCell.setAttribute('colspan', '4');
    instructionCell.textContent = 'לא נמצאו תוצאות. אנא נסה חיפוש אחר';
    instructionRow.appendChild(instructionCell);
    resultsTableBody.appendChild(instructionRow);
  } else {
    const theadElement = document.querySelector(".custom-table thead");
    if (theadElement) {
      theadElement.style.display = "table-header-group";
    }

    resultsToDisplay.forEach(song => {
      const row = document.createElement('tr');

      // יצירת תא עבור מספר סידורי
      const serialCell = document.createElement('td');
      const serialLink = document.createElement('a');
      serialLink.textContent = song.serial;
      serialLink.addEventListener('click', function(event) {
        event.stopPropagation();
        const shareLink = window.location.origin + window.location.pathname;
        copyToClipboard(shareLink + `?search=${encodeURIComponent(song.serial)}`);
        showCopiedMessage();
      });
      serialCell.appendChild(serialLink);
      row.appendChild(serialCell);

      // יצירת תא עבור שם השיר
      const nameCell = document.createElement('td');
      nameCell.textContent = song.name;
      row.appendChild(nameCell);

      // יצירת תא עבור שם האלבום
      const albumCell = document.createElement('td');
      const albumButton = document.createElement('button');
      albumButton.textContent = song.album;
      albumButton.classList.add('album-button');
      albumButton.addEventListener('click', function(event) {
        event.preventDefault();
        searchInput.value = song.album.toLowerCase();
        searchSongs(song.album.toLowerCase(), 'album');
      });
      albumCell.appendChild(albumButton);
      row.appendChild(albumCell);

      // יצירת תא עבור שם הזמר
      const singerCell = document.createElement('td');
      const singerButton = document.createElement('button');
      singerButton.textContent = song.singer;
      singerButton.classList.add('singer-button');
      singerButton.addEventListener('click', function(event) {
        event.preventDefault();
        searchInput.value = song.singer.toLowerCase();
        searchSongs(song.singer.toLowerCase(), 'singer');
      });
      singerCell.appendChild(singerButton);
      row.appendChild(singerCell);

      // הוספת אירוע לחיצה על השורה
      row.addEventListener('click', function(event) {
        if (event.target.tagName !== 'BUTTON') {
          event.preventDefault();

          if (
            !song.album.toLowerCase().includes('סינגלים') &&
            !song.singer.toLowerCase().includes('סינגלים')
          ) {
            showMessage('באתר זה נשלחים סינגלים בלבד, נא נסה שיר אחר!');
          } else {
            downloadSong(song.serial);
          }
        }
      });

      resultsTableBody.appendChild(row);
    });
    
    // הוספת המחלקה לאחר הצגת השירים
    resultsTableBody.classList.add('songs-list');
  }
}

// פונקציה לטיפול ב"טען עוד"
loadMoreButton.addEventListener('click', loadMoreResults);

function loadMoreResults() {
  displayedResults += 250;
  displayResults(results.slice(0, displayedResults));
  loadMoreButton.style.display = results.length > displayedResults ? 'block' : 'none';
}

// פונקציה להעתקת טקסט ללוח
function copyToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
}

// פונקציה להצגת הודעת העתקה
function showCopiedMessage() {
  const message = document.createElement('div');
  message.textContent = 'הקישור הועתק ללוח';
  message.classList.add('copied-message');

  document.body.appendChild(message);

  setTimeout(() => {
    document.body.removeChild(message);
  }, 3000);
}

// פונקציה להצגת הודעה
function showMessage(messageText) {
  const message = document.createElement('div');
  message.textContent = messageText;
  message.classList.add('message');

  document.body.appendChild(message);

  setTimeout(() => {
    document.body.removeChild(message);
  }, 3000);
}

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
      // Reset progress bar and messages
      progressText.innerText = `${downloadedSongsCount + 1}/${totalSongsToDownload} מעבד...`;
      progressBar.style.width = '15%';
      loadingMessage.classList.add('show'); // Display the loading message

      const scriptUrl = 'https://script.google.com/macros/s/AKfycbyzJ9j93gbyOx1N42oJzDgFRDxPg4wsK6zCxEVNDkJb8zPzhgf5OyO6Prj4dWQWdhS-ow/exec'; // Replace with your Google Apps Script web app URL
      const downloadUrl = `${scriptUrl}?songNumber=${encodeURIComponent(songNumber)}`;

      const response = await fetch(downloadUrl);
      const data = await response.json();

      progressText.innerText = `${downloadedSongsCount + 1}/${totalSongsToDownload} מעבד...`;
      progressBar.style.width = '40%';

      if (data.success) {
        // Display the stages
        progressText.innerText = `${downloadedSongsCount + 1}/${totalSongsToDownload} מוריד...`;
        progressBar.style.width = '60%';

        setTimeout(async () => {
          progressText.innerText = `${downloadedSongsCount + 1}/${totalSongsToDownload} מוריד...`;
          progressBar.style.width = '80%';

          // Background download continues here
          const link = document.createElement('a');
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
        reject(new Error(data.message)); // Reject the promise on error
      }
    } catch (error) {
      console.error("Error:", error);
      showMessage("אירעה שגיאה. בבקשה נסה שוב מאוחר יותר");
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
  const progressPercentage = totalSongsToDownload > 0 ? Math.round((downloadedSongsCount / totalSongsToDownload) * 100) : 0;
  progressBar.style.width = `${progressPercentage}%`;
}

// פונקציה לעדכון ה-URL ללא רענון הדף
function updateURLWithoutReload() {
  const newURL = window.location.origin + window.location.pathname;
  window.history.replaceState({}, document.title, newURL);
}

// פונקציה להשלמת חיפוש אוטומטי מה-URL
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const searchValue = urlParams.get('search');

  if (searchValue) {
    searchInput.value = searchValue.toLowerCase();
    searchSongs(searchValue.toLowerCase(), 'all');

    // הסרת הפרמטרים מה-URL ללא רענון הדף
    updateURLWithoutReload();
  } else {
    preloadCSVData();
  }
});

// פונקציה להגשת טופס החיפוש
function submitForm() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  // בצע את החיפוש מבלי לשנות את ה-URL
  searchSongs(searchTerm, searchBySelect.value);
}

// Event listener לשליחת הטופס בעת לחיצה על Enter
searchInput.addEventListener("keypress", function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitForm();
  }
});