const contentSection = document.getElementById("instructions-container");
const prevButton = document.getElementById("prevSection");
const nextButton = document.getElementById("nextSection");

let newContents = []; // Array to store the dynamic content
let currentContentIndex = 0;
let interval;

// Fetch data from JSON file
fetch('artist/artist-data.json')
  .then(response => response.json())
  .then(data => {
    // Iterate over data and populate newContents array
    data.forEach(item => {
      const artist = item.artist;
      const paragraphA = item.paragraphA;
      const paragraphB = item.paragraphB || '';
      const paragraphC = item.paragraphC || '';
      const imageLink = item.imageLink || '';

      const adContent = `
        <div class="ad-container">
          <h3>${artist}</h3>
          ${imageLink ? `<img src="${imageLink}" width="100">` : ''}
          <p style="text-align: justify"><b>${artist}</b> ${paragraphA}</p>
          <p style="text-align: justify">${paragraphB}</p>
          <p style="text-align: justify">${paragraphC}</p>
          <button class="helpButton" onclick='searchNow("${artist}")'>חפשו "${artist}"</button>
          <p><small style="text-align: right">המידע והתמונות באדיבות ויקיפדיה</small></p>
        </div>
      `;

      newContents.push(adContent);
    });

    // Initial content update
    updateContent();
    startAutoChange(); // Start the automatic content change
  })
  .catch(error => console.error('Error fetching JSON:', error));

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
