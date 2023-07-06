document.getElementById('searchForm').addEventListener('submit', function(event) {
  event.preventDefault();
  var searchInput = document.getElementById('searchInput').value.toLowerCase();
  var searchBy = document.getElementById('searchBy').value;
  searchSongs(searchInput, searchBy);
});

function searchSongs(query, searchBy) {
  // Check if the query string is empty or less than two letters/one number
  if (query.trim() === '' || (query.trim().length < 2 && !/^\d$/.test(query.trim()))) {
    return; // Do not perform a search
  }
  
  fetch('https://nhlocal.github.io/shir-bot/site/%E2%80%8F%E2%80%8Fsongs%20-%20%D7%A2%D7%95%D7%AA%D7%A7.csv')
    .then(function(response) {
      return response.text();
    })
    .then(function(csvText) {
      var songs = parseCSV(csvText);
      var results = filterSongs(songs, query, searchBy);
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

function filterSongs(songs, query, searchBy) {
  return songs.filter(function(song) {
    var values = Object.values(song).map(function(value) {
      return value.toLowerCase();
    });
    if (searchBy === 'all') {
      return values.some(function(value) {
        return value.includes(query);
      });
    } else {
      var value = song[searchBy];
      if (value) {
        value = value.toLowerCase();
        return value.includes(query);
      }
    }
    return false;
  });
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

      // Check if the album name does not contain the word "סינגלים" and attach the event listener
      if (!song.album.toLowerCase().includes('סינגלים')) {
        serialLink.addEventListener('click', function(event) {
          event.preventDefault();
          alert('כרגע רק סינגלים נשלחים, נא נסה שיר אחר!');
        });
      } else {
        serialLink.href = generateMailtoLink(song.serial);
        serialLink.target = '_blank';
      }

    }
  }
}



function generateMailtoLink(serial) {
  var baseEmail = 'autoshirbot@gmail.com';
  var additionalEmail = 'autoshirbot1@gmail.com';
  
  // Check if the user has logged in before
  var hasLoggedIn = checkCookie('hasLoggedIn');
  
  // Declare a variable to hold the selected email
  var email;
  
  if (hasLoggedIn) {
    // Retrieve the email from the cookie
    email = getCookie('selectedEmail');
  } else {
    // Generate a random number between 0 and 1
    var randomNumber = Math.random();
  
    // Select email based on the random number
    if (randomNumber < 0.5) {
      email = baseEmail;
    } else {
      email = additionalEmail;
    }
    
    // Save the selected email in a cookie
    setCookie('selectedEmail', email, 365);
    setCookie('hasLoggedIn', true, 365);
  }
  
  var encodedSerial = encodeURIComponent(serial);
  var mailtoLink = 'https://mail.google.com/mail/u/0/?view=cm&fs=1&tf=1&source=mailto&su=%D7%A7%D7%91%D7%9C&to=' + encodeURIComponent(email) + '&body=' + encodedSerial;
  
  console.log(hasLoggedIn)
  return mailtoLink;
}

// Function to set a cookie
function setCookie(name, value, days) {
  var expires = '';
  if (days) {
    var date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = '; expires=' + date.toUTCString();
  }
  document.cookie = name + '=' + (value || '') + expires + '; path=/';
}

// Function to retrieve a cookie
function getCookie(name) {
  var nameEQ = name + '=';
  var ca = document.cookie.split(';');
  for (var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

// Function to check if a cookie exists
function checkCookie(name) {
  var cookie = getCookie(name);
  return cookie !== null;
}




document.addEventListener('DOMContentLoaded', function() {
  var searchInput = document.getElementById('searchInput');
  var awesomplete = new Awesomplete(searchInput, {
    minChars: 2, // Minimum number of characters to trigger auto-completion
    list: [], // Initially empty list of suggestions
    autoFirst: true, // Automatically select the first suggestion
  });

  // Fetch CSV data and update the suggestions list
  fetch('https://nhlocal.github.io/shir-bot/site/%E2%80%8F%E2%80%8Fsongs%20-%20%D7%A2%D7%95%D7%AA%D7%A7.csv')
    .then(function(response) {
      return response.text();
    })
    .then(function(csvText) {
      var songs = parseCSV(csvText);
      var songNames = songs.map(function(song) {
        return song.name;
      });
      awesomplete.list = songNames; // Update the suggestions list
    });
});
