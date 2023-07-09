// Get the playlist data
var playlist = constplaylist;

// Function to download a song
function downloadSong(song) {
  fetch(song.path)
    .then(response => response.blob())
    .then(blob => {
      var url = window.URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = song.name + '.mp3';
      link.click();
      window.URL.revokeObjectURL(url);
    });
}

// Function to display the song list in a message box
function displaySongList() {

  var messageBox = document.createElement('div');
  messageBox.style.position = 'fixed';
  messageBox.style.top = '50%';
  messageBox.style.left = '50%';
  messageBox.style.transform = 'translate(-50%, -50%)';
  messageBox.style.width = '300px';
  messageBox.style.maxHeight = '400px';
  messageBox.style.overflowY = 'scroll';
  messageBox.style.background = '#fff';
  messageBox.style.padding = '10px';
  messageBox.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
  messageBox.style.zIndex = '9999';

  // Create a frame for the message box
  var frame = document.createElement('div');
  frame.style.background = '#eee';
  frame.style.padding = '10px';
  frame.style.borderRadius = '10px';
  frame.style.overflow = 'hidden';
  messageBox.appendChild(frame);

  // Add the title above the playlist
  var title = document.createElement('h3');
  title.textContent = 'בחר שירים להורדה';
  title.style.marginTop = '0';
  title.style.marginBottom = '10px';
  title.style.textAlign = 'center';
  frame.appendChild(title);

  // Create a select all checkbox
  var selectAllContainer = document.createElement('div');
  selectAllContainer.style.display = 'flex';
  selectAllContainer.style.alignItems = 'center';

  var selectAllCheckbox = document.createElement('input');
  selectAllCheckbox.type = 'checkbox';
  selectAllCheckbox.id = 'selectAll';
  selectAllCheckbox.style.marginLeft = '8px';
  selectAllCheckbox.addEventListener('change', function() {
    var checkboxes = frame.getElementsByTagName('input');
    for (var i = 0; i < checkboxes.length; i++) {
      checkboxes[i].checked = selectAllCheckbox.checked;
    }
  });

  var selectAllLabel = document.createElement('label');
  selectAllLabel.htmlFor = 'selectAll';
  selectAllLabel.appendChild(document.createTextNode('בחר הכל'));
  selectAllLabel.style.fontWeight = 'bold';
  selectAllLabel.style.fontSize = '1.2em';


  selectAllContainer.appendChild(selectAllCheckbox);
  selectAllContainer.appendChild(selectAllLabel);

  frame.appendChild(selectAllContainer);

  // Create checkboxes for each song
  for (var i = 0; i < playlist.length; i++) {
    var song = playlist[i];

    var checkboxContainer = document.createElement('div');
    checkboxContainer.style.display = 'flex';
    checkboxContainer.style.alignItems = 'center';
    checkboxContainer.style.marginBottom = '5px'; // Added margin bottom for spacing

    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'song' + i;
    checkbox.style.marginLeft = '8px';
    checkbox.style.verticalAlign = 'middle'; // Align checkboxes vertically

    var label = document.createElement('label');
    label.htmlFor = 'song' + i;
    label.appendChild(document.createTextNode(song.name));
    label.style.marginLeft = '5px'; // Added margin left for spacing
    label.style.verticalAlign = 'middle'; // Align labels vertically

    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(label);

    frame.appendChild(checkboxContainer);
  }

  // Add a download button
  var downloadButton = document.createElement('button');
  downloadButton.textContent = 'הורד שירים נבחרים';
  downloadButton.style.marginTop = '10px';
  downloadButton.style.width = '100%';
  downloadButton.style.border = 'none';
  downloadButton.style.background = '#4CAF50';
  downloadButton.style.color = '#fff';
  downloadButton.style.padding = '8px 16px';
  downloadButton.style.borderRadius = '4px';
  downloadButton.addEventListener('click', function() {
    // Collect selected songs
    var selectedSongs = [];
    var checkboxes = frame.getElementsByTagName('input');
    for (var i = 0; i < checkboxes.length; i++) {
      if (checkboxes[i].checked) {
        selectedSongs.push(playlist[i]);
      }
    }

    // Download selected songs
    for (var i = 0; i < selectedSongs.length; i++) {
      downloadSong(selectedSongs[i]);
    }

    // Close the message box window
    document.body.removeChild(messageBox);
  });

  // Append the message box to the document
  document.body.insertBefore(messageBox, document.body.firstChild);
  frame.appendChild(downloadButton);
}

// Run the function to display the song list
displaySongList();
