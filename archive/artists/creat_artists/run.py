import csv
import os

def create_singer_html_file(folder_path, singer_name, songs):

    html_file_path = os.path.join(folder_path, f"{singer_name}.html")
    
    # Define the HTML template
    html_template = f"""<!DOCTYPE html>
<html lang="he">
<head>
  <meta charset="utf-8">
  <meta name="author" content="NHLOCAL">
  <meta name="keywords" content="הורדת שירים, מוזיקה בדרייב, שירים בדרייב, שירים חרדיים, מוזיקה חסידית, שיר-בוט, מאגר שירים, חיפוש שירים, זמרים חרדיים, שירים חסידיים, הורדה מהירה, מספר סידורי, אלבום, זמר, חרדים, יהדות, טקסטים, תורה, מוסיקליות, מועדים, אמנות">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css">
  <title>{singer_name}</title>
  <link rel="canonical" href="https://nhlocal.github.io/shir-bot/artists/list/{singer_name}" />
  <link rel="icon" type="image/x-icon" href="https://nhlocal.github.io/shir-bot/site/favicon.ico">
  <link rel="stylesheet" href="https://nhlocal.github.io/shir-bot/site/styles.css">
  <link rel="stylesheet" href="https://nhlocal.github.io/shir-bot/site/personal.css">
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-T5D8XKQX');</script>
  <script src="https://nhlocal.github.io/general-settings.js"></script>
</head>

<body dir="rtl" style="background-color:#FFFEDB;">
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5D8XKQX"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
  <div class="topnav">
  <header class="ripple-header">
    <a class="feedback-button" href="mailto:mesader.singelim@gmail.com" target="_blank" title="שלח משוב"><i class="fas fa-envelope"></i></a>
    <a class="right-item" href="https://nhlocal.github.io/shir-bot/?utm_source=artist&utm_medium=site" title="למעבר לדף הבית"><img width="50" style="border-radius: 30%;" src="https://nhlocal.github.io/shir-bot/archive/logo1.png" alt="סמל האתר"></a>
    
    <center class="parent-element">
      <h3 id="nextObject">&nbsp{singer_name}</h3>
    </center>
  </header>
<form id="searchForm" class="search-form">
  
  <div class="input-container">
    <input type="text" id="searchInput" name="searchInput" class="search-input awesomplete" class="search-input" placeholder="נסה משהו אחר..." autofocus>
    <div id="textBubble" class="text-bubble">נסה לחפש שירים חדשים שיצאו לאחרונה!</div>
  </div>

  <button type="button" onclick="submitForm()" class="search-button"><i class="fas fa-search"></i></button>
</form>
</div>


    <div id="loadingMessage" class="loading-message">
      <div class="progress-bar-container">
        <img src="https://nhlocal.github.io/shir-bot/site/loading.gif" alt="טעינה" />
        <span id="progressText"></span>
        <div class="progress-bar">
          <div id="progress" class="progress"></div>
        </div>
      </div>
    </div>
    
  <!-- הגדרת מעבר אוטומטי לדף הראשי והורדת השירים  -->
  <script src="../main-artists.js"></script>

    <div id="resultsTable" class="custom-table">
      <table>
        <thead>
          <tr>
            <th>מספר סידורי</th>
            <th>שם השיר</th>
            <th>שם האלבום</th>
            <th>שם הזמר</th>		  
          </tr>
        </thead>
      <tbody>
    """
    # Append songs to the HTML template
    for song in songs:
        html_template += f"""
              <tr onclick="downloadSong('{song['number']}')">
                <td><a>{song['number']}</a></td>
                <td>{song['name']}</td>
                <td>{song['album']}</td>
                <td>{song['artist']}</td>
              </tr>
        """
    # Close the HTML template
    html_template += """
          </tbody>
        </table>
      </div>
      
	<div class="fixed-bottom">
	  <p></p>
	</div>

    <script src="../ads.js"></script>
</body>
</html>
    """
    # Write the HTML template to a file
    with open(html_file_path, "w", encoding="utf-8") as file:
        file.write(html_template)


def contains_hebrew_singles(text):
    # Check if the text contains the word "סינגלים" in Hebrew
    return "סינגלים" in text

def is_short_singer(name):
    # Check if the singer's name has less than 4 words
    return len(name.split()) < 4

# List of singers' names to skip
skip_singers = ["הראל סקעת", "יהורם גאון", "עדן חסון", "הפרויקט של רביבו", "בית ספר למוסיקה", "אריק איינשטיין",]

# Read data from CSV and create HTML files for each singer
def create_html_files(csv_file_path, folder_path):
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)

    with open(csv_file_path, "r", encoding="utf-8") as csv_file:
        csv_reader = csv.DictReader(csv_file)
        current_singer = None
        current_songs = []
        for row in csv_reader:
            singer_name = row["Singer"]
            album_name = row["Album Name"]
            
            if contains_hebrew_singles(singer_name) or contains_hebrew_singles(album_name):
                song = {
                    "number": row["Serial Number"],
                    "name": row["Song Name"],
                    "album": album_name,
                    "artist": singer_name
                }
                
                if is_short_singer(singer_name) and singer_name not in skip_singers:
                    if singer_name != current_singer:
                        if current_singer and current_singer not in skip_singers:
                            html_file_path = os.path.join(folder_path, f"{current_singer}.html")
                            create_singer_html_file(folder_path, current_singer, current_songs)
                        current_singer = singer_name
                        current_songs = []
                    current_songs.append(song)
        
        # Create HTML file for the last singer if it exists
        if current_singer and current_singer not in skip_singers:
            html_file_path = os.path.join(folder_path, f"{current_singer}.html")
            create_singer_html_file(folder_path, current_singer, current_songs)

# Example usage
create_html_files("songs.csv", r"C:\Users\משתמש\Documents\GitHub\shir-bot\artists\list2")
