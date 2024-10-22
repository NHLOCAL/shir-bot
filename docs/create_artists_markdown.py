import csv
import os

# פונקציה הבודקת אם שם האלבום או שם הזמר מכיל את המילה 'סינגלים'
def contains_hebrew_singles(text):
    return "סינגלים" in text

# פונקציה הבודקת אם שם הזמר הוא קצר יחסית (פחות מ-4 מילים)
def is_short_singer(name):
    return len(name.split()) < 4

# רשימת זמרים שמדלגים עליהם
skip_singers = [
    "הראל סקעת", "יהורם גאון", "עדן חסון",
    "הפרויקט של רביבו", "בית ספר למוסיקה", "אריק איינשטיין"
]

# פונקציה ליצירת קבצי Markdown עבור כל אמן
def create_artist_markdown(csv_file_path, artists_folder):
    if not os.path.exists(artists_folder):
        os.makedirs(artists_folder)  # יצירת התיקייה במידה והיא לא קיימת

    singers = {}
    with open(csv_file_path, "r", encoding="utf-8") as csv_file:
        csv_reader = csv.DictReader(csv_file)
        
        # עבור כל שורה ב-CSV, נבדוק מי האמן ונאסוף את השירים שלו
        for row in csv_reader:
            singer = row["Singer"]
            album = row["Album Name"]
            
            # נוודא שהאמן או האלבום מכיל את המילה 'סינגלים'
            if contains_hebrew_singles(singer) or contains_hebrew_singles(album):
                song = {
                    "number": row["Serial Number"],
                    "name": row["Song Name"],
                    "album": album,
                    "artist": singer
                }
                # אם האמן הוא קצר ולא ברשימת האמנים שיש לדלג עליהם, נאגור את השירים שלו
                if is_short_singer(singer) and singer not in skip_singers:
                    if singer not in singers:
                        singers[singer] = []
                    singers[singer].append(song)

    # ניצור קובץ Markdown עבור כל אמן
    for singer, songs in singers.items():
        # יצירת שם קובץ ידידותי למערכת הקבצים
        safe_singer_name = singer.replace(" ", "-").replace("/", "-").replace("\\", "-")
        filename = os.path.join(artists_folder, f"{safe_singer_name}.md")
        
        with open(filename, "w", encoding="utf-8") as f:
            f.write("---\n")
            f.write(f"layout: artist\n")
            f.write(f"name: {singer}\n")
            f.write(f"title: \"{singer}\"\n")
            f.write(f"description: \"דף האמן {singer}\"\n")
            f.write(f"keywords: \"שירים, מוזיקה, {singer}\"\n")
            f.write(f"permalink: /artists/{safe_singer_name}\n")
            f.write("redirect_from:\n")
            f.write(f"  - /artists/list/{singer}\n")
            f.write(f"  - /artists/{safe_singer_name}/\n")
            f.write("songs:\n")
            for song in songs:
                f.write(f"  - number: \"{song['number']}\"\n")
                f.write(f"    name: \"{song['name']}\"\n")
                f.write(f"    album: \"{song['album']}\"\n")
                f.write(f"    artist: \"{song['artist']}\"\n")
            f.write("---\n")
            # ניתן להוסיף תוכן נוסף כאן אם יש צורך

# הפעלת הפונקציה עם הנתיב לקובץ ה-CSV ותיקיית היעד של קבצי האמנים
create_artist_markdown("songs.csv", "_artists")
