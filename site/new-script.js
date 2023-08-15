document.getElementById('searchForm').addEventListener('submit', function(event) {
  event.preventDefault();
  var searchInput = document.getElementById('searchInput').value.toLowerCase();
  var searchBy = document.getElementById('searchBy').value;
  searchSongs(searchInput, searchBy);
});


var singleFilterButton = document.getElementById('singleFilter');
var showSinglesOnly = false;

singleFilterButton.addEventListener('click', function() {
  showSinglesOnly = !showSinglesOnly;

  if (showSinglesOnly) {
    this.textContent = 'הצג את כל השירים';
  } else {
    this.textContent = 'הצג סינגלים בלבד';
  }

  // Re-run the search with the updated filter
  var searchInput = document.getElementById('searchInput').value.toLowerCase();
  var searchBy = document.getElementById('searchBy').value;
  searchSongs(searchInput, searchBy);
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

  fetch('https://nhlocal.github.io/shir-bot/site/%E2%80%8F%E2%80%8Fsongs%20-%20%D7%A2%D7%95%D7%AA%D7%A7.csv')
    .then(function (response) {
      return response.text();
    })
    .then(function (csvText) {
      var songs = parseCSV(csvText);
      // Apply the selected filter method
      var filteredSongs;
      if (showSinglesOnly) {
        filteredSongs = songs.filter(song => song.album.toLowerCase().includes('סינגלים'));
      } else {
        filteredSongs = songs;
      }
      var results = filterSongs(filteredSongs, query, searchBy);
      displayResults(results);
    });
}



function parseCSV(csvText) {
  var lines = csvText.split('\n');
  var songs = [];
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line) {
      var columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      var song = {
        serial: columns[0].trim(),
        name: columns[1].trim(),
        album: columns[2].trim(),
        singer: columns[3].trim()
      };
      songs.push(song);
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

  const results = [...exactMatches, ...fuzzyMatches].sort(function(a, b) {
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



function displayResults(results) {
  var tableBody = document.querySelector('#resultsTable tbody');

  // Clear the table body
  tableBody.innerHTML = '';

  if (results.length === 0) {
    // Display instructions and explanations when no results are found
    var instructionRow = document.createElement('tr');
    var instructionCell = document.createElement('td');
    instructionCell.setAttribute('colspan', '4');
    instructionCell.textContent = 'לא נמצאו תוצאות. אנא נסה חיפוש אחר';
    instructionRow.appendChild(instructionCell);
    tableBody.appendChild(instructionRow);
  } else {
    // Display the search results
    for (var i = 0; i < results.length; i++) {
      var song = results[i];
      var row = document.createElement('tr');
      var serialCell = document.createElement('td');
      var nameCell = document.createElement('td');
      var albumCell = document.createElement('td');
      var singerCell = document.createElement('td');
      var serialLink = document.createElement('a');

      serialLink.textContent = song.serial;
      serialCell.appendChild(serialLink);
      nameCell.textContent = song.name;
      albumCell.textContent = song.album;
      singerCell.textContent = song.singer;
      row.appendChild(serialCell);
      row.appendChild(nameCell);
      row.appendChild(albumCell);
      row.appendChild(singerCell);
      tableBody.appendChild(row);

    // Add the share button
    var shareButton = document.createElement('button');
    shareButton.textContent = 'שתף';
    shareButton.classList.add('share-button');
    shareButton.dataset.serial = song.serial;
    shareButton.addEventListener('click', function () {
      var serial = this.dataset.serial;
      var shareLink = window.location.origin + window.location.pathname + '?search=' + serial;
      copyToClipboard(shareLink); // Copy the share link to clipboard
      showCopiedMessage(); // Show a message indicating the link has been copied
    });
    // Append the share button to the row
    row.appendChild(shareButton);

    tableBody.appendChild(row);

      // Check if the album name does not contain the word "סינגלים" and attach the event listener
      if (!song.album.toLowerCase().includes('סינגלים')) {
        serialLink.addEventListener('click', function(event) {
          event.preventDefault();
          showMessage('באתר זה נשלחים סינגלים בלבד, נא נסה שיר אחר!');
        });
      } else {
        serialLink.addEventListener('click', function(event) {
          event.preventDefault(); // Prevent the default link behavior
          var clickedElement = event.target; // The <a> element that was clicked
          var songNumber = clickedElement.textContent; // Extract the number from the text
          downloadSong(songNumber);
        });

      }

    }
  }
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


function updateURLWithoutReload(searchTerm) {
  var newURL = window.location.protocol + '//' + window.location.host + window.location.pathname + '?search=' + encodeURIComponent(searchTerm);
  window.history.pushState({ path: newURL }, '', newURL);
}


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



function openShareModal(shareLink) {
  var overlay = document.createElement('div');
  overlay.classList.add('modal-overlay');

  var modal = document.createElement('div');
  modal.classList.add('modal-content');

  var h2 = document.createElement('h2');
  h2.textContent = 'שתף את השיר';

  var p = document.createElement('p');
  p.textContent = 'הקישור לשיר:';

  var link = document.createElement('a');
  link.textContent = 'לחץ כאן';
  link.dataset.shareLink = shareLink;
  link.target = '_blank';

  var closeButton = document.createElement('button');
  closeButton.textContent = 'סגור';
  closeButton.classList.add('share-button');
  closeButton.addEventListener('click', function () {
    document.body.removeChild(overlay); // Close the modal overlay
  });

  modal.appendChild(h2);
  modal.appendChild(p);
  modal.appendChild(link);
  modal.appendChild(closeButton);

  overlay.appendChild(modal);

  document.body.appendChild(overlay);
}



function downloadSong(songNumber) {
  var loadingMessage = document.getElementById('loadingMessage');
  loadingMessage.classList.add('show'); // Display the loading message

  var scriptUrl = 'https://script.google.com/macros/s/AKfycbyzJ9j93gbyOx1N42oJzDgFRDxPg4wsK6zCxEVNDkJb8zPzhgf5OyO6Prj4dWQWdhS-ow/exec'; // Replace with your Google Apps Script web app URL
  var downloadUrl = scriptUrl + '?songNumber=' + encodeURIComponent(songNumber);

  fetch(downloadUrl)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        var link = document.createElement('a');
        link.href = data.downloadLink;
        link.download = data.originalFileName;
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



// Function to show a message in the center modal overlay
function showMessage(message) {
  var modalOverlay = document.getElementById('modalOverlay');
  var modalMessage = document.getElementById('modalMessage');
  var modalOkButton = document.getElementById('modalOkButton');

  modalMessage.textContent = message;
  modalOverlay.style.display = 'flex'; // Display the modal overlay

  // Add event listener to OK button
  modalOkButton.addEventListener('click', hideMessage);
}

// Function to hide the modal overlay
function hideMessage() {
  var modalOverlay = document.getElementById('modalOverlay');
  modalOverlay.style.display = 'none'; // Hide the modal overlay
}