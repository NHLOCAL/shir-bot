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
    end
    def read_yaml(*)
    end
  end
  class ArtistPageGenerator < Generator
    safe true
    priority :lowest
    def generate(site)
      puts "ArtistPageGenerator: Starting generation..."
      unless site.data['all_songs']
        puts "ArtistPageGenerator: Error - site.data['all_songs'] not found. Check _data folder/files."
        return
      end
      all_songs_data = site.data['all_songs']
      unless all_songs_data.is_a?(Array) && !all_songs_data.empty?
        puts "ArtistPageGenerator: Warning - site.data['all_songs'] is empty or not an array."
      end
      singers = all_songs_data.group_by { |song| song['singer'] }.compact
      puts "ArtistPageGenerator: Grouped songs into #{singers.size} artist groups."
      target_dir_base = 'artists'
      generated_count = 0
      skipped_word_count = 0
      singers.each do |singer_name, songs|
        next if singer_name.nil? || singer_name.strip.empty?
        word_count = singer_name.split.length
        if word_count > 3
          skipped_word_count += 1
          next
        end
        safe_singer_slug = create_slug(singer_name)
        next if safe_singer_slug.nil? || safe_singer_slug.strip.empty?
        artist_output_dir = File.join(target_dir_base, safe_singer_slug)
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
    end
    private
    def create_slug(text)
       return nil if text.nil?
       text = text.to_s
       begin
         normalized_text = UNF::Normalizer.normalize(text, :nfkc).downcase
         slug = normalized_text.gsub(/[^a-z0-9\u0590-\u05ff\-\.\']/i, '-')
         slug.gsub!(/\s+/, '-')
         slug.gsub!(/-+/, '-')
         slug.gsub!(/^-+|-+$/, '')
         slug = "artist" if slug.empty?
         return slug
       rescue => e
         puts "Error creating slug for '#{text}': #{e.message}"
         return text.to_s.downcase.gsub(/[^a-z0-9\-]/, '-').gsub(/-+/, '-').gsub(/^-+|-+$/, '')
       end
    end
  end
end