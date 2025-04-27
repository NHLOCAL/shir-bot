# File: _plugins/artist_page_generator.rb
# frozen_string_literal: true

require 'jekyll'
require 'unf' # Required for proper UTF-8 slugification

module Jekyll
  # Custom generator for creating artist pages from _data/all_songs.yml
  class ArtistPageGenerator < Generator
    safe true
    priority :lowest

    def generate(site)
      puts "ArtistPageGenerator: Starting generation..."

      # Check if data exists
      unless site.data['all_songs']
        puts "ArtistPageGenerator: Error - site.data['all_songs'] not found. Ensure _data/all_songs.yml exists and is loaded."
        return
      end

      all_songs_data = site.data['all_songs']
      if !all_songs_data.is_a?(Array) || all_songs_data.empty?
        puts "ArtistPageGenerator: Warning - site.data['all_songs'] is empty or not an array."
        return
      end

      puts "ArtistPageGenerator: Found #{all_songs_data.length} songs in site.data['all_songs']."

      # Group songs by singer
      singers = all_songs_data.group_by { |song| song['singer'] }

      puts "ArtistPageGenerator: Grouped songs into #{singers.keys.length} singers."

      # Define the target directory within the source
      target_dir = 'artists' # We'll generate files into a source folder named 'artists'

      # Ensure the target directory exists in the source
      source_target_path = File.join(site.source, target_dir)
      FileUtils.mkdir_p(source_target_path) unless Dir.exist?(source_target_path)

      # Create a page for each singer
      singers.each do |singer_name, songs|
        next if singer_name.nil? || singer_name.strip.empty? # Skip if singer name is missing

        # Create a URL-safe slug from the singer name (handling Hebrew)
        safe_singer_slug = create_slug(singer_name)
        page_path = File.join(target_dir, "#{safe_singer_slug}.md")

        puts "ArtistPageGenerator: Generating page for '#{singer_name}' at #{page_path}"

        # Create a new Page instance
        page = ArtistPage.new(site, site.source, target_dir, "#{safe_singer_slug}.md", singer_name, songs)
        site.pages << page
      end

      puts "ArtistPageGenerator: Finished generation."
    end

    private

    # Function to create a URL-friendly slug (handles Hebrew)
    def create_slug(text)
      # Normalize Unicode characters (important for consistent slugification)
      normalized_text = UNF::Normalizer.normalize(text, :nfkc).downcase
      # Replace spaces and invalid characters with hyphens
      slug = normalized_text.gsub(/[\s.\/\\?%*:|"<>]+/, '-')
      # Remove leading/trailing hyphens
      slug.gsub!(/^-+|-+$/, '')
      # Ensure it's not empty
      slug = "artist" if slug.empty?
      slug
    end
  end

  # Custom Page class to handle artist pages
  class ArtistPage < Page
    def initialize(site, base, dir, name, singer_name, songs)
      super(site, base, dir, name)

      # Prepare songs data for Front Matter (select relevant fields)
      page_songs = songs.map do |song|
        {
          'number' => song['serial'],
          'name' => song['name'],
          'album' => song['album'],
          'artist' => song['singer'], # Redundant but matches original layout expectation
          'driveId' => song['driveId'] # Include driveId
        }
      end

      # Set the Front Matter data for the page
      self.data['layout'] = 'artist'
      self.data['name'] = singer_name # Used by the layout/collection logic before
      self.data['title'] = singer_name
      self.data['description'] = "דף האמן #{singer_name} בשיר-בוט"
      self.data['keywords'] = "שירים, מוזיקה, #{singer_name}, שיר-בוט"
      # Permalink is automatically handled by Jekyll based on file path (artists/slug.html)
      # self.data['permalink'] = "/artists/#{create_slug(singer_name)}/" # Define explicitly if needed
      self.data['songs'] = page_songs # Add the list of songs
    end

    # Helper method (needed if used in initialize's permalink)
    def create_slug(text)
       normalized_text = UNF::Normalizer.normalize(text, :nfkc).downcase
       slug = normalized_text.gsub(/[\s.\/\\?%*:|"<>]+/, '-')
       slug.gsub!(/^-+|-+$/, '')
       slug = "artist" if slug.empty?
       slug
    end
  end
end