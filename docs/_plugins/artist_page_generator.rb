# File: _plugins/artist_page_generator.rb
require 'jekyll'
require 'unf' # Make sure this is installed or part of Gemfile

module Jekyll
  class ArtistPageGenerator < Generator
    safe true
    priority :lowest

    def generate(site)
      puts "ArtistPageGenerator: Starting generation..."

      # Ensure all_songs data exists and is valid
      unless site.data['all_songs']
        puts "ArtistPageGenerator: Error - site.data['all_songs'] not found."
        return
      end
      all_songs_data = site.data['all_songs']
      unless all_songs_data.is_a?(Array) && !all_songs_data.empty?
        puts "ArtistPageGenerator: Warning - site.data['all_songs'] is empty or not an array."
        return
      end

      # Group songs by singer
      singers = all_songs_data.group_by { |song| song['singer'] }.compact
      puts "ArtistPageGenerator: Grouped songs into #{singers.keys.length} unique singer names initially."

      target_dir = 'artists'

      generated_count = 0 # Counter for generated pages

      singers.each do |singer_name, songs|
        # --- Existing check: Skip nil or empty names ---
        next if singer_name.nil? || singer_name.strip.empty?

        # --- <<< NEW CHECK: Skip if singer name has more than 3 words >>> ---
        # Split the name by whitespace and count the resulting words.
        word_count = singer_name.split.length
        if word_count > 3
          # Optional: Log skipped artists for debugging
          # puts "ArtistPageGenerator: Skipping '#{singer_name}' (word count: #{word_count} > 3)"
          next # Skip to the next singer
        end
        # --- <<< End of NEW CHECK >>> ---

        # --- Existing Logic (only runs if checks above pass) ---
        safe_singer_slug = create_slug(singer_name)
        page_name = "#{safe_singer_slug}.md"

        # Log the preparation (only for artists that passed the check)
        puts "ArtistPageGenerator: Preparing page for '#{singer_name}' -> #{target_dir}/#{page_name}"

        # Create a new Page instance
        page = Page.new(site, site.source, target_dir, page_name)

        # Map song data for the page
        page_songs = songs.map do |song|
          {
            'number' => song['serial'],
            'name' => song['name'],
            'album' => song['album'],
            'artist' => song['singer'],
            'driveId' => song['driveId'] # Include driveId if available
          }.compact # Remove nil values just in case
        end

        # Set page data (front matter)
        page.data['layout'] = 'artist'
        page.data['name'] = singer_name # Original name
        page.data['title'] = singer_name # Page title
        page.data['description'] = "דף האמן #{singer_name} בשיר-בוט"
        page.data['keywords'] = "שירים, מוזיקה, #{singer_name}, שיר-בוט"
        page.data['songs'] = page_songs

        # Add the page to the site's pages collection
        site.pages << page
        generated_count += 1
      end

      puts "ArtistPageGenerator: Finished generation. Generated #{generated_count} artist pages (out of #{singers.keys.length} initial singers)."
    end

    private

    # Function to create a URL-safe slug from text
    def create_slug(text)
       # Ensure text is a string before processing
       text = text.to_s
       # Normalize, downcase, replace non-alphanumeric (allowing Hebrew), handle spaces/hyphens
       normalized_text = UNF::Normalizer.normalize(text, :nfkc).downcase rescue text.downcase
       slug = normalized_text.gsub(/[^a-z0-9\u0590-\u05FF\-_\.]/i, '-') # Allow letters, numbers, Hebrew, hyphen, underscore, dot
       slug.gsub!(/\s+/, '-')    # Replace whitespace with hyphens
       slug.gsub!(/-+/, '-')     # Collapse multiple hyphens
       slug.gsub!(/^-+|-+$/, '') # Trim leading/trailing hyphens
       slug = "artist" if slug.empty? # Fallback for empty slugs
       slug
    end
  end
end