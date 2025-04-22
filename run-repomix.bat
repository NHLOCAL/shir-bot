@echo off
npx repomix --ignore "_artists/,_site/,.jekyll-cache/,**/*.csv,assets/data/singers_list.txt,repomix-output.xml,_data/new_songs.yml" "docs" --style markdown --remove-comments
pause