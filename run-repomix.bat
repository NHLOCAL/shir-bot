@echo off
npx repomix --ignore "_artists/,_site/,.jekyll-cache/,**/*.csv,assets/data/singers_list.txt,repomix-output.xml" "docs" --style markdown
pause