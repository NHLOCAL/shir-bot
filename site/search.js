document.getElementById('searchForm').addEventListener('submit', function(event) {
  event.preventDefault();
  var searchInput = document.getElementById('searchInput').value.toLowerCase();
  var searchBy = document.getElementById('searchBy').value;
  searchSongs(searchInput, searchBy);
});



// הצגת הסינגלים החדשים
document.getElementById('newsFilter').addEventListener('click', function() {
  event.preventDefault(); // Prevent form submission
  // Call the searchSongs function with the specified parameters
  searchSongs('סינגלים חדשים - תשפד', 'singer');
});

// חיפוש אוטומטי של שיר בקישור עם פרמטר
const urlParams = new URLSearchParams(window.location.search);
const searchValue = urlParams.get('search');

window.addEventListener('DOMContentLoaded', (event) => {
  const searchInput = document.getElementById('searchInput');
  searchInput.value = searchValue || ''; // Set the value if 'search' parameter exists, or set it to an empty string if not.
});

window.addEventListener('DOMContentLoaded', (event) => {
  const searchInput = document.getElementById('searchInput');
  const searchValue = urlParams.get('search');
  searchInput.value = searchValue || '';

  if (searchValue) {
    // Simulate search if 'search' parameter is present.
    const searchBy = document.getElementById('searchBy').value;
    searchSongs(searchValue, searchBy);
  }
});


var results; // Declare results at the global level

var singleFilterButton = document.getElementById('singleFilter');
var showSinglesOnly = true;

singleFilterButton.addEventListener('click', function() {
  showSinglesOnly = !showSinglesOnly;

  if (showSinglesOnly) {
    this.textContent = 'הצג את כל השירים';
  } else {
    this.textContent = 'הצג סינגלים בלבד';
  }
});



function searchSongs(query, searchBy) {
  var searchInput = document.getElementById('searchInput');
  searchInput.value = query; // Fill the search term into the search input
  // Check if the query string is empty or less than two letters/one number
  if (query.trim() === '' || (query.trim().length < 2 && !/^\d$/.test(query.trim()))) {
    return; // Do not perform a search
  }
  
  var tableBody = document.querySelector('#resultsTable tbody');

  tableBody.innerHTML = ''; // Clear the table body
  
  var loadingRow = document.createElement('tr');
  var loadingCell = document.createElement('td');
  loadingCell.setAttribute('colspan', '4');
  
  var loadingContainer = document.createElement('div');
  loadingContainer.classList.add('loading-container');
  
  var loadingImage = document.createElement('img');
  loadingImage.src = 'site/loading.gif';
  loadingImage.classList.add('loading-image');
  
  var loadingText = document.createElement('p');
  loadingText.textContent = 'מחפש...';
  loadingText.classList.add('loading-text');
  
  loadingContainer.appendChild(loadingImage);
  loadingContainer.appendChild(loadingText);
  loadingCell.appendChild(loadingContainer);
  loadingRow.appendChild(loadingCell);
  tableBody.appendChild(loadingRow);

// Define the URLs for both CSV files
const currentCSVUrl = 'https://nhlocal.github.io/shir-bot/site/new-songs.csv';
const additionalCSVUrl = 'https://nhlocal.github.io/shir-bot/site/new-singles.csv'; // Replace with the actual URL

// Create a function to fetch CSV data
function fetchCSV(url) {
  return fetch(url)
    .then(function (response) {
      return response.text();
    });
}

// Fetch data from both CSV files in parallel
Promise.all([fetchCSV(currentCSVUrl), fetchCSV(additionalCSVUrl)])
  .then(function ([currentCSVText, additionalCSVText]) {
    // Parse both CSV data
    const currentSongs = parseCSV(currentCSVText);
    const additionalSongs = parseCSV(additionalCSVText);

    // Combine both sets of songs
    const allSongs = currentSongs.concat(additionalSongs);

    // Apply the selected filter method
    var filteredSongs;
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
    displayResults(results.slice(0, 250)); // Display the initial 100 results

    // Show the "Load more" button after a search is performed
    loadMoreButton.style.display = 'block';
  });


}



function parseCSV(csvText) {
  var lines = csvText.split('\n');
  var songs = [];
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line) {
      var columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      if (columns.length >= 4) {
        var song = {
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



// סינון התוצאות עם חיפוש מטושטש
function filterSongs(songs, query, searchBy) {
  // Check if the query string is empty or less than two letters/one number
  if (query.trim() === '' || (query.trim().length < 2 && !/^\d$/.test(query.trim()))) {
    return []; // Return an empty array when the query is invalid
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

  const queryTokens = query.toLowerCase().split(/\s+/); // Convert query into tokens
  const threshold = 0.6; // Fuzzy search threshold
  const maxLevenshteinDistance = 0.3; // Maximum normalized Levenshtein distance for relevance
  const exactMatchRelevance = 2; // Relevance score for exact string matches

  const exactMatches = songs.filter(function(song) {
    const songValues = Object.values(song).map(function(value) {
      return value.toLowerCase();
    });

    if (searchBy === 'all') {
      // Check for exact string matches
      return songValues.some(function(value) {
        return value.includes(query);
      });
    } else {
      const value = song[searchBy];
      if (value) {
        return value.includes(query);
      }
    }
    return false;
  });

  const fuzzyMatches = songs.filter(function(song) {
    const songValues = Object.values(song).map(function(value) {
      return value.toLowerCase();
    });

    if (searchBy === 'all') {
      // Perform fuzzy search across all properties
      const relevanceScores = songValues.map(function(value) {
        const valueTokens = value.split(/\s+/);
        const similarity = calculateDiceCoefficient(queryTokens, valueTokens);
        const levenshteinDistance = calculateNormalizedLevenshteinDistance(query, value);
        return Math.max(similarity, 1 - levenshteinDistance); // Calculate relevance score
      });

      return relevanceScores.some(function(score) {
        return score >= threshold;
      });
    } else {
      const value = song[searchBy];
      if (value) {
        const valueTokens = value.toLowerCase().split(/\s+/);
        const similarity = calculateDiceCoefficient(queryTokens, valueTokens);
        const levenshteinDistance = calculateNormalizedLevenshteinDistance(query, value);
        const relevanceScore = Math.max(similarity, 1 - levenshteinDistance); // Calculate relevance score
        return relevanceScore >= threshold;
      }
    }
    return false;
  });

  // Combine exact and fuzzy matches while ensuring uniqueness
  const results = [...new Set([...exactMatches, ...fuzzyMatches])].sort(function(a, b) {
    // Sort results in descending order of relevance score
    const relevanceScoreA = calculateRelevanceScore(a);
    const relevanceScoreB = calculateRelevanceScore(b);
    return relevanceScoreB - relevanceScoreA;
  });

  return results;

  function calculateRelevanceScore(song) {
    const songValues = Object.values(song).map(function(value) {
      return value.toLowerCase();
    });

    const relevanceScores = songValues.map(function(value) {
      const valueTokens = value.split(/\s+/);
      const similarity = calculateDiceCoefficient(queryTokens, valueTokens);
      const levenshteinDistance = calculateNormalizedLevenshteinDistance(query, value);
      const exactMatchBonus = value.includes(query) ? exactMatchRelevance : 0;
      return Math.max(similarity, 1 - levenshteinDistance) + exactMatchBonus; // Calculate relevance score with bonus for exact matches
    });

    return Math.max(...relevanceScores);
  }
}



function displayResults(resultsToDisplay) {
  var tableBody = document.querySelector('#resultsTable tbody');
  
  var table = document.getElementById('resultsTable');
  table.classList.add('custom-table');

  // Clear the table body
  tableBody.innerHTML = '';

  if (resultsToDisplay.length === 0) {
    // Display instructions and explanations when no results are found
    var instructionRow = document.createElement('tr');
    var instructionCell = document.createElement('td');
    instructionCell.setAttribute('colspan', '4');
    instructionCell.textContent = 'לא נמצאו תוצאות. אנא נסה חיפוש אחר';
    instructionRow.appendChild(instructionCell);
    tableBody.appendChild(instructionRow);
  } else {
    const theadElement = document.querySelector(".custom-table thead");
    theadElement.style.display = "table-header-group";

    // Display the search results for the specified range.
    for (var i = 0; i < resultsToDisplay.length; i++) {
      var song = resultsToDisplay[i];
      var row = document.createElement('tr');

      // Create cells for each column in the table
      var serialCell = document.createElement('td');
      var nameCell = document.createElement('td');
      var albumCell = document.createElement('td');
      var singerCell = document.createElement('td');

      // Create a link for the serial number
      var serialLink = document.createElement('a');
      serialLink.textContent = song.serial;

      // Update the event listener to target the entire row
      row.addEventListener('click', createRowClickListener(song));

      // Create a button for the album
      var albumButton = document.createElement('button');
      albumButton.textContent = song.album;
      albumButton.classList.add('album-button');

      // Add an event listener to the album button
      albumButton.addEventListener('click', createButtonClickListener('album', song.album));

      // Create a button for the singer
      var singerButton = document.createElement('button');
      singerButton.textContent = song.singer;
      singerButton.classList.add('singer-button');

      // Add an event listener to the singer button
      singerButton.addEventListener('click', createButtonClickListener('singer', song.singer));

      // Create the share button
      var shareButton = document.createElement('button');
      shareButton.textContent = 'שתף';
      shareButton.classList.add('share-button');
      shareButton.dataset.serial = song.serial;

      // Add an event listener to the share button
      shareButton.addEventListener('click', createShareButtonClickListener(song.serial));

      // Append elements to the row
      serialCell.appendChild(serialLink);
      nameCell.textContent = song.name;
      albumCell.appendChild(albumButton);
      singerCell.appendChild(singerButton);
      row.appendChild(serialCell);
      row.appendChild(nameCell);
      row.appendChild(albumCell);
      row.appendChild(singerCell);
      row.appendChild(shareButton);

      // Append the row to the table body
      tableBody.appendChild(row);
    }
  }

  // Helper function to create a closure for the row click listener
  function createRowClickListener(song) {
    return function(event) {
      // Check if the click occurred on a button or a link
      if (
        event.target.tagName !== 'BUTTON' &&
        !event.target.classList.contains('share-button')
      ) {
        event.preventDefault(); // Prevent the default link behavior

        // Check the conditions before allowing the download
        if (
          (!song.album.toLowerCase().includes('סינגלים')) &&
          (!song.singer.toLowerCase().includes('סינגלים'))
        ) {
          showMessage('באתר זה נשלחים סינגלים בלבד, נא נסה שיר אחר!');
        } else {
          downloadSong(song.serial);
        }
      }
    };
  }

  // Helper function to create a closure for button click listener
  function createButtonClickListener(searchBy, query) {
    return function(event) {
      event.preventDefault();
      searchSongs(query, searchBy);
    };
  }

  // Helper function to create a closure for share button click listener
  function createShareButtonClickListener(serial) {
    return function() {
      var shareLink = window.location.origin + window.location.pathname + '?search=' + serial;
      copyToClipboard(shareLink); // Copy the share link to clipboard
      showCopiedMessage(); // Show a message indicating the link has been copied
    };
  }
}






// Define a variable to keep track of the number of results displayed.
var displayedResults = 0;

// Add an event listener to the "Load more" button.
var loadMoreButton = document.getElementById('loadMoreButton');
loadMoreButton.addEventListener('click', loadMoreResults);

// Function to load more results.
function loadMoreResults() {
  // Increase the number of displayed results by 500.
  displayedResults += 250;

  // Display the additional results.
  displayResults(results.slice(0, displayedResults));

  // Hide the "Load more" button if all results are displayed.
  if (displayedResults >= results.length) {
    loadMoreButton.style.display = 'none';
  }
}

// Initially, hide the "Load more" button if there are fewer than 500 results.
if (results.length <= 250) {
  loadMoreButton.style.display = 'none';
}



// שיתוף קישור עם URL
function getSearchTermFromURL() {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  return urlParams.get('search');
}

window.addEventListener('load', function () {
  var searchTerm = getSearchTermFromURL();
  var searchInput = document.getElementById('searchInput');
  if (searchTerm) {
    searchInput.value = searchTerm;
    searchSongs(searchTerm, 'all'); // Perform the search automatically
  }
});


function copyToClipboard(text) {
  var textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
}

function showCopiedMessage() {
  var message = document.createElement('div');
  message.textContent = 'הקישור הועתק ללוח';
  message.classList.add('copied-message');

  document.body.appendChild(message);

  setTimeout(function () {
    document.body.removeChild(message);
  }, 3000);
}


// הורדה אוטומטית של שיר באמצעות אפליקציית גוגל
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