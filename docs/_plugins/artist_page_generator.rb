require 'jekyll'
require 'unf' # ודא ש-Gem זה מותקן (הוא ב-Gemfile שלך)

module Jekyll

  # מחלקה מותאמת אישית לדף אמן שאינה דורשת קובץ מקור פיזי
  class ArtistPage < Page
    def initialize(site, base, dir, name, artist_data)
      @site = site
      @base = base # תיקיית המקור הכללית (docs)
      @dir  = dir  # תיקיית היעד היחסית לדף זה (e.g., 'artists/some-artist')
      @name = name # שם הקובץ שייווצר ביעד (e.g., 'index.html')

      # קריאה לפונקציה process חיונית לאתחול פנימי של Jekyll
      self.process(@name)

      # טעינת הנתונים מה-layout המיועד ('artist') כברירת מחדל
      # שימוש ב-dup כדי למנוע שינוי ה-layout המקורי
      self.data = site.layouts['artist'].data.dup

      # ודא שה-layout הנכון מוגדר (למקרה שהיה משהו אחר ב-layout data)
      self.data['layout'] = 'artist'

      # הוספת/דריסת נתונים ספציפיים לאמן זה
      self.data['name']        = artist_data['name'] # שם האמן לקריאה
      self.data['title']       = artist_data['title'] # כותרת הדף
      self.data['description'] = artist_data['description']
      self.data['keywords']    = artist_data['keywords']
      self.data['songs']       = artist_data['songs'] # רשימת השירים

      # הגדרת תוכן הדף לריק - ה-layout ידאג לתוכן האמיתי
      self.content = ""

      # Jekyll ישתמש ב-@dir וב-@name כדי לקבוע את נתיב היעד
      # למשל, dir='artists/artist-slug', name='index.html' -> _site/artists/artist-slug/index.html
    end

    # דריסת הפונקציה read_yaml כדי למנוע ניסיון לקרוא Front Matter מקובץ לא קיים
    def read_yaml(*)
      # לא עושים כלום
    end
  end

  # מחולל הדפים
  class ArtistPageGenerator < Generator
    safe true # עדיין נדרש כדי ש-GitHub Actions יפעיל אותו ללא --safe
    priority :lowest

    def generate(site)
      # ודא שתיקיית הפלאגין מחוץ לאתר עצמו (למקרה שזה גורם לבעיות, בדרך כלל לא)
      # if site.config['plugins_dir'] != '_plugins'
      #   puts "Plugin directory might be configured incorrectly."
      # end

      puts "ArtistPageGenerator: Starting generation..."

      # --- בדיקת נתונים קריטית ---
      unless site.data['all_songs']
        puts "ArtistPageGenerator: Error - site.data['all_songs'] not found. Check _data folder/files."
        return # עצור אם אין נתונים
      end
      all_songs_data = site.data['all_songs']
      unless all_songs_data.is_a?(Array) && !all_songs_data.empty?
        puts "ArtistPageGenerator: Warning - site.data['all_songs'] is empty or not an array."
        # אל תעצור כאן, יכול להיות שפשוט אין שירים עדיין, רק תדפיס אזהרה
      end
      # -------------------------

      # קיבוץ השירים לפי זמר
      singers = all_songs_data.group_by { |song| song['singer'] }.compact # compact מסיר nil keys
      puts "ArtistPageGenerator: Grouped songs into #{singers.keys.length} unique singer names initially."

      target_dir_base = 'artists' # שם תיקיית הפלט הראשית

      generated_count = 0

      singers.each do |singer_name, songs|
        # דילוג על ערכים ריקים או שמות ארוכים מדי
        next if singer_name.nil? || singer_name.strip.empty?
        word_count = singer_name.split.length
        next if word_count > 3 # המגבלה שלך

        # יצירת ה-slug (חלק ה-URL)
        safe_singer_slug = create_slug(singer_name)
        next if safe_singer_slug.nil? || safe_singer_slug.strip.empty? # ודא שה-slug תקין

        # נתיב התיקייה הספציפי לאמן זה (למשל, 'artists/some-artist')
        artist_output_dir = File.join(target_dir_base, safe_singer_slug)

        puts "ArtistPageGenerator: Preparing page for '#{singer_name}' -> /#{artist_output_dir}/"

        # מיפוי נתוני השירים עבור הדף הספציפי
        page_songs = songs.map do |song|
          {
            'number' => song['serial'], # שינית משם שדה קודם
            'name' => song['name'],
            'album' => song['album'],
            'artist' => song['singer'], # השם כאן צריך להיות 'artist' או 'singer' לפי מה שה-layout מצפה
            'driveId' => song['driveId']
          }.compact # הסר nil values אם יש
        end

        # הכנת הנתונים שיועברו למחלקה ArtistPage
        artist_page_data = {
          'name'        => singer_name, # שם האמן לתצוגה
          'title'       => singer_name, # כותרת HTML
          'description' => "דף האמן #{singer_name} בשיר-בוט",
          'keywords'    => "שירים, מוזיקה, #{singer_name}, שיר-בוט",
          'songs'       => page_songs
        }

        # יצירת הדף החדש באמצעות המחלקה המותאמת אישית שלנו
        # הוא ייצור קובץ index.html בתוך תיקיית האמן
        page = ArtistPage.new(site, site.source, artist_output_dir, 'index.html', artist_page_data)

        # הוספת הדף לאוסף הדפים של Jekyll כדי שהוא יעובד וייכתב ל- _site
        site.pages << page
        generated_count += 1
      end

      puts "ArtistPageGenerator: Finished generation. Generated #{generated_count} artist pages (out of #{singers.keys.length} initial singers)."
    end

    private

    # פונקציית יצירת ה-slug (ודא שהיא מטפלת בעברית כראוי)
    def create_slug(text)
       return nil if text.nil? # הוספנו בדיקת nil
       text = text.to_s

       # נרמול וניקוי עדין יותר
       begin
         # נרמול Unicode (חשוב לעברית) והפיכה לאותיות קטנות
         normalized_text = UNF::Normalizer.normalize(text, :nfkc).downcase
         # החלף כל מה שאינו אות (כולל עברית), ספרה, מקף או נקודה בודדת - במקף
         slug = normalized_text.gsub(/[^a-z0-9\u0590-\u05ff\-\.]/i, '-')
         # החלף רווחים במקף
         slug.gsub!(/\s+/, '-')
         # הסר מקפים כפולים
         slug.gsub!(/-+/, '-')
         # הסר מקפים מההתחלה והסוף
         slug.gsub!(/^-+|-+$/, '')
         # אם ה-slug ריק אחרי כל הניקוי, החזר ערך ברירת מחדל או nil
         slug = "artist" if slug.empty?
         return slug
       rescue => e
         # אם יש שגיאה בנרמול (פחות סביר עם UNF אבל אפשרי)
         puts "Error creating slug for '#{text}': #{e.message}"
         # חלופה בסיסית מאוד במקרה של שגיאה
         return text.to_s.downcase.gsub(/[^a-z0-9\-]/, '-').gsub(/-+/, '-').gsub(/^-+|-+$/, '')
       end
    end
  end
end