const contentSection = document.getElementById("instructions-container");
const prevButton = document.getElementById("prevSection");
const nextButton = document.getElementById("nextSection");

let newContents = [];
let currentContentIndex = 0;
let interval;

// Fetch data from CSV file using PapaParse
Papa.parse('https://nhlocal.github.io/shir-bot/artists/artist-list.csv', {
  download: true,
  header: true,
  complete: function (results) {
    const data = results.data;

    for (let i = 0; i < data.length; i++) {
      const artist = data[i].Artist;
      const paragraphA = data[i].ParagraphA;
      const paragraphB = data[i].ParagraphB || '';
      const paragraphC = data[i].ParagraphC || '';
      const imageLink = data[i].ImageLink || '';

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

    updateContent();
    startAutoChange();
  },
  error: function (error) {
    console.error('Error fetching and parsing CSV:', error);
  }
});

function updateContent() {
  contentSection.innerHTML = newContents.join('');
}

function startAutoChange() {
  interval = setInterval(() => {
    currentContentIndex = (currentContentIndex + 1) % newContents.length;
    updateContent();
  }, 8000);
}

prevButton.addEventListener("click", () => {
  currentContentIndex = (currentContentIndex - 1 + newContents.length) % newContents.length;
  updateContent();
  clearInterval(interval);
  startAutoChange();
});

nextButton.addEventListener("click", () => {
  currentContentIndex = (currentContentIndex + 1) % newContents.length;
  updateContent();
  clearInterval(interval);
  startAutoChange();
});

updateContent();
startAutoChange();


function searchNow(query) {	
	searchSongs(query, 'singer')	
}