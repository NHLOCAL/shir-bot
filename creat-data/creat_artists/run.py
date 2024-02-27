import csv

def create_singer_html_file(singer_name, songs):
    # Define the JavaScript function to handle row click
    js_function = """
    <script>
      function createRowClickListener(song) {
        return function() {
          console.log('Song:', song);
          // Add your custom logic here to handle the click event
        };
      }
    </script>
    """
    
    # Define the HTML template
    html_template = f"""
    <!DOCTYPE html>
    <html lang="he">
    <head>
      <meta charset="utf-8">
      <meta name="author" content="NHLOCAL">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css">
      <title>{singer_name}</title>
      <link rel="canonical" href="https://nhlocal.github.io/shir-bot/" />
      <link rel="icon" type="image/x-icon" href="https://nhlocal.github.io/shir-bot/site/favicon.ico">
      <link rel="stylesheet" href="https://nhlocal.github.io/shir-bot/site/styles.css">
      <link rel="stylesheet" href="https://nhlocal.github.io/shir-bot/site/personal.css">
      <script async src="https://www.googletagmanager.com/gtag/js?id=G-TGD4VQW4X8"></script>
      <script src="https://nhlocal.github.io/general-settings.js"></script>
      {js_function}
    </head>
    
    <body dir="rtl" style="background-color:#FFFEDB;">
      <div class="topnav">
      <header class="ripple-header">
        <a class="feedback-button" href="mailto:mesader.singelim@gmail.com" target="_blank" title="שלח משוב"><i class="fas fa-envelope"></i></a>
        <a class="right-item" href="https://nhlocal.github.io/shir-bot/" title="למעבר לדף הבית"><img width="50" style="border-radius: 30%;" src="https://nhlocal.github.io/shir-bot/archive/logo1.png" alt="סמל האתר"></a>
        
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
    
    <script>
      // Function to submit the form
      function submitForm() {{
        var searchTerm = document.getElementById('searchInput').value;
        var url = 'https://nhlocal.github.io/shir-bot/?search=' + encodeURIComponent(searchTerm);
        // Optionally, you can include the searchBy parameter as well
        // var url = 'https://nhlocal.github.io/shir-bot/?search=' + encodeURIComponent(searchTerm);
        window.location.href = url;
      }}
    
      // Event listener to submit the form when Enter key is pressed
      document.getElementById("searchInput").addEventListener("keypress", function(event) {{
        if (event.keyCode === 13) {{
          event.preventDefault();
          submitForm();
        }}
      }});
    </script>
    
      </div>
    
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
              <tr>
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
        <!--  גרסת בטא ניסיונית - לתקלות ניתן לשלוח משוב למייל היוצר  -->
          <div class="fixed-bottom">
            <p>זוהי תצוגה בלבד, להורדת שירים עברו ל<a href='https://nhlocal.github.io/shir-bot'>דף הבית</a></p>
          </div>
        </div>
        </body>
        </html>
    """
    # Write the HTML template to a file
    with open(f"{singer_name}.html", "w", encoding="utf-8") as file:
        file.write(html_template)

# Read data from CSV and create HTML files for each singer
with open("songs.csv", "r", encoding="utf-8") as csv_file:
    csv_reader = csv.DictReader(csv_file)
    current_singer = None
    current_songs = []
    for row in csv_reader:
        singer_name = row["Singer"]
        song = {
            "number": row["Serial Number"],
            "name": row["Song Name"],
            "album": row["Album Name"],
            "artist": row["Singer"]
        }
        if singer_name != current_singer:
            if current_singer:
                create_singer_html_file(current_singer, current_songs)
            current_singer = singer_name
            current_songs = []
        current_songs.append(song)
    # Create HTML file for the last singer
    if current_singer:
        create_singer_html_file(current_singer, current_songs)
