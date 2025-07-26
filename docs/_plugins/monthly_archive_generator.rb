require 'jekyll'
require 'unf'

module Jekyll

  def self.create_slug_for_archive(text)
    return nil if text.nil?
    text = text.to_s

    begin
      normalized_text = UNF::Normalizer.normalize(text, :nfkc).downcase
      slug = normalized_text.gsub(/[^a-z0-9\u0590-\u05ff\-\.\']/i, '-')
      slug.gsub!(/\s+/, '-')
      slug.gsub!(/-+/, '-')
      slug.gsub!(/^-+|-+$/, '')
      slug = "archive-month" if slug.empty?
      return slug
    rescue => e
      puts "Error creating slug for '#{text}': #{e.message}. Using basic slug."
      return text.to_s.downcase.gsub(/[^a-z0-9\-]/, '-').gsub(/-+/, '-').gsub(/^-+|-+$/, '')
    end
  end

  class MonthlyArchivePage < Page
    def initialize(site, base, dir_slug, album_name, songs_for_album)
      @site = site
      @base = base
      @dir = File.join('archive', dir_slug)
      @name = 'index.html'

      self.process(@name)

      # --- START OF FIX ---
      # BEFORE (Original code that was causing issues):
      # self.read_yaml(File.join(base, '_layouts'), 'monthly_archive.html')
      # self.data['layout'] = 'monthly_archive'
      #
      # AFTER (The same direct approach that worked for artists):
      # We explicitly tell the page to use the 'redirect' layout.
      self.data = site.layouts['redirect'].data.dup
      self.data['layout'] = 'redirect'
      # --- END OF FIX ---

      # This data is still useful, so we keep it.
      self.data['title'] = "ארכיון - #{album_name}"
      self.data['album_name'] = album_name
      self.data['songs'] = songs_for_album
      self.data['description'] = "ארכיון שירים מהחודש #{album_name} באתר שיר-בוט."
      self.data['keywords'] = "ארכיון, #{album_name}, מוזיקה, שירים, שיר-בוט"
      self.data['sitemap'] = false
    end
  end

  class MonthlyArchiveGenerator < Generator
    safe true
    priority :low

    def generate(site)
      return unless site.layouts.key? 'redirect' # Safety check

      puts "MonthlyArchiveGenerator: Starting generation..."

      unless site.data['new_songs'] && site.data['new_songs'].is_a?(Array)
        puts "MonthlyArchiveGenerator: site.data['new_songs'] not found or not an array. Skipping."
        return
      end

      all_new_songs = site.data['new_songs']
      if all_new_songs.empty?
        puts "MonthlyArchiveGenerator: site.data['new_songs'] is empty. Skipping."
        return
      end

      unique_albums_in_order = all_new_songs.map { |song| song['album'] }.uniq.compact
      puts "MonthlyArchiveGenerator: Found #{unique_albums_in_order.size} unique album names: #{unique_albums_in_order.join(', ')}"

      num_albums_for_current_page = 3
      
      current_display_albums = []
      archive_albums_details = []

      if unique_albums_in_order.size <= num_albums_for_current_page
        current_display_albums = unique_albums_in_order.dup
        puts "MonthlyArchiveGenerator: #{unique_albums_in_order.size} <= #{num_albums_for_current_page} albums. All will be on new-songs page."
      else
        current_display_albums = unique_albums_in_order.last(num_albums_for_current_page)
        archive_album_names = unique_albums_in_order.first(unique_albums_in_order.size - num_albums_for_current_page)
        
        archive_album_names.each do |album_name|
          slug = Jekyll.create_slug_for_archive(album_name)
          archive_albums_details << { 'name' => album_name, 'slug' => slug, 'url' => "/archive/#{slug}/" }
        end
        puts "MonthlyArchiveGenerator: Displaying on new-songs: #{current_display_albums.join(', ')}"
        puts "MonthlyArchiveGenerator: Archiving: #{archive_album_names.join(', ')}"
      end

      site.data['generated_archive_settings'] = {
        'current_display_album_names' => current_display_albums,
        'archive_albums_list' => archive_albums_details
      }
      
      puts "MonthlyArchiveGenerator: current_display_album_names set in site.data: #{current_display_albums.join(', ')}"
 
      generated_pages_count = 0
      archive_albums_details.each do |album_detail|
        album_name_for_page = album_detail['name']
        album_slug_for_page = album_detail['slug']

        songs_for_this_album = all_new_songs.select { |song| song['album'] == album_name_for_page }
        
        sorted_songs_for_album = songs_for_this_album.sort_by { |s| s['serial'].to_i }.reverse

        if sorted_songs_for_album.empty?
          puts "MonthlyArchiveGenerator: No songs found for album '#{album_name_for_page}', skipping page generation."
          next
        end
        
        puts "MonthlyArchiveGenerator: Generating page for archived album '#{album_name_for_page}' at /archive/#{album_slug_for_page}/"
        site.pages << MonthlyArchivePage.new(site, site.source, album_slug_for_page, album_name_for_page, sorted_songs_for_album)
        generated_pages_count += 1
      end

      puts "MonthlyArchiveGenerator: Finished. Generated #{generated_pages_count} monthly archive pages."
    end
  end
end