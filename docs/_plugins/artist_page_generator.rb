require 'jekyll'
require 'unf'

module Jekyll


  class ArtistPage < Page
    def initialize(site, base, dir, name, artist_data)
      @site = site
      @base = base
      @dir  = dir
      @name = name


      self.process(@name)



      self.data = site.layouts['artist'].data.dup


      self.data['layout'] = 'artist'


      self.data['name']        = artist_data['name']
      self.data['title']       = artist_data['title']
      self.data['description'] = artist_data['description']
      self.data['keywords']    = artist_data['keywords']
      self.data['songs']       = artist_data['songs']


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
      puts "ArtistPageGenerator: Grouped songs into #{singers.keys.length} singers." # תיקון הדפסה

      target_dir_base = 'artists'

      generated_count = 0
      skipped_word_count = 0
      skipped_song_count = 0 # מונה חדש

      singers.each do |singer_name, songs|

        # בדיקה ראשונית של שם הזמר
        next if singer_name.nil? || singer_name.strip.empty?

        # בדיקת ספירת מילים
        word_count = singer_name.split.length
        if word_count > 3
          skipped_word_count += 1
          next
        end

        # !!! בדיקת מינימום שירים !!!
        if songs.nil? || songs.length < 3
          skipped_song_count += 1
          next
        end
        # !!! סוף הבדיקה !!!

        safe_singer_slug = create_slug(singer_name)
        next if safe_singer_slug.nil? || safe_singer_slug.strip.empty?


        artist_output_dir = File.join(target_dir_base, safe_singer_slug)

        # הדפסה רק עבור אלו שעברו את כל הסינונים
        puts "ArtistPageGenerator: Preparing page for '#{singer_name}' (#{songs.length} songs) -> /#{artist_output_dir}/"


        page_songs = songs.map do |song|
          {
            'number' => song['serial'],
            'name' => song['name'],
            'album' => song['album'],
            'artist' => song['singer'],
            'driveId' => song['driveId']
          }.compact
        end


        artist_page_data = {
          'name'        => singer_name,
          'title'       => singer_name,
          'description' => "דף האמן #{singer_name} בשיר-בוט",
          'keywords'    => "שירים, מוזיקה, #{singer_name}, שיר-בוט",
          'songs'       => page_songs
        }



        page = ArtistPage.new(site, site.source, artist_output_dir, 'index.html', artist_page_data)


        site.pages << page
        generated_count += 1
      end

      puts "ArtistPageGenerator: Finished generation. Generated #{generated_count} artist pages."
      puts "ArtistPageGenerator: Skipped #{skipped_word_count} artists due to word count > 3."
      puts "ArtistPageGenerator: Skipped #{skipped_song_count} artists due to having less than 3 songs."
    end

    private


    def create_slug(text)
       return nil if text.nil?
       text = text.to_s


       begin

         normalized_text = UNF::Normalizer.normalize(text, :nfkc).downcase

         slug = normalized_text.gsub(/[^a-z0-9\u0590-\u05ff\-\.]/i, '-')

         slug.gsub!(/\s+/, '-')

         slug.gsub!(/-+/, '-')

         slug.gsub!(/^-+|-+$/, '')
         # אם ה-slug ריק אחרי כל הניקוי, החזר ערך ברירת מחדל או nil
         slug = "artist" if slug.empty?
         return slug
       rescue => e
         # אם יש שגיאה בנרמול (פחות סביר עם UNF אבל אפשרי)
         puts "Error creating slug for '#{text}': #{e.message}" # הדפסת השגיאה

         return text.to_s.downcase.gsub(/[^a-z0-9\-]/, '-').gsub(/-+/, '-').gsub(/^-+|-+$/, '')
       end
    end
  end
end