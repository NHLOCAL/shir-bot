const contentSection = document.getElementById("instructions-container");
const prevButton = document.getElementById("prevSection");
const nextButton = document.getElementById("nextSection");

let newContents = []; // Array to store the dynamic content
let currentContentIndex = 0;
let interval;

// Fetch data from CSV file
fetch('https://nhlocal.github.io/shir-bot/artists/artist-list.csv')
  .then(response => response.text())
  .then(data => {
    // Parse CSV data
    const rows = data.split('\n');
    
    // Iterate over rows and populate newContents array
    for (let i = 1; i < rows.length; i++) {
      const columns = rows[i].split(',');
      const artist = columns[0];
      const paragraphA = columns[1];
      const paragraphB = columns[2] || ''; // Use an empty string if column B is empty
      const paragraphC = columns[3] || ''; // Use an empty string if column C is empty
      const imageLink = columns[4] || '';   // Use an empty string if column D is empty

      const adContent = `
        <div class="ad-container">
          <h3>${artist}</h3>
          ${imageLink ? `<img src="${imageLink}" width="100">` : ''}
          <p style="text-align: justify"><b>${artist}</b> ${paragraphA}</p>
          <p style="text-align: justify">${paragraphB}</p>
          <p style="text-align: justify">${paragraphC}</p>
          <button class="helpButton" onclick='searchNow("${artist}")'>חפשו "${artist}"</button>

        </div>
      `;

      newContents.push(adContent);
    }

    // Initial content update
    updateContent();
    startAutoChange(); // Start the automatic content change
  })
  .catch(error => console.error('Error fetching CSV:', error));

// Function to update the content section
function updateContent() {
  contentSection.innerHTML = newContents.join('');
}

// Function to handle the automatic content change
function startAutoChange() {
  interval = setInterval(() => {
    currentContentIndex = (currentContentIndex + 1) % newContents.length;
    updateContent();
  }, 8000); // Reduced the interval to 8 seconds for the example
}

// Event listeners for previous and next buttons
prevButton.addEventListener("click", () => {
  currentContentIndex = (currentContentIndex - 1 + newContents.length) % newContents.length;
  updateContent();
  clearInterval(interval); // Reset the interval on arrow click
  startAutoChange(); // Restart the automatic change
});

nextButton.addEventListener("click", () => {
  currentContentIndex = (currentContentIndex + 1) % newContents.length;
  updateContent();
  clearInterval(interval); // Reset the interval on arrow click
  startAutoChange(); // Restart the automatic change
});

// Initial content update
updateContent();
startAutoChange(); // Start the automatic content change


function searchNow(query) {	
	searchSongs(query, 'singer')	
}