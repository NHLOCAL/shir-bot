# File: _plugins/artist_page_generator.rb
# frozen_string_literal: true

require 'jekyll'
require 'unf' # Required for proper UTF-8 slugification
# ודא ש- gem 'unf' מותקן

module Jekyll
  class ArtistPageGenerator < Generator
    safe true
    priority :lowest

    def generate(site)
      puts "ArtistPageGenerator: Starting generation..."

      # קריאת נתונים וקיבוץ (כמו קודם)
      unless site.data['all_songs']
        puts "ArtistPageGenerator: Error - site.data['all_songs'] not found."
        return
      end
      all_songs_data = site.data['all_songs']
      unless all_songs_data.is_a?(Array) && !all_songs_data.empty?
        puts "ArtistPageGenerator: Warning - site.data['all_songs'] is empty or not an array."
        return
      end
      singers = all_songs_data.group_by { |song| song['singer'] }.compact # Use compact to remove nil singer group

      puts "ArtistPageGenerator: Grouped songs into #{singers.keys.length} singers."

      target_dir = 'artists' # Relative to site.source

      singers.each do |singer_name, songs|
        next if singer_name.nil? || singer_name.strip.empty? # Skip if singer name is missing

        safe_singer_slug = create_slug(singer_name)
        page_name = "#{safe_singer_slug}.md" # Just the filename

        puts "ArtistPageGenerator: Preparing page for '#{singer_name}' -> #{target_dir}/#{page_name}"

        # --- שינוי: יצירת דף סטנדרטי והזנת הנתונים ---
        page = Page.new(site, site.source, target_dir, page_name)

        # הכנת נתוני השירים עבור Front Matter
        page_songs = songs.map do |song|
          {
            'number' => song['serial'],
            'name' => song['name'],
            'album' => song['album'],
            'artist' => song['singer'],
            'driveId' => song['driveId']
          }.compact # Remove nil values if any field is missing
        end

        # הגדרת Front Matter ישירות על אובייקט הדף
        page.data['layout'] = 'artist'
        page.data['name'] = singer_name # For compatibility if layout uses it
        page.data['title'] = singer_name
        page.data['description'] = "דף האמן #{singer_name} בשיר-בוט"
        page.data['keywords'] = "שירים, מוזיקה, #{singer_name}, שיר-בוט"
        page.data['songs'] = page_songs

        # --- סוף שינוי ---

        site.pages << page # הוסף את הדף לרשימת הדפים לעיבוד
      end

      puts "ArtistPageGenerator: Finished generation."
    end

    private

    # פונקציית יצירת slug (נשארת זהה)
    def create_slug(text)
      # ... (אותה לוגיקה עם UNF) ...
       normalized_text = UNF::Normalizer.normalize(text, :nfkc).downcase rescue text.downcase # Fallback if UNF fails
       slug = normalized_text.gsub(/[^a-z0-9\u0590-\u05FF\-_\.]/i, '-') # Allow Hebrew, numbers, -, _, .
       slug.gsub!(/\s+/, '-') # Replace spaces with hyphens
       slug.gsub!(/-+/, '-') # Replace multiple hyphens with one
       slug.gsub!(/^-+|-+$/, '') # Remove leading/trailing hyphens
       slug = "artist" if slug.empty?
       slug
    end
  end

end