// השלמה אוטומטית - לשימוש עתידי
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
